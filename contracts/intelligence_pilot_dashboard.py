"""
contracts/intelligence_pilot_dashboard.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Pure aggregation module for the Zorg OS V3 Pilot Impact Dashboard.

Computes case-flow, acceptance, placement quality, intake progress, and
decision-intelligence performance metrics from live querysets.

Public API
----------
build_pilot_dashboard(*, cases, alerts, placements, baseline) -> dict

Everything is **read-only and advisory**.  Nothing in this module writes to
the database or modifies any record.

Field mapping to real PlacementRequest / CaseIntakeProcess / RegiekamerAlert:
  PlacementRequest.provider_response_status  → ACCEPTED / REJECTED / …
  PlacementRequest.placement_quality_status  → GOOD_FIT / AT_RISK / …
  PlacementRequest.predicted_confidence      → float 0.0–1.0
  CaseIntakeProcess.status                   → INTAKE / MATCHING / DECISION / COMPLETED / ON_HOLD
  RegiekamerAlert.alert_type                 → string key
"""
from __future__ import annotations

from collections import Counter
from statistics import mean
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

HIGH_CONFIDENCE_THRESHOLD = 0.70
LOW_CONFIDENCE_THRESHOLD = 0.50

# Status thresholds for overall pilot health
_SCORE_ON_TRACK = 7
_SCORE_WATCH = 4

# Max issues shown in the issues panel
_MAX_ISSUES = 3


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _pct(part: int, whole: int) -> float | None:
    """Return part/whole as a percentage (0–100), rounded to 1 dp, or None."""
    if not whole:
        return None
    return round((part / whole) * 100, 1)


def _delta(current: float | None, baseline: float | None) -> float | None:
    """Return current − baseline, rounded to 1 dp, or None if either is None."""
    if current is None or baseline is None:
        return None
    return round(current - baseline, 1)


def _trend_direction(delta_value: float | None, *, inverse_good: bool = False) -> str:
    """Map a numeric delta to 'up' | 'down' | 'neutral'.

    When inverse_good=True (e.g. weak-match share, stuck counts) a negative
    delta is the *good* direction, shown as 'up' (green).
    """
    if delta_value is None:
        return "neutral"
    if delta_value == 0:
        return "neutral"
    if inverse_good:
        return "up" if delta_value < 0 else "down"
    return "up" if delta_value > 0 else "down"


def _format_pct(value: float | None) -> str:
    if value is None:
        return "n.v.t."
    return f"{value:.1f}%"


def _format_pp(delta_value: float | None) -> str:
    if delta_value is None:
        return "n.v.t."
    sign = "+" if delta_value > 0 else ""
    return f"{sign}{delta_value:.1f}pp"


def _format_count(value: int | float | None) -> str:
    if value is None:
        return "n.v.t."
    return str(int(value))


def _format_count_delta(delta_value: float | None) -> str:
    if delta_value is None:
        return "n.v.t."
    sign = "+" if delta_value > 0 else ""
    return f"{sign}{int(delta_value)}"


# ---------------------------------------------------------------------------
# Field extractors — tolerant of missing / legacy fields
# ---------------------------------------------------------------------------

def _extract_alert_type(alert_like: Any) -> str:
    """Return alert_type string, empty string if missing."""
    return getattr(alert_like, "alert_type", "") or ""


def _extract_confidence(placement: Any) -> float | None:
    """Return predicted_confidence float, or None."""
    val = getattr(placement, "predicted_confidence", None)
    if isinstance(val, (int, float)):
        return round(float(val), 3)
    return None


def _extract_accepted(placement: Any) -> bool | None:
    """Return True/False based on provider_response_status, or None if pending."""
    status = getattr(placement, "provider_response_status", None)
    if status is None:
        return None
    s = str(status).upper()
    if s == "ACCEPTED":
        return True
    if s in ("REJECTED", "NO_CAPACITY"):
        return False
    return None  # PENDING / WAITLIST / NEEDS_INFO are not yet decided


def _extract_good_fit(placement: Any) -> bool | None:
    """Return True if placement_quality_status == GOOD_FIT, False if AT_RISK/BROKEN_DOWN."""
    status = getattr(placement, "placement_quality_status", None)
    if status is None:
        return None
    s = str(status).upper()
    if s == "GOOD_FIT":
        return True
    if s in ("AT_RISK", "BROKEN_DOWN"):
        return False
    return None  # PENDING — not yet evaluated


def _extract_intake_started(case: Any) -> bool | None:
    """Return True if the CaseIntakeProcess has progressed past INTAKE."""
    status = getattr(case, "status", None)
    if status is None:
        return None
    s = str(status).upper()
    if s in ("MATCHING", "DECISION", "COMPLETED"):
        return True
    if s == "INTAKE":
        return False
    return None


def _bucket_case_stage(case: Any) -> str:
    """Map CaseIntakeProcess.status to a V3-flow bucket."""
    status = getattr(case, "status", None) or ""
    s = str(status).upper()
    if s == "INTAKE":
        return "intake"
    if s == "MATCHING":
        return "matching"
    if s == "DECISION":
        return "aanbieder_beoordeling"
    if s == "COMPLETED":
        return "plaatsing"
    if s == "ON_HOLD":
        return "on_hold"
    return "casus"


_BUCKET_LABELS = {
    "intake": "Intake",
    "matching": "Matching",
    "aanbieder_beoordeling": "Aanbieder Beoordeling",
    "plaatsing": "Plaatsing",
    "on_hold": "In wacht",
    "casus": "Casus",
}

# Flow order for the progress strip (terminal stages excluded from bottleneck)
_FLOW_ORDER = ["casus", "intake", "matching", "aanbieder_beoordeling", "plaatsing"]


# ---------------------------------------------------------------------------
# Overall health scoring
# ---------------------------------------------------------------------------

def _status_from_kpis(
    acceptance_rate: float | None,
    stuck_cases: int,
    weak_match_share: float | None,
    intake_started_share: float | None,
) -> dict[str, str]:
    """Compute a 3-tier health status: on_track / watch / at_risk."""
    score = 0

    if acceptance_rate is not None:
        if acceptance_rate >= 60:
            score += 2
        elif acceptance_rate >= 45:
            score += 1

    if stuck_cases <= 2:
        score += 2
    elif stuck_cases <= 5:
        score += 1

    if weak_match_share is not None:
        if weak_match_share <= 20:
            score += 2
        elif weak_match_share <= 35:
            score += 1

    if intake_started_share is not None:
        if intake_started_share >= 60:
            score += 2
        elif intake_started_share >= 40:
            score += 1

    if score >= _SCORE_ON_TRACK:
        return {"key": "on_track", "label": "Op koers", "tone": "success"}
    if score >= _SCORE_WATCH:
        return {"key": "watch", "label": "Aandacht nodig", "tone": "warning"}
    return {"key": "at_risk", "label": "Risico", "tone": "danger"}


# ---------------------------------------------------------------------------
# Issues panel builder
# ---------------------------------------------------------------------------

def _build_issues(alert_counter: Counter) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    if alert_counter.get("provider_rejected_case", 0):
        issues.append({
            "tone": "danger",
            "title": f"{alert_counter['provider_rejected_case']} afwijzingen door aanbieder",
            "description": "Herpositionering of scherpere matching nodig.",
        })
    if alert_counter.get("no_capacity_available", 0):
        issues.append({
            "tone": "warning",
            "title": f"{alert_counter['no_capacity_available']} casussen zonder capaciteit",
            "description": "Aanbod of regio verbreden.",
        })
    if alert_counter.get("weak_match_needs_verification", 0):
        issues.append({
            "tone": "warning",
            "title": f"{alert_counter['weak_match_needs_verification']} zwakke matches",
            "description": "Verificatie nodig vóór doorzetten.",
        })
    summary_count = (
        alert_counter.get("summary_missing_or_stale", 0)
        + alert_counter.get("missing_summary", 0)
    )
    if summary_count:
        issues.append({
            "tone": "warning",
            "title": f"{summary_count} samenvattingen ontbreken of zijn verouderd",
            "description": "Beslisbasis is mogelijk onvolledig.",
        })
    if alert_counter.get("placement_stalled", 0):
        issues.append({
            "tone": "danger",
            "title": f"{alert_counter['placement_stalled']} plaatsingen lopen vast",
            "description": "Actie nodig om doorstroom te herstellen.",
        })

    return issues[:_MAX_ISSUES]


# ---------------------------------------------------------------------------
# Recommendation builder
# ---------------------------------------------------------------------------

def _build_recommendation(alert_counter: Counter) -> str:
    if alert_counter.get("no_capacity_available", 0) >= 2:
        return "Vergroot de aanbiederpool of zoek alternatieven in aangrenzende regio's."
    if alert_counter.get("provider_rejected_case", 0) >= 2:
        return "Analyseer afwijzingsredenen en verscherp matching op specialisatie en context."
    summary_count = (
        alert_counter.get("summary_missing_or_stale", 0)
        + alert_counter.get("missing_summary", 0)
    )
    if summary_count >= 2:
        return "Verbeter de kwaliteit en actualiteit van samenvattingen vóór matching."
    if alert_counter.get("weak_match_needs_verification", 0) >= 2:
        return "Verhoog verificatie op lage-confidence matches voordat ze naar aanbieders gaan."
    return "Monitor pilot en verzamel feedback."


# ---------------------------------------------------------------------------
# Main aggregation function
# ---------------------------------------------------------------------------

def build_pilot_dashboard(
    *,
    cases: Iterable[Any],
    alerts: Iterable[Any],
    placements: Iterable[Any],
    baseline: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Build a fully computed pilot dashboard dict from live querysets.

    All inputs are consumed lazily (one pass each) so Django querysets work
    without forcing multiple DB round-trips.

    Parameters
    ----------
    cases       : iterable of CaseIntakeProcess (or duck-typed objects)
    alerts      : iterable of RegiekamerAlert (unresolved)
    placements  : iterable of PlacementRequest
    baseline    : optional dict of {kpi_key: float} for delta computation

    Returns a dict safe to pass directly to a Django template context.
    """
    baseline = baseline or {}

    cases = list(cases)
    alerts = list(alerts)
    placements = list(placements)

    # --- Case flow --------------------------------------------------------
    flow_counts: Counter = Counter()
    stuck_cases = 0

    for case in cases:
        flow_counts[_bucket_case_stage(case)] += 1

    # Cases counted as stuck = those in ON_HOLD stage
    stuck_cases = flow_counts.get("on_hold", 0)

    # --- Placement metrics ------------------------------------------------
    acceptance_vals: list[float] = []
    good_fit_vals: list[float] = []
    confidence_vals: list[float] = []
    weak_match_count = 0
    high_conf_total = 0
    high_conf_accepted = 0
    low_conf_total = 0
    low_conf_rejected = 0

    for placement in placements:
        conf = _extract_confidence(placement)
        accepted = _extract_accepted(placement)
        good_fit = _extract_good_fit(placement)

        if conf is not None:
            confidence_vals.append(conf)
            if conf < LOW_CONFIDENCE_THRESHOLD:
                weak_match_count += 1
                low_conf_total += 1
                if accepted is False:
                    low_conf_rejected += 1
            if conf >= HIGH_CONFIDENCE_THRESHOLD:
                high_conf_total += 1
                if accepted is True:
                    high_conf_accepted += 1

        if accepted is not None:
            acceptance_vals.append(1.0 if accepted else 0.0)

        if good_fit is not None:
            good_fit_vals.append(1.0 if good_fit else 0.0)

    # --- Case intake progress ---------------------------------------------
    intake_started_vals: list[float] = []
    for case in cases:
        started = _extract_intake_started(case)
        if started is not None:
            intake_started_vals.append(1.0 if started else 0.0)

    # --- Derived KPIs -----------------------------------------------------
    acceptance_rate = round(mean(acceptance_vals) * 100, 1) if acceptance_vals else None
    placement_success_rate = round(mean(good_fit_vals) * 100, 1) if good_fit_vals else None
    intake_started_share = round(mean(intake_started_vals) * 100, 1) if intake_started_vals else None
    avg_confidence = round(mean(confidence_vals) * 100, 1) if confidence_vals else None
    weak_match_share = _pct(weak_match_count, len(placements))

    high_conf_accepted_pct = _pct(high_conf_accepted, high_conf_total)
    low_conf_rejected_pct = _pct(low_conf_rejected, low_conf_total)
    if high_conf_accepted_pct is not None or low_conf_rejected_pct is not None:
        confidence_alignment = round(
            mean([v for v in [high_conf_accepted_pct, low_conf_rejected_pct] if v is not None]),
            1,
        )
    else:
        confidence_alignment = None

    # --- Alert aggregation ------------------------------------------------
    alert_counter: Counter = Counter(_extract_alert_type(a) for a in alerts)

    # --- Bottleneck -------------------------------------------------------
    non_terminal = {k: flow_counts[k] for k in _FLOW_ORDER if k in flow_counts}
    bottleneck_stage: str | None = max(non_terminal, key=non_terminal.__getitem__) if non_terminal else None

    # --- Status -----------------------------------------------------------
    status = _status_from_kpis(
        acceptance_rate=acceptance_rate,
        stuck_cases=stuck_cases,
        weak_match_share=weak_match_share,
        intake_started_share=intake_started_share,
    )

    # --- Issues & recommendation ------------------------------------------
    issues = _build_issues(alert_counter)
    recommendation = _build_recommendation(alert_counter)

    # --- Deltas -----------------------------------------------------------
    d_acceptance = _delta(acceptance_rate, baseline.get("acceptance_rate"))
    d_success = _delta(placement_success_rate, baseline.get("placement_success_rate"))
    d_intake = _delta(intake_started_share, baseline.get("intake_started_share"))
    d_weak = _delta(weak_match_share, baseline.get("weak_match_share"))
    d_stuck = _delta(
        float(stuck_cases) if stuck_cases is not None else None,
        float(baseline["stuck_cases"]) if "stuck_cases" in baseline else None,
    )

    return {
        "status": status,
        "hero_metrics": [
            {
                "label": "Acceptatieratio",
                "value": _format_pct(acceptance_rate),
                "delta": _format_pp(d_acceptance),
                "direction": _trend_direction(d_acceptance),
            },
            {
                "label": "Plaatsingskwaliteit",
                "value": _format_pct(placement_success_rate),
                "delta": _format_pp(d_success),
                "direction": _trend_direction(d_success),
            },
            {
                "label": "Intake gestart",
                "value": _format_pct(intake_started_share),
                "delta": _format_pp(d_intake),
                "direction": _trend_direction(d_intake),
            },
            {
                "label": "Zwakke matches",
                "value": _format_pct(weak_match_share),
                "delta": _format_pp(d_weak),
                "direction": _trend_direction(d_weak, inverse_good=True),
            },
        ],
        "kpi_cards": [
            {
                "label": "Match acceptatie",
                "value": _format_pct(acceptance_rate),
                "delta": _format_pp(d_acceptance),
                "direction": _trend_direction(d_acceptance),
            },
            {
                "label": "Plaatsingskwaliteit",
                "value": _format_pct(placement_success_rate),
                "delta": _format_pp(d_success),
                "direction": _trend_direction(d_success),
            },
            {
                "label": "Intake gestart",
                "value": _format_pct(intake_started_share),
                "delta": _format_pp(d_intake),
                "direction": _trend_direction(d_intake),
            },
            {
                "label": "Vastgelopen casussen",
                "value": _format_count(stuck_cases),
                "delta": _format_count_delta(d_stuck),
                "direction": _trend_direction(d_stuck, inverse_good=True),
            },
            {
                "label": "Zwakke matches",
                "value": _format_pct(weak_match_share),
                "delta": _format_pp(d_weak),
                "direction": _trend_direction(d_weak, inverse_good=True),
            },
        ],
        "flow": {
            "counts": [
                {"key": k, "label": _BUCKET_LABELS[k], "count": flow_counts.get(k, 0)}
                for k in _FLOW_ORDER
            ],
            "bottleneck": bottleneck_stage,
            "bottleneck_label": _BUCKET_LABELS.get(bottleneck_stage) if bottleneck_stage else None,
        },
        "issues": issues,
        "intelligence": {
            "confidence_alignment": _format_pct(confidence_alignment),
            "high_conf_accepted": _format_pct(high_conf_accepted_pct),
            "low_conf_rejected": _format_pct(low_conf_rejected_pct),
            "avg_confidence": _format_pct(avg_confidence),
        },
        "recommendation": recommendation,
        "totals": {
            "cases": len(cases),
            "placements": len(placements),
            "open_alerts": len(alerts),
        },
    }
