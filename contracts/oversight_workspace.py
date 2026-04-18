"""Oversight workspace data providers for Gemeenten / Regio pages.

Design level: MEDIUM — strategic aggregation, no tactical urgency.
No command bars, no case-level triage, no heavy predictive framing.

Answers:
  - Where is pressure rising?
  - Which providers or flow stages are under strain?
  - What regional intervention may help?
"""
from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# Thresholds
# ---------------------------------------------------------------------------
PROVIDER_CAPACITY_PRESSURE_RATIO = 0.80   # fraction of max_capacity considered under pressure
WAIT_ELEVATED_DAYS = 14                   # avg wait days considered elevated
HIGH_WAITLIST_COUNT = 5                   # waitlist items considered high


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _provider_capacity_pressure(providers) -> dict[str, Any]:
    """Return aggregated capacity pressure derived from a linked-provider queryset."""
    total = providers.count()
    if total == 0:
        return {
            "total": 0,
            "under_pressure": 0,
            "tone": "neutral",
            "label": "Geen aanbieders",
            "has_data": False,
        }

    under_pressure = 0
    has_profile_data = False

    for client in providers.select_related("provider_profile"):
        profile = getattr(client, "provider_profile", None)
        if profile is None:
            continue
        has_profile_data = True
        cap = profile.current_capacity
        max_cap = profile.max_capacity
        if cap is not None and max_cap and max_cap > 0:
            if cap >= max_cap * PROVIDER_CAPACITY_PRESSURE_RATIO:
                under_pressure += 1
        elif profile.waiting_list_length and profile.waiting_list_length >= HIGH_WAITLIST_COUNT:
            under_pressure += 1

    if not has_profile_data:
        return {
            "total": total,
            "under_pressure": 0,
            "tone": "neutral",
            "label": "Capaciteitsdata niet ingericht",
            "has_data": False,
        }

    if under_pressure == 0:
        tone = "good"
        label = "Capaciteit beschikbaar"
    elif under_pressure >= max(2, total // 2):
        tone = "critical"
        label = f"{under_pressure} aanbieders onder capaciteitsdruk"
    else:
        plural = "s" if under_pressure > 1 else ""
        tone = "warning"
        label = f"{under_pressure} aanbieder{plural} onder druk"

    return {
        "total": total,
        "under_pressure": under_pressure,
        "tone": tone,
        "label": label,
        "has_data": True,
    }


def _provider_wait_pressure(providers) -> dict[str, Any]:
    """Return aggregated wait pressure derived from a linked-provider queryset."""
    wait_days: list[int] = []

    for client in providers.select_related("provider_profile"):
        profile = getattr(client, "provider_profile", None)
        if profile and profile.average_wait_days:
            wait_days.append(profile.average_wait_days)

    if not wait_days:
        return {
            "has_data": False,
            "avg_days": None,
            "elevated_count": 0,
            "tone": "neutral",
            "label": "Geen wachtdata beschikbaar",
        }

    avg = round(sum(wait_days) / len(wait_days))
    elevated = sum(1 for d in wait_days if d >= WAIT_ELEVATED_DAYS)

    if elevated == 0:
        tone = "good"
        label = f"Gem. wachttijd {avg} dagen"
    elif elevated >= max(2, len(wait_days) // 2):
        tone = "critical"
        label = f"Verhoogde wachttijd — gem. {avg} dagen"
    else:
        tone = "warning"
        label = f"Gedeeltelijk verhoogd — gem. {avg} dagen"

    return {
        "has_data": True,
        "avg_days": avg,
        "elevated_count": elevated,
        "tone": tone,
        "label": label,
    }


def _derive_oversight_tone(capacity_pressure: dict, wait_pressure: dict) -> tuple[str, str]:
    """Return (tone, label) for the combined oversight signal."""
    tones = {capacity_pressure["tone"], wait_pressure["tone"]}
    if "critical" in tones:
        return "critical", "Druk hoog"
    if "warning" in tones:
        return "warning", "Druk gedetecteerd"
    return "neutral", "Geen signalen"


# ---------------------------------------------------------------------------
# Municipality helpers
# ---------------------------------------------------------------------------

def build_municipality_list_summary(municipalities) -> dict[str, Any]:
    """Aggregate pressure signals for the municipality list page.

    Lightweight — only uses already-prefetched data (no extra profile queries).
    """
    total = municipalities.count()
    if total == 0:
        return {"total": 0, "pressure_signal": None, "missing_norm_count": 0}

    missing_norm = sum(1 for m in municipalities if not m.max_wait_days)
    pressure_signal = None

    if missing_norm >= 3:
        pressure_signal = {
            "tone": "warning",
            "message": (
                f"{missing_norm} gemeenten hebben geen wachttijdnorm ingesteld — "
                "prestatiesturing is beperkt"
            ),
        }

    return {
        "total": total,
        "missing_norm_count": missing_norm,
        "norm_count": total - missing_norm,
        "pressure_signal": pressure_signal,
    }


def build_municipality_oversight_row(municipality: Any) -> dict[str, Any]:
    """Build per-row oversight data for the municipality list table.

    Called per object — assumes `linked_providers` is prefetched.
    Keeps signal lightweight (count-based) to avoid N+1 profile queries.
    """
    provider_count = municipality.linked_providers.count()
    wait_norm_missing = municipality.max_wait_days is None

    if provider_count == 0:
        oversight_tone = "neutral"
        oversight_label = "Geen aanbieders"
    elif wait_norm_missing:
        oversight_tone = "warning"
        oversight_label = "Norm niet ingesteld"
    else:
        oversight_tone = "neutral"
        oversight_label = "Ingericht"

    return {
        "oversight_tone": oversight_tone,
        "oversight_label": oversight_label,
        "wait_norm_missing": wait_norm_missing,
        "provider_count": provider_count,
    }


def build_municipality_detail_summary(municipality: Any) -> dict[str, Any]:
    """Build pressure summary for municipality detail view.

    Full profile analysis — called once per detail page.
    """
    providers = municipality.linked_providers
    capacity_pressure = _provider_capacity_pressure(providers)
    wait_pressure = _provider_wait_pressure(providers)

    context_strip = None
    if capacity_pressure["tone"] == "critical":
        context_strip = {
            "tone": "critical",
            "message": capacity_pressure["label"],
        }
    elif wait_pressure["tone"] == "critical":
        context_strip = {
            "tone": "critical",
            "message": wait_pressure["label"],
        }
    elif capacity_pressure["tone"] == "warning":
        context_strip = {
            "tone": "warning",
            "message": capacity_pressure["label"],
        }
    elif wait_pressure["tone"] == "warning":
        context_strip = {
            "tone": "warning",
            "message": wait_pressure["label"],
        }
    elif municipality.max_wait_days is None and providers.count() > 0:
        context_strip = {
            "tone": "warning",
            "message": "Wachttijdnorm is niet ingesteld — prestatiesturing niet mogelijk",
        }

    return {
        "capacity_pressure": capacity_pressure,
        "wait_pressure": wait_pressure,
        "context_strip": context_strip,
        "wait_norm_risk": municipality.max_wait_days is None,
    }


# ---------------------------------------------------------------------------
# Regional helpers
# ---------------------------------------------------------------------------

def build_regional_list_summary(regions) -> dict[str, Any]:
    """Aggregate pressure signals for the regional list page.

    Lightweight — count-based only.
    """
    total = regions.count()
    if total == 0:
        return {"total": 0, "pressure_signal": None, "empty_region_count": 0}

    empty_regions = sum(1 for r in regions if r.municipality_count == 0)
    pressure_signal = None

    if empty_regions >= 2:
        pressure_signal = {
            "tone": "warning",
            "message": (
                f"{empty_regions} zorgregio's hebben nog geen bediende gemeenten — "
                "regionaal overzicht is onvolledig"
            ),
        }

    return {
        "total": total,
        "empty_region_count": empty_regions,
        "pressure_signal": pressure_signal,
    }


def build_regional_oversight_row(region: Any) -> dict[str, Any]:
    """Build per-row oversight data for the regional list table.

    Count-based to avoid N+1.
    """
    provider_count = region.linked_providers.count()
    municipality_count = region.municipality_count
    wait_norm_missing_count = region.served_municipalities.filter(max_wait_days__isnull=True).count()

    if municipality_count == 0:
        oversight_tone = "warning"
        oversight_label = "Geen gemeenten gekoppeld"
    elif wait_norm_missing_count > 0:
        oversight_tone = "warning"
        oversight_label = f"{wait_norm_missing_count} gemeenten zonder norm"
    else:
        oversight_tone = "neutral"
        oversight_label = "Ingericht"

    return {
        "oversight_tone": oversight_tone,
        "oversight_label": oversight_label,
        "provider_count": provider_count,
        "municipality_count": municipality_count,
        "wait_norm_missing_count": wait_norm_missing_count,
    }


def build_regional_detail_summary(region: Any) -> dict[str, Any]:
    """Build pressure summary for regional detail view.

    Full profile analysis — called once per detail page.
    """
    providers = region.linked_providers
    municipalities = region.served_municipalities

    capacity_pressure = _provider_capacity_pressure(providers)
    wait_pressure = _provider_wait_pressure(providers)

    total_muni = municipalities.count()
    missing_norm = municipalities.filter(max_wait_days__isnull=True).count()

    context_strip = None
    if capacity_pressure["tone"] == "critical":
        context_strip = {
            "tone": "critical",
            "message": capacity_pressure["label"],
        }
    elif wait_pressure["tone"] == "critical":
        context_strip = {
            "tone": "critical",
            "message": wait_pressure["label"],
        }
    elif capacity_pressure["tone"] == "warning" or wait_pressure["tone"] == "warning":
        context_strip = {
            "tone": "warning",
            "message": "Verhoogde druk gedetecteerd bij aanbieders in deze regio",
        }
    elif missing_norm > 0:
        context_strip = {
            "tone": "warning",
            "message": (
                f"{missing_norm} van {total_muni} gemeenten hebben geen wachttijdnorm — "
                "regionale prestatievergelijking is beperkt"
            ),
        }

    return {
        "capacity_pressure": capacity_pressure,
        "wait_pressure": wait_pressure,
        "missing_norm_count": missing_norm,
        "total_municipality_count": total_muni,
        "context_strip": context_strip,
    }
