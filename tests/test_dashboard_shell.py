import os
from datetime import date

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import CareConfiguration, CareSignal, Client as CareProvider, Organization, OrganizationMembership
from contracts.regiekamer_service import build_regiekamer_summary


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

    def test_dashboard_returns_spa_shell(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<!DOCTYPE html>')
        self.assertContains(response, '<div id="root"></div>', html=False)
        self.assertContains(response, '<title>SaaS Careon</title>', html=False)

    def test_dashboard_spa_shell_includes_mount_styles(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '#root { height: 100%; }', html=False)

    def test_dashboard_spa_shell_uses_module_bundle_or_fallback_shell(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode('utf-8')
        self.assertIn('<div id="root"></div>', content)
        self.assertTrue(
            ('<script type="module"' in content) or ('<style>html, body { height: 100%; margin: 0; } #root { height: 100%; }</style>' in content)
        )

    def test_dashboard_is_not_server_rendered_regiekamer_template(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'command-grid')
        self.assertNotContains(response, 'decision-alert-strip')
        self.assertNotContains(response, 'decision-focus-panel')

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

    def test_regiekamer_service_remains_available_independently(self):
        summary = build_regiekamer_summary(
            org=self.organization,
            active_intakes=[],
            signals_qs=CareSignal.objects.none(),
            selected_case_id=None,
            today=date.today(),
        )
        self.assertIn('regiekamer_kpis', summary)
        self.assertIn('recommended_action', summary)
        self.assertIn('priority_queue', summary)
        self.assertIn('command_bar', summary)

    def tearDown(self):
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']
