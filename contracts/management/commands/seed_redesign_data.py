from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from contracts.models import (
    Budget,
    BudgetExpense,
    AanbiederVestiging,
    CareCase,
    CareCategoryMain,
    CareSignal,
    CaseAssessment,
    CaseIntakeProcess,
    Client,
    Deadline,
    Document,
    MatchResultaat,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
    OutcomeReasonCode,
    RegionalConfiguration,
    Zorgaanbieder,
    Zorgprofiel,
    TrustAccount,
)


User = get_user_model()

PILOT_CASE_TITLES = [
    'Crisisplaatsing jeugd - meisje 15 jaar, onveilige thuissituatie',
    'Onvolledige intake - jongen 13 jaar, schoolverzuim en gezinsspanning',
    'Zwakke match - jongen 16 jaar, LVB en trauma',
    'Afwijzing aanbieder - meisje 14 jaar, autisme en escalatie',
    'SLA-overschrijding aanbiederreactie - jongen 12 jaar, gedragsproblematiek',
    'Geaccepteerd maar intake vertraagd - meisje 17 jaar, woonvoorziening',
    'Afgeronde casus - nazorg afgesloten en gearchiveerd',
]

LEGACY_PILOT_CASE_TITLES = [
    'Pilot Casus Intake',
    'Pilot Casus Matching',
    'Pilot Casus Plaatsing',
]


class Command(BaseCommand):
	help = 'Seed realistic Dutch youth-care pilot data for the care workflow.'

	def add_arguments(self, parser):
		parser.add_argument(
			'--reset',
			action='store_true',
			help='Remove previously generated pilot records for the pilot organization first.',
		)

	@transaction.atomic
	def handle(self, *args, **options):
		org, owner, admin, member = self._ensure_organization_with_users(reset=options['reset'])
		categories = self._ensure_categories()
		providers = self._ensure_providers(org=org, users=(owner, admin, member), categories=categories)
		matching_providers = self._ensure_matching_providers(org=org, categories=categories)
		municipalities, region = self._ensure_network_configuration(org=org, user=owner, categories=categories, providers=providers)

		intakes = self._ensure_cases_and_flow(
			org=org,
			users=(owner, admin, member),
			providers=providers,
			matching_providers=matching_providers,
			categories=categories,
		)
		self._ensure_waittimes(providers)
		self._ensure_budget(org=org, user=owner, intakes=intakes, municipalities=municipalities)

		self.stdout.write(self.style.SUCCESS('Pilot data seeded successfully.'))
		self.stdout.write('- Organisatie: pilot-careon')
		self.stdout.write(f'- Casussen/intakes: {len(intakes)}')
		self.stdout.write(f'- Aanbieders: {len(providers)}')
		self.stdout.write(f'- Regio: {region.region_name}')

	def _ensure_organization_with_users(self, *, reset=False):
		org, _ = Organization.objects.get_or_create(name='Careon Pilot Team', defaults={'slug': 'pilot-careon'})
		if org.slug != 'pilot-careon':
			org.slug = 'pilot-careon'
			org.save(update_fields=['slug'])

		owner = self._ensure_user('pilot.owner', 'pilot.owner@careon.local', 'Pilot', 'Owner')
		admin = self._ensure_user('pilot.admin', 'pilot.admin@careon.local', 'Pilot', 'Admin')
		member = self._ensure_user('pilot.member', 'pilot.member@careon.local', 'Pilot', 'Member')

		OrganizationMembership.objects.update_or_create(
			organization=org,
			user=owner,
			defaults={'role': OrganizationMembership.Role.OWNER, 'is_active': True},
		)
		OrganizationMembership.objects.update_or_create(
			organization=org,
			user=admin,
			defaults={'role': OrganizationMembership.Role.ADMIN, 'is_active': True},
		)
		OrganizationMembership.objects.update_or_create(
			organization=org,
			user=member,
			defaults={'role': OrganizationMembership.Role.MEMBER, 'is_active': True},
		)

		if reset:
			CaseIntakeProcess.objects.filter(organization=org, title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			CareCase.objects.filter(organization=org, title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			MatchResultaat.objects.filter(casus__organization=org, casus__title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			PlacementRequest.objects.filter(due_diligence_process__organization=org, due_diligence_process__title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			CaseAssessment.objects.filter(due_diligence_process__organization=org, due_diligence_process__title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			CareSignal.objects.filter(due_diligence_process__organization=org, due_diligence_process__title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			Deadline.objects.filter(due_diligence_process__organization=org, due_diligence_process__title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			Document.objects.filter(contract__organization=org, contract__title__in=LEGACY_PILOT_CASE_TITLES + PILOT_CASE_TITLES).delete()
			Zorgprofiel.objects.filter(zorgaanbieder__name__in=self._matching_provider_names()).delete()
			AanbiederVestiging.objects.filter(zorgaanbieder__name__in=self._matching_provider_names()).delete()
			Zorgaanbieder.objects.filter(name__in=self._matching_provider_names()).delete()
			MunicipalityConfiguration.objects.filter(organization=org, municipality_code__startswith='PILOT-').delete()
			RegionalConfiguration.objects.filter(organization=org, region_code__startswith='PILOT-').delete()
			Client.objects.filter(
				organization=org,
				name__in=self._provider_names() + ['Pilot Aanbieder Noord', 'Pilot Aanbieder Midden', 'Pilot Aanbieder Crisis'],
			).delete()

		return org, owner, admin, member

	def _ensure_user(self, username, email, first_name, last_name):
		user, created = User.objects.get_or_create(
			username=username,
			defaults={
				'email': email,
				'first_name': first_name,
				'last_name': last_name,
			},
		)
		if created:
			user.set_password('PilotPass123!')
			user.save(update_fields=['password'])
		return user

	def _ensure_categories(self):
		names = ['Jeugd GGZ', 'Gezinsondersteuning', 'Wmo begeleiding']
		categories = []
		for index, name in enumerate(names, start=1):
			category, _ = CareCategoryMain.objects.get_or_create(
				name=name,
				defaults={'order': index, 'is_active': True},
			)
			categories.append(category)
		return categories

	def _provider_specs(self):
		return [
			('Jeugd & Gezin Utrecht', 'Jeugd & Gezin Utrecht', 12, 5, False),
			('Midden-Nederland Jeugdhulp', 'Midden-Nederland Jeugdhulp', 18, 2, False),
			('Crisisteam Jeugd Utrecht', 'Crisisteam Jeugd Utrecht', 4, 1, True),
		]

	def _provider_names(self):
		return [name for name, _, _, _, _ in self._provider_specs()]

	def _matching_provider_specs(self):
		return [
			{
				'name': 'Jeugd & Gezin Utrecht',
				'city': 'Utrecht',
				'care_form': 'ambulant',
				'care_domain': 'jeugd',
				'avg_wait_days': 18,
				'capacity': 4,
				'specialisation': 'gezinsbehandeling en ambulante ondersteuning',
				'profiles': [
					{
						'zorgvorm': 'ambulant',
						'zorgdomein': 'jeugd',
						'confidence': 0.42,
						'label': MatchResultaat.ConfidenceLabel.LAAG,
						'trade_offs': [
							'Regio sluit aan, maar de wachttijd is relatief lang.',
							'De vraag past maar gedeeltelijk bij de huidige gezinsbegeleiding.',
							'Capaciteit is beperkt in vergelijking met andere opties.',
						],
						'advies': 'Herbevestig de matchonderbouwing voordat deze casus wordt verstuurd.',
					}
				],
			},
			{
				'name': 'Midden-Nederland Jeugdhulp',
				'city': 'Amersfoort',
				'care_form': 'ambulant',
				'care_domain': 'jeugd',
				'avg_wait_days': 14,
				'capacity': 3,
				'specialisation': 'ambulante jeugd-ggz en opvoedondersteuning',
				'profiles': [
					{
						'zorgvorm': 'ambulant',
						'zorgdomein': 'jeugd',
						'confidence': 0.66,
						'label': MatchResultaat.ConfidenceLabel.MIDDEL,
						'trade_offs': [
							'Inhoudelijke fit is redelijk, maar niet uitgesproken sterk.',
							'Regio is passend, maar de wachttijd is hoger dan wenselijk.',
						],
						'advies': 'Controleer of aanvullende context nodig is.',
					}
				],
			},
			{
				'name': 'Crisisteam Jeugd Utrecht',
				'city': 'Utrecht',
				'care_form': 'crisisopvang',
				'care_domain': 'jeugd',
				'avg_wait_days': 2,
				'capacity': 1,
				'specialisation': 'crisisopvang en intensieve overbrugging',
				'profiles': [
					{
						'zorgvorm': 'crisisopvang',
						'zorgdomein': 'jeugd',
						'confidence': 0.91,
						'label': MatchResultaat.ConfidenceLabel.HOOG,
						'trade_offs': [
							'Crisiszorg sluit goed aan op de hulpvraag.',
							'De capaciteit is beperkt maar de fit is sterk.',
						],
						'advies': 'Gebruik deze aanbieder als primaire optie voor crisisinstroom.',
					}
				],
			},
		]

	def _matching_provider_names(self):
		return [spec['name'] for spec in self._matching_provider_specs()]

	def _ensure_providers(self, *, org, users, categories):
		owner, admin, member = users
		provider_specs = [
			('Jeugd & Gezin Utrecht', owner, 12, 5, False),
			('Midden-Nederland Jeugdhulp', admin, 18, 2, False),
			('Crisisteam Jeugd Utrecht', member, 4, 1, True),
		]
		providers = []
		for name, creator, wait_days, open_slots, crisis in provider_specs:
			provider, _ = Client.objects.get_or_create(
				organization=org,
				name=name,
				defaults={
					'status': Client.Status.ACTIVE,
					'client_type': Client.ClientType.CORPORATION,
					'created_by': creator,
					'industry': 'Jeugdzorg',
				},
			)
			profile, _ = ProviderProfile.objects.get_or_create(
				client=provider,
				defaults={
					'offers_outpatient': True,
					'offers_day_treatment': True,
					'offers_residential': crisis,
					'offers_crisis': crisis,
					'handles_low_urgency': True,
					'handles_medium_urgency': True,
					'handles_high_urgency': True,
					'handles_crisis_urgency': crisis,
					'current_capacity': max(0, 6 - open_slots),
					'max_capacity': 6,
					'average_wait_days': wait_days,
				},
			)
			profile.target_care_categories.set(categories)
			providers.append(provider)
		return providers

	def _ensure_matching_providers(self, *, org, categories):
		bundles = []
		for index, spec in enumerate(self._matching_provider_specs(), start=1):
			zorgaanbieder, _ = Zorgaanbieder.objects.get_or_create(
				name=spec['name'],
				defaults={
					'handelsnaam': spec['name'],
					'provider_type': Zorgaanbieder.ProviderType.OVERIG if hasattr(Zorgaanbieder, 'ProviderType') else 'OVERIG',
					'trust_level': Zorgaanbieder.TrustLevel.VERIFIED,
					'is_active': True,
					'bron_type': Zorgaanbieder.BronType.MANUAL,
					'normalisatie_status': Zorgaanbieder.NormalisatieStatus.NORMALIZED,
					'review_status': Zorgaanbieder.ReviewStatus.APPROVED,
				},
			)
			zorgaanbieder.is_active = True
			zorgaanbieder.handelsnaam = spec['name']
			zorgaanbieder.save(update_fields=['is_active', 'handelsnaam', 'updated_at'])

			vestiging, _ = AanbiederVestiging.objects.get_or_create(
				zorgaanbieder=zorgaanbieder,
				vestiging_code=f'PILOT-MATCH-{index}',
				defaults={
					'name': spec['name'],
					'city': spec['city'],
					'gemeente': spec['city'],
					'provincie': 'Utrecht',
					'region': 'Regio Midden',
					'is_primary': True,
					'is_active': True,
					'bron_type': 'seeded',
					'bron_id': f'pilot-match-{index}',
				},
			)
			vestiging.name = spec['name']
			vestiging.city = spec['city']
			vestiging.gemeente = spec['city']
			vestiging.provincie = 'Utrecht'
			vestiging.region = 'Regio Midden'
			vestiging.is_active = True
			vestiging.save(update_fields=['name', 'city', 'gemeente', 'provincie', 'region', 'is_active', 'updated_at'])

			profile_bundles = []
			for profile_index, profile_spec in enumerate(spec['profiles'], start=1):
				profile, _ = Zorgprofiel.objects.get_or_create(
					aanbieder_vestiging=vestiging,
					zorgaanbieder=zorgaanbieder,
					zorgvorm=profile_spec['zorgvorm'],
					zorgdomein=profile_spec['zorgdomein'],
					defaults={
						'doelgroep_leeftijd_van': 12,
						'doelgroep_leeftijd_tot': 18,
						'problematiek_types': ['gezins- en opvoedproblematiek', 'schoolverzuim'],
						'intensiteit': 'middel',
						'setting_type': 'open',
						'crisis_opvang_mogelijk': profile_spec['zorgvorm'] == 'crisisopvang',
						'lvb_geschikt': True,
						'autisme_geschikt': True,
						'trauma_geschikt': True,
						'ggz_comorbiditeit_mogelijk': True,
						'verslavingsproblematiek_mogelijk': False,
						'veiligheidsrisico_hanteerbaar': True,
						'omschrijving_match_context': spec['specialisation'],
						'biedt_ambulant': profile_spec['zorgvorm'] == 'ambulant',
						'biedt_dagbehandeling': False,
						'biedt_residentieel': profile_spec['zorgvorm'] == 'residentieel',
						'biedt_crisis': profile_spec['zorgvorm'] == 'crisisopvang',
						'biedt_thuisbegeleiding': False,
						'leeftijd_12_18': True,
						'complexiteit_meervoudig': True,
						'urgentie_middel': True,
						'urgentie_hoog': True,
						'urgentie_crisis': profile_spec['zorgvorm'] == 'crisisopvang',
						'specialisaties': spec['specialisation'],
						'actief': True,
					},
				)
				profile_bundles.append((profile, profile_spec))

			bundles.append(
				{
					'zorgaanbieder': zorgaanbieder,
					'vestiging': vestiging,
					'profiles': profile_bundles,
					'avg_wait_days': spec['avg_wait_days'],
					'capacity': spec['capacity'],
				}
			)
		return bundles

	def _ensure_network_configuration(self, *, org, user, categories, providers):
		municipalities = []
		for idx, name in enumerate(['Utrecht', 'Amersfoort'], start=1):
			config, _ = MunicipalityConfiguration.objects.get_or_create(
				organization=org,
				municipality_code=f'PILOT-MUN-{idx}',
				defaults={
					'municipality_name': name,
					'status': MunicipalityConfiguration.Status.ACTIVE,
					'responsible_coordinator': user,
					'created_by': user,
					'max_wait_days': 21,
				},
			)
			config.care_domains.set(categories)
			config.linked_providers.set(providers)
			municipalities.append(config)

		region, _ = RegionalConfiguration.objects.get_or_create(
			organization=org,
			region_code='PILOT-REGIO-1',
			defaults={
				'region_name': 'Regio Midden Pilot',
				'status': RegionalConfiguration.Status.ACTIVE,
				'responsible_coordinator': user,
				'created_by': user,
				'max_wait_days': 21,
			},
		)
		region.served_municipalities.set(municipalities)
		region.care_domains.set(categories)
		region.linked_providers.set(providers)
		return municipalities, region

	def _ensure_cases_and_flow(self, *, org, users, providers, matching_providers, categories):
		owner, admin, member = users
		today = date.today()
		now = timezone.now()
		specs = [
			{
				'title': PILOT_CASE_TITLES[0],
				'coordinator': owner,
				'municipality': 'Utrecht',
				'region': 'Regio Midden Pilot',
				'status': CaseIntakeProcess.ProcessStatus.MATCHING,
				'urgency': CaseIntakeProcess.Urgency.CRISIS,
				'complexity': CaseIntakeProcess.Complexity.SEVERE,
				'care_form': CaseIntakeProcess.CareForm.CRISIS,
				'category': categories[0],
				'age': 15,
				'age_category': CaseIntakeProcess.AgeCategory.ADOLESCENT,
				'family_situation': CaseIntakeProcess.FamilySituation.HOME_DWELLING,
				'problematiek': ['veiligheidsrisico', 'schoolverzuim', 'gezinscrisis'],
				'summary': '15-jarige met escalatie thuis, signalen van onveiligheid en acute behoefte aan crisisopvang.',
				'description': 'De regiekamer zoekt een crisisplek omdat de thuissituatie niet meer veilig is.',
				'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
				'matching_ready': True,
				'case_phase': CareCase.CasePhase.MATCHING,
				'case_status': CareCase.Status.ACTIVE,
				'case_age_days': 4,
				'state_age_hours': 60,
				'deadline_type': Deadline.TaskType.CONTACT_PROVIDER,
				'signal_type': CareSignal.SignalType.SAFETY,
				'signal_level': CareSignal.RiskLevel.CRITICAL,
				'document_type': Document.DocType.CORRESPONDENCE,
				'placement': None,
				'match': None,
			},
			{
				'title': PILOT_CASE_TITLES[1],
				'coordinator': admin,
				'municipality': 'Amersfoort',
				'region': 'Regio Midden Pilot',
				'status': CaseIntakeProcess.ProcessStatus.INTAKE,
				'urgency': CaseIntakeProcess.Urgency.MEDIUM,
				'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
				'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
				'category': categories[1],
				'age': 13,
				'age_category': CaseIntakeProcess.AgeCategory.CHILDHOOD,
				'family_situation': CaseIntakeProcess.FamilySituation.DIVORCED_PARENTS,
				'problematiek': ['schoolverzuim', 'gezinsspanning', 'emotieregulatie'],
				'summary': '',
				'description': '',
				'assessment_status': None,
				'matching_ready': False,
				'case_phase': CareCase.CasePhase.INTAKE,
				'case_status': CareCase.Status.PENDING,
				'case_age_days': 2,
				'state_age_hours': 8,
				'deadline_type': Deadline.TaskType.ASSESSMENT_PERFORM,
				'signal_type': CareSignal.SignalType.INTAKE_INCOMPLETE,
				'signal_level': CareSignal.RiskLevel.MEDIUM,
				'document_type': Document.DocType.MEMO,
				'placement': None,
				'match': None,
			},
			{
				'title': PILOT_CASE_TITLES[2],
				'coordinator': member,
				'municipality': 'Utrecht',
				'region': 'Regio Midden Pilot',
				'status': CaseIntakeProcess.ProcessStatus.MATCHING,
				'urgency': CaseIntakeProcess.Urgency.HIGH,
				'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
				'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
				'category': categories[0],
				'age': 16,
				'age_category': CaseIntakeProcess.AgeCategory.ADOLESCENT,
				'family_situation': CaseIntakeProcess.FamilySituation.DIVORCED_PARENTS,
				'problematiek': ['LVB', 'trauma', 'schooluitval'],
				'summary': '16-jarige met LVB en traumageschiedenis; de eerste match is inhoudelijk passend maar niet ideaal.',
				'description': 'De regie wil deze casus niet te snel doorzetten zonder zicht op de trade-offs.',
				'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
				'matching_ready': True,
				'case_phase': CareCase.CasePhase.MATCHING,
				'case_status': CareCase.Status.ACTIVE,
				'case_age_days': 6,
				'state_age_hours': 18,
				'deadline_type': Deadline.TaskType.SELECT_MATCH,
				'signal_type': CareSignal.SignalType.NO_MATCH,
				'signal_level': CareSignal.RiskLevel.MEDIUM,
				'document_type': Document.DocType.RESEARCH,
				'match': {
					'provider_index': 0,
					'profile_index': 0,
					'score': 0.42,
					'label': MatchResultaat.ConfidenceLabel.LAAG,
					'trade_offs': [
						'De regio sluit aan, maar de wachttijd is lang.',
						'De inhoudelijke fit is onvoldoende voor directe plaatsing.',
						'Extra verificatie is nodig voor besluitvorming.',
					],
					'advies': 'Controleer de fit met de gemeente en houd alternatieven achter de hand.',
				},
				'placement': None,
			},
			{
				'title': PILOT_CASE_TITLES[3],
				'coordinator': owner,
				'municipality': 'Utrecht',
				'region': 'Regio Midden Pilot',
				'status': CaseIntakeProcess.ProcessStatus.DECISION,
				'urgency': CaseIntakeProcess.Urgency.HIGH,
				'complexity': CaseIntakeProcess.Complexity.SEVERE,
				'care_form': CaseIntakeProcess.CareForm.RESIDENTIAL,
				'category': categories[1],
				'age': 14,
				'age_category': CaseIntakeProcess.AgeCategory.ADOLESCENT,
				'family_situation': CaseIntakeProcess.FamilySituation.FOSTER_CARE,
				'problematiek': ['autisme', 'escalatie', 'veiligheidsrisico'],
				'summary': '14-jarige in pleegzorg is inhoudelijk aangemeld, maar de aanbieder heeft de casus afgewezen op capaciteit en complexiteit.',
				'description': 'De gemeente moet her-matchen na een inhoudelijke afwijzing door de aanbieder.',
				'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
				'matching_ready': True,
				'case_phase': CareCase.CasePhase.PROVIDER_BEOORDELING,
				'case_status': CareCase.Status.ACTIVE,
				'case_age_days': 8,
				'state_age_hours': 14,
				'deadline_type': Deadline.TaskType.CONTACT_PROVIDER,
				'signal_type': CareSignal.SignalType.CAPACITY_ISSUE,
				'signal_level': CareSignal.RiskLevel.HIGH,
				'document_type': Document.DocType.CORRESPONDENCE,
				'placement': {
					'status': PlacementRequest.Status.REJECTED,
					'provider_response_status': PlacementRequest.ProviderResponseStatus.REJECTED,
					'provider_response_reason_code': OutcomeReasonCode.PROVIDER_DECLINED,
					'provider_index': 1,
					'selected_provider_index': 1,
					'age_hours': 14,
				},
				'match': None,
			},
			{
				'title': PILOT_CASE_TITLES[4],
				'coordinator': admin,
				'municipality': 'Amersfoort',
				'region': 'Regio Midden Pilot',
				'status': CaseIntakeProcess.ProcessStatus.DECISION,
				'urgency': CaseIntakeProcess.Urgency.MEDIUM,
				'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
				'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
				'category': categories[2],
				'age': 12,
				'age_category': CaseIntakeProcess.AgeCategory.CHILDHOOD,
				'family_situation': CaseIntakeProcess.FamilySituation.HOME_DWELLING,
				'problematiek': ['gedragsproblematiek', 'emotieregulatie', 'schoolverzuim'],
				'summary': 'Aanbiederbeoordeling staat al meerdere dagen open; de provider moet inhoudelijk reageren.',
				'description': 'De casus is wel naar de aanbieder verstuurd, maar de reactie is nog niet binnen.',
				'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
				'matching_ready': True,
				'case_phase': CareCase.CasePhase.PROVIDER_BEOORDELING,
				'case_status': CareCase.Status.ACTIVE,
				'case_age_days': 9,
				'state_age_hours': 96,
				'deadline_type': Deadline.TaskType.CONTACT_PROVIDER,
				'signal_type': CareSignal.SignalType.WAIT_EXCEEDED,
				'signal_level': CareSignal.RiskLevel.HIGH,
				'document_type': Document.DocType.MEMO,
				'placement': {
					'status': PlacementRequest.Status.IN_REVIEW,
					'provider_response_status': PlacementRequest.ProviderResponseStatus.PENDING,
					'provider_index': 0,
					'selected_provider_index': 0,
					'age_hours': 96,
				},
				'match': None,
			},
			{
				'title': PILOT_CASE_TITLES[5],
				'coordinator': member,
				'municipality': 'Utrecht',
				'region': 'Regio Midden Pilot',
				'status': CaseIntakeProcess.ProcessStatus.DECISION,
				'urgency': CaseIntakeProcess.Urgency.HIGH,
				'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
				'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
				'category': categories[0],
				'age': 17,
				'age_category': CaseIntakeProcess.AgeCategory.ADOLESCENT,
				'family_situation': CaseIntakeProcess.FamilySituation.INSTITUTION,
				'problematiek': ['woonvoorziening', 'trauma', 'uitstroom'],
				'summary': 'Aanbieder heeft geaccepteerd, maar de intake-overdracht is nog niet gestart ondanks bevestigde plaatsing.',
				'description': 'De casus wacht op de eerste intakeafspraak terwijl de plaatsing al is bevestigd.',
				'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
				'matching_ready': True,
				'case_phase': CareCase.CasePhase.PLAATSING,
				'case_status': CareCase.Status.ACTIVE,
				'case_age_days': 14,
				'state_age_hours': 192,
				'deadline_type': Deadline.TaskType.INTAKE_COMPLETE,
				'signal_type': CareSignal.SignalType.WAIT_EXCEEDED,
				'signal_level': CareSignal.RiskLevel.MEDIUM,
				'document_type': Document.DocType.MEMO,
				'placement': {
					'status': PlacementRequest.Status.APPROVED,
					'provider_response_status': PlacementRequest.ProviderResponseStatus.ACCEPTED,
					'provider_index': 2,
					'selected_provider_index': 2,
					'age_hours': 192,
				},
				'match': None,
			},
			{
				'title': PILOT_CASE_TITLES[6],
				'coordinator': owner,
				'municipality': 'Utrecht',
				'region': 'Regio Midden Pilot',
				'status': CaseIntakeProcess.ProcessStatus.ARCHIVED,
				'urgency': CaseIntakeProcess.Urgency.MEDIUM,
				'complexity': CaseIntakeProcess.Complexity.SIMPLE,
				'care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
				'category': categories[1],
				'age': 11,
				'age_category': CaseIntakeProcess.AgeCategory.CHILDHOOD,
				'family_situation': CaseIntakeProcess.FamilySituation.HOME_DWELLING,
				'problematiek': ['nazorg', 'afgesloten traject'],
				'summary': 'Traject is afgerond, intake is gestart en de casus is gearchiveerd na succesvolle overdracht.',
				'description': 'Deze casus is alleen-lezen en hoort niet meer in de actieve werkvoorraad.',
				'assessment_status': CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
				'matching_ready': True,
				'case_phase': CareCase.CasePhase.AFGEROND,
				'case_status': CareCase.Status.COMPLETED,
				'case_age_days': 26,
				'state_age_hours': 360,
				'deadline_type': Deadline.TaskType.EVALUATE,
				'signal_type': CareSignal.SignalType.DROPOUT_RISK,
				'signal_level': CareSignal.RiskLevel.LOW,
				'document_type': Document.DocType.CONTRACT,
				'placement': {
					'status': PlacementRequest.Status.APPROVED,
					'provider_response_status': PlacementRequest.ProviderResponseStatus.ACCEPTED,
					'provider_index': 1,
					'selected_provider_index': 1,
					'age_hours': 384,
				},
				'match': None,
			},
		]

		created_intakes = []
		for index, spec in enumerate(specs, start=1):
			intake = self._seed_case_scenario(
				org=org,
				users=users,
				providers=providers,
				matching_providers=matching_providers,
				categories=categories,
				spec=spec,
				index=index,
			)
			created_intakes.append(intake)

		return created_intakes

	def _seed_case_scenario(self, *, org, users, providers, matching_providers, categories, spec, index):
		coordinator = spec['coordinator']
		today = date.today()
		now = timezone.now()

		case, _ = CareCase.objects.get_or_create(
			organization=org,
			title=spec['title'],
			defaults={
				'contract_type': self._contract_type_for_case_form(spec['care_form']),
				'content': spec['summary'] or spec['description'] or '',
				'status': spec['case_status'],
				'service_region': spec['region'],
				'risk_level': self._risk_level_for_urgency(spec['urgency']),
				'start_date': today - timedelta(days=spec['case_age_days']),
				'end_date': today + timedelta(days=28),
				'case_phase': spec['case_phase'],
				'phase_entered_at': now - timedelta(hours=spec['state_age_hours']),
				'created_by': coordinator,
			},
		)
		case.contract_type = self._contract_type_for_case_form(spec['care_form'])
		case.content = spec['summary'] or spec['description'] or ''
		case.status = spec['case_status']
		case.service_region = spec['region']
		case.risk_level = self._risk_level_for_urgency(spec['urgency'])
		case.start_date = today - timedelta(days=spec['case_age_days'])
		case.end_date = today + timedelta(days=28)
		case.case_phase = spec['case_phase']
		case.phase_entered_at = now - timedelta(hours=spec['state_age_hours'])
		case.created_by = coordinator
		case.save(
			update_fields=[
				'contract_type',
				'content',
				'status',
				'service_region',
				'risk_level',
				'start_date',
				'end_date',
				'case_phase',
				'phase_entered_at',
				'created_by',
				'updated_at',
			]
		)
		CareCase.objects.filter(pk=case.pk).update(
			created_at=now - timedelta(days=spec['case_age_days']),
			updated_at=now - timedelta(hours=spec['state_age_hours']),
		)

		intake_defaults = {
			'organization': org,
			'title': spec['title'],
			'status': spec['status'],
			'case_coordinator': coordinator,
			'start_date': today - timedelta(days=spec['case_age_days']),
			'target_completion_date': today + timedelta(days=7),
			'urgency': spec['urgency'],
			'complexity': spec['complexity'],
			'preferred_care_form': spec['care_form'],
			'zorgvorm_gewenst': spec['care_form'],
			'preferred_region_type': 'GEMEENTELIJK',
			'preferred_region': None,
			'gemeente': self._municipality_for_name(org, spec['municipality']),
			'care_category_main': spec['category'],
			'client_age_category': spec['age_category'],
			'family_situation': spec['family_situation'],
			'leeftijd': spec['age'],
			'problematiek_types': spec['problematiek'],
			'assessment_summary': spec['summary'],
			'description': spec['description'],
			'urgency_validated': spec['urgency'] in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS},
			'urgency_granted_date': today - timedelta(days=1) if spec['urgency'] in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS} else None,
			'setting_voorkeur': 'open' if spec['care_form'] == CaseIntakeProcess.CareForm.OUTPATIENT else 'besloten',
			'other_support_description': 'Jeugdwerker, wijkteam en onderwijs betrokken.' if spec['title'] != PILOT_CASE_TITLES[1] else '',
			'school_work_status': 'Schoolverzuim en parttime dagstructuur.' if spec['title'] != PILOT_CASE_TITLES[6] else 'Traject afgerond',
			'has_other_support': spec['title'] != PILOT_CASE_TITLES[1],
		}
		intake, created = CaseIntakeProcess.objects.get_or_create(
			contract=case,
			defaults=intake_defaults,
		)
		for field, value in intake_defaults.items():
			setattr(intake, field, value)
		intake.save()
		CaseIntakeProcess.objects.filter(pk=intake.pk).update(
			start_date=today - timedelta(days=spec['case_age_days']),
			target_completion_date=today + timedelta(days=7),
			updated_at=now - timedelta(hours=spec['state_age_hours']),
		)

		if spec['summary'] or spec['description']:
			intake.assessment_summary = spec['summary']
			intake.description = spec['description']
			intake.save(update_fields=['assessment_summary', 'description', 'updated_at'])

		CaseAssessment.objects.filter(due_diligence_process=intake).delete()
		if spec['assessment_status'] is not None:
			assessment = CaseAssessment.objects.create(
				due_diligence_process=intake,
				assessment_status=spec['assessment_status'],
				matching_ready=spec['matching_ready'],
				assessed_by=coordinator,
				notes=spec['summary'],
				reason_not_ready='' if spec['matching_ready'] else 'Aanvullende informatie ontbreekt.',
			)
			CaseAssessment.objects.filter(pk=assessment.pk).update(updated_at=now - timedelta(hours=max(spec['state_age_hours'] - 6, 1)))

		Deadline.objects.filter(due_diligence_process=intake).delete()
		Deadline.objects.create(
			due_diligence_process=intake,
			title=f"{spec['title']} - {spec['deadline_type'].lower().replace('_', ' ')}",
			task_type=spec['deadline_type'],
			priority=Deadline.Priority.URGENT if spec['urgency'] == CaseIntakeProcess.Urgency.CRISIS else Deadline.Priority.HIGH,
			due_date=today + timedelta(days=2 if spec['title'] == PILOT_CASE_TITLES[1] else 5),
			description='Pilot opvolging volgens realistische jeugdregie-afspraak.',
			assigned_to=coordinator,
			created_by=coordinator,
			case_record=case,
		)

		CareSignal.objects.filter(due_diligence_process=intake).delete()
		CareSignal.objects.create(
			due_diligence_process=intake,
			title=f"Signaal - {spec['title']}",
			signal_type=spec['signal_type'],
			description=spec['summary'] or 'Geen samenvatting beschikbaar.',
			risk_level=spec['signal_level'],
			status=CareSignal.SignalStatus.OPEN,
			assigned_to=coordinator,
			follow_up='Monitor in regiekamer en leg vervolgacties vast.',
			case_record=case,
			created_by=coordinator,
		)

		Document.objects.filter(contract=case).delete()
		Document.objects.create(
			organization=org,
			contract=case,
			title=f'Casusmemo - {spec["title"]}',
			document_type=spec['document_type'],
			status=Document.Status.FINAL if spec['status'] == CaseIntakeProcess.ProcessStatus.ARCHIVED else Document.Status.DRAFT,
			description=spec['summary'] or spec['description'] or 'Casusdossier voor pilotregie.',
			uploaded_by=coordinator,
			tags='pilot,jeugdzorg,casus',
		)

		if spec.get('match'):
			match_spec = spec['match']
			provider_bundle = matching_providers[match_spec['provider_index']]
			profile, profile_spec = provider_bundle['profiles'][match_spec['profile_index']]
			MatchResultaat.objects.filter(casus=case).delete()
			match_result = MatchResultaat.objects.create(
				casus=case,
				zorgprofiel=profile,
				zorgaanbieder=provider_bundle['zorgaanbieder'],
				totaalscore=match_spec['score'],
				score_inhoudelijke_fit=max(0.0, min(match_spec['score'] + 0.08, 1.0)),
				score_capaciteit=0.55,
				score_contract_regio=0.80,
				score_complexiteit=0.60,
				score_performance=0.72,
				score_regio_contract_fit=0.82,
				score_capaciteit_wachttijd_fit=0.53,
				score_complexiteit_veiligheid_fit=0.57,
				score_performance_fit=0.69,
				confidence_label=match_spec['label'],
				fit_samenvatting=spec['summary'],
				trade_offs=match_spec['trade_offs'],
				verificatie_advies=match_spec['advies'],
				ranking=1,
			)
			MatchResultaat.objects.filter(pk=match_result.pk).update(created_at=now - timedelta(hours=12))

		PlacementRequest.objects.filter(due_diligence_process=intake).delete()
		if spec.get('placement'):
			placement_spec = spec['placement']
			provider_bundle = matching_providers[placement_spec['provider_index']]
			client_provider = providers[placement_spec['selected_provider_index']]
			placement = PlacementRequest.objects.create(
				due_diligence_process=intake,
				proposed_provider=client_provider,
				selected_provider=client_provider,
				status=placement_spec['status'],
				provider_response_status=placement_spec['provider_response_status'],
				provider_response_reason_code=placement_spec.get('provider_response_reason_code', OutcomeReasonCode.NONE),
				care_form=spec['care_form'],
				decision_notes=spec['summary'],
				start_date=today + timedelta(days=7),
				duration_weeks=12,
			)
			if placement_spec['provider_response_status'] == PlacementRequest.ProviderResponseStatus.PENDING:
				placement.provider_response_requested_at = now - timedelta(hours=placement_spec['age_hours'])
				placement.provider_response_deadline_at = now - timedelta(hours=12)
				placement.save(update_fields=['provider_response_requested_at', 'provider_response_deadline_at', 'updated_at'])
			elif placement_spec['provider_response_status'] == PlacementRequest.ProviderResponseStatus.ACCEPTED:
				placement.provider_response_recorded_at = now - timedelta(hours=placement_spec['age_hours'])
				placement.save(update_fields=['provider_response_recorded_at', 'updated_at'])
			else:
				placement.provider_response_recorded_at = now - timedelta(hours=placement_spec['age_hours'])
				placement.save(update_fields=['provider_response_recorded_at', 'updated_at'])
			PlacementRequest.objects.filter(pk=placement.pk).update(updated_at=now - timedelta(hours=placement_spec['age_hours']))

			if spec['status'] == CaseIntakeProcess.ProcessStatus.ARCHIVED:
				intake.status = CaseIntakeProcess.ProcessStatus.ARCHIVED
				intake.save(update_fields=['status', 'updated_at'])
				case.lifecycle_stage = 'ARCHIVED'
				case.status = CareCase.Status.COMPLETED
				case.case_phase = CareCase.CasePhase.AFGEROND
				case.save(update_fields=['lifecycle_stage', 'status', 'case_phase', 'updated_at'])

		else:
			if spec['status'] == CaseIntakeProcess.ProcessStatus.ARCHIVED:
				intake.status = CaseIntakeProcess.ProcessStatus.ARCHIVED
				intake.save(update_fields=['status', 'updated_at'])
				case.lifecycle_stage = 'ARCHIVED'
				case.status = CareCase.Status.COMPLETED
				case.case_phase = CareCase.CasePhase.AFGEROND
				case.save(update_fields=['lifecycle_stage', 'status', 'case_phase', 'updated_at'])

		return intake

	def _municipality_for_name(self, org, name):
		return MunicipalityConfiguration.objects.get(organization=org, municipality_name=name)

	def _contract_type_for_case_form(self, care_form):
		mapping = {
			CaseIntakeProcess.CareForm.OUTPATIENT: CareCase.ContractType.MSA,
			CaseIntakeProcess.CareForm.DAY_TREATMENT: CareCase.ContractType.SOW,
			CaseIntakeProcess.CareForm.RESIDENTIAL: CareCase.ContractType.LEASE,
			CaseIntakeProcess.CareForm.CRISIS: CareCase.ContractType.NDA,
		}
		return mapping.get(care_form, CareCase.ContractType.OTHER)

	def _risk_level_for_urgency(self, urgency):
		mapping = {
			CaseIntakeProcess.Urgency.LOW: CareCase.RiskLevel.LOW,
			CaseIntakeProcess.Urgency.MEDIUM: CareCase.RiskLevel.MEDIUM,
			CaseIntakeProcess.Urgency.HIGH: CareCase.RiskLevel.HIGH,
			CaseIntakeProcess.Urgency.CRISIS: CareCase.RiskLevel.CRITICAL,
		}
		return mapping.get(urgency, CareCase.RiskLevel.MEDIUM)

	def _ensure_waittimes(self, providers):
		for index, provider in enumerate(providers, start=1):
			TrustAccount.objects.update_or_create(
				provider=provider,
				region='Regio Midden',
				care_type=TrustAccount.CareType.AMBULANT,
				defaults={
					'wait_days': 7 + index * 4,
					'open_slots': max(0, 4 - index),
					'waiting_list_size': index * 3,
					'notes': 'Pilot capaciteitssnapshot',
				},
			)

	def _ensure_budget(self, *, org, user, intakes, municipalities):
		budget, _ = Budget.objects.get_or_create(
			organization=org,
			year=date.today().year,
			scope_type=Budget.ScopeType.GEMEENTE,
			scope_name=municipalities[0].municipality_name,
			target_group='Jeugd 12-18',
			care_type=Budget.CareType.OUTPATIENT,
			defaults={
				'allocated_amount': 150000,
				'description': 'Pilot budget voor ambulante trajecten.',
				'created_by': user,
			},
		)
		budget.linked_cases.set(intakes)

		BudgetExpense.objects.get_or_create(
			budget=budget,
			description='Opstartkosten pilottraject',
			defaults={
				'amount': 12500,
				'category': BudgetExpense.Category.CONSULTING,
				'date': date.today() - timedelta(days=5),
				'created_by': user,
			},
		)
