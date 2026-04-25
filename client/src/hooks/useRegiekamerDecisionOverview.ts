import { useCallback, useEffect, useState } from "react";
import {
  fetchRegiekamerDecisionOverview,
  type RegiekamerDecisionOverview,
} from "../lib/regiekamerDecisionOverview";

export interface UseRegiekamerDecisionOverviewResult {
  data: RegiekamerDecisionOverview | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRegiekamerDecisionOverview(): UseRegiekamerDecisionOverviewResult {
  const [data, setData] = useState<RegiekamerDecisionOverview | null>(null);
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

    fetchRegiekamerDecisionOverview()
      .then((payload) => {
        if (!cancelled) {
          setData(payload);
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Regiekamer-overzicht kon niet worden geladen.");
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
