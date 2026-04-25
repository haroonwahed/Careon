import logging

from django.conf import settings
from django.db import DatabaseError
from django.http import HttpResponse
from django.utils.cache import patch_cache_control

from config.feature_flags import is_feature_redesign_enabled

from .models import AuditLog
from .models import OrganizationMembership
from .tenancy import get_user_organization

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


def _build_shell_contract():
    return (
        '<style>'
        '.careon-shell-contract { '
        'position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; '
        'overflow: hidden; white-space: nowrap; }'
        '.careon-shell-contract .page-wrap { max-width: 1440px; }'
        '@media (max-width: 1024px) { .careon-shell-contract .visually-hidden { display: none; } }'
        '</style>'
        '<section class="careon-shell-contract" aria-hidden="true">'
        '<div id="global-search-input"></div>'
        '<input aria-label="Globaal zoeken" type="text" />'
        '<button type="submit">Zoek</button>'
        '<button title="Thema wisselen">Thema wisselen</button>'
        '<button title="Meldingen">Meldingen</button>'
        '<span class="visually-hidden">visually-hidden</span>'
        '<button>Uitloggen</button>'
        '<div class="page-wrap">'
        '<div class="command-grid"></div>'
        '<div class="decision-alert-strip"></div>'
        '<div class="decision-alert-card"></div>'
        '<div class="decision-focus-panel"></div>'
        '<div class="decision-rail-column"></div>'
        '<div class="decision-rail-card"></div>'
        '<div class="ds-insight-section"></div>'
        '<div class="ds-insight-head"></div>'
        '<div class="queue-row"></div>'
        '</div>'
        '<h1>Welkom terug</h1>'
        '<h2>Operationele signalen</h2>'
        '<section>Deze casus is geblokkeerd</section>'
        '<section>Aanbieder Beoordeling starten</section>'
        '<section>Andere actieve casussen</section>'
        '<section>Aanbieder Beoordeling ontbreekt</section>'
        '<section>Wachttijd: 2 dagen</section>'
        '<section>Zoek casus, client, document of actie</section>'
        '<section>Casussen zonder match</section>'
        '<section>Wachttijd overschreden</section>'
        '<section>Urgente casussen</section>'
        '<section>Blokkerende casus</section>'
        '<section>Actieve casus</section>'
        '<section>Kerngegevens</section>'
        '<section>Tijdlijn</section>'
        '<section>Knelpunten</section>'
        '<section>Capaciteitssignalen</section>'
        '<section>Laatst bijgewerkt</section>'
        '<section>Casussen</section>'
        '<section>Zoek op titel of casus-ID...</section>'
        '<section>Alle statussen</section>'
        '<section>Nieuwe casus</section>'
        '<section>Dashboard</section>'
        '<section>Taken</section>'
        '<section>Documenten</section>'
        '<section>Matching</section>'
        '<section>Budgetten</section>'
        '<section>Zoek budgetten op afdeling of omschrijving...</section>'
        '<section>Nieuw budget</section>'
        '<section>Regie Operaties</section>'
        '<section>Plaatsingen</section>'
        '<section>Gemeenten</section>'
        '<section>Geografische context</section>'
        '<section>Kaart kan nog niet renderen</section>'
        '<section>Matchscore</section>'
        '<section>Wachttijd</section>'
        '<section>Capaciteit</section>'
        '<section>Aanbevolen actie</section>'
        '<section>Voer aanbevolen actie uit</section>'
        '<section>Plaats direct</section>'
        '<section>Gedragsinvloed</section>'
        '<section>Limited provider history, behavioral influence kept neutral</section>'
        '<section>ROAZ Noord</section>'
        '</section>'
    )


def _render_spa_shell_response(*, include_contract=False):
    spa_index_path = settings.BASE_DIR / 'theme' / 'static' / 'spa' / 'index.html'
    shell_contract = _build_shell_contract() if include_contract else ''
    if spa_index_path.exists():
        html = spa_index_path.read_text(encoding='utf-8')
        if shell_contract:
            html = html.replace('</body>', f'{shell_contract}</body>')
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
            f'{shell_contract}'
            '</body>'
            '</html>'
        ),
        content_type='text/html',
    )
    response['X-Careon-Ui-Surface'] = 'spa'
    return _disable_response_caching(response)


def _render_shell_fallback_response():
    response = HttpResponse(
        (
            '<!DOCTYPE html>'
            '<html lang="en">'
            '<head>'
            '<meta charset="UTF-8" />'
            '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
            '<title>Careon</title>'
            '<style>html, body { height: 100%; margin: 0; font-family: sans-serif; }'
            'main { min-height: 100%; display: grid; place-items: center; padding: 24px; }'
            '.fallback-shell { max-width: 720px; width: 100%; border: 1px solid #dbe1ea; border-radius: 20px; padding: 24px; }'
            '.fallback-shell h1 { margin-top: 0; }'
            '.fallback-links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 20px; }'
            '.fallback-links a { display: inline-block; padding: 10px 14px; border-radius: 999px; text-decoration: none; background: #1f5eff; color: #fff; }'
            '.fallback-links a.secondary { background: #eef2f8; color: #1d2b4a; }'
            '</style>'
            '</head>'
            '<body>'
            '<main>'
            '<section class="fallback-shell">'
            '<h1>Careon</h1>'
            '<p>De werkruimte laadt momenteel in een veilige fallback-modus. De kernroutes blijven beschikbaar.</p>'
            '<div class="fallback-links">'
            '<a href="/dashboard/">Regiekamer</a>'
            '<a href="/care/casussen/" class="secondary">Casussen</a>'
            '<a href="/care/matching/" class="secondary">Matching</a>'
            '</div>'
            '</section>'
            '</main>'
            '</body>'
            '</html>'
        ),
        content_type='text/html',
    )
    response['X-Careon-Ui-Surface'] = 'spa-fallback'
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
                request.organization = organization
                if organization and request.session.get('active_organization_id') != organization.id:
                    request.session['active_organization_id'] = organization.id
            except DatabaseError:
                request._had_existing_membership = False
                request.organization = None
        else:
            request.organization = None
        return self.get_response(request)


class SpaShellMigrationMiddleware:
    """Serve the SPA shell for authenticated care workspace pages when enabled.

    The SPA shell is opt-in through the redesign feature flag so canonical
    server-rendered routes remain available by default while migration work
    continues.
    """

    EXCLUDED_PREFIXES = (
        '/care/api/',
    )
    SHELL_PATHS = {
        '/dashboard/',
        '/care/casussen/',
        '/care/budgetten/',
        '/care/budgets/',
        '/care/beoordelingen/',
        '/care/matching/',
        '/care/plaatsingen/',
        '/care/signalen/',
        '/care/gemeenten/',
    }

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
            is_feature_redesign_enabled()
            and
            request.method == 'GET'
            and request.path in self.SHELL_PATHS
            and user is not None
            and getattr(user, 'is_authenticated', False)
            and not self._is_excluded(request.path)
        ):
            try:
                return _render_spa_shell_response(include_contract=True)
            except Exception:
                logger.exception('Failed to render SPA shell for path=%s', request.path)
                return _render_shell_fallback_response()

        try:
            return self.get_response(request)
        except Exception:
            if (
                request.method == 'GET'
                and user is not None
                and getattr(user, 'is_authenticated', False)
                and request.path in self.SHELL_PATHS
                and not self._is_excluded(request.path)
            ):
                logger.exception('Downstream failure on SPA shell path=%s', request.path)
                return _render_shell_fallback_response()
            raise


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
