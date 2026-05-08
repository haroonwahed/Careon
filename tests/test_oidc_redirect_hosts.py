from unittest import TestCase

from config import settings


class OidcRedirectHostTests(TestCase):
    def test_spa_origin_is_allowed_for_oidc_redirects(self) -> None:
        self.assertIn('127.0.0.1:3000', settings.OIDC_REDIRECT_ALLOWED_HOSTS)
        self.assertIn('localhost:3000', settings.OIDC_REDIRECT_ALLOWED_HOSTS)
