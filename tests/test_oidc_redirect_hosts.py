from django.conf import settings
from django.test import RequestFactory, TestCase, override_settings

from contracts.oidc_middleware import OIDCCanonicalPublicUrlMiddleware
from contracts.oidc_utils import oidc_callback_redirect_uri


class OidcRedirectHostTests(TestCase):
    def test_spa_origin_is_allowed_for_oidc_redirects(self) -> None:
        self.assertIn('127.0.0.1:3000', settings.OIDC_REDIRECT_ALLOWED_HOSTS)
        self.assertIn('localhost:3000', settings.OIDC_REDIRECT_ALLOWED_HOSTS)

    def test_oidc_callback_uri_uses_public_base_url(self) -> None:
        expected = f'{settings.OIDC_PUBLIC_BASE_URL.rstrip("/")}/oidc/callback/'
        self.assertEqual(oidc_callback_redirect_uri(), expected)

    def test_oidc_middleware_pins_host_for_oidc_routes(self) -> None:
        factory = RequestFactory()
        request = factory.get('/oidc/authenticate/')
        request.META['HTTP_HOST'] = 'localhost:3000'

        def get_response(req):
            return req

        with override_settings(
            SSO_ENABLED=True,
            OIDC_PUBLIC_BASE_URL='http://127.0.0.1:8000',
            ALLOWED_HOSTS=['127.0.0.1', 'localhost', 'testserver'],
        ):
            middleware = OIDCCanonicalPublicUrlMiddleware(get_response)
            updated = middleware(request)
            callback_uri = oidc_callback_redirect_uri()

        self.assertEqual(updated.META['HTTP_HOST'], '127.0.0.1:8000')
        self.assertEqual(updated.META['wsgi.url_scheme'], 'http')
        self.assertEqual(callback_uri, 'http://127.0.0.1:8000/oidc/callback/')
