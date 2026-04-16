from __future__ import annotations

from typing import Any, Dict, List

import logging

from django.db import DatabaseError
from django.db.models import Q

from contracts.models import CaseDecisionLog, GovernanceLogImmutableError, SystemPolicyConfig  # noqa: F401 GovernanceLogImmutableError re-exported

logger = logging.getLogger(__name__)

_POLICY_BOOL_TRUE = {'1', 'true', 'yes', 'on'}
_POLICY_BOOL_FALSE = {'0', 'false', 'no', 'off'}


def _parse_policy_int(key: str, raw_value: Any, default_value: int) -> int:
    """Return a validated integer policy value or the provided default."""
    if raw_value is None:
        return default_value
    if isinstance(raw_value, bool):
        logger.warning('Invalid integer policy value; falling back to default', extra={
            'policy_key': key,
            'raw_value': raw_value,
            'default_value': default_value,
        })
        return default_value
    if isinstance(raw_value, int):
        return raw_value
    if isinstance(raw_value, float) and raw_value.is_integer():
        return int(raw_value)
    if isinstance(raw_value, str):
        candidate = raw_value.strip()
        if candidate:
            try:
                return int(candidate)
            except ValueError:
                pass
    logger.warning('Invalid integer policy value; falling back to default', extra={
        'policy_key': key,
        'raw_value': raw_value,
        'default_value': default_value,
    })
    return default_value


def _parse_policy_bool(key: str, raw_value: Any, default_value: bool) -> bool:
    """Return a validated boolean policy value or the provided default."""
    if raw_value is None:
        return default_value
    if isinstance(raw_value, bool):
        return raw_value
    if isinstance(raw_value, int) and raw_value in {0, 1}:
        return bool(raw_value)
    if isinstance(raw_value, str):
        candidate = raw_value.strip().lower()
        if candidate in _POLICY_BOOL_TRUE:
            return True
        if candidate in _POLICY_BOOL_FALSE:
            return False
    logger.warning('Invalid boolean policy value; falling back to default', extra={
        'policy_key': key,
        'raw_value': raw_value,
        'default_value': default_value,
    })
    return default_value


def _normalize_policy_value(key: str, raw_value: Any, default_value: Any) -> Any:
    """Coerce a policy value to the type implied by its default.

    Missing or malformed values always fall back safely to the supplied
    default so runtime execution paths remain resilient.
    """
    if raw_value is None:
        return default_value
    if isinstance(default_value, bool):
        return _parse_policy_bool(key, raw_value, default_value)
    if isinstance(default_value, int):
        return _parse_policy_int(key, raw_value, default_value)
    if isinstance(default_value, float):
        try:
            return float(raw_value)
        except (TypeError, ValueError):
            logger.warning('Invalid float policy value; falling back to default', extra={
                'policy_key': key,
                'raw_value': raw_value,
                'default_value': default_value,
            })
            return default_value
    if isinstance(default_value, str):
        if isinstance(raw_value, str):
            return raw_value
        logger.warning('Invalid string policy value; falling back to default', extra={
            'policy_key': key,
            'raw_value': raw_value,
            'default_value': default_value,
        })
        return default_value
    if isinstance(default_value, (dict, list)):
        if isinstance(raw_value, type(default_value)):
            return raw_value
        logger.warning('Invalid structured policy value; falling back to default', extra={
            'policy_key': key,
            'raw_value': raw_value,
            'default_value': default_value,
        })
        return default_value
    return raw_value


def get_policy_value(key: str, default_value: Any, *, scope: str = SystemPolicyConfig.Scope.GLOBAL) -> Any:
    """Return the active policy value for *key* or *default_value* when missing.

    This helper is intentionally minimal and read-only. Missing, inactive, or
    null-valued rows fall back to the provided default without raising.
    """
    try:
        row = (
            SystemPolicyConfig.objects.filter(key=key, scope=scope, active=True)
            .order_by('-updated_at', '-id')
            .values_list('value', flat=True)
            .first()
        )
    except DatabaseError:
        logger.warning('Policy lookup failed; falling back to default value', extra={
            'policy_key': key,
            'scope': scope,
        })
        return default_value
    return _normalize_policy_value(key, row, default_value)


def get_policy_values(default_map: Dict[str, Any], *, scope: str = SystemPolicyConfig.Scope.GLOBAL) -> Dict[str, Any]:
    """Fetch a set of active policy values with one query and safe defaults."""
    resolved = dict(default_map)
    if not default_map:
        return resolved

    try:
        rows = list(
            SystemPolicyConfig.objects.filter(
                key__in=list(default_map.keys()),
                scope=scope,
                active=True,
            ).values_list('key', 'value')
        )
    except DatabaseError:
        logger.warning('Bulk policy lookup failed; falling back to defaults', extra={
            'policy_keys': sorted(default_map.keys()),
            'scope': scope,
        })
        return resolved
    for key, value in rows:
        resolved[key] = _normalize_policy_value(key, value, default_map[key])
    return resolved


def log_case_decision_event(
    *,
    case_id: int | None,
    placement_id: int | None = None,
    event_type: str,
    system_recommendation: Dict[str, Any] | None = None,
    recommendation_context: Dict[str, Any] | None = None,
    user_action: str | None = None,
    actor_user_id: int | None = None,
    actor_kind: str | None = None,
    action_source: str = 'system',
    provider_id: int | None = None,
    sla_state: str | None = None,
    adaptive_flags: Dict[str, Any] | None = None,
    override_type: str | None = None,
    recommended_value: Dict[str, Any] | None = None,
    actual_value: Dict[str, Any] | None = None,
    optional_reason: str | None = None,
) -> bool:
    """Append a CaseDecisionLog row and never raise to callers.

    Logging is intentionally best-effort so operational actions are never
    blocked by audit-write failures.
    """
    if not case_id:
        return False

    resolved_actor_kind = str(actor_kind or '').strip().lower()
    if actor_user_id:
        # User attribution must never be silently downgraded.
        resolved_actor_kind = CaseDecisionLog.ActorKind.USER
    elif resolved_actor_kind not in {
        CaseDecisionLog.ActorKind.SYSTEM,
        CaseDecisionLog.ActorKind.USER,
        CaseDecisionLog.ActorKind.SERVICE,
    }:
        resolved_actor_kind = CaseDecisionLog.ActorKind.SYSTEM

    try:
        CaseDecisionLog.objects.create(
            case_id=case_id,
            placement_id=placement_id,
            event_type=event_type,
            system_recommendation=system_recommendation,
            recommendation_context=recommendation_context or {},
            user_action=user_action or '',
            actor_id=actor_user_id,
            actor_kind=resolved_actor_kind,
            action_source=action_source,
            provider_id=provider_id,
            sla_state=str(sla_state or ''),
            adaptive_flags=adaptive_flags or {},
            override_type=override_type or '',
            recommended_value=recommended_value,
            actual_value=actual_value,
            optional_reason=optional_reason or '',
        )
    except Exception:
        logger.exception('Failed to append CaseDecisionLog event', extra={
            'case_id': case_id,
            'placement_id': placement_id,
            'event_type': event_type,
        })
        return False
    return True


def build_matching_recommendation_payload(suggestions: List[Dict[str, Any]], *, limit: int = 3) -> tuple[Dict[str, Any] | None, Dict[str, Any], Dict[str, Any]]:
    """Return structured payloads for recommendation logging.

    Returns `(system_recommendation, recommendation_context, adaptive_flags)`.
    All payloads are lightweight and safe when suggestions are empty.
    """
    if not suggestions:
        return None, {'candidate_count': 0, 'top_candidates': []}, {}

    def _serialize(row: Dict[str, Any]) -> Dict[str, Any]:
        explanation = row.get('explanation') or {}
        return {
            'provider_id': row.get('provider_id'),
            'provider_name': row.get('provider_name'),
            'match_score': row.get('match_score'),
            'fit_score': row.get('fit_score'),
            'confidence': explanation.get('confidence'),
            'fit_summary': explanation.get('fit_summary'),
        }

    top = _serialize(suggestions[0])
    explanation = (suggestions[0].get('explanation') or {})
    context = {
        'candidate_count': len(suggestions),
        'top_candidates': [_serialize(row) for row in suggestions[:limit]],
    }
    adaptive_flags = {
        'behavior_consideration': explanation.get('behavior_consideration'),
        'behavior_influence': explanation.get('behavior_influence') or [],
    }
    return top, context, adaptive_flags


def _replay_semantic_type(row: CaseDecisionLog) -> str:
    semantic_map = {
        CaseDecisionLog.EventType.MATCH_RECOMMENDED: 'recommendation_issued',
        CaseDecisionLog.EventType.PROVIDER_SELECTED: 'provider_selected',
        CaseDecisionLog.EventType.RESEND_TRIGGERED: 'resend_chosen',
        CaseDecisionLog.EventType.PROVIDE_MISSING_INFO: 'missing_info_provided',
        CaseDecisionLog.EventType.REMATCH_TRIGGERED: 'rematch_chosen',
        CaseDecisionLog.EventType.CONTINUE_WAITING: 'continue_waiting_chosen',
        CaseDecisionLog.EventType.SLA_ESCALATION: 'sla_state_changed',
    }
    if row.override_type:
        return 'override_detected'
    return semantic_map.get(row.event_type, 'decision_logged')


def _replay_summary(row: CaseDecisionLog) -> str:
    provider_id = row.provider_id or 'unknown provider'
    if row.event_type == CaseDecisionLog.EventType.MATCH_RECOMMENDED:
        recommended_provider = (row.system_recommendation or {}).get('provider_id') or provider_id
        return f'Recommendation issued for provider {recommended_provider}.'
    if row.event_type == CaseDecisionLog.EventType.PROVIDER_SELECTED:
        if row.override_type:
            return f'Provider {provider_id} selected as an override.'
        return f'Provider {provider_id} selected.'
    if row.event_type == CaseDecisionLog.EventType.RESEND_TRIGGERED:
        return 'Provider response request resent.'
    if row.event_type == CaseDecisionLog.EventType.PROVIDE_MISSING_INFO:
        return 'Missing information was provided to reopen the provider response.'
    if row.event_type == CaseDecisionLog.EventType.REMATCH_TRIGGERED:
        return 'Rematch was triggered.'
    if row.event_type == CaseDecisionLog.EventType.CONTINUE_WAITING:
        return 'A forced-action wait override was recorded.'
    if row.event_type == CaseDecisionLog.EventType.SLA_ESCALATION:
        from_state = (row.recommended_value or {}).get('sla_state') or (row.recommendation_context or {}).get('sla_transition_from') or 'unknown'
        to_state = (row.actual_value or {}).get('sla_state') or (row.recommendation_context or {}).get('sla_transition_to') or row.sla_state or 'unknown'
        return f'SLA state changed from {from_state} to {to_state}.'
    return f'{row.event_type} recorded.'


def _build_replay_item(row: CaseDecisionLog, *, sequence_index: int) -> Dict[str, Any]:
    case_ref = row.case_id_snapshot or row.case_id
    placement_ref = row.placement_id_snapshot or row.placement_id
    has_partial_data = not bool(row.system_recommendation or row.user_action or row.recommendation_context)
    return {
        'timestamp': row.timestamp,
        'event_type': row.event_type,
        'semantic_type': _replay_semantic_type(row),
        'summary': _replay_summary(row),
        'recommendation': row.system_recommendation,
        'action': row.user_action or None,
        'actor_user_id': row.actor_id,
        'actor_kind': row.actor_kind,
        'actor': {
            'user_id': row.actor_id,
            'kind': row.actor_kind,
        },
        'sla_state': row.sla_state or None,
        'override_type': row.override_type or None,
        'recommended_value': row.recommended_value,
        'actual_value': row.actual_value,
        'action_source': row.action_source,
        'source': {
            'action_source': row.action_source,
            'provider_id': row.provider_id,
            'placement_id': row.placement_id,
        },
        'provider_id': row.provider_id,
        'context': row.recommendation_context or {},
        'correlation_hint': {
            'sequence_index': sequence_index,
            'sequence_key': f'case:{case_ref}|placement:{placement_ref or "none"}',
            'case_ref': case_ref,
            'placement_ref': placement_ref,
            'provider_id': row.provider_id,
        },
        'flags': {
            'is_override': bool(row.override_type),
            'is_partial_log': has_partial_data,
        },
    }


def replay_case_decisions(case_id: int) -> List[Dict[str, Any]]:
    """Reconstruct a chronological decision timeline for a case."""
    timeline = []
    rows = CaseDecisionLog.objects.filter(
        Q(case_id=case_id) | Q(case_id_snapshot=case_id)
    ).order_by('timestamp', 'id')
    for index, row in enumerate(rows, start=1):
        timeline.append(_build_replay_item(row, sequence_index=index))
    return timeline


# ---------------------------------------------------------------------------
# SLA transition detection
# ---------------------------------------------------------------------------

# Canonical ordering used to determine escalation vs improvement direction.
_SLA_STATE_ORDER: tuple[str, ...] = ('ON_TRACK', 'AT_RISK', 'OVERDUE', 'ESCALATED', 'FORCED_ACTION')


def _sla_transition_direction(from_state: str, to_state: str) -> str:
    """Return ``'escalating'``, ``'improving'``, or ``'lateral'``."""
    try:
        return (
            'escalating' if _SLA_STATE_ORDER.index(to_state) > _SLA_STATE_ORDER.index(from_state)
            else 'improving' if _SLA_STATE_ORDER.index(to_state) < _SLA_STATE_ORDER.index(from_state)
            else 'lateral'
        )
    except ValueError:
        return 'lateral'


def detect_and_log_sla_transition(
    *,
    case_id: int,
    placement_id: int | None,
    provider_id: int | None,
    current_sla_state: str,
    action_source: str = 'system',
    sla_context: Dict[str, Any] | None = None,
) -> bool:
    """Emit an SLA_ESCALATION governance event only when the SLA state has changed.

    Queries the most recent non-blank ``sla_state`` already recorded for this
    placement (any event type) and compares it with *current_sla_state*.

    * If no prior state is found, the current state is treated as the initial
      observation and no event is emitted (avoids noise on first action).
    * If the prior and current states are equal, this is a no-op (prevents
      duplicate event spam).
    * Otherwise, a single SLA_ESCALATION row is appended capturing the
      ``from``/``to`` states, the direction (escalating or improving), and
      caller-supplied *sla_context* for replay.

    Returns True when a transition event was written, False otherwise.
    """
    if not case_id or not current_sla_state:
        return False

    # Restrict the lookup to specific cases + placement combination.
    qs = CaseDecisionLog.objects.filter(Q(case_id=case_id) | Q(case_id_snapshot=case_id))
    if placement_id:
        qs = qs.filter(Q(placement_id=placement_id) | Q(placement_id_snapshot=placement_id))

    last_sla_state = (
        qs.exclude(sla_state='')
        .order_by('-id')
        .values_list('sla_state', flat=True)
        .first()
    )

    # No prior logged state — treat current as initial, do not emit.
    if last_sla_state is None:
        return False

    # State unchanged — do not spam duplicate events.
    if last_sla_state == current_sla_state:
        return False

    direction = _sla_transition_direction(last_sla_state, current_sla_state)
    context: Dict[str, Any] = {
        'sla_transition_from': last_sla_state,
        'sla_transition_to': current_sla_state,
        'transition_direction': direction,
    }
    if sla_context:
        context.update(sla_context)

    return log_case_decision_event(
        case_id=case_id,
        placement_id=placement_id,
        event_type=CaseDecisionLog.EventType.SLA_ESCALATION,
        action_source=action_source,
        sla_state=current_sla_state,
        recommendation_context=context,
        recommended_value={'sla_state': last_sla_state},
        actual_value={'sla_state': current_sla_state},
        provider_id=provider_id,
    )


# ---------------------------------------------------------------------------
# Decision Quality Review Helpers (Pilot Evaluation)
# ---------------------------------------------------------------------------

def build_decision_review_context(case_id: int) -> Dict[str, Any]:
    """Build structured context for decision quality review.

    Pulls relevant data from CaseDecisionLog, replay logic, and case state
    to support pilot reviewers in evaluating decision quality. All data is
    read-only and safe for partial/missing cases.

    Returns:
        Dictionary with case_summary, recommendation, actual_decision, override,
        sla_timeline, outcome fields (all safe for missing data).
    """
    from contracts.models import CaseIntakeProcess, PlacementRequest

    # Case baseline
    case_summary: Dict[str, Any] = {'case_id': case_id, 'found': False}
    try:
        case = CaseIntakeProcess.objects.get(pk=case_id)
        case_summary['found'] = True
        case_summary['case_name'] = getattr(case, 'name', f'Case {case_id}')
        case_summary['created_at'] = case.created_at.isoformat() if hasattr(case, 'created_at') else None
        case_summary['status'] = getattr(case, 'status', 'unknown')
    except CaseIntakeProcess.DoesNotExist:
        pass

    # Placement context
    placement_summary: Dict[str, Any] = {}
    try:
        placement = PlacementRequest.objects.filter(due_diligence_process_id=case_id).order_by('-created_at').first()
        if placement:
            placement_summary['placement_id'] = placement.pk
            placement_summary['selected_provider_id'] = getattr(placement, 'selected_provider_id', None)
            placement_summary['proposed_provider_id'] = getattr(placement, 'proposed_provider_id', None)
            placement_summary['status'] = getattr(placement, 'status', 'unknown')
            placement_summary['created_at'] = placement.created_at.isoformat() if hasattr(placement, 'created_at') else None
    except Exception:
        pass

    # Replay timeline (all events for this case)
    timeline = replay_case_decisions(case_id)

    # Extract recommendation and decision snapshots from timeline
    recommendation_item: Dict[str, Any] | None = None
    decision_items: List[Dict[str, Any]] = []
    override_item: Dict[str, Any] | None = None

    for item in timeline:
        if item.get('semantic_type') == 'recommendation_issued':
            recommendation_item = item
        elif item.get('flags', {}).get('is_override'):
            override_item = item
        else:
            decision_items.append(item)

    # Build return structure
    return {
        'case_summary': case_summary,
        'placement_summary': placement_summary,
        'recommendation': {
            'timestamp': recommendation_item.get('timestamp') if recommendation_item else None,
            'recommendation': recommendation_item.get('recommendation') if recommendation_item else None,
            'context': recommendation_item.get('context') if recommendation_item else {},
            'provider_id': recommendation_item.get('provider_id') if recommendation_item else None,
        },
        'actual_decision': {
            'timeline': decision_items,
            'latest_event': decision_items[-1] if decision_items else None,
            'event_count': len(decision_items),
        },
        'override': {
            'present': bool(override_item),
            'item': override_item,
            'override_type': override_item.get('override_type') if override_item else None,
        },
        'sla_timeline': [
            {
                'timestamp': item.get('timestamp'),
                'semantic_type': item.get('semantic_type'),
                'sla_state': item.get('sla_state'),
                'recommended_value': item.get('recommended_value'),
            }
            for item in timeline
            if item.get('sla_state') or item.get('semantic_type') == 'sla_state_changed'
        ],
        'outcome': {
            'placement_result': placement_summary.get('status') if placement_summary else None,
        },
    }


def get_decision_quality_distribution() -> Dict[str, int]:
    """Get count of reviews by decision quality classification.

    Used for aggregate metrics: e.g., {SYSTEM_CORRECT: 5, USER_CORRECT: 3, ...}
    """
    from contracts.models import DecisionQualityReview

    distribution = {}
    for choice_value, choice_label in DecisionQualityReview.DecisionQuality.choices:
        count = DecisionQualityReview.objects.filter(decision_quality=choice_value).count()
        distribution[choice_label] = count
    return distribution


def get_override_reason_patterns() -> Dict[str, Dict[str, int]]:
    """Get override classification patterns: which primary reasons co-occur with overrides.

    Returns:
        {
            'has_override': {reason: count, ...},
            'no_override': {reason: count, ...}
        }
    """
    from contracts.models import DecisionQualityReview

    result = {'has_override': {}, 'no_override': {}}

    for choice_value, choice_label in DecisionQualityReview.PrimaryReason.choices:
        has_override_count = DecisionQualityReview.objects.filter(
            override_present=True,
            primary_reason=choice_value,
        ).count()
        no_override_count = DecisionQualityReview.objects.filter(
            override_present=False,
            primary_reason=choice_value,
        ).count()
        result['has_override'][choice_label] = has_override_count
        result['no_override'][choice_label] = no_override_count

    return result


def get_decision_quality_by_case_type() -> Dict[str, Dict[str, int]]:
    """Get decision quality distribution by case status/type.

    Returns aggregated metrics by case type (if available).
    """
    from contracts.models import DecisionQualityReview, CaseIntakeProcess
    from django.db.models import Count, Q

    result = {}
    try:
        for case_status, _ in CaseIntakeProcess._meta.get_field('status').choices:
            quality_counts = (
                DecisionQualityReview.objects
                .filter(case__status=case_status)
                .values('decision_quality')
                .annotate(count=Count('id'))
            )
            result[case_status] = {
                q['decision_quality']: q['count']
                for q in quality_counts
            }
    except Exception:
        pass

    return result


def get_decision_quality_by_provider() -> Dict[int, Dict[str, Any]]:
    """Get decision quality metrics aggregated by provider.

    Returns aggregated quality and override stats per provider.
    """
    from contracts.models import DecisionQualityReview
    from django.db.models import Count, Q

    result = {}
    reviews = DecisionQualityReview.objects.select_related('case', 'placement').all()

    for review in reviews:
        # Use selected_provider if available, fall back to proposed_provider
        if review.placement:
            provider_id = review.placement.selected_provider_id or review.placement.proposed_provider_id
        else:
            provider_id = None
        
        if not provider_id:
            continue

        if provider_id not in result:
            result[provider_id] = {
                'review_count': 0,
                'system_correct': 0,
                'user_correct': 0,
                'both_acceptable': 0,
                'both_suboptimal': 0,
                'override_count': 0,
            }

        result[provider_id]['review_count'] += 1
        result[provider_id][review.decision_quality.lower()] = result[provider_id].get(review.decision_quality.lower(), 0) + 1
        if review.override_present:
            result[provider_id]['override_count'] += 1

    return result
