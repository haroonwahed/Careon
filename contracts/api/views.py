
"""
API views for CareOn case workspace functionality.
"""
import json
import logging
from datetime import date

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.utils import timezone

from contracts.domain.contracts import CareCaseData, ListParams, ListResult
from contracts.forms import CaseIntakeProcessForm
from contracts.middleware import log_action
from contracts.decision_engine import build_regiekamer_decision_overview, evaluate_case
from contracts.models import (
    CareCase, CaseAssessment, PlacementRequest, CareSignal, CareTask,
    Document, AuditLog, Client, ProviderProfile,
    MunicipalityConfiguration, RegionalConfiguration, CaseIntakeProcess, OutcomeReasonCode, RegionType,
)
from contracts.tenancy import (
    get_scoped_object_or_404,
    get_user_organization,
    scope_queryset_for_organization,
    set_organization_on_instance,
)
from contracts.permissions import CaseAction, can_access_case_action
from contracts.provider_workspace import build_provider_workspace_summary
from contracts.legacy_backend.provider_matching_service import MatchContext, MatchEngine
from contracts.views import _assign_provider_to_intake
from contracts.navigation import SPA_DASHBOARD_URL
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    derive_workflow_state,
    evaluate_transition,
    log_transition_event,
    normalize_provider_rejection_states,
    resolve_actor_role,
)

logger = logging.getLogger(__name__)


_WORKFLOW_STATE_VALUES = {
    WorkflowState.DRAFT_CASE,
    WorkflowState.SUMMARY_READY,
    WorkflowState.MATCHING_READY,
    WorkflowState.GEMEENTE_VALIDATED,
    WorkflowState.PROVIDER_REVIEW_PENDING,
    WorkflowState.PROVIDER_ACCEPTED,
    WorkflowState.PROVIDER_REJECTED,
    WorkflowState.PLACEMENT_CONFIRMED,
    WorkflowState.INTAKE_STARTED,
    WorkflowState.ARCHIVED,
}


def _case_workflow_state(case):
    try:
        intake = case.due_diligence_process
    except CaseIntakeProcess.DoesNotExist:
        intake = None

    persisted_state = str(getattr(intake, 'workflow_state', '') or '').strip() if intake is not None else ''
    if persisted_state in _WORKFLOW_STATE_VALUES:
        return persisted_state
    if intake is not None:
        return derive_workflow_state(intake=intake)
    if getattr(case, 'lifecycle_stage', '') == 'ARCHIVED':
        return WorkflowState.ARCHIVED
    return WorkflowState.DRAFT_CASE


def _coerce_coordinate(value, *, minimum, maximum):
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    if numeric_value < minimum or numeric_value > maximum:
        return None
    return round(numeric_value, 6)


def _extract_coordinates(source):
    if source is None:
        return None, None

    candidate_pairs = (
        ('latitude', 'longitude'),
        ('lat', 'lng'),
        ('lat', 'lon'),
    )

    for latitude_attr, longitude_attr in candidate_pairs:
        if not hasattr(source, latitude_attr) or not hasattr(source, longitude_attr):
            continue

        latitude = _coerce_coordinate(getattr(source, latitude_attr, None), minimum=-90, maximum=90)
        longitude = _coerce_coordinate(getattr(source, longitude_attr, None), minimum=-180, maximum=180)
        if latitude is not None and longitude is not None:
            return latitude, longitude

    return None, None


def _first_related(queryset_or_manager):
    if queryset_or_manager is None:
        return None

    try:
        return queryset_or_manager.all().first()
    except AttributeError:
        return None


def _provider_location_payload(profile):
    primary_region = _first_related(profile.served_regions)
    municipality = _first_related(primary_region.served_municipalities) if primary_region else None
    region_label = primary_region.region_name if primary_region else ''
    municipality_label = municipality.municipality_name if municipality else ''
    location_label = profile.client.city or municipality_label or region_label or profile.service_area or 'Locatie ontbreekt'

    # Derive coordinates from available linked sources until explicit provider geo fields exist.
    sources = [profile, profile.client, primary_region, municipality]
    latitude = None
    longitude = None
    for source in sources:
        latitude, longitude = _extract_coordinates(source)
        if latitude is not None and longitude is not None:
            break

    return {
        'label': location_label,
        'latitude': latitude,
        'longitude': longitude,
        'region_label': region_label,
        'municipality_label': municipality_label,
        'has_coordinates': latitude is not None and longitude is not None,
    }


def _provider_regions_payload(profile):
    if profile is None:
        return {
            'primary_region_label': '',
            'secondary_region_labels': [],
            'all_region_labels': [],
        }

    primary_regions = list(profile.served_regions.all())
    secondary_regions = list(profile.secondary_served_regions.all())

    primary_label = primary_regions[0].region_name if primary_regions else ''
    secondary_labels = [region.region_name for region in secondary_regions]

    labels = []
    seen = set()
    for region in primary_regions + secondary_regions:
        key = (region.region_name or '').strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        labels.append(region.region_name)

    return {
        'primary_region_label': primary_label,
        'secondary_region_labels': secondary_labels,
        'all_region_labels': labels,
    }


def _build_case_data(case, *, include_geo=False):
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
    result['lifecycle_stage'] = getattr(case, 'lifecycle_stage', '') or ''
    result['workflow_state'] = _case_workflow_state(case)
    intake = getattr(case, 'due_diligence_process', None)
    has_case_geo = bool(
        intake and getattr(intake, 'latitude', None) is not None and getattr(intake, 'longitude', None) is not None
    )
    result['has_case_geo'] = has_case_geo
    if include_geo:
        result['case_geo'] = {
            'postcode': str(getattr(intake, 'postcode', '') or '') if intake is not None else '',
            'latitude': getattr(intake, 'latitude', None) if intake is not None else None,
            'longitude': getattr(intake, 'longitude', None) if intake is not None else None,
            'has_coordinates': has_case_geo,
        }
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
        queryset = scope_queryset_for_organization(
            CareCase.objects.select_related('due_diligence_process'),
            organization,
        ).exclude(lifecycle_stage='ARCHIVED')

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
        if record_id is None:
            return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

        # Guard against route shadowing or malformed ids (e.g. "intake-form").
        try:
            record_id = int(record_id)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

        organization = get_user_organization(request.user)
        case = get_scoped_object_or_404(
            CareCase.objects.select_related('due_diligence_process'),
            organization,
            pk=record_id,
        )

        payload = _build_case_data(case, include_geo=True)
        payload['decision_evaluation'] = evaluate_case(case, actor=request.user)
        return JsonResponse(payload)

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def case_decision_evaluation_api(request, case_id):
    organization = get_user_organization(request.user)
    case = get_scoped_object_or_404(CareCase.objects.all(), organization, pk=case_id)

    if not can_access_case_action(request.user, case, CaseAction.VIEW):
        return JsonResponse({'error': 'Je hebt geen rechten om deze casus te bekijken.'}, status=403)

    return JsonResponse(evaluate_case(case, actor=request.user))


@login_required
@require_http_methods(["GET"])
def regiekamer_decision_overview_api(request):
    organization = get_user_organization(request.user)
    try:
        if organization is None:
            return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

        cases = scope_queryset_for_organization(
            CareCase.objects.select_related('due_diligence_process'),
            organization,
        ).exclude(
            Q(lifecycle_stage='ARCHIVED') | Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
        )

        payload = build_regiekamer_decision_overview(
            cases,
            actor=request.user,
            organization=organization,
        )
        return JsonResponse(payload)
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

        disallowed_workflow_fields = {
            'status',
            'case_phase',
            'lifecycle_stage',
            'phase_entered_at',
        }
        blocked_fields = sorted(field for field in updates.keys() if field in disallowed_workflow_fields)
        if blocked_fields:
            return JsonResponse(
                {
                    'success': False,
                    'error': 'Workflowvelden zijn niet toegestaan in bulk updates.',
                    'blocked_fields': blocked_fields,
                },
                status=400,
            )

        organization = get_user_organization(request.user)
        queryset = scope_queryset_for_organization(
            CareCase.objects.filter(id__in=case_ids).exclude(lifecycle_stage='ARCHIVED'),
            organization,
        )
        result = queryset.update(**updates)

        return JsonResponse({'success': True, 'updated_count': result})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def _serialize_simple_choices(field):
    serialized = []
    for value, label in field.choices:
        if value in (None, ''):
            continue
        serialized.append({
            'value': str(value),
            'label': str(label),
        })
    return serialized


def _serialize_model_choices(field):
    return [
        {
            'value': str(obj.pk),
            'label': str(field.label_from_instance(obj)),
        }
        for obj in field.queryset
    ]


def _flatten_form_errors(form):
    errors = {}
    for field_name, field_errors in form.errors.items():
        if field_name == '__all__':
            errors[field_name] = [str(error) for error in field_errors]
            continue
        errors[field_name] = str(field_errors[0])
    return errors


def _build_intake_form_payload(form, coordinator_field):
    care_category_sub = []
    care_category_sub_field = form.fields.get('care_category_sub')
    if care_category_sub_field is not None:
        for subcategory in care_category_sub_field.queryset:
            care_category_sub.append({
                'value': str(subcategory.pk),
                'label': str(care_category_sub_field.label_from_instance(subcategory)),
                'mainCategoryId': str(subcategory.main_category_id),
            })

    def _model_options(field_name):
        field = form.fields.get(field_name)
        if field is None:
            return []
        return _serialize_model_choices(field)

    def _simple_options(field_name):
        field = form.fields.get(field_name)
        if field is None:
            return []
        return _serialize_simple_choices(field)

    return {
        'initial_values': {
            'title': '',
            'start_date': date.today().isoformat(),
            'target_completion_date': '',
            'care_category_main': str(form.initial.get('care_category_main') or ''),
            'care_category_sub': '',
            'assessment_summary': '',
            'gemeente': '',
            'regio': '',
            'urgency': CaseIntakeProcess.Urgency.MEDIUM,
            'complexity': CaseIntakeProcess.Complexity.SIMPLE,
            'urgency_applied': False,
            'urgency_applied_since': '',
            'diagnostiek': [],
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': form.initial.get('preferred_region_type', 'GEMEENTELIJK'),
            'preferred_region': '',
            'max_toelaatbare_wachttijd_dagen': '',
            'leeftijd': '',
            'setting_voorkeur': '',
            'contra_indicaties': '',
            'problematiek_types': '',
            'client_age_category': '',
            'family_situation': '',
            'school_work_status': '',
            'postcode': '',
            'latitude': '',
            'longitude': '',
            'case_coordinator': '',
            'description': '',
        },
        'options': {
            'care_category_main': _model_options('care_category_main'),
            'care_category_sub': care_category_sub,
            'gemeente': _model_options('gemeente'),
            'regio': _model_options('regio'),
            'urgency': _simple_options('urgency'),
            'complexity': _simple_options('complexity'),
            'diagnostiek': _simple_options('diagnostiek'),
            'zorgvorm_gewenst': _simple_options('zorgvorm_gewenst'),
            'preferred_care_form': _simple_options('preferred_care_form'),
            'preferred_region_type': _simple_options('preferred_region_type'),
            'preferred_region': _model_options('preferred_region'),
            'client_age_category': _simple_options('client_age_category'),
            'family_situation': _simple_options('family_situation'),
            'case_coordinator': _serialize_model_choices(coordinator_field) if coordinator_field is not None else [],
        },
    }


def _build_match_context_from_intake(intake, organization):
    region_ref = ''
    if getattr(intake, 'regio', None):
        region_ref = intake.regio.region_code or intake.regio.region_name or ''
    elif getattr(intake, 'preferred_region', None):
        region_ref = intake.preferred_region.region_code or intake.preferred_region.region_name or ''

    contra = [token.strip() for token in str(getattr(intake, 'contra_indicaties', '') or '').split(',') if token.strip()]
    return MatchContext(
        zorgvorm=(getattr(intake, 'zorgvorm_gewenst', '') or intake.preferred_care_form or '').lower(),
        leeftijd=getattr(intake, 'leeftijd', None),
        regio=region_ref,
        gemeente=(intake.gemeente.municipality_name if getattr(intake, 'gemeente', None) else ''),
        complexiteit=(intake.complexity or '').lower(),
        urgentie=(intake.urgency or '').lower(),
        problematiek=list(getattr(intake, 'problematiek_types', []) or []),
        crisisopvang_vereist=(intake.urgency == CaseIntakeProcess.Urgency.CRISIS),
        setting_voorkeur=getattr(intake, 'setting_voorkeur', '') or '',
        contra_indicaties=contra,
        max_toelaatbare_wachttijd_dagen=getattr(intake, 'max_toelaatbare_wachttijd_dagen', None),
        organization=organization,
    )


@login_required
@require_http_methods(["GET"])
def matching_candidates_api(request, case_id):
    organization = get_user_organization(request.user)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    intake = CaseIntakeProcess.objects.filter(organization=organization, pk=case_id).select_related(
        'regio', 'preferred_region', 'gemeente', 'contract'
    ).first()
    if intake is None:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'error': 'Casus is gearchiveerd.'}, status=400)

    ctx = _build_match_context_from_intake(intake, organization)
    limit = int(request.GET.get('limit', 10) or 10)
    results = MatchEngine.run(ctx=ctx, casus=intake, max_results=max(limit, 10), persist=False)

    payload = []
    for rank, row in enumerate(results, start=1):
        trade_offs = []
        for item in list(row.trade_offs or []):
            if isinstance(item, dict):
                detail = item.get('toelichting') or item.get('factor') or ''
                if detail:
                    trade_offs.append(str(detail))
            elif item:
                trade_offs.append(str(item))

        payload.append({
            'casus_id': intake.pk,
            'zorgprofiel_id': row.zorgprofiel_id,
            'zorgaanbieder_id': row.zorgaanbieder_id,
            'totaalscore': float(row.totaalscore or 0.0),
            'score_inhoudelijke_fit': float(row.score_inhoudelijke_fit or 0.0),
            'score_regio_contract_fit': float(row.score_regio_contract_fit or row.score_contract_regio or 0.0),
            'score_capaciteit_wachttijd_fit': float(row.score_capaciteit_wachttijd_fit or row.score_capaciteit or 0.0),
            'score_complexiteit_veiligheid_fit': float(row.score_complexiteit_veiligheid_fit or row.score_complexiteit or 0.0),
            'score_performance_fit': float(row.score_performance_fit or row.score_performance or 0.0),
            'confidence_label': (row.confidence_label or '').lower(),
            'fit_samenvatting': row.fit_samenvatting or '',
            'trade_offs': trade_offs,
            'verificatie_advies': row.verificatie_advies or '',
            'uitgesloten': bool(row.uitgesloten),
            'uitsluitreden': row.uitsluitreden or '',
            'ranking': row.ranking or rank,
            'region_pressure_signal': 'Beste inhoudelijke match, maar capaciteit in regio staat onder druk' if (row.score_capaciteit_wachttijd_fit or row.score_capaciteit or 0) < 10 else '',
        })

    return JsonResponse({
        'caseId': intake.pk,
        'count': len(payload),
        'matches': payload[:limit],
    })


@login_required
@require_http_methods(["GET"])
def intake_form_options_api(request):
    try:
        organization = get_user_organization(request.user)
        form = CaseIntakeProcessForm()

        coordinator_field = form.fields.get('case_coordinator')
        if organization and coordinator_field is not None:
            coordinator_field.queryset = coordinator_field.queryset.filter(
                organization_memberships__organization=organization,
                organization_memberships__is_active=True,
            ).distinct().order_by('first_name', 'last_name', 'username')

        return JsonResponse(_build_intake_form_payload(form, coordinator_field))
    except Exception as e:
        return JsonResponse({'error': f'Intake-form kon niet worden opgebouwd: {str(e)}'}, status=500)


@login_required
@require_http_methods(["GET"])
def case_detail_string_fallback_api(request, case_ref):
    """Fail-safe route for non-numeric case identifiers under /api/cases/."""
    if str(case_ref).isdigit():
        return case_detail_api(request, case_id=int(case_ref))
    return JsonResponse({'error': 'Casus niet gevonden'}, status=404)


def _assessment_decision_payload(*, case_record, intake, assessment):
    decision_key = 'draft'
    if assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING:
        decision_key = 'matching'
    elif assessment.assessment_status == CaseAssessment.AssessmentStatus.NEEDS_INFO:
        decision_key = 'needs_info'
    elif assessment.assessment_status == CaseAssessment.AssessmentStatus.UNDER_REVIEW:
        decision_key = 'under_review'

    return {
        'caseId': str(case_record.pk),
        'assessmentId': str(assessment.pk),
        'form': {
            'decision': decision_key,
            'urgency': intake.urgency,
            'zorgtype': intake.zorgvorm_gewenst or intake.preferred_care_form,
            'shortDescription': assessment.notes or intake.assessment_summary or '',
        },
        'summary': {
            'title': intake.title,
            'urgency': intake.urgency,
            'matchingReady': bool(assessment.matching_ready),
        },
        'hints': {
            'suggestedUrgency': {
                'value': intake.urgency,
                'label': intake.get_urgency_display(),
            },
        },
        'consequences': [
            'matching',
            'placement',
        ],
    }


def _require_workflow_role(*, user, organization, allowed_roles: set[str]):
    actor_role = resolve_actor_role(user=user, organization=organization)
    if actor_role not in allowed_roles:
        return actor_role, JsonResponse(
            {
                'ok': False,
                'error': 'Deze rol mag deze workflow-actie niet uitvoeren.',
                'actor_role': actor_role,
            },
            status=403,
        )
    return actor_role, None


@login_required
@require_http_methods(["GET", "POST"])
def assessment_decision_api(request, case_id):
    organization = get_user_organization(request.user)
    case_record = get_scoped_object_or_404(CareCase.objects.all(), organization, pk=case_id)
    intake = get_scoped_object_or_404(
        CaseIntakeProcess.objects.select_related('organization', 'contract'),
        organization,
        contract=case_record,
    )
    assessment = getattr(intake, 'case_assessment', None)
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'error': 'Casus is gearchiveerd.'}, status=400)
    if assessment is None:
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.DRAFT,
            matching_ready=False,
            assessed_by=request.user,
        )

    if request.method == 'GET':
        return JsonResponse(_assessment_decision_payload(case_record=case_record, intake=intake, assessment=assessment))

    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    decision = (payload.get('decision') or '').strip().lower()
    short_description = (payload.get('shortDescription') or '').strip()
    urgency = (payload.get('urgency') or intake.urgency or '').strip()
    complexity = (payload.get('complexity') or intake.complexity or '').strip()
    zorgtype = (payload.get('zorgtype') or intake.zorgvorm_gewenst or intake.preferred_care_form or '').strip()
    constraints = payload.get('constraints') or []

    previous_state = derive_workflow_state(intake=intake, assessment=assessment)

    if urgency:
        intake.urgency = urgency
    if complexity:
        intake.complexity = complexity
    if zorgtype:
        intake.zorgvorm_gewenst = zorgtype
        intake.preferred_care_form = zorgtype

    if decision == 'matching':
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.MATCHING_READY,
            actor_role=actor_role,
            action=WorkflowAction.START_MATCHING,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        assessment.assessment_status = CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
        assessment.matching_ready = True
        assessment.reason_not_ready = ''
        intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        case_record.case_phase = CareCase.CasePhase.MATCHING
        if short_description:
            assessment.notes = short_description
        if isinstance(constraints, list):
            assessment.risk_signals = ','.join(str(item).strip() for item in constraints if str(item).strip())
    elif decision == 'needs_info':
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.SUMMARY_READY,
            actor_role=actor_role,
            action=WorkflowAction.COMPLETE_SUMMARY,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        assessment.assessment_status = CaseAssessment.AssessmentStatus.NEEDS_INFO
        assessment.matching_ready = False
        if short_description:
            assessment.reason_not_ready = short_description
        assessment.notes = short_description or assessment.notes
        intake.status = CaseIntakeProcess.ProcessStatus.INTAKE
        case_record.case_phase = CareCase.CasePhase.INTAKE
    else:
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.SUMMARY_READY,
            actor_role=actor_role,
            action=WorkflowAction.COMPLETE_SUMMARY,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        assessment.assessment_status = CaseAssessment.AssessmentStatus.UNDER_REVIEW
        assessment.matching_ready = False
        if short_description:
            assessment.notes = short_description
        intake.status = CaseIntakeProcess.ProcessStatus.INTAKE
        case_record.case_phase = CareCase.CasePhase.INTAKE

    intake.workflow_state = WorkflowState.MATCHING_READY if decision == 'matching' else WorkflowState.SUMMARY_READY
    intake.save(update_fields=['urgency', 'complexity', 'zorgvorm_gewenst', 'preferred_care_form', 'status', 'workflow_state', 'updated_at'])
    case_record.save(update_fields=['case_phase', 'updated_at'])
    assessment.assessed_by = request.user
    assessment.save()

    new_state = WorkflowState.MATCHING_READY if decision == 'matching' else WorkflowState.SUMMARY_READY
    action = WorkflowAction.START_MATCHING if decision == 'matching' else WorkflowAction.COMPLETE_SUMMARY
    log_transition_event(
        intake=intake,
        actor_user=request.user,
        actor_role=actor_role,
        old_state=previous_state,
        new_state=new_state,
        action=action,
        source='assessment_decision_api',
    )

    return JsonResponse({
        'ok': True,
        'nextPage': 'matching' if decision == 'matching' else 'assessment',
        'caseId': str(case_record.pk),
        'assessmentId': str(assessment.pk),
        'assessment': _assessment_decision_payload(case_record=case_record, intake=intake, assessment=assessment),
    })


@login_required
@require_http_methods(["POST"])
def matching_action_api(request, case_id):
    organization = get_user_organization(request.user)
    intake = get_scoped_object_or_404(
        CaseIntakeProcess.objects.select_related('contract'),
        organization,
        pk=case_id,
    )
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        payload = {}

    action = (payload.get('action') or '').strip().lower()
    if action != 'assign':
        return JsonResponse({'ok': False, 'error': 'Unsupported action.'}, status=400)

    provider = get_object_or_404(
        Client.objects.filter(organization=organization, status='ACTIVE'),
        pk=payload.get('provider_id'),
    )

    assessment = getattr(intake, 'case_assessment', None)
    previous_state = derive_workflow_state(intake=intake, assessment=assessment)
    validation_transition = evaluate_transition(
        current_state=previous_state,
        target_state=WorkflowState.GEMEENTE_VALIDATED,
        actor_role=actor_role,
        action=WorkflowAction.VALIDATE_MATCHING,
    )
    if not validation_transition.allowed:
        return JsonResponse({'ok': False, 'error': validation_transition.reason}, status=400)

    send_to_provider_transition = evaluate_transition(
        current_state=WorkflowState.GEMEENTE_VALIDATED,
        target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
        actor_role=actor_role,
        action=WorkflowAction.SEND_TO_PROVIDER,
    )
    if not send_to_provider_transition.allowed:
        return JsonResponse({'ok': False, 'error': send_to_provider_transition.reason}, status=400)

    if intake.workflow_state != WorkflowState.GEMEENTE_VALIDATED:
        intake.workflow_state = WorkflowState.GEMEENTE_VALIDATED
        intake.save(update_fields=['workflow_state', 'updated_at'])

    try:
        placement = _assign_provider_to_intake(request=request, intake=intake, provider=provider, source='matching_api')
    except ValidationError as exc:
        return JsonResponse({'ok': False, 'error': '; '.join(exc.messages) or 'Matching kan nog niet worden gestart.'}, status=400)

    update_fields = ['updated_at']
    if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
        intake.status = CaseIntakeProcess.ProcessStatus.DECISION
        update_fields.append('status')
    if intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
        intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
        update_fields.append('workflow_state')

    case_record = intake.case_record
    if case_record is not None and case_record.case_phase != CareCase.CasePhase.PROVIDER_BEOORDELING:
        case_record.case_phase = CareCase.CasePhase.PROVIDER_BEOORDELING
        case_record.save(update_fields=['case_phase', 'updated_at'])

    intake.save(update_fields=list(dict.fromkeys(update_fields)))
    new_state = derive_workflow_state(intake=intake, assessment=assessment, placement=placement)
    log_transition_event(
        intake=intake,
        actor_user=request.user,
        actor_role=actor_role,
        old_state=previous_state,
        new_state=WorkflowState.GEMEENTE_VALIDATED,
        action=WorkflowAction.VALIDATE_MATCHING,
        source='matching_action_api',
    )
    log_transition_event(
        intake=intake,
        actor_user=request.user,
        actor_role=actor_role,
        old_state=WorkflowState.GEMEENTE_VALIDATED,
        new_state=new_state,
        action=WorkflowAction.SEND_TO_PROVIDER,
        placement=placement,
        source='matching_action_api',
    )

    return JsonResponse({
        'ok': True,
        'nextPage': 'casussen',
        'providerId': str(provider.pk),
        'placementId': str(placement.pk),
        'caseId': str(intake.pk),
    })


@login_required
@require_http_methods(["GET"])
def case_placement_detail_api(request, case_id):
    organization = get_user_organization(request.user)
    intake = get_scoped_object_or_404(
        CaseIntakeProcess.objects.select_related('contract'),
        organization,
        pk=case_id,
    )
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'caseId': str(intake.pk), 'placement': {}, 'error': 'Casus is gearchiveerd.'}, status=400)
    placement = (
        PlacementRequest.objects.filter(due_diligence_process=intake)
        .select_related('proposed_provider', 'selected_provider')
        .order_by('-updated_at')
        .first()
    )

    if placement is None:
        return JsonResponse({'caseId': str(intake.pk), 'placement': {}}, status=200)

    return JsonResponse({
        'caseId': str(intake.pk),
        'placement': {
            'id': str(placement.pk),
            'status': placement.status,
            'providerResponseStatus': placement.provider_response_status,
            'providerResponseReasonCode': placement.provider_response_reason_code,
            'proposedProviderId': str(placement.proposed_provider_id) if placement.proposed_provider_id else '',
            'selectedProviderId': str(placement.selected_provider_id) if placement.selected_provider_id else '',
            'careForm': placement.care_form,
            'decisionNotes': placement.decision_notes,
        },
    })


@login_required
@require_http_methods(["POST"])
def provider_decision_api(request, case_id):
    organization = get_user_organization(request.user)
    intake = get_scoped_object_or_404(
        CaseIntakeProcess.objects.select_related('contract'),
        organization,
        pk=case_id,
    )
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)

    placement = (
        PlacementRequest.objects
        .filter(due_diligence_process=intake)
        .select_related('selected_provider', 'proposed_provider')
        .order_by('-updated_at')
        .first()
    )
    if placement is None:
        return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

    decision = str(payload.get('status') or '').strip().upper()
    notes = (payload.get('provider_comment') or payload.get('information_request_comment') or '').strip()
    reason_code = str(payload.get('rejection_reason_code') or payload.get('reason_code') or '').strip().upper()

    previous_state = derive_workflow_state(intake=intake, placement=placement)
    now = timezone.now()

    if decision == 'ACCEPTED':
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.PROVIDER_ACCEPTED,
            actor_role=actor_role,
            action=WorkflowAction.PROVIDER_ACCEPT,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.ACCEPTED
        placement.provider_response_reason_code = reason_code or OutcomeReasonCode.NONE
        placement.provider_response_notes = notes
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by = request.user
        placement.save(update_fields=[
            'provider_response_status',
            'provider_response_reason_code',
            'provider_response_notes',
            'provider_response_recorded_at',
            'provider_response_recorded_by',
            'updated_at',
        ])
        if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.PLAATSING:
            intake.case_record.case_phase = CareCase.CasePhase.PLAATSING
            intake.case_record.save(update_fields=['case_phase', 'updated_at'])

        new_state = WorkflowState.PROVIDER_ACCEPTED
        if intake.workflow_state != new_state:
            intake.workflow_state = new_state
            intake.save(update_fields=['workflow_state', 'updated_at'])
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=new_state,
            action=WorkflowAction.PROVIDER_ACCEPT,
            placement=placement,
            reason=notes,
            source='provider_decision_api',
        )
        return JsonResponse({'ok': True, 'nextPage': 'plaatsingen', 'caseId': str(intake.pk)})

    if decision == 'REJECTED':
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.PROVIDER_REJECTED,
            actor_role=actor_role,
            action=WorkflowAction.PROVIDER_REJECT,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)
        if not reason_code:
            return JsonResponse({'ok': False, 'error': 'Afwijzing vereist een reden.'}, status=400)

        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.REJECTED
        placement.provider_response_reason_code = reason_code
        placement.provider_response_notes = notes
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by = request.user
        placement.status = PlacementRequest.Status.REJECTED
        placement.save(update_fields=[
            'provider_response_status',
            'provider_response_reason_code',
            'provider_response_notes',
            'provider_response_recorded_at',
            'provider_response_recorded_by',
            'status',
            'updated_at',
        ])

        new_state = WorkflowState.PROVIDER_REJECTED
        if intake.workflow_state != new_state:
            intake.workflow_state = new_state
            intake.save(update_fields=['workflow_state', 'updated_at'])
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=new_state,
            action=WorkflowAction.PROVIDER_REJECT,
            placement=placement,
            reason=notes,
            source='provider_decision_api',
        )
        return JsonResponse({'ok': True, 'nextPage': 'beoordelingen', 'caseId': str(intake.pk)})

    if decision == 'INFO_REQUESTED':
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.PROVIDER_REVIEW_PENDING,
            actor_role=actor_role,
            action=WorkflowAction.PROVIDER_REQUEST_INFO,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.NEEDS_INFO
        placement.provider_response_notes = notes
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by = request.user
        placement.save(update_fields=[
            'provider_response_status',
            'provider_response_notes',
            'provider_response_recorded_at',
            'provider_response_recorded_by',
            'updated_at',
        ])
        if intake.workflow_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            intake.workflow_state = WorkflowState.PROVIDER_REVIEW_PENDING
            intake.save(update_fields=['workflow_state', 'updated_at'])
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=WorkflowState.PROVIDER_REVIEW_PENDING,
            action=WorkflowAction.PROVIDER_REQUEST_INFO,
            placement=placement,
            reason=notes,
            source='provider_decision_api',
        )
        return JsonResponse({'ok': True, 'nextPage': 'beoordelingen', 'caseId': str(intake.pk)})

    return JsonResponse({'ok': False, 'error': 'Ongeldige providerbeslissing.'}, status=400)


@login_required
@require_http_methods(["POST"])
def placement_action_api(request, case_id):
    organization = get_user_organization(request.user)
    intake = get_scoped_object_or_404(
        CaseIntakeProcess.objects.select_related('contract'),
        organization,
        pk=case_id,
    )
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'ok': False, 'error': 'Ongeldige JSON payload.'}, status=400)

    placement = (
        PlacementRequest.objects
        .filter(due_diligence_process=intake)
        .select_related('selected_provider', 'proposed_provider')
        .order_by('-updated_at')
        .first()
    )
    if placement is None:
        return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

    requested_status = str(payload.get('status') or '').strip().upper()
    note = (payload.get('note') or payload.get('comment') or '').strip()
    previous_state = derive_workflow_state(intake=intake, placement=placement)

    if requested_status == PlacementRequest.Status.APPROVED:
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.PLACEMENT_CONFIRMED,
            actor_role=actor_role,
            action=WorkflowAction.CONFIRM_PLACEMENT,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        allowed, blocker = placement.can_transition_to_status(PlacementRequest.Status.APPROVED)
        if not allowed:
            return JsonResponse({'ok': False, 'error': blocker or 'Plaatsing kan niet worden bevestigd.'}, status=400)

        placement.status = PlacementRequest.Status.APPROVED
        if note:
            existing = placement.decision_notes or ''
            stamped_note = f"[{timezone.now().strftime('%d-%m-%Y %H:%M')}] {note}"
            placement.decision_notes = f"{existing}\n{stamped_note}".strip()
            placement.save(update_fields=['status', 'decision_notes', 'updated_at'])
        else:
            placement.save(update_fields=['status', 'updated_at'])

        if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.PLAATSING:
            intake.case_record.case_phase = CareCase.CasePhase.PLAATSING
            intake.case_record.save(update_fields=['case_phase', 'updated_at'])

        new_state = WorkflowState.PLACEMENT_CONFIRMED
        if intake.workflow_state != new_state:
            intake.workflow_state = new_state
            intake.save(update_fields=['workflow_state', 'updated_at'])
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=new_state,
            action=WorkflowAction.CONFIRM_PLACEMENT,
            placement=placement,
            reason=note,
            source='placement_action_api',
        )
        return JsonResponse({'ok': True, 'nextPage': 'intake', 'caseId': str(intake.pk)})

    if requested_status == PlacementRequest.Status.REJECTED:
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.MATCHING_READY,
            actor_role=actor_role,
            action=WorkflowAction.REMATCH,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)
        if placement.provider_response_status not in normalize_provider_rejection_states():
            return JsonResponse({'ok': False, 'error': 'Rematch kan alleen na aanbiederafwijzing.'}, status=400)

        placement.status = PlacementRequest.Status.REJECTED
        placement.save(update_fields=['status', 'updated_at'])
        intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        intake.workflow_state = WorkflowState.MATCHING_READY
        intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
        if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.MATCHING:
            intake.case_record.case_phase = CareCase.CasePhase.MATCHING
            intake.case_record.save(update_fields=['case_phase', 'updated_at'])

        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state=previous_state,
            new_state=WorkflowState.MATCHING_READY,
            action=WorkflowAction.REMATCH,
            placement=placement,
            reason=note,
            source='placement_action_api',
        )
        return JsonResponse({'ok': True, 'nextPage': 'matching', 'caseId': str(intake.pk)})

    return JsonResponse({'ok': False, 'error': 'Ongeldige plaatsingsactie.'}, status=400)


@login_required
@require_http_methods(["POST"])
def intake_action_api(request, case_id):
    organization = get_user_organization(request.user)
    intake = get_scoped_object_or_404(
        CaseIntakeProcess.objects.select_related('contract'),
        organization,
        pk=case_id,
    )
    if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
        return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error

    placement = (
        PlacementRequest.objects
        .filter(due_diligence_process=intake)
        .order_by('-updated_at')
        .first()
    )
    if placement is None:
        return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

    previous_state = derive_workflow_state(intake=intake, placement=placement)
    transition = evaluate_transition(
        current_state=previous_state,
        target_state=WorkflowState.INTAKE_STARTED,
        actor_role=actor_role,
        action=WorkflowAction.START_INTAKE,
    )
    if not transition.allowed:
        return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

    intake.status = CaseIntakeProcess.ProcessStatus.COMPLETED
    intake.workflow_state = WorkflowState.INTAKE_STARTED
    intake.save(update_fields=['status', 'workflow_state', 'updated_at'])
    if intake.case_record is not None and intake.case_record.case_phase != CareCase.CasePhase.ACTIEF:
        intake.case_record.case_phase = CareCase.CasePhase.ACTIEF
        intake.case_record.save(update_fields=['case_phase', 'updated_at'])

    new_state = WorkflowState.INTAKE_STARTED
    log_transition_event(
        intake=intake,
        actor_user=request.user,
        actor_role=actor_role,
        old_state=previous_state,
        new_state=new_state,
        action=WorkflowAction.START_INTAKE,
        placement=placement,
        source='intake_action_api',
    )
    return JsonResponse({'ok': True, 'nextPage': 'intake', 'caseId': str(intake.pk)})


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def intake_create_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN},
    )
    if role_error is not None:
        return role_error

    form = CaseIntakeProcessForm(data=payload)

    coordinator_field = form.fields['case_coordinator']
    if organization:
        coordinator_field.queryset = coordinator_field.queryset.filter(
            organization_memberships__organization=organization,
            organization_memberships__is_active=True,
        ).distinct().order_by('first_name', 'last_name', 'username')

    if not form.is_valid():
        return JsonResponse({'errors': _flatten_form_errors(form)}, status=400)

    set_organization_on_instance(form.instance, organization)
    if not form.instance.start_date:
        form.instance.start_date = date.today()
    form.instance.workflow_state = WorkflowState.DRAFT_CASE

    intake = form.save()
    case_record = intake.ensure_case_record(created_by=request.user)
    try:
        log_action(
            request.user,
            'CREATE',
            'CaseIntakeProcess',
            intake.id,
            str(intake),
            request=request,
        )
    except Exception:
        logger.exception(
            "Intake create audit logging failed for intake_id=%s user_id=%s",
            intake.id,
            getattr(request.user, "id", None),
        )
    try:
        log_transition_event(
            intake=intake,
            actor_user=request.user,
            actor_role=actor_role,
            old_state='NONE',
            new_state=WorkflowState.DRAFT_CASE,
            action=WorkflowAction.CREATE_CASE,
            source='intake_create_api',
        )
    except Exception:
        logger.exception(
            "Intake create transition logging failed for intake_id=%s user_id=%s",
            intake.id,
            getattr(request.user, "id", None),
        )

    case_pk = case_record.pk if case_record else intake.pk
    return JsonResponse({
        'ok': True,
        'id': intake.pk,
        'title': intake.title,
        'case_id': str(case_record.pk) if case_record else '',
        'redirect_url': f'/care/cases/{case_pk}/',
    })


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def assessments_api(request):
    organization = get_user_organization(request.user)
    try:
        intakes = CaseIntakeProcess.objects.filter(organization=organization).exclude(status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
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
        qs = PlacementRequest.objects.for_organization(organization).exclude(
            due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED
        ).select_related(
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
        qs = CareSignal.objects.for_organization(organization).exclude(
            Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
            | Q(case_record__lifecycle_stage='ARCHIVED')
        ).select_related(
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
        qs = CareTask.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
        ).select_related(
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
        ).select_related('provider_profile').prefetch_related(
            'provider_profile__served_regions__served_municipalities',
            'provider_profile__secondary_served_regions',
        )
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
            location = _provider_location_payload(pp) if pp else {
                'label': client.city or 'Locatie ontbreekt',
                'latitude': None,
                'longitude': None,
                'region_label': '',
                'municipality_label': '',
                'has_coordinates': False,
            }
            regions_payload = _provider_regions_payload(pp)
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
                'latitude': location['latitude'],
                'longitude': location['longitude'],
                'hasCoordinates': location['has_coordinates'],
                'locationLabel': location['label'],
                'regionLabel': location['region_label'] or regions_payload['primary_region_label'],
                'municipalityLabel': location['municipality_label'],
                'secondaryRegionLabels': regions_payload['secondary_region_labels'],
                'allRegionLabels': regions_payload['all_region_labels'],
            })
        return JsonResponse({'providers': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages, 'workspace_summary': build_provider_workspace_summary(list(qs))})
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


def _normalize_region_key(value):
    return (value or '').strip().lower()


def _days_in_current_phase(case):
    if case.phase_entered_at:
        phase_date = case.phase_entered_at.date()
    elif case.updated_at:
        phase_date = case.updated_at.date()
    elif case.created_at:
        phase_date = case.created_at.date()
    else:
        phase_date = date.today()
    return max((date.today() - phase_date).days, 0)


def _is_active_case(case):
    completed_statuses = {
        CareCase.Status.COMPLETED,
        CareCase.Status.CANCELLED,
        CareCase.Status.TERMINATED,
        CareCase.Status.EXPIRED,
    }
    if case.case_phase == CareCase.CasePhase.AFGEROND:
        return False
    if case.status in completed_statuses:
        return False
    return True


def _compute_region_status(metrics):
    if (
        (metrics['beschikbare_capaciteit'] == 0 and metrics['actieve_casussen'] > 0)
        or metrics['urgente_casussen_zonder_match'] >= 4
        or metrics['gemiddelde_wachttijd_dagen'] > 42
        or metrics['vastgelopen_casussen'] >= 5
    ):
        return 'kritiek'

    if (
        metrics['capaciteitsratio'] < 0.2
        or metrics['urgente_casussen_zonder_match'] >= 2
        or metrics['gemiddelde_wachttijd_dagen'] > 28
        or metrics['vastgelopen_casussen'] >= 3
    ):
        return 'tekort'

    if (
        metrics['capaciteitsratio'] < 0.4
        or metrics['urgente_casussen_zonder_match'] >= 1
        or metrics['gemiddelde_wachttijd_dagen'] > 14
        or metrics['vastgelopen_casussen'] >= 1
    ):
        return 'druk'

    return 'stabiel'


def _build_signal_summary(status, metrics):
    if status == 'stabiel':
        return 'Geen capaciteitsproblemen'

    if metrics['beschikbare_capaciteit'] == 0 and metrics['actieve_casussen'] > 0:
        return 'Geen beschikbare capaciteit'

    urgent = metrics['urgente_casussen_zonder_match']
    if urgent > 0:
        return '1 urgente casus zonder match' if urgent == 1 else f'{urgent} urgente casussen zonder match'

    if metrics['gemiddelde_wachttijd_dagen'] > 14:
        return 'Wachttijd boven norm'

    stuck = metrics['vastgelopen_casussen']
    if stuck > 0:
        return '1 vastgelopen casus' if stuck == 1 else f'{stuck} vastgelopen casussen'

    if metrics['capaciteitsratio'] < 0.4:
        return 'Capaciteit onder druk'

    return 'Capaciteit onder druk'


def _build_region_health_payload(region, region_cases, region_provider_profiles):
    actieve_cases = [case for case in region_cases if _is_active_case(case)]
    actieve_count = len(actieve_cases)

    beschikbare_capaciteit = sum(max(profile.current_capacity or 0, 0) for profile in region_provider_profiles)
    gemiddelde_wachttijd_dagen = (
        round(sum(_days_in_current_phase(case) for case in actieve_cases) / actieve_count)
        if actieve_count > 0
        else 0
    )

    urgente_zonder_match = 0
    vastgelopen = 0
    for case in actieve_cases:
        days_in_phase = _days_in_current_phase(case)
        is_urgent = case.risk_level in {CareCase.RiskLevel.HIGH, CareCase.RiskLevel.CRITICAL}

        if is_urgent and not (case.preferred_provider or '').strip():
            urgente_zonder_match += 1

        if case.case_phase == CareCase.CasePhase.PROVIDER_BEOORDELING and days_in_phase > 3:
            vastgelopen += 1
        elif case.case_phase == CareCase.CasePhase.MATCHING:
            threshold = 2 if is_urgent else 5
            if days_in_phase > threshold:
                vastgelopen += 1
        elif case.case_phase == CareCase.CasePhase.PLAATSING and days_in_phase > 5:
            vastgelopen += 1

    capaciteitsratio = (beschikbare_capaciteit / actieve_count) if actieve_count > 0 else 1

    metrics = {
        'actieve_casussen': actieve_count,
        'beschikbare_capaciteit': beschikbare_capaciteit,
        'capaciteitsratio': round(capaciteitsratio, 2),
        'gemiddelde_wachttijd_dagen': gemiddelde_wachttijd_dagen,
        'urgente_casussen_zonder_match': urgente_zonder_match,
        'vastgelopen_casussen': vastgelopen,
    }

    status = _compute_region_status(metrics)
    status_label = {
        'stabiel': 'Stabiel',
        'druk': 'Druk',
        'tekort': 'Tekort',
        'kritiek': 'Kritiek',
    }[status]
    signal_summary = _build_signal_summary(status, metrics)

    metrics.update({
        'status': status,
        'status_label': status_label,
        'heeft_tekort': status in {'tekort', 'kritiek'},
        'heeft_hoge_wachttijd': metrics['gemiddelde_wachttijd_dagen'] > 14,
        'heeft_kritiek_signaal': status == 'kritiek',
        'signaal_samenvatting': signal_summary,
        'providerCountComputed': len(region_provider_profiles),
    })
    return metrics


@login_required
@require_http_methods(["GET"])
def provider_evaluations_list_api(request):
    """List provider-side evaluations for the SPA (Aanbieder Beoordeling).

    Returns an empty list until a dedicated evaluation model is wired; the
    client hook degrades gracefully when this endpoint is absent or empty.
    """
    organization = get_user_organization(request.user)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)
    return JsonResponse({'evaluations': [], 'total_count': 0})


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


@login_required
@require_http_methods(["GET"])
def regions_health_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = RegionalConfiguration.objects.filter(organization=organization)
        q = request.GET.get('q', '')
        if q:
            qs = qs.filter(Q(region_name__icontains=q) | Q(region_code__icontains=q))

        region_type = request.GET.get('region_type', '')
        if region_type:
            qs = qs.filter(region_type=region_type)

        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 100))
        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)

        cases_qs = scope_queryset_for_organization(CareCase.objects.all(), organization).only(
            'id', 'service_region', 'status', 'case_phase', 'risk_level', 'preferred_provider',
            'phase_entered_at', 'updated_at', 'created_at',
        )
        all_cases = list(cases_qs)

        provider_clients = list(
            Client.objects.filter(
                organization=organization,
                client_type='CORPORATION',
            ).select_related('provider_profile').prefetch_related(
                'provider_profile__served_regions',
                'provider_profile__secondary_served_regions',
            )
        )

        cases_by_region_key = {}
        for case in all_cases:
            service_key = _normalize_region_key(case.service_region)
            if not service_key:
                continue
            cases_by_region_key.setdefault(service_key, []).append(case)

        profiles_by_region_id = {}
        for client in provider_clients:
            profile = getattr(client, 'provider_profile', None)
            if profile is None:
                continue

            region_ids = set(profile.served_regions.values_list('id', flat=True))
            region_ids.update(profile.secondary_served_regions.values_list('id', flat=True))
            for region_id in region_ids:
                profiles_by_region_id.setdefault(region_id, []).append(profile)

        data = []
        for region in page_obj:
            keys = {
                _normalize_region_key(region.region_name),
                _normalize_region_key(region.region_code),
            }
            region_cases = []
            for key in keys:
                region_cases.extend(cases_by_region_key.get(key, []))

            # Deduplicate cases when region name/code resolve to the same key.
            seen_case_ids = set()
            deduped_cases = []
            for case in region_cases:
                if case.id in seen_case_ids:
                    continue
                seen_case_ids.add(case.id)
                deduped_cases.append(case)

            region_profiles = profiles_by_region_id.get(region.id, [])
            health = _build_region_health_payload(region, deduped_cases, region_profiles)

            data.append({
                'id': str(region.id),
                'name': region.region_name,
                'code': region.region_code,
                'regionType': region.region_type,
                'configurationStatus': region.status,
                'maxWaitDays': region.max_wait_days,
                'providerCount': region.provider_count,
                'municipalityCount': region.municipality_count,
                'coordinator': region.responsible_coordinator.get_full_name() if region.responsible_coordinator else '',
                'province': region.province,
                'regionTypeLabel': RegionType(region.region_type).label if region.region_type in RegionType.values else region.region_type,
                **health,
            })

        return JsonResponse({
            'regions': data,
            'total_count': paginator.count,
            'page': page,
            'total_pages': paginator.num_pages,
        })
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
        cases_qs = scope_queryset_for_organization(CareCase.objects.all(), organization).exclude(lifecycle_stage='ARCHIVED')
        signals_qs = CareSignal.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
            | Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
        )
        tasks_qs = CareTask.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
        )

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
