"""
Dashboard and region API views.
"""
import logging
from datetime import date

from django.db.models import Count, Q
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator

from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    CareSignal,
    CareTask,
    Client,
    MunicipalityConfiguration,
    RegionalConfiguration,
    RegionType,
)
from contracts.tenancy import (
    get_user_organization,
    scope_queryset_for_organization,
)
from contracts.throttle import throttle
from contracts.permissions import (
    filter_care_cases_for_provider_actor,
    filter_care_signals_for_provider_actor,
    filter_care_tasks_for_provider_actor,
)

from contracts.api._helpers import _internal_server_error

logger = logging.getLogger(__name__)


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
        is_urgent = case.risk_level in {CareCase.RiskLevel.VERHOOGD_RISICO, CareCase.RiskLevel.ACUUT_RISICO}

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
@throttle(rate=60, period=60)
@require_http_methods(["GET"])
def dashboard_summary_api(request):
    organization = get_user_organization(request.user)
    try:
        cases_qs = scope_queryset_for_organization(CareCase.objects.all(), organization).exclude(lifecycle_stage='ARCHIVED')
        cases_qs = filter_care_cases_for_provider_actor(cases_qs, request.user, organization)
        signals_qs = CareSignal.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
            | Q(due_diligence_process__status=CaseIntakeProcess.ProcessStatus.ARCHIVED)
        )
        signals_qs = filter_care_signals_for_provider_actor(signals_qs, request.user, organization)
        tasks_qs = CareTask.objects.for_organization(organization).exclude(
            Q(case_record__lifecycle_stage='ARCHIVED')
        )
        tasks_qs = filter_care_tasks_for_provider_actor(tasks_qs, request.user, organization)

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
    except Exception:
        return _internal_server_error(request, context='dashboard_summary_api_failed')


@login_required
@require_http_methods(["GET"])
def regions_api(request):
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
        data = []
        for r in page_obj:
            data.append({
                'id': str(r.id),
                'name': r.region_name,
                'code': r.region_code,
                'regionType': r.region_type,
                'status': r.status,
                'active': bool(getattr(r, 'active', False)),
                'maxWaitDays': r.max_wait_days,
                'providerCount': r.provider_count,
                'municipalityCount': r.municipality_count,
                'coordinator': r.responsible_coordinator.get_full_name() if r.responsible_coordinator else '',
                'escalatieContact': r.escalatie_contact.get_full_name() if r.escalatie_contact else '',
            })
        return JsonResponse({'regions': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='regions_api_failed')


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
        cases_qs = filter_care_cases_for_provider_actor(cases_qs, request.user, organization)
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
                'active': bool(getattr(region, 'active', False)),
                'maxWaitDays': region.max_wait_days,
                'providerCount': region.provider_count,
                'municipalityCount': region.municipality_count,
                'coordinator': region.responsible_coordinator.get_full_name() if region.responsible_coordinator else '',
                'escalatieContact': region.escalatie_contact.get_full_name() if region.escalatie_contact else '',
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
    except Exception:
        return _internal_server_error(request, context='regions_health_api_failed')


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
                'brpCode': m.brp_code,
                'status': m.status,
                'active': bool(getattr(m, 'active', False)),
                'maxWaitDays': m.max_wait_days,
                'providerCount': m.provider_count,
                'coordinator': m.responsible_coordinator.get_full_name() if m.responsible_coordinator else '',
                'woonplaatsbeginselContact': m.woonplaatsbeginsel_contact.get_full_name() if m.woonplaatsbeginsel_contact else '',
                'budgetOwner': m.budget_owner,
                'contractPolicies': m.contract_policies or [],
            })
        return JsonResponse({'municipalities': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages})
    except Exception:
        return _internal_server_error(request, context='municipalities_api_failed')
