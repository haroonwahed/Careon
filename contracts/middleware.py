from django.conf import settings
from django.http import HttpResponse
from django.utils.cache import patch_cache_control

from .models import AuditLog
from .tenancy import get_user_organization


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
        response = HttpResponse(spa_index_path.read_text(encoding='utf-8'), content_type='text/html')
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


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        return response


class OrganizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user and getattr(user, 'is_authenticated', False):
            preferred_org_id = request.session.get('active_organization_id')
            if preferred_org_id:
                user._active_organization_id = preferred_org_id
            organization = get_user_organization(user)
            request.organization = organization
            if organization and request.session.get('active_organization_id') != organization.id:
                request.session['active_organization_id'] = organization.id
        else:
            request.organization = None
        return self.get_response(request)


class SpaShellMigrationMiddleware:
    """Serve the SPA shell for authenticated care workspace pages.

    This middleware finalizes the migration away from server-rendered legacy
    templates for /care/* GET pages while preserving API and invite accept
    endpoints that still need dedicated backend handling.
    """

    EXCLUDED_PREFIXES = (
        '/care/api/',
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def _is_excluded(self, path):
        if any(path.startswith(prefix) for prefix in self.EXCLUDED_PREFIXES):
            return True

        # Keep invite acceptance logic reachable as a real backend endpoint.
        if path.startswith('/care/organizations/invitations/') and path.endswith('/accept/'):
            return True

        return False

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if (
            request.method == 'GET'
            and request.path.startswith('/care/')
            and user is not None
            and getattr(user, 'is_authenticated', False)
            and not self._is_excluded(request.path)
        ):
            return _render_spa_shell_response()

        return self.get_response(request)


def log_action(user, action, model_name, object_id=None, object_repr='', changes=None, request=None):
    ip_address = None
    user_agent = ''
    if request:
        ip_address = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', ''))
        if ip_address and ',' in ip_address:
            ip_address = ip_address.split(',')[0].strip()
        user_agent = request.META.get('HTTP_USER_AGENT', '')

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
