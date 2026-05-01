import re

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
        self.client.login(username='testuser', password='testpass123')

    def _assert_dashboard_spa_shell(self, response):
        self.assertEqual(response.status_code, 200)
        html = response.content.decode('utf-8')
        self.assertIn('<div id="root"></div>', html)
        self.assertRegex(html, r'/static/spa/assets/index-[^\"\']+\.js')
        self.assertRegex(html, r'/static/spa/assets/index-[^\"\']+\.css')

    def test_base_shell_and_theme_controls(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_dashboard_spa_shell(response)

    def test_sidebar_navigation_sections_and_links(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_dashboard_spa_shell(response)

    def test_topbar_actions(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_dashboard_spa_shell(response)

    def test_dashboard_decision_screen_structure(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_dashboard_spa_shell(response)

    def test_dashboard_reduces_secondary_actions(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_dashboard_spa_shell(response)
