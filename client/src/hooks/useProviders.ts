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
}

interface UseProvidersOptions {
  q?: string;
}

interface UseProvidersResult {
  providers: SpaProvider[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useProviders(options: UseProvidersOptions = {}): UseProvidersResult {
  const { q = '' } = options;
  const [providers, setProviders] = useState<SpaProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
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
      }>; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setProviders((data.providers ?? []).map(p => ({
          ...p,
          availableSpots: p.currentCapacity,
          region: p.city,
          type: [
            p.offersOutpatient ? 'ambulant' : null,
            p.offersDayTreatment ? 'dagbehandeling' : null,
            p.offersResidential ? 'residentieel' : null,
            p.offersCrisis ? 'crisis' : null,
          ].filter(Boolean).join(', ') || 'onbekend',
          specializations: p.specialFacilities
            ? p.specialFacilities.split(',').map(s => s.trim()).filter(Boolean)
            : [],
        })));
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon aanbieders niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  return { providers, loading, error, totalCount, refetch };
}
