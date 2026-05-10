"""Write merged release/readiness evidence bundle and enforce timeline GO/NO-GO."""

from __future__ import annotations

import json
from argparse import ArgumentParser
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from contracts.release_evidence_bundle import build_release_evidence_bundle


class Command(BaseCommand):
    help = (
        'Merge rehearsal timeline evidence files under reports/ and validate pilot GO/NO-GO '
        '(Case Timeline v1 boundary).'
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            '--base-dir',
            dest='base_dir',
            default='',
            help='Repository root (default: Django BASE_DIR).',
        )
        parser.add_argument(
            '--write-json',
            dest='write_json',
            default='',
            help='Write bundle JSON (default: <base-dir>/reports/release_evidence_bundle.json).',
        )
        parser.add_argument(
            '--report-only',
            action='store_true',
            help='Write JSON but do not exit non-zero on NO-GO.',
        )

    def handle(self, *args, **options):
        raw_base = options.get('base_dir')
        if raw_base is None or raw_base == '':
            base = Path(settings.BASE_DIR)
        elif isinstance(raw_base, Path):
            base = raw_base
        else:
            s = str(raw_base).strip()
            base = Path(s) if s else Path(settings.BASE_DIR)

        raw_out = options.get('write_json')
        if raw_out is None or raw_out == '':
            out_path = base / 'reports' / 'release_evidence_bundle.json'
        elif isinstance(raw_out, Path):
            out_path = raw_out
        else:
            os_out = str(raw_out).strip()
            out_path = Path(os_out) if os_out else base / 'reports' / 'release_evidence_bundle.json'

        bundle = build_release_evidence_bundle(base)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(bundle, indent=2, ensure_ascii=False), encoding='utf-8')

        tg = bundle.get('timeline_gate') or {}
        go = bool(tg.get('go'))
        reasons = tg.get('no_go_reasons') or []

        if go:
            self.stdout.write(self.style.SUCCESS(f'release_evidence_bundle: GO — wrote {out_path}'))
        else:
            self.stdout.write(
                self.style.ERROR(f'release_evidence_bundle: NO-GO — {reasons} — wrote {out_path}'),
            )

        if not options.get('report_only') and not go:
            raise CommandError(f'timeline gate NO-GO: {reasons}')
