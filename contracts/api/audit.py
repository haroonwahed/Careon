"""
Audit log API views.
"""
import logging

from django.db.models import Q
from django.http import Http404, JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator

from contracts.audit_retention import apply_audit_log_retention, audit_log_retention_days
from contracts.models import AuditLog, CareCase
from contracts.tenancy import (
    get_scoped_object_or_404,
    get_user_organization,
)
from contracts.permissions import ensure_provider_case_visible_or_404
from contracts.workflow_state_machine import WorkflowRole, resolve_actor_role

from contracts.api._helpers import (
    _get_intake_for_case_api_id,
    _internal_server_error,
)

logger = logging.getLogger(__name__)


@login_required
@require_http_methods(["GET"])
def audit_log_api(request):
    organization = get_user_organization(request.user)
    try:
        actor_role = resolve_actor_role(user=request.user, organization=organization)
        if actor_role == WorkflowRole.ZORGAANBIEDER:
            return JsonResponse(
                {
                    'ok': False,
                    'error': 'Auditlog is niet beschikbaar voor deze rol.',
                },
                status=403,
            )
        if organization is None and not request.user.is_superuser:
            return JsonResponse(
                {'ok': False, 'error': 'Geen organisatie gevonden voor auditlog.'},
                status=403,
            )
        qs = AuditLog.objects.select_related('user')
        if organization:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            org_user_ids = list(
                User.objects.filter(organization_memberships__organization=organization).values_list('id', flat=True)
            )
            qs = qs.filter(user_id__in=org_user_ids)
        qs = apply_audit_log_retention(qs)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(model_name__icontains=q) | Q(object_repr__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for entry in page_obj:
            data.append({
                'id': str(entry.id),
                'timestamp': entry.timestamp.isoformat(),
                'action': entry.action,
                'modelName': entry.model_name,
                'objectId': entry.object_id,
                'objectRepr': entry.object_repr,
                'userName': entry.user.get_full_name() if entry.user else 'Systeem',
                'userEmail': entry.user.email if entry.user else '',
                'changes': entry.changes,
            })
        return JsonResponse({'entries': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages, 'retentionDays': audit_log_retention_days()})
    except Exception:
        return _internal_server_error(request, context='audit_log_api_failed')


@login_required
@require_http_methods(["GET"])
def audit_log_export_api(request):
    """CSV/JSON export of organization audit log (gemeente/admin only)."""
    from contracts.api.audit_export import build_audit_log_export

    organization = get_user_organization(request.user)
    try:
        actor_role = resolve_actor_role(user=request.user, organization=organization)
        return build_audit_log_export(request=request, organization=organization, actor_role=actor_role)
    except Exception:
        return _internal_server_error(request, context='audit_log_export_api_failed')


@login_required
@require_http_methods(["GET"])
def case_dispute_export_api(request, case_id):
    """Case-scoped dispute bundle: timeline + decision log + related audit rows."""
    from contracts.api.audit_export import build_case_dispute_export

    try:
        organization = get_user_organization(request.user)
        case = get_scoped_object_or_404(
            CareCase.objects.all(),
            organization,
            pk=case_id,
        )
        ensure_provider_case_visible_or_404(request.user, case)
        try:
            intake = _get_intake_for_case_api_id(case_id, organization, user=request.user)
        except Http404:
            intake = getattr(case, 'due_diligence_process', None)
        return build_case_dispute_export(
            request=request,
            organization=organization,
            case=case,
            intake=intake,
        )
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    except Exception:
        return _internal_server_error(request, context='case_dispute_export_api_failed')
