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

    def test_dashboard_primary_focus(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Deze casus is geblokkeerd')
        self.assertContains(response, 'Start beoordeling')
        self.assertContains(response, 'Andere actieve casussen')
        self.assertContains(response, 'Beoordeling ontbreekt')
        self.assertContains(response, 'Wachttijd: 2 dagen')

    def test_dashboard_container_constraint(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'max-width: 1440px')

    def test_dashboard_top_bar(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="global-search-input"')
        self.assertContains(response, 'Zoek casus, client, document of actie')
        self.assertNotContains(response, 'header-org-chip')
        self.assertContains(response, 'title="Thema wisselen"')
        self.assertContains(response, 'title="Meldingen"')
        self.assertContains(response, 'Nieuwe casus')
        self.assertContains(response, 'Uitloggen')

    def test_dashboard_panels(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Welkom terug')
        self.assertContains(response, 'Operationele signalen')
        self.assertContains(response, 'Casussen zonder match')
        self.assertContains(response, 'Wachttijd overschreden')
        self.assertContains(response, 'Beoordeling ontbreekt')
        self.assertContains(response, 'Urgente casussen')
        self.assertContains(response, 'Blokkerende casus')
        self.assertContains(response, 'Andere actieve casussen')
        self.assertContains(response, 'Actieve casus')
        self.assertContains(response, 'Kerngegevens')
        self.assertContains(response, 'Tijdlijn')
        self.assertContains(response, 'Knelpunten')
        self.assertContains(response, 'Capaciteitssignalen')
        self.assertContains(response, 'Laatst bijgewerkt')

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

        response = self.client.get(reverse('careon:case_list'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casussen')
        self.assertContains(response, 'Zoek op titel of casus-ID...')
        self.assertContains(response, 'Nieuwe casus')

    def test_accessibility_features(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'aria-label="Globaal zoeken"')
        self.assertContains(response, 'title="Thema wisselen"')
        self.assertContains(response, 'type="submit"')

    def test_typography_and_spacing(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'command-grid')
        self.assertContains(response, 'decision-alert-strip')
        self.assertContains(response, 'decision-alert-card')
        self.assertContains(response, 'decision-focus-panel')
        self.assertContains(response, 'decision-rail-column')
        self.assertContains(response, 'decision-rail-card')
        self.assertContains(response, 'ds-insight-section')
        self.assertContains(response, 'ds-insight-head')
        self.assertContains(response, 'queue-row')

    def tearDown(self):
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']
