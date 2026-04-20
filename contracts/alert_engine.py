"""Alert Engine – Regiekamer operational alert generation.

Purpose
-------
Translates evaluated case state (output of ``evaluate_case_intelligence``)
into persisted ``OperationalAlert`` objects that drive the Regiekamer control
interface.

Design rules
------------
- One unresolved alert per (case, alert_type) at any time.
- Existing unresolved alerts are refreshed (title/description/action updated)
  rather than duplicated.
- If a condition no longer holds the corresponding unresolved alert is
  automatically resolved.
- Alert generation is a side effect of ``evaluateCase`` – callers only need
  to call :func:`generate_alerts_for_case`.
- No business logic in views.  All rules live here.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from django.utils import timezone

from contracts.case_intelligence import evaluate_case_intelligence
from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    OperationalAlert,
    PlacementRequest,
)


# ---------------------------------------------------------------------------
# Severity constants
# ---------------------------------------------------------------------------

_HIGH = OperationalAlert.Severity.HIGH
_MEDIUM = OperationalAlert.Severity.MEDIUM
_LOW = OperationalAlert.Severity.LOW

# Alert type constants for readability
_URGENT_UNMATCHED = OperationalAlert.AlertType.URGENT_UNMATCHED_CASE
_INCOMPLETE_BEOORDELING = OperationalAlert.AlertType.INCOMPLETE_BEOORDELING
_MISSING_CRITICAL_DATA = OperationalAlert.AlertType.MISSING_CRITICAL_DATA
_WEAK_MATCH = OperationalAlert.AlertType.WEAK_MATCH_NEEDS_REVIEW
_PLACEMENT_STALLED = OperationalAlert.AlertType.PLACEMENT_STALLED
_CAPACITY_RISK = OperationalAlert.AlertType.PROVIDER_CAPACITY_RISK


# ---------------------------------------------------------------------------
# Case data builder (mirrors _build_case_intelligence_context in views.py)
# ---------------------------------------------------------------------------

def _build_case_data_for_alert(intake: CaseIntakeProcess) -> Dict[str, Any]:
    """Build the minimal case_data dict required by evaluate_case_intelligence.

    This function queries related objects directly from the intake so that
    alert generation can work independently of the view context.
    """
    assessment = getattr(intake, 'case_assessment', None)

    placements = (
        PlacementRequest.objects
        .filter(due_diligence_process=intake)
        .order_by('-updated_at', '-id')
    )
    placement = placements.first()

    open_signals_count = intake.signals.filter(status='OPEN').count() if intake.pk else 0
    open_tasks_count = intake.followup_tasks.filter(is_completed=False).count() if intake.pk else 0

    rejected_count = (
        placements.filter(
            provider_response_status__in=[
                PlacementRequest.ProviderResponseStatus.REJECTED,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            ]
        ).count()
    )

    has_region_preference = bool(
        getattr(intake, 'preferred_region_id', None)
        or getattr(intake, 'preferred_region_type', None)
    )

    return {
        'phase': intake.status,
        'care_category': intake.care_category_main.name if intake.care_category_main else None,
        'urgency': intake.urgency,
        'assessment_complete': bool(
            assessment and assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
        ),
        'matching_run_exists': False,
        'top_match_confidence': None,
        'top_match_has_capacity_issue': False,
        'top_match_wait_days': None,
        'selected_provider_id': placement.selected_provider_id if placement else None,
        'placement_status': placement.status if placement else None,
        'placement_updated_at': placement.updated_at if placement else None,
        'rejected_provider_count': rejected_count,
        'open_signal_count': open_signals_count,
        'open_task_count': open_tasks_count,
        'case_updated_at': intake.updated_at,
        'candidate_suggestions': [],
        'has_preferred_region': has_region_preference,
        'has_assessment_summary': bool(getattr(intake, 'assessment_summary', None)),
        'has_client_age_category': bool(getattr(intake, 'client_age_category', None)),
        'assessment_status': assessment.assessment_status if assessment else None,
        'assessment_matching_ready': assessment.matching_ready if assessment else None,
        'matching_updated_at': None,
        'provider_response_status': getattr(placement, 'provider_response_status', None) if placement else None,
        'provider_response_recorded_at': getattr(placement, 'provider_response_recorded_at', None) if placement else None,
        'provider_response_requested_at': getattr(placement, 'provider_response_requested_at', None) if placement else None,
        'provider_response_deadline_at': getattr(placement, 'provider_response_deadline_at', None) if placement else None,
        'provider_response_last_reminder_at': getattr(placement, 'provider_response_last_reminder_at', None) if placement else None,
        'now': timezone.now(),
    }


# ---------------------------------------------------------------------------
# Alert rule evaluation
# ---------------------------------------------------------------------------

AlertSpec = Tuple[str, str, str, str, str]  # (alert_type, severity, title, description, recommended_action)

_SIGNAL_CODE_TO_ALERT: Dict[str, Tuple[str, str, str, str, str]] = {
    'placement_stalled': (
        _PLACEMENT_STALLED,
        _HIGH,
        'Plaatsing stagneert',
        'De plaatsingsstatus heeft al meerdere dagen geen voortgang geboekt.',
        'Neem contact op met de aanbieder en werk de plaatsingsstatus bij.',
    ),
    'capacity_risk': (
        _CAPACITY_RISK,
        _MEDIUM,
        'Capaciteitsrisico bij aanbieder',
        'De geselecteerde aanbieder heeft een beperkte of onzekere capaciteit.',
        'Valideer beschikbaarheid bij de aanbieder of start een her-match.',
    ),
    'provider_no_capacity': (
        _CAPACITY_RISK,
        _HIGH,
        'Aanbieder heeft geen capaciteit',
        'De geselecteerde aanbieder geeft aan geen capaciteit te hebben.',
        'Markeer als hoog risico en voer direct een her-match uit.',
    ),
    'weak_matching_quality': (
        _WEAK_MATCH,
        _MEDIUM,
        'Zwakke matchingkwaliteit – review vereist',
        'De topmatch heeft een lage of ontbrekende confidence.',
        'Controleer matchingfactoren en herzie de kandidatenlijst.',
    ),
}


def _evaluate_alert_specs(
    intake: CaseIntakeProcess,
    intelligence: Dict[str, Any],
) -> List[Tuple[str, str, str, str, str]]:
    """Return a list of (alert_type, severity, title, description, recommended_action) tuples
    that should be *active* for this case right now.
    """
    specs: List[Tuple[str, str, str, str, str]] = []

    # ── urgent_unmatched_case ──────────────────────────────────────────────
    urgency = str(intake.urgency or '').upper()
    is_urgent = urgency in {'HIGH', 'CRISIS'}
    next_action = intelligence.get('next_best_action', {}).get('code', '')
    if is_urgent and next_action in {'run_matching', 'fill_missing_information', 'complete_assessment'}:
        specs.append((
            _URGENT_UNMATCHED,
            _HIGH,
            'Urgente casus wacht op matching',
            f'De casus heeft urgentie "{intake.get_urgency_display()}" maar er is nog geen matching uitgevoerd.',
            'Voer direct matching uit en selecteer een aanbieder.',
        ))

    # ── incomplete_beoordeling ─────────────────────────────────────────────
    missing_codes = {item.get('code') for item in intelligence.get('missing_information', [])}
    beoordeling_codes = {
        'assessment_needs_info',
        'assessment_not_ready',
        'missing_assessment_summary',
    }
    if missing_codes.intersection(beoordeling_codes):
        specs.append((
            _INCOMPLETE_BEOORDELING,
            _MEDIUM,
            'Beoordeling incompleet',
            'De beoordeling is nog niet afgerond of mist vereiste informatie voor matching.',
            'Open de beoordeling en vul ontbrekende informatie aan.',
        ))

    # ── missing_critical_data ──────────────────────────────────────────────
    critical_missing_codes = missing_codes - beoordeling_codes
    if critical_missing_codes:
        first_item = next(
            (i for i in intelligence.get('missing_information', [])
             if i.get('code') in critical_missing_codes),
            None,
        )
        description = (
            first_item['message'] if first_item
            else 'Kritieke casusgegevens ontbreken.'
        )
        specs.append((
            _MISSING_CRITICAL_DATA,
            _HIGH,
            'Kritieke gegevens ontbreken',
            description,
            'Vul de ontbrekende casusgegevens aan voordat matching kan doorgaan.',
        ))

    # ── weak_match_needs_review ────────────────────────────────────────────
    signal_codes = {sig.get('code') for sig in intelligence.get('risk_signals', [])}
    if 'weak_matching_quality' in signal_codes:
        specs.append((
            _WEAK_MATCH,
            _MEDIUM,
            'Zwakke match – review vereist',
            'De topmatch heeft een lage of ontbrekende confidence.',
            'Controleer matchingfactoren en herzie de kandidatenlijst.',
        ))

    # ── placement_stalled ─────────────────────────────────────────────────
    if 'placement_stalled' in signal_codes:
        specs.append((
            _PLACEMENT_STALLED,
            _HIGH,
            'Plaatsing stagneert',
            'De plaatsingsstatus heeft meerdere dagen geen voortgang geboekt.',
            'Neem contact op met de aanbieder en werk de plaatsingsstatus bij.',
        ))

    # ── provider_capacity_risk ────────────────────────────────────────────
    if 'capacity_risk' in signal_codes or 'provider_no_capacity' in signal_codes:
        severity = _HIGH if 'provider_no_capacity' in signal_codes else _MEDIUM
        description = (
            'De geselecteerde aanbieder heeft geen capaciteit.'
            if 'provider_no_capacity' in signal_codes
            else 'De geselecteerde aanbieder heeft een beperkte of onzekere capaciteit.'
        )
        action = (
            'Markeer als hoog risico en voer direct een her-match uit.'
            if 'provider_no_capacity' in signal_codes
            else 'Valideer beschikbaarheid bij de aanbieder of start een her-match.'
        )
        specs.append((
            _CAPACITY_RISK,
            severity,
            'Capaciteitsrisico aanbieder',
            description,
            action,
        ))

    return specs


# ---------------------------------------------------------------------------
# Upsert / resolve helpers
# ---------------------------------------------------------------------------

def _upsert_alert(
    case: CaseIntakeProcess,
    alert_type: str,
    severity: str,
    title: str,
    description: str,
    recommended_action: str,
) -> OperationalAlert:
    """Create or update the unresolved alert for (case, alert_type)."""
    existing = (
        OperationalAlert.objects
        .filter(case=case, alert_type=alert_type, resolved_at__isnull=True)
        .first()
    )
    if existing:
        existing.severity = severity
        existing.title = title
        existing.description = description
        existing.recommended_action = recommended_action
        existing.save(update_fields=['severity', 'title', 'description', 'recommended_action'])
        return existing

    return OperationalAlert.objects.create(
        case=case,
        alert_type=alert_type,
        severity=severity,
        title=title,
        description=description,
        recommended_action=recommended_action,
    )


def _resolve_stale_alerts(case: CaseIntakeProcess, active_types: set) -> int:
    """Resolve unresolved alerts whose condition no longer applies.

    Returns the count of alerts resolved.
    """
    stale_qs = OperationalAlert.objects.filter(
        case=case,
        resolved_at__isnull=True,
    ).exclude(alert_type__in=active_types)

    count = stale_qs.count()
    if count:
        stale_qs.update(resolved_at=timezone.now())
    return count


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_alerts_for_case(intake: CaseIntakeProcess) -> List[OperationalAlert]:
    """Generate operational alerts for *intake* based on case evaluation output.

    This is the primary entry point.  Call it after any ``evaluate_case_intelligence``
    run for a case.

    Returns the list of currently active (unresolved) alerts for the case.
    """
    case_data = _build_case_data_for_alert(intake)
    intelligence = evaluate_case_intelligence(case_data)

    specs = _evaluate_alert_specs(intake, intelligence)
    active_types = {spec[0] for spec in specs}

    # Resolve alerts that no longer apply
    _resolve_stale_alerts(intake, active_types)

    # Upsert active alerts
    alerts = []
    for alert_type, severity, title, description, recommended_action in specs:
        alert = _upsert_alert(
            case=intake,
            alert_type=alert_type,
            severity=severity,
            title=title,
            description=description,
            recommended_action=recommended_action,
        )
        alerts.append(alert)

    return alerts


def build_regiekamer_summary(organization) -> Dict[str, Any]:
    """Compute summary card counts for the Regiekamer dashboard.

    Returns a dict with counts grouped by alert category for the four
    summary cards required by the Regiekamer spec.
    """
    base_qs = OperationalAlert.objects.filter(
        case__organization=organization,
        resolved_at__isnull=True,
    )

    urgent_unmatched = base_qs.filter(
        alert_type=_URGENT_UNMATCHED,
    ).count()

    stalled_placements = base_qs.filter(
        alert_type=_PLACEMENT_STALLED,
    ).count()

    capacity_risk = base_qs.filter(
        alert_type=_CAPACITY_RISK,
    ).count()

    missing_data = base_qs.filter(
        alert_type=_MISSING_CRITICAL_DATA,
    ).count()

    total_high = base_qs.filter(severity=_HIGH).count()
    total = base_qs.count()

    return {
        'urgent_unmatched': urgent_unmatched,
        'stalled_placements': stalled_placements,
        'capacity_risk': capacity_risk,
        'missing_data': missing_data,
        'total_high': total_high,
        'total': total,
    }
