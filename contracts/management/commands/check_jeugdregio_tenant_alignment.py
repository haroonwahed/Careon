from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from contracts.jeugdregio_reference import (
    build_jeugdregio_manifest,
    municipality_code_from_name,
    normalize_municipality_name,
    normalize_text,
)
from contracts.models import MunicipalityConfiguration, Organization, RegionalConfiguration, RegionType


class Command(BaseCommand):
    help = "Validate tenant-specific JEUGDREGIO alignment against the normalized CareOn snapshot."

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            default="",
            help="Beperk de validatie tot één Organization.slug (default: alle actieve organisaties).",
        )
        parser.add_argument(
            "--json",
            action="store_true",
            help="Write the validation report as JSON to stdout.",
        )
        parser.add_argument(
            "--output",
            default="",
            help="Optional path to write the JSON validation report.",
        )

    def handle(self, *args, **options):
        manifest = build_jeugdregio_manifest()
        expected_by_municipality = {}
        for link in manifest["municipality_links"]:
            expected_by_municipality[normalize_text(link["municipality_name"])] = {
                "municipality_name": link["municipality_name"],
                "municipality_code": link["municipality_code"],
                "region_name": link["region_name"],
                "region_code": link["region_code"],
            }

        slug = (options.get("slug") or "").strip()
        orgs = Organization.objects.filter(is_active=True).order_by("slug")
        if slug:
            orgs = orgs.filter(slug=slug)
        organizations = list(orgs)
        if not organizations:
            self.stdout.write(self.style.WARNING("Geen actieve organisaties gevonden voor tenant-validatie."))
            return

        payload = {
            "snapshot": manifest["snapshot"],
            "summary": {
                "municipality_total": 0,
                "ready": 0,
                "partially_mapped": 0,
                "blocked": 0,
                "code_matches": 0,
                "code_mismatches": 0,
                "active_region_mismatches": 0,
                "municipalities_without_active_region": 0,
            },
            "organizations": [],
        }

        for org in organizations:
            org_entries = []
            org_summary = {
                "organization_id": org.id,
                "organization_slug": org.slug,
                "organization_name": org.name,
                "municipality_total": 0,
                "ready": 0,
                "partially_mapped": 0,
                "blocked": 0,
                "code_matches": 0,
                "code_mismatches": 0,
                "active_region_mismatches": 0,
                "municipalities_without_active_region": 0,
            }
            municipalities = (
                MunicipalityConfiguration.objects.filter(
                    organization=org,
                    status=MunicipalityConfiguration.Status.ACTIVE,
                )
                .prefetch_related("regions")
                .order_by("municipality_name", "municipality_code", "id")
            )

            for municipality in municipalities:
                canonical_name = normalize_municipality_name(municipality.municipality_name)
                expected = expected_by_municipality.get(normalize_text(canonical_name))
                active_regions = list(
                    municipality.regions.filter(
                        status=RegionalConfiguration.Status.ACTIVE,
                        region_type=RegionType.JEUGDREGIO,
                    ).order_by("region_name", "region_code", "id")
                )
                expected_code = municipality_code_from_name(canonical_name)
                code_matches = municipality.municipality_code == expected_code
                active_region_match = bool(
                    expected
                    and len(active_regions) == 1
                    and normalize_text(active_regions[0].region_name) == normalize_text(expected["region_name"])
                )

                if expected and code_matches and active_region_match:
                    status = "READY"
                    reason = "Gemeente, code en actieve JEUGDREGIO sluiten aan op de CareOn-snapshot."
                elif expected and active_region_match:
                    status = "PARTIALLY_MAPPED"
                    reason = "Gemeente en actieve JEUGDREGIO sluiten aan, maar de tenant-code wijkt af van de snapshotcode."
                elif expected:
                    status = "BLOCKED"
                    reason = "Gemeente kan niet eenduidig aan een actieve JEUGDREGIO worden gekoppeld."
                else:
                    status = "BLOCKED"
                    reason = "Gemeente staat niet in de CareOn-referentiesnapshot."

                if not active_regions:
                    org_summary["municipalities_without_active_region"] += 1
                if code_matches:
                    org_summary["code_matches"] += 1
                else:
                    org_summary["code_mismatches"] += 1
                if expected and not active_region_match:
                    org_summary["active_region_mismatches"] += 1

                org_summary["municipality_total"] += 1
                org_summary[status.lower()] += 1

                entry = {
                    "municipality_id": municipality.id,
                    "municipality_name": municipality.municipality_name,
                    "municipality_code": municipality.municipality_code,
                    "canonical_name": canonical_name,
                    "expected_region": expected,
                    "active_regions": [
                        {
                            "region_id": region.id,
                            "region_name": region.region_name,
                            "region_code": region.region_code,
                            "region_type": region.region_type,
                        }
                        for region in active_regions
                    ],
                    "status": status,
                    "reason": reason,
                    "code_matches": code_matches,
                    "active_region_match": active_region_match,
                }
                org_entries.append(entry)

            payload["organizations"].append({**org_summary, "municipalities": org_entries})
            for key in payload["summary"].keys():
                if key == "municipality_total":
                    payload["summary"][key] += org_summary[key]
                elif key in {"ready", "partially_mapped", "blocked", "code_matches", "code_mismatches", "active_region_mismatches", "municipalities_without_active_region"}:
                    payload["summary"][key] += org_summary[key]

        output_path = (options.get("output") or "").strip()
        if output_path:
            target = Path(output_path).expanduser().resolve()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Validation JSON written to {target}"))

        if options.get("json"):
            self.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("JEUGDREGIO tenant validation"))
        self.stdout.write(
            f"municipalities={payload['summary']['municipality_total']} ready={payload['summary']['ready']} "
            f"partial={payload['summary']['partially_mapped']} blocked={payload['summary']['blocked']} "
            f"code_matches={payload['summary']['code_matches']} code_mismatches={payload['summary']['code_mismatches']} "
            f"active_region_mismatches={payload['summary']['active_region_mismatches']} "
            f"municipalities_without_active_region={payload['summary']['municipalities_without_active_region']}"
        )
        for org in payload["organizations"]:
            self.stdout.write(
                f"- {org['organization_slug']}: municipalities={org['municipality_total']} "
                f"ready={org['ready']} partial={org['partially_mapped']} blocked={org['blocked']} "
                f"code_matches={org['code_matches']} code_mismatches={org['code_mismatches']} "
                f"active_region_mismatches={org['active_region_mismatches']} "
                f"municipalities_without_active_region={org['municipalities_without_active_region']}"
            )
