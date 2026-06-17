"""
Ensure ContractRelatie + ProviderRegioDekking (+ SPA provider clients) for an organisation
so advisory matching can return non-excluded candidates on the matching page.

Typical use after creating casussen under a non-demo tenant (e.g. personal pilot org):
  DATABASE_URL= python manage.py seed_demo_data
  DATABASE_URL= python manage.py ensure_org_matching_contracts --org-slug=haroonwahed
"""

from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    Client,
    ContractRelatie,
    Organization,
    ProviderProfile,
    ProviderRegioDekking,
    RegionalConfiguration,
    Zorgaanbieder,
)
from contracts.pilot_universe import PILOT_ORG_SLUG, PILOT_PROVIDER_CLIENT_NAMES


class Command(BaseCommand):
    help = (
        "Copy demo provider contracts (and SPA provider clients) from the pilot gemeente org "
        "so matching candidates are not hard-excluded for another organisation."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--org-slug",
            required=True,
            help="Target organisation slug (e.g. haroonwahed).",
        )
        parser.add_argument(
            "--template-org-slug",
            default=PILOT_ORG_SLUG,
            help=f"Source organisation with seeded contracts (default: {PILOT_ORG_SLUG}).",
        )
        parser.add_argument(
            "--re-persist-case",
            type=int,
            default=None,
            help="Optional CareCase pk to re-run advisory matching persist after wiring contracts.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        target = Organization.objects.filter(slug=options["org_slug"]).first()
        if target is None:
            raise CommandError(f"Organisation not found: {options['org_slug']}")

        template = Organization.objects.filter(slug=options["template_org_slug"]).first()
        if template is None:
            raise CommandError(
                f"Template organisation not found: {options['template_org_slug']}. "
                "Run seed_demo_data first."
            )

        contracts_created = self._copy_contracts(template=template, target=target)
        clients_created = self._copy_provider_clients(template=template, target=target)
        coverage_created = self._ensure_case_region_coverage(target=target)

        self.stdout.write(
            self.style.SUCCESS(
                f"ensure_org_matching_contracts: org={target.slug} "
                f"contracts_upserted={contracts_created} "
                f"provider_clients_upserted={clients_created} "
                f"regio_dekking_upserted={coverage_created}"
            )
        )

        case_id = options.get("re_persist_case")
        if case_id:
            self._re_persist_matching(case_id=case_id, organization=target)

    def _copy_contracts(self, *, template: Organization, target: Organization) -> int:
        count = 0
        for src in ContractRelatie.objects.filter(organization=template, actief_contract=True):
            _, created = ContractRelatie.objects.update_or_create(
                zorgaanbieder=src.zorgaanbieder,
                organization=target,
                contract_type=src.contract_type or "DEMO",
                defaults={
                    "status": src.status,
                    "start_date": src.start_date,
                    "end_date": src.end_date,
                    "gemeente": src.gemeente,
                    "regio": src.regio,
                    "zorgvormen_contract": src.zorgvormen_contract,
                    "actief_contract": True,
                    "voorkeursaanbieder": src.voorkeursaanbieder,
                    "opmerkingen_contract": (
                        f"Gekopieerd van {template.slug} voor lokale matching."
                    ),
                },
            )
            if created:
                count += 1
        return count

    def _copy_provider_clients(self, *, template: Organization, target: Organization) -> int:
        """SPA matching map joins API candidate names to /care/api/providers/ Client rows."""
        count = 0
        for name in PILOT_PROVIDER_CLIENT_NAMES:
            src = Client.objects.filter(
                organization=template,
                name=name,
                client_type=Client.ClientType.CORPORATION,
            ).select_related("provider_profile").first()
            if src is None:
                continue
            client, created = Client.objects.update_or_create(
                organization=target,
                name=name,
                defaults={
                    "client_type": Client.ClientType.CORPORATION,
                    "status": src.status,
                    "created_by": src.created_by,
                    "email": src.email,
                    "city": src.city,
                    "industry": src.industry,
                    "notes": f"Demo aanbieder (gekopieerd van {template.slug}).",
                },
            )
            if created:
                count += 1
            src_pp = getattr(src, "provider_profile", None)
            if src_pp is None:
                continue
            pp, _ = ProviderProfile.objects.update_or_create(
                client=client,
                defaults={
                    "offers_outpatient": src_pp.offers_outpatient,
                    "offers_day_treatment": src_pp.offers_day_treatment,
                    "offers_residential": src_pp.offers_residential,
                    "offers_crisis": src_pp.offers_crisis,
                    "handles_simple": src_pp.handles_simple,
                    "handles_multiple": src_pp.handles_multiple,
                    "handles_high_complex": src_pp.handles_high_complex,
                    "handles_low_urgency": src_pp.handles_low_urgency,
                    "handles_medium_urgency": src_pp.handles_medium_urgency,
                    "handles_high_urgency": src_pp.handles_high_urgency,
                    "handles_crisis_urgency": src_pp.handles_crisis_urgency,
                    "current_capacity": src_pp.current_capacity,
                    "max_capacity": src_pp.max_capacity,
                    "waiting_list_length": src_pp.waiting_list_length,
                    "average_wait_days": src_pp.average_wait_days,
                    "special_facilities": src_pp.special_facilities,
                    "service_area": src_pp.service_area,
                },
            )
            pp.served_regions.set(src_pp.served_regions.all())
            pp.secondary_served_regions.set(src_pp.secondary_served_regions.all())
            pp.target_care_categories.set(src_pp.target_care_categories.all())
        return count

    def _ensure_case_region_coverage(self, *, target: Organization) -> int:
        """Ensure ProviderRegioDekking exists for regions used by this org's intakes."""
        count = 0
        region_ids = (
            CaseIntakeProcess.objects.filter(organization=target)
            .exclude(regio_id__isnull=True)
            .values_list("regio_id", flat=True)
            .distinct()
        )
        regions = RegionalConfiguration.objects.filter(pk__in=region_ids)
        provider_names = list(PILOT_PROVIDER_CLIENT_NAMES)
        for reg in regions:
            for za in Zorgaanbieder.objects.filter(name__in=provider_names, is_active=True):
                vest = za.vestigingen.filter(is_active=True).first()
                _, created = ProviderRegioDekking.objects.update_or_create(
                    zorgaanbieder=za,
                    aanbieder_vestiging=vest,
                    regio=reg,
                    defaults={
                        "is_primair_dekkingsgebied": True,
                        "contract_actief": True,
                        "dekking_status": ProviderRegioDekking.DekkingStatus.ACTIVE,
                        "bron_type": ProviderRegioDekking.BronType.SEEDED,
                        "zorgvormen": ["outpatient"],
                        "doelgroepen": ["jeugd"],
                        "toelichting": f"Regiodekking voor {target.slug} casussen.",
                    },
                )
                if created:
                    count += 1
        return count

    def _re_persist_matching(self, *, case_id: int, organization: Organization) -> None:
        from contracts.api.views import _persist_advisory_matching_results

        case = CareCase.objects.filter(pk=case_id, organization=organization).first()
        if case is None:
            raise CommandError(f"Case {case_id} not found for org {organization.slug}")
        intake = CaseIntakeProcess.objects.filter(contract=case).first()
        if intake is None:
            raise CommandError(f"No intake for case {case_id}")
        _persist_advisory_matching_results(
            case_record=case,
            intake=intake,
            organization=organization,
        )
        self.stdout.write(f"Re-persisted matching results for case {case_id}.")
