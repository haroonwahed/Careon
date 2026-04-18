/**
 * useRegions — fetches live RegionalConfiguration records from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface SpaRegion {
  id: string;
  name: string;
  code: string;
  regionType: string;
  status: string;
  maxWaitDays: number | null;
  providerCount: number;
  municipalityCount: number;
  coordinator: string;
  // derived / enriched (defaults until we have aggregation)
  casesCount: number;
  gemeentenCount: number;
  providersCount: number;
  avgWaitingTime: number;
  capacityStatus: 'normal' | 'busy' | 'shortage';
  totalCapacity: number;
  usedCapacity: number;
  trend: 'up' | 'down' | 'stable';
}

interface UseRegionsOptions {
  q?: string;
}

interface UseRegionsResult {
  regions: SpaRegion[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useRegions(options: UseRegionsOptions = {}): UseRegionsResult {
  const { q = '' } = options;
  const [regions, setRegions] = useState<SpaRegion[]>([]);
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

    apiClient.get('/care/api/regions/', params)
      .then((data: { regions: Array<{
        id: string; name: string; code: string; regionType: string; status: string;
        maxWaitDays: number | null; providerCount: number; municipalityCount: number;
        coordinator: string;
      }>; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setRegions((data.regions ?? []).map(r => ({
          ...r,
          casesCount: 0,
          gemeentenCount: r.municipalityCount,
          providersCount: r.providerCount,
          avgWaitingTime: r.maxWaitDays ?? 0,
          capacityStatus: 'normal' as const,
          totalCapacity: 0,
          usedCapacity: 0,
          trend: 'stable' as const,
        })));
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon regio\'s niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  return { regions, loading, error, totalCount, refetch };
}
