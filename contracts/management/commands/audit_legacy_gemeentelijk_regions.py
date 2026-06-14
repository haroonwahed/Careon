from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from contracts.legacy_region_migration import build_legacy_region_reference, iterate_legacy_regions
from contracts.models import Organization


class Command(BaseCommand):
    help = (
        "Inventariseer legacy RegionType.GEMEENTELIJK records, classificeer ze en geef een machineleesbare "
        "backfill-map zonder data te wijzigen."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            dest="slug",
            default="",
            help="Beperk inventarisatie tot één Organization.slug (default: alle organisaties).",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Schrijf de volledige inventarisatie als JSON naar stdout.",
        )
        parser.add_argument(
            "--output",
            dest="output",
            default="",
            help="Optioneel pad om de JSON-inventarisatie weg te schrijven.",
        )

    def handle(self, *args, **options):
        slug = (options.get("slug") or "").strip()
        emit_json = bool(options.get("json"))
        output_path = (options.get("output") or "").strip()

        org_qs = Organization.objects.filter(is_active=True).order_by("slug")
        if slug:
            org_qs = org_qs.filter(slug=slug)
        organizations = list(org_qs)

        if not organizations:
            self.stdout.write(self.style.WARNING("Geen actieve organisaties gevonden voor de inventarisatie."))
            return

        generated_at = timezone.now().isoformat()
        payload = {
            "generated_at": generated_at,
            "scope": {"slug": slug or None},
            "summary": {
                "legacy_region_total": 0,
                "classifications": {"MIRROR": 0, "OPERATIONAL": 0, "AMBIGUOUS": 0, "ORPHANED": 0},
                "migration_statuses": {"READY": 0, "PARTIALLY_MAPPED": 0, "BLOCKED": 0},
                "reference_totals": {},
                "blockers_total": 0,
                "ambiguous_total": 0,
                "orphaned_total": 0,
            },
            "organizations": [],
        }

        for org in organizations:
            org_entries = []
            org_summary = {
                "organization_id": org.id,
                "organization_slug": org.slug,
                "organization_name": org.name,
                "legacy_region_total": 0,
                "classifications": {"MIRROR": 0, "OPERATIONAL": 0, "AMBIGUOUS": 0, "ORPHANED": 0},
                "migration_statuses": {"READY": 0, "PARTIALLY_MAPPED": 0, "BLOCKED": 0},
                "reference_totals": {},
                "blockers_total": 0,
            }
            for region in iterate_legacy_regions(organization=org):
                reference = build_legacy_region_reference(region=region, timestamp=generated_at)
                org_entries.append(reference.as_dict())
                org_summary["legacy_region_total"] += 1
                org_summary["classifications"][reference.classification] += 1
                org_summary["migration_statuses"][reference.migration_status] += 1
                org_summary["blockers_total"] += len(reference.blockers)
                if reference.classification in {"AMBIGUOUS"}:
                    payload["summary"]["ambiguous_total"] += 1
                if reference.classification in {"ORPHANED"}:
                    payload["summary"]["orphaned_total"] += 1
                payload["summary"]["legacy_region_total"] += 1
                payload["summary"]["classifications"][reference.classification] += 1
                payload["summary"]["migration_statuses"][reference.migration_status] += 1
                for key, value in reference.references.items():
                    org_summary["reference_totals"][key] = org_summary["reference_totals"].get(key, 0) + value
                    payload["summary"]["reference_totals"][key] = payload["summary"]["reference_totals"].get(key, 0) + value
                if reference.blockers:
                    payload["summary"]["blockers_total"] += len(reference.blockers)

            payload["organizations"].append(
                {
                    **org_summary,
                    "regions": org_entries,
                }
            )

        if output_path:
            target = Path(output_path).expanduser().resolve()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"JSON-inventarisatie geschreven naar {target}"))

        if emit_json:
            self.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False))
            return

        for org in payload["organizations"]:
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING(f"{org['organization_slug']} — {org['organization_name']}"))
            self.stdout.write(
                f"  legacy={org['legacy_region_total']} "
                f"mirror={org['classifications']['MIRROR']} "
                f"operational={org['classifications']['OPERATIONAL']} "
                f"ambiguous={org['classifications']['AMBIGUOUS']} "
                f"orphaned={org['classifications']['ORPHANED']} "
                f"ready={org['migration_statuses']['READY']} "
                f"partial={org['migration_statuses']['PARTIALLY_MAPPED']} "
                f"blocked={org['migration_statuses']['BLOCKED']}"
            )
            for row in org["regions"]:
                self.stdout.write(
                    f"  - [{row['classification']}] {row['legacy_region_id']} "
                    f"{row['municipality_name'] or '-'} -> {row['youth_region_name'] or '-'} "
                    f"status={row['migration_status']} blockers={len(row['blockers'])}"
                )

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Inventarisatie afgerond."))
