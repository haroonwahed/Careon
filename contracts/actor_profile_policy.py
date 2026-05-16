"""
P2 foundation: actor-profile hints intersected with WorkflowRole action sets.

Authorization remains keyed on ``WorkflowRole`` until P3 (see ``docs/ACTOR_PROFILES_ROADMAP.md``).
This module narrows *permitted* actions when a persisted ``aanmelder_actor_profile`` implies
a narrower operational mandate (e.g. wijkteam cannot resolve financial transition gates).
"""
from __future__ import annotations

from contracts.models import CaseIntakeProcess
from contracts.workflow_state_machine import WorkflowAction, WorkflowRole

# Actions denied for (workflow_role, aanmelder_actor_profile) even when the role would allow them.
_PROFILE_ACTION_DENIALS: dict[tuple[str, str], frozenset[str]] = {
    (
        WorkflowRole.GEMEENTE,
        CaseIntakeProcess.AanmelderActorProfile.WIJKTEAM,
    ): frozenset({
        WorkflowAction.RESOLVE_TRANSITION_FINANCIAL,
        WorkflowAction.BUDGET_APPROVE,
        WorkflowAction.BUDGET_REJECT,
        WorkflowAction.BUDGET_REQUEST_INFO,
        WorkflowAction.BUDGET_DEFER,
    }),
    (
        WorkflowRole.ZORGAANBIEDER,
        CaseIntakeProcess.AanmelderActorProfile.ZORGAANBIEDER_ORG,
    ): frozenset({
        WorkflowAction.VALIDATE_MATCHING,
        WorkflowAction.SEND_TO_PROVIDER,
        WorkflowAction.RESOLVE_TRANSITION_FINANCIAL,
    }),
}


def actor_profile_denied_actions(
    *,
    workflow_role: str,
    actor_profile: str | None,
) -> frozenset[str]:
    if not actor_profile:
        return frozenset()
    return _PROFILE_ACTION_DENIALS.get((workflow_role, actor_profile), frozenset())


def filter_actions_for_actor_profile(
    *,
    workflow_role: str,
    actor_profile: str | None,
    permitted_actions: set[str],
) -> set[str]:
    """Return ``permitted_actions`` minus profile-specific denials."""
    denied = actor_profile_denied_actions(
        workflow_role=workflow_role,
        actor_profile=actor_profile,
    )
    if not denied:
        return set(permitted_actions)
    return {action for action in permitted_actions if action not in denied}


_DECISION_CODE_TO_WORKFLOW_ACTION: dict[str, str] = {
    'VALIDATE_MATCHING': WorkflowAction.VALIDATE_MATCHING,
    'SEND_TO_PROVIDER': WorkflowAction.SEND_TO_PROVIDER,
    'BUDGET_APPROVE': WorkflowAction.BUDGET_APPROVE,
    'BUDGET_REJECT': WorkflowAction.BUDGET_REJECT,
    'BUDGET_REQUEST_INFO': WorkflowAction.BUDGET_REQUEST_INFO,
    'BUDGET_DEFER': WorkflowAction.BUDGET_DEFER,
    'RESOLVE_TRANSITION_FINANCIAL': WorkflowAction.RESOLVE_TRANSITION_FINANCIAL,
}


def decision_action_blocked_for_actor_profile(
    *,
    action_code: str,
    workflow_role: str,
    actor_profile: str | None,
) -> bool:
    """True when NBA/decision-engine action_code is denied for the case actor profile."""
    workflow_action = _DECISION_CODE_TO_WORKFLOW_ACTION.get(action_code)
    if not workflow_action:
        return False
    return workflow_action in actor_profile_denied_actions(
        workflow_role=workflow_role,
        actor_profile=actor_profile,
    )


def actor_profile_allows_action(
    *,
    workflow_role: str,
    actor_profile: str | None,
    action: str,
    permitted_actions: set[str],
) -> bool:
    """True when ``action`` is in the role set and not denied for the actor profile."""
    if action not in permitted_actions:
        return False
    return action not in actor_profile_denied_actions(
        workflow_role=workflow_role,
        actor_profile=actor_profile,
    )
