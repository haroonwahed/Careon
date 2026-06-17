"""
Deterministic pilot / rehearsal reset for gemeente-demo tenant.

Runs locked seed_demo_data (full wipe + reseed) then seed_pilot_e2e (users + coordinator wiring).
Records rehearsal timestamp for /ops/system-state.

Typical: DJANGO_SETTINGS_MODULE=config.settings_rehearsal ./manage.py reset_pilot_environment
"""

from __future__ import annotations

import os
import subprocess
import sys

from django.core.management import call_command
from django.core.management.base import BaseCommand

from contracts.observability import record_rehearsal_run


class Command(BaseCommand):
    help = (
        "Reset pilot tenant (gemeente-demo): wipe demo-scoped data, reseed with locked clock, "
        "replay seed_pilot_e2e. Idempotent for rehearsal DBs."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-geo-sync",
            action="store_true",
            help="Skip sync_nl_reference_geo (runs it in background instead, safe for Render startup).",
        )

    def handle(self, *args, **options):
        self.stdout.write("[reset_pilot_environment] seed_demo_data --reset --locked-time …")
        call_command("seed_demo_data", reset=True, locked_time=True, verbosity=1)

        # On Render (or when --no-geo-sync is set), run geo sync in the background so gunicorn
        # can bind to a port without waiting for the PDOK/LNAZ HTTP calls to complete.
        skip_inline = options.get("no_geo_sync") or os.environ.get("RENDER") == "true"
        if skip_inline:
            self.stdout.write("[reset_pilot_environment] sync_nl_reference_geo → background (non-blocking) …")
            subprocess.Popen(
                [sys.executable, "manage.py", "sync_nl_reference_geo", "--replace-links"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            self.stdout.write("[reset_pilot_environment] sync_nl_reference_geo --replace-links …")
            call_command("sync_nl_reference_geo", replace_links=True, verbosity=1)

        self.stdout.write("[reset_pilot_environment] seed_pilot_e2e …")
        call_command("seed_pilot_e2e", verbosity=1)
        record_rehearsal_run(command="reset_pilot_environment")
        self.stdout.write(
            self.style.SUCCESS(
                "Pilot environment reset complete. Rehearsal timestamp recorded for ops cockpit.",
            ),
        )
