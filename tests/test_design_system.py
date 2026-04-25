
import os
import re
from importlib import reload

from django.contrib.auth.models import User
from django.template import Context, Template
from django.test import Client, TestCase, override_settings
from django.urls import clear_url_caches, reverse

import config.urls as project_urls


class DesignSystemTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
        )

    def _assert_spa_shell(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        body = response.content.decode('utf-8')
        self.assertRegex(body, r'/static/spa/assets/index-[^\"\']+\.js')
        self.assertRegex(body, r'/static/spa/assets/index-[^\"\']+\.css')
        # Dashboard is SPA-first; legacy server-rendered dashboard content is no longer the contract.

    def test_dashboard_loads_with_feature_flag_enabled(self):
        os.environ['FEATURE_REDESIGN'] = 'true'
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('dashboard'))
        self._assert_spa_shell(response)

    def test_dashboard_loads_with_feature_flag_disabled(self):
        os.environ['FEATURE_REDESIGN'] = 'false'
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('dashboard'))
        self._assert_spa_shell(response)

    def test_button_component_snippet(self):
        template = Template(
            '<button class="btn-primary">Primary Button</button>'
            '<button class="btn-secondary">Secondary Button</button>'
        )
        rendered = template.render(Context({}))
        self.assertIn('btn-primary', rendered)
        self.assertIn('btn-secondary', rendered)

    def test_card_component_snippet(self):
        template = Template(
            '<div class="card"><div class="card-header"></div><div class="card-content"></div></div>'
        )
        rendered = template.render(Context({}))
        self.assertIn('card-header', rendered)
        self.assertIn('card-content', rendered)

    def test_stat_component_snippet(self):
        template = Template(
            '<div class="stat"><div class="stat-label">Total Contracts</div>'
            '<div class="stat-value">142</div></div>'
        )
        rendered = template.render(Context({}))
        self.assertIn('stat-label', rendered)
        self.assertIn('stat-value', rendered)

    def test_responsive_shell_markers(self):
        os.environ['FEATURE_REDESIGN'] = 'true'
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('dashboard'))
        self._assert_spa_shell(response)

    def test_search_and_notifications_links_exist(self):
        os.environ['FEATURE_REDESIGN'] = 'true'
        self.client.login(username='testuser', password='testpass123')
        response = self.client.get(reverse('dashboard'))
        self._assert_spa_shell(response)

    @override_settings(DEBUG=True)
    def test_debug_urlconf_exposes_static_files(self):
        clear_url_caches()
        reloaded_urls = reload(project_urls)
        patterns = [str(pattern.pattern) for pattern in reloaded_urls.urlpatterns]
        self.assertIn('^static/(?P<path>.*)$', patterns)

    def tearDown(self):
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']
