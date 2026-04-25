from types import SimpleNamespace
from unittest.mock import patch

from django.test import RequestFactory, TestCase

from contracts.middleware import SpaShellMigrationMiddleware


class SpaShellMigrationMiddlewareTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _build_request(self, path='/dashboard/'):
        request = self.factory.get(path)
        request.user = SimpleNamespace(is_authenticated=True)
        return request

    def test_shell_render_failure_returns_fallback_response(self):
        request = self._build_request('/dashboard/')

        with patch('contracts.middleware.is_feature_redesign_enabled', return_value=True), patch(
            'contracts.middleware._render_spa_shell_response',
            side_effect=RuntimeError('boom'),
        ):
            response = SpaShellMigrationMiddleware(lambda req: None)(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['X-Careon-Ui-Surface'], 'spa-fallback')
        self.assertContains(response, 'fallback-modus')
        self.assertContains(response, '/dashboard/')

    def test_downstream_failure_on_shell_path_returns_fallback_response(self):
        request = self._build_request('/care/matching/')

        def failing_get_response(_request):
            raise RuntimeError('boom')

        with patch('contracts.middleware.is_feature_redesign_enabled', return_value=False):
            response = SpaShellMigrationMiddleware(failing_get_response)(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['X-Careon-Ui-Surface'], 'spa-fallback')
        self.assertContains(response, 'fallback-modus')
        self.assertContains(response, '/care/matching/')

    def test_shell_paths_cover_canonical_workflow_routes(self):
        shell_paths = SpaShellMigrationMiddleware.SHELL_PATHS

        self.assertIn('/dashboard/', shell_paths)
        self.assertIn('/care/casussen/', shell_paths)
        self.assertIn('/care/matching/', shell_paths)
        self.assertIn('/care/beoordelingen/', shell_paths)
        self.assertIn('/care/plaatsingen/', shell_paths)
        self.assertIn('/care/signalen/', shell_paths)
