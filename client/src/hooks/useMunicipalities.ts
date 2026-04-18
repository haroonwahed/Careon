/**
 * useMunicipalities — fetches live MunicipalityConfiguration records from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface SpaMunicipality {
  id: string;
  name: string;
  code: string;
  status: string;
  maxWaitDays: number | null;
  providerCount: number;
  coordinator: string;
  // derived / enriched fields (set to defaults since DB lacks these)
  casesCount: number;
  activeCases: number;
  avgWaitingTime: number;
  capacityStatus: 'normal' | 'busy' | 'shortage';
  urgentCases: number;
  blockedCases: number;
  population: number;
  trend: 'up' | 'down' | 'stable';
}

interface UseMunicipalitiesOptions {
  q?: string;
}

interface UseMunicipalitiesResult {
  municipalities: SpaMunicipality[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useMunicipalities(options: UseMunicipalitiesOptions = {}): UseMunicipalitiesResult {
  const { q = '' } = options;
  const [municipalities, setMunicipalities] = useState<SpaMunicipality[]>([]);
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

    apiClient.get('/care/api/municipalities/', params)
      .then((data: { municipalities: Array<{
        id: string; name: string; code: string; status: string;
        maxWaitDays: number | null; providerCount: number; coordinator: string;
      }>; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setMunicipalities((data.municipalities ?? []).map(m => ({
          ...m,
          casesCount: 0,
          activeCases: 0,
          avgWaitingTime: m.maxWaitDays ?? 0,
          capacityStatus: 'normal' as const,
          urgentCases: 0,
          blockedCases: 0,
          population: 0,
          trend: 'stable' as const,
        })));
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon gemeenten niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  return { municipalities, loading, error, totalCount, refetch };
}
