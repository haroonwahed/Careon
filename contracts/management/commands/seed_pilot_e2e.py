"""
Canonical pilot E2E dataset for settings_rehearsal (db_rehearsal.sqlite3).

Seeds one org with:
- demo_gemeente + demo providers (E2E_DEMO_PASSWORD)
- e2e_owner for pilot-smoke (E2E_SMOKE_PASSWORD)

Run via: ./scripts/prepare_pilot_e2e.sh or
  DJANGO_SETTINGS_MODULE=config.settings_rehearsal \\
  E2E_DEMO_PASSWORD=... E2E_SMOKE_PASSWORD=... \\
  ./manage.py seed_pilot_e2e

Legacy: if E2E_PASSWORD is set and explicit vars are not, both tiers use E2E_PASSWORD.
"""

from __future__ import annotations

import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from contracts.models import (
    Client,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    ProviderProfile,
    RegionalConfiguration,
    UserProfile,
)

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
    help = "Seed canonical pilot E2E users and org (rehearsal DB). Idempotent for users/org."

    def handle(self, *args, **options):
        demo_pw = _resolve_demo_password()
        smoke_pw = _resolve_smoke_password()

        gemeente_username = os.environ.get("E2E_GEMEENTE_USERNAME", "demo_gemeente")
        provider_one_u = os.environ.get("E2E_PROVIDER_ONE_USERNAME", "demo_provider_brug")
        provider_two_u = os.environ.get("E2E_PROVIDER_TWO_USERNAME", "demo_provider_kompas")
        smoke_username = os.environ.get("E2E_USERNAME", "e2e_owner")
        municipality_name = os.environ.get("E2E_MUNICIPALITY_NAME", "Gemeente Utrecht")
        region_name = os.environ.get("E2E_REGION_NAME", "Regio Utrecht")
        provider_one_name = os.environ.get("E2E_PROVIDER_ONE_NAME", "Jeugdzorg De Brug")
        provider_two_name = os.environ.get("E2E_PROVIDER_TWO_NAME", "Kompas Jeugdzorg")

        org, _ = Organization.objects.get_or_create(
            slug="pilot-demo-org",
            defaults={"name": "Pilot Demo Org", "is_active": True},
        )
        org.name = "Pilot Demo Org"
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

        gemeente_user = ensure_user(
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
            "demo.provider.brug@example.com",
            "Jeugdzorg",
            "De Brug",
            demo_pw,
            membership_role=OrganizationMembership.Role.MEMBER,
            profile_role=UserProfile.Role.CLIENT,
        )
        provider_two_user = ensure_user(
            provider_two_u,
            "demo.provider.kompas@example.com",
            "Kompas",
            "Jeugdzorg",
            demo_pw,
            membership_role=OrganizationMembership.Role.MEMBER,
            profile_role=UserProfile.Role.CLIENT,
        )
        # pilot-smoke: owner-style account (matches verify_ui expectations)
        ensure_user(
            smoke_username,
            f"{smoke_username}@example.com",
            "E2E",
            "Owner",
            smoke_pw,
            membership_role=OrganizationMembership.Role.OWNER,
            profile_role=UserProfile.Role.ASSOCIATE,
        )

        municipality, _ = MunicipalityConfiguration.objects.get_or_create(
            organization=org,
            municipality_code="UTR-DEMO",
            defaults={
                "municipality_name": municipality_name,
                "province": "Utrecht",
                "created_by": gemeente_user,
            },
        )
        municipality.municipality_name = municipality_name
        municipality.status = MunicipalityConfiguration.Status.ACTIVE
        municipality.responsible_coordinator = gemeente_user
        municipality.save(
            update_fields=["municipality_name", "status", "responsible_coordinator", "updated_at"],
        )

        region, _ = RegionalConfiguration.objects.get_or_create(
            organization=org,
            region_code="REG-DEMO",
            defaults={
                "region_name": region_name,
                "region_type": "GEMEENTELIJK",
                "province": "Utrecht",
                "created_by": gemeente_user,
            },
        )
        region.region_name = region_name
        region.region_type = "GEMEENTELIJK"
        region.status = RegionalConfiguration.Status.ACTIVE
        region.responsible_coordinator = gemeente_user
        region.save(
            update_fields=[
                "region_name",
                "region_type",
                "status",
                "responsible_coordinator",
                "updated_at",
            ],
        )
        region.served_municipalities.set([municipality])

        for provider_name, username, coord_user in [
            (provider_one_name, provider_one_u, provider_one_user),
            (provider_two_name, provider_two_u, provider_two_user),
        ]:
            provider_client, _ = Client.objects.get_or_create(
                organization=org,
                name=provider_name,
                defaults={
                    "client_type": Client.ClientType.CORPORATION,
                    "status": Client.Status.ACTIVE,
                    "created_by": gemeente_user,
                    "city": "Utrecht",
                    "responsible_coordinator": coord_user,
                },
            )
            provider_client.client_type = Client.ClientType.CORPORATION
            provider_client.status = Client.Status.ACTIVE
            provider_client.created_by = gemeente_user
            provider_client.city = "Utrecht"
            provider_client.responsible_coordinator = coord_user
            provider_client.save(
                update_fields=[
                    "client_type",
                    "status",
                    "created_by",
                    "city",
                    "responsible_coordinator",
                    "updated_at",
                ],
            )

            profile, _ = ProviderProfile.objects.get_or_create(
                client=provider_client,
                defaults={
                    "target_age_12_18": True,
                    "offers_outpatient": True,
                    "handles_simple": True,
                    "handles_multiple": True,
                    "handles_low_urgency": True,
                    "handles_medium_urgency": True,
                    "handles_high_urgency": True,
                    "current_capacity": 4,
                    "max_capacity": 8,
                    "waiting_list_length": 1,
                    "average_wait_days": 2,
                    "service_area": "Utrecht",
                    "special_facilities": "Pilot E2E capaciteit",
                },
            )
            profile.offers_outpatient = True
            profile.handles_simple = True
            profile.handles_multiple = True
            profile.handles_low_urgency = True
            profile.handles_medium_urgency = True
            profile.handles_high_urgency = True
            profile.current_capacity = 4
            profile.max_capacity = 8
            profile.waiting_list_length = 1
            profile.average_wait_days = 2
            profile.service_area = "Utrecht"
            profile.special_facilities = "Pilot E2E capaciteit"
            profile.save()
            profile.served_regions.set([region])

        self.stdout.write(
            self.style.SUCCESS(
                f"seed_pilot_e2e: org={org.slug} "
                f"gemeente={gemeente_username} demo_pw_set providers={provider_one_u},{provider_two_u} "
                f"smoke_user={smoke_username}",
            ),
        )
