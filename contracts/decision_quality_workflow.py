from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from django.db.models import Count, Q
from django.utils import timezone

from contracts.governance import build_decision_review_context, replay_case_decisions
from contracts.models import (
    CaseDecisionLog,
    CaseIntakeProcess,
    DecisionQualityReview,
    DecisionQualityWeeklyReviewMark,
    PlacementRequest,
)


# ---------------------------------------------------------------------------
# Review Rubric (machine-readable, reusable)
# ---------------------------------------------------------------------------

DECISION_QUALITY_RUBRIC: Dict[str, Dict[str, str]] = {
    DecisionQualityReview.DecisionQuality.SYSTEM_CORRECT: {
        'label': 'System correct',
        'guidance': 'Use when the recommendation was appropriate given known context at decision time.',
        'reviewer_note': 'Still valid even if outcome later changed due to external constraints.',
    },
    DecisionQualityReview.DecisionQuality.USER_CORRECT: {
        'label': 'User correct',
        'guidance': 'Use when the user override clearly improved the practical or clinical decision quality.',
        'reviewer_note': 'Capture why the recommendation missed critical context or feasibility.',
    },
    DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE: {
        'label': 'Both acceptable',
        'guidance': 'Use when both system path and user path were defensible with available information.',
        'reviewer_note': 'Prefer when differences are tactical, not quality-impacting.',
    },
    DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL: {
        'label': 'Both suboptimal',
        'guidance': 'Use when neither path adequately addressed case needs or constraints.',
        'reviewer_note': 'Add notes to explain failure pattern and prevention options.',
    },
}

PRIMARY_REASON_RUBRIC: Dict[str, Dict[str, str]] = {
    DecisionQualityReview.PrimaryReason.MISSING_DATA: {
        'label': 'Missing data',
        'guidance': 'Use when key context was absent or stale during the decision.',
        'reviewer_note': 'Highlight which data gap changed decision confidence.',
    },
    DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH: {
        'label': 'Provider mismatch',
        'guidance': 'Use when provider fit (care profile, region, capability) was insufficient.',
        'reviewer_note': 'Distinguish fit mismatch from temporary capacity shortage.',
    },
    DecisionQualityReview.PrimaryReason.CAPACITY_ISSUE: {
        'label': 'Capacity issue',
        'guidance': 'Use when provider availability/timing prevented good execution.',
        'reviewer_note': 'Capture if issue was predictable from existing operational signals.',
    },
    DecisionQualityReview.PrimaryReason.SLA_TIMING: {
        'label': 'SLA timing',
        'guidance': 'Use when escalation timing and response windows drove the decision outcome.',
        'reviewer_note': 'Reference whether escalation happened too late or too early.',
    },
    DecisionQualityReview.PrimaryReason.EXPLANATION_UNCLEAR: {
        'label': 'Explanation unclear',
        'guidance': 'Use when recommendation rationale was hard to interpret or trust.',
        'reviewer_note': 'Note which part of explainability was insufficient for action.',
    },
    DecisionQualityReview.PrimaryReason.EXTERNAL_CONSTRAINT: {
        'label': 'External constraint',
        'guidance': 'Use when municipal/legal/family/operational constraints dominated decisions.',
        'reviewer_note': 'Do not classify as model failure if external constraint is primary.',
    },
    DecisionQualityReview.PrimaryReason.OTHER: {
        'label': 'Other',
        'guidance': 'Use only when predefined categories do not capture the root cause.',
        'reviewer_note': 'Add notes with concrete explanation when selecting this category.',
    },
}


# ---------------------------------------------------------------------------
# Weekly date helpers
# ---------------------------------------------------------------------------


def _week_bounds(year: int, week: int) -> tuple[date, date]:
    start = date.fromisocalendar(year, week, 1)
    end = date.fromisocalendar(year, week, 7)
    return start, end


def _week_queryset_filter(field_name: str, year: int, week: int) -> Dict[str, Any]:
    start, end = _week_bounds(year, week)
    return {f'{field_name}__date__gte': start, f'{field_name}__date__lte': end}


def _serialize_dt(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


# ---------------------------------------------------------------------------
# Weekly candidate selection
# ---------------------------------------------------------------------------


def _candidate_entry(case_id: int) -> Dict[str, Any]:
    return {
        'case_id': case_id,
        'placement_id': None,
        'latest_event_at': None,
        'override_count': 0,
        'escalation_count': 0,
        'forced_action_count': 0,
        'rematch_count': 0,
        'friction_count': 0,
        'event_count': 0,
        'reasons': [],
        'priority_score': 0,
    }


def _append_reason(entry: Dict[str, Any], reason: str) -> None:
    if reason not in entry['reasons']:
        entry['reasons'].append(reason)


def _score_entry(entry: Dict[str, Any]) -> int:
    score = 0
    score += entry['override_count'] * 3
    score += entry['forced_action_count'] * 4
    score += entry['escalation_count'] * 2
    score += entry['rematch_count'] * 3
    score += entry['friction_count']
    return score


def get_weekly_decision_review_candidates(year: int, week: int, limit: int | None = None) -> List[Dict[str, Any]]:
    """Return deterministic weekly candidate cases for decision-quality review."""
    start, end = _week_bounds(year, week)
    logs = (
        CaseDecisionLog.objects
        .filter(timestamp__date__gte=start, timestamp__date__lte=end)
        .order_by('-timestamp', '-id')
    )

    by_case: Dict[int, Dict[str, Any]] = {}
    for log in logs:
        case_id = log.case_id_snapshot or log.case_id
        if not case_id:
            continue
        entry = by_case.setdefault(case_id, _candidate_entry(case_id))
        entry['event_count'] += 1
        if entry['latest_event_at'] is None:
            entry['latest_event_at'] = log.timestamp
            entry['placement_id'] = log.placement_id_snapshot or log.placement_id

        if log.override_type:
            entry['override_count'] += 1
            _append_reason(entry, 'override_present')

        if log.event_type == CaseDecisionLog.EventType.SLA_ESCALATION:
            if log.sla_state in {'ESCALATED', 'FORCED_ACTION'}:
                entry['escalation_count'] += 1
                _append_reason(entry, 'sla_escalation')
            if log.sla_state == 'FORCED_ACTION':
                entry['forced_action_count'] += 1
                _append_reason(entry, 'forced_action')

        if log.event_type == CaseDecisionLog.EventType.REMATCH_TRIGGERED:
            entry['rematch_count'] += 1
            _append_reason(entry, 'rematch')

        if log.event_type in {
            CaseDecisionLog.EventType.RESEND_TRIGGERED,
            CaseDecisionLog.EventType.PROVIDE_MISSING_INFO,
            CaseDecisionLog.EventType.CONTINUE_WAITING,
        }:
            entry['friction_count'] += 1
            _append_reason(entry, 'provider_response_friction')

    if not by_case:
        return []

    cases = CaseIntakeProcess.objects.filter(pk__in=list(by_case.keys())).values(
        'id',
        'status',
        'title',
        'intake_outcome_status',
    )
    case_by_id = {row['id']: row for row in cases}

    placements = (
        PlacementRequest.objects
        .filter(due_diligence_process_id__in=list(by_case.keys()))
        .order_by('due_diligence_process_id', '-created_at')
    )
    latest_placement: Dict[int, PlacementRequest] = {}
    for placement in placements:
        if placement.due_diligence_process_id not in latest_placement:
            latest_placement[placement.due_diligence_process_id] = placement

    week_reviewed_case_ids = set(
        DecisionQualityReview.objects
        .filter(**_week_queryset_filter('review_timestamp', year, week))
        .values_list('case_id', flat=True)
    )

    rows: List[Dict[str, Any]] = []
    for case_id, entry in by_case.items():
        case_row = case_by_id.get(case_id, {})
        placement = latest_placement.get(case_id)

        if case_row.get('intake_outcome_status') == CaseIntakeProcess.IntakeOutcomeStatus.COMPLETED:
            _append_reason(entry, 'completed_outcome')
        if placement and placement.provider_response_status in {
            PlacementRequest.ProviderResponseStatus.REJECTED,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        }:
            _append_reason(entry, 'provider_response_friction')
            entry['friction_count'] += 1
        if placement and placement.placement_quality_status in {
            PlacementRequest.PlacementQualityStatus.AT_RISK,
            PlacementRequest.PlacementQualityStatus.BROKEN_DOWN,
        }:
            _append_reason(entry, 'suboptimal_outcome')

        entry['priority_score'] = _score_entry(entry)
        entry['case_title'] = case_row.get('title') or f'Case {case_id}'
        entry['case_status'] = case_row.get('status')
        entry['intake_outcome_status'] = case_row.get('intake_outcome_status')
        entry['placement_id'] = entry['placement_id'] or (placement.pk if placement else None)
        entry['placement_status'] = placement.status if placement else None
        entry['provider_response_status'] = placement.provider_response_status if placement else None
        entry['reviewed_this_week'] = case_id in week_reviewed_case_ids
        rows.append(entry)

    rows.sort(
        key=lambda row: (
            -row['priority_score'],
            row['latest_event_at'] is None,
            -(row['latest_event_at'].timestamp() if row['latest_event_at'] else 0),
            row['case_id'],
        )
    )

    if limit is not None:
        rows = rows[:limit]

    for row in rows:
        row['latest_event_at'] = _serialize_dt(row['latest_event_at'])

    return rows


def get_override_heavy_cases(year: int, week: int, limit: int | None = None) -> List[Dict[str, Any]]:
    """Return weekly candidates prioritized by override intensity."""
    candidates = [row for row in get_weekly_decision_review_candidates(year, week) if row['override_count'] > 0]
    candidates.sort(
        key=lambda row: (
            -row['override_count'],
            -row['priority_score'],
            row['case_id'],
        )
    )
    return candidates[:limit] if limit is not None else candidates


def get_suboptimal_outcome_cases(year: int, week: int, limit: int | None = None) -> List[Dict[str, Any]]:
    """Return weekly candidates where outcomes suggest suboptimal execution paths."""
    candidates = get_weekly_decision_review_candidates(year, week)
    filtered = [
        row for row in candidates
        if (
            'suboptimal_outcome' in row['reasons']
            or row['provider_response_status'] in {
                PlacementRequest.ProviderResponseStatus.REJECTED,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
                PlacementRequest.ProviderResponseStatus.WAITLIST,
            }
            or row['forced_action_count'] > 0
            or row['rematch_count'] > 0
        )
    ]
    return filtered[:limit] if limit is not None else filtered


# ---------------------------------------------------------------------------
# Weekly review packet
# ---------------------------------------------------------------------------


def build_weekly_decision_quality_review_packet(year: int, week: int) -> Dict[str, Any]:
    """Build a compact weekly packet to support decision-quality review sessions."""
    candidates = get_weekly_decision_review_candidates(year, week)
    start, end = _week_bounds(year, week)

    reviewed_this_week = {
        review.case_id: review
        for review in DecisionQualityReview.objects.filter(**_week_queryset_filter('review_timestamp', year, week)).order_by('-review_timestamp')
    }

    packet_cases: List[Dict[str, Any]] = []
    for candidate in candidates:
        case_id = candidate['case_id']
        context = build_decision_review_context(case_id)
        replay = replay_case_decisions(case_id)

        latest_review = (
            DecisionQualityReview.objects
            .filter(case_id=case_id)
            .order_by('-review_timestamp', '-created_at')
            .first()
        )
        weekly_review = reviewed_this_week.get(case_id)

        replay_summary = [
            {
                'event_type': item.get('event_type'),
                'semantic_type': item.get('semantic_type'),
                'summary': item.get('summary'),
                'timestamp': _serialize_dt(item.get('timestamp')),
            }
            for item in replay[-5:]
        ]

        packet_cases.append({
            'case_id': case_id,
            'priority_score': candidate['priority_score'],
            'selection_reasons': candidate['reasons'],
            'reviewed_this_week': bool(weekly_review),
            'case_summary': context.get('case_summary', {}),
            'recommendation_snapshot': context.get('recommendation', {}),
            'actual_decision_snapshot': context.get('actual_decision', {}),
            'override': context.get('override', {}),
            'outcome': context.get('outcome', {}),
            'sla_timeline': context.get('sla_timeline', []),
            'replay_summary': replay_summary,
            'review_status': {
                'reviewed_this_week': bool(weekly_review),
                'weekly_review_id': weekly_review.id if weekly_review else None,
                'last_review_id': latest_review.id if latest_review else None,
                'last_review_timestamp': _serialize_dt(latest_review.review_timestamp) if latest_review else None,
                'last_decision_quality': latest_review.decision_quality if latest_review else None,
                'last_primary_reason': latest_review.primary_reason if latest_review else None,
            },
        })

    return {
        'year': year,
        'week': week,
        'week_start': start.isoformat(),
        'week_end': end.isoformat(),
        'candidate_count': len(candidates),
        'reviewed_count': len(reviewed_this_week),
        'cases': packet_cases,
    }


# ---------------------------------------------------------------------------
# Weekly summaries
# ---------------------------------------------------------------------------


def get_top_decision_quality_reasons(year: int, week: int) -> Dict[str, List[Dict[str, Any]]]:
    """Return top reason patterns for USER_CORRECT and BOTH_SUBOPTIMAL reviews."""
    base_qs = DecisionQualityReview.objects.filter(**_week_queryset_filter('review_timestamp', year, week))

    def _top_for(quality: str) -> List[Dict[str, Any]]:
        rows = (
            base_qs
            .filter(decision_quality=quality)
            .values('primary_reason')
            .annotate(count=Count('id'))
            .order_by('-count', 'primary_reason')
        )
        return [{'primary_reason': row['primary_reason'], 'count': row['count']} for row in rows]

    return {
        'user_correct': _top_for(DecisionQualityReview.DecisionQuality.USER_CORRECT),
        'both_suboptimal': _top_for(DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL),
    }


def get_weekly_review_completion_stats(year: int, week: int) -> Dict[str, Any]:
    candidates = get_weekly_decision_review_candidates(year, week)
    candidate_case_ids = {row['case_id'] for row in candidates}

    reviewed_case_ids = set(
        DecisionQualityReview.objects
        .filter(**_week_queryset_filter('review_timestamp', year, week))
        .values_list('case_id', flat=True)
    )

    marked_case_ids = set(
        DecisionQualityWeeklyReviewMark.objects
        .filter(year=year, week=week)
        .values_list('case_id', flat=True)
    )

    reviewed_candidate_case_ids = candidate_case_ids & reviewed_case_ids
    unreviewed_priority_case_ids = sorted(candidate_case_ids - reviewed_case_ids)
    completion_rate = round((len(reviewed_candidate_case_ids) / len(candidate_case_ids)) * 100, 1) if candidate_case_ids else 0.0

    return {
        'candidate_case_count': len(candidate_case_ids),
        'reviewed_case_count': len(reviewed_case_ids),
        'reviewed_candidate_case_count': len(reviewed_candidate_case_ids),
        'candidate_not_yet_reviewed_count': len(unreviewed_priority_case_ids),
        'candidate_not_yet_reviewed_case_ids': unreviewed_priority_case_ids,
        'marked_case_count': len(marked_case_ids),
        'marked_but_unreviewed_count': len(marked_case_ids - reviewed_case_ids),
        'completion_rate_percent': completion_rate,
    }


def get_weekly_decision_quality_summary(year: int, week: int) -> Dict[str, Any]:
    """Return compact weekly summary for pilot operations review."""
    reviews_qs = DecisionQualityReview.objects.filter(**_week_queryset_filter('review_timestamp', year, week))
    reviews = list(reviews_qs.select_related('case', 'placement'))

    distribution = {choice: 0 for choice, _ in DecisionQualityReview.DecisionQuality.choices}
    for review in reviews:
        distribution[review.decision_quality] = distribution.get(review.decision_quality, 0) + 1

    reviewed_count = len(reviews)
    override_count = sum(1 for review in reviews if review.override_present)
    override_frequency = round((override_count / reviewed_count) * 100, 1) if reviewed_count else 0.0

    provider_counter: Counter[int] = Counter()
    case_type_counter: Counter[str] = Counter()
    for review in reviews:
        case_type_counter[review.case.status] += 1
        if review.placement and (review.placement.selected_provider_id or review.placement.proposed_provider_id):
            provider_counter[review.placement.selected_provider_id or review.placement.proposed_provider_id] += 1

    completion = get_weekly_review_completion_stats(year, week)

    return {
        'year': year,
        'week': week,
        'reviewed_case_count': reviewed_count,
        'quality_distribution': distribution,
        'override_count': override_count,
        'override_frequency_percent': override_frequency,
        'top_reasons': get_top_decision_quality_reasons(year, week),
        'provider_concentration': [{'provider_id': provider_id, 'count': count} for provider_id, count in provider_counter.most_common(5)],
        'case_type_concentration': [{'case_status': status, 'count': count} for status, count in case_type_counter.most_common(5)],
        'candidate_not_yet_reviewed_count': completion['candidate_not_yet_reviewed_count'],
        'completion': completion,
    }


# ---------------------------------------------------------------------------
# Consistency guardrails
# ---------------------------------------------------------------------------


def evaluate_review_consistency(
    *,
    decision_quality: str,
    override_present: bool,
    override_type: str | None,
    primary_reason: str,
    notes: str,
) -> Dict[str, Any]:
    """Return non-blocking consistency flags and warnings for review quality."""
    warnings: List[str] = []
    hints: List[str] = []

    normalized_notes = (notes or '').strip()
    has_notes = bool(normalized_notes)

    if not override_present and override_type:
        warnings.append('override_type is set while override_present is false; this is usually inconsistent.')

    if override_present and not override_type:
        warnings.append('override_present is true but override_type is empty; classify override type when possible.')

    if decision_quality == DecisionQualityReview.DecisionQuality.USER_CORRECT and primary_reason == DecisionQualityReview.PrimaryReason.OTHER:
        warnings.append('USER_CORRECT usually benefits from a specific primary_reason beyond OTHER.')

    if decision_quality == DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL and len(normalized_notes) < 12:
        hints.append('BOTH_SUBOPTIMAL reviews are more useful with explanatory notes.')

    if decision_quality == DecisionQualityReview.DecisionQuality.SYSTEM_CORRECT and override_present:
        hints.append('SYSTEM_CORRECT with override is allowed; verify override rationale in notes.')

    completeness_flags = {
        'has_primary_reason': bool(primary_reason),
        'has_notes': has_notes,
        'override_type_consistent': (override_present and bool(override_type)) or (not override_present and not override_type),
        'requires_followup_notes': decision_quality == DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL and not has_notes,
    }

    return {
        'is_consistent': len(warnings) == 0,
        'warnings': warnings,
        'hints': hints,
        'completeness_flags': completeness_flags,
    }


# ---------------------------------------------------------------------------
# Weekly mark workflow
# ---------------------------------------------------------------------------


def mark_case_for_weekly_review(
    case_id: int,
    year: int,
    week: int,
    reason: str | None = None,
    *,
    marked_by_user_id: int | None = None,
) -> Dict[str, Any]:
    """Persist a lightweight weekly mark to support pilot review cadence."""
    mark, created = DecisionQualityWeeklyReviewMark.objects.get_or_create(
        case_id=case_id,
        year=year,
        week=week,
        defaults={
            'reason': (reason or '').strip(),
            'marked_by_id': marked_by_user_id,
        },
    )
    if not created:
        updated = False
        if reason is not None and reason.strip() != mark.reason:
            mark.reason = reason.strip()
            updated = True
        if marked_by_user_id and mark.marked_by_id != marked_by_user_id:
            mark.marked_by_id = marked_by_user_id
            updated = True
        if updated:
            mark.save(update_fields=['reason', 'marked_by'])

    return {
        'created': created,
        'mark_id': mark.id,
        'case_id': mark.case_id,
        'year': mark.year,
        'week': mark.week,
        'reason': mark.reason,
        'marked_by_user_id': mark.marked_by_id,
        'created_at': _serialize_dt(mark.created_at),
    }


def get_cases_marked_for_review(year: int, week: int) -> List[Dict[str, Any]]:
    marks = (
        DecisionQualityWeeklyReviewMark.objects
        .filter(year=year, week=week)
        .select_related('case', 'placement', 'marked_by')
        .order_by('-created_at', 'case_id')
    )
    return [
        {
            'mark_id': mark.id,
            'case_id': mark.case_id,
            'case_title': mark.case.title,
            'placement_id': mark.placement_id,
            'reason': mark.reason,
            'marked_by_user_id': mark.marked_by_id,
            'created_at': _serialize_dt(mark.created_at),
        }
        for mark in marks
    ]


def get_unreviewed_priority_cases(year: int, week: int) -> List[Dict[str, Any]]:
    """Return high-priority weekly cases that still need review."""
    reviewed_case_ids = set(
        DecisionQualityReview.objects
        .filter(**_week_queryset_filter('review_timestamp', year, week))
        .values_list('case_id', flat=True)
    )
    marks = get_cases_marked_for_review(year, week)
    marked_case_ids = {row['case_id'] for row in marks}

    candidates = get_weekly_decision_review_candidates(year, week)
    prioritized: List[Dict[str, Any]] = []
    for candidate in candidates:
        if candidate['case_id'] in reviewed_case_ids:
            continue
        candidate_copy = dict(candidate)
        candidate_copy['is_marked'] = candidate['case_id'] in marked_case_ids
        prioritized.append(candidate_copy)

    prioritized.sort(key=lambda row: (not row['is_marked'], -row['priority_score'], row['case_id']))
    return prioritized
