import { useCallback, useEffect, useState } from "react";
import {
  fetchCoordinationDecisionOverview,
  type CoordinationDecisionOverview,
} from "../lib/coordinationDecisionOverview";

export interface UseCoordinationDecisionOverviewResult {
  data: CoordinationDecisionOverview | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCoordinationDecisionOverview(): UseCoordinationDecisionOverviewResult {
  const [data, setData] = useState<CoordinationDecisionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCoordinationDecisionOverview()
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Coördinatie-overzicht kon niet worden geladen.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { data, loading, error, refetch };
}
