"""
Append-only case timeline writes for operational milestones (v1: gemeente validatie → aanbieder).
"""

from __future__ import annotations

import os
from typing import Any

from django.db import transaction
from django.utils import timezone

from contracts.build_info import gather_build_info
from contracts.models import AuditLog, CaseDecisionLog, CaseIntakeProcess, CaseTimelineEvent, PlacementRequest
from contracts.workflow_state_machine import WorkflowState


def _release_and_build_ids() -> tuple[str, str]:
    release_id = (os.environ.get('CAREON_RELEASE_ID') or '').strip()[:120]
    try:
        sha = (gather_build_info().get('commit_sha') or '')[:64]
    except Exception:  # noqa: BLE001 — deployment truth must never block timeline append
        sha = ''
    return release_id, sha


def _resolve_links(*, intake: CaseIntakeProcess, placement: PlacementRequest) -> tuple[Any, Any]:
    """Best-effort FK links to governance rows (same transaction)."""
    decision_log = (
        CaseDecisionLog.objects.filter(case_id=intake.pk).order_by('-pk').first()
    )
    audit_log = (
        AuditLog.objects.filter(model_name='MatchingAssignment', object_id=placement.pk)
        .order_by('-pk')
        .first()
    )
    return decision_log, audit_log


def _safe_placement_metadata(placement: PlacementRequest) -> dict[str, Any]:
    """Operational ids/status only — no free-text PHI."""
    meta: dict[str, Any] = {
        'placement_id': placement.pk,
        'placement_status': placement.status,
    }
    if placement.proposed_provider_id:
        meta['provider_id'] = placement.proposed_provider_id
    return meta


@transaction.atomic
def record_gemeente_validation_to_provider_review_boundary(
    *,
    intake: CaseIntakeProcess,
    placement: PlacementRequest,
    request,
    actor_role: str,
    workflow_state_before_action: str,
    source: str,
) -> None:
    """
    Emit timeline rows when crossing into aanbieder beoordeling (PROVIDER_REVIEW_PENDING).

    Call after placement exists and workflow transitions have been persisted.
    """
    care_case = intake.case_record
    org = intake.organization
    if care_case is None or org is None:
        return

    release_id, build_sha = _release_and_build_ids()
    rid = getattr(request, 'correlation_id', None)
    rid_s = str(rid) if rid else ''

    decision_log, audit_log = _resolve_links(intake=intake, placement=placement)
    occurred = timezone.now()
    actor = request.user if getattr(request.user, 'is_authenticated', False) else None

    rows: list[CaseTimelineEvent] = []

    if workflow_state_before_action == WorkflowState.MATCHING_READY:
        rows.append(
            CaseTimelineEvent(
                organization=org,
                care_case=care_case,
                event_type=CaseTimelineEvent.EventType.GEMEENTE_VALIDATION_APPROVED,
                occurred_at=occurred,
                actor=actor,
                actor_role=actor_role,
                source=source,
                request_id=rid_s,
                release_id=release_id,
                build_sha=build_sha,
                from_phase=WorkflowState.MATCHING_READY,
                to_phase=WorkflowState.GEMEENTE_VALIDATED,
                reason_code='VALIDATE_MATCHING',
                summary='Gemeente heeft matching gevalideerd.',
                decision_log=decision_log,
                audit_log=audit_log,
                metadata={'step': 'gemeente_validatie'},
            )
        )

    rows.append(
        CaseTimelineEvent(
            organization=org,
            care_case=care_case,
            event_type=CaseTimelineEvent.EventType.PLACEMENT_REQUEST_CREATED,
            occurred_at=occurred,
            actor=actor,
            actor_role=actor_role,
            source=source,
            request_id=rid_s,
            release_id=release_id,
            build_sha=build_sha,
            from_phase=WorkflowState.GEMEENTE_VALIDATED,
            to_phase=WorkflowState.PROVIDER_REVIEW_PENDING,
            reason_code='PLACEMENT_ACTIVE_FOR_REVIEW',
            summary='Plaatsingsaanvraag vastgelegd voor aanbiederbeoordeling.',
            decision_log=decision_log,
            audit_log=audit_log,
            metadata=_safe_placement_metadata(placement),
        )
    )
    rows.append(
        CaseTimelineEvent(
            organization=org,
            care_case=care_case,
            event_type=CaseTimelineEvent.EventType.PROVIDER_REVIEW_OPENED,
            occurred_at=occurred,
            actor=actor,
            actor_role=actor_role,
            source=source,
            request_id=rid_s,
            release_id=release_id,
            build_sha=build_sha,
            from_phase=WorkflowState.GEMEENTE_VALIDATED,
            to_phase=WorkflowState.PROVIDER_REVIEW_PENDING,
            reason_code='SEND_TO_PROVIDER',
            summary='Aanbiederbeoordeling geopend.',
            decision_log=decision_log,
            audit_log=audit_log,
            metadata={'placement_id': placement.pk},
        )
    )

    for row in rows:
        row.save()


def serialize_timeline_events_for_api(qs):
    """Safe JSON-serializable rows for GET .../timeline/."""
    out = []
    for row in qs.select_related('actor'):
        actor_display = ''
        if row.actor_id:
            u = row.actor
            actor_display = (u.get_full_name() or u.username or '').strip()
        # Strip deployment-only fields from metadata for clients if DEBUG off
        meta = dict(row.metadata or {})
        out.append(
            {
                'event_type': row.event_type,
                'occurred_at': row.occurred_at.isoformat(),
                'actor_display': actor_display,
                'actor_role': row.actor_role,
                'from_phase': row.from_phase,
                'to_phase': row.to_phase,
                'reason_code': row.reason_code,
                'summary': row.summary,
                'request_id': row.request_id or None,
                'metadata': meta,
                'source': row.source,
            }
        )
    return out
