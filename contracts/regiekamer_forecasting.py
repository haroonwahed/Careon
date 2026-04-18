"""
Regiekamer Forecasting Layer
============================

Deterministic predictive intelligence for the Regiekamer dashboard.
No machine learning — all rules are explicit, explainable, and tunable.

Answers four operational questions:
  1. What is wrong right now?          → handled by regiekamer_service
  2. What is likely to go wrong next?  → forecast_signals
  3. What should the user do first?    → per_case_forecast[pk].next_best_action
  4. What does that action unlock?     → action_impact_summary

Design contract
---------------
- No request objects. No HTTP concerns.
- All DB queries happen only in build_predictive_summary (public API).
- Helper functions (_detect_*, _score_*, _build_*) are pure — they receive
  pre-loaded data and perform no additional queries.
- Every Dutch string is plain and explainable; no "AI predicts" language.
- Fallback-safe: all functions return empty lists / "none" on missing data.

Template contract (additive — nothing existing is removed)
----------------------------------------------------------
New keys produced:
    forecast_signals           – list of 0–6 predictive signal dicts
    sla_risk_cases             – top-5 cases most likely to breach SLA
    projected_bottleneck_stage – where flow will likely clog next
    action_impact_summary      – one-line impact statement for top action
    predictive_strips          – 1–2 UI-ready strips for the template
    per_case_forecast          – dict[pk → risk_score/band/reasons] (internal; not
                                  directly rendered but merged into priority_queue rows
                                  by regiekamer_service)

Tunable constants
-----------------
All thresholds and score weights are module-level constants — easy to
adjust without touching business logic.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from django.urls import reverse

from .models import (
    CareSignal,
    CaseAssessment,
    CaseIntakeProcess,
    PlacementRequest,
)

# ---------------------------------------------------------------------------
# Tunable thresholds
# ---------------------------------------------------------------------------

SLA_NEAR_BREACH_DAYS: int = 3
"""Flag a case when target_completion_date is within this many days."""

STALE_DAYS: int = 5
"""Case updated_at older than this → inactivity flag."""

ASSESSMENT_STALE_DAYS: int = 4
"""Assessment not updated for this many days and still incomplete → delay risk."""

RESPONSE_DEADLINE_WARNING_DAYS: int = 2
"""Provider response deadline within this many days → stall risk."""

DELAY_RISK_INACTIVITY_DAYS: int = 3
"""Min inactivity days before flagging assessment_delay_risk (without other triggers)."""

CAPACITY_PRESSURE_REGION_THRESHOLD: int = 3
"""Matching-stage cases in the same region >= this → capacity pressure."""

# ---------------------------------------------------------------------------
# Risk score weights — transparent component scoring
# ---------------------------------------------------------------------------

SCORE_CRISIS_URGENCY: int = 40
SCORE_HIGH_URGENCY: int = 25
SCORE_MEDIUM_URGENCY: int = 10
SCORE_OVERDUE_TARGET: int = 25
SCORE_NEAR_TARGET_3D: int = 15
SCORE_NO_MATCH: int = 20
SCORE_NO_ASSESSMENT: int = 15
SCORE_NEEDS_INFO: int = 12
SCORE_ESCALATION_SIGNAL: int = 20
SCORE_DROPOUT_RISK_SIGNAL: int = 15
SCORE_PROVIDER_NO_CAPACITY: int = 15
SCORE_PLACEMENT_AT_RISK: int = 12
SCORE_STALE_CASE: int = 8
SCORE_RESPONSE_DEADLINE: int = 10

# Risk band thresholds (applied after clamping score to 0–100)
BAND_CRITICAL: int = 75
BAND_HIGH: int = 50
BAND_MEDIUM: int = 25

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _days_since(dt: Any, today: date) -> int:
    """Return how many days ago dt was. Zero if None or in the future."""
    if dt is None:
        return 0
    # date objects don't have a callable .date(); datetime and datetime-like
    # objects (DateTimeField values, MagicMocks) do.
    if isinstance(dt, datetime):
        d = dt.date()
    elif isinstance(dt, date):
        d = dt
    elif hasattr(dt, "date") and callable(getattr(dt, "date")):
        d = dt.date()
    else:
        return 0
    return max((today - d).days, 0)


def _days_to(dt: Any, today: date) -> int | None:
    """Return days until dt (negative if overdue). None if dt is None."""
    if dt is None:
        return None
    if isinstance(dt, datetime):
        d = dt.date()
    elif isinstance(dt, date):
        d = dt
    elif hasattr(dt, "date") and callable(getattr(dt, "date")):
        d = dt.date()
    else:
        return None
    return (d - today).days


def _band(score: int) -> str:
    if score >= BAND_CRITICAL:
        return "critical"
    if score >= BAND_HIGH:
        return "high"
    if score >= BAND_MEDIUM:
        return "medium"
    return "low"


def _stage_href(stage: str) -> str:
    _map = {
        "beoordelingen": reverse("careon:assessment_list"),
        "matching": reverse("careon:matching_dashboard"),
        "plaatsingen": reverse("careon:placement_list"),
        "casussen": reverse("careon:case_list"),
    }
    return _map.get(stage, reverse("careon:case_list"))


# ---------------------------------------------------------------------------
# Next best action — per-case, impact-aware
# ---------------------------------------------------------------------------


def _scored_next_action(
    intake: Any,
    assessment: Any,
    placement: Any,
    risk_score: int,
) -> dict[str, str]:
    """
    Return the highest-value next action for a case, with projected impact.

    Candidate actions are evaluated by downstream flow unlock potential.
    The action that unblocks the most critical downstream step is selected.
    """
    S = CaseIntakeProcess.ProcessStatus
    AS = CaseAssessment.AssessmentStatus
    PR = PlacementRequest

    if intake.status == S.INTAKE:
        return {
            "label": "Vul intakegegevens aan",
            "href": reverse("careon:case_detail", args=[intake.pk]),
            "impact": "Ontgrendelt beoordeling en latere matching",
        }

    if intake.status == S.ASSESSMENT:
        if assessment and assessment.assessment_status == AS.NEEDS_INFO:
            return {
                "label": "Vul ontbrekende beoordelingsgegevens aan",
                "href": reverse("careon:assessment_update", args=[assessment.pk]),
                "impact": "Rondt beoordeling af en maakt matching mogelijk",
            }
        if assessment:
            return {
                "label": "Rond beoordeling af",
                "href": reverse("careon:assessment_update", args=[assessment.pk]),
                "impact": "Maakt matching mogelijk en ontgrendelt doorstroom",
            }
        return {
            "label": "Start beoordeling",
            "href": reverse("careon:assessment_create") + f"?intake={intake.pk}",
            "impact": "Eerste stap naar matching en plaatsing",
        }

    if intake.status in (S.MATCHING, S.DECISION):
        if placement is None:
            return {
                "label": "Start matching",
                "href": reverse("careon:matching_dashboard") + f"?intake={intake.pk}",
                "impact": "Zoekt beschikbare aanbieder voor dit dossier",
            }
        resp = getattr(placement, "provider_response_status", None)
        if resp in (
            PR.ProviderResponseStatus.NO_CAPACITY,
            PR.ProviderResponseStatus.WAITLIST,
        ):
            return {
                "label": "Heroverweeg zoekcriteria of verbreed regio",
                "href": reverse("careon:matching_dashboard") + f"?intake={intake.pk}",
                "impact": "Vergroot kans op plaatsing door alternatief te verkennen",
            }
        if resp == PR.ProviderResponseStatus.REJECTED:
            return {
                "label": "Start nieuwe matching",
                "href": reverse("careon:matching_dashboard") + f"?intake={intake.pk}",
                "impact": "Nieuwe kans op plaatsing na afwijzing",
            }
        if resp == PR.ProviderResponseStatus.PENDING:
            return {
                "label": "Herinner aanbieder aan openstaande reactie",
                "href": reverse("careon:placement_list"),
                "impact": "Verkort doorlooptijd en voorkomt deadline-overschrijding",
            }
        pqs = getattr(placement, "placement_quality_status", None)
        if pqs in (
            PR.PlacementQualityStatus.AT_RISK,
            PR.PlacementQualityStatus.BROKEN_DOWN,
        ):
            return {
                "label": "Controleer plaatsingskwaliteit",
                "href": reverse("careon:placement_list"),
                "impact": "Voorkomt uitval uit het zorgtraject",
            }
        return {
            "label": "Controleer plaatsingsstatus",
            "href": reverse("careon:placement_list"),
            "impact": "Bevestigt of verdere actie nodig is",
        }

    if intake.status == S.ON_HOLD:
        if risk_score >= BAND_HIGH:
            return {
                "label": "Escaleer naar regiocoördinator",
                "href": reverse("careon:case_signal_create", args=[intake.pk]),
                "impact": "Vergroot kans op plaatsing binnen 48 uur",
            }
        return {
            "label": "Verwijder blokkade",
            "href": reverse("careon:case_detail", args=[intake.pk]),
            "impact": "Herstelt doorstroom voor dit dossier",
        }

    return {
        "label": "Monitor voortgang",
        "href": reverse("careon:case_detail", args=[intake.pk]),
        "impact": "Houdt dossier actueel",
    }


# ---------------------------------------------------------------------------
# Per-case risk scoring
# ---------------------------------------------------------------------------


def _score_single_case(
    intake: Any,
    assessment: Any,
    placement: Any,
    open_signals: list[Any],
    today: date,
) -> dict[str, Any]:
    """
    Compute an explainable operational risk score (0–100) for a single case.

    Scoring factors (weights above):
      urgency × SCORE_CRISIS/HIGH/MEDIUM
      + overdue / near target_completion_date
      + assessment state (missing / NEEDS_INFO / blocking matching)
      + no provider match found
      + provider response issues (NO_CAPACITY / WAITLIST / deadline)
      + placement quality at risk
      + open ESCALATION / DROPOUT_RISK signals
      + case inactivity (stale_days)

    Returns a dict with risk_score, risk_band, top_reasons, and scored action.
    """
    S = CaseIntakeProcess.ProcessStatus
    AS = CaseAssessment.AssessmentStatus
    PR = PlacementRequest
    CS = CareSignal

    score = 0
    reasons: list[str] = []

    # --- Urgency ---
    if intake.urgency == CaseIntakeProcess.Urgency.CRISIS:
        score += SCORE_CRISIS_URGENCY
        reasons.append("Urgentie is crisis — directe actie vereist")
    elif intake.urgency == CaseIntakeProcess.Urgency.HIGH:
        score += SCORE_HIGH_URGENCY
        reasons.append("Urgentie is hoog")
    elif intake.urgency == CaseIntakeProcess.Urgency.MEDIUM:
        score += SCORE_MEDIUM_URGENCY

    # --- SLA / target date ---
    days_to_target = _days_to(intake.target_completion_date, today)
    if days_to_target is not None:
        if days_to_target < 0:
            score += SCORE_OVERDUE_TARGET
            n = abs(days_to_target)
            reasons.append(
                f"Streefdatum verstreken ({n} dag{'en' if n != 1 else ''} geleden)"
            )
        elif days_to_target <= SLA_NEAR_BREACH_DAYS:
            score += SCORE_NEAR_TARGET_3D
            reasons.append(
                f"Streefdatum binnen {days_to_target} dag{'en' if days_to_target != 1 else ''}"
            )

    # --- Assessment state ---
    if assessment is None:
        score += SCORE_NO_ASSESSMENT
        reasons.append("Beoordeling ontbreekt")
    elif assessment.assessment_status == AS.NEEDS_INFO:
        score += SCORE_NEEDS_INFO
        reasons.append("Beoordeling vereist aanvulling")
    elif assessment.assessment_status in (AS.DRAFT, AS.UNDER_REVIEW):
        if intake.status in (S.MATCHING, S.DECISION):
            score += SCORE_NO_ASSESSMENT
            reasons.append("Beoordeling is onvolledig en blokkeert matching")

    # --- Match availability ---
    if intake.status in (S.MATCHING, S.DECISION):
        no_provider = placement is None or not getattr(
            placement, "selected_provider_id", None
        )
        if no_provider:
            score += SCORE_NO_MATCH
            reasons.append("Geen passende aanbieder beschikbaar")

    # --- Provider response / placement quality ---
    if placement is not None:
        resp = getattr(placement, "provider_response_status", None)
        if resp in (
            PR.ProviderResponseStatus.NO_CAPACITY,
            PR.ProviderResponseStatus.WAITLIST,
        ):
            score += SCORE_PROVIDER_NO_CAPACITY
            reasons.append("Aanbieder heeft geen capaciteit of staat op wachtlijst")

        pqs = getattr(placement, "placement_quality_status", None)
        if pqs in (
            PR.PlacementQualityStatus.AT_RISK,
            PR.PlacementQualityStatus.BROKEN_DOWN,
        ):
            score += SCORE_PLACEMENT_AT_RISK
            reasons.append("Plaatsing loopt risico op uitval")

        deadline = getattr(placement, "provider_response_deadline_at", None)
        days_to_dl = _days_to(deadline, today)
        if days_to_dl is not None and 0 <= days_to_dl <= RESPONSE_DEADLINE_WARNING_DAYS:
            score += SCORE_RESPONSE_DEADLINE
            reasons.append(
                f"Reactiedeadline aanbieder over {days_to_dl} dag{'en' if days_to_dl != 1 else ''}"
            )

    # --- Signals ---
    escalation_added = False
    dropout_added = False
    for sig in open_signals:
        if not escalation_added and sig.signal_type == CS.SignalType.ESCALATION:
            score += SCORE_ESCALATION_SIGNAL
            reasons.append("Open escalatiesignaal")
            escalation_added = True
        if not dropout_added and sig.signal_type == CS.SignalType.DROPOUT_RISK:
            score += SCORE_DROPOUT_RISK_SIGNAL
            reasons.append("Risico op uitval uit traject")
            dropout_added = True

    # --- Stale case ---
    stale = _days_since(intake.updated_at, today)
    if stale >= STALE_DAYS and intake.status not in (S.COMPLETED,):
        score += SCORE_STALE_CASE
        reasons.append(f"Geen activiteit in {stale} dagen")

    score = min(100, max(0, score))
    band = _band(score)
    top_reasons = reasons[:4]
    action = _scored_next_action(intake, assessment, placement, score)

    return {
        "risk_score": score,
        "risk_band": band,
        "top_reasons": top_reasons,
        "next_best_action": action["label"],
        "next_best_action_href": action["href"],
        "projected_impact": action["impact"],
    }


# ---------------------------------------------------------------------------
# Forecast signal detectors — one per risk type
# ---------------------------------------------------------------------------


def _detect_assessment_delay_risk(
    active_intakes: list[Any],
    today: date,
) -> dict[str, Any] | None:
    """
    Flag when ASSESSMENT-phase cases have stale or incomplete assessments.

    Triggers:
      - assessment is None / DRAFT / UNDER_REVIEW / NEEDS_INFO
      - AND at least one of: inactivity >= DELAY_RISK_INACTIVITY_DAYS,
        urgency HIGH/CRISIS, or target_completion_date near/overdue
    """
    S = CaseIntakeProcess.ProcessStatus
    AS = CaseAssessment.AssessmentStatus

    affected_ids: list[int] = []
    worst_severity = "warning"

    for intake in active_intakes:
        if intake.status not in (S.ASSESSMENT, S.MATCHING, S.DECISION):
            continue
        assessment = getattr(intake, "case_assessment", None)
        is_incomplete = (
            assessment is None
            or assessment.assessment_status
            in (AS.DRAFT, AS.UNDER_REVIEW, AS.NEEDS_INFO)
        )
        if not is_incomplete:
            continue

        inactivity = _days_since(intake.updated_at, today)
        dtt = _days_to(intake.target_completion_date, today)
        near_target = dtt is not None and 0 <= dtt <= SLA_NEAR_BREACH_DAYS
        target_passed = dtt is not None and dtt < 0
        is_urgent = intake.urgency in (
            CaseIntakeProcess.Urgency.HIGH,
            CaseIntakeProcess.Urgency.CRISIS,
        )

        if (
            inactivity < DELAY_RISK_INACTIVITY_DAYS
            and not is_urgent
            and not near_target
            and not target_passed
        ):
            continue

        affected_ids.append(intake.pk)
        if is_urgent or target_passed:
            worst_severity = "critical"
        elif (near_target or inactivity >= STALE_DAYS) and worst_severity != "critical":
            worst_severity = "high"

    if not affected_ids:
        return None

    count = len(affected_ids)
    return {
        "key": "assessment_delay_risk",
        "severity": worst_severity,
        "label": f"Beoordelingsvertraging dreigt bij {count} casus{'sen' if count > 1 else ''}",
        "reason": "Beoordeling is onvolledig en blokkeert matching als dit niet wordt opgelost",
        "affected_case_count": count,
        "affected_case_ids": affected_ids,
        "recommended_action": "Rond openstaande beoordelingen af",
        "target_url": reverse("careon:assessment_list"),
    }


def _detect_match_failure_risk(
    active_intakes: list[Any],
    placement_by_intake: dict[int, Any],
    signals_by_intake: dict[int, list[Any]],
    today: date,
) -> dict[str, Any] | None:
    """
    Flag when MATCHING/DECISION-phase cases have no viable provider path.

    Triggers:
      - no selected_provider, OR
      - open NO_MATCH signal, OR
      - provider response is REJECTED / NO_CAPACITY / WAITLIST
    """
    S = CaseIntakeProcess.ProcessStatus
    CS = CareSignal
    PR = PlacementRequest

    affected_ids: list[int] = []
    worst_severity = "warning"

    for intake in active_intakes:
        if intake.status not in (S.MATCHING, S.DECISION):
            continue

        placement = placement_by_intake.get(intake.pk)
        open_signals = signals_by_intake.get(intake.pk, [])

        no_provider = placement is None or not getattr(
            placement, "selected_provider_id", None
        )
        has_no_match_signal = any(
            s.signal_type == CS.SignalType.NO_MATCH
            and s.status in (CS.SignalStatus.OPEN, CS.SignalStatus.IN_PROGRESS)
            for s in open_signals
        )
        bad_response = placement is not None and getattr(
            placement, "provider_response_status", None
        ) in (
            PR.ProviderResponseStatus.REJECTED,
            PR.ProviderResponseStatus.NO_CAPACITY,
            PR.ProviderResponseStatus.WAITLIST,
        )

        if not (no_provider or has_no_match_signal or bad_response):
            continue

        affected_ids.append(intake.pk)
        if intake.urgency in (
            CaseIntakeProcess.Urgency.HIGH,
            CaseIntakeProcess.Urgency.CRISIS,
        ):
            worst_severity = "critical"
        elif bad_response and worst_severity != "critical":
            worst_severity = "high"

    if not affected_ids:
        return None

    count = len(affected_ids)
    return {
        "key": "match_failure_risk",
        "severity": worst_severity,
        "label": (
            f"{count} casus{'sen' if count > 1 else ''} "
            f"{'lopen' if count > 1 else 'loopt'} risico op mislukte matching"
        ),
        "reason": (
            "Geen beschikbare aanbieder of reactie is afwijzing / wachtlijst"
        ),
        "affected_case_count": count,
        "affected_case_ids": affected_ids,
        "recommended_action": (
            "Controleer aanbiederbeschikbaarheid of verbreed zoekcriteria"
        ),
        "target_url": reverse("careon:matching_dashboard"),
    }


def _detect_sla_breach_risk(
    active_intakes: list[Any],
    today: date,
) -> dict[str, Any] | None:
    """
    Flag when cases are near or over their target_completion_date.

    Only cases with a target set are evaluated.
    """
    affected_ids: list[int] = []
    worst_severity = "warning"

    for intake in active_intakes:
        dtt = _days_to(intake.target_completion_date, today)
        if dtt is None or dtt > SLA_NEAR_BREACH_DAYS:
            continue
        affected_ids.append(intake.pk)
        if dtt < 0:
            worst_severity = "critical"
        elif dtt <= 1 and worst_severity != "critical":
            worst_severity = "high"

    if not affected_ids:
        return None

    count = len(affected_ids)
    overdue_count = sum(
        1
        for intake in active_intakes
        if intake.pk in affected_ids
        and _days_to(intake.target_completion_date, today) is not None
        and _days_to(intake.target_completion_date, today) < 0
    )
    label = (
        f"{overdue_count} casus{'sen' if overdue_count > 1 else ''} overschrijdt de wachttijdnorm"
        if overdue_count
        else f"{count} casus{'sen' if count > 1 else ''} nadert de wachttijdnorm"
    )
    return {
        "key": "sla_breach_risk",
        "severity": worst_severity,
        "label": label,
        "reason": f"Streefdatum binnen {SLA_NEAR_BREACH_DAYS} dagen of al verstreken",
        "affected_case_count": count,
        "affected_case_ids": affected_ids,
        "recommended_action": (
            "Prioriteer deze casussen en versnel matching of plaatsing"
        ),
        "target_url": reverse("careon:case_list") + "?attention=waiting_long",
    }


def _detect_placement_stall_risk(
    active_intakes: list[Any],
    placement_by_intake: dict[int, Any],
    today: date,
) -> dict[str, Any] | None:
    """
    Flag when placements are likely to stall.

    Triggers:
      - provider_response_status = PENDING AND (deadline near or past), OR
      - last_reminder_at is stale (repeated nudging without movement), OR
      - placement_quality_status = AT_RISK / BROKEN_DOWN
    """
    PR = PlacementRequest
    affected_ids: list[int] = []
    worst_severity = "warning"

    for intake in active_intakes:
        placement = placement_by_intake.get(intake.pk)
        if placement is None:
            continue

        resp = getattr(placement, "provider_response_status", None)
        pqs = getattr(placement, "placement_quality_status", None)
        deadline = getattr(placement, "provider_response_deadline_at", None)
        last_reminder = getattr(placement, "provider_response_last_reminder_at", None)

        days_to_dl = _days_to(deadline, today)
        deadline_near = days_to_dl is not None and 0 <= days_to_dl <= RESPONSE_DEADLINE_WARNING_DAYS
        deadline_past = days_to_dl is not None and days_to_dl < 0

        stalled_by_deadline = resp == PR.ProviderResponseStatus.PENDING and (
            deadline_near or deadline_past
        )
        stalled_by_reminder = (
            resp == PR.ProviderResponseStatus.PENDING
            and last_reminder is not None
            and _days_since(last_reminder, today) >= STALE_DAYS
        )
        broken_quality = pqs in (
            PR.PlacementQualityStatus.AT_RISK,
            PR.PlacementQualityStatus.BROKEN_DOWN,
        )

        if not (stalled_by_deadline or stalled_by_reminder or broken_quality):
            continue

        affected_ids.append(intake.pk)
        if broken_quality or deadline_past:
            worst_severity = "critical"
        elif deadline_near and worst_severity != "critical":
            worst_severity = "high"

    if not affected_ids:
        return None

    count = len(affected_ids)
    return {
        "key": "placement_stall_risk",
        "severity": worst_severity,
        "label": (
            f"{count} plaatsing{'en' if count > 1 else ''} "
            f"dreig{'en' if count > 1 else 't'} vast te lopen"
        ),
        "reason": (
            "Reactiedeadline aanbieder nadert of plaatsingskwaliteit staat onder druk"
        ),
        "affected_case_count": count,
        "affected_case_ids": affected_ids,
        "recommended_action": "Herinner aanbieder of start rematch",
        "target_url": reverse("careon:placement_list"),
    }


def _detect_capacity_pressure_risk(
    active_intakes: list[Any],
    capacity_shortage: int,
    today: date,
) -> dict[str, Any] | None:
    """
    Flag when multiple matching-stage cases cluster in the same region,
    or when provider capacity shortage count is non-zero.

    Region clustering is computed from preferred_region_id on intakes.
    Capacity shortage is passed in (computed upstream by _build_capacity_signals).
    """
    S = CaseIntakeProcess.ProcessStatus

    region_case_ids: dict[int, list[int]] = {}
    for intake in active_intakes:
        if intake.status not in (S.MATCHING, S.DECISION):
            continue
        rid = getattr(intake, "preferred_region_id", None)
        if rid:
            region_case_ids.setdefault(rid, []).append(intake.pk)

    overloaded: dict[int, list[int]] = {
        rid: ids
        for rid, ids in region_case_ids.items()
        if len(ids) >= CAPACITY_PRESSURE_REGION_THRESHOLD
    }

    if not overloaded and capacity_shortage == 0:
        return None

    # Flatten affected case IDs (deduplicated)
    all_affected: list[int] = list(
        dict.fromkeys(pk for ids in overloaded.values() for pk in ids)
    )

    region_count = len(overloaded)
    if region_count > 0 and capacity_shortage > 0:
        label = (
            f"Capaciteitsdruk in {region_count} regio{'s' if region_count > 1 else ''} "
            f"— {capacity_shortage} aanbieder{'s' if capacity_shortage > 1 else ''} vol"
        )
        severity = "critical"
    elif capacity_shortage > 0:
        label = (
            f"{capacity_shortage} aanbieder{'s' if capacity_shortage > 1 else ''} "
            "heeft geen vrije capaciteit"
        )
        severity = "high"
    else:
        label = (
            f"Capaciteitsdruk in {region_count} regio{'s' if region_count > 1 else ''}: "
            "meerdere casussen wachten op dezelfde regio"
        )
        severity = "warning"

    return {
        "key": "capacity_pressure_risk",
        "severity": severity,
        "label": label,
        "reason": "Meerdere casussen concurreren om beperkte regionale capaciteit",
        "affected_case_count": len(all_affected) or capacity_shortage,
        "affected_case_ids": all_affected,
        "recommended_action": (
            "Controleer aanbiedercapaciteit of verbreed regio voor openstaande casussen"
        ),
        "target_url": reverse("careon:case_list") + "?attention=capacity_none",
    }


def _detect_escalation_risk(
    active_intakes: list[Any],
    signals_by_intake: dict[int, list[Any]],
    today: date,
) -> dict[str, Any] | None:
    """
    Flag when cases are likely to escalate to the municipality.

    Triggers:
      - urgency CRISIS with any blocking condition, OR
      - open ESCALATION signal, OR
      - urgency HIGH with DROPOUT_RISK signal, OR
      - ON_HOLD and urgent
    """
    CS = CareSignal
    S = CaseIntakeProcess.ProcessStatus

    affected_ids: list[int] = []

    for intake in active_intakes:
        open_signals = signals_by_intake.get(intake.pk, [])
        is_crisis = intake.urgency == CaseIntakeProcess.Urgency.CRISIS
        is_high = intake.urgency == CaseIntakeProcess.Urgency.HIGH
        has_escalation = any(
            s.signal_type == CS.SignalType.ESCALATION
            and s.status in (CS.SignalStatus.OPEN, CS.SignalStatus.IN_PROGRESS)
            for s in open_signals
        )
        has_dropout = any(
            s.signal_type == CS.SignalType.DROPOUT_RISK
            and s.status in (CS.SignalStatus.OPEN, CS.SignalStatus.IN_PROGRESS)
            for s in open_signals
        )
        is_blocked = intake.status == S.ON_HOLD
        is_unmatched_crisis = is_crisis and intake.status in (S.MATCHING, S.DECISION)

        if (
            has_escalation
            or (is_crisis and is_blocked)
            or (is_high and has_dropout)
            or is_unmatched_crisis
        ):
            affected_ids.append(intake.pk)

    if not affected_ids:
        return None

    count = len(affected_ids)
    return {
        "key": "escalation_risk",
        "severity": "critical",
        "label": (
            f"{count} casus{'sen' if count > 1 else ''} "
            f"dreig{'en' if count > 1 else 't'} te escaleren naar gemeente"
        ),
        "reason": "Hoge urgentie en open signalen zonder plaatsingsprogres",
        "affected_case_count": count,
        "affected_case_ids": affected_ids,
        "recommended_action": "Escaleer naar regiocoördinator of meld bij gemeente",
        "target_url": reverse("careon:signal_list"),
    }


# ---------------------------------------------------------------------------
# SLA risk list — top N cases most likely to breach SLA soon
# ---------------------------------------------------------------------------


def _build_sla_risk_cases(
    active_intakes: list[Any],
    placement_by_intake: dict[int, Any],
    today: date,
    max_items: int = 5,
) -> list[dict[str, Any]]:
    """
    Return the cases most at risk of missing their SLA / wachttijdnorm.

    Scored on:
      - days overdue (highest weight)
      - days remaining to deadline (near-breach)
      - urgency boost

    Only includes cases with a target_completion_date set, or cases that
    are extremely stale (>= 3× STALE_DAYS) without a target.
    """
    at_risk: list[dict[str, Any]] = []

    for intake in active_intakes:
        dtt = _days_to(intake.target_completion_date, today)
        days_waiting = _days_since(intake.updated_at, today)

        if dtt is None:
            if days_waiting < STALE_DAYS * 3:
                continue
            sla_score = min(days_waiting * 2, 60)
            reason = f"Geen activiteit in {days_waiting} dagen"
        elif dtt < 0:
            sla_score = 100 + abs(dtt)
            n = abs(dtt)
            reason = f"Streefdatum {n} dag{'en' if n != 1 else ''} verstreken"
        elif dtt <= SLA_NEAR_BREACH_DAYS:
            sla_score = 70 + (SLA_NEAR_BREACH_DAYS - dtt) * 10
            reason = f"Streefdatum over {dtt} dag{'en' if dtt != 1 else ''}"
        else:
            continue

        if intake.urgency == CaseIntakeProcess.Urgency.CRISIS:
            sla_score += 40
        elif intake.urgency == CaseIntakeProcess.Urgency.HIGH:
            sla_score += 25

        placement = placement_by_intake.get(intake.pk)
        assessment = getattr(intake, "case_assessment", None)
        action = _scored_next_action(intake, assessment, placement, sla_score)

        at_risk.append(
            {
                "id": intake.pk,
                "title": intake.title,
                "phase": intake.get_status_display(),
                "urgency_code": intake.urgency,
                "days_waiting": days_waiting,
                "days_to_target": dtt,
                "reason": reason,
                "sla_score": sla_score,
                "recommended_action": action["label"],
                "projected_impact": action["impact"],
                "action_href": action["href"],
                "case_href": reverse("careon:case_detail", args=[intake.pk]),
            }
        )

    at_risk.sort(key=lambda c: c["sla_score"], reverse=True)
    return at_risk[:max_items]


# ---------------------------------------------------------------------------
# Projected bottleneck stage
# ---------------------------------------------------------------------------


def _compute_projected_bottleneck(
    forecast_signals: list[dict[str, Any]],
) -> str:
    """
    Determine which stage is most likely to become the next bottleneck.

    Considers: assessment_delay_risk, match_failure_risk, placement_stall_risk,
    capacity_pressure_risk (→ matching), escalation_risk (→ casussen).

    Candidate stages are ranked by (severity, affected_case_count).
    Returns 'none' when no signals are active.
    """
    signal_map = {s["key"]: s for s in forecast_signals}
    severity_rank = {"critical": 0, "high": 1, "warning": 2, "info": 3}

    candidates: list[tuple[str, int, str]] = []  # (stage, count, severity)

    assessment_sig = signal_map.get("assessment_delay_risk")
    if assessment_sig:
        candidates.append(
            (
                "beoordelingen",
                assessment_sig["affected_case_count"],
                assessment_sig["severity"],
            )
        )

    match_sig = signal_map.get("match_failure_risk")
    cap_sig = signal_map.get("capacity_pressure_risk")
    if match_sig or cap_sig:
        best = max(
            [s for s in (match_sig, cap_sig) if s],
            key=lambda s: (
                -severity_rank.get(s["severity"], 9),
                s["affected_case_count"],
            ),
        )
        candidates.append(
            ("matching", best["affected_case_count"], best["severity"])
        )

    stall_sig = signal_map.get("placement_stall_risk")
    if stall_sig:
        candidates.append(
            (
                "plaatsingen",
                stall_sig["affected_case_count"],
                stall_sig["severity"],
            )
        )

    esc_sig = signal_map.get("escalation_risk")
    if esc_sig:
        candidates.append(
            ("casussen", esc_sig["affected_case_count"], esc_sig["severity"])
        )

    if not candidates:
        return "none"

    candidates.sort(key=lambda c: (severity_rank.get(c[2], 9), -c[1]))
    return candidates[0][0]


# ---------------------------------------------------------------------------
# Action impact summary
# ---------------------------------------------------------------------------


def _build_action_impact_summary(
    forecast_signals: list[dict[str, Any]],
) -> str:
    """
    Produce a one-line Dutch statement summarising the impact of resolving
    the highest-priority forecast signal.
    """
    if not forecast_signals:
        return "Doorstroom is stabiel — geen directe risico's gedetecteerd"

    severity_rank = {"critical": 0, "high": 1, "warning": 2, "info": 3}
    top = min(forecast_signals, key=lambda s: severity_rank.get(s["severity"], 9))
    count = top["affected_case_count"]

    impact_map = {
        "assessment_delay_risk": (
            f"Ontgrendelt matching voor {count} casus{'sen' if count > 1 else ''}"
        ),
        "match_failure_risk": (
            f"Vergroot kans op plaatsing voor {count} casus{'sen' if count > 1 else ''}"
        ),
        "sla_breach_risk": (
            f"Verkleint kans op SLA-overschrijding voor {count} dossier{'s' if count > 1 else ''}"
        ),
        "placement_stall_risk": (
            f"Deblokkeert plaatsingsproces voor {count} casus{'sen' if count > 1 else ''}"
        ),
        "capacity_pressure_risk": "Vergroot beschikbare matchruimte in de regio",
        "escalation_risk": (
            f"Voorkomt escalatie bij {count} crisissitu{'aties' if count > 1 else 'atie'}"
        ),
    }
    return impact_map.get(
        top["key"],
        f"Verbetert doorstroom voor {count} casus{'sen' if count > 1 else ''}",
    )


# ---------------------------------------------------------------------------
# Predictive strips (max 2 — one projected bottleneck + one SLA/critical)
# ---------------------------------------------------------------------------


def _build_predictive_strips(
    forecast_signals: list[dict[str, Any]],
    projected_bottleneck_stage: str,
    sla_risk_cases: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Build at most 2 compact predictive signal strips for the dashboard.

    Strip 1: Projected bottleneck stage (if any).
    Strip 2: SLA risk count (if > 0), or top critical forecast signal.
    """
    strips: list[dict[str, Any]] = []
    used_hrefs: set[str] = set()

    # Strip 1: projected bottleneck
    if projected_bottleneck_stage != "none":
        stage_labels = {
            "beoordelingen": "Beoordelingen",
            "matching": "Matching",
            "plaatsingen": "Plaatsingen",
            "casussen": "Intake",
        }
        label = stage_labels.get(projected_bottleneck_stage, projected_bottleneck_stage)
        href = _stage_href(projected_bottleneck_stage)
        strips.append(
            {
                "label": f"Verwacht volgend knelpunt: {label}",
                "tone": "predictive",
                "href": href,
                "is_forecast": True,
            }
        )
        used_hrefs.add(href)

    # Strip 2: SLA risk count
    sla_count = len(sla_risk_cases)
    if sla_count > 0 and len(strips) < 2:
        sla_href = reverse("careon:case_list") + "?attention=waiting_long"
        strips.append(
            {
                "label": (
                    f"{sla_count} casus{'sen' if sla_count > 1 else ''} "
                    f"dreig{'en' if sla_count > 1 else 't'} wachttijdnorm te overschrijden"
                ),
                "tone": "warning",
                "href": sla_href,
                "is_forecast": True,
            }
        )
        used_hrefs.add(sla_href)

    # Optional: top critical forecast signal (if space remains)
    if len(strips) < 2:
        critical = [s for s in forecast_signals if s["severity"] == "critical"]
        for sig in critical:
            if sig["target_url"] not in used_hrefs:
                strips.append(
                    {
                        "label": sig["label"],
                        "tone": "critical",
                        "href": sig["target_url"],
                        "is_forecast": True,
                    }
                )
                break

    return strips[:2]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_predictive_summary(
    *,
    org: Any,
    active_intakes: list[Any],
    placement_by_intake: dict[int, Any],
    signals_by_intake: dict[int, list[Any]],
    today: date,
    capacity_shortage: int = 0,
) -> dict[str, Any]:
    """
    Compute the full predictive intelligence layer for the Regiekamer.

    Parameters
    ----------
    org:
        Organisation instance (may be None — all computations degrade safely).
    active_intakes:
        Pre-scoped list of CaseIntakeProcess objects with case_assessment
        available via select_related. COMPLETED cases should be excluded.
    placement_by_intake:
        Dict[intake_pk → PlacementRequest] (latest placement per intake).
    signals_by_intake:
        Dict[intake_pk → list[CareSignal]] (OPEN + IN_PROGRESS only).
    today:
        Today's date — override for deterministic testing.
    capacity_shortage:
        Number of providers at zero capacity (computed upstream).

    Returns
    -------
    dict
        All keys are additive to the existing regiekamer_summary context.

        forecast_signals           – list[dict], 0–6 predictive signal dicts
        sla_risk_cases             – list[dict], top-5 SLA-at-risk cases
        projected_bottleneck_stage – str, predicted next bottleneck stage
        action_impact_summary      – str, one-line impact statement
        per_case_forecast          – dict[pk → {risk_score, risk_band, top_reasons, ...}]
        predictive_strips          – list[dict], 1–2 UI strips for template
    """
    # --- Per-case risk scoring ---
    per_case_forecast: dict[int, dict[str, Any]] = {}
    for intake in active_intakes:
        assessment = getattr(intake, "case_assessment", None)
        placement = placement_by_intake.get(intake.pk)
        open_signals = signals_by_intake.get(intake.pk, [])
        per_case_forecast[intake.pk] = _score_single_case(
            intake, assessment, placement, open_signals, today
        )

    # --- Forecast signal detection ---
    forecast_signals: list[dict[str, Any]] = []

    for detector, kwargs in [
        (_detect_assessment_delay_risk, {"active_intakes": active_intakes, "today": today}),
        (
            _detect_match_failure_risk,
            {
                "active_intakes": active_intakes,
                "placement_by_intake": placement_by_intake,
                "signals_by_intake": signals_by_intake,
                "today": today,
            },
        ),
        (_detect_sla_breach_risk, {"active_intakes": active_intakes, "today": today}),
        (
            _detect_placement_stall_risk,
            {
                "active_intakes": active_intakes,
                "placement_by_intake": placement_by_intake,
                "today": today,
            },
        ),
        (
            _detect_capacity_pressure_risk,
            {
                "active_intakes": active_intakes,
                "capacity_shortage": capacity_shortage,
                "today": today,
            },
        ),
        (
            _detect_escalation_risk,
            {
                "active_intakes": active_intakes,
                "signals_by_intake": signals_by_intake,
                "today": today,
            },
        ),
    ]:
        result = detector(**kwargs)
        if result is not None:
            forecast_signals.append(result)

    # Sort by severity (critical first)
    _sev_rank = {"critical": 0, "high": 1, "warning": 2, "info": 3}
    forecast_signals.sort(key=lambda s: _sev_rank.get(s["severity"], 9))

    # --- SLA risk list ---
    sla_risk_cases = _build_sla_risk_cases(active_intakes, placement_by_intake, today)

    # --- Projected bottleneck ---
    projected_bottleneck_stage = _compute_projected_bottleneck(forecast_signals)

    # --- Action impact summary ---
    action_impact_summary = _build_action_impact_summary(forecast_signals)

    # --- Predictive strips ---
    predictive_strips = _build_predictive_strips(
        forecast_signals, projected_bottleneck_stage, sla_risk_cases
    )

    return {
        "forecast_signals": forecast_signals,
        "sla_risk_cases": sla_risk_cases,
        "projected_bottleneck_stage": projected_bottleneck_stage,
        "action_impact_summary": action_impact_summary,
        "per_case_forecast": per_case_forecast,
        "predictive_strips": predictive_strips,
    }
