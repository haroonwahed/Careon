"""
Post-seed pilot rehearsal checks (tenancy, routes, API smoke, escalation lane).

Run after `reset_pilot_environment` or `seed_demo_data` + `seed_pilot_e2e`.
"""

from __future__ import annotations

import json
import os
from typing import Any, Callable

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.test import Client as DjangoTestClient
from django.urls import reverse

from contracts.models import CareCase, CaseIntakeProcess, Client as ProviderClient, Organization, OrganizationMembership, PlacementRequest, UserProfile
from contracts.pilot_universe import (
    PILOT_CASE_TITLES,
    PILOT_ORG_SLUG,
    PILOT_PROVIDER_CLIENT_NAMES,
)
from contracts.workflow_state_machine import WorkflowRole, resolve_actor_role

User = get_user_model()


def _demo_password() -> str:
    return (
        os.environ.get("E2E_DEMO_PASSWORD")
        or os.environ.get("E2E_PASSWORD")
        or "pilot_demo_pass_123"
    )


def _gemeente_username() -> str:
    return os.environ.get("E2E_GEMEENTE_USERNAME", "demo_gemeente")


class Command(BaseCommand):
    help = "Verify pilot tenant, memberships, routes, APIs, placements, and escalation (Casus J)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--json",
            action="store_true",
            help="Emit one JSON object with checks[] and ok boolean (stdout only).",
        )

    def handle(self, *args, **options):
        want_json: bool = options["json"]
        checks: list[dict[str, Any]] = []
        failures: list[str] = []

        def record(name: str, fn: Callable[[], None]) -> None:
            try:
                fn()
                checks.append({"name": name, "ok": True})
                if not want_json:
                    self.stdout.write(self.style.SUCCESS(f"PASS  {name}"))
            except Exception as exc:  # noqa: BLE001 — surface all rehearsal failures
                msg = f"{exc}"
                checks.append({"name": name, "ok": False, "error": msg})
                failures.append(f"{name}: {msg}")
                if not want_json:
                    self.stdout.write(self.style.ERROR(f"FAIL  {name}: {msg}"))

        org_holder: dict[str, Organization | None] = {"org": None}

        def verify_org() -> None:
            org = Organization.objects.filter(slug=PILOT_ORG_SLUG, is_active=True).first()
            if org is None:
                raise ValueError(f"Missing active organization slug={PILOT_ORG_SLUG!r}")
            org_holder["org"] = org

        def verify_case_inventory() -> None:
            org = org_holder["org"]
            assert org is not None
            qs = CareCase.objects.filter(organization=org)
            if qs.count() != len(PILOT_CASE_TITLES):
                raise ValueError(
                    f"Expected {len(PILOT_CASE_TITLES)} cases for pilot org, found {qs.count()}",
                )
            titles = set(qs.values_list("title", flat=True))
            missing = [t for t in PILOT_CASE_TITLES if t not in titles]
            if missing:
                raise ValueError(f"Missing pilot cases: {missing}")

        def verify_providers() -> None:
            org = org_holder["org"]
            assert org is not None
            for name in PILOT_PROVIDER_CLIENT_NAMES:
                if not ProviderClient.objects.filter(organization=org, name=name).exists():
                    raise ValueError(f"Missing provider Client {name!r}")

        def verify_e2e_memberships() -> None:
            org = org_holder["org"]
            assert org is not None
            pw = _demo_password()
            for username, profile_role in (
                (_gemeente_username(), UserProfile.Role.ASSOCIATE),
                (os.environ.get("E2E_PROVIDER_ONE_USERNAME", "demo_provider_brug"), UserProfile.Role.CLIENT),
                (os.environ.get("E2E_PROVIDER_TWO_USERNAME", "demo_provider_kompas"), UserProfile.Role.CLIENT),
            ):
                user = User.objects.filter(username=username).first()
                if user is None:
                    raise ValueError(f"Missing user {username!r} (seed_pilot_e2e)")
                if not user.check_password(pw):
                    raise ValueError(f"Password mismatch for {username!r} vs E2E_DEMO_PASSWORD")
                m = OrganizationMembership.objects.filter(
                    organization=org, user=user, is_active=True
                ).first()
                if m is None:
                    raise ValueError(f"No active membership for {username!r}")
                prof = getattr(user, "profile", None)
                if prof is None or prof.role != profile_role:
                    raise ValueError(f"UserProfile.role for {username!r} expected {profile_role}, got {getattr(prof, 'role', None)!r}")

        def verify_actor_roles() -> None:
            org = org_holder["org"]
            assert org is not None
            u_g = User.objects.get(username=_gemeente_username())
            if resolve_actor_role(user=u_g, organization=org) != WorkflowRole.GEMEENTE:
                raise ValueError("demo_gemeente must resolve to GEMEENTE workflow role")
            u_p = User.objects.get(username=os.environ.get("E2E_PROVIDER_TWO_USERNAME", "demo_provider_kompas"))
            if resolve_actor_role(user=u_p, organization=org) != WorkflowRole.ZORGAANBIEDER:
                raise ValueError("demo_provider_kompas must resolve to ZORGAANBIEDER workflow role")

        def verify_no_orphan_placements() -> None:
            n = PlacementRequest.objects.filter(due_diligence_process__isnull=True).count()
            if n != 0:
                raise ValueError(f"Found {n} orphan PlacementRequest rows (missing intake link)")

        def verify_routes() -> None:
            reverse("build_info")
            reverse("ops_system_state")
            reverse("careon:cases_api")
            case = CareCase.objects.filter(organization__slug=PILOT_ORG_SLUG).first()
            if case is None:
                raise ValueError("No CareCase to resolve case_detail_api")
            reverse("careon:case_detail_api", kwargs={"case_id": case.pk})

        def verify_api_smoke() -> None:
            client = DjangoTestClient()
            ok = client.login(username=_gemeente_username(), password=_demo_password())
            if not ok:
                raise ValueError("Client.login failed for gemeente demo user")
            r = client.get("/care/api/me/")
            if r.status_code != 200:
                raise ValueError(f"GET /care/api/me/ => {r.status_code}")
            r2 = client.get("/care/api/cases/")
            if r2.status_code != 200:
                raise ValueError(f"GET /care/api/cases/ => {r2.status_code}")
            body = json.loads(r2.content.decode())
            if "contracts" not in body:
                raise ValueError("cases API JSON missing 'contracts'")

        def verify_escalation_casus_j() -> None:
            org = org_holder["org"]
            assert org is not None
            title = PILOT_CASE_TITLES[9]
            intake = CaseIntakeProcess.objects.filter(
                organization=org,
                title=title,
            ).first()
            if intake is None:
                raise ValueError(f"No intake for {title!r} (escalation rehearsal row)")
            if intake.urgency != CaseIntakeProcess.Urgency.CRISIS:
                raise ValueError(
                    f"{title} urgency expected CRISIS for escalation lane, got {intake.urgency!r}",
                )

        for name, fn in (
            ("tenant_org", verify_org),
            ("case_inventory", verify_case_inventory),
            ("provider_clients", verify_providers),
            ("e2e_memberships", verify_e2e_memberships),
            ("workflow_roles", verify_actor_roles),
            ("no_orphan_placements", verify_no_orphan_placements),
            ("routes_reverse", verify_routes),
            ("api_me_and_cases", verify_api_smoke),
            ("escalation_casus_j", verify_escalation_casus_j),
        ):
            record(name, fn)

        all_ok = len(failures) == 0
        payload = {"ok": all_ok, "checks": checks}

        if want_json:
            self.stdout.write(json.dumps(payload, indent=2))
        elif failures:
            self.stdout.write(self.style.ERROR("\n".join(failures)))

        if not all_ok:
            raise CommandError(f"rehearsal_verify: {len(failures)} check(s) failed")

        # With --json, stdout must contain only the JSON object (merge/release_evidence_bundle parse it).
        if not want_json:
            self.stdout.write(self.style.SUCCESS("rehearsal_verify: all checks passed."))
