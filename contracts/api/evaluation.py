"""
Evaluation API views: case evaluations, provider evaluations list, assessments,
placements, signals, tasks, early lifecycle.
"""
from __future__ import annotations

import json
import logging
from datetime import date

from django.db.models import Q, Prefetch
from django.http import Http404, JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.paginator import Paginator

from contracts.governance import AuditLoggingError, log_case_decision_event
from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseCareEvaluation,
    CaseDecisionLog,
    CaseIntakeProcess,
    CareSignal,
    CareTask,
    Client,
    MatchResultaat,
    OutcomeReasonCode,
    PlacementRequest,
)
from contracts.tenancy import get_user_organization
from contracts.permissions import (
    filter_care_cases_for_provider_actor,
    filter_care_signals_for_provider_actor,
    filter_care_tasks_for_provider_actor,
    filter_placement_requests_for_provider_actor,
    visible_provider_scoped_care_cases,
)
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    derive_workflow_state,
    evaluate_transition,
    log_transition_event,
    resolve_actor_role,
    sync_case_phase_from_workflow_state,
)
from contracts.care_lifecycle_v12 import serialize_evaluation
from contracts.workflow_summary_gate import MIN_SUMMARY_CONTEXT_LEN
from django.db import transaction
from contracts.zorgbehoefte_taxonomy import format_taxonomy_explainability

from contracts.api._helpers import (
    _active_organization,
    _evaluation_client_label,
    _get_intake_for_case_api_id,
    _internal_server_error,
    _parse_provider_info_request_notes,
    _require_workflow_role,
)

logger = logging.getLogger(__name__)


def _normalize_provider_rejection_reason_code(raw: str) -> str:
    """Map SPA rejection slugs (and legacy codes) to ``OutcomeReasonCode`` values."""
    slug = str(raw or '').strip().lower()
    slug_map = {
        'geen_capaciteit': OutcomeReasonCode.CAPACITY,
        'urgentie_niet_haalbaar': OutcomeReasonCode.WAITLIST,
        'specialisatie_past_niet': OutcomeReasonCode.CARE_MISMATCH,
        'regio_niet_passend': OutcomeReasonCode.REGION_MISMATCH,
        'te_hoge_complexiteit': OutcomeReasonCode.SAFETY_RISK,
        'onvoldoende_informatie': OutcomeReasonCode.ADMINISTRATIVE_BLOCK,
        'andere_reden': OutcomeReasonCode.OTHER,
    }
    if slug in slug_map:
        return slug_map[slug]
    upper = str(raw or '').strip().upper()
    valid = {choice.value for choice in OutcomeReasonCode}
    if upper in valid:
        return upper
    return OutcomeReasonCode.OTHER


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


def _match_hints_for_placement(
    case: CareCase | None,
    provider: Client | None,
    *,
    match_lookup: dict | None = None,
) -> tuple[str, str, int | None]:
    """Read-model hints from persisted MatchResultaat for this case + aanbieder (advisory).

    Pass ``match_lookup`` (case_id → MatchResultaat) from a pre-fetched batch to avoid
    one DB query per row when serializing a list.
    """
    if case is None or provider is None or not (provider.name or '').strip():
        return '', '', None
    name = (provider.name or '').strip()

    if match_lookup is not None:
        mr = match_lookup.get(case.pk)
        if mr is None:
            return '', '', None
        if (mr.zorgaanbieder is None) or (mr.zorgaanbieder.name or '').strip().lower() != name.lower():
            return '', '', None
    else:
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


def _serialize_provider_evaluation_row(placement: PlacementRequest, *, match_lookup: dict | None = None) -> dict:
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

    match_fit_summary, match_trade_offs_hint, match_score_val = _match_hints_for_placement(case, provider, match_lookup=match_lookup)
    arrangement_hint = _arrangement_hint_line(intake)
    arrangement_disclaimer = (
        'Indicatief arrangement — geen budget- of tarieftoezegging; bevestig financiering in eigen proces.'
        if arrangement_hint
        else ''
    )
    case_coordinator_label = _case_coordinator_display(intake)
    care_category_main = getattr(intake, 'care_category_main', None)
    care_category_sub = getattr(intake, 'care_category_sub', None)
    taxonomie_lijn, taxonomie_code_lijn = format_taxonomy_explainability(
        getattr(care_category_main, 'name', '') or '',
        getattr(care_category_main, 'code', '') or '',
        getattr(care_category_sub, 'name', '') or '',
        getattr(care_category_sub, 'code', '') or '',
    )

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
        'zorgbehoefteCategorie': getattr(care_category_main, 'name', '') or '',
        'zorgbehoefteCategorieCode': getattr(care_category_main, 'code', '') or '',
        'zorgbehoefteSpecifiek': getattr(care_category_sub, 'name', '') or '',
        'zorgbehoefteSpecifiekCode': getattr(care_category_sub, 'code', '') or '',
        'taxonomieLijn': taxonomie_lijn,
        'taxonomieCodeLijn': taxonomie_code_lijn,
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
    placements = list(qs[:200])

    # Batch-load MatchResultaat to avoid one query per placement row (N+1).
    case_ids = [
        p.due_diligence_process.contract_id
        for p in placements
        if p.due_diligence_process and p.due_diligence_process.contract_id
    ]
    match_lookup: dict[int, MatchResultaat] = {}
    if case_ids:
        for mr in (
            MatchResultaat.objects.filter(casus_id__in=case_ids, uitgesloten=False)
            .select_related('zorgaanbieder')
            .order_by('-totaalscore')
        ):
            # Keep only the top-scoring match per case (queryset is already ordered desc).
            if mr.casus_id not in match_lookup:
                match_lookup[mr.casus_id] = mr

    rows = [_serialize_provider_evaluation_row(p, match_lookup=match_lookup) for p in placements]
    return JsonResponse({'evaluations': rows, 'total_count': total})


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
            sync_case_phase_from_workflow_state(intake)
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
            sync_case_phase_from_workflow_state(intake)
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
def case_summary_api(request, case_id):
    """POST /api/cases/<id>/summary/ — sla een casusomschrijving op.

    Het casusoverzicht wordt afgeleid uit deze omschrijving; zodra die voldoende
    context bevat is de matchinggate vervuld. Gemeente/regie/admin only.
    """
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
    summary = str(payload.get('summary') or '').strip()
    if not summary:
        return JsonResponse({'ok': False, 'error': 'Casusomschrijving mag niet leeg zijn.'}, status=400)
    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)
        intake.assessment_summary = summary[:4000]
        intake.save(update_fields=['assessment_summary', 'updated_at'])
    return JsonResponse({
        'ok': True,
        'caseId': str(intake.pk),
        'summaryLength': len(summary),
        'minLength': MIN_SUMMARY_CONTEXT_LEN,
        'matchingSummaryReady': len(summary) >= MIN_SUMMARY_CONTEXT_LEN,
    })
