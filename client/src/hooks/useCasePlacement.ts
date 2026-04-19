/**
 * useCasePlacement — fetches the current PlacementRequest for a given case.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface CasePlacementDetail {
  id: string;
  status: string;
  careForm: string;
  providerResponseStatus: string;
  proposedProviderId: string;
  proposedProviderName: string;
  selectedProviderId: string;
  selectedProviderName: string;
  resolvedProviderId: string;
  resolvedProviderName: string;
  decisionNotes: string;
  startDate: string;
  createdAt: string;
}

interface UseCasePlacementResult {
  placement: CasePlacementDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCasePlacement(caseId: string | null): UseCasePlacementResult {
  const [placement, setPlacement] = useState<CasePlacementDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!caseId) {
      setPlacement(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .get<{ placement: CasePlacementDetail | null }>(`/care/api/cases/${caseId}/placement/`)
      .then((data) => {
        if (cancelled) return;
        setPlacement(data.placement ?? null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon plaatsing niet laden');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, tick]);

  return { placement, loading, error, refetch };
}
