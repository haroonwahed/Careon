"""Geocoding for AanbiederVestiging — PDOK default, Google optional."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import quote_plus

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

PDOK_FREE_SEARCH_URL = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free'
GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'


@dataclass(frozen=True)
class GeocodeResult:
    latitude: float
    longitude: float
    provider: str
    label: str


def _format_vestiging_query(vestiging) -> str:
    parts = []
    if vestiging.straat:
        street = vestiging.straat.strip()
        if vestiging.huisnummer:
            street = f'{street} {vestiging.huisnummer.strip()}'
        parts.append(street)
    elif vestiging.address:
        parts.append(vestiging.address.strip())
    if vestiging.postcode:
        parts.append(vestiging.postcode.strip())
    if vestiging.city:
        parts.append(vestiging.city.strip())
    elif vestiging.gemeente:
        parts.append(vestiging.gemeente.strip())
    return ', '.join(part for part in parts if part)


def geocode_with_pdok(query: str, *, timeout: float = 8.0) -> GeocodeResult | None:
    if not query.strip():
        return None

    response = requests.get(
        PDOK_FREE_SEARCH_URL,
        params={'q': query, 'rows': 1, 'fq': 'type:adres'},
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    docs = payload.get('response', {}).get('docs') or []
    if not docs:
        return None

    doc = docs[0]
    centre = doc.get('centroide_ll') or ''
    if centre.startswith('POINT(') and centre.endswith(')'):
        lon_str, lat_str = centre[6:-1].split()
        return GeocodeResult(
            latitude=round(float(lat_str), 6),
            longitude=round(float(lon_str), 6),
            provider='geocode_pdok',
            label=doc.get('weergavenaam') or query,
        )
    return None


def geocode_with_google(query: str, *, api_key: str, timeout: float = 8.0) -> GeocodeResult | None:
    if not query.strip() or not api_key:
        return None

    response = requests.get(
        GOOGLE_GEOCODE_URL,
        params={'address': query, 'key': api_key, 'region': 'nl'},
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get('status') != 'OK':
        logger.info('google_geocode_status', extra={'status': payload.get('status'), 'query': query})
        return None

    results = payload.get('results') or []
    if not results:
        return None

    location = results[0]['geometry']['location']
    return GeocodeResult(
        latitude=round(float(location['lat']), 6),
        longitude=round(float(location['lng']), 6),
        provider='geocode_google',
        label=results[0].get('formatted_address') or query,
    )


def geocode_vestiging(vestiging, *, prefer_google: bool = False) -> GeocodeResult | None:
    query = _format_vestiging_query(vestiging)
    if not query:
        return None

    google_key = getattr(settings, 'GOOGLE_GEOCODING_API_KEY', '') or ''
    if prefer_google and google_key:
        result = geocode_with_google(query, api_key=google_key)
        if result:
            return result

    result = geocode_with_pdok(query)
    if result:
        return result

    if google_key and not prefer_google:
        return geocode_with_google(query, api_key=google_key)
    return None


def apply_geocode_result(vestiging, result: GeocodeResult) -> None:
    vestiging.latitude = result.latitude
    vestiging.longitude = result.longitude
    vestiging.coordinate_source = result.provider
    vestiging.geocoded_at = timezone.now()
    vestiging.save(update_fields=['latitude', 'longitude', 'coordinate_source', 'geocoded_at', 'updated_at'])


def google_maps_directions_url(*, latitude: float, longitude: float, label: str = '') -> str:
    destination = f'{latitude},{longitude}'
    if label:
        destination = f'{quote_plus(label)}@{latitude},{longitude}'
    return f'https://www.google.com/maps/dir/?api=1&destination={destination}'
