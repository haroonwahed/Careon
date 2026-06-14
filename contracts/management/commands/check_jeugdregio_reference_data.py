from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from contracts.jeugdregio_reference import build_jeugdregio_manifest, validate_jeugdregio_manifest


class Command(BaseCommand):
    help = "Validate the checked-in JEUGDREGIO reference snapshot and report mapping issues."

    def add_arguments(self, parser):
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
        report = validate_jeugdregio_manifest(manifest)
        payload = {
            "snapshot": manifest["snapshot"],
            "summary": report["summary"],
            "issues": report["issues"],
            "regions": manifest["regions"],
            "municipality_links": manifest["municipality_links"],
        }

        output_path = (options.get("output") or "").strip()
        if output_path:
            target = Path(output_path).expanduser().resolve()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            self.stdout.write(self.style.SUCCESS(f"Validation JSON written to {target}"))

        if options.get("json"):
            self.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("JEUGDREGIO reference validation"))
        self.stdout.write(
            f"peildatum={payload['snapshot']['peildatum']} regions={report['summary']['region_count']} "
            f"active={report['summary']['active_region_count']} inactive={report['summary']['inactive_region_count']} "
            f"municipality_links={report['summary']['municipality_link_count']} "
            f"regions_without_municipalities={report['summary']['regions_without_municipalities']} "
            f"issues={report['summary']['issues_count']}"
        )
        for issue in report["issues"]:
            self.stdout.write(
                f"- [{issue['severity']}] {issue['code']}: {issue['message']}"
            )

