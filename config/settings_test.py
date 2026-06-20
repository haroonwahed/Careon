import os

# Keep test boot deterministic regardless of local .env.
os.environ.setdefault('DJANGO_DEBUG', '0')
os.environ.setdefault('SSO_ENABLED', '0')
os.environ.setdefault('DATABASE_URL', '')

from .settings import *  # noqa: F401,F403

# Never let LocMemCache bleed state between tests.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}
