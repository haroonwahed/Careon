"""OIDC helpers — canonical redirect_uri for Google OAuth (avoids redirect_uri_mismatch)."""

from django.conf import settings
from django.urls import reverse


def oidc_callback_redirect_uri() -> str:
    """Fully qualified OAuth callback URL registered in the IdP (Google Cloud Console)."""
    base = getattr(settings, 'OIDC_PUBLIC_BASE_URL', '').rstrip('/')
    callback_path = reverse('oidc_authentication_callback')
    if not callback_path.startswith('/'):
        callback_path = f'/{callback_path}'
    return f'{base}{callback_path}'
