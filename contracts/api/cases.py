"""
Cases API views: list, detail, timeline, decision evaluation, arrangement alignment,
coordination overview, bulk update.
"""
import logging

from django.core.cache import cache
from django.db.models import Prefetch, Q
from django.http import Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
import json

_COORDINATION_OVERVIEW_CACHE_TTL = 60  # seconds

from contracts.domain.contracts import ListParams
from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    MatchResultaat,
    PlacementRequest,
)
from contracts.tenancy import (
    get_scoped_object_or_404,
    get_user_organization,
    scope_queryset_for_organization,
)
from contracts.permissions import (
    CaseAction,
    can_access_case_action,
    ensure_provider_case_visible_or_404,
    filter_care_cases_for_provider_actor,
)
from contracts.arrangement_alignment import build_arrangement_alignment_payload
from contracts.decision_engine import build_coordination_decision_overview, evaluate_case
from contracts.observability import log_escalation_hint
from contracts.case_timeline import serialize_timeline_events_for_api
from contracts.models import CaseTimelineEvent
from django.utils import timezone

from contracts.api._helpers import (
    _active_organization,
    _build_case_data,
    _internal_server_error,
    _minimal_case_list_entry,
)

logger = logging.getLogger(__name__)


@login_required
@require_http_methods(["GET"])
def contracts_api(request):
    """
    API endpoint for listing cases with filtering and pagination.
    Used by the CareOn case workspace UI.
    """
    try:
        # Parse filters from request
        params = ListParams(
            q=request.GET.get('q', ''),
            status=[s for s in request.GET.getlist('status') if s],
            contract_type=[t for t in request.GET.getlist('contract_type') if t],
            sort=request.GET.get('sort', 'updated_desc'),
            page=int(request.GET.get('page', 1)),
            page_size=int(request.GET.get('page_size', 25))
        )

        organization = get_user_organization(request.user)
        queryset = scope_queryset_for_organization(
            CareCase.objects.select_related(
                'due_diligence_process',
                'due_diligence_process__care_category_main',
                'due_diligence_process__care_category_sub',
                'due_diligence_process__regio',
                'due_diligence_process__preferred_region',
                'due_diligence_process__gemeente',
                'due_diligence_process__herkomst_gemeente',
                'due_diligence_process__verantwoordelijke_gemeente',
                'due_diligence_process__verblijfsgemeente',
                'due_diligence_process__zorgregio',
                'due_diligence_process__plaatsingsregio',
                'due_diligence_process__contractregio',
                'due_diligence_process__escalatie_regio',
                'due_diligence_process__case_assessment',
                'created_by',
            ).prefetch_related(
                Prefetch(
                    'due_diligence_process__indications',
                    queryset=PlacementRequest.objects.order_by('-updated_at'),
                ),
            ),
            organization,
        ).exclude(lifecycle_stage='ARCHIVED')
        queryset = filter_care_cases_for_provider_actor(queryset, request.user, organization)

        if params.q:
            queryset = queryset.filter(
                Q(title__icontains=params.q)
                | Q(preferred_provider__icontains=params.q)
                | Q(content__icontains=params.q)
            )

        if params.status:
            queryset = queryset.filter(status__in=params.status)

        responsible_municipality = str(request.GET.get('verantwoordelijke_gemeente') or '').strip()
        zorgregio_filter = str(request.GET.get('zorgregio') or '').strip()
        plaatsingsregio_filter = str(request.GET.get('plaatsingsregio') or '').strip()
        verblijfsgemeente_filter = str(request.GET.get('verblijfsgemeente') or '').strip()
        escalatie_regio_filter = str(request.GET.get('escalatie_regio') or '').strip()
        requires_revalidation = str(request.GET.get('requires_revalidation') or '').strip().lower() in {'1', 'true', 'yes', 'on'}
        cross_region_only = str(request.GET.get('cross_region') or '').strip().lower() in {'1', 'true', 'yes', 'on'}

        if responsible_municipality.isdigit():
            queryset = queryset.filter(verantwoordelijke_gemeente_id=int(responsible_municipality))
        if zorgregio_filter.isdigit():
            queryset = queryset.filter(zorgregio_id=int(zorgregio_filter))
        if plaatsingsregio_filter.isdigit():
            queryset = queryset.filter(plaatsingsregio_id=int(plaatsingsregio_filter))
        if verblijfsgemeente_filter.isdigit():
            queryset = queryset.filter(verblijfsgemeente_id=int(verblijfsgemeente_filter))
        if escalatie_regio_filter.isdigit():
            queryset = queryset.filter(escalatie_regio_id=int(escalatie_regio_filter))
        if requires_revalidation or cross_region_only:
            queryset = queryset.filter(requires_revalidation=True)

        if params.sort == 'updated_asc':
            queryset = queryset.order_by('updated_at')
        elif params.sort == 'title':
            queryset = queryset.order_by('title')
        elif params.sort == 'status':
            queryset = queryset.order_by('status')
        else:
            queryset = queryset.order_by('-updated_at')

        paginator = Paginator(queryset, params.page_size)
        page_obj = paginator.get_page(params.page)

        # Data-minimization: list endpoint exposes only `has_case_geo: bool`.
        # Raw `case_geo` payload (postcode/coordinates) is intentionally restricted
        # to the detail endpoint at line ~486. See test_case_api_workflow_state.py
        # `test_case_geo_is_exposed_in_detail_but_not_raw_in_list` for the contract.
        cases: list[dict] = []
        for case in page_obj:
            try:
                cases.append(_build_case_data(case))
            except Exception:
                logger.exception("contracts_api case_serialize_failed case_id=%s", getattr(case, "pk", "?"))
                cases.append(_minimal_case_list_entry(case))
        return JsonResponse({
            'contracts': cases,
            'total_count': paginator.count,
            'page': params.page,
            'page_size': params.page_size,
            'total_pages': paginator.num_pages,
        })

    except Exception:
        return _internal_server_error(request, context='cases_api_failed')

@login_required
@require_http_methods(["GET"])
def case_timeline_api(request, case_id):
    """Append-only operational timeline for a case (v1: gemeente validatie → aanbieder)."""
    try:
        organization = get_user_organization(request.user)
        case = get_scoped_object_or_404(
            CareCase.objects.all(),
            organization,
            pk=case_id,
        )
        ensure_provider_case_visible_or_404(request.user, case)
        qs = CaseTimelineEvent.objects.filter(
            organization=organization,
            care_case=case,
        ).order_by('occurred_at', 'id')
        events = serialize_timeline_events_for_api(qs)
        return JsonResponse({'caseId': str(case.pk), 'events': events})
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    except Exception:
        return _internal_server_error(request, context='case_timeline_api_failed')


@login_required
@require_http_methods(["GET"])
def case_detail_api(request, contract_id=None, case_id=None):
    """Get single case details."""
    try:
        record_id = case_id or contract_id
        if record_id is None:
            return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

        # Guard against route shadowing or malformed ids (e.g. "intake-form").
        try:
            record_id = int(record_id)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

        organization = get_user_organization(request.user)
        case = get_scoped_object_or_404(
            CareCase.objects.select_related(
                'due_diligence_process',
                'due_diligence_process__care_category_main',
                'due_diligence_process__care_category_sub',
                'due_diligence_process__regio',
                'due_diligence_process__preferred_region',
                'due_diligence_process__gemeente',
                'due_diligence_process__herkomst_gemeente',
                'due_diligence_process__verantwoordelijke_gemeente',
                'due_diligence_process__verblijfsgemeente',
                'due_diligence_process__zorgregio',
                'due_diligence_process__plaatsingsregio',
                'due_diligence_process__contractregio',
                'due_diligence_process__escalatie_regio',
                'due_diligence_process__case_assessment',
                'created_by',
            ).prefetch_related(
                Prefetch(
                    'due_diligence_process__indications',
                    queryset=PlacementRequest.objects.order_by('-updated_at'),
                ),
            ),
            organization,
            pk=record_id,
        )
        ensure_provider_case_visible_or_404(request.user, case)

        payload = _build_case_data(case, include_geo=True)
        payload['decision_evaluation'] = evaluate_case(case, actor=request.user)
        return JsonResponse(payload)

    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    except Exception:
        return _internal_server_error(request, context='case_detail_api_failed')


@login_required
@require_http_methods(["GET"])
def case_detail_string_fallback_api(request, case_ref):
    """Fail-safe route for non-numeric case identifiers under /api/cases/."""
    if str(case_ref).isdigit():
        return case_detail_api(request, case_id=int(case_ref))
    return JsonResponse({'error': 'Casus niet gevonden'}, status=404)


@login_required
@require_http_methods(["GET"])
def case_decision_evaluation_api(request, case_id):
    organization = get_user_organization(request.user)
    try:
        case = get_scoped_object_or_404(CareCase.objects.all(), organization, pk=case_id)
        ensure_provider_case_visible_or_404(request.user, case)
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    if not can_access_case_action(request.user, case, CaseAction.VIEW):
        return JsonResponse({'error': 'Je hebt geen rechten om deze casus te bekijken.'}, status=403)

    return JsonResponse(evaluate_case(case, actor=request.user))


@login_required
@require_http_methods(["GET"])
def case_arrangement_alignment_api(request, case_id):
    """Read-only advisory hints for arrangement / tariff alignment (v1.3 staging)."""
    organization = get_user_organization(request.user)
    try:
        case = get_scoped_object_or_404(
            CareCase.objects.select_related('due_diligence_process'),
            organization,
            pk=case_id,
        )
        ensure_provider_case_visible_or_404(request.user, case)
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    if not can_access_case_action(request.user, case, CaseAction.VIEW):
        return JsonResponse({'error': 'Je hebt geen rechten om deze casus te bekijken.'}, status=403)
    intake = getattr(case, 'due_diligence_process', None)
    if intake is None:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    payload = build_arrangement_alignment_payload(intake=intake, case_id=str(case.pk))
    return JsonResponse(payload)


@login_required
@require_http_methods(["GET"])
def coordination_decision_overview_api(request):
    try:
        organization = _active_organization(request)
        if organization is None:
            return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

        try:
            cases = scope_queryset_for_organization(
                CareCase.objects.select_related(
                    'due_diligence_process',
                    'due_diligence_process__case_assessment',
                ).prefetch_related(
                    Prefetch(
                        'due_diligence_process__indications',
                        queryset=PlacementRequest.objects.select_related(
                            'selected_provider', 'proposed_provider'
                        ).order_by('-updated_at', '-created_at'),
                    ),
                    Prefetch(
                        'match_resultaten',
                        queryset=MatchResultaat.objects.select_related(
                            'zorgaanbieder', 'zorgprofiel'
                        ).order_by('-created_at'),
                    ),
                ),
                organization,
            ).exclude(
                Q(lifecycle_stage='ARCHIVED') | Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
            )
            cases = filter_care_cases_for_provider_actor(cases, request.user, organization)
        except Exception:
            logger.exception(
                "coordination_cases_queryset_failed org_id=%s user_id=%s",
                getattr(organization, "pk", "?"),
                getattr(request.user, "pk", "?"),
            )
            cases = CareCase.objects.none()

        cache_key = f"coord_overview_org_{organization.pk}_user_{request.user.pk}"
        payload = cache.get(cache_key)
        if payload is None:
            payload = build_coordination_decision_overview(
                cases,
                actor=request.user,
                organization=organization,
            )
            cache.set(cache_key, payload, _COORDINATION_OVERVIEW_CACHE_TTL)
        totals = payload.get('totals') or {}
        try:
            critical_blockers = int(totals.get('critical_blockers') or 0)
        except (TypeError, ValueError):
            critical_blockers = 0
        if critical_blockers > 0:
            try:
                log_escalation_hint(
                    'COORDINATION_CRITICAL_BLOCKERS',
                    extra={
                        'critical_blockers': totals.get('critical_blockers'),
                        'active_cases': totals.get('active_cases'),
                    },
                )
            except Exception:
                logger.exception("coordination_escalation_hint_failed")
        try:
            return JsonResponse(payload)
        except Exception:
            logger.exception(
                "coordination_json_encode_failed correlation_id=%s",
                getattr(request, "correlation_id", None),
            )

            def _safe_totals_int(key: str, default: int = 0) -> int:
                try:
                    return int((totals or {}).get(key) or default)
                except (TypeError, ValueError):
                    return default

            return JsonResponse(
                {
                    "generated_at": timezone.now().isoformat(),
                    "totals": {
                        "active_cases": _safe_totals_int("active_cases"),
                        "critical_blockers": critical_blockers,
                        "high_priority_alerts": _safe_totals_int("high_priority_alerts"),
                        "provider_sla_breaches": _safe_totals_int("provider_sla_breaches"),
                        "repeated_rejections": _safe_totals_int("repeated_rejections"),
                        "intake_delays": _safe_totals_int("intake_delays"),
                    },
                    "items": [],
                    "governance_queues": {},
                    "degraded": True,
                    "degraded_reason": "response_serialization_failed",
                },
                status=200,
            )
    except Exception:
        return _internal_server_error(request, context='coordination_decision_overview_api_failed')


regiekamer_decision_overview_api = coordination_decision_overview_api

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def cases_bulk_update_api(request):
    """Bulk update cases."""
    try:
        data = json.loads(request.body)
        case_ids = data.get('case_ids', data.get('contract_ids', []))
        updates = data.get('updates', {})

        _BULK_UPDATE_ALLOWED_FIELDS = frozenset({
            'title',
            'content',
            'risk_level',
            'policy_framework',
            'service_region',
            'preferred_provider',
            'contract_type',
            'value',
            'currency',
            'start_date',
            'end_date',
            'renewal_date',
            'auto_renew',
            'notice_period_days',
            'language',
            'data_transfer_flag',
            'dpa_attached',
            'scc_attached',
        })
        blocked_fields = sorted(field for field in updates.keys() if field not in _BULK_UPDATE_ALLOWED_FIELDS)
        if blocked_fields:
            return JsonResponse(
                {
                    'success': False,
                    'error': 'Eén of meer velden zijn niet toegestaan in bulk updates.',
                    'blocked_fields': blocked_fields,
                },
                status=400,
            )

        organization = get_user_organization(request.user)
        queryset = scope_queryset_for_organization(
            CareCase.objects.filter(id__in=case_ids).exclude(lifecycle_stage='ARCHIVED'),
            organization,
        )
        queryset = filter_care_cases_for_provider_actor(queryset, request.user, organization)
        result = queryset.update(**updates)

        return JsonResponse({'success': True, 'updated_count': result})

    except Exception:
        return _internal_server_error(request, context='cases_bulk_update_api_failed')
