"""
Documents API views: list, upload, detail, authenticated file serving.
"""
import logging
import os

from django.conf import settings
from django.db.models import Q
from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator

from contracts.models import AuditLog, CareCase, CaseIntakeProcess, Document
from contracts.middleware import log_action
from contracts.tenancy import (
    get_scoped_object_or_404,
    get_user_organization,
)
from contracts.permissions import (
    ensure_provider_case_visible_or_404,
    filter_documents_for_provider_actor,
)
from contracts.workflow_state_machine import WorkflowRole, resolve_actor_role

from contracts.api._helpers import _internal_server_error

logger = logging.getLogger(__name__)


def _serialize_document_row(d):
    return {
        'id': str(d.id),
        'name': d.title,
        'type': d.document_type,
        'status': d.status,
        'description': d.description,
        'linkedCaseId': str(d.contract_id) if d.contract_id else '',
        'linkedCaseName': d.contract.title if d.contract else '',
        'uploadedBy': d.uploaded_by.get_full_name() if d.uploaded_by else '',
        'uploadDate': d.created_at.isoformat(),
        'fileSize': d.file_size,
        'mimeType': d.mime_type,
        'version': d.version,
        'hasStoredFile': bool(d.file),
        'externalHandoffReference': d.external_handoff_reference,
        'isConfidential': d.is_confidential,
    }


def _serve_field_file(field_file, filename: str):
    """Serve a FieldFile via FileResponse, or nginx X-Accel-Redirect when explicitly configured."""
    if field_file and field_file.name and field_file.storage.exists(field_file.name):
        if not getattr(settings, 'NGINX_MEDIA_ACCEL_REDIRECT', False):
            return FileResponse(field_file.open('rb'), as_attachment=True, filename=filename)

    if getattr(settings, 'NGINX_MEDIA_ACCEL_REDIRECT', False):
        from django.http import HttpResponse
        response = HttpResponse()
        response['X-Accel-Redirect'] = f'/protected_media/{field_file.name}'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Content-Type'] = ''
        return response

    if not field_file or not field_file.name:
        return JsonResponse({'error': 'Bestand niet gevonden op schijf'}, status=404)
    if not field_file.storage.exists(field_file.name):
        return JsonResponse({'error': 'Bestand niet gevonden op schijf'}, status=404)
    return FileResponse(field_file.open('rb'), as_attachment=True, filename=filename)


def _documents_upload_api(request, organization):
    """POST /api/documents/ — multipart file upload scoped to the actor's organization."""
    actor_role = resolve_actor_role(user=request.user, organization=organization)
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        return JsonResponse({'error': 'Zorgaanbieders kunnen geen losse documenten uploaden.'}, status=403)

    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return JsonResponse({'error': 'Geen bestand ontvangen. Stuur het bestand als "file" veld.'}, status=400)

    max_mb = getattr(settings, 'CARELANE_MAX_DOCUMENT_UPLOAD_MB', 20)
    if uploaded_file.size > max_mb * 1024 * 1024:
        return JsonResponse(
            {'error': f'Bestand "{uploaded_file.name}" is te groot (max {max_mb} MB).'},
            status=413,
        )

    title = (request.POST.get('title') or '').strip() or uploaded_file.name
    document_type = (request.POST.get('document_type') or Document.DocType.OTHER).strip()
    description = (request.POST.get('description') or '').strip()
    tags = (request.POST.get('tags') or '').strip()

    case_id = request.POST.get('case_id') or request.POST.get('contract')
    contract = None
    if case_id:
        try:
            contract = get_scoped_object_or_404(CareCase.objects.all(), organization, pk=int(case_id))
        except (Http404, ValueError, TypeError):
            return JsonResponse({'error': 'Casus niet gevonden.'}, status=404)

    import mimetypes
    mime_type = uploaded_file.content_type or mimetypes.guess_type(uploaded_file.name)[0] or 'application/octet-stream'

    try:
        doc = Document.objects.create(
            organization=organization,
            title=title[:300],
            document_type=document_type if document_type in Document.DocType.values else Document.DocType.OTHER,
            description=description,
            tags=tags,
            file=uploaded_file,
            file_size=uploaded_file.size,
            mime_type=mime_type,
            uploaded_by=request.user,
            contract=contract,
        )
    except Exception:
        return _internal_server_error(request, context='documents_upload_failed')

    doc.refresh_from_db()
    return JsonResponse({'document': _serialize_document_row(doc)}, status=201)


@login_required
@require_http_methods(["GET", "POST"])
def documents_api(request):
    organization = get_user_organization(request.user)

    if request.method == "POST":
        return _documents_upload_api(request, organization)

    try:
        qs = Document.objects.filter(organization=organization).select_related(
            'uploaded_by', 'contract'
        )
        qs = filter_documents_for_provider_actor(qs, request.user, organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(tags__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = [_serialize_document_row(d) for d in page_obj]
        return JsonResponse({'documents': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='documents_api_failed')


@login_required
@require_http_methods(["GET"])
def document_detail_api(request, document_id):
    """Single document metadata; zorgaanbieder requires placement-linked case visibility."""
    organization = get_user_organization(request.user)
    try:
        doc = Document.objects.select_related('uploaded_by', 'contract').get(
            pk=document_id,
            organization=organization,
        )
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    actor_role = resolve_actor_role(user=request.user, organization=organization)
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        if doc.contract_id is None:
            return JsonResponse({'error': 'Document niet gevonden'}, status=404)
        try:
            ensure_provider_case_visible_or_404(request.user, doc.contract)
        except Http404:
            return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    return JsonResponse(_serialize_document_row(doc))


@login_required
@require_http_methods(["GET"])
def serve_case_document_api(request, document_id):
    """Authenticated download for CareDocument files — enforces org-scope and provider visibility."""
    organization = get_user_organization(request.user)
    try:
        doc = Document.objects.select_related('contract').get(
            pk=document_id,
            organization=organization,
        )
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    actor_role = resolve_actor_role(user=request.user, organization=organization)
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        if doc.contract_id is None:
            return JsonResponse({'error': 'Document niet gevonden'}, status=404)
        try:
            ensure_provider_case_visible_or_404(request.user, doc.contract)
        except Http404:
            return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    if not doc.file:
        return JsonResponse({'error': 'Dit document heeft geen bijlage'}, status=404)

    filename = os.path.basename(doc.file.name)
    log_action(
        request.user,
        AuditLog.Action.VIEW,
        'DocumentDownload',
        object_id=doc.id,
        object_repr=f'document:{doc.id} case:{doc.contract_id}',
        changes={'filename': filename, 'document_id': str(doc.id)},
        request=request,
    )
    return _serve_field_file(doc.file, filename)


@login_required
@require_http_methods(["GET"])
def serve_case_document_scoped_api(request, case_id, document_id):
    """Download a document scoped to a specific case — enforces case ownership before doc lookup."""
    organization = get_user_organization(request.user)
    try:
        case_record = get_scoped_object_or_404(CareCase.objects.all(), organization, pk=case_id)
    except Http404:
        return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    actor_role = resolve_actor_role(user=request.user, organization=organization)
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        try:
            ensure_provider_case_visible_or_404(request.user, case_record)
        except Http404:
            return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    try:
        doc = Document.objects.get(
            pk=document_id,
            organization=organization,
            contract=case_record,
        )
    except Document.DoesNotExist:
        return JsonResponse({'error': 'Document niet gevonden'}, status=404)

    if not doc.file:
        return JsonResponse({'error': 'Dit document heeft geen bijlage'}, status=404)

    filename = os.path.basename(doc.file.name)
    log_action(
        request.user,
        AuditLog.Action.VIEW,
        'DocumentDownload',
        object_id=doc.id,
        object_repr=f'document:{doc.id} case:{case_record.pk}',
        changes={'filename': filename, 'document_id': str(doc.id), 'case_id': str(case_record.pk)},
        request=request,
    )
    return _serve_field_file(doc.file, filename)


@login_required
@require_http_methods(["GET"])
def serve_urgency_document_api(request, case_id):
    """Authenticated download for urgency_document on CaseIntakeProcess — enforces org-scope and provider visibility."""
    organization = get_user_organization(request.user)
    try:
        case_record = get_scoped_object_or_404(CareCase.objects.all(), organization, pk=case_id)
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    actor_role = resolve_actor_role(user=request.user, organization=organization)
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        try:
            ensure_provider_case_visible_or_404(request.user, case_record)
        except Http404:
            return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    try:
        intake = get_scoped_object_or_404(
            CaseIntakeProcess.objects.all(),
            organization,
            contract=case_record,
        )
    except Http404:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    if not intake.urgency_document:
        return JsonResponse({'error': 'Geen urgentiedocument aanwezig'}, status=404)

    filename = os.path.basename(intake.urgency_document.name)
    log_action(
        request.user,
        AuditLog.Action.VIEW,
        'UrgencyDocumentDownload',
        object_id=case_record.id,
        object_repr=f'urgency_document case:{case_record.pk}',
        changes={'filename': filename, 'case_id': str(case_record.pk)},
        request=request,
    )
    return _serve_field_file(intake.urgency_document, filename)
