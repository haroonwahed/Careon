"""Provider Evaluation Service.

Purpose
-------
Records and enforces the Aanbieder Beoordeling (provider evaluation) step.

After a provider candidate is selected via matching, the operator registers
the provider's decision: accept, reject, or needs_more_info.

Design rules
------------
- Each call to ``record_provider_evaluation`` creates a **new** evaluation row
  (append-only).  The latest row is the effective decision.
- All mutations are logged via ``CaseDecisionLog`` (append-only) and
  ``AuditLog`` for full audit coverage.
- On acceptance the associated ``PlacementRequest.provider_response_status``
  is updated to ``ACCEPTED`` and placement is unlocked.
- On rejection ``provider_response_status`` is updated to ``REJECTED`` and
  placement with this provider is blocked.
- On needs_more_info ``provider_response_status`` is set to ``NEEDS_INFO``
  and case flow is blocked pending operator follow-up.
- No business logic lives in views; all rules live here.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction
from django.utils import timezone

from .models import (
    AuditLog,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client,
    PlacementRequest,
    ProviderEvaluation,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def record_provider_evaluation(
    *,
    intake: CaseIntakeProcess,
    provider: Client,
    placement: PlacementRequest | None,
    decision: str,
    reason_code: str = '',
    capacity_flag: bool = False,
    risk_notes: str = '',
    requested_info: str = '',
    decided_by_id: int | None = None,
    action_source: str = 'case_detail',
) -> ProviderEvaluation:
    """Create a ProviderEvaluation record and apply all side effects.

    Parameters
    ----------
    intake:
        The ``CaseIntakeProcess`` being evaluated.
    provider:
        The ``Client`` (provider) making the evaluation.
    placement:
        The active ``PlacementRequest`` for the case, if available.
    decision:
        One of ``ProviderEvaluation.Decision`` values.
    reason_code:
        Required when ``decision == 'reject'``.
    capacity_flag:
        ``True`` when provider currently has a capacity constraint.
    risk_notes:
        Free-text risk or safety context (optional).
    requested_info:
        Required when ``decision == 'needs_more_info'``.
    decided_by_id:
        PK of the ``User`` recording the evaluation.
    action_source:
        Identifier of the calling context (used in audit logs).

    Returns
    -------
    ProviderEvaluation
        The newly created evaluation record.

    Raises
    ------
    ValueError
        When business rules are violated (missing reason_code on rejection,
        missing requested_info on needs_more_info, unknown decision value).
    """
    _validate_decision_inputs(decision, reason_code, requested_info)

    with transaction.atomic():
        evaluation = ProviderEvaluation.objects.create(
            case=intake,
            provider=provider,
            placement=placement,
            decision=decision,
            reason_code=reason_code,
            capacity_flag=capacity_flag,
            risk_notes=risk_notes,
            requested_info=requested_info,
            decided_by_id=decided_by_id,
        )

        if placement:
            _apply_placement_side_effects(evaluation, placement)

        _log_decision_event(evaluation, placement, decided_by_id, action_source)
        _log_audit(evaluation, intake, placement, decided_by_id, action_source)

        if decision == ProviderEvaluation.Decision.NEEDS_MORE_INFO:
            _create_or_update_info_request(intake, provider, evaluation, requested_info)

    return evaluation


def latest_evaluation_for_case_provider(
    intake: CaseIntakeProcess, provider: Client
) -> ProviderEvaluation | None:
    """Return the most recent evaluation for a (case, provider) pair."""
    return (
        ProviderEvaluation.objects.filter(case=intake, provider=provider)
        .order_by('-created_at')
        .first()
    )


def placement_unlocked_for_case(intake: CaseIntakeProcess) -> bool:
    """Return True when at least one provider has accepted the case."""
    return ProviderEvaluation.objects.filter(
        case=intake,
        decision=ProviderEvaluation.Decision.ACCEPT,
    ).exists()


def get_evaluation_nba_code(intake: CaseIntakeProcess) -> str | None:
    """Return a next-best-action code reflecting the latest evaluation state.

    Returns one of:
    - ``'awaiting_provider_evaluation'``
    - ``'provider_rejected'``
    - ``'provider_requested_more_info'``
    - ``'ready_for_placement'``
    - ``None`` when no evaluation exists yet
    """
    evaluations = (
        ProviderEvaluation.objects.filter(case=intake)
        .order_by('-created_at')
        .values('decision')
    )
    if not evaluations:
        return None

    decisions = {e['decision'] for e in evaluations}

    if ProviderEvaluation.Decision.ACCEPT in decisions:
        return 'ready_for_placement'
    if ProviderEvaluation.Decision.NEEDS_MORE_INFO in decisions:
        return 'provider_requested_more_info'
    if ProviderEvaluation.Decision.REJECT in decisions:
        return 'provider_rejected'
    return 'awaiting_provider_evaluation'


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _validate_decision_inputs(
    decision: str, reason_code: str, requested_info: str
) -> None:
    valid_decisions = {
        ProviderEvaluation.Decision.ACCEPT,
        ProviderEvaluation.Decision.REJECT,
        ProviderEvaluation.Decision.NEEDS_MORE_INFO,
    }
    if decision not in valid_decisions:
        raise ValueError(
            f"Ongeldig besluit '{decision}'. Kies uit: "
            + ', '.join(valid_decisions)
        )
    if decision == ProviderEvaluation.Decision.REJECT and not reason_code:
        raise ValueError('Redencode is verplicht bij afwijzing.')
    if decision == ProviderEvaluation.Decision.NEEDS_MORE_INFO and not requested_info:
        raise ValueError(
            'Omschrijf welke informatie ontbreekt (requested_info is verplicht).'
        )


def _apply_placement_side_effects(
    evaluation: ProviderEvaluation,
    placement: PlacementRequest,
) -> None:
    """Update PlacementRequest.provider_response_status based on decision."""
    decision = evaluation.decision
    now = timezone.now()

    if decision == ProviderEvaluation.Decision.ACCEPT:
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.ACCEPTED
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by_id = evaluation.decided_by_id
        placement.provider_response_reason_code = ''

    elif decision == ProviderEvaluation.Decision.REJECT:
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.REJECTED
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by_id = evaluation.decided_by_id
        placement.provider_response_reason_code = _map_reason_code_to_outcome(
            evaluation.reason_code
        )

    elif decision == ProviderEvaluation.Decision.NEEDS_MORE_INFO:
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.NEEDS_INFO
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by_id = evaluation.decided_by_id
        if evaluation.requested_info:
            stamped = (
                f"[{now.strftime('%d-%m-%Y %H:%M')}] "
                f"Meer informatie nodig: {evaluation.requested_info}"
            )
            existing = placement.provider_response_notes or ''
            placement.provider_response_notes = f"{existing}\n{stamped}".strip()

    placement.save(update_fields=[
        'provider_response_status',
        'provider_response_recorded_at',
        'provider_response_recorded_by',
        'provider_response_reason_code',
        'provider_response_notes',
        'updated_at',
    ])


def _map_reason_code_to_outcome(reason_code: str) -> str:
    """Map ProviderEvaluation.RejectionCode to OutcomeReasonCode where possible."""
    from .models import OutcomeReasonCode
    mapping = {
        ProviderEvaluation.RejectionCode.NO_CAPACITY: OutcomeReasonCode.CAPACITY,
        ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH: OutcomeReasonCode.CARE_MISMATCH,
        ProviderEvaluation.RejectionCode.URGENCY_NOT_SUPPORTED: OutcomeReasonCode.CARE_MISMATCH,
        ProviderEvaluation.RejectionCode.REGION_NOT_SUPPORTED: OutcomeReasonCode.REGION_MISMATCH,
        ProviderEvaluation.RejectionCode.MISSING_INFORMATION: OutcomeReasonCode.NONE,
        ProviderEvaluation.RejectionCode.RISK_TOO_HIGH: OutcomeReasonCode.SAFETY_RISK,
        ProviderEvaluation.RejectionCode.OTHER: OutcomeReasonCode.OTHER,
    }
    return mapping.get(reason_code, OutcomeReasonCode.PROVIDER_DECLINED)


_DECISION_TO_EVENT_TYPE: dict[str, str] = {
    ProviderEvaluation.Decision.ACCEPT: CaseDecisionLog.EventType.PROVIDER_ACCEPTED,
    ProviderEvaluation.Decision.REJECT: CaseDecisionLog.EventType.PROVIDER_REJECTED,
    ProviderEvaluation.Decision.NEEDS_MORE_INFO: CaseDecisionLog.EventType.PROVIDER_NEEDS_INFO,
}


def _log_decision_event(
    evaluation: ProviderEvaluation,
    placement: PlacementRequest | None,
    decided_by_id: int | None,
    action_source: str,
) -> None:
    event_type = _DECISION_TO_EVENT_TYPE[evaluation.decision]
    recommendation_context: dict[str, Any] = {
        'evaluation_id': evaluation.pk,
        'decision': evaluation.decision,
        'reason_code': evaluation.reason_code,
        'capacity_flag': evaluation.capacity_flag,
    }
    try:
        CaseDecisionLog.objects.create(
            case=evaluation.case,
            case_id_snapshot=evaluation.case_id,
            placement=placement,
            placement_id_snapshot=placement.pk if placement else None,
            event_type=event_type,
            recommendation_context=recommendation_context,
            user_action=evaluation.decision,
            actor_id=decided_by_id,
            actor_kind=CaseDecisionLog.ActorKind.USER if decided_by_id else CaseDecisionLog.ActorKind.SYSTEM,
            action_source=action_source,
            provider=evaluation.provider,
        )
    except Exception:
        logger.exception(
            'Failed to log CaseDecisionLog for ProviderEvaluation %s', evaluation.pk
        )


def _log_audit(
    evaluation: ProviderEvaluation,
    intake: CaseIntakeProcess,
    placement: PlacementRequest | None,
    decided_by_id: int | None,
    action_source: str,
) -> None:
    try:
        AuditLog.objects.create(
            user_id=decided_by_id,
            action=AuditLog.Action.CREATE,
            model_name='ProviderEvaluation',
            object_id=evaluation.pk,
            object_repr=str(evaluation),
            changes={
                'decision': evaluation.decision,
                'reason_code': evaluation.reason_code,
                'capacity_flag': evaluation.capacity_flag,
                'intake_id': intake.pk,
                'placement_id': placement.pk if placement else None,
                'source': action_source,
            },
        )
    except Exception:
        logger.exception(
            'Failed to write AuditLog for ProviderEvaluation %s', evaluation.pk
        )


def _create_or_update_info_request(
    intake: CaseIntakeProcess,
    provider: Client,
    evaluation: ProviderEvaluation,
    requested_info: str,
) -> None:
    """Delegate to information_request_service — wrapped so import errors don't block evaluation."""
    try:
        from .information_request_service import create_or_update_info_request
        create_or_update_info_request(
            intake=intake,
            provider=provider,
            evaluation=evaluation,
            requested_info_text=requested_info,
        )
    except Exception:
        logger.exception(
            'Failed to create/update CaseInformationRequest for ProviderEvaluation %s',
            evaluation.pk,
        )
