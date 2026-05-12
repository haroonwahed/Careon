import type { CaseDecisionState, WorkflowCaseView } from "../../lib/workflowUi";
import type { CasusWorkboardClassification } from "./casusWorkboardClassification";

/**
 * Display-only operational queue buckets for Werkvoorraad grouping.
 * Does not replace backend workflow classification (`classifyCasusWorkboardState`).
 */
export type OperatieveWachtrijGroepKey =
  | "wacht-op-aanmelder"
  | "financiele-validatie"
  | "klaar-voor-matching"
  | "wacht-op-aanbieder"
  | "plaatsing-intake"
  | "doorstroom-overig";

/** Sort order when flattening the queue for pagination. */
export const OPERATIEVE_WACHTLIJN_VOLGORDE: readonly OperatieveWachtrijGroepKey[] = [
  "wacht-op-aanmelder",
  "financiele-validatie",
  "klaar-voor-matching",
  "wacht-op-aanbieder",
  "plaatsing-intake",
  "doorstroom-overig",
] as const;

export const OPERATIEVE_WACHTLIJN_LABELS: Record<OperatieveWachtrijGroepKey, string> = {
  "wacht-op-aanmelder": "Wacht op aanmelder",
  "financiele-validatie": "Financiële validatie vereist",
  "klaar-voor-matching": "Klaar voor matching",
  "wacht-op-aanbieder": "Wacht op aanbieder",
  "plaatsing-intake": "Plaatsing & intake",
  "doorstroom-overig": "Zonder urgente wachtrij",
};

function financialSignals(reason: string | null, whyHere: string): boolean {
  const rx = /financ|tarief|bekostig|budget|declaratie|indicatie|verzeker/i;
  return rx.test(reason ?? "") || rx.test(whyHere);
}

export function operatieveGroepSortIndex(key: OperatieveWachtrijGroepKey): number {
  const i = OPERATIEVE_WACHTLIJN_VOLGORDE.indexOf(key);
  return i >= 0 ? i : OPERATIEVE_WACHTLIJN_VOLGORDE.length;
}

/**
 * Maps a case to a coarse operational queue group for UI grouping only.
 */
export function deriveOperatieveWachtrijGroep(
  item: WorkflowCaseView,
  decision: CaseDecisionState,
  classification: CasusWorkboardClassification,
): OperatieveWachtrijGroepKey {
  if (classification.section === "waiting-provider") {
    return "wacht-op-aanbieder";
  }

  if (item.boardColumn === "gemeente-validatie" || financialSignals(decision.blockedReason, decision.whyHere)) {
    return "financiele-validatie";
  }

  if (item.boardColumn === "plaatsing" || item.boardColumn === "intake") {
    return "plaatsing-intake";
  }

  if (item.boardColumn === "matching") {
    return "klaar-voor-matching";
  }

  const applicantSurface =
    item.missingDataItems.length > 0 || item.boardColumn === "casus" || item.boardColumn === "samenvatting";

  if (classification.section === "attention" && applicantSurface) {
    return "wacht-op-aanmelder";
  }

  return "doorstroom-overig";
}

export function emptyQueueGroupTotals(): Record<OperatieveWachtrijGroepKey, number> {
  return {
    "wacht-op-aanmelder": 0,
    "financiele-validatie": 0,
    "klaar-voor-matching": 0,
    "wacht-op-aanbieder": 0,
    "plaatsing-intake": 0,
    "doorstroom-overig": 0,
  };
}
