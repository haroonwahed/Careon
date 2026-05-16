"""
Idempotent staging/pilot bootstrap: seed demo tenant only when canonical E2E users are absent.

Enable on Render (staging web service only):
  PILOT_AUTO_BOOTSTRAP=1
  E2E_DEMO_PASSWORD=pilot_demo_pass_123   # optional; defaults match prepare_pilot_e2e.sh

When demo_gemeente already exists, runs seed_pilot_e2e only (password sync). Full wipe only when
the user is missing or PILOT_FORCE_RESET=1.
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


def _demo_werkvoorraad_empty() -> bool:
    from contracts.models import CareCase, Organization

    try:
        org = Organization.objects.get(slug="gemeente-demo")
    except Organization.DoesNotExist:
        return True
    return not CareCase.objects.filter(organization=org).exists()


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
                f"bootstrap_staging_pilot: {username} exists — syncing demo passwords (seed_pilot_e2e) …",
            )
            call_command("seed_pilot_e2e", verbosity=1)
            if _env_flag("PILOT_FULL_DEMO_SEED") and _demo_werkvoorraad_empty():
                self.stdout.write(
                    self.style.WARNING(
                        "bootstrap_staging_pilot: PILOT_FULL_DEMO_SEED — "
                        "gemeente-demo has no cases; reset_pilot_environment …",
                    ),
                )
                try:
                    call_command("reset_pilot_environment", verbosity=1)
                except Exception as exc:
                    self.stderr.write(
                        self.style.ERROR(
                            f"bootstrap_staging_pilot: full demo seed failed ({exc!s}); "
                            "E2E users remain available via seed_pilot_e2e.",
                        ),
                    )
                    return
            self.stdout.write(
                self.style.SUCCESS(
                    f"bootstrap_staging_pilot: {username} ready (passwords aligned with E2E_DEMO_PASSWORD).",
                ),
            )
            return

        # Always ensure E2E users exist (passwords + memberships).
        call_command("seed_pilot_e2e", verbosity=1)

        if force or _env_flag("PILOT_FULL_DEMO_SEED"):
            label = "PILOT_FORCE_RESET" if force else "PILOT_FULL_DEMO_SEED"
            self.stdout.write(
                self.style.WARNING(
                    f"bootstrap_staging_pilot: {label} — reset_pilot_environment (full demo) …",
                ),
            )
            try:
                call_command("reset_pilot_environment", verbosity=1)
            except Exception as exc:
                self.stderr.write(
                    self.style.ERROR(
                        f"bootstrap_staging_pilot: full demo seed failed ({exc!s}); "
                        "E2E users remain available via seed_pilot_e2e.",
                    ),
                )
                return
        else:
            self.stdout.write(
                "bootstrap_staging_pilot: demo users seeded; "
                "set PILOT_FULL_DEMO_SEED=1 for full werkvoorraad on cold start.",
            )

        self.stdout.write(
            self.style.SUCCESS("bootstrap_staging_pilot: pilot users ready."),
        )
