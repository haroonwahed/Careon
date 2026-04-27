from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    UserProfile,
)


User = get_user_model()


class WorkflowFoundationLockTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.organization = Organization.objects.create(name='Workflow Lock Org', slug='workflow-lock-org')

        self.gemeente_user = User.objects.create_user(
            username='gemeente_user',
            email='gemeente@example.com',
            password='testpass123',
        )
        self.provider_user = User.objects.create_user(
            username='provider_user',
            email='provider@example.com',
            password='testpass123',
        )
        self.admin_user = User.objects.create_user(
            username='admin_user',
            email='admin@example.com',
            password='testpass123',
        )

        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.gemeente_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.provider_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.admin_user,
            role=OrganizationMembership.Role.ADMIN,
            is_active=True,
        )

        UserProfile.objects.create(user=self.gemeente_user, role=UserProfile.Role.ASSOCIATE)
        UserProfile.objects.create(user=self.provider_user, role=UserProfile.Role.CLIENT)
        UserProfile.objects.create(user=self.admin_user, role=UserProfile.Role.ADMIN)

        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Provider One',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
        )

    def _create_matching_ready_case(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Workflow Lock Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=10),
            case_coordinator=self.gemeente_user,
        )
        case_record = intake.ensure_case_record(created_by=self.gemeente_user)
        case_record.case_phase = CareCase.CasePhase.MATCHING
        case_record.save(update_fields=['case_phase', 'updated_at'])

        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.gemeente_user,
        )
        return intake

    def test_provider_cannot_create_case_via_intake_create_api(self):
        self.client.login(username='provider_user', password='testpass123')

        response = self.client.post(
            reverse('careon:intake_create_api'),
            data='{}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_provider_decision_requires_provider_role(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.pk}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_bulk_update_rejects_workflow_fields(self):
        intake = self._create_matching_ready_case()

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:cases_bulk_update_api'),
            data=f'{{"case_ids":[{intake.case_record.pk}],"updates":{{"case_phase":"provider_beoordeling"}}}}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload.get('success'), False)
        self.assertIn('case_phase', payload.get('blocked_fields', []))

    def test_intake_start_blocked_before_placement_confirmation(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='provider_user', password='testpass123')
        response = self.client.post(
            reverse('careon:intake_action_api', kwargs={'case_id': intake.pk}),
            data='{}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Ongeldige workflow-overgang', response.json().get('error', ''))

    def test_canonical_progression_logs_state_transitions(self):
        intake = self._create_matching_ready_case()

        self.client.login(username='gemeente_user', password='testpass123')
        assign_response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.pk}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(assign_response.status_code, 200)

        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        provider_response = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.pk}),
            data='{"status":"ACCEPTED","provider_comment":"Capaciteit beschikbaar"}',
            content_type='application/json',
        )
        self.assertEqual(provider_response.status_code, 200)

        self.client.logout()
        self.client.login(username='gemeente_user', password='testpass123')
        placement_response = self.client.post(
            reverse('careon:placement_action_api', kwargs={'case_id': intake.pk}),
            data='{"status":"APPROVED","note":"Plaatsing bevestigd"}',
            content_type='application/json',
        )
        self.assertEqual(placement_response.status_code, 200)

        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        intake_response = self.client.post(
            reverse('careon:intake_action_api', kwargs={'case_id': intake.pk}),
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(intake_response.status_code, 200)

        intake.refresh_from_db()
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.COMPLETED)
        self.assertEqual(intake.case_record.case_phase, CareCase.CasePhase.ACTIEF)

        transition_events = CaseDecisionLog.objects.filter(
            case_id=intake.pk,
            event_type=CaseDecisionLog.EventType.STATE_TRANSITION,
        )
        actions = list(transition_events.values_list('user_action', flat=True))

        self.assertIn('validate_matching', actions)
        self.assertIn('send_to_provider', actions)
        self.assertIn('provider_accept', actions)
        self.assertIn('confirm_placement', actions)
        self.assertIn('start_intake', actions)

    def test_org_admin_cannot_record_provider_decision_via_api(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='admin_user', password='testpass123')
        response = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.pk}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_org_admin_cannot_start_intake_via_api_after_placement_confirmed(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.pk}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.pk}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:placement_action_api', kwargs={'case_id': intake.pk}),
            data='{"status":"APPROVED","note":"OK"}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='admin_user', password='testpass123')
        response = self.client.post(
            reverse('careon:intake_action_api', kwargs={'case_id': intake.pk}),
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_provider_cannot_assign_via_matching_action_api(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.pk}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
