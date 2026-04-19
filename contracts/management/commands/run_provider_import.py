"""
Management command: run_provider_import

Triggers the provider data pipeline for a given source adapter.
Supports dry-run mode (validates only, no canonical writes).

Usage examples:
    python manage.py run_provider_import --source fixture
    python manage.py run_provider_import --source jsonfile --file /path/to/data.json
    python manage.py run_provider_import --source csv_import --file /path/to/data.csv
    python manage.py run_provider_import --source http_api --url https://api.example.com/providers --system agbregister_v2
    python manage.py run_provider_import --dry-run --source fixture
    python manage.py run_provider_import --source fixture --organization-id 1
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from contracts.models import Organization
from contracts.provider_adapters import (
    AGBRegistryCsvAdapter,
    CsvFileAdapter,
    FixtureAdapter,
    JsonFileAdapter,
    HttpApiAdapter,
)
from contracts.provider_pipeline import ProviderPipeline


class Command(BaseCommand):
    help = "Run the provider data import pipeline from a specified source."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            required=True,
            choices=["fixture", "agb_csv", "jsonfile", "csv_import", "http_api"],
            help="Source adapter to use.",
        )
        parser.add_argument(
            "--file",
            default=None,
            help="Path to JSON file (required for --source jsonfile).",
        )
        parser.add_argument(
            "--url",
            default=None,
            help="Base URL (required for --source http_api).",
        )
        parser.add_argument(
            "--system",
            default=None,
            help="Override source_system identifier for the batch log.",
        )
        parser.add_argument(
            "--organization-id",
            type=int,
            default=None,
            help="Organization PK to scope ContractRelatie records.",
        )
        parser.add_argument(
            "--allow-fixture",
            action="store_true",
            default=False,
            help="Allow fixture adapter (tests only). Without this flag fixture import is blocked.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Validate and stage records only; do not write to canonical tables.",
        )

    def handle(self, *args, **options):
        source = options["source"]
        dry_run = options["dry_run"]
        org_id = options.get("organization_id")

        # Resolve adapter
        if source == "fixture":
            if not options.get("allow_fixture"):
                raise CommandError(
                    "Fixture import is disabled by real-source policy. "
                    "Use --allow-fixture only for isolated automated tests."
                )
            adapter = FixtureAdapter()
        elif source == "agb_csv":
            if not options["file"]:
                raise CommandError("--file is required for --source agb_csv")
            adapter = AGBRegistryCsvAdapter(
                path=options["file"],
                source_system=options["system"] or "agb_registry_csv",
            )
        elif source == "jsonfile":
            if not options["file"]:
                raise CommandError("--file is required for --source jsonfile")
            adapter = JsonFileAdapter(path=options["file"],
                                      source_system=options["system"] or "jsonfile")
        elif source == "csv_import":
            if not options["file"]:
                raise CommandError("--file is required for --source csv_import")
            adapter = CsvFileAdapter(path=options["file"],
                                     source_system=options["system"] or "csv_import")
        elif source == "http_api":
            if not options["url"]:
                raise CommandError("--url is required for --source http_api")
            adapter = HttpApiAdapter(
                base_url=options["url"],
                source_system=options["system"] or "http_api",
            )
        else:
            raise CommandError(f"Unknown source: {source}")  # unreachable

        # Resolve optional organization
        organization = None
        if org_id:
            try:
                organization = Organization.objects.get(pk=org_id)
            except Organization.DoesNotExist:
                raise CommandError(f"Organization with id={org_id} does not exist.")

        system_label = options["system"] or adapter.source_system
        triggered_by = "management_command"

        pipeline = ProviderPipeline(
            source_system=system_label,
            source_version=adapter.source_version,
            triggered_by=triggered_by,
            organization=organization,
        )

        self.stdout.write(
            self.style.NOTICE(
                f"[provider_import] source={system_label} dry_run={dry_run}"
            )
        )

        batch = pipeline.open_batch()
        records = list(adapter.records())
        staged = pipeline.ingest(batch, records)

        self.stdout.write(f"  Staged {staged} records into batch {batch.batch_ref}")

        if dry_run:
            # Validate only — no canonical writes
            pipeline.validate_batch(batch)
            from contracts.models import ProviderStagingRecord
            valid_count = ProviderStagingRecord.objects.filter(
                batch=batch,
                validation_status=ProviderStagingRecord.ValidationStatus.VALID,
            ).count()
            invalid_count = ProviderStagingRecord.objects.filter(
                batch=batch,
                validation_status=ProviderStagingRecord.ValidationStatus.INVALID,
            ).count()
            quarantined_count = ProviderStagingRecord.objects.filter(
                batch=batch,
                validation_status=ProviderStagingRecord.ValidationStatus.QUARANTINED,
            ).count()
            self.stdout.write(
                self.style.WARNING(
                    f"  [DRY RUN] valid={valid_count} invalid={invalid_count} "
                    f"quarantined={quarantined_count} — no canonical writes performed"
                )
            )
            from contracts.models import ProviderImportBatch
            batch.status = ProviderImportBatch.BatchStatus.COMPLETED
            batch.save(update_fields=["status"])
            return

        summary = pipeline.promote_batch(batch)

        self.stdout.write(
            self.style.SUCCESS(
                f"  Import complete — created={summary['created']} "
                f"updated={summary['updated']} skipped={summary['skipped']} "
                f"conflicted={summary['conflicted']} quarantined={summary['quarantined']}"
            )
        )

        if summary["conflicted"] > 0:
            self.stdout.write(
                self.style.WARNING(
                    f"  {summary['conflicted']} conflict(s) require manual resolution. "
                    "Review ProviderSyncConflict records in admin."
                )
            )
