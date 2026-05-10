"""
Deterministic pilot / rehearsal reset for gemeente-demo tenant.

Runs locked seed_demo_data (full wipe + reseed) then seed_pilot_e2e (users + coordinator wiring).
Records rehearsal timestamp for /ops/system-state.

Typical: DJANGO_SETTINGS_MODULE=config.settings_rehearsal ./manage.py reset_pilot_environment
"""

from __future__ import annotations

from django.core.management import call_command
from django.core.management.base import BaseCommand

from contracts.observability import record_rehearsal_run


class Command(BaseCommand):
    help = (
        "Reset pilot tenant (gemeente-demo): wipe demo-scoped data, reseed with locked clock, "
        "replay seed_pilot_e2e. Idempotent for rehearsal DBs."
    )

    def handle(self, *args, **options):
        self.stdout.write("[reset_pilot_environment] seed_demo_data --reset --locked-time …")
        call_command("seed_demo_data", reset=True, locked_time=True, verbosity=1)
        self.stdout.write("[reset_pilot_environment] seed_pilot_e2e …")
        call_command("seed_pilot_e2e", verbosity=1)
        record_rehearsal_run(command="reset_pilot_environment")
        self.stdout.write(
            self.style.SUCCESS(
                "Pilot environment reset complete. Rehearsal timestamp recorded for ops cockpit.",
            ),
        )
