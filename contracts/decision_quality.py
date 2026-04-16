"""Decision Quality Review service layer for pilot evaluation.

This module provides the service-level logic for creating and managing decision
quality reviews. It handles input validation, snapshot capture, and integration
with the governance layer without disrupting operational workflows.

All reviews are created as separate records with no side effects on cases or
placement requests. This is a read-only evaluation layer.
"""

from typing import Any, Dict, Optional
import logging
from datetime import datetime, date, timedelta

from django.utils import timezone
from django.db import transaction, models
from django.db.models import Q

from contracts.models import DecisionQualityReview, CaseIntakeProcess, PlacementRequest
from contracts.governance import build_decision_review_context
from contracts.decision_quality_workflow import evaluate_review_consistency

logger = logging.getLogger(__name__)


def _json_safe(value: Any) -> Any:
    """Convert snapshot payloads to JSON-serializable primitives."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    return value


def create_decision_quality_review(
    *,
    case_id: int,
    placement_id: Optional[int] = None,
    reviewed_by_user_id: Optional[int] = None,
    decision_quality: str = DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE,
    override_present: bool = False,
    override_type: Optional[str] = None,
    primary_reason: str = DecisionQualityReview.PrimaryReason.OTHER,
    outcome: str = '',
    notes: str = '',
    review_timestamp: Optional[datetime] = None,
) -> Optional[DecisionQualityReview]:
    """Create a decision quality review for a case.

    This is the primary entry point for recording decision quality evaluations
    during pilot reviews. It validates inputs, captures decision snapshots from
    the governance layer, and persists the review without side effects.

    Args:
        case_id: ID of the case being reviewed
        placement_id: ID of the placement (optional)
        reviewed_by_user_id: ID of the reviewer (optional for system reviews)
        decision_quality: One of DecisionQualityReview.DecisionQuality choices
        override_present: Whether a user override was detected
        override_type: Type of override (if present)
        primary_reason: Primary reason for quality assessment
        outcome: Description of what actually happened
        notes: Additional reviewer notes
        review_timestamp: When the review occurred (defaults to now)

    Returns:
        Created DecisionQualityReview instance or None if validation failed
    """
    # Validate case exists
    try:
        case = CaseIntakeProcess.objects.get(pk=case_id)
    except CaseIntakeProcess.DoesNotExist:
        logger.warning('Cannot create review for non-existent case', extra={'case_id': case_id})
        return None

    # Validate placement if provided
    placement = None
    if placement_id:
        try:
            placement = PlacementRequest.objects.get(pk=placement_id, due_diligence_process_id=case_id)
        except PlacementRequest.DoesNotExist:
            logger.warning(
                'Placement does not match case; review will be created without placement reference',
                extra={'case_id': case_id, 'placement_id': placement_id},
            )
            placement_id = None

    # Build decision context from governance layer
    context = build_decision_review_context(case_id)

    # Prepare snapshots
    system_recommendation = _json_safe(context.get('recommendation', {}).get('recommendation'))
    actual_decision = _json_safe(context.get('actual_decision', {}))

    # Validate enum choices
    if decision_quality not in dict(DecisionQualityReview.DecisionQuality.choices):
        logger.warning(
            'Invalid decision_quality value',
            extra={'decision_quality': decision_quality, 'defaulting_to': DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE},
        )
        decision_quality = DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE

    if primary_reason not in dict(DecisionQualityReview.PrimaryReason.choices):
        logger.warning(
            'Invalid primary_reason value',
            extra={'primary_reason': primary_reason, 'defaulting_to': DecisionQualityReview.PrimaryReason.OTHER},
        )
        primary_reason = DecisionQualityReview.PrimaryReason.OTHER

    # Override type validation
    if override_present and override_type:
        if override_type not in dict(DecisionQualityReview.OverrideType.choices):
            logger.warning(
                'Invalid override_type; override_type will be cleared',
                extra={'override_type': override_type},
            )
            override_type = None

    consistency = evaluate_review_consistency(
        decision_quality=decision_quality,
        override_present=override_present,
        override_type=override_type,
        primary_reason=primary_reason,
        notes=notes,
    )
    if consistency['warnings']:
        logger.warning('Decision quality review created with consistency warnings', extra={
            'case_id': case_id,
            'placement_id': placement_id,
            'warnings': consistency['warnings'],
        })

    # Create the review
    try:
        with transaction.atomic():
            review = DecisionQualityReview.objects.create(
                case=case,
                placement_id=placement_id,
                reviewed_by_id=reviewed_by_user_id,
                system_recommendation=system_recommendation,
                actual_decision=actual_decision,
                outcome=outcome or '',
                decision_quality=decision_quality,
                override_present=override_present,
                override_type=override_type or '',
                primary_reason=primary_reason,
                notes=notes or '',
                review_timestamp=review_timestamp or timezone.now(),
            )
            logger.info(
                'Decision quality review created',
                extra={
                    'review_id': review.pk,
                    'case_id': case_id,
                    'placement_id': placement_id,
                    'decision_quality': decision_quality,
                    'override_present': override_present,
                },
            )
            # Optional runtime metadata for callers (not persisted).
            review.consistency_feedback = consistency  # type: ignore[attr-defined]
            return review
    except Exception as e:
        logger.exception('Failed to create decision quality review', extra={
            'case_id': case_id,
            'placement_id': placement_id,
            'error': str(e),
        })
        return None


def get_reviews_for_case(case_id: int) -> list[DecisionQualityReview]:
    """Retrieve all quality reviews for a case, ordered by most recent first."""
    return list(
        DecisionQualityReview.objects
        .filter(case_id=case_id)
        .order_by('-review_timestamp', '-created_at')
    )


def get_reviews_for_week(year: int, week: int) -> list[DecisionQualityReview]:
    """Retrieve all quality reviews created in a specific ISO week.

    Args:
        year: ISO year
        week: ISO week number (1-53)

    Returns:
        List of DecisionQualityReview objects in that week
    """
    from datetime import date, timedelta

    # Calculate date range for ISO week
    jan_4 = date(year, 1, 4)
    week_1_monday = jan_4 - timedelta(days=jan_4.isoweekday() - 1)
    week_monday = week_1_monday + timedelta(weeks=week - 1)
    week_sunday = week_monday + timedelta(days=6)

    return list(
        DecisionQualityReview.objects
        .filter(
            review_timestamp__date__gte=week_monday,
            review_timestamp__date__lte=week_sunday,
        )
        .order_by('-review_timestamp')
    )


def get_reviews_needing_attention() -> list[DecisionQualityReview]:
    """Get reviews flagged as suboptimal or with overrides for follow-up."""
    return list(
        DecisionQualityReview.objects
        .filter(
            Q(decision_quality=DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL)
            | Q(override_present=True)
        )
        .order_by('-review_timestamp')
        .select_related('case', 'placement', 'reviewed_by')
    )
