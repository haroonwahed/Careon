"""
Idempotent staging/pilot bootstrap: seed demo tenant only when canonical E2E users are absent.

Enable on Render (staging web service only):
  PILOT_AUTO_BOOTSTRAP=1
  E2E_DEMO_PASSWORD=pilot_demo_pass_123   # optional; defaults match prepare_pilot_e2e.sh

Does not wipe an existing pilot DB when demo_gemeente already exists.
"""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand

User = get_user_model()


def _env_flag(name: str) -> bool:
    return str(os.environ.get(name, "")).strip().lower() in ("1", "true", "yes")


def _gemeente_username() -> str:
    return os.environ.get("E2E_GEMEENTE_USERNAME", "demo_gemeente")


class Command(BaseCommand):
    help = (
        "When PILOT_AUTO_BOOTSTRAP=1, run reset_pilot_environment only if demo_gemeente "
        "is missing (safe for staging cold start)."
    )

    def handle(self, *args, **options):
        if not _env_flag("PILOT_AUTO_BOOTSTRAP"):
            self.stdout.write(
                "bootstrap_staging_pilot: skipped (set PILOT_AUTO_BOOTSTRAP=1 to enable).",
            )
            return

        username = _gemeente_username()
        force = _env_flag("PILOT_FORCE_RESET")
        if User.objects.filter(username=username).exists() and not force:
            self.stdout.write(
                self.style.SUCCESS(
                    f"bootstrap_staging_pilot: {username} exists — no reset.",
                ),
            )
            return

        if force:
            self.stdout.write(
                self.style.WARNING(
                    f"bootstrap_staging_pilot: PILOT_FORCE_RESET — reset_pilot_environment …",
                ),
            )
        else:
            self.stdout.write(
                f"bootstrap_staging_pilot: {username} missing — running reset_pilot_environment …",
            )
        call_command("reset_pilot_environment", verbosity=1)
        self.stdout.write(
            self.style.SUCCESS("bootstrap_staging_pilot: pilot tenant ready."),
        )
