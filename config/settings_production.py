import os

from django.core.exceptions import ImproperlyConfigured

from . import settings as base
from .settings import *  # noqa: F401,F403


DEBUG = base._bool_env('DJANGO_DEBUG', default=False)

if DEBUG:
    raise ImproperlyConfigured('DJANGO_DEBUG must be false in production settings.')

if not ALLOWED_HOSTS:
    raise ImproperlyConfigured('ALLOWED_HOSTS must be set in production.')
if not CSRF_TRUSTED_ORIGINS:
    raise ImproperlyConfigured('CSRF_TRUSTED_ORIGINS must be set in production.')
if SECRET_KEY.startswith('django-insecure-'):
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set in production.')
if DEFAULT_FROM_EMAIL == 'noreply@careon.local':
    raise ImproperlyConfigured('DEFAULT_FROM_EMAIL must be set in production.')
if DATABASES['default']['ENGINE'] == 'django.db.backends.sqlite3':
    raise ImproperlyConfigured('DATABASE_URL must point to PostgreSQL in production.')

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_SSL_REDIRECT = base._bool_env('SECURE_SSL_REDIRECT', default=True)
WHITENOISE_USE_FINDERS = False
SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '3600'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = base._bool_env('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=True)
SECURE_HSTS_PRELOAD = base._bool_env('SECURE_HSTS_PRELOAD', default=True)
SECURE_REFERRER_POLICY = os.getenv('SECURE_REFERRER_POLICY', 'same-origin')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_CROSS_ORIGIN_OPENER_POLICY = os.getenv('SECURE_CROSS_ORIGIN_OPENER_POLICY', 'same-origin')

# ---------------------------------------------------------------------------
# Error monitoring (Sentry)
# ---------------------------------------------------------------------------
# Activates only when SENTRY_DSN is set in env. The DSN itself MUST never be
# committed; it lives in deploy-time environment variables.
#
# Privacy posture (regielaag / AVG):
#   - send_default_pii=False — Sentry must not auto-attach IPs, usernames, or
#     request bodies. Personal/casus data must not leave the boundary.
#   - traces_sample_rate=0 by default — no performance tracing during pilot to
#     keep volume + cost predictable. Override via SENTRY_TRACES_SAMPLE_RATE.
#   - profiles_sample_rate=0 — no profiling.
#
# Operator-facing follow-ups (deploy-time, not code):
#   - Set SENTRY_DSN, SENTRY_ENVIRONMENT (e.g. "pilot-2026"), and SENTRY_RELEASE
#     (the deployed git SHA).
#   - Configure Sentry alert routing for the pilot gemeente.
SENTRY_DSN = os.getenv('SENTRY_DSN', '').strip()
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        environment=os.getenv('SENTRY_ENVIRONMENT', 'production'),
        release=os.getenv('SENTRY_RELEASE') or None,
        send_default_pii=False,
        traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0')),
        profiles_sample_rate=float(os.getenv('SENTRY_PROFILES_SAMPLE_RATE', '0')),
    )
