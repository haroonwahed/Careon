from unittest.mock import patch

from django.contrib.auth.models import User
from django.http import HttpResponse
from django.test import Client, RequestFactory, TestCase
from django.urls import reverse

from contracts.middleware import SpaShellMigrationMiddleware
from contracts.models import Organization, OrganizationMembership


class SpaShellMigrationMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username='shell-user',
            password='testpass123',
        )

    def _build_request(self, path='/dashboard/'):
        request = self.factory.get(path)
        request.user = self.user
        return request

    def test_client_route_prefix_casussen_renders_spa_shell(self):
        """pushState uses /casussen; full page GET must serve index.html (not 404)."""
        request = self._build_request('/casussen/')
        with patch('contracts.middleware._render_spa_shell_response') as shell_mock:
            shell_mock.return_value = HttpResponse('<div id="root"></div>', content_type='text/html')
            response = SpaShellMigrationMiddleware(lambda req: HttpResponse('miss'))(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode('utf-8'), '<div id="root"></div>')

    def test_shell_render_failure_returns_safe_error_page(self):
        request = self._build_request('/dashboard/')

        with patch('contracts.middleware.logger.exception'), patch(
            'contracts.middleware._render_spa_shell_response',
            side_effect=RuntimeError('boom'),
        ):
            response = SpaShellMigrationMiddleware(lambda req: None)(request)

        body = response.content.decode('utf-8')
        self.assertEqual(response.status_code, 500)
        self.assertNotIn('Careon Zorgregie', body)
        self.assertNotIn('Regiekamer', body)
        self.assertIn('Er ging iets mis', body)

    def test_backend_api_routes_are_not_rewritten_to_spa_shell(self):
        request = self._build_request('/care/api/cases/')

        def api_response(_request):
            return HttpResponse('api-ok', content_type='application/json')

        response = SpaShellMigrationMiddleware(api_response)(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content.decode('utf-8'), 'api-ok')
        self.assertNotIn('X-Careon-Ui-Surface', response)

    def test_shell_paths_cover_canonical_workflow_routes(self):
        shell_paths = SpaShellMigrationMiddleware.SHELL_PATHS

        self.assertIn('/dashboard/', shell_paths)
        self.assertIn('/care/casussen/', shell_paths)
        self.assertIn('/care/matching/', shell_paths)
        self.assertIn('/care/beoordelingen/', shell_paths)
        self.assertIn('/care/plaatsingen/', shell_paths)
        self.assertIn('/care/signalen/', shell_paths)


class SpaShellMigrationIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='spa-shell-user',
            password='testpass123',
            email='spa-shell@example.com',
        )
        self.organization = Organization.objects.create(name='SPA Shell Org', slug='spa-shell-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

    def _login_client(self):
        client = Client()
        client.login(username='spa-shell-user', password='testpass123')
        return client

    def test_authenticated_care_routes_render_spa_shell_without_legacy_layout_strings(self):
        client = self._login_client()

        legacy_strings = (
            'Careon Zorgregie',
            'Globaal zoeken',
            'CASUSMANAGEMENT',
            'NETWERK',
            'STURING',
            'Regiekamer',
            'Casussen',
            'Matching',
            'Plaatsingen',
            'Taken',
            'Collapse sidebar',
        )

        for path in (
            reverse('careon:case_create'),
            reverse('careon:matching_dashboard'),
            reverse('careon:case_list'),
            '/casussen/',
            reverse('careon:global_search') + '?q=test',
            '/care/does-not-exist/',
        ):
            with self.subTest(path=path):
                response = client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['X-Careon-Ui-Surface'], 'spa')
                self.assertContains(response, '<div id="root"></div>', html=True)
                self.assertContains(response, '/static/spa/assets/index-')
                for legacy_string in legacy_strings:
                    self.assertNotContains(response, legacy_string)
