"""Management command: simulate_pipeline

Creates 50 deterministic seeded cases and runs each through the full pipeline:
  Intake → Beoordeling → Matching → Plaatsing → Intake overdracht

Usage:
    python manage.py simulate_pipeline
    python manage.py simulate_pipeline --seed 99
    python manage.py simulate_pipeline --reset
    python manage.py simulate_pipeline --org-slug pilot-careon
"""

from __future__ import annotations

import random
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from contracts.models import (
    CareCategoryMain,
    CaseAssessment,
    CaseIntakeProcess,
    Client,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
    RegionalConfiguration,
    SimulatedCaseResult,
    SimulationRun,
    TrustAccount,
)

User = get_user_model()

SIMULATION_ORG_SLUG = 'sim-zorg-os'

# ── Scenario definitions ──────────────────────────────────────────────────────

URGENCY_CHOICES = [
    CaseIntakeProcess.Urgency.LOW,
    CaseIntakeProcess.Urgency.MEDIUM,
    CaseIntakeProcess.Urgency.HIGH,
    CaseIntakeProcess.Urgency.CRISIS,
]

COMPLEXITY_CHOICES = [
    CaseIntakeProcess.Complexity.SIMPLE,
    CaseIntakeProcess.Complexity.MULTIPLE,
    CaseIntakeProcess.Complexity.SEVERE,
]

AGE_CHOICES = [
    CaseIntakeProcess.AgeCategory.EARLY_CHILDHOOD,
    CaseIntakeProcess.AgeCategory.CHILDHOOD,
    CaseIntakeProcess.AgeCategory.ADOLESCENT,
    CaseIntakeProcess.AgeCategory.ADULT,
]

CARE_FORM_CHOICES = [
    CaseIntakeProcess.CareForm.OUTPATIENT,
    CaseIntakeProcess.CareForm.DAY_TREATMENT,
    CaseIntakeProcess.CareForm.RESIDENTIAL,
    CaseIntakeProcess.CareForm.CRISIS,
]

PROBLEMATIEK_POOL = [
    'trauma', 'angst', 'adhd', 'autisme', 'depressie',
    'verslaving', 'huiselijk_geweld', 'eetstoornissen', 'psychose',
]

# Weights for scenario type distribution across 50 cases
# (normal, missing_data, no_capacity, weak_match, stalled, urgent_limited)
SCENARIO_WEIGHTS = [40, 15, 10, 10, 10, 15]
SCENARIO_TYPES = ['normal', 'missing_data', 'no_capacity', 'weak_match', 'stalled', 'urgent_limited']

# Provider specs: (name_suffix, has_crisis, max_cap, wait_days)
PROVIDER_SPECS = [
    ('Noord', True, 10, 8),
    ('Zuid', False, 8, 14),
    ('Oost', False, 6, 21),
    ('West', True, 4, 5),
    ('Centraal', False, 12, 10),
    ('Crisis Opvang', True, 2, 2),
    ('Volledig Bezet', False, 0, 60),  # capacity=0 edge case
]

CATEGORY_NAMES = [
    'Jeugd GGZ',
    'Gezinsondersteuning',
    'Wmo begeleiding',
    'LVB ondersteuning',
    'Crisishulp',
]

MUNICIPALITY_NAMES = [
    'Amsterdam', 'Rotterdam', 'Utrecht', 'Eindhoven',
    'Groningen', 'Maastricht', 'Tilburg', 'Breda',
]

REGION_NAME = 'Simulatieregio Landelijk'


class Command(BaseCommand):
    help = 'Simulate 50 realistic cases through the full Zorg OS pipeline.'

    def add_arguments(self, parser):
        parser.add_argument('--seed', type=int, default=42, help='Reproducibility seed (default: 42)')
        parser.add_argument('--reset', action='store_true', help='Delete previous simulation records for this seed before running')
        parser.add_argument('--org-slug', default=SIMULATION_ORG_SLUG, help='Organisation slug to use/create')

    @transaction.atomic
    def handle(self, *args, **options):
        seed = options['seed']
        org_slug = options['org_slug']
        rng = random.Random(seed)

        org, user = self._ensure_org_and_user(org_slug)

        if options['reset']:
            self._reset_simulation_data(org, seed)

        categories = self._ensure_categories(org)
        providers = self._ensure_providers(org, user, categories)
        municipality, region = self._ensure_geo(org, user, categories, providers)

        run = SimulationRun.objects.create(
            seed=seed,
            label=f'Simulatie seed={seed}',
            status=SimulationRun.RunStatus.RUNNING,
            organization=org,
            created_by=user,
        )

        self.stdout.write(f'Simulatie gestart: run #{run.pk}, seed={seed}')

        results = []
        scenario_list = self._build_scenario_list(rng)

        for idx, scenario in enumerate(scenario_list, start=1):
            result = self._run_single_case(
                run=run,
                case_number=idx,
                scenario=scenario,
                rng=rng,
                org=org,
                user=user,
                categories=categories,
                providers=providers,
                municipality=municipality,
                region=region,
            )
            results.append(result)
            phase_label = result.get_current_phase_display()
            block = result.pipeline_block_reason
            self.stdout.write(f'  [{idx:02d}] {phase_label:<20} block={block}')

        summary = self._build_summary(results)
        run.total_cases = len(results)
        run.successful_flows = summary['successful_flows']
        run.blocked_missing_data = summary['blocked_missing_data']
        run.blocked_no_capacity = summary['blocked_no_capacity']
        run.weak_match_count = summary['weak_match_count']
        run.stalled_placement_count = summary['stalled_placement_count']
        run.summary = summary
        run.status = SimulationRun.RunStatus.COMPLETED
        run.completed_at = timezone.now()
        run.save()

        self.stdout.write(self.style.SUCCESS(f'\nSimulatie afgerond: run #{run.pk}'))
        self.stdout.write(f'  Totaal casussen    : {run.total_cases}')
        self.stdout.write(f'  Succesvol          : {run.successful_flows}')
        self.stdout.write(f'  Geblokkeerd data   : {run.blocked_missing_data}')
        self.stdout.write(f'  Geen capaciteit    : {run.blocked_no_capacity}')
        self.stdout.write(f'  Zwakke match       : {run.weak_match_count}')
        self.stdout.write(f'  Plaatsing vastgelopen: {run.stalled_placement_count}')
        self.stdout.write(f'\nBekijk resultaten op /care/simulatie/')

    # ── Infrastructure helpers ────────────────────────────────────────────────

    def _ensure_org_and_user(self, slug):
        org, _ = Organization.objects.get_or_create(
            slug=slug,
            defaults={'name': f'Simulatie Org ({slug})'},
        )
        user, created = User.objects.get_or_create(
            username='sim.coordinator',
            defaults={
                'email': 'sim.coordinator@careon.local',
                'first_name': 'Sim',
                'last_name': 'Coordinator',
            },
        )
        if created:
            user.set_password('SimPass123!')
            user.save(update_fields=['password'])
        OrganizationMembership.objects.get_or_create(
            organization=org,
            user=user,
            defaults={'role': OrganizationMembership.Role.OWNER, 'is_active': True},
        )
        return org, user

    def _ensure_categories(self, org):
        cats = []
        for i, name in enumerate(CATEGORY_NAMES, start=1):
            cat, _ = CareCategoryMain.objects.get_or_create(
                name=name,
                defaults={'order': i, 'is_active': True},
            )
            cats.append(cat)
        return cats

    def _ensure_providers(self, org, user, categories):
        providers = []
        for name_suffix, has_crisis, max_cap, wait_days in PROVIDER_SPECS:
            name = f'Sim Aanbieder {name_suffix}'
            provider, _ = Client.objects.get_or_create(
                organization=org,
                name=name,
                defaults={
                    'status': Client.Status.ACTIVE,
                    'client_type': Client.ClientType.CORPORATION,
                    'created_by': user,
                    'industry': 'Jeugdzorg',
                },
            )
            profile, _ = ProviderProfile.objects.get_or_create(
                client=provider,
                defaults={
                    'offers_outpatient': True,
                    'offers_day_treatment': True,
                    'offers_residential': has_crisis,
                    'offers_crisis': has_crisis,
                    'handles_low_urgency': True,
                    'handles_medium_urgency': True,
                    'handles_high_urgency': True,
                    'handles_crisis_urgency': has_crisis,
                    'current_capacity': max_cap,
                    'max_capacity': max(max_cap, 1),
                    'waiting_list_length': max(0, 30 - max_cap),
                    'average_wait_days': wait_days,
                },
            )
            profile.target_care_categories.set(categories)
            providers.append(provider)
        return providers

    def _ensure_geo(self, org, user, categories, providers):
        municipalities = []
        for i, name in enumerate(MUNICIPALITY_NAMES, start=1):
            mun, _ = MunicipalityConfiguration.objects.get_or_create(
                organization=org,
                municipality_code=f'SIM-MUN-{i:03d}',
                defaults={
                    'municipality_name': name,
                    'status': MunicipalityConfiguration.Status.ACTIVE,
                    'responsible_coordinator': user,
                    'created_by': user,
                    'max_wait_days': 21,
                },
            )
            mun.care_domains.set(categories)
            mun.linked_providers.set(providers)
            municipalities.append(mun)

        region, _ = RegionalConfiguration.objects.get_or_create(
            organization=org,
            region_code='SIM-REGIO-1',
            defaults={
                'region_name': REGION_NAME,
                'status': RegionalConfiguration.Status.ACTIVE,
                'responsible_coordinator': user,
                'created_by': user,
                'max_wait_days': 21,
            },
        )
        region.served_municipalities.set(municipalities)
        region.care_domains.set(categories)
        region.linked_providers.set(providers)
        return municipalities[0], region

    def _reset_simulation_data(self, org, seed):
        runs = SimulationRun.objects.filter(organization=org, seed=seed)
        case_ids = list(
            SimulatedCaseResult.objects.filter(run__in=runs)
            .values_list('intake_id', flat=True)
        )
        CaseIntakeProcess.objects.filter(pk__in=case_ids).delete()
        runs.delete()
        self.stdout.write(self.style.WARNING(f'Vorige simulatiedata verwijderd voor seed={seed}.'))

    # ── Scenario generation ───────────────────────────────────────────────────

    def _build_scenario_list(self, rng: random.Random) -> list[str]:
        scenarios = []
        remaining = 50
        for i, stype in enumerate(SCENARIO_TYPES):
            count = SCENARIO_WEIGHTS[i]
            scenarios.extend([stype] * count)
        # Shuffle deterministically, then trim/pad to exactly 50
        rng.shuffle(scenarios)
        return scenarios[:50]

    # ── Single case simulation ────────────────────────────────────────────────

    def _run_single_case(
        self, *, run, case_number, scenario, rng, org, user, categories, providers, municipality, region
    ) -> SimulatedCaseResult:
        urgency = rng.choice(URGENCY_CHOICES)
        complexity = rng.choice(COMPLEXITY_CHOICES)
        age_group = rng.choice(AGE_CHOICES)
        care_form = rng.choice(CARE_FORM_CHOICES)
        care_cat = rng.choice(categories)
        problematiek = rng.sample(PROBLEMATIEK_POOL, k=rng.randint(1, 3))
        has_special = scenario in ('urgent_limited',) or rng.random() < 0.15

        # Force urgency for urgent_limited scenario
        if scenario == 'urgent_limited':
            urgency = CaseIntakeProcess.Urgency.CRISIS

        # For crisis care form, ensure we ask for crisis
        if scenario == 'no_capacity':
            care_form = CaseIntakeProcess.CareForm.CRISIS

        today = date.today()
        title = f'Sim Casus {run.pk}-{case_number:02d} ({scenario})'

        # ── Step 1: create intake ─────────────────────────────────────────────
        missing_fields = scenario == 'missing_data' or (scenario == 'normal' and rng.random() < 0.05)

        intake_kwargs = {
            'organization': org,
            'title': title,
            'status': CaseIntakeProcess.ProcessStatus.INTAKE,
            'case_coordinator': user,
            'start_date': today - timedelta(days=rng.randint(1, 30)),
            'target_completion_date': today + timedelta(days=rng.randint(5, 45)),
            'urgency': urgency,
            'complexity': complexity,
            'preferred_care_form': care_form,
            'care_category_main': care_cat,
            'client_age_category': age_group,
            'problematiek_types': problematiek,
            'gemeente': municipality,
        }

        if not missing_fields:
            intake_kwargs['assessment_summary'] = (
                f'Hulpvraag: {care_cat.name}. Leeftijd: {age_group}. '
                f'Problematiek: {", ".join(problematiek)}. '
                f'Urgentie: {urgency}. Complexiteit: {complexity}.'
            )

        intake = CaseIntakeProcess.objects.create(**intake_kwargs)

        risk_flags = []
        block_reason = SimulatedCaseResult.BlockReason.NONE
        current_phase = SimulatedCaseResult.PipelinePhase.INTAKE
        next_best_action = ''
        matched_count = 0
        selected_provider = None
        placement_status = ''

        # ── Step 2: evaluate required fields ─────────────────────────────────
        if missing_fields:
            risk_flags.append('INCOMPLETE_INTAKE')
            block_reason = SimulatedCaseResult.BlockReason.MISSING_DATA
            current_phase = SimulatedCaseResult.PipelinePhase.GEBLOKKEERD
            next_best_action = 'Vul ontbrekende intakegegevens aan (samenvatting, regio, leeftijdscategorie)'
            return self._save_result(
                run, case_number, intake, None, current_phase,
                next_best_action, risk_flags, matched_count, selected_provider,
                placement_status, block_reason,
                urgency, complexity, age_group, care_cat.name,
                region.region_name, missing_fields, has_special,
            )

        # ── Step 3: beoordeling ───────────────────────────────────────────────
        current_phase = SimulatedCaseResult.PipelinePhase.BEOORDELING
        assessment_status = CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
        if scenario == 'weak_match':
            risk_flags.append('WEAK_MATCH_RISK')

        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=assessment_status,
            matching_ready=True,
            notes=f'Beoordeling gegenereerd door simulatie (scenario={scenario}).',
            assessed_by=user,
        )
        intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        intake.save(update_fields=['status'])

        # ── Step 4: matching ──────────────────────────────────────────────────
        current_phase = SimulatedCaseResult.PipelinePhase.MATCHING

        candidates = self._run_matching(
            intake=intake,
            providers=providers,
            scenario=scenario,
            care_form=care_form,
            urgency=urgency,
            rng=rng,
        )
        matched_count = len(candidates)

        if matched_count == 0:
            risk_flags.append('NO_MATCH')
            if scenario == 'no_capacity':
                block_reason = SimulatedCaseResult.BlockReason.NO_CAPACITY
                next_best_action = 'Controleer capaciteit bij aanbieders; overweeg wachtlijst of regionaal alternatief'
            else:
                block_reason = SimulatedCaseResult.BlockReason.NO_PROVIDERS
                next_best_action = 'Verbreed zoekcriteria of schaal op naar regionale matching'
            current_phase = SimulatedCaseResult.PipelinePhase.GEBLOKKEERD
            return self._save_result(
                run, case_number, intake, None, current_phase,
                next_best_action, risk_flags, matched_count, None,
                placement_status, block_reason,
                urgency, complexity, age_group, care_cat.name,
                region.region_name, missing_fields, has_special,
            )

        if scenario == 'weak_match':
            risk_flags.append('WEAK_MATCH')
            block_reason = SimulatedCaseResult.BlockReason.WEAK_MATCH
            next_best_action = 'Match van lage kwaliteit; overweeg alternatief of aanvullende indicatie'

        # Select best (first) candidate
        selected_provider = candidates[0]

        # ── Step 5: placement ─────────────────────────────────────────────────
        current_phase = SimulatedCaseResult.PipelinePhase.PLAATSING

        if scenario == 'stalled':
            placement_status = PlacementRequest.ProviderResponseStatus.PENDING
            risk_flags.append('STALLED_PLACEMENT')
            block_reason = SimulatedCaseResult.BlockReason.STALLED_PLACEMENT
            next_best_action = 'Plaatsing vastgelopen: geen reactie aanbieder. Stuur herinnering of heroverweeg match.'
        elif scenario == 'urgent_limited':
            risk_flags.append('URGENT_LIMITED_OPTIONS')
            block_reason = SimulatedCaseResult.BlockReason.URGENT_LIMITED
            placement_status = PlacementRequest.ProviderResponseStatus.WAITLIST
            next_best_action = 'Urgente casus met beperkt aanbod; escaleer naar crisisteam'
        else:
            placement_status = PlacementRequest.ProviderResponseStatus.ACCEPTED

        placement = PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=selected_provider,
            selected_provider=selected_provider if placement_status == PlacementRequest.ProviderResponseStatus.ACCEPTED else None,
            care_form=care_form,
            status=PlacementRequest.Status.APPROVED if placement_status == PlacementRequest.ProviderResponseStatus.ACCEPTED else PlacementRequest.Status.IN_REVIEW,
            provider_response_status=placement_status,
            start_date=today + timedelta(days=rng.randint(3, 21)),
            decision_notes=f'Simulatie plaatsing ({scenario}).',
        )

        # ── Step 6: intake overdracht ─────────────────────────────────────────
        if placement_status == PlacementRequest.ProviderResponseStatus.ACCEPTED and scenario not in ('stalled', 'urgent_limited', 'weak_match'):
            current_phase = SimulatedCaseResult.PipelinePhase.INTAKE_OVERDRACHT
            intake.status = CaseIntakeProcess.ProcessStatus.COMPLETED
            intake.save(update_fields=['status'])
            next_best_action = 'Plaatsing bevestigd. Overdracht aan aanbieder gereed.'
            current_phase = SimulatedCaseResult.PipelinePhase.AFGEROND
        elif not next_best_action:
            next_best_action = 'Plaatsing in uitvoering. Volg reactie aanbieder op.'

        if urgency == CaseIntakeProcess.Urgency.CRISIS and not risk_flags:
            risk_flags.append('CRISIS_URGENTIE')

        return self._save_result(
            run, case_number, intake, placement, current_phase,
            next_best_action, risk_flags, matched_count, selected_provider,
            placement_status, block_reason,
            urgency, complexity, age_group, care_cat.name,
            region.region_name, missing_fields, has_special,
        )

    def _run_matching(self, *, intake, providers, scenario, care_form, urgency, rng):
        """Simple rule-based matching returning a list of suitable providers."""
        if scenario == 'no_capacity':
            # Return only zero-capacity providers = blocked
            return [
                p for p in providers
                if hasattr(p, 'provider_profile') and p.provider_profile.current_capacity == 0
            ]

        # Filter by care form and capacity
        candidates = []
        for provider in providers:
            try:
                profile = provider.provider_profile
            except Exception:
                continue

            if profile.current_capacity == 0:
                continue

            form_ok = (
                (care_form == CaseIntakeProcess.CareForm.OUTPATIENT and profile.offers_outpatient)
                or (care_form == CaseIntakeProcess.CareForm.DAY_TREATMENT and profile.offers_day_treatment)
                or (care_form == CaseIntakeProcess.CareForm.RESIDENTIAL and profile.offers_residential)
                or (care_form == CaseIntakeProcess.CareForm.CRISIS and profile.offers_crisis)
            )
            urgency_ok = (
                (urgency == CaseIntakeProcess.Urgency.LOW and profile.handles_low_urgency)
                or (urgency == CaseIntakeProcess.Urgency.MEDIUM and profile.handles_medium_urgency)
                or (urgency == CaseIntakeProcess.Urgency.HIGH and profile.handles_high_urgency)
                or (urgency == CaseIntakeProcess.Urgency.CRISIS and profile.handles_crisis_urgency)
            )

            if form_ok and urgency_ok:
                candidates.append(provider)

        if scenario == 'weak_match':
            # Return only 1 low-quality candidate if any
            return candidates[:1]

        if scenario == 'urgent_limited':
            # Only crisis providers
            crisis_candidates = [
                p for p in candidates
                if hasattr(p, 'provider_profile') and p.provider_profile.offers_crisis
            ]
            return crisis_candidates[:1]

        rng.shuffle(candidates)
        return candidates

    # ── Result persistence ────────────────────────────────────────────────────

    def _save_result(
        self, run, case_number, intake, placement,
        current_phase, next_best_action, risk_flags,
        matched_count, selected_provider, placement_status, block_reason,
        urgency, complexity, age_group, care_category, region, missing_fields, has_special,
    ) -> SimulatedCaseResult:
        return SimulatedCaseResult.objects.create(
            run=run,
            case_number=case_number,
            intake=intake,
            placement=placement,
            current_phase=current_phase,
            next_best_action=next_best_action,
            risk_flags=risk_flags,
            matched_provider_count=matched_count,
            selected_provider=selected_provider,
            placement_status=placement_status,
            pipeline_block_reason=block_reason,
            urgency_snapshot=urgency,
            complexity_snapshot=complexity,
            age_group_snapshot=age_group,
            care_category_snapshot=care_category,
            region_snapshot=region,
            has_missing_fields=missing_fields,
            has_special_needs=has_special,
        )

    # ── Summary aggregation ───────────────────────────────────────────────────

    def _build_summary(self, results: list[SimulatedCaseResult]) -> dict:
        phase_counts: dict[str, int] = {}
        for r in results:
            phase_counts[r.current_phase] = phase_counts.get(r.current_phase, 0) + 1

        successful = sum(
            1 for r in results
            if r.current_phase == SimulatedCaseResult.PipelinePhase.AFGEROND
        )
        blocked_data = sum(
            1 for r in results
            if r.pipeline_block_reason == SimulatedCaseResult.BlockReason.MISSING_DATA
        )
        blocked_cap = sum(
            1 for r in results
            if r.pipeline_block_reason in (
                SimulatedCaseResult.BlockReason.NO_CAPACITY,
                SimulatedCaseResult.BlockReason.NO_PROVIDERS,
            )
        )
        weak = sum(
            1 for r in results
            if r.pipeline_block_reason == SimulatedCaseResult.BlockReason.WEAK_MATCH
        )
        stalled = sum(
            1 for r in results
            if r.pipeline_block_reason == SimulatedCaseResult.BlockReason.STALLED_PLACEMENT
        )

        avg_per_phase = {}
        total = len(results)
        if total:
            for phase, count in phase_counts.items():
                avg_per_phase[phase] = round(count / total * 100, 1)

        return {
            'successful_flows': successful,
            'blocked_missing_data': blocked_data,
            'blocked_no_capacity': blocked_cap,
            'weak_match_count': weak,
            'stalled_placement_count': stalled,
            'phase_distribution': phase_counts,
            'phase_percentage': avg_per_phase,
        }
