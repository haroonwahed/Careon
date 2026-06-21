"""WCAG: built SPA shell must declare lang=\"nl\"."""
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase


class SpaShellLangTests(SimpleTestCase):
    def test_built_spa_index_declares_dutch(self):
        index_path = settings.BASE_DIR / 'theme' / 'static' / 'spa' / 'index.html'
        if not index_path.exists():
            self.skipTest('SPA not built — run npm run build in client/ (CI builds before pytest).')
        html = index_path.read_text(encoding='utf-8')
        self.assertIn('lang="nl"', html)
        self.assertNotIn('lang="en"', html)

    def test_middleware_fallback_shell_declares_dutch(self):
        from contracts.middleware import _render_spa_shell_response

        response = _render_spa_shell_response()
        self.assertIn(b'lang="nl"', response.content)
