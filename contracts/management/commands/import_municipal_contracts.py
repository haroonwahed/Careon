from __future__ import annotations

import csv
from datetime import date, datetime
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from contracts.models import (
    ContractRelatie,
    MunicipalityConfiguration,
    Organization,
    ProviderRegioDekking,
    ProviderImportBatch,
    RegionalConfiguration,
    Zorgaanbieder,
)


_STATUS_MAP = {
    "actief": ContractRelatie.ContractStatus.ACTIEF,
    "active": ContractRelatie.ContractStatus.ACTIEF,
    "verlopen": ContractRelatie.ContractStatus.VERLOPEN,
    "expired": ContractRelatie.ContractStatus.VERLOPEN,
    "opgeschort": ContractRelatie.ContractStatus.OPGESCHORT,
    "suspended": ContractRelatie.ContractStatus.OPGESCHORT,
    "concept": ContractRelatie.ContractStatus.CONCEPT,
    "onbekend": ContractRelatie.ContractStatus.CONCEPT,
    "unknown": ContractRelatie.ContractStatus.CONCEPT,
}


def _parse_date(value: str) -> date | None:
    raw = (value or "").strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _split_csv_list(value: str) -> list[str]:
    return [item.strip() for item in str(value or "").split(",") if item.strip()]


class Command(BaseCommand):
    help = (
        "Import real municipal/regional contract records from CSV without fabricating "
        "status, coverage, or care-form values."
    )

    def add_arguments(self, parser):
        parser.add_argument("--file", required=True, help="CSV file path")
        parser.add_argument("--organization-id", type=int, required=True, help="Organization id")
        parser.add_argument("--delimiter", default=",", help="CSV delimiter")
        parser.add_argument(
            "--source-system",
            default="municipal_contract_csv",
            help="Source system label for import traceability",
        )

    def handle(self, *args, **options):
        file_path = Path(options["file"])
        if not file_path.exists():
            raise CommandError(f"CSV file not found: {file_path}")

        try:
            organization = Organization.objects.get(pk=options["organization_id"])
        except Organization.DoesNotExist as exc:
            raise CommandError(f"Organization not found: {options['organization_id']}") from exc

        batch = ProviderImportBatch.objects.create(
            source_system=options["source_system"],
            source_version="1.0",
            triggered_by="manage.py import_municipal_contracts",
            status=ProviderImportBatch.BatchStatus.RUNNING,
            started_at=timezone.now(),
        )

        created = 0
        updated = 0
        skipped = 0
        coverage_upserts = 0

        with open(file_path, encoding="utf-8", newline="") as fh:
            reader = csv.DictReader(fh, delimiter=options["delimiter"])
            rows = list(reader)

        for row in rows:
            provider = self._resolve_provider(row)
            if provider is None:
                skipped += 1
                continue

            municipality_name = (row.get("municipality") or row.get("gemeente") or "").strip()
            region_name = (row.get("region") or row.get("regio") or "").strip()
            contract_type = (row.get("contract_type") or row.get("contract_soort") or "").strip() or "ONBEKEND"
            raw_status = (row.get("contract_status") or row.get("status") or "").strip().lower()
            status = _STATUS_MAP.get(raw_status, ContractRelatie.ContractStatus.CONCEPT)
            actief_contract = status == ContractRelatie.ContractStatus.ACTIEF

            zorgvormen = _split_csv_list(
                row.get("covered_care_forms") or row.get("zorgvormen") or row.get("zorgvormen_contract") or ""
            )

            contract_defaults = {
                "status": status,
                "start_date": _parse_date(row.get("contract_start") or row.get("start_date") or ""),
                "end_date": _parse_date(row.get("contract_end") or row.get("end_date") or ""),
                "gemeente": municipality_name,
                "regio": region_name,
                "zorgvormen_contract": zorgvormen,
                "actief_contract": actief_contract,
                "opmerkingen_contract": "Contractstatus onbekend" if not raw_status else "",
                "import_batch": batch,
            }

            with transaction.atomic():
                relation, relation_created = ContractRelatie.objects.update_or_create(
                    zorgaanbieder=provider,
                    organization=organization,
                    contract_type=contract_type,
                    defaults=contract_defaults,
                )

                if relation_created:
                    created += 1
                else:
                    updated += 1

                region = self._resolve_region(organization, region_name)
                if region is not None:
                    ProviderRegioDekking.objects.update_or_create(
                        zorgaanbieder=provider,
                        aanbieder_vestiging=None,
                        regio=region,
                        defaults={
                            "is_primair_dekkingsgebied": True,
                            "zorgvormen": zorgvormen,
                            "contract_actief": relation.actief_contract,
                            "capaciteit_meerekenen": True,
                            "dekking_status": ProviderRegioDekking.DekkingStatus.ACTIVE,
                            "toelichting": "Afgeleid uit contractimport",
                            "bron_type": ProviderRegioDekking.BronType.CSV_IMPORT,
                        },
                    )
                    coverage_upserts += 1

                if municipality_name:
                    municipality = MunicipalityConfiguration.objects.filter(
                        organization=organization,
                        municipality_name__iexact=municipality_name,
                    ).first()
                    if municipality is not None and region is not None:
                        region.served_municipalities.add(municipality)

        batch.total_records = len(rows)
        batch.processed_records = created + updated + skipped
        batch.created_records = created
        batch.updated_records = updated
        batch.skipped_records = skipped
        batch.conflicted_records = 0
        batch.quarantined_records = 0
        batch.status = ProviderImportBatch.BatchStatus.COMPLETED
        batch.completed_at = timezone.now()
        batch.save(update_fields=[
            "total_records",
            "processed_records",
            "created_records",
            "updated_records",
            "skipped_records",
            "conflicted_records",
            "quarantined_records",
            "status",
            "completed_at",
        ])

        self.stdout.write(
            self.style.SUCCESS(
                "Contract import complete: "
                f"created={created} updated={updated} skipped={skipped} coverage_upserts={coverage_upserts}"
            )
        )

    def _resolve_provider(self, row: dict) -> Zorgaanbieder | None:
        agb = (row.get("provider_agb") or row.get("agb_code") or row.get("agb") or "").strip()
        kvk = (row.get("provider_kvk") or row.get("kvk") or row.get("kvk_number") or "").strip()
        name = (row.get("provider_name") or row.get("naam") or "").strip()

        provider = None
        if agb:
            provider = Zorgaanbieder.objects.filter(agb_code=agb).first()
        if provider is None and kvk:
            provider = Zorgaanbieder.objects.filter(kvk_number=kvk).first()
        if provider is None and name:
            provider = Zorgaanbieder.objects.filter(name__iexact=name).first()
        return provider

    def _resolve_region(self, organization: Organization, region_name: str) -> RegionalConfiguration | None:
        if not region_name:
            return None
        return RegionalConfiguration.objects.filter(
            organization=organization,
        ).filter(
            Q(region_name__iexact=region_name) | Q(region_code__iexact=region_name)
        ).first()
