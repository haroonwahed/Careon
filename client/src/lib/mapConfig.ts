export type CoordinateSource = 'vestiging' | 'geocode' | 'city_estimate' | 'none';

export type MapBasemap = 'maplibre' | 'google';

export function isGoogleMapsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim());
}

export function resolveDefaultMapBasemap(): MapBasemap {
  const configured = import.meta.env.VITE_MAP_BASEMAP?.trim().toLowerCase();
  if (configured === 'google' && isGoogleMapsConfigured()) {
    return 'google';
  }
  return 'maplibre';
}

export function coordinateSourceLabel(source: CoordinateSource | undefined): string {
  switch (source) {
    case 'geocode':
      return 'Geocode (adres)';
    case 'vestiging':
      return 'Vestigingscoördinaten';
    case 'city_estimate':
      return 'Geschat op plaats';
    case 'none':
    default:
      return 'Geen coördinaten';
  }
}
