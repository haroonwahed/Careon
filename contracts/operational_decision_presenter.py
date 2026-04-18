"""Operational decision presenter for UI-safe primitives.

This module centralizes presentation mapping from the operational decision
contract payload to template primitives. It intentionally contains no
business decision logic.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


ATTENTION_BAND_CONFIG: Dict[str, Dict[str, str]] = {
    "now": {
        "label": "Directe actie",
        "badge_class": "badge-critical",
        "severity": "critical",
    },
    "today": {
        "label": "Vandaag oppakken",
        "badge_class": "badge-high",
        "severity": "warning",
    },
    "monitor": {
        "label": "Monitoren",
        "badge_class": "badge-medium",
        "severity": "info",
    },
    "waiting": {
        "label": "Wacht op externe partij",
        "badge_class": "badge-blue",
        "severity": "info",
    },
}

PRIORITY_BADGE_CONFIG: Dict[str, Dict[str, str]] = {
    "first": {
        "label": "Hoogste prioriteit",
        "compact_label": "#1",
        "badge_class": "badge-critical",
    },
    "soon": {
        "label": "Eerst oppakken",
        "compact_label": "Eerst",
        "badge_class": "badge-high",
    },
    "monitor": {
        "label": "Monitoren",
        "compact_label": "Monitor",
        "badge_class": "badge-medium",
    },
    "waiting": {
        "label": "Wacht op externe partij",
        "compact_label": "Wachten",
        "badge_class": "badge-blue",
    },
    "escalate": {
        "label": "Escalatie aanbevolen",
        "compact_label": "Escalatie",
        "badge_class": "badge-critical",
    },
}

BOTTLENECK_META_CONFIG: Dict[str, Dict[str, str]] = {
    "assessment": {
        "label": "Vertraagt beoordeling",
        "badge_class": "badge-high",
        "blocked_copy": "Blokkeert matching voor deze casus",
    },
    "matching": {
        "label": "Blokkeert matching",
        "badge_class": "badge-critical",
        "blocked_copy": "Matching is geblokkeerd totdat beoordeling compleet is",
    },
    "placement": {
        "label": "Blokkeert plaatsing",
        "badge_class": "badge-high",
        "blocked_copy": "Doorstroom vertraagt richting plaatsing",
    },
}

ESCALATION_SIGNAL = {
    "label": "Escalatie aanbevolen",
    "badge_class": "badge-critical",
}


def _clean_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _as_int(value: Any, fallback: int) -> int:
    if isinstance(value, bool):
        return fallback
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return fallback


def _derive_priority_band(priority_rank: int, escalation_recommended: bool) -> str:
    if escalation_recommended:
        return "escalate"
    if priority_rank <= 5:
        return "first"
    if priority_rank <= 15:
        return "soon"
    if priority_rank <= 30:
        return "monitor"
    return "waiting"


def _build_signal_candidates(
    *,
    attention_band_value: str,
    attention_band: Dict[str, str],
    bottleneck_badge: Optional[Dict[str, str]],
    escalation_recommended: bool,
) -> List[Dict[str, str]]:
    candidates: List[Dict[str, str]] = []

    # Escalation always becomes the primary signal when active.
    if escalation_recommended:
        candidates.append(dict(ESCALATION_SIGNAL))

    if bottleneck_badge:
        candidates.append(
            {
                "label": bottleneck_badge["label"],
                "badge_class": bottleneck_badge["badge_class"],
            }
        )

    if attention_band_value in {"now", "today"}:
        candidates.append(
            {
                "label": attention_band["label"],
                "badge_class": attention_band["badge_class"],
            }
        )

    deduped: List[Dict[str, str]] = []
    seen_labels = set()
    for candidate in candidates:
        label = candidate.get("label")
        if not label or label in seen_labels:
            continue
        seen_labels.add(label)
        deduped.append(candidate)
    return deduped


def present_operational_decision(
    decision_payload: Dict[str, Any],
    *,
    action_defaults: Dict[str, str],
    impact_defaults: Dict[str, str],
    fallback_reason: str = "",
    priority_default_rank: int = 50,
) -> Dict[str, Any]:
    """Map decision contract data to consistent, density-safe UI primitives."""

    payload = decision_payload or {}
    recommended_action = payload.get("recommended_action") or {}
    impact_summary = payload.get("impact_summary") or {}

    attention_band_value = _clean_text(payload.get("attention_band")) or "monitor"
    attention_band = ATTENTION_BAND_CONFIG.get(
        attention_band_value,
        ATTENTION_BAND_CONFIG["monitor"],
    )

    bottleneck_state = _clean_text(payload.get("bottleneck_state")) or "none"
    bottleneck_meta = BOTTLENECK_META_CONFIG.get(bottleneck_state)
    bottleneck_badge = None
    if bottleneck_meta:
        bottleneck_badge = {
            "label": bottleneck_meta["label"],
            "badge_class": bottleneck_meta["badge_class"],
        }

    escalation_recommended = bool(payload.get("escalation_recommended"))

    priority_rank = _as_int(payload.get("priority_rank"), priority_default_rank)
    if priority_rank < 1:
        priority_rank = priority_default_rank

    priority_band = _clean_text(payload.get("priority_band")) or _derive_priority_band(
        priority_rank,
        escalation_recommended,
    )
    priority_badge = PRIORITY_BADGE_CONFIG.get(priority_band, PRIORITY_BADGE_CONFIG["monitor"])

    action_label = _clean_text(recommended_action.get("label")) or _clean_text(action_defaults.get("label"))
    action_reason = (
        _clean_text(recommended_action.get("reason"))
        or _clean_text(fallback_reason)
        or _clean_text(action_defaults.get("reason"))
    )
    action_url = _clean_text(recommended_action.get("url")) or _clean_text(action_defaults.get("url"))

    impact_text = _clean_text(impact_summary.get("text")) or _clean_text(impact_defaults.get("text"))
    impact_type = _clean_text(impact_summary.get("type")) or _clean_text(impact_defaults.get("type")) or "positive"

    action_block = {
        "action": {
            "label": action_label,
            "reason": action_reason,
            "url": action_url,
        },
        "impact": {
            "text": impact_text,
            "type": impact_type,
        },
    }

    signal_candidates = _build_signal_candidates(
        attention_band_value=attention_band_value,
        attention_band=attention_band,
        bottleneck_badge=bottleneck_badge,
        escalation_recommended=escalation_recommended,
    )
    primary_signal = signal_candidates[0] if signal_candidates else None
    secondary_signal = signal_candidates[1] if len(signal_candidates) > 1 else None
    badges = [signal for signal in [primary_signal, secondary_signal] if signal]

    priority_indicator = {
        "value": priority_band,
        "rank": priority_rank,
        "label": priority_badge["label"],
        "compact_label": priority_badge["compact_label"],
        "badge_class": priority_badge["badge_class"],
    }

    return {
        "primary_signal": primary_signal,
        "secondary_signal": secondary_signal,
        "action_block": action_block,
        "priority_indicator": priority_indicator,
        "badges": badges[:2],
        # Compatibility fields for existing templates.
        "recommended_action": action_block["action"],
        "impact_summary": action_block["impact"],
        "attention_band": {
            "value": attention_band_value,
            "label": attention_band["label"],
            "badge_class": attention_band["badge_class"],
            "severity": attention_band["severity"],
        },
        "priority_rank": priority_rank,
        "priority_badge": {
            "label": priority_badge["label"],
            "compact_label": priority_badge["compact_label"],
            "badge_class": priority_badge["badge_class"],
        },
        "bottleneck_state": bottleneck_state,
        "bottleneck_badge": bottleneck_badge,
        "bottleneck_descriptor": bottleneck_meta,
        "escalation_recommended": escalation_recommended,
        "strongest_signal": primary_signal,
        "strongest_signals": badges[:2],
        "signal_chips": badges[:2],
    }
