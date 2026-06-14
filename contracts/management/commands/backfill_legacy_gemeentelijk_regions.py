from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from contracts.legacy_region_migration import (
    LegacyRegionClassification,
    build_legacy_region_reference,
    MigrationStatus,
    iterate_legacy_regions,
)
from contracts.models import CaseIntakeProcess, Organization


class Command(BaseCommand):
    help = (
        "Transactionele, idempotente backfill voor legacy RegionType.GEMEENTELIJK records. "
        "Legacywaarden blijven intact; alleen afgeleide gemeente- en jeugdhulpregio-velden worden gevuld."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            dest="slug",
            default="",
            help="Beperk backfill tot één Organization.slug (default: alle organisaties).",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Schrijf wijzigingen weg. Zonder deze vlag draait het commando in dry-run modus.",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Schrijf de mapping- en backfillresultaten als JSON naar stdout.",
        )
        parser.add_argument(
            "--output",
            dest="output",
            default="",
            help="Optioneel pad om de JSON-inventarisatie weg te schrijven.",
        )

    def _build_case_updates(self, case: CaseIntakeProcess, municipality_id: int | None, youth_region_id: int | None):
        updates: dict[str, int] = {}
        if municipality_id:
            for field_name in ("gemeente_id", "herkomst_gemeente_id", "verantwoordelijke_gemeente_id", "verblijfsgemeente_id"):
                if getattr(case, field_name) is None:
                    updates[field_name] = municipality_id
        if youth_region_id:
            for field_name in ("zorgregio_id", "plaatsingsregio_id", "contractregio_id", "escalatie_regio_id"):
                if getattr(case, field_name) is None:
                    updates[field_name] = youth_region_id
        return updates

    def handle(self, *args, **options):
        slug = (options.get("slug") or "").strip()
        apply_changes = bool(options.get("apply"))
        emit_json = bool(options.get("json"))
        output_path = (options.get("output") or "").strip()

        org_qs = Organization.objects.filter(is_active=True).order_by("slug")
        if slug:
            org_qs = org_qs.filter(slug=slug)
        organizations = list(org_qs)
        if not organizations:
            self.stdout.write(self.style.WARNING("Geen actieve organisaties gevonden voor de backfill."))
            return

        generated_at = timezone.now().isoformat()
        payload = {
            "generated_at": generated_at,
            "apply": apply_changes,
            "scope": {"slug": slug or None},
            "summary": {
                "legacy_region_total": 0,
                "classifications": {"MIRROR": 0, "OPERATIONAL": 0, "AMBIGUOUS": 0, "ORPHANED": 0},
                "migration_statuses": {"READY": 0, "PARTIALLY_MAPPED": 0, "BLOCKED": 0},
                "updated_cases": 0,
                "full_backfills": 0,
                "partial_backfills": 0,
                "skipped_cases": 0,
                "blocked_regions": 0,
                "reference_totals": {},
            },
            "organizations": [],
        }

        with transaction.atomic():
            for org in organizations:
                org_entries = []
                org_summary = {
                    "organization_id": org.id,
                    "organization_slug": org.slug,
                    "organization_name": org.name,
                    "legacy_region_total": 0,
                    "classifications": {"MIRROR": 0, "OPERATIONAL": 0, "AMBIGUOUS": 0, "ORPHANED": 0},
                    "migration_statuses": {"READY": 0, "PARTIALLY_MAPPED": 0, "BLOCKED": 0},
                    "updated_cases": 0,
                    "full_backfills": 0,
                    "partial_backfills": 0,
                    "skipped_cases": 0,
                    "blocked_regions": 0,
                }

                for region in iterate_legacy_regions(organization=org):
                    reference = build_legacy_region_reference(region=region, timestamp=generated_at)
                    affected_cases = []
                    skipped_cases = []

                    if reference.migration_status in {MigrationStatus.READY, MigrationStatus.PARTIALLY_MAPPED} and reference.municipality_id:
                        case_qs = CaseIntakeProcess.objects.filter(
                            organization=org,
                        ).filter(
                            (
                                Q(regio_id=region.id)
                                | Q(preferred_region_id=region.id)
                                | Q(zorgregio_id=region.id)
                                | Q(plaatsingsregio_id=region.id)
                                | Q(contractregio_id=region.id)
                                | Q(escalatie_regio_id=region.id)
                            )
                        ).select_related("gemeente", "regio", "preferred_region")
                        for case in case_qs.iterator():
                            if case.gemeente_id and case.gemeente_id != reference.municipality_id:
                                skipped_cases.append(
                                    {
                                        "case_id": case.id,
                                        "reason": "bestaande gemeente wijkt af van voorgestelde mapping",
                                    }
                                )
                                continue
                            youth_region_id = reference.youth_region_id if reference.migration_status == MigrationStatus.READY else None
                            updates = self._build_case_updates(case, reference.municipality_id, youth_region_id)
                            if not updates:
                                continue
                            affected_cases.append(case.id)
                            if apply_changes:
                                CaseIntakeProcess.objects.filter(pk=case.pk).update(**updates)

                    elif reference.classification in {LegacyRegionClassification.ORPHANED} or reference.migration_status == MigrationStatus.BLOCKED:
                        skipped_cases.append(
                            {
                                "case_id": None,
                                "reason": "legacy regio is geblokkeerd of verweesd; handmatige review vereist",
                            }
                        )

                    org_summary["legacy_region_total"] += 1
                    org_summary["classifications"][reference.classification] += 1
                    org_summary["migration_statuses"][reference.migration_status] += 1
                    org_summary["updated_cases"] += len(affected_cases)
                    if reference.migration_status == "READY":
                        org_summary["full_backfills"] += len(affected_cases)
                    elif reference.migration_status == "PARTIALLY_MAPPED":
                        org_summary["partial_backfills"] += len(affected_cases)
                    org_summary["skipped_cases"] += len(skipped_cases)
                    if reference.migration_status == "BLOCKED":
                        org_summary["blocked_regions"] += 1

                    for key, value in reference.references.items():
                        org_summary.setdefault("reference_totals", {})
                        org_summary["reference_totals"][key] = org_summary["reference_totals"].get(key, 0) + value
                        payload["summary"]["reference_totals"][key] = payload["summary"]["reference_totals"].get(key, 0) + value

                    payload["summary"]["legacy_region_total"] += 1
                    payload["summary"]["classifications"][reference.classification] += 1
                    payload["summary"]["migration_statuses"][reference.migration_status] += 1
                    payload["summary"]["updated_cases"] += len(affected_cases)
                    if reference.migration_status == "READY":
                        payload["summary"]["full_backfills"] += len(affected_cases)
                    elif reference.migration_status == "PARTIALLY_MAPPED":
                        payload["summary"]["partial_backfills"] += len(affected_cases)
                    payload["summary"]["skipped_cases"] += len(skipped_cases)
                    if reference.migration_status == "BLOCKED":
                        payload["summary"]["blocked_regions"] += 1

                    org_entries.append(
                        {
                            **reference.as_dict(),
                            "affected_case_ids": affected_cases,
                            "skipped_cases": skipped_cases,
                            "apply": apply_changes,
                        }
                    )

                payload["organizations"].append(
                    {
                        **org_summary,
                        "regions": org_entries,
                    }
                )

            if not apply_changes:
                transaction.set_rollback(True)

        if output_path:
            target = Path(output_path).expanduser().resolve()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"JSON-backfill geschreven naar {target}"))

        if emit_json:
            self.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False))
            return

        mode = "APPLY" if apply_changes else "DRY-RUN"
        self.stdout.write(self.style.NOTICE(f"Backfill mode: {mode}"))
        for org in payload["organizations"]:
            self.stdout.write(
                f"{org['organization_slug']}: legacy={org['legacy_region_total']} "
                f"mirror={org['classifications']['MIRROR']} operational={org['classifications']['OPERATIONAL']} "
                f"ambiguous={org['classifications']['AMBIGUOUS']} orphaned={org['classifications']['ORPHANED']} "
                f"ready={org['migration_statuses']['READY']} partial={org['migration_statuses']['PARTIALLY_MAPPED']} "
                f"blocked={org['migration_statuses']['BLOCKED']} updated_cases={org['updated_cases']} "
                f"full_backfills={org['full_backfills']} partial_backfills={org['partial_backfills']} "
                f"skipped_cases={org['skipped_cases']} "
                f"blocked_regions={org['blocked_regions']}"
            )
        self.stdout.write(
            self.style.SUCCESS(
                f"Backfill summary: legacy={payload['summary']['legacy_region_total']} "
                f"ready={payload['summary']['migration_statuses']['READY']} "
                f"partial={payload['summary']['migration_statuses']['PARTIALLY_MAPPED']} "
                f"blocked={payload['summary']['migration_statuses']['BLOCKED']} "
                f"updated_cases={payload['summary']['updated_cases']} "
                f"full_backfills={payload['summary']['full_backfills']} "
                f"partial_backfills={payload['summary']['partial_backfills']} "
                f"skipped_cases={payload['summary']['skipped_cases']} "
                f"blocked_regions={payload['summary']['blocked_regions']} apply={apply_changes}"
            )
        )
