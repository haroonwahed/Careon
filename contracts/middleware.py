import logging
import re
import time

from django.conf import settings
from django.db import DatabaseError
from django.http import HttpResponse
from django.utils.cache import patch_cache_control

from .error_pages import render_safe_error_page
from .observability import (
    bind_correlation_from_request,
    clear_correlation_id,
    log_api_outcome,
    record_api_failure,
)
from .models import AuditLog
from .models import OrganizationMembership
from .tenancy import ensure_user_organization, get_user_organization

logger = logging.getLogger(__name__)


def _disable_response_caching(response):
    patch_cache_control(
        response,
        no_cache=True,
        no_store=True,
        must_revalidate=True,
        private=True,
        max_age=0,
    )
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response


def _render_spa_shell_response():
    spa_index_path = settings.BASE_DIR / 'theme' / 'static' / 'spa' / 'index.html'
    if spa_index_path.exists():
        html = spa_index_path.read_text(encoding='utf-8')
        response = HttpResponse(html, content_type='text/html')
        response['X-Careon-Ui-Surface'] = 'spa'
        return _disable_response_caching(response)

    response = HttpResponse(
        (
            '<!DOCTYPE html>'
            '<html lang="en">'
            '<head>'
            '<meta charset="UTF-8" />'
            '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
            '<title>SaaS Careon</title>'
            '<style>html, body { height: 100%; margin: 0; } #root { height: 100%; }</style>'
            '</head>'
            '<body>'
            '<div id="root"></div>'
            '</body>'
            '</html>'
        ),
        content_type='text/html',
    )
    response['X-Careon-Ui-Surface'] = 'spa'
    return _disable_response_caching(response)


def _should_render_safe_error_page(request, response):
    if request.path.startswith('/care/api/'):
        return False
    if response.status_code not in {403, 404, 500}:
        return False
    content_type = response.get('Content-Type', '')
    if 'application/json' in content_type or 'application/xml' in content_type:
        return False
    return True


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response


class OperationalObservabilityMiddleware:
    """Correlation ID (request/response headers + logging context) and /care/api/ outcome logs."""

    API_PREFIX = "/care/api/"
    RESPONSE_HEADER = "X-Request-ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        cid = bind_correlation_from_request(request)
        start = time.perf_counter()
        try:
            response = self.get_response(request)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            if request.path.startswith(self.API_PREFIX):
                record_api_failure(request, status_code=500)
                log_api_outcome(
                    path=request.path,
                    method=request.method,
                    status_code=500,
                    duration_ms=duration_ms,
                    user_label=self._user_label(request),
                )
            clear_correlation_id()
            raise
        duration_ms = (time.perf_counter() - start) * 1000
        response[self.RESPONSE_HEADER] = cid
        if request.path.startswith(self.API_PREFIX):
            if response.status_code >= 500:
                record_api_failure(request, status_code=response.status_code)
            log_api_outcome(
                path=request.path,
                method=request.method,
                status_code=response.status_code,
                duration_ms=duration_ms,
                user_label=self._user_label(request),
            )
        clear_correlation_id()
        return response

    @staticmethod
    def _user_label(request):
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return "anonymous"
        return getattr(user, "username", "") or str(user.pk)


class OrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            try:
                request._had_existing_membership = OrganizationMembership.objects.filter(
                    user=user,
                    is_active=True,
                    organization__is_active=True,
                ).exists()
                preferred_org_id = request.session.get('active_organization_id')
                if preferred_org_id:
                    user._active_organization_id = preferred_org_id
                organization = get_user_organization(user)
                if organization is None:
                    organization = ensure_user_organization(user)
                request.organization = organization
                if organization and request.session.get('active_organization_id') != organization.id:
                    request.session['active_organization_id'] = organization.id
            except DatabaseError:
                request._had_existing_membership = False
                try:
                    request.organization = ensure_user_organization(user)
                except DatabaseError:
                    request.organization = None
        else:
            request.organization = None
        return self.get_response(request)


class SpaShellMigrationMiddleware:
    """Serve the SPA shell for authenticated workspace pages.

    The legacy Django-rendered care workspace is retired. Authenticated
    workspace routes render the SPA shell directly while backend and API
    exceptions remain available.
    """

    EXCLUDED_PREFIXES = (
        '/care/api/',
    )
    EXCLUDED_EXACT = {
        '/care/organizations/activity/export/',
    }
    SHELL_PATHS = {
        '/dashboard/',
        '/care/casussen/',
        '/care/casussen/new/',
        '/care/beoordelingen/',
        '/care/matching/',
        '/care/plaatsingen/',
        '/care/signalen/',
        '/care/gemeenten/',
        '/care/search/',
    }
    SHELL_PREFIXES = (
        '/dashboard/',
        '/settings/',
        '/care/',
    )
    # Pilot SPA shells: keep serving the React index even when the path contains /pk/.
    # Tenancy and forbidden access for these routes are enforced by /care/api/... .
    SPA_SHELL_PK_EXCEPTION_PREFIXES = (
        '/care/casussen/',
        '/care/cases/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def _is_excluded(self, path):
        if any(path.startswith(prefix) for prefix in self.EXCLUDED_PREFIXES):
            return True
        if path in self.EXCLUDED_EXACT:
            return True

        # Keep invite acceptance logic reachable as a real backend endpoint.
        if path.startswith('/care/organizations/invitations/') and path.endswith('/accept/'):
            return True

        return False

    def _should_serve_shell(self, request):
        path = request.path
        if request.method != 'GET':
            return False

        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return False

        if self._is_excluded(path):
            return False

        if not any(path.startswith(prefix) for prefix in self.SHELL_PREFIXES):
            return False

        # Legacy Django list/detail/edit URLs under /care/ must reach views so queryset
        # scoping can return real 404/403 (cross-tenant, missing object). Pilot dossier
        # URLs above remain SPA-first; those flows rely on API source of truth.
        if self._legacy_care_path_should_bypass_spa_shell(path):
            return False

        return True

    def _legacy_care_path_should_bypass_spa_shell(self, path: str) -> bool:
        """True when path looks like a numeric PK route outside SPA dossier shells."""
        if not path.startswith('/care/'):
            return False
        if not re.search(r'/\d+(?:/|$)', path):
            return False
        for prefix in self.SPA_SHELL_PK_EXCEPTION_PREFIXES:
            if path.startswith(prefix):
                return False
        return True

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if self._should_serve_shell(request):
            try:
                return _render_spa_shell_response()
            except Exception:
                logger.exception('Failed to render SPA shell for path=%s', request.path)
                return render_safe_error_page(request, 500, '500.html')

        try:
            response = self.get_response(request)
        except Exception:
            if (
                request.method == 'GET'
                and user is not None
                and getattr(user, 'is_authenticated', False)
                and any(request.path.startswith(prefix) for prefix in self.SHELL_PREFIXES)
                and not self._is_excluded(request.path)
            ):
                logger.exception('Downstream failure on SPA shell path=%s', request.path)
                return render_safe_error_page(request, 500, '500.html')
            raise

        if _should_render_safe_error_page(request, response):
            return render_safe_error_page(request, response.status_code, f'{response.status_code}.html')
        return response


def log_action(user, action, model_name, object_id=None, object_repr='', changes=None, request=None):
    ip_address = None
    user_agent = ''
    if request:
        ip_address = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip_address and ',' in ip_address:
            ip_address = ip_address.split(',')[0].strip()
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        cid = getattr(request, 'correlation_id', None)
        if cid:
            rid = {'request_id': str(cid)}
            if isinstance(changes, dict):
                changes = {**rid, **changes}
            elif changes is None:
                changes = rid

    AuditLog.objects.create(
        user=user,
        action=action,
        model_name=model_name,
        object_id=object_id,
        object_repr=object_repr[:300],
        changes=changes,
        ip_address=ip_address,
        user_agent=user_agent[:500],
    )
