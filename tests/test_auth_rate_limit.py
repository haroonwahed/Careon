"""Login brute-force rate limiting."""
import json

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

User = get_user_model()


@override_settings(
    AUTH_LOGIN_MAX_ATTEMPTS=3,
    AUTH_LOGIN_ATTEMPT_WINDOW_SECONDS=900,
    AUTH_LOGIN_LOCKOUT_SECONDS=900,
    CACHES={
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    },
)
class AuthLoginRateLimitTests(TestCase):
    def setUp(self):
        from django.core.cache import cache

        cache.clear()
        self.user = User.objects.create_user(username='rate_user', password='correct-pass')
        self.api_url = reverse('carelane:auth_login_api')

    def _post_login(self, *, username='rate_user', password='wrong'):
        return self.client.post(
            self.api_url,
            data=json.dumps({'username': username, 'password': password}),
            content_type='application/json',
        )

    def test_successful_login_clears_attempt_counter(self):
        response = self.client.post(
            self.api_url,
            data=json.dumps({'username': 'rate_user', 'password': 'correct-pass'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['ok'])

    def test_failed_attempts_lock_out_after_threshold(self):
        for _ in range(3):
            response = self._post_login()
            self.assertEqual(response.status_code, 401)

        locked = self._post_login(password='correct-pass')
        self.assertEqual(locked.status_code, 429)
        self.assertIn('retry_after', locked.json())

    def test_html_login_respects_lockout(self):
        for _ in range(3):
            self._post_login()

        response = self.client.post(
            reverse('login'),
            data={'username': 'rate_user', 'password': 'correct-pass'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Te veel mislukte inlogpogingen')
