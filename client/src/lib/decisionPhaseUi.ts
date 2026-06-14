/**
 * UI-only decision phases (canonical five-phase flow on Coordination doorstroom).
 * Maps from backend/API `phase` strings — no API changes.
 */

import { CARE_TERMS } from "./terminology";

export const DECISION_UI_PHASE_IDS = [
  "aanmelding",
  "matching",
  "aanbiederreactie",
  "plaatsing",
  "intake",
] as const;

export type DecisionUiPhaseId = (typeof DECISION_UI_PHASE_IDS)[number];

const API_PHASE_TO_DECISION: Record<string, DecisionUiPhaseId> = {
  casus_gestart: "aanmelding",
  casus: "aanmelding",
  samenvatting: "aanmelding",
  klaar_voor_matching: "matching",
  matching: "matching",
  gemeente_validatie: "matching",
  /** Legacy filter/URL id — gemeente-validatie valt onder matching-kolom. */
  wacht_op_validatie: "matching",
  in_beoordeling: "aanbiederreactie",
  aanbieder_beoordeling: "aanbiederreactie",
  plaatsing_intake: "plaatsing",
  plaatsing: "plaatsing",
  intake: "intake",
};

export const DECISION_UI_PHASE_LABELS: Record<DecisionUiPhaseId, string> = {
  aanmelding: "Aanmelding",
  matching: "Matching",
  aanbiederreactie: "Aanbiederreactie",
  plaatsing: "Plaatsing",
  intake: "Intake",
};

export const DECISION_WORKSPACE_FLOW_STEPS = [
  { id: "aanmelding" as const, label: "Aanmelding", owner: CARE_TERMS.roles.aanmelder },
  { id: "matching" as const, label: "Matching", owner: CARE_TERMS.roles.gemeente },
  { id: "aanbiederreactie" as const, label: "Aanbiederreactie", owner: CARE_TERMS.roles.zorgaanbieder },
  { id: "plaatsing" as const, label: "Plaatsing", owner: CARE_TERMS.roles.gemeente },
  { id: "intake" as const, label: "Intake", owner: CARE_TERMS.roles.zorgaanbieder },
] as const;

export function normalizeApiPhaseId(phaseId: string): string {
  const trimmed = phaseId.trim();
  if (!trimmed) {
    return "casus";
  }
  return trimmed.includes("-") ? trimmed.replace(/-/g, "_") : trimmed;
}

/**
 * Normalizes `phase` URL query values (Coordination filters, bookmarks).
 * Remaps legacy labels to the canonical five-phase flow. Returns `""` when absent.
 */
export function normalizeCoordinationPhaseQueryParam(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const key = normalizeApiPhaseId(trimmed);
  if (key === "casus_gestart" || key === "casus" || key === "samenvatting") {
    return "aanmelding";
  }
  if (key === "wacht_op_validatie" || key === "gemeente_validatie" || key === "klaar_voor_matching" || key === "matching") {
    return "matching";
  }
  if (key === "in_beoordeling" || key === "aanbieder_beoordeling") {
    return "aanbiederreactie";
  }
  if (key === "plaatsing_intake") {
    return "plaatsing";
  }
  if (key === "plaatsing") {
    return "plaatsing";
  }
  if (key === "intake") {
    return "intake";
  }
  return key;
}

export function mapApiPhaseToDecisionUiPhase(phaseId: string): DecisionUiPhaseId {
  const key = normalizeApiPhaseId(phaseId);
  if (isDecisionUiPhaseId(key)) {
    return key;
  }
  return API_PHASE_TO_DECISION[key] ?? "aanmelding";
}

export function isDecisionUiPhaseId(value: string): value is DecisionUiPhaseId {
  return (DECISION_UI_PHASE_IDS as readonly string[]).includes(value);
}

export function decisionUiPhaseBadgeLabel(id: DecisionUiPhaseId): string {
  return DECISION_UI_PHASE_LABELS[id];
}

export function decisionUiPhaseBadgeShellClass(id: DecisionUiPhaseId): string {
  switch (id) {
    case "aanmelding":
      return "border-border/80 bg-muted/35 text-foreground";
    case "matching":
      return "border-sky-500/40 bg-sky-500/12 text-sky-100";
    case "aanbiederreactie":
      return "border-fuchsia-500/40 bg-fuchsia-500/12 text-fuchsia-100";
    case "plaatsing":
      return "border-emerald-500/40 bg-emerald-500/12 text-emerald-100";
    case "intake":
      return "border-emerald-500/40 bg-emerald-500/12 text-emerald-100";
    default:
      return "border-border/80 bg-muted/35 text-foreground";
  }
}

/** Sub-status for merged buckets (not a top-level phase chip). */
export function canonicalPhaseSubStatusLabel(normalizedApiPhase: string): string | null {
  const key = normalizeApiPhaseId(normalizedApiPhase);
  if (key === "samenvatting") {
    return `${CARE_TERMS.workflow.samenvatting} vastgelegd`;
  }
  if (key === "gemeente_validatie" || key === "wacht_op_validatie") {
    return "Toetsing";
  }
  return null;
}

export function decisionTimelineIndexFromWorkflowState(currentState: string, isArchived: boolean): number {
  if (isArchived) {
    return DECISION_UI_PHASE_IDS.length - 1;
  }
  switch (currentState) {
    case "WIJKTEAM_INTAKE":
    case "ZORGVRAAG_BEOORDELING":
    case "DRAFT_CASE":
    case "SUMMARY_READY":
      return 0;
    case "MATCHING_READY":
    case "GEMEENTE_VALIDATED":
      return 1;
    case "PROVIDER_REVIEW_PENDING":
    case "PROVIDER_ACCEPTED":
    case "BUDGET_REVIEW_PENDING":
    case "PROVIDER_REJECTED":
      return 2;
    case "PLACEMENT_CONFIRMED":
      return 3;
    case "INTAKE_STARTED":
    case "ACTIVE_PLACEMENT":
      return 4;
    default:
      return 0;
  }
}

/** Fallback when `decisionEvaluation.phase` is absent — mirrors coarse workflow progression. */
export function canonicalPhaseFromWorkflowState(currentState: string): string {
  switch (currentState) {
    case "WIJKTEAM_INTAKE":
    case "ZORGVRAAG_BEOORDELING":
    case "DRAFT_CASE":
      return "casus";
    case "SUMMARY_READY":
      return "samenvatting";
    case "MATCHING_READY":
      return "matching";
    case "GEMEENTE_VALIDATED":
      return "gemeente_validatie";
    case "PROVIDER_REVIEW_PENDING":
    case "PROVIDER_ACCEPTED":
    case "BUDGET_REVIEW_PENDING":
    case "PROVIDER_REJECTED":
      return "aanbieder_beoordeling";
    case "PLACEMENT_CONFIRMED":
      return "plaatsing";
    case "INTAKE_STARTED":
    case "ACTIVE_PLACEMENT":
      return "intake";
    default:
      return "casus";
  }
}

export function canonicalPhaseForCaseExecution(args: {
  evaluationPhase?: string | null;
  currentState: string;
}): string {
  const raw = args.evaluationPhase?.trim();
  if (raw) {
    return normalizeApiPhaseId(raw);
  }
  return canonicalPhaseFromWorkflowState(args.currentState);
}

/** Case detail + workspace header — never pass raw `WorkflowState` into `mapApiPhaseToDecisionUiPhase`. */
export function resolveCaseExecutionPhasePresentation(args: {
  evaluationPhase?: string | null;
  currentState: string;
}): {
  apiPhase: string;
  decisionUiPhaseId: DecisionUiPhaseId;
  badgeLabel: string;
  subStatusLabel: string | null;
} {
  const apiPhase = canonicalPhaseForCaseExecution(args);
  const decisionUiPhaseId = mapApiPhaseToDecisionUiPhase(apiPhase);
  return {
    apiPhase,
    decisionUiPhaseId,
    badgeLabel: decisionUiPhaseBadgeLabel(decisionUiPhaseId),
    subStatusLabel: canonicalPhaseSubStatusLabel(apiPhase),
  };
}
