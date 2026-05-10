"""Emit structured Case Timeline v1 boundary evidence for pilot rehearsal (stdout JSON file only)."""

from __future__ import annotations

import json
from argparse import ArgumentParser

from django.core.management.base import BaseCommand, CommandError

from contracts.rehearsal_timeline_evidence import collect_timeline_boundary_evidence


class Command(BaseCommand):
    help = (
        "After gemeente-demo seed: run MATCHING_READY→provider review assign + timeline GET "
        "and write evidence JSON (rehearsal report)."
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            '--json-out',
            dest='json_out',
            default='',
            help='Write full evidence payload to this path.',
        )
        parser.add_argument(
            '--correlation-id',
            dest='correlation_id',
            default='rehearsal-timeline-correlation',
            help='X-Request-ID value for timeline rows.',
        )

    def handle(self, *args, **options):
        json_out = (options.get('json_out') or '').strip()
        cid = (options.get('correlation_id') or 'rehearsal-timeline-correlation').strip()

        try:
            evidence = collect_timeline_boundary_evidence(correlation_id=cid)
        except AssertionError as exc:
            raise CommandError(f'timeline boundary evidence failed: {exc}') from exc

        if json_out:
            path = json_out
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(evidence, f, indent=2, ensure_ascii=False)

        # Single quiet summary line for logs (details only in JSON file / merged report).
        self.stdout.write(
            self.style.SUCCESS(
                f"timeline_evidence ok case_id={evidence.get('case_id')} "
                f"events={evidence.get('event_count')} types={evidence.get('event_types_ordered')}",
            ),
        )
