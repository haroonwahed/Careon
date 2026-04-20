"""Regiekamer Alert Engine

Derives operational alerts from OperationalDecisionBuilder output so that
all alert logic shares the same centralized decision source used by live
case pages and simulation runs.

Public API
----------
- ``generate_alerts_for_intake(intake)`` → list[RegiekamerAlert]
  Upserts one open alert per applicable rule.  Resolves alerts that are
  no longer triggered.

- ``resolve_stale_alerts_for_intake(intake, active_types)`` → int
  Marks open alerts not in *active_types* as auto-resolved.

- ``generate_alerts_for_organization(org_id)`` → dict
  Batch upsert / auto-resolve across all active cases in an org.
  Returns a summary dict.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone
from django.utils.timezone import make_aware

from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    CareSignal,
    PlacementRequest,
    RegiekamerAlert,
    SimulatedCaseResult,
)

logger = logging.getLogger(__name__)
from contracts.operational_decision_contract import (
    AttentionBandLevel,
    BottleneckState,
    OperationalDecisionBuilder,
    build_operational_decisions_for_organization,
)


# ---------------------------------------------------------------------------
# Alert rule definitions
# ---------------------------------------------------------------------------

_AT = RegiekamerAlert.AlertType
_SEV = RegiekamerAlert.Severity

# V3 legacy alias mapping: old engine type → V3 native type.
# Used in _auto_resolve_stale so legacy DB rows are treated as equivalent
# to their V3 successors when computing which types are still active.
_LEGACY_ALIAS_MAP = {
    _AT.INCOMPLETE_BEOORDELING: _AT.MISSING_SUMMARY,
    _AT.WEAK_MATCH: _AT.WEAK_MATCH_VERIFICATION,
}

_SEVERITY_ORDER = [_SEV.CRITICAL, _SEV.HIGH, _SEV.MEDIUM, _SEV.LOW]


def _severity_for_urgency(urgency: str) -> str:
    return {
        CaseIntakeProcess.Urgency.CRISIS: _SEV.CRITICAL,
        CaseIntakeProcess.Urgency.HIGH: _SEV.HIGH,
        CaseIntakeProcess.Urgency.MEDIUM: _SEV.MEDIUM,
        CaseIntakeProcess.Urgency.LOW: _SEV.LOW,
    }.get(urgency, _SEV.MEDIUM)


def _evaluate_rules(intake: CaseIntakeProcess) -> list[dict]:
    """Return a list of alert dicts for rules that currently fire for *intake*.

    Each dict contains the fields needed to upsert a ``RegiekamerAlert``.
    No DB writes happen here — this is pure evaluation.

    All emitted alert_type values are V3-native.  Legacy aliases
    (incomplete_beoordeling, weak_match_needs_review) are no longer emitted;
    the alias mapping in views.py handles any legacy DB rows during transition.
    """
    from contracts.operational_decision_contract import OperationalDecisionBuilder

    # Gather related objects once
    assessment: CaseAssessment | None = getattr(intake, 'case_assessment', None)
    placement: PlacementRequest | None = (
        intake.indications.order_by('-updated_at').first()
        if hasattr(intake, 'indications')
        else None
    )
    open_signals = list(
        CareSignal.objects.filter(
            due_diligence_process=intake,
            status__in=[CareSignal.SignalStatus.OPEN, CareSignal.SignalStatus.IN_PROGRESS],
        ).values('signal_type', 'risk_level')
    )

    S = CaseIntakeProcess.ProcessStatus
    PR = PlacementRequest.ProviderResponseStatus
    active = []

    # ── Rule 1: urgent_unmatched_case ─────────────────────────────────────
    # A HIGH/CRISIS case is in INTAKE or MATCHING without a selected provider.
    if (
        intake.urgency in (CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS)
        and intake.status in (S.INTAKE, S.MATCHING, S.DECISION)
        and (placement is None or not placement.selected_provider_id)
    ):
        sev = _severity_for_urgency(intake.urgency)
        active.append({
            'alert_type': _AT.URGENT_UNMATCHED,
            'severity': sev,
            'title': f'Urgente casus zonder aanbieder: {intake.title}',
            'description': (
                f'Urgentie {intake.get_urgency_display()} – geen aanbieder geselecteerd. '
                f'Casus bevindt zich in fase {intake.get_status_display()}.'
            ),
            'recommended_action': 'Open matching en selecteer een passende aanbieder.',
            'source_phase': intake.status,
            'placement': placement,
        })

    # ── Rule 2: missing_critical_data ─────────────────────────────────────
    # Intake has no assessment_summary AND no preferred_region.
    missing_summary_text = not (intake.assessment_summary or '').strip()
    missing_region = not intake.preferred_region_id and not intake.gemeente_id
    missing_age = not intake.client_age_category
    missing_count = sum([missing_summary_text, missing_region, missing_age])
    if missing_count >= 2:
        active.append({
            'alert_type': _AT.MISSING_CRITICAL_DATA,
            'severity': _SEV.HIGH,
            'title': f'Kritieke gegevens ontbreken: {intake.title}',
            'description': (
                'De volgende gegevens ontbreken: '
                + ', '.join(filter(None, [
                    'intakesamenvatting' if missing_summary_text else '',
                    'regio' if missing_region else '',
                    'leeftijdscategorie' if missing_age else '',
                ]))
                + '. Matching kan pas starten als de intake compleet is.'
            ),
            'recommended_action': 'Vul de ontbrekende intakegegevens aan via de casuspagina.',
            'source_phase': intake.status,
            'placement': None,
        })
    elif missing_count == 1 and missing_summary_text:
        # Only the summary is missing — V3 uses a dedicated type for this
        active.append({
            'alert_type': _AT.MISSING_SUMMARY,
            'severity': _SEV.MEDIUM,
            'title': f'Samenvatting ontbreekt: {intake.title}',
            'description': (
                'De intakesamenvatting ontbreekt. Een heldere samenvatting is nodig '
                'voor betrouwbare matching.'
            ),
            'recommended_action': 'Vul de intakesamenvatting aan via de casuspagina.',
            'source_phase': intake.status,
            'placement': None,
        })

    # ── Rule 3: missing_summary (V3 – replaces incomplete_beoordeling) ────
    # Case is in MATCHING or beyond but assessment is not matching-ready.
    # This is distinct from missing_critical_data: data is present but incomplete.
    if intake.status in (S.MATCHING, S.DECISION):
        if assessment is None or not assessment.matching_ready:
            # Only emit if not already covered by missing_critical_data above
            already_covered = any(r['alert_type'] == _AT.MISSING_CRITICAL_DATA for r in active)
            if not already_covered:
                active.append({
                    'alert_type': _AT.MISSING_SUMMARY,
                    'severity': _SEV.MEDIUM,
                    'title': f'Samenvatting niet matching-klaar: {intake.title}',
                    'description': (
                        'Casus is doorgeleid naar matching maar de samenvatting is nog niet '
                        'volledig voor matching-gebruik. '
                        + (assessment.reason_not_ready if assessment and assessment.reason_not_ready else '')
                    ),
                    'recommended_action': (
                        'Vul de samenvatting aan en markeer als gereed voor matching.'
                    ),
                    'source_phase': intake.status,
                    'placement': None,
                })

    # ── Rule 4: provider_rejected_case (V3-new) ────────────────────────────
    # Provider has explicitly rejected the case.
    if placement and placement.provider_response_status == PR.REJECTED:
        # Count prior open provider_rejected alerts for this case to track attempts
        prior_rejections = RegiekamerAlert.objects.filter(
            case=intake,
            alert_type=_AT.PROVIDER_REJECTED,
        ).count()
        rejection_count = prior_rejections + 1
        sev = _SEV.CRITICAL if rejection_count >= 2 else _severity_for_urgency(intake.urgency)
        active.append({
            'alert_type': _AT.PROVIDER_REJECTED,
            'severity': sev,
            'title': f'Casus afgewezen door aanbieder: {intake.title}',
            'description': (
                f'Aanbieder "{getattr(placement.proposed_provider, "name", "onbekend")}" '
                f'heeft de casus afgewezen. '
                f'Poging {rejection_count}.'
                + (' Herhaalde afwijzing – prioriteit verhoogd.' if rejection_count >= 2 else '')
            ),
            'recommended_action': (
                'Herstart matching en selecteer een alternatieve aanbieder. '
                'Leg de afwijzingsreden vast voor rapportage.'
            ),
            'source_phase': intake.status,
            'placement': placement,
            'rejection_count': rejection_count,
        })

    # ── Rule 5: provider_review_pending (V3-new) ───────────────────────────
    # Placement is PENDING (within SLA window — not yet stalled).
    elif placement and placement.provider_response_status == PR.PENDING:
        ref = (
            placement.provider_response_last_reminder_at
            or placement.provider_response_requested_at
            or placement.updated_at
        )
        if ref is not None:
            now_ts = timezone.now()
            if not timezone.is_aware(ref):
                logger.warning(
                    'Naive datetime encountered for placement pk=%s '
                    '(checked fields: provider_response_last_reminder_at, '
                    'provider_response_requested_at, updated_at); '
                    'this should not happen when USE_TZ=True. Converting to UTC.',
                    getattr(placement, 'pk', '?'),
                )
                ref = make_aware(ref)
            hours_waiting = max(0, (now_ts - ref).total_seconds() / 3600)
            if hours_waiting < 72:
                # Within SLA — emit provider_review_pending, not placement_stalled
                active.append({
                    'alert_type': _AT.PROVIDER_REVIEW_PENDING,
                    'severity': _SEV.MEDIUM,
                    'title': f'Aanbieder beoordeling wacht: {intake.title}',
                    'description': (
                        f'Aanbieder "{getattr(placement.proposed_provider, "name", "onbekend")}" '
                        f'heeft {int(hours_waiting)} uur niet gereageerd op plaatsingsverzoek.'
                    ),
                    'recommended_action': (
                        'Controleer of de aanbieder het verzoek heeft ontvangen. '
                        'Stuur een herinnering indien nodig.'
                    ),
                    'source_phase': intake.status,
                    'placement': placement,
                })

    # ── Rule 6: weak_match_needs_verification (V3 – replaces weak_match_needs_review) ──
    # Placement exists but no_capacity or waitlist + urgency HIGH/CRISIS.
    if placement and placement.provider_response_status in (PR.NO_CAPACITY, PR.WAITLIST):
        sev = (
            _SEV.CRITICAL
            if intake.urgency == CaseIntakeProcess.Urgency.CRISIS
            else _SEV.HIGH
        )
        active.append({
            'alert_type': _AT.WEAK_MATCH_VERIFICATION,
            'severity': sev,
            'title': f'Zwakke match – verificatie vereist: {intake.title}',
            'description': (
                f'Aanbieder "{getattr(placement.proposed_provider, "name", "onbekend")}" '
                f'heeft geen capaciteit of staat op wachtlijst. '
                f'Urgentie: {intake.get_urgency_display()}.'
            ),
            'recommended_action': 'Verifieer de match en selecteer een aanbieder met capaciteit.',
            'source_phase': intake.status,
            'placement': placement,
        })

    # ── Rule 7: no_capacity_available ─────────────────────────────────────
    no_cap_signal = any(
        s['signal_type'] == CareSignal.SignalType.CAPACITY_ISSUE for s in open_signals
    )
    no_cap_response = (
        placement is not None
        and placement.provider_response_status == PR.NO_CAPACITY
    )
    if no_cap_signal or no_cap_response:
        active.append({
            'alert_type': _AT.NO_CAPACITY,
            'severity': _severity_for_urgency(intake.urgency),
            'title': f'Geen capaciteit beschikbaar: {intake.title}',
            'description': (
                'Er is geen beschikbare capaciteit bij de geselecteerde aanbieder. '
                'Controleer het capaciteitsoverzicht en overweeg een alternatieve aanbieder.'
            ),
            'recommended_action': (
                'Controleer wachttijden en capaciteit. Selecteer een alternatieve aanbieder.'
            ),
            'source_phase': intake.status,
            'placement': placement,
        })

    # ── Rule 8: placement_stalled ─────────────────────────────────────────
    # Placement exists with PENDING response and no update for > 72 hours.
    if placement and placement.provider_response_status == PR.PENDING:
        ref = (
            placement.provider_response_last_reminder_at
            or placement.provider_response_requested_at
            or placement.updated_at
        )
        if ref is not None:
            now_ts = timezone.now()
            if not timezone.is_aware(ref):
                logger.warning(
                    'Naive datetime encountered for placement pk=%s '
                    '(checked fields: provider_response_last_reminder_at, '
                    'provider_response_requested_at, updated_at); '
                    'this should not happen when USE_TZ=True. Converting to UTC.',
                    getattr(placement, 'pk', '?'),
                )
                ref = make_aware(ref)
            hours_waiting = max(0, (now_ts - ref).total_seconds() / 3600)
            if hours_waiting >= 72:
                active.append({
                    'alert_type': _AT.PLACEMENT_STALLED,
                    'severity': _severity_for_urgency(intake.urgency),
                    'title': f'Plaatsing vastgelopen: {intake.title}',
                    'description': (
                        f'Geen reactie van aanbieder na {int(hours_waiting)} uur. '
                        f'Aanbieder: "{getattr(placement.proposed_provider, "name", "onbekend")}".'
                    ),
                    'recommended_action': (
                        'Stuur een herinnering of heroverweeg de plaatsing '
                        'via de casuspagina → Plaatsing.'
                    ),
                    'source_phase': intake.status,
                    'placement': placement,
                })

    # ── Rule 9: intake_not_started (V3-new) ───────────────────────────────
    # Provider accepted but intake process has not been started within 5 days.
    if placement and placement.provider_response_status == PR.ACCEPTED:
        ref = (
            placement.provider_response_recorded_at
            if hasattr(placement, 'provider_response_recorded_at')
            else placement.updated_at
        )
        if ref is not None:
            now_ts = timezone.now()
            if not timezone.is_aware(ref):
                ref = make_aware(ref)
            days_since_acceptance = max(0, (now_ts - ref).total_seconds() / 86400)
            if days_since_acceptance >= 5:
                active.append({
                    'alert_type': _AT.INTAKE_NOT_STARTED,
                    'severity': _SEV.LOW,
                    'title': f'Intake nog niet gestart: {intake.title}',
                    'description': (
                        f'Aanbieder heeft geaccepteerd maar de intake is na '
                        f'{int(days_since_acceptance)} dagen nog niet gestart.'
                    ),
                    'recommended_action': (
                        'Neem contact op met de aanbieder om een intakedatum te plannen.'
                    ),
                    'source_phase': intake.status,
                    'placement': placement,
                })

    return active


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------

def _upsert_alert(intake: CaseIntakeProcess, org_id: int, alert_data: dict) -> RegiekamerAlert:
    """Create or update a single open alert for *intake*.

    Idempotent: updates existing open alert rather than creating duplicates.
    Persists V3 evidence fields (evidence_data, rejection_count, rejection_reason_code)
    when present in alert_data.
    """
    placement = alert_data.pop('placement', None)
    rejection_count = alert_data.pop('rejection_count', 0)
    rejection_reason_code = alert_data.pop('rejection_reason_code', '')
    evidence_data = alert_data.pop('evidence_data', None)
    defaults = {
        'organization_id': org_id,
        'severity': alert_data['severity'],
        'title': alert_data['title'],
        'description': alert_data.get('description', ''),
        'recommended_action': alert_data.get('recommended_action', ''),
        'source_phase': alert_data.get('source_phase', ''),
        'placement': placement,
        'is_resolved': False,
        'resolved_at': None,
        'resolved_by': None,
        'auto_resolved': False,
        'rejection_count': rejection_count,
        'rejection_reason_code': rejection_reason_code,
    }
    if evidence_data is not None:
        defaults['evidence_data'] = evidence_data
    alert, _ = RegiekamerAlert.objects.update_or_create(
        case=intake,
        alert_type=alert_data['alert_type'],
        is_resolved=False,
        defaults=defaults,
    )
    return alert


def _auto_resolve_stale(
    intake: CaseIntakeProcess,
    active_types: set[str],
) -> int:
    """Auto-resolve open alerts that no longer match any active rule.

    Legacy DB rows (incomplete_beoordeling, weak_match_needs_review) are treated
    as equivalent to their V3 successors so they are not incorrectly auto-resolved
    when the engine now emits the V3 type.

    Returns the number of alerts resolved.
    """
    # Expand active_types to include legacy aliases that map to an active V3 type
    effective_active: set[str] = set(active_types)
    for legacy_type, v3_type in _LEGACY_ALIAS_MAP.items():
        if v3_type in active_types:
            effective_active.add(legacy_type)

    stale = RegiekamerAlert.objects.filter(
        case=intake,
        is_resolved=False,
    ).exclude(alert_type__in=effective_active)
    count = stale.count()
    stale.update(
        is_resolved=True,
        auto_resolved=True,
        resolved_at=timezone.now(),
    )
    return count


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@transaction.atomic
def generate_alerts_for_intake(
    intake: CaseIntakeProcess,
    org_id: int | None = None,
) -> list[RegiekamerAlert]:
    """Upsert alerts for a single intake, auto-resolve stale ones.

    Args:
        intake: CaseIntakeProcess instance (related data should be prefetched).
        org_id: Override organization ID (defaults to intake.organization_id).

    Returns:
        List of active (non-resolved) alerts after the run.
    """
    effective_org_id = org_id or intake.organization_id
    if not effective_org_id:
        return []

    rule_results = _evaluate_rules(intake)
    active_types = {r['alert_type'] for r in rule_results}

    # Upsert active alerts
    for alert_data in rule_results:
        _upsert_alert(intake, effective_org_id, dict(alert_data))

    # Auto-resolve stale
    _auto_resolve_stale(intake, active_types)

    return list(
        RegiekamerAlert.objects.filter(case=intake, is_resolved=False)
        .order_by('-severity', 'created_at')
    )


def generate_alerts_for_organization(org_id: int) -> dict:
    """Batch-generate/resolve alerts for all active cases in an organization.

    Returns a summary dict with counts per alert type and severity.
    """
    intakes = (
        CaseIntakeProcess.objects
        .filter(
            organization_id=org_id,
            status__in=[
                CaseIntakeProcess.ProcessStatus.INTAKE,
                CaseIntakeProcess.ProcessStatus.MATCHING,
                CaseIntakeProcess.ProcessStatus.DECISION,
                CaseIntakeProcess.ProcessStatus.ON_HOLD,
            ],
        )
        .select_related('case_assessment', 'care_category_main', 'preferred_region')
        .prefetch_related('indications', 'signals')
    )

    total_alerts = 0
    resolved_alerts = 0
    by_type: dict[str, int] = {}

    for intake in intakes:
        try:
            active = generate_alerts_for_intake(intake, org_id=org_id)
            total_alerts += len(active)
            for alert in active:
                by_type[alert.alert_type] = by_type.get(alert.alert_type, 0) + 1
        except Exception:
            logger.exception('Alert generation failed for intake pk=%s', intake.pk)

    return {
        'org_id': org_id,
        'total_active_alerts': total_alerts,
        'by_type': by_type,
    }


def resolve_alert_manually(
    alert_id: int,
    resolved_by_user,
) -> RegiekamerAlert | None:
    """Manually resolve an alert by ID.

    Returns the resolved alert, or None if not found.
    """
    try:
        alert = RegiekamerAlert.objects.get(pk=alert_id, is_resolved=False)
    except RegiekamerAlert.DoesNotExist:
        return None
    alert.is_resolved = True
    alert.resolved_at = timezone.now()
    alert.resolved_by = resolved_by_user
    alert.auto_resolved = False
    alert.save(update_fields=['is_resolved', 'resolved_at', 'resolved_by', 'auto_resolved', 'updated_at'])
    return alert
