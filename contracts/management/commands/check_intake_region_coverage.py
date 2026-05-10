"""
Diagnose RegionalConfiguration coverage for the SPA intake form (/care/api/cases/intake-form/).

Mirrors CaseIntakeProcessForm region_qs scoping (tenant + shared NULL-org rows).
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Q

from contracts.forms import CaseIntakeProcessForm
from contracts.models import Organization, OrganizationMembership, RegionalConfiguration, RegionType

User = get_user_model()


def _orgs_filter(slug: str | None):
    qs = Organization.objects.filter(is_active=True).order_by("slug")
    if slug:
        qs = qs.filter(slug=slug)
    return qs


def _organization_for_username(username: str) -> Organization | None:
    """First active membership (CLI has no session active_organization)."""
    user = User.objects.filter(username=username).first()
    if user is None:
        return None
    m = (
        OrganizationMembership.objects.filter(
            user=user,
            is_active=True,
            organization__is_active=True,
        )
        .select_related("organization")
        .first()
    )
    return m.organization if m else None


def _raw_counts_snapshot(org: Organization | None) -> dict[str, dict[str, int]]:
    """Counts without tenant filter (global) vs tenant+shared."""
    out: dict[str, dict[str, int]] = {}
    for rt in RegionType.values:
        base = RegionalConfiguration.objects.filter(
            status=RegionalConfiguration.Status.ACTIVE,
            region_type=rt,
        )
        total_active = base.count()
        if org is None:
            scoped = base.count()
        else:
            scoped = base.filter(Q(organization=org) | Q(organization__isnull=True)).count()
        out[rt] = {"active_total_db": total_active, "intake_visible_for_org": scoped}
    return out


class Command(BaseCommand):
    help = (
        "Report region dropdown coverage per organization for nieuwe-casus (same rules as CaseIntakeProcessForm). "
        "Use after seed/reset when regio dropdown is empty."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug",
            dest="slug",
            default="",
            help="Limit to one Organization.slug (default: all active organizations).",
        )
        parser.add_argument(
            "--username",
            dest="username",
            default="",
            help="Show resolved organization via first active OrganizationMembership (no Django session in CLI).",
        )

    def handle(self, *args, **options):
        slug = (options.get("slug") or "").strip()
        username = (options.get("username") or "").strip()

        if username:
            org_u = _organization_for_username(username)
            if org_u is None:
                self.stderr.write(self.style.ERROR(f"No active organization membership for username={username!r}."))
                return
            self.stdout.write(
                self.style.NOTICE(f"User {username!r} → organization {org_u.slug} ({org_u.name})")
            )
            if slug and slug != org_u.slug:
                self.stderr.write(
                    self.style.WARNING(f"--slug={slug!r} differs from user's org {org_u.slug!r}; using user's org.")
                )
            orgs = [org_u]
        else:
            orgs = list(_orgs_filter(slug or None))
        if not orgs:
            self.stderr.write(self.style.ERROR("No organizations match the filter."))
            return

        for org in orgs:
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING(f"Organization: {org.slug} — {org.name}"))

            snap = _raw_counts_snapshot(org)
            form_default = CaseIntakeProcessForm(organization=org)
            default_type = (
                form_default.initial.get("preferred_region_type")
                or form_default.fields["preferred_region_type"].initial
                or "GEMEENTELIJK"
            )
            if hasattr(default_type, "value"):
                default_type = default_type.value
            default_type = str(default_type)

            regio_qs = form_default.fields["regio"].queryset
            pref_qs = form_default.fields["preferred_region"].queryset
            self.stdout.write(
                f"  Intake form default preferred_region_type: {default_type!r} "
                f"(regio queryset count={regio_qs.count()}, same as preferred_region={pref_qs.count()})"
            )

            if regio_qs.count() == 0:
                self.stdout.write(
                    self.style.WARNING(
                        "  [!] Geen regio's voor dit tenant + gedeelde (NULL-org) rijen bij dit regiotype — "
                        "dropdown blijft leeg. Seed RegionalConfiguration (ACTIVE) voor dit org of gebruik gedeelde rijen."
                    )
                )

            self.stdout.write("  Per RegionType (intake-visible = tenant OR organization IS NULL):")
            for rt in RegionType.values:
                row = snap[rt]
                form_rt = CaseIntakeProcessForm(
                    data={"preferred_region_type": rt},
                    organization=org,
                )
                n_form = form_rt.fields["regio"].queryset.count()
                self.stdout.write(
                    f"    {rt}: intake queryset={n_form} "
                    f"(active_total_db={row['active_total_db']}, tenant_or_shared={row['intake_visible_for_org']})"
                )

        self.stdout.write("")
        self.stdout.write(
            "Tip: default SPA intake uses GEMEENTELIJK. "
            "Zorg dat RegionalConfiguration met status=ACTIVE en region_type=GEMEENTELIJK bestaat voor deze tenant."
        )
