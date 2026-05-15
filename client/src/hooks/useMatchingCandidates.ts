/**
 * Live matching candidates for a case — same payload as gemeente matching API (row 7).
 */

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiRequestError } from "../lib/apiClient";

export interface MatchingCandidateRow {
  casus_id: number;
  zorgprofiel_id: number | null;
  zorgaanbieder_id: number | null;
  aanbiederName?: string;
  totaalscore: number;
  score_inhoudelijke_fit: number;
  score_regio_contract_fit: number;
  score_capaciteit_wachttijd_fit: number;
  score_complexiteit_veiligheid_fit: number;
  score_performance_fit: number;
  confidence_label: string;
  fit_samenvatting: string;
  trade_offs: string[];
  verificatie_advies: string;
  uitgesloten: boolean;
  uitsluitreden: string;
  ranking: number;
  region_pressure_signal?: string;
}

interface MatchingCandidatesResponse {
  caseId?: number;
  count?: number;
  matches?: MatchingCandidateRow[];
  error?: string;
  code?: string;
}

export interface UseMatchingCandidatesResult {
  matches: MatchingCandidateRow[];
  loading: boolean;
  error: string | null;
  /** Set when API returns 400 with code SUMMARY_INCOMPLETE */
  incompleteCode: string | null;
  refetch: () => void;
}

export function useMatchingCandidates(caseId: string): UseMatchingCandidatesResult {
  const [matches, setMatches] = useState<MatchingCandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incompleteCode, setIncompleteCode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!caseId || !/^\d+$/.test(caseId)) {
      setMatches([]);
      setLoading(false);
      setError(null);
      setIncompleteCode(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIncompleteCode(null);

    apiClient
      .get<MatchingCandidatesResponse>(`/care/api/cases/${caseId}/matching-candidates/`, {
        limit: 10,
      })
      .then(data => {
        if (cancelled) return;
        setMatches(data.matches ?? []);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiRequestError && e.status === 400) {
          try {
            const body = JSON.parse(e.bodyText || "{}") as { code?: string; error?: string };
            if (body.code === "SUMMARY_INCOMPLETE") {
              setIncompleteCode(body.code);
              setError(body.error ?? null);
              setMatches([]);
              setLoading(false);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        const msg = e instanceof Error ? e.message : "Matching kon niet worden geladen.";
        setError(msg);
        setMatches([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caseId, tick]);

  return { matches, loading, error, incompleteCode, refetch };
}
