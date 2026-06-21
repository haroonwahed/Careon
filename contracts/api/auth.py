"""
Auth API views: login, logout, current user, session organization switching.
"""
import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required

from contracts.models import Organization, OrganizationMembership
from contracts.tenancy import get_user_organization
from contracts.workflow_state_machine import resolve_actor_role
from contracts.auth_rate_limit import (
    check_login_allowed,
    clear_login_attempts,
    is_login_locked,
    lockout_user_message,
    record_failed_login,
)

from contracts.api._helpers import _active_organization

logger = logging.getLogger(__name__)


@ensure_csrf_cookie
@require_http_methods(["POST", "GET"])
def auth_login_api(request):
    if request.method == "GET":
        return JsonResponse({'csrfReady': True})
    """JSON login endpoint — lets the React SPA authenticate without a full-page redirect."""
    from django.contrib.auth import authenticate, login as auth_login
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'ok': False, 'error': 'Ongeldig verzoek.'}, status=400)
    username = (body.get('username') or '').strip()
    password = body.get('password') or ''
    if not username or not password:
        return JsonResponse({'ok': False, 'error': 'Gebruikersnaam en wachtwoord zijn verplicht.'}, status=400)

    if is_login_locked(request, username):
        _, retry_after = check_login_allowed(request, username)
        return JsonResponse(
            {'ok': False, 'error': lockout_user_message(retry_after), 'retry_after': retry_after},
            status=429,
        )

    allowed, retry_after = check_login_allowed(request, username)
    if not allowed:
        return JsonResponse(
            {'ok': False, 'error': lockout_user_message(retry_after), 'retry_after': retry_after},
            status=429,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        record_failed_login(request, username)
        return JsonResponse({'ok': False, 'error': 'De gebruikersnaam of het wachtwoord is onjuist.'}, status=401)
    clear_login_attempts(request, username)
    auth_login(request, user)
    return JsonResponse({'ok': True, 'next': '/dashboard/'})


@require_http_methods(["POST"])
def auth_logout_api(request):
    """JSON logout endpoint."""
    from django.contrib.auth import logout as auth_logout
    auth_logout(request)
    return JsonResponse({'ok': True})


@login_required
@ensure_csrf_cookie
@require_http_methods(["GET"])
def current_user_api(request):
    """Session-backed actor for SPA shell (no client-side role switching)."""
    organization = _active_organization(request)
    workflow_role = resolve_actor_role(user=request.user, organization=organization)
    pilot_ui = bool(getattr(settings, 'CARELANE_PILOT_UI', False))
    payload = {
        'id': request.user.pk,
        'email': getattr(request.user, 'email', '') or '',
        'fullName': (request.user.get_full_name() or '').strip() or request.user.username,
        'username': request.user.username,
        'workflowRole': workflow_role,
        'organization': None,
        'permissions': {
            'allowRoleSwitch': not pilot_ui,
        },
        'flags': {
            'pilotUi': pilot_ui,
            'spaOnlyWorkflow': bool(getattr(settings, 'CARELANE_PILOT_SPA_ONLY', False)),
        },
    }
    if organization is not None:
        payload['organization'] = {
            'id': organization.pk,
            'slug': organization.slug,
            'name': getattr(organization, 'name', str(organization.pk)),
        }
    return JsonResponse(payload)


@login_required
@require_http_methods(["POST"])
def session_active_organization_api(request):
    """Persist active tenant for the session (same semantics as HTML switch_organization).

    SPA sends JSON: ``{"organization_slug": "gemeente-demo"}`` or ``{"organization_id": 123}``.
    Membership is required — no cross-tenant activation without OrganizationMembership.
    """
    try:
        data = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON'}, status=400)

    slug = data.get('organization_slug') or data.get('slug')
    org_id = data.get('organization_id')
    organization = None
    if org_id is not None:
        try:
            org_id = int(org_id)
        except (TypeError, ValueError):
            return JsonResponse({'ok': False, 'error': 'Ongeldig organization_id'}, status=400)
        organization = Organization.objects.filter(pk=org_id, is_active=True).first()
    elif slug:
        organization = Organization.objects.filter(slug=str(slug).strip(), is_active=True).first()

    if organization is None:
        return JsonResponse({'ok': False, 'error': 'Organisatie niet gevonden'}, status=404)

    membership = OrganizationMembership.objects.filter(
        user=request.user,
        organization=organization,
        is_active=True,
        organization__is_active=True,
    ).first()
    if membership is None:
        return JsonResponse({'ok': False, 'error': 'Geen lidmaatschap voor deze organisatie'}, status=400)

    request.session['active_organization_id'] = organization.id
    request.session.modified = True
    return JsonResponse({
        'ok': True,
        'organization': {
            'id': organization.pk,
            'slug': organization.slug,
            'name': organization.name,
        },
    })
