"""Shared provider location resolution for API and HTML views."""

from __future__ import annotations

from .models import AanbiederVestiging, ContractRelatie, ProviderProfile


COORDINATE_SOURCE_VESTIGING = 'vestiging'
COORDINATE_SOURCE_GEOCODE = 'geocode'
COORDINATE_SOURCE_CITY_ESTIMATE = 'city_estimate'
COORDINATE_SOURCE_NONE = 'none'


def _coerce_coordinate(value, *, minimum, maximum):
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None

    if numeric_value < minimum or numeric_value > maximum:
        return None
    return round(numeric_value, 6)


def extract_coordinates(source):
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


def first_related(queryset_or_manager):
    if queryset_or_manager is None:
        return None

    try:
        return queryset_or_manager.all().first()
    except AttributeError:
        return None


def _resolve_primary_vestiging(profile: ProviderProfile) -> AanbiederVestiging | None:
    client = profile.client
    organization = getattr(client, 'organization', None)
    if organization is None:
        return None

    contract_qs = ContractRelatie.objects.filter(
        organization=organization,
        status=ContractRelatie.ContractStatus.ACTIEF,
    ).select_related('zorgaanbieder')

    exact = contract_qs.filter(zorgaanbieder__name__iexact=client.name).first()
    if exact is None:
        exact = contract_qs.filter(zorgaanbieder__name__icontains=client.name).first()
    if exact is None:
        return None

    return (
        AanbiederVestiging.objects.filter(
            zorgaanbieder=exact.zorgaanbieder,
            is_active=True,
        )
        .order_by('-is_primary', '-updated_at')
        .first()
    )


def _coordinate_source_for_vestiging(vestiging: AanbiederVestiging | None) -> str:
    if vestiging is None:
        return COORDINATE_SOURCE_NONE
    source = (getattr(vestiging, 'coordinate_source', '') or '').strip()
    if source in {COORDINATE_SOURCE_GEOCODE, 'geocode_pdok', 'geocode_google'}:
        return COORDINATE_SOURCE_GEOCODE
    if vestiging.latitude is not None and vestiging.longitude is not None:
        return COORDINATE_SOURCE_VESTIGING
    return COORDINATE_SOURCE_NONE


def provider_location_payload(profile: ProviderProfile | None) -> dict:
    if profile is None:
        return {
            'label': 'Locatie ontbreekt',
            'latitude': None,
            'longitude': None,
            'region_label': '',
            'municipality_label': '',
            'has_coordinates': False,
            'coordinate_source': COORDINATE_SOURCE_NONE,
            'geocoded_at': None,
        }

    primary_region = first_related(profile.served_regions)
    municipality = first_related(primary_region.served_municipalities) if primary_region else None
    region_label = primary_region.region_name if primary_region else ''
    municipality_label = municipality.municipality_name if municipality else ''
    location_label = profile.client.city or municipality_label or region_label or profile.service_area or 'Locatie ontbreekt'

    vestiging = _resolve_primary_vestiging(profile)
    latitude = None
    longitude = None
    coordinate_source = COORDINATE_SOURCE_NONE
    geocoded_at = None

    if vestiging is not None:
        latitude, longitude = extract_coordinates(vestiging)
        coordinate_source = _coordinate_source_for_vestiging(vestiging)
        geocoded_at = getattr(vestiging, 'geocoded_at', None)

    if latitude is None or longitude is None:
        sources = [profile, profile.client, primary_region, municipality]
        for source in sources:
            latitude, longitude = extract_coordinates(source)
            if latitude is not None and longitude is not None:
                coordinate_source = COORDINATE_SOURCE_VESTIGING
                break

    has_city_hint = bool((profile.client.city or municipality_label or region_label or '').strip())
    if latitude is None and has_city_hint:
        coordinate_source = COORDINATE_SOURCE_CITY_ESTIMATE

    return {
        'label': location_label,
        'latitude': latitude,
        'longitude': longitude,
        'region_label': region_label,
        'municipality_label': municipality_label,
        'has_coordinates': latitude is not None and longitude is not None,
        'coordinate_source': coordinate_source,
        'geocoded_at': geocoded_at.isoformat() if geocoded_at else None,
    }
