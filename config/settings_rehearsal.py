from .settings import *  # noqa: F401,F403
from .settings import _bool_env  # not exported by import * (leading underscore)


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db_rehearsal.sqlite3',
    }
}

# Local rehearsal / pilot E2E: new Vite builds emit content-hashed filenames under theme/static/spa/.
# With DEBUG=False, staticfiles URL patterns are not mounted and Whitenoise + CompressedManifestStaticFilesStorage
# can 404 fresh chunks until collectstatic refreshes the manifest — the SPA shell loads but React never mounts.
# Default DEBUG on for this settings module so django.contrib.staticfiles finders serve new assets after npm run build.
# Override for stricter checks: DJANGO_DEBUG=0 DEBUG=0
DEBUG = _bool_env('DJANGO_DEBUG', default=_bool_env('DEBUG', default=True))  # noqa: F405

# rehearsal_verify and e2e preflight use Django TestClient (HTTP_HOST=testserver).
_REHEARSAL_ALLOWED_HOSTS = ('localhost', '127.0.0.1', 'testserver', '[::1]')
if isinstance(ALLOWED_HOSTS, list) and '*' in ALLOWED_HOSTS:  # noqa: F405
    pass
else:
    ALLOWED_HOSTS = list(  # noqa: F405
        dict.fromkeys([*(ALLOWED_HOSTS or []), *_REHEARSAL_ALLOWED_HOSTS]),
    )
