
"""
API views for CareOn case workspace functionality.
"""
import json
import logging
import re
import sys
from datetime import date

from django.conf import settings
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone

from contracts.domain.contracts import CareCaseData, ListParams, ListResult
from contracts.forms import CaseIntakeProcessForm
from contracts.middleware import log_action
from contracts.observability import log_escalation_hint
from contracts.arrangement_alignment import build_arrangement_alignment_payload
from contracts.decision_engine import build_regiekamer_decision_overview, evaluate_case
from contracts.governance import AuditLoggingError, log_case_decision_event
from contracts.care_lifecycle_v12 import (
    sync_placement_budget_review_flags,
    care_form_requires_budget_review,
    effective_care_form_code,
    serialize_evaluation,
)
from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseCareEvaluation,
    CaseDecisionLog,
    CaseTimelineEvent,
    PlacementRequest,
    ProviderCareTransitionRequest,
    CareSignal,
    CareTask,
    Document,
    AuditLog,
    Client,
    ProviderProfile,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    RegionalConfiguration,
    CaseIntakeProcess,
    OutcomeReasonCode,
    RegionType,
    MatchResultaat,
)
from contracts.tenancy import (
    ensure_user_organization,
    get_scoped_object_or_404,
    get_user_organization,
    scope_queryset_for_organization,
    set_organization_on_instance,
)
from contracts.permissions import (
    CaseAction,
    can_access_case_action,
    ensure_provider_case_visible_or_404,
    filter_care_cases_for_provider_actor,
    filter_care_signals_for_provider_actor,
    filter_care_tasks_for_provider_actor,
    filter_documents_for_provider_actor,
    filter_placement_requests_for_provider_actor,
    visible_provider_scoped_care_cases,
)
from contracts.provider_workspace import build_provider_workspace_summary
from contracts.legacy_backend.provider_matching_service import MatchContext, MatchEngine
from contracts.views import _assign_provider_to_intake, _prepare_waitlist_proposal_for_intake
from contracts.case_timeline import (
    record_gemeente_validation_to_provider_review_boundary,
    serialize_timeline_events_for_api,
)
from contracts.navigation import SPA_DASHBOARD_URL
from contracts.operational_failures import build_operational_failure_payload
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    derive_workflow_state,
    evaluate_transition,
    log_transition_event,
    normalize_provider_rejection_states,
    resolve_actor_role,
)

logger = logging.getLogger(__name__)

# SPA InfoRequestType slugs (client/src/hooks/useProviderEvaluations.ts) — stored in
# PlacementRequest.provider_response_notes for INFO_REQUESTED via ``[INFO_TYPE:slug]`` prefix.
_SPA_INFO_REQUEST_TYPES = frozenset({
    'medische_informatie',
    'woonsituatie',
    'financiele_situatie',
    'gezinssituatie',
    'diagnostiek',
    'andere_informatie',
})
_INFO_TYPE_NOTES_PREFIX = re.compile(r'^\[INFO_TYPE:([a-z0-9_]+)\]\s*\n?', re.IGNORECASE)


def _compose_provider_info_request_notes(*, info_type: str, body: str) -> str:
    slug = (info_type or '').strip().lower()
    body = (body or '').strip()
    if slug in _SPA_INFO_REQUEST_TYPES and body:
        return f'[INFO_TYPE:{slug}]\n{body}'
    return body


def _parse_provider_info_request_notes(raw: str) -> tuple[str | None, str]:
    """Split optional ``[INFO_TYPE:slug]`` storage prefix from provider_response_notes."""
    s = (raw or '').strip()
    if not s:
        return None, ''
    m = _INFO_TYPE_NOTES_PREFIX.match(s)
    if not m:
        return None, s
    slug = m.group(1).lower()
    rest = s[m.end():].strip()
    if slug not in _SPA_INFO_REQUEST_TYPES:
        return None, s
    return slug, rest


def _evaluation_client_label(case: CareCase | None) -> str:
    """Pseudonymous label aligned with SPA ``formatClientReference`` (casus id, not free-text naam)."""
    if case is None:
        return 'Aanvrager'
    digits = ''.join(c for c in str(case.pk) if c.isdigit())
    if not digits:
        return 'Aanvrager'
    return f'CLI-{digits.zfill(5)[-5:]}'


def _derive_aanmelder_actor_profile_for_intake(*, actor_role: str, entry_route: str) -> str:
    """
    Product-hint (cliëntaanbieder-kanaal) voor audit/rapportage; geen permissies.
    """
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        return CaseIntakeProcess.AanmelderActorProfile.ZORGAANBIEDER_ORG
    if actor_role == WorkflowRole.ADMIN:
        return CaseIntakeProcess.AanmelderActorProfile.ADMIN
    if actor_role == WorkflowRole.GEMEENTE:
        if entry_route == CaseIntakeProcess.EntryRoute.WIJKTEAM:
            return CaseIntakeProcess.AanmelderActorProfile.WIJKTEAM
        return CaseIntakeProcess.AanmelderActorProfile.GEMEENTE_AMBTELIJK
    return CaseIntakeProcess.AanmelderActorProfile.ONBEKEND

MIN_SUMMARY_CONTEXT_LEN = 24


def _active_organization(request):
    """Resolve org for API calls; prefers middleware-cached request.organization when set."""
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    org = getattr(request, 'organization', None)
    if org is not None:
        return org
    organization = get_user_organization(user)
    if organization is None:
        try:
            organization = ensure_user_organization(user)
        except Exception:
            logger.exception(
                "active_organization_provision_failed user_id=%s",
                getattr(user, "pk", "?"),
            )
            return None
    return organization


def _workflow_summary_complete(*, assessment: CaseAssessment | None, intake: CaseIntakeProcess) -> tuple[bool, str]:
    """Pilot samenvatting gate vóór matching (structured summary + urgency)."""
    if assessment is None:
        return False, 'Casusbeoordeling ontbreekt.'
    ws = assessment.workflow_summary or {}
    context = (ws.get('context') or '').strip()
    if len(context) < MIN_SUMMARY_CONTEXT_LEN:
        return False, (
            f'Samenvatting (context) moet minstens {MIN_SUMMARY_CONTEXT_LEN} tekens bevatten vóór matching.'
        )
    if not (intake.urgency or '').strip():
        return False, 'Urgentie is verplicht op de casus.'
    if 'risks' not in ws:
        return False, 'Vul het veld risico\'s in (of vink aan: geen aanvullende risico\'s).'
    risks = ws.get('risks')
    if not isinstance(risks, list):
        return False, 'Risico\'s moeten als lijst worden aangeleverd.'
    if len(risks) == 0 and not ws.get('risks_none_ack'):
        return False, 'Voeg risico\'s toe of bevestig expliciet dat er geen aanvullende risico\'s zijn.'
    return True, ''


def _draft_validation_placement(*, request, intake, provider, validation_context):
    """Persist DRAFT placement after gemeente validatie (vóór verzenden naar aanbieder)."""
    notes_payload = json.dumps(
        {
            'kind': 'gemeente_validatie_concept',
            'provider_id': provider.pk,
            'match': validation_context or {},
        },
        ensure_ascii=False,
    )
    placement, created = PlacementRequest.objects.get_or_create(
        due_diligence_process=intake,
        defaults={
            'status': PlacementRequest.Status.DRAFT,
            'proposed_provider': provider,
            'selected_provider': provider,
            'care_form': intake.preferred_care_form or PlacementRequest.CareForm.OUTPATIENT,
            'decision_notes': notes_payload,
            'provider_response_status': PlacementRequest.ProviderResponseStatus.PENDING,
        },
    )
    if not created:
        placement.proposed_provider = provider
        placement.selected_provider = provider
        placement.status = PlacementRequest.Status.DRAFT
        placement.decision_notes = notes_payload
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
        if not placement.care_form:
            placement.care_form = intake.preferred_care_form or PlacementRequest.CareForm.OUTPATIENT
        placement.save(
            update_fields=[
                'proposed_provider',
                'selected_provider',
                'care_form',
                'status',
                'provider_response_status',
                'decision_notes',
                'updated_at',
            ]
        )
    log_action(
        request.user,
        AuditLog.Action.APPROVE,
        'GemeenteValidatieConcept',
        object_id=placement.id,
        object_repr=f'{intake.title} -> {provider.name} (concept)',
        changes={'intake_id': intake.id, 'provider_id': provider.id},
        request=request,
    )
    return placement


def _internal_server_error(request, *, context: str):
    """Log API failures with traceback (when inside except) and return calm operational JSON (5xx)."""
    cid = getattr(request, "correlation_id", None)
    cid_str = str(cid) if cid else None
    exc_info = sys.exc_info()
    if exc_info[0] is not None:
        logger.error(
            "api_error context=%s correlation_id=%s",
            context,
            cid_str or "-",
            exc_info=exc_info,
        )
    else:
        logger.error(
            "api_error context=%s correlation_id=%s (no active exception — check call site)",
            context,
            cid_str or "-",
        )
    body = build_operational_failure_payload(request, context=context)
    return JsonResponse(body, status=500)


_WORKFLOW_STATE_VALUES = {
    WorkflowState.DRAFT_CASE,
    WorkflowState.SUMMARY_READY,
    WorkflowState.MATCHING_READY,
    WorkflowState.GEMEENTE_VALIDATED,
    WorkflowState.PROVIDER_REVIEW_PENDING,
    WorkflowState.PROVIDER_ACCEPTED,
    WorkflowState.PROVIDER_REJECTED,
    WorkflowState.PLACEMENT_CONFIRMED,
    WorkflowState.INTAKE_STARTED,
    WorkflowState.ARCHIVED,
}


def _case_workflow_state(case):
    """
    Prefer persisted CaseIntakeProcess.workflow_state when set (authoritative for transitions).
    Otherwise derive from intake/placement (same logic as derive_workflow_state).
    API consumers should treat mismatch with placement_request_* as a signal to open the dossier,
    not auto-reconcile persisted workflow_state here (server transitions own writes).
    """
    try:
        intake = case.due_diligence_process
    except CaseIntakeProcess.DoesNotExist:
        intake = None

    persisted_state = str(getattr(intake, 'workflow_state', '') or '').strip() if intake is not None else ''
    if persisted_state in _WORKFLOW_STATE_VALUES:
        return persisted_state
    if intake is not None:
        return derive_workflow_state(intake=intake)
    if getattr(case, 'lifecycle_stage', '') == 'ARCHIVED':
        return WorkflowState.ARCHIVED
    return WorkflowState.DRAFT_CASE


def _get_intake_for_case_api_id(case_id, organization, *, lock=False, select_related=None, user=None):
    """
    URLs under /care/api/cases/<case_id>/ use the CareCase primary key for assessment,
    decision evaluation, and SPA calls. Resolve CaseIntakeProcess via CareCase.contract back-ref,
    not CaseIntakeProcess.pk (which may differ).
    """
    case_record = get_scoped_object_or_404(
        CareCase.objects.all(),
        organization,
        pk=case_id,
    )
    if user is not None:
        ensure_provider_case_visible_or_404(user, case_record)
    base_rel = ('contract', 'organization')
    extra = tuple(select_related) if select_related else ()
    qs = CaseIntakeProcess.objects.select_related(*base_rel, *extra)
    if lock:
        qs = qs.select_for_update(of=('self',))
    return get_scoped_object_or_404(
        qs,
        organization,
        contract=case_record,
    )


def _coerce_coordinate(value, *, minimum, maximum):
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    if numeric_value < minimum or numeric_value > maximum:
        return None
    return round(numeric_value, 6)


def _extract_coordinates(source):
    if source is None:
        return None, None

    candidate_pairs = (
        ('latitude', 'longitude'),
        ('lat', 'lng'),
        ('lat', 'lon'),
    )

    for latitude_attr, longitude_attr in candidate_pairs:
        if not hasattr(source, latitude_attr) or not hasattr(source, longitude_attr):
            continue

        latitude = _coerce_coordinate(getattr(source, latitude_attr, None), minimum=-90, maximum=90)
        longitude = _coerce_coordinate(getattr(source, longitude_attr, None), minimum=-180, maximum=180)
        if latitude is not None and longitude is not None:
            return latitude, longitude

    return None, None


def _first_related(queryset_or_manager):
    if queryset_or_manager is None:
        return None

    try:
        return queryset_or_manager.all().first()
    except AttributeError:
        return None


def _provider_location_payload(profile):
    primary_region = _first_related(profile.served_regions)
    municipality = _first_related(primary_region.served_municipalities) if primary_region else None
    region_label = primary_region.region_name if primary_region else ''
    municipality_label = municipality.municipality_name if municipality else ''
    location_label = profile.client.city or municipality_label or region_label or profile.service_area or 'Locatie ontbreekt'

    # Derive coordinates from available linked sources until explicit provider geo fields exist.
    sources = [profile, profile.client, primary_region, municipality]
    latitude = None
    longitude = None
    for source in sources:
        latitude, longitude = _extract_coordinates(source)
        if latitude is not None and longitude is not None:
            break

    return {
        'label': location_label,
        'latitude': latitude,
        'longitude': longitude,
        'region_label': region_label,
        'municipality_label': municipality_label,
        'has_coordinates': latitude is not None and longitude is not None,
    }


def _provider_regions_payload(profile):
    if profile is None:
        return {
            'primary_region_label': '',
            'secondary_region_labels': [],
            'all_region_labels': [],
        }

    primary_regions = list(profile.served_regions.all())
    secondary_regions = list(profile.secondary_served_regions.all())

    primary_label = primary_regions[0].region_name if primary_regions else ''
    secondary_labels = [region.region_name for region in secondary_regions]

    labels = []
    seen = set()
    for region in primary_regions + secondary_regions:
        key = (region.region_name or '').strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        labels.append(region.region_name)

    return {
        'primary_region_label': primary_label,
        'secondary_region_labels': secondary_labels,
        'all_region_labels': labels,
    }


def _safe_case_intake(case):
    """Return linked CaseIntakeProcess or None (OneToOne may not exist)."""
    try:
        return case.due_diligence_process
    except CaseIntakeProcess.DoesNotExist:
        return None


def _coerce_case_value_for_api(case) -> float | None:
    if not hasattr(case, "value"):
        return None
    raw = getattr(case, "value", None)
    if raw is None or raw == "":
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _case_owner_display(case) -> str:
    try:
        creator = getattr(case, "created_by", None)
        if creator is None:
            return "System"
        name = creator.get_full_name()
        return name.strip() if name else (getattr(creator, "username", None) or "System")
    except Exception:
        return "System"


def _minimal_case_list_entry(case: CareCase) -> dict:
    """Safe JSON row when full serialization fails (one bad dossier must not 500 the list)."""
    return {
        "id": str(case.pk),
        "title": (getattr(case, "title", None) or "Casus")[:200],
        "status": getattr(case, "status", None) or "DRAFT",
        "preferred_provider": getattr(case, "preferred_provider", "") or "",
        "value": None,
        "start_date": None,
        "end_date": None,
        "owner": _case_owner_display(case),
        "updated_at": case.updated_at.isoformat() if getattr(case, "updated_at", None) else None,
        "created_at": case.created_at.isoformat() if getattr(case, "created_at", None) else None,
        "content": "",
        "case_phase": getattr(case, "case_phase", "intake") or "intake",
        "risk_level": getattr(case, "risk_level", "LOW") or "LOW",
        "service_region": getattr(case, "service_region", "") or "",
        "contract_type": getattr(case, "contract_type", "") or "",
        "lifecycle_stage": getattr(case, "lifecycle_stage", "") or "",
        "workflow_state": WorkflowState.DRAFT_CASE,
        "arrangement_type_code": "",
        "arrangement_provider": "",
        "arrangement_end_date": None,
        "intake_start_date": None,
        "urgency_validated": False,
        "urgency_document_present": False,
        "urgency_granted_date": None,
        "placement_request_status": None,
        "placement_provider_response_status": None,
        "has_case_geo": False,
    }


def _build_case_data(case, *, include_geo=False):
    data = CareCaseData(
        id=str(case.id),
        title=case.title,
        status=case.status,
        preferred_provider=getattr(case, 'preferred_provider', ''),
        value=_coerce_case_value_for_api(case),
        start_date=case.start_date.isoformat() if hasattr(case, 'start_date') and case.start_date else None,
        end_date=case.end_date.isoformat() if hasattr(case, 'end_date') and case.end_date else None,
        owner=_case_owner_display(case),
        updated_at=case.updated_at.isoformat() if hasattr(case, 'updated_at') and case.updated_at else None,
        created_at=case.created_at.isoformat() if case.created_at else None,
        content=case.content or "",
    )
    # Extend with SPA-required fields not in CareCaseData dataclass
    result = data.to_dict()
    result['case_phase'] = getattr(case, 'case_phase', 'intake') or 'intake'
    result['risk_level'] = getattr(case, 'risk_level', 'LOW') or 'LOW'
    result['service_region'] = getattr(case, 'service_region', '') or ''
    result['contract_type'] = getattr(case, 'contract_type', '') or ''
    result['lifecycle_stage'] = getattr(case, 'lifecycle_stage', '') or ''
    try:
        result['workflow_state'] = _case_workflow_state(case)
    except Exception:
        logger.exception("case_workflow_state_failed case_id=%s", getattr(case, "pk", "?"))
        result['workflow_state'] = WorkflowState.DRAFT_CASE
    intake = _safe_case_intake(case)
    # Intake-backed fields for SPA (placement inference + urgency) when older clients omit workflow_state.
    if intake is not None:
        result['arrangement_type_code'] = (getattr(intake, 'arrangement_type_code', '') or '').strip()
        result['arrangement_provider'] = (getattr(intake, 'arrangement_provider', '') or '').strip()
        result['arrangement_end_date'] = (
            intake.arrangement_end_date.isoformat() if getattr(intake, 'arrangement_end_date', None) else None
        )
        result['intake_start_date'] = intake.start_date.isoformat() if getattr(intake, 'start_date', None) else None
        result['urgency_validated'] = bool(getattr(intake, 'urgency_validated', False))
        result['urgency_document_present'] = bool(getattr(intake, 'urgency_document', None))
        result['urgency_granted_date'] = (
            intake.urgency_granted_date.isoformat() if getattr(intake, 'urgency_granted_date', None) else None
        )
        # Latest placement row (same signals as derive_workflow_state) for SPA when workflow_state is absent/stale.
        try:
            placement_rows = list(intake.indications.all())
            placement = placement_rows[0] if placement_rows else None
            result['placement_request_status'] = placement.status if placement is not None else None
            result['placement_provider_response_status'] = (
                placement.provider_response_status if placement is not None else None
            )
        except Exception:
            logger.exception("case_placement_snapshot_failed case_id=%s", getattr(case, "pk", "?"))
            result['placement_request_status'] = None
            result['placement_provider_response_status'] = None
    else:
        result['arrangement_type_code'] = ''
        result['arrangement_provider'] = ''
        result['arrangement_end_date'] = None
        result['intake_start_date'] = None
        result['urgency_validated'] = False
        result['urgency_document_present'] = False
        result['urgency_granted_date'] = None
        result['placement_request_status'] = None
        result['placement_provider_response_status'] = None
    has_case_geo = bool(
        intake and getattr(intake, 'latitude', None) is not None and getattr(intake, 'longitude', None) is not None
    )
    result['has_case_geo'] = has_case_geo
    if include_geo:
        result['case_geo'] = {
            'postcode': str(getattr(intake, 'postcode', '') or '') if intake is not None else '',
            'latitude': getattr(intake, 'latitude', None) if intake is not None else None,
            'longitude': getattr(intake, 'longitude', None) if intake is not None else None,
            'has_coordinates': has_case_geo,
        }
    return result


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
            CareCase.objects.select_related('due_diligence_process').prefetch_related(
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
            CareCase.objects.select_related('due_diligence_process').prefetch_related(
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
def regiekamer_decision_overview_api(request):
    try:
        organization = _active_organization(request)
        if organization is None:
            return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

        try:
            cases = scope_queryset_for_organization(
                CareCase.objects.select_related('due_diligence_process'),
                organization,
            ).exclude(
                Q(lifecycle_stage='ARCHIVED') | Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
            )
            cases = filter_care_cases_for_provider_actor(cases, request.user, organization)
        except Exception:
            logger.exception(
                "regiekamer_cases_queryset_failed org_id=%s user_id=%s",
                getattr(organization, "pk", "?"),
                getattr(request.user, "pk", "?"),
            )
            cases = CareCase.objects.none()

        payload = build_regiekamer_decision_overview(
            cases,
            actor=request.user,
            organization=organization,
        )
        totals = payload.get('totals') or {}
        try:
            critical_blockers = int(totals.get('critical_blockers') or 0)
        except (TypeError, ValueError):
            critical_blockers = 0
        if critical_blockers > 0:
            try:
                log_escalation_hint(
                    'REGIEKAMER_CRITICAL_BLOCKERS',
                    extra={
                        'critical_blockers': totals.get('critical_blockers'),
                        'active_cases': totals.get('active_cases'),
                    },
                )
            except Exception:
                logger.exception("regiekamer_escalation_hint_failed")
        try:
            return JsonResponse(payload)
        except Exception:
            logger.exception(
                "regiekamer_json_encode_failed correlation_id=%s",
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
        return _internal_server_error(request, context='regiekamer_decision_overview_api_failed')

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def cases_bulk_update_api(request):
    """Bulk update cases."""
    try:
        data = json.loads(request.body)
        case_ids = data.get('case_ids', data.get('contract_ids', []))
        updates = data.get('updates', {})

        disallowed_workflow_fields = {
            'status',
            'case_phase',
            'lifecycle_stage',
            'phase_entered_at',
        }
        blocked_fields = sorted(field for field in updates.keys() if field in disallowed_workflow_fields)
        if blocked_fields:
            return JsonResponse(
                {
                    'success': False,
                    'error': 'Workflowvelden zijn niet toegestaan in bulk updates.',
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


def _serialize_simple_choices(field):
    serialized = []
    for value, label in field.choices:
        if value in (None, ''):
            continue
        serialized.append({
            'value': str(value),
            'label': str(label),
        })
    return serialized


def _serialize_model_choices(field):
    return [
        {
            'value': str(obj.pk),
            'label': str(field.label_from_instance(obj)),
        }
        for obj in field.queryset
    ]


def _flatten_form_errors(form):
    errors = {}
    for field_name, field_errors in form.errors.items():
        if field_name == '__all__':
            errors[field_name] = [str(error) for error in field_errors]
            continue
        errors[field_name] = str(field_errors[0])
    return errors


def _build_intake_form_payload(form, coordinator_field):
    care_category_sub = []
    care_category_sub_field = form.fields.get('care_category_sub')
    if care_category_sub_field is not None:
        for subcategory in care_category_sub_field.queryset:
            care_category_sub.append({
                'value': str(subcategory.pk),
                'label': str(care_category_sub_field.label_from_instance(subcategory)),
                'mainCategoryId': str(subcategory.main_category_id),
            })

    def _model_options(field_name):
        field = form.fields.get(field_name)
        if field is None:
            return []
        return _serialize_model_choices(field)

    def _simple_options(field_name):
        field = form.fields.get(field_name)
        if field is None:
            return []
        return _serialize_simple_choices(field)

    return {
        'initial_values': {
            'title': '',
            'start_date': date.today().isoformat(),
            'target_completion_date': '',
            'care_category_main': str(form.initial.get('care_category_main') or ''),
            'care_category_sub': '',
            'assessment_summary': '',
            'gemeente': '',
            'regio': '',
            'urgency': CaseIntakeProcess.Urgency.MEDIUM,
            'complexity': CaseIntakeProcess.Complexity.SIMPLE,
            'urgency_applied': False,
            'urgency_applied_since': '',
            'diagnostiek': [],
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': form.initial.get('preferred_region_type', 'GEMEENTELIJK'),
            'preferred_region': '',
            'max_toelaatbare_wachttijd_dagen': '',
            'leeftijd': '',
            'setting_voorkeur': '',
            'contra_indicaties': '',
            'problematiek_types': '',
            'client_age_category': '',
            'family_situation': '',
            'school_work_status': '',
            'postcode': '',
            'latitude': '',
            'longitude': '',
            'case_coordinator': '',
            'description': '',
        },
        'options': {
            'care_category_main': _model_options('care_category_main'),
            'care_category_sub': care_category_sub,
            'gemeente': _model_options('gemeente'),
            'regio': _model_options('regio'),
            'urgency': _simple_options('urgency'),
            'complexity': _simple_options('complexity'),
            'diagnostiek': _simple_options('diagnostiek'),
            'zorgvorm_gewenst': _simple_options('zorgvorm_gewenst'),
            'preferred_care_form': _simple_options('preferred_care_form'),
            'preferred_region_type': _simple_options('preferred_region_type'),
            'preferred_region': _model_options('preferred_region'),
            'client_age_category': _simple_options('client_age_category'),
            'family_situation': _simple_options('family_situation'),
            'case_coordinator': _serialize_model_choices(coordinator_field) if coordinator_field is not None else [],
        },
    }


def _build_match_context_from_intake(intake, organization):
    region_ref = ''
    if getattr(intake, 'regio', None):
        region_ref = intake.regio.region_code or intake.regio.region_name or ''
    elif getattr(intake, 'preferred_region', None):
        region_ref = intake.preferred_region.region_code or intake.preferred_region.region_name or ''

    contra = [token.strip() for token in str(getattr(intake, 'contra_indicaties', '') or '').split(',') if token.strip()]
    return MatchContext(
        zorgvorm=(getattr(intake, 'zorgvorm_gewenst', '') or intake.preferred_care_form or '').lower(),
        leeftijd=getattr(intake, 'leeftijd', None),
        regio=region_ref,
        gemeente=(intake.gemeente.municipality_name if getattr(intake, 'gemeente', None) else ''),
        complexiteit=(intake.complexity or '').lower(),
        urgentie=(intake.urgency or '').lower(),
        problematiek=list(getattr(intake, 'problematiek_types', []) or []),
        crisisopvang_vereist=(intake.urgency == CaseIntakeProcess.Urgency.CRISIS),
        setting_voorkeur=getattr(intake, 'setting_voorkeur', '') or '',
        contra_indicaties=contra,
        max_toelaatbare_wachttijd_dagen=getattr(intake, 'max_toelaatbare_wachttijd_dagen', None),
        organization=organization,
    )


@login_required
@require_http_methods(["GET"])
def current_user_api(request):
    """Session-backed actor for SPA shell (no client-side role switching)."""
    organization = _active_organization(request)
    workflow_role = resolve_actor_role(user=request.user, organization=organization)
    pilot_ui = bool(getattr(settings, 'CAREON_PILOT_UI', False))
    payload = {
        'id': request.user.pk,
        'email': getattr(request.user, 'email', '') or '',
        'fullName': (request.user.get_full_name() or '').strip() or request.user.username,
        'username': request.user.username,
        'workflowRole': workflow_role,
        'organization': None,
        'permissions': {
            'allowRoleSwitch': not pilot_ui,
        },
        'flags': {
            'pilotUi': pilot_ui,
            'spaOnlyWorkflow': bool(getattr(settings, 'CAREON_PILOT_SPA_ONLY', False)),
        },
    }
    if organization is not None:
        payload['organization'] = {
            'id': organization.pk,
            'slug': organization.slug,
            'name': getattr(organization, 'name', str(organization.pk)),
        }
    return JsonResponse(payload)


@login_required
@require_http_methods(["POST"])
def session_active_organization_api(request):
    """Persist active tenant for the session (same semantics as HTML switch_organization).

    SPA sends JSON: ``{"organization_slug": "gemeente-demo"}`` or ``{"organization_id": 123}``.
    Membership is required — no cross-tenant activation without OrganizationMembership.
    """
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON'}, status=400)

    slug = data.get('organization_slug') or data.get('slug')
    org_id = data.get('organization_id')
    organization = None
    if org_id is not None:
        try:
            org_id = int(org_id)
        except (TypeError, ValueError):
            return JsonResponse({'ok': False, 'error': 'Ongeldig organization_id'}, status=400)
        organization = Organization.objects.filter(pk=org_id, is_active=True).first()
    elif slug:
        organization = Organization.objects.filter(slug=str(slug).strip(), is_active=True).first()

    if organization is None:
        return JsonResponse({'ok': False, 'error': 'Organisatie niet gevonden'}, status=404)

    membership = OrganizationMembership.objects.filter(
        user=request.user,
        organization=organization,
        is_active=True,
        organization__is_active=True,
    ).first()
    if membership is None:
        return JsonResponse({'ok': False, 'error': 'Geen lidmaatschap voor deze organisatie'}, status=400)

    request.session['active_organization_id'] = organization.id
    request.session.modified = True
    return JsonResponse({
        'ok': True,
        'organization': {
            'id': organization.pk,
            'slug': organization.slug,
            'name': organization.name,
        },
    })


@login_required
@require_http_methods(["GET"])
def matching_candidates_api(request, case_id):
    organization = _active_organization(request)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    try:
        intake = _get_intake_for_case_api_id(
            case_id,
            organization,
            lock=False,
            select_related=('regio', 'preferred_region', 'gemeente'),
            user=request.user,
        )
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'error': 'Casus is gearchiveerd.'}, status=400)

    assessment = getattr(intake, 'case_assessment', None)
    ok, err = _workflow_summary_complete(assessment=assessment, intake=intake)
    if not ok:
        return JsonResponse({'error': err, 'code': 'SUMMARY_INCOMPLETE'}, status=400)

    ctx = _build_match_context_from_intake(intake, organization)
    limit = int(request.GET.get('limit', 10) or 10)
    results = MatchEngine.run(ctx=ctx, casus=intake, max_results=max(limit, 10), persist=False)

    payload = []
    for rank, row in enumerate(results, start=1):
        trade_offs = []
        for item in list(row.trade_offs or []):
            if isinstance(item, dict):
                detail = item.get('toelichting') or item.get('factor') or ''
                if detail:
                    trade_offs.append(str(detail))
            elif item:
                trade_offs.append(str(item))

        payload.append({
            'casus_id': intake.pk,
            'zorgprofiel_id': row.zorgprofiel_id,
            'zorgaanbieder_id': row.zorgaanbieder_id,
            'aanbiederName': row.zorgaanbieder.name if getattr(row, 'zorgaanbieder', None) else '',
            'totaalscore': float(row.totaalscore or 0.0),
            'score_inhoudelijke_fit': float(row.score_inhoudelijke_fit or 0.0),
            'score_regio_contract_fit': float(row.score_regio_contract_fit or row.score_contract_regio or 0.0),
            'score_capaciteit_wachttijd_fit': float(row.score_capaciteit_wachttijd_fit or row.score_capaciteit or 0.0),
            'score_complexiteit_veiligheid_fit': float(row.score_complexiteit_veiligheid_fit or row.score_complexiteit or 0.0),
            'score_performance_fit': float(row.score_performance_fit or row.score_performance or 0.0),
            'confidence_label': (row.confidence_label or '').lower(),
            'fit_samenvatting': row.fit_samenvatting or '',
            'trade_offs': trade_offs,
            'verificatie_advies': row.verificatie_advies or '',
            'uitgesloten': bool(row.uitgesloten),
            'uitsluitreden': row.uitsluitreden or '',
            'ranking': row.ranking or rank,
            'region_pressure_signal': 'Beste inhoudelijke match, maar capaciteit in regio staat onder druk' if (row.score_capaciteit_wachttijd_fit or row.score_capaciteit or 0) < 10 else '',
        })

    return JsonResponse({
        'caseId': intake.pk,
        'count': len(payload),
        'matches': payload[:limit],
    })


@login_required
@require_http_methods(["GET"])
def intake_form_options_api(request):
    try:
        organization = _active_organization(request)
        form = CaseIntakeProcessForm(organization=organization)

        coordinator_field = form.fields.get('case_coordinator')
        if organization and coordinator_field is not None:
            coordinator_field.queryset = coordinator_field.queryset.filter(
                organization_memberships__organization=organization,
                organization_memberships__is_active=True,
            ).distinct().order_by('first_name', 'last_name', 'username')

        return JsonResponse(_build_intake_form_payload(form, coordinator_field))
    except Exception as e:
        return JsonResponse({'error': f'Intake-form kon niet worden opgebouwd: {str(e)}'}, status=500)


@login_required
@require_http_methods(["GET"])
def case_detail_string_fallback_api(request, case_ref):
    """Fail-safe route for non-numeric case identifiers under /api/cases/."""
    if str(case_ref).isdigit():
        return case_detail_api(request, case_id=int(case_ref))
    return JsonResponse({'error': 'Casus niet gevonden'}, status=404)


def _assessment_decision_payload(*, case_record, intake, assessment):
    decision_key = 'draft'
    if assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING:
        decision_key = 'matching'
    elif assessment.assessment_status == CaseAssessment.AssessmentStatus.NEEDS_INFO:
        decision_key = 'needs_info'
    elif assessment.assessment_status == CaseAssessment.AssessmentStatus.UNDER_REVIEW:
        decision_key = 'under_review'

    ws = assessment.workflow_summary or {}
    return {
        'caseId': str(case_record.pk),
        'assessmentId': str(assessment.pk),
        'form': {
            'decision': decision_key,
            'urgency': intake.urgency,
            'zorgtype': intake.zorgvorm_gewenst or intake.preferred_care_form,
            'shortDescription': assessment.notes or intake.assessment_summary or '',
            'workflowSummary': {
                'context': ws.get('context', ''),
                'urgency': ws.get('urgency', '') or intake.urgency or '',
                'risks': ws.get('risks', []) if isinstance(ws.get('risks'), list) else [],
                'missing_information': ws.get('missing_information', ''),
                'risks_none_ack': bool(ws.get('risks_none_ack')),
            },
        },
        'summary': {
            'title': intake.title,
            'urgency': intake.urgency,
            'matchingReady': bool(assessment.matching_ready),
        },
        'hints': {
            'suggestedUrgency': {
                'value': intake.urgency,
                'label': intake.get_urgency_display(),
            },
        },
        'consequences': [
            'matching',
            'placement',
        ],
    }


def _require_workflow_role(*, user, organization, allowed_roles: set[str]):
    actor_role = resolve_actor_role(user=user, organization=organization)
    if actor_role not in allowed_roles:
        return actor_role, JsonResponse(
            {
                'ok': False,
                'error': 'Deze rol mag deze workflow-actie niet uitvoeren.',
                'actor_role': actor_role,
            },
            status=403,
        )
    return actor_role, None


@login_required
@require_http_methods(["GET", "POST"])
def assessment_decision_api(request, case_id):
    organization = get_user_organization(request.user)
    try:
        case_record = get_scoped_object_or_404(CareCase.objects.all(), organization, pk=case_id)
        ensure_provider_case_visible_or_404(request.user, case_record)
        intake = get_scoped_object_or_404(
            CaseIntakeProcess.objects.select_related('organization', 'contract'),
            organization,
            contract=case_record,
        )
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    assessment = getattr(intake, 'case_assessment', None)
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'error': 'Casus is gearchiveerd.'}, status=400)
    if assessment is None:
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.DRAFT,
            matching_ready=False,
            assessed_by=request.user,
        )

    if request.method == 'GET':
        return JsonResponse(_assessment_decision_payload(case_record=case_record, intake=intake, assessment=assessment))

    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    decision = (payload.get('decision') or '').strip().lower()
    short_description = (payload.get('shortDescription') or '').strip()
    urgency = (payload.get('urgency') or intake.urgency or '').strip()
    complexity = (payload.get('complexity') or intake.complexity or '').strip()
    zorgtype = (payload.get('zorgtype') or intake.zorgvorm_gewenst or intake.preferred_care_form or '').strip()
    constraints = payload.get('constraints') or []

    raw_ws = payload.get('workflow_summary')
    if isinstance(raw_ws, dict):
        risks_in = raw_ws.get('risks')
        risks_list: list[str] = []
        if isinstance(risks_in, list):
            risks_list = [str(x).strip() for x in risks_in if str(x).strip()]
        u_ws = str(raw_ws.get('urgency', '') or '').strip()
        assessment.workflow_summary = {
            'context': str(raw_ws.get('context', '')).strip(),
            'urgency': u_ws or str(urgency or intake.urgency or '').strip(),
            'risks': risks_list,
            'missing_information': str(raw_ws.get('missing_information', '')).strip(),
            'risks_none_ack': bool(raw_ws.get('risks_none_ack')),
        }
        if u_ws:
            urgency = u_ws

    previous_state = derive_workflow_state(intake=intake, assessment=assessment)

    if urgency:
        intake.urgency = urgency
    if complexity:
        intake.complexity = complexity
    if zorgtype:
        intake.zorgvorm_gewenst = zorgtype
        intake.preferred_care_form = zorgtype

    if decision == 'matching':
        ok_sum, err_sum = _workflow_summary_complete(assessment=assessment, intake=intake)
        if not ok_sum:
            return JsonResponse({'ok': False, 'error': err_sum, 'code': 'SUMMARY_INCOMPLETE'}, status=400)

        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.MATCHING_READY,
            actor_role=actor_role,
            action=WorkflowAction.START_MATCHING,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        assessment.assessment_status = CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
        assessment.matching_ready = True
        assessment.reason_not_ready = ''
        intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        case_record.case_phase = CareCase.CasePhase.MATCHING
        if short_description:
            assessment.notes = short_description
        if isinstance(constraints, list):
            assessment.risk_signals = ','.join(str(item).strip() for item in constraints if str(item).strip())
    elif decision == 'needs_info':
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.SUMMARY_READY,
            actor_role=actor_role,
            action=WorkflowAction.COMPLETE_SUMMARY,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        assessment.assessment_status = CaseAssessment.AssessmentStatus.NEEDS_INFO
        assessment.matching_ready = False
        if short_description:
            assessment.reason_not_ready = short_description
        assessment.notes = short_description or assessment.notes
        intake.status = CaseIntakeProcess.ProcessStatus.INTAKE
        case_record.case_phase = CareCase.CasePhase.INTAKE
    else:
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.SUMMARY_READY,
            actor_role=actor_role,
            action=WorkflowAction.COMPLETE_SUMMARY,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        assessment.assessment_status = CaseAssessment.AssessmentStatus.UNDER_REVIEW
        assessment.matching_ready = False
        if short_description:
            assessment.notes = short_description
        intake.status = CaseIntakeProcess.ProcessStatus.INTAKE
        case_record.case_phase = CareCase.CasePhase.INTAKE

    intake.workflow_state = WorkflowState.MATCHING_READY if decision == 'matching' else WorkflowState.SUMMARY_READY
    intake.save(update_fields=['urgency', 'complexity', 'zorgvorm_gewenst', 'preferred_care_form', 'status', 'workflow_state', 'updated_at'])
    case_record.save(update_fields=['case_phase', 'updated_at'])
    assessment.assessed_by = request.user
    assessment.save()

    new_state = WorkflowState.MATCHING_READY if decision == 'matching' else WorkflowState.SUMMARY_READY
    action = WorkflowAction.START_MATCHING if decision == 'matching' else WorkflowAction.COMPLETE_SUMMARY
    try:
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=new_state,
            action=action,
            source='assessment_decision_api',
        )
    except AuditLoggingError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)

    return JsonResponse({
        'ok': True,
        'nextPage': 'matching' if decision == 'matching' else 'assessment',
        'caseId': str(case_record.pk),
        'assessmentId': str(assessment.pk),
        'assessment': _assessment_decision_payload(case_record=case_record, intake=intake, assessment=assessment),
    })


@login_required
@require_http_methods(["POST"])
def matching_action_api(request, case_id):
    try:
        return _matching_action_api_inner(request, case_id)
    except Http404:
        return JsonResponse({'ok': False, 'error': 'Casus niet gevonden.'}, status=404)
    except AuditLoggingError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)


def _matching_action_api_inner(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        payload = {}

    action = (payload.get('action') or '').strip().lower()

    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

        provider = get_object_or_404(
            Client.objects.filter(organization=organization, status='ACTIVE'),
            pk=payload.get('provider_id'),
        )

        assessment = getattr(intake, 'case_assessment', None)
        previous_state = derive_workflow_state(intake=intake, assessment=assessment)

        actions_need_summary = {'prepare_waitlist_proposal', 'confirm_validation', 'send_to_provider', 'assign'}
        if action in actions_need_summary:
            ok_s, err_s = _workflow_summary_complete(assessment=assessment, intake=intake)
            if not ok_s:
                return JsonResponse({'ok': False, 'error': err_s, 'code': 'SUMMARY_INCOMPLETE'}, status=400)

        if action == 'prepare_waitlist_proposal':
            active_for_block = (
                PlacementRequest.objects.filter(due_diligence_process=intake)
                .order_by('-updated_at', '-created_at')
                .first()
            )
            if active_for_block and active_for_block.status == PlacementRequest.Status.IN_REVIEW:
                return JsonResponse(
                    {'ok': False, 'error': 'Deze casus is al naar de aanbieder verstuurd; wachtlijstvoorstel kan niet meer als concept worden vastgelegd.'},
                    status=400,
                )

            if previous_state == WorkflowState.MATCHING_READY:
                validation_transition = evaluate_transition(
                    current_state=WorkflowState.MATCHING_READY,
                    target_state=WorkflowState.GEMEENTE_VALIDATED,
                    actor_role=actor_role,
                    action=WorkflowAction.VALIDATE_MATCHING,
                )
                if not validation_transition.allowed:
                    return JsonResponse({'ok': False, 'error': validation_transition.reason}, status=400)
            elif previous_state == WorkflowState.GEMEENTE_VALIDATED:
                pass
            else:
                return JsonResponse(
                    {'ok': False, 'error': 'Wachtlijstvoorstel kan alleen worden vastgelegd tijdens matching of na eerdere gemeente-validatie zonder verzending naar aanbieder.'},
                    status=400,
                )

            match_score = payload.get('match_score')
            try:
                placement = _prepare_waitlist_proposal_for_intake(
                    request=request,
                    intake=intake,
                    provider=provider,
                    source='matching_action_api_prepare_waitlist',
                    match_score=match_score,
                )
            except ValidationError as exc:
                return JsonResponse({'ok': False, 'error': '; '.join(exc.messages) or 'Wachtlijstvoorstel mislukt.'}, status=400)

            intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
            if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
                intake.status = CaseIntakeProcess.ProcessStatus.DECISION
            intake.save(update_fields=['workflow_state', 'status', 'updated_at'])

            case_record = intake.case_record
            if case_record is not None and case_record.case_phase != CareCase.CasePhase.MATCHING:
                case_record.case_phase = CareCase.CasePhase.MATCHING
                case_record.save(update_fields=['case_phase', 'updated_at'])

            if previous_state == WorkflowState.MATCHING_READY:
                log_transition_event(
                    intake=intake,
                    actor_user=request.user,
                    actor_role=actor_role,
                    old_state=previous_state,
                    new_state=WorkflowState.GEMEENTE_VALIDATED,
                    action=WorkflowAction.VALIDATE_MATCHING,
                    placement=placement,
                    source='matching_action_api_prepare_waitlist',
                )

            return JsonResponse({
                'ok': True,
                'matchingOutcome': 'WAITLIST_PROPOSAL',
                'nextPage': 'case_detail',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        if action == 'confirm_validation':
            active_in_review = (
                PlacementRequest.objects.filter(
                    due_diligence_process=intake,
                    status=PlacementRequest.Status.IN_REVIEW,
                ).exists()
            )
            if active_in_review:
                return JsonResponse({'ok': False, 'error': 'Deze casus staat al bij de aanbieder in beoordeling.'}, status=400)
            if previous_state != WorkflowState.MATCHING_READY:
                return JsonResponse({'ok': False, 'error': 'Gemeente-validatie is alleen mogelijk wanneer matching gereed is.'}, status=400)
            validation_transition = evaluate_transition(
                current_state=WorkflowState.MATCHING_READY,
                target_state=WorkflowState.GEMEENTE_VALIDATED,
                actor_role=actor_role,
                action=WorkflowAction.VALIDATE_MATCHING,
            )
            if not validation_transition.allowed:
                return JsonResponse({'ok': False, 'error': validation_transition.reason}, status=400)
            validation_context = payload.get('validation_context')
            if not isinstance(validation_context, dict):
                validation_context = {}
            placement = _draft_validation_placement(
                request=request,
                intake=intake,
                provider=provider,
                validation_context=validation_context,
            )
            intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
            intake.save(update_fields=['workflow_state', 'updated_at'])
            case_record_cv = intake.case_record
            if case_record_cv is not None and case_record_cv.case_phase != CareCase.CasePhase.MATCHING:
                case_record_cv.case_phase = CareCase.CasePhase.MATCHING
                case_record_cv.save(update_fields=['case_phase', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=WorkflowState.GEMEENTE_VALIDATED,
                action=WorkflowAction.VALIDATE_MATCHING,
                placement=placement,
                source='matching_action_api_confirm_validation',
            )
            log_case_decision_event(
                case_id=intake.pk,
                placement_id=placement.pk,
                event_type=CaseDecisionLog.EventType.GEMEENTE_VALIDATION,
                recommendation_context={
                    'validation_context': validation_context,
                    'actor_role': actor_role,
                },
                user_action='gemeente_validate_matching',
                actor_user_id=request.user.id,
                action_source='matching_action_api_confirm_validation',
                provider_id=provider.pk,
                strict=True,
            )
            return JsonResponse({
                'ok': True,
                'step': 'gemeente_validatie',
                'nextPage': 'matching',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        if action == 'send_to_provider':
            if previous_state != WorkflowState.GEMEENTE_VALIDATED:
                return JsonResponse({'ok': False, 'error': 'Bevestig eerst de gemeente-validatie (stap vóór verzenden).'}, status=400)
            placement_row = (
                PlacementRequest.objects.filter(due_diligence_process=intake)
                .order_by('-updated_at')
                .first()
            )
            if placement_row is None or placement_row.status != PlacementRequest.Status.DRAFT:
                return JsonResponse({'ok': False, 'error': 'Geen gevalideerde concept-plaatsing; voer validatie opnieuw uit.'}, status=400)
            if placement_row.proposed_provider_id != provider.pk:
                return JsonResponse({'ok': False, 'error': 'Aanbieder komt niet overeen met de gevalideerde keuze.'}, status=400)
            send_to_provider_transition = evaluate_transition(
                current_state=WorkflowState.GEMEENTE_VALIDATED,
                target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
                actor_role=actor_role,
                action=WorkflowAction.SEND_TO_PROVIDER,
            )
            if not send_to_provider_transition.allowed:
                return JsonResponse({'ok': False, 'error': send_to_provider_transition.reason}, status=400)
            try:
                placement = _assign_provider_to_intake(request=request, intake=intake, provider=provider, source='matching_api_send')
            except ValidationError as exc:
                return JsonResponse({'ok': False, 'error': '; '.join(exc.messages) or 'Verzenden mislukt.'}, status=400)
            update_fields = ['updated_at']
            if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
                intake.status = CaseIntakeProcess.ProcessStatus.DECISION
                update_fields.append('status')
            if intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
                intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
                update_fields.append('workflow_state')
            case_record_sp = intake.case_record
            if case_record_sp is not None and case_record_sp.case_phase != CareCase.CasePhase.PROVIDER_BEOORDELING:
                case_record_sp.case_phase = CareCase.CasePhase.PROVIDER_BEOORDELING
                case_record_sp.save(update_fields=['case_phase', 'updated_at'])
            intake.save(update_fields=list(dict.fromkeys(update_fields)))
            new_state = derive_workflow_state(intake=intake, assessment=assessment, placement=placement)
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=WorkflowState.GEMEENTE_VALIDATED,
                new_state=new_state,
                action=WorkflowAction.SEND_TO_PROVIDER,
                placement=placement,
                source='matching_action_api_send_to_provider',
            )
            record_gemeente_validation_to_provider_review_boundary(
                intake=intake,
                placement=placement,
                request=request,
                actor_role=actor_role,
                workflow_state_before_action=previous_state,
                source='matching_action_api_send_to_provider',
            )
            return JsonResponse({
                'ok': True,
                'nextPage': 'casussen',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        if action == 'assign':
            validation_transition = evaluate_transition(
                current_state=previous_state,
                target_state=WorkflowState.GEMEENTE_VALIDATED,
                actor_role=actor_role,
                action=WorkflowAction.VALIDATE_MATCHING,
            )
            if not validation_transition.allowed:
                return JsonResponse({'ok': False, 'error': validation_transition.reason}, status=400)

            send_to_provider_transition = evaluate_transition(
                current_state=WorkflowState.GEMEENTE_VALIDATED,
                target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
                actor_role=actor_role,
                action=WorkflowAction.SEND_TO_PROVIDER,
            )
            if not send_to_provider_transition.allowed:
                return JsonResponse({'ok': False, 'error': send_to_provider_transition.reason}, status=400)

            if intake.workflow_state != WorkflowState.GEMEENTE_VALIDATED:
                intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
                intake.save(update_fields=['workflow_state', 'updated_at'])

            try:
                placement = _assign_provider_to_intake(request=request, intake=intake, provider=provider, source='matching_api')
            except ValidationError as exc:
                return JsonResponse({'ok': False, 'error': '; '.join(exc.messages) or 'Matching kan nog niet worden gestart.'}, status=400)

            update_fields = ['updated_at']
            if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
                intake.status = CaseIntakeProcess.ProcessStatus.DECISION
                update_fields.append('status')
            if intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
                intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
                update_fields.append('workflow_state')

            case_record = intake.case_record
            if case_record is not None and case_record.case_phase != CareCase.CasePhase.PROVIDER_BEOORDELING:
                case_record.case_phase = CareCase.CasePhase.PROVIDER_BEOORDELING
                case_record.save(update_fields=['case_phase', 'updated_at'])

            intake.save(update_fields=list(dict.fromkeys(update_fields)))
            new_state = derive_workflow_state(intake=intake, assessment=assessment, placement=placement)
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=WorkflowState.GEMEENTE_VALIDATED,
                action=WorkflowAction.VALIDATE_MATCHING,
                source='matching_action_api',
            )
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=WorkflowState.GEMEENTE_VALIDATED,
                new_state=new_state,
                action=WorkflowAction.SEND_TO_PROVIDER,
                placement=placement,
                source='matching_action_api',
            )
            record_gemeente_validation_to_provider_review_boundary(
                intake=intake,
                placement=placement,
                request=request,
                actor_role=actor_role,
                workflow_state_before_action=previous_state,
                source='matching_action_api',
            )

            return JsonResponse({
                'ok': True,
                'nextPage': 'casussen',
                'providerId': str(provider.pk),
                'placementId': str(placement.pk),
                'caseId': str(intake.pk),
            })

        return JsonResponse({'ok': False, 'error': 'Unsupported action.'}, status=400)


@login_required
@require_http_methods(["GET"])
def case_placement_detail_api(request, case_id):
    organization = get_user_organization(request.user)
    try:
        intake = _get_intake_for_case_api_id(case_id, organization, lock=False, user=request.user)
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'caseId': str(intake.pk), 'placement': {}, 'error': 'Casus is gearchiveerd.'}, status=400)
    placement = (
        PlacementRequest.objects.filter(due_diligence_process=intake)
        .select_related('proposed_provider', 'selected_provider')
        .order_by('-updated_at')
        .first()
    )

    if placement is None:
        return JsonResponse({'caseId': str(intake.pk), 'placement': {}}, status=200)

    return JsonResponse({
        'caseId': str(intake.pk),
        'placement': {
            'id': str(placement.pk),
            'status': placement.status,
            'providerResponseStatus': placement.provider_response_status,
            'providerResponseReasonCode': placement.provider_response_reason_code,
            'proposedProviderId': str(placement.proposed_provider_id) if placement.proposed_provider_id else '',
            'selectedProviderId': str(placement.selected_provider_id) if placement.selected_provider_id else '',
            'careForm': placement.care_form,
            'decisionNotes': placement.decision_notes,
            'providerResponseNotes': placement.provider_response_notes,
            'budgetReviewStatus': getattr(placement, 'budget_review_status', '') or '',
            'budgetReviewNote': getattr(placement, 'budget_review_note', '') or '',
        },
    })


@login_required
@require_http_methods(["POST"])
def provider_decision_api(request, case_id):
    try:
        return _provider_decision_api_inner(request, case_id)
    except Http404:
        return JsonResponse({'ok': False, 'error': 'Casus niet gevonden.'}, status=404)
    except AuditLoggingError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)


def _provider_decision_api_inner(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)

    decision = str(payload.get('status') or '').strip().upper()
    notes = (payload.get('provider_comment') or payload.get('information_request_comment') or '').strip()
    reason_code = str(payload.get('rejection_reason_code') or payload.get('reason_code') or '').strip().upper()

    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

        placement = (
            PlacementRequest.objects
            .select_for_update()
            .filter(due_diligence_process=intake)
            .select_related('selected_provider', 'proposed_provider')
            .order_by('-updated_at')
            .first()
        )
        if placement is None:
            return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

        previous_state = derive_workflow_state(intake=intake, placement=placement)
        now = timezone.now()

        if decision == 'ACCEPTED':
            placement.provider_response_status = PlacementRequest.ProviderResponseStatus.ACCEPTED
            placement.provider_response_reason_code = reason_code or OutcomeReasonCode.NONE
            placement.provider_response_notes = notes
            placement.provider_response_recorded_at = now
            placement.provider_response_recorded_by = request.user
            budget_updates = sync_placement_budget_review_flags(intake=intake, placement=placement)
            placement.save(update_fields=[
                'provider_response_status',
                'provider_response_reason_code',
                'provider_response_notes',
                'provider_response_recorded_at',
                'provider_response_recorded_by',
                'updated_at',
                *budget_updates,
            ])
            code = effective_care_form_code(intake=intake, placement=placement)
            needs_budget = care_form_requires_budget_review(code)
            target_state = (
                WorkflowState.BUDGET_REVIEW_PENDING
                if needs_budget and placement.budget_review_status == PlacementRequest.BudgetReviewStatus.PENDING
                else WorkflowState.PROVIDER_ACCEPTED
            )
            transition = evaluate_transition(
                current_state=previous_state,
                target_state=target_state,
                actor_role=actor_role,
                action=WorkflowAction.PROVIDER_ACCEPT,
            )
            if not transition.allowed:
                return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

            if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.PLAATSING:
                intake.case_record.case_phase = CareCase.CasePhase.PLAATSING
                intake.case_record.save(update_fields=['case_phase', 'updated_at'])

            if intake.workflow_state != target_state:
                intake.workflow_state = target_state
                intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=target_state,
                action=WorkflowAction.PROVIDER_ACCEPT,
                placement=placement,
                reason=notes,
                source='provider_decision_api',
            )
            return JsonResponse({'ok': True, 'nextPage': 'plaatsingen', 'caseId': str(intake.pk)})

        if decision == 'REJECTED':
            transition = evaluate_transition(
                current_state=previous_state,
                target_state=WorkflowState.PROVIDER_REJECTED,
                actor_role=actor_role,
                action=WorkflowAction.PROVIDER_REJECT,
            )
            if not transition.allowed:
                return JsonResponse({'ok': False, 'error': transition.reason}, status=400)
            if not reason_code:
                return JsonResponse({'ok': False, 'error': 'Afwijzing vereist een reden.'}, status=400)

            placement.provider_response_status = PlacementRequest.ProviderResponseStatus.REJECTED
            placement.provider_response_reason_code = reason_code
            placement.provider_response_notes = notes
            placement.provider_response_recorded_at = now
            placement.provider_response_recorded_by = request.user
            placement.status = PlacementRequest.Status.REJECTED
            placement.save(update_fields=[
                'provider_response_status',
                'provider_response_reason_code',
                'provider_response_notes',
                'provider_response_recorded_at',
                'provider_response_recorded_by',
                'status',
                'updated_at',
            ])

            new_state = WorkflowState.PROVIDER_REJECTED
            if intake.workflow_state != new_state:
                intake.workflow_state = new_state
                intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=new_state,
                action=WorkflowAction.PROVIDER_REJECT,
                placement=placement,
                reason=notes,
                source='provider_decision_api',
            )
            return JsonResponse({'ok': True, 'nextPage': 'beoordelingen', 'caseId': str(intake.pk)})

        if decision == 'INFO_REQUESTED':
            transition = evaluate_transition(
                current_state=previous_state,
                target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
                actor_role=actor_role,
                action=WorkflowAction.PROVIDER_REQUEST_INFO,
            )
            if not transition.allowed:
                return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

            info_type_raw = str(payload.get('information_request_type') or '').strip().lower()
            stored_notes = _compose_provider_info_request_notes(info_type=info_type_raw, body=notes)
            placement.provider_response_status = PlacementRequest.ProviderResponseStatus.NEEDS_INFO
            placement.provider_response_notes = stored_notes
            placement.provider_response_recorded_at = now
            placement.provider_response_recorded_by = request.user
            placement.save(update_fields=[
                'provider_response_status',
                'provider_response_notes',
                'provider_response_recorded_at',
                'provider_response_recorded_by',
                'updated_at',
            ])
            if intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
                intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
                intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=WorkflowState.PROVIDER_REVIEW_PENDING,
                action=WorkflowAction.PROVIDER_REQUEST_INFO,
                placement=placement,
                reason=notes,
                source='provider_decision_api',
            )
            return JsonResponse({'ok': True, 'nextPage': 'beoordelingen', 'caseId': str(intake.pk)})

        return JsonResponse({'ok': False, 'error': 'Ongeldige providerbeslissing.'}, status=400)


@login_required
@require_http_methods(["POST"])
def placement_action_api(request, case_id):
    try:
        return _placement_action_api_inner(request, case_id)
    except Http404:
        return JsonResponse({'ok': False, 'error': 'Casus niet gevonden.'}, status=404)
    except AuditLoggingError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)


def _placement_action_api_inner(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)

    requested_status = str(payload.get('status') or '').strip().upper()
    note = (payload.get('note') or payload.get('comment') or '').strip()
    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

        placement = (
            PlacementRequest.objects
            .select_for_update()
            .filter(due_diligence_process=intake)
            .select_related('selected_provider', 'proposed_provider')
            .order_by('-updated_at')
            .first()
        )
        if placement is None:
            return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

        previous_state = derive_workflow_state(intake=intake, placement=placement)

        if requested_status == PlacementRequest.Status.APPROVED:
            transition = evaluate_transition(
                current_state=previous_state,
                target_state=WorkflowState.PLACEMENT_CONFIRMED,
                actor_role=actor_role,
                action=WorkflowAction.CONFIRM_PLACEMENT,
            )
            if not transition.allowed:
                return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

            allowed, blocker = placement.can_transition_to_status(PlacementRequest.Status.APPROVED)
            if not allowed:
                return JsonResponse({'ok': False, 'error': blocker or 'Plaatsing kan niet worden bevestigd.'}, status=400)

            placement.status = PlacementRequest.Status.APPROVED
            if note:
                existing = placement.decision_notes or ''
                stamped_note = f"[{timezone.now().strftime('%d-%m-%Y %H:%M')}] {note}"
                placement.decision_notes = f"{existing}\n{stamped_note}".strip()
                placement.save(update_fields=['status', 'decision_notes', 'updated_at'])
            else:
                placement.save(update_fields=['status', 'updated_at'])

            if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.PLAATSING:
                intake.case_record.case_phase = CareCase.CasePhase.PLAATSING
                intake.case_record.save(update_fields=['case_phase', 'updated_at'])

            new_state = WorkflowState.PLACEMENT_CONFIRMED
            if intake.workflow_state != new_state:
                intake.workflow_state = new_state
                intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=new_state,
                action=WorkflowAction.CONFIRM_PLACEMENT,
                placement=placement,
                reason=note,
                source='placement_action_api',
            )
            return JsonResponse({'ok': True, 'nextPage': 'intake', 'caseId': str(intake.pk)})

        if requested_status == PlacementRequest.Status.REJECTED:
            transition = evaluate_transition(
                current_state=previous_state,
                target_state=WorkflowState.MATCHING_READY,
                actor_role=actor_role,
                action=WorkflowAction.REMATCH,
            )
            if not transition.allowed:
                return JsonResponse({'ok': False, 'error': transition.reason}, status=400)
            if placement.provider_response_status not in normalize_provider_rejection_states():
                return JsonResponse({'ok': False, 'error': 'Rematch kan alleen na aanbiederafwijzing.'}, status=400)

            placement.status = PlacementRequest.Status.REJECTED
            placement.save(update_fields=['status', 'updated_at'])
            intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
            intake.workflow_state = WorkflowState.MATCHING_READY
            intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
            if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.MATCHING:
                intake.case_record.case_phase = CareCase.CasePhase.MATCHING
                intake.case_record.save(update_fields=['case_phase', 'updated_at'])

            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous_state,
                new_state=WorkflowState.MATCHING_READY,
                action=WorkflowAction.REMATCH,
                placement=placement,
                reason=note,
                source='placement_action_api',
            )
            return JsonResponse({'ok': True, 'nextPage': 'matching', 'caseId': str(intake.pk)})

        return JsonResponse({'ok': False, 'error': 'Ongeldige plaatsingsactie.'}, status=400)


@login_required
@require_http_methods(["POST"])
def intake_action_api(request, case_id):
    try:
        return _intake_action_api_inner(request, case_id)
    except Http404:
        return JsonResponse({'ok': False, 'error': 'Casus niet gevonden.'}, status=404)
    except AuditLoggingError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)


def _intake_action_api_inner(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error

    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

        placement = (
            PlacementRequest.objects
            .select_for_update()
            .filter(due_diligence_process=intake)
            .order_by('-updated_at')
            .first()
        )
        if placement is None:
            return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

        previous_state = derive_workflow_state(intake=intake, placement=placement)
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.INTAKE_STARTED,
            actor_role=actor_role,
            action=WorkflowAction.START_INTAKE,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        intake.status = CaseIntakeProcess.ProcessStatus.COMPLETED
        intake.workflow_state = WorkflowState.INTAKE_STARTED
        intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
        if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.ACTIEF:
            intake.case_record.case_phase = CareCase.CasePhase.ACTIEF
            intake.case_record.save(update_fields=['case_phase', 'updated_at'])

        new_state = WorkflowState.INTAKE_STARTED
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=new_state,
            action=WorkflowAction.START_INTAKE,
            placement=placement,
            source='intake_action_api',
        )
        intake.refresh_from_db()
        placement.refresh_from_db()
        state_after_intake = derive_workflow_state(intake=intake, placement=placement)
        activate = evaluate_transition(
            current_state=state_after_intake,
            target_state=WorkflowState.ACTIVE_PLACEMENT,
            actor_role=actor_role,
            action=WorkflowAction.ACTIVATE_PLACEMENT_MONITORING,
        )
        if activate.allowed:
            intake.workflow_state = WorkflowState.ACTIVE_PLACEMENT
            intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=state_after_intake,
                new_state=WorkflowState.ACTIVE_PLACEMENT,
                action=WorkflowAction.ACTIVATE_PLACEMENT_MONITORING,
                placement=placement,
                source='intake_action_api',
            )
        return JsonResponse({'ok': True, 'nextPage': 'intake', 'caseId': str(intake.pk)})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def intake_create_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN, WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error

    form = CaseIntakeProcessForm(data=payload, organization=organization)

    coordinator_field = form.fields['case_coordinator']
    if organization:
        coordinator_field.queryset = coordinator_field.queryset.filter(
            organization_memberships__organization=organization,
            organization_memberships__is_active=True,
        ).distinct().order_by('first_name', 'last_name', 'username')

    if not form.is_valid():
        return JsonResponse({'errors': _flatten_form_errors(form)}, status=400)

    try:
        with transaction.atomic():
            set_organization_on_instance(form.instance, organization)
            if not form.instance.start_date:
                form.instance.start_date = date.today()
            entry_route = str(payload.get('entry_route') or payload.get('entryRoute') or '').strip().upper()
            if entry_route == CaseIntakeProcess.EntryRoute.WIJKTEAM:
                form.instance.entry_route = CaseIntakeProcess.EntryRoute.WIJKTEAM
                form.instance.workflow_state = WorkflowState.WIJKTEAM_INTAKE
            else:
                form.instance.entry_route = CaseIntakeProcess.EntryRoute.STANDARD
                form.instance.workflow_state = WorkflowState.DRAFT_CASE

            form.instance.aanmelder_actor_profile = _derive_aanmelder_actor_profile_for_intake(
                actor_role=actor_role,
                entry_route=form.instance.entry_route,
            )
            intake = form.save()
            case_record = intake.ensure_case_record(created_by=request.user)
            try:
                log_action(
                    request.user,
                    'CREATE',
                    'CaseIntakeProcess',
                    intake.id,
                    str(intake),
                    request=request,
                )
            except Exception as exc:
                logger.exception(
                    "Intake create CREATE audit log failed for intake_id=%s user_id=%s",
                    intake.id,
                    getattr(request.user, "id", None),
                )
                raise AuditLoggingError(
                    'Kan auditlog voor nieuwe casus niet vastleggen.'
                ) from exc
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state='NONE',
                new_state=intake.workflow_state or WorkflowState.DRAFT_CASE,
                action=WorkflowAction.CREATE_CASE,
                source='intake_create_api',
            )

        case_pk = case_record.pk if case_record else intake.pk
        return JsonResponse({
            'ok': True,
            'id': intake.pk,
            'title': intake.title,
            'case_id': str(case_record.pk) if case_record else '',
            'redirect_url': f'/care/cases/{case_pk}/',
        })
    except AuditLoggingError as exc:
        logger.exception(
            "Intake create blocked: audit logging required intake_create_api user_id=%s",
            getattr(request.user, "id", None),
        )
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)
    except Exception:
        logger.exception(
            "Intake create failed for user_id=%s org_id=%s payload_keys=%s",
            getattr(request.user, "id", None),
            getattr(organization, "id", None),
            sorted(payload.keys()) if isinstance(payload, dict) else [],
        )
        return JsonResponse(
            {
                'ok': False,
                'error': 'Nieuwe casus kon niet worden geladen. Probeer opnieuw of neem contact op met support.',
            },
            status=500,
        )


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def assessments_api(request):
    organization = get_user_organization(request.user)
    try:
        intakes = CaseIntakeProcess.objects.filter(organization=organization).exclude(
            status=CaseIntakeProcess.ProcessStatus.ARCHIVED
        )
        if resolve_actor_role(user=request.user, organization=organization) == WorkflowRole.ZORGAANBIEDER:
            intakes = intakes.filter(
                contract_id__in=visible_provider_scoped_care_cases(request.user, organization).values('pk')
            )
        qs = CaseAssessment.objects.filter(due_diligence_process__in=intakes).select_related(
            'due_diligence_process', 'assessed_by'
        )
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(
                Q(due_diligence_process__title__icontains=q) | Q(notes__icontains=q)
            )
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for a in page_obj:
            intake = a.due_diligence_process
            data.append({
                'id': str(a.id),
                'caseId': str(intake.id) if intake else '',
                'caseTitle': intake.title if intake else '',
                'regio': (intake.preferred_region.region_name if intake and intake.preferred_region else ''),
                'wachttijd': 0,
                'status': a.assessment_status,
                'matchingReady': a.matching_ready,
                'riskSignals': [s.strip() for s in a.risk_signals.split(',') if s.strip()] if a.risk_signals else [],
                'notes': a.notes,
                'assessedBy': a.assessed_by.get_full_name() if a.assessed_by else '',
                'createdAt': a.created_at.isoformat(),
            })
        return JsonResponse({'assessments': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='assessments_api_failed')


# ---------------------------------------------------------------------------
# Placements
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def placements_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = PlacementRequest.objects.for_organization(organization).exclude(
            due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED
        ).select_related(
            'due_diligence_process', 'proposed_provider', 'selected_provider'
        )
        qs = filter_placement_requests_for_provider_actor(qs, request.user, organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(
                Q(due_diligence_process__title__icontains=q) | Q(description__icontains=q)
            )
        qs = qs.order_by('-updated_at', '-id')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for p in page_obj:
            intake = p.due_diligence_process
            data.append({
                'id': str(p.id),
                'caseId': str(intake.id) if intake else '',
                'caseTitle': intake.title if intake else '',
                'status': p.status,
                'careForm': p.care_form,
                'providerResponseStatus': p.provider_response_status,
                'proposedProvider': p.proposed_provider.name if p.proposed_provider else '',
                'selectedProvider': p.selected_provider.name if p.selected_provider else '',
                'description': p.description,
                'createdAt': p.created_at.isoformat(),
            })
        return JsonResponse({'placements': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='placements_api_failed')


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def signals_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = CareSignal.objects.for_organization(organization).exclude(
            Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
            | Q(case_record__lifecycle_stage='ARCHIVED')
        ).select_related(
            'case_record', 'assigned_to', 'created_by'
        )
        qs = filter_care_signals_for_provider_actor(qs, request.user, organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        status_filter = request.GET.get('status', '')
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs.order_by('-created_at', '-id')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for s in page_obj:
            data.append({
                'id': str(s.id),
                'title': s.title or s.get_signal_type_display(),
                'signalType': s.signal_type,
                'riskLevel': s.risk_level,
                'status': s.status,
                'description': s.description,
                'linkedCaseId': str(s.case_record_id) if s.case_record_id else '',
                'linkedCaseTitle': s.case_record.title if s.case_record else '',
                'assignedTo': s.assigned_to.get_full_name() if s.assigned_to else '',
                'createdAt': s.created_at.isoformat(),
                'updatedAt': s.updated_at.isoformat(),
            })
        return JsonResponse({'signals': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='signals_api_failed')


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def tasks_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = CareTask.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
        ).select_related(
            'case_record', 'assigned_to'
        )
        qs = filter_care_tasks_for_provider_actor(qs, request.user, organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        status_filter = request.GET.get('status', '')
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs.order_by('-created_at', '-id')
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        from datetime import date as date_today
        today = date_today.today()
        for t in page_obj:
            due = t.due_date
            if t.status in ('COMPLETED', 'CANCELLED'):
                action_status = 'completed'
            elif due is None:
                # DB-should-not-happen guard: comparing None to date raises TypeError → 500.
                action_status = 'upcoming'
            elif due < today:
                action_status = 'overdue'
            elif due == today:
                action_status = 'today'
            else:
                action_status = 'upcoming'
            data.append({
                'id': str(t.id),
                'title': t.title,
                'description': t.description,
                'priority': t.priority,
                'status': t.status,
                'actionStatus': action_status,
                'linkedCaseId': str(t.case_record_id) if t.case_record_id else '',
                'caseTitle': t.case_record.title if t.case_record else '',
                'assignedTo': t.assigned_to.get_full_name() if t.assigned_to else '',
                'dueDate': due.isoformat() if due else '',
                'createdAt': t.created_at.isoformat(),
            })
        return JsonResponse({'tasks': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='tasks_api_failed')


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

def _serialize_document_row(d):
    return {
        'id': str(d.id),
        'name': d.title,
        'type': d.document_type,
        'status': d.status,
        'description': d.description,
        'linkedCaseId': str(d.contract_id) if d.contract_id else '',
        'linkedCaseName': d.contract.title if d.contract else '',
        'uploadedBy': d.uploaded_by.get_full_name() if d.uploaded_by else '',
        'uploadDate': d.created_at.isoformat(),
        'fileSize': d.file_size,
        'mimeType': d.mime_type,
        'version': d.version,
        'isConfidential': d.is_confidential,
    }


@login_required
@require_http_methods(["GET"])
def documents_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = Document.objects.filter(organization=organization).select_related(
            'uploaded_by', 'contract'
        )
        qs = filter_documents_for_provider_actor(qs, request.user, organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(tags__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = [_serialize_document_row(d) for d in page_obj]
        return JsonResponse({'documents': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='documents_api_failed')


@login_required
@require_http_methods(["GET"])
def document_detail_api(request, document_id):
    """Single document metadata; zorgaanbieder requires placement-linked case visibility."""
    organization = get_user_organization(request.user)
    try:
        doc = Document.objects.select_related('uploaded_by', 'contract').get(
            pk=document_id,
            organization=organization,
        )
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    actor_role = resolve_actor_role(user=request.user, organization=organization)
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        if doc.contract_id is None:
            return JsonResponse({'error': 'Document niet gevonden'}, status=404)
        try:
            ensure_provider_case_visible_or_404(request.user, doc.contract)
        except Http404:
            return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    return JsonResponse(_serialize_document_row(doc))


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def audit_log_api(request):
    organization = get_user_organization(request.user)
    try:
        actor_role = resolve_actor_role(user=request.user, organization=organization)
        if actor_role == WorkflowRole.ZORGAANBIEDER:
            return JsonResponse(
                {
                    'ok': False,
                    'error': 'Auditlog is niet beschikbaar voor deze rol.',
                },
                status=403,
            )
        qs = AuditLog.objects.select_related('user')
        if organization:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            org_user_ids = list(
                User.objects.filter(organization_memberships__organization=organization).values_list('id', flat=True)
            )
            qs = qs.filter(user_id__in=org_user_ids)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(model_name__icontains=q) | Q(object_repr__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for entry in page_obj:
            data.append({
                'id': str(entry.id),
                'timestamp': entry.timestamp.isoformat(),
                'action': entry.action,
                'modelName': entry.model_name,
                'objectId': entry.object_id,
                'objectRepr': entry.object_repr,
                'userName': entry.user.get_full_name() if entry.user else 'Systeem',
                'userEmail': entry.user.email if entry.user else '',
                'changes': entry.changes,
            })
        return JsonResponse({'entries': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='audit_log_api_failed')


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def providers_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = Client.objects.filter(
            organization=organization,
            client_type='CORPORATION',
        ).order_by('name', 'id').select_related('provider_profile').prefetch_related(
            'provider_profile__served_regions__served_municipalities',
            'provider_profile__secondary_served_regions',
        )
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for client in page_obj:
            pp = getattr(client, 'provider_profile', None)
            location = _provider_location_payload(pp) if pp else {
                'label': client.city or 'Locatie ontbreekt',
                'latitude': None,
                'longitude': None,
                'region_label': '',
                'municipality_label': '',
                'has_coordinates': False,
            }
            regions_payload = _provider_regions_payload(pp)
            data.append({
                'id': str(client.id),
                'name': client.name,
                'city': client.city,
                'status': client.status,
                'currentCapacity': pp.current_capacity if pp else 0,
                'maxCapacity': pp.max_capacity if pp else 0,
                'waitingListLength': pp.waiting_list_length if pp else 0,
                'averageWaitDays': pp.average_wait_days if pp else 0,
                'offersOutpatient': pp.offers_outpatient if pp else False,
                'offersDayTreatment': pp.offers_day_treatment if pp else False,
                'offersResidential': pp.offers_residential if pp else False,
                'offersCrisis': pp.offers_crisis if pp else False,
                'serviceArea': pp.service_area if pp else '',
                'specialFacilities': pp.special_facilities if pp else '',
                'latitude': location['latitude'],
                'longitude': location['longitude'],
                'hasCoordinates': location['has_coordinates'],
                'locationLabel': location['label'],
                'regionLabel': location['region_label'] or regions_payload['primary_region_label'],
                'municipalityLabel': location['municipality_label'],
                'secondaryRegionLabels': regions_payload['secondary_region_labels'],
                'allRegionLabels': regions_payload['all_region_labels'],
            })
        return JsonResponse({'providers': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages, 'workspace_summary': build_provider_workspace_summary(list(qs))})
    except Exception:
        return _internal_server_error(request, context='providers_api_failed')


# ---------------------------------------------------------------------------
# Municipalities
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def municipalities_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = MunicipalityConfiguration.objects.filter(organization=organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(municipality_name__icontains=q) | Q(municipality_code__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for m in page_obj:
            data.append({
                'id': str(m.id),
                'name': m.municipality_name,
                'code': m.municipality_code,
                'status': m.status,
                'maxWaitDays': m.max_wait_days,
                'providerCount': m.provider_count,
                'coordinator': m.responsible_coordinator.get_full_name() if m.responsible_coordinator else '',
            })
        return JsonResponse({'municipalities': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='municipalities_api_failed')


# ---------------------------------------------------------------------------
# Regions
# ---------------------------------------------------------------------------


def _normalize_region_key(value):
    return (value or '').strip().lower()


def _days_in_current_phase(case):
    if case.phase_entered_at:
        phase_date = case.phase_entered_at.date()
    elif case.updated_at:
        phase_date = case.updated_at.date()
    elif case.created_at:
        phase_date = case.created_at.date()
    else:
        phase_date = date.today()
    return max((date.today() - phase_date).days, 0)


def _is_active_case(case):
    completed_statuses = {
        CareCase.Status.COMPLETED,
        CareCase.Status.CANCELLED,
        CareCase.Status.TERMINATED,
        CareCase.Status.EXPIRED,
    }
    if case.case_phase == CareCase.CasePhase.AFGEROND:
        return False
    if case.status in completed_statuses:
        return False
    return True


def _compute_region_status(metrics):
    if (
        (metrics['beschikbare_capaciteit'] == 0 and metrics['actieve_casussen'] > 0)
        or metrics['urgente_casussen_zonder_match'] >= 4
        or metrics['gemiddelde_wachttijd_dagen'] > 42
        or metrics['vastgelopen_casussen'] >= 5
    ):
        return 'kritiek'

    if (
        metrics['capaciteitsratio'] < 0.2
        or metrics['urgente_casussen_zonder_match'] >= 2
        or metrics['gemiddelde_wachttijd_dagen'] > 28
        or metrics['vastgelopen_casussen'] >= 3
    ):
        return 'tekort'

    if (
        metrics['capaciteitsratio'] < 0.4
        or metrics['urgente_casussen_zonder_match'] >= 1
        or metrics['gemiddelde_wachttijd_dagen'] > 14
        or metrics['vastgelopen_casussen'] >= 1
    ):
        return 'druk'

    return 'stabiel'


def _build_signal_summary(status, metrics):
    if status == 'stabiel':
        return 'Geen capaciteitsproblemen'

    if metrics['beschikbare_capaciteit'] == 0 and metrics['actieve_casussen'] > 0:
        return 'Geen beschikbare capaciteit'

    urgent = metrics['urgente_casussen_zonder_match']
    if urgent > 0:
        return '1 urgente casus zonder match' if urgent == 1 else f'{urgent} urgente casussen zonder match'

    if metrics['gemiddelde_wachttijd_dagen'] > 14:
        return 'Wachttijd boven norm'

    stuck = metrics['vastgelopen_casussen']
    if stuck > 0:
        return '1 vastgelopen casus' if stuck == 1 else f'{stuck} vastgelopen casussen'

    if metrics['capaciteitsratio'] < 0.4:
        return 'Capaciteit onder druk'

    return 'Capaciteit onder druk'


def _build_region_health_payload(region, region_cases, region_provider_profiles):
    actieve_cases = [case for case in region_cases if _is_active_case(case)]
    actieve_count = len(actieve_cases)

    beschikbare_capaciteit = sum(max(profile.current_capacity or 0, 0) for profile in region_provider_profiles)
    gemiddelde_wachttijd_dagen = (
        round(sum(_days_in_current_phase(case) for case in actieve_cases) / actieve_count)
        if actieve_count > 0
        else 0
    )

    urgente_zonder_match = 0
    vastgelopen = 0
    for case in actieve_cases:
        days_in_phase = _days_in_current_phase(case)
        is_urgent = case.risk_level in {CareCase.RiskLevel.HIGH, CareCase.RiskLevel.CRITICAL}

        if is_urgent and not (case.preferred_provider or '').strip():
            urgente_zonder_match += 1

        if case.case_phase == CareCase.CasePhase.PROVIDER_BEOORDELING and days_in_phase > 3:
            vastgelopen += 1
        elif case.case_phase == CareCase.CasePhase.MATCHING:
            threshold = 2 if is_urgent else 5
            if days_in_phase > threshold:
                vastgelopen += 1
        elif case.case_phase == CareCase.CasePhase.PLAATSING and days_in_phase > 5:
            vastgelopen += 1

    capaciteitsratio = (beschikbare_capaciteit / actieve_count) if actieve_count > 0 else 1

    metrics = {
        'actieve_casussen': actieve_count,
        'beschikbare_capaciteit': beschikbare_capaciteit,
        'capaciteitsratio': round(capaciteitsratio, 2),
        'gemiddelde_wachttijd_dagen': gemiddelde_wachttijd_dagen,
        'urgente_casussen_zonder_match': urgente_zonder_match,
        'vastgelopen_casussen': vastgelopen,
    }

    status = _compute_region_status(metrics)
    status_label = {
        'stabiel': 'Stabiel',
        'druk': 'Druk',
        'tekort': 'Tekort',
        'kritiek': 'Kritiek',
    }[status]
    signal_summary = _build_signal_summary(status, metrics)

    metrics.update({
        'status': status,
        'status_label': status_label,
        'heeft_tekort': status in {'tekort', 'kritiek'},
        'heeft_hoge_wachttijd': metrics['gemiddelde_wachttijd_dagen'] > 14,
        'heeft_kritiek_signaal': status == 'kritiek',
        'signaal_samenvatting': signal_summary,
        'providerCountComputed': len(region_provider_profiles),
    })
    return metrics


def _outcome_reason_to_spa_rejection_code(code: str) -> str | None:
    """Map persisted OutcomeReasonCode to SPA RejectionReasonCode (slug)."""
    if not code or code == OutcomeReasonCode.NONE:
        return None
    mapping = {
        OutcomeReasonCode.CAPACITY: 'geen_capaciteit',
        OutcomeReasonCode.WAITLIST: 'urgentie_niet_haalbaar',
        OutcomeReasonCode.CARE_MISMATCH: 'specialisatie_past_niet',
        OutcomeReasonCode.REGION_MISMATCH: 'regio_niet_passend',
        OutcomeReasonCode.SAFETY_RISK: 'te_hoge_complexiteit',
        OutcomeReasonCode.ADMINISTRATIVE_BLOCK: 'onvoldoende_informatie',
        OutcomeReasonCode.NO_RESPONSE: 'onvoldoende_informatie',
        OutcomeReasonCode.CLIENT_DECLINED: 'andere_reden',
        OutcomeReasonCode.PROVIDER_DECLINED: 'andere_reden',
        OutcomeReasonCode.NO_SHOW: 'andere_reden',
        OutcomeReasonCode.OTHER: 'andere_reden',
    }
    return mapping.get(code, 'andere_reden')


def _spa_evaluation_status_from_placement(placement: PlacementRequest) -> str:
    st = (placement.provider_response_status or '').strip().upper()
    if st == PlacementRequest.ProviderResponseStatus.PENDING:
        return 'PENDING'
    if st == PlacementRequest.ProviderResponseStatus.ACCEPTED:
        return 'ACCEPTED'
    if st == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
        return 'INFO_REQUESTED'
    if st in {
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    }:
        return 'REJECTED'
    return 'PENDING'


def _intake_region_label(intake: CaseIntakeProcess | None, case: CareCase | None) -> str:
    if intake is not None:
        if intake.regio_id and getattr(intake, 'regio', None):
            return intake.regio.region_name
        if intake.preferred_region_id and getattr(intake, 'preferred_region', None):
            return intake.preferred_region.region_name
        if intake.gemeente_id and getattr(intake, 'gemeente', None):
            return intake.gemeente.municipality_name
    if case is not None and case.service_region:
        return case.service_region
    return ''


def _placement_care_type_label(placement: PlacementRequest, intake: CaseIntakeProcess | None) -> str:
    if placement.care_form:
        return placement.get_care_form_display()
    if intake is None:
        return ''
    if intake.zorgvorm_gewenst:
        return intake.get_zorgvorm_gewenst_display()
    if intake.preferred_care_form:
        return intake.get_preferred_care_form_display()
    return ''


def _trade_offs_hint_short(trade_offs, *, max_items: int = 2, max_len: int = 280) -> str:
    if not trade_offs:
        return ''
    parts: list[str] = []
    for item in list(trade_offs)[:max_items]:
        if isinstance(item, dict):
            t = (item.get('toelichting') or item.get('factor') or '').strip()
            if t:
                parts.append(t)
        elif item:
            parts.append(str(item))
    return ' · '.join(parts)[:max_len]


def _match_hints_for_placement(case: CareCase | None, provider: Client | None) -> tuple[str, str, int | None]:
    """Read-model hints from persisted MatchResultaat for this case + aanbieder (advisory)."""
    if case is None or provider is None or not (provider.name or '').strip():
        return '', '', None
    name = (provider.name or '').strip()
    mr = (
        MatchResultaat.objects.filter(casus=case, uitgesloten=False)
        .select_related('zorgaanbieder')
        .filter(zorgaanbieder__name__iexact=name)
        .order_by('-totaalscore')
        .first()
    )
    if mr is None:
        return '', '', None
    raw_score = float(mr.totaalscore or 0.0)
    if 0 < raw_score <= 1.0:
        display_score = max(0, min(100, int(round(raw_score * 100))))
    else:
        display_score = max(0, min(100, int(round(raw_score))))
    summary = (mr.fit_samenvatting or '').strip()[:500]
    hint = _trade_offs_hint_short(mr.trade_offs)
    return summary, hint, display_score or None


def _arrangement_hint_line(intake: CaseIntakeProcess | None) -> str:
    if intake is None:
        return ''
    code = (getattr(intake, 'arrangement_type_code', '') or '').strip()
    prov = (getattr(intake, 'arrangement_provider', '') or '').strip()
    if not code and not prov:
        return ''
    parts: list[str] = []
    if code:
        parts.append(f'Arrangement (indicatief): {code}')
    if prov:
        parts.append(f'Bron registratie: {prov}')
    return ' · '.join(parts)[:400]


def _case_coordinator_display(intake: CaseIntakeProcess | None) -> str:
    if intake is None:
        return ''
    u = getattr(intake, 'case_coordinator', None)
    if u is None:
        return ''
    full = (u.get_full_name() or '').strip()
    return full or (getattr(u, 'username', None) or '').strip()


def _serialize_provider_evaluation_row(placement: PlacementRequest) -> dict:
    intake = placement.due_diligence_process
    case = intake.contract if intake is not None else None
    provider = placement.selected_provider or placement.proposed_provider
    provider_name = provider.name if provider is not None else ''
    provider_id = str(provider.pk) if provider is not None else ''

    urgency = intake.get_urgency_display() if intake is not None else ''
    complexity = intake.get_complexity_display() if intake is not None else ''
    municipality_id = str(intake.gemeente_id) if intake is not None and intake.gemeente_id else ''

    anchor = placement.provider_response_requested_at or placement.created_at
    if anchor is not None:
        days_pending = max(0, (timezone.now() - anchor).days)
    else:
        days_pending = 0

    case_title = case.title if case is not None else (intake.title if intake is not None else '')
    case_pk = case.pk if case is not None else None

    rejection = _outcome_reason_to_spa_rejection_code(placement.provider_response_reason_code or '')

    raw_notes = (placement.provider_response_notes or '').strip()
    info_type_slug, info_comment_body = _parse_provider_info_request_notes(raw_notes)
    pr_status = (placement.provider_response_status or '').strip().upper()

    if pr_status == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
        provider_comment = None
        information_request_type = info_type_slug
        information_request_comment = info_comment_body or None
    else:
        provider_comment = raw_notes or None
        information_request_type = None
        information_request_comment = None

    municipality_name = ''
    if intake is not None and intake.gemeente_id and getattr(intake, 'gemeente', None):
        municipality_name = intake.gemeente.municipality_name
    entry_route_label = intake.get_entry_route_display() if intake is not None else ''
    actor_profile_label = intake.get_aanmelder_actor_profile_display() if intake is not None else ''
    entry_route_value = intake.entry_route if intake is not None else ''
    actor_profile_value = intake.aanmelder_actor_profile if intake is not None else ''

    match_fit_summary, match_trade_offs_hint, match_score_val = _match_hints_for_placement(case, provider)
    arrangement_hint = _arrangement_hint_line(intake)
    arrangement_disclaimer = (
        'Indicatief arrangement — geen budget- of tarieftoezegging; bevestig financiering in eigen proces.'
        if arrangement_hint
        else ''
    )
    case_coordinator_label = _case_coordinator_display(intake)

    return {
        'id': str(placement.pk),
        'caseId': str(case_pk) if case_pk is not None else '',
        'caseTitle': case_title,
        'clientLabel': _evaluation_client_label(case),
        'region': _intake_region_label(intake, case),
        'urgency': urgency,
        'complexity': complexity,
        'careType': _placement_care_type_label(placement, intake),
        'providerId': provider_id,
        'providerName': provider_name,
        'municipalityId': municipality_id,
        'municipalityName': municipality_name,
        'entryRoute': entry_route_value,
        'entryRouteLabel': entry_route_label,
        'aanmelderActorProfile': actor_profile_value,
        'aanmelderActorProfileLabel': actor_profile_label,
        'caseCoordinatorLabel': case_coordinator_label,
        'matchFitSummary': match_fit_summary,
        'matchTradeOffsHint': match_trade_offs_hint,
        'arrangementHintLine': arrangement_hint,
        'arrangementHintDisclaimer': arrangement_disclaimer,
        'selectedMatchId': None,
        'status': _spa_evaluation_status_from_placement(placement),
        'rejectionReasonCode': rejection,
        'providerComment': provider_comment,
        'informationRequestType': information_request_type,
        'informationRequestComment': information_request_comment,
        'requestedAt': placement.provider_response_requested_at.isoformat()
        if placement.provider_response_requested_at
        else None,
        'respondedAt': placement.provider_response_recorded_at.isoformat()
        if placement.provider_response_recorded_at
        else None,
        'decidedAt': placement.provider_response_recorded_at.isoformat()
        if placement.provider_response_recorded_at
        else None,
        'createdAt': placement.created_at.isoformat(),
        'updatedAt': placement.updated_at.isoformat(),
        'daysPending': days_pending,
        'slaDeadlineAt': placement.provider_response_deadline_at.isoformat()
        if placement.provider_response_deadline_at
        else None,
        'matchScore': match_score_val,
    }


@login_required
@require_http_methods(["GET"])
def provider_evaluations_list_api(request):
    """List provider-side evaluations for the SPA (Aanbieder Beoordeling).

    Rows are derived from ``PlacementRequest`` + linked ``CaseIntakeProcess`` / ``CareCase``,
    scoped to the active organization. Zorgaanbieder users only see placements whose case
    is visible via the same placement-link rules as other case APIs.

    **Inclusion (provider-review window):** at least one of: case phase is
    ``provider_beoordeling``; ``provider_response_requested_at`` is set; placement
    ``status`` is ``IN_REVIEW``; or ``provider_response_status`` is not ``PENDING``.
    Rows must have a proposed or selected provider.

    **Info-request type:** when the provider chose ``INFO_REQUESTED`` with a structured
    type, the canonical API stores ``[INFO_TYPE:<slug>]`` at the start of
    ``provider_response_notes`` (see ``_compose_provider_info_request_notes``); legacy
    rows without that prefix still expose ``informationRequestComment`` from the full
    notes string when status is ``NEEDS_INFO``.

    **Handoff read-model (optional):** ``municipalityName``, ``entryRoute`` /
    ``entryRouteLabel``, ``aanmelderActorProfile`` / ``aanmelderActorProfileLabel``
    from the linked intake for operational context (read-only).
    **Advisory hints (row 6):** ``matchFitSummary``, ``matchTradeOffsHint``, ``matchScore`` from
    persisted ``MatchResultaat`` when it matches the placement aanbieder; ``arrangementHintLine`` +
    ``arrangementHintDisclaimer`` from intake arrangement metadata (not a financing guarantee).
    **Coordinator (row 9):** ``caseCoordinatorLabel`` — display name of ``CaseIntakeProcess.case_coordinator``.
    """
    organization = _active_organization(request)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    in_provider_review_window = (
        Q(due_diligence_process__contract__case_phase=CareCase.CasePhase.PROVIDER_BEOORDELING)
        | Q(provider_response_requested_at__isnull=False)
        | ~Q(provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING)
        | Q(status=PlacementRequest.Status.IN_REVIEW)
    )

    qs = (
        PlacementRequest.objects.for_organization(organization)
        .filter(
            due_diligence_process__isnull=False,
            due_diligence_process__contract__isnull=False,
        )
        .filter(in_provider_review_window)
        .filter(Q(proposed_provider__isnull=False) | Q(selected_provider__isnull=False))
        .select_related(
            'due_diligence_process',
            'due_diligence_process__contract',
            'due_diligence_process__gemeente',
            'due_diligence_process__case_coordinator',
            'due_diligence_process__regio',
            'due_diligence_process__preferred_region',
            'proposed_provider',
            'selected_provider',
        )
        .order_by('-updated_at')
    )
    qs = filter_placement_requests_for_provider_actor(qs, request.user, organization)

    total = qs.count()
    rows = [_serialize_provider_evaluation_row(p) for p in qs[:200]]
    return JsonResponse({'evaluations': rows, 'total_count': total})


@login_required
@require_http_methods(["GET"])
def regions_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = RegionalConfiguration.objects.filter(organization=organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(region_name__icontains=q) | Q(region_code__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for r in page_obj:
            data.append({
                'id': str(r.id),
                'name': r.region_name,
                'code': r.region_code,
                'regionType': r.region_type,
                'status': r.status,
                'maxWaitDays': r.max_wait_days,
                'providerCount': r.provider_count,
                'municipalityCount': r.municipality_count,
                'coordinator': r.responsible_coordinator.get_full_name() if r.responsible_coordinator else '',
            })
        return JsonResponse({'regions': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='regions_api_failed')


@login_required
@require_http_methods(["GET"])
def regions_health_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = RegionalConfiguration.objects.filter(organization=organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(region_name__icontains=q) | Q(region_code__icontains=q))

        region_type = request.GET.get('region_type', '')
        if region_type:
            qs = qs.filter(region_type=region_type)

        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)

        cases_qs = scope_queryset_for_organization(CareCase.objects.all(), organization).only(
            'id', 'service_region', 'status', 'case_phase', 'risk_level', 'preferred_provider',
            'phase_entered_at', 'updated_at', 'created_at',
        )
        cases_qs = filter_care_cases_for_provider_actor(cases_qs, request.user, organization)
        all_cases = list(cases_qs)

        provider_clients = list(
            Client.objects.filter(
                organization=organization,
                client_type='CORPORATION',
            ).select_related('provider_profile').prefetch_related(
                'provider_profile__served_regions',
                'provider_profile__secondary_served_regions',
            )
        )

        cases_by_region_key = {}
        for case in all_cases:
            service_key = _normalize_region_key(case.service_region)
            if not service_key:
                continue
            cases_by_region_key.setdefault(service_key, []).append(case)

        profiles_by_region_id = {}
        for client in provider_clients:
            profile = getattr(client, 'provider_profile', None)
            if profile is None:
                continue

            region_ids = set(profile.served_regions.values_list('id', flat=True))
            region_ids.update(profile.secondary_served_regions.values_list('id', flat=True))
            for region_id in region_ids:
                profiles_by_region_id.setdefault(region_id, []).append(profile)

        data = []
        for region in page_obj:
            keys = {
                _normalize_region_key(region.region_name),
                _normalize_region_key(region.region_code),
            }
            region_cases = []
            for key in keys:
                region_cases.extend(cases_by_region_key.get(key, []))

            # Deduplicate cases when region name/code resolve to the same key.
            seen_case_ids = set()
            deduped_cases = []
            for case in region_cases:
                if case.id in seen_case_ids:
                    continue
                seen_case_ids.add(case.id)
                deduped_cases.append(case)

            region_profiles = profiles_by_region_id.get(region.id, [])
            health = _build_region_health_payload(region, deduped_cases, region_profiles)

            data.append({
                'id': str(region.id),
                'name': region.region_name,
                'code': region.region_code,
                'regionType': region.region_type,
                'configurationStatus': region.status,
                'maxWaitDays': region.max_wait_days,
                'providerCount': region.provider_count,
                'municipalityCount': region.municipality_count,
                'coordinator': region.responsible_coordinator.get_full_name() if region.responsible_coordinator else '',
                'province': region.province,
                'regionTypeLabel': RegionType(region.region_type).label if region.region_type in RegionType.values else region.region_type,
                **health,
            })

        return JsonResponse({
            'regions': data,
            'total_count': paginator.count,
            'page': page,
            'total_pages': paginator.num_pages,
        })
    except Exception:
        return _internal_server_error(request, context='regions_health_api_failed')


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def dashboard_summary_api(request):
    organization = get_user_organization(request.user)
    try:
        cases_qs = scope_queryset_for_organization(CareCase.objects.all(), organization).exclude(lifecycle_stage='ARCHIVED')
        cases_qs = filter_care_cases_for_provider_actor(cases_qs, request.user, organization)
        signals_qs = CareSignal.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
            | Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
        )
        signals_qs = filter_care_signals_for_provider_actor(signals_qs, request.user, organization)
        tasks_qs = CareTask.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
        )
        tasks_qs = filter_care_tasks_for_provider_actor(tasks_qs, request.user, organization)

        total_cases = cases_qs.count()
        active_cases = cases_qs.filter(
            case_phase__in=['intake', 'beoordeling', 'matching', 'plaatsing', 'actief']
        ).count()
        open_signals = signals_qs.filter(status='OPEN').count()
        critical_signals = signals_qs.filter(status='OPEN', risk_level='CRITICAL').count()
        pending_tasks = tasks_qs.filter(status='PENDING').count()

        phase_counts = {}
        for item in cases_qs.values('case_phase').annotate(count=Count('id')):
            phase_counts[item['case_phase']] = item['count']

        risk_counts = {}
        for item in cases_qs.values('risk_level').annotate(count=Count('id')):
            risk_counts[item['risk_level']] = item['count']

        return JsonResponse({
            'totalCases': total_cases,
            'activeCases': active_cases,
            'openSignals': open_signals,
            'criticalSignals': critical_signals,
            'pendingTasks': pending_tasks,
            'phaseBreakdown': phase_counts,
            'riskBreakdown': risk_counts,
        })
    except Exception:
        return _internal_server_error(request, context='dashboard_summary_api_failed')


# ---------------------------------------------------------------------------
# Zorg OS v1.2 — wijkteam-instroom, budget, evaluaties, doorstroom (gemeente bron van waarheid)
# ---------------------------------------------------------------------------


@login_required
@require_http_methods(["POST"])
def case_early_lifecycle_api(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)
    action = str(payload.get('action') or '').strip().lower()
    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)
        previous = derive_workflow_state(intake=intake)
        if action == 'complete_wijkteam':
            if intake.entry_route != CaseIntakeProcess.EntryRoute.WIJKTEAM:
                return JsonResponse({'ok': False, 'error': 'Alleen voor wijkteam-instroom.'}, status=400)
            t = evaluate_transition(
                current_state=previous,
                target_state=WorkflowState.ZORGVRAAG_BEOORDELING,
                actor_role=actor_role,
                action=WorkflowAction.COMPLETE_WIJKTEAM_INTAKE,
            )
            if not t.allowed:
                return JsonResponse({'ok': False, 'error': t.reason}, status=400)
            intake.workflow_state = WorkflowState.ZORGVRAAG_BEOORDELING
            intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous,
                new_state=WorkflowState.ZORGVRAAG_BEOORDELING,
                action=WorkflowAction.COMPLETE_WIJKTEAM_INTAKE,
                source='case_early_lifecycle_api',
            )
        elif action == 'open_casus_from_zorgvraag':
            if intake.entry_route != CaseIntakeProcess.EntryRoute.WIJKTEAM:
                return JsonResponse({'ok': False, 'error': 'Alleen voor wijkteam-instroom.'}, status=400)
            t = evaluate_transition(
                current_state=previous,
                target_state=WorkflowState.DRAFT_CASE,
                actor_role=actor_role,
                action=WorkflowAction.COMPLETE_ZORGVRAAG_ASSESSMENT,
            )
            if not t.allowed:
                return JsonResponse({'ok': False, 'error': t.reason}, status=400)
            intake.workflow_state = WorkflowState.DRAFT_CASE
            intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=previous,
                new_state=WorkflowState.DRAFT_CASE,
                action=WorkflowAction.COMPLETE_ZORGVRAAG_ASSESSMENT,
                source='case_early_lifecycle_api',
            )
        else:
            return JsonResponse({'ok': False, 'error': 'Ongeldige actie.'}, status=400)
    return JsonResponse({'ok': True, 'caseId': str(intake.pk), 'workflowState': intake.workflow_state})


@login_required
@require_http_methods(["POST"])
def placement_budget_decision_api(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)
    decision = str(payload.get('decision') or '').strip().upper()
    note = (payload.get('note') or '').strip()
    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        placement = (
            PlacementRequest.objects.select_for_update()
            .filter(due_diligence_process=intake)
            .order_by('-updated_at')
            .first()
        )
        if placement is None:
            return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)
        previous = derive_workflow_state(intake=intake, placement=placement)
        now = timezone.now()
        status_map = {
            'APPROVE': PlacementRequest.BudgetReviewStatus.APPROVED,
            'APPROVED': PlacementRequest.BudgetReviewStatus.APPROVED,
            'REJECT': PlacementRequest.BudgetReviewStatus.REJECTED,
            'REJECTED': PlacementRequest.BudgetReviewStatus.REJECTED,
            'NEEDS_INFO': PlacementRequest.BudgetReviewStatus.NEEDS_INFO,
            'DEFER': PlacementRequest.BudgetReviewStatus.DEFERRED,
            'DEFERRED': PlacementRequest.BudgetReviewStatus.DEFERRED,
        }
        if decision not in status_map:
            return JsonResponse({'ok': False, 'error': 'Ongeldige budgetbeslissing.'}, status=400)
        new_budget = status_map[decision]
        wf_action = WorkflowAction.BUDGET_APPROVE
        target_state = WorkflowState.PROVIDER_ACCEPTED
        if new_budget == PlacementRequest.BudgetReviewStatus.REJECTED:
            wf_action = WorkflowAction.BUDGET_REJECT
            target_state = WorkflowState.MATCHING_READY
        elif new_budget in {PlacementRequest.BudgetReviewStatus.NEEDS_INFO, PlacementRequest.BudgetReviewStatus.DEFERRED}:
            wf_action = (
                WorkflowAction.BUDGET_REQUEST_INFO
                if new_budget == PlacementRequest.BudgetReviewStatus.NEEDS_INFO
                else WorkflowAction.BUDGET_DEFER
            )
            target_state = WorkflowState.BUDGET_REVIEW_PENDING

        t = evaluate_transition(
            current_state=previous,
            target_state=target_state,
            actor_role=actor_role,
            action=wf_action,
        )
        if not t.allowed:
            return JsonResponse({'ok': False, 'error': t.reason}, status=400)

        placement.budget_review_note = note
        placement.budget_review_decided_at = now
        placement.budget_review_decided_by = request.user

        if new_budget == PlacementRequest.BudgetReviewStatus.REJECTED:
            stamp = f"[{timezone.now().strftime('%d-%m-%Y %H:%M')}] [BUDGET_REJECT_REMATCH] {note}".strip()
            existing_notes = placement.decision_notes or ''
            placement.decision_notes = f"{existing_notes}\n{stamp}".strip()
            placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
            placement.status = PlacementRequest.Status.IN_REVIEW
            placement.budget_review_status = PlacementRequest.BudgetReviewStatus.NOT_REQUIRED
            placement.save(update_fields=[
                'decision_notes',
                'provider_response_status',
                'status',
                'budget_review_status',
                'budget_review_note',
                'budget_review_decided_at',
                'budget_review_decided_by',
                'updated_at',
            ])
            intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
            intake.workflow_state = WorkflowState.MATCHING_READY
            intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
            if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.MATCHING:
                intake.case_record.case_phase = CareCase.CasePhase.MATCHING
                intake.case_record.save(update_fields=['case_phase', 'updated_at'])
        else:
            placement.budget_review_status = new_budget
            placement.save(update_fields=[
                'budget_review_status',
                'budget_review_note',
                'budget_review_decided_at',
                'budget_review_decided_by',
                'updated_at',
            ])
            if new_budget == PlacementRequest.BudgetReviewStatus.APPROVED:
                intake.workflow_state = WorkflowState.PROVIDER_ACCEPTED
                intake.save(update_fields=['workflow_state', 'updated_at'])

        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.BUDGET_DECISION,
            recommendation_context={'decision': new_budget},
            user_action='budget_decision',
            actor_user_id=request.user.id,
            action_source='placement_budget_decision_api',
            provider_id=placement.selected_provider_id or placement.proposed_provider_id,
            actual_value={'budget_review_status': new_budget},
            optional_reason=note,
            strict=True,
        )
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous,
            new_state=derive_workflow_state(intake=intake, placement=placement),
            action=wf_action,
            placement=placement,
            reason=note,
            source='placement_budget_decision_api',
        )
    return JsonResponse({'ok': True, 'caseId': str(intake.pk)})


@login_required
@require_http_methods(["POST"])
def activate_placement_monitoring_api(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error
    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        placement = (
            PlacementRequest.objects.filter(due_diligence_process=intake).order_by('-updated_at').first()
        )
        previous = derive_workflow_state(intake=intake, placement=placement)
        t = evaluate_transition(
            current_state=previous,
            target_state=WorkflowState.ACTIVE_PLACEMENT,
            actor_role=actor_role,
            action=WorkflowAction.ACTIVATE_PLACEMENT_MONITORING,
        )
        if not t.allowed:
            return JsonResponse({'ok': False, 'error': t.reason}, status=400)
        intake.workflow_state = WorkflowState.ACTIVE_PLACEMENT
        intake.save(update_fields=['workflow_state', 'updated_at'])
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous,
            new_state=WorkflowState.ACTIVE_PLACEMENT,
            action=WorkflowAction.ACTIVATE_PLACEMENT_MONITORING,
            placement=placement,
            source='activate_placement_monitoring_api',
        )
    return JsonResponse({'ok': True, 'caseId': str(intake.pk)})


@login_required
@require_http_methods(["GET", "POST"])
def case_evaluations_api(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN, WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error
    intake = _get_intake_for_case_api_id(case_id, organization, lock=False, user=request.user)
    if request.method == 'GET':
        qs = CaseCareEvaluation.objects.filter(due_diligence_process=intake).order_by('due_date')
        return JsonResponse({'evaluations': [serialize_evaluation(e) for e in qs]})
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        return JsonResponse({'ok': False, 'error': 'Alleen gemeente kan evaluaties vastleggen.'}, status=403)
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)
    due_raw = str(payload.get('dueDate') or payload.get('due_date') or '').strip()
    try:
        due_date = date.fromisoformat(due_raw)
    except ValueError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige datum.'}, status=400)
    attendees = payload.get('attendees') or []
    if not isinstance(attendees, list):
        attendees = []
    ev = CaseCareEvaluation.objects.create(
        due_diligence_process=intake,
        due_date=due_date,
        attendees=[str(a) for a in attendees],
        recorded_by=request.user,
    )
    log_case_decision_event(
        case_id=intake.pk,
        placement_id=None,
        event_type=CaseDecisionLog.EventType.EVALUATION_OUTCOME,
        recommendation_context={'evaluation_id': ev.pk, 'phase': 'scheduled'},
        user_action='evaluation_scheduled',
        actor_user_id=request.user.id,
        action_source='case_evaluations_api',
        actual_value={'due_date': due_raw},
        strict=True,
    )
    return JsonResponse({'ok': True, 'evaluation': serialize_evaluation(ev)})


@login_required
@require_http_methods(["PATCH"])
def case_evaluation_detail_api(request, case_id, evaluation_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)
    intake = _get_intake_for_case_api_id(case_id, organization, lock=False, user=request.user)
    ev = get_object_or_404(CaseCareEvaluation, pk=evaluation_id, due_diligence_process=intake)
    today = timezone.now().date()
    status = str(payload.get('status') or '').strip().upper()
    outcome = str(payload.get('outcome') or '').strip().upper()
    follow_up = str(payload.get('followUpActions') or payload.get('follow_up_actions') or '').strip()
    if status in {CaseCareEvaluation.Status.UPCOMING, CaseCareEvaluation.Status.OVERDUE, CaseCareEvaluation.Status.COMPLETED}:
        ev.status = status
    valid_outcomes = {choice[0] for choice in CaseCareEvaluation.Outcome.choices}
    if outcome in valid_outcomes:
        ev.outcome = outcome
    if follow_up:
        ev.follow_up_actions = follow_up
    if ev.due_date < today and ev.status != CaseCareEvaluation.Status.COMPLETED:
        ev.status = CaseCareEvaluation.Status.OVERDUE
    ev.recorded_by = request.user
    ev.save()
    log_case_decision_event(
        case_id=intake.pk,
        placement_id=None,
        event_type=CaseDecisionLog.EventType.EVALUATION_OUTCOME,
        recommendation_context={'evaluation_id': ev.pk},
        user_action='evaluation_updated',
        actor_user_id=request.user.id,
        action_source='case_evaluation_detail_api',
        actual_value={'status': ev.status, 'outcome': ev.outcome},
        strict=True,
    )
    return JsonResponse({'ok': True, 'evaluation': serialize_evaluation(ev)})


@login_required
@require_http_methods(["POST"])
def provider_transition_request_api(request, case_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)
    proposed = str(payload.get('proposedCareForm') or payload.get('proposed_care_form') or '')[:32].strip()
    reason = str(payload.get('reason') or '').strip()
    if not proposed or not reason:
        return JsonResponse({'ok': False, 'error': 'Zorgvorm en reden zijn verplicht.'}, status=400)
    rsd = None
    raw_start = payload.get('requestedStartDate')
    if raw_start:
        try:
            rsd = date.fromisoformat(str(raw_start).strip())
        except ValueError:
            return JsonResponse({'ok': False, 'error': 'Ongeldige startdatum.'}, status=400)
    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        placement = (
            PlacementRequest.objects.filter(due_diligence_process=intake).order_by('-updated_at').first()
        )
        req = ProviderCareTransitionRequest.objects.create(
            due_diligence_process=intake,
            placement_request=placement,
            proposed_care_form=proposed,
            reason=reason,
            urgency=str(payload.get('urgency') or 'MEDIUM').strip()[:10],
            estimated_financial_impact=str(payload.get('estimatedFinancialImpact') or '').strip(),
            requested_start_date=rsd,
            supporting_explanation=str(payload.get('supportingExplanation') or '').strip(),
            created_by=request.user,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk if placement else None,
            event_type=CaseDecisionLog.EventType.TRANSITION_REQUEST,
            recommendation_context={'transition_request_id': req.pk},
            user_action='transition_request_submitted',
            actor_user_id=request.user.id,
            action_source='provider_transition_request_api',
            actual_value={'proposed_care_form': req.proposed_care_form},
            strict=True,
        )
    return JsonResponse({'ok': True, 'id': str(req.pk)})


@login_required
@require_http_methods(["POST"])
def transition_request_financial_api(request, case_id, transition_id):
    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)
    decision = str(payload.get('decision') or '').strip().upper()
    note = str(payload.get('note') or '').strip()
    status_map = {
        'APPROVED': ProviderCareTransitionRequest.FinancialValidationStatus.APPROVED,
        'REJECTED': ProviderCareTransitionRequest.FinancialValidationStatus.REJECTED,
        'NEEDS_INFO': ProviderCareTransitionRequest.FinancialValidationStatus.NEEDS_INFO,
        'DEFERRED': ProviderCareTransitionRequest.FinancialValidationStatus.DEFERRED,
    }
    if decision not in status_map:
        return JsonResponse({'ok': False, 'error': 'Ongeldige beslissing.'}, status=400)
    intake = _get_intake_for_case_api_id(case_id, organization, lock=False, user=request.user)
    tr = get_object_or_404(ProviderCareTransitionRequest, pk=transition_id, due_diligence_process=intake)
    now = timezone.now()
    tr.financial_validation_status = status_map[decision]
    tr.financial_validation_note = note
    tr.financial_validation_at = now
    tr.financial_validation_by = request.user
    if tr.financial_validation_status == ProviderCareTransitionRequest.FinancialValidationStatus.APPROVED:
        tr.status = ProviderCareTransitionRequest.Status.CLOSED
    tr.save()
    log_case_decision_event(
        case_id=intake.pk,
        placement_id=tr.placement_request_id,
        event_type=CaseDecisionLog.EventType.FINANCIAL_VALIDATION,
        recommendation_context={'transition_request_id': tr.pk, 'decision': tr.financial_validation_status},
        user_action='transition_financial_decision',
        actor_user_id=request.user.id,
        action_source='transition_request_financial_api',
        optional_reason=note,
        strict=True,
    )
    return JsonResponse({'ok': True, 'id': str(tr.pk), 'financialValidationStatus': tr.financial_validation_status})
