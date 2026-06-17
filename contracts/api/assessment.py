"""
Assessment API views: assessment decision flow.
"""
import json
import logging

from django.http import Http404, JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.db import transaction

from contracts.governance import AuditLoggingError, log_case_decision_event
from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseIntakeProcess,
)
from contracts.tenancy import get_user_organization, get_scoped_object_or_404
from contracts.permissions import ensure_provider_case_visible_or_404
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    derive_workflow_state,
    evaluate_transition,
    log_transition_event,
    resolve_actor_role,
)
from contracts.workflow_summary_gate import (
    ensure_workflow_summary_for_matching,
)

from contracts.api._helpers import (
    _get_intake_for_case_api_id,
    _internal_server_error,
    _require_workflow_role,
    _resolved_intake_urgency,
)
from contracts.api.matching import _persist_advisory_matching_results

logger = logging.getLogger(__name__)


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
            'urgency': _resolved_intake_urgency(intake) or intake.urgency,
            'zorgtype': intake.zorgvorm_gewenst or intake.preferred_care_form,
            'shortDescription': assessment.notes or intake.assessment_summary or '',
            'workflowSummary': {
                'context': ws.get('context', ''),
                'urgency': ws.get('urgency', '') or _resolved_intake_urgency(intake) or intake.urgency or '',
                'risks': ws.get('risks', []) if isinstance(ws.get('risks'), list) else [],
                'missing_information': ws.get('missing_information', ''),
                'risks_none_ack': bool(ws.get('risks_none_ack')),
            },
        },
        'summary': {
            'title': intake.title,
            'urgency': _resolved_intake_urgency(intake) or intake.urgency,
            'matchingReady': bool(assessment.matching_ready),
        },
        'hints': {
            'suggestedUrgency': {
                'value': _resolved_intake_urgency(intake) or intake.urgency,
                'label': intake.get_urgency_display() or (_resolved_intake_urgency(intake) or intake.urgency),
            },
        },
        'consequences': [
            'matching',
            'placement',
        ],
    }


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
    care_intensity = (payload.get('care_intensity') or intake.care_intensity or '').strip()
    zorgtype = (payload.get('zorgtype') or intake.zorgvorm_gewenst or intake.preferred_care_form or '').strip()
    constraints = payload.get('constraints') or []

    raw_ws = payload.get('workflow_summary') or payload.get('workflowSummary')
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
    if care_intensity:
        intake.care_intensity = care_intensity
    if zorgtype:
        intake.zorgvorm_gewenst = zorgtype
        intake.preferred_care_form = zorgtype

    transition_steps: list[tuple[str, str, str]] = []
    if decision == 'matching':
        ok_sum, err_sum = ensure_workflow_summary_for_matching(assessment=assessment, intake=intake)
        if not ok_sum:
            return JsonResponse({'ok': False, 'error': err_sum, 'code': 'SUMMARY_INCOMPLETE'}, status=400)

        current_state = previous_state
        if current_state == WorkflowState.DRAFT_CASE:
            summary_step = evaluate_transition(
                current_state=current_state,
                target_state=WorkflowState.SUMMARY_READY,
                actor_role=actor_role,
                action=WorkflowAction.COMPLETE_SUMMARY,
            )
            if not summary_step.allowed:
                return JsonResponse({'ok': False, 'error': summary_step.reason}, status=400)
            transition_steps.append(
                (current_state, WorkflowState.SUMMARY_READY, WorkflowAction.COMPLETE_SUMMARY),
            )
            current_state = WorkflowState.SUMMARY_READY

        matching_step = evaluate_transition(
            current_state=current_state,
            target_state=WorkflowState.MATCHING_READY,
            actor_role=actor_role,
            action=WorkflowAction.START_MATCHING,
        )
        if not matching_step.allowed:
            return JsonResponse({'ok': False, 'error': matching_step.reason}, status=400)
        transition_steps.append(
            (current_state, WorkflowState.MATCHING_READY, WorkflowAction.START_MATCHING),
        )

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

    new_state = WorkflowState.MATCHING_READY if decision == 'matching' else WorkflowState.SUMMARY_READY
    try:
        with transaction.atomic():
            intake.workflow_state = new_state
            intake.save(update_fields=['urgency', 'complexity', 'care_intensity', 'zorgvorm_gewenst', 'preferred_care_form', 'status', 'workflow_state', 'updated_at'])
            case_record.save(update_fields=['case_phase', 'updated_at'])
            assessment.assessed_by = request.user
            assessment.save()
            if decision == 'matching' and transition_steps:
                for old_state, target_state, action in transition_steps:
                    log_transition_event(
                        intake=intake,
                        actor_user=request.user,
                        actor_role=actor_role,
                        old_state=old_state,
                        new_state=target_state,
                        action=action,
                        source='assessment_decision_api',
                    )
            else:
                action = WorkflowAction.START_MATCHING if decision == 'matching' else WorkflowAction.COMPLETE_SUMMARY
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

    if decision == 'matching':
        try:
            _persist_advisory_matching_results(
                case_record=case_record,
                intake=intake,
                organization=organization,
            )
        except Exception:
            logger.exception(
                "persist_matching_results_failed case_id=%s intake_id=%s",
                case_record.pk,
                intake.pk,
            )
            return JsonResponse(
                {
                    'ok': False,
                    'error': 'Matching kon niet worden vastgelegd. Probeer opnieuw vanuit de matchingpagina.',
                    'code': 'MATCHING_PERSIST_FAILED',
                },
                status=503,
            )

    return JsonResponse({
        'ok': True,
        'nextPage': 'matching' if decision == 'matching' else 'assessment',
        'caseId': str(case_record.pk),
        'assessmentId': str(assessment.pk),
        'assessment': _assessment_decision_payload(case_record=case_record, intake=intake, assessment=assessment),
    })
