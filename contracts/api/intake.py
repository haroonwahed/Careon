"""
Intake API views and serializer helpers.
"""
import json
import logging
from datetime import date

from django.http import Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.db import transaction

from contracts.forms import CaseIntakeProcessForm
from contracts.governance import AuditLoggingError, log_case_decision_event
from contracts.middleware import log_action
from contracts.models import (
    CaseIntakeProcess,
    RegionType,
)
from contracts.tenancy import (
    get_user_organization,
    set_organization_on_instance,
)
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    log_transition_event,
    resolve_actor_role,
)

from contracts.api._helpers import (
    _active_organization,
    _derive_aanmelder_actor_profile_for_intake,
    _internal_server_error,
    _require_workflow_role,
)

logger = logging.getLogger(__name__)


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


def _serialize_taxonomy_choices(field):
    serialized = []
    for obj in field.queryset:
        payload = {
            'value': str(obj.pk),
            'label': str(field.label_from_instance(obj)),
            'code': getattr(obj, 'code', '') or '',
            'visibleInMvp': bool(getattr(obj, 'visible_in_mvp', True)),
            'sortOrder': int(getattr(obj, 'order', 0) or 0),
        }
        main_category = getattr(obj, 'main_category', None)
        if main_category is not None:
            payload['mainCategoryId'] = str(main_category.pk)
            payload['parentCategory'] = {
                'id': str(main_category.pk),
                'code': getattr(main_category, 'code', '') or '',
                'label': getattr(main_category, 'name', '') or '',
            }
        serialized.append(payload)
    return serialized


def _serialize_unique_municipality_choices(field):
    serialized = []
    seen = set()
    for obj in field.queryset.prefetch_related('regions'):
        label = (getattr(obj, 'municipality_name', '') or str(field.label_from_instance(obj))).strip()
        dedupe_key = label.casefold()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        # Use Python-level filtering to avoid bypassing the prefetch cache.
        region = next(
            (r for r in obj.regions.all() if getattr(r, 'region_type', None) == RegionType.JEUGDREGIO),
            None,
        )
        region_label = (getattr(region, 'region_name', '') or str(region)).strip() if region else ''
        serialized.append({
            'value': str(obj.pk),
            'label': label,
            'urgencyDocumentRequestUrl': getattr(obj, 'urgency_document_request_url', '') or '',
            'regio': str(region.pk) if region else '',
            'regioLabel': region_label,
        })
    return serialized


def _serialize_unique_region_choices(field):
    serialized = []
    seen = set()
    for obj in field.queryset:
        label = (getattr(obj, 'region_name', '') or str(field.label_from_instance(obj))).strip()
        dedupe_key = label.casefold()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        serialized.append({
            'value': str(obj.pk),
            'label': label,
        })
    return serialized


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
        care_category_sub = _serialize_taxonomy_choices(care_category_sub_field)

    def _model_options(field_name):
        field = form.fields.get(field_name)
        if field is None:
            return []
        if field_name == 'gemeente':
            return _serialize_unique_municipality_choices(field)
        if field_name in {'jeugdhulpregio', 'regio', 'preferred_region'}:
            return _serialize_unique_region_choices(field)
        return _serialize_model_choices(field)

    def _simple_options(field_name):
        field = form.fields.get(field_name)
        if field is None:
            return []
        return _serialize_simple_choices(field)

    return {
        'initial_values': {
            'title': '',
            'source_reference': '',
            'start_date': date.today().isoformat(),
            'target_completion_date': '',
            'care_category_main': str(form.initial.get('care_category_main') or ''),
            'care_category_sub': '',
            'assessment_summary': '',
            'gemeente': '',
            'regio': str(form.initial.get('regio') or form.initial.get('preferred_region') or form.initial.get('jeugdhulpregio') or ''),
            'jeugdhulpregio': str(form.initial.get('jeugdhulpregio') or form.initial.get('preferred_region') or form.initial.get('regio') or ''),
            'urgency': CaseIntakeProcess.Urgency.MEDIUM,
            'complexity': '',
            'placement_pressure_horizon': CaseIntakeProcess.PlacementPressureHorizon.MORE_THAN_TWO_WEEKS,
            'safety_pressure': False,
            'time_sensitive_arrangement': False,
            'escalation_needed': False,
            'placement_pressure_notes': '',
            'has_urgency_declaration': False,
            'urgency_applied': False,
            'urgency_applied_since': '',
            'diagnostiek': [],
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': form.initial.get('preferred_region_type', RegionType.JEUGDREGIO),
            'preferred_region': str(form.initial.get('preferred_region') or form.initial.get('jeugdhulpregio') or form.initial.get('regio') or ''),
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
            'care_category_main': _serialize_taxonomy_choices(form.fields['care_category_main']) if form.fields.get('care_category_main') is not None else [],
            'care_category_sub': care_category_sub,
            'gemeente': _model_options('gemeente'),
            'jeugdhulpregio': _model_options('jeugdhulpregio'),
            'regio': _model_options('regio'),
            'urgency': _simple_options('urgency'),
            'complexity': _simple_options('complexity'),
            'placement_pressure_horizon': _simple_options('placement_pressure_horizon'),
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


@login_required
@require_http_methods(["GET"])
def intake_form_options_api(request):
    try:
        organization = _active_organization(request)
        form = CaseIntakeProcessForm(organization=organization)

        coordinator_field = form.fields.get('case_coordinator')
        if organization and coordinator_field is not None:
            coordinator_field.queryset = coordinator_field.queryset.filter(
                organization_memberships__organization=organization,
                organization_memberships__is_active=True,
            ).distinct().order_by('first_name', 'last_name', 'username')

        response = JsonResponse(_build_intake_form_payload(form, coordinator_field))
        # Options are reference data that rarely change; allow browser/CDN to cache for 5 min.
        response['Cache-Control'] = 'private, max-age=300'
        return response
    except Exception as e:
        return JsonResponse({'error': f'Intake-form kon niet worden opgebouwd: {str(e)}'}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def intake_create_api(request):
    try:
        if request.FILES:
            payload = request.POST
            uploaded_files = request.FILES
        else:
            payload = json.loads(request.body or '{}')
            uploaded_files = None
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    if uploaded_files is not None:
        from django.conf import settings
        max_mb = getattr(settings, 'CAREON_MAX_DOCUMENT_UPLOAD_MB', 20)
        max_bytes = max_mb * 1024 * 1024
        for field_name, f in uploaded_files.items():
            if f.size > max_bytes:
                return JsonResponse(
                    {'error': f'Bestand "{f.name}" is te groot (max {max_mb} MB).'},
                    status=413,
                )

    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.GEMEENTE, WorkflowRole.ADMIN, WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error

    if uploaded_files is not None:
        form = CaseIntakeProcessForm(data=payload, files=uploaded_files, organization=organization)
    else:
        form = CaseIntakeProcessForm(data=payload, organization=organization)

    coordinator_field = form.fields['case_coordinator']
    if organization:
        coordinator_field.queryset = coordinator_field.queryset.filter(
            organization_memberships__organization=organization,
            organization_memberships__is_active=True,
        ).distinct().order_by('first_name', 'last_name', 'username')

    if not form.is_valid():
        return JsonResponse({'errors': _flatten_form_errors(form)}, status=400)

    try:
        with transaction.atomic():
            set_organization_on_instance(form.instance, organization)
            if not form.instance.start_date:
                form.instance.start_date = date.today()
            entry_route = str(payload.get('entry_route') or payload.get('entryRoute') or '').strip().upper()
            if entry_route == CaseIntakeProcess.EntryRoute.WIJKTEAM:
                form.instance.entry_route = CaseIntakeProcess.EntryRoute.WIJKTEAM
                form.instance.workflow_state = WorkflowState.WIJKTEAM_INTAKE
            else:
                form.instance.entry_route = CaseIntakeProcess.EntryRoute.STANDARD
                form.instance.workflow_state = WorkflowState.DRAFT_CASE

            form.instance.aanmelder_actor_profile = _derive_aanmelder_actor_profile_for_intake(
                actor_role=actor_role,
                entry_route=form.instance.entry_route,
            )
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
            except Exception as exc:
                logger.exception(
                    "Intake create CREATE audit log failed for intake_id=%s user_id=%s",
                    intake.id,
                    getattr(request.user, "id", None),
                )
                raise AuditLoggingError(
                    'Kan auditlog voor nieuwe casus niet vastleggen.'
                ) from exc
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state='NONE',
                new_state=intake.workflow_state or WorkflowState.DRAFT_CASE,
                action=WorkflowAction.CREATE_CASE,
                source='intake_create_api',
            )

        # Compute system classification proposal
        try:
            from contracts.classification_engine import compute_classification
            proposal = compute_classification(intake)
            intake.proposed_complexity = proposal.proposed_complexity
            intake.proposed_care_intensity = proposal.proposed_care_intensity
            intake.complexity = proposal.proposed_complexity
            intake.care_intensity = proposal.proposed_care_intensity
            intake.classification_rationale = {
                'criteria': [
                    {'label': c.label, 'value': c.value, 'signal': c.signal, 'toelichting': c.toelichting}
                    for c in proposal.criteria
                ],
                'explanation': proposal.explanation,
            }
            intake.complexity_status = CaseIntakeProcess.ClassificationStatus.SYSTEM_PROPOSED
            intake.care_intensity_status = CaseIntakeProcess.ClassificationStatus.SYSTEM_PROPOSED
            intake.save(update_fields=[
                'proposed_complexity', 'proposed_care_intensity',
                'complexity', 'care_intensity',
                'classification_rationale', 'complexity_status', 'care_intensity_status',
            ])
        except Exception:
            logger.exception('classification_engine_failed intake_id=%s', intake.pk)

        case_pk = case_record.pk if case_record else intake.pk
        return JsonResponse({
            'ok': True,
            'id': intake.pk,
            'title': intake.title,
            'source_reference': intake.source_reference,
            'case_id': str(case_record.pk) if case_record else '',
            'redirect_url': f'/care/cases/{case_pk}/',
            'routing': intake.routing_summary,
        })
    except AuditLoggingError as exc:
        logger.exception(
            "Intake create blocked: audit logging required intake_create_api user_id=%s",
            getattr(request.user, "id", None),
        )
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)
    except Exception:
        logger.exception(
            "Intake create failed for user_id=%s org_id=%s payload_keys=%s",
            getattr(request.user, "id", None),
            getattr(organization, "id", None),
            sorted(payload.keys()) if isinstance(payload, dict) else [],
        )
        return JsonResponse(
            {
                'ok': False,
                'error': 'Nieuwe casus kon niet worden geladen. Probeer opnieuw of neem contact op met support.',
            },
            status=500,
        )


@login_required
@require_http_methods(["POST"])
def intake_action_api(request, case_id):
    try:
        return _intake_action_api_inner(request, case_id)
    except Http404:
        return JsonResponse({'ok': False, 'error': 'Casus niet gevonden.'}, status=404)
    except AuditLoggingError as exc:
        return JsonResponse({'ok': False, 'error': str(exc)}, status=503)


def _intake_action_api_inner(request, case_id):
    from django.http import Http404
    from contracts.workflow_state_machine import evaluate_transition
    from contracts.models import PlacementRequest
    from contracts.api._helpers import _get_intake_for_case_api_id

    organization = get_user_organization(request.user)
    actor_role, role_error = _require_workflow_role(
        user=request.user,
        organization=organization,
        allowed_roles={WorkflowRole.ZORGAANBIEDER},
    )
    if role_error is not None:
        return role_error

    with transaction.atomic():
        intake = _get_intake_for_case_api_id(case_id, organization, lock=True, user=request.user)
        if intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return JsonResponse({'ok': False, 'error': 'Casus is gearchiveerd.'}, status=400)

        placement = (
            PlacementRequest.objects
            .select_for_update(of=('self',))
            .filter(due_diligence_process=intake)
            .order_by('-updated_at')
            .first()
        )
        if placement is None:
            return JsonResponse({'ok': False, 'error': 'Nog geen plaatsing beschikbaar.'}, status=400)

        from contracts.workflow_state_machine import derive_workflow_state
        previous_state = derive_workflow_state(intake=intake, placement=placement)
        transition = evaluate_transition(
            current_state=previous_state,
            target_state=WorkflowState.INTAKE_STARTED,
            actor_role=actor_role,
            action=WorkflowAction.START_INTAKE,
        )
        if not transition.allowed:
            return JsonResponse({'ok': False, 'error': transition.reason}, status=400)

        from contracts.models import CareCase
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
        intake.refresh_from_db()
        placement.refresh_from_db()
        state_after_intake = derive_workflow_state(intake=intake, placement=placement)
        activate = evaluate_transition(
            current_state=state_after_intake,
            target_state=WorkflowState.ACTIVE_PLACEMENT,
            actor_role=actor_role,
            action=WorkflowAction.ACTIVATE_PLACEMENT_MONITORING,
        )
        if activate.allowed:
            intake.workflow_state = WorkflowState.ACTIVE_PLACEMENT
            intake.save(update_fields=['workflow_state', 'updated_at'])
            log_transition_event(
                intake=intake,
                actor_user=request.user,
                actor_role=actor_role,
                old_state=state_after_intake,
                new_state=WorkflowState.ACTIVE_PLACEMENT,
                action=WorkflowAction.ACTIVATE_PLACEMENT_MONITORING,
                placement=placement,
                source='intake_action_api',
            )
        return JsonResponse({'ok': True, 'nextPage': 'intake', 'caseId': str(intake.pk)})
