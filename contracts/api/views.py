
"""
API views for CareOn case workspace functionality.
"""
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q, Count

from contracts.domain.contracts import CareCaseData, ListParams, ListResult
from contracts.models import (
    CareCase, CaseAssessment, PlacementRequest, CareSignal, CareTask,
    Document, AuditLog, Client, ProviderProfile,
    MunicipalityConfiguration, RegionalConfiguration, CaseIntakeProcess,
)
from contracts.tenancy import get_user_organization, scope_queryset_for_organization


def _build_case_data(case):
    data = CareCaseData(
        id=str(case.id),
        title=case.title,
        status=case.status,
        preferred_provider=getattr(case, 'preferred_provider', ''),
        value=float(case.value) if hasattr(case, 'value') and case.value else None,
        start_date=case.start_date.isoformat() if hasattr(case, 'start_date') and case.start_date else None,
        end_date=case.end_date.isoformat() if hasattr(case, 'end_date') and case.end_date else None,
        owner=case.created_by.get_full_name() if case.created_by else 'System',
        updated_at=case.updated_at.isoformat() if hasattr(case, 'updated_at') and case.updated_at else None,
        created_at=case.created_at.isoformat() if case.created_at else None,
        content=case.content or "",
    )
    # Extend with SPA-required fields not in CareCaseData dataclass
    result = data.to_dict()
    result['case_phase'] = getattr(case, 'case_phase', 'intake') or 'intake'
    result['risk_level'] = getattr(case, 'risk_level', 'LOW') or 'LOW'
    result['service_region'] = getattr(case, 'service_region', '') or ''
    result['contract_type'] = getattr(case, 'contract_type', '') or ''
    return result

@login_required
@require_http_methods(["GET"])
def contracts_api(request):
    """
    API endpoint for listing cases with filtering and pagination.
    Used by the CareOn case workspace UI.
    """
    try:
        # Parse filters from request
        params = ListParams(
            q=request.GET.get('q', ''),
            status=[s for s in request.GET.getlist('status') if s],
            contract_type=[t for t in request.GET.getlist('contract_type') if t],
            sort=request.GET.get('sort', 'updated_desc'),
            page=int(request.GET.get('page', 1)),
            page_size=int(request.GET.get('page_size', 25))
        )

        organization = get_user_organization(request.user)
        queryset = scope_queryset_for_organization(CareCase.objects.all(), organization)

        if params.q:
            queryset = queryset.filter(
                Q(title__icontains=params.q)
                | Q(preferred_provider__icontains=params.q)
                | Q(content__icontains=params.q)
            )

        if params.status:
            queryset = queryset.filter(status__in=params.status)

        if params.sort == 'updated_asc':
            queryset = queryset.order_by('updated_at')
        elif params.sort == 'title':
            queryset = queryset.order_by('title')
        elif params.sort == 'status':
            queryset = queryset.order_by('status')
        else:
            queryset = queryset.order_by('-updated_at')

        paginator = Paginator(queryset, params.page_size)
        page_obj = paginator.get_page(params.page)

        cases = [_build_case_data(case) for case in page_obj]
        return JsonResponse({
            'contracts': cases,
            'total_count': paginator.count,
            'page': params.page,
            'page_size': params.page_size,
            'total_pages': paginator.num_pages,
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_http_methods(["GET"])
def case_detail_api(request, contract_id=None, case_id=None):
    """Get single case details."""
    try:
        record_id = case_id or contract_id
        organization = get_user_organization(request.user)
        queryset = scope_queryset_for_organization(CareCase.objects.all(), organization)

        try:
            case = queryset.get(id=record_id)
        except CareCase.DoesNotExist:
            case = None

        if not case:
            return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

        return JsonResponse(_build_case_data(case))

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def cases_bulk_update_api(request):
    """Bulk update cases."""
    try:
        data = json.loads(request.body)
        case_ids = data.get('case_ids', data.get('contract_ids', []))
        updates = data.get('updates', {})

        organization = get_user_organization(request.user)
        queryset = scope_queryset_for_organization(
            CareCase.objects.filter(id__in=case_ids),
            organization,
        )
        result = queryset.update(**updates)

        return JsonResponse({'success': True, 'updated_count': result})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


contract_detail_api = case_detail_api
contracts_bulk_update_api = cases_bulk_update_api


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def assessments_api(request):
    organization = get_user_organization(request.user)
    try:
        intakes = CaseIntakeProcess.objects.filter(organization=organization)
        qs = CaseAssessment.objects.filter(due_diligence_process__in=intakes).select_related(
            'due_diligence_process', 'assessed_by'
        )
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(
                Q(due_diligence_process__title__icontains=q) | Q(notes__icontains=q)
            )
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for a in page_obj:
            intake = a.due_diligence_process
            data.append({
                'id': str(a.id),
                'caseId': str(intake.id) if intake else '',
                'caseTitle': intake.title if intake else '',
                'regio': (intake.preferred_region.region_name if intake and intake.preferred_region else ''),
                'wachttijd': 0,
                'status': a.assessment_status,
                'matchingReady': a.matching_ready,
                'riskSignals': [s.strip() for s in a.risk_signals.split(',') if s.strip()] if a.risk_signals else [],
                'notes': a.notes,
                'assessedBy': a.assessed_by.get_full_name() if a.assessed_by else '',
                'createdAt': a.created_at.isoformat(),
            })
        return JsonResponse({'assessments': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Placements
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def placements_api(request):
    organization = get_user_organization(request.user)
    try:
        intakes = CaseIntakeProcess.objects.filter(organization=organization)
        qs = PlacementRequest.objects.filter(due_diligence_process__in=intakes).select_related(
            'due_diligence_process', 'proposed_provider', 'selected_provider'
        )
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(
                Q(due_diligence_process__title__icontains=q) | Q(description__icontains=q)
            )
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for p in page_obj:
            intake = p.due_diligence_process
            data.append({
                'id': str(p.id),
                'caseId': str(intake.id) if intake else '',
                'caseTitle': intake.title if intake else '',
                'status': p.status,
                'careForm': p.care_form,
                'providerResponseStatus': p.provider_response_status,
                'proposedProvider': p.proposed_provider.name if p.proposed_provider else '',
                'selectedProvider': p.selected_provider.name if p.selected_provider else '',
                'description': p.description,
                'createdAt': p.created_at.isoformat(),
            })
        return JsonResponse({'placements': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def signals_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = CareSignal.objects.for_organization(organization).select_related(
            'case_record', 'assigned_to', 'created_by'
        )
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        status_filter = request.GET.get('status', '')
        if status_filter:
            qs = qs.filter(status=status_filter)
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for s in page_obj:
            data.append({
                'id': str(s.id),
                'title': s.title or s.get_signal_type_display(),
                'signalType': s.signal_type,
                'riskLevel': s.risk_level,
                'status': s.status,
                'description': s.description,
                'linkedCaseId': str(s.case_record_id) if s.case_record_id else '',
                'linkedCaseTitle': s.case_record.title if s.case_record else '',
                'assignedTo': s.assigned_to.get_full_name() if s.assigned_to else '',
                'createdAt': s.created_at.isoformat(),
                'updatedAt': s.updated_at.isoformat(),
            })
        return JsonResponse({'signals': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def tasks_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = CareTask.objects.for_organization(organization).select_related(
            'case_record', 'assigned_to'
        )
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        status_filter = request.GET.get('status', '')
        if status_filter:
            qs = qs.filter(status=status_filter)
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        from datetime import date as date_today
        today = date_today.today()
        for t in page_obj:
            due = t.due_date
            if t.status in ('COMPLETED', 'CANCELLED'):
                action_status = 'completed'
            elif due < today:
                action_status = 'overdue'
            elif due == today:
                action_status = 'today'
            else:
                action_status = 'upcoming'
            data.append({
                'id': str(t.id),
                'title': t.title,
                'description': t.description,
                'priority': t.priority,
                'status': t.status,
                'actionStatus': action_status,
                'linkedCaseId': str(t.case_record_id) if t.case_record_id else '',
                'caseTitle': t.case_record.title if t.case_record else '',
                'assignedTo': t.assigned_to.get_full_name() if t.assigned_to else '',
                'dueDate': due.isoformat() if due else '',
                'createdAt': t.created_at.isoformat(),
            })
        return JsonResponse({'tasks': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def documents_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = Document.objects.filter(organization=organization).select_related(
            'uploaded_by', 'contract'
        )
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(tags__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for d in page_obj:
            data.append({
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
                'isConfidential': d.is_confidential,
            })
        return JsonResponse({'documents': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def audit_log_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = AuditLog.objects.select_related('user')
        if organization:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            org_user_ids = list(
                User.objects.filter(organization_memberships__organization=organization).values_list('id', flat=True)
            )
            qs = qs.filter(user_id__in=org_user_ids)
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
        return JsonResponse({'entries': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def providers_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = Client.objects.filter(
            organization=organization,
            client_type='CORPORATION',
        ).select_related('provider_profile')
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(city__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for client in page_obj:
            pp = getattr(client, 'provider_profile', None)
            data.append({
                'id': str(client.id),
                'name': client.name,
                'city': client.city,
                'status': client.status,
                'currentCapacity': pp.current_capacity if pp else 0,
                'maxCapacity': pp.max_capacity if pp else 0,
                'waitingListLength': pp.waiting_list_length if pp else 0,
                'averageWaitDays': pp.average_wait_days if pp else 0,
                'offersOutpatient': pp.offers_outpatient if pp else False,
                'offersDayTreatment': pp.offers_day_treatment if pp else False,
                'offersResidential': pp.offers_residential if pp else False,
                'offersCrisis': pp.offers_crisis if pp else False,
                'serviceArea': pp.service_area if pp else '',
                'specialFacilities': pp.special_facilities if pp else '',
            })
        return JsonResponse({'providers': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Municipalities
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def municipalities_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = MunicipalityConfiguration.objects.filter(organization=organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(municipality_name__icontains=q) | Q(municipality_code__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for m in page_obj:
            data.append({
                'id': str(m.id),
                'name': m.municipality_name,
                'code': m.municipality_code,
                'status': m.status,
                'maxWaitDays': m.max_wait_days,
                'providerCount': m.provider_count,
                'coordinator': m.responsible_coordinator.get_full_name() if m.responsible_coordinator else '',
            })
        return JsonResponse({'municipalities': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Regions
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def regions_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = RegionalConfiguration.objects.filter(organization=organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(region_name__icontains=q) | Q(region_code__icontains=q))
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)
        data = []
        for r in page_obj:
            data.append({
                'id': str(r.id),
                'name': r.region_name,
                'code': r.region_code,
                'regionType': r.region_type,
                'status': r.status,
                'maxWaitDays': r.max_wait_days,
                'providerCount': r.provider_count,
                'municipalityCount': r.municipality_count,
                'coordinator': r.responsible_coordinator.get_full_name() if r.responsible_coordinator else '',
            })
        return JsonResponse({'regions': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ---------------------------------------------------------------------------
# Dashboard summary
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def dashboard_summary_api(request):
    organization = get_user_organization(request.user)
    try:
        cases_qs = scope_queryset_for_organization(CareCase.objects.all(), organization)
        signals_qs = CareSignal.objects.for_organization(organization)
        tasks_qs = CareTask.objects.for_organization(organization)

        total_cases = cases_qs.count()
        active_cases = cases_qs.filter(
            case_phase__in=['intake', 'beoordeling', 'matching', 'plaatsing', 'actief']
        ).count()
        open_signals = signals_qs.filter(status='OPEN').count()
        critical_signals = signals_qs.filter(status='OPEN', risk_level='CRITICAL').count()
        pending_tasks = tasks_qs.filter(status='PENDING').count()

        phase_counts = {}
        for item in cases_qs.values('case_phase').annotate(count=Count('id')):
            phase_counts[item['case_phase']] = item['count']

        risk_counts = {}
        for item in cases_qs.values('risk_level').annotate(count=Count('id')):
            risk_counts[item['risk_level']] = item['count']

        return JsonResponse({
            'totalCases': total_cases,
            'activeCases': active_cases,
            'openSignals': open_signals,
            'criticalSignals': critical_signals,
            'pendingTasks': pending_tasks,
            'phaseBreakdown': phase_counts,
            'riskBreakdown': risk_counts,
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
