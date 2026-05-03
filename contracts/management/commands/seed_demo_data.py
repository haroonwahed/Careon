from __future__ import annotations

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from contracts.models import (
    AanbiederVestiging,
    CareCategoryMain,
    CareCase,
    CareSignal,
    CaseAssessment,
    CaseIntakeProcess,
    Client,
    ContractRelatie,
    Deadline,
    MatchResultaat,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    PrestatieProfiel,
    ProviderProfile,
    ProviderRegioDekking,
    RegionalConfiguration,
    RegionType,
    TrustAccount,
    UserProfile,
    Zorgaanbieder,
    Zorgprofiel,
    CapaciteitRecord,
    OutcomeReasonCode,
)


User = get_user_model()

DEMO_ORG_NAME = 'Gemeente Demo'
DEMO_ORG_SLUG = 'gemeente-demo'
DEMO_EMAIL = 'test@gemeente-demo.nl'
DEMO_PASSWORD = 'DemoTest123!'

CASE_TITLES = [
    'Demo Casus A',
    'Demo Casus B',
    'Demo Casus C',
    'Demo Casus D',
    'Demo Casus E',
]


class Command(BaseCommand):
    help = 'Seed Zorg OS demo data for the gemeente demo account and matching flow.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Remove existing demo records for the demo organization before seeding.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        organization = self._ensure_organization()
        demo_user = self._ensure_demo_user(organization)

        if options['reset']:
            self._clear_existing_demo_data(organization=organization)

        categories = self._ensure_categories()
        municipality_map, region_map = self._ensure_network(organization=organization, demo_user=demo_user, categories=categories)
        provider_specs = self._provider_specs(categories=categories, region_map=region_map)
        providers = self._ensure_providers(
            organization=organization,
            demo_user=demo_user,
            provider_specs=provider_specs,
            municipality_map=municipality_map,
            region_map=region_map,
        )

        case_specs = self._case_specs(categories=categories, municipality_map=municipality_map, region_map=region_map)
        cases = [self._ensure_case(organization=organization, demo_user=demo_user, spec=spec, providers=providers) for spec in case_specs]

        self.stdout.write(self.style.SUCCESS('Demo data successfully seeded.'))
        self.stdout.write(f'- Organisatie: {organization.slug}')
        self.stdout.write(f'- Demo account: {DEMO_EMAIL}')
        self.stdout.write(f'- Casussen: {len(cases)}')
        self.stdout.write(f'- Aanbieders: {len(providers)}')

    def _ensure_organization(self):
        organization, _ = Organization.objects.update_or_create(
            slug=DEMO_ORG_SLUG,
            defaults={
                'name': DEMO_ORG_NAME,
                'is_active': True,
            },
        )
        return organization

    def _ensure_demo_user(self, organization):
        user, _ = User.objects.update_or_create(
            username=DEMO_EMAIL,
            defaults={
                'email': DEMO_EMAIL,
                'first_name': 'Demo',
                'last_name': 'Gemeente',
            },
        )
        user.set_password(DEMO_PASSWORD)
        user.save(update_fields=['password', 'email', 'first_name', 'last_name'])

        OrganizationMembership.objects.update_or_create(
            organization=organization,
            user=user,
            defaults={
                'role': OrganizationMembership.Role.MEMBER,
                'is_active': True,
            },
        )
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                'role': UserProfile.Role.ASSOCIATE,
                'department': 'Gemeente Demo',
                'is_active': True,
            },
        )
        return user

    def _clear_existing_demo_data(self, *, organization):
        case_titles = list(CASE_TITLES)
        provider_names = [
            'Horizon Jeugdzorg',
            'NovaCare Jeugd',
            'ThuisKompas Zorg',
            'Veerkracht Centrum',
        ]
        zorgaanbieder_names = list(provider_names)

        MatchResultaat.objects.filter(casus__organization=organization).delete()
        PlacementRequest.objects.filter(due_diligence_process__organization=organization).delete()
        CaseAssessment.objects.filter(due_diligence_process__organization=organization).delete()
        CareSignal.objects.filter(due_diligence_process__organization=organization).delete()
        Deadline.objects.for_organization(organization).delete()
        CaseIntakeProcess.objects.filter(organization=organization, title__in=case_titles).delete()
        CareCase.objects.filter(organization=organization, title__in=case_titles).delete()
        ProviderRegioDekking.objects.filter(zorgaanbieder__name__in=zorgaanbieder_names).delete()
        ContractRelatie.objects.filter(zorgaanbieder__name__in=zorgaanbieder_names, organization=organization).delete()
        PrestatieProfiel.objects.filter(zorgprofiel__zorgaanbieder__name__in=zorgaanbieder_names).delete()
        CapaciteitRecord.objects.filter(vestiging__zorgaanbieder__name__in=zorgaanbieder_names).delete()
        Zorgprofiel.objects.filter(zorgaanbieder__name__in=zorgaanbieder_names).delete()
        AanbiederVestiging.objects.filter(zorgaanbieder__name__in=zorgaanbieder_names).delete()
        Zorgaanbieder.objects.filter(name__in=zorgaanbieder_names).delete()
        TrustAccount.objects.filter(provider__name__in=provider_names).delete()
        Client.objects.filter(organization=organization, name__in=provider_names).delete()

    def _ensure_categories(self):
        names = [
            'Angst en spanning',
            'Gedrag en gezin',
            'Autisme en structuur',
            'Trauma en veiligheid',
            'Schoolverzuim',
            'Gezinsbegeleiding',
        ]
        categories = {}
        for order, name in enumerate(names, start=1):
            category, _ = CareCategoryMain.objects.update_or_create(
                name=name,
                defaults={
                    'order': order,
                    'is_active': True,
                },
            )
            categories[name] = category
        return categories

    def _ensure_network(self, *, organization, demo_user, categories):
        municipalities = [
            {'name': 'Utrecht', 'code': 'DEMO-UTR', 'province': 'Utrecht', 'region_code': 'DEMO-UTR-REG', 'region_name': 'Utrecht Regio'},
            {'name': 'Rotterdam', 'code': 'DEMO-RTM', 'province': 'Zuid-Holland', 'region_code': 'DEMO-RTM-REG', 'region_name': 'Rotterdam Regio'},
            {'name': 'Den Haag', 'code': 'DEMO-DHG', 'province': 'Zuid-Holland', 'region_code': 'DEMO-DHG-REG', 'region_name': 'Den Haag Regio'},
            {'name': 'Amsterdam', 'code': 'DEMO-AMS', 'province': 'Noord-Holland', 'region_code': 'DEMO-AMS-REG', 'region_name': 'Amsterdam Regio'},
        ]

        municipality_map = {}
        region_map = {}
        for entry in municipalities:
            municipality, _ = MunicipalityConfiguration.objects.update_or_create(
                organization=organization,
                municipality_code=entry['code'],
                defaults={
                    'municipality_name': entry['name'],
                    'province': entry['province'],
                    'status': MunicipalityConfiguration.Status.ACTIVE,
                    'responsible_coordinator': demo_user,
                    'created_by': demo_user,
                    'max_wait_days': 21,
                    'priority_rules': 'Demo prioritering volgens canonical flow.',
                    'notes': 'Demo gemeenteconfiguratie.',
                },
            )
            municipality.care_domains.set(categories.values())
            municipality_map[entry['name']] = municipality

            region, _ = RegionalConfiguration.objects.update_or_create(
                organization=organization,
                region_code=entry['region_code'],
                defaults={
                    'region_type': RegionType.GEMEENTELIJK,
                    'region_name': entry['region_name'],
                    'province': entry['province'],
                    'status': RegionalConfiguration.Status.ACTIVE,
                    'responsible_coordinator': demo_user,
                    'created_by': demo_user,
                    'max_wait_days': 21,
                    'priority_rules': 'Demo regioregels.',
                },
            )
            region.care_domains.set(categories.values())
            region.served_municipalities.set([municipality])
            region_map[entry['name']] = region

        return municipality_map, region_map

    def _provider_specs(self, *, categories, region_map):
        return [
            {
                'name': 'Horizon Jeugdzorg',
                'city': 'Utrecht',
                'category': categories['Angst en spanning'],
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'zorgvorm_code': 'outpatient',
                'provider_type': Zorgaanbieder.ProviderType.AMBULANT,
                'target_age_12_18': True,
                'target_age_4_12': False,
                'current_capacity': 2,
                'max_capacity': 6,
                'waiting_list_length': 3,
                'average_wait_days': 11,
                'specialisations': 'angst, schoolverzuim, gezinsbegeleiding',
                'problematiek_types': ['angstklachten', 'schoolverzuim', 'ouderlijke zorgen'],
                'intensiteit': 'middel',
                'setting_type': 'open',
                'complexiteit_enkelvoudig': False,
                'complexiteit_meervoudig': True,
                'complexiteit_zwaar': False,
                'urgentie_middel': True,
                'urgentie_hoog': True,
                'urgentie_crisis': False,
                'capacity_snapshot': {'open_slots': 4, 'waiting_list': 3, 'avg_wait_days': 11, 'reliability': 0.9},
                'performance': {'matches': 18, 'placements': 16, 'rejections': 2, 'success': 0.86, 'reactie': 14.0, 'dropout': 0.06},
                'contract_label': 'Utrecht',
                'score': 86,
                'summary': 'Sterke match op angst, schoolverzuim en ouderbetrokkenheid.',
                'trade_offs': ['Capaciteit is beperkt maar nog beschikbaar.', 'Inhoudelijke fit is sterk.'],
                'verification': 'Controleer beschikbaarheid en plan vervolgstap naar samenvatting.',
            },
            {
                'name': 'NovaCare Jeugd',
                'city': 'Rotterdam',
                'category': categories['Gedrag en gezin'],
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'zorgvorm_code': 'outpatient',
                'provider_type': Zorgaanbieder.ProviderType.AMBULANT,
                'target_age_12_18': True,
                'target_age_4_12': False,
                'current_capacity': 4,
                'max_capacity': 7,
                'waiting_list_length': 1,
                'average_wait_days': 8,
                'specialisations': 'gedrag, crisis, systeemtherapie, gezinsconflict',
                'problematiek_types': ['gedragsproblemen', 'gezinsconflict', 'eerdere hulp mislukt'],
                'intensiteit': 'intensief',
                'setting_type': 'open',
                'complexiteit_enkelvoudig': False,
                'complexiteit_meervoudig': True,
                'complexiteit_zwaar': False,
                'urgentie_middel': True,
                'urgentie_hoog': True,
                'urgentie_crisis': False,
                'capacity_snapshot': {'open_slots': 4, 'waiting_list': 1, 'avg_wait_days': 8, 'reliability': 0.94},
                'performance': {'matches': 24, 'placements': 22, 'rejections': 2, 'success': 0.91, 'reactie': 10.0, 'dropout': 0.04},
                'contract_label': 'Rotterdam',
                'score': 91,
                'summary': 'Beste inhoudelijke fit voor gedragsproblemen en gezinsconflict.',
                'trade_offs': ['Hoge matchscore met beperkte trade-offs.', 'Capaciteit is direct beschikbaar.'],
                'verification': 'Leg de match voor aan de gemeente en stuur vervolgens door.',
            },
            {
                'name': 'ThuisKompas Zorg',
                'city': 'Den Haag',
                'category': categories['Autisme en structuur'],
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'zorgvorm_code': 'outpatient',
                'provider_type': Zorgaanbieder.ProviderType.AMBULANT,
                'target_age_4_12': True,
                'target_age_12_18': True,
                'current_capacity': 3,
                'max_capacity': 6,
                'waiting_list_length': 2,
                'average_wait_days': 9,
                'specialisations': 'autisme, ambulante begeleiding, oudercoaching, structuur',
                'problematiek_types': ['autisme', 'begeleiding thuis', 'structuurproblemen'],
                'intensiteit': 'middel',
                'setting_type': 'open',
                'complexiteit_enkelvoudig': False,
                'complexiteit_meervoudig': True,
                'complexiteit_zwaar': False,
                'urgentie_middel': True,
                'urgentie_hoog': True,
                'urgentie_crisis': False,
                'capacity_snapshot': {'open_slots': 3, 'waiting_list': 2, 'avg_wait_days': 9, 'reliability': 0.89},
                'performance': {'matches': 20, 'placements': 18, 'rejections': 2, 'success': 0.88, 'reactie': 12.0, 'dropout': 0.05},
                'contract_label': 'Den Haag',
                'score': 88,
                'summary': 'Passende ondersteuning voor autisme, structuur en thuisbegeleiding.',
                'trade_offs': ['Regio is passend en capaciteit is beschikbaar.', 'Inhoudelijke fit is sterk.'],
                'verification': 'Bevestig de gemeentevalidatie en vraag de aanbiederbeoordeling op.',
            },
            {
                'name': 'Veerkracht Centrum',
                'city': 'Amsterdam',
                'category': categories['Trauma en veiligheid'],
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'zorgvorm_code': 'outpatient',
                'provider_type': Zorgaanbieder.ProviderType.AMBULANT,
                'target_age_12_18': True,
                'target_age_4_12': False,
                'current_capacity': 0,
                'max_capacity': 4,
                'waiting_list_length': 8,
                'average_wait_days': 35,
                'specialisations': 'trauma, spoed, complexe casuïstiek',
                'problematiek_types': ['trauma', 'spoedplaatsing', 'complexe thuissituatie'],
                'intensiteit': 'hoog_intensief',
                'setting_type': 'open',
                'complexiteit_enkelvoudig': False,
                'complexiteit_meervoudig': True,
                'complexiteit_zwaar': True,
                'urgentie_middel': False,
                'urgentie_hoog': True,
                'urgentie_crisis': False,
                'capacity_snapshot': {'open_slots': 0, 'waiting_list': 8, 'avg_wait_days': 35, 'reliability': 0.82},
                'performance': {'matches': 11, 'placements': 8, 'rejections': 3, 'success': 0.79, 'reactie': 18.0, 'dropout': 0.08},
                'contract_label': 'Amsterdam',
                'score': 79,
                'summary': 'Trauma- en spoedexpertise, maar zonder directe ruimte.',
                'trade_offs': ['Geen directe capaciteit beschikbaar.', 'De inhoudelijke fit is toch bruikbaar voor retry.'],
                'verification': 'Gebruik deze aanbieder als onderbouwing voor her-matching.',
            },
        ]

    def _ensure_providers(self, *, organization, demo_user, provider_specs, municipality_map, region_map):
        providers = []
        for spec in provider_specs:
            client, _ = Client.objects.update_or_create(
                organization=organization,
                name=spec['name'],
                defaults={
                    'client_type': Client.ClientType.CORPORATION,
                    'status': Client.Status.ACTIVE,
                    'created_by': demo_user,
                    'email': f"info@{spec['name'].lower().replace(' ', '')}.nl",
                    'city': spec['city'],
                    'industry': 'Jeugdzorg',
                    'notes': 'Demo aanbieder voor Zorg OS.',
                },
            )

            provider_profile, _ = ProviderProfile.objects.update_or_create(
                client=client,
                defaults={
                    'offers_outpatient': True,
                    'offers_day_treatment': False,
                    'offers_residential': False,
                    'offers_crisis': False,
                    'handles_simple': False,
                    'handles_multiple': True,
                    'handles_severe': spec['name'] == 'Veerkracht Centrum',
                    'handles_low_urgency': True,
                    'handles_medium_urgency': True,
                    'handles_high_urgency': True,
                    'handles_crisis_urgency': False,
                    'current_capacity': spec['current_capacity'],
                    'max_capacity': spec['max_capacity'],
                    'waiting_list_length': spec['waiting_list_length'],
                    'average_wait_days': spec['average_wait_days'],
                    'special_facilities': spec['specialisations'],
                    'service_area': f"{spec['city']} en omgeving",
                },
            )
            provider_profile.target_care_categories.set([spec['category']])
            provider_profile.served_regions.set([region_map[spec['city']]])
            provider_profile.secondary_served_regions.clear()

            zorgaanbieder, _ = Zorgaanbieder.objects.update_or_create(
                name=spec['name'],
                defaults={
                    'short_name': spec['name'].split()[0],
                    'handelsnaam': spec['name'],
                    'omschrijving_kort': spec['summary'],
                    'provider_type': spec['provider_type'],
                    'trust_level': Zorgaanbieder.TrustLevel.VERIFIED,
                    'is_active': True,
                    'landelijk_dekkend': False,
                    'website': f"https://{spec['name'].lower().replace(' ', '')}.example",
                    'email': f"zorg@{spec['name'].lower().replace(' ', '')}.nl",
                    'bron_type': Zorgaanbieder.BronType.SEEDED,
                    'bron_id': f"demo-{spec['name'].lower().replace(' ', '-')}",
                    'normalisatie_status': Zorgaanbieder.NormalisatieStatus.NORMALIZED,
                    'review_status': Zorgaanbieder.ReviewStatus.APPROVED,
                    'last_source_system': 'seed_demo_data',
                    'bron_laatst_gesynchroniseerd_op': timezone.now(),
                },
            )

            vestiging, _ = AanbiederVestiging.objects.update_or_create(
                zorgaanbieder=zorgaanbieder,
                vestiging_code=f"DEMO-{spec['city'].upper().replace(' ', '-')}",
                defaults={
                    'name': spec['name'],
                    'city': spec['city'],
                    'gemeente': spec['city'],
                    'provincie': municipality_map[spec['city']].province,
                    'region': region_map[spec['city']].region_code,
                    'regio_jeugd': region_map[spec['city']].region_name,
                    'is_primary': True,
                    'is_active': True,
                    'bron_type': 'seeded',
                    'bron_id': f"demo-vestiging-{spec['name'].lower().replace(' ', '-')}",
                    'bron_laatst_gesynchroniseerd_op': timezone.now(),
                },
            )

            zorgprofiel, _ = Zorgprofiel.objects.update_or_create(
                zorgaanbieder=zorgaanbieder,
                aanbieder_vestiging=vestiging,
                zorgvorm=spec['zorgvorm_code'],
                zorgdomein='jeugd',
                defaults={
                    'doelgroep_leeftijd_van': 4 if spec['name'] == 'ThuisKompas Zorg' else 12,
                    'doelgroep_leeftijd_tot': 18,
                    'problematiek_types': spec['problematiek_types'],
                    'intensiteit': spec['capacity_snapshot']['avg_wait_days'] >= 30 and 'hoog_intensief' or spec['zorgvorm_code'] == 'outpatient' and 'middel' or 'intensief',
                    'setting_type': spec['setting_type'],
                    'crisis_opvang_mogelijk': False,
                    'lvb_geschikt': True,
                    'autisme_geschikt': 'autisme' in ' '.join(spec['problematiek_types']).lower(),
                    'trauma_geschikt': 'trauma' in ' '.join(spec['problematiek_types']).lower(),
                    'ggz_comorbiditeit_mogelijk': True,
                    'verslavingsproblematiek_mogelijk': False,
                    'veiligheidsrisico_hanteerbaar': True,
                    'omschrijving_match_context': spec['summary'],
                    'biedt_ambulant': True,
                    'biedt_dagbehandeling': False,
                    'biedt_residentieel': False,
                    'biedt_crisis': False,
                    'biedt_thuisbegeleiding': spec['name'] == 'ThuisKompas Zorg',
                    'leeftijd_0_4': False,
                    'leeftijd_4_12': spec['name'] == 'ThuisKompas Zorg',
                    'leeftijd_12_18': True,
                    'leeftijd_18_plus': False,
                    'complexiteit_enkelvoudig': spec['name'] == 'Horizon Jeugdzorg',
                    'complexiteit_meervoudig': True,
                    'complexiteit_zwaar': spec['name'] == 'Veerkracht Centrum',
                    'urgentie_laag': True,
                    'urgentie_middel': spec['name'] != 'Veerkracht Centrum',
                    'urgentie_hoog': True,
                    'urgentie_crisis': False,
                    'regio_codes': region_map[spec['city']].region_code,
                    'specialisaties': spec['specialisations'],
                    'actief': True,
                },
            )

            PrestatieProfiel.objects.update_or_create(
                zorgprofiel=zorgprofiel,
                defaults={
                    'aantal_matches': spec['performance']['matches'],
                    'aantal_plaatsingen': spec['performance']['placements'],
                    'aantal_afwijzingen': spec['performance']['rejections'],
                    'succesratio_match_naar_plaatsing': spec['performance']['success'],
                    'gemiddelde_reactietijd_uren': spec['performance']['reactie'],
                    'gemiddelde_doorlooptijd_dagen': 10,
                    'intake_no_show_ratio': 0.03,
                    'plaatsing_voortijdig_beeindigd_ratio': spec['performance']['dropout'],
                    'kwalitatieve_opmerking': spec['summary'],
                    'laatst_berekend_op': timezone.now(),
                },
            )

            CapaciteitRecord.objects.create(
                vestiging=vestiging,
                zorgprofiel=zorgprofiel,
                import_batch=self._capacity_import_batch(),
                open_slots=spec['capacity_snapshot']['open_slots'],
                waiting_list_size=spec['capacity_snapshot']['waiting_list'],
                avg_wait_days=spec['capacity_snapshot']['avg_wait_days'],
                max_capacity=spec['max_capacity'],
                totale_capaciteit=spec['max_capacity'],
                beschikbare_capaciteit=spec['current_capacity'],
                wachtlijst_aantal=spec['waiting_list_length'],
                gemiddelde_wachttijd_dagen=spec['average_wait_days'],
                direct_pleegbaar=spec['current_capacity'] > 0,
                toelichting_capaciteit='Demo capaciteitssnapshot voor matching.',
                betrouwbaarheid_score=spec['capacity_snapshot']['reliability'],
                laatst_bijgewerkt_op=timezone.now(),
                laatst_bijgewerkt_door='seed_demo_data',
            )

            ContractRelatie.objects.update_or_create(
                zorgaanbieder=zorgaanbieder,
                organization=organization,
                contract_type='DEMO',
                defaults={
                    'status': ContractRelatie.ContractStatus.ACTIEF,
                    'start_date': date.today() - timedelta(days=30),
                    'end_date': date.today() + timedelta(days=365),
                    'gemeente': spec['city'],
                    'regio': region_map[spec['city']].region_code,
                    'zorgvormen_contract': [spec['care_form']],
                    'actief_contract': True,
                    'voorkeursaanbieder': spec['name'] != 'Veerkracht Centrum',
                    'opmerkingen_contract': 'Demo contractrelatie voor Zorg OS.',
                },
            )

            ProviderRegioDekking.objects.update_or_create(
                zorgaanbieder=zorgaanbieder,
                aanbieder_vestiging=vestiging,
                regio=region_map[spec['city']],
                defaults={
                    'is_primair_dekkingsgebied': True,
                    'zorgvormen': [spec['zorgvorm_code']],
                    'doelgroepen': ['jeugd'],
                    'contract_actief': True,
                    'capaciteit_meerekenen': True,
                    'reisafstand_score': 0.95,
                    'service_radius_km': 35.0,
                    'dekking_status': ProviderRegioDekking.DekkingStatus.ACTIVE,
                    'toelichting': 'Demo regiodekking voor matching.',
                    'bron_type': ProviderRegioDekking.BronType.SEEDED,
                },
            )

            TrustAccount.objects.update_or_create(
                provider=client,
                region=spec['city'],
                care_type=TrustAccount.CareType.JEUGDHULP,
                defaults={
                    'wait_days': spec['average_wait_days'],
                    'open_slots': spec['current_capacity'],
                    'waiting_list_size': spec['waiting_list_length'],
                    'notes': 'Demo wachttijdregistratie.',
                    'created_by': demo_user,
                },
            )

            providers.append(
                {
                    'client': client,
                    'zorgaanbieder': zorgaanbieder,
                    'vestiging': vestiging,
                    'zorgprofiel': zorgprofiel,
                    'spec': spec,
                }
            )

        return providers

    def _capacity_import_batch(self):
        from contracts.models import ProviderImportBatch

        batch, _ = ProviderImportBatch.objects.get_or_create(
            source_system='seed_demo_data',
            source_version='v1',
            defaults={
                'triggered_by': 'manage.py seed_demo_data',
                'status': ProviderImportBatch.BatchStatus.COMPLETED,
                'total_records': 4,
                'processed_records': 4,
                'created_records': 4,
                'updated_records': 0,
                'skipped_records': 0,
                'conflicted_records': 0,
                'quarantined_records': 0,
                'completed_at': timezone.now(),
            },
        )
        return batch

    def _case_specs(self, *, categories, municipality_map, region_map):
        return [
            {
                'title': CASE_TITLES[0],
                'city': 'Utrecht',
                'category': categories['Angst en spanning'],
                'age': 14,
                'problematiek': ['angstklachten', 'schoolverzuim', 'ouderlijke zorgen'],
                'urgency': CaseIntakeProcess.Urgency.MEDIUM,
                'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'status': CaseIntakeProcess.ProcessStatus.INTAKE,
                'workflow_state': CaseIntakeProcess.WorkflowState.DRAFT_CASE,
                'summary': '',
                'description': 'Minimale intake. Vul de casus aan en breng hem richting samenvatting.',
                'assessment_status': None,
                'matching_ready': False,
                'case_phase': CareCase.CasePhase.INTAKE,
                'case_status': CareCase.Status.DRAFT,
                'signal_type': CareSignal.SignalType.INTAKE_INCOMPLETE,
                'deadline_type': Deadline.TaskType.ASSESSMENT_PERFORM,
                'deadline_title': 'Samenvatting voorbereiden',
                'signal_title': 'Casus aanvullen',
            },
            {
                'title': CASE_TITLES[1],
                'city': 'Rotterdam',
                'category': categories['Gedrag en gezin'],
                'age': 16,
                'problematiek': ['gedragsproblemen', 'gezinsconflict', 'eerdere hulp mislukt'],
                'urgency': CaseIntakeProcess.Urgency.HIGH,
                'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'status': CaseIntakeProcess.ProcessStatus.MATCHING,
                'workflow_state': CaseIntakeProcess.WorkflowState.MATCHING_READY,
                'summary': 'Klaar voor matching. Gemeente moet de beste aanbieder beoordelen.',
                'description': 'Sterke matchvraag met hoge urgentie en eerdere hulp die niet werkte.',
                'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
                'matching_ready': True,
                'case_phase': CareCase.CasePhase.MATCHING,
                'case_status': CareCase.Status.ACTIVE,
                'signal_type': CareSignal.SignalType.NO_MATCH,
                'deadline_type': Deadline.TaskType.SELECT_MATCH,
                'deadline_title': 'Match selecteren',
                'signal_title': 'Match klaar voor keuze',
                'match_provider_name': 'NovaCare Jeugd',
                'match_score': 91,
                'match_summary': 'Beste inhoudelijke fit voor gedragsproblemen en gezinsconflict.',
                'match_trade_offs': ['Capaciteit is beschikbaar.', 'Fit is inhoudelijk sterk.'],
                'verification': 'Vraag de gemeentevalidatie op voordat de casus wordt verzonden.',
            },
            {
                'title': CASE_TITLES[2],
                'city': 'Den Haag',
                'category': categories['Autisme en structuur'],
                'age': 11,
                'problematiek': ['autisme', 'begeleiding thuis', 'structuurproblemen'],
                'urgency': CaseIntakeProcess.Urgency.MEDIUM,
                'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'status': CaseIntakeProcess.ProcessStatus.DECISION,
                'workflow_state': CaseIntakeProcess.WorkflowState.PROVIDER_REVIEW_PENDING,
                'summary': 'Wacht op aanbiederbeoordeling; gemeente mag hier niet namens de aanbieder beslissen.',
                'description': 'De casus is doorgezet en wacht op inhoudelijke reactie van de aanbieder.',
                'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
                'matching_ready': True,
                'case_phase': CareCase.CasePhase.PROVIDER_BEOORDELING,
                'case_status': CareCase.Status.ACTIVE,
                'signal_type': CareSignal.SignalType.WAIT_EXCEEDED,
                'deadline_type': Deadline.TaskType.CONTACT_PROVIDER,
                'deadline_title': 'Aanbieder opvolgen',
                'signal_title': 'Aanbiederbeoordeling open',
                'placement_status': PlacementRequest.Status.IN_REVIEW,
                'provider_response_status': PlacementRequest.ProviderResponseStatus.PENDING,
                'provider_name': 'ThuisKompas Zorg',
                'match_provider_name': 'ThuisKompas Zorg',
                'match_score': 88,
                'match_summary': 'Sterke match voor autisme, thuisbegeleiding en structuur.',
                'match_trade_offs': ['Capaciteit is direct beschikbaar.', 'Regio sluit goed aan.'],
                'verification': 'Volg de aanbiederreactie op, maar beslis niet namens de aanbieder.',
            },
            {
                'title': CASE_TITLES[3],
                'city': 'Amsterdam',
                'category': categories['Trauma en veiligheid'],
                'age': 15,
                'problematiek': ['trauma', 'spoedplaatsing', 'complexe thuissituatie'],
                'urgency': CaseIntakeProcess.Urgency.HIGH,
                'complexity': CaseIntakeProcess.Complexity.SEVERE,
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'status': CaseIntakeProcess.ProcessStatus.MATCHING,
                'workflow_state': CaseIntakeProcess.WorkflowState.PROVIDER_REJECTED,
                'summary': 'Afgewezen door aanbieder wegens capaciteit; her-matching is nodig.',
                'description': 'De casus moet opnieuw richting een passende aanbieder worden gestuurd.',
                'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
                'matching_ready': True,
                'case_phase': CareCase.CasePhase.MATCHING,
                'case_status': CareCase.Status.ACTIVE,
                'signal_type': CareSignal.SignalType.CAPACITY_ISSUE,
                'deadline_type': Deadline.TaskType.SELECT_MATCH,
                'deadline_title': 'Nieuwe matchrichting bepalen',
                'signal_title': 'Capaciteitsprobleem',
                'placement_status': PlacementRequest.Status.REJECTED,
                'provider_response_status': PlacementRequest.ProviderResponseStatus.REJECTED,
                'provider_response_reason_code': OutcomeReasonCode.CAPACITY,
                'provider_name': 'Veerkracht Centrum',
                'match_provider_name': 'Veerkracht Centrum',
                'match_score': 79,
                'match_summary': 'Trauma- en spoedexpertise, maar zonder directe ruimte.',
                'match_trade_offs': ['Geen directe capaciteit beschikbaar.', 'Toch bruikbaar voor retry.'],
                'verification': 'Gebruik de afwijzing als aanleiding voor een nieuwe matchrichting.',
            },
            {
                'title': CASE_TITLES[4],
                'city': 'Utrecht',
                'category': categories['Schoolverzuim'],
                'age': 13,
                'problematiek': ['onvolledig dossier', 'schoolverzuim'],
                'urgency': CaseIntakeProcess.Urgency.LOW,
                'complexity': CaseIntakeProcess.Complexity.SIMPLE,
                'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
                'status': CaseIntakeProcess.ProcessStatus.ON_HOLD,
                'workflow_state': CaseIntakeProcess.WorkflowState.SUMMARY_READY,
                'summary': 'Geblokkeerd door ontbrekende documenten.',
                'description': 'Schoolrapportage en toestemming van ouder/voogd ontbreken nog.',
                'assessment_status': CaseAssessment.AssessmentStatus.NEEDS_INFO,
                'matching_ready': False,
                'case_phase': CareCase.CasePhase.INTAKE,
                'case_status': CareCase.Status.PENDING,
                'signal_type': CareSignal.SignalType.INTAKE_INCOMPLETE,
                'deadline_type': Deadline.TaskType.ASSESSMENT_PERFORM,
                'deadline_title': 'Ontbrekende informatie ophalen',
                'signal_title': 'Dossier incompleet',
                'missing_information': 'Schoolrapportage en toestemming ouder/voogd',
            },
        ]

    def _ensure_case(self, *, organization, demo_user, spec, providers):
        municipality = MunicipalityConfiguration.objects.get(
            organization=organization,
            municipality_name=spec['city'],
        )
        region = RegionalConfiguration.objects.get(
            organization=organization,
            region_name__startswith=spec['city'],
        )

        intake_defaults = {
            'organization': organization,
            'title': spec['title'],
            'status': spec['status'],
            'workflow_state': spec['workflow_state'],
            'case_coordinator': demo_user,
            'start_date': date.today() - timedelta(days=spec['age'] // 2 or 1),
            'target_completion_date': date.today() + timedelta(days=10),
            'care_category_main': spec['category'],
            'urgency': spec['urgency'],
            'complexity': spec['complexity'],
            'preferred_care_form': spec['care_form'],
            'zorgvorm_gewenst': spec['care_form'],
            'preferred_region_type': RegionType.GEMEENTELIJK,
            'preferred_region': region,
            'gemeente': municipality,
            'leeftijd': spec['age'],
            'client_age_category': CaseIntakeProcess.AgeCategory.ADOLESCENT if spec['age'] >= 12 else CaseIntakeProcess.AgeCategory.CHILDHOOD,
            'family_situation': CaseIntakeProcess.FamilySituation.HOME_DWELLING,
            'problematiek_types': spec['problematiek'],
            'assessment_summary': spec['summary'],
            'description': spec['description'],
            'has_other_support': spec['title'] != CASE_TITLES[4],
            'other_support_description': 'Wijkteam, school en ouders betrekken.' if spec['title'] != CASE_TITLES[4] else '',
            'school_work_status': 'Schoolverzuim' if 'schoolverzuim' in spec['problematiek'] else 'Onderwijs loopt',
            'setting_voorkeur': 'open',
            'max_toelaatbare_wachttijd_dagen': 42,
        }

        intake, _ = CaseIntakeProcess.objects.update_or_create(
            organization=organization,
            title=spec['title'],
            defaults=intake_defaults,
        )
        intake.save()

        case_record = intake.ensure_case_record(created_by=demo_user)
        case_record.status = spec['case_status']
        case_record.case_phase = spec['case_phase']
        case_record.content = spec['summary'] or spec['description']
        case_record.service_region = region.region_name
        case_record.risk_level = self._risk_for_urgency(spec['urgency'])
        case_record.start_date = intake.start_date
        case_record.end_date = date.today() + timedelta(days=90)
        case_record.created_by = demo_user
        case_record.save(update_fields=['status', 'case_phase', 'content', 'service_region', 'risk_level', 'start_date', 'end_date', 'created_by', 'updated_at'])

        if spec['assessment_status'] is not None:
            ws_context = (spec.get('summary') or spec.get('description') or 'Demo samenvatting voor pilot.').strip()
            if len(ws_context) < 24:
                ws_context = f'{ws_context} — aangevuld voor minimale samenvattingslengte.'
            assessment = CaseAssessment.objects.update_or_create(
                due_diligence_process=intake,
                defaults={
                    'assessment_status': spec['assessment_status'],
                    'matching_ready': spec['matching_ready'],
                    'reason_not_ready': '' if spec['matching_ready'] else 'Ontbrekende informatie.',
                    'notes': spec['summary'] or spec['description'],
                    'assessed_by': demo_user,
                    'workflow_summary': {
                        'context': ws_context,
                        'urgency': str(spec['urgency']),
                        'risks': [str(p) for p in spec.get('problematiek', [])],
                        'missing_information': str(spec.get('missing_information', '') or ''),
                        'risks_none_ack': len(spec.get('problematiek', [])) == 0,
                    },
                },
            )[0]
            assessment.save()

        Deadline.objects.update_or_create(
            due_diligence_process=intake,
            task_type=spec['deadline_type'],
            title=spec['deadline_title'],
            defaults={
                'priority': Deadline.Priority.URGENT if spec['urgency'] == CaseIntakeProcess.Urgency.HIGH else Deadline.Priority.HIGH,
                'due_date': date.today() + timedelta(days=2),
                'description': 'Demo opvolgtaak.',
                'assigned_to': demo_user,
                'created_by': demo_user,
                'case_record': case_record,
                'configuration': None,
            },
        )

        CareSignal.objects.update_or_create(
            due_diligence_process=intake,
            signal_type=spec['signal_type'],
            defaults={
                'title': spec['signal_title'],
                'description': spec['summary'] or spec['description'],
                'risk_level': self._signal_risk(spec['urgency']),
                'status': CareSignal.SignalStatus.OPEN,
                'assigned_to': demo_user,
                'follow_up': 'Demo opvolgactie vastgelegd.',
                'case_record': case_record,
                'created_by': demo_user,
            },
        )

        if spec.get('placement_status'):
            provider_bundle = next(item for item in providers if item['client'].name == spec['provider_name'])
            placement = PlacementRequest.objects.update_or_create(
                due_diligence_process=intake,
                defaults={
                    'proposed_provider': provider_bundle['client'],
                    'selected_provider': provider_bundle['client'],
                    'status': spec['placement_status'],
                    'provider_response_status': spec['provider_response_status'],
                    'provider_response_reason_code': spec.get('provider_response_reason_code', OutcomeReasonCode.NONE),
                    'care_form': spec['care_form'],
                    'decision_notes': spec['summary'],
                    'start_date': date.today() + timedelta(days=7),
                    'duration_weeks': 12,
                    'provider_response_recorded_at': timezone.now() - timedelta(hours=6),
                    'provider_response_recorded_by': demo_user,
                },
            )[0]
            placement.save()

        if spec.get('match_provider_name'):
            provider_bundle = next(item for item in providers if item['client'].name == spec['match_provider_name'])
            MatchResultaat.objects.update_or_create(
                casus=case_record,
                zorgaanbieder=provider_bundle['zorgaanbieder'],
                zorgprofiel=provider_bundle['zorgprofiel'],
                defaults={
                    'totaalscore': spec['match_score'],
                    'score_inhoudelijke_fit': 34.0,
                    'score_capaciteit': 18.0,
                    'score_contract_regio': 20.0,
                    'score_complexiteit': 9.0,
                    'score_performance': 5.0,
                    'score_regio_contract_fit': 20.0,
                    'score_capaciteit_wachttijd_fit': 18.0,
                    'score_complexiteit_veiligheid_fit': 9.0,
                    'score_performance_fit': 5.0,
                    'confidence_label': MatchResultaat.ConfidenceLabel.HOOG,
                    'fit_samenvatting': spec['match_summary'],
                    'trade_offs': spec['match_trade_offs'],
                    'verificatie_advies': spec['verification'],
                    'uitgesloten': False,
                    'uitsluitreden': '',
                    'ranking': 1,
                },
            )

        if spec['title'] == CASE_TITLES[4]:
            CareSignal.objects.filter(due_diligence_process=intake).update(
                follow_up='Schoolrapportage en toestemming ouder/voogd ontbreken nog.',
            )

        return intake

    def _risk_for_urgency(self, urgency):
        mapping = {
            CaseIntakeProcess.Urgency.LOW: CareCase.RiskLevel.LOW,
            CaseIntakeProcess.Urgency.MEDIUM: CareCase.RiskLevel.MEDIUM,
            CaseIntakeProcess.Urgency.HIGH: CareCase.RiskLevel.HIGH,
            CaseIntakeProcess.Urgency.CRISIS: CareCase.RiskLevel.CRITICAL,
        }
        return mapping.get(urgency, CareCase.RiskLevel.MEDIUM)

    def _signal_risk(self, urgency):
        mapping = {
            CaseIntakeProcess.Urgency.LOW: CareSignal.RiskLevel.LOW,
            CaseIntakeProcess.Urgency.MEDIUM: CareSignal.RiskLevel.MEDIUM,
            CaseIntakeProcess.Urgency.HIGH: CareSignal.RiskLevel.HIGH,
            CaseIntakeProcess.Urgency.CRISIS: CareSignal.RiskLevel.CRITICAL,
        }
        return mapping.get(urgency, CareSignal.RiskLevel.MEDIUM)
