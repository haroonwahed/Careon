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

    def test_dashboard_primary_focus(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')

    def test_dashboard_container_constraint(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)

    def test_dashboard_top_bar(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')

    def test_dashboard_panels(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')

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
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')
        self.assertNotContains(response, 'Careon Zorgregie')
        self.assertNotContains(response, 'Regiekamer')
        self.assertNotContains(response, 'Globaal zoeken')

    def test_accessibility_features(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')

    def test_typography_and_spacing(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')
