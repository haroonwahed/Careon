/**
 * useSignals — fetches live CareSignal records from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export type SignalSeverity = 'critical' | 'warning' | 'info';

export interface SpaSignal {
  id: string;
  severity: SignalSeverity;
  signalType: string;
  title: string;
  description: string;
  status: string;
  linkedCaseId: string;
  linkedCaseTitle: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
}

function mapSeverity(riskLevel: string): SignalSeverity {
  switch (riskLevel?.toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH':     return 'critical';
    case 'MEDIUM':   return 'warning';
    default:         return 'info';
  }
}

interface UseSignalsOptions {
  q?: string;
  status?: string;
}

interface UseSignalsResult {
  signals: SpaSignal[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useSignals(options: UseSignalsOptions = {}): UseSignalsResult {
  const { q = '', status = '' } = options;
  const [signals, setSignals] = useState<SpaSignal[]>([]);
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
    if (status) params.status = status;

    apiClient.get('/care/api/signals/', params)
      .then((data: { signals: Array<{
        id: string; title: string; signalType: string; riskLevel: string;
        status: string; description: string; linkedCaseId: string;
        linkedCaseTitle: string; assignedTo: string; createdAt: string; updatedAt: string;
      }>; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setSignals((data.signals ?? []).map(s => ({
          id: s.id,
          severity: mapSeverity(s.riskLevel),
          signalType: s.signalType,
          title: s.title,
          description: s.description,
          status: s.status,
          linkedCaseId: s.linkedCaseId,
          linkedCaseTitle: s.linkedCaseTitle,
          assignedTo: s.assignedTo,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })));
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon signalen niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, status, tick]);

  return { signals, loading, error, totalCount, refetch };
}
