import os

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    ProviderProfile,
)


class MatchingRecommendationsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='match_user',
            email='match@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Care Team Matching', slug='care-team-matching')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='match_user', password='testpass123')
        os.environ['FEATURE_REDESIGN'] = 'true'

    def tearDown(self):
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']

    def test_matching_panel_shows_score_wait_capacity_reason(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Aanbieder Noord',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=4,
            average_wait_days=12,
        )

        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Intake Matching Test',
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date='2026-04-10',
            target_completion_date='2026-04-20',
            case_coordinator=self.user,
        )
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Matchscore')
        self.assertContains(response, 'Wachttijd')
        self.assertContains(response, 'Capaciteit')
        self.assertContains(response, 'Matching')
        self.assertContains(response, 'Wijs toe')
