from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from contracts.models import Organization, RegionalConfiguration, RegionType
from contracts.region_integrity import is_municipality_mirror_region_data


class Command(BaseCommand):
    help = "Audit RegionalConfiguration data for one-to-one municipal mirror regions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--organization-id",
            type=int,
            help="Optional organization id to limit the audit to one tenant.",
        )

    def handle(self, *args, **options):
        organization_id = options.get("organization_id")
        orgs = Organization.objects.all().order_by("id")
        if organization_id:
            orgs = orgs.filter(id=organization_id)

        orgs = list(orgs)
        if not orgs:
            raise SystemExit("Geen organisaties gevonden voor region integrity audit.")

        violations = []
        for org in orgs:
            regions = (
                RegionalConfiguration.objects.filter(
                    organization=org,
                    region_type=RegionType.GEMEENTELIJK,
                )
                .prefetch_related("served_municipalities")
                .order_by("region_name", "region_code")
            )
            for region in regions:
                served = list(region.served_municipalities.all())
                if is_municipality_mirror_region_data(
                    region_type=region.region_type,
                    region_name=region.region_name,
                    region_code=region.region_code,
                    served_municipalities=served,
                ):
                    municipality = served[0]
                    violations.append(
                        (
                            org.slug,
                            region.region_name,
                            region.region_code,
                            municipality.municipality_name,
                            municipality.municipality_code,
                        )
                    )

        if not violations:
            self.stdout.write(self.style.SUCCESS("Geen gemeentelijke spiegelregio's gevonden."))
            return

        self.stdout.write(self.style.WARNING("Gemeentelijke spiegelregio's gevonden:"))
        for org_slug, region_name, region_code, municipality_name, municipality_code in violations:
            self.stdout.write(
                f"- {org_slug}: regio={region_name!r} ({region_code!r}) ↔ gemeente={municipality_name!r} ({municipality_code!r})"
            )
        raise CommandError("Gemeentelijke spiegelregio's gevonden.")
