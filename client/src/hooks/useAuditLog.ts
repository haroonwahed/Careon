/**
 * useAuditLog — fetches live AuditLog records from the Django API.
 *
 * Potential violation: telemetry must not use audit infrastructure — Regiekamer NBA
 * events must not be sent here; see docs/REGIEKAMER_NBA_TELEMETRY.md.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface SpaAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  modelName: string;
  objectId: number | null;
  objectRepr: string;
  userName: string;
  userEmail: string;
  changes: Record<string, unknown> | null;
}

interface UseAuditLogOptions {
  q?: string;
}

interface UseAuditLogResult {
  entries: SpaAuditEntry[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useAuditLog(options: UseAuditLogOptions = {}): UseAuditLogResult {
  const { q = '' } = options;
  const [entries, setEntries] = useState<SpaAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page_size: '50' };
    if (q) params.q = q;

    apiClient.get('/care/api/audit-log/', params)
      .then((data: { entries: SpaAuditEntry[]; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setEntries(data.entries ?? []);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon auditlog niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  return { entries, loading, error, totalCount, refetch };
}
