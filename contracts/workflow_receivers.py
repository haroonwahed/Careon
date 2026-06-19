"""
Default WorkflowBus receivers.

These are registered in ContractsConfig.ready().  Each receiver handles
a bus event and performs side effects (e.g. notifications, SLA re-evaluation).

Add more receivers here as the system grows.  Keep each receiver focused on
a single concern; call bus signal handlers from this module only, never
wire them in views.py.
"""
from __future__ import annotations

import logging

from django.dispatch import receiver

from contracts.workflow_bus import WorkflowBus

logger = logging.getLogger(__name__)


@receiver(WorkflowBus.INTAKE_STATE_CHANGED)
def on_intake_state_changed(sender, *, intake=None, old_state=None, new_state=None, user=None, action=None, **kwargs):
    if intake is None or new_state == old_state:
        return
    logger.info(
        "workflow_bus intake_state_changed pk=%s %s→%s actor=%s action=%s",
        getattr(intake, 'pk', '?'),
        old_state,
        new_state,
        getattr(user, 'pk', 'system'),
        action,
    )


@receiver(WorkflowBus.INTAKE_STATUS_CHANGED)
def on_intake_status_changed(sender, *, intake=None, old_status=None, new_status=None, user=None, **kwargs):
    if intake is None or new_status == old_status:
        return
    logger.info(
        "workflow_bus intake_status_changed pk=%s %s→%s actor=%s",
        getattr(intake, 'pk', '?'),
        old_status,
        new_status,
        getattr(user, 'pk', 'system'),
    )


@receiver(WorkflowBus.CASE_PHASE_CHANGED)
def on_case_phase_changed(sender, *, case=None, old_phase=None, new_phase=None, user=None, **kwargs):
    if case is None or new_phase == old_phase:
        return
    logger.info(
        "workflow_bus case_phase_changed pk=%s %s→%s actor=%s",
        getattr(case, 'pk', '?'),
        old_phase,
        new_phase,
        getattr(user, 'pk', 'system'),
    )


@receiver(WorkflowBus.PLACEMENT_STATUS_CHANGED)
def on_placement_status_changed(sender, *, placement=None, old_status=None, new_status=None, user=None, **kwargs):
    if placement is None or new_status == old_status:
        return
    logger.info(
        "workflow_bus placement_status_changed pk=%s %s→%s actor=%s",
        getattr(placement, 'pk', '?'),
        old_status,
        new_status,
        getattr(user, 'pk', 'system'),
    )


@receiver(WorkflowBus.PLACEMENT_RESPONSE_STATUS_CHANGED)
def on_placement_response_status_changed(sender, *, placement=None, old_response_status=None, new_response_status=None, user=None, **kwargs):
    if placement is None or new_response_status == old_response_status:
        return
    logger.info(
        "workflow_bus placement_response_changed pk=%s %s→%s actor=%s",
        getattr(placement, 'pk', '?'),
        old_response_status,
        new_response_status,
        getattr(user, 'pk', 'system'),
    )


@receiver(WorkflowBus.ASSESSMENT_STATUS_CHANGED)
def on_assessment_status_changed(sender, *, assessment=None, old_status=None, new_status=None, user=None, **kwargs):
    if assessment is None or new_status == old_status:
        return
    logger.info(
        "workflow_bus assessment_status_changed pk=%s %s→%s actor=%s",
        getattr(assessment, 'pk', '?'),
        old_status,
        new_status,
        getattr(user, 'pk', 'system'),
    )


@receiver(WorkflowBus.CARE_SIGNAL_STATUS_CHANGED)
def on_care_signal_status_changed(sender, *, care_signal=None, old_status=None, new_status=None, user=None, **kwargs):
    if care_signal is None or new_status == old_status:
        return
    logger.info(
        "workflow_bus care_signal_status_changed pk=%s %s→%s actor=%s",
        getattr(care_signal, 'pk', '?'),
        old_status,
        new_status,
        getattr(user, 'pk', 'system'),
    )
