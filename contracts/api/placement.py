"""
Placement API views: placement detail, provider decision, placement actions,
budget decision, monitoring activation, transition requests.
"""
import json
import logging
from datetime import date

from django.http import Http404, JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from contracts.capacity import NO_CAPACITY_CODE, commit_capacity, release_capacity
from contracts.governance import AuditLoggingError, log_case_decision_event
from contracts.models import (
    CareCase,
    CaseCareEvaluation,
    CaseDecisionLog,
    CaseIntakeProcess,
    PlacementRequest,
    ProviderCareTransitionRequest,
    OutcomeReasonCode,
)
from contracts.tenancy import get_user_organization
from contracts.permissions import provider_client_ids_for_user
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    derive_workflow_state,
    evaluate_transition,
    log_transition_event,
    normalize_provider_rejection_states,
    sync_case_phase_from_workflow_state,
)
from contracts.care_lifecycle_v12 import (
    sync_placement_budget_review_flags,
    care_form_requires_budget_review,
    effective_care_form_code,
)
from contracts.zorgbehoefte_taxonomy import format_taxonomy_explainability

from contracts.api._helpers import (
    _compose_provider_info_request_notes,
    _get_intake_for_case_api_id,
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

    care_category_main = getattr(intake, 'care_category_main', None)
    care_category_sub = getattr(intake, 'care_category_sub', None)
    taxonomie_lijn, taxonomie_code_lijn = format_taxonomy_explainability(
        getattr(care_category_main, 'name', '') or '',
        getattr(care_category_main, 'code', '') or '',
        getattr(care_category_sub, 'name', '') or '',
        getattr(care_category_sub, 'code', '') or '',
    )

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
            'zorgbehoefteCategorie': getattr(care_category_main, 'name', '') or '',
            'zorgbehoefteCategorieCode': getattr(care_category_main, 'code', '') or '',
            'zorgbehoefteSpecifiek': getattr(care_category_sub, 'name', '') or '',
            'zorgbehoefteSpecifiekCode': getattr(care_category_sub, 'code', '') or '',
            'taxonomieLijn': taxonomie_lijn,
            'taxonomieCodeLijn': taxonomie_code_lijn,
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
    reason_code = _normalize_provider_rejection_reason_code(
        str(payload.get('rejection_reason_code') or payload.get('reason_code') or ''),
    )

    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

        placement = (
            PlacementRequest.objects
            .select_for_update(of=('self',))
            .filter(due_diligence_process=intake)
            .select_related('selected_provider', 'proposed_provider')
            .order_by('-updated_at')
            .first()
        )
        if placement is None:
            return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

        effective_provider_id = placement.selected_provider_id or placement.proposed_provider_id
        if effective_provider_id is None:
            return JsonResponse(
                {'ok': False, 'error': 'Geen aanbieder gekoppeld aan deze casus; beslissing geweigerd.'},
                status=400,
            )

        actor_client_ids = provider_client_ids_for_user(request.user, organization)
        if effective_provider_id not in actor_client_ids:
            return JsonResponse(
                {'ok': False, 'error': 'Niet gemachtigd: u bent niet de geselecteerde aanbieder voor deze casus.'},
                status=403,
            )

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

            if intake.workflow_state != target_state:
                intake.workflow_state = target_state
                intake.save(update_fields=['workflow_state', 'updated_at'])
                sync_case_phase_from_workflow_state(intake)
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
                sync_case_phase_from_workflow_state(intake)
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
                sync_case_phase_from_workflow_state(intake)
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
            .select_for_update(of=('self',))
            .filter(due_diligence_process=intake)
            .select_related(
                'selected_provider', 'selected_provider__zorgaanbieder',
                'proposed_provider', 'proposed_provider__zorgaanbieder',
            )
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

            cap_ok, cap_code = commit_capacity(placement)
            if not cap_ok:
                return JsonResponse(
                    {
                        'ok': False,
                        'error': 'Geen capaciteit beschikbaar bij deze aanbieder.',
                        'code': NO_CAPACITY_CODE,
                    },
                    status=409,
                )

            placement.status = PlacementRequest.Status.APPROVED
            if note:
                existing = placement.decision_notes or ''
                stamped_note = f"[{timezone.now().strftime('%d-%m-%Y %H:%M')}] {note}"
                placement.decision_notes = f"{existing}\n{stamped_note}".strip()
                placement.save(update_fields=['status', 'decision_notes', 'updated_at'])
            else:
                placement.save(update_fields=['status', 'updated_at'])

            new_state = WorkflowState.PLACEMENT_CONFIRMED
            if intake.workflow_state != new_state:
                intake.workflow_state = new_state
                intake.save(update_fields=['workflow_state', 'updated_at'])
                sync_case_phase_from_workflow_state(intake)
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

            release_capacity(placement)
            placement.status = PlacementRequest.Status.REJECTED
            placement.save(update_fields=['status', 'updated_at'])
            intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
            intake.workflow_state = WorkflowState.MATCHING_READY
            intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
            sync_case_phase_from_workflow_state(intake)
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
            sync_case_phase_from_workflow_state(intake)
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
                sync_case_phase_from_workflow_state(intake)

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
        sync_case_phase_from_workflow_state(intake)
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
