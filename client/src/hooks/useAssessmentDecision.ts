import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';

export interface AssessmentDecisionOption {
  value: string;
  label: string;
}

export interface AssessmentDecisionSignal {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  status: string;
}

export interface AssessmentDecisionTimelineItem {
  label: string;
  date: string;
  tone: 'neutral' | 'info' | 'warning';
}

export interface AssessmentDecisionPayload {
  caseId: string;
  assessmentId: string;
  intakeId: string;
  title: string;
  form: {
    decision: string;
    zorgtype: string;
    shortDescription: string;
    urgency: string;
    complexity: string;
    constraints: string[];
  };
  options: {
    decision: AssessmentDecisionOption[];
    zorgtype: AssessmentDecisionOption[];
    urgency: AssessmentDecisionOption[];
    complexity: AssessmentDecisionOption[];
    constraints: AssessmentDecisionOption[];
  };
  consequences: Record<string, { title: string; description: string }>;
  summary: {
    caseId: string;
    title: string;
    region: string;
    municipality: string;
    phase: string;
    waitDays: number;
    careType: string;
    coordinator: string;
    ageCategory: string;
    familySituation: string;
    schoolWorkStatus: string;
    intakeSummary: string;
  };
  hints: {
    suggestedUrgency: {
      value: string;
      label: string;
      reason: string;
    };
    matchingDifficulty: {
      level: string;
      detail: string;
    };
    riskHints: string[];
  };
  signals: AssessmentDecisionSignal[];
  timeline: AssessmentDecisionTimelineItem[];
  meta: {
    updatedAt: string;
    assessedBy: string;
    status: string;
    matchingReady: boolean;
    reasonNotReady: string;
  };
}

export interface SaveAssessmentDecisionPayload {
  decision: string;
  zorgtype: string;
  shortDescription: string;
  urgency: string;
  complexity: string;
  constraints: string[];
}

export interface SaveAssessmentDecisionResult {
  ok: boolean;
  assessmentId: string;
  decision: string;
  nextPage: 'matching' | 'beoordelingen';
  message: string;
}

interface UseAssessmentDecisionResult {
  data: AssessmentDecisionPayload | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refetch: () => void;
  save: (payload: SaveAssessmentDecisionPayload) => Promise<SaveAssessmentDecisionResult>;
}

export function useAssessmentDecision(caseId: string | null): UseAssessmentDecisionResult {
  const [data, setData] = useState<AssessmentDecisionPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(caseId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((current) => current + 1), []);

  useEffect(() => {
    if (!caseId) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .get<AssessmentDecisionPayload>(`/care/api/cases/${caseId}/assessment-decision/`)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setData(payload);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) {
          return;
        }
        setError(err.message ?? 'Kon beoordeling niet laden');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, tick]);

  const save = useCallback(async (payload: SaveAssessmentDecisionPayload) => {
    if (!caseId) {
      throw new Error('Geen casus geselecteerd');
    }
    setSaving(true);
    setError(null);
    try {
      const result = await apiClient.post<SaveAssessmentDecisionResult>(
        `/care/api/cases/${caseId}/assessment-decision/`,
        payload,
      );
      setTick((current) => current + 1);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Opslaan is mislukt';
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [caseId]);

  return { data, loading, saving, error, refetch, save };
}
