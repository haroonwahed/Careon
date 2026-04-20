"""seed_demo_data – management command for Zorg OS demo/pilot dataset.

Creates a stable, realistic Dutch-style dataset covering all key workflow
scenarios so the full workflow can be demoed, tested, and reviewed without
hand-crafting records.

Usage::

    python manage.py seed_demo_data          # idempotent; skips if already present
    python manage.py seed_demo_data --reset  # wipe demo records first, then seed
    python manage.py seed_demo_data --list   # print scenario summary only

Scenario tags (visible in case titles / descriptions):
  [happy-path]          Straightforward accepted match → active placement
  [capacity-issue]      Rejected due to no capacity; re-matched to second provider
  [info-request]        Needs-more-info loop with operator resolution
  [weak-match]          Low-confidence match flagged for review
  [stalled-placement]   Placement approved but start date overdue
  [bounced-case]        Repeated rejections from multiple providers
  [crisis]              CRISIS urgency accepted quickly
  [closed]              Completed trajectory for historical reference
"""
from __future__ import annotations

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from contracts.models import (
    CareCase,
    CareCategoryMain,
    CareSignal,
    CaseAssessment,
    CaseInformationRequest,
    CaseIntakeProcess,
    Client,
    MunicipalityConfiguration,
    OperationalAlert,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderEvaluation,
    ProviderProfile,
    RegionalConfiguration,
    TrustAccount,
)

User = get_user_model()

# ---------------------------------------------------------------------------
# Constants – sentinel to distinguish demo records for clean resets.
# ---------------------------------------------------------------------------
DEMO_ORG_SLUG = 'demo-zorgos'
DEMO_TAG = '[demo]'


class Command(BaseCommand):
    help = (
        'Seed realistic demo/pilot data for Zorg OS covering all key workflow scenarios.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe all existing demo records before seeding.',
        )
        parser.add_argument(
            '--list',
            action='store_true',
            dest='list_only',
            help='Print scenario summary and exit without writing to the database.',
        )

    def handle(self, *args, **options):
        if options['list_only']:
            self._print_scenario_list()
            return

        with transaction.atomic():
            if options['reset']:
                self._reset_demo_data()

            org, users = self._ensure_org_and_users()
            categories = self._ensure_categories()
            providers = self._ensure_providers(org, users, categories)
            municipalities, regions = self._ensure_network(org, users, categories, providers)
            intakes = self._seed_all_scenarios(org, users, categories, providers, municipalities, regions)

        self.stdout.write(self.style.SUCCESS(
            f'\nDemo dataset gereed voor "{DEMO_ORG_SLUG}".'
        ))
        self.stdout.write(f'  Organisatie  : {org.name}')
        self.stdout.write(f'  Gebruikers   : {", ".join(u.username for u in users.values())}')
        self.stdout.write(f'  Aanbieders   : {len(providers)}')
        self.stdout.write(f'  Casussen     : {len(intakes)}')
        self.stdout.write('')
        self._print_scenario_list()

    # -----------------------------------------------------------------------
    # Reset
    # -----------------------------------------------------------------------

    def _reset_demo_data(self):
        org = Organization.objects.filter(slug=DEMO_ORG_SLUG).first()
        if org is None:
            return
        self.stdout.write(self.style.WARNING('Demo records worden verwijderd…'))
        # Delete in explicit dependency order to avoid FK cascade into legacy
        # tables whose names may differ between development and production DBs.
        from django.db import connection

        org_intakes = CaseIntakeProcess.objects.filter(organization=org)
        intake_ids = list(org_intakes.values_list('pk', flat=True))
        case_ids = list(org_intakes.values_list('contract_id', flat=True))

        if intake_ids:
            CaseInformationRequest.objects.filter(case_id__in=intake_ids).delete()
            OperationalAlert.objects.filter(case_id__in=intake_ids).delete()
            ProviderEvaluation.objects.filter(case_id__in=intake_ids).delete()
            PlacementRequest.objects.filter(due_diligence_process_id__in=intake_ids).delete()
            CaseAssessment.objects.filter(due_diligence_process_id__in=intake_ids).delete()
            CareSignal.objects.filter(due_diligence_process_id__in=intake_ids).delete()
            # Use raw SQL to skip Django's cascade collector which resolves all
            # related tables – some may use legacy names in dev DBs.
            with connection.cursor() as cursor:
                for pk in intake_ids:
                    cursor.execute(
                        'DELETE FROM contracts_caseintakeprocess WHERE id = %s',
                        [pk],
                    )

        case_ids_clean = [c for c in case_ids if c]
        if case_ids_clean:
            CareCase.objects.filter(pk__in=case_ids_clean).delete()

        MunicipalityConfiguration.objects.filter(organization=org).delete()
        RegionalConfiguration.objects.filter(organization=org).delete()
        TrustAccount.objects.filter(provider__organization=org).delete()
        Client.objects.filter(organization=org).delete()
        self.stdout.write(self.style.WARNING('Demo records verwijderd.'))

    # -----------------------------------------------------------------------
    # Organisation & users
    # -----------------------------------------------------------------------

    def _ensure_org_and_users(self):
        org, _ = Organization.objects.get_or_create(
            slug=DEMO_ORG_SLUG,
            defaults={'name': 'Gemeente Demo Zorg OS'},
        )

        user_specs = [
            ('demo.regie', 'demo.regie@zorgos.local', 'Regie', 'Coördinator',
             OrganizationMembership.Role.OWNER, True),
            ('demo.operator', 'demo.operator@zorgos.local', 'Operator', 'Gemeente',
             OrganizationMembership.Role.ADMIN, False),
            ('demo.viewer', 'demo.viewer@zorgos.local', 'Bekijk', 'Toegang',
             OrganizationMembership.Role.MEMBER, False),
        ]
        users = {}
        for username, email, first, last, role, is_staff in user_specs:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': first,
                    'last_name': last,
                    'is_staff': is_staff,
                },
            )
            if created:
                user.set_password('Demo2026!')
                user.save(update_fields=['password'])
            OrganizationMembership.objects.update_or_create(
                organization=org,
                user=user,
                defaults={'role': role, 'is_active': True},
            )
            users[username] = user

        regie = users['demo.regie']
        if not org.name:
            org.name = 'Gemeente Demo Zorg OS'
            org.save(update_fields=['name'])

        return org, users

    # -----------------------------------------------------------------------
    # Care categories
    # -----------------------------------------------------------------------

    def _ensure_categories(self):
        specs = [
            ('Jeugd GGZ', 1),
            ('Gezinsondersteuning', 2),
            ('Wmo Begeleiding', 3),
            ('Jeugd & Opvoed', 4),
        ]
        return {
            name: CareCategoryMain.objects.get_or_create(
                name=name, defaults={'order': order, 'is_active': True}
            )[0]
            for name, order in specs
        }

    # -----------------------------------------------------------------------
    # Providers (zorgaanbieders)
    # -----------------------------------------------------------------------

    def _ensure_providers(self, org, users, categories):
        regie = users['demo.regie']
        operator = users['demo.operator']

        specs = [
            # (name, capacity, wait_days, open_slots, crisis, outpatient, day, residential, industry)
            ('Aanbieder De Horizon BV',     8, 7,  4, False, True, True,  False, 'Jeugdzorg'),
            ('Aanbieder Kompas Jeugd NV',   6, 14, 2, False, True, False, False, 'Jeugdzorg'),
            ('Aanbieder Stap Verder',        4, 21, 1, False, True, True,  False, 'Gezinshulp'),
            ('Aanbieder CrisisZorg Noord',   3, 2,  2, True,  True, False, True,  'Crisisopvang'),
            ('Aanbieder Zilverlinde Groep',  10, 28, 0, False, True, True,  True, 'Wmo Zorg'),
            ('Aanbieder Bronzegel GGZ',      5, 35, 1, False, True, False, False, 'GGZ Jeugd'),
        ]

        providers = {}
        cats_list = list(categories.values())
        for name, max_cap, wait_days, open_slots, crisis, out, day, res, industry in specs:
            provider, _ = Client.objects.get_or_create(
                organization=org,
                name=name,
                defaults={
                    'status': Client.Status.ACTIVE,
                    'client_type': Client.ClientType.CORPORATION,
                    'created_by': regie,
                    'industry': industry,
                    'email': f'{name.lower().replace(" ", ".")[:20]}@demo.local',
                    'city': 'Utrecht',
                    'country': 'Nederland',
                },
            )
            profile, _ = ProviderProfile.objects.get_or_create(
                client=provider,
                defaults={
                    'offers_outpatient': out,
                    'offers_day_treatment': day,
                    'offers_residential': res,
                    'offers_crisis': crisis,
                    'handles_low_urgency': True,
                    'handles_medium_urgency': True,
                    'handles_high_urgency': True,
                    'handles_crisis_urgency': crisis,
                    'current_capacity': max(0, max_cap - open_slots),
                    'max_capacity': max_cap,
                    'average_wait_days': wait_days,
                },
            )
            profile.target_care_categories.set(cats_list)
            providers[name] = provider

        return providers

    # -----------------------------------------------------------------------
    # Network: gemeenten + regio's
    # -----------------------------------------------------------------------

    def _ensure_network(self, org, users, categories, providers):
        regie = users['demo.regie']
        cats = list(categories.values())
        provs = list(providers.values())

        mun_specs = [
            ('Utrecht',     'DEMO-MUN-01', 21),
            ('Amersfoort',  'DEMO-MUN-02', 28),
            ('Nieuwegein',  'DEMO-MUN-03', 14),
        ]
        municipalities = {}
        for name, code, max_wait in mun_specs:
            config, _ = MunicipalityConfiguration.objects.get_or_create(
                organization=org,
                municipality_code=code,
                defaults={
                    'municipality_name': name,
                    'status': MunicipalityConfiguration.Status.ACTIVE,
                    'responsible_coordinator': regie,
                    'created_by': regie,
                    'max_wait_days': max_wait,
                },
            )
            config.care_domains.set(cats)
            config.linked_providers.set(provs)
            municipalities[name] = config

        region_specs = [
            ('Regio Midden-Nederland',    'DEMO-REGIO-01'),
            ('Regio Utrecht-Stad',        'DEMO-REGIO-02'),
        ]
        regions = {}
        mun_list = list(municipalities.values())
        for name, code in region_specs:
            region, _ = RegionalConfiguration.objects.get_or_create(
                organization=org,
                region_code=code,
                defaults={
                    'region_name': name,
                    'status': RegionalConfiguration.Status.ACTIVE,
                    'responsible_coordinator': regie,
                    'created_by': regie,
                    'max_wait_days': 21,
                },
            )
            region.served_municipalities.set(mun_list)
            region.care_domains.set(cats)
            region.linked_providers.set(provs)
            regions[name] = region

        return municipalities, regions

    # -----------------------------------------------------------------------
    # All scenario seeds
    # -----------------------------------------------------------------------

    def _seed_all_scenarios(self, org, users, categories, providers, municipalities, regions):
        regie = users['demo.regie']
        operator = users['demo.operator']

        mun_utrecht = municipalities['Utrecht']
        mun_amersfoort = municipalities['Amersfoort']
        region_midden = regions['Regio Midden-Nederland']

        p_horizon = providers['Aanbieder De Horizon BV']
        p_kompas = providers['Aanbieder Kompas Jeugd NV']
        p_stap = providers['Aanbieder Stap Verder']
        p_crisis = providers['Aanbieder CrisisZorg Noord']
        p_zilver = providers['Aanbieder Zilverlinde Groep']
        p_bron = providers['Aanbieder Bronzegel GGZ']

        cat_jeugd_ggz = categories['Jeugd GGZ']
        cat_gezin = categories['Gezinsondersteuning']
        cat_wmo = categories['Wmo Begeleiding']
        cat_jeugd_opvoed = categories['Jeugd & Opvoed']

        today = date.today()
        intakes = []

        # ------------------------------------------------------------------
        # 1. [happy-path] – straightforward accepted match
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='T. van den Berg – Ambulante begeleiding [happy-path]',
            scenario_tag='happy-path',
            coordinator=regie,
            category=cat_jeugd_ggz,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            complexity=CaseIntakeProcess.Complexity.SIMPLE,
            care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=today - timedelta(days=30),
            target=today + timedelta(days=14),
            age=14,
            municipality=mun_utrecht,
            region=region_midden,
            assessment_summary=(
                'Jeugdige van 14 jaar met lichte angstklachten. Goed netwerk thuis. '
                'Ambulante begeleiding 1×/week voldoende. Laag risico.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.COMPLETED,
        )
        placement = self._make_placement(
            intake=intake,
            provider=p_horizon,
            status=PlacementRequest.Status.APPROVED,
            start_date=today - timedelta(days=14),
        )
        self._make_evaluation(
            intake=intake,
            provider=p_horizon,
            placement=placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by=operator,
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 2. [capacity-issue] – first provider rejects (no capacity), rematch
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='M. Bakker – Dagbehandeling, capaciteitsknelpunt [capacity-issue]',
            scenario_tag='capacity-issue',
            coordinator=regie,
            category=cat_gezin,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            complexity=CaseIntakeProcess.Complexity.MULTIPLE,
            care_form=CaseIntakeProcess.CareForm.DAY_TREATMENT,
            start_date=today - timedelta(days=20),
            target=today + timedelta(days=7),
            age=10,
            municipality=mun_amersfoort,
            region=region_midden,
            assessment_summary=(
                'Kind met sociaal-emotionele ontwikkelachterstand. Dagbehandeling geïndiceerd. '
                'Eerste aanbieder had geen vrije plek. Opnieuw gematcht.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.MATCHING,
        )
        placement_1 = self._make_placement(
            intake=intake,
            provider=p_kompas,
            status=PlacementRequest.Status.REJECTED,
        )
        self._make_evaluation(
            intake=intake,
            provider=p_kompas,
            placement=placement_1,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
            capacity_flag=True,
            decided_by=operator,
        )
        # Second placement (active, pending provider response)
        placement_2 = self._make_placement(
            intake=intake,
            provider=p_horizon,
            status=PlacementRequest.Status.IN_REVIEW,
        )
        self._make_alert(
            intake=intake,
            alert_type=OperationalAlert.AlertType.PROVIDER_CAPACITY_RISK,
            severity=OperationalAlert.Severity.HIGH,
            title='Capaciteitsknelpunt – Kompas Jeugd vol',
            description='Eerste aanbieder heeft geen vrije plek. Wacht op reactie tweede aanbieder.',
            action='Bevestig plaatsing zodra tweede aanbieder akkoord geeft.',
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 3. [info-request] – needs_more_info loop with resolved request
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='L. Janssen – GGZ traject, informatieverzoek [info-request]',
            scenario_tag='info-request',
            coordinator=operator,
            category=cat_jeugd_ggz,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            complexity=CaseIntakeProcess.Complexity.MULTIPLE,
            care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=today - timedelta(days=25),
            target=today + timedelta(days=10),
            age=16,
            municipality=mun_utrecht,
            region=region_midden,
            assessment_summary=(
                'Adolescent met depressieve klachten en schooluitval. GGZ-traject geïndiceerd. '
                'Aanbieder heeft aanvullende informatie gevraagd over medicatiegeschiedenis en school.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.MATCHING,
        )
        placement = self._make_placement(
            intake=intake,
            provider=p_bron,
            status=PlacementRequest.Status.NEEDS_INFO,
        )
        evaluation = self._make_evaluation(
            intake=intake,
            provider=p_bron,
            placement=placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info=(
                'Graag aanvullende informatie over medicatiegeschiedenis (laatste 12 maanden) '
                'en recent schoolrapport. Tevens contra-indicaties bij groepstherapie gewenst.'
            ),
            decided_by=operator,
        )
        # Open info request (not yet resolved – surfaces on Regiekamer)
        info_req = CaseInformationRequest.objects.update_or_create(
            case=intake,
            provider=p_bron,
            status__in=[
                CaseInformationRequest.Status.OPEN,
                CaseInformationRequest.Status.IN_PROGRESS,
            ],
            defaults={
                'provider': p_bron,
                'evaluation': evaluation,
                'requested_info_text': (
                    'Graag aanvullende informatie over medicatiegeschiedenis (laatste 12 maanden) '
                    'en recent schoolrapport. Tevens contra-indicaties bij groepstherapie gewenst.'
                ),
                'requested_fields': [
                    'medicatiegeschiedenis',
                    'schoolrapport',
                    'contra_indicaties_groepstherapie',
                ],
                'status': CaseInformationRequest.Status.IN_PROGRESS,
                'operator_response': (
                    'Medicatieoverzicht opgevraagd bij huisarts. Schoolrapport ontvangen en '
                    'bijgevoegd. Contra-indicaties genoteerd in dossier.'
                ),
            },
        )[0]
        self._make_alert(
            intake=intake,
            alert_type=OperationalAlert.AlertType.PROVIDER_INFO_REQUESTED,
            severity=OperationalAlert.Severity.MEDIUM,
            title='Informatieverzoek Bronzegel GGZ – in behandeling',
            description='Aanbieder wacht op medicatiegeschiedenis en schoolrapport.',
            action='Lever aanvullende stukken aan en dien opnieuw in voor aanbiederbeoordeling.',
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 4. [info-request resolved] – completed info loop, resubmitted
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='R. de Vries – Gezinsbegeleiding, herbeoordelingsaanvraag [info-request]',
            scenario_tag='info-request',
            coordinator=regie,
            category=cat_gezin,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            complexity=CaseIntakeProcess.Complexity.MULTIPLE,
            care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=today - timedelta(days=40),
            target=today + timedelta(days=5),
            age=8,
            municipality=mun_amersfoort,
            region=region_midden,
            assessment_summary=(
                'Gezin met meervoudige problematiek. Hulpvraag helder. Informatieverzoek '
                'afgerond en opnieuw ingediend voor aanbiederbeoordeling.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.MATCHING,
        )
        placement = self._make_placement(
            intake=intake,
            provider=p_stap,
            status=PlacementRequest.Status.IN_REVIEW,
        )
        eval_nmi = self._make_evaluation(
            intake=intake,
            provider=p_stap,
            placement=placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info=(
                'Aanvullende informatie gewenst over eerdere hulpverleningsgeschiedenis '
                'en beschikbaarheid ouders voor oudergesprekken.'
            ),
            decided_by=operator,
        )
        # Resolved info request
        resolved_req, _ = CaseInformationRequest.objects.update_or_create(
            case=intake,
            provider=p_stap,
            status=CaseInformationRequest.Status.RESUBMITTED,
            defaults={
                'evaluation': eval_nmi,
                'requested_info_text': (
                    'Aanvullende informatie gewenst over eerdere hulpverleningsgeschiedenis '
                    'en beschikbaarheid ouders voor oudergesprekken.'
                ),
                'requested_fields': ['hulpverleningsgeschiedenis', 'beschikbaarheid_ouders'],
                'operator_response': (
                    'Hulpverleningsoverzicht bijgevoegd. Ouders beschikbaar dinsdag/donderdag. '
                    'Casus opnieuw ingediend bij aanbieder.'
                ),
                'resolved_at': timezone.now() - timedelta(hours=4),
                'resolved_by': operator,
            },
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 5. [weak-match] – low confidence match, alert raised for review
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='F. Mulder – Residentieel, zwakke match [weak-match]',
            scenario_tag='weak-match',
            coordinator=regie,
            category=cat_wmo,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            complexity=CaseIntakeProcess.Complexity.SEVERE,
            care_form=CaseIntakeProcess.CareForm.RESIDENTIAL,
            start_date=today - timedelta(days=18),
            target=today + timedelta(days=3),
            age=17,
            municipality=mun_utrecht,
            region=region_midden,
            assessment_summary=(
                'Jongere met gedragsproblematiek en thuissituatie onveilig. Residentiële '
                'plaatsing nodig. Beschikbare aanbieder sluit niet volledig aan op zorgvraag. '
                'Match ter review: specialisatie gedeeltelijk passend.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.MATCHING,
        )
        placement = self._make_placement(
            intake=intake,
            provider=p_zilver,
            status=PlacementRequest.Status.IN_REVIEW,
        )
        self._make_alert(
            intake=intake,
            alert_type=OperationalAlert.AlertType.WEAK_MATCH_NEEDS_REVIEW,
            severity=OperationalAlert.Severity.HIGH,
            title='Zwakke match – Zilverlinde Groep: specialisatie gedeeltelijk passend',
            description=(
                'Matchingscore onvoldoende: aanbieder biedt residentieel aan maar '
                'ontbreekt specifieke gedragsspecialisatie die de casus vereist.'
            ),
            action='Beoordeel of de match acceptabel is of zoek alternatieve aanbieder.',
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 6. [stalled-placement] – approved but start date overdue
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='S. Visser – Dagbehandeling, stagneert [stalled-placement]',
            scenario_tag='stalled-placement',
            coordinator=operator,
            category=cat_jeugd_opvoed,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            complexity=CaseIntakeProcess.Complexity.MULTIPLE,
            care_form=CaseIntakeProcess.CareForm.DAY_TREATMENT,
            start_date=today - timedelta(days=50),
            target=today - timedelta(days=7),
            age=11,
            municipality=mun_utrecht,
            region=region_midden,
            assessment_summary=(
                'Dagbehandeling geïndiceerd en aanbieder akkoord, maar start is nu 10 dagen '
                'achterstallig door administratieve vertraging bij aanbieder. Escalateren.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.DECISION,
        )
        placement = self._make_placement(
            intake=intake,
            provider=p_horizon,
            status=PlacementRequest.Status.APPROVED,
            start_date=today - timedelta(days=10),
        )
        self._make_evaluation(
            intake=intake,
            provider=p_horizon,
            placement=placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by=operator,
        )
        self._make_alert(
            intake=intake,
            alert_type=OperationalAlert.AlertType.PLACEMENT_STALLED,
            severity=OperationalAlert.Severity.HIGH,
            title='Plaatsing stagneert – start 10 dagen achterstallig',
            description='Goedgekeurde plaatsing bij De Horizon BV is nog niet gestart.',
            action='Neem contact op met aanbieder en stel definitieve startdatum vast.',
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 7. [bounced-case] – repeated rejections from multiple providers
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='J. Smit – GGZ complex, meerdere afwijzingen [bounced-case]',
            scenario_tag='bounced-case',
            coordinator=regie,
            category=cat_jeugd_ggz,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            complexity=CaseIntakeProcess.Complexity.SEVERE,
            care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=today - timedelta(days=60),
            target=today - timedelta(days=14),
            age=15,
            municipality=mun_utrecht,
            region=region_midden,
            assessment_summary=(
                'Zwaar GGZ-traject. Drie aanbieders hebben afgewezen. Eerste wegens '
                'specialisatiemismatch, tweede geen capaciteit, derde risico te hoog. '
                'Casus staat open en vereist escalatie naar Regionaal Expertteam.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.MATCHING,
        )
        p1 = self._make_placement(intake=intake, provider=p_bron, status=PlacementRequest.Status.REJECTED)
        self._make_evaluation(
            intake=intake, provider=p_bron, placement=p1,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH,
            decided_by=operator,
        )
        p2 = self._make_placement(intake=intake, provider=p_kompas, status=PlacementRequest.Status.REJECTED)
        self._make_evaluation(
            intake=intake, provider=p_kompas, placement=p2,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
            capacity_flag=True,
            decided_by=operator,
        )
        p3 = self._make_placement(intake=intake, provider=p_zilver, status=PlacementRequest.Status.REJECTED)
        self._make_evaluation(
            intake=intake, provider=p_zilver, placement=p3,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.RISK_TOO_HIGH,
            risk_notes='Jeugdige heeft actieve suïcidale gedachten; aanbieder heeft geen 24/7 crisisprotocol.',
            decided_by=operator,
        )
        self._make_alert(
            intake=intake,
            alert_type=OperationalAlert.AlertType.URGENT_UNMATCHED_CASE,
            severity=OperationalAlert.Severity.HIGH,
            title='Urgente casus zonder match – 3 afwijzingen',
            description='Drie aanbieders hebben de casus afgewezen. Opschaling vereist.',
            action='Escaleer naar Regionaal Expertteam voor specialistische plaatsing.',
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 8. [crisis] – CRISIS urgency, quick accept
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='K. Pietersen – Crisisopvang, geaccepteerd [crisis]',
            scenario_tag='crisis',
            coordinator=regie,
            category=cat_jeugd_ggz,
            urgency=CaseIntakeProcess.Urgency.CRISIS,
            complexity=CaseIntakeProcess.Complexity.SEVERE,
            care_form=CaseIntakeProcess.CareForm.CRISIS,
            start_date=today - timedelta(days=3),
            target=today + timedelta(days=1),
            age=13,
            municipality=mun_utrecht,
            region=region_midden,
            assessment_summary=(
                'CRISIS intake. Jeugdige in acuut onveilige thuissituatie. '
                'Crisisaanbieder onmiddellijk benaderd en geaccepteerd. Start binnen 24 uur.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.DECISION,
        )
        placement = self._make_placement(
            intake=intake,
            provider=p_crisis,
            status=PlacementRequest.Status.APPROVED,
            start_date=today + timedelta(days=1),
        )
        self._make_evaluation(
            intake=intake,
            provider=p_crisis,
            placement=placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by=operator,
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # 9. [closed] – completed historical trajectory
        # ------------------------------------------------------------------
        intake = self._make_case(
            org=org,
            case_title='A. Wolters – Ambulant traject afgerond [closed]',
            scenario_tag='closed',
            coordinator=operator,
            category=cat_wmo,
            urgency=CaseIntakeProcess.Urgency.LOW,
            complexity=CaseIntakeProcess.Complexity.SIMPLE,
            care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=today - timedelta(days=180),
            target=today - timedelta(days=120),
            age=45,
            municipality=mun_utrecht,
            region=region_midden,
            assessment_summary=(
                'Wmo begeleiding succesvol afgerond. Cliënt zelfredzaam. Geen verdere ondersteuning nodig.'
            ),
            flow_status=CaseIntakeProcess.ProcessStatus.COMPLETED,
        )
        placement = self._make_placement(
            intake=intake,
            provider=p_stap,
            status=PlacementRequest.Status.APPROVED,
            start_date=today - timedelta(days=150),
        )
        self._make_evaluation(
            intake=intake,
            provider=p_stap,
            placement=placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by=operator,
        )
        intakes.append(intake)

        # ------------------------------------------------------------------
        # Wait times for observability pages
        # ------------------------------------------------------------------
        self._ensure_wait_times(providers)

        return intakes

    # -----------------------------------------------------------------------
    # Helpers – record creation
    # -----------------------------------------------------------------------

    def _make_case(
        self, *, org, case_title, scenario_tag, coordinator, category,
        urgency, complexity, care_form, start_date, target, age,
        municipality, region, assessment_summary, flow_status,
    ) -> CaseIntakeProcess:
        """Create or get a CaseIntakeProcess + associated CareCase + CaseAssessment."""
        case, _ = CareCase.objects.get_or_create(
            organization=org,
            title=case_title,
            defaults={
                'contract_type': CareCase.ContractType.NDA,
                'status': CareCase.Status.ACTIVE,
                'created_by': coordinator,
                'case_phase': CareCase.CasePhase.MATCHING,
                'content': (
                    f'Demo casus voor scenario: {scenario_tag}. '
                    f'Zorgcategorie: {category.name}. Leeftijd: {age} jaar.'
                ),
            },
        )

        intake, _ = CaseIntakeProcess.objects.get_or_create(
            organization=org,
            contract=case,
            defaults={
                'title': case_title,
                'status': flow_status,
                'case_coordinator': coordinator,
                'start_date': start_date,
                'target_completion_date': target,
                'urgency': urgency,
                'complexity': complexity,
                'preferred_care_form': care_form,
                'care_category_main': category,
                'assessment_summary': assessment_summary,
                'description': (
                    f'Demo scenario [{scenario_tag}] – gegenereerd door seed_demo_data commando. '
                    f'Leeftijd cliënt: {age} jaar. Gemeente: {municipality.municipality_name}.'
                ),
                'leeftijd': age,
                'gemeente': municipality,
                'regio': region,
                'preferred_region': region,
            },
        )

        matching_ready = flow_status in {
            CaseIntakeProcess.ProcessStatus.MATCHING,
            CaseIntakeProcess.ProcessStatus.DECISION,
            CaseIntakeProcess.ProcessStatus.COMPLETED,
        }
        CaseAssessment.objects.update_or_create(
            due_diligence_process=intake,
            defaults={
                'assessment_status': (
                    CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
                    if matching_ready
                    else CaseAssessment.AssessmentStatus.DRAFT
                ),
                'matching_ready': matching_ready,
                'assessed_by': coordinator,
                'notes': assessment_summary,
            },
        )

        return intake

    def _make_placement(
        self, *, intake, provider, status, start_date=None
    ) -> PlacementRequest:
        """Create a PlacementRequest for the given intake/provider."""
        placement, _ = PlacementRequest.objects.get_or_create(
            due_diligence_process=intake,
            proposed_provider=provider,
            defaults={
                'status': status,
                'selected_provider': provider if status == PlacementRequest.Status.APPROVED else None,
                'care_form': intake.preferred_care_form,
                'decision_notes': f'Demo plaatsingsbesluit [{status}].',
                'start_date': start_date,
                'duration_weeks': 12,
            },
        )
        return placement

    def _make_evaluation(
        self, *, intake, provider, placement, decision,
        reason_code='', capacity_flag=False, risk_notes='',
        requested_info='', decided_by,
    ) -> ProviderEvaluation:
        """Create a ProviderEvaluation without side-effects from the service layer."""
        evaluation, _ = ProviderEvaluation.objects.get_or_create(
            case=intake,
            provider=provider,
            decision=decision,
            defaults={
                'placement': placement,
                'reason_code': reason_code,
                'capacity_flag': capacity_flag,
                'risk_notes': risk_notes,
                'requested_info': requested_info,
                'decided_by': decided_by,
            },
        )
        return evaluation

    def _make_alert(
        self, *, intake, alert_type, severity, title, description, action
    ) -> OperationalAlert:
        """Create an unresolved OperationalAlert for a case."""
        alert, _ = OperationalAlert.objects.get_or_create(
            case=intake,
            alert_type=alert_type,
            resolved_at=None,
            defaults={
                'severity': severity,
                'title': title,
                'description': description,
                'recommended_action': action,
            },
        )
        return alert

    def _ensure_wait_times(self, providers):
        """Seed TrustAccount wait-time snapshots for observability pages."""
        specs = [
            ('Aanbieder De Horizon BV',      'OUTPATIENT', 7,  4,  12),
            ('Aanbieder Kompas Jeugd NV',    'DAY_TREATMENT', 14, 2, 9),
            ('Aanbieder Stap Verder',         'OUTPATIENT', 21, 1,  7),
            ('Aanbieder CrisisZorg Noord',    'CRISIS', 2,  2,  3),
            ('Aanbieder Zilverlinde Groep',   'RESIDENTIAL', 28, 0, 18),
            ('Aanbieder Bronzegel GGZ',       'OUTPATIENT', 35, 1,  14),
        ]
        care_type_map = {
            'OUTPATIENT': TrustAccount.CareType.AMBULANT,
            'DAY_TREATMENT': TrustAccount.CareType.DAGBESTEDING,
            'RESIDENTIAL': TrustAccount.CareType.OVERIG,
            'CRISIS': TrustAccount.CareType.JEUGDHULP,
        }
        for name, form, wait_days, open_slots, waiting_list in specs:
            provider = providers.get(name)
            if provider is None:
                continue
            TrustAccount.objects.update_or_create(
                provider=provider,
                region='Regio Midden-Nederland',
                care_type=care_type_map[form],
                defaults={
                    'wait_days': wait_days,
                    'open_slots': open_slots,
                    'waiting_list_size': waiting_list,
                    'notes': f'Demo capaciteitssnapshot – {name}.',
                },
            )

    # -----------------------------------------------------------------------
    # Scenario list printer
    # -----------------------------------------------------------------------

    def _print_scenario_list(self):
        scenarios = [
            ('happy-path',          'T. van den Berg',    'Ambulant geaccepteerd, plaatsing actief'),
            ('capacity-issue',      'M. Bakker',          'Eerste aanbieder vol; tweede aanbieder in beoordeling'),
            ('info-request (open)', 'L. Janssen',         'Informatieverzoek in behandeling bij operator'),
            ('info-request (done)', 'R. de Vries',        'Informatieverzoek opgelost, opnieuw ingediend'),
            ('weak-match',          'F. Mulder',          'Zwakke match – vereist beoordeling'),
            ('stalled-placement',   'S. Visser',          'Goedgekeurd, start 10 dagen achterstallig'),
            ('bounced-case',        'J. Smit',            '3 opeenvolgende afwijzingen – escalatie nodig'),
            ('crisis',              'K. Pietersen',       'Crisis geaccepteerd, start binnen 24 uur'),
            ('closed',              'A. Wolters',         'Traject succesvol afgerond'),
        ]
        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('Demo scenario overzicht:'))
        self.stdout.write(f"  {'Scenario':<25} {'Cliënt':<22} Beschrijving")
        self.stdout.write('  ' + '─' * 80)
        for tag, client, desc in scenarios:
            self.stdout.write(f'  [{tag:<22}]  {client:<20} {desc}')
        self.stdout.write('')
        self.stdout.write('Inloggegevens (niet-productie omgeving):')
        self.stdout.write('  demo.regie    / Demo2026!   (eigenaar, staff)')
        self.stdout.write('  demo.operator / Demo2026!   (admin)')
        self.stdout.write('  demo.viewer   / Demo2026!   (lid)')
