/**
 * useAssessments — fetches live CaseAssessment records from the Django API.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';

export interface SpaAssessment {
  id: string;
  caseId: string;
  caseTitle: string;
  regio: string;
  wachttijd: number;
  status: 'open' | 'in_progress' | 'completed' | 'needs_info';
  matchingReady: boolean;
  missingInfo: { field: string; severity: 'error' | 'warning' }[];
  notes: string;
  assessedBy: string;
  createdAt: string;
}

function mapStatus(apiStatus: string): SpaAssessment['status'] {
  switch (apiStatus) {
    case 'DRAFT':                 return 'open';
    case 'UNDER_REVIEW':          return 'in_progress';
    case 'APPROVED_FOR_MATCHING': return 'completed';
    case 'NEEDS_INFO':            return 'needs_info';
    default:                      return 'open';
  }
}

function deriveRiskSignalsMissing(signals: string[]): { field: string; severity: 'error' | 'warning' }[] {
  return signals.map(code => {
    const isError = ['SAFETY', 'ESCALATION', 'INCOMPLETE_INTAKE'].includes(code);
    const labels: Record<string, string> = {
      SAFETY: 'Veiligheidssignaal aanwezig',
      ESCALATION: 'Escalatierisico',
      DROPOUT_RISK: 'Uitvalsrisico',
      INCOMPLETE_INTAKE: 'Intake incompleet',
    };
    return { field: labels[code] || code, severity: isError ? 'error' : 'warning' };
  });
}

interface UseAssessmentsOptions {
  q?: string;
}

interface UseAssessmentsResult {
  assessments: SpaAssessment[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  refetch: () => void;
}

export function useAssessments(options: UseAssessmentsOptions = {}): UseAssessmentsResult {
  const { q = '' } = options;
  const [assessments, setAssessments] = useState<SpaAssessment[]>([]);
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

    apiClient.get('/care/api/assessments/', params)
      .then((data: { assessments: Array<{
        id: string; caseId: string; caseTitle: string; regio: string;
        wachttijd: number; status: string; matchingReady: boolean;
        riskSignals: string[]; notes: string; assessedBy: string; createdAt: string;
      }>; total_count: number }) => {
        if (cancelled) return;
        setTotalCount(data.total_count ?? 0);
        setAssessments((data.assessments ?? []).map(a => ({
          id: a.id,
          caseId: a.caseId,
          caseTitle: a.caseTitle,
          regio: a.regio,
          wachttijd: a.wachttijd,
          status: mapStatus(a.status),
          matchingReady: a.matchingReady,
          missingInfo: deriveRiskSignalsMissing(a.riskSignals ?? []),
          notes: a.notes,
          assessedBy: a.assessedBy,
          createdAt: a.createdAt,
        })));
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Kon beoordelingen niet laden');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, tick]);

  return { assessments, loading, error, totalCount, refetch };
}
