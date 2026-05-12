"""Zorg OS v1.2 — budgetcontrole, wijkteam-instroom, doorstroom (API + workflow)."""

import json
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.care_lifecycle_v12 import placement_budget_blocks_confirmation, care_form_requires_budget_review
from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderCareTransitionRequest,
    UserProfile,
)
from contracts.workflow_state_machine import WorkflowState

User = get_user_model()


class GovernanceV12BudgetGateTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name='V12 Org', slug='v12-org')
        self.gemeente = User.objects.create_user(username='v12_gemeente', password='pw-v12')
        self.provider = User.objects.create_user(username='v12_provider', password='pw-v12')
        OrganizationMembership.objects.create(organization=self.org, user=self.gemeente, role=OrganizationMembership.Role.MEMBER, is_active=True)
        OrganizationMembership.objects.create(organization=self.org, user=self.provider, role=OrganizationMembership.Role.MEMBER, is_active=True)
        UserProfile.objects.update_or_create(user=self.gemeente, defaults={'role': UserProfile.Role.ASSOCIATE})
        UserProfile.objects.update_or_create(user=self.provider, defaults={'role': UserProfile.Role.CLIENT})
        self.care_provider = CareProvider.objects.create(
            organization=self.org,
            name='V12 Zorgaanbieder',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente,
        )
        self.care_provider.responsible_coordinator = self.provider
        self.care_provider.save(update_fields=['responsible_coordinator', 'updated_at'])

    def _matching_intake(self, *, care_form: str = CaseIntakeProcess.CareForm.RESIDENTIAL):
        intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='V12 Budget Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=care_form,
            zorgvorm_gewenst=care_form,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=14),
            case_coordinator=self.gemeente,
            workflow_state=WorkflowState.PROVIDER_REVIEW_PENDING,
        )
        intake.ensure_case_record(created_by=self.gemeente)
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.gemeente,
            workflow_summary={
                'context': 'x' * 30,
                'urgency': 'MEDIUM',
                'risks': [],
                'missing_information': '',
                'risks_none_ack': False,
            },
        )
        return intake

    def test_residential_requires_budget_review_flag(self):
        self.assertTrue(care_form_requires_budget_review('RESIDENTIAL'))
        self.assertFalse(care_form_requires_budget_review('LOW_THRESHOLD_CONSULT'))

    def test_placement_confirm_blocked_until_budget_approved(self):
        intake = self._matching_intake()
        placement = PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.care_provider,
            selected_provider=self.care_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            care_form=PlacementRequest.CareForm.RESIDENTIAL,
            budget_review_status=PlacementRequest.BudgetReviewStatus.PENDING,
        )
        blocked, msg = placement_budget_blocks_confirmation(placement)
        self.assertTrue(blocked)
        self.assertIn('Budgetverzoek', msg)

        allowed, reason = placement.can_transition_to_status(PlacementRequest.Status.APPROVED)
        self.assertFalse(allowed)
        self.assertIn('Budgetverzoek', reason)

        placement.budget_review_status = PlacementRequest.BudgetReviewStatus.APPROVED
        placement.save(update_fields=['budget_review_status', 'updated_at'])
        allowed2, _ = placement.can_transition_to_status(PlacementRequest.Status.APPROVED)
        self.assertTrue(allowed2)

    def test_provider_accept_sets_budget_pending_for_residential(self):
        intake = self._matching_intake()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.care_provider,
            selected_provider=self.care_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.RESIDENTIAL,
        )
        self.client.login(username='v12_provider', password='pw-v12')
        case = intake.case_record
        resp = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': case.pk}),
            data=json.dumps({'status': 'ACCEPTED', 'provider_comment': 'Akkoord'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        body = json.loads(resp.content.decode())
        self.assertTrue(body.get('ok'))
        intake.refresh_from_db()
        self.assertEqual(intake.workflow_state, WorkflowState.BUDGET_REVIEW_PENDING)

    def test_ambulant_accept_skips_budget_pending(self):
        intake = self._matching_intake(care_form=CaseIntakeProcess.CareForm.AMBULANT_SUPPORT)
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.care_provider,
            selected_provider=self.care_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.AMBULANT_SUPPORT,
        )
        self.client.login(username='v12_provider', password='pw-v12')
        case = intake.case_record
        resp = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': case.pk}),
            data=json.dumps({'status': 'ACCEPTED'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        intake.refresh_from_db()
        self.assertEqual(intake.workflow_state, WorkflowState.PROVIDER_ACCEPTED)


class GovernanceV12WijkteamTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name='V12 Wijkteam Org', slug='v12-wijkteam')
        self.user = User.objects.create_user(username='v12_wijkteam_u', password='pw-v12')
        OrganizationMembership.objects.create(organization=self.org, user=self.user, role=OrganizationMembership.Role.MEMBER, is_active=True)
        UserProfile.objects.update_or_create(user=self.user, defaults={'role': UserProfile.Role.ASSOCIATE})

    def test_intake_create_wijkteam_sets_workflow(self):
        self.client.login(username='v12_wijkteam_u', password='pw-v12')
        payload = {
            'title': 'Familie Jansen',
            'start_date': str(date.today()),
            'target_completion_date': str(date.today() + timedelta(days=30)),
            'urgency': CaseIntakeProcess.Urgency.MEDIUM,
            'complexity': CaseIntakeProcess.Complexity.SIMPLE,
            'preferred_care_form': CaseIntakeProcess.CareForm.LOW_THRESHOLD_CONSULT,
            'preferred_region_type': 'GEMEENTELIJK',
            'entry_route': 'WIJKTEAM',
            'case_coordinator': self.user.pk,
        }
        resp = self.client.post(
            reverse('careon:intake_create_api'),
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        intake = CaseIntakeProcess.objects.order_by('-id').first()
        self.assertIsNotNone(intake)
        self.assertEqual(intake.entry_route, CaseIntakeProcess.EntryRoute.WIJKTEAM)
        self.assertEqual(intake.workflow_state, WorkflowState.WIJKTEAM_INTAKE)
        self.assertEqual(intake.aanmelder_actor_profile, CaseIntakeProcess.AanmelderActorProfile.WIJKTEAM)


class GovernanceV12BudgetRejectRematchTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name='V12 BR Org', slug='v12-br')
        self.gemeente = User.objects.create_user(username='v12_br_g', password='pw-v12')
        self.provider = User.objects.create_user(username='v12_br_p', password='pw-v12')
        OrganizationMembership.objects.create(organization=self.org, user=self.gemeente, role=OrganizationMembership.Role.MEMBER, is_active=True)
        OrganizationMembership.objects.create(organization=self.org, user=self.provider, role=OrganizationMembership.Role.MEMBER, is_active=True)
        UserProfile.objects.update_or_create(user=self.gemeente, defaults={'role': UserProfile.Role.ASSOCIATE})
        UserProfile.objects.update_or_create(user=self.provider, defaults={'role': UserProfile.Role.CLIENT})
        self.care_provider = CareProvider.objects.create(
            organization=self.org,
            name='V12 BR Aanbieder',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente,
        )
        self.care_provider.responsible_coordinator = self.provider
        self.care_provider.save(update_fields=['responsible_coordinator', 'updated_at'])

    def test_budget_reject_returns_matching_and_enables_rematch(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='BR reject',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.RESIDENTIAL,
            zorgvorm_gewenst=CaseIntakeProcess.CareForm.RESIDENTIAL,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=10),
            case_coordinator=self.gemeente,
            workflow_state=WorkflowState.BUDGET_REVIEW_PENDING,
        )
        case = intake.ensure_case_record(created_by=self.gemeente)
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.gemeente,
            workflow_summary={'context': 'x' * 30, 'urgency': 'MEDIUM', 'risks': [], 'missing_information': '', 'risks_none_ack': False},
        )
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.care_provider,
            selected_provider=self.care_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            care_form=PlacementRequest.CareForm.RESIDENTIAL,
            budget_review_status=PlacementRequest.BudgetReviewStatus.PENDING,
        )
        self.client.login(username='v12_br_g', password='pw-v12')
        resp = self.client.post(
            reverse('careon:placement_budget_decision_api', kwargs={'case_id': case.pk}),
            data=json.dumps({'decision': 'REJECTED', 'note': 'Onvoldoende onderbouwing'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        intake.refresh_from_db()
        self.assertEqual(intake.workflow_state, WorkflowState.MATCHING_READY)
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.MATCHING)
        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertIn('[BUDGET_REJECT_REMATCH]', placement.decision_notes or '')


class GovernanceV12TransitionFinancialTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name='V12 Tr Org', slug='v12-tr')
        self.gemeente = User.objects.create_user(username='v12_tr_g', password='pw-v12')
        self.provider = User.objects.create_user(username='v12_tr_p', password='pw-v12')
        OrganizationMembership.objects.create(organization=self.org, user=self.gemeente, role=OrganizationMembership.Role.MEMBER, is_active=True)
        OrganizationMembership.objects.create(organization=self.org, user=self.provider, role=OrganizationMembership.Role.MEMBER, is_active=True)
        UserProfile.objects.update_or_create(user=self.gemeente, defaults={'role': UserProfile.Role.ASSOCIATE})
        UserProfile.objects.update_or_create(user=self.provider, defaults={'role': UserProfile.Role.CLIENT})

    def test_transition_financial_approval_closes_request(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='TR case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=10),
            case_coordinator=self.gemeente,
        )
        case = intake.ensure_case_record(created_by=self.gemeente)
        tr = ProviderCareTransitionRequest.objects.create(
            due_diligence_process=intake,
            proposed_care_form='RESIDENTIAL',
            reason='Doorstroom',
            urgency='HIGH',
            estimated_financial_impact='€ 12k/jaar',
            supporting_explanation='Onderbouwing',
            created_by=self.provider,
        )
        self.client.login(username='v12_tr_g', password='pw-v12')
        url = reverse(
            'careon:transition_request_financial_api',
            kwargs={'case_id': case.pk, 'transition_id': tr.pk},
        )
        resp = self.client.post(
            url,
            data=json.dumps({'decision': 'APPROVED', 'note': 'Doorstroom financieel akkoord'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200)
        tr.refresh_from_db()
        self.assertEqual(tr.financial_validation_status, ProviderCareTransitionRequest.FinancialValidationStatus.APPROVED)
        self.assertEqual(tr.status, ProviderCareTransitionRequest.Status.CLOSED)
