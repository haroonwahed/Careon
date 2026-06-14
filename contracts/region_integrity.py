from __future__ import annotations

from collections.abc import Iterable

from contracts.models import RegionType


def _normalize(value: object) -> str:
    return str(value or "").strip().casefold()


def is_municipality_mirror_region_data(
    *,
    region_type: str,
    region_name: object,
    region_code: object,
    served_municipalities: Iterable[object] | None,
) -> bool:
    if region_type != RegionType.GEMEENTELIJK:
        return False

    municipalities = list(served_municipalities or [])
    if len(municipalities) != 1:
        return False

    municipality = municipalities[0]
    municipality_name = getattr(municipality, "municipality_name", "")
    municipality_code = getattr(municipality, "municipality_code", "")

    return _normalize(region_name) == _normalize(municipality_name) and _normalize(region_code) == _normalize(municipality_code)


def find_municipality_mirror_region_qs(regions_qs):
    """Return a queryset/list of mirror regions when the caller passes a queryset."""
    matches = []
    for region in regions_qs:
        served = list(getattr(region, "served_municipalities", []).all()) if hasattr(region, "served_municipalities") else []
        if is_municipality_mirror_region_data(
            region_type=getattr(region, "region_type", ""),
            region_name=getattr(region, "region_name", ""),
            region_code=getattr(region, "region_code", ""),
            served_municipalities=served,
        ):
            matches.append(region)
    return matches
