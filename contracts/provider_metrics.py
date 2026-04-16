"""Provider behavior metrics aggregation and signal derivation.

Pure read-only aggregation layer.  No side effects, no writes, no scoring.

Aggregates behavioral signals for a single provider from existing placement
and intake outcome data.  Designed for repeated calls — no caching or
persistence is applied here.

Public API
----------
build_provider_behavior_metrics(provider_id) -> Dict[str, Any]
derive_behavior_signals(metrics)            -> Dict[str, str | None]
label_behavior_signals(signals)             -> List[str]
calculate_provider_behavior_modifier(metrics, case_context=None) -> float
describe_behavior_influence(metrics, signals=None, close_call_applied=False) -> List[str]
"""

from __future__ import annotations

from typing import Any, Dict, Optional


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Statuses that represent an actual provider reply (terminal or intermediate
# decisions).  PENDING means no reply yet and is excluded from response-rate
# denominators.
_RESPONDED_STATUSES: frozenset[str] = frozenset(
    {"ACCEPTED", "REJECTED", "NO_CAPACITY", "WAITLIST", "NEEDS_INFO"}
)

# Intake outcome value that counts as a successful intake.
_INTAKE_SUCCESS_STATUS = "COMPLETED"
_MAX_BEHAVIOR_MODIFIER = 0.15


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


def build_provider_behavior_metrics(provider_id: Any) -> Dict[str, Any]:
    """Return aggregated behavioral metrics for *provider_id*.

    Metrics
    -------
    avg_response_time_hours : float | None
        Mean hours between ``provider_response_requested_at`` and
        ``provider_response_recorded_at`` across all cases where both
        timestamps exist and the provider gave a terminal response.
        ``None`` when no timed-response pairs exist.

    acceptance_rate : float | None
        ``ACCEPTED / total_responses`` (0.0–1.0, 4-decimal precision).
        ``None`` when total_responses == 0.

    no_capacity_rate : float | None
        ``NO_CAPACITY / total_responses``.
        ``None`` when total_responses == 0.

    waitlist_rate : float | None
        ``WAITLIST / total_responses``.
        ``None`` when total_responses == 0.

    intake_success_rate : float | None
        ``COMPLETED intakes / ACCEPTED placements`` (0.0–1.0).
        ``None`` when no accepted placements exist.

    total_cases : int
        Total PlacementRequest records where ``selected_provider_id`` matches.

    Edge cases
    ----------
    - ``provider_id`` is ``None`` → all metrics are safe defaults.
    - No placement records → ``total_cases == 0``, all rates ``None``.
    - Partial data (missing timestamps, missing intake) → excluded from the
      relevant sub-calculation only; other metrics remain valid.
    """
    if provider_id is None:
        return _empty_metrics()

    from contracts.models import PlacementRequest  # deferred: avoids circular at module-init

    rows = list(
        PlacementRequest.objects.filter(selected_provider_id=provider_id).values(
            "provider_response_status",
            "provider_response_requested_at",
            "provider_response_recorded_at",
            "due_diligence_process__intake_outcome_status",
        )
    )

    if not rows:
        return _empty_metrics()

    total_cases: int = len(rows)
    total_responses: int = 0
    accepted_count: int = 0
    no_capacity_count: int = 0
    waitlist_count: int = 0
    response_time_seconds_sum: float = 0.0
    response_time_count: int = 0
    successful_intake_count: int = 0

    for row in rows:
        status = _normalize_status(row.get("provider_response_status"))

        if status in _RESPONDED_STATUSES:
            total_responses += 1

            if status == "ACCEPTED":
                accepted_count += 1
            elif status == "NO_CAPACITY":
                no_capacity_count += 1
            elif status == "WAITLIST":
                waitlist_count += 1

            # Response time: only when both timestamps are present and ordered.
            requested_at = row.get("provider_response_requested_at")
            recorded_at = row.get("provider_response_recorded_at")
            if requested_at is not None and recorded_at is not None:
                delta = (recorded_at - requested_at).total_seconds()
                if delta >= 0:
                    response_time_seconds_sum += delta
                    response_time_count += 1

        # Intake success: only for accepted placements with a known intake outcome.
        if status == "ACCEPTED":
            intake_outcome = _normalize_intake_outcome(
                row.get("due_diligence_process__intake_outcome_status")
            )
            if intake_outcome == _INTAKE_SUCCESS_STATUS:
                successful_intake_count += 1

    # --- Derived rates -------------------------------------------------------

    avg_response_time_hours: Optional[float] = None
    if response_time_count > 0:
        avg_response_time_hours = round(
            (response_time_seconds_sum / response_time_count) / 3600.0, 2
        )

    acceptance_rate: Optional[float] = None
    no_capacity_rate: Optional[float] = None
    waitlist_rate: Optional[float] = None
    if total_responses > 0:
        acceptance_rate = round(accepted_count / total_responses, 4)
        no_capacity_rate = round(no_capacity_count / total_responses, 4)
        waitlist_rate = round(waitlist_count / total_responses, 4)

    intake_success_rate: Optional[float] = None
    if accepted_count > 0:
        intake_success_rate = round(successful_intake_count / accepted_count, 4)

    return {
        "avg_response_time_hours": avg_response_time_hours,
        "acceptance_rate": acceptance_rate,
        "no_capacity_rate": no_capacity_rate,
        "waitlist_rate": waitlist_rate,
        "intake_success_rate": intake_success_rate,
        "total_cases": total_cases,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _normalize_status(raw: Any) -> str:
    """Normalise a raw provider_response_status value to a canonical string."""
    value = str(raw or "").strip().upper()
    if value == "DECLINED":
        return "REJECTED"
    if value == "NO_RESPONSE":
        return "PENDING"
    return value


def _normalize_intake_outcome(raw: Any) -> str:
    """Normalise a raw intake_outcome_status value to a canonical string."""
    return str(raw or "").strip().upper()


def _empty_metrics() -> Dict[str, Any]:
    """Return the safe-default metrics dict used when no data is available."""
    return {
        "avg_response_time_hours": None,
        "acceptance_rate": None,
        "no_capacity_rate": None,
        "waitlist_rate": None,
        "intake_success_rate": None,
        "total_cases": 0,
    }


# ---------------------------------------------------------------------------
# Qualitative signal derivation
# ---------------------------------------------------------------------------
#
# Thresholds are intentionally centralised here so that the mapping rules
# live in one place and can be updated without touching case_intelligence.py.
#
# All four keys are always present in the returned dict; the value is None
# when the underlying metric is unavailable (insufficient history).

_RESPONSE_SPEED_FAST_H = 24       # hours
_RESPONSE_SPEED_SLOW_H = 72       # hours

_ACCEPTANCE_HIGH = 0.70
_ACCEPTANCE_LOW = 0.30

_NO_CAPACITY_OFTEN_FULL = 0.40
_NO_CAPACITY_LIMITED = 0.15

_INTAKE_SUCCESS_HIGH = 0.70


def derive_behavior_signals(metrics: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """Map raw provider metrics to qualitative behavior signal labels.

    Parameters
    ----------
    metrics:
        Output of ``build_provider_behavior_metrics()``.

    Returns
    -------
    dict with four keys — all always present, value is ``None`` when data is
    insufficient to derive a meaningful label:

    ``response_speed``
        ``"fast"`` < 24 h  |  ``"average"`` 24–72 h  |  ``"slow"`` ≥ 72 h

    ``acceptance_pattern``
        ``"high"`` ≥ 70 %  |  ``"mixed"`` 30–70 %  |  ``"low"`` < 30 %

    ``capacity_pattern``
        ``"stable"`` < 15 %  |  ``"limited"`` 15–40 %  |  ``"often_full"`` ≥ 40 %

    ``intake_pattern``
        ``"high_success"`` ≥ 70 %  |  ``"variable"`` < 70 %
    """
    return {
        "response_speed": _map_response_speed(metrics.get("avg_response_time_hours")),
        "acceptance_pattern": _map_acceptance_pattern(metrics.get("acceptance_rate")),
        "capacity_pattern": _map_capacity_pattern(metrics.get("no_capacity_rate")),
        "intake_pattern": _map_intake_pattern(metrics.get("intake_success_rate")),
    }


def _map_response_speed(avg_hours: Optional[float]) -> Optional[str]:
    if avg_hours is None:
        return None
    if avg_hours < _RESPONSE_SPEED_FAST_H:
        return "fast"
    if avg_hours < _RESPONSE_SPEED_SLOW_H:
        return "average"
    return "slow"


def _map_acceptance_pattern(rate: Optional[float]) -> Optional[str]:
    if rate is None:
        return None
    if rate >= _ACCEPTANCE_HIGH:
        return "high"
    if rate >= _ACCEPTANCE_LOW:
        return "mixed"
    return "low"


def _map_capacity_pattern(no_capacity_rate: Optional[float]) -> Optional[str]:
    if no_capacity_rate is None:
        return None
    if no_capacity_rate >= _NO_CAPACITY_OFTEN_FULL:
        return "often_full"
    if no_capacity_rate >= _NO_CAPACITY_LIMITED:
        return "limited"
    return "stable"


def _map_intake_pattern(intake_success_rate: Optional[float]) -> Optional[str]:
    if intake_success_rate is None:
        return None
    if intake_success_rate >= _INTAKE_SUCCESS_HIGH:
        return "high_success"
    return "variable"


# ---------------------------------------------------------------------------
# Human-readable signal labels (for UI rendering)
# ---------------------------------------------------------------------------
#
# Maps each (signal_key, value) pair to a short Dutch label suitable for
# display as a chip/tag.  Only positive or noteworthy patterns are shown —
# neutral values ("average", "mixed") are intentionally omitted from the
# visible label set to avoid noise.
#
# Returns a list of label strings, empty list when nothing is noteworthy.

_SIGNAL_LABELS: Dict[tuple, str] = {
    ("response_speed", "fast"):            "Reageert snel",
    ("response_speed", "slow"):            "Reageert traag",
    ("acceptance_pattern", "high"):        "Accepteert vaak",
    ("acceptance_pattern", "low"):         "Accepteert zelden",
    ("capacity_pattern", "stable"):        "Capaciteit stabiel",
    ("capacity_pattern", "limited"):       "Beperkte capaciteit",
    ("capacity_pattern", "often_full"):    "Vaak vol",
    ("intake_pattern", "high_success"):    "Hoge intakescore",
    ("intake_pattern", "variable"):        "Variabele intakeresultaten",
}


def label_behavior_signals(signals: Dict[str, Optional[str]]) -> list:
    """Return a list of human-readable Dutch label strings for UI display.

    Only signal values that are worth surfacing to a coordinator are included.
    Returns an empty list when all signals are ``None`` or neutral.
    """
    labels = []
    for key in ("response_speed", "acceptance_pattern", "capacity_pattern", "intake_pattern"):
        value = signals.get(key)
        if value is None:
            continue
        label = _SIGNAL_LABELS.get((key, value))
        if label:
            labels.append(label)
    return labels


def calculate_provider_behavior_modifier(
    provider_metrics: Dict[str, Any],
    case_context: Optional[Dict[str, Any]] = None,
) -> float:
    """Return a bounded secondary modifier for matching.

    The modifier is deterministic and side-effect free, normalized to a small
    range around 0 where:

    - positive values indicate more reliable operational behavior,
    - negative values indicate recurring friction patterns,
    - sparse history compresses the effect toward neutral.

    Guardrails:
    - bounded to [-0.15, +0.15]
    - designed as secondary influence only
    - never intended as a hard exclusion signal
    """
    del case_context  # reserved for future contextual tuning

    metrics = provider_metrics or {}
    total_cases = int(metrics.get("total_cases") or 0)
    history_factor = _history_confidence_factor(total_cases)
    if history_factor <= 0:
        return 0.0

    response_component = _response_reliability_component(metrics.get("avg_response_time_hours"))
    acceptance_component = _centered_rate_component(metrics.get("acceptance_rate"), baseline=0.50)
    intake_component = _centered_rate_component(metrics.get("intake_success_rate"), baseline=0.60)
    capacity_component = _capacity_friction_component(
        metrics.get("no_capacity_rate"),
        metrics.get("waitlist_rate"),
    )

    # Weighted aggregate in [-1, 1], centered near 0.
    raw = (
        0.25 * response_component
        + 0.30 * acceptance_component
        + 0.30 * capacity_component
        + 0.15 * intake_component
    )

    # Signals provide small deterministic nudges, not independent scoring.
    signals = derive_behavior_signals(metrics)
    raw += _signal_nudge(signals)
    raw = _clamp(raw, -1.0, 1.0)

    modifier = raw * _MAX_BEHAVIOR_MODIFIER * history_factor
    return round(_clamp(modifier, -_MAX_BEHAVIOR_MODIFIER, _MAX_BEHAVIOR_MODIFIER), 4)


def _history_confidence_factor(total_cases: int) -> float:
    if total_cases <= 0:
        return 0.0
    if total_cases <= 2:
        return 0.15
    if total_cases <= 5:
        return 0.35
    if total_cases <= 10:
        return 0.55
    if total_cases <= 20:
        return 0.75
    return 1.0


def _response_reliability_component(avg_response_time_hours: Optional[float]) -> float:
    if avg_response_time_hours is None:
        return 0.0

    hours = float(avg_response_time_hours)
    if hours <= 24:
        return 0.8
    if hours >= 96:
        return -0.8
    # Linear transition: 24h -> +0.8, 96h -> -0.8
    slope = -1.6 / 72.0
    return _clamp(0.8 + (hours - 24.0) * slope, -0.8, 0.8)


def _centered_rate_component(rate: Optional[float], *, baseline: float) -> float:
    if rate is None:
        return 0.0
    span = max(baseline, 1.0 - baseline)
    if span <= 0:
        return 0.0
    return _clamp((float(rate) - baseline) / span, -1.0, 1.0)


def _capacity_friction_component(
    no_capacity_rate: Optional[float],
    waitlist_rate: Optional[float],
) -> float:
    observed = []
    if no_capacity_rate is not None:
        observed.append((float(no_capacity_rate), 0.7))
    if waitlist_rate is not None:
        observed.append((float(waitlist_rate), 0.3))
    if not observed:
        return 0.0

    weighted_total = sum(value * weight for value, weight in observed)
    total_weight = sum(weight for _, weight in observed)
    friction_rate = weighted_total / total_weight if total_weight else 0.0

    # <= 15% is mildly positive (stable), >= 55% is strongly negative.
    return _clamp((0.15 - friction_rate) / 0.40, -1.0, 1.0)


def _signal_nudge(signals: Dict[str, Optional[str]]) -> float:
    nudge = 0.0
    if signals.get("response_speed") == "fast":
        nudge += 0.06
    elif signals.get("response_speed") == "slow":
        nudge -= 0.06

    if signals.get("capacity_pattern") == "often_full":
        nudge -= 0.10
    elif signals.get("capacity_pattern") == "stable":
        nudge += 0.04

    if signals.get("intake_pattern") == "high_success":
        nudge += 0.04
    elif signals.get("intake_pattern") == "variable":
        nudge -= 0.03

    return nudge


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def describe_behavior_influence(
    provider_metrics: Dict[str, Any],
    signals: Optional[Dict[str, Optional[str]]] = None,
    *,
    close_call_applied: bool = False,
) -> list:
    """Return compact human-readable behavior influence explanations.

    The returned lines are qualitative only (no raw numeric modifier values),
    designed to be shown as secondary explanation context.
    """
    metrics = provider_metrics or {}
    signal_map = signals or derive_behavior_signals(metrics)

    total_cases = int(metrics.get("total_cases") or 0)
    notes = []

    if total_cases <= 2:
        notes.append("Limited provider history, behavioral influence kept neutral")
    else:
        response_speed = signal_map.get("response_speed")
        acceptance_pattern = signal_map.get("acceptance_pattern")
        capacity_pattern = signal_map.get("capacity_pattern")
        intake_pattern = signal_map.get("intake_pattern")

        if response_speed == "fast" and acceptance_pattern in {"high", "mixed"}:
            notes.append("Operationally reliable response pattern")
        elif response_speed == "slow":
            notes.append("Response follow-up appears slower than comparable providers")

        if capacity_pattern in {"limited", "often_full"}:
            notes.append("Frequent no-capacity responses reduced recommendation strength")

        if intake_pattern == "high_success":
            notes.append("Strong intake follow-through supports recommendation")
        elif intake_pattern == "variable":
            notes.append("Intake follow-through is variable, so fit checks remain leading")

        if not notes:
            notes.append("Behavioral influence remained secondary to care-fit factors")

    if close_call_applied:
        notes.append("Behavioral reliability slightly strengthened this recommendation")

    return notes
