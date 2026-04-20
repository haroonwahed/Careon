"""Information Request Service.

Purpose
-------
Manages the ``CaseInformationRequest`` lifecycle — the structured loop
that activates when a provider responds ``needs_more_info`` to a matched case.

Design rules
------------
- One *open/in_progress* request per (case, provider) pair at any time.
  A new needs_more_info evaluation updates the existing open request rather
  than creating duplicates.
- All status transitions are atomic and append-only in the audit log.
- Resubmission closes the current request and sets the placement
  ``provider_response_status`` back to ``PENDING`` so the provider evaluation
  loop restarts cleanly.
- No business logic in views — all rules live here.

Public API
----------
create_or_update_info_request(intake, provider, evaluation, requested_info_text, requested_fields)
resolve_info_request(request_obj, operator_response, resolved_by_id)
resubmit_info_request(request_obj, operator_response, resolved_by_id)
get_open_requests_for_case(intake)
get_all_requests_for_case(intake)
stale_requests_for_org(org, threshold_days)
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any, List

from django.db import transaction
from django.utils import timezone

from .models import (
    AuditLog,
    CaseDecisionLog,
    CaseInformationRequest,
    CaseIntakeProcess,
    Client,
    PlacementRequest,
    ProviderEvaluation,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_or_update_info_request(
    *,
    intake: CaseIntakeProcess,
    provider: Client,
    evaluation: ProviderEvaluation,
    requested_info_text: str,
    requested_fields: list | None = None,
) -> CaseInformationRequest:
    """Create a new information request or update the current open one.

    At most one *open/in_progress* request exists per (case, provider) pair.
    If one already exists it is updated with the new text and linked evaluation;
    otherwise a fresh request is created.

    This is called automatically from ``record_provider_evaluation`` on
    ``needs_more_info`` decisions — callers should not call this directly
    except in tests.

    Returns
    -------
    CaseInformationRequest
        The created or updated request object.
    """
    with transaction.atomic():
        existing = (
            CaseInformationRequest.objects.select_for_update()
            .filter(
                case=intake,
                provider=provider,
                status__in=[
                    CaseInformationRequest.Status.OPEN,
                    CaseInformationRequest.Status.IN_PROGRESS,
                ],
            )
            .first()
        )

        if existing:
            # Update the open request with fresh text and new evaluation link.
            existing.requested_info_text = requested_info_text
            existing.requested_fields = requested_fields or existing.requested_fields
            existing.evaluation = evaluation
            existing.status = CaseInformationRequest.Status.OPEN
            existing.save(update_fields=[
                'requested_info_text', 'requested_fields', 'evaluation', 'status', 'updated_at',
            ])
            request_obj = existing
        else:
            request_obj = CaseInformationRequest.objects.create(
                case=intake,
                provider=provider,
                evaluation=evaluation,
                requested_info_text=requested_info_text,
                requested_fields=requested_fields or [],
                status=CaseInformationRequest.Status.OPEN,
            )

        _log_audit_info_request(
            request_obj,
            actor_id=None,
            action_note='Informatieverzoek aangemaakt of bijgewerkt vanuit aanbiederbeoordeling.',
        )

    return request_obj


def resolve_info_request(
    *,
    request_obj: CaseInformationRequest,
    operator_response: str,
    resolved_by_id: int,
) -> CaseInformationRequest:
    """Mark an information request as resolved.

    The operator has provided the requested information but the case is
    *not* yet resubmitted for renewed provider evaluation.  Use
    ``resubmit_info_request`` to also trigger the re-evaluation path.

    Raises
    ------
    ValueError
        When the request is already closed.
    """
    if request_obj.is_closed:
        raise ValueError(
            f'Informatieverzoek {request_obj.pk} is al gesloten '
            f'(status: {request_obj.get_status_display()}).'
        )

    with transaction.atomic():
        request_obj.status = CaseInformationRequest.Status.RESOLVED
        request_obj.operator_response = operator_response
        request_obj.resolved_at = timezone.now()
        request_obj.resolved_by_id = resolved_by_id
        request_obj.save(update_fields=[
            'status', 'operator_response', 'resolved_at', 'resolved_by', 'updated_at',
        ])
        _log_audit_info_request(
            request_obj,
            actor_id=resolved_by_id,
            action_note='Informatieverzoek opgelost door operator.',
        )

    return request_obj


def resubmit_info_request(
    *,
    request_obj: CaseInformationRequest,
    operator_response: str,
    resolved_by_id: int,
) -> CaseInformationRequest:
    """Close the information request as resubmitted and restart provider evaluation.

    Side effects
    ------------
    - Marks the linked ``PlacementRequest.provider_response_status`` back to
      ``PENDING`` so the provider evaluation loop restarts.
    - Writes a ``CaseDecisionLog`` event for audit.

    Raises
    ------
    ValueError
        When the request is already closed.
    """
    if request_obj.is_closed:
        raise ValueError(
            f'Informatieverzoek {request_obj.pk} is al gesloten '
            f'(status: {request_obj.get_status_display()}).'
        )

    now = timezone.now()

    with transaction.atomic():
        request_obj.status = CaseInformationRequest.Status.RESUBMITTED
        request_obj.operator_response = operator_response
        request_obj.resolved_at = now
        request_obj.resolved_by_id = resolved_by_id
        request_obj.save(update_fields=[
            'status', 'operator_response', 'resolved_at', 'resolved_by', 'updated_at',
        ])

        # Reset placement response status so the provider evaluation loop restarts.
        placement = _get_active_placement(request_obj.case)
        if placement:
            stamped = (
                f"[{now.strftime('%d-%m-%Y %H:%M')}] "
                f"Herindienen na informatieverzoek: {operator_response}"
            )
            existing_notes = placement.provider_response_notes or ''
            placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
            placement.provider_response_notes = (
                f"{existing_notes}\n{stamped}".strip()
            )
            placement.save(update_fields=[
                'provider_response_status', 'provider_response_notes', 'updated_at',
            ])

        _log_decision_event_for_resubmit(request_obj, placement, resolved_by_id)
        _log_audit_info_request(
            request_obj,
            actor_id=resolved_by_id,
            action_note='Casus herindienen na leveren ontbrekende informatie.',
        )

    return request_obj


def mark_info_request_in_progress(
    *,
    request_obj: CaseInformationRequest,
    operator_response: str,
    updated_by_id: int,
) -> CaseInformationRequest:
    """Update the operator response and set status to in_progress without closing.

    Used when the operator is gathering information but is not yet ready to
    resubmit.
    """
    if request_obj.is_closed:
        raise ValueError(
            f'Informatieverzoek {request_obj.pk} is al gesloten '
            f'(status: {request_obj.get_status_display()}).'
        )

    with transaction.atomic():
        request_obj.status = CaseInformationRequest.Status.IN_PROGRESS
        request_obj.operator_response = operator_response
        request_obj.save(update_fields=['status', 'operator_response', 'updated_at'])
        _log_audit_info_request(
            request_obj,
            actor_id=updated_by_id,
            action_note='Operator werkt aan informatieverzoek (in behandeling).',
        )

    return request_obj


def get_open_requests_for_case(
    intake: CaseIntakeProcess,
) -> list:
    """Return all open/in_progress information requests for *intake*."""
    return list(
        CaseInformationRequest.objects.filter(
            case=intake,
            status__in=[
                CaseInformationRequest.Status.OPEN,
                CaseInformationRequest.Status.IN_PROGRESS,
            ],
        ).select_related('provider', 'evaluation', 'resolved_by')
        .order_by('-created_at')
    )


def get_all_requests_for_case(
    intake: CaseIntakeProcess,
) -> list:
    """Return all information requests (all statuses) for *intake* — for history view."""
    return list(
        CaseInformationRequest.objects.filter(case=intake)
        .select_related('provider', 'evaluation', 'resolved_by')
        .order_by('-created_at')
    )


def stale_requests_for_org(organization: Any, threshold_days: int = 3):
    """Return open/in_progress requests older than *threshold_days* for the org.

    Used by the Regiekamer to flag stale information requests.
    """
    cutoff = timezone.now() - timedelta(days=threshold_days)
    return CaseInformationRequest.objects.filter(
        case__organization=organization,
        status__in=[
            CaseInformationRequest.Status.OPEN,
            CaseInformationRequest.Status.IN_PROGRESS,
        ],
        created_at__lt=cutoff,
    ).select_related('case', 'provider').order_by('created_at')


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_active_placement(intake: CaseIntakeProcess) -> PlacementRequest | None:
    return (
        PlacementRequest.objects.filter(due_diligence_process=intake)
        .order_by('-updated_at')
        .first()
    )


def _log_decision_event_for_resubmit(
    request_obj: CaseInformationRequest,
    placement: PlacementRequest | None,
    resolved_by_id: int | None,
) -> None:
    try:
        CaseDecisionLog.objects.create(
            case=request_obj.case,
            case_id_snapshot=request_obj.case_id,
            placement=placement,
            placement_id_snapshot=placement.pk if placement else None,
            event_type=CaseDecisionLog.EventType.PROVIDE_MISSING_INFO,
            recommendation_context={
                'info_request_id': request_obj.pk,
                'action': 'resubmit',
                'operator_response_length': len(request_obj.operator_response),
            },
            user_action='resubmit_info_request',
            actor_id=resolved_by_id,
            actor_kind=(
                CaseDecisionLog.ActorKind.USER
                if resolved_by_id
                else CaseDecisionLog.ActorKind.SYSTEM
            ),
            action_source='information_request_service',
            provider=request_obj.provider,
        )
    except Exception:
        logger.exception(
            'Failed to log CaseDecisionLog for resubmit of CaseInformationRequest %s',
            request_obj.pk,
        )


def _log_audit_info_request(
    request_obj: CaseInformationRequest,
    *,
    actor_id: int | None,
    action_note: str,
) -> None:
    try:
        AuditLog.objects.create(
            user_id=actor_id,
            action=AuditLog.Action.UPDATE,
            model_name='CaseInformationRequest',
            object_id=request_obj.pk,
            object_repr=str(request_obj),
            changes={
                'status': request_obj.status,
                'note': action_note,
                'case_id': request_obj.case_id,
                'provider_id': request_obj.provider_id,
            },
        )
    except Exception:
        logger.exception(
            'Failed to write AuditLog for CaseInformationRequest %s', request_obj.pk
        )
