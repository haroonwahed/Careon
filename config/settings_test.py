import os

# Keep test boot deterministic regardless of local .env.
os.environ.setdefault('DJANGO_DEBUG', '0')
os.environ.setdefault('SSO_ENABLED', '0')

from .settings import *  # noqa: F401,F403
