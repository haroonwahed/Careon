import { useCallback, useEffect, useState } from "react";
import { apiClient } from "../lib/apiClient";

export type WorkflowRole = "gemeente" | "zorgaanbieder" | "admin";

export interface CurrentUserMe {
  id: number;
  email: string;
  fullName: string;
  username: string;
  workflowRole: WorkflowRole;
  organization: { id: number; name: string } | null;
  permissions: { allowRoleSwitch: boolean };
  flags: { pilotUi: boolean; spaOnlyWorkflow: boolean };
}

function normalizeRole(raw: string | undefined): WorkflowRole {
  if (raw === "zorgaanbieder" || raw === "admin" || raw === "gemeente") {
    return raw;
  }
  return "gemeente";
}

export function useCurrentUser(): {
  me: CurrentUserMe | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [me, setMe] = useState<CurrentUserMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiClient
      .get<CurrentUserMe>("/care/api/me/")
      .then((payload) => {
        if (!cancelled) {
          setMe({
            ...payload,
            workflowRole: normalizeRole(payload.workflowRole),
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMe(null);
          setError(err instanceof Error ? err.message : "Kon gebruikersprofiel niet laden.");
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

  return { me, loading, error, refetch };
}
