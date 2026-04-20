from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import ListView, DetailView, CreateView, UpdateView
from django.urls import reverse_lazy, reverse
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum, Count, Q, Avg, Min
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.conf import settings
from django.db import models, connection, DatabaseError
from django.utils.dateparse import parse_date
from django.utils.cache import patch_cache_control
from django.utils.http import url_has_allowed_host_and_scheme
from datetime import timedelta, date
from collections import defaultdict
from decimal import Decimal
from math import asin, cos, radians, sin, sqrt
import csv
import json
import logging

from .forms import (
    BudgetForm, CareTaskForm, BudgetExpenseForm,
    ClientForm, CareConfigurationForm, DocumentForm,
    DeadlineForm, UserProfileForm,
    RegistrationForm,
    OrganizationInvitationForm,
    MunicipalityConfigurationForm, RegionalConfigurationForm,
    CaseAssessmentForm, CaseIntakeProcessForm,
    TrustAccountForm, CareSignalForm, PlacementRequestForm,
)
from .models import (
    Organization, OrganizationMembership, OrganizationInvitation,
    CareCase, PlacementRequest, CareTask, CareSignal,
    Workflow,
    CaseIntakeProcess, Budget, BudgetExpense,
    Client, CareConfiguration, Document, TrustAccount, ProviderProfile,
    Deadline, AuditLog, Notification, UserProfile, CaseAssessment,
    MunicipalityConfiguration, RegionalConfiguration, CaseDecisionLog,
    OutcomeReasonCode, OperationalAlert, ProviderEvaluation,
)
from .middleware import log_action
from .permissions import (
    CaseAction,
    can_access_case_action,
    can_manage_organization,
    is_organization_owner,
)
from .provider_metrics import (
    build_provider_behavior_metrics,
    calculate_provider_behavior_modifier,
    describe_behavior_influence,
    derive_behavior_signals,
    label_behavior_signals,
)
from .provider_workspace import build_provider_workspace_rows, build_provider_workspace_summary
from .oversight_workspace import (
    build_municipality_list_summary,
    build_municipality_detail_summary,
    build_municipality_oversight_row,
    build_regional_list_summary,
    build_regional_detail_summary,
    build_regional_oversight_row,
)
from .case_intelligence import (
    calculate_provider_response_sla,
    derive_provider_response_ownership,
    evaluate_case_intelligence,
)
from .governance import (
    build_matching_recommendation_payload,
    detect_and_log_sla_transition,
    log_case_decision_event,
)
# Temporary blocker: active matching flow still depends on legacy_backend module.
# Keep until a non-legacy matching service is introduced and migrated here.
from .provider_matching_service import MatchContext, MatchEngine
from .operational_decision_contract import build_operational_decision_for_intake
from .operational_decision_presenter import present_operational_decision
from .tenancy import get_user_organization, scope_queryset_for_organization, set_organization_on_instance
from .alert_engine import generate_alerts_for_case, build_regiekamer_summary
from .provider_evaluation_service import (
    get_evaluation_nba_code,
    latest_evaluation_for_case_provider,
    placement_unlocked_for_case,
    record_provider_evaluation,
)
from .provider_outcome_aggregates import (
    apply_evaluation_outcome_to_candidate,
    build_provider_evaluation_aggregates,
    build_provider_context_aggregates,
    build_regiekamer_provider_health,
)
from config.feature_flags import is_feature_redesign_enabled

logger = logging.getLogger(__name__)
User = get_user_model()


AUTO_INTAKE_TASKS = {
    CaseIntakeProcess.ProcessStatus.INTAKE: {
        'title': 'Intake afronden',
        'task_type': Deadline.TaskType.INTAKE_COMPLETE,
        'priority': Deadline.Priority.HIGH,
        'source': Deadline.GenerationSource.INTAKE,
    },
    CaseIntakeProcess.ProcessStatus.MATCHING: {
        'title': 'Match selecteren',
        'task_type': Deadline.TaskType.SELECT_MATCH,
        'priority': Deadline.Priority.URGENT,
        'source': Deadline.GenerationSource.MATCHING,
    },
}

DESIGN_MODE_SESSION_KEY = 'careon_design_mode'
DESIGN_MODE_SPA = 'spa'
VALID_DESIGN_MODES = {DESIGN_MODE_SPA}


def _resolve_deadline_case(deadline):
    if getattr(deadline, 'case_record_id', None):
        return deadline.case_record
    process = getattr(deadline, 'due_diligence_process', None)
    if process and getattr(process, 'contract_id', None):
        return process.case_record
    return None


def _resolve_signal_case(signal):
    if getattr(signal, 'case_record_id', None):
        return signal.case_record
    process = getattr(signal, 'due_diligence_process', None)
    if process and getattr(process, 'contract_id', None):
        return process.case_record
    return None


def _redirect_to_safe_next_or_default(request, fallback_url):
    next_url = request.POST.get('next')
    if next_url and url_has_allowed_host_and_scheme(
        url=next_url,
        allowed_hosts={request.get_host()},
        require_https=request.is_secure(),
    ):
        return redirect(next_url)
    return redirect(fallback_url)


def _case_detail_tab_href(intake_id, tab):
    return f"{reverse('careon:case_detail', kwargs={'pk': intake_id})}?tab={tab}"


def _split_csv_tags(raw_tags):
    if not raw_tags:
        return []
    return [part.strip() for part in raw_tags.split(',') if part.strip()]


def _extract_document_phase_event(tags):
    phase = ''
    event = ''
    for part in _split_csv_tags(tags):
        if part.startswith('phase:') and not phase:
            phase = part.split(':', 1)[1].strip()
        if part.startswith('event:') and not event:
            event = part.split(':', 1)[1].strip()
    return phase, event


def _merge_document_context_tags(existing_tags, *, phase='', event=''):
    tags = _split_csv_tags(existing_tags)
    context_tokens = []
    if phase:
        context_tokens.append(f'phase:{phase}')
    if event:
        context_tokens.append(f'event:{event}')

    for token in context_tokens:
        if token not in tags:
            tags.append(token)

    return ','.join(tags)


def _flow_stage_for_intake_status(intake_status):
    flow_stage_map = {
        CaseIntakeProcess.ProcessStatus.INTAKE: 'aanvraag',
        CaseIntakeProcess.ProcessStatus.MATCHING: 'matching',
        CaseIntakeProcess.ProcessStatus.DECISION: 'intake_aanbieder',
        CaseIntakeProcess.ProcessStatus.COMPLETED: 'plaatsing',
        CaseIntakeProcess.ProcessStatus.ON_HOLD: 'aanvraag',
    }
    return flow_stage_map.get(intake_status, 'aanvraag')


def _provider_form_match(profile, intake):
    return {
        CaseIntakeProcess.CareForm.OUTPATIENT: profile.offers_outpatient,
        CaseIntakeProcess.CareForm.DAY_TREATMENT: profile.offers_day_treatment,
        CaseIntakeProcess.CareForm.RESIDENTIAL: profile.offers_residential,
        CaseIntakeProcess.CareForm.CRISIS: profile.offers_crisis,
    }.get(intake.preferred_care_form, False)


def _provider_urgency_match(profile, intake):
    return {
        CaseIntakeProcess.Urgency.LOW: profile.handles_low_urgency,
        CaseIntakeProcess.Urgency.MEDIUM: profile.handles_medium_urgency,
        CaseIntakeProcess.Urgency.HIGH: profile.handles_high_urgency,
        CaseIntakeProcess.Urgency.CRISIS: profile.handles_crisis_urgency,
    }.get(intake.urgency, False)


def _capacity_status_label(free_slots):
    if free_slots > 3:
        return 'available', 'Capaciteit beschikbaar'
    if free_slots > 0:
        return 'limited', 'Capaciteit beperkt'
    return 'full', 'Geen directe capaciteit'


def _performance_status_label(wait_days):
    if wait_days <= 14:
        return 'good', 'Korte wachttijd'
    if wait_days <= 28:
        return 'acceptable', 'Acceptabele wachttijd'
    return 'slow', 'Relatief lange wachttijd'


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


def _haversine_distance_km(latitude_a, longitude_a, latitude_b, longitude_b):
    if None in {latitude_a, longitude_a, latitude_b, longitude_b}:
        return None

    radius_km = 6371.0
    latitude_delta = radians(latitude_b - latitude_a)
    longitude_delta = radians(longitude_b - longitude_a)
    start_latitude = radians(latitude_a)
    end_latitude = radians(latitude_b)

    arc = sin(latitude_delta / 2) ** 2 + cos(start_latitude) * cos(end_latitude) * sin(longitude_delta / 2) ** 2
    return round(2 * radius_km * asin(sqrt(arc)), 1)


def _preferred_region_label(intake):
    preferred_region = getattr(intake, 'preferred_region', None)
    if preferred_region:
        return preferred_region.region_name
    return getattr(intake, 'region', '') or getattr(intake, 'region_name', '') or ''


def _build_case_location(intake):
    preferred_region = getattr(intake, 'preferred_region', None)
    municipality = _first_related(preferred_region.served_municipalities) if preferred_region else None
    region_label = _preferred_region_label(intake)
    municipality_label = municipality.municipality_name if municipality else ''
    location_label = municipality_label or region_label or 'Casuslocatie onbekend'

    sources = [intake]
    linked_case = getattr(intake, 'case_record', None)
    if linked_case is not None:
        sources.append(linked_case)
        linked_client = getattr(linked_case, 'client', None)
        if linked_client is not None:
            sources.append(linked_client)
    if preferred_region is not None:
        sources.append(preferred_region)
    if municipality is not None:
        sources.append(municipality)

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


def _provider_location_payload(profile):
    primary_region = _first_related(profile.served_regions)
    municipality = _first_related(primary_region.served_municipalities) if primary_region else None
    region_label = primary_region.region_name if primary_region else ''
    municipality_label = municipality.municipality_name if municipality else ''
    location_label = profile.client.city or municipality_label or region_label or profile.service_area or 'Locatie ontbreekt'

    # TODO: wire explicit provider/case geo fields into this source list when the schema is extended.
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


def _provider_specialization_summary(profile):
    categories = [category.name for category in list(profile.target_care_categories.all())[:2]]
    if categories:
        return ', '.join(categories)

    offered_forms = []
    if profile.offers_outpatient:
        offered_forms.append('Ambulant')
    if profile.offers_day_treatment:
        offered_forms.append('Dagbehandeling')
    if profile.offers_residential:
        offered_forms.append('Residentieel')
    if profile.offers_crisis:
        offered_forms.append('Crisisopvang')
    if offered_forms:
        return ', '.join(offered_forms[:2])

    if profile.special_facilities:
        return profile.special_facilities.splitlines()[0][:80]
    return 'Algemene zorgondersteuning'


def _build_matching_explanation(*, match_score, category_match, urgency_match, care_form_match, region_match, region_type_match, free_slots, average_wait_days, specialization_summary, tradeoff, complexity_match=False, special_needs_ok=True):
    capacity_status, capacity_label = _capacity_status_label(free_slots)
    performance_status, performance_label = _performance_status_label(average_wait_days)

    # ── Confidence ────────────────────────────────────────────────────────────
    if match_score >= 80 and free_slots > 0 and care_form_match and urgency_match:
        confidence = 'high'
        confidence_reason = 'Sterke fit op zorgvorm, urgentie en operationele haalbaarheid.'
    elif match_score >= 55:
        confidence = 'medium'
        confidence_reason = 'Passende optie, maar met expliciete handmatige controle op capaciteit of regio.'
    else:
        confidence = 'low'
        confidence_reason = 'Aanbeveling is bruikbaar als alternatief, maar vraagt nadrukkelijke validatie.'

    # ── Trade-offs ─────────────────────────────────────────────────────────────
    trade_offs = []
    if care_form_match and free_slots <= 0:
        trade_offs.append('Juiste zorgvorm maar beperkte resterende capaciteit.')
    elif not region_match and region_type_match:
        trade_offs.append('Nabijgelegen aanbieder maar geen exacte regiomatch.')
    elif category_match and performance_status == 'slow':
        trade_offs.append('Sterke categoriefit maar lange wachttijd.')
    elif urgency_match and not care_form_match:
        trade_offs.append('Urgentiecompatibiliteit aanwezig maar zorgvorm vraagt verificatie.')
    elif match_score >= 70 and not region_match:
        trade_offs.append('Goede totaalfit maar regio behoeft bevestiging.')
    if tradeoff and tradeoff not in trade_offs:
        trade_offs.append(tradeoff)

    # ── Verification guidance ──────────────────────────────────────────────────
    verify_manually = []
    if not region_match and not region_type_match:
        verify_manually.append('Bevestig regionale uitvoerbaarheid: aanbieder dekt de casusregio mogelijk niet.')
    elif not region_match:
        verify_manually.append('Controleer of de casus praktisch uitvoerbaar is binnen de gewenste regio.')
    if capacity_status != 'available':
        verify_manually.append('Bevestig actuele intakeslotbeschikbaarheid vóór toewijzing.')
    if not urgency_match:
        verify_manually.append('Verifieer of aanbieder dit urgentieniveau accepteert.')
    if not special_needs_ok:
        verify_manually.append('Beoordeel geschiktheid voor bijzondere zorgsituatie.')
    if performance_status == 'slow':
        verify_manually.append('Beoordeel of de wachttijd verdedigbaar is voor deze casus.')
    if not verify_manually:
        verify_manually.append('Bevestig intake-fit en uitvoerbaarheid in de casuswerkruimte.')

    # ── Warning flags ──────────────────────────────────────────────────────────
    warning_flags = []
    if confidence == 'low':
        warning_flags.append('Lage confidence – meerdere factoren vragen handmatige controle.')
    if capacity_status == 'full':
        warning_flags.append('Aanbieder heeft geen directe vrije capaciteit.')
    if not urgency_match:
        warning_flags.append('Urgentiecompatibiliteit onbevestigd voor dit aanbiederprofiel.')
    if not region_match and not region_type_match:
        warning_flags.append('Geen regiomatch – geografische dekking moet worden bevestigd.')
    if not special_needs_ok:
        warning_flags.append('Bijzondere zorgsituatie: geschiktheid aanbieders moet worden geverifieerd.')

    # ── Fit summary ────────────────────────────────────────────────────────────
    fit_summary_parts = []
    if category_match:
        fit_summary_parts.append('categorie')
    if urgency_match:
        fit_summary_parts.append('urgentie')
    if care_form_match:
        fit_summary_parts.append('zorgvorm')
    if region_match:
        fit_summary_parts.append('regio')
    fit_summary = (
        'Sterke fit op ' + ', '.join(fit_summary_parts[:3])
        if fit_summary_parts
        else 'Handmatige beoordeling nodig om de fit te bevestigen.'
    )

    # ── Factor breakdown (ordered list for template rendering) ─────────────────
    factor_breakdown = [
        {
            'name': 'Zorgvorm',
            'key': 'care_form',
            'status': 'match' if care_form_match else 'review',
            'detail': 'Gevraagde zorgvorm is beschikbaar.' if care_form_match else 'Zorgvorm vraagt aanvullende controle.',
        },
        {
            'name': 'Urgentiecompatibiliteit',
            'key': 'urgency',
            'status': 'match' if urgency_match else 'review',
            'detail': 'Urgentie past binnen het aanbiederprofiel.' if urgency_match else 'Controleer of deze aanbieder de urgentie aankan.',
        },
        {
            'name': 'Specialisatie',
            'key': 'specialization',
            'status': 'match' if category_match else 'review',
            'detail': 'Categorie match aanwezig.' if category_match else specialization_summary,
        },
        {
            'name': 'Regionale fit',
            'key': 'region',
            'status': 'exact' if region_match else 'compatible' if region_type_match else 'review',
            'detail': (
                'Voorkeursregio sluit aan.'
                if region_match
                else 'Regiotype sluit aan, maar exacte locatie moet worden bevestigd.'
                if region_type_match
                else 'Geen harde geografische bevestiging beschikbaar.'
            ),
        },
        {
            'name': 'Beschikbare capaciteit',
            'key': 'capacity',
            'status': capacity_status,
            'detail': capacity_label if free_slots <= 0 else f'{capacity_label} ({free_slots} vrije plekken).',
        },
        {
            'name': 'Complexiteitsfit',
            'key': 'complexity',
            'status': 'match' if complexity_match else 'review',
            'detail': 'Aanbieder is uitgerust voor de benodigde complexiteit.' if complexity_match else 'Complexiteitsgeschiktheid vraagt bevestiging.',
        },
        {
            'name': 'Bijzondere behoeften',
            'key': 'special_needs',
            'status': 'ok' if special_needs_ok else 'warning',
            'detail': 'Geen contra-indicaties gevonden voor bijzondere zorgsituatie.' if special_needs_ok else 'Bijzondere zorgsituatie vereist handmatige verificatie van geschiktheid.',
        },
    ]

    # ── Backward-compatible factors dict ─────────────────────────────────────
    factors = {item['key']: {'status': item['status'], 'detail': item['detail']} for item in factor_breakdown}
    factors['performance'] = {
        'status': performance_status,
        'detail': f'{performance_label} ({average_wait_days} dagen).',
    }

    return {
        'fit_summary': fit_summary,
        'factor_breakdown': factor_breakdown,
        'factors': factors,
        'confidence': confidence,
        'confidence_reason': confidence_reason,
        'trade_offs': trade_offs,
        'verification_guidance': verify_manually,
        'verify_manually': verify_manually,  # keep alias for backward compat
        'warning_flags': warning_flags,
        'behavior_consideration': 'Niet toegepast op ranking (onvoldoende nabijheid of historie)',
        'behavior_influence': ['Limited provider history, behavioral influence kept neutral'],
    }


def _build_matching_map_context(intake, suggestions, *, selected_provider_id=None):
    case_location = _build_case_location(intake)
    provider_markers = []

    for rank, suggestion in enumerate(suggestions[:5], start=1):
        provider_location = suggestion.get('location') or {}
        distance_km = _haversine_distance_km(
            case_location.get('latitude'),
            case_location.get('longitude'),
            provider_location.get('latitude'),
            provider_location.get('longitude'),
        )
        provider_markers.append(
            {
                'provider_id': suggestion['provider_id'],
                'provider_name': suggestion['provider_name'],
                'rank': rank,
                'emphasis': 'primary' if rank == 1 else 'secondary',
                'match_score': suggestion['match_score'],
                'fit_score': suggestion['fit_score'],
                'geo_fit_score': 100 if suggestion.get('region_match') else None,
                'capacity_status': suggestion.get('capacity_status'),
                'capacity_status_label': suggestion.get('capacity_label'),
                'specialization_summary': suggestion.get('specialization_summary'),
                'distance_km': distance_km,
                'distance_label': f'{distance_km} km vanaf casus' if distance_km is not None else '',
                'location_label': provider_location.get('label') or 'Locatie ontbreekt',
                'region_label': provider_location.get('region_label') or '',
                'latitude': provider_location.get('latitude'),
                'longitude': provider_location.get('longitude'),
                'has_coordinates': bool(provider_location.get('has_coordinates')),
            }
        )

    providers_with_coordinates = [marker for marker in provider_markers if marker['has_coordinates']]
    has_case_coordinates = case_location['has_coordinates']
    can_render_map = bool(has_case_coordinates and providers_with_coordinates)
    has_partial_geo = bool(has_case_coordinates or providers_with_coordinates)
    has_candidates = bool(provider_markers)

    limitations = []
    if not case_location['has_coordinates']:
        limitations.append('Casuscoordinaten ontbreken in het huidige schema.')
    if has_candidates and not providers_with_coordinates:
        limitations.append('Aanbiedercoordinaten ontbreken in het huidige schema.')
    if has_candidates and not any(marker['distance_label'] for marker in provider_markers):
        limitations.append('Afstand wordt pas berekend zodra zowel casus- als aanbiedercoordinaten beschikbaar zijn.')

    if not has_candidates:
        empty_state = {
            'title': 'Nog geen kandidaten om geografisch te tonen',
            'message': 'De kaartlaag blijft ondersteunend. Start eerst matching om topaanbieders te tonen.',
        }
    elif can_render_map:
        empty_state = {
            'title': '',
            'message': '',
        }
    elif has_partial_geo:
        empty_state = {
            'title': 'Geografische context is nog onvolledig',
            'message': 'Er is al locatiecontext beschikbaar, maar niet genoeg coordinaten om de kaartlaag volledig te plotten.',
        }
    else:
        empty_state = {
            'title': 'Kaart kan nog niet renderen',
            'message': 'Locatiecoordinaten ontbreken voor casus en aanbieders. De kaartintegratie is voorbereid, maar wacht nog op expliciete latitude/longitude-velden.',
        }

    return {
        'integration': {
            'library': 'mapbox-gl-js',
            'mode': 'shell',
            'library_available': False,
        },
        'summary': {
            'candidate_count': len(provider_markers),
            'providers_with_coordinates': len(providers_with_coordinates),
            'has_case_coordinates': has_case_coordinates,
            'can_render_map': can_render_map,
            'has_partial_geo': has_partial_geo,
        },
        'case_location': case_location,
        'provider_markers': provider_markers,
        'selected_provider_id': selected_provider_id,
        'empty_state': empty_state,
        'limitations': limitations,
    }


def _behavior_tiebreak_weight(distance_from_top):
    if distance_from_top <= 5:
        return 1.0
    if distance_from_top <= 10:
        return 0.6
    if distance_from_top <= 15:
        return 0.3
    return 0.0


def _build_provider_outcome_context(provider_id):
    metrics = build_provider_behavior_metrics(provider_id)
    total_cases = int(metrics.get('total_cases') or 0)
    if total_cases <= 0:
        return None

    acceptance_rate = metrics.get('acceptance_rate')
    intake_success_rate = metrics.get('intake_success_rate')

    evidence_level = 'sufficient' if total_cases >= 3 else 'limited'
    evidence_label = 'Voldoende historie' if evidence_level == 'sufficient' else 'Beperkte historie'

    if evidence_level == 'sufficient':
        summary = f'Gebaseerd op {total_cases} eerdere plaatsingen bij deze aanbieder.'
        warning = None
    else:
        summary = f'Gebaseerd op {total_cases} eerdere plaatsing(en); signalen zijn indicatief.'
        warning = 'Historische signalen zijn indicatief en vragen extra handmatige verificatie.'

    acceptance_label = None
    if acceptance_rate is not None:
        acceptance_label = f'Acceptatiegraad: {round(acceptance_rate * 100)}%'

    quality_label = 'Risico op uitval: onvoldoende data'
    if intake_success_rate is not None:
        dropout_risk = max(0, min(100, round((1 - intake_success_rate) * 100)))
        quality_label = f'Risico op uitval: {dropout_risk}%'

    return {
        'evidence_level': evidence_level,
        'evidence_label': evidence_label,
        'summary': summary,
        'acceptance_label': acceptance_label,
        'quality_label': quality_label,
        'warning': warning,
    }


def _build_case_intelligence_context(
    intake,
    *,
    assessment,
    placement,
    matching_preview_candidates,
    latest_assignment,
    open_signals_count,
    open_tasks_count,
    rejected_count,
):
    top_candidate = matching_preview_candidates[0] if matching_preview_candidates else None
    has_region_preference = bool(intake.preferred_region_id or intake.preferred_region_type)

    candidate_suggestions = []
    for row in matching_preview_candidates:
        candidate_suggestions.append(
            {
                'provider_id': row.get('provider_id'),
                'confidence': (row.get('explanation') or {}).get('confidence'),
                'has_capacity_issue': (row.get('free_slots') or 0) <= 0,
                'wait_days': row.get('avg_wait_days'),
                'has_region_mismatch': bool(has_region_preference and not row.get('region_match')),
            }
        )

    case_data = {
        'phase': _flow_stage_for_intake_status(intake.status),
        'care_category': intake.care_category_main.name if intake.care_category_main else None,
        'urgency': intake.urgency,
        'assessment_complete': bool(assessment and assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING),
        'matching_run_exists': bool(matching_preview_candidates),
        'top_match_confidence': ((top_candidate or {}).get('explanation') or {}).get('confidence'),
        'top_match_has_capacity_issue': bool(top_candidate and (top_candidate.get('free_slots') or 0) <= 0),
        'top_match_wait_days': top_candidate.get('avg_wait_days') if top_candidate else None,
        'selected_provider_id': latest_assignment.selected_provider_id if latest_assignment else None,
        'placement_status': placement.status if placement else None,
        'placement_updated_at': placement.updated_at if placement else None,
        'rejected_provider_count': rejected_count,
        'open_signal_count': open_signals_count,
        'open_task_count': open_tasks_count,
        'case_updated_at': intake.updated_at,
        'candidate_suggestions': candidate_suggestions,
        'has_preferred_region': has_region_preference,
        'has_assessment_summary': bool(intake.assessment_summary),
        'has_client_age_category': bool(intake.client_age_category),
        'assessment_status': assessment.assessment_status if assessment else None,
        'assessment_matching_ready': assessment.matching_ready if assessment else None,
        'matching_updated_at': latest_assignment.updated_at if latest_assignment else None,
        'provider_response_status': getattr(placement, 'provider_response_status', None) if placement else None,
        'provider_response_recorded_at': getattr(placement, 'provider_response_recorded_at', None) if placement else None,
        'provider_response_requested_at': getattr(placement, 'provider_response_requested_at', None) if placement else None,
        'provider_response_deadline_at': getattr(placement, 'provider_response_deadline_at', None) if placement else None,
        'provider_response_last_reminder_at': getattr(placement, 'provider_response_last_reminder_at', None) if placement else None,
        'now': timezone.now(),
    }
    intelligence = evaluate_case_intelligence(case_data)

    known_flags = {
        'open_signals': False,
        'repeated_rejections': False,
        'weak_matching_quality': False,
        'capacity_risk': False,
        'long_wait_risk': False,
        'placement_stalled': False,
        'provider_response_delayed': False,
        'provider_not_responding': False,
        'high_urgency_response_delay': False,
        'rematch_recommended': False,
        'provider_no_capacity': False,
    }
    for signal in intelligence.get('risk_signals', []):
        code = signal.get('code')
        if code:
            known_flags[code] = True
    for item in intelligence.get('missing_information', []):
        code = item.get('code')
        if code:
            known_flags[code] = True

    hint_map = {
        row.get('provider_id'): row
        for row in intelligence.get('candidate_hints', [])
        if row.get('provider_id') is not None
    }

    return {
        'intelligence': intelligence,
        'intelligence_flags': known_flags,
        'candidate_hint_map': hint_map,
    }


def _build_match_context_from_intake(intake, organization):
    region_ref = ''
    if getattr(intake, 'regio', None):
        region_ref = intake.regio.region_code or intake.regio.region_name or ''
    elif getattr(intake, 'preferred_region', None):
        region_ref = intake.preferred_region.region_code or intake.preferred_region.region_name or ''

    gemeente_name = ''
    if getattr(intake, 'gemeente', None):
        gemeente_name = intake.gemeente.municipality_name

    problematiek = list(getattr(intake, 'problematiek_types', []) or [])
    contra_indicaties = [
        token.strip() for token in str(getattr(intake, 'contra_indicaties', '') or '').split(',') if token.strip()
    ]

    return MatchContext(
        zorgvorm=(getattr(intake, 'zorgvorm_gewenst', '') or intake.preferred_care_form or '').lower(),
        leeftijd=getattr(intake, 'leeftijd', None),
        regio=(region_ref or '').strip(),
        gemeente=(gemeente_name or '').strip(),
        complexiteit=(intake.complexity or '').lower(),
        urgentie=(intake.urgency or '').lower(),
        problematiek=problematiek,
        crisisopvang_vereist=(intake.urgency == CaseIntakeProcess.Urgency.CRISIS),
        setting_voorkeur=getattr(intake, 'setting_voorkeur', '') or '',
        contra_indicaties=contra_indicaties,
        max_toelaatbare_wachttijd_dagen=getattr(intake, 'max_toelaatbare_wachttijd_dagen', None),
        organization=organization,
    )


def _region_pressure_summary(*, intake, provider_profiles, region_id):
    if not region_id:
        return {
            'status': 'onbekend',
            'message': 'Regionale druk niet volledig bepaalbaar',
        }

    active_statuses = {
        CaseIntakeProcess.ProcessStatus.INTAKE,
        CaseIntakeProcess.ProcessStatus.MATCHING,
        CaseIntakeProcess.ProcessStatus.DECISION,
    }
    active_cases = CaseIntakeProcess.objects.filter(
        organization=intake.organization,
        status__in=active_statuses,
    ).filter(Q(regio_id=region_id) | Q(preferred_region_id=region_id)).count()

    regional_profiles = [
        profile for profile in provider_profiles
        if profile.served_regions.filter(id=region_id).exists() or profile.secondary_served_regions.filter(id=region_id).exists()
    ]
    total_free_slots = sum(max((profile.max_capacity or 0) - (profile.current_capacity or 0), 0) for profile in regional_profiles)

    if total_free_slots == 0 and active_cases > 0:
        return {
            'status': 'kritiek',
            'message': 'Beste inhoudelijke match, maar capaciteit in regio staat onder druk',
        }

    if active_cases > max(total_free_slots, 1):
        return {
            'status': 'druk',
            'message': 'Regionale capaciteit is beperkt; monitor wachttijd en escalatiepad',
        }

    return {
        'status': 'stabiel',
        'message': 'Regionale dekking en capaciteit zijn op dit moment werkbaar',
    }


def _build_canonical_factor_breakdown(result):
    """Return ordered list of factor dicts for a canonical MatchResultaat."""
    score_complex = float(result.score_complexiteit_veiligheid_fit or result.score_complexiteit or 0.0)
    score_cap = float(result.score_capaciteit_wachttijd_fit or result.score_capaciteit or 0.0)
    score_regio = float(result.score_regio_contract_fit or result.score_contract_regio or 0.0)
    score_inhoud = float(result.score_inhoudelijke_fit or 0.0)
    score_perf = float(result.score_performance_fit or result.score_performance or 0.0)
    return [
        {
            'name': 'Zorgvorm',
            'key': 'care_form',
            'status': 'match' if score_inhoud >= 8 else 'review',
            'detail': 'Zorgvorm meegewogen in inhoudelijke fit.',
        },
        {
            'name': 'Urgentiecompatibiliteit',
            'key': 'urgency',
            'status': 'match' if score_complex >= 7 else 'review',
            'detail': f"Complexiteit/veiligheid fit: {score_complex:.1f}/15",
        },
        {
            'name': 'Specialisatie',
            'key': 'specialization',
            'status': 'match' if score_inhoud >= 18 else 'review',
            'detail': f"Inhoudelijke fit: {score_inhoud:.1f}/35",
        },
        {
            'name': 'Regionale fit',
            'key': 'region',
            'status': 'exact' if score_regio >= 10 else 'review',
            'detail': f"Regio/contract fit: {score_regio:.1f}/20",
        },
        {
            'name': 'Beschikbare capaciteit',
            'key': 'capacity',
            'status': 'available' if score_cap >= 12 else 'limited',
            'detail': f"Capaciteit/wachttijd fit: {score_cap:.1f}/20",
        },
        {
            'name': 'Complexiteitsfit',
            'key': 'complexity',
            'status': 'match' if score_complex >= 10 else 'review',
            'detail': f"Complexiteitsfit: {score_complex:.1f}/15",
        },
        {
            'name': 'Bijzondere behoeften',
            'key': 'special_needs',
            'status': 'ok',
            'detail': 'Geen contra-indicatie conflict gedetecteerd door matchingengine.',
        },
        {
            'name': 'Performance',
            'key': 'performance',
            'status': 'good' if score_perf >= 6 else 'review',
            'detail': f"Performance fit: {score_perf:.1f}/10",
        },
    ]


def _build_canonical_warning_flags(result):
    """Derive warning flags from a MatchResultaat for display on provider cards."""
    flags = []
    confidence = str(result.confidence_label or '').lower()
    if confidence in {'laag', 'onzeker', 'low'}:
        flags.append('Lage confidence – meerdere factoren vragen handmatige controle.')
    score_cap = float(result.score_capaciteit_wachttijd_fit or result.score_capaciteit or 0.0)
    if score_cap < 8:
        flags.append('Aanbieder heeft mogelijk geen directe vrije capaciteit.')
    score_complex = float(result.score_complexiteit_veiligheid_fit or result.score_complexiteit or 0.0)
    if score_complex < 7:
        flags.append('Urgentiecompatibiliteit onbevestigd voor dit aanbiederprofiel.')
    score_regio = float(result.score_regio_contract_fit or result.score_contract_regio or 0.0)
    if score_regio < 5:
        flags.append('Geen regiomatch – geografische dekking moet worden bevestigd.')
    return flags


def _build_canonical_matching_suggestions_for_intake(intake, organization, *, limit=5):
    ctx = _build_match_context_from_intake(intake, organization)
    results = MatchEngine.run(ctx=ctx, casus=intake, max_results=max(limit * 3, 10), persist=False)
    non_excluded = [row for row in results if not row.uitgesloten]
    if not non_excluded:
        return [], [row for row in results if row.uitgesloten]

    provider_clients = {
        client.name.strip().lower(): client
        for client in Client.objects.filter(
            organization=organization,
            client_type='CORPORATION',
            status=Client.Status.ACTIVE,
        )
    }

    suggestions = []
    for result in non_excluded[:limit]:
        provider_name = result.zorgaanbieder.name if result.zorgaanbieder_id else 'Onbekende aanbieder'
        provider_client = provider_clients.get(provider_name.strip().lower())
        provider_profile = getattr(provider_client, 'provider_profile', None) if provider_client else None
        location = _provider_location_payload(provider_profile) if provider_profile else {
            'label': result.zorgaanbieder.short_name if result.zorgaanbieder_id else 'Locatie onbekend',
            'latitude': None,
            'longitude': None,
            'region_label': '',
            'municipality_label': '',
            'has_coordinates': False,
        }

        trade_offs = []
        for item in list(result.trade_offs or []):
            if isinstance(item, dict):
                explanation = item.get('toelichting') or item.get('factor') or ''
                if explanation:
                    trade_offs.append(str(explanation))
            elif item:
                trade_offs.append(str(item))

        suggestions.append(
            {
                'casus_id': intake.pk,
                'zorgprofiel_id': result.zorgprofiel_id,
                'zorgaanbieder_id': result.zorgaanbieder_id,
                'provider_id': provider_client.id if provider_client else None,
                'provider_name': provider_name,
                'match_score': float(result.totaalscore or 0.0),
                'fit_score': float(result.score_inhoudelijke_fit or 0.0),
                'totaalscore': float(result.totaalscore or 0.0),
                'score_inhoudelijke_fit': float(result.score_inhoudelijke_fit or 0.0),
                'score_regio_contract_fit': float(result.score_regio_contract_fit or result.score_contract_regio or 0.0),
                'score_capaciteit_wachttijd_fit': float(result.score_capaciteit_wachttijd_fit or result.score_capaciteit or 0.0),
                'score_complexiteit_veiligheid_fit': float(result.score_complexiteit_veiligheid_fit or result.score_complexiteit or 0.0),
                'score_performance_fit': float(result.score_performance_fit or result.score_performance or 0.0),
                'confidence_label': str(result.confidence_label or '').lower(),
                'fit_samenvatting': result.fit_samenvatting or '',
                'trade_offs': trade_offs,
                'verificatie_advies': result.verificatie_advies or '',
                'uitgesloten': bool(result.uitgesloten),
                'uitsluitreden': result.uitsluitreden or '',
                'ranking': result.ranking,
                'category_match': bool(result.score_inhoudelijke_fit >= 18),
                'urgency_match': bool(result.score_complexiteit >= 7),
                'care_form_match': bool(result.score_inhoudelijke_fit >= 8),
                'region_match': bool(result.score_contract_regio >= 10),
                'free_slots': None,
                'avg_wait_days': None,
                'reason': result.fit_samenvatting or 'Deterministische matchscore toegepast',
                'reasons': [result.fit_samenvatting] if result.fit_samenvatting else [],
                'tradeoff': '; '.join(trade_offs) if trade_offs else '',
                'capacity_status': 'available' if result.score_capaciteit >= 12 else 'limited',
                'capacity_label': 'Capaciteit meegewogen in score',
                'specialization_summary': result.fit_samenvatting or 'Inhoudelijke fit berekend',
                'distance_km': None,
                'location': location,
                'behavior_labels': [],
                'decision_hint': None,
                'decision_hint_code': None,
                'decision_comparison_to_top': '',
                'decision_trade_offs': trade_offs,
                'outcome_context': None,
                'scores': {
                    'score_inhoudelijke_fit': float(result.score_inhoudelijke_fit or 0.0),
                    'score_regio_contract_fit': float(result.score_regio_contract_fit or result.score_contract_regio or 0.0),
                    'score_capaciteit_wachttijd_fit': float(result.score_capaciteit_wachttijd_fit or result.score_capaciteit or 0.0),
                    'score_complexiteit_veiligheid_fit': float(result.score_complexiteit_veiligheid_fit or result.score_complexiteit or 0.0),
                    'score_performance_fit': float(result.score_performance_fit or result.score_performance or 0.0),
                },
                'explanation': {
                    'fit_summary': result.fit_samenvatting or 'Deterministische matchscore',
                    'factor_breakdown': _build_canonical_factor_breakdown(result),
                    'factors': {
                        'care_form': {
                            'status': 'match' if result.score_inhoudelijke_fit >= 8 else 'review',
                            'detail': 'Zorgvorm meegewogen in inhoudelijke fit.',
                        },
                        'urgency': {
                            'status': 'match' if result.score_complexiteit >= 7 else 'review',
                            'detail': f"Complexiteit/veiligheid fit: {result.score_complexiteit_veiligheid_fit or result.score_complexiteit:.1f}/15",
                        },
                        'specialization': {
                            'status': 'match' if result.score_inhoudelijke_fit >= 18 else 'review',
                            'detail': f"Inhoudelijke fit: {result.score_inhoudelijke_fit:.1f}/35",
                        },
                        'region': {
                            'status': 'exact' if result.score_contract_regio >= 10 else 'review',
                            'detail': f"Regio/contract fit: {result.score_regio_contract_fit or result.score_contract_regio:.1f}/20",
                        },
                        'capacity': {
                            'status': 'available' if result.score_capaciteit >= 12 else 'limited',
                            'detail': f"Capaciteit/wachttijd fit: {result.score_capaciteit_wachttijd_fit or result.score_capaciteit:.1f}/20",
                        },
                        'complexity': {
                            'status': 'match' if result.score_complexiteit_veiligheid_fit >= 10 else 'review',
                            'detail': f"Complexiteitsfit: {result.score_complexiteit_veiligheid_fit or result.score_complexiteit:.1f}/15",
                        },
                        'special_needs': {
                            'status': 'ok',
                            'detail': 'Geen contra-indicatie conflict gedetecteerd door matchingengine.',
                        },
                        'performance': {
                            'status': 'good' if result.score_performance >= 6 else 'review',
                            'detail': f"Performance fit: {result.score_performance_fit or result.score_performance:.1f}/10",
                        },
                    },
                    'confidence': str(result.confidence_label or '').lower(),
                    'confidence_reason': result.verificatie_advies or 'Confidence gebaseerd op score en datacompleetheid.',
                    'trade_offs': trade_offs,
                    'verification_guidance': (
                        [result.verificatie_advies] if result.verificatie_advies
                        else ['Verifieer capaciteit en contract voorafgaand aan plaatsing.']
                    ),
                    'verify_manually': (
                        [result.verificatie_advies] if result.verificatie_advies
                        else ['Verifieer capaciteit en contract voorafgaand aan plaatsing.']
                    ),
                    'warning_flags': _build_canonical_warning_flags(result),
                    'behavior_consideration': 'Deterministisch model toegepast met expliciete regio/contract- en capaciteitsfactoren.',
                    'behavior_influence': [],
                },
            }
        )

    return suggestions, [row for row in results if row.uitgesloten]


def _sync_matching_signals_for_intake(intake, suggestions, excluded_results):
    if intake is None:
        return

    open_status = CareSignal.SignalStatus.OPEN
    no_match_title = f'Geen werkbare match in regio voor casus {intake.pk}'

    if not suggestions:
        CareSignal.objects.update_or_create(
            due_diligence_process=intake,
            title=no_match_title,
            defaults={
                'signal_type': CareSignal.SignalType.NO_MATCH,
                'description': 'Er is geen actieve providerdekking met contracteerbare capaciteit voor de casusregio.',
                'risk_level': CareSignal.RiskLevel.HIGH,
                'status': open_status,
            },
        )
    else:
        CareSignal.objects.filter(
            due_diligence_process=intake,
            title=no_match_title,
            signal_type=CareSignal.SignalType.NO_MATCH,
            status=open_status,
        ).update(status=CareSignal.SignalStatus.RESOLVED)

    weak_matches = [row for row in suggestions if (row.get('match_score') or 0) < 55]
    if weak_matches:
        CareSignal.objects.update_or_create(
            due_diligence_process=intake,
            title=f'Alleen zwakke matches voor casus {intake.pk}',
            defaults={
                'signal_type': CareSignal.SignalType.CAPACITY_ISSUE,
                'description': 'Beschikbare kandidaten scoren laag op gecombineerde fit/regio/capaciteit.',
                'risk_level': CareSignal.RiskLevel.MEDIUM,
                'status': open_status,
            },
        )

    urgent_threshold = int(getattr(intake, 'max_toelaatbare_wachttijd_dagen', 0) or 0)
    if intake.urgency in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS} and urgent_threshold:
        top_wait = suggestions[0].get('avg_wait_days') if suggestions else None
        if top_wait is not None and top_wait > urgent_threshold:
            CareSignal.objects.update_or_create(
                due_diligence_process=intake,
                title=f'Urgente casus overschrijdt wachtnorm ({intake.pk})',
                defaults={
                    'signal_type': CareSignal.SignalType.WAIT_EXCEEDED,
                    'description': 'Urgentie en wachtnorm conflicteren met beschikbare regionale capaciteit.',
                    'risk_level': CareSignal.RiskLevel.HIGH,
                    'status': open_status,
                },
            )

    if excluded_results and len(excluded_results) >= 3:
        CareSignal.objects.update_or_create(
            due_diligence_process=intake,
            title=f'Herhaalde regionale schaarste voor profiel ({intake.pk})',
            defaults={
                'signal_type': CareSignal.SignalType.CAPACITY_ISSUE,
                'description': 'Meerdere kandidaten zijn uitgesloten door regio/contract/capaciteit.',
                'risk_level': CareSignal.RiskLevel.MEDIUM,
                'status': open_status,
            },
        )


def _build_matching_suggestions_for_intake(intake, provider_profiles, *, limit=5):
    canonical_suggestions, _excluded = _build_canonical_matching_suggestions_for_intake(
        intake,
        intake.organization,
        limit=limit,
    )
    if canonical_suggestions:
        return canonical_suggestions[:limit] if limit else canonical_suggestions

    suggestions = []

    for profile in provider_profiles:
        score = 0
        reasons = []

        category_match = False
        if intake.care_category_main_id:
            category_match = profile.target_care_categories.filter(id=intake.care_category_main_id).exists()
            if category_match:
                score += 40
                reasons.append('Categorie match')

        urgency_match = _provider_urgency_match(profile, intake)
        if urgency_match:
            score += 20
            reasons.append('Urgentie match')

        care_form_match = _provider_form_match(profile, intake)
        if care_form_match:
            score += 20
            reasons.append('Zorgvorm match')

        region_match = False
        region_type_match = False
        effective_region_id = intake.regio_id or intake.preferred_region_id
        if effective_region_id:
            region_match = (
                profile.served_regions.filter(id=effective_region_id).exists()
                or profile.secondary_served_regions.filter(id=effective_region_id).exists()
            )
            if region_match:
                score += 15
                reasons.append('Voorkeursregio match')
        elif intake.preferred_region_type:
            region_type_match = (
                profile.served_regions.filter(region_type=intake.preferred_region_type).exists()
                or profile.secondary_served_regions.filter(region_type=intake.preferred_region_type).exists()
            )
            if region_type_match:
                score += 8
                reasons.append('Regiotype match')

        free_slots = max(profile.max_capacity - profile.current_capacity, 0)
        if free_slots > 0:
            score += min(free_slots * 4, 20)
            reasons.append(f'{free_slots} vrije plekken')

        if profile.average_wait_days <= 14:
            score += 10
            reasons.append('Korte wachttijd')
        elif profile.average_wait_days <= 28:
            score += 5
            reasons.append('Acceptabele wachttijd')

        tradeoff = 'Handmatige afweging nodig'
        if free_slots <= 0:
            tradeoff = 'Geen directe capaciteit beschikbaar'
        elif profile.average_wait_days > 28:
            tradeoff = 'Lange wachttijd ondanks fit'
        elif score < 70:
            tradeoff = 'Lagere zekerheid dan topmatch'

        capacity_status, capacity_label = _capacity_status_label(free_slots)
        provider_location = _provider_location_payload(profile)
        specialization_summary = _provider_specialization_summary(profile)
        behavior_metrics = build_provider_behavior_metrics(profile.client_id)
        behavior_signals = derive_behavior_signals(behavior_metrics)
        behavior_labels = label_behavior_signals(behavior_signals)
        behavior_modifier = calculate_provider_behavior_modifier(
            behavior_metrics,
            case_context={
                'urgency': intake.urgency,
                'care_form': intake.preferred_care_form,
                'region_id': effective_region_id,
            },
        )
        explanation = _build_matching_explanation(
            match_score=min(score, 100),
            category_match=category_match,
            urgency_match=urgency_match,
            care_form_match=care_form_match,
            region_match=region_match,
            region_type_match=region_type_match,
            free_slots=free_slots,
            average_wait_days=profile.average_wait_days,
            specialization_summary=specialization_summary,
            tradeoff=tradeoff,
        )
        explanation['behavior_influence'] = describe_behavior_influence(
            behavior_metrics,
            behavior_signals,
            close_call_applied=False,
        )

        suggestions.append(
            {
                'casus_id': intake.pk,
                'zorgprofiel_id': None,
                'zorgaanbieder_id': None,
                'provider_id': profile.client_id,
                'provider_name': profile.client.name,
                'match_score': min(score, 100),
                'fit_score': min(score, 100),
                'totaalscore': min(score, 100),
                'score_inhoudelijke_fit': min(score, 35),
                'score_regio_contract_fit': 15 if region_match else 6 if region_type_match else 0,
                'score_capaciteit_wachttijd_fit': 20 if free_slots > 0 and profile.average_wait_days <= 14 else 10,
                'score_complexiteit_veiligheid_fit': 10 if urgency_match else 4,
                'score_performance_fit': 8 if profile.average_wait_days <= 21 else 5,
                'confidence_label': explanation.get('confidence') or 'medium',
                'fit_samenvatting': explanation.get('fit_summary') or '',
                'trade_offs': explanation.get('trade_offs') or [],
                'verificatie_advies': '; '.join(explanation.get('verify_manually') or []),
                'uitgesloten': False,
                'uitsluitreden': '',
                'ranking': None,
                'category_match': category_match,
                'urgency_match': urgency_match,
                'care_form_match': care_form_match,
                'region_match': region_match,
                'free_slots': free_slots,
                'avg_wait_days': profile.average_wait_days,
                'reason': reasons[0] if reasons else 'Handmatige beoordeling nodig',
                'reasons': reasons,
                'tradeoff': tradeoff,
                'capacity_status': capacity_status,
                'capacity_label': capacity_label,
                'specialization_summary': specialization_summary,
                'distance_km': None,
                'location': provider_location,
                'behavior_labels': behavior_labels,
                'explanation': explanation,
                'decision_hint': None,
                'decision_hint_code': None,
                'decision_comparison_to_top': '',
                'decision_trade_offs': [],
                'outcome_context': _build_provider_outcome_context(profile.client_id),
                '_base_match_score': min(score, 100),
                '_behavior_modifier': behavior_modifier,
                '_behavior_metrics': behavior_metrics,
                '_behavior_signals': behavior_signals,
                'scores': {
                    'score_inhoudelijke_fit': min(score, 35),
                    'score_regio_contract_fit': 15 if region_match else 6 if region_type_match else 0,
                    'score_capaciteit_wachttijd_fit': 20 if free_slots > 0 and profile.average_wait_days <= 14 else 10,
                    'score_complexiteit_veiligheid_fit': 10 if urgency_match else 4,
                    'score_performance_fit': 8 if profile.average_wait_days <= 21 else 5,
                },
            }
        )

    if suggestions:
        top_base_score = max(row['_base_match_score'] for row in suggestions)
        for suggestion in suggestions:
            distance_from_top = top_base_score - suggestion['_base_match_score']
            proximity_weight = _behavior_tiebreak_weight(distance_from_top)
            adjustment_points = suggestion['_behavior_modifier'] * 10.0 * proximity_weight
            adjusted_score = suggestion['_base_match_score'] + adjustment_points

            suggestion['fit_score'] = suggestion['_base_match_score']
            suggestion['match_score'] = max(0.0, min(100.0, round(adjusted_score, 1)))

            if proximity_weight > 0 and abs(adjustment_points) >= 0.1:
                suggestion['explanation']['behavior_consideration'] = (
                    'Operationele betrouwbaarheid meegewogen als secundaire tie-break bij vergelijkbare basismatch'
                )
                suggestion['explanation']['behavior_influence'] = describe_behavior_influence(
                    suggestion['_behavior_metrics'],
                    suggestion['_behavior_signals'],
                    close_call_applied=True,
                )
            elif proximity_weight > 0:
                suggestion['explanation']['behavior_consideration'] = (
                    'Operationele betrouwbaarheid meegewogen, maar zonder merkbaar ranking-effect'
                )

            suggestion.pop('_base_match_score', None)
            suggestion.pop('_behavior_modifier', None)
            suggestion.pop('_behavior_metrics', None)
            suggestion.pop('_behavior_signals', None)

    # ── Evaluation-outcome enrichment (feedback loop) ──────────────────────
    # Applies ProviderEvaluation aggregates as outcome signals per candidate.
    for suggestion in suggestions:
        pid = suggestion.get('provider_id')
        if pid is None:
            continue
        try:
            overall_agg = build_provider_evaluation_aggregates(pid)
            ctx_agg = build_provider_context_aggregates(
                pid,
                care_category_id=getattr(intake, 'care_category_main_id', None),
                urgency=getattr(intake, 'urgency', None),
            )
            apply_evaluation_outcome_to_candidate(suggestion, overall_agg, ctx_agg)
        except Exception:
            logger.exception(
                'Evaluation outcome enrichment failed for provider %s on intake %s',
                pid,
                intake.pk,
            )

    suggestions.sort(
        key=lambda row: (
            -row['match_score'],
            -row['fit_score'],
            row['provider_name'].lower(),
        )
    )
    if limit:
        return suggestions[:limit]
    return suggestions


def _assign_provider_to_intake(*, request, intake, provider, source):
    placement, created = PlacementRequest.objects.get_or_create(
        due_diligence_process=intake,
        defaults={
            'status': PlacementRequest.Status.IN_REVIEW,
            'proposed_provider': provider,
            'selected_provider': provider,
            'care_form': intake.preferred_care_form,
            'decision_notes': 'Automatisch toegewezen vanuit matching.',
        },
    )
    if not created:
        placement.proposed_provider = provider
        placement.selected_provider = provider
        if not placement.care_form:
            placement.care_form = intake.preferred_care_form
        placement.status = PlacementRequest.Status.IN_REVIEW
        placement.save(update_fields=['proposed_provider', 'selected_provider', 'care_form', 'status', 'updated_at'])

    if intake.status != CaseIntakeProcess.ProcessStatus.MATCHING:
        intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
        intake.save(update_fields=['status', 'updated_at'])

    log_action(
        request.user,
        AuditLog.Action.APPROVE,
        'MatchingAssignment',
        object_id=placement.id,
        object_repr=f'{intake.title} -> {provider.name}',
        changes={
            'intake_id': intake.id,
            'provider_id': provider.id,
            'provider_name': provider.name,
            'source': source,
        },
        request=request,
    )

    return placement


def _matching_history_for_intake(intake, *, limit=10):
    history_qs = AuditLog.objects.filter(
        model_name__in=['MatchingAssignment', 'MatchingRecommendation'],
        changes__intake_id=intake.id,
    ).order_by('-timestamp')
    return list(history_qs[:limit])


def _can_edit_intake(user, intake):
    if intake is None:
        return False

    linked_case = intake.case_record
    if linked_case is not None:
        return can_access_case_action(user, linked_case, CaseAction.EDIT)

    if intake.organization and can_manage_organization(user, intake.organization):
        return True

    return bool(intake.case_coordinator_id and intake.case_coordinator_id == user.id)


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


def _can_edit_assessment(user, assessment):
    if assessment is None:
        return False

    if _can_edit_intake(user, assessment.intake):
        return True

    return bool(assessment.assessed_by_id and assessment.assessed_by_id == user.id)


def _log_pilot_issue(request, *, category, detail, level='warning'):
    user = getattr(request, 'user', None)
    user_label = getattr(user, 'username', 'anonymous') if user and getattr(user, 'is_authenticated', False) else 'anonymous'
    log_method = getattr(logger, level, logger.warning)
    log_method(
        'pilot.%s user=%s path=%s detail=%s',
        category,
        user_label,
        getattr(request, 'path', '-'),
        detail,
    )


def _resolve_task_due_date(*, base_date=None, fallback_days=2):
    if base_date:
        return base_date
    return date.today() + timedelta(days=fallback_days)


def sync_intake_auto_tasks(process, user=None):
    task_config = AUTO_INTAKE_TASKS.get(process.status)
    auto_tasks = Deadline.objects.filter(due_diligence_process=process, auto_generated=True)

    if not task_config:
        auto_tasks.filter(is_completed=False).update(
            is_completed=True,
            completed_at=timezone.now(),
            completed_by=user,
        )
        return

    due_date = _resolve_task_due_date(
        base_date=process.target_completion_date,
        fallback_days=3,
    )

    current_task, created = Deadline.objects.get_or_create(
        due_diligence_process=process,
        auto_generated=True,
        generation_source=task_config['source'],
        task_type=task_config['task_type'],
        defaults={
            'title': task_config['title'],
            'description': f'Automatisch aangemaakt vanuit {task_config["source"].lower()} voor {process.title}.',
            'priority': task_config['priority'],
            'due_date': due_date,
            'assigned_to': process.case_coordinator,
            'created_by': user,
        },
    )

    update_fields = []
    if current_task.title != task_config['title']:
        current_task.title = task_config['title']
        update_fields.append('title')
    if current_task.priority != task_config['priority']:
        current_task.priority = task_config['priority']
        update_fields.append('priority')
    if current_task.due_date != due_date:
        current_task.due_date = due_date
        update_fields.append('due_date')
    if current_task.assigned_to_id != process.case_coordinator_id:
        current_task.assigned_to = process.case_coordinator
        update_fields.append('assigned_to')
    if update_fields:
        current_task.save(update_fields=update_fields)

    auto_tasks.exclude(pk=current_task.pk).filter(is_completed=False).update(
        is_completed=True,
        completed_at=timezone.now(),
        completed_by=user,
    )


def sync_case_phase_auto_tasks(case, user=None):
    phase_task = None
    if case.case_phase == CareCase.CasePhase.PLAATSING:
        phase_task = {
            'title': 'Plaatsing bevestigen',
            'task_type': Deadline.TaskType.CONFIRM_PLACEMENT,
            'priority': Deadline.Priority.URGENT,
            'source': Deadline.GenerationSource.PLACEMENT,
        }

    auto_tasks = Deadline.objects.filter(case_record=case, auto_generated=True)

    if not phase_task:
        auto_tasks.filter(is_completed=False).update(
            is_completed=True,
            completed_at=timezone.now(),
            completed_by=user,
        )
        return

    due_date = _resolve_task_due_date(fallback_days=1)
    current_task, created = Deadline.objects.get_or_create(
        case_record=case,
        auto_generated=True,
        generation_source=phase_task['source'],
        task_type=phase_task['task_type'],
        defaults={
            'title': phase_task['title'],
            'description': f'Automatisch aangemaakt vanuit plaatsing voor {case.title}.',
            'priority': phase_task['priority'],
            'due_date': due_date,
            'assigned_to': case.created_by,
            'created_by': user,
        },
    )

    update_fields = []
    if current_task.title != phase_task['title']:
        current_task.title = phase_task['title']
        update_fields.append('title')
    if current_task.priority != phase_task['priority']:
        current_task.priority = phase_task['priority']
        update_fields.append('priority')
    if current_task.due_date != due_date:
        current_task.due_date = due_date
        update_fields.append('due_date')
    if current_task.assigned_to_id != case.created_by_id:
        current_task.assigned_to = case.created_by
        update_fields.append('assigned_to')
    if update_fields:
        current_task.save(update_fields=update_fields)

    auto_tasks.exclude(pk=current_task.pk).filter(is_completed=False).update(
        is_completed=True,
        completed_at=timezone.now(),
        completed_by=user,
    )


def sync_automatic_deadlines_for_organization(org, user=None):
    if not org:
        return
    for process in CaseIntakeProcess.objects.filter(organization=org).select_related('case_coordinator'):
        sync_intake_auto_tasks(process, user=user)
    for case in CareCase.objects.filter(organization=org):
        sync_case_phase_auto_tasks(case, user=user)


PHASE_TO_PROCESS_STATUS = {
    CareCase.CasePhase.INTAKE: CaseIntakeProcess.ProcessStatus.INTAKE,
    CareCase.CasePhase.MATCHING: CaseIntakeProcess.ProcessStatus.MATCHING,
    CareCase.CasePhase.PROVIDER_BEOORDELING: CaseIntakeProcess.ProcessStatus.MATCHING,
    CareCase.CasePhase.PLAATSING: CaseIntakeProcess.ProcessStatus.DECISION,
    CareCase.CasePhase.ACTIEF: CaseIntakeProcess.ProcessStatus.COMPLETED,
    CareCase.CasePhase.AFGEROND: CaseIntakeProcess.ProcessStatus.COMPLETED,
}


def get_case_section_url(case, section=None):
    url = reverse('careon:case_detail', kwargs={'pk': case.pk})
    if section:
        return f'{url}#{section}'
    return url


def _coerce_case_process_defaults(case):
    start_date = case.start_date or case.created_at.date() or date.today()
    target_date = case.end_date or start_date + timedelta(days=14)
    return {
        'organization': case.organization,
        'contract': case,
        'title': case.title,
        'status': PHASE_TO_PROCESS_STATUS.get(case.case_phase, CaseIntakeProcess.ProcessStatus.INTAKE),
        'case_coordinator': case.created_by if case.created_by_id else None,
        'start_date': start_date,
        'target_completion_date': target_date,
        'assessment_summary': case.content or '',
        'description': case.content or '',
    }


def ensure_case_flow(case, user=None):
    process = getattr(case, 'due_diligence_process', None)
    if not process:
        process = CaseIntakeProcess.objects.filter(contract=case).select_related('case_assessment').first()
    if not process:
        process = CaseIntakeProcess.objects.filter(
            organization=case.organization,
            contract__isnull=True,
            title=case.title,
        ).order_by('-updated_at').first()

    process_defaults = _coerce_case_process_defaults(case)
    if process is None:
        process = CaseIntakeProcess.objects.create(**process_defaults)
    else:
        update_fields = []
        for field_name, field_value in process_defaults.items():
            current_value = getattr(process, field_name)
            if field_name in {'assessment_summary', 'description'}:
                if current_value or not field_value:
                    continue
            elif field_name in {'case_coordinator', 'start_date', 'target_completion_date'}:
                if current_value:
                    continue
            if current_value != field_value:
                setattr(process, field_name, field_value)
                update_fields.append(field_name)
        if update_fields:
            process.save(update_fields=update_fields)

    assessment_defaults = {'assessed_by': user} if user else {}
    assessment, _ = CaseAssessment.objects.get_or_create(
        due_diligence_process=process,
        defaults=assessment_defaults,
    )

    workflow = Workflow.objects.filter(contract=case).order_by('created_at').first()
    if workflow is None:
        Workflow.objects.create(
            title=f'Matching {case.title}',
            description='Automatisch overzicht voor de casusflow.',
            contract=case,
            created_by=user or case.created_by,
        )

    return process, assessment


def sync_case_flow_state(case, user=None):
    process, assessment = ensure_case_flow(case, user=user)

    desired_process_status = PHASE_TO_PROCESS_STATUS.get(case.case_phase, CaseIntakeProcess.ProcessStatus.INTAKE)
    if process.status != desired_process_status:
        process.status = desired_process_status
        process.save(update_fields=['status'])

    assessment_changed = False
    if case.case_phase in [CareCase.CasePhase.MATCHING, CareCase.CasePhase.PLAATSING, CareCase.CasePhase.ACTIEF, CareCase.CasePhase.AFGEROND]:
        if not assessment.matching_ready:
            assessment.matching_ready = True
            assessment_changed = True
        if assessment.assessment_status == CaseAssessment.AssessmentStatus.DRAFT:
            assessment.assessment_status = CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
            assessment_changed = True
    elif case.case_phase == CareCase.CasePhase.PROVIDER_BEOORDELING and assessment.assessment_status == CaseAssessment.AssessmentStatus.DRAFT:
        assessment.assessment_status = CaseAssessment.AssessmentStatus.UNDER_REVIEW
        assessment_changed = True
    if assessment_changed:
        assessment.save(update_fields=['matching_ready', 'assessment_status'])

    placement = process.indications.order_by('-updated_at', '-created_at').first()
    if case.client_id:
        if placement is None:
            placement = PlacementRequest.objects.create(
                due_diligence_process=process,
                proposed_provider=case.client,
                selected_provider=case.client,
                status=PlacementRequest.Status.APPROVED,
                care_form=process.preferred_care_form,
                start_date=case.start_date,
                decision_notes='Automatisch gekoppeld vanuit de casusflow.',
            )
        else:
            placement_updates = []
            if placement.proposed_provider_id != case.client_id:
                placement.proposed_provider = case.client
                placement_updates.append('proposed_provider')
            if placement.selected_provider_id != case.client_id:
                placement.selected_provider = case.client
                placement_updates.append('selected_provider')
            if placement.status != PlacementRequest.Status.APPROVED:
                placement.status = PlacementRequest.Status.APPROVED
                placement_updates.append('status')
            if not placement.care_form and process.preferred_care_form:
                placement.care_form = process.preferred_care_form
                placement_updates.append('care_form')
            if not placement.start_date and case.start_date:
                placement.start_date = case.start_date
                placement_updates.append('start_date')
            if placement_updates:
                placement.save(update_fields=placement_updates)

    sync_intake_auto_tasks(process, user=user)
    return process, assessment, placement


sync_contract_phase_auto_tasks = sync_case_phase_auto_tasks
get_contract_section_url = get_case_section_url
_coerce_contract_process_defaults = _coerce_case_process_defaults
ensure_contract_flow = ensure_case_flow
sync_contract_flow_state = sync_case_flow_state


def get_or_create_profile(user):
    profile, created = UserProfile.objects.get_or_create(user=user)
    return profile


def _normalize_design_mode(value):
    candidate = str(value or '').strip().lower()
    # Legacy mode is retired; keep backward-compatible coercion to SPA.
    if candidate in {DESIGN_MODE_SPA, 'legacy'}:
        return DESIGN_MODE_SPA
    return None


def _get_design_mode(request):
    stored = request.session.get(DESIGN_MODE_SESSION_KEY)
    normalized = _normalize_design_mode(stored)
    if normalized != DESIGN_MODE_SPA:
        request.session[DESIGN_MODE_SESSION_KEY] = DESIGN_MODE_SPA
        request.session.modified = True
    return DESIGN_MODE_SPA


def _render_spa_shell_response():
    spa_index_path = settings.BASE_DIR / 'theme' / 'static' / 'spa' / 'index.html'
    if spa_index_path.exists():
        response = HttpResponse(spa_index_path.read_text(encoding='utf-8'), content_type='text/html')
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
    return _disable_response_caching(response)


def index(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'landing.html')


def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except DatabaseError:
        return HttpResponse('DATABASE ERROR', status=503, content_type='text/plain')
    return HttpResponse("OK", content_type="text/plain")


def favicon(request):
    """Serve favicon.ico to avoid 404 errors. Returns 204 No Content."""
    return HttpResponse(status=204)


class TenantScopedQuerysetMixin:
    """Mixin to automatically scope querysets to the user's organization.

    Caches organization in request to avoid repeated lookups.
    Use self.get_organization() to access cached org in any view method.
    """
    def get_organization(self):
        """Get organization for current user, cached on request."""
        if not hasattr(self.request, '_cached_organization'):
            self.request._cached_organization = get_user_organization(self.request.user)
        return self.request._cached_organization

    def get_queryset(self):
        queryset = super().get_queryset()
        org = self.get_organization()
        return scope_queryset_for_organization(queryset, org)


class TenantAssignCreateMixin:
    def form_valid(self, form):
        set_organization_on_instance(form.instance, get_user_organization(self.request.user))
        return super().form_valid(form)


# ==================== CLIENT VIEWS ====================

class ClientListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = Client
    template_name = 'contracts/client_list.html'
    context_object_name = 'clients'
    paginate_by = 25

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        qs = scope_queryset_for_organization(Client.objects.all(), org).select_related(
            'provider_profile'
        ).prefetch_related(
            'provider_profile__served_regions',
            'wait_time_entries',
        )
        q = self.request.GET.get('q')
        status = self.request.GET.get('status')
        client_type = self.request.GET.get('type')
        region_type = self.request.GET.get('region_type')
        region_id = self.request.GET.get('region')
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(email__icontains=q) | Q(industry__icontains=q))
        if status:
            if status == 'REJECTED_OR_INFO':
                qs = qs.filter(status__in=[PlacementRequest.Status.REJECTED, PlacementRequest.Status.NEEDS_INFO])
            else:
                qs = qs.filter(status=status)
        if client_type:
            qs = qs.filter(client_type=client_type)
        if region_type:
            qs = qs.filter(provider_profile__served_regions__region_type=region_type)
        if region_id and region_id.isdigit():
            qs = qs.filter(provider_profile__served_regions__id=int(region_id))
        return qs.distinct().order_by('name')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = get_user_organization(self.request.user)
        tenant_clients = scope_queryset_for_organization(Client.objects.all(), org)
        filtered_clients = list(self.object_list)
        paginated_clients = list(ctx['clients'])
        workspace_summary = build_provider_workspace_summary(filtered_clients)

        client_stats = tenant_clients.aggregate(total=Count('id'))
        ctx['total_clients'] = client_stats['total']
        ctx['active_clients'] = workspace_summary['direct_capacity_count']
        ctx['provider_workspace_summary'] = workspace_summary
        ctx['provider_rows'] = build_provider_workspace_rows(paginated_clients)
        ctx['search_query'] = self.request.GET.get('q', '')
        ctx['selected_status'] = self.request.GET.get('status', '')
        ctx['selected_client_type'] = self.request.GET.get('type', '')
        selected_region_type = self.request.GET.get('region_type', '')
        region_qs = RegionalConfiguration.objects.filter(organization=org)
        if selected_region_type:
            region_qs = region_qs.filter(region_type=selected_region_type)
        ctx['region_type_choices'] = RegionalConfiguration._meta.get_field('region_type').choices
        ctx['selected_region_type'] = selected_region_type
        ctx['selected_region'] = self.request.GET.get('region', '')
        ctx['region_choices'] = region_qs.order_by('region_name')
        query_params = self.request.GET.copy()
        query_params.pop('page', None)
        ctx['pagination_query'] = query_params.urlencode()
        ctx['has_active_filters'] = any(
            self.request.GET.get(key)
            for key in ('q', 'status', 'type', 'region_type', 'region')
        )
        return ctx


class ClientDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = Client
    template_name = 'contracts/client_detail.html'
    context_object_name = 'client'

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        return scope_queryset_for_organization(Client.objects.all(), org)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        configurations = self.object.matters.all()[:10]
        case_records = self.object.contracts.all()[:10]
        ctx['configurations'] = configurations
        ctx['case_records'] = case_records
        ctx['documents'] = self.object.documents.all()[:10]

        profile = getattr(self.object, 'provider_profile', None)
        free_slots = 0
        waiting_days = 0
        capacity_status_label = 'Beperkt'
        capacity_status_badge = 'badge-capacity-limited'
        intake_timing_label = 'Intake op korte termijn'
        operational_status_line = 'Controleer capaciteit en casusfit voor toewijzing.'

        capability_rows = []
        why_passing = []
        constraints = []
        risk_signals = []

        case_fit_summary = {
            'label': 'Geen casus geselecteerd',
            'score': None,
            'details': ['Open matching met een casuscontext om fit direct te beoordelen.'],
        }
        selected_intake = None

        if profile:
            free_slots = max(profile.max_capacity - profile.current_capacity, 0)
            waiting_days = profile.average_wait_days or 0

            if free_slots <= 0 and profile.max_capacity > 0:
                capacity_status_label = 'Vol'
                capacity_status_badge = 'badge-capacity-full'
                intake_timing_label = 'Intake tijdelijk niet beschikbaar'
                operational_status_line = 'Geen vrije plek; alternatieve aanbieder nodig.'
            elif free_slots <= 2:
                capacity_status_label = 'Beperkt'
                capacity_status_badge = 'badge-capacity-limited'
                intake_timing_label = 'Intake beperkt beschikbaar'
                operational_status_line = 'Beperkte ruimte; snel beslissen aanbevolen.'
            else:
                capacity_status_label = 'Actief'
                capacity_status_badge = 'badge-capacity-open'
                intake_timing_label = 'Intake direct mogelijk'
                operational_status_line = 'Capaciteit beschikbaar voor directe plaatsing.'

            if waiting_days > 21:
                intake_timing_label = 'Intake met wachttijd'

            offered_forms = []
            if profile.offers_outpatient:
                offered_forms.append('Ambulant')
            if profile.offers_day_treatment:
                offered_forms.append('Dagbehandeling')
            if profile.offers_residential:
                offered_forms.append('Residentieel')
            if profile.offers_crisis:
                offered_forms.append('Crisisopvang')

            supported_urgency = []
            if profile.handles_low_urgency:
                supported_urgency.append('Laag')
            if profile.handles_medium_urgency:
                supported_urgency.append('Middel')
            if profile.handles_high_urgency:
                supported_urgency.append('Hoog')
            if profile.handles_crisis_urgency:
                supported_urgency.append('Crisis')

            complexity_support = []
            if profile.handles_simple:
                complexity_support.append('Enkelvoudig')
            if profile.handles_multiple:
                complexity_support.append('Meervoudig')
            if profile.handles_severe:
                complexity_support.append('Zwaar')

            ages = []
            if profile.target_age_0_4:
                ages.append('0-4')
            if profile.target_age_4_12:
                ages.append('4-12')
            if profile.target_age_12_18:
                ages.append('12-18')
            if profile.target_age_18_plus:
                ages.append('18+')

            capability_rows = [
                ('Zorgvormen', ', '.join(offered_forms) if offered_forms else 'Niet gespecificeerd'),
                ('Urgentie', ', '.join(supported_urgency) if supported_urgency else 'Niet gespecificeerd'),
                ('Complexiteit', ', '.join(complexity_support) if complexity_support else 'Niet gespecificeerd'),
                ('Doelgroep leeftijd', ', '.join(ages) if ages else 'Niet gespecificeerd'),
                ('Dienstgebied', profile.service_area or self.object.city or 'Niet gespecificeerd'),
            ]

            why_passing = [
                f'{free_slots} vrije plek(ken) beschikbaar' if free_slots > 0 else 'Capaciteit momenteel vol',
                f'Gemiddelde wachttijd: {waiting_days} dagen',
                'Profiel matchbaar op zorgvorm en urgentie',
            ]

            if profile.special_facilities:
                why_passing.append('Beschikt over aanvullende faciliteiten')

            if free_slots <= 0:
                constraints.append('Geen vrije plekken beschikbaar')
                risk_signals.append('Capaciteit is volledig benut')
            if waiting_days > 28:
                constraints.append('Wachttijd boven 4 weken')
                risk_signals.append('Verhoogde wachttijd voor intake')
            if not profile.offers_crisis:
                constraints.append('Geen crisisopvang in profiel')
            if not profile.special_facilities:
                constraints.append('Speciale faciliteiten niet gespecificeerd')

            intake_raw = (self.request.GET.get('intake') or '').strip()
            if intake_raw.isdigit():
                selected_intake = CaseIntakeProcess.objects.filter(
                    organization=self.object.organization,
                    pk=int(intake_raw),
                ).first()

            if selected_intake:
                form_fit = {
                    str(CaseIntakeProcess.CareForm.OUTPATIENT): profile.offers_outpatient,
                    str(CaseIntakeProcess.CareForm.DAY_TREATMENT): profile.offers_day_treatment,
                    str(CaseIntakeProcess.CareForm.RESIDENTIAL): profile.offers_residential,
                    str(CaseIntakeProcess.CareForm.CRISIS): profile.offers_crisis,
                }.get(str(selected_intake.preferred_care_form), False)
                urgency_fit = {
                    str(CaseIntakeProcess.Urgency.LOW): profile.handles_low_urgency,
                    str(CaseIntakeProcess.Urgency.MEDIUM): profile.handles_medium_urgency,
                    str(CaseIntakeProcess.Urgency.HIGH): profile.handles_high_urgency,
                    str(CaseIntakeProcess.Urgency.CRISIS): profile.handles_crisis_urgency,
                }.get(str(selected_intake.urgency), False)

                category_fit = False
                if selected_intake.care_category_main_id:
                    category_fit = profile.target_care_categories.filter(id=selected_intake.care_category_main_id).exists()

                fit_points = [form_fit, urgency_fit, category_fit]
                fit_score = int((sum(1 for p in fit_points if p) / 3) * 100)
                case_fit_summary = {
                    'label': f'Casus {selected_intake.pk}: {selected_intake.title}',
                    'score': fit_score,
                    'details': [
                        f"Zorgvorm fit: {'Ja' if form_fit else 'Nee'}",
                        f"Urgentie fit: {'Ja' if urgency_fit else 'Nee'}",
                        f"Categorie fit: {'Ja' if category_fit else 'Nee'}",
                    ],
                }
            else:
                case_fit_summary = {
                    'label': 'Geen casus geselecteerd',
                    'score': None,
                    'details': [
                        'Open deze aanbieder vanuit matching voor directe casusfit.',
                        'Gebruik Wijs toe om terug te gaan naar casusgerichte toewijzing.',
                    ],
                }

        track_record = {
            'active_cases': int(self.object.total_billed),
            'open_cases': int(self.object.outstanding_balance),
            'active_configurations': self.object.active_matters_count,
        }

        ctx['provider_profile'] = profile
        ctx['provider_free_slots'] = free_slots
        ctx['provider_wait_days'] = waiting_days
        ctx['provider_capacity_status_label'] = capacity_status_label
        ctx['provider_capacity_status_badge'] = capacity_status_badge
        ctx['provider_intake_timing_label'] = intake_timing_label
        ctx['provider_operational_status_line'] = operational_status_line
        ctx['provider_capability_rows'] = capability_rows
        ctx['provider_why_passing'] = why_passing
        ctx['provider_constraints'] = constraints
        ctx['provider_risk_signals'] = risk_signals
        ctx['selected_intake'] = selected_intake
        ctx['case_fit_summary'] = case_fit_summary
        ctx['provider_track_record'] = track_record

        # Evaluation outcome aggregates (feedback loop)
        try:
            evaluation_aggregates = build_provider_evaluation_aggregates(self.object.pk)
            from contracts.provider_outcome_aggregates import derive_evaluation_signals
            evaluation_signals = derive_evaluation_signals(evaluation_aggregates)
        except Exception:
            evaluation_aggregates = None
            evaluation_signals = {}
        ctx['evaluation_aggregates'] = evaluation_aggregates
        ctx['evaluation_signals'] = evaluation_signals
        ctx['evaluation_overview_href'] = reverse(
            'careon:provider_evaluation_stats', kwargs={'pk': self.object.pk}
        )
        return ctx


class ClientCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = Client
    form_class = ClientForm
    template_name = 'contracts/client_form.html'
    success_url = reverse_lazy('careon:client_list')

    def form_valid(self, form):
        set_organization_on_instance(form.instance, get_user_organization(self.request.user))
        form.instance.created_by = self.request.user
        response = super().form_valid(form)
        profile, _ = ProviderProfile.objects.get_or_create(client=self.object)
        profile.served_regions.set(form.cleaned_data.get('served_regions', []))
        log_action(self.request.user, 'CREATE', 'Client', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, f'Aanbieder "{self.object.name}" is aangemaakt.')
        return response

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        form.fields['served_regions'].queryset = RegionalConfiguration.objects.filter(organization=org).order_by('region_type', 'region_name')
        return form


class ClientUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = Client
    form_class = ClientForm
    template_name = 'contracts/client_form.html'
    success_url = reverse_lazy('careon:client_list')

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        return scope_queryset_for_organization(Client.objects.all(), org)

    def form_valid(self, form):
        response = super().form_valid(form)
        profile, _ = ProviderProfile.objects.get_or_create(client=self.object)
        profile.served_regions.set(form.cleaned_data.get('served_regions', []))
        log_action(self.request.user, 'UPDATE', 'Client', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, f'Aanbieder "{self.object.name}" is bijgewerkt.')
        return response

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        form.fields['served_regions'].queryset = RegionalConfiguration.objects.filter(organization=org).order_by('region_type', 'region_name')
        return form


@login_required
def provider_evaluation_stats(request, pk):
    """Provider evaluation outcome drill-down view.

    Shows acceptance trend, rejection reason breakdown, and needs-more-info
    patterns for a single provider, scoped to the user's organization.
    """
    org = get_user_organization(request.user)
    provider = get_object_or_404(
        scope_queryset_for_organization(Client.objects.all(), org),
        pk=pk,
    )

    evaluation_aggregates = build_provider_evaluation_aggregates(provider.pk)
    from contracts.provider_outcome_aggregates import derive_evaluation_signals, build_provider_context_aggregates as _ctx_agg
    evaluation_signals = derive_evaluation_signals(evaluation_aggregates)

    # Acceptance trend: last 20 evaluations ordered chronologically.
    from contracts.models import ProviderEvaluation
    recent_evaluations = list(
        ProviderEvaluation.objects.filter(provider=provider)
        .select_related('case', 'decided_by')
        .order_by('-created_at')[:20]
    )

    # Rejection reason breakdown (all time).
    rejection_reasons = evaluation_aggregates.get('top_rejection_reasons') or []

    # Per-care-category context aggregates (only for categories with ≥1 evaluation).
    from django.db.models import Count as _Count
    category_ids = list(
        ProviderEvaluation.objects.filter(provider=provider)
        .exclude(case__care_category_main__isnull=True)
        .values('case__care_category_main_id', 'case__care_category_main__name')
        .annotate(n=_Count('id'))
        .filter(n__gte=1)
        .values_list('case__care_category_main_id', flat=True)
    )
    category_context_rows = []
    for cat_id in category_ids[:5]:
        ctx_agg = _ctx_agg(provider.pk, care_category_id=cat_id)
        if ctx_agg.get('total_evaluations', 0) > 0:
            cat_name = ProviderEvaluation.objects.filter(
                provider=provider, case__care_category_main_id=cat_id
            ).values_list('case__care_category_main__name', flat=True).first() or str(cat_id)
            category_context_rows.append({
                'category_name': cat_name,
                'aggregates': ctx_agg,
                'signals': derive_evaluation_signals(ctx_agg),
            })

    return render(request, 'contracts/provider_evaluation_stats.html', {
        'provider': provider,
        'evaluation_aggregates': evaluation_aggregates,
        'evaluation_signals': evaluation_signals,
        'recent_evaluations': recent_evaluations,
        'rejection_reasons': rejection_reasons,
        'category_context_rows': category_context_rows,
    })


# ==================== CONFIGURATION VIEWS ====================

def get_configuration_scope_content(scope):
    if scope == CareConfiguration.Scope.REGIO:
        return {
            'entity_label': 'Regioconfiguratie',
            'entity_label_lower': 'regioconfiguratie',
            'page_title': 'Regioconfiguratie',
            'page_subtitle': 'Beheer regionale capaciteit, aanbieders en wachtnormen.',
            'create_label': 'Nieuwe regioconfiguratie',
            'search_placeholder': 'Zoek regioconfiguratie...',
            'empty_label': 'Geen regioconfiguraties gevonden.',
            'detail_title': 'Regioconfiguratie',
            'detail_subtitle': 'Regionale afspraken over capaciteit, wachttijd en aanbieders.',
            'form_title_create': 'Nieuwe regioconfiguratie',
            'form_title_update': 'Bewerk regioconfiguratie',
            'submit_label_create': 'Aanmaken regioconfiguratie',
            'submit_label_update': 'Bijwerken regioconfiguratie',
        }
    return {
        'entity_label': 'Gemeenteconfiguratie',
        'entity_label_lower': 'gemeenteconfiguratie',
        'page_title': 'Gemeenteconfiguratie',
        'page_subtitle': 'Beheer gemeentelijke capaciteit, aanbieders en wachtnormen.',
        'create_label': 'Nieuwe gemeenteconfiguratie',
        'search_placeholder': 'Zoek gemeenteconfiguratie...',
        'empty_label': 'Geen gemeenteconfiguraties gevonden.',
        'detail_title': 'Gemeenteconfiguratie',
        'detail_subtitle': 'Lokale afspraken over capaciteit, wachttijd en aanbieders.',
        'form_title_create': 'Nieuwe gemeenteconfiguratie',
        'form_title_update': 'Bewerk gemeenteconfiguratie',
        'submit_label_create': 'Aanmaken gemeenteconfiguratie',
        'submit_label_update': 'Bijwerken gemeenteconfiguratie',
    }

_SCOPE_QUERY_ALIASES = {
    'gemeente': CareConfiguration.Scope.GEMEENTE,
    'gemeenten': CareConfiguration.Scope.GEMEENTE,
    CareConfiguration.Scope.GEMEENTE: CareConfiguration.Scope.GEMEENTE,
    'regio': CareConfiguration.Scope.REGIO,
    'regios': CareConfiguration.Scope.REGIO,
    "regio's": CareConfiguration.Scope.REGIO,
    CareConfiguration.Scope.REGIO: CareConfiguration.Scope.REGIO,
}


class CareConfigurationDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = CareConfiguration
    template_name = 'contracts/configuration_detail.html'
    context_object_name = 'configuration'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(CareConfiguration.objects.all(), org)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        case_records = self.object.contracts.all()
        ctx['case_records'] = case_records
        ctx['linked_providers'] = self.object.linked_providers.all().order_by('name')
        ctx['documents'] = self.object.documents.all()[:10]
        ctx['time_entries'] = []
        ctx['tasks'] = self.object.tasks.all()[:10]
        ctx['deadlines'] = self.object.deadlines.filter(is_completed=False)[:10]
        ctx['risks'] = self.object.risks.all()[:10]
        ctx.update(get_configuration_scope_content(self.object.scope))
        return ctx


class CareConfigurationCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = CareConfiguration
    form_class = CareConfigurationForm
    template_name = 'contracts/configuration_form.html'

    def get_initial(self):
        initial = super().get_initial()
        raw_scope = (self.request.GET.get('scope') or '').strip()
        normalized_scope = _SCOPE_QUERY_ALIASES.get(raw_scope, _SCOPE_QUERY_ALIASES.get(raw_scope.upper()))
        if normalized_scope:
            initial['scope'] = normalized_scope
        client_id = (self.request.GET.get('client') or '').strip()
        if client_id.isdigit():
            org = get_user_organization(self.request.user)
            client = scope_queryset_for_organization(Client.objects.all(), org).filter(pk=int(client_id)).first()
            if client:
                initial['linked_providers'] = [client.pk]
        return initial

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        scope = ctx['form'].initial.get('scope') or CareConfiguration.Scope.GEMEENTE
        ctx.update(get_configuration_scope_content(scope))
        ctx['cancel_url'] = reverse('careon:regional_list') if scope == CareConfiguration.Scope.REGIO else reverse('careon:municipality_list')
        ctx['is_edit'] = False
        selected_provider_ids = ctx['form'].initial.get('linked_providers') or []
        ctx['prefilled_provider'] = ctx['form'].fields['linked_providers'].queryset.filter(pk__in=selected_provider_ids).first()
        return ctx

    def get_success_url(self):
        return reverse('careon:configuration_detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        set_organization_on_instance(form.instance, get_user_organization(self.request.user))
        form.instance.created_by = self.request.user
        form.instance.status = CareConfiguration.Status.ACTIVE if form.cleaned_data.get('is_active') else CareConfiguration.Status.ON_HOLD
        response = super().form_valid(form)
        if not self.object.client_id and self.object.linked_providers.exists():
            self.object.client = self.object.linked_providers.first()
            self.object.save(update_fields=['client'])
        log_action(self.request.user, 'CREATE', 'CareConfiguration', self.object.id, str(self.object), request=self.request)
        scope_content = get_configuration_scope_content(self.object.scope)
        messages.success(self.request, f'{scope_content["entity_label"]} "{self.object.title}" aangemaakt.')
        return response


class CareConfigurationUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = CareConfiguration
    form_class = CareConfigurationForm
    template_name = 'contracts/configuration_form.html'

    def get_success_url(self):
        return reverse('careon:configuration_detail', kwargs={'pk': self.object.pk})

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(CareConfiguration.objects.all(), org)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update(get_configuration_scope_content(self.object.scope))
        ctx['cancel_url'] = reverse('careon:regional_list') if self.object.scope == CareConfiguration.Scope.REGIO else reverse('careon:municipality_list')
        ctx['is_edit'] = True
        return ctx

    def form_valid(self, form):
        form.instance.status = CareConfiguration.Status.ACTIVE if form.cleaned_data.get('is_active') else CareConfiguration.Status.ON_HOLD
        response = super().form_valid(form)
        if not self.object.client_id and self.object.linked_providers.exists():
            self.object.client = self.object.linked_providers.first()
            self.object.save(update_fields=['client'])
        log_action(self.request.user, 'UPDATE', 'CareConfiguration', self.object.id, str(self.object), request=self.request)
        scope_content = get_configuration_scope_content(self.object.scope)
        messages.success(self.request, f'{scope_content["entity_label"]} "{self.object.title}" bijgewerkt.')
        return response


# ==================== DOCUMENT VIEWS ====================

class DocumentListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = Document
    template_name = 'contracts/document_list.html'
    context_object_name = 'documents'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = scope_queryset_for_organization(
            Document.objects.select_related('contract', 'matter', 'client', 'uploaded_by'),
            org,
        )
        q = self.request.GET.get('q')
        doc_type = self.request.GET.get('type')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(tags__icontains=q))
        if doc_type:
            qs = qs.filter(document_type=doc_type)
        return qs.order_by('-created_at')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        all_docs = scope_queryset_for_organization(Document.objects.all(), org)
        editable_document_ids = set()
        document_rows = []
        for doc in ctx['documents']:
            case_href = None
            intake = None
            if doc.contract:
                intake = getattr(doc.contract, 'due_diligence_process', None)
                if intake:
                    case_href = _case_detail_tab_href(intake.pk, 'documenten')

            if not doc.contract or can_access_case_action(self.request.user, doc.contract, CaseAction.EDIT):
                editable_document_ids.add(doc.pk)

            document_rows.append({
                'document': doc,
                'case_href': case_href,
                'can_edit': doc.pk in editable_document_ids,
            })

        ctx.update({
            'total_documents': all_docs.count(),
            'review_documents': all_docs.filter(status=Document.Status.REVIEW).count(),
            'draft_documents': all_docs.filter(status=Document.Status.DRAFT).count(),
            'editable_document_ids': editable_document_ids,
            'document_rows': document_rows,
        })
        return ctx


class DocumentDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = Document
    template_name = 'contracts/document_detail.html'
    context_object_name = 'document'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(Document.objects.all(), org)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['versions'] = Document.objects.filter(parent_document=self.object).order_by('-version')
        ctx['can_edit_document'] = (not self.object.contract) or can_access_case_action(
            self.request.user,
            self.object.contract,
            CaseAction.EDIT,
        )
        return ctx


class DocumentCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = Document
    form_class = DocumentForm
    template_name = 'contracts/document_form.html'
    success_url = reverse_lazy('careon:document_list')

    def form_valid(self, form):
        set_organization_on_instance(form.instance, get_user_organization(self.request.user))
        if form.instance.contract and not can_access_case_action(self.request.user, form.instance.contract, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om documenten aan deze casus toe te voegen.')
        form.instance.uploaded_by = self.request.user
        response = super().form_valid(form)
        log_action(self.request.user, 'CREATE', 'Document', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, f'Document "{self.object.title}" is toegevoegd.')
        return response


class DocumentUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = Document
    form_class = DocumentForm
    template_name = 'contracts/document_form.html'
    success_url = reverse_lazy('careon:document_list')

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(Document.objects.all(), org)

    def dispatch(self, request, *args, **kwargs):
        document = self.get_object()
        if document.contract and not can_access_case_action(request.user, document.contract, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om documenten van deze casus te bewerken.')
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        response = super().form_valid(form)
        log_action(self.request.user, 'UPDATE', 'Document', self.object.id, str(self.object), request=self.request)
        return response


# ==================== DEADLINE VIEWS ====================

class DeadlineListView(LoginRequiredMixin, ListView):
    model = Deadline
    template_name = 'contracts/deadline_list.html'
    context_object_name = 'deadlines'
    paginate_by = 25

    def get_organization(self):
        """Get organization for current user, cached on request."""
        if not hasattr(self.request, '_cached_organization'):
            self.request._cached_organization = get_user_organization(self.request.user)
        return self.request._cached_organization

    def get_queryset(self):
        org = self.get_organization()
        sync_automatic_deadlines_for_organization(org, user=self.request.user)
        qs = Deadline.objects.select_related('due_diligence_process', 'assigned_to', 'case_record').for_organization(org)
        show = self.request.GET.get('show', 'mine')
        if show == 'mine':
            qs = qs.filter(assigned_to=self.request.user, is_completed=False)
        elif show == 'today':
            qs = qs.filter(is_completed=False, due_date=date.today())
        elif show == 'overdue':
            qs = qs.filter(is_completed=False, due_date__lt=date.today())
        elif show == 'high':
            qs = qs.filter(is_completed=False, priority__in=[Deadline.Priority.HIGH, Deadline.Priority.URGENT])
        elif show == 'all':
            pass
        else:
            qs = qs.filter(assigned_to=self.request.user, is_completed=False)

        owner = self.request.GET.get('owner', 'all')
        if owner == 'mine':
            qs = qs.filter(assigned_to=self.request.user)

        priority_rank = models.Case(
            models.When(priority=Deadline.Priority.URGENT, then=models.Value(0)),
            models.When(priority=Deadline.Priority.HIGH, then=models.Value(1)),
            models.When(priority=Deadline.Priority.MEDIUM, then=models.Value(2)),
            default=models.Value(3),
            output_field=models.IntegerField(),
        )
        return qs.annotate(priority_rank=priority_rank).order_by('is_completed', 'priority_rank', 'due_date', 'due_time')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        org_deadlines = Deadline.objects.for_organization(org)
        owner = self.request.GET.get('owner', 'all')
        stats_qs = org_deadlines
        if owner == 'mine':
            stats_qs = stats_qs.filter(assigned_to=self.request.user)

        today_value = date.today()
        ctx['today_count'] = stats_qs.filter(is_completed=False, due_date=today_value).count()
        ctx['overdue_count'] = stats_qs.filter(is_completed=False, due_date__lt=today_value).count()
        ctx['high_priority_count'] = stats_qs.filter(is_completed=False, priority__in=[Deadline.Priority.HIGH, Deadline.Priority.URGENT]).count()
        ctx['my_open_count'] = org_deadlines.filter(assigned_to=self.request.user, is_completed=False).count()
        ctx['all_count'] = stats_qs.count()
        ctx['completed_count'] = stats_qs.filter(is_completed=True).count()
        ctx['show'] = self.request.GET.get('show', 'mine')
        ctx['owner'] = owner
        ctx['today'] = today_value
        task_rows = []
        for deadline in ctx['deadlines']:
            if deadline.is_completed:
                row_status = 'Afgerond'
                row_status_class = 'bg-green-100 text-green-800'
            elif deadline.is_overdue:
                row_status = 'Te laat'
                row_status_class = 'bg-red-100 text-red-800'
            elif deadline.due_date == today_value:
                row_status = 'Vandaag'
                row_status_class = 'bg-orange-100 text-orange-800'
            else:
                row_status = 'Open'
                row_status_class = 'bg-blue-100 text-blue-800'

            linked_case = None
            if deadline.intake:
                linked_case = getattr(deadline.intake, 'contract', None)
                open_href = _case_detail_tab_href(deadline.intake.pk, 'taken')
                case_title = deadline.intake.title
            elif deadline.case_record:
                linked_case = deadline.case_record
                open_href = reverse('careon:case_detail', kwargs={'pk': deadline.case_record.pk})
                case_title = deadline.case_record.title
            else:
                open_href = None
                case_title = 'Niet gekoppeld'

            if deadline.priority == Deadline.Priority.URGENT:
                priority_class = 'bg-red-100 text-red-800'
            elif deadline.priority == Deadline.Priority.HIGH:
                priority_class = 'bg-orange-100 text-orange-800'
            elif deadline.priority == Deadline.Priority.MEDIUM:
                priority_class = 'bg-yellow-100 text-yellow-800'
            else:
                priority_class = 'bg-gray-100 text-gray-600'

            task_rows.append({
                'deadline': deadline,
                'case_title': case_title,
                'open_href': open_href,
                'row_status': row_status,
                'row_status_class': row_status_class,
                'priority_class': priority_class,
                'can_edit': (linked_case is None) or can_access_case_action(self.request.user, linked_case, CaseAction.EDIT),
            })

        ctx['task_rows'] = task_rows
        return ctx


class DeadlineCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = Deadline
    form_class = DeadlineForm
    template_name = 'contracts/deadline_form.html'
    success_url = reverse_lazy('careon:deadline_list')

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        if org:
            form.fields['due_diligence_process'].queryset = CaseIntakeProcess.objects.filter(
                organization=org
            ).order_by('-updated_at')
            form.fields['assigned_to'].queryset = User.objects.filter(
                organization_memberships__organization=org,
                organization_memberships__is_active=True,
            ).distinct().order_by('first_name', 'last_name', 'username')
        else:
            form.fields['due_diligence_process'].queryset = CaseIntakeProcess.objects.none()
            form.fields['assigned_to'].queryset = User.objects.none()

        selected_case = self.request.GET.get('case')
        if selected_case and selected_case.isdigit():
            form.initial['due_diligence_process'] = int(selected_case)
        return form

    def form_valid(self, form):
        intake = form.instance.intake
        if intake and not _can_edit_intake(self.request.user, intake):
            return HttpResponseForbidden('Je hebt geen rechten om opvolgtaken voor deze casus toe te voegen.')
        form.instance.created_by = self.request.user
        response = super().form_valid(form)
        if self.object.generation_source == Deadline.GenerationSource.MANUAL:
            self.object.generation_source = Deadline.GenerationSource.MANUAL
            self.object.save(update_fields=['generation_source'])
        log_action(self.request.user, 'CREATE', 'OpvolgingTaak', self.object.id, str(self.object), request=self.request)
        return response


class DeadlineUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = Deadline
    form_class = DeadlineForm
    template_name = 'contracts/deadline_form.html'
    success_url = reverse_lazy('careon:deadline_list')

    def get_queryset(self):
        org = self.get_organization()
        if not org:
            return Deadline.objects.none()
        return Deadline.objects.for_organization(org)

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        if org:
            form.fields['due_diligence_process'].queryset = CaseIntakeProcess.objects.filter(
                organization=org
            ).order_by('-updated_at')
            form.fields['assigned_to'].queryset = User.objects.filter(
                organization_memberships__organization=org,
                organization_memberships__is_active=True,
            ).distinct().order_by('first_name', 'last_name', 'username')
        else:
            form.fields['due_diligence_process'].queryset = CaseIntakeProcess.objects.none()
            form.fields['assigned_to'].queryset = User.objects.none()
        return form

    def dispatch(self, request, *args, **kwargs):
        deadline = self.get_object()
        linked_case = _resolve_deadline_case(deadline)
        if linked_case and not can_access_case_action(request.user, linked_case, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om opvolgtaken van deze casus te bewerken.')
        return super().dispatch(request, *args, **kwargs)


@login_required
@require_POST
def deadline_complete(request, pk):
    # Cache org on request for consistency
    if not hasattr(request, '_cached_organization'):
        request._cached_organization = get_user_organization(request.user)
    organization = request._cached_organization

    deadline_qs = Deadline.objects.for_organization(organization)
    deadline = get_object_or_404(deadline_qs, pk=pk)
    linked_case = _resolve_deadline_case(deadline)
    if linked_case and not can_access_case_action(request.user, linked_case, CaseAction.EDIT):
        return HttpResponseForbidden('Je hebt geen rechten om opvolgtaken van deze casus af te ronden.')
    deadline.is_completed = True
    deadline.completed_at = timezone.now()
    deadline.completed_by = request.user
    deadline.save()
    log_action(request.user, 'UPDATE', 'OpvolgingTaak', deadline.id, str(deadline), request=request)
    messages.success(request, f'Taak "{deadline.title}" gemarkeerd als afgerond.')
    return _redirect_to_safe_next_or_default(request, reverse('careon:deadline_list'))


@login_required
@require_POST
def signal_update_status(request, pk):
    if not hasattr(request, '_cached_organization'):
        request._cached_organization = get_user_organization(request.user)
    organization = request._cached_organization

    signal_qs = CareSignal.objects.for_organization(organization).select_related('due_diligence_process', 'case_record')
    signal = get_object_or_404(signal_qs, pk=pk)

    linked_case = _resolve_signal_case(signal)
    if linked_case and not can_access_case_action(request.user, linked_case, CaseAction.EDIT):
        return HttpResponseForbidden('Je hebt geen rechten om signalen van deze casus te wijzigen.')

    status = request.POST.get('status')
    valid_statuses = {
        CareSignal.SignalStatus.OPEN,
        CareSignal.SignalStatus.IN_PROGRESS,
        CareSignal.SignalStatus.RESOLVED,
    }
    if status not in valid_statuses:
        messages.error(request, 'Ongeldige signaalstatus.')
        fallback_url = reverse('careon:signal_detail', kwargs={'pk': signal.pk})
        if signal.due_diligence_process_id:
            fallback_url = f"{reverse('careon:case_detail', kwargs={'pk': signal.due_diligence_process_id})}?tab=signalen"
        return _redirect_to_safe_next_or_default(request, fallback_url)

    if signal.status != status:
        signal.status = status
        signal.save(update_fields=['status', 'updated_at'])
        log_action(
            request.user,
            'UPDATE',
            'CareSignal',
            signal.id,
            str(signal),
            changes={'status': status},
            request=request,
        )
        messages.success(request, 'Signaalstatus bijgewerkt.')
    else:
        messages.info(request, 'Signaalstatus was al up-to-date.')

    fallback_url = reverse('careon:signal_detail', kwargs={'pk': signal.pk})
    if signal.due_diligence_process_id:
        fallback_url = f"{reverse('careon:case_detail', kwargs={'pk': signal.due_diligence_process_id})}?tab=signalen"
    return _redirect_to_safe_next_or_default(request, fallback_url)


# ==================== AUDIT LOG VIEW ====================

class AuditLogListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = AuditLog
    template_name = 'contracts/audit_log_list.html'
    context_object_name = 'logs'
    paginate_by = 50

    def get_queryset(self):
        qs = AuditLog.objects.select_related('user')
        action = self.request.GET.get('action')
        model = self.request.GET.get('model')
        if action:
            qs = qs.filter(action=action)
        if model:
            qs = qs.filter(model_name=model)
        return qs.order_by('-timestamp')


# ==================== NOTIFICATION VIEWS ====================

@login_required
def notification_list(request):
    all_notifications = Notification.objects.filter(recipient=request.user).order_by('-created_at')
    unread_count = all_notifications.filter(is_read=False).count()
    notifications = all_notifications[:50]
    return render(request, 'contracts/notification_list.html', {
        'notifications': notifications,
        'unread_count': unread_count,
    })


@login_required
@require_POST
def mark_notification_read(request, pk):
    notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
    notification.is_read = True
    notification.save()
    if notification.link:
        return redirect(notification.link)
    return redirect('careon:notification_list')


@login_required
@require_POST
def mark_all_notifications_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return redirect('careon:notification_list')


@login_required
@require_POST
def switch_organization(request):
    org_id = request.POST.get('organization_id')
    membership = (
        OrganizationMembership.objects
        .filter(
            user=request.user,
            is_active=True,
            organization__is_active=True,
            organization_id=org_id,
        )
        .select_related('organization')
        .first()
    )
    if membership:
        request.session['active_organization_id'] = membership.organization_id
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'OrganizationMembership',
            object_id=membership.id,
            object_repr=str(membership),
            changes={'event': 'switch_organization', 'organization_id': membership.organization_id},
            request=request,
        )
        messages.success(request, f'Overgeschakeld naar {membership.organization.name}.')
    else:
        messages.error(request, 'Je hebt geen toegang tot die organisatie.')
    return redirect(request.META.get('HTTP_REFERER', 'dashboard'))



def _build_invite_url(request, invitation):
    return request.build_absolute_uri(
        reverse('careon:accept_organization_invite', kwargs={'token': invitation.token})
    )


def _send_invitation_email(invitation, invite_url):
    subject = f"Uitnodiging voor {invitation.organization.name}"
    body = (
        f"Je bent uitgenodigd om deel te nemen aan {invitation.organization.name} als {invitation.get_role_display()}.\n\n"
        f"Accepteer uitnodiging: {invite_url}\n\n"
        "Deze link verloopt over 7 dagen."
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', None),
        recipient_list=[invitation.email],
        fail_silently=False,
    )


@login_required
def organization_team(request):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization:
        messages.error(request, 'Geen actieve organisatie gevonden.')
        return redirect('dashboard')

    if not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Alleen organisatie-eigenaren of beheerders kunnen teamuitnodigingen beheren.')

    if request.method == 'POST':
        form = OrganizationInvitationForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            role = form.cleaned_data['role']

            existing_member = (
                OrganizationMembership.objects
                .filter(organization=organization, user__email__iexact=email, is_active=True)
                .select_related('user')
                .first()
            )
            if existing_member:
                messages.warning(request, f'{email} is al een actief lid van deze organisatie.')
                return redirect('careon:organization_team')

            pending_invitation = (
                OrganizationInvitation.objects
                .filter(
                    organization=organization,
                    email__iexact=email,
                    status=OrganizationInvitation.Status.PENDING,
                )
                .order_by('-created_at')
                .first()
            )
            if pending_invitation and (not pending_invitation.expires_at or pending_invitation.expires_at > timezone.now()):
                invite_url = _build_invite_url(request, pending_invitation)
                messages.info(request, f'Er bestaat al een actieve uitnodiging voor {email}: {invite_url}')
                return redirect('careon:organization_team')

            invitation = OrganizationInvitation.objects.create(
                organization=organization,
                email=email,
                role=role,
                invited_by=request.user,
                expires_at=timezone.now() + timedelta(days=7),
            )
            log_action(
                request.user,
                AuditLog.Action.CREATE,
                'OrganizationInvitation',
                object_id=invitation.id,
                object_repr=invitation.email,
                changes={
                    'organization_id': organization.id,
                    'email': invitation.email,
                    'role': invitation.role,
                    'event': 'invite_created',
                },
                request=request,
            )
            invite_url = _build_invite_url(request, invitation)
            try:
                _send_invitation_email(invitation, invite_url)
                messages.success(request, f'Uitnodiging aangemaakt en verzonden naar {email}. Link: {invite_url}')
            except Exception:
                messages.warning(request, f'Uitnodiging aangemaakt voor {email}, maar e-mailbezorging mislukte. Deel deze link handmatig: {invite_url}')
            return redirect('careon:organization_team')
    else:
        form = OrganizationInvitationForm()

    memberships = (
        OrganizationMembership.objects
        .filter(organization=organization, is_active=True)
        .select_related('user')
        .order_by('role', 'user__username')
    )
    inactive_memberships = (
        OrganizationMembership.objects
        .filter(organization=organization, is_active=False)
        .select_related('user')
        .order_by('user__username')
    )
    invitations = (
        OrganizationInvitation.objects
        .filter(organization=organization, status=OrganizationInvitation.Status.PENDING)
        .order_by('-created_at')
    )
    invitation_history = (
        OrganizationInvitation.objects
        .filter(organization=organization)
        .exclude(status=OrganizationInvitation.Status.PENDING)
        .select_related('invited_by', 'invited_user')
        .order_by('-created_at')[:20]
    )

    return render(request, 'contracts/organization_team.html', {
        'organization': organization,
        'memberships': memberships,
        'inactive_memberships': inactive_memberships,
        'invitations': invitations,
        'invitation_history': invitation_history,
        'invite_form': form,
        'is_owner': is_organization_owner(request.user, organization),
        'current_user_id': request.user.id,
    })


@login_required
@require_POST
def revoke_organization_invite(request, invite_id):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization or not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Onvoldoende rechten.')

    invitation = get_object_or_404(OrganizationInvitation, id=invite_id, organization=organization)
    if invitation.status == OrganizationInvitation.Status.PENDING:
        invitation.status = OrganizationInvitation.Status.REVOKED
        invitation.save(update_fields=['status'])
        log_action(
            request.user,
            AuditLog.Action.REJECT,
            'OrganizationInvitation',
            object_id=invitation.id,
            object_repr=invitation.email,
            changes={'organization_id': organization.id, 'event': 'invite_revoked'},
            request=request,
        )
        messages.success(request, f'Uitnodiging voor {invitation.email} is ingetrokken.')
    else:
        messages.info(request, 'Alleen openstaande uitnodigingen kunnen worden ingetrokken.')
    return redirect('careon:organization_team')


@login_required
@require_POST
def resend_organization_invite(request, invite_id):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization or not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Onvoldoende rechten.')

    invitation = get_object_or_404(OrganizationInvitation, id=invite_id, organization=organization)
    if invitation.status != OrganizationInvitation.Status.PENDING:
        messages.info(request, 'Alleen openstaande uitnodigingen kunnen opnieuw worden verzonden.')
        return redirect('careon:organization_team')

    invitation.status = OrganizationInvitation.Status.REVOKED
    invitation.save(update_fields=['status'])
    log_action(
        request.user,
        AuditLog.Action.REJECT,
        'OrganizationInvitation',
        object_id=invitation.id,
        object_repr=invitation.email,
        changes={'organization_id': organization.id, 'event': 'invite_superseded_for_resend'},
        request=request,
    )

    new_invitation = OrganizationInvitation.objects.create(
        organization=organization,
        email=invitation.email,
        role=invitation.role,
        invited_by=request.user,
        expires_at=timezone.now() + timedelta(days=7),
    )
    log_action(
        request.user,
        AuditLog.Action.CREATE,
        'OrganizationInvitation',
        object_id=new_invitation.id,
        object_repr=new_invitation.email,
        changes={'organization_id': organization.id, 'event': 'invite_resent', 'role': new_invitation.role},
        request=request,
    )
    invite_url = _build_invite_url(request, new_invitation)
    try:
        _send_invitation_email(new_invitation, invite_url)
        messages.success(request, f'Uitnodiging opnieuw verzonden naar {new_invitation.email}.')
    except Exception:
        messages.warning(request, f'Nieuwe uitnodiging aangemaakt, maar e-mailbezorging mislukte. Deel deze link handmatig: {invite_url}')
    return redirect('careon:organization_team')


@login_required
@require_POST
def update_membership_role(request, membership_id):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization or not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Onvoldoende rechten.')

    membership = get_object_or_404(OrganizationMembership, id=membership_id, organization=organization, is_active=True)
    requested_role = request.POST.get('role')
    allowed_roles = {choice[0] for choice in OrganizationMembership.Role.choices}
    if requested_role not in allowed_roles:
        messages.error(request, 'Ongeldige rolselectie.')
        return redirect('careon:organization_team')

    actor_is_owner = is_organization_owner(request.user, organization)
    if requested_role == OrganizationMembership.Role.OWNER and not actor_is_owner:
        messages.error(request, 'Alleen organisatie-eigenaren kunnen de rol Eigenaar toekennen.')
        return redirect('careon:organization_team')

    if membership.user_id == request.user.id and membership.role == OrganizationMembership.Role.OWNER and requested_role != OrganizationMembership.Role.OWNER:
        owner_count = OrganizationMembership.objects.filter(
            organization=organization,
            is_active=True,
            role=OrganizationMembership.Role.OWNER,
        ).count()
        if owner_count <= 1:
            messages.error(request, 'Er moet minimaal een actieve eigenaar in de organisatie overblijven.')
            return redirect('careon:organization_team')

    membership.role = requested_role
    membership.save(update_fields=['role'])
    log_action(
        request.user,
        AuditLog.Action.UPDATE,
        'OrganizationMembership',
        object_id=membership.id,
        object_repr=str(membership),
        changes={'organization_id': organization.id, 'event': 'role_updated', 'new_role': requested_role},
        request=request,
    )
    messages.success(request, f'Rol bijgewerkt voor {membership.user.email or membership.user.username}.')
    return redirect('careon:organization_team')


@login_required
@require_POST
def deactivate_organization_member(request, membership_id):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization or not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Onvoldoende rechten.')

    membership = get_object_or_404(OrganizationMembership, id=membership_id, organization=organization, is_active=True)
    if membership.user_id == request.user.id:
        messages.error(request, 'Je kunt je eigen lidmaatschap niet deactiveren.')
        return redirect('careon:organization_team')

    if membership.role == OrganizationMembership.Role.OWNER:
        owner_count = OrganizationMembership.objects.filter(
            organization=organization,
            is_active=True,
            role=OrganizationMembership.Role.OWNER,
        ).count()
        if owner_count <= 1:
            messages.error(request, 'Er moet minimaal een actieve eigenaar in de organisatie overblijven.')
            return redirect('careon:organization_team')

    membership.is_active = False
    membership.save(update_fields=['is_active'])
    log_action(
        request.user,
        AuditLog.Action.DELETE,
        'OrganizationMembership',
        object_id=membership.id,
        object_repr=str(membership),
        changes={'organization_id': organization.id, 'event': 'member_deactivated'},
        request=request,
    )
    messages.success(request, f'Lidmaatschap gedeactiveerd voor {membership.user.email or membership.user.username}.')
    return redirect('careon:organization_team')


@login_required
@require_POST
def reactivate_organization_member(request, membership_id):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization or not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Onvoldoende rechten.')

    membership = get_object_or_404(OrganizationMembership, id=membership_id, organization=organization)
    if membership.is_active:
        messages.info(request, 'Dit lidmaatschap is al actief.')
        return redirect('careon:organization_team')

    membership.is_active = True
    membership.save(update_fields=['is_active'])
    log_action(
        request.user,
        AuditLog.Action.UPDATE,
        'OrganizationMembership',
        object_id=membership.id,
        object_repr=str(membership),
        changes={'organization_id': organization.id, 'event': 'member_reactivated'},
        request=request,
    )
    messages.success(request, f'Lidmaatschap opnieuw geactiveerd voor {membership.user.email or membership.user.username}.')
    return redirect('careon:organization_team')


def _filter_organization_activity_logs(request, organization):
    logs = AuditLog.objects.select_related('user').filter(changes__organization_id=organization.id)
    action = request.GET.get('action', '').strip()
    model_name = request.GET.get('model', '').strip()
    start_date = parse_date((request.GET.get('start_date') or '').strip())
    end_date = parse_date((request.GET.get('end_date') or '').strip())

    if action:
        logs = logs.filter(action=action)
    if model_name:
        logs = logs.filter(model_name=model_name)
    if start_date:
        logs = logs.filter(timestamp__date__gte=start_date)
    if end_date:
        logs = logs.filter(timestamp__date__lte=end_date)

    return logs.order_by('-timestamp')


@login_required
def organization_activity(request):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization:
        messages.error(request, 'Geen actieve organisatie gevonden.')
        return redirect('dashboard')

    if not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Alleen organisatie-eigenaren of beheerders kunnen organisatieactiviteit bekijken.')

    logs = _filter_organization_activity_logs(request, organization)
    paginator = Paginator(logs, 50)
    page_obj = paginator.get_page(request.GET.get('page') or 1)

    query_params = request.GET.copy()
    query_params.pop('page', None)

    return render(request, 'contracts/organization_activity.html', {
        'organization': organization,
        'logs': page_obj.object_list,
        'page_obj': page_obj,
        'is_paginated': page_obj.has_other_pages(),
        'query_string': query_params.urlencode(),
    })


@login_required
def organization_activity_export(request):
    organization = getattr(request, 'organization', None) or get_user_organization(request.user)
    if not organization:
        messages.error(request, 'Geen actieve organisatie gevonden.')
        return redirect('dashboard')

    if not can_manage_organization(request.user, organization):
        return HttpResponseForbidden('Alleen organisatie-eigenaren of beheerders kunnen organisatieactiviteit exporteren.')

    logs = _filter_organization_activity_logs(request, organization)
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="organization-activity-{organization.slug}-{date.today().isoformat()}.csv"'

    writer = csv.writer(response)
    writer.writerow(['timestamp', 'user', 'action', 'model_name', 'object_repr', 'event', 'ip_address'])
    for log in logs.iterator():
        event = (log.changes or {}).get('event', '')
        writer.writerow([
            log.timestamp.isoformat(),
            (log.user.get_full_name() or log.user.username) if log.user else 'System',
            log.action,
            log.model_name,
            log.object_repr,
            event,
            log.ip_address or '',
        ])

    return response


@login_required
def accept_organization_invite(request, token):
    invitation = get_object_or_404(
        OrganizationInvitation.objects.select_related('organization'),
        token=token,
    )

    if invitation.status != OrganizationInvitation.Status.PENDING:
        messages.error(request, 'Deze uitnodiging is niet meer geldig.')
        return redirect('dashboard')

    if invitation.expires_at and invitation.expires_at <= timezone.now():
        invitation.status = OrganizationInvitation.Status.EXPIRED
        invitation.save(update_fields=['status'])
        messages.error(request, 'Deze uitnodiging is verlopen.')
        return redirect('dashboard')

    user_email = (request.user.email or '').strip().lower()
    if not user_email or user_email != invitation.email.lower():
        messages.error(request, f'Deze uitnodiging is voor {invitation.email}. Log in met dat e-mailadres.')
        return redirect('dashboard')

    membership, _ = OrganizationMembership.objects.get_or_create(
        organization=invitation.organization,
        user=request.user,
        defaults={
            'role': invitation.role,
            'is_active': True,
        },
    )
    if membership.role != invitation.role or not membership.is_active:
        membership.role = invitation.role
        membership.is_active = True
        membership.save(update_fields=['role', 'is_active'])

    invitation.status = OrganizationInvitation.Status.ACCEPTED
    invitation.invited_user = request.user
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=['status', 'invited_user', 'accepted_at'])
    log_action(
        request.user,
        AuditLog.Action.APPROVE,
        'OrganizationInvitation',
        object_id=invitation.id,
        object_repr=invitation.email,
        changes={
            'organization_id': invitation.organization_id,
            'event': 'invite_accepted',
            'role': invitation.role,
        },
        request=request,
    )

    request.session['active_organization_id'] = invitation.organization_id
    messages.success(request, f'Je bent toegevoegd aan {invitation.organization.name}.')
    return redirect('dashboard')


# ==================== REPORTS VIEW ====================

@login_required
def reports_dashboard(request):
    today = date.today()
    org = get_user_organization(request.user)

    # UI filters
    attention_filter = request.GET.get('attention', 'all')
    domain_filter = request.GET.get('domain', '')
    region_type_filter = request.GET.get('region_type', '')
    region_filter = request.GET.get('region', '')
    try:
        stagnation_days = int(request.GET.get('stagnation_days', 21))
    except (TypeError, ValueError):
        stagnation_days = 21
    stagnation_days = max(7, min(stagnation_days, 120))

    case_records_qs = scope_queryset_for_organization(CareCase.objects.all(), org)
    clients_qs = scope_queryset_for_organization(Client.objects.all(), org)
    configurations_qs = scope_queryset_for_organization(CareConfiguration.objects.all(), org)

    if org:
        cases_qs = CaseIntakeProcess.objects.filter(organization=org)
        indications_qs = PlacementRequest.objects.filter(due_diligence_process__organization=org)
        risks_qs = CareSignal.objects.for_organization(org)
        provider_profiles_qs = ProviderProfile.objects.filter(client__organization=org)
        waittime_qs = TrustAccount.objects.filter(provider__organization=org).select_related('provider')
    else:
        cases_qs = CaseIntakeProcess.objects.none()
        indications_qs = PlacementRequest.objects.none()
        risks_qs = CareSignal.objects.none()
        provider_profiles_qs = ProviderProfile.objects.none()
        waittime_qs = TrustAccount.objects.none()

    if domain_filter:
        configurations_qs = configurations_qs.filter(care_domains__id=domain_filter)
        case_records_qs = case_records_qs.filter(matter__care_domains__id=domain_filter)

    if region_type_filter:
        cases_qs = cases_qs.filter(preferred_region_type=region_type_filter)
    if region_filter.isdigit():
        cases_qs = cases_qs.filter(preferred_region_id=int(region_filter))

    # KPI 1: Casussen zonder match
    matched_case_ids = indications_qs.filter(selected_provider__isnull=False).values_list('due_diligence_process_id', flat=True)
    unmatched_cases_qs = (
        cases_qs
        .filter(status__in=[CaseIntakeProcess.ProcessStatus.MATCHING, CaseIntakeProcess.ProcessStatus.DECISION])
        .exclude(id__in=matched_case_ids)
        .select_related('case_coordinator', 'care_category_main')
        .order_by('target_completion_date', '-updated_at')
    )
    cases_without_match_count = unmatched_cases_qs.count()

    # KPI 2: Gemiddelde wachttijd (dagen)
    avg_wait_days = waittime_qs.aggregate(avg=Avg('wait_days'))['avg']
    if avg_wait_days is None:
        avg_wait_days = provider_profiles_qs.aggregate(avg=Avg('average_wait_days'))['avg'] or 0

    # KPI 3: Stagnaties (> X dagen)
    stagnation_limit_date = today - timedelta(days=stagnation_days)
    stagnated_cases_qs = (
        cases_qs
        .filter(
            status__in=[
                CaseIntakeProcess.ProcessStatus.INTAKE,
                CaseIntakeProcess.ProcessStatus.MATCHING,
                CaseIntakeProcess.ProcessStatus.DECISION,
            ],
            start_date__lt=stagnation_limit_date,
        )
        .select_related('case_coordinator', 'care_category_main')
        .order_by('start_date')
    )
    stagnation_count = stagnated_cases_qs.count()

    # KPI 4: Escalaties
    escalation_qs = (
        risks_qs
        .filter(status__in=[CareSignal.SignalStatus.OPEN, CareSignal.SignalStatus.IN_PROGRESS])
        .filter(Q(signal_type=CareSignal.SignalType.ESCALATION) | Q(risk_level__in=[CareSignal.RiskLevel.HIGH, CareSignal.RiskLevel.CRITICAL]))
        .select_related('due_diligence_process', 'assigned_to')
        .order_by('-updated_at')
    )
    escalation_count = escalation_qs.count()

    # Aanbieders zonder capaciteit
    no_capacity_qs = waittime_qs.filter(open_slots__lte=0).order_by('-waiting_list_size', '-wait_days')

    # AANDACHT NODIG (filterbaar)
    attention_rows = []
    if attention_filter in ['all', 'unmatched']:
        for case in unmatched_cases_qs[:6]:
            attention_rows.append({
                'kind': 'unmatched',
                'kind_label': 'Casus zonder match',
                'title': case.title,
                'meta': f"{case.get_status_display()} · {case.get_urgency_display()} · doel {case.target_completion_date:%d-%m-%Y}",
                'href': reverse('careon:intake_detail', kwargs={'pk': case.pk}),
            })
    if attention_filter in ['all', 'stagnation']:
        for case in stagnated_cases_qs[:6]:
            days_open = (today - case.start_date).days
            attention_rows.append({
                'kind': 'stagnation',
                'kind_label': 'Stagnatie',
                'title': case.title,
                'meta': f"{days_open} dagen in traject · {case.get_status_display()}",
                'href': reverse('careon:intake_detail', kwargs={'pk': case.pk}),
            })
    if attention_filter in ['all', 'capacity']:
        for wt in no_capacity_qs[:6]:
            provider_name = wt.provider.name if wt.provider else 'Onbekende aanbieder'
            attention_rows.append({
                'kind': 'capacity',
                'kind_label': 'Geen capaciteit',
                'title': provider_name,
                'meta': f"{wt.region} · wachtlijst {wt.waiting_list_size} · wachttijd {wt.wait_days} dagen",
                'href': reverse('careon:waittime_detail', kwargs={'pk': wt.pk}),
            })
    if attention_filter in ['all', 'escalation']:
        for signal in escalation_qs[:6]:
            case_title = signal.intake.title if signal.intake else 'Niet gekoppelde casus'
            attention_rows.append({
                'kind': 'escalation',
                'kind_label': 'Escalatie',
                'title': case_title,
                'meta': f"{signal.get_signal_type_display()} · {signal.get_risk_level_display()} · {signal.get_status_display()}",
                'href': reverse('careon:signal_update', kwargs={'pk': signal.pk}),
            })

    # Doorstroomtrend op basis van het centrale zorgproces
    flow_counts = {
        'case': cases_qs.filter(status=CaseIntakeProcess.ProcessStatus.INTAKE).count(),
        'matching': cases_qs.filter(status=CaseIntakeProcess.ProcessStatus.MATCHING).count(),
        'placement': cases_qs.filter(status=CaseIntakeProcess.ProcessStatus.DECISION).count(),
        'follow_up': cases_qs.filter(status=CaseIntakeProcess.ProcessStatus.COMPLETED).count(),
    }
    max_flow = max(max(flow_counts.values()), 1)
    flow_stages = [
        {'key': 'case', 'label': 'Intake', 'count': flow_counts['case'], 'width': int((flow_counts['case'] / max_flow) * 100)},
        {'key': 'matching', 'label': 'Matching', 'count': flow_counts['matching'], 'width': int((flow_counts['matching'] / max_flow) * 100)},
        {'key': 'placement', 'label': 'Plaatsing', 'count': flow_counts['placement'], 'width': int((flow_counts['placement'] / max_flow) * 100)},
        {'key': 'follow_up', 'label': 'Opvolging', 'count': flow_counts['follow_up'], 'width': int((flow_counts['follow_up'] / max_flow) * 100)},
    ]
    flow_drops = [
        ('Intake -> Matching', max(flow_counts['case'] - flow_counts['matching'], 0)),
        ('Matching -> Plaatsing', max(flow_counts['matching'] - flow_counts['placement'], 0)),
        ('Plaatsing -> Opvolging', max(flow_counts['placement'] - flow_counts['follow_up'], 0)),
    ]
    bottleneck_label, bottleneck_value = max(flow_drops, key=lambda x: x[1])

    # Verdeling (klikbaar filter)
    active_configurations = configurations_qs.filter(is_active=True).prefetch_related('care_domains')
    total_active_configurations = active_configurations.count()
    domain_counts = {}
    for config in active_configurations:
        for domain in config.care_domains.all():
            domain_counts[domain.id] = {
                'id': domain.id,
                'name': domain.name,
                'count': domain_counts.get(domain.id, {}).get('count', 0) + 1,
            }
    practice_area_rows = []
    for row in sorted(domain_counts.values(), key=lambda item: item['count'], reverse=True):
        code = str(row['id'])
        label = row['name']
        width = int((row['count'] / max(total_active_configurations, 1)) * 100)
        practice_area_rows.append({
            'code': code,
            'label': label,
            'count': row['count'],
            'width': width,
            'is_active': code == domain_filter,
        })

    # Aanbevelingen (optioneel)
    recommendations = []
    if cases_without_match_count > 0:
        recommendations.append({
            'title': 'Herverdeel casussen zonder match naar matchingteam',
            'detail': f'{cases_without_match_count} casussen wachten op aanbiederkeuze.',
            'href': reverse('careon:matching_dashboard'),
            'action': 'Open matchingoverzicht',
        })
    if no_capacity_qs.count() > 0:
        recommendations.append({
            'title': 'Optimaliseer capaciteit bij aanbieders zonder vrije plekken',
            'detail': f'{no_capacity_qs.count()} aanbieders hebben geen open plekken.',
            'href': reverse('careon:waittime_list'),
            'action': 'Bekijk wachttijden',
        })
    if float(avg_wait_days) > 28:
        recommendations.append({
            'title': 'Wachttijdwaarschuwing: gemiddelde boven 28 dagen',
            'detail': f'Huidig gemiddelde is {avg_wait_days:.1f} dagen.',
            'href': reverse('careon:client_list'),
            'action': 'Open aanbieders',
        })

    region_scope_qs = RegionalConfiguration.objects.filter(organization=org) if org else RegionalConfiguration.objects.none()
    if region_type_filter:
        region_scope_qs = region_scope_qs.filter(region_type=region_type_filter)

    matched_case_ids_set = set(matched_case_ids)
    region_rows = []
    for region in region_scope_qs.order_by('region_name')[:50]:
        region_cases_qs = cases_qs.filter(preferred_region=region)
        region_total = region_cases_qs.count()
        if not region_total:
            continue
        region_matching = region_cases_qs.filter(status__in=[
            CaseIntakeProcess.ProcessStatus.MATCHING,
            CaseIntakeProcess.ProcessStatus.DECISION,
        ]).count()
        region_unmatched = region_cases_qs.filter(
            status__in=[CaseIntakeProcess.ProcessStatus.MATCHING, CaseIntakeProcess.ProcessStatus.DECISION]
        ).exclude(id__in=matched_case_ids_set).count()
        region_rows.append({
            'name': region.region_name,
            'region_type': region.get_region_type_display(),
            'total': region_total,
            'matching': region_matching,
            'unmatched': region_unmatched,
        })

    total_clients = clients_qs.count()
    active_clients = clients_qs.filter(status='ACTIVE').count()
    total_configurations = configurations_qs.count()
    active_cases = case_records_qs.filter(status='ACTIVE').count()
    total_case_value = case_records_qs.aggregate(total=Coalesce(Sum('value'), Decimal('0')))['total']
    high_risk_cases = case_records_qs.filter(risk_level__in=['HIGH', 'CRITICAL']).count()

    context = {
        'total_clients': total_clients,
        'active_clients': active_clients,
        'active_cases': active_cases,
        'active_contracts': active_cases,
        'total_case_value': total_case_value,
        'total_contract_value': total_case_value,
        'total_configurations': total_configurations,
        'active_configurations': total_active_configurations,
        'overdue_deadlines': 0,
        'upcoming_deadlines': 0,
        'high_risks': high_risk_cases,
        'cases_without_match_count': cases_without_match_count,
        'avg_wait_days': avg_wait_days,
        'stagnation_count': stagnation_count,
        'stagnation_days': stagnation_days,
        'escalation_count': escalation_count,
        'attention_rows': attention_rows,
        'attention_filter': attention_filter,
        'flow_stages': flow_stages,
        'bottleneck_label': bottleneck_label,
        'bottleneck_value': bottleneck_value,
        'practice_areas': practice_area_rows,
        'domain_filter': domain_filter,
        'recommendations': recommendations,
        'region_rows': region_rows,
        'region_type_filter': region_type_filter,
        'region_filter': region_filter,
        'region_type_choices': RegionalConfiguration._meta.get_field('region_type').choices,
        'region_choices': region_scope_qs.order_by('region_name'),
    }
    return render(request, 'contracts/reports_dashboard.html', context)


# ==================== TASK VIEWS ====================

class CareTaskKanbanView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = CareTask
    template_name = 'contracts/task_board.html'
    context_object_name = 'care_tasks'

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        if not org:
            return CareTask.objects.none()
        return CareTask.objects.select_related('case_record', 'configuration', 'assigned_to').filter(
            Q(case_record__organization=org) | Q(configuration__organization=org)
        ).order_by('-updated_at', '-created_at')


@login_required
def task_board_redirect(request):
    return redirect('careon:care_task_kanban')


class CareTaskCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = CareTask
    form_class = CareTaskForm
    template_name = 'contracts/task_form.html'
    success_url = reverse_lazy('careon:task_list')

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        if org:
            form.fields['case_record'].queryset = scope_queryset_for_organization(CareCase.objects.all(), org)
            form.fields['configuration'].queryset = scope_queryset_for_organization(CareConfiguration.objects.all(), org)
        else:
            form.fields['case_record'].queryset = CareCase.objects.none()
            form.fields['configuration'].queryset = CareConfiguration.objects.none()
        return form

    def form_valid(self, form):
        org = get_user_organization(self.request.user)
        if form.instance.case_record and not can_access_case_action(self.request.user, form.instance.case_record, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om taken voor deze casus aan te maken.')
        if form.instance.configuration and org and form.instance.configuration.organization_id != org.id:
            return HttpResponseForbidden('Je hebt geen rechten om taken voor deze configuratie aan te maken.')
        return super().form_valid(form)


class CareTaskUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = CareTask
    form_class = CareTaskForm
    template_name = 'contracts/task_form.html'
    success_url = reverse_lazy('careon:task_list')

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        if not org:
            return CareTask.objects.none()
        return CareTask.objects.filter(
            Q(case_record__organization=org) | Q(configuration__organization=org)
        )

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        if org:
            form.fields['case_record'].queryset = scope_queryset_for_organization(CareCase.objects.all(), org)
            form.fields['configuration'].queryset = scope_queryset_for_organization(CareConfiguration.objects.all(), org)
        else:
            form.fields['case_record'].queryset = CareCase.objects.none()
            form.fields['configuration'].queryset = CareConfiguration.objects.none()
        return form

    def dispatch(self, request, *args, **kwargs):
        task = self.get_object()
        if task.case_record and not can_access_case_action(request.user, task.case_record, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om taken voor deze casus te bewerken.')
        org = get_user_organization(request.user)
        if task.configuration and org and task.configuration.organization_id != org.id:
            return HttpResponseForbidden('Je hebt geen rechten om taken voor deze configuratie te bewerken.')
        return super().dispatch(request, *args, **kwargs)


# ==================== BUDGET VIEWS ====================

class BudgetListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = Budget
    template_name = 'contracts/budget_list.html'
    context_object_name = 'budgets'

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        qs = scope_queryset_for_organization(
            Budget.objects.prefetch_related('linked_cases', 'linked_placements'),
            org,
        )
        search_query = (self.request.GET.get('q') or '').strip()
        year = (self.request.GET.get('year') or '').strip()

        if search_query:
            qs = qs.filter(
                Q(scope_name__icontains=search_query)
                | Q(target_group__icontains=search_query)
                | Q(care_type__icontains=search_query)
                | Q(description__icontains=search_query)
            )

        if year and year.isdigit():
            qs = qs.filter(year=int(year))

        return qs.order_by('-year', 'scope_type', 'scope_name', 'target_group')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = get_user_organization(self.request.user)
        tenant_budgets = scope_queryset_for_organization(Budget.objects.all(), org)
        tenant_configs = scope_queryset_for_organization(CareConfiguration.objects.all(), org)
        current_year = timezone.localdate().year
        ctx['search_query'] = (self.request.GET.get('q') or '').strip()
        ctx['selected_year'] = (self.request.GET.get('year') or '').strip()
        ctx['current_year'] = current_year
        budget_stats = tenant_budgets.aggregate(
            total=Count('id'),
            current_year=Count('id', filter=Q(year=current_year)),
            total_allocated=Coalesce(Sum('allocated_amount'), Decimal('0')),
        )

        total_spent = Decimal('0')
        total_remaining = Decimal('0')
        pressure_count = 0
        for budget in tenant_budgets.prefetch_related('expenses').all():
            spent = budget.spent_amount
            remaining = budget.remaining_amount
            total_spent += spent
            total_remaining += remaining
            if budget.utilization_percentage >= 80:
                pressure_count += 1

        ctx['total_budgets'] = budget_stats['total']
        ctx['current_year_budgets'] = budget_stats['current_year']
        ctx['total_allocated'] = budget_stats['total_allocated']
        ctx['total_spent'] = total_spent
        ctx['total_remaining'] = total_remaining
        ctx['budget_under_pressure'] = pressure_count
        ctx['budget_tabs'] = [
            ('Alle budgetten', ''),
            (str(current_year), str(current_year)),
        ]
        configured_scope_labels = {
            item.title.strip().lower(): f'Gebaseerd op {get_configuration_scope_content(item.scope)["entity_label_lower"]}'
            for item in tenant_configs.only('title', 'scope')
        }
        budget_rows = []
        for budget in ctx['budgets']:
            budget_rows.append({
                'budget': budget,
                'configuration_hint': configured_scope_labels.get((budget.scope_name or '').strip().lower(), ''),
            })

        ctx['budget_rows'] = budget_rows
        return ctx


class BudgetCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = Budget
    form_class = BudgetForm
    template_name = 'contracts/budget_form.html'
    success_url = reverse_lazy('careon:budget_list')

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        if org:
            form.fields['linked_providers'].queryset = Client.objects.filter(
                organization=org,
                provider_profile__isnull=False,
                status='ACTIVE',
            ).order_by('name')
            form.fields['linked_cases'].queryset = CaseIntakeProcess.objects.filter(organization=org).order_by('-updated_at')
            form.fields['linked_placements'].queryset = PlacementRequest.objects.filter(
                due_diligence_process__organization=org
            ).order_by('-updated_at')
        else:
            form.fields['linked_providers'].queryset = Client.objects.none()
            form.fields['linked_cases'].queryset = CaseIntakeProcess.objects.none()
            form.fields['linked_placements'].queryset = PlacementRequest.objects.none()
        return form

    def form_valid(self, form):
        form.instance.created_by = self.request.user
        return super().form_valid(form)


class BudgetDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = Budget
    template_name = 'contracts/budget_detail.html'
    context_object_name = 'budget'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['linked_cases'] = self.object.linked_cases.all()[:20]
        ctx['linked_placements'] = self.object.linked_placements.all()[:20]
        return ctx


class BudgetUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = Budget
    form_class = BudgetForm
    template_name = 'contracts/budget_form.html'
    success_url = reverse_lazy('careon:budget_list')

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        org = get_user_organization(self.request.user)
        if org:
            form.fields['linked_providers'].queryset = Client.objects.filter(
                organization=org,
                provider_profile__isnull=False,
                status='ACTIVE',
            ).order_by('name')
            form.fields['linked_cases'].queryset = CaseIntakeProcess.objects.filter(organization=org).order_by('-updated_at')
            form.fields['linked_placements'].queryset = PlacementRequest.objects.filter(
                due_diligence_process__organization=org
            ).order_by('-updated_at')
        return form


class SignUpView(CreateView):
    form_class = RegistrationForm
    success_url = reverse_lazy('login')
    template_name = 'registration/register.html'

    def form_valid(self, form):
        response = super().form_valid(form)
        UserProfile.objects.get_or_create(user=self.object)

        # Bootstrap a tenant for each newly registered account.
        base_slug = slugify(self.object.username) or f'user-{self.object.id}'
        org_slug = base_slug
        n = 2
        while Organization.objects.filter(slug=org_slug).exists():
            org_slug = f'{base_slug}-{n}'
            n += 1

        org_name = f"{self.object.get_full_name().strip() or self.object.username}'s Regie"
        organization = Organization.objects.create(name=org_name, slug=org_slug)
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.object,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

        login(self.request, self.object, backend='django.contrib.auth.backends.ModelBackend')
        return response


# ==================== ACTION VIEWS ====================


class AddExpenseView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = BudgetExpense
    form_class = BudgetExpenseForm
    template_name = 'contracts/expense_form.html'

    def form_valid(self, form):
        form.instance.budget_id = self.kwargs['budget_pk']
        form.instance.created_by = self.request.user
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('careon:budget_detail', kwargs={'pk': self.kwargs['budget_pk']})


# ==================== FUNCTION-BASED VIEWS ====================

@login_required
def toggle_redesign(request):
    if request.method == 'POST':
        import os
        current_value = os.environ.get('FEATURE_REDESIGN', 'false').lower()
        new_value = 'false' if current_value == 'true' else 'true'
        os.environ['FEATURE_REDESIGN'] = new_value
        from config.feature_flags import cache
        cache.clear()
        return redirect(request.META.get('HTTP_REFERER', 'dashboard'))
    return redirect('dashboard')


@login_required
def design_mode_settings(request):
    if request.method == 'GET':
        return JsonResponse({'ok': True, 'design_mode': DESIGN_MODE_SPA})

    requested_mode = request.POST.get('design_mode')
    if not requested_mode and request.content_type and 'application/json' in request.content_type:
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except json.JSONDecodeError:
            payload = {}
        requested_mode = payload.get('design_mode')

    design_mode = _normalize_design_mode(requested_mode)
    if design_mode is None:
        return JsonResponse(
            {
                'ok': False,
                'error': 'Invalid design mode. Use "spa".',
            },
            status=400,
        )

    request.session[DESIGN_MODE_SESSION_KEY] = DESIGN_MODE_SPA
    request.session.modified = True

    wants_json = (
        request.headers.get('X-Requested-With') == 'XMLHttpRequest'
        or 'application/json' in request.headers.get('Accept', '')
        or (request.content_type and 'application/json' in request.content_type)
    )
    if wants_json:
        return JsonResponse({'ok': True, 'design_mode': DESIGN_MODE_SPA})

    next_url = request.POST.get('next') or request.GET.get('next') or reverse('settings_hub')
    if not url_has_allowed_host_and_scheme(next_url, {request.get_host()}, require_https=request.is_secure()):
        next_url = reverse('settings_hub')
    return redirect(next_url)


def profile(request):
    profile_obj = get_or_create_profile(request.user) if request.user.is_authenticated else None
    form = UserProfileForm(instance=profile_obj) if profile_obj else None
    return render(request, 'profile.html', {'form': form, 'profile': profile_obj})


@login_required
def settings_hub(request):
    return render(
        request,
        'settings_hub.html',
        {
            'design_mode': DESIGN_MODE_SPA,
        },
    )


@login_required
def case_flow_list_redirect(request, step=None):
    """Route legacy list entry points to the case-first workspace."""
    target = reverse('careon:case_list')
    if step:
        target = f'{target}?flow={step}'
    return redirect(target)


@login_required
def case_flow_create_redirect(request, step=None):
    """Route legacy create entry points to case creation as single start object."""
    target = reverse('careon:case_create')
    if step:
        target = f'{target}?flow={step}'
    return redirect(target)


@login_required
def case_flow_detail_redirect(request, pk):
    """Route legacy intake detail URLs to the canonical case detail page."""
    return redirect('careon:case_detail', pk=pk)


@login_required
def case_flow_update_redirect(request, pk):
    """Route legacy intake edit URLs to the canonical case edit page."""
    return redirect('careon:case_update', pk=pk)


def _normalize_provider_response_status_code(status):
    normalized = str(status or '').strip().upper()
    if normalized == 'DECLINED':
        return PlacementRequest.ProviderResponseStatus.REJECTED
    if normalized == 'NO_RESPONSE':
        return PlacementRequest.ProviderResponseStatus.PENDING
    return normalized or PlacementRequest.ProviderResponseStatus.PENDING


def _build_provider_response_governance_context(placement):
    sla = calculate_provider_response_sla(placement, now=timezone.now())
    normalized_status = _normalize_provider_response_status_code(
        placement.provider_response_status
    )
    recommended_actions = []
    if normalized_status in {
        PlacementRequest.ProviderResponseStatus.PENDING,
        PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
    }:
        recommended_actions.append({'action': 'resend_request'})
    if normalized_status == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
        recommended_actions.append({'action': 'provide_missing_info'})
    if normalized_status in {
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    } or sla['sla_state'] == 'FORCED_ACTION':
        recommended_actions.append({'action': 'trigger_rematch'})
    if sla['sla_state'] == 'FORCED_ACTION' and normalized_status in {
        PlacementRequest.ProviderResponseStatus.PENDING,
        PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    }:
        recommended_actions.append({'action': 'continue_waiting'})

    recommendation_context = {
        'recommended_actions': recommended_actions,
        'hours_waiting': sla['hours_waiting'],
        'next_threshold_hours': sla['next_threshold_hours'],
        'sla_state': sla['sla_state'],
    }
    adaptive_flags = {
        'sla_adjustment': sla.get('sla_adjustment', {}),
    }
    return normalized_status, sla, recommendation_context, adaptive_flags


def _provider_response_status_label(status_code):
    normalized = _normalize_provider_response_status_code(status_code)
    labels = {
        PlacementRequest.ProviderResponseStatus.PENDING: 'Nog niet vastgelegd',
        PlacementRequest.ProviderResponseStatus.ACCEPTED: 'Geaccepteerd',
        PlacementRequest.ProviderResponseStatus.REJECTED: 'Afgewezen',
        PlacementRequest.ProviderResponseStatus.NEEDS_INFO: 'Aanvullende info nodig',
        PlacementRequest.ProviderResponseStatus.WAITLIST: 'Wachtlijst',
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY: 'Geen capaciteit',
    }
    return labels.get(normalized, normalized.title())


def _workflow_stage_label(workflow_stage):
    stage_labels = {
        'aanvraag': 'Intake',
        'matching': 'Matching',
        'intake_aanbieder': 'Plaatsing',
        'plaatsing': 'Plaatsing',
    }
    return stage_labels.get(workflow_stage, 'Intake')


def _communication_type_label(item_type):
    labels = {
        'operational_message': 'Operationeel bericht',
        'internal_note': 'Interne notitie',
        'provider_response': 'Aanbiederreactie',
        'decision_item': 'Besluititem',
        'escalation_item': 'Escalatie',
    }
    return labels.get(item_type, 'Communicatie')


def _decision_item_message(log_entry):
    decision_messages = {
        CaseDecisionLog.EventType.MATCH_RECOMMENDED: 'Matching gestart met nieuwe aanbeveling.',
        CaseDecisionLog.EventType.PROVIDER_SELECTED: 'Aanbieder geselecteerd voor plaatsing.',
        CaseDecisionLog.EventType.RESEND_TRIGGERED: 'Herinnering verstuurd naar aanbieder.',
        CaseDecisionLog.EventType.PROVIDE_MISSING_INFO: 'Aanvullende informatie geregistreerd.',
        CaseDecisionLog.EventType.REMATCH_TRIGGERED: 'Her-match geactiveerd voor deze casus.',
        CaseDecisionLog.EventType.CONTINUE_WAITING: 'Expliciet gekozen om te blijven wachten.',
        CaseDecisionLog.EventType.SLA_ESCALATION: 'SLA-escalatie vastgelegd voor opvolging.',
    }
    if log_entry.optional_reason:
        return log_entry.optional_reason
    if log_entry.event_type == CaseDecisionLog.EventType.SLA_ESCALATION:
        from_state = (log_entry.recommended_value or {}).get('sla_state') or ''
        to_state = (log_entry.actual_value or {}).get('sla_state') or (log_entry.sla_state or '')
        if from_state and to_state:
            return f'SLA wijzigde van {from_state} naar {to_state}.'
    return decision_messages.get(log_entry.event_type, log_entry.user_action or 'Besluit vastgelegd voor deze casus.')


def _derive_communication_item_from_log(log_entry, *, active_stage, resolved_ids):
    adaptive_flags = log_entry.adaptive_flags or {}
    communication_type = adaptive_flags.get('communication_type')
    status = adaptive_flags.get('communication_status') or 'informational'
    workflow_stage = adaptive_flags.get('workflow_stage') or active_stage
    message = log_entry.optional_reason or ''

    if log_entry.event_type == CaseDecisionLog.EventType.CASE_COMMUNICATION:
        item_type = communication_type or 'operational_message'
        if not message:
            message = log_entry.user_action or 'Communicatie-item toegevoegd.'
    elif log_entry.event_type == CaseDecisionLog.EventType.SLA_ESCALATION:
        item_type = 'escalation_item'
        status = 'open' if status != 'resolved' else status
        message = message or _decision_item_message(log_entry)
    else:
        item_type = 'decision_item'
        message = message or _decision_item_message(log_entry)

    if log_entry.pk in resolved_ids and status == 'open':
        status = 'resolved'

    source_label = 'Systeem'
    if log_entry.actor_id:
        source_label = log_entry.actor.get_full_name() if log_entry.actor else 'Gebruiker'
        source_label = source_label or (log_entry.actor.username if log_entry.actor else 'Gebruiker')

    is_open = status == 'open'
    blocks_progress = bool(adaptive_flags.get('blocks_progress')) and is_open
    blocking_label = ''
    if blocks_progress:
        blocking_label = f'Open vraag blokkeert {_workflow_stage_label(workflow_stage).lower()}.'

    return {
        'id': f'log-{log_entry.pk}',
        'source_id': log_entry.pk,
        'source_kind': 'decision_log',
        'type': item_type,
        'type_label': _communication_type_label(item_type),
        'sender': source_label,
        'timestamp': log_entry.timestamp,
        'message': message,
        'workflow_stage': workflow_stage,
        'workflow_stage_label': _workflow_stage_label(workflow_stage),
        'status': status,
        'status_label': 'Open' if status == 'open' else 'Afgehandeld' if status == 'resolved' else 'Informatief',
        'is_open': is_open,
        'blocks_progress': blocks_progress,
        'blocking_label': blocking_label,
    }


def _build_case_communication_context(*, intake, placement, provider_response_summary, decision_logs, selected_filter):
    active_stage = _flow_stage_for_intake_status(intake.status)

    resolved_ids = set()
    for log_entry in decision_logs:
        flags = log_entry.adaptive_flags or {}
        if flags.get('communication_action') == 'resolve_item':
            target_id = flags.get('resolves_log_id')
            try:
                resolved_ids.add(int(target_id))
            except (TypeError, ValueError):
                continue

    items = []
    for log_entry in decision_logs:
        flags = log_entry.adaptive_flags or {}
        if flags.get('communication_action') == 'resolve_item':
            continue
        items.append(
            _derive_communication_item_from_log(
                log_entry,
                active_stage=active_stage,
                resolved_ids=resolved_ids,
            )
        )

    if provider_response_summary:
        provider_status = provider_response_summary.get('status')
        provider_status_label = provider_response_summary.get('status_label')
        provider_notes = getattr(placement, 'provider_response_notes', '') if placement else ''

        provider_is_open = provider_status in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.REJECTED,
        }
        provider_blocks = provider_is_open and (
            provider_response_summary.get('is_overdue')
            or provider_status in {
                PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
                PlacementRequest.ProviderResponseStatus.WAITLIST,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            }
        )

        if provider_status == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
            provider_blocking_label = 'Aanbiederreactie wacht op opvolging.'
        elif provider_status == PlacementRequest.ProviderResponseStatus.WAITLIST:
            provider_blocking_label = 'Wachtlijststatus vraagt besluit op vervolgroute.'
        elif provider_blocks:
            provider_blocking_label = 'Open vraag blokkeert matching.'
        else:
            provider_blocking_label = ''

        provider_message = provider_notes.strip() if provider_notes else f'Laatste aanbiederreactie: {provider_status_label.lower()}.'

        items.append(
            {
                'id': 'provider-response',
                'source_id': placement.pk if placement else None,
                'source_kind': 'provider_response',
                'type': 'provider_response',
                'type_label': _communication_type_label('provider_response'),
                'sender': 'Aanbieder',
                'timestamp': provider_response_summary.get('requested_at') or provider_response_summary.get('deadline_at') or timezone.now(),
                'message': provider_message,
                'workflow_stage': 'matching',
                'workflow_stage_label': _workflow_stage_label('matching'),
                'status': 'open' if provider_is_open else 'informational',
                'status_label': 'Open' if provider_is_open else 'Informatief',
                'is_open': provider_is_open,
                'blocks_progress': provider_blocks,
                'blocking_label': provider_blocking_label,
                'provider_status_label': provider_status_label,
            }
        )

    items.sort(key=lambda item: item.get('timestamp') or timezone.now(), reverse=True)

    filter_mapping = {
        'alles': lambda item: True,
        'open': lambda item: item.get('is_open'),
        'aanbiederreacties': lambda item: item.get('type') == 'provider_response',
        'interne_notities': lambda item: item.get('type') == 'internal_note',
        'besluiten': lambda item: item.get('type') == 'decision_item',
    }
    selected = selected_filter if selected_filter in filter_mapping else 'alles'
    filtered_items = [item for item in items if filter_mapping[selected](item)]

    open_items = [item for item in items if item.get('is_open')]
    internal_notes = [item for item in items if item.get('type') == 'internal_note']
    provider_items = [item for item in items if item.get('type') == 'provider_response']
    open_questions = [
        item
        for item in open_items
        if item.get('type') in {'operational_message', 'provider_response', 'escalation_item'}
    ]

    latest_provider = provider_items[0] if provider_items else None
    if latest_provider:
        latest_provider_copy = f"Laatste aanbiederreactie: {latest_provider.get('provider_status_label', latest_provider.get('status_label', 'onbekend')).lower()}"
    else:
        latest_provider_copy = 'Geen aanbiederreactie'

    summary_items = [
        f"{len(open_questions)} open vraag" if len(open_questions) == 1 else f"{len(open_questions)} open vragen",
        latest_provider_copy,
        f"{len(internal_notes)} interne notitie" if len(internal_notes) == 1 else f"{len(internal_notes)} interne notities",
        'Geen onbeantwoorde berichten' if not open_items else f"{len(open_items)} communicatie-items open",
    ]

    return {
        'items': items,
        'filtered_items': filtered_items,
        'selected_filter': selected,
        'filter_options': [
            {'key': 'alles', 'label': 'Alles'},
            {'key': 'open', 'label': 'Open'},
            {'key': 'aanbiederreacties', 'label': 'Aanbiederreacties'},
            {'key': 'interne_notities', 'label': 'Interne notities'},
            {'key': 'besluiten', 'label': 'Besluiten'},
        ],
        'summary_items': summary_items,
        'has_blocking_items': any(item.get('blocks_progress') for item in open_items),
        'blocking_items': [item for item in open_items if item.get('blocks_progress')],
    }


def _provider_recommended_action_presentation(next_action):
    mapping = {
        'monitor': ('Monitor voortgang', 'medium'),
        'resend': ('Stuur herinnering', 'high'),
        'resend_or_rematch': ('Beslis: herinnering of her-match', 'high'),
        'immediate_decision': ('Neem direct een besluit', 'critical'),
        'rematch_or_override_decision': ('Her-match of expliciete override', 'critical'),
        'rematch': ('Start her-match', 'critical'),
    }
    return mapping.get(next_action, ('Monitor voortgang', 'medium'))


@login_required
@require_POST
def case_communication_action(request, pk):
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om communicatie voor deze casus te wijzigen.')

    normalized_action = (request.POST.get('action') or '').strip().lower()
    next_fallback = f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=communicatie"

    workflow_stage = (request.POST.get('workflow_stage') or _flow_stage_for_intake_status(intake.status)).strip()
    if workflow_stage not in {'aanvraag', 'matching', 'intake_aanbieder', 'plaatsing'}:
        workflow_stage = _flow_stage_for_intake_status(intake.status)

    if normalized_action in {'add_message', 'add_internal_note', 'reply', 'escalate'}:
        content = (request.POST.get('content') or '').strip()
        if not content:
            messages.error(request, 'Voer eerst inhoud in voor het communicatie-item.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        if normalized_action == 'add_internal_note':
            communication_type = 'internal_note'
            communication_status = 'informational'
            user_action = 'internal_note'
            blocks_progress = False
        elif normalized_action == 'escalate':
            communication_type = 'escalation_item'
            communication_status = 'open'
            user_action = 'escalation_item'
            blocks_progress = True
        elif normalized_action == 'reply':
            communication_type = 'operational_message'
            communication_status = 'informational'
            user_action = 'reply'
            blocks_progress = False
        else:
            communication_type = 'operational_message'
            communication_status = 'open'
            user_action = 'operational_message'
            blocks_progress = True

        log_case_decision_event(
            case_id=intake.pk,
            event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            actor_user_id=request.user.id,
            action_source='case_detail',
            user_action=user_action,
            optional_reason=content,
            adaptive_flags={
                'communication_type': communication_type,
                'communication_status': communication_status,
                'workflow_stage': workflow_stage,
                'blocks_progress': blocks_progress,
            },
        )
        messages.success(request, 'Communicatie-item toegevoegd aan de casus.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'mark_resolved':
        target_log_id = (request.POST.get('target_log_id') or '').strip()
        try:
            target_log_id_int = int(target_log_id)
        except (TypeError, ValueError):
            messages.error(request, 'Selecteer een geldig communicatie-item om af te handelen.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        exists = CaseDecisionLog.objects.filter(
            Q(case_id=intake.pk) | Q(case_id_snapshot=intake.pk),
            pk=target_log_id_int,
        ).exists()
        if not exists:
            messages.error(request, 'Communicatie-item niet gevonden voor deze casus.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        log_case_decision_event(
            case_id=intake.pk,
            event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            actor_user_id=request.user.id,
            action_source='case_detail',
            user_action='resolve_item',
            optional_reason='Communicatie-item gemarkeerd als afgehandeld.',
            adaptive_flags={
                'communication_action': 'resolve_item',
                'resolves_log_id': target_log_id_int,
                'communication_status': 'resolved',
                'workflow_stage': workflow_stage,
            },
        )
        messages.success(request, 'Communicatie-item gemarkeerd als afgehandeld.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekende communicatie-actie.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


def _provider_response_age_days(placement, hours_waiting):
    requested_at = (
        placement.provider_response_requested_at
        or placement.provider_response_last_reminder_at
        or placement.updated_at
    )
    if requested_at:
        return max((timezone.now().date() - requested_at.date()).days, 0)
    return max(int(hours_waiting // 24), 0)


def _provider_response_actions_for_case_detail(*, normalized_status, sla_state):
    if normalized_status == PlacementRequest.ProviderResponseStatus.ACCEPTED:
        return []

    if sla_state == 'FORCED_ACTION':
        return [
            {
                'action': 'trigger_rematch',
                'label': 'Her-match starten',
                'note': 'SLA FORCED_ACTION bereikt: her-match is de primaire route.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            },
            {
                'action': 'provide_missing_info',
                'label': 'Aanvullende informatie aanleveren',
                'note': 'Gebruik dit alleen wanneer ontbrekende info direct de providerreactie kan herstellen.',
                'visual_tone': 'secondary',
                'requires_confirmation': False,
            },
            {
                'action': 'continue_waiting',
                'label': 'Blijf wachten (expliciete override)',
                'note': 'Alleen bij expliciete operationele onderbouwing; keuze wordt geaudit.',
                'visual_tone': 'ghost',
                'requires_confirmation': True,
                'confirm_text': 'Bevestig dat je expliciet blijft wachten ondanks SLA FORCED_ACTION.',
                'confirm_field': 'confirm_forced_wait',
                'confirm_value': '1',
            },
        ]

    if normalized_status in {
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
    }:
        return [
            {
                'action': 'trigger_rematch',
                'label': 'Her-match starten',
                'note': 'Aanbieder blokkeert voortgang; stuur direct terug naar matching.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            }
        ]

    if normalized_status == PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
        return [
            {
                'action': 'provide_missing_info',
                'label': 'Aanvullende informatie registreren',
                'note': 'Na registreren wordt de providerreactie opnieuw opengezet.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            },
            {
                'action': 'resend_request',
                'label': 'Herinnering sturen',
                'note': 'Stuur een extra reminder wanneer aanvullende informatie al gedeeld is.',
                'visual_tone': 'secondary',
                'requires_confirmation': False,
            },
        ]

    if normalized_status == PlacementRequest.ProviderResponseStatus.WAITLIST:
        return [
            {
                'action': 'resend_request',
                'label': 'Herinnering sturen',
                'note': 'Vraag een update op de wachtlijstverwachting en alternatieven.',
                'visual_tone': 'secondary',
                'requires_confirmation': False,
            },
            {
                'action': 'trigger_rematch',
                'label': 'Her-match starten',
                'note': 'Kies her-match wanneer wachttijd niet acceptabel is.',
                'visual_tone': 'primary',
                'requires_confirmation': False,
            },
        ]

    return [
        {
            'action': 'resend_request',
            'label': 'Herinnering sturen',
            'note': 'Stuur een reminder om providerreactie binnen SLA te houden.',
            'visual_tone': 'secondary',
            'requires_confirmation': False,
        }
    ]


def _build_case_provider_response_context(*, intake, placement):
    if not placement:
        return None, [], None

    normalized_status, sla, _, _ = _build_provider_response_governance_context(placement)
    ownership = derive_provider_response_ownership(
        provider_response_status=normalized_status,
        sla_state=sla['sla_state'],
        hours_waiting=sla['hours_waiting'],
        next_threshold_hours=sla['next_threshold_hours'],
        now=timezone.now(),
        case_phase=intake.status,
    )

    requested_at = (
        placement.provider_response_requested_at
        or placement.provider_response_last_reminder_at
    )
    summary = {
        'status': normalized_status,
        'status_label': _provider_response_status_label(normalized_status),
        'sla_state': sla['sla_state'],
        'sla_hours_waiting': sla['hours_waiting'],
        'sla_escalates_in_hours': max(sla['next_threshold_hours'] - sla['hours_waiting'], 0) if sla['next_threshold_hours'] else 0,
        'age_days': _provider_response_age_days(placement, sla['hours_waiting']),
        'requested_at': requested_at,
        'deadline_at': placement.provider_response_deadline_at,
        'is_overdue': sla['sla_state'] in {'OVERDUE', 'ESCALATED', 'FORCED_ACTION'},
        'sla_forced_action_required': sla['sla_state'] == 'FORCED_ACTION',
        'next_owner': ownership['next_owner'],
        'next_owner_label': ownership['next_owner_label'],
        'next_action': ownership['next_action'],
        'next_action_label': ownership['next_action_label'],
        'action_deadline': ownership['action_deadline'],
        'action_deadline_label': ownership['action_deadline_label'],
        'escalation_level_label': ownership['escalation_level_label'],
        'ownership_reason': ownership['ownership_reason'],
    }

    actions = _provider_response_actions_for_case_detail(
        normalized_status=normalized_status,
        sla_state=sla['sla_state'],
    )

    action_href = reverse('careon:case_provider_response_action', kwargs={'pk': intake.pk})
    return summary, actions, action_href


def _to_bool_filter(value):
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


def _urgency_rank(urgency_code):
    ranks = {
        CaseIntakeProcess.Urgency.CRISIS: 4,
        CaseIntakeProcess.Urgency.HIGH: 3,
        CaseIntakeProcess.Urgency.MEDIUM: 2,
        CaseIntakeProcess.Urgency.LOW: 1,
    }
    return ranks.get(str(urgency_code or '').strip().upper(), 0)


def build_provider_response_monitor(org, *, user=None, filters=None, next_url=None):
    filters = filters or {}
    priority_mode = _to_bool_filter(filters.get('priority_mode'))
    search_query = str(filters.get('q') or '').strip()
    urgency_filter = str(filters.get('urgency') or '').strip().upper()
    status_filter = _normalize_provider_response_status_code(filters.get('provider_response_status')) if filters.get('provider_response_status') else ''
    region_filter = str(filters.get('region') or '').strip()
    overdue_only = _to_bool_filter(filters.get('overdue_only'))
    rematch_recommended_only = _to_bool_filter(filters.get('rematch_recommended_only'))

    default_sort = 'urgency' if priority_mode else 'default'
    requested_sort = str(filters.get('sort') or default_sort).strip().lower()
    sort_mode = requested_sort if requested_sort in {'default', 'oldest_waiting', 'urgency'} else default_sort

    placement_qs = (
        PlacementRequest.objects.filter(
            due_diligence_process__organization=org,
            due_diligence_process__isnull=False,
        )
        .select_related(
            'due_diligence_process',
            'due_diligence_process__preferred_region',
            'due_diligence_process__contract',
            'due_diligence_process__contract__client',
            'selected_provider',
            'proposed_provider',
        )
        .order_by('due_diligence_process_id', '-updated_at', '-id')
    )

    latest_by_case = {}
    for placement in placement_qs:
        intake_id = placement.due_diligence_process_id
        if intake_id not in latest_by_case:
            latest_by_case[intake_id] = placement

    can_edit = bool(user) and can_manage_organization(user, org)
    queue_rows = []
    for placement in latest_by_case.values():
        intake = placement.due_diligence_process
        if not intake:
            continue

        normalized_status = _normalize_provider_response_status_code(placement.provider_response_status)
        if normalized_status == PlacementRequest.ProviderResponseStatus.ACCEPTED:
            continue
        if intake.status == CaseIntakeProcess.ProcessStatus.COMPLETED:
            continue

        sla = calculate_provider_response_sla(placement, now=timezone.now())
        ownership = derive_provider_response_ownership(
            provider_response_status=normalized_status,
            sla_state=sla['sla_state'],
            hours_waiting=sla['hours_waiting'],
            next_threshold_hours=sla['next_threshold_hours'],
            now=timezone.now(),
            case_phase=intake.status,
        )

        provider = placement.selected_provider or placement.proposed_provider
        provider_name = provider.name if provider else 'Onbekende aanbieder'
        provider_id = provider.id if provider else None
        region = intake.preferred_region
        region_label = region.region_name if region else 'Niet toegewezen'
        client_name = ''
        if intake.contract and intake.contract.client:
            client_name = intake.contract.client.name or ''

        is_overdue = sla['sla_state'] in {'OVERDUE', 'ESCALATED', 'FORCED_ACTION'}
        is_rematch_recommended = normalized_status in {
            PlacementRequest.ProviderResponseStatus.REJECTED,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } or sla['sla_state'] == 'FORCED_ACTION'

        recommended_action_label, recommended_action_tone = _provider_recommended_action_presentation(
            ownership['next_action']
        )

        age_days = _provider_response_age_days(placement, sla['hours_waiting'])
        case_href = _case_detail_tab_href(intake.pk, 'plaatsing')

        resend_action = None
        if can_edit and normalized_status in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        }:
            resend_action = {
                'href': reverse('careon:case_provider_response_action', kwargs={'pk': intake.pk}),
                'action': 'resend_request',
                'next': next_url or case_href,
                'confirm_text': 'Weet je zeker dat je een herinnering wilt versturen naar deze aanbieder?',
            }

        queue_rows.append(
            {
                'case_id': intake.pk,
                'case_title': intake.title,
                'case_href': case_href,
                'client_name': client_name,
                'provider_id': provider_id,
                'provider_name': provider_name,
                'status': normalized_status,
                'status_label': _provider_response_status_label(normalized_status),
                'sla_state': sla['sla_state'],
                'sla_hours_waiting': sla['hours_waiting'],
                'sla_escalates_in_hours': max(sla['next_threshold_hours'] - sla['hours_waiting'], 0) if sla['next_threshold_hours'] else 0,
                'next_owner': ownership['next_owner'],
                'next_owner_label': ownership['next_owner_label'],
                'escalation_level_label': ownership['escalation_level_label'],
                'region_id': str(region.pk) if region else '',
                'region_label': region_label,
                'phase_label': intake.get_status_display(),
                'urgency_label': intake.get_urgency_display(),
                'urgency_rank': _urgency_rank(intake.urgency),
                'age_days': age_days,
                'requested_at': placement.provider_response_requested_at,
                'deadline_at': placement.provider_response_deadline_at,
                'recommended_action_label': recommended_action_label,
                'recommended_action_detail': ownership['ownership_reason'],
                'recommended_action_tone': recommended_action_tone,
                'action_deadline_label': ownership['action_deadline_label'],
                # Waitlist prioritization fields
                'urgency_validated': intake.urgency_validated,
                'urgency_granted_date': intake.urgency_granted_date,
                'start_date': intake.start_date,
                # 0 = validated urgent (jumps ahead), 1 = normal FCFS
                'waitlist_bucket': 0 if (intake.urgency_validated and intake.urgency_granted_date) else 1,
                'flags': {
                    'is_waiting': normalized_status in {
                        PlacementRequest.ProviderResponseStatus.PENDING,
                        PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
                    },
                    'is_overdue': is_overdue,
                    'is_rematch_recommended': is_rematch_recommended,
                },
                'resend_action': resend_action,
            }
        )

    summary = {
        'total_cases': len(queue_rows),
        'waiting_count': sum(1 for row in queue_rows if row['flags']['is_waiting']),
        'overdue_count': sum(1 for row in queue_rows if row['flags']['is_overdue']),
        'rematch_recommended_count': sum(1 for row in queue_rows if row['flags']['is_rematch_recommended']),
        'waitlist_no_capacity_count': sum(
            1
            for row in queue_rows
            if row['status'] in {
                PlacementRequest.ProviderResponseStatus.WAITLIST,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            }
        ),
        'avg_age_days': round(
            sum(row['age_days'] for row in queue_rows) / len(queue_rows),
            1,
        ) if queue_rows else 0.0,
        'sla_breach_count': sum(1 for row in queue_rows if row['flags']['is_overdue']),
        'escalation_required_count': sum(
            1 for row in queue_rows if row['sla_state'] in {'ESCALATED', 'FORCED_ACTION'}
        ),
        'forced_action_count': sum(1 for row in queue_rows if row['sla_state'] == 'FORCED_ACTION'),
    }

    filtered_rows = list(queue_rows)
    if search_query:
        needle = search_query.lower()
        filtered_rows = [
            row
            for row in filtered_rows
            if (
                needle in row['case_title'].lower()
                or needle in str(row['case_id'])
                or needle in row['provider_name'].lower()
                or needle in row['client_name'].lower()
            )
        ]

    if urgency_filter:
        filtered_rows = [
            row for row in filtered_rows if str(row['urgency_label']).strip().upper() == urgency_filter
            or str(latest_by_case[row['case_id']].due_diligence_process.urgency).strip().upper() == urgency_filter
        ]

    if status_filter:
        filtered_rows = [row for row in filtered_rows if row['status'] == status_filter]

    if region_filter:
        filtered_rows = [row for row in filtered_rows if row['region_id'] == region_filter]

    if overdue_only:
        filtered_rows = [row for row in filtered_rows if row['flags']['is_overdue']]

    if rematch_recommended_only:
        filtered_rows = [row for row in filtered_rows if row['flags']['is_rematch_recommended']]

    if priority_mode:
        filtered_rows = [
            row
            for row in filtered_rows
            if row['sla_state'] in {'FORCED_ACTION', 'ESCALATED', 'OVERDUE'}
            or row['status'] in {
                PlacementRequest.ProviderResponseStatus.REJECTED,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            }
        ]

    def _default_sort_key(row):
        severity_order = {
            'FORCED_ACTION': 0,
            'ESCALATED': 1,
            'OVERDUE': 2,
            'AT_RISK': 3,
            'ON_TRACK': 4,
        }
        rematch_group = 4 if row['flags']['is_rematch_recommended'] else 0
        if row['flags']['is_rematch_recommended'] and row['sla_state'] not in {'FORCED_ACTION', 'ESCALATED', 'OVERDUE'}:
            rematch_group = 5
        return (
            severity_order.get(row['sla_state'], 6),
            rematch_group,
            -row['urgency_rank'],
            -row['age_days'],
            -row['case_id'],
        )

    from datetime import date as _date
    _sentinel = _date(9999, 12, 31)

    def _waitlist_sort_key(row):
        """
        Policy-aligned waitlist sort key.
        1. Validated urgent cases first, sorted by urgency_granted_date ASC
        2. Non-urgent cases sorted by start_date ASC (FCFS / aanmeldingsdatum)
        """
        bucket = row['waitlist_bucket']  # 0 = urgent, 1 = normal
        if bucket == 0:
            return (0, row['urgency_granted_date'] or _sentinel, _sentinel)
        return (1, _sentinel, row['start_date'] or _sentinel)

    if sort_mode == 'oldest_waiting':
        # Primary: waitlist policy order; secondary: age_days as tie-break
        filtered_rows.sort(key=lambda row: (_waitlist_sort_key(row), -row['age_days']))
    elif sort_mode == 'urgency':
        # Primary: waitlist policy order; secondary: urgency_rank as tie-break
        filtered_rows.sort(key=lambda row: (_waitlist_sort_key(row), -row['urgency_rank']))
    else:
        filtered_rows.sort(key=_default_sort_key)

    immediate_action_rows = [
        row for row in filtered_rows if row['sla_state'] in {'OVERDUE', 'ESCALATED', 'FORCED_ACTION'}
    ]

    region_choices = []
    for region in RegionalConfiguration.objects.filter(organization=org).order_by('region_name'):
        region_choices.append({'id': region.pk, 'label': region.region_name})

    return {
        'summary': summary,
        'queue_rows': filtered_rows,
        'immediate_action_rows': immediate_action_rows,
        'filters': {
            'priority_mode': priority_mode,
            'search_query': search_query,
            'urgency': urgency_filter,
            'provider_response_status': status_filter,
            'region': region_filter,
            'overdue_only': overdue_only,
            'rematch_recommended_only': rematch_recommended_only,
            'sort': sort_mode,
        },
        'region_choices': region_choices,
        'status_choices': [
            (PlacementRequest.ProviderResponseStatus.PENDING, 'Nog niet vastgelegd'),
            (PlacementRequest.ProviderResponseStatus.NEEDS_INFO, 'Aanvullende info nodig'),
            (PlacementRequest.ProviderResponseStatus.WAITLIST, 'Wachtlijst'),
            (PlacementRequest.ProviderResponseStatus.REJECTED, 'Afgewezen'),
            (PlacementRequest.ProviderResponseStatus.NO_CAPACITY, 'Geen capaciteit'),
        ],
        'sort_choices': [
            ('default', 'Standaard triage'),
            ('urgency', 'Urgentie eerst'),
            ('oldest_waiting', 'Langst wachtend eerst'),
        ],
    }


def build_provider_response_overview(queue_rows, limit=8):
    grouped_rows = defaultdict(lambda: {
        'provider_id': None,
        'provider_name': 'Onbekende aanbieder',
        'open_response_count': 0,
        'overdue_response_count': 0,
        'avg_response_age_days': 0.0,
        'recent_no_capacity_count': 0,
        'recent_rejection_count': 0,
        '_age_sum': 0,
        'patterns': [],
    })

    for row in queue_rows:
        provider_key = row.get('provider_id') or f"name::{row.get('provider_name', 'onbekend')}"
        bucket = grouped_rows[provider_key]
        bucket['provider_id'] = row.get('provider_id')
        bucket['provider_name'] = row.get('provider_name') or 'Onbekende aanbieder'
        bucket['open_response_count'] += 1
        bucket['_age_sum'] += int(row.get('age_days') or 0)
        if row.get('flags', {}).get('is_overdue'):
            bucket['overdue_response_count'] += 1
        if row.get('status') == PlacementRequest.ProviderResponseStatus.NO_CAPACITY:
            bucket['recent_no_capacity_count'] += 1
        if row.get('status') == PlacementRequest.ProviderResponseStatus.REJECTED:
            bucket['recent_rejection_count'] += 1

    overview_rows = []
    for bucket in grouped_rows.values():
        if bucket['open_response_count']:
            bucket['avg_response_age_days'] = round(
                bucket['_age_sum'] / bucket['open_response_count'],
                1,
            )
        patterns = []
        if bucket['overdue_response_count'] >= 2:
            patterns.append('frequent delays')
        if bucket['recent_no_capacity_count'] >= 2:
            patterns.append('often no capacity')
        if bucket['recent_rejection_count'] >= 2:
            patterns.append('repeated rejections')
        bucket['patterns'] = patterns
        bucket.pop('_age_sum', None)
        overview_rows.append(bucket)

    overview_rows.sort(
        key=lambda row: (
            -row['open_response_count'],
            -row['overdue_response_count'],
            -row['avg_response_age_days'],
            row['provider_name'].lower(),
        )
    )

    return {
        'total_provider_count': len(overview_rows),
        'is_truncated': len(overview_rows) > limit,
        'rows': overview_rows[:limit],
    }


@login_required
def matching_dashboard(request):
    """Show actionable assessment-to-provider matching suggestions and assignments."""
    org = get_user_organization(request.user)
    if not org:
        messages.error(request, 'Geen actieve organisatie gevonden voor matching.')
        return render(request, 'contracts/matching_dashboard.html', {'rows': [], 'total_ready': 0})

    from django.db.models import Case as DBCase, IntegerField as DBInt, Value, When
    _urgency_bucket_expr = DBCase(
        When(
            due_diligence_process__urgency_validated=True,
            due_diligence_process__urgency_granted_date__isnull=False,
            then=Value(0),
        ),
        default=Value(1),
        output_field=DBInt(),
    )
    approved_assessments_qs = (
        CaseAssessment.objects.filter(
            due_diligence_process__organization=org,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        .select_related('due_diligence_process', 'due_diligence_process__care_category_main', 'assessed_by')
        .annotate(_wl_bucket=_urgency_bucket_expr)
        # Waitlist order: validated urgent (by urgency_granted_date) first,
        # then non-urgent by start_date ascending (aanmeldingsdatum / FCFS).
        .order_by(
            '_wl_bucket',
            'due_diligence_process__urgency_granted_date',
            'due_diligence_process__start_date',
        )
    )

    selected_intake = None
    selected_intake_raw = (request.GET.get('intake') or '').strip()
    if selected_intake_raw.isdigit():
        selected_intake = CaseIntakeProcess.objects.filter(organization=org, pk=int(selected_intake_raw)).first()
        if selected_intake:
            approved_assessments_qs = approved_assessments_qs.filter(due_diligence_process=selected_intake)
        else:
            messages.warning(request, 'De gekozen casus is niet gevonden. Alle matchingitems worden getoond.')
            _log_pilot_issue(
                request,
                category='matching_invalid_intake_filter',
                detail=f'intake={selected_intake_raw}',
            )

    if request.method == 'POST' and request.POST.get('action') == 'assign':
        assessment = get_object_or_404(approved_assessments_qs, pk=request.POST.get('assessment_id'))
        intake = assessment.intake
        if not _can_edit_intake(request.user, intake):
            _log_pilot_issue(
                request,
                category='matching_forbidden',
                detail=f'intake={getattr(intake, "pk", "-")}',
            )
            return HttpResponseForbidden('Je hebt geen rechten om matching voor deze casus bij te werken.')

        messages.info(request, 'Toewijzen verloopt vanuit de casuswerkruimte.')
        return redirect(f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=matching")

    provider_profiles = (
        ProviderProfile.objects.filter(client__organization=org, client__status='ACTIVE')
        .select_related('client')
        .prefetch_related('target_care_categories', 'served_regions')
    )

    assessments = list(approved_assessments_qs)
    assessments_by_intake = {assessment.due_diligence_process_id: assessment for assessment in assessments}
    assigned_by_intake = {
        placement.due_diligence_process_id: placement
        for placement in PlacementRequest.objects.filter(
            due_diligence_process_id__in=assessments_by_intake.keys(),
            selected_provider__isnull=False,
        ).select_related('selected_provider')
    }

    capacity_failure_labels = {
        'no_capacity': 'Geen capaciteit',
        'waitlist': 'Wachtlijst',
        'rejection': 'Afwijzing',
    }

    rows = []
    no_match_count = 0
    capacity_pressure_count = 0
    for assessment in assessments:
        intake = assessment.intake
        can_assign = _can_edit_intake(request.user, intake)
        canonical_suggestions, excluded_candidates = _build_canonical_matching_suggestions_for_intake(
            intake,
            org,
            limit=5,
        )
        suggestions = canonical_suggestions or _build_matching_suggestions_for_intake(intake, provider_profiles, limit=5)
        _sync_matching_signals_for_intake(intake, suggestions, excluded_candidates)
        decision = build_operational_decision_for_intake(intake.pk)
        decision_payload = decision.to_dict() if decision else {}

        blocker_label = decision_payload.get('blocker_label') or ''
        failure_reason = blocker_label or (decision_payload.get('recommended_action') or {}).get('reason') or 'Geen passende aanbieder'
        presented_decision = present_operational_decision(
            decision_payload,
            action_defaults={
                'label': 'Vraag aanvullende regio-opties op',
                'reason': failure_reason,
                'url': reverse('careon:assessment_detail', kwargs={'pk': assessment.pk}),
            },
            impact_defaults={
                'text': 'Vergroot kans op match',
                'type': 'positive',
            },
            fallback_reason=failure_reason,
        )

        if not suggestions:
            no_match_count += 1

        normalized_suggestions = []
        pressure_context = _region_pressure_summary(
            intake=intake,
            provider_profiles=provider_profiles,
            region_id=(intake.regio_id or intake.preferred_region_id),
        )
        for suggestion in suggestions[:5]:
            provider_name = suggestion.get('provider_name') or 'Onbekende aanbieder'
            free_slots_raw = suggestion.get('free_slots')
            wait_days_raw = suggestion.get('avg_wait_days')
            free_slots = free_slots_raw if isinstance(free_slots_raw, (int, float)) else None
            wait_days = wait_days_raw if isinstance(wait_days_raw, (int, float)) else None
            region_match = suggestion.get('region_match')

            if free_slots is not None and free_slots <= 0:
                matching_status = 'Geen directe capaciteit'
                local_failure_reason = 'Capaciteitstekort in regio'
            elif wait_days is not None and wait_days > 28:
                matching_status = 'Wachtlijstrisico'
                local_failure_reason = 'Wachttijd loopt op'
            elif wait_days is None and free_slots is None:
                matching_status = 'Onvoldoende capaciteitsdata'
                local_failure_reason = 'Capaciteitscontext ontbreekt'
            else:
                matching_status = 'Matchbaar'
                local_failure_reason = failure_reason

            operational_signals = []
            if free_slots is not None:
                if free_slots <= 0:
                    operational_signals.append({'label': 'Geen capaciteit', 'chip_tone': 'red'})
                elif free_slots <= 2:
                    operational_signals.append({'label': f'Capaciteit beperkt ({int(free_slots)})', 'chip_tone': 'amber'})
                else:
                    operational_signals.append({'label': 'Capaciteit beschikbaar', 'chip_tone': 'green'})

            if wait_days is not None and len(operational_signals) < 2:
                if wait_days >= 35:
                    operational_signals.append({'label': 'Wachtlijst', 'chip_tone': 'red'})
                elif wait_days > 21:
                    operational_signals.append({'label': f'{int(wait_days)}d wachttijd', 'chip_tone': 'amber'})
                else:
                    operational_signals.append({'label': f'{int(wait_days)}d wachttijd', 'chip_tone': 'green'})

            if region_match is False and len(operational_signals) < 2:
                operational_signals.append({'label': 'Regio: afwijking', 'chip_tone': 'amber'})

            if any(signal['label'] in ['Geen capaciteit', 'Wachtlijst'] for signal in operational_signals):
                capacity_pressure_count += 1

            normalized_suggestion = dict(suggestion)
            normalized_suggestion.update({
                'provider_name': provider_name,
                'match_score': suggestion.get('match_score') if isinstance(suggestion.get('match_score'), (int, float)) else 0,
                'fit_score': suggestion.get('fit_score') if isinstance(suggestion.get('fit_score'), (int, float)) else 0,
                'free_slots': free_slots,
                'avg_wait_days': wait_days,
                'operational_signals': operational_signals[:2],
                'matching_status': matching_status,
                'failure_reason': local_failure_reason,
                'capacity_context': (
                    'Capaciteit onbekend'
                    if free_slots is None
                    else 'Geen vrije plekken'
                    if free_slots <= 0
                    else f'{int(free_slots)} vrije plekken'
                ),
                'wait_context': (
                    'Wachttijd onbekend'
                    if wait_days is None
                    else f'{int(wait_days)} dagen wachttijd'
                ),
                'region_context': 'Regio match' if region_match else 'Regio-afwijking',
                'region_pressure_status': pressure_context['status'],
                'region_pressure_note': (
                    'Alternatieve aanbieder beschikbaar in aangrenzende dekking met snellere intake'
                    if (not region_match and wait_days is not None and wait_days <= 14)
                    else pressure_context['message']
                ),
            })
            normalized_suggestions.append(normalized_suggestion)

        _assignment = assigned_by_intake.get(intake.id)
        selected_provider_id = _assignment.selected_provider_id if _assignment else (normalized_suggestions[0].get('provider_id') if normalized_suggestions else None)
        if normalized_suggestions:
            recommendation, recommendation_context, adaptive_flags = build_matching_recommendation_payload(
                normalized_suggestions,
                limit=3,
            )
            recommendation_context['source_view'] = 'matching_dashboard'
            log_case_decision_event(
                case_id=intake.pk,
                placement_id=_assignment.pk if _assignment else None,
                event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
                system_recommendation=recommendation,
                recommendation_context=recommendation_context,
                action_source='system',
                provider_id=recommendation.get('provider_id') if recommendation else None,
                adaptive_flags=adaptive_flags,
            )

        failure_states = decision_payload.get('capacity_failure_states') or []
        capacity_failure_signals = [
            capacity_failure_labels[state]
            for state in failure_states
            if state in capacity_failure_labels
        ]

        rows.append(
            {
                'assessment': assessment,
                'intake': intake,
                'can_assign': can_assign,
                'assigned_provider': _assignment.selected_provider if _assignment else None,
                'placement_pk': _assignment.pk if _assignment else None,
                'suggestions': normalized_suggestions,
                'matching_map': _build_matching_map_context(intake, normalized_suggestions, selected_provider_id=selected_provider_id),
                'matching_status': 'Toegewezen' if _assignment else ('Geen passende aanbieder' if not normalized_suggestions else 'Matchkandidaten beschikbaar'),
                'failure_reason': failure_reason,
                'primary_signal': presented_decision['primary_signal'],
                'secondary_signal': presented_decision['secondary_signal'],
                'action_block': presented_decision['action_block'],
                'priority_indicator': presented_decision['priority_indicator'],
                'badges': presented_decision['badges'],
                'recommended_action': presented_decision['recommended_action'],
                'impact_summary': presented_decision['impact_summary'],
                'attention_band': presented_decision['attention_band'],
                'bottleneck_badge': presented_decision['bottleneck_badge'],
                'capacity_failure_signals': capacity_failure_signals,
                'decision_data_integrity_ok': bool(presented_decision['recommended_action'].get('label')) and bool(presented_decision['impact_summary'].get('text')),
            }
        )

    matching_operational_strip = None
    if no_match_count > 0:
        matching_operational_strip = {
            'severity': 'critical',
            'message': f'{no_match_count} casussen hebben geen match door capaciteitsdruk',
        }
    elif capacity_pressure_count > 0:
        matching_operational_strip = {
            'severity': 'warning',
            'message': f'{capacity_pressure_count} matchkandidaten tonen capaciteitsdruk of wachtlijstrisico',
        }

    context = {
        'rows': rows,
        'total_ready': len(rows),
        'assigned_count': len(assigned_by_intake),
        'selected_intake': selected_intake,
        'matching_operational_strip': matching_operational_strip,
        'decision_data_integrity_ok': all(row['decision_data_integrity_ok'] for row in rows),
    }
    return render(request, 'contracts/matching_dashboard.html', context)


@login_required
@require_POST
def case_matching_action(request, pk):
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om matching voor deze casus bij te werken.')

    action = (request.POST.get('action') or '').strip()
    phase = (request.POST.get('phase') or '').strip()
    next_fallback = f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=matching"
    if phase:
        next_fallback += f'&phase={phase}'

    if action == 'assign':
        provider = get_object_or_404(
            Client.objects.filter(organization=org, status='ACTIVE'),
            pk=request.POST.get('provider_id'),
        )
        provider_profiles = (
            ProviderProfile.objects.filter(client__organization=org, client__status='ACTIVE')
            .select_related('client')
            .prefetch_related('target_care_categories', 'served_regions')
        )
        suggestions = _build_matching_suggestions_for_intake(intake, provider_profiles, limit=5)
        recommended_value, recommendation_context, adaptive_flags = build_matching_recommendation_payload(
            suggestions,
            limit=3,
        )
        placement = _assign_provider_to_intake(request=request, intake=intake, provider=provider, source='case_detail')
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
            recommendation_context=recommendation_context,
            user_action='assign_provider',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider.id,
            adaptive_flags=adaptive_flags,
            override_type='provider_selection' if recommended_value and recommended_value.get('provider_id') != provider.id else None,
            recommended_value=recommended_value,
            actual_value={
                'provider_id': provider.id,
                'provider_name': provider.name,
            },
        )
        messages.success(request, f'Aanbieder {provider.name} gekoppeld aan casus "{intake.title}".')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if action == 'reject':
        provider = get_object_or_404(
            Client.objects.filter(organization=org, status='ACTIVE'),
            pk=request.POST.get('provider_id'),
        )
        rejection_reason = (request.POST.get('reason') or '').strip() or 'Afgewezen in casusdetail.'
        log_action(
            request.user,
            AuditLog.Action.REJECT,
            'MatchingRecommendation',
            object_id=provider.id,
            object_repr=f'{intake.title} -> {provider.name}',
            changes={
                'intake_id': intake.id,
                'provider_id': provider.id,
                'provider_name': provider.name,
                'reason': rejection_reason,
                'phase': phase,
                'source': 'case_detail',
            },
            request=request,
        )
        messages.success(request, f'Aanbieder {provider.name} gemarkeerd als afgewezen voor deze casus.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekende matching-actie.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


@login_required
@require_POST
def case_provider_response_action(request, pk):
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om providerreacties voor deze casus te wijzigen.')

    placement = PlacementRequest.objects.filter(
        due_diligence_process=intake,
    ).select_related('selected_provider', 'proposed_provider').order_by('-updated_at').first()

    next_fallback = f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing"

    if not placement:
        messages.error(request, 'Nog geen plaatsing beschikbaar. Start eerst via matching.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    normalized_action = (request.POST.get('action') or '').strip()
    normalized_action = {
        'resend': 'resend_request',
        'provide_info': 'provide_missing_info',
        'rematch': 'trigger_rematch',
    }.get(normalized_action, normalized_action)

    normalized_status, sla, recommendation_context, adaptive_flags = _build_provider_response_governance_context(placement)
    if normalized_status != placement.provider_response_status:
        placement.provider_response_status = normalized_status
        placement.save(update_fields=['provider_response_status', 'updated_at'])

    provider_id = placement.selected_provider_id or placement.proposed_provider_id
    detect_and_log_sla_transition(
        case_id=intake.pk,
        placement_id=placement.pk,
        provider_id=provider_id,
        current_sla_state=str(sla['sla_state']),
        action_source='case_detail',
        sla_context={
            'hours_waiting': sla['hours_waiting'],
            'next_threshold_hours': sla['next_threshold_hours'],
        },
    )

    now = timezone.now()

    if normalized_action == 'resend_request':
        if normalized_status not in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        }:
            messages.error(request, 'Herinnering is alleen toegestaan voor open providerreacties.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
        placement.provider_response_requested_at = now
        placement.provider_response_last_reminder_at = now
        placement.provider_response_deadline_at = now + timedelta(days=3)
        placement.save(update_fields=[
            'provider_response_status',
            'provider_response_requested_at',
            'provider_response_last_reminder_at',
            'provider_response_deadline_at',
            'updated_at',
        ])
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> provider response resend',
            changes={
                'provider_response_action': 'resend_request',
                'provider_response_due_days': 3,
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
                'sla_state': sla['sla_state'],
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.RESEND_TRIGGERED,
            recommendation_context=recommendation_context,
            user_action='resend_request',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state=str(sla['sla_state']),
        )
        messages.success(request, 'Verzoek opnieuw verstuurd naar aanbieder')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'provide_missing_info':
        if normalized_status != PlacementRequest.ProviderResponseStatus.NEEDS_INFO:
            messages.error(request, 'Aanvullende informatie kan alleen worden geregistreerd voor providerreacties die nog extra informatie nodig hebben.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        stamped_note = f"[{now.strftime('%d-%m-%Y %H:%M')}] Aanvullende informatie aangeleverd"
        existing_notes = placement.provider_response_notes or ''
        placement.provider_response_status = PlacementRequest.ProviderResponseStatus.PENDING
        placement.provider_response_requested_at = now
        placement.provider_response_deadline_at = now + timedelta(days=3)
        placement.provider_response_notes = f"{existing_notes}\n{stamped_note}".strip()
        placement.save(update_fields=[
            'provider_response_status',
            'provider_response_requested_at',
            'provider_response_deadline_at',
            'provider_response_notes',
            'updated_at',
        ])
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> missing info provided',
            changes={
                'provider_response_action': 'provide_missing_info',
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
                'sla_state': sla['sla_state'],
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.PROVIDE_MISSING_INFO,
            recommendation_context=recommendation_context,
            user_action='provide_missing_info',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state=str(sla['sla_state']),
        )
        messages.success(request, 'Aanvullende informatie geregistreerd en providerreactie opnieuw opengezet.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'continue_waiting':
        if normalized_status not in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } or sla['sla_state'] != 'FORCED_ACTION':
            messages.error(request, 'Doorgaan met wachten is alleen beschikbaar bij open providerreacties met SLA FORCED_ACTION.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        if request.POST.get('confirm_forced_wait') != '1':
            messages.error(request, 'Bevestig expliciet dat je blijft wachten ondanks SLA FORCED_ACTION.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        forced_wait_reason = (request.POST.get('forced_wait_reason') or '').strip()
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> continue waiting',
            changes={
                'provider_response_action': 'continue_waiting_forced_action',
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
                'sla_state': 'FORCED_ACTION',
                'forced_wait_reason': forced_wait_reason,
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.CONTINUE_WAITING,
            recommendation_context=recommendation_context,
            user_action='continue_waiting',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state='FORCED_ACTION',
            override_type='action_override',
            recommended_value={'action': 'trigger_rematch'},
            actual_value={'action': 'continue_waiting'},
            optional_reason=forced_wait_reason,
        )
        messages.success(request, 'Je hebt expliciet gekozen om te blijven wachten ondanks SLA FORCED_ACTION. Deze keuze is gelogd.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    if normalized_action == 'trigger_rematch':
        if normalized_status not in {
            PlacementRequest.ProviderResponseStatus.REJECTED,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } and sla['sla_state'] != 'FORCED_ACTION':
            messages.error(request, 'Her-match is alleen toegestaan na afwijzing, geen capaciteit, wachtlijst of SLA FORCED_ACTION.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        existing = placement.decision_notes or ''
        stamped_note = f"[{now.strftime('%d-%m-%Y %H:%M')}] Her-match gestart vanuit providerreactie-orchestratie."
        placement.status = PlacementRequest.Status.REJECTED
        placement.provider_response_status = normalized_status
        placement.decision_notes = f"{existing}\n{stamped_note}".strip()
        placement.save(update_fields=['status', 'provider_response_status', 'decision_notes', 'updated_at'])
        if intake.status != CaseIntakeProcess.ProcessStatus.MATCHING:
            intake.status = CaseIntakeProcess.ProcessStatus.MATCHING
            intake.save(update_fields=['status', 'updated_at'])
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> rematch',
            changes={
                'provider_response_action': 'trigger_rematch',
                'intake_id': intake.id,
                'placement_id': placement.id,
                'intake_status': CaseIntakeProcess.ProcessStatus.MATCHING,
                'source': 'case_detail',
                'sla_state': sla['sla_state'],
            },
            request=request,
        )
        log_case_decision_event(
            case_id=intake.pk,
            placement_id=placement.pk,
            event_type=CaseDecisionLog.EventType.REMATCH_TRIGGERED,
            recommendation_context=recommendation_context,
            user_action='trigger_rematch',
            actor_user_id=request.user.id,
            action_source='case_detail',
            provider_id=provider_id,
            adaptive_flags=adaptive_flags,
            sla_state=str(sla['sla_state']),
        )
        messages.success(request, 'Her-match geactiveerd. Casus staat weer in matchingfase.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekende providerreactie-actie.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


@login_required
def case_provider_evaluation_view(request, pk):
    """Render the Aanbieder Beoordeling evaluation page for a case.

    GET  – Show the evaluation form with case summary and matching explanation.
    POST – Record the provider evaluation (accept / reject / needs_more_info).
    """
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(
            CaseIntakeProcess.objects.select_related(
                'contract', 'care_category_main', 'care_category_sub',
                'preferred_region', 'gemeente',
            ),
            org,
        ),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om de aanbiederbeoordeling voor deze casus te wijzigen.')

    placement = (
        PlacementRequest.objects.filter(due_diligence_process=intake)
        .select_related('selected_provider', 'proposed_provider')
        .order_by('-updated_at')
        .first()
    )

    next_fallback = reverse('careon:case_detail', kwargs={'pk': intake.pk})

    if request.method == 'POST':
        return _handle_provider_evaluation_post(request, intake, placement, next_fallback)

    # GET – build context for the evaluation page
    provider = placement.selected_provider or placement.proposed_provider if placement else None
    latest_evaluation = (
        latest_evaluation_for_case_provider(intake, provider) if provider else None
    )

    matching_explanation = None
    if placement:
        try:
            matching_explanation = _build_matching_explanation_for_placement(intake, placement)
        except Exception:
            pass

    context = {
        'intake': intake,
        'placement': placement,
        'provider': provider,
        'latest_evaluation': latest_evaluation,
        'matching_explanation': matching_explanation,
        'rejection_codes': ProviderEvaluation.RejectionCode.choices,
        'decision_choices': ProviderEvaluation.Decision.choices,
        'action_url': reverse('careon:case_provider_evaluation_action', kwargs={'pk': intake.pk}),
        'back_url': next_fallback,
        'placement_unlocked': placement_unlocked_for_case(intake),
    }
    return render(request, 'contracts/provider_evaluation.html', context)


def _build_matching_explanation_for_placement(intake, placement):
    """Extract matching explanation context for the evaluation page."""
    if not placement:
        return None
    provider = placement.selected_provider or placement.proposed_provider
    if not provider:
        return None
    if not hasattr(provider, 'provider_profile'):
        return None
    try:
        profile = provider.provider_profile
        categories = list(profile.target_care_categories.values_list('name', flat=True)) if hasattr(profile, 'target_care_categories') else []
        category_match = bool(intake.care_category_main and categories)
        return _build_matching_explanation(
            match_score=0,
            category_match=category_match,
            urgency_match=True,
            care_form_match=True,
            region_match=True,
            region_type_match=True,
            free_slots=getattr(profile, 'available_spots', 0) or 0,
            average_wait_days=getattr(profile, 'average_wait_days', 0) or 0,
            specialization_summary=getattr(profile, 'specialization_summary', '') or '',
            tradeoff='',
        )
    except Exception:
        return None


@login_required
@require_POST
def case_provider_evaluation_action(request, pk):
    """Handle POST submission of a provider evaluation decision."""
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om de aanbiederbeoordeling voor deze casus te wijzigen.')

    placement = (
        PlacementRequest.objects.filter(due_diligence_process=intake)
        .select_related('selected_provider', 'proposed_provider')
        .order_by('-updated_at')
        .first()
    )

    next_fallback = reverse('careon:case_detail', kwargs={'pk': intake.pk})
    return _handle_provider_evaluation_post(request, intake, placement, next_fallback)


def _handle_provider_evaluation_post(request, intake, placement, next_fallback):
    """Parse and persist a provider evaluation POST submission."""
    provider = None
    if placement:
        provider = placement.selected_provider or placement.proposed_provider

    if not provider:
        messages.error(request, 'Geen aanbieder gekoppeld aan deze casus. Selecteer eerst een aanbieder via matching.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    decision = (request.POST.get('decision') or '').strip()
    reason_code = (request.POST.get('reason_code') or '').strip()
    capacity_flag = request.POST.get('capacity_flag') in ('1', 'true', 'on')
    risk_notes = (request.POST.get('risk_notes') or '').strip()
    requested_info = (request.POST.get('requested_info') or '').strip()

    try:
        record_provider_evaluation(
            intake=intake,
            provider=provider,
            placement=placement,
            decision=decision,
            reason_code=reason_code,
            capacity_flag=capacity_flag,
            risk_notes=risk_notes,
            requested_info=requested_info,
            decided_by_id=request.user.id,
            action_source='case_detail',
        )
    except ValueError as exc:
        messages.error(request, str(exc))
        return _redirect_to_safe_next_or_default(
            request,
            reverse('careon:case_provider_evaluation', kwargs={'pk': intake.pk}),
        )

    _decision_labels = {
        ProviderEvaluation.Decision.ACCEPT: 'Aanbieder heeft de casus geaccepteerd. Plaatsing kan worden bevestigd.',
        ProviderEvaluation.Decision.REJECT: 'Aanbieder heeft de casus afgewezen. Overweeg een her-match.',
        ProviderEvaluation.Decision.NEEDS_MORE_INFO: 'Aanbieder vraagt om aanvullende informatie. Lever de ontbrekende gegevens aan.',
    }
    messages.success(request, _decision_labels.get(decision, 'Beoordeling vastgelegd.'))

    try:
        generate_alerts_for_case(intake)
    except Exception:
        logger.exception('Alert generation failed after provider evaluation for case %s', intake.pk)

    return _redirect_to_safe_next_or_default(request, next_fallback)



@login_required
@require_POST
def case_outcome_action(request, pk):
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om uitkomstregistratie voor deze casus te wijzigen.')

    placement = PlacementRequest.objects.filter(
        due_diligence_process=intake,
    ).select_related('selected_provider', 'proposed_provider').order_by('-updated_at').first()

    next_fallback = f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing"
    if not placement:
        messages.error(request, 'Nog geen plaatsing beschikbaar. Start eerst via matching.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    outcome_type = str(request.POST.get('outcome_type') or '').strip().lower()
    now = timezone.now()

    if outcome_type == 'provider_response':
        raw_status = request.POST.get('status')
        normalized_status = _normalize_provider_response_status_code(raw_status)
        valid_statuses = {choice[0] for choice in PlacementRequest.ProviderResponseStatus.choices}
        if normalized_status not in valid_statuses:
            messages.error(request, 'Ongeldige providerreactie-status.')
            return _redirect_to_safe_next_or_default(request, next_fallback)

        reason_code = str(request.POST.get('reason_code') or OutcomeReasonCode.NONE).strip().upper()
        valid_reason_codes = {choice[0] for choice in OutcomeReasonCode.choices}
        if reason_code not in valid_reason_codes:
            reason_code = OutcomeReasonCode.NONE

        notes = (request.POST.get('notes') or '').strip()
        placement.provider_response_status = normalized_status
        placement.provider_response_reason_code = reason_code
        placement.provider_response_notes = notes
        placement.provider_response_recorded_at = now
        placement.provider_response_recorded_by = request.user
        if normalized_status in {
            PlacementRequest.ProviderResponseStatus.PENDING,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
        } and placement.provider_response_requested_at is None:
            placement.provider_response_requested_at = now
        placement.save(
            update_fields=[
                'provider_response_status',
                'provider_response_reason_code',
                'provider_response_notes',
                'provider_response_recorded_at',
                'provider_response_recorded_by',
                'provider_response_requested_at',
                'updated_at',
            ]
        )

        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'PlacementRequest',
            object_id=placement.id,
            object_repr=f'{intake.title} -> provider response outcome',
            changes={
                'outcome_type': 'provider_response',
                'status': normalized_status,
                'reason_code': reason_code,
                'intake_id': intake.id,
                'placement_id': placement.id,
                'source': 'case_detail',
            },
            request=request,
        )
        messages.success(request, 'Providerreactie-uitkomst opgeslagen.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    messages.error(request, 'Onbekend uitkomsttype.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


@login_required
def provider_response_monitor(request):
    org = get_user_organization(request.user)
    base_context = {
        'monitor_summary': {
            'total_cases': 0,
            'waiting_count': 0,
            'overdue_count': 0,
            'rematch_recommended_count': 0,
            'waitlist_no_capacity_count': 0,
            'avg_age_days': 0.0,
            'sla_breach_count': 0,
            'escalation_required_count': 0,
            'forced_action_count': 0,
        },
        'monitor_queue_rows': [],
        'monitor_immediate_action_rows': [],
        'monitor_filters': {
            'priority_mode': False,
            'search_query': '',
            'urgency': '',
            'provider_response_status': '',
            'region': '',
            'overdue_only': False,
            'rematch_recommended_only': False,
            'sort': 'default',
        },
        'monitor_region_choices': [],
        'monitor_status_choices': [
            (PlacementRequest.ProviderResponseStatus.PENDING, 'Nog niet vastgelegd'),
            (PlacementRequest.ProviderResponseStatus.NEEDS_INFO, 'Aanvullende info nodig'),
            (PlacementRequest.ProviderResponseStatus.WAITLIST, 'Wachtlijst'),
            (PlacementRequest.ProviderResponseStatus.REJECTED, 'Afgewezen'),
            (PlacementRequest.ProviderResponseStatus.NO_CAPACITY, 'Geen capaciteit'),
        ],
        'monitor_sort_choices': [
            ('default', 'Standaard triage'),
            ('urgency', 'Urgentie eerst'),
            ('oldest_waiting', 'Langst wachtend eerst'),
        ],
        'monitor_provider_overview_rows': [],
        'monitor_provider_overview_total_provider_count': 0,
        'monitor_provider_overview_is_truncated': False,
        'monitor_updated_at': timezone.now(),
        'monitor_has_active_filters': False,
    }

    if not org:
        messages.error(request, 'Geen actieve organisatie gevonden voor provider response monitor.')
        return render(request, 'contracts/provider_response_monitor.html', base_context)

    query_string = request.GET.urlencode()
    next_url = reverse('careon:provider_response_monitor')
    if query_string:
        next_url = f'{next_url}?{query_string}'

    monitor = build_provider_response_monitor(
        org,
        user=request.user,
        filters=request.GET,
        next_url=next_url,
    )
    provider_overview = build_provider_response_overview(monitor['queue_rows'], limit=8)

    base_context.update(
        {
            'monitor_summary': monitor['summary'],
            'monitor_queue_rows': monitor['queue_rows'],
            'monitor_immediate_action_rows': monitor['immediate_action_rows'],
            'monitor_filters': monitor['filters'],
            'monitor_region_choices': monitor['region_choices'],
            'monitor_status_choices': monitor['status_choices'],
            'monitor_sort_choices': monitor['sort_choices'],
            'monitor_provider_overview_rows': provider_overview['rows'],
            'monitor_provider_overview_total_provider_count': provider_overview['total_provider_count'],
            'monitor_provider_overview_is_truncated': provider_overview['is_truncated'],
            'monitor_updated_at': timezone.now(),
            'monitor_has_active_filters': bool(query_string),
        }
    )

    return render(request, 'contracts/provider_response_monitor.html', base_context)


@login_required
@require_POST
def case_placement_action(request, pk):
    org = get_user_organization(request.user)
    intake = get_object_or_404(
        scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
        pk=pk,
    )

    if not _can_edit_intake(request.user, intake):
        return HttpResponseForbidden('Je hebt geen rechten om plaatsing voor deze casus te wijzigen.')

    placement = PlacementRequest.objects.filter(
        due_diligence_process=intake,
    ).select_related('selected_provider', 'proposed_provider').order_by('-updated_at').first()

    next_fallback = f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing"

    if not placement:
        messages.error(request, 'Nog geen plaatsing beschikbaar. Start eerst via matching.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    status = (request.POST.get('status') or '').strip()
    valid_statuses = {choice[0] for choice in PlacementRequest.Status.choices}
    if status not in valid_statuses:
        messages.error(request, 'Ongeldige plaatsingsstatus.')
        return _redirect_to_safe_next_or_default(request, next_fallback)

    update_fields = ['updated_at']
    changes = {'status': status}

    if placement.status != status:
        placement.status = status
        update_fields.append('status')

    note = (request.POST.get('note') or '').strip()
    if note:
        existing = placement.decision_notes or ''
        stamped_note = f"[{timezone.now().strftime('%d-%m-%Y %H:%M')}] {note}"
        placement.decision_notes = f"{existing}\n{stamped_note}".strip()
        update_fields.append('decision_notes')
        changes['note'] = note

    if placement.status == PlacementRequest.Status.APPROVED and not placement.start_date:
        start_date = date.today()
        placement.start_date = start_date
        update_fields.append('start_date')
        changes['start_date'] = start_date.isoformat()

    placement.save(update_fields=list(dict.fromkeys(update_fields)))
    log_action(
        request.user,
        AuditLog.Action.UPDATE,
        'PlacementRequest',
        object_id=placement.id,
        object_repr=str(placement),
        changes=changes,
        request=request,
    )
    messages.success(request, 'Plaatsing bijgewerkt vanuit de casuswerkruimte.')
    return _redirect_to_safe_next_or_default(request, next_fallback)


# ==================== DASHBOARD VIEW ====================

def dashboard(request):
    # Dashboard is SPA-first: always serve the React frontend shell.
    # Legacy Regiekamer backend pages are retired; workspace always loads the SPA.
    return _render_spa_shell_response()


@login_required
def global_search(request):
    q = request.GET.get('q', '').strip()
    results = {}
    org = get_user_organization(request.user)
    if q:
        case_qs = scope_queryset_for_organization(CareCase.objects.all(), org) if org else CareCase.objects.none()
        client_qs = scope_queryset_for_organization(Client.objects.all(), org) if org else Client.objects.none()
        configuration_qs = scope_queryset_for_organization(CareConfiguration.objects.all(), org) if org else CareConfiguration.objects.none()
        document_qs = scope_queryset_for_organization(Document.objects.all(), org) if org else Document.objects.none()

        case_records = case_qs.filter(
            Q(title__icontains=q) | Q(preferred_provider__icontains=q) | Q(content__icontains=q)
        )[:10]
        configurations = configuration_qs.filter(
            Q(title__icontains=q) | Q(configuration_id__icontains=q) | Q(description__icontains=q)
        )[:10]

        results['case_records'] = case_records
        results['clients'] = client_qs.filter(
            Q(name__icontains=q) | Q(email__icontains=q) | Q(industry__icontains=q)
        )[:10]
        results['configurations'] = configurations
        results['documents'] = document_qs.filter(
            Q(title__icontains=q) | Q(description__icontains=q) | Q(tags__icontains=q)
        )[:10]
    return render(request, 'contracts/search_results.html', {'q': q, 'results': results})


# ============================================
# MUNICIPALITY CONFIGURATION VIEWS
# ============================================

class MunicipalityConfigurationListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = MunicipalityConfiguration
    template_name = 'contracts/municipality_list.html'
    context_object_name = 'municipalities'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = scope_queryset_for_organization(
            MunicipalityConfiguration.objects.prefetch_related('care_domains', 'linked_providers', 'responsible_coordinator'),
            org,
        )
        q = self.request.GET.get('q')
        status = self.request.GET.get('status')
        if q:
            qs = qs.filter(
                Q(municipality_name__icontains=q)
                | Q(municipality_code__icontains=q)
            ).distinct()
        if status:
            qs = qs.filter(status=status)
        return qs.order_by('municipality_name')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        municipality_qs = scope_queryset_for_organization(MunicipalityConfiguration.objects.all(), org)
        municipality_stats = municipality_qs.aggregate(
            total=Count('id'),
            active=Count('id', filter=Q(status='ACTIVE')),
        )
        ctx['total_municipalities'] = municipality_stats['total']
        ctx['active_municipalities'] = municipality_stats['active']
        ctx['search_query'] = self.request.GET.get('q', '')
        # Oversight workspace: aggregate pressure signals for MEDIUM-intensity oversight display
        full_qs = scope_queryset_for_organization(
            MunicipalityConfiguration.objects.prefetch_related('linked_providers'),
            org,
        )
        ctx['list_summary'] = build_municipality_list_summary(full_qs)
        
        # Build per-row oversight data for paginated municipalities
        for muni in ctx['municipalities']:
            muni._oversight_row = build_municipality_oversight_row(muni)
        
        return ctx


class MunicipalityConfigurationDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = MunicipalityConfiguration
    template_name = 'contracts/municipality_detail.html'
    context_object_name = 'municipality'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(MunicipalityConfiguration.objects.all(), org)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['oversight_summary'] = build_municipality_detail_summary(self.object)
        return ctx


class MunicipalityConfigurationCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = MunicipalityConfiguration
    form_class = MunicipalityConfigurationForm
    template_name = 'contracts/municipality_form.html'

    def get_success_url(self):
        return reverse('careon:municipality_detail', kwargs={'pk': self.object.pk})


class MunicipalityConfigurationUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = MunicipalityConfiguration
    form_class = MunicipalityConfigurationForm
    template_name = 'contracts/municipality_form.html'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(MunicipalityConfiguration.objects.all(), org)

    def get_success_url(self):
        return reverse('careon:municipality_detail', kwargs={'pk': self.object.pk})


# ============================================
# REGIONAL CONFIGURATION VIEWS
# ============================================

class RegionalConfigurationListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = RegionalConfiguration
    template_name = 'contracts/regional_list.html'
    context_object_name = 'regions'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = scope_queryset_for_organization(
            RegionalConfiguration.objects.prefetch_related('care_domains', 'linked_providers', 'served_municipalities', 'responsible_coordinator'),
            org,
        )
        q = self.request.GET.get('q')
        status = self.request.GET.get('status')
        region_type = self.request.GET.get('region_type')
        if q:
            qs = qs.filter(
                Q(region_name__icontains=q)
                | Q(region_code__icontains=q)
            ).distinct()
        if status:
            qs = qs.filter(status=status)
        if region_type:
            qs = qs.filter(region_type=region_type)
        return qs.order_by('region_name')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        regional_qs = scope_queryset_for_organization(RegionalConfiguration.objects.all(), org)
        regional_stats = regional_qs.aggregate(
            total=Count('id'),
            active=Count('id', filter=Q(status='ACTIVE')),
        )
        ctx['total_regions'] = regional_stats['total']
        ctx['active_regions'] = regional_stats['active']
        ctx['search_query'] = self.request.GET.get('q', '')
        ctx['region_type_choices'] = RegionalConfiguration._meta.get_field('region_type').choices
        ctx['selected_region_type'] = self.request.GET.get('region_type', '')
        # Oversight workspace: aggregate pressure signals for MEDIUM-intensity oversight display
        full_qs = scope_queryset_for_organization(
            RegionalConfiguration.objects.prefetch_related('linked_providers', 'served_municipalities'),
            org,
        )
        ctx['regional_list_summary'] = build_regional_list_summary(full_qs)
        
        # Build per-row oversight data for paginated regions
        for region in ctx['regions']:
            region._oversight_row = build_regional_oversight_row(region)
        
        return ctx


class RegionalConfigurationDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = RegionalConfiguration
    template_name = 'contracts/regional_detail.html'
    context_object_name = 'region'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(RegionalConfiguration.objects.all(), org)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['oversight_summary'] = build_regional_detail_summary(self.object)
        return ctx


class RegionalConfigurationCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    model = RegionalConfiguration
    form_class = RegionalConfigurationForm
    template_name = 'contracts/regional_form.html'

    def get_success_url(self):
        return reverse('careon:regional_detail', kwargs={'pk': self.object.pk})


class RegionalConfigurationUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = RegionalConfiguration
    form_class = RegionalConfigurationForm
    template_name = 'contracts/regional_form.html'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(RegionalConfiguration.objects.all(), org)

    def get_success_url(self):
        return reverse('careon:regional_detail', kwargs={'pk': self.object.pk})


# ==================== CARE INTAKE VIEWS ====================

class CaseIntakeListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    """List all care intakes for the organization."""
    model = CaseIntakeProcess
    template_name = 'contracts/intake_list.html'
    context_object_name = 'intakes'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = scope_queryset_for_organization(
            CaseIntakeProcess.objects.select_related(
                'organization', 'case_coordinator', 'care_category_main', 'contract'
            ).prefetch_related('risk_factors'),
            org,
        )
        today = date.today()
        waiting_threshold_days = 7

        # Search by title, case ID, or case coordinator
        q = self.request.GET.get('q')
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(case_coordinator__first_name__icontains=q)
                | Q(case_coordinator__last_name__icontains=q)
                | Q(contract__id__icontains=q)
            ).distinct()

        # Filter by status
        status = self.request.GET.get('status')
        if status:
            qs = qs.filter(status=status)

        # flow=intake is a dashboard shortcut — filters to INTAKE-phase cases only
        flow = self.request.GET.get('flow')
        if flow == 'intake':
            qs = qs.filter(status=CaseIntakeProcess.ProcessStatus.INTAKE)
        elif flow == 'assessment':
            qs = qs.filter(status=CaseIntakeProcess.ProcessStatus.INTAKE)
        elif flow == 'matching':
            qs = qs.filter(status__in=[
                CaseIntakeProcess.ProcessStatus.MATCHING,
                CaseIntakeProcess.ProcessStatus.DECISION,
            ])

        attention = self.request.GET.get('attention')
        if attention == 'no_match':
            qs = qs.filter(status__in=[
                CaseIntakeProcess.ProcessStatus.MATCHING,
                CaseIntakeProcess.ProcessStatus.DECISION,
            ])
        elif attention == 'waiting_long':
            qs = qs.filter(updated_at__date__lt=today - timedelta(days=waiting_threshold_days))
        elif attention == 'missing_assessment':
            qs = qs.filter(
                Q(case_assessment__isnull=True)
                | Q(case_assessment__assessment_status__in=[
                    CaseAssessment.AssessmentStatus.DRAFT,
                    CaseAssessment.AssessmentStatus.UNDER_REVIEW,
                    CaseAssessment.AssessmentStatus.NEEDS_INFO,
                ])
            )
        elif attention == 'urgent':
            qs = qs.filter(urgency__in=[CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS])
        elif attention == 'capacity_none':
            qs = qs.filter(status__in=[
                CaseIntakeProcess.ProcessStatus.MATCHING,
                CaseIntakeProcess.ProcessStatus.DECISION,
            ])

        # Filter by urgency
        urgency = self.request.GET.get('urgency')
        if urgency:
            qs = qs.filter(urgency=urgency)

        region_type = self.request.GET.get('region_type')
        if region_type:
            qs = qs.filter(preferred_region_type=region_type)

        region = self.request.GET.get('region')
        if region and region.isdigit():
            qs = qs.filter(preferred_region_id=int(region))

        # Apply waitlist-aligned ordering when viewing the matching flow.
        # For other flows, fall back to creation date descending.
        active_flow = self.request.GET.get('flow')
        if active_flow == 'matching':
            from contracts.waitlist import apply_waitlist_order
            return apply_waitlist_order(qs)
        return qs.order_by('-created_at')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()

        # Statistics
        org_intakes = scope_queryset_for_organization(CaseIntakeProcess.objects.all(), org)
        ctx.update({
            'total_intakes': org_intakes.count(),
            'active_intakes': org_intakes.exclude(status=CaseIntakeProcess.ProcessStatus.COMPLETED).count(),
            'urgent_intakes': org_intakes.filter(urgency__in=[CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS]).count(),
            'search_query': self.request.GET.get('q', ''),
            'status_choices': CaseIntakeProcess.ProcessStatus.choices,
            'urgency_choices': CaseIntakeProcess.Urgency.choices,
            'region_type_choices': RegionalConfiguration._meta.get_field('region_type').choices,
            'selected_region_type': self.request.GET.get('region_type', ''),
            'selected_region': self.request.GET.get('region', ''),
            'region_choices': RegionalConfiguration.objects.filter(organization=org).order_by('region_name'),
        })

        # Build intake rows for display using the shared operational decision contract.
        intake_rows = []
        assessment_blocked_count = 0
        waiting_risk_count = 0
        escalation_count = 0
        for intake in ctx['intakes']:
            decision = build_operational_decision_for_intake(intake.pk)
            decision_payload = decision.to_dict() if decision else {}

            presented_decision = present_operational_decision(
                decision_payload,
                action_defaults={
                    'label': 'Monitor voortgang',
                    'reason': 'Case beweegt door flow',
                    'url': reverse('careon:case_detail', kwargs={'pk': intake.pk}),
                },
                impact_defaults={
                    'text': 'Houdt zaak op koers',
                    'type': 'positive',
                },
            )

            attention_band_value = presented_decision['attention_band']['value']
            bottleneck_state_value = presented_decision['bottleneck_state']
            escalation_recommended = presented_decision['escalation_recommended']

            if bottleneck_state_value == 'assessment':
                assessment_blocked_count += 1
            if attention_band_value in ['now', 'today']:
                waiting_risk_count += 1
            if escalation_recommended:
                escalation_count += 1

            intake_rows.append({
                'obj': intake,
                'title': intake.title,
                'status': intake.get_status_display(),
                'urgency': intake.get_urgency_display(),
                'lead': intake.case_coordinator.get_full_name() if intake.case_coordinator else '—',
                'category': intake.care_category_main.name if intake.care_category_main else '—',
                'region': intake.preferred_region.region_name if intake.preferred_region else '—',
                'created': intake.start_date,
                'primary_signal': presented_decision['primary_signal'],
                'secondary_signal': presented_decision['secondary_signal'],
                'action_block': presented_decision['action_block'],
                'priority_indicator': presented_decision['priority_indicator'],
                'badges': presented_decision['badges'],
                'recommended_action': presented_decision['recommended_action'],
                'impact_summary': presented_decision['impact_summary'],
                'attention_band': presented_decision['attention_band'],
                'priority_rank': presented_decision['priority_rank'],
                'priority_badge': presented_decision['priority_badge'],
                'bottleneck_state': presented_decision['bottleneck_state'],
                'bottleneck_badge': presented_decision['bottleneck_badge'],
                'escalation_recommended': presented_decision['escalation_recommended'],
                'strongest_signals': presented_decision['strongest_signals'],
            })

        ctx['intake_rows'] = intake_rows
        ctx['decision_data_integrity_ok'] = all(
            bool(row['recommended_action'].get('label')) and bool(row['impact_summary'].get('text'))
            for row in intake_rows
        )

        # Local operational strip (max 1) derived only from shared decision fields.
        operational_strip = None
        if assessment_blocked_count > 0:
            operational_strip = {
                'severity': 'critical',
                'message': f'{assessment_blocked_count} casussen blokkeren matching door ontbrekende beoordeling',
            }
        elif waiting_risk_count > 0:
            operational_strip = {
                'severity': 'warning',
                'message': f'{waiting_risk_count} casussen hebben verhoogd risico op wachttijdoverschrijding',
            }
        elif escalation_count > 0:
            operational_strip = {
                'severity': 'critical',
                'message': f'{escalation_count} casussen vragen escalatie om doorstroom te beschermen',
            }

        ctx['casussen_operational_strip'] = operational_strip
        query_params = self.request.GET.copy()
        if 'page' in query_params:
            query_params.pop('page')
        ctx['query_string_without_page'] = query_params.urlencode()
        return ctx


class CaseIntakeDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    """Show details of a specific care intake."""
    model = CaseIntakeProcess
    template_name = 'contracts/intake_detail.html'
    context_object_name = 'intake'

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(
            CaseIntakeProcess.objects.select_related(
                'organization', 'case_coordinator', 'care_category_main', 'care_category_sub', 'contract'
            ).prefetch_related('risk_factors'),
            org,
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        intake = self.object

        assessment = CaseAssessment.objects.filter(due_diligence_process=intake).select_related('assessed_by').first()
        placement = PlacementRequest.objects.filter(due_diligence_process=intake).select_related('selected_provider').order_by('-updated_at').first()
        case_record = intake.case_record
        can_edit_case = _can_edit_intake(self.request.user, intake)

        open_tasks = Deadline.objects.for_organization(self.get_organization()).filter(
            due_diligence_process=intake,
            is_completed=False,
        ).select_related('assigned_to').order_by('due_date')[:5]
        open_signals = CareSignal.objects.for_organization(self.get_organization()).filter(
            due_diligence_process=intake,
            status__in=[CareSignal.SignalStatus.OPEN, CareSignal.SignalStatus.IN_PROGRESS],
        ).select_related('assigned_to').order_by('-updated_at')[:5]
        documents = Document.objects.filter(contract=case_record).order_by('-created_at')[:5] if case_record else Document.objects.none()

        assessment_href = reverse('careon:assessment_detail', kwargs={'pk': assessment.pk}) if assessment else f"{reverse('careon:assessment_create')}?intake={intake.pk}"
        assessment_action_label = 'Open beoordeling' if assessment else 'Beoordeling starten'
        assessment_status_label = assessment.get_assessment_status_display() if assessment else 'Nog niet gestart'

        matching_href = f"{reverse('careon:matching_dashboard')}?intake={intake.pk}"
        matching_status_label = 'Klaar voor matching' if intake.status == CaseIntakeProcess.ProcessStatus.MATCHING else 'Wacht op matching'

        placement_href = reverse('careon:placement_detail', kwargs={'pk': placement.pk}) if placement else reverse('careon:matching_dashboard')
        placement_action_label = 'Open plaatsing' if placement else 'Start via matching'
        placement_status_label = placement.get_status_display() if placement else 'Nog niet gestart'

        if not placement:
            placement_phase_label = 'Nog niet gestart'
        elif placement.status == PlacementRequest.Status.APPROVED:
            placement_phase_label = 'Plaatsing bevestigd'
        elif placement.status == PlacementRequest.Status.IN_REVIEW:
            placement_phase_label = 'Aanbieder beoordeelt'
        elif placement.status == PlacementRequest.Status.REJECTED:
            placement_phase_label = 'Opnieuw matchen'
        else:
            placement_phase_label = 'Indicatie voorbereiding'

        if not can_edit_case:
            next_action = {
                'label': 'Alleen-lezen toegang',
                'href': reverse('careon:case_list'),
                'help': 'Je kunt deze casus bekijken, maar niet wijzigen. Neem contact op met een beheerder.',
            }
        elif not placement:
            next_action = {
                'label': 'Start matching',
                'href': matching_href,
                'help': 'Kies een passende aanbieder via matching.',
            }
        else:
            next_action = {
                'label': 'Bevestig plaatsing',
                'href': placement_href,
                'help': 'Werk de plaatsingsbeslissing af en start opvolging.',
            }

        matching_requirements = [
            {
                'label': 'Casus heeft een aanbieder nodig',
                'ok': bool(placement and placement.selected_provider_id),
            },
        ]
        ready_for_matching = True  # No longer gated on assessment
        matching_missing = []

        placement_requirements = [
            {
                'label': 'Aanbieder is toegewezen in matching',
                'ok': bool(placement and placement.selected_provider_id),
            },
            {
                'label': 'Plaatsing staat in beoordeling of bevestigd',
                'ok': bool(placement and placement.status in [PlacementRequest.Status.IN_REVIEW, PlacementRequest.Status.APPROVED]),
            },
        ]
        ready_for_placement = all(item['ok'] for item in placement_requirements)
        placement_missing = [item['label'] for item in placement_requirements if not item['ok']]

        active_flow_stage = _flow_stage_for_intake_status(intake.status)
        flow_order = ['aanvraag', 'matching', 'intake_aanbieder', 'plaatsing']
        flow_labels = {
            'aanvraag': 'Aanvraag',
            'matching': 'Matching',
            'intake_aanbieder': 'Intake aanbieder',
            'plaatsing': 'Plaatsing',
        }
        active_index = flow_order.index(active_flow_stage)
        flow_rail = []
        for idx, key in enumerate(flow_order):
            flow_rail.append(
                {
                    'key': key,
                    'label': flow_labels[key],
                    'active': key == active_flow_stage,
                    'completed': idx < active_index,
                }
            )

        if not can_edit_case:
            blocker_label = 'Geen bewerkrechten voor deze casus'
        elif not ready_for_matching:
            blocker_label = f"Niet gereed voor matching: {', '.join(matching_missing)}"
        elif not ready_for_placement:
            blocker_label = f"Niet gereed voor plaatsing: {', '.join(placement_missing)}"
        else:
            blocker_label = 'Geen blokkades; casus kan door naar de volgende stap'

        progress_label = (
            f"{open_tasks.count()} open taken · {open_signals.count()} open signalen"
            if (open_tasks.count() or open_signals.count())
            else 'Geen open taken of signalen'
        )

        placement_selected_provider = None
        if placement and placement.selected_provider:
            placement_selected_provider = placement.selected_provider
        elif placement and placement.proposed_provider:
            placement_selected_provider = placement.proposed_provider

        placement_action_href = reverse('careon:case_placement_action', kwargs={'pk': intake.pk})
        placement_status_actions = []
        if placement and can_edit_case:
            action_specs = [
                (PlacementRequest.Status.IN_REVIEW, 'Markeer: in beoordeling', 'Overdracht loopt, aanbieder beoordeelt intake.'),
                (PlacementRequest.Status.NEEDS_INFO, 'Markeer: info nodig', 'Aanvullende informatie opgevraagd bij ketenpartner.'),
                (PlacementRequest.Status.APPROVED, 'Bevestig plaatsing', 'Plaatsing bevestigd en overdracht afgerond.'),
                (PlacementRequest.Status.REJECTED, 'Markeer: afgewezen', 'Plaatsing afgewezen, terug naar matching.'),
            ]
            for status_code, label, note in action_specs:
                if placement.status != status_code:
                    placement_status_actions.append(
                        {
                            'status': status_code,
                            'label': label,
                            'note': note,
                        }
                    )

        handoff_docs_qs = Document.objects.none()
        if case_record:
            handoff_docs_qs = Document.objects.filter(
                contract=case_record,
                tags__icontains='event:provider_handoff',
            ).order_by('-created_at')
        latest_handoff_doc = handoff_docs_qs.first()

        placement_notification_qs = Notification.objects.filter(recipient=self.request.user)
        if placement:
            placement_notification_qs = placement_notification_qs.filter(
                Q(link__icontains=f'/care/plaatsingen/{placement.pk}/')
                | Q(link__icontains=f'/care/casussen/{intake.pk}/')
            )
        else:
            placement_notification_qs = placement_notification_qs.filter(link__icontains=f'/care/casussen/{intake.pk}/')
        latest_placement_notification = placement_notification_qs.order_by('-created_at').first()

        matching_preview_candidates = []
        if ready_for_matching:
            provider_profiles = (
                ProviderProfile.objects.filter(client__organization=self.get_organization(), client__status='ACTIVE')
                .select_related('client')
                .prefetch_related('target_care_categories')
            )
            matching_preview_candidates = _build_matching_suggestions_for_intake(intake, provider_profiles, limit=5)
            for row in matching_preview_candidates:
                row['capacity'] = f"{row['free_slots']} plekken beschikbaar" if row['free_slots'] > 0 else 'Beperkte capaciteit'
                row['cta_href'] = matching_href
                row['cta_label'] = 'Open matching'

        latest_assignment = PlacementRequest.objects.filter(
            due_diligence_process=intake,
            selected_provider__isnull=False,
        ).select_related('selected_provider').order_by('-updated_at').first()

        matching_history = _matching_history_for_intake(intake, limit=8)
        rejected_options = [entry for entry in matching_history if entry.action == AuditLog.Action.REJECT]
        communication_logs = list(
            CaseDecisionLog.objects.filter(
                Q(case_id=intake.pk) | Q(case_id_snapshot=intake.pk)
            )
            .select_related('actor')
            .order_by('-timestamp', '-id')[:120]
        )

        intelligence_context = _build_case_intelligence_context(
            intake,
            assessment=assessment,
            placement=placement,
            matching_preview_candidates=matching_preview_candidates,
            latest_assignment=latest_assignment,
            open_signals_count=open_signals.count(),
            open_tasks_count=open_tasks.count(),
            rejected_count=len(rejected_options),
        )
        intelligence = intelligence_context['intelligence']
        candidate_hint_map = intelligence_context['candidate_hint_map']

        # Generate operational alerts from the case evaluation output.
        try:
            generate_alerts_for_case(intake)
        except Exception:
            logger.exception('Alert generation failed for case %s', intake.pk)
        for row in matching_preview_candidates:
            hint = candidate_hint_map.get(row['provider_id'])
            if not hint:
                continue
            row['decision_hint'] = hint.get('hint')
            row['decision_hint_code'] = hint.get('hint_code')
            row['decision_comparison_to_top'] = hint.get('comparison_to_top') or ''
            row['decision_trade_offs'] = hint.get('trade_offs') or []

        matching_action_href = reverse('careon:case_matching_action', kwargs={'pk': intake.pk})
        matching_archive_href = f"{reverse('careon:matching_dashboard')}?intake={intake.pk}"

        selected_tab = (self.request.GET.get('tab') or 'tijdlijn').lower()
        tab_options = {'tijdlijn', 'documenten', 'taken', 'signalen', 'communicatie', 'matching', 'plaatsing'}
        if selected_tab not in tab_options:
            selected_tab = 'tijdlijn'

        anonymized_title = intake.title
        if len(anonymized_title) > 42:
            anonymized_title = f'{anonymized_title[:39]}...'

        region_municipality_label = case_record.service_region if case_record and case_record.service_region else 'Niet ingevuld'

        if assessment and assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING:
            assessment_interpretation = 'Beoordeling staat op gereed voor matching.'
        elif assessment and assessment.assessment_status == CaseAssessment.AssessmentStatus.NEEDS_INFO:
            assessment_interpretation = 'Aanvullende informatie nodig voordat matching kan starten.'
        elif assessment:
            assessment_interpretation = 'Beoordeling loopt; werk status bij om volgende stap vrij te maken.'
        else:
            assessment_interpretation = 'Start de beoordeling om door te gaan naar matching.'

        can_create_case_document = bool(case_record) and can_edit_case
        case_document_href = reverse('careon:case_document_create', kwargs={'pk': intake.pk}) if can_create_case_document else reverse('careon:case_update', kwargs={'pk': intake.pk})
        if can_create_case_document:
            case_document_action_label = 'Document toevoegen'
        elif not case_record:
            case_document_action_label = 'Koppel eerst een casus'
        else:
            case_document_action_label = 'Geen bewerkrechten'

        upload_event = self.request.GET.get('event', 'documenten').strip() or 'documenten'
        case_document_context_href = case_document_href
        if can_create_case_document:
            case_document_context_href = f'{case_document_href}?phase={active_flow_stage}&event={upload_event}'

        # Decision-driven header recommendation for intake detail.
        recommended_action_block = None
        if can_edit_case:
            priority = 'medium'
            icon = 'i'
            if intake.urgency == CaseIntakeProcess.Urgency.CRISIS:
                priority = 'critical'
                icon = '!'
            elif intake.urgency == CaseIntakeProcess.Urgency.HIGH:
                priority = 'high'
                icon = 'H'

            recommended_action_block = {
                'title': 'AANBEVOLEN ACTIE',
                'icon': icon,
                'priority': priority,
                'action': next_action['label'],
                'reasons': [next_action['help']],
                'href': next_action['href'],
                'cta': next_action['label'],
            }

        flow_label_map = {
            'aanvraag': 'Aanvraag',
            'beoordeling': 'Beoordeling',
            'matching': 'Matching',
            'intake_aanbieder': 'Intake aanbieder',
            'plaatsing': 'Plaatsing',
        }

        case_document_rows = []
        for document in documents:
            linked_phase_key, linked_event = _extract_document_phase_event(document.tags)
            case_document_rows.append(
                {
                    'document': document,
                    'linked_phase': flow_label_map.get(linked_phase_key, linked_phase_key),
                    'linked_event': linked_event,
                }
            )

        provider_response_summary, provider_response_actions, provider_response_action_href = _build_case_provider_response_context(
            intake=intake,
            placement=placement,
        )
        communication_filter = (self.request.GET.get('comm_filter') or 'alles').strip().lower()
        communication_context = _build_case_communication_context(
            intake=intake,
            placement=placement,
            provider_response_summary=provider_response_summary,
            decision_logs=communication_logs,
            selected_filter=communication_filter,
        )

        # Provider evaluation context
        eval_provider = placement_selected_provider
        latest_provider_evaluation = (
            latest_evaluation_for_case_provider(intake, eval_provider)
            if eval_provider else None
        )
        _placement_unlocked = placement_unlocked_for_case(intake)

        if not can_edit_case:
            provider_response_actions = []

        outcome_action_href = reverse('careon:case_outcome_action', kwargs={'pk': intake.pk})
        communication_action_href = reverse('careon:case_communication_action', kwargs={'pk': intake.pk})
        outcome_sections = []

        overview_links = {
            'documents': reverse('careon:document_list'),
            'tasks': reverse('careon:task_list'),
            'signals': reverse('careon:signal_list'),
            'placements': reverse('careon:placement_list'),
        }

        ctx.update({
            'assessment_list': CaseAssessment.objects.filter(due_diligence_process=intake),
            'has_assessment': bool(assessment),
            'assessment_status': assessment_status_label if assessment else None,
            'assessment_status_label': assessment_status_label,
            'assessment_href': assessment_href,
            'assessment_action_label': assessment_action_label,
            'risk_factors_list': intake.risk_factors.all(),
            'case_record': case_record,
            'can_edit_case': can_edit_case,
            'matching_status_label': matching_status_label,
            'matching_href': matching_href,
            'placement_status_label': placement_status_label,
            'placement_phase_label': placement_phase_label,
            'placement_href': placement_href,
            'placement_action_label': placement_action_label,
            'has_placement': bool(placement),
            'placement_selected_provider': placement_selected_provider,
            'placement_action_href': placement_action_href,
            'placement_status_actions': placement_status_actions,
            'placement_handoff_docs_count': handoff_docs_qs.count() if case_record else 0,
            'latest_handoff_doc': latest_handoff_doc,
            'placement_notifications_count': placement_notification_qs.count(),
            'latest_placement_notification': latest_placement_notification,
            'open_tasks': open_tasks,
            'open_tasks_count': open_tasks.count(),
            'open_signals': open_signals,
            'open_signals_count': open_signals.count(),
            'documents': documents,
            'documents_count': documents.count(),
            'overview_links': overview_links,
            'next_action': next_action,
            'can_create_case_document': can_create_case_document,
            'can_create_case_task': can_edit_case,
            'can_create_case_signal': can_edit_case,
            'case_document_href': case_document_href,
            'case_document_context_href': case_document_context_href,
            'case_document_action_label': case_document_action_label,
            'case_document_rows': case_document_rows,
            'matching_requirements': matching_requirements,
            'ready_for_matching': ready_for_matching,
            'matching_missing': matching_missing,
            'placement_requirements': placement_requirements,
            'ready_for_placement': ready_for_placement,
            'placement_missing': placement_missing,
            'flow_rail': flow_rail,
            'active_flow_stage': active_flow_stage,
            'blocker_label': blocker_label,
            'progress_label': progress_label,
            'safe_to_proceed': intelligence.get('safe_to_proceed', True),
            'stop_reasons': intelligence.get('stop_reasons', []),
            'system_signals': intelligence.get('risk_signals', []),
            'missing_information_alerts': intelligence.get('missing_information', []),
            'enhanced_next_action': intelligence.get('next_best_action'),
            'intelligence_flags': intelligence_context['intelligence_flags'],
            'can_execute_matching_actions': bool(
                can_edit_case
                and ready_for_matching
                and intelligence.get('safe_to_proceed', True)
            ),
            'matching_preview_candidates': matching_preview_candidates,
            'matching_action_href': matching_action_href,
            'matching_archive_href': matching_archive_href,
            'latest_assignment': latest_assignment,
            'matching_history': matching_history,
            'rejected_options': rejected_options,
            'provider_response_summary': provider_response_summary,
            'provider_response_actions': provider_response_actions,
            'provider_response_action_href': provider_response_action_href,
            'latest_provider_evaluation': latest_provider_evaluation,
            'placement_unlocked_for_evaluation': _placement_unlocked,
            'communication_action_href': communication_action_href,
            'communication_items': communication_context['items'],
            'communication_filtered_items': communication_context['filtered_items'],
            'communication_filter_options': communication_context['filter_options'],
            'communication_selected_filter': communication_context['selected_filter'],
            'communication_summary_items': communication_context['summary_items'],
            'communication_has_blocking_items': communication_context['has_blocking_items'],
            'communication_blocking_items': communication_context['blocking_items'],
            'outcome_action_href': outcome_action_href,
            'outcome_sections': outcome_sections,
            'selected_tab': selected_tab,
            'anonymized_title': anonymized_title,
            'region_municipality_label': region_municipality_label,
            'assessment_interpretation': assessment_interpretation,
            'recommended_action_block': recommended_action_block,
            'decision_header': {
                'title': intake.title,
                'status': intake.get_status_display(),
                'urgency': intake.get_urgency_display(),
                'urgency_code': intake.urgency,
            },
            'phase_stepper': flow_rail,
        })

        return ctx


class CaseIntakeCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    """Create a new care intake."""
    model = CaseIntakeProcess
    form_class = CaseIntakeProcessForm
    template_name = 'contracts/intake_form.html'

    def dispatch(self, request, *args, **kwargs):
        if request.method == 'GET':
            return _render_spa_shell_response()
        return super().dispatch(request, *args, **kwargs)

    def render_to_response(self, context, **response_kwargs):
        response = super().render_to_response(context, **response_kwargs)
        response['X-Careon-Template-Version'] = 'intake_form'
        return _disable_response_caching(response)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update({
            'is_edit': False,
            'page_title': 'Nieuwe casus',
            'button_text': 'Casus aanmaken',
        })
        return ctx

    def form_valid(self, form):
        org = get_user_organization(self.request.user)
        set_organization_on_instance(form.instance, org)
        if hasattr(form.instance, 'contra_indicaties') and form.instance.contra_indicaties is None:
            form.instance.contra_indicaties = ''
        if hasattr(form.instance, 'problematiek_types') and form.instance.problematiek_types is None:
            form.instance.problematiek_types = []
        if hasattr(form.instance, 'zorgvorm_gewenst') and form.instance.zorgvorm_gewenst is None:
            form.instance.zorgvorm_gewenst = ''
        if hasattr(form.instance, 'setting_voorkeur') and form.instance.setting_voorkeur is None:
            form.instance.setting_voorkeur = ''
        if not form.instance.start_date:
            form.instance.start_date = date.today()
        response = super().form_valid(form)
        self.object.ensure_case_record(created_by=self.request.user)
        log_action(self.request.user, 'CREATE', 'CaseIntakeProcess', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, f'Casus "{self.object.title}" aangemaakt en toegevoegd aan het casusoverzicht.')
        return response

    def get_success_url(self):
        case_record = getattr(self.object, 'contract', None)
        if case_record:
            return f"{reverse('dashboard')}?page=casussen&case={case_record.pk}"
        return f"{reverse('dashboard')}?page=casussen"


class CaseIntakeUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    """Update an existing care intake."""
    model = CaseIntakeProcess
    form_class = CaseIntakeProcessForm
    template_name = 'contracts/intake_form.html'

    def render_to_response(self, context, **response_kwargs):
        response = super().render_to_response(context, **response_kwargs)
        response['X-Careon-Template-Version'] = 'intake_form'
        return _disable_response_caching(response)

    def get_queryset(self):
        org = self.get_organization()
        return scope_queryset_for_organization(CaseIntakeProcess.objects.all(), org)

    def dispatch(self, request, *args, **kwargs):
        intake = self.get_object()
        if not _can_edit_intake(request.user, intake):
            _log_pilot_issue(
                request,
                category='case_update_forbidden',
                detail=f'intake={intake.pk}',
            )
            return HttpResponseForbidden('Je hebt geen rechten om deze casus te bewerken.')
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update({
            'is_edit': True,
            'page_title': f'Casus bewerken: {self.object.title}',
            'button_text': 'Wijzigingen opslaan',
        })
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        log_action(self.request.user, 'UPDATE', 'CaseIntakeProcess', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, f'Casus "{self.object.title}" bijgewerkt.')
        return response

    def get_success_url(self):
        return reverse('careon:case_detail', kwargs={'pk': self.object.pk})


# ==================== CASE ASSESSMENT VIEWS ====================
# FIX #2: Wire CaseAssessment into care workflow

class CaseAssessmentListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    """List all case assessments (beoordelingen) for matching."""
    model = CaseAssessment
    template_name = 'contracts/assessment_list.html'
    context_object_name = 'assessments'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = CaseAssessment.objects.filter(
            due_diligence_process__organization=org,
        ).select_related(
            'due_diligence_process', 'assessed_by'
        )

        # Filter by status
        status = self.request.GET.get('status')
        if status:
            qs = qs.filter(assessment_status=status)

        # Search by case title/ID
        q = self.request.GET.get('q')
        if q:
            qs = qs.filter(
                Q(due_diligence_process__title__icontains=q)
            ).distinct()

        return qs.order_by('-updated_at')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        org_assessments = CaseAssessment.objects.filter(due_diligence_process__organization=org)

        assessment_rows = []
        urgent_blocked_count = 0
        for assessment in ctx['assessments']:
            intake = assessment.intake
            decision = build_operational_decision_for_intake(intake.pk)
            decision_payload = decision.to_dict() if decision else {}

            presented_decision = present_operational_decision(
                decision_payload,
                action_defaults={
                    'label': 'Rond beoordeling af',
                    'reason': 'Nodig voordat matching kan starten',
                    'url': reverse('careon:assessment_update', kwargs={'pk': assessment.pk}),
                },
                impact_defaults={
                    'text': 'Ontgrendelt vervolgstap',
                    'type': 'accelerating',
                },
            )

            attention_band_value = presented_decision['attention_band']['value']
            bottleneck_state_value = presented_decision['bottleneck_state']
            escalation_recommended = presented_decision['escalation_recommended']

            if (
                bottleneck_state_value == 'assessment'
                and attention_band_value in ['now', 'today']
            ):
                urgent_blocked_count += 1

            missing_copy = decision_payload.get('blocker_label') or 'Geen ontbrekende beoordelingsstap'
            blocked_copy = (
                (presented_decision.get('bottleneck_descriptor') or {}).get('blocked_copy')
                or 'Geen actieve blokkade voor matching'
            )

            assessment_rows.append({
                'obj': assessment,
                'intake': intake,
                'assessor': assessment.assessed_by.get_full_name() if assessment.assessed_by else '—',
                'updated_at': assessment.updated_at,
                'assessment_status_label': assessment.get_assessment_status_display(),
                'missing_copy': missing_copy,
                'blocked_copy': blocked_copy,
                'primary_signal': presented_decision['primary_signal'],
                'secondary_signal': presented_decision['secondary_signal'],
                'action_block': presented_decision['action_block'],
                'priority_indicator': presented_decision['priority_indicator'],
                'badges': presented_decision['badges'],
                'recommended_action': presented_decision['recommended_action'],
                'impact_summary': presented_decision['impact_summary'],
                'attention_band': presented_decision['attention_band'],
                'priority_rank': presented_decision['priority_rank'],
                'bottleneck_state': presented_decision['bottleneck_state'],
                'strongest_signal': presented_decision['strongest_signal'],
                'escalation_recommended': presented_decision['escalation_recommended'],
            })

        operational_strip = None
        if urgent_blocked_count > 0:
            operational_strip = {
                'severity': 'warning',
                'message': f'{urgent_blocked_count} urgente beoordelingen blokkeren doorstroom',
                'cta_label': 'Werk beoordelingen af',
                'cta_href': reverse('careon:assessment_list') + '?status=' + CaseAssessment.AssessmentStatus.DRAFT,
            }

        ctx.update({
            'total_assessments': org_assessments.count(),
            'pending_assessments': org_assessments.filter(
                assessment_status=CaseAssessment.AssessmentStatus.DRAFT
            ).count(),
            'ready_for_matching': org_assessments.filter(
                assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING
            ).count(),
            'status_choices': CaseAssessment.AssessmentStatus.choices,
            'search_query': self.request.GET.get('q', ''),
            'assessment_rows': assessment_rows,
            'beoordelingen_operational_strip': operational_strip,
            'decision_data_integrity_ok': all(
                bool(row['recommended_action'].get('label')) and bool(row['impact_summary'].get('text'))
                for row in assessment_rows
            ),
        })

        query_params = self.request.GET.copy()
        if 'page' in query_params:
            query_params.pop('page')
        ctx['query_string_without_page'] = query_params.urlencode()

        return ctx


class CaseAssessmentDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    """Show details of a specific assessment."""
    model = CaseAssessment
    template_name = 'contracts/assessment_detail.html'
    context_object_name = 'assessment'

    def get_queryset(self):
        org = self.get_organization()
        return CaseAssessment.objects.filter(
            due_diligence_process__organization=org,
        ).select_related(
            'due_diligence_process', 'assessed_by'
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        assessment = self.object
        intake = assessment.intake
        can_edit_assessment = _can_edit_assessment(self.request.user, assessment)
        matching_href = f"{reverse('careon:matching_dashboard')}?intake={intake.pk}"

        matching_requirements = [
            {
                'label': 'Status op Gereed voor matching',
                'ok': assessment.assessment_status == CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            },
            {
                'label': 'Klaar voor matching staat op Ja',
                'ok': bool(assessment.matching_ready),
            },
            {
                'label': 'Minimaal 1 signaal beoordeeld',
                'ok': bool((assessment.risk_signals or '').strip()),
            },
        ]
        matching_ready = all(item['ok'] for item in matching_requirements)
        matching_missing = [item['label'] for item in matching_requirements if not item['ok']]

        ctx.update({
            'intake': intake,
            'can_edit_assessment': can_edit_assessment,
            'matching_href': matching_href,
            'matching_requirements': matching_requirements,
            'matching_ready': matching_ready,
            'matching_missing': matching_missing,
        })

        return ctx


class CaseAssessmentCreateView(TenantAssignCreateMixin, LoginRequiredMixin, CreateView):
    """Create a new assessment for a care intake."""
    model = CaseAssessment
    form_class = CaseAssessmentForm
    template_name = 'contracts/assessment_form.html'

    def get_initial(self):
        initial = super().get_initial()
        # Pre-fill if linked from intake detail page
        intake_id = self.request.GET.get('intake')
        if intake_id:
            try:
                org = self.get_organization()
                intake = scope_queryset_for_organization(
                    CaseIntakeProcess.objects.all(), org
                ).get(pk=intake_id)
                initial['due_diligence_process'] = intake
            except CaseIntakeProcess.DoesNotExist:
                pass
        return initial

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update({
            'is_edit': False,
            'page_title': 'Nieuwe beoordeling',
            'button_text': 'Beoordeling aanmaken',
        })
        return ctx

    def form_valid(self, form):
        org = get_user_organization(self.request.user)
        set_organization_on_instance(form.instance, org)
        if form.instance.intake and not _can_edit_intake(self.request.user, form.instance.intake):
            _log_pilot_issue(
                self.request,
                category='assessment_create_forbidden',
                detail=f'intake={form.instance.intake.pk}',
            )
            return HttpResponseForbidden('Je hebt geen rechten om voor deze casus een beoordeling aan te maken.')
        form.instance.assessed_by = self.request.user
        if not form.instance.assessment_status:
            form.instance.assessment_status = CaseAssessment.AssessmentStatus.DRAFT
        response = super().form_valid(form)
        log_action(self.request.user, 'CREATE', 'CaseAssessment', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, 'Beoordeling aangemaakt. Volgende stap: matching.')
        return response

    def get_success_url(self):
        return reverse('careon:assessment_detail', kwargs={'pk': self.object.pk})


class CaseAssessmentUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    """Update an existing assessment."""
    model = CaseAssessment
    form_class = CaseAssessmentForm
    template_name = 'contracts/assessment_form.html'

    def get_queryset(self):
        org = self.get_organization()
        return CaseAssessment.objects.filter(due_diligence_process__organization=org)

    def dispatch(self, request, *args, **kwargs):
        assessment = self.get_object()
        if not _can_edit_assessment(request.user, assessment):
            _log_pilot_issue(
                request,
                category='assessment_update_forbidden',
                detail=f'assessment={assessment.pk}',
            )
            return HttpResponseForbidden('Je hebt geen rechten om deze beoordeling te bewerken.')
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx.update({
            'is_edit': True,
            'page_title': 'Beoordeling bewerken',
            'button_text': 'Wijzigingen opslaan',
        })
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        log_action(self.request.user, 'UPDATE', 'CaseAssessment', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, 'Beoordeling bijgewerkt.')
        return response

    def get_success_url(self):
        return reverse('careon:assessment_detail', kwargs={'pk': self.object.pk})


# ==================== WAIT TIME VIEWS (Wachttijden) ====================

class WaitTimeListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = TrustAccount
    template_name = 'contracts/waittime_list.html'
    context_object_name = 'waittimes'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = TrustAccount.objects.filter(provider__organization=org).select_related('provider').order_by('provider__name', 'region')
        q = self.request.GET.get('q')
        if q:
            qs = qs.filter(Q(provider__name__icontains=q) | Q(region__icontains=q) | Q(care_type__icontains=q))
        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        qs = TrustAccount.objects.filter(provider__organization=org)
        ctx.update({
            'total_count': qs.count(),
            'no_capacity_count': qs.filter(open_slots__lte=0).count(),
            'avg_wait_days': round(qs.aggregate(avg=Avg('wait_days'))['avg'] or 0),
            'search_query': self.request.GET.get('q', ''),
        })
        return ctx


class WaitTimeDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = TrustAccount
    template_name = 'contracts/waittime_detail.html'
    context_object_name = 'waittime'

    def get_queryset(self):
        org = self.get_organization()
        return TrustAccount.objects.filter(provider__organization=org).select_related('provider')


class WaitTimeCreateView(TenantScopedQuerysetMixin, LoginRequiredMixin, CreateView):
    model = TrustAccount
    form_class = TrustAccountForm
    template_name = 'contracts/waittime_form.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['is_edit'] = False
        ctx['page_title'] = 'Wachttijd registreren'
        return ctx

    def form_valid(self, form):
        form.instance.created_by = self.request.user
        response = super().form_valid(form)
        messages.success(self.request, 'Wachttijd geregistreerd.')
        return response

    def get_success_url(self):
        return reverse('careon:waittime_detail', kwargs={'pk': self.object.pk})


class WaitTimeUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = TrustAccount
    form_class = TrustAccountForm
    template_name = 'contracts/waittime_form.html'

    def get_queryset(self):
        org = self.get_organization()
        return TrustAccount.objects.filter(provider__organization=org)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['is_edit'] = True
        ctx['page_title'] = 'Wachttijd bijwerken'
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(self.request, 'Wachttijd bijgewerkt.')
        return response

    def get_success_url(self):
        return reverse('careon:waittime_detail', kwargs={'pk': self.object.pk})


# ==================== CARE SIGNAL VIEWS (Signalen) ====================

class CareSignalListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = CareSignal
    template_name = 'contracts/signal_list.html'
    context_object_name = 'signals'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = CareSignal.objects.for_organization(org).select_related('due_diligence_process', 'assigned_to', 'case_record').order_by('-created_at')

        q = self.request.GET.get('q')
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(due_diligence_process__title__icontains=q)
                | Q(description__icontains=q)
            ).distinct()

        status = self.request.GET.get('status')
        if status:
            qs = qs.filter(status=status)

        risk_level = self.request.GET.get('risk_level')
        if risk_level:
            qs = qs.filter(risk_level=risk_level)

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        all_qs = CareSignal.objects.for_organization(org)
        editable_signal_ids = set()
        signal_rows = []
        for signal in ctx['signals']:
            linked_case = signal.case_record or (signal.intake.case_record if signal.intake else None)
            if linked_case is None or can_access_case_action(self.request.user, linked_case, CaseAction.EDIT):
                editable_signal_ids.add(signal.pk)

            case_href = None
            intake_id = getattr(signal, 'due_diligence_process_id', None)
            if intake_id:
                case_href = _case_detail_tab_href(intake_id, 'signalen')

            signal_rows.append({
                'signal': signal,
                'case_href': case_href,
                'can_edit': signal.pk in editable_signal_ids,
            })

        ctx.update({
            'total_count': all_qs.count(),
            'open_count': all_qs.filter(status=CareSignal.SignalStatus.OPEN).count(),
            'critical_count': all_qs.filter(
                risk_level=CareSignal.RiskLevel.CRITICAL,
                status__in=[CareSignal.SignalStatus.OPEN, CareSignal.SignalStatus.IN_PROGRESS],
            ).count(),
            'status_choices': CareSignal.SignalStatus.choices,
            'risk_level_choices': CareSignal.RiskLevel.choices,
            'search_query': self.request.GET.get('q', ''),
            'editable_signal_ids': editable_signal_ids,
            'signal_rows': signal_rows,
        })
        return ctx


class CareSignalDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = CareSignal
    template_name = 'contracts/signal_detail.html'
    context_object_name = 'signal'

    def get_queryset(self):
        org = self.get_organization()
        return CareSignal.objects.for_organization(org).select_related('due_diligence_process', 'assigned_to', 'case_record', 'created_by')

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        linked_case = _resolve_signal_case(self.object)
        ctx['can_edit_signal'] = (linked_case is None) or can_access_case_action(
            self.request.user,
            linked_case,
            CaseAction.EDIT,
        )
        return ctx


class CareSignalCreateView(TenantScopedQuerysetMixin, LoginRequiredMixin, CreateView):
    model = CareSignal
    form_class = CareSignalForm
    template_name = 'contracts/signal_form.html'

    def get_initial(self):
        initial = super().get_initial()
        intake_id = self.request.GET.get('intake')
        if intake_id:
            try:
                org = self.get_organization()
                intake = scope_queryset_for_organization(CaseIntakeProcess.objects.all(), org).get(pk=intake_id)
                initial['due_diligence_process'] = intake
            except CaseIntakeProcess.DoesNotExist:
                pass
        return initial

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['is_edit'] = False
        ctx['page_title'] = 'Nieuw signaal'
        return ctx

    def form_valid(self, form):
        intake = form.cleaned_data.get('due_diligence_process')
        if intake and intake.case_record and not can_access_case_action(self.request.user, intake.case_record, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om signalen voor deze casus toe te voegen.')
        form.instance.created_by = self.request.user
        if intake and intake.contract_id and not form.instance.case_record_id:
            form.instance.case_record = intake.case_record
        response = super().form_valid(form)
        log_action(self.request.user, 'CREATE', 'CareSignal', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, 'Signaal aangemaakt.')
        return response

    def get_success_url(self):
        return reverse('careon:signal_detail', kwargs={'pk': self.object.pk})


class CareSignalUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = CareSignal
    form_class = CareSignalForm
    template_name = 'contracts/signal_form.html'

    def get_queryset(self):
        org = self.get_organization()
        return CareSignal.objects.for_organization(org)

    def dispatch(self, request, *args, **kwargs):
        signal = self.get_object()
        linked_case = _resolve_signal_case(signal)
        if linked_case and not can_access_case_action(request.user, linked_case, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om signalen van deze casus te bewerken.')
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['is_edit'] = True
        ctx['page_title'] = 'Signaal bewerken'
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        log_action(self.request.user, 'UPDATE', 'CareSignal', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, 'Signaal bijgewerkt.')
        return response

    def get_success_url(self):
        return reverse('careon:signal_detail', kwargs={'pk': self.object.pk})


# ==================== PLACEMENT REQUEST VIEWS (Plaatsingen) ====================

def _placement_phase_label(placement):
    if placement.status == PlacementRequest.Status.APPROVED:
        return 'Plaatsing bevestigd'
    if placement.status == PlacementRequest.Status.IN_REVIEW:
        return 'Aanbieder beoordeelt'
    if placement.status == PlacementRequest.Status.NEEDS_INFO:
        return 'Aanvullende informatie nodig'
    if placement.status == PlacementRequest.Status.REJECTED:
        return 'Opnieuw matchen'
    return 'Indicatie voorbereiding'


class PlacementRequestListView(TenantScopedQuerysetMixin, LoginRequiredMixin, ListView):
    model = PlacementRequest
    template_name = 'contracts/placement_list.html'
    context_object_name = 'placements'
    paginate_by = 25

    def get_queryset(self):
        org = self.get_organization()
        qs = PlacementRequest.objects.filter(due_diligence_process__organization=org).select_related(
            'due_diligence_process', 'proposed_provider', 'selected_provider'
        ).order_by('-updated_at')

        q = self.request.GET.get('q')
        if q:
            qs = qs.filter(
                Q(due_diligence_process__title__icontains=q)
                | Q(proposed_provider__name__icontains=q)
                | Q(selected_provider__name__icontains=q)
            ).distinct()

        status = self.request.GET.get('status')
        if status:
            qs = qs.filter(status=status)

        return qs

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        org = self.get_organization()
        all_qs = PlacementRequest.objects.filter(due_diligence_process__organization=org)
        provider_response_copy = {
            'pending': 'Pending: reactie uitstaand',
            'rejected': 'Rejected: aanbieder afgewezen',
            'waitlist': 'Waitlist: plaatsing vertraagd',
            'no_capacity': 'No capacity: geen plek beschikbaar',
            'accepted': 'Accepted: aanbieder bevestigd',
            'needs_info': 'Needs info: aanvullende info gevraagd',
        }
        editable_placement_ids = set()
        stalled_count = 0
        escalation_count = 0
        derived_strip = None
        placement_rows = []
        for placement in ctx['placements']:
            linked_case = placement.intake.case_record if placement.intake else None
            if linked_case is None or can_access_case_action(self.request.user, linked_case, CaseAction.EDIT):
                editable_placement_ids.add(placement.pk)

            decision = build_operational_decision_for_intake(placement.intake.pk) if placement.intake else None
            decision_payload = decision.to_dict() if decision else {}

            attention_band_value = decision_payload.get('attention_band') or 'monitor'
            bottleneck_state_value = decision_payload.get('bottleneck_state') or 'none'

            response_state = (decision_payload.get('provider_response_state') or placement.provider_response_status or '').lower()
            response_label = provider_response_copy.get(response_state, placement.get_provider_response_status_display())

            blocker_label = (decision_payload.get('blocker_label') or '').strip()
            fallback_stall_reason = response_label or 'Plaatsing wacht op vervolgactie'
            stall_reason = blocker_label or fallback_stall_reason

            is_stalled = bool(decision_payload.get('is_stalled')) or response_state in {
                'pending', 'rejected', 'waitlist', 'no_capacity', 'needs_info'
            } or bottleneck_state_value == 'placement'
            if is_stalled and not stall_reason:
                stall_reason = 'Plaatsing wacht op vervolgactie'

            presented_decision = present_operational_decision(
                decision_payload,
                action_defaults={
                    'label': 'Stuur herinnering' if is_stalled else 'Monitor plaatsing',
                    'reason': stall_reason,
                    'url': reverse('careon:placement_detail', kwargs={'pk': placement.pk}),
                },
                impact_defaults={
                    'text': (
                        'Versnelt besluitvorming bij stagnerende plaatsing'
                        if is_stalled
                        else 'Houdt plaatsing op koers'
                    ),
                    'type': 'accelerating',
                },
                fallback_reason=stall_reason,
            )

            escalation_recommended = presented_decision['escalation_recommended']
            escalation_reason = (decision_payload.get('escalation_reason') or '').strip()
            if escalation_recommended and not escalation_reason:
                escalation_reason = 'Escalatie aanbevolen'

            if is_stalled:
                stalled_count += 1
            if escalation_recommended:
                escalation_count += 1

            if not derived_strip:
                strip_payload = decision_payload.get('operational_strip') or {}
                strip_message = (strip_payload.get('message') or '').strip()
                if strip_message:
                    derived_strip = {
                        'severity': (strip_payload.get('severity') or 'warning').strip().lower(),
                        'message': strip_message,
                    }

            placement_rows.append({
                'placement': placement,
                'phase_label': _placement_phase_label(placement),
                'provider_name': (
                    placement.selected_provider.name
                    if placement.selected_provider
                    else placement.proposed_provider.name
                    if placement.proposed_provider
                    else '—'
                ),
                'status_label': placement.get_status_display(),
                'provider_response_label': response_label,
                'stall_reason': stall_reason,
                'is_stalled': is_stalled,
                'primary_signal': presented_decision['primary_signal'],
                'secondary_signal': presented_decision['secondary_signal'],
                'action_block': presented_decision['action_block'],
                'priority_indicator': presented_decision['priority_indicator'],
                'badges': presented_decision['badges'],
                'recommended_action': presented_decision['recommended_action'],
                'impact_summary': presented_decision['impact_summary'],
                'attention_band': presented_decision['attention_band'],
                'bottleneck_badge': presented_decision['bottleneck_badge'],
                'signal_chips': presented_decision['signal_chips'],
                'escalation_recommended': presented_decision['escalation_recommended'],
                'escalation_reason': escalation_reason,
            })

        placement_operational_strip = derived_strip
        if not placement_operational_strip and escalation_count > 0:
            placement_operational_strip = {
                'severity': 'critical',
                'message': f'{escalation_count} plaatsingen vragen escalatie om doorstroom te beschermen',
            }
        elif not placement_operational_strip and stalled_count > 1:
            placement_operational_strip = {
                'severity': 'warning',
                'message': f'{stalled_count} plaatsingen staan stil door uitblijvende providerreactie',
            }

        ctx.update({
            'total_count': all_qs.count(),
            'approved_count': all_qs.filter(status=PlacementRequest.Status.APPROVED).count(),
            'in_review_count': all_qs.filter(status=PlacementRequest.Status.IN_REVIEW).count(),
            'status_choices': PlacementRequest.Status.choices,
            'search_query': self.request.GET.get('q', ''),
            'editable_placement_ids': editable_placement_ids,
            'placement_rows': placement_rows,
            'placement_operational_strip': placement_operational_strip,
            'decision_data_integrity_ok': all(
                ((not row['is_stalled']) or bool(row['stall_reason']))
                and bool(row['recommended_action'].get('label'))
                and bool(row['impact_summary'].get('text'))
                and len(row['signal_chips']) <= 2
                for row in placement_rows
            ),
        })
        return ctx


class PlacementRequestDetailView(TenantScopedQuerysetMixin, LoginRequiredMixin, DetailView):
    model = PlacementRequest
    template_name = 'contracts/placement_detail.html'
    context_object_name = 'placement'

    def get_queryset(self):
        org = self.get_organization()
        return PlacementRequest.objects.filter(due_diligence_process__organization=org).select_related(
            'due_diligence_process', 'proposed_provider', 'selected_provider'
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['placement_phase_label'] = _placement_phase_label(self.object)
        linked_case = self.object.intake.case_record if self.object.intake else None
        ctx['can_edit_placement'] = (linked_case is not None) and can_access_case_action(
            self.request.user,
            linked_case,
            CaseAction.EDIT,
        )
        return ctx


class PlacementRequestUpdateView(TenantScopedQuerysetMixin, LoginRequiredMixin, UpdateView):
    model = PlacementRequest
    form_class = PlacementRequestForm
    template_name = 'contracts/placement_form.html'

    def get_queryset(self):
        org = self.get_organization()
        return PlacementRequest.objects.filter(due_diligence_process__organization=org)

    def dispatch(self, request, *args, **kwargs):
        placement = self.get_object()
        if not placement.due_diligence_process_id:
            return HttpResponseForbidden('Plaatsing zonder gekoppelde casus is alleen inspecteerbaar.')
        linked_case = placement.intake.case_record if placement.intake else None
        if linked_case is None:
            return HttpResponseForbidden('Plaatsing zonder gekoppelde casus is alleen inspecteerbaar.')
        if not can_access_case_action(request.user, linked_case, CaseAction.EDIT):
            return HttpResponseForbidden('Je hebt geen rechten om plaatsing voor deze casus te wijzigen.')
        return super().dispatch(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx['is_edit'] = True
        ctx['page_title'] = 'Plaatsing bewerken'
        ctx['intake'] = self.object.intake
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        log_action(self.request.user, 'UPDATE', 'PlacementRequest', self.object.id, str(self.object), request=self.request)
        messages.success(self.request, 'Plaatsing bijgewerkt.')
        return response

    def get_success_url(self):
        return reverse('careon:placement_detail', kwargs={'pk': self.object.pk})


# ==================== CASE-SCOPED CREATE VIEWS ====================

class _CaseScopedIntakeMixin(TenantScopedQuerysetMixin):
    intake = None

    def _load_intake(self):
        if self.intake is None:
            org = get_user_organization(self.request.user)
            self.intake = get_object_or_404(
                scope_queryset_for_organization(CaseIntakeProcess.objects.select_related('contract'), org),
                pk=self.kwargs['pk'],
            )
        return self.intake

    def dispatch(self, request, *args, **kwargs):
        intake = self._load_intake()
        if not _can_edit_intake(request.user, intake):
            _log_pilot_issue(
                request,
                category='case_scoped_create_forbidden',
                detail=f'intake={intake.pk}',
            )
            return HttpResponseForbidden('Je hebt geen rechten om deze casus bij te werken.')
        return super().dispatch(request, *args, **kwargs)


class CaseScopedDeadlineCreateView(_CaseScopedIntakeMixin, DeadlineCreateView):
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method in ('POST', 'PUT'):
            data = kwargs.get('data', self.request.POST).copy()
            data['due_diligence_process'] = str(self._load_intake().pk)
            kwargs['data'] = data
        return kwargs

    def get_initial(self):
        initial = super().get_initial()
        initial['due_diligence_process'] = self._load_intake()
        return initial

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        intake = self._load_intake()
        form.initial['due_diligence_process'] = intake.pk
        return form

    def form_valid(self, form):
        intake = self._load_intake()
        form.instance.due_diligence_process = intake
        if intake.contract_id:
            form.instance.case_record = intake.case_record
        response = super().form_valid(form)
        messages.success(self.request, f'Taak toegevoegd aan casus "{intake.title}".')
        return response

    def get_success_url(self):
        return f"{reverse('careon:case_detail', kwargs={'pk': self._load_intake().pk})}?tab=taken"


class CaseScopedCareSignalCreateView(_CaseScopedIntakeMixin, CareSignalCreateView):
    def get_form_kwargs(self):
        kwargs = super().get_form_kwargs()
        if self.request.method in ('POST', 'PUT'):
            data = kwargs.get('data', self.request.POST).copy()
            data['due_diligence_process'] = str(self._load_intake().pk)
            kwargs['data'] = data
        return kwargs

    def get_initial(self):
        initial = super().get_initial()
        initial['due_diligence_process'] = self._load_intake()
        return initial

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        intake = self._load_intake()
        form.initial['due_diligence_process'] = intake.pk
        return form

    def form_valid(self, form):
        intake = self._load_intake()
        form.instance.due_diligence_process = intake
        if intake.contract_id:
            form.instance.case_record = intake.case_record
        response = super().form_valid(form)
        messages.success(self.request, f'Signaal toegevoegd aan casus "{intake.title}".')
        return response

    def get_success_url(self):
        return f"{reverse('careon:case_detail', kwargs={'pk': self._load_intake().pk})}?tab=signalen"


class CaseScopedDocumentCreateView(_CaseScopedIntakeMixin, DocumentCreateView):
    def dispatch(self, request, *args, **kwargs):
        intake = self._load_intake()
        if not intake.contract_id:
            messages.error(request, 'Koppel eerst een casusrecord voordat je documenten toevoegt.')
            return redirect('careon:case_detail', pk=intake.pk)
        return super().dispatch(request, *args, **kwargs)

    def get_initial(self):
        initial = super().get_initial()
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        if intake.contract_id:
            initial['contract'] = intake.case_record
        if phase or event:
            initial['tags'] = _merge_document_context_tags(initial.get('tags', ''), phase=phase, event=event)
        return initial

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        phase_label = {
            'aanvraag': 'Aanvraag',
            'beoordeling': 'Beoordeling',
            'matching': 'Matching',
            'intake_aanbieder': 'Intake aanbieder',
            'plaatsing': 'Plaatsing',
        }.get(phase, phase)
        ctx['intake'] = intake
        ctx['document_context_phase'] = phase_label
        ctx['document_context_event'] = event
        ctx['cancel_href'] = f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=documenten"
        return ctx

    def form_valid(self, form):
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        form.instance.contract = intake.case_record
        if phase or event:
            form.instance.tags = _merge_document_context_tags(form.instance.tags, phase=phase, event=event)
        response = super().form_valid(form)
        messages.success(self.request, f'Document toegevoegd aan casus "{intake.title}".')
        return response

    def get_success_url(self):
        intake = self._load_intake()
        phase = (self.request.GET.get('phase') or '').strip()
        event = (self.request.GET.get('event') or '').strip()
        url = f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=documenten"
        if phase:
            url += f'&phase={phase}'
        if event:
            url += f'&event={event}'
        return url


# ==================== REGIEKAMER ALERT VIEWS ====================

@login_required
def regiekamer_alerts(request):
    """Regiekamer operational control interface.

    Groups active alerts by severity (high → medium → low) and surfaces
    summary cards for the four priority categories.
    """
    org = get_user_organization(request.user)
    if not org:
        messages.error(request, 'Geen actieve organisatie gevonden.')
        return redirect(reverse('dashboard'))

    unresolved_qs = (
        OperationalAlert.objects
        .filter(case__organization=org, resolved_at__isnull=True)
        .select_related('case')
        .order_by('severity', '-created_at')
    )

    show_resolved = request.GET.get('show_resolved') == '1'
    if show_resolved:
        alerts_qs = (
            OperationalAlert.objects
            .filter(case__organization=org)
            .select_related('case')
            .order_by('resolved_at', 'severity', '-created_at')
        )
    else:
        alerts_qs = unresolved_qs

    severity_order = {
        OperationalAlert.Severity.HIGH: 0,
        OperationalAlert.Severity.MEDIUM: 1,
        OperationalAlert.Severity.LOW: 2,
    }
    alerts_by_severity = {
        OperationalAlert.Severity.HIGH: [],
        OperationalAlert.Severity.MEDIUM: [],
        OperationalAlert.Severity.LOW: [],
    }
    for alert in alerts_qs:
        bucket = alerts_by_severity.get(alert.severity)
        if bucket is not None:
            bucket.append(alert)

    summary = build_regiekamer_summary(org)

    return render(request, 'contracts/regiekamer_alerts.html', {
        'alerts_high': alerts_by_severity[OperationalAlert.Severity.HIGH],
        'alerts_medium': alerts_by_severity[OperationalAlert.Severity.MEDIUM],
        'alerts_low': alerts_by_severity[OperationalAlert.Severity.LOW],
        'summary': summary,
        'show_resolved': show_resolved,
        'alert_type_labels': dict(OperationalAlert.AlertType.choices),
    })


@login_required
@require_POST
def resolve_alert(request, pk):
    """Mark a single operational alert as resolved."""
    org = get_user_organization(request.user)
    alert = get_object_or_404(
        OperationalAlert.objects.select_related('case'),
        pk=pk,
        case__organization=org,
    )
    if not alert.is_resolved:
        alert.resolved_at = timezone.now()
        alert.save(update_fields=['resolved_at'])
        log_action(
            request.user,
            AuditLog.Action.UPDATE,
            'OperationalAlert',
            object_id=alert.pk,
            object_repr=str(alert),
            changes={'resolved_at': alert.resolved_at.isoformat()},
            request=request,
        )
        messages.success(request, 'Alert als opgelost gemarkeerd.')
    else:
        messages.info(request, 'Alert was al opgelost.')

    next_fallback = reverse('careon:regiekamer_alerts')
    return _redirect_to_safe_next_or_default(request, next_fallback)
