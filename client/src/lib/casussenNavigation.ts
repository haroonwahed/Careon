/**
 * One-shot focus handoff between Regiekamer NBA links and the Casussen worklist.
 *
 * Regiekamer can hint a preferred initial focus when navigating the user to
 * /casussen (e.g. landing pre-filtered to "critical" cases). The receiver
 * (WorkloadPage) consumes the hint exactly once on mount and clears it.
 *
 * Safe across SSR / privacy modes — sessionStorage access is guarded.
 */
export const CASUSSEN_PREFERRED_FOCUS_STORAGE_KEY = "careon.casussen.preferredFocus";

/**
 * Supported focus hints:
 * - "critical": blockers + critical-urgency (used by "Bekijk kritieke casussen").
 * - "pipeline": casussen die actief in de stroom zitten — gemeentelijke aandacht
 *   of bij aanbieder belegd. Used by "Bekijk gehele stroom" so it is operationally
 *   distinct from the default /casussen entry.
 */
export type CasussenPreferredFocus = "critical" | "pipeline";

const VALID_FOCUS_VALUES: ReadonlySet<string> = new Set<CasussenPreferredFocus>([
  "critical",
  "pipeline",
]);

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function setCasussenPreferredFocus(value: CasussenPreferredFocus): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(CASUSSEN_PREFERRED_FOCUS_STORAGE_KEY, value);
  } catch {
    // ignore quota / privacy errors — caller falls back to plain navigation.
  }
}

export function consumeCasussenPreferredFocus(): CasussenPreferredFocus | null {
  const storage = getStorage();
  if (!storage) return null;
  let raw: string | null = null;
  try {
    raw = storage.getItem(CASUSSEN_PREFERRED_FOCUS_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw && VALID_FOCUS_VALUES.has(raw)) {
    try {
      storage.removeItem(CASUSSEN_PREFERRED_FOCUS_STORAGE_KEY);
    } catch {
      // ignore — best effort one-shot.
    }
    return raw as CasussenPreferredFocus;
  }
  return null;
}
