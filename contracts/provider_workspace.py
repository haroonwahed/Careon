from __future__ import annotations

from typing import Any

from .models import Client


WAIT_PRESSURE_ELEVATED_DAYS = 8
WAIT_PRESSURE_HIGH_DAYS = 21
WAITLIST_ELEVATED_COUNT = 4
WAITLIST_HIGH_COUNT = 10


def _compact_list(values: list[str], *, max_items: int = 2) -> str:
    if not values:
        return "—"
    compact = values[:max_items]
    suffix = "" if len(values) <= max_items else f" +{len(values) - max_items}"
    return ", ".join(compact) + suffix


def _capability_badges(profile: Any) -> list[str]:
    if not profile:
        return []

    badges: list[str] = []
    if profile.offers_crisis:
        badges.append("Crisis")
    if profile.offers_residential:
        badges.append("Residentieel")
    if profile.offers_day_treatment:
        badges.append("Dagbehandeling")
    if profile.offers_outpatient:
        badges.append("Ambulant")
    return badges[:2]


def _region_names(profile: Any) -> list[str]:
    if not profile:
        return []
    return [region.region_name for region in profile.served_regions.all()]


def _has_wait_data(profile: Any, wait_entries: list[Any]) -> bool:
    if wait_entries:
        return True
    if not profile:
        return False
    return bool(profile.average_wait_days or profile.waiting_list_length)


def _wait_snapshot(profile: Any, wait_entries: list[Any]) -> dict[str, Any]:
    if wait_entries:
        avg_wait_days = round(sum(entry.wait_days for entry in wait_entries) / len(wait_entries))
        open_slots = sum(entry.open_slots for entry in wait_entries)
        waiting_list_size = sum(entry.waiting_list_size for entry in wait_entries)
        return {
            "has_wait_data": True,
            "avg_wait_days": avg_wait_days,
            "open_slots": open_slots,
            "waiting_list_size": waiting_list_size,
        }

    return {
        "has_wait_data": _has_wait_data(profile, wait_entries),
        "avg_wait_days": profile.average_wait_days if profile and _has_wait_data(profile, wait_entries) else None,
        "open_slots": profile.current_capacity if profile else None,
        "waiting_list_size": profile.waiting_list_length if profile and _has_wait_data(profile, wait_entries) else None,
    }


def _capacity_state(client: Client, profile: Any, snapshot: dict[str, Any]) -> dict[str, Any]:
    if client.status in {Client.Status.INACTIVE, Client.Status.FORMER}:
        return {
            "key": "closed",
            "label": "Niet inzetbaar",
            "detail": "Aanbieder staat niet open voor nieuwe instroom.",
            "tone": "critical",
            "slots": 0,
        }

    available_slots = snapshot["open_slots"] if snapshot["open_slots"] is not None else None
    max_capacity = profile.max_capacity if profile else None

    if not profile and available_slots is None:
        return {
            "key": "unknown",
            "label": "Niet ingericht",
            "detail": "Capaciteit is nog niet vastgelegd.",
            "tone": "neutral",
            "slots": None,
        }

    if available_slots is None:
        available_slots = profile.current_capacity if profile else None

    if available_slots is None:
        return {
            "key": "unknown",
            "label": "Niet ingericht",
            "detail": "Capaciteit is nog niet vastgelegd.",
            "tone": "neutral",
            "slots": None,
        }

    if available_slots <= 0:
        detail = "0 open plekken"
        if max_capacity:
            detail = f"0 open van {max_capacity} plekken"
        return {
            "key": "full",
            "label": "Capaciteit op",
            "detail": detail,
            "tone": "critical",
            "slots": 0,
        }

    if available_slots == 1:
        detail = "1 open plek"
        if max_capacity:
            detail = f"1 open van {max_capacity} plekken"
        return {
            "key": "limited",
            "label": "Beperkte ruimte",
            "detail": detail,
            "tone": "warning",
            "slots": 1,
        }

    detail = f"{available_slots} open plekken"
    if max_capacity:
        detail = f"{available_slots} open van {max_capacity} plekken"
    return {
        "key": "open",
        "label": "Ruimte beschikbaar",
        "detail": detail,
        "tone": "good",
        "slots": available_slots,
    }


def _wait_pressure(profile: Any, snapshot: dict[str, Any]) -> dict[str, Any]:
    wait_days = snapshot["avg_wait_days"]
    waiting_list_size = snapshot["waiting_list_size"]

    if not snapshot["has_wait_data"] and not profile:
        return {
            "key": "unknown",
            "label": "Geen wachttijddata",
            "detail": "Wachtdruk is nog niet ingevuld.",
            "tone": "neutral",
        }

    if not snapshot["has_wait_data"]:
        return {
            "key": "unknown",
            "label": "Geen wachttijddata",
            "detail": "Wachtdruk is nog niet ingevuld.",
            "tone": "neutral",
        }

    detail_bits: list[str] = []
    if wait_days is not None:
        detail_bits.append(f"Gem. wachttijd {wait_days} dagen")
    if waiting_list_size:
        detail_bits.append(f"Wachtlijst {waiting_list_size}")
    detail = " • ".join(detail_bits) if detail_bits else "Wachtdruk is nog niet ingevuld."

    if (wait_days or 0) >= WAIT_PRESSURE_HIGH_DAYS or (waiting_list_size or 0) >= WAITLIST_HIGH_COUNT:
        return {
            "key": "high",
            "label": "Wachtdruk hoog",
            "detail": detail,
            "tone": "critical",
        }

    if (wait_days or 0) >= WAIT_PRESSURE_ELEVATED_DAYS or (waiting_list_size or 0) >= WAITLIST_ELEVATED_COUNT:
        return {
            "key": "elevated",
            "label": "Wachtdruk verhoogd",
            "detail": detail,
            "tone": "warning",
        }

    return {
        "key": "stable",
        "label": "Wachtdruk beheersbaar",
        "detail": detail,
        "tone": "good",
    }


def _operational_signal(client: Client, profile: Any, capacity_state: dict[str, Any], wait_pressure: dict[str, Any]) -> dict[str, str]:
    capability_badges = _capability_badges(profile)

    if not profile:
        return {
            "label": "Profiel aanvullen",
            "detail": "Regio, zorgvormen en capaciteit ontbreken nog.",
            "tone": "neutral",
        }

    if not capability_badges:
        return {
            "label": "Profiel aanvullen",
            "detail": "Zorgvormen zijn nog niet gekoppeld aan deze aanbieder.",
            "tone": "neutral",
        }

    if capacity_state["key"] in {"full", "closed"} and wait_pressure["key"] == "high":
        return {
            "label": "Wachtlijst actief",
            "detail": "Geen directe instroom en oplopende wachtdruk.",
            "tone": "critical",
        }

    if client.status == Client.Status.PROSPECTIVE:
        return {
            "label": "Beperkt inzetbaar",
            "detail": "Beschikbaarheid is nog in afstemming.",
            "tone": "warning",
        }

    if capacity_state["key"] in {"full", "closed"}:
        return {
            "label": "Instroom gepauzeerd",
            "detail": "Nieuwe plaatsingen vragen eerst extra ruimte of herplanning.",
            "tone": "critical",
        }

    if capacity_state["key"] == "limited" or wait_pressure["key"] == "elevated":
        return {
            "label": "Instroom bewaken",
            "detail": "Beperkte ruimte voor nieuwe plaatsingen.",
            "tone": "warning",
        }

    if wait_pressure["key"] == "high":
        return {
            "label": "Beschikbaarheid onder druk",
            "detail": "Instroom is mogelijk, maar wachttijd loopt op.",
            "tone": "warning",
        }

    return {
        "label": "Operationeel beschikbaar",
        "detail": "Instroom is mogelijk binnen de huidige capaciteit.",
        "tone": "good",
    }


def build_provider_workspace_rows(clients: list[Client]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for client in clients:
        profile = getattr(client, "provider_profile", None)
        wait_entries = list(client.wait_time_entries.all())
        snapshot = _wait_snapshot(profile, wait_entries)
        capacity_state = _capacity_state(client, profile, snapshot)
        wait_pressure = _wait_pressure(profile, snapshot)
        operational_signal = _operational_signal(client, profile, capacity_state, wait_pressure)
        capability_badges = _capability_badges(profile)
        regions = _region_names(profile)

        contact_primary = client.primary_contact or client.email or client.primary_contact_email or "—"
        contact_secondary = client.primary_contact_email or client.phone or client.primary_contact_phone or ""

        rows.append(
            {
                "client": client,
                "capacity_state": capacity_state,
                "wait_pressure": wait_pressure,
                "operational_signal": operational_signal,
                "capability_badges": capability_badges,
                "capability_summary": _compact_list(capability_badges) if capability_badges else "Zorgvormen nog niet ingesteld",
                "region_summary": _compact_list(regions),
                "regions": regions,
                "contact_primary": contact_primary,
                "contact_secondary": contact_secondary,
                "wait_days": snapshot["avg_wait_days"],
                "waiting_list_size": snapshot["waiting_list_size"] or 0,
                "open_slots": capacity_state["slots"],
                "has_profile": profile is not None,
            }
        )

    return rows


def build_provider_workspace_summary(clients: list[Client]) -> dict[str, Any]:
    rows = build_provider_workspace_rows(clients)
    provider_count = len(rows)
    direct_capacity_count = sum(
        1
        for row in rows
        if row["capacity_state"]["key"] == "open" and row["wait_pressure"]["key"] in {"stable", "elevated"}
    )
    pressure_capacity_count = sum(1 for row in rows if row["capacity_state"]["key"] in {"limited", "full", "closed"})
    high_wait_count = sum(1 for row in rows if row["wait_pressure"]["key"] == "high")
    partial_data_count = sum(
        1
        for row in rows
        if not row["has_profile"]
        or row["wait_pressure"]["key"] == "unknown"
        or row["capability_summary"] == "Zorgvormen nog niet ingesteld"
    )
    total_open_slots = sum(row["open_slots"] or 0 for row in rows)

    subtle_summary = None
    if pressure_capacity_count >= 3:
        subtle_summary = f"{pressure_capacity_count} aanbieders in selectie zitten op beperkte of nul capaciteit."
    elif high_wait_count >= 3:
        subtle_summary = f"{high_wait_count} aanbieders in selectie hebben hoge wachtdruk."
    elif partial_data_count >= 3:
        subtle_summary = f"{partial_data_count} aanbieders missen nog profiel- of wachttijdinformatie."

    regional_capacity_summary = None
    if provider_count >= 4 and pressure_capacity_count >= 2:
        regional_capacity_summary = f"{pressure_capacity_count} aanbieders in deze selectie zitten op of boven capaciteit."

    return {
        "provider_count": provider_count,
        "direct_capacity_count": direct_capacity_count,
        "pressure_capacity_count": pressure_capacity_count,
        "high_wait_count": high_wait_count,
        "partial_data_count": partial_data_count,
        "total_open_slots": total_open_slots,
        "subtle_summary": subtle_summary,
        "regional_capacity_summary": regional_capacity_summary,
    }