import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useProviderMapMarkers } from './useProviderMapMarkers';
import type { SpaProvider } from './useProviders';

function makeProvider(overrides: Partial<SpaProvider> = {}): SpaProvider {
  return {
    id: 'p1',
    name: 'Test',
    city: 'Utrecht',
    status: 'ACTIVE',
    currentCapacity: 1,
    maxCapacity: 5,
    waitingListLength: 0,
    averageWaitDays: 0,
    offersOutpatient: true,
    offersDayTreatment: false,
    offersResidential: false,
    offersCrisis: false,
    serviceArea: '',
    specialFacilities: '',
    availableSpots: 1,
    region: 'Utrecht',
    type: 'ambulant',
    specializations: [],
    latitude: null,
    longitude: null,
    hasCoordinates: false,
    coordinateSource: 'city_estimate',
    locationLabel: 'Utrecht',
    regionLabel: '',
    municipalityLabel: '',
    secondaryRegionLabels: [],
    allRegionLabels: [],
    ...overrides,
  };
}

describe('useProviderMapMarkers', () => {
  it('maps exact coordinates when present', () => {
    const { result } = renderHook(() =>
      useProviderMapMarkers([
        makeProvider({
          hasCoordinates: true,
          latitude: 52.09,
          longitude: 5.12,
          coordinateSource: 'geocode',
        }),
      ]),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].isEstimated).toBe(false);
    expect(result.current[0].lat).toBe(52.09);
  });

  it('estimates city coordinates when only city is known', () => {
    const { result } = renderHook(() => useProviderMapMarkers([makeProvider()]));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].isEstimated).toBe(true);
    expect(result.current[0].coordinateSource).toBe('city_estimate');
  });
});
