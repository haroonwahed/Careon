import re

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse


class PublicAuthFlowTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='flow-user',
            password='testpass123',
            email='flow@example.com',
        )

    def _extract_csrf(self, response):
        match = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', response.content.decode('utf-8'))
        self.assertIsNotNone(match, 'Expected csrf token in login form.')
        return match.group(1)

    def test_public_landing_is_the_root_page(self):
        self.client.force_login(self.user)

        response = self.client.get(reverse('index'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'CareOn')
        self.assertContains(response, 'public-shell')
        self.assertNotContains(response, 'Welkom terug')

    def test_care_home_redirects_to_spa_landing(self):
        response = self.client.get(reverse('careon:home'), follow=False)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/')

    def test_login_redirects_to_spa_dashboard(self):
        response = self.client.get(reverse('login'))
        csrf = self._extract_csrf(response)

        login_response = self.client.post(
            reverse('login'),
            {
                'csrfmiddlewaretoken': csrf,
                'username': 'flow-user',
                'password': 'testpass123',
            },
            follow=False,
        )

        self.assertEqual(login_response.status_code, 302)
        self.assertEqual(login_response['Location'], '/dashboard/')

    def test_logout_returns_to_public_landing(self):
        self.client.force_login(self.user)

        response = self.client.post(reverse('logout'), follow=False)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response['Location'], '/')

    def test_public_flow_round_trip_keeps_the_expected_entry_points(self):
        login_page = self.client.get(reverse('login'))
        csrf = self._extract_csrf(login_page)

        login_response = self.client.post(
            reverse('login'),
            {
                'csrfmiddlewaretoken': csrf,
                'username': 'flow-user',
                'password': 'testpass123',
            },
            follow=False,
        )
        self.assertEqual(login_response.status_code, 302)
        self.assertEqual(login_response['Location'], '/dashboard/')

        dashboard_response = self.client.get(reverse('dashboard'))
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertContains(dashboard_response, '<div id="root"></div>', html=True)

        logout_response = self.client.post(reverse('logout'), follow=False)
        self.assertEqual(logout_response.status_code, 302)
        self.assertEqual(logout_response['Location'], '/')

        landing_response = self.client.get(reverse('index'))
        self.assertEqual(landing_response.status_code, 200)
        self.assertContains(landing_response, 'public-shell')
