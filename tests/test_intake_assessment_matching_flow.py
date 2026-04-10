from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CaseAssessment,
    Client as CareProvider,
    DueDiligenceProcess,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
)


class IntakeAssessmentMatchingFlowTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='flow_user',
            email='flow@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Care Team Flow', slug='care-team-flow')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='flow_user', password='testpass123')

    def test_intake_assessment_matching_assignment_flow(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Flow Aanbieder',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=3,
            average_wait_days=10,
        )

        intake = DueDiligenceProcess.objects.create(
            organization=self.organization,
            title='Flow Intake',
            status=DueDiligenceProcess.ProcessStatus.INTAKE,
            urgency=DueDiligenceProcess.Urgency.MEDIUM,
            preferred_care_form=DueDiligenceProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            lead_attorney=self.user,
        )
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        assessment_list_response = self.client.get(reverse('contracts:assessment_list'))
        self.assertEqual(assessment_list_response.status_code, 200)
        self.assertContains(assessment_list_response, 'Flow Intake')

        matching_response = self.client.get(reverse('contracts:matching_dashboard'))
        self.assertEqual(matching_response.status_code, 200)
        self.assertContains(matching_response, 'Flow Intake')
        self.assertContains(matching_response, 'Flow Aanbieder')

        assign_response = self.client.post(
            reverse('contracts:matching_dashboard'),
            {
                'action': 'assign',
                'assessment_id': str(assessment.pk),
                'provider_id': str(provider.pk),
            },
            follow=True,
        )
        self.assertEqual(assign_response.status_code, 200)

        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.selected_provider_id, provider.id)
        self.assertEqual(placement.proposed_provider_id, provider.id)

        intake.refresh_from_db()
        self.assertEqual(intake.status, DueDiligenceProcess.ProcessStatus.MATCHING)
        self.assertContains(assign_response, 'Toegewezen: Flow Aanbieder')

    def test_matching_dashboard_empty_state_without_approved_assessments(self):
        intake = DueDiligenceProcess.objects.create(
            organization=self.organization,
            title='Draft Intake',
            status=DueDiligenceProcess.ProcessStatus.INTAKE,
            urgency=DueDiligenceProcess.Urgency.MEDIUM,
            preferred_care_form=DueDiligenceProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            lead_attorney=self.user,
        )
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.DRAFT,
            matching_ready=False,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('contracts:matching_dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Geen beoordelingen met status "Goedgekeurd voor matching".')
        self.assertNotContains(response, 'Draft Intake')

    def test_matching_dashboard_shows_no_provider_profile_fallback(self):
        intake = DueDiligenceProcess.objects.create(
            organization=self.organization,
            title='Approved Intake Zonder Profiel',
            status=DueDiligenceProcess.ProcessStatus.ASSESSMENT,
            urgency=DueDiligenceProcess.Urgency.MEDIUM,
            preferred_care_form=DueDiligenceProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            lead_attorney=self.user,
        )
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('contracts:matching_dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Approved Intake Zonder Profiel')
        self.assertContains(response, 'Geen providers met profieldata beschikbaar voor deze beoordeling.')
