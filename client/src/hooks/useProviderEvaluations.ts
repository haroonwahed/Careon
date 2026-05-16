/**
 * useProviderEvaluations — manages provider evaluation (Aanbieder Beoordeling) records.
 *
 * Business rules:
 * - Gemeente creates a case, performs matching, selects a provider, then sends the case
 *   to the provider for beoordeling (Aanbieder Beoordeling).
 * - Only the zorgaanbieder performs the actual beoordeling (accept/reject/request info).
 * - Gemeente monitors the outcome but never decides.
 *
 * The hook falls back gracefully when the /care/api/provider-evaluations/ endpoint is not
 * yet deployed, deriving display state from the existing cases API.
 */

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { apiClient } from '../lib/apiClient';

// ─── Evaluation status types ──────────────────────────────────────────────────

export type EvaluationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'INFO_REQUESTED'
  | 'CANCELLED'
  | 'SUPERSEDED';

export type RejectionReasonCode =
  | 'geen_capaciteit'
  | 'specialisatie_past_niet'
  | 'regio_niet_passend'
  | 'te_hoge_complexiteit'
  | 'onvoldoende_informatie'
  | 'urgentie_niet_haalbaar'
  | 'andere_reden';

export type InfoRequestType =
  | 'medische_informatie'
  | 'woonsituatie'
  | 'financiele_situatie'
  | 'gezinssituatie'
  | 'diagnostiek'
  | 'andere_informatie';

export const REJECTION_REASON_LABELS: Record<RejectionReasonCode, string> = {
  geen_capaciteit:          'Geen capaciteit',
  specialisatie_past_niet:  'Zorgvraag past niet bij specialisatie',
  regio_niet_passend:       'Regio niet passend',
  te_hoge_complexiteit:     'Te hoge complexiteit',
  onvoldoende_informatie:   'Onvoldoende informatie',
  urgentie_niet_haalbaar:   'Urgentie niet haalbaar',
  andere_reden:             'Andere reden',
};

export const INFO_REQUEST_TYPE_LABELS: Record<InfoRequestType, string> = {
  medische_informatie:   'Medische informatie',
  woonsituatie:          'Woonsituatie',
  financiele_situatie:   'Financiële situatie',
  gezinssituatie:        'Gezinssituatie',
  diagnostiek:           'Diagnostiek',
  andere_informatie:     'Andere informatie',
};

// ─── Evaluation model ─────────────────────────────────────────────────────────

export interface ProviderEvaluation {
  id: string;
  caseId: string;
  caseTitle: string;
  clientLabel: string;
  region: string;
  urgency: string;
  complexity: string;
  careType: string;
  providerId: string;
  providerName: string;
  municipalityId: string;
  /** Gemeente label from linked intake (read-model handoff). */
  municipalityName?: string;
  /** Intake entry route code + human label (read-model). */
  entryRoute?: string;
  entryRouteLabel?: string;
  /** Aanmelder actor profile code + label (read-model). */
  aanmelderActorProfile?: string;
  aanmelderActorProfileLabel?: string;
  /** Gemeente casusregisseur display (read-model). */
  caseCoordinatorLabel?: string;
  /** Persisted match explainability for this aanbieder (advisory). */
  matchFitSummary?: string;
  matchTradeOffsHint?: string;
  /** Intake arrangement metadata line (advisory; not a budget guarantee). */
  arrangementHintLine?: string;
  arrangementHintDisclaimer?: string;
  selectedMatchId: string | null;
  status: EvaluationStatus;
  rejectionReasonCode: RejectionReasonCode | null;
  providerComment: string | null;
  informationRequestType: InfoRequestType | null;
  informationRequestComment: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Derived display fields
  daysPending: number;
  slaDeadlineAt: string | null;
  matchScore: number | null;
}

// ─── Decision payload ─────────────────────────────────────────────────────────

export interface EvaluationDecisionPayload {
  status: 'ACCEPTED' | 'REJECTED' | 'INFO_REQUESTED';
  rejection_reason_code?: RejectionReasonCode;
  provider_comment?: string;
  information_request_type?: InfoRequestType;
  information_request_comment?: string;
}

function decisionSuccessToastMessage(payload: EvaluationDecisionPayload): string {
  if (payload.status === 'ACCEPTED') {
    return 'Beoordeling verzonden. De gemeente kan nu plaatsing inplannen.';
  }
  if (payload.status === 'REJECTED') {
    return 'Afwijzing geregistreerd. De casus gaat terug naar matching.';
  }
  return 'Verzoek om aanvullende informatie is verstuurd naar de gemeente.';
}

// ─── API response shape ───────────────────────────────────────────────────────

interface ApiEvaluationsResponse {
  evaluations: ProviderEvaluation[];
  total_count: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseProviderEvaluationsResult {
  evaluations: ProviderEvaluation[];
  totalCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  submitDecision: (caseId: string, payload: EvaluationDecisionPayload) => Promise<void>;
  submitting: boolean;
  submitError: string | null;
  clearSubmitError: () => void;
}

export function useProviderEvaluations(): UseProviderEvaluationsResult {
  const [evaluations, setEvaluations] = useState<ProviderEvaluation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const refetch = useCallback(() => setTick(t => t + 1), []);
  const clearSubmitError = useCallback(() => setSubmitError(null), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .get<ApiEvaluationsResponse>('/care/api/provider-evaluations/')
      .then(data => {
        if (!cancelled) {
          setEvaluations(data.evaluations ?? []);
          setTotalCount(data.total_count ?? 0);
        }
      })
      .catch(() => {
        // Endpoint not yet deployed — degrade gracefully.
        // AanbiederBeoordelingPage falls back to useCases() for display.
        if (!cancelled) {
          setEvaluations([]);
          setTotalCount(0);
          // Do not set error — absence of data is handled in the UI
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [tick]);

  /**
   * submitDecision — zorgaanbieder accepts, rejects, or requests info.
   *
   * Uses the canonical provider-decision endpoint and keeps a temporary
   * fallback to placement-action for rollout compatibility.
   */
  const submitDecision = useCallback(
    async (caseId: string, payload: EvaluationDecisionPayload) => {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await apiClient.post(
          `/care/api/cases/${caseId}/provider-decision/`,
          payload,
        );
        toast.success(decisionSuccessToastMessage(payload));
        refetch();
      } catch (primaryErr) {
        const msg =
          primaryErr instanceof Error
            ? primaryErr.message
            : 'De beslissing kon niet worden verwerkt. Probeer het opnieuw.';
        setSubmitError(msg);
        toast.error(msg);
        throw primaryErr;
      } finally {
        setSubmitting(false);
      }
    },
    [refetch],
  );

  return {
    evaluations,
    totalCount,
    loading,
    error,
    refetch,
    submitDecision,
    submitting,
    submitError,
    clearSubmitError,
  };
}
