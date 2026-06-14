from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db.models import Q
from django.utils import timezone

from contracts.models import CaseIntakeProcess, MunicipalityConfiguration, Organization, ProviderProfile, RegionalConfiguration, RegionType


AMBIGUOUS_LEGACY_REGION_NAMES = {
    "amsterdam regio",
    "rotterdam regio",
    "utrecht regio",
}


class LegacyRegionClassification:
    MIRROR = "MIRROR"
    OPERATIONAL = "OPERATIONAL"
    AMBIGUOUS = "AMBIGUOUS"
    ORPHANED = "ORPHANED"


class MigrationStatus:
    READY = "READY"
    PARTIALLY_MAPPED = "PARTIALLY_MAPPED"
    BLOCKED = "BLOCKED"
    APPLIED = "APPLIED"
    SKIPPED = "SKIPPED"


@dataclass(frozen=True)
class LegacyRegionReference:
    legacy_region_id: int
    classification: str
    reason: str
    migration_status: str
    municipality_id: int | None
    municipality_name: str | None
    youth_region_id: int | None
    youth_region_name: str | None
    blockers: list[str]
    references: dict[str, int]
    timestamp: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "legacy_region_id": self.legacy_region_id,
            "classification": self.classification,
            "reason": self.reason,
            "migration_status": self.migration_status,
            "municipality_id": self.municipality_id,
            "municipality_name": self.municipality_name,
            "youth_region_id": self.youth_region_id,
            "youth_region_name": self.youth_region_name,
            "blockers": list(self.blockers),
            "references": dict(self.references),
            "timestamp": self.timestamp,
        }


def normalize_text(value: object) -> str:
    return str(value or "").strip().casefold()


def get_primary_youth_region_for_municipality(
    municipality: MunicipalityConfiguration | None,
) -> RegionalConfiguration | None:
    if municipality is None:
        return None
    return (
        municipality.regions.filter(
            status=RegionalConfiguration.Status.ACTIVE,
            region_type=RegionType.JEUGDREGIO,
        )
        .order_by("region_name", "pk")
        .first()
    )


def _shared_youth_region_for_municipalities(
    municipalities: list[MunicipalityConfiguration],
) -> RegionalConfiguration | None:
    youth_regions = []
    for municipality in municipalities:
        region = get_primary_youth_region_for_municipality(municipality)
        if region is None:
            return None
        youth_regions.append(region)
    unique_ids = {region.id for region in youth_regions}
    if len(unique_ids) == 1:
        return youth_regions[0]
    return None


def classify_legacy_region(region: RegionalConfiguration) -> tuple[str, str, list[str], MunicipalityConfiguration | None, RegionalConfiguration | None]:
    served_municipalities = list(region.served_municipalities.select_related().order_by("municipality_name", "municipality_code"))
    normalized_name = normalize_text(region.region_name)
    blockers: list[str] = []

    if normalized_name in AMBIGUOUS_LEGACY_REGION_NAMES:
        municipality = served_municipalities[0] if served_municipalities else None
        youth_region = get_primary_youth_region_for_municipality(municipality)
        blockers.append("Regionaam staat expliciet op de ambigue uitzonderingslijst.")
        if municipality is None:
            blockers.append("Geen gekoppelde gemeente gevonden; handmatige controle vereist.")
        if youth_region is None:
            blockers.append("Geen actieve JEUGDREGIO voor de gekoppelde gemeente gevonden.")
        return (
            LegacyRegionClassification.AMBIGUOUS,
            "Expliciete uitzondering uit de repository; handmatige controle vereist.",
            blockers,
            municipality,
            youth_region,
        )

    if not served_municipalities:
        return (
            LegacyRegionClassification.ORPHANED,
            "Geen gekoppelde gemeenten gevonden; geen veilige backfill mogelijk.",
            ["Geen bediende gemeente gekoppeld."],
            None,
            None,
        )

    if len(served_municipalities) == 1:
        municipality = served_municipalities[0]
        youth_region = get_primary_youth_region_for_municipality(municipality)
        if youth_region is None:
            blockers.append("Geen actieve JEUGDREGIO gevonden voor de gekoppelde gemeente.")
        return (
            LegacyRegionClassification.MIRROR,
            "1-op-1 gemeentelijke spiegel: exact één bediende gemeente gekoppeld.",
            blockers,
            municipality,
            youth_region,
        )

    youth_region = _shared_youth_region_for_municipalities(served_municipalities)
    if youth_region is None:
        blockers.append("Meerdere gemeenten wijzen niet naar één gedeelde JEUGDREGIO.")
    return (
        LegacyRegionClassification.OPERATIONAL,
        "Expliciet samenwerkingsgebied met meerdere gemeenten.",
        blockers,
        None,
        youth_region,
    )


def collect_reference_counts(region: RegionalConfiguration) -> dict[str, int]:
    region_id = region.id
    counts = {
        "CaseIntakeProcess.regio": CaseIntakeProcess.objects.filter(regio_id=region_id).count(),
        "CaseIntakeProcess.preferred_region": CaseIntakeProcess.objects.filter(preferred_region_id=region_id).count(),
        "CaseIntakeProcess.zorgregio": CaseIntakeProcess.objects.filter(zorgregio_id=region_id).count(),
        "CaseIntakeProcess.plaatsingsregio": CaseIntakeProcess.objects.filter(plaatsingsregio_id=region_id).count(),
        "CaseIntakeProcess.contractregio": CaseIntakeProcess.objects.filter(contractregio_id=region_id).count(),
        "CaseIntakeProcess.escalatie_regio": CaseIntakeProcess.objects.filter(escalatie_regio_id=region_id).count(),
        "ProviderRegioDekking.regio": region.provider_dekkingen.count(),
        "ProviderProfile.served_regions": ProviderProfile.objects.filter(served_regions__id=region_id).distinct().count(),
        "ProviderProfile.secondary_served_regions": ProviderProfile.objects.filter(secondary_served_regions__id=region_id).distinct().count(),
    }
    return counts


def build_legacy_region_reference(
    *,
    region: RegionalConfiguration,
    timestamp: str | None = None,
) -> LegacyRegionReference:
    classification, reason, blockers, municipality, youth_region = classify_legacy_region(region)
    references = collect_reference_counts(region)
    if classification == LegacyRegionClassification.MIRROR and municipality and youth_region:
        migration_status = MigrationStatus.READY
    elif classification in {LegacyRegionClassification.MIRROR, LegacyRegionClassification.AMBIGUOUS} and municipality:
        migration_status = MigrationStatus.PARTIALLY_MAPPED
    else:
        migration_status = MigrationStatus.BLOCKED

    return LegacyRegionReference(
        legacy_region_id=region.id,
        classification=classification,
        reason=reason,
        migration_status=migration_status,
        municipality_id=municipality.id if municipality else None,
        municipality_name=municipality.municipality_name if municipality else None,
        youth_region_id=youth_region.id if youth_region else None,
        youth_region_name=youth_region.region_name if youth_region else None,
        blockers=blockers,
        references=references,
        timestamp=timestamp or timezone.now().isoformat(),
    )


def iterate_legacy_regions(*, organization: Organization | None = None):
    qs = RegionalConfiguration.objects.filter(region_type=RegionType.GEMEENTELIJK).prefetch_related("served_municipalities")
    if organization is not None:
        qs = qs.filter(Q(organization=organization) | Q(organization__isnull=True))
    return qs.order_by("region_name", "region_code", "id")
