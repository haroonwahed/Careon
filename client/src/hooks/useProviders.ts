/**
 * useProviders — fetches live ProviderProfile/Client records from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface SpaProvider {
  id: string;
  name: string;
  city: string;
  status: string;
  currentCapacity: number;
  maxCapacity: number;
  waitingListLength: number;
  averageWaitDays: number;
  offersOutpatient: boolean;
  offersDayTreatment: boolean;
  offersResidential: boolean;
  offersCrisis: boolean;
  serviceArea: string;
  specialFacilities: string;
  availableSpots: number;
  region: string;
  type: string;
  specializations: string[];
  latitude: number | null;
  longitude: number | null;
  hasCoordinates: boolean;
  locationLabel: string;
  regionLabel: string;
  municipalityLabel: string;
  secondaryRegionLabels: string[];
  allRegionLabels: string[];
}

interface UseProvidersOptions {
  q?: string;
  autoRefreshMs?: number;
}

interface NetworkSummary {
  provider_count: number;
  direct_capacity_count: number;
  pressure_capacity_count: number;
  high_wait_count: number;
  total_open_slots: number;
  subtle_summary: string | null;
  regional_capacity_summary: string | null;
}

interface UseProvidersResult {
  providers: SpaProvider[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  networkSummary: NetworkSummary | null;
  lastUpdatedAt: number | null;
  refetch: () => void;
}

export function useProviders(options: UseProvidersOptions = {}): UseProvidersResult {
  const { q = '', autoRefreshMs = 30_000 } = options;
  const [providers, setProviders] = useState<SpaProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page_size: '100' };
    if (q) params.q = q;

    apiClient.get('/care/api/providers/', params)
      .then((data: { providers: Array<{
        id: string; name: string; city: string; status: string;
        currentCapacity: number; maxCapacity: number; waitingListLength: number;
        averageWaitDays: number; offersOutpatient: boolean; offersDayTreatment: boolean;
        offersResidential: boolean; offersCrisis: boolean; serviceArea: string;
        specialFacilities: string;
        latitude: number | null;
        longitude: number | null;
        hasCoordinates: boolean;
        locationLabel: string;
        regionLabel: string;
        municipalityLabel: string;
        secondaryRegionLabels?: string[];
        allRegionLabels?: string[];
      }>; total_count: number; workspace_summary?: NetworkSummary }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        if (data.workspace_summary) setNetworkSummary(data.workspace_summary);
        setProviders((data.providers ?? []).map(p => ({
          ...p,
          availableSpots: p.currentCapacity,
          region: p.regionLabel || p.city,
          type: [
            p.offersOutpatient ? 'ambulant' : null,
            p.offersDayTreatment ? 'dagbehandeling' : null,
            p.offersResidential ? 'residentieel' : null,
            p.offersCrisis ? 'crisis' : null,
          ].filter(Boolean).join(', ') || 'onbekend',
          specializations: p.specialFacilities
            ? p.specialFacilities.split(',').map(s => s.trim()).filter(Boolean)
            : [],
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          hasCoordinates: Boolean(p.hasCoordinates),
          locationLabel: p.locationLabel ?? p.city ?? '',
          regionLabel: p.regionLabel ?? '',
          municipalityLabel: p.municipalityLabel ?? '',
          secondaryRegionLabels: p.secondaryRegionLabels ?? [],
          allRegionLabels: p.allRegionLabels ?? (p.regionLabel ? [p.regionLabel] : []),
        })));
        setLastUpdatedAt(Date.now());
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon aanbieders niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  useEffect(() => {
    if (autoRefreshMs <= 0) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    }, autoRefreshMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefreshMs, refetch]);

  return { providers, loading, error, totalCount, networkSummary, lastUpdatedAt, refetch };
}
