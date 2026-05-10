"""
Canonical pilot E2E dataset for settings_rehearsal (db_rehearsal.sqlite3).

Seeds users into the same organization as `seed_demo_data` (**gemeente-demo**) so that:
- Playwright pilot flows share one tenant with the rich demo werkvoorraad
- Provider accounts are wired as `Client.responsible_coordinator` for placement-scoped visibility

Run via: ./scripts/prepare_pilot_e2e.sh or
  DJANGO_SETTINGS_MODULE=config.settings_rehearsal \\
  E2E_DEMO_PASSWORD=... E2E_SMOKE_PASSWORD=... \\
  ./manage.py seed_pilot_e2e

Legacy: if E2E_PASSWORD is set and explicit vars are not, both tiers use E2E_PASSWORD.

**Prepare script order:** run `seed_demo_data` first (full pilot ecosystem), then `seed_pilot_e2e`
(users + coordinator wiring).
"""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from contracts.models import Client, Organization, OrganizationMembership, UserProfile

User = get_user_model()


def _resolve_demo_password() -> str:
    return (
        os.environ.get("E2E_DEMO_PASSWORD")
        or os.environ.get("E2E_PASSWORD")
        or "pilot_demo_pass_123"
    )


def _resolve_smoke_password() -> str:
    return (
        os.environ.get("E2E_SMOKE_PASSWORD")
        or os.environ.get("E2E_PASSWORD")
        or "e2e_pass_123"
    )


class Command(BaseCommand):
    help = "Seed canonical pilot E2E users (aligned with seed_demo_data org slug gemeente-demo)."

    def handle(self, *args, **options):
        demo_pw = _resolve_demo_password()
        smoke_pw = _resolve_smoke_password()

        gemeente_username = os.environ.get("E2E_GEMEENTE_USERNAME", "demo_gemeente")
        provider_one_u = os.environ.get("E2E_PROVIDER_ONE_USERNAME", "demo_provider_brug")
        provider_two_u = os.environ.get("E2E_PROVIDER_TWO_USERNAME", "demo_provider_kompas")
        smoke_username = os.environ.get("E2E_USERNAME", "e2e_owner")

        provider_one_name = os.environ.get("E2E_PROVIDER_ONE_NAME", "Horizon Jeugdzorg")
        provider_two_name = os.environ.get("E2E_PROVIDER_TWO_NAME", "Kompas Zorg")

        org, _ = Organization.objects.get_or_create(
            slug="gemeente-demo",
            defaults={"name": "Gemeente Demo", "is_active": True},
        )
        org.name = "Gemeente Demo"
        org.is_active = True
        org.save(update_fields=["name", "is_active", "updated_at"])

        def ensure_user(
            username: str,
            email: str,
            first_name: str,
            last_name: str,
            password: str,
            *,
            membership_role: OrganizationMembership.Role,
            profile_role: UserProfile.Role,
        ):
            user, _ = User.objects.get_or_create(username=username, defaults={"email": email})
            user.email = email
            user.first_name = first_name
            user.last_name = last_name
            user.is_active = True
            user.set_password(password)
            user.save()
            OrganizationMembership.objects.update_or_create(
                organization=org,
                user=user,
                defaults={"role": membership_role, "is_active": True},
            )
            profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": profile_role})
            profile.role = profile_role
            profile.save(update_fields=["role"])
            return user

        ensure_user(
            gemeente_username,
            "demo.gemeente@example.com",
            "Demo",
            "Gemeente",
            demo_pw,
            membership_role=OrganizationMembership.Role.MEMBER,
            profile_role=UserProfile.Role.ASSOCIATE,
        )
        provider_one_user = ensure_user(
            provider_one_u,
            "demo.provider.horizon@example.com",
            "Jeugdzorg",
            "Horizon",
            demo_pw,
            membership_role=OrganizationMembership.Role.MEMBER,
            profile_role=UserProfile.Role.CLIENT,
        )
        provider_two_user = ensure_user(
            provider_two_u,
            "demo.provider.kompas@example.com",
            "Kompas",
            "Zorg",
            demo_pw,
            membership_role=OrganizationMembership.Role.MEMBER,
            profile_role=UserProfile.Role.CLIENT,
        )
        ensure_user(
            smoke_username,
            f"{smoke_username}@example.com",
            "E2E",
            "Owner",
            smoke_pw,
            membership_role=OrganizationMembership.Role.OWNER,
            profile_role=UserProfile.Role.ASSOCIATE,
        )

        def wire_provider_if_present(user: User, provider_label: str):
            client = (
                Client.objects.filter(organization=org, name=provider_label)
                .order_by("id")
                .first()
            )
            if client is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"seed_pilot_e2e: geen Client '{provider_label}' — run seed_demo_data eerst.",
                    ),
                )
                return
            client.responsible_coordinator = user
            client.save(update_fields=["responsible_coordinator", "updated_at"])

        wire_provider_if_present(provider_one_user, provider_one_name)
        wire_provider_if_present(provider_two_user, provider_two_name)

        self.stdout.write(
            self.style.SUCCESS(
                f"seed_pilot_e2e: org={org.slug} "
                f"gemeente={gemeente_username} demo_pw_set providers={provider_one_u},{provider_two_u} "
                f"smoke_user={smoke_username}",
            ),
        )
