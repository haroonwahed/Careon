
"""
API views for CareOn case workspace functionality.
"""
import json
from datetime import date

from django.utils import timezone

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Q, Count
from django.urls import reverse

from contracts.domain.contracts import CareCaseData, ListParams, ListResult
from contracts.forms import CaseIntakeProcessForm
from contracts.middleware import log_action
from contracts.models import (
    CareCase, CaseAssessment, PlacementRequest, CareSignal, CareTask,
    Document, AuditLog, Client, ProviderProfile,
    MunicipalityConfiguration, RegionalConfiguration, CaseIntakeProcess, RegionType,
)
from contracts.tenancy import get_user_organization, scope_queryset_for_organization, set_organization_on_instance
from contracts.provider_workspace import build_provider_workspace_summary
from contracts.provider_matching_service import MatchContext, MatchEngine


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

    # Urgency validation + arrangement fields from linked intake
    intake = getattr(case, 'due_diligence_process', None)
    if intake is not None:
        result['urgency'] = intake.urgency or ''
        result['urgency_validated'] = intake.urgency_validated
        result['urgency_document_present'] = bool(intake.urgency_document)
        result['urgency_granted_date'] = (
            intake.urgency_granted_date.isoformat() if intake.urgency_granted_date else None
        )
        result['waitlist_bucket'] = 0 if (intake.urgency_validated and intake.urgency_granted_date) else 1
        result['intake_start_date'] = intake.start_date.isoformat() if intake.start_date else None
        result['arrangement_type_code'] = intake.arrangement_type_code or ''
        result['arrangement_provider'] = intake.arrangement_provider or ''
        result['arrangement_end_date'] = (
            intake.arrangement_end_date.isoformat() if intake.arrangement_end_date else None
        )
    else:
        result['urgency'] = ''
        result['urgency_validated'] = False
        result['urgency_document_present'] = False
        result['urgency_granted_date'] = None
        result['waitlist_bucket'] = 1
        result['intake_start_date'] = None
        result['arrangement_type_code'] = ''
        result['arrangement_provider'] = ''
        result['arrangement_end_date'] = None
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
        )

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


def _apply_intake_create_defaults(instance):
    if hasattr(instance, 'contra_indicaties') and instance.contra_indicaties is None:
        instance.contra_indicaties = ''
    if hasattr(instance, 'problematiek_types') and instance.problematiek_types is None:
        instance.problematiek_types = []
    if hasattr(instance, 'zorgvorm_gewenst') and instance.zorgvorm_gewenst is None:
        instance.zorgvorm_gewenst = ''
    if hasattr(instance, 'setting_voorkeur') and instance.setting_voorkeur is None:
        instance.setting_voorkeur = ''


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


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def intake_create_api(request):
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    if payload.get('contra_indicaties') is None:
        payload['contra_indicaties'] = ''
    if payload.get('problematiek_types') is None:
        payload['problematiek_types'] = ''
    if payload.get('zorgvorm_gewenst') is None:
        payload['zorgvorm_gewenst'] = ''
    if payload.get('setting_voorkeur') is None:
        payload['setting_voorkeur'] = ''

    organization = get_user_organization(request.user)
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
    _apply_intake_create_defaults(form.instance)
    if not form.instance.start_date:
        form.instance.start_date = date.today()

    intake = form.save()
    case_record = intake.ensure_case_record(created_by=request.user)
    log_action(
        request.user,
        'CREATE',
        'CaseIntakeProcess',
        intake.id,
        str(intake),
        request=request,
    )

    return JsonResponse({
        'ok': True,
        'id': intake.pk,
        'case_id': str(case_record.pk),
        'title': intake.title,
        'redirect_url': f"{reverse('dashboard')}?page=casussen&case={case_record.pk}",
    })


# ---------------------------------------------------------------------------
# Assessments
# ---------------------------------------------------------------------------

NOT_ASSIGNABLE_REASON_PREFIX = 'NOT_ASSIGNABLE::'


def _simple_choice_payload(choices):
    return [{'value': value, 'label': label} for value, label in choices]


def _serialize_decision_consequences():
    return {
        'matching': {
            'title': 'Casus gaat door naar matching',
            'description': 'Beoordeling wordt afgerond en de casus schuift direct door naar de matchingstap.',
        },
        'needs_info': {
            'title': 'Casus blijft in beoordeling',
            'description': 'Er is aanvullende informatie nodig voordat matching verantwoord kan starten.',
        },
        'not_assignable': {
            'title': 'Casus wordt geblokkeerd voor matching',
            'description': 'De casus blijft buiten matching totdat randvoorwaarden of geschiktheid fundamenteel veranderen.',
        },
    }


def _infer_assessment_decision(assessment):
    if assessment is None:
        return ''
    reason = str(assessment.reason_not_ready or '').strip()
    if reason.startswith(NOT_ASSIGNABLE_REASON_PREFIX):
        return 'not_assignable'
    if assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING and assessment.matching_ready:
        return 'matching'
    if assessment.assessment_status == CaseAssessment.AssessmentStatus.NEEDS_INFO:
        return 'needs_info'
    return ''


def _clean_reason_text(reason):
    reason_text = str(reason or '').strip()
    if reason_text.startswith(NOT_ASSIGNABLE_REASON_PREFIX):
        return reason_text[len(NOT_ASSIGNABLE_REASON_PREFIX):].strip()
    return reason_text


def _matching_difficulty_payload(intake, signal_codes, signals):
    score = 0
    reasons = []

    if intake.urgency in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS}:
        score += 1
        reasons.append('urgentie is hoog')
    if intake.complexity == CaseIntakeProcess.Complexity.SEVERE:
        score += 1
        reasons.append('complexiteit is zwaar')
    if not intake.preferred_region_id and not intake.regio_id:
        score += 1
        reasons.append('regio is nog niet scherp')
    if {'SAFETY', 'ESCALATION'} & set(signal_codes):
        score += 1
        reasons.append('er zijn kritieke randvoorwaarden')
    if len(signals) >= 2:
        score += 1
        reasons.append('meerdere signalen vragen extra afstemming')

    if score >= 4:
        level = 'Hoog'
    elif score >= 2:
        level = 'Middel'
    else:
        level = 'Beheersbaar'

    detail = 'Geen directe blokkades op basis van huidige gegevens.'
    if reasons:
        detail = 'Moeilijkheid neemt toe omdat ' + ', '.join(reasons) + '.'

    return {
        'level': level,
        'detail': detail,
    }


def _assessment_risk_hints(intake, assessment, signals):
    hints = []
    if not str(intake.assessment_summary or '').strip():
        hints.append('Intake-samenvatting is beperkt; verifieer kerninformatie voordat je beslist.')
    if intake.urgency == CaseIntakeProcess.Urgency.CRISIS:
        hints.append('Crisisurgentie vraagt directe bevestiging van veiligheid en beschikbaarheid.')
    if intake.complexity == CaseIntakeProcess.Complexity.SEVERE:
        hints.append('Zware complexiteit vergroot de kans op beperkte matchopties.')
    if not intake.preferred_region_id and not intake.regio_id:
        hints.append('Regio ontbreekt of is niet bevestigd; matching wordt daardoor onnauwkeuriger.')
    if assessment and not assessment.matching_ready and assessment.assessment_status == CaseAssessment.AssessmentStatus.NEEDS_INFO:
        hints.append('Deze beoordeling stond al op aanvullende informatie nodig.')
    if any(signal.risk_level in {'CRITICAL', 'HIGH'} for signal in signals):
        hints.append('Er zijn signalen met verhoogd risico die de doorstroom kunnen blokkeren.')
    return hints[:3]


def _assessment_timeline(case_record, intake, assessment, signals, tasks):
    timeline = []
    if case_record.created_at:
        timeline.append({
            'label': 'Casus aangemaakt',
            'date': case_record.created_at.isoformat(),
            'tone': 'neutral',
        })
    if intake.start_date:
        timeline.append({
            'label': 'Intake gestart',
            'date': intake.start_date.isoformat(),
            'tone': 'neutral',
        })
    if assessment:
        timeline.append({
            'label': 'Beoordeling bijgewerkt',
            'date': assessment.updated_at.isoformat(),
            'tone': 'info',
        })
    if signals:
        latest_signal = signals[0]
        timeline.append({
            'label': latest_signal.title or latest_signal.get_signal_type_display(),
            'date': latest_signal.updated_at.isoformat(),
            'tone': 'warning' if latest_signal.risk_level in {'MEDIUM', 'HIGH', 'CRITICAL'} else 'neutral',
        })
    if tasks:
        next_task = tasks[0]
        if next_task.due_date:
            timeline.append({
                'label': next_task.title,
                'date': next_task.due_date.isoformat(),
                'tone': 'neutral',
            })
    timeline.sort(key=lambda item: item['date'], reverse=True)
    return timeline[:4]


def _serialize_assessment_decision_payload(case_record, organization):
    intake = getattr(case_record, 'due_diligence_process', None)
    if intake is None:
        return None

    assessment = getattr(intake, 'case_assessment', None)
    signals = list(
        CareSignal.objects.for_organization(organization)
        .filter(case_record=case_record)
        .select_related('assigned_to')
        .order_by('-updated_at', '-created_at')[:3]
    )
    tasks = list(
        CareTask.objects.for_organization(organization)
        .filter(case_record=case_record)
        .select_related('assigned_to')
        .order_by('due_date', '-created_at')[:2]
    )
    signal_codes = [code.strip() for code in (assessment.risk_signals or '').split(',') if code.strip()] if assessment else []
    summary_text = str((assessment.notes if assessment and assessment.notes else intake.assessment_summary or intake.description or '')).strip()
    decision = _infer_assessment_decision(assessment)
    region_label = ''
    if intake.regio_id and intake.regio:
        region_label = intake.regio.region_name
    elif intake.preferred_region_id and intake.preferred_region:
        region_label = intake.preferred_region.region_name

    return {
        'caseId': str(case_record.pk),
        'assessmentId': str(assessment.pk) if assessment else '',
        'intakeId': str(intake.pk),
        'title': case_record.title,
        'form': {
            'decision': decision,
            'zorgtype': intake.zorgvorm_gewenst or intake.preferred_care_form or CaseIntakeProcess.CareForm.OUTPATIENT,
            'shortDescription': summary_text,
            'urgency': intake.urgency or CaseIntakeProcess.Urgency.MEDIUM,
            'complexity': intake.complexity or CaseIntakeProcess.Complexity.SIMPLE,
            'constraints': signal_codes,
        },
        'options': {
            'decision': [
                {'value': 'matching', 'label': 'Door naar matching'},
                {'value': 'needs_info', 'label': 'Aanvullende info nodig'},
                {'value': 'not_assignable', 'label': 'Niet toewijsbaar'},
            ],
            'zorgtype': _simple_choice_payload(CaseIntakeProcess.CareForm.choices),
            'urgency': _simple_choice_payload(CaseIntakeProcess.Urgency.choices),
            'complexity': _simple_choice_payload(CaseIntakeProcess.Complexity.choices),
            'constraints': _simple_choice_payload(CaseAssessment.RiskSignal.choices),
        },
        'consequences': _serialize_decision_consequences(),
        'summary': {
            'caseId': str(case_record.pk),
            'title': case_record.title,
            'region': region_label or 'Nog niet bepaald',
            'municipality': intake.gemeente.municipality_name if intake.gemeente_id and intake.gemeente else 'Nog niet bepaald',
            'phase': case_record.case_phase,
            'waitDays': _days_in_current_phase(case_record),
            'careType': intake.zorgvorm_gewenst or intake.preferred_care_form or 'Onbekend',
            'coordinator': intake.case_coordinator.get_full_name() if intake.case_coordinator else 'Nog niet toegewezen',
            'ageCategory': intake.get_client_age_category_display() if intake.client_age_category else 'Onbekend',
            'familySituation': intake.get_family_situation_display() if intake.family_situation else 'Onbekend',
            'schoolWorkStatus': intake.school_work_status or 'Niet ingevuld',
            'intakeSummary': intake.assessment_summary or intake.description or 'Nog geen samenvatting beschikbaar.',
        },
        'hints': {
            'suggestedUrgency': {
                'value': intake.urgency,
                'label': intake.get_urgency_display(),
                'reason': 'Gebaseerd op de huidige intake en signalen in het dossier.',
            },
            'matchingDifficulty': _matching_difficulty_payload(intake, signal_codes, signals),
            'riskHints': _assessment_risk_hints(intake, assessment, signals),
        },
        'signals': [
            {
                'id': str(signal.pk),
                'title': signal.title or signal.get_signal_type_display(),
                'description': signal.description,
                'severity': 'critical' if signal.risk_level in {'HIGH', 'CRITICAL'} else 'warning' if signal.risk_level == 'MEDIUM' else 'info',
                'status': signal.status,
            }
            for signal in signals
        ],
        'timeline': _assessment_timeline(case_record, intake, assessment, signals, tasks),
        'meta': {
            'updatedAt': assessment.updated_at.isoformat() if assessment else '',
            'assessedBy': assessment.assessed_by.get_full_name() if assessment and assessment.assessed_by else '',
            'status': assessment.assessment_status if assessment else CaseAssessment.AssessmentStatus.DRAFT,
            'matchingReady': bool(assessment.matching_ready) if assessment else False,
            'reasonNotReady': _clean_reason_text(assessment.reason_not_ready) if assessment else '',
        },
    }


@login_required
@require_http_methods(["GET", "POST"])
def assessment_decision_api(request, case_id):
    organization = get_user_organization(request.user)
    queryset = scope_queryset_for_organization(
        CareCase.objects.select_related(
            'due_diligence_process',
            'due_diligence_process__case_assessment',
            'due_diligence_process__preferred_region',
            'due_diligence_process__regio',
            'due_diligence_process__gemeente',
            'due_diligence_process__case_coordinator',
        ),
        organization,
    )
    case_record = queryset.filter(pk=case_id).first()
    if case_record is None:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    intake = getattr(case_record, 'due_diligence_process', None)
    if intake is None:
        return JsonResponse({'error': 'Beoordeling is niet beschikbaar voor deze casus'}, status=404)

    if request.method == 'GET':
        payload = _serialize_assessment_decision_payload(case_record, organization)
        return JsonResponse(payload)

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    decision = str(payload.get('decision') or '').strip()
    zorgtype = str(payload.get('zorgtype') or '').strip()
    urgency = str(payload.get('urgency') or '').strip()
    complexity = str(payload.get('complexity') or '').strip()
    short_description = str(payload.get('shortDescription') or '').strip()
    constraints = payload.get('constraints') or []
    if not isinstance(constraints, list):
        constraints = []

    valid_decisions = {'matching', 'needs_info', 'not_assignable'}
    valid_care_types = {value for value, _ in CaseIntakeProcess.CareForm.choices}
    valid_urgencies = {value for value, _ in CaseIntakeProcess.Urgency.choices}
    valid_complexities = {value for value, _ in CaseIntakeProcess.Complexity.choices}
    valid_constraints = {value for value, _ in CaseAssessment.RiskSignal.choices}

    errors = {}
    if decision not in valid_decisions:
        errors['decision'] = 'Kies een beslissing om de beoordeling te bevestigen.'
    if zorgtype not in valid_care_types:
        errors['zorgtype'] = 'Kies een geldig zorgtype.'
    if urgency not in valid_urgencies:
        errors['urgency'] = 'Kies een geldige urgentie.'
    if complexity not in valid_complexities:
        errors['complexity'] = 'Kies een geldige complexiteit.'
    invalid_constraints = [item for item in constraints if item not in valid_constraints]
    if invalid_constraints:
        errors['constraints'] = 'Een of meer randvoorwaarden zijn ongeldig.'

    if errors:
        return JsonResponse({'errors': errors}, status=400)

    assessment, created = CaseAssessment.objects.get_or_create(
        due_diligence_process=intake,
        defaults={'assessed_by': request.user},
    )
    assessment.assessed_by = request.user
    assessment.risk_signals = ','.join(constraints)
    assessment.notes = short_description

    intake.zorgvorm_gewenst = zorgtype
    intake.preferred_care_form = zorgtype
    intake.urgency = urgency
    intake.complexity = complexity

    previous_phase = case_record.case_phase
    if decision == 'matching':
        assessment.assessment_status = CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
        assessment.matching_ready = True
        assessment.reason_not_ready = ''
        intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        case_record.case_phase = CareCase.CasePhase.MATCHING
    elif decision == 'needs_info':
        assessment.assessment_status = CaseAssessment.AssessmentStatus.NEEDS_INFO
        assessment.matching_ready = False
        assessment.reason_not_ready = short_description or 'Aanvullende informatie nodig.'
        intake.status = CaseIntakeProcess.ProcessStatus.INTAKE
        case_record.case_phase = CareCase.CasePhase.CASUS
    else:
        assessment.assessment_status = CaseAssessment.AssessmentStatus.NEEDS_INFO
        assessment.matching_ready = False
        assessment.reason_not_ready = f'{NOT_ASSIGNABLE_REASON_PREFIX}{short_description or "Niet toewijsbaar."}'
        intake.status = CaseIntakeProcess.ProcessStatus.INTAKE
        case_record.case_phase = CareCase.CasePhase.CASUS

    if case_record.case_phase != previous_phase:
        case_record.phase_entered_at = timezone.now()

    intake.save(update_fields=[
        'zorgvorm_gewenst',
        'preferred_care_form',
        'urgency',
        'complexity',
        'status',
    ])
    assessment.save(update_fields=[
        'assessment_status',
        'matching_ready',
        'reason_not_ready',
        'notes',
        'risk_signals',
        'assessed_by',
    ])
    case_record.save()

    log_action(
        request.user,
        'CREATE' if created else 'UPDATE',
        'CaseAssessment',
        assessment.pk,
        str(assessment),
        request=request,
    )

    return JsonResponse({
        'ok': True,
        'assessmentId': str(assessment.pk),
        'decision': decision,
        'nextPage': 'matching' if decision == 'matching' else 'beoordelingen',
        'message': _serialize_decision_consequences()[decision]['title'],
    })


# ---------------------------------------------------------------------------
# Urgency validation (gemeente-only)
# ---------------------------------------------------------------------------

@csrf_exempt
@login_required
@require_http_methods(["GET", "POST"])
def urgency_validation_api(request, case_id):
    """
    GET  /care/api/cases/<id>/urgency/
         Returns current urgency and arrangement data for the intake.

    POST /care/api/cases/<id>/urgency/
         Body:
           { "action": "validate" }
             → Marks urgency_validated=True. Requires document to be present.
             → Only callable by gemeente users.

           { "action": "revoke" }
             → Revokes urgency validation. Only callable by gemeente users.

           { "action": "set_urgency_granted_date", "urgency_granted_date": "YYYY-MM-DD" }
             → Sets urgency_granted_date. Only callable by gemeente users.

           { "action": "update_arrangement",
             "arrangement_type_code": str,
             "arrangement_provider": str,
             "arrangement_end_date": "YYYY-MM-DD" | null }
             → Updates arrangement metadata.
    """
    from contracts.waitlist import validate_urgency_transition

    organization = get_user_organization(request.user)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    intake = (
        CaseIntakeProcess.objects
        .filter(organization=organization, pk=case_id)
        .select_related('urgency_validated_by')
        .first()
    )
    if intake is None:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    if request.method == 'GET':
        return JsonResponse(_serialize_urgency_arrangement(intake))

    # POST
    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    action = str(payload.get('action') or '').strip()

    if action == 'validate':
        ok, reason = validate_urgency_transition(intake, request.user)
        if not ok:
            return JsonResponse({'error': reason}, status=400)

        intake.urgency_validated = True
        intake.urgency_validated_by = request.user
        intake.urgency_validated_at = timezone.now()
        intake.save(update_fields=['urgency_validated', 'urgency_validated_by', 'urgency_validated_at'])

        log_action(
            request.user, 'UPDATE', 'CaseIntakeProcess', intake.pk,
            str(intake), request=request,
        )
        return JsonResponse({
            'ok': True,
            'message': 'Urgentie is gevalideerd.',
            'urgency': _serialize_urgency_arrangement(intake),
        })

    elif action == 'revoke':
        # Role guard
        try:
            actor_role = getattr(request.user.profile, 'role', None)
        except Exception:
            actor_role = None
        if actor_role != 'gemeente':
            return JsonResponse({'error': 'Alleen gemeente-gebruikers mogen urgentievalidatie intrekken.'}, status=403)

        intake.urgency_validated = False
        intake.urgency_validated_by = None
        intake.urgency_validated_at = None
        intake.save(update_fields=['urgency_validated', 'urgency_validated_by', 'urgency_validated_at'])

        log_action(
            request.user, 'UPDATE', 'CaseIntakeProcess', intake.pk,
            str(intake), request=request,
        )
        return JsonResponse({'ok': True, 'message': 'Urgentievalidatie ingetrokken.'})

    elif action == 'set_urgency_granted_date':
        try:
            actor_role = getattr(request.user.profile, 'role', None)
        except Exception:
            actor_role = None
        if actor_role != 'gemeente':
            return JsonResponse({'error': 'Alleen gemeente-gebruikers mogen de urgentiedatum instellen.'}, status=403)

        raw_date = str(payload.get('urgency_granted_date') or '').strip()
        if not raw_date:
            return JsonResponse({'error': 'urgency_granted_date is verplicht.'}, status=400)
        try:
            from datetime import date as _date
            parsed = _date.fromisoformat(raw_date)
        except ValueError:
            return JsonResponse({'error': 'Ongeldige datumnotatie (verwacht YYYY-MM-DD).'}, status=400)

        intake.urgency_granted_date = parsed
        intake.save(update_fields=['urgency_granted_date'])
        return JsonResponse({
            'ok': True,
            'urgency_granted_date': parsed.isoformat(),
        })

    elif action == 'update_arrangement':
        update_fields = []
        if 'arrangement_type_code' in payload:
            intake.arrangement_type_code = str(payload['arrangement_type_code'] or '').strip()
            update_fields.append('arrangement_type_code')
        if 'arrangement_provider' in payload:
            intake.arrangement_provider = str(payload['arrangement_provider'] or '').strip()
            update_fields.append('arrangement_provider')
        if 'arrangement_end_date' in payload:
            raw = payload['arrangement_end_date']
            if raw:
                try:
                    from datetime import date as _date
                    intake.arrangement_end_date = _date.fromisoformat(str(raw).strip())
                except ValueError:
                    return JsonResponse({'error': 'Ongeldige arrangement_end_date (verwacht YYYY-MM-DD).'}, status=400)
            else:
                intake.arrangement_end_date = None
            update_fields.append('arrangement_end_date')

        if update_fields:
            intake.save(update_fields=update_fields)

        return JsonResponse({'ok': True, 'arrangement': _serialize_urgency_arrangement(intake)})

    return JsonResponse({'error': f'Onbekende actie: {action}'}, status=400)


def _serialize_urgency_arrangement(intake) -> dict:
    """Serializes urgency validation and arrangement fields for API responses."""
    return {
        'urgency': intake.urgency,
        'urgency_label': intake.get_urgency_display(),
        'urgency_validated': intake.urgency_validated,
        'urgency_document_present': bool(intake.urgency_document),
        'urgency_document_url': intake.urgency_document.url if intake.urgency_document else None,
        'urgency_granted_date': intake.urgency_granted_date.isoformat() if intake.urgency_granted_date else None,
        'urgency_validated_by': (
            intake.urgency_validated_by.get_full_name() if intake.urgency_validated_by else None
        ),
        'urgency_validated_at': intake.urgency_validated_at.isoformat() if intake.urgency_validated_at else None,
        # Arrangement
        'arrangement_type_code': intake.arrangement_type_code or '',
        'arrangement_provider': intake.arrangement_provider or '',
        'arrangement_end_date': intake.arrangement_end_date.isoformat() if intake.arrangement_end_date else None,
        # Waitlist
        'start_date': intake.start_date.isoformat() if intake.start_date else None,
        'waitlist_bucket': 0 if (intake.urgency_validated and intake.urgency_granted_date) else 1,
    }


# ---------------------------------------------------------------------------
# Matching action (SPA JSON)
# ---------------------------------------------------------------------------

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def matching_action_api(request, case_id):
    """
    Assign or reject a provider for a case via the SPA matching view.
    Body: {action: 'assign'|'reject', provider_id: int, reason?: str}
    Returns: {ok, message, nextPage, providerId?, providerName?}
    """
    organization = get_user_organization(request.user)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    action = str(payload.get('action') or '').strip()
    if action not in ('assign', 'reject'):
        return JsonResponse({'error': "Ongeldige actie. Kies 'assign' of 'reject'."}, status=400)

    intake = CaseIntakeProcess.objects.filter(
        organization=organization, pk=case_id
    ).select_related('contract').first()
    if intake is None:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    provider_id = payload.get('provider_id')
    if not provider_id:
        return JsonResponse({'error': 'provider_id is verplicht.'}, status=400)

    provider = Client.objects.filter(organization=organization, status='ACTIVE', pk=provider_id).first()
    if provider is None:
        return JsonResponse({'error': 'Aanbieder niet gevonden of niet actief.'}, status=404)

    if action == 'assign':
        from contracts.views import _assign_provider_to_intake
        placement = _assign_provider_to_intake(
            request=request,
            intake=intake,
            provider=provider,
            source='spa_matching',
        )
        # Advance case phase to provider beoordeling
        case_record = CareCase.objects.filter(
            due_diligence_process=intake
        ).first()
        placement.status = PlacementRequest.Status.IN_REVIEW
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
        placement.provider_response_requested_at = timezone.now()
        placement.save(update_fields=[
            'status',
            'provider_response_status',
            'provider_response_requested_at',
            'updated_at',
        ])

        if case_record and case_record.case_phase != CareCase.CasePhase.PROVIDER_BEOORDELING:
            case_record.case_phase = CareCase.CasePhase.PROVIDER_BEOORDELING
            case_record.phase_entered_at = timezone.now()
            case_record.save(update_fields=['case_phase', 'phase_entered_at'])
        log_action(
            request.user, 'UPDATE', 'CaseIntakeProcess', intake.pk,
            f'{intake.title}: provider toegewezen via SPA matching',
            request=request,
        )
        return JsonResponse({
            'ok': True,
            'message': f'Aanbieder {provider.name} geselecteerd en verstuurd voor beoordeling.',
            'nextPage': 'casussen',
            'placementId': str(placement.pk),
            'providerId': str(provider.pk),
            'providerName': provider.name,
        })

    # action == 'reject'
    reason = str(payload.get('reason') or '').strip() or 'Afgewezen via SPA matching.'
    log_action(
        request.user, 'REJECT', 'MatchingRecommendation', provider.pk,
        f'{intake.title} -> {provider.name}: afgewezen',
        request=request,
    )
    return JsonResponse({
        'ok': True,
        'message': f'Aanbieder {provider.name} gemarkeerd als afgewezen.',
        'nextPage': 'matching',
        'reason': reason,
    })


# ---------------------------------------------------------------------------
# Placement action (SPA JSON)
# ---------------------------------------------------------------------------

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def placement_action_api(request, case_id):
    """
    Update the placement status for a case via the SPA placement view.
    Body: {status: str, note?: str}
    Returns: {ok, message, nextPage}
    """
    organization = get_user_organization(request.user)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    try:
        payload = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Ongeldige JSON payload.'}, status=400)

    intake = CaseIntakeProcess.objects.filter(
        organization=organization, pk=case_id
    ).first()
    if intake is None:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    placement = PlacementRequest.objects.filter(
        due_diligence_process=intake
    ).select_related('selected_provider', 'proposed_provider').order_by('-updated_at').first()
    if placement is None:
        return JsonResponse({'error': 'Geen plaatsing gevonden voor deze casus. Start eerst via matching.'}, status=404)

    status = str(payload.get('status') or '').strip()
    valid_statuses = {choice[0] for choice in PlacementRequest.Status.choices}
    if status not in valid_statuses:
        return JsonResponse({
            'error': f"Ongeldige status. Kies uit: {', '.join(sorted(valid_statuses))}"
        }, status=400)

    update_fields = ['updated_at']

    if placement.status != status:
        placement.status = status
        update_fields.append('status')

    note = str(payload.get('note') or '').strip()
    if note:
        existing = placement.decision_notes or ''
        stamped = f"[{timezone.now().strftime('%d-%m-%Y %H:%M')}] {note}"
        placement.decision_notes = f"{existing}\n{stamped}".strip()
        update_fields.append('decision_notes')

    case_record = CareCase.objects.filter(due_diligence_process=intake).first()

    if placement.status == PlacementRequest.Status.APPROVED:
        from datetime import date as _date
        if not placement.start_date:
            placement.start_date = _date.today()
            update_fields.append('start_date')
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.ACCEPTED
        placement.provider_response_recorded_at = timezone.now()
        placement.provider_response_recorded_by = request.user
        update_fields.extend([
            'provider_response_status',
            'provider_response_recorded_at',
            'provider_response_recorded_by',
        ])
        if intake.status != CaseIntakeProcess.ProcessStatus.DECISION:
            intake.status = CaseIntakeProcess.ProcessStatus.DECISION
            intake.save(update_fields=['status', 'updated_at'])
        if case_record and case_record.case_phase != CareCase.CasePhase.PLAATSING:
            case_record.case_phase = CareCase.CasePhase.PLAATSING
            case_record.phase_entered_at = timezone.now()
            case_record.save(update_fields=['case_phase', 'phase_entered_at'])
    elif placement.status == PlacementRequest.Status.REJECTED:
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.REJECTED
        placement.provider_response_recorded_at = timezone.now()
        placement.provider_response_recorded_by = request.user
        update_fields.extend([
            'provider_response_status',
            'provider_response_recorded_at',
            'provider_response_recorded_by',
        ])
        if intake.status != CaseIntakeProcess.ProcessStatus.MATCHING:
            intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
            intake.save(update_fields=['status', 'updated_at'])
        if case_record and case_record.case_phase != CareCase.CasePhase.MATCHING:
            case_record.case_phase = CareCase.CasePhase.MATCHING
            case_record.phase_entered_at = timezone.now()
            case_record.save(update_fields=['case_phase', 'phase_entered_at'])

    placement.save(update_fields=list(dict.fromkeys(update_fields)))
    log_action(
        request.user, 'UPDATE', 'PlacementRequest', placement.pk,
        str(placement), request=request,
    )
    return JsonResponse({
        'ok': True,
        'message': 'Plaatsing bijgewerkt.',
        'nextPage': 'plaatsingen' if placement.status == PlacementRequest.Status.APPROVED else 'matching',
        'placementId': str(placement.pk),
        'status': placement.status,
    })


# ---------------------------------------------------------------------------
# Case placement detail (SPA JSON — GET)
# ---------------------------------------------------------------------------

@login_required
@require_http_methods(["GET"])
def case_placement_detail_api(request, case_id):
    """Return the current placement for a case so the SPA can display it."""
    organization = get_user_organization(request.user)
    if organization is None:
        return JsonResponse({'error': 'Geen actieve organisatie'}, status=400)

    intake = CaseIntakeProcess.objects.filter(
        organization=organization, pk=case_id
    ).first()
    if intake is None:
        return JsonResponse({'error': 'Casus niet gevonden'}, status=404)

    placement = PlacementRequest.objects.filter(
        due_diligence_process=intake
    ).select_related('selected_provider', 'proposed_provider').order_by('-updated_at').first()
    if placement is None:
        return JsonResponse({'placement': None})

    provider = placement.selected_provider or placement.proposed_provider
    return JsonResponse({
        'placement': {
            'id': str(placement.pk),
            'status': placement.status,
            'careForm': placement.care_form,
            'providerResponseStatus': placement.provider_response_status,
            'proposedProviderId': str(placement.proposed_provider_id) if placement.proposed_provider_id else '',
            'proposedProviderName': placement.proposed_provider.name if placement.proposed_provider else '',
            'selectedProviderId': str(placement.selected_provider_id) if placement.selected_provider_id else '',
            'selectedProviderName': placement.selected_provider.name if placement.selected_provider else '',
            'resolvedProviderId': str(provider.pk) if provider else '',
            'resolvedProviderName': provider.name if provider else '',
            'decisionNotes': placement.decision_notes or '',
            'startDate': placement.start_date.isoformat() if placement.start_date else '',
            'createdAt': placement.created_at.isoformat(),
        }
    })


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
