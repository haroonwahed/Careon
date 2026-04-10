import os

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import CareConfiguration, Client as CareProvider, Organization, OrganizationMembership


class DashboardShellTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com',
        )
        self.organization = Organization.objects.create(name='Care Team Noord', slug='care-team-noord')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='testuser', password='testpass123')
        os.environ['FEATURE_REDESIGN'] = 'true'

    def test_dashboard_kpi_cards(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Urgente casussen')
        self.assertContains(response, 'Casussen zonder match')
        self.assertContains(response, 'Casussen in intakefase')
        self.assertContains(response, 'Gem. doorlooptijd intake')
        self.assertContains(response, 'kpi-card')

    def test_dashboard_container_constraint(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'max-width: 1400px')

    def test_dashboard_top_bar(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'title="Search"')
        self.assertContains(response, 'title="Thema wisselen"')
        self.assertContains(response, 'title="Meldingen"')
        self.assertContains(response, 'Nieuwe casus')
        self.assertContains(response, 'Uitloggen')

    def test_dashboard_panels(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Actie vereist')
        self.assertContains(response, 'Match aanbevelingen open')
        self.assertContains(response, 'Regie-activiteit')
        self.assertContains(response, 'Regie snapshot')

    def test_case_list_alias_uses_configuration_shell(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='ZorgPlus Noord',
            created_by=self.user,
        )
        CareConfiguration.objects.create(
            organization=self.organization,
            matter_number='CFG-DASH-1',
            title='Test Configuration',
            client=provider,
            created_by=self.user,
        )

        response = self.client.get(reverse('contracts:case_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Zorgintakes')
        self.assertContains(response, 'Zoek intakes op titel, casus-ID...')
        self.assertContains(response, 'Nieuwe intake')

    def test_accessibility_features(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'title="Search"')
        self.assertContains(response, 'title="Thema wisselen"')
        self.assertContains(response, 'type="submit"')

    def test_typography_and_spacing(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "font-family: 'Inter'")
        self.assertContains(response, 'dash-grid')
        self.assertContains(response, 'gap: 20px')

    def tearDown(self):
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']