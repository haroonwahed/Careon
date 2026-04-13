
import os

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse


class RedesignLayoutTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )
        os.environ['FEATURE_REDESIGN'] = 'true'
        self.client.login(username='testuser', password='testpass123')

    def test_base_shell_and_theme_controls(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Careon')
        self.assertContains(response, 'zorgregie-design-system.css')
        self.assertContains(response, 'toggleTheme()')
        self.assertContains(response, 'title="Search"')

    def test_sidebar_navigation_sections_and_links(self):
        response = self.client.get(reverse('dashboard'))
        self.assertContains(response, 'CASUSMANAGEMENT')
        self.assertContains(response, 'Casussen')
        self.assertContains(response, 'Dashboard')
        self.assertContains(response, 'Casussen')
        self.assertContains(response, 'Taken')
        self.assertContains(response, 'Matching')

    def test_topbar_actions(self):
        response = self.client.get(reverse('dashboard'))
        self.assertContains(response, 'title="Meldingen"')
        self.assertContains(response, 'Nieuwe casus')
        self.assertContains(response, 'Uitloggen')
        self.assertContains(response, '/care/casussen/new/')

    def test_dashboard_kpis_and_panels(self):
        response = self.client.get(reverse('dashboard'))
        self.assertContains(response, 'Urgente casussen')
        self.assertContains(response, 'Zonder match')
        self.assertContains(response, 'Systeemoverzicht')
        self.assertContains(response, 'Knelpuntfocus')
        self.assertContains(response, 'Signalen')
        self.assertContains(response, 'Systeemstatus')

    def test_dashboard_quick_actions(self):
        response = self.client.get(reverse('dashboard'))
        self.assertContains(response, 'Nieuwe casus')
        self.assertContains(response, 'Start matching')
        self.assertContains(response, 'Bekijk capaciteit')
        self.assertContains(response, 'Plan overleg')

    def tearDown(self):
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']
