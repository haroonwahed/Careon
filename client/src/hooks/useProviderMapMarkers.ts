import { useMemo } from 'react';
import type { CoordinateSource } from '../lib/mapConfig';
import type { SpaProvider } from './useProviders';

const CITY_COORDINATES: Record<string, [number, number]> = {
  amsterdam: [52.3676, 4.9041],
  rotterdam: [51.9244, 4.4777],
  utrecht: [52.0907, 5.1214],
  'den haag': [52.0705, 4.3007],
  denhaag: [52.0705, 4.3007],
  eindhoven: [51.4416, 5.4697],
  groningen: [53.2194, 6.5665],
  breda: [51.5719, 4.7683],
  arnhem: [51.9851, 5.8987],
  nijmegen: [51.8126, 5.8372],
  haarlem: [52.3874, 4.6462],
  maastricht: [50.8514, 5.6909],
  leiden: [52.1601, 4.497],
  delft: [52.0116, 4.3571],
  almere: [52.3508, 5.2647],
  tilburg: [51.5555, 5.0913],
  enschede: [52.2215, 6.8937],
  apeldoorn: [52.2112, 5.9699],
  zwolle: [52.5168, 6.083],
  amersfoort: [52.1561, 5.3878],
};

function normalizeCity(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function stableOffset(seed: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return [(((hash & 0xff) / 255) - 0.5) * 0.08, ((((hash >> 8) & 0xff) / 255) - 0.5) * 0.12];
}

export type ProviderMapMarker = {
  provider: SpaProvider;
  lat: number;
  lng: number;
  isEstimated: boolean;
  coordinateSource: CoordinateSource;
};

export function useProviderMapMarkers(providers: SpaProvider[]): ProviderMapMarker[] {
  return useMemo(() => {
    const markers: ProviderMapMarker[] = [];

    for (const provider of providers) {
      if (provider.hasCoordinates && provider.latitude !== null && provider.longitude !== null) {
        markers.push({
          provider,
          lat: provider.latitude,
          lng: provider.longitude,
          isEstimated: false,
          coordinateSource: provider.coordinateSource ?? 'vestiging',
        });
        continue;
      }

      const shouldEstimate =
        provider.coordinateSource === 'city_estimate' ||
        (!provider.hasCoordinates && Boolean(provider.city || provider.region));

      if (!shouldEstimate) {
        continue;
      }

      const key = normalizeCity(provider.city || provider.region || '');
      const coords = CITY_COORDINATES[key];
      if (!coords) {
        continue;
      }

      const [dLat, dLng] = stableOffset(provider.id);
      markers.push({
        provider,
        lat: coords[0] + dLat,
        lng: coords[1] + dLng,
        isEstimated: true,
        coordinateSource: 'city_estimate',
      });
    }

    return markers;
  }, [providers]);
}

export function countEstimatedMarkers(markers: ProviderMapMarker[]): number {
  return markers.filter((marker) => marker.isEstimated).length;
}
