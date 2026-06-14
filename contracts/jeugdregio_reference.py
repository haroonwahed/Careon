from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from django.utils.text import slugify

from contracts.management.commands.seed_jeugdregio_backbone import _resolve_jeugdregio


BASE_DIR = Path(__file__).resolve().parent / "management" / "seed_data"
REGIOS_CSV = BASE_DIR / "regios_jeugdregio.csv"
GEMEENTEN_CSV = BASE_DIR / "gemeenten_jeugdregio_full.csv"
MVP_GEMEENTEN_CSV = BASE_DIR / "gemeenten_jeugdregio_mvp.csv"

# Snapshot date for the checked-in reference package. This is a repo-level
# peildatum, not a claim about historical inception / expiry dates.
JEUGDREGIO_REFERENCE_PEILDATUM = date(2026, 6, 14)
JEUGDREGIO_REFERENCE_SOURCE = {
    "external_source": {
        "publishing_organization": "Kadaster / PDOK",
        "official_dataset_name": "Bestuurlijke Gebieden - Gemeentegebied",
        "source_version_or_publication_date": "WFS v1_0 consulted on 2026-06-14",
        "consulted_at": "2026-06-14",
        "original_source_reference": "https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeName=Gemeentegebied&outputFormat=application/json&srsName=EPSG:4326",
        "source_checksum": "c2ed8a042b8b33fed75ce993fcba3636c479d6ab531199c500c3d78d31707b5e",
        "notes": "The external source is the authoritative municipality geometry/name baseline. CareOn does not treat the checked-in CSVs as the source of truth.",
    },
    "imported_source_copy": {
        "regions_csv": "contracts/management/seed_data/regios_jeugdregio.csv",
        "regions_csv_checksum": "ba7df44f01d99d5dc96ab2a98eb9e2b144bd903f65e389eb2af165aedc1d1dfb",
        "municipality_mapping_csv": "contracts/management/seed_data/gemeenten_jeugdregio_full.csv",
        "municipality_mapping_csv_checksum": "1e2a5c27ecbcbca2778abffb44bde65dc81d340ec7c7cb10eef8aaf3d4fd87a8",
        "municipality_mvp_csv": "contracts/management/seed_data/gemeenten_jeugdregio_mvp.csv",
        "municipality_mvp_csv_checksum": None,
        "notes": "These CSVs are the CareOn-imported source copies used to build the normalized reference snapshot.",
    },
    "normalized_careon_snapshot": {
        "manifest_path": "contracts/management/seed_data/jeugdregio_reference_manifest.json",
        "manifest_checksum": None,
        "notes": "Normalized CareOn reference snapshot with canonical municipality naming and CareOn-generated region codes.",
    },
    "tenant_specific_records": {
        "included": False,
        "notes": "Tenant-specific records are validated separately and are not part of the reference snapshot.",
    },
    "mapping_policy": "CareOn curated mapping policy from contracts/management/commands/seed_jeugdregio_backbone.py (province defaults + municipality overrides)",
}

MUNICIPALITY_NAME_ALIASES = {
    "'s-Gravenhage": "Den Haag",
}


@dataclass(frozen=True)
class JeugdregioRegionReference:
    name: str
    code: str
    province: str
    active: bool
    active_period_start: str | None
    active_period_end: str | None
    source: str
    peildatum: str
    participating_municipalities: tuple[str, ...]
    coverage_status: str
    coverage_reason: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "code": self.code,
            "province": self.province,
            "active": self.active,
            "active_period": {
                "start": self.active_period_start,
                "end": self.active_period_end,
            },
            "source": self.source,
            "peildatum": self.peildatum,
            "participating_municipalities": list(self.participating_municipalities),
            "participating_municipality_count": len(self.participating_municipalities),
            "coverage": {
                "status": self.coverage_status,
                "reason": self.coverage_reason,
            },
        }


@dataclass(frozen=True)
class JeugdregioMunicipalityLink:
    source_name: str
    municipality_name: str
    municipality_code: str
    province: str
    region_name: str
    region_code: str
    active: bool
    source: str
    peildatum: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "source_name": self.source_name,
            "municipality_name": self.municipality_name,
            "municipality_code": self.municipality_code,
            "province": self.province,
            "region_name": self.region_name,
            "region_code": self.region_code,
            "active": self.active,
            "source": self.source,
            "peildatum": self.peildatum,
        }


def normalize_text(value: object) -> str:
    return str(value or "").strip().casefold()


def normalize_municipality_name(value: object) -> str:
    raw = str(value or "").strip()
    return MUNICIPALITY_NAME_ALIASES.get(raw, raw)


def _checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def region_code_from_name(index: int, name: str) -> str:
    suffix = slugify(name).replace("-", "").upper()[:14]
    return f"JRG-{index:03d}-{suffix}"


def municipality_code_from_name(name: str) -> str:
    suffix = slugify(name).replace("-", "").upper()
    return f"GM-{suffix[:18]}"


def _load_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(path)
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def load_jeugdregio_region_rows() -> list[dict[str, str]]:
    return _load_csv_rows(REGIOS_CSV)


def load_jeugdregio_municipality_rows() -> list[dict[str, str]]:
    rows = _load_csv_rows(GEMEENTEN_CSV)
    if rows:
        return rows
    return _load_csv_rows(MVP_GEMEENTEN_CSV)


def build_jeugdregio_manifest() -> dict[str, Any]:
    region_rows = load_jeugdregio_region_rows()
    municipality_rows = load_jeugdregio_municipality_rows()

    region_index: dict[str, dict[str, Any]] = {}
    ordered_regions: list[JeugdregioRegionReference] = []
    for index, row in enumerate(region_rows, start=1):
        name = (row.get("naam") or "").strip()
        province = (row.get("provincie") or "").strip()
        active = str(row.get("actief") or "").strip().lower() == "true"
        code = region_code_from_name(index=index, name=name)
        coverage_status = "ACTIVE_POPULATED" if active else "INACTIVE"
        coverage_reason = "Regio heeft gekoppelde gemeenten in de CareOn-snapshot."
        reference = JeugdregioRegionReference(
            name=name,
            code=code,
            province=province,
            active=active,
            active_period_start=JEUGDREGIO_REFERENCE_PEILDATUM.isoformat() if active else None,
            active_period_end=None if active else JEUGDREGIO_REFERENCE_PEILDATUM.isoformat(),
            source=JEUGDREGIO_REFERENCE_SOURCE["imported_source_copy"]["regions_csv"],
            peildatum=JEUGDREGIO_REFERENCE_PEILDATUM.isoformat(),
            participating_municipalities=(),
            coverage_status=coverage_status,
            coverage_reason=coverage_reason,
        )
        ordered_regions.append(reference)
        region_index[normalize_text(name)] = {"reference": reference, "municipalities": []}

    municipality_links: list[JeugdregioMunicipalityLink] = []
    for row in municipality_rows:
        source_name = (row.get("naam") or "").strip()
        municipality_name = normalize_municipality_name(source_name)
        province = (row.get("provincie") or "").strip()
        region_name = _resolve_jeugdregio(municipality_name, province)
        region_entry = region_index.get(normalize_text(region_name))
        if region_entry is None:
            continue
        region_reference: JeugdregioRegionReference = region_entry["reference"]
        municipality_code = municipality_code_from_name(municipality_name)
        link = JeugdregioMunicipalityLink(
            source_name=source_name,
            municipality_name=municipality_name,
            municipality_code=municipality_code,
            province=province,
            region_name=region_reference.name,
            region_code=region_reference.code,
            active=region_reference.active,
            source=f'{JEUGDREGIO_REFERENCE_SOURCE["imported_source_copy"]["municipality_mapping_csv"]} + {JEUGDREGIO_REFERENCE_SOURCE["mapping_policy"]}',
            peildatum=JEUGDREGIO_REFERENCE_PEILDATUM.isoformat(),
        )
        municipality_links.append(link)
        region_entry["municipalities"].append(municipality_name)

    for region_entry in region_index.values():
        reference: JeugdregioRegionReference = region_entry["reference"]
        municipalities = tuple(sorted(region_entry["municipalities"]))
        if municipalities:
            coverage_status = "ACTIVE_POPULATED" if reference.active else "INACTIVE_POPULATED"
            coverage_reason = "Regio heeft gekoppelde gemeenten in de CareOn-snapshot."
        elif reference.active:
            coverage_status = "ACTIVE_EMPTY"
            coverage_reason = "Actieve regio zonder deelnemende gemeenten in de CareOn-snapshot; handmatige review vereist."
        else:
            coverage_status = "INACTIVE_EMPTY"
            coverage_reason = "Inactieve regio zonder deelnemende gemeenten in de CareOn-snapshot."
        region_entry["reference"] = JeugdregioRegionReference(
            name=reference.name,
            code=reference.code,
            province=reference.province,
            active=reference.active,
            active_period_start=reference.active_period_start,
            active_period_end=reference.active_period_end,
            source=reference.source,
            peildatum=reference.peildatum,
            participating_municipalities=municipalities,
            coverage_status=coverage_status,
            coverage_reason=coverage_reason,
        )

    regions = [
        JeugdregioRegionReference(
            name=reference.name,
            code=reference.code,
            province=reference.province,
            active=reference.active,
            active_period_start=reference.active_period_start,
            active_period_end=reference.active_period_end,
            source=reference.source,
            peildatum=reference.peildatum,
            participating_municipalities=tuple(sorted(region_index[normalize_text(reference.name)]["municipalities"])),
            coverage_status=region_index[normalize_text(reference.name)]["reference"].coverage_status,
            coverage_reason=region_index[normalize_text(reference.name)]["reference"].coverage_reason,
        ).as_dict()
        for reference in ordered_regions
    ]

    provenance = {
        "external_source": {
            **JEUGDREGIO_REFERENCE_SOURCE["external_source"],
        },
        "imported_source_copy": {
            **JEUGDREGIO_REFERENCE_SOURCE["imported_source_copy"],
            "regions_csv_checksum": _checksum(REGIOS_CSV),
            "municipality_mapping_csv_checksum": _checksum(GEMEENTEN_CSV),
            "municipality_mvp_csv_checksum": _checksum(MVP_GEMEENTEN_CSV) if MVP_GEMEENTEN_CSV.exists() else None,
        },
        "normalized_careon_snapshot": {
            **JEUGDREGIO_REFERENCE_SOURCE["normalized_careon_snapshot"],
        },
        "tenant_specific_records": dict(JEUGDREGIO_REFERENCE_SOURCE["tenant_specific_records"]),
        "mapping_policy": JEUGDREGIO_REFERENCE_SOURCE["mapping_policy"],
    }

    payload_without_checksum = {
        "snapshot": {
            "peildatum": JEUGDREGIO_REFERENCE_PEILDATUM.isoformat(),
            "source": provenance,
            "notes": (
                "This snapshot is a CareOn reference package. It is not treated as a live "
                "authoritative source during runtime; it documents the checked-in mapping only."
            ),
        },
        "regions": regions,
        "municipality_links": [link.as_dict() for link in municipality_links],
    }

    canonical_snapshot = json.dumps(payload_without_checksum, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    provenance["normalized_careon_snapshot"]["manifest_checksum"] = hashlib.sha256(canonical_snapshot.encode("utf-8")).hexdigest()
    payload_without_checksum["snapshot"]["source"] = provenance
    return payload_without_checksum


def validate_jeugdregio_manifest(manifest: dict[str, Any] | None = None) -> dict[str, Any]:
    manifest = manifest or build_jeugdregio_manifest()
    region_entries = manifest.get("regions", [])
    link_entries = manifest.get("municipality_links", [])

    municipality_to_regions: dict[str, set[str]] = {}
    region_to_municipalities: dict[str, set[str]] = {}
    issues: list[dict[str, Any]] = []

    for link in link_entries:
        municipality = normalize_text(link.get("municipality_name"))
        region = normalize_text(link.get("region_name"))
        municipality_to_regions.setdefault(municipality, set()).add(region)
        region_to_municipalities.setdefault(region, set()).add(municipality)

    for municipality, regions in sorted(municipality_to_regions.items()):
        if not municipality:
            issues.append({
                "severity": "high",
                "code": "MISSING_MUNICIPALITY_NAME",
                "message": "Lege gemeentenaam in referentiedata.",
            })
            continue
        if len(regions) > 1:
            issues.append({
                "severity": "high",
                "code": "DUPLICATE_PRIMARY_REGION",
                "municipality": municipality,
                "message": "Gemeente heeft meerdere primaire jeugdhulpregio's op dezelfde peildatum.",
                "regions": sorted(regions),
            })

    for region in region_entries:
        region_name = normalize_text(region.get("name"))
        municipalities = region_to_municipalities.get(region_name, set())
        coverage = region.get("coverage") or {}
        coverage_status = str(coverage.get("status") or "").upper()
        if coverage_status == "ACTIVE_EMPTY":
            issues.append({
                "severity": "high",
                "code": "ACTIVE_REGION_WITHOUT_MUNICIPALITIES",
                "region": region.get("name"),
                "classification": "FAULTY",
                "message": "Actieve jeugdhulpregio heeft geen deelnemende gemeenten in de CareOn-snapshot.",
            })
        elif not municipalities and coverage_status == "INACTIVE_EMPTY":
            issues.append({
                "severity": "low",
                "code": "INACTIVE_REGION_WITHOUT_MUNICIPALITIES",
                "region": region.get("name"),
                "classification": "HISTORICAL",
                "message": "Inactieve jeugdhulpregio heeft geen deelnemende gemeenten in de CareOn-snapshot.",
            })

    municipalities_without_region = sorted(
        municipality for municipality, regions in municipality_to_regions.items() if not regions
    )
    if municipalities_without_region:
        for municipality in municipalities_without_region:
            issues.append({
                "severity": "high",
                "code": "MUNICIPALITY_WITHOUT_ACTIVE_REGION",
                "municipality": municipality,
                "message": "Gemeente heeft geen actieve jeugdhulpregio op de peildatum.",
            })

    region_count = len(region_entries)
    active_count = sum(1 for region in region_entries if region.get("active"))
    inactive_count = region_count - active_count
    municipality_count = len(link_entries)
    regions_without_municipalities = sum(1 for region in region_entries if not region.get("participating_municipalities"))

    summary = {
        "region_count": region_count,
        "active_region_count": active_count,
        "inactive_region_count": inactive_count,
        "municipality_link_count": municipality_count,
        "municipality_count": len({normalize_text(link.get("municipality_name")) for link in link_entries if link.get("municipality_name")}),
        "regions_without_municipalities": regions_without_municipalities,
        "municipalities_without_active_region": len(municipalities_without_region),
        "duplicate_primary_region_count": sum(1 for issue in issues if issue["code"] == "DUPLICATE_PRIMARY_REGION"),
        "missing_municipality_links_count": sum(1 for issue in issues if issue["code"] == "MUNICIPALITY_WITHOUT_ACTIVE_REGION"),
        "issues_count": len(issues),
    }

    return {"summary": summary, "issues": issues, "manifest": manifest}
