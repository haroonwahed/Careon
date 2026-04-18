/**
 * useDashboard — fetches aggregate KPI summary from the Django API for the Regiekamer.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface DashboardSummary {
  totalCases: number;
  activeCases: number;
  openSignals: number;
  criticalSignals: number;
  pendingTasks: number;
  phaseBreakdown: Record<string, number>;
  riskBreakdown: Record<string, number>;
}

const EMPTY_SUMMARY: DashboardSummary = {
  totalCases: 0,
  activeCases: 0,
  openSignals: 0,
  criticalSignals: 0,
  pendingTasks: 0,
  phaseBreakdown: {},
  riskBreakdown: {},
};

interface UseDashboardResult {
  summary: DashboardSummary;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardResult {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient.get('/care/api/dashboard/', {})
      .then((data: DashboardSummary) => {
        if (cancelled) return;
        setSummary(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon dashboard niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  return { summary, loading, error, refetch };
}
