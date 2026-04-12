from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from contracts.models import (
	Budget,
	BudgetExpense,
	CareCase,
	CareCategoryMain,
	CareSignal,
	CaseAssessment,
	CaseIntakeProcess,
	Client,
	Deadline,
	Document,
	MunicipalityConfiguration,
	Organization,
	OrganizationMembership,
	PlacementRequest,
	ProviderProfile,
	RegionalConfiguration,
	TrustAccount,
)


User = get_user_model()


class Command(BaseCommand):
	help = 'Seed coherent pilot/demo data for the care workflow (casus -> intake -> beoordeling -> matching -> plaatsing).'

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
		municipalities, region = self._ensure_network_configuration(org=org, user=owner, categories=categories, providers=providers)

		intakes = self._ensure_cases_and_flow(org=org, users=(owner, admin, member), providers=providers, categories=categories)
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
			CareCase.objects.filter(organization=org, title__startswith='Pilot Casus').delete()
			MunicipalityConfiguration.objects.filter(organization=org, municipality_code__startswith='PILOT-').delete()
			RegionalConfiguration.objects.filter(organization=org, region_code__startswith='PILOT-').delete()
			Client.objects.filter(organization=org, name__startswith='Pilot Aanbieder').delete()

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

	def _ensure_providers(self, *, org, users, categories):
		owner, admin, member = users
		provider_specs = [
			('Pilot Aanbieder Noord', owner, 12, 5, True),
			('Pilot Aanbieder Midden', admin, 18, 2, False),
			('Pilot Aanbieder Crisis', member, 4, 1, True),
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

	def _ensure_cases_and_flow(self, *, org, users, providers, categories):
		owner, admin, member = users
		specs = [
			('Pilot Casus Intake', owner, CaseIntakeProcess.ProcessStatus.INTAKE, CaseAssessment.AssessmentStatus.DRAFT, None),
			('Pilot Casus Matching', admin, CaseIntakeProcess.ProcessStatus.MATCHING, CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING, PlacementRequest.Status.IN_REVIEW),
			('Pilot Casus Plaatsing', member, CaseIntakeProcess.ProcessStatus.DECISION, CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING, PlacementRequest.Status.APPROVED),
		]
		created_intakes = []
		for index, (title, coordinator, flow_status, assessment_status, placement_status) in enumerate(specs, start=1):
			case, _ = CareCase.objects.get_or_create(
				organization=org,
				title=title,
				defaults={
					'contract_type': 'NDA',
					'status': CareCase.Status.ACTIVE,
					'created_by': coordinator,
				},
			)

			intake, _ = CaseIntakeProcess.objects.get_or_create(
				organization=org,
				contract=case,
				defaults={
					'title': title,
					'status': flow_status,
					'case_coordinator': coordinator,
					'start_date': date.today() - timedelta(days=10 + index),
					'target_completion_date': date.today() + timedelta(days=7),
					'urgency': CaseIntakeProcess.Urgency.HIGH if index == 3 else CaseIntakeProcess.Urgency.MEDIUM,
					'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
					'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
					'care_category_main': categories[index % len(categories)],
					'assessment_summary': 'Pilot intake met realistische hulpvraag en vervolgacties.',
					'description': 'Gegenereerd voor pilotvalidatie.',
				},
			)
			created_intakes.append(intake)

			CaseAssessment.objects.update_or_create(
				due_diligence_process=intake,
				defaults={
					'assessment_status': assessment_status,
					'matching_ready': assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
					'assessed_by': coordinator,
					'notes': 'Pilot beoordeling voor matchingvalidatie.',
				},
			)

			Deadline.objects.get_or_create(
				due_diligence_process=intake,
				title=f'Pilot opvolgtaak {index}',
				defaults={
					'task_type': Deadline.TaskType.CONTACT_PROVIDER,
					'priority': Deadline.Priority.HIGH,
					'description': 'Neem contact op met aanbieder en stem startdatum af.',
					'due_date': date.today() + timedelta(days=index),
					'assigned_to': coordinator,
					'created_by': coordinator,
					'case_record': case,
				},
			)

			CareSignal.objects.get_or_create(
				due_diligence_process=intake,
				description=f'Pilot signaal {index}',
				defaults={
					'signal_type': CareSignal.SignalType.CAPACITY_ISSUE if index == 2 else CareSignal.SignalType.SAFETY,
					'risk_level': CareSignal.RiskLevel.HIGH if index == 3 else CareSignal.RiskLevel.MEDIUM,
					'status': CareSignal.SignalStatus.OPEN,
					'assigned_to': coordinator,
					'follow_up': 'Monitor capaciteit en terugkoppeling met regie.',
					'created_by': coordinator,
					'case_record': case,
				},
			)

			Document.objects.get_or_create(
				contract=case,
				title=f'Pilot document {index}',
				defaults={
					'organization': org,
					'document_type': Document.DocType.MEMO,
					'status': Document.Status.DRAFT,
					'description': 'Pilot memo voor overdracht en afstemming.',
					'uploaded_by': coordinator,
					'tags': 'pilot,casus',
				},
			)

			if placement_status:
				PlacementRequest.objects.update_or_create(
					due_diligence_process=intake,
					defaults={
						'status': placement_status,
						'proposed_provider': providers[index % len(providers)],
						'selected_provider': providers[index % len(providers)],
						'care_form': intake.preferred_care_form,
						'decision_notes': 'Pilot plaatsingsbesluit.',
						'start_date': date.today() + timedelta(days=14),
						'duration_weeks': 12,
					},
				)

		return created_intakes

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
