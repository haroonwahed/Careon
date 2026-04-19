from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError

from contracts.models import MunicipalityConfiguration, Organization, RegionalConfiguration


class Command(BaseCommand):
    help = "Toon geo backbone gezondheid per organisatie (gemeenten, regios, links)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--organization-id",
            type=int,
            help="Optioneel: check alleen voor een specifieke organisatie-id.",
        )
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Exit met foutcode als een organisatie 0 gemeenten, 0 regio's of 0 links heeft.",
        )

    def handle(self, *args, **options):
        organization_id = options.get("organization_id")
        strict = bool(options.get("strict"))

        org_qs = Organization.objects.all().order_by("id")
        if organization_id:
            org_qs = org_qs.filter(id=organization_id)

        orgs = list(org_qs)
        if not orgs:
            raise CommandError("Geen organisaties gevonden voor check.")

        self.stdout.write("Geo backbone health")
        self.stdout.write("org_id\torg_name\tgemeenten\tregios\tlinks\thealth")

        has_failures = False
        for org in orgs:
            municipalities = MunicipalityConfiguration.objects.filter(organization=org)
            regions = RegionalConfiguration.objects.filter(organization=org)

            municipality_count = municipalities.count()
            region_count = regions.count()
            linked_count = 0
            for region in regions:
                linked_count += region.served_municipalities.count()

            is_healthy = municipality_count > 0 and region_count > 0 and linked_count > 0
            health_label = "OK" if is_healthy else "MISSING_DATA"
            has_failures = has_failures or not is_healthy

            line = (
                f"{org.id}\t{org.name}\t{municipality_count}\t"
                f"{region_count}\t{linked_count}\t{health_label}"
            )
            if is_healthy:
                self.stdout.write(self.style.SUCCESS(line))
            else:
                self.stdout.write(self.style.WARNING(line))

        if strict and has_failures:
            raise CommandError("Geo backbone check gefaald: minimaal 1 organisatie mist data.")
