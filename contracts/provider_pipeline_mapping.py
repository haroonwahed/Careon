"""
Provider Pipeline — Mapping Rules and Normalization Layer.

Rules defined here govern how external source fields are translated into
the canonical internal model. No external field ever reaches the UI or
matching engine without passing through this module.

Terminology:
  source_payload  -- raw dict from external system (immutable staging record)
  canonical_data  -- normalized dict ready for internal model write
"""

from __future__ import annotations

import re
from typing import Any

# ---------------------------------------------------------------------------
# Provider type mapping: external strings -> ProviderType choices
# ---------------------------------------------------------------------------

_PROVIDER_TYPE_MAP: dict[str, str] = {
    "residentieel": "RESIDENTIEEL",
    "residentiële zorg": "RESIDENTIEEL",
    "residentiele zorg": "RESIDENTIEEL",
    "residential": "RESIDENTIEEL",
    "ambulant": "AMBULANT",
    "ambulante begeleiding": "AMBULANT",
    "ambulante zorg": "AMBULANT",
    "dagbehandeling": "DAGBEHANDELING",
    "dag behandeling": "DAGBEHANDELING",
    "day treatment": "DAGBEHANDELING",
    "thuisbegeleiding": "THUISBEGELEIDING",
    "home care": "THUISBEGELEIDING",
    "crisisopvang": "CRISISOPVANG",
    "crisis": "CRISISOPVANG",
    "crisis care": "CRISISOPVANG",
}


def normalize_provider_type(raw: str | None) -> str:
    if not raw:
        return "OVERIG"
    key = raw.strip().lower()
    return _PROVIDER_TYPE_MAP.get(key, "OVERIG")


# ---------------------------------------------------------------------------
# Region code normalization
# ---------------------------------------------------------------------------

_REGION_CODE_MAP: dict[str, str] = {
    "utrecht": "NL-UT",
    "amsterdam": "NL-NH-AMS",
    "rotterdam": "NL-ZH-RTD",
    "den haag": "NL-ZH-DHG",
    "the hague": "NL-ZH-DHG",
    "eindhoven": "NL-NB-EHV",
    "nijmegen": "NL-GD-NJM",
    "arnhem": "NL-GD-ARN",
    "zwolle": "NL-OV-ZWO",
    "haarlem": "NL-NH-HRM",
}


def normalize_region_code(raw: str | None) -> str:
    if not raw:
        return ""
    return _REGION_CODE_MAP.get(raw.strip().lower(), raw.strip().upper())


def normalize_region_list(raw: str | list | None) -> str:
    """Return comma-separated canonical region codes."""
    if not raw:
        return ""
    items = raw if isinstance(raw, list) else [raw]
    return ",".join(normalize_region_code(r) for r in items if r)


def normalize_agb_code(raw: str | None) -> str:
    if not raw:
        return ""
    cleaned = re.sub(r"[^0-9]", "", str(raw))
    return cleaned.zfill(8)[:8] if cleaned else ""


def normalize_kvk(raw: str | None) -> str:
    if not raw:
        return ""
    cleaned = re.sub(r"[^0-9]", "", str(raw))
    return cleaned[:8]


def normalize_postcode(raw: str | None) -> str:
    if not raw:
        return ""
    return re.sub(r"\s+", "", str(raw)).upper()


def coerce_bool(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, int):
        return bool(raw)
    if isinstance(raw, str):
        return raw.strip().lower() in ("true", "1", "ja", "yes")
    return False


# ---------------------------------------------------------------------------
# Field alias map
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = ("source_id",)

_FIELD_ALIASES: dict[str, list[str]] = {
    "name": ["name", "naam", "organisatienaam", "provider_name"],
    "short_name": ["short_name", "kortenaam", "afkorting"],
    "agb_code": ["agb_code", "agb", "agbcode", "provider_agb"],
    "kvk_number": ["kvk", "kvk_number", "kvknummer", "chamber_of_commerce"],
    "provider_type": ["type", "zorgvorm", "provider_type", "care_type"],
    "website": ["website", "url"],
    "email": ["email", "emailadres", "contact_email"],
    "phone": ["phone", "telefoon", "tel", "contact_phone"],
    "vestiging_code": ["vestiging_code", "location_id", "branch_id"],
    "address": ["address", "adres", "straat"],
    "city": ["city", "stad", "gemeente"],
    "postcode": ["postcode", "zip", "zipcode"],
    "region": ["region", "regio"],
    "latitude": ["latitude", "lat"],
    "longitude": ["longitude", "lng", "lon"],
    "open_slots": ["open_slots", "beschikbare_plekken", "available_spots", "capacity"],
    "waiting_list_size": ["waiting_list_size", "wachtlijst", "wachtenden"],
    "avg_wait_days": ["avg_wait_days", "gemiddelde_wachttijd", "average_wait_days"],
    "max_capacity": ["max_capacity", "maximale_capaciteit"],
    "biedt_ambulant": ["biedt_ambulant", "ambulant"],
    "biedt_dagbehandeling": ["biedt_dagbehandeling", "dagbehandeling"],
    "biedt_residentieel": ["biedt_residentieel", "residentieel"],
    "biedt_crisis": ["biedt_crisis", "crisis"],
    "biedt_thuisbegeleiding": ["biedt_thuisbegeleiding", "thuisbegeleiding"],
    "leeftijd_0_4": ["leeftijd_0_4", "age_0_4", "target_0_4"],
    "leeftijd_4_12": ["leeftijd_4_12", "age_4_12", "target_4_12"],
    "leeftijd_12_18": ["leeftijd_12_18", "age_12_18", "target_12_18"],
    "leeftijd_18_plus": ["leeftijd_18_plus", "age_18_plus", "target_18_plus"],
    "complexiteit_enkelvoudig": ["complexiteit_enkelvoudig", "simple"],
    "complexiteit_meervoudig": ["complexiteit_meervoudig", "multiple"],
    "complexiteit_zwaar": ["complexiteit_zwaar", "severe"],
    "urgentie_laag": ["urgentie_laag", "low_urgency"],
    "urgentie_middel": ["urgentie_middel", "medium_urgency"],
    "urgentie_hoog": ["urgentie_hoog", "high_urgency"],
    "urgentie_crisis": ["urgentie_crisis", "crisis_urgency"],
    "regio_codes": ["regio_codes", "regions", "served_regions"],
    "specialisaties": ["specialisaties", "specializations", "specialties"],
    "contract_type": ["contract_type", "contract_soort"],
    "contract_status": ["contract_status", "status"],
    "contract_start": ["contract_start", "start_date", "geldig_vanaf"],
    "contract_end": ["contract_end", "end_date", "geldig_tot"],
    "zorgvormen_contract": ["zorgvormen_contract", "contract_care_forms", "zorgvormen", "care_forms"],
    # v2 Zorgaanbieder
    "handelsnaam": ["handelsnaam", "trade_name", "handelsname"],
    "omschrijving_kort": ["omschrijving", "omschrijving_kort", "description", "short_description"],
    "bron_type": ["bron_type", "source_type"],
    "bron_id": ["bron_id", "source_id_external"],
    # v2 AanbiederVestiging
    "agb_code_vestiging": ["agb_code_vestiging", "agb_vestiging", "branch_agb"],
    "straat": ["straat", "street"],
    "huisnummer": ["huisnummer", "house_number", "number"],
    "gemeente": ["gemeente", "municipality"],
    "provincie": ["provincie", "province"],
    "regio_jeugd": ["regio_jeugd", "youth_region"],
    "telefoon_vestiging": ["telefoon_vestiging", "vestiging_tel", "branch_phone"],
    "email_vestiging": ["email_vestiging", "vestiging_email", "branch_email"],
    # v2 Zorgprofiel
    "zorgvorm": ["zorgvorm", "care_form", "type_of_care"],
    "zorgdomein": ["zorgdomein", "care_domain", "domain"],
    "doelgroep_leeftijd_van": ["doelgroep_leeftijd_van", "min_age", "leeftijd_van", "age_from"],
    "doelgroep_leeftijd_tot": ["doelgroep_leeftijd_tot", "max_age", "leeftijd_tot", "age_to"],
    "geslacht_beperking": ["geslacht_beperking", "gender_restriction"],
    "problematiek_types": ["problematiek_types", "problematiek", "problem_types", "diagnoses"],
    "contra_indicaties": ["contra_indicaties", "contra_indications"],
    "intensiteit": ["intensiteit", "intensity"],
    "setting_type": ["setting_type", "setting"],
    "crisis_opvang_mogelijk": ["crisis_opvang_mogelijk", "crisis_possible", "offers_crisis"],
    "lvb_geschikt": ["lvb_geschikt", "suitable_lvb", "lvb"],
    "autisme_geschikt": ["autisme_geschikt", "suitable_autism", "autism"],
    "trauma_geschikt": ["trauma_geschikt", "suitable_trauma", "trauma"],
    "ggz_comorbiditeit_mogelijk": ["ggz_comorbiditeit_mogelijk", "ggz_comorbidity"],
    "verslavingsproblematiek_mogelijk": ["verslavingsproblematiek_mogelijk", "addiction"],
    "veiligheidsrisico_hanteerbaar": ["veiligheidsrisico_hanteerbaar", "safety_risk_manageable"],
    "omschrijving_match_context": ["omschrijving_match_context", "match_context", "match_description"],
    # v2 CapaciteitRecord
    "capaciteit_type": ["capaciteit_type", "capacity_type"],
    "totale_capaciteit": ["totale_capaciteit", "total_capacity"],
    "beschikbare_capaciteit": ["beschikbare_capaciteit", "available_capacity"],
    "wachtlijst_aantal": ["wachtlijst_aantal", "waitlist_count"],
    "gemiddelde_wachttijd_dagen": ["gemiddelde_wachttijd_dagen", "avg_waittime_days"],
    "direct_pleegbaar": ["direct_pleegbaar", "immediately_available"],
    "betrouwbaarheid_score": ["betrouwbaarheid_score", "reliability_score", "confidence_score"],
    # ContractRelatie v2
    "gemeente_contract": ["gemeente_contract", "municipality_contract"],
    "regio_contract": ["regio_contract", "region_contract"],
    "voorkeursaanbieder": ["voorkeursaanbieder", "preferred_provider"],
}


def _resolve(payload: dict, aliases: list[str]) -> Any:
    for alias in aliases:
        val = payload.get(alias)
        if val is not None:
            return val
    return None


def map_payload_to_canonical(payload: dict) -> dict:
    """Map a raw source payload to a normalized canonical dict."""
    out: dict[str, Any] = {}

    for canon_field, aliases in _FIELD_ALIASES.items():
        out[canon_field] = _resolve(payload, aliases)

    out["agb_code"] = normalize_agb_code(out.get("agb_code"))
    out["kvk_number"] = normalize_kvk(out.get("kvk_number"))
    out["provider_type"] = normalize_provider_type(out.get("provider_type"))
    out["postcode"] = normalize_postcode(out.get("postcode"))

    raw_regions = out.get("regio_codes")
    out["regio_codes"] = normalize_region_list(raw_regions)

    bool_fields = [
        "biedt_ambulant", "biedt_dagbehandeling", "biedt_residentieel",
        "biedt_crisis", "biedt_thuisbegeleiding",
        "leeftijd_0_4", "leeftijd_4_12", "leeftijd_12_18", "leeftijd_18_plus",
        "complexiteit_enkelvoudig", "complexiteit_meervoudig", "complexiteit_zwaar",
        "urgentie_laag", "urgentie_middel", "urgentie_hoog", "urgentie_crisis",
        "crisis_opvang_mogelijk", "lvb_geschikt", "autisme_geschikt", "trauma_geschikt",
        "ggz_comorbiditeit_mogelijk", "verslavingsproblematiek_mogelijk",
        "veiligheidsrisico_hanteerbaar", "direct_pleegbaar", "voorkeursaanbieder",
    ]
    for f in bool_fields:
        out[f] = coerce_bool(out.get(f))

    for f in ("open_slots", "waiting_list_size", "avg_wait_days", "max_capacity"):
        raw_val = out.get(f)
        try:
            if raw_val in (None, ""):
                out[f] = None
            else:
                out[f] = int(raw_val)
        except (ValueError, TypeError):
            out[f] = None

    for f in (
        "doelgroep_leeftijd_van", "doelgroep_leeftijd_tot",
        "totale_capaciteit", "beschikbare_capaciteit", "wachtlijst_aantal",
        "gemiddelde_wachttijd_dagen",
    ):
        raw_val = out.get(f)
        try:
            out[f] = int(raw_val) if raw_val is not None else None
        except (ValueError, TypeError):
            out[f] = None

    for f in ("betrouwbaarheid_score",):
        raw_val = out.get(f)
        try:
            out[f] = round(float(raw_val), 2) if raw_val is not None else None
        except (ValueError, TypeError):
            out[f] = None

    for f in ("problematiek_types",):
        raw_val = out.get(f)
        if raw_val is None:
            out[f] = []
        elif isinstance(raw_val, list):
            out[f] = [str(v).strip() for v in raw_val if v]
        elif isinstance(raw_val, str):
            out[f] = [v.strip() for v in raw_val.split(",") if v.strip()]
        else:
            out[f] = []

    for f in ("zorgvormen_contract",):
        raw_val = out.get(f)
        if raw_val is None:
            out[f] = []
        elif isinstance(raw_val, list):
            out[f] = [str(v).strip() for v in raw_val if str(v).strip()]
        elif isinstance(raw_val, str):
            out[f] = [v.strip() for v in raw_val.split(",") if v.strip()]
        else:
            out[f] = []

    for f in ("latitude", "longitude"):
        raw_val = out.get(f)
        try:
            out[f] = float(raw_val) if raw_val is not None else None
        except (ValueError, TypeError):
            out[f] = None

    for f in (
        "name", "short_name", "website", "email", "phone",
        "address", "city", "region", "specialisaties", "contract_type",
        "handelsnaam", "omschrijving_kort", "zorgvorm", "zorgdomein",
        "intensiteit", "setting_type", "geslacht_beperking",
        "contra_indicaties", "omschrijving_match_context",
    ):
        val = out.get(f)
        out[f] = str(val).strip() if val else ""

    return out


# ---------------------------------------------------------------------------
# Validation rules
# ---------------------------------------------------------------------------

def validate_canonical_data(data: dict) -> list[str]:
    """Returns a list of error strings. Empty list means valid."""
    errors: list[str] = []

    if not data.get("name"):
        errors.append("'name' is verplicht")

    agb = data.get("agb_code", "")
    if agb and not re.fullmatch(r"[0-9]{8}", agb):
        errors.append(f"'agb_code' moet 8 cijfers zijn, ontvangen: '{agb}'")

    kvk = data.get("kvk_number", "")
    if kvk and not re.fullmatch(r"[0-9]{1,8}", kvk):
        errors.append(f"'kvk_number' ongeldig formaat: '{kvk}'")

    lat = data.get("latitude")
    lng = data.get("longitude")
    if lat is not None and not (-90 <= lat <= 90):
        errors.append(f"'latitude' buiten bereik: {lat}")
    if lng is not None and not (-180 <= lng <= 180):
        errors.append(f"'longitude' buiten bereik: {lng}")

    open_slots = data.get("open_slots", 0)
    max_cap = data.get("max_capacity", 0)
    if max_cap and open_slots > max_cap:
        errors.append(
            f"'open_slots' ({open_slots}) kan niet groter zijn dan 'max_capacity' ({max_cap})"
        )

    leeftijd_van = data.get("doelgroep_leeftijd_van")
    leeftijd_tot = data.get("doelgroep_leeftijd_tot")
    if leeftijd_van is not None and leeftijd_tot is not None:
        if leeftijd_van > leeftijd_tot:
            errors.append(
                f"'doelgroep_leeftijd_van' ({leeftijd_van}) mag niet groter zijn dan "
                f"'doelgroep_leeftijd_tot' ({leeftijd_tot})"
            )

    totaal = data.get("totale_capaciteit")
    beschikbaar = data.get("beschikbare_capaciteit")
    if totaal is not None and beschikbaar is not None and beschikbaar > totaal:
        errors.append(
            f"'beschikbare_capaciteit' ({beschikbaar}) mag niet groter zijn dan "
            f"'totale_capaciteit' ({totaal})"
        )

    bsc = data.get("betrouwbaarheid_score")
    if bsc is not None and not (0.0 <= bsc <= 1.0):
        errors.append(f"'betrouwbaarheid_score' moet tussen 0.0 en 1.0 zijn, ontvangen: {bsc}")

    return errors


def compute_confidence_score(data: dict, errors: list[str]) -> float:
    """Heuristic confidence score 0.0-1.0."""
    score = 1.0

    if errors:
        score -= 0.4 * min(len(errors), 2)

    if not data.get("agb_code"):
        score -= 0.1
    if not data.get("kvk_number"):
        score -= 0.05
    if not data.get("latitude") or not data.get("longitude"):
        score -= 0.05
    if not data.get("regio_codes"):
        score -= 0.05

    if data.get("zorgvorm"):
        score = min(1.0, score + 0.02)
    if data.get("problematiek_types"):
        score = min(1.0, score + 0.03)
    if data.get("doelgroep_leeftijd_van") is not None:
        score = min(1.0, score + 0.02)

    return max(0.0, round(score, 2))
