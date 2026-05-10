from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    Client,
    Deadline,
    MatchResultaat,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    UserProfile,
)
from contracts.pilot_universe import PILOT_LOCK_ANCHOR
from contracts.workflow_state_machine import WorkflowAction, WorkflowRole, can_role_execute_action, resolve_actor_role

from contracts.management.commands.seed_demo_data import CASE_TITLES, DEMO_EMAIL, DEMO_ORG_SLUG


User = get_user_model()


class SeedDemoDataTests(TestCase):
    def setUp(self):
        call_command('seed_demo_data', reset=True, verbosity=0)

    def test_demo_account_is_gemeente_only(self):
        organization = Organization.objects.get(slug=DEMO_ORG_SLUG)
        user = User.objects.get(username=DEMO_EMAIL)
        membership = OrganizationMembership.objects.get(organization=organization, user=user)
        profile = UserProfile.objects.get(user=user)

        self.assertEqual(membership.role, OrganizationMembership.Role.MEMBER)
        self.assertEqual(profile.role, UserProfile.Role.ASSOCIATE)
        self.assertEqual(resolve_actor_role(user=user, organization=organization), WorkflowRole.GEMEENTE)
        self.assertTrue(can_role_execute_action(WorkflowRole.GEMEENTE, WorkflowAction.VALIDATE_MATCHING))
        self.assertFalse(can_role_execute_action(WorkflowRole.GEMEENTE, WorkflowAction.PROVIDER_ACCEPT))
        self.assertFalse(can_role_execute_action(WorkflowRole.GEMEENTE, WorkflowAction.START_INTAKE))

    def test_demo_cases_and_providers_are_seeded(self):
        organization = Organization.objects.get(slug=DEMO_ORG_SLUG)

        self.assertEqual(Client.objects.filter(organization=organization, provider_profile__isnull=False).count(), 3)
        self.assertEqual(CaseIntakeProcess.objects.filter(organization=organization).count(), 12)

        case_map = {case.title: case for case in CaseIntakeProcess.objects.filter(organization=organization)}
        self.assertEqual(case_map[CASE_TITLES[0]].workflow_state, CaseIntakeProcess.WorkflowState.DRAFT_CASE)
        self.assertEqual(case_map[CASE_TITLES[1]].workflow_state, CaseIntakeProcess.WorkflowState.MATCHING_READY)
        self.assertEqual(case_map[CASE_TITLES[2]].workflow_state, CaseIntakeProcess.WorkflowState.PROVIDER_REVIEW_PENDING)
        self.assertEqual(case_map[CASE_TITLES[3]].workflow_state, CaseIntakeProcess.WorkflowState.PROVIDER_REJECTED)
        self.assertEqual(case_map[CASE_TITLES[4]].workflow_state, CaseIntakeProcess.WorkflowState.SUMMARY_READY)

        self.assertFalse(CaseAssessment.objects.filter(due_diligence_process=case_map[CASE_TITLES[0]]).exists())
        self.assertTrue(CaseAssessment.objects.filter(due_diligence_process=case_map[CASE_TITLES[1]], matching_ready=True).exists())
        self.assertTrue(
            PlacementRequest.objects.filter(
                due_diligence_process=case_map[CASE_TITLES[2]],
                provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            ).exists()
        )
        self.assertTrue(
            PlacementRequest.objects.filter(
                due_diligence_process=case_map[CASE_TITLES[3]],
                provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
            ).exists()
        )

    def test_seeded_match_results_point_to_expected_top_candidates(self):
        organization = Organization.objects.get(slug=DEMO_ORG_SLUG)
        expected_top_candidates = {
            CASE_TITLES[1]: 'Kompas Zorg',
            CASE_TITLES[2]: 'Groei & Co',
            CASE_TITLES[3]: 'Horizon Jeugdzorg',
        }

        for title, expected_provider in expected_top_candidates.items():
            with self.subTest(title=title):
                intake = CaseIntakeProcess.objects.get(organization=organization, title=title)
                match = MatchResultaat.objects.get(casus=intake.case_record)
                self.assertEqual(match.zorgaanbieder.name, expected_provider)
                self.assertGreaterEqual(match.totaalscore, 79)

    def test_matching_candidates_api_is_safe_for_demo_account(self):
        organization = Organization.objects.get(slug=DEMO_ORG_SLUG)
        user = User.objects.get(username=DEMO_EMAIL)
        intake = CaseIntakeProcess.objects.get(organization=organization, title=CASE_TITLES[1])
        match = MatchResultaat.objects.get(casus=intake.case_record)

        self.client.force_login(user)
        response = self.client.get(reverse('careon:matching_candidates_api', kwargs={'case_id': intake.contract_id}))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertGreaterEqual(payload['count'], 1)
        self.assertEqual(payload['matches'][0]['zorgaanbieder_id'], match.zorgaanbieder_id)

    def test_locked_seed_sets_deadline_dates_from_pilot_anchor(self):
        call_command('seed_demo_data', reset=True, locked_time=True, verbosity=0)
        organization = Organization.objects.get(slug=DEMO_ORG_SLUG)
        intake = CaseIntakeProcess.objects.get(organization=organization, title=CASE_TITLES[1])
        deadline = Deadline.objects.filter(due_diligence_process=intake).first()
        self.assertIsNotNone(deadline)
        expected = PILOT_LOCK_ANCHOR.date() + timedelta(days=2)
        self.assertEqual(deadline.due_date, expected)
