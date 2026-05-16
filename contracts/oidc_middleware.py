"""Normalize OIDC redirect_uri host to OIDC_PUBLIC_BASE_URL (Google OAuth mismatch fix)."""

from urllib.parse import urlparse

from django.conf import settings


class OIDCCanonicalPublicUrlMiddleware:
    """
    Google OAuth requires redirect_uri to match an authorized URI exactly.

    When login runs behind the Vite proxy (localhost:3000) or mixed hosts,
    ``request.build_absolute_uri()`` can produce the wrong origin. For /oidc/*
    routes we pin Host/scheme to ``OIDC_PUBLIC_BASE_URL``.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, 'SSO_ENABLED', False):
            base = getattr(settings, 'OIDC_PUBLIC_BASE_URL', '').strip().rstrip('/')
            if base and request.path.startswith('/oidc/'):
                parsed = urlparse(base)
                if parsed.netloc:
                    request.META['HTTP_HOST'] = parsed.netloc
                    request.META['wsgi.url_scheme'] = parsed.scheme or 'https'
                    hostname = parsed.hostname or ''
                    request.META['SERVER_NAME'] = hostname
                    if parsed.port:
                        request.META['SERVER_PORT'] = str(parsed.port)
                    elif parsed.scheme == 'https':
                        request.META['SERVER_PORT'] = '443'
                    else:
                        request.META['SERVER_PORT'] = '80'
        return self.get_response(request)
