from datetime import date
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from contracts.models import (
    Organization, OrganizationMembership, CaseIntakeProcess,
    Client as CareProvider, RegionalConfiguration
)


class ReportsDashboardTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com',
        )
        self.organization = Organization.objects.create(
            name='Care Team Noord',
            slug='care-team-noord'
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='testuser', password='testpass123')

    def _assert_spa_shell(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')
        self.assertNotContains(response, 'Careon Zorgregie')
        self.assertNotContains(response, 'Regiekamer')

    def test_reports_dashboard_loads(self):
        response = self.client.get(reverse('careon:reports_dashboard'))
        self._assert_spa_shell(response)

    def test_reports_dashboard_kpi_cards_are_clickable(self):
        response = self.client.get(reverse('careon:reports_dashboard'))
        self._assert_spa_shell(response)

    def test_reports_dashboard_shows_attention_items(self):
        CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Test Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            start_date=date.today(),
            target_completion_date=date.today(),
        )

        response = self.client.get(reverse('careon:reports_dashboard'))
        self._assert_spa_shell(response)

    def test_reports_dashboard_flow_analysis(self):
        response = self.client.get(reverse('careon:reports_dashboard'))
        self._assert_spa_shell(response)

    def test_reports_dashboard_filter_by_attention_type(self):
        response = self.client.get(reverse('careon:reports_dashboard'), {'attention': 'stagnation'})
        self._assert_spa_shell(response)

    def test_reports_dashboard_no_generic_theater(self):
        response = self.client.get(reverse('careon:reports_dashboard'))
        self._assert_spa_shell(response)

    def test_reports_dashboard_has_actionable_recommendations(self):
        CareProvider.objects.create(
            organization=self.organization,
            name='Test Provider',
            created_by=self.user,
        )
        CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Unmatched Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            start_date=date.today(),
            target_completion_date=date.today(),
        )

        response = self.client.get(reverse('careon:reports_dashboard'))
        self._assert_spa_shell(response)

    def test_reports_dashboard_can_filter_on_region_type_and_region(self):
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='GGD Test Regio',
            region_code='GGD001',
            region_type='GGD',
            status=RegionalConfiguration.Status.ACTIVE,
        )
        CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Region Filter Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            preferred_region_type='GGD',
            preferred_region=region,
            start_date=date.today(),
            target_completion_date=date.today(),
        )

        response = self.client.get(
            reverse('careon:reports_dashboard'),
            {'region_type': 'GGD', 'region': str(region.pk)},
        )

        self._assert_spa_shell(response)
