"""
Providers API views.
"""
import json
import logging

from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator

from contracts.models import Client, ProviderProfile
from contracts.tenancy import get_user_organization
from contracts.provider_location import provider_location_payload as _provider_location_payload
from contracts.provider_workspace import build_provider_workspace_summary

from contracts.api._helpers import _internal_server_error
from contracts.throttle import throttle

logger = logging.getLogger(__name__)


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


@login_required
@throttle(rate=30, period=60)
@require_http_methods(["GET"])
def providers_api(request):
    organization = get_user_organization(request.user)
    try:
        qs = Client.objects.filter(
            organization=organization,
            client_type='CORPORATION',
        ).order_by('name', 'id').select_related('provider_profile').prefetch_related(
            'provider_profile__served_regions__served_municipalities',
            'provider_profile__secondary_served_regions',
            'wait_time_entries',
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
            location = _provider_location_payload(pp) if pp else _provider_location_payload(None)
            if not pp:
                location = {
                    **location,
                    'label': client.city or location['label'],
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
                'coordinateSource': location['coordinate_source'],
                'geocodedAt': location['geocoded_at'],
                'locationLabel': location['label'],
                'regionLabel': location['region_label'] or regions_payload['primary_region_label'],
                'municipalityLabel': location['municipality_label'],
                'secondaryRegionLabels': regions_payload['secondary_region_labels'],
                'allRegionLabels': regions_payload['all_region_labels'],
            })
        response = JsonResponse({'providers': data, 'total_count': paginator.count, 'page': page, 'total_pages': paginator.num_pages, 'workspace_summary': build_provider_workspace_summary(list(page_obj.object_list))})
        # Provider capacity/region data changes rarely. Let the browser reuse the
        # response for a short window so navigating between pages (matching,
        # zorgaanbieders, dashboard) doesn't refetch this heavy payload each time.
        # `private` keeps it per-user (no shared/CDN caching).
        response['Cache-Control'] = 'private, max-age=20'
        return response
    except Exception:
        return _internal_server_error(request, context='providers_api_failed')


@login_required
@require_http_methods(['POST'])
def geocode_vestigingen_api(request):
    if not request.user.is_staff:
        return JsonResponse({'error': 'Geen toegang'}, status=403)

    from contracts.geocoding import apply_geocode_result, geocode_vestiging
    from contracts.models import AanbiederVestiging

    try:
        body = json.loads(request.body or '{}')
    except json.JSONDecodeError:
        body = {}

    limit = int(body.get('limit') or 25)
    force = bool(body.get('force'))
    prefer_google = bool(body.get('prefer_google'))

    qs = AanbiederVestiging.objects.filter(is_active=True).order_by('id')
    if not force:
        qs = qs.filter(Q(latitude__isnull=True) | Q(longitude__isnull=True))
    if limit > 0:
        qs = qs[:limit]

    updated = []
    skipped = []
    for vestiging in qs:
        result = geocode_vestiging(vestiging, prefer_google=prefer_google)
        if result is None:
            skipped.append(vestiging.id)
            continue
        apply_geocode_result(vestiging, result)
        updated.append({'id': vestiging.id, 'label': result.label, 'provider': result.provider})

    return JsonResponse({'updated': updated, 'skipped_ids': skipped, 'processed': len(updated) + len(skipped)})
