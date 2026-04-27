from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from django.contrib.auth import get_user_model

from contracts.governance import log_case_decision_event
from contracts.models import CaseAssessment, CaseDecisionLog, CaseIntakeProcess, OrganizationMembership, PlacementRequest, UserProfile

User = get_user_model()


class WorkflowRole:
    GEMEENTE = 'gemeente'
    ZORGAANBIEDER = 'zorgaanbieder'
    ADMIN = 'admin'


class WorkflowState:
    DRAFT_CASE = 'DRAFT_CASE'
    SUMMARY_READY = 'SUMMARY_READY'
    MATCHING_READY = 'MATCHING_READY'
    GEMEENTE_VALIDATED = 'GEMEENTE_VALIDATED'
    PROVIDER_REVIEW_PENDING = 'PROVIDER_REVIEW_PENDING'
    PROVIDER_ACCEPTED = 'PROVIDER_ACCEPTED'
    PROVIDER_REJECTED = 'PROVIDER_REJECTED'
    PLACEMENT_CONFIRMED = 'PLACEMENT_CONFIRMED'
    INTAKE_STARTED = 'INTAKE_STARTED'
    ARCHIVED = 'ARCHIVED'


class WorkflowAction:
    CREATE_CASE = 'create_case'
    COMPLETE_SUMMARY = 'complete_summary'
    START_MATCHING = 'start_matching'
    VALIDATE_MATCHING = 'validate_matching'
    SEND_TO_PROVIDER = 'send_to_provider'
    PROVIDER_ACCEPT = 'provider_accept'
    PROVIDER_REJECT = 'provider_reject'
    PROVIDER_REQUEST_INFO = 'provider_request_info'
    CONFIRM_PLACEMENT = 'confirm_placement'
    START_INTAKE = 'start_intake'
    ARCHIVE_CASE = 'archive_case'
    REMATCH = 'rematch'


_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    WorkflowState.DRAFT_CASE: {WorkflowState.SUMMARY_READY},
    WorkflowState.SUMMARY_READY: {WorkflowState.MATCHING_READY},
    WorkflowState.MATCHING_READY: {WorkflowState.GEMEENTE_VALIDATED},
    WorkflowState.GEMEENTE_VALIDATED: {WorkflowState.PROVIDER_REVIEW_PENDING},
    WorkflowState.PROVIDER_REVIEW_PENDING: {
        WorkflowState.PROVIDER_ACCEPTED,
        WorkflowState.PROVIDER_REJECTED,
        WorkflowState.MATCHING_READY,
    },
    WorkflowState.PROVIDER_REJECTED: {WorkflowState.MATCHING_READY},
    WorkflowState.PROVIDER_ACCEPTED: {WorkflowState.PLACEMENT_CONFIRMED},
    WorkflowState.PLACEMENT_CONFIRMED: {WorkflowState.INTAKE_STARTED},
    WorkflowState.INTAKE_STARTED: {WorkflowState.ARCHIVED},
}

_ROLE_ACTIONS: dict[str, set[str]] = {
    WorkflowRole.GEMEENTE: {
        WorkflowAction.CREATE_CASE,
        WorkflowAction.COMPLETE_SUMMARY,
        WorkflowAction.START_MATCHING,
        WorkflowAction.VALIDATE_MATCHING,
        WorkflowAction.SEND_TO_PROVIDER,
        WorkflowAction.CONFIRM_PLACEMENT,
        WorkflowAction.ARCHIVE_CASE,
        WorkflowAction.REMATCH,
    },
    WorkflowRole.ZORGAANBIEDER: {
        WorkflowAction.PROVIDER_ACCEPT,
        WorkflowAction.PROVIDER_REJECT,
        WorkflowAction.PROVIDER_REQUEST_INFO,
        WorkflowAction.START_INTAKE,
    },
    WorkflowRole.ADMIN: {
        WorkflowAction.CREATE_CASE,
        WorkflowAction.COMPLETE_SUMMARY,
        WorkflowAction.START_MATCHING,
        WorkflowAction.VALIDATE_MATCHING,
        WorkflowAction.SEND_TO_PROVIDER,
        WorkflowAction.PROVIDER_ACCEPT,
        WorkflowAction.PROVIDER_REJECT,
        WorkflowAction.PROVIDER_REQUEST_INFO,
        WorkflowAction.CONFIRM_PLACEMENT,
        WorkflowAction.START_INTAKE,
        WorkflowAction.ARCHIVE_CASE,
        WorkflowAction.REMATCH,
    },
}


@dataclass(frozen=True)
class TransitionDecision:
    allowed: bool
    reason: str
    current_state: str


def resolve_actor_role(*, user: User, organization=None) -> str:
    membership = None
    if organization is not None:
        membership = (
            OrganizationMembership.objects
            .filter(
                user=user,
                organization=organization,
                is_active=True,
                organization__is_active=True,
            )
            .first()
        )

    if membership and membership.role in {OrganizationMembership.Role.OWNER, OrganizationMembership.Role.ADMIN}:
        return WorkflowRole.ADMIN

    profile_role = getattr(getattr(user, 'profile', None), 'role', None)
    if profile_role == UserProfile.Role.CLIENT:
        return WorkflowRole.ZORGAANBIEDER
    if profile_role == UserProfile.Role.ADMIN:
        return WorkflowRole.ADMIN

    return WorkflowRole.GEMEENTE


def can_role_execute_action(role: str, action: str) -> bool:
    return action in _ROLE_ACTIONS.get(role, set())


def can_transition(current_state: str, target_state: str) -> bool:
    if current_state == target_state:
        return True
    return target_state in _ALLOWED_TRANSITIONS.get(current_state, set())


def evaluate_transition(*, current_state: str, target_state: str, actor_role: str, action: str) -> TransitionDecision:
    if not can_role_execute_action(actor_role, action):
        return TransitionDecision(
            allowed=False,
            reason='Deze rol mag deze workflow-actie niet uitvoeren.',
            current_state=current_state,
        )

    if not can_transition(current_state, target_state):
        return TransitionDecision(
            allowed=False,
            reason=f'Ongeldige workflow-overgang van {current_state} naar {target_state}.',
            current_state=current_state,
        )

    return TransitionDecision(allowed=True, reason='', current_state=current_state)


def derive_workflow_state(*, intake: CaseIntakeProcess, assessment: CaseAssessment | None = None, placement: PlacementRequest | None = None) -> str:
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return WorkflowState.ARCHIVED

    persisted_state = str(getattr(intake, 'workflow_state', '') or '').strip()
    if persisted_state in {
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
    } and persisted_state != WorkflowState.DRAFT_CASE:
        return persisted_state

    if assessment is None:
        assessment = getattr(intake, 'case_assessment', None)

    if placement is None:
        placement = (
            PlacementRequest.objects
            .filter(due_diligence_process=intake)
            .order_by('-updated_at')
            .first()
        )

    if intake.status == CaseIntakeProcess.ProcessStatus.COMPLETED and placement and placement.status == PlacementRequest.Status.APPROVED:
        return WorkflowState.INTAKE_STARTED

    if placement is not None:
        if placement.status == PlacementRequest.Status.APPROVED:
            return WorkflowState.PLACEMENT_CONFIRMED

        if placement.provider_response_status == PlacementRequest.ProviderResponseStatus.ACCEPTED:
            return WorkflowState.PROVIDER_ACCEPTED

        if placement.provider_response_status in {
            PlacementRequest.ProviderResponseStatus.REJECTED,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        }:
            return WorkflowState.PROVIDER_REJECTED

        if placement.status == PlacementRequest.Status.IN_REVIEW:
            return WorkflowState.PROVIDER_REVIEW_PENDING

    if intake.status == CaseIntakeProcess.ProcessStatus.MATCHING:
        return WorkflowState.MATCHING_READY

    if assessment is not None:
        if assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING and assessment.matching_ready:
            return WorkflowState.MATCHING_READY
        if assessment.assessment_status in {
            CaseAssessment.AssessmentStatus.UNDER_REVIEW,
            CaseAssessment.AssessmentStatus.NEEDS_INFO,
        } or bool((assessment.notes or '').strip()):
            return WorkflowState.SUMMARY_READY

    return WorkflowState.DRAFT_CASE


def normalize_provider_rejection_states() -> set[str]:
    return {
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    }


def log_transition_event(
    *,
    intake: CaseIntakeProcess,
    actor_user,
    actor_role: str,
    old_state: str,
    new_state: str,
    action: str,
    placement: PlacementRequest | None = None,
    reason: str | None = None,
    source: str,
) -> None:
    provider_id = None
    placement_id = None
    if placement is not None:
        placement_id = placement.pk
        provider_id = placement.selected_provider_id or placement.proposed_provider_id

    log_case_decision_event(
        case_id=intake.pk,
        placement_id=placement_id,
        event_type=CaseDecisionLog.EventType.STATE_TRANSITION,
        recommendation_context={
            'old_state': old_state,
            'new_state': new_state,
            'action': action,
            'actor_role': actor_role,
        },
        user_action=action,
        actor_user_id=getattr(actor_user, 'id', None),
        action_source=source,
        provider_id=provider_id,
        actual_value={
            'old_state': old_state,
            'new_state': new_state,
            'action': action,
            'actor_role': actor_role,
            'timestamp': intake.updated_at.isoformat() if intake.updated_at else '',
        },
        optional_reason=reason or '',
    )
