import type {
  RegiekamerDecisionOverviewItem,
  RegiekamerDecisionOverviewTotals,
} from "./regiekamerDecisionOverview";
import {
  DECISION_UI_PHASE_LABELS,
  DECISION_UI_PHASE_IDS,
  mapApiPhaseToDecisionUiPhase,
  type DecisionUiPhaseId,
} from "./decisionPhaseUi";

/** Regiekamer phase board columns — UI decision phases (doorstroom strip). */
export const REGIEKAMER_FLOW_PHASES = DECISION_UI_PHASE_IDS;

export type RegiekamerFlowPhase = DecisionUiPhaseId;

/** Regiekamer-only labels for horizontal doorstroom (may differ from compact workload chips). */
export const REGIEKAMER_PHASE_BOARD_LABELS: Record<RegiekamerFlowPhase, string> = {
  ...DECISION_UI_PHASE_LABELS,
  in_beoordeling: "Wacht op aanbieder",
};

/** Filter snapshot applied when user clicks an attention chip (matches SystemAwarenessPage state). */
export type RegiekamerListFilter = {
  issue: string;
  phase: string;
  priority: string;
};

export type AttentionSignalId =
  | "no_match"
  | "rejections"
  | "intake_blocked"
  | "weak_matching";

export type AttentionSignal = {
  id: AttentionSignalId;
  label: string;
  count: number;
  filter: RegiekamerListFilter;
};

/**
 * Max 4 actionable attention chips; only non-zero counts.
 * Order: matching urgent → afwijzingen → intake → zwakke match/capaciteit.
 */
export function deriveAttentionSignals(
  items: RegiekamerDecisionOverviewItem[],
  totals: RegiekamerDecisionOverviewTotals,
  noMatchUrgentCount: number,
): AttentionSignal[] {
  const weakMatchingCount = items.filter(
    (i) => i.phase === "matching" && (r(i.risk_count) > 0 || r(i.alert_count) > 0),
  ).length;

  const candidates: AttentionSignal[] = [];

  if (noMatchUrgentCount > 0) {
    candidates.push({
      id: "no_match",
      label: "Matching-urgent",
      count: noMatchUrgentCount,
      filter: { issue: "alerts", phase: "klaar_voor_matching", priority: "all" },
    });
  }
  if (r(totals.repeated_rejections) > 0) {
    candidates.push({
      id: "rejections",
      label: "Meerdere afwijzingen",
      count: r(totals.repeated_rejections),
      filter: { issue: "rejection", phase: "all", priority: "all" },
    });
  }
  if (r(totals.intake_delays) > 0) {
    candidates.push({
      id: "intake_blocked",
      label: "Intake geblokkeerd",
      count: r(totals.intake_delays),
      filter: { issue: "intake", phase: "all", priority: "all" },
    });
  }
  if (weakMatchingCount > 0) {
    candidates.push({
      id: "weak_matching",
      label: "Zwakke match / capaciteit",
      count: weakMatchingCount,
      filter: { issue: "risks", phase: "klaar_voor_matching", priority: "all" },
    });
  }

  return candidates.slice(0, 4);
}

function r(n: number | undefined | null): number {
  return Math.max(0, Math.round(Number(n) || 0));
}

export type PhaseBoardColumn = {
  phase: RegiekamerFlowPhase;
  label: string;
  count: number;
  sample: RegiekamerDecisionOverviewItem[];
};

export function derivePhaseBoard(
  items: RegiekamerDecisionOverviewItem[],
  maxSample = 3,
): PhaseBoardColumn[] {
  return REGIEKAMER_FLOW_PHASES.map((phase) => ({
    phase,
    label: REGIEKAMER_PHASE_BOARD_LABELS[phase],
    count: items.filter((i) => mapApiPhaseToDecisionUiPhase(i.phase) === phase).length,
    sample: items.filter((i) => mapApiPhaseToDecisionUiPhase(i.phase) === phase).slice(0, maxSample),
  }));
}

/** Phase with highest case volume (for bottleneck highlight). */
export function getDominantPhaseColumn(columns: PhaseBoardColumn[]): PhaseBoardColumn | null {
  if (columns.length === 0) {
    return null;
  }
  const max = Math.max(...columns.map((c) => c.count));
  if (max <= 0) {
    return null;
  }
  return columns.reduce((best, col) => (col.count > best.count ? col : best), columns[0]);
}
