"""Zorg OS V3 – Tuning Configuration Layer.

Purpose
-------
Single authoritative registry of all configurable decision-intelligence
thresholds used across ``case_intelligence``, ``provider_outcome_aggregates``,
and the alert engine.

Design rules
------------
- All thresholds live here.  No module should hard-code a threshold value
  that appears in this registry.
- Defaults are conservative and reviewed against observability data.
- DB overrides are supported transparently via the existing governance
  ``SystemPolicyConfig`` mechanism (``get_policy_values``).  If the DB is
  unavailable the safe default is always returned.
- ``THRESHOLD_REGISTRY`` is the single source of truth for metadata (label,
  description, affected modules/reports).  It does NOT store resolved values.
- Callers use ``get_thresholds(*keys)`` for batch lookups (one DB query) or
  ``get_threshold(key)`` for a single value.
- ``build_threshold_summary()`` returns the full registry enriched with the
  currently active resolved value; it is used by the tuning admin view.

Public API
----------
THRESHOLD_REGISTRY     : dict[str, ThresholdMeta]
get_threshold(key)     -> int | float
get_thresholds(*keys)  -> dict[str, int | float]
build_threshold_summary() -> list[dict]
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Registry metadata type (for documentation; no runtime enforcement)
# ---------------------------------------------------------------------------

# Each entry has the shape:
# {
#   "default": <int|float>,
#   "type":    "int" | "float",
#   "label":   "<human-readable NL name>",
#   "description": "<what it controls>",
#   "affected_modules": [list of python module names],
#   "affected_reports": [list of report/view names],
# }

THRESHOLD_REGISTRY: Dict[str, Dict[str, Any]] = {
    # ── case_intelligence: wait / stall / staleness ────────────────────────
    "LONG_WAIT_DAYS_THRESHOLD": {
        "default": 28,
        "type": "int",
        "label": "Lange wachttijd (dagen)",
        "description": (
            "Wachttijddrempel in dagen. Boven deze waarde wordt een "
            "'lang_wait_risk' risicosignaal gegenereerd en activeert "
            "validate_capacity_wait als volgende actie."
        ),
        "affected_modules": ["case_intelligence"],
        "affected_reports": ["confidence_calibration", "scenario_validation"],
    },
    "PLACEMENT_STALL_DAYS": {
        "default": 7,
        "type": "int",
        "label": "Plaatsing stagneert (dagen)",
        "description": (
            "Aantal dagen dat een plaatsing op IN_REVIEW of NEEDS_INFO mag "
            "staan zonder voortgang voordat een 'placement_stalled' signaal "
            "en alert worden gegenereerd."
        ),
        "affected_modules": ["case_intelligence", "alert_engine"],
        "affected_reports": ["repeated_rejections", "scenario_validation"],
    },
    "PROVIDER_RESPONSE_DELAYED_DAYS": {
        "default": 3,
        "type": "int",
        "label": "Providerreactie vertraagd (dagen)",
        "description": (
            "Dagen na verzoek waarna een 'provider_response_delayed' "
            "signaal wordt gegenereerd voor PENDING/NEEDS_INFO responses."
        ),
        "affected_modules": ["case_intelligence"],
        "affected_reports": ["confidence_calibration"],
    },
    "PROVIDER_NOT_RESPONDING_DAYS": {
        "default": 7,
        "type": "int",
        "label": "Aanbieder reageert niet (dagen)",
        "description": (
            "Dagen na verzoek waarna een 'provider_not_responding' signaal "
            "wordt gegenereerd."
        ),
        "affected_modules": ["case_intelligence"],
        "affected_reports": ["confidence_calibration"],
    },
    "PROVIDER_NOT_RESPONDING_OVERDUE_DAYS": {
        "default": 5,
        "type": "int",
        "label": "Aanbieder reageert niet bij deadline (dagen)",
        "description": (
            "Dagen waarna 'provider_not_responding' al bij overschreden "
            "deadline wordt gegenereerd (kortere variant van "
            "PROVIDER_NOT_RESPONDING_DAYS)."
        ),
        "affected_modules": ["case_intelligence"],
        "affected_reports": ["confidence_calibration"],
    },
    "HIGH_URGENCY_RESPONSE_DELAY_DAYS": {
        "default": 2,
        "type": "int",
        "label": "Urgente casus reactievertraging (dagen)",
        "description": (
            "Reactiedagen na verzoek waarna HIGH/CRISIS casussen een "
            "'high_urgency_response_delay' signaal ontvangen."
        ),
        "affected_modules": ["case_intelligence"],
        "affected_reports": ["confidence_calibration"],
    },
    "STALE_CASE_DAYS": {
        "default": 10,
        "type": "int",
        "label": "Casus verouderd (dagen)",
        "description": (
            "Dagen zonder bijwerking waarna een 'stale_case' signaal "
            "wordt gegenereerd."
        ),
        "affected_modules": ["case_intelligence"],
        "affected_reports": ["noisy_rules"],
    },
    # ── provider_outcome_aggregates: evidence / acceptance rates ───────────
    "MIN_EVALUATIONS_SUFFICIENT": {
        "default": 3,
        "type": "int",
        "label": "Minimaal evaluaties (voldoende bewijs)",
        "description": (
            "Minimaal aantal aanbiederbeoordelingen voordat een acceptatie- "
            "of afwijzingspercentage als betrouwbaar wordt beschouwd."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["confidence_calibration", "rejection_taxonomy"],
    },
    "LOW_ACCEPTANCE_THRESHOLD": {
        "default": 0.40,
        "type": "float",
        "label": "Lage acceptatiegraad (drempel)",
        "description": (
            "Acceptatiepercentage waaronder een lichte confidence-penalty "
            "(PENALTY_LOW_ACCEPTANCE) wordt toegepast."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["confidence_calibration", "weak_match_false_positive"],
    },
    "VERY_LOW_ACCEPTANCE_THRESHOLD": {
        "default": 0.20,
        "type": "float",
        "label": "Zeer lage acceptatiegraad (drempel)",
        "description": (
            "Acceptatiepercentage waaronder een zware confidence-penalty "
            "(PENALTY_VERY_LOW_ACCEPTANCE) wordt toegepast."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["confidence_calibration", "weak_match_false_positive"],
    },
    "HIGH_REJECTION_THRESHOLD": {
        "default": 0.60,
        "type": "float",
        "label": "Hoge afwijzingsgraad (drempel)",
        "description": (
            "Afwijzingspercentage waarboven een 'evaluation_high_rejection' "
            "waarschuwing wordt gegenereerd en de aanbieder als risicovolaabieder "
            "in de Regiekamer verschijnt."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["rejection_taxonomy", "repeated_rejections"],
    },
    "HIGH_NEEDS_INFO_THRESHOLD": {
        "default": 0.30,
        "type": "float",
        "label": "Hoge informatiebehoefte (drempel)",
        "description": (
            "Needs-more-info percentage waarboven verificatiebegeleiding "
            "wordt gegenereerd voor matching kandidaten."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["noisy_rules"],
    },
    "HIGH_CAPACITY_FLAG_THRESHOLD": {
        "default": 0.40,
        "type": "float",
        "label": "Hoge capaciteitsvlag-graad (often_full)",
        "description": (
            "Capaciteitsvlagpercentage waarboven een aanbieder als 'often_full' "
            "wordt geclassificeerd."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["rejection_taxonomy"],
    },
    "CAPACITY_LIMITED_BAND": {
        "default": 0.20,
        "type": "float",
        "label": "Beperkte capaciteitsvlag-graad (limited)",
        "description": (
            "Capaciteitsvlagpercentage waarboven een aanbieder als 'limited' "
            "wordt geclassificeerd (onder HIGH_CAPACITY_FLAG_THRESHOLD)."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["rejection_taxonomy"],
    },
    "REGIEKAMER_MIN_EVALUATIONS": {
        "default": 3,
        "type": "int",
        "label": "Regiekamer minimaal evaluaties",
        "description": (
            "Minimaal aantal beoordelingen voordat een aanbieder in de "
            "Regiekamer aanbiedersgezondheidsoverzicht kan verschijnen."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["repeated_rejections"],
    },
    "PENALTY_LOW_ACCEPTANCE": {
        "default": 0.10,
        "type": "float",
        "label": "Confidence-penalty lage acceptatiegraad",
        "description": (
            "Kwantitatieve verlaging op de confidence-score (als aandeel) "
            "wanneer de acceptatiegraad onder LOW_ACCEPTANCE_THRESHOLD ligt."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["confidence_calibration", "weak_match_false_positive"],
    },
    "PENALTY_VERY_LOW_ACCEPTANCE": {
        "default": 0.20,
        "type": "float",
        "label": "Confidence-penalty zeer lage acceptatiegraad",
        "description": (
            "Kwantitatieve verlaging op de confidence-score (als aandeel) "
            "wanneer de acceptatiegraad onder VERY_LOW_ACCEPTANCE_THRESHOLD ligt."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["confidence_calibration", "weak_match_false_positive"],
    },
    "BOUNCING_CASE_MIN_EVALUATIONS": {
        "default": 2,
        "type": "int",
        "label": "Bouncende casus (minimaal afwijzingen)",
        "description": (
            "Minimaal aantal afwijzingen per casus voordat deze als "
            "'bouncend' (herhaald afgewezen) wordt gerapporteerd in de "
            "Regiekamer."
        ),
        "affected_modules": ["provider_outcome_aggregates"],
        "affected_reports": ["repeated_rejections"],
    },
}


# ---------------------------------------------------------------------------
# Resolved defaults (for batch lookup)
# ---------------------------------------------------------------------------

_THRESHOLD_DEFAULTS: Dict[str, Any] = {
    k: v["default"] for k, v in THRESHOLD_REGISTRY.items()
}


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

def get_thresholds(*keys: str) -> Dict[str, Any]:
    """Return a dict of resolved threshold values for the given keys.

    Uses the governance ``get_policy_values`` mechanism — resolved values
    come from ``SystemPolicyConfig`` DB rows when present; safe registry
    defaults otherwise.  Never raises.

    Parameters
    ----------
    *keys:
        Threshold keys to resolve.  Must exist in ``THRESHOLD_REGISTRY``.
        Unknown keys are silently skipped.

    Returns
    -------
    dict
        Mapping of key → resolved value (int or float).
    """
    if not keys:
        return {}

    # Build the default map only for the requested keys.
    request_defaults = {k: _THRESHOLD_DEFAULTS[k] for k in keys if k in _THRESHOLD_DEFAULTS}

    if not request_defaults:
        return {}

    try:
        from contracts.governance import get_policy_values
        return get_policy_values(request_defaults)
    except Exception:
        logger.exception("get_thresholds: governance lookup failed; using registry defaults")
        return dict(request_defaults)


def get_threshold(key: str) -> Any:
    """Return a single resolved threshold value.

    Convenience wrapper around ``get_thresholds``.
    """
    result = get_thresholds(key)
    return result.get(key, _THRESHOLD_DEFAULTS.get(key))


def build_threshold_summary() -> List[Dict[str, Any]]:
    """Return the full registry enriched with currently active resolved values.

    Used by the tuning admin view.  Performs a single batch DB lookup for
    all registered thresholds.  Never raises — missing DB rows fall back to
    registry defaults.

    Returns
    -------
    list[dict]
        One dict per threshold, sorted by affected_modules then key.
        Each dict includes: key, label, description, default_value,
        resolved_value, type, affected_modules, affected_reports,
        is_overridden (True when resolved != default).
    """
    all_keys = list(THRESHOLD_REGISTRY.keys())
    resolved = get_thresholds(*all_keys)

    rows = []
    for key, meta in THRESHOLD_REGISTRY.items():
        default_val = meta["default"]
        resolved_val = resolved.get(key, default_val)
        is_overridden = resolved_val != default_val
        rows.append({
            "key": key,
            "label": meta["label"],
            "description": meta["description"],
            "type": meta["type"],
            "default_value": default_val,
            "resolved_value": resolved_val,
            "is_overridden": is_overridden,
            "affected_modules": meta["affected_modules"],
            "affected_reports": meta["affected_reports"],
        })

    # Sort: overridden first, then by primary affected_module, then key.
    rows.sort(key=lambda r: (not r["is_overridden"], r["affected_modules"][0] if r["affected_modules"] else "z", r["key"]))
    return rows
