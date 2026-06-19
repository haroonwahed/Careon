"""
WorkflowBus — thin event bus for Carelane workflow state transitions.

Every state-mutating action in views.py calls ``publish_transition()``
instead of fire-and-forgetting a ``.save()``.  That helper:
  1. Writes the audit row (CaseDecisionLog.EventType.STATE_TRANSITION)
  2. Fires a Django signal on the bus — external handlers can subscribe
     for notifications, replay, SLA re-evaluation, etc.

Usage inside a view:

    from contracts.workflow_bus import WorkflowBus, publish_transition

    old = intake.workflow_state
    intake.workflow_state = WorkflowState.MATCHING_READY
    intake.status = ProcessStatus.MATCHING
    intake.save(update_fields=["workflow_state", "status"])

    publish_transition(
        bus_event=WorkflowBus.INTAKE_STATE_CHANGED,
        intake=intake,
        old_state=old,
        new_state=intake.workflow_state,
        user=request.user,
        action=WorkflowAction.START_MATCHING,
    )

Receivers are wired in ``contracts/apps.py`` → ``ready()``.
"""
from __future__ import annotations

import logging
from typing import Any

from django.dispatch import Signal

logger = logging.getLogger(__name__)


# ── Signal definitions ────────────────────────────────────────────────────────
# Every signal sends keyword-only arguments documented below.
# All arguments are optional (Signal does not enforce kwargs); callers must
# pass at least the ones they have — receivers must handle missing ones with
# .get() / defaults.

class WorkflowBus:
    # CaseIntakeProcess.workflow_state changed
    # kwargs: intake, old_state, new_state, user, action (WorkflowAction constant or None)
    INTAKE_STATE_CHANGED = Signal()

    # CaseIntakeProcess.status changed  (ProcessStatus)
    # kwargs: intake, old_status, new_status, user
    INTAKE_STATUS_CHANGED = Signal()

    # CareCase.case_phase changed
    # kwargs: case, old_phase, new_phase, user
    CASE_PHASE_CHANGED = Signal()

    # PlacementRequest.status changed
    # kwargs: placement, old_status, new_status, user
    PLACEMENT_STATUS_CHANGED = Signal()

    # PlacementRequest.provider_response_status changed
    # kwargs: placement, old_response_status, new_response_status, user
    PLACEMENT_RESPONSE_STATUS_CHANGED = Signal()

    # CaseAssessment.assessment_status changed
    # kwargs: assessment, old_status, new_status, user
    ASSESSMENT_STATUS_CHANGED = Signal()

    # CareSignal.status changed
    # kwargs: care_signal, old_status, new_status, user
    CARE_SIGNAL_STATUS_CHANGED = Signal()


# ── Publish helpers ───────────────────────────────────────────────────────────

def publish_transition(
    *,
    bus_event: Signal,
    intake=None,
    assessment=None,
    placement=None,
    care_signal=None,
    case=None,
    old_state: str | None = None,
    new_state: str | None = None,
    old_status: str | None = None,
    new_status: str | None = None,
    old_response_status: str | None = None,
    new_response_status: str | None = None,
    old_phase: str | None = None,
    new_phase: str | None = None,
    user=None,
    action: str | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    """Audit-log the transition and fire the bus signal.

    Safe to call after ``.save()`` — never raises; errors are logged and
    swallowed so a bus failure never rolls back a committed transition.
    """
    try:
        _audit_transition(
            intake=intake,
            assessment=assessment,
            placement=placement,
            care_signal=care_signal,
            case=case,
            old_state=old_state,
            new_state=new_state,
            old_status=old_status,
            new_status=new_status,
            old_response_status=old_response_status,
            new_response_status=new_response_status,
            old_phase=old_phase,
            new_phase=new_phase,
            user=user,
            action=action,
            extra=extra or {},
        )
    except Exception:
        logger.exception("workflow_bus.audit_failed action=%s", action)

    try:
        bus_event.send(
            sender=_sender(intake, assessment, placement, care_signal, case),
            intake=intake,
            assessment=assessment,
            placement=placement,
            care_signal=care_signal,
            case=case,
            old_state=old_state,
            new_state=new_state,
            old_status=old_status,
            new_status=new_status,
            old_response_status=old_response_status,
            new_response_status=new_response_status,
            old_phase=old_phase,
            new_phase=new_phase,
            user=user,
            action=action,
            extra=extra or {},
        )
    except Exception:
        logger.exception("workflow_bus.signal_failed action=%s", action)


def emit_intake_state_changed(*, intake, old_state, new_state, user=None, action=None):
    """Shortcut — fire without writing a CaseDecisionLog row (log_transition_event handles that)."""
    if old_state == new_state:
        return
    try:
        WorkflowBus.INTAKE_STATE_CHANGED.send(
            sender=type(intake), intake=intake,
            old_state=old_state, new_state=new_state, user=user, action=action, extra={},
        )
    except Exception:
        logger.exception("workflow_bus.emit_intake_state_changed failed")


def emit_case_phase_changed(*, case, old_phase, new_phase, user=None):
    if old_phase == new_phase:
        return
    try:
        WorkflowBus.CASE_PHASE_CHANGED.send(
            sender=type(case), case=case,
            old_phase=old_phase, new_phase=new_phase, user=user, extra={},
        )
    except Exception:
        logger.exception("workflow_bus.emit_case_phase_changed failed")


def emit_placement_response_status_changed(*, placement, old_response_status, new_response_status, user=None):
    if old_response_status == new_response_status:
        return
    try:
        WorkflowBus.PLACEMENT_RESPONSE_STATUS_CHANGED.send(
            sender=type(placement), placement=placement,
            old_response_status=old_response_status,
            new_response_status=new_response_status,
            user=user, extra={},
        )
    except Exception:
        logger.exception("workflow_bus.emit_placement_response_status_changed failed")


def emit_placement_status_changed(*, placement, old_status, new_status, user=None):
    if old_status == new_status:
        return
    try:
        WorkflowBus.PLACEMENT_STATUS_CHANGED.send(
            sender=type(placement), placement=placement,
            old_status=old_status, new_status=new_status, user=user, extra={},
        )
    except Exception:
        logger.exception("workflow_bus.emit_placement_status_changed failed")


def emit_assessment_status_changed(*, assessment, old_status, new_status, user=None):
    if old_status == new_status:
        return
    try:
        WorkflowBus.ASSESSMENT_STATUS_CHANGED.send(
            sender=type(assessment), assessment=assessment,
            old_status=old_status, new_status=new_status, user=user, extra={},
        )
    except Exception:
        logger.exception("workflow_bus.emit_assessment_status_changed failed")


def _sender(*objects):
    for obj in objects:
        if obj is not None:
            return type(obj)
    return object


def _audit_transition(
    *,
    intake=None,
    assessment=None,
    placement=None,
    care_signal=None,
    case=None,
    old_state,
    new_state,
    old_status,
    new_status,
    old_response_status,
    new_response_status,
    old_phase,
    new_phase,
    user,
    action,
    extra,
):
    from contracts.governance import log_case_decision_event
    from contracts.models import CaseDecisionLog

    case_id = None
    placement_id = None

    if intake is not None:
        case_id = getattr(intake, 'pk', None)
    elif case is not None:
        # CareCase → find associated intake
        case_id = getattr(getattr(case, 'intake', None), 'pk', None)
    elif assessment is not None:
        case_id = getattr(getattr(assessment, 'process', None), 'pk', None)

    if placement is not None:
        placement_id = getattr(placement, 'pk', None)
        if case_id is None:
            case_id = getattr(getattr(placement, 'intake', None), 'pk', None)

    # Build a compact human-readable description of what changed.
    changes: list[str] = []
    if old_state is not None or new_state is not None:
        changes.append(f"state {old_state!r} → {new_state!r}")
    if old_status is not None or new_status is not None:
        changes.append(f"status {old_status!r} → {new_status!r}")
    if old_response_status is not None or new_response_status is not None:
        changes.append(f"response_status {old_response_status!r} → {new_response_status!r}")
    if old_phase is not None or new_phase is not None:
        changes.append(f"phase {old_phase!r} → {new_phase!r}")

    log_case_decision_event(
        case_id=case_id,
        placement_id=placement_id,
        event_type=CaseDecisionLog.EventType.STATE_TRANSITION,
        user_action=action or '',
        actor_user_id=getattr(user, 'pk', None) if user else None,
        actor_kind=CaseDecisionLog.ActorKind.USER if user else CaseDecisionLog.ActorKind.SYSTEM,
        recommendation_context={
            'changes': changes,
            **extra,
        },
        strict=False,
    )
