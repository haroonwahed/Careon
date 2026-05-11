/**
 * UI-only decision phases (max 4 on Regiekamer doorstroom). Maps from backend/API `phase` strings — no API changes.
 */

import { CARE_TERMS } from "./terminology";

export const DECISION_UI_PHASE_IDS = [
  "casus_gestart",
  "klaar_voor_matching",
  "in_beoordeling",
  "plaatsing_intake",
] as const;

export type DecisionUiPhaseId = (typeof DECISION_UI_PHASE_IDS)[number];

const API_PHASE_TO_DECISION: Record<string, DecisionUiPhaseId> = {
  casus: "casus_gestart",
  samenvatting: "casus_gestart",
  matching: "klaar_voor_matching",
  gemeente_validatie: "klaar_voor_matching",
  /** Legacy filter/URL id — gemeente-validatie valt onder matching-kolom. */
  wacht_op_validatie: "klaar_voor_matching",
  aanbieder_beoordeling: "in_beoordeling",
  plaatsing: "plaatsing_intake",
  intake: "plaatsing_intake",
};

export const DECISION_UI_PHASE_LABELS: Record<DecisionUiPhaseId, string> = {
  casus_gestart: "Aanmelding & zorgvraag",
  klaar_voor_matching: "Matching & validatie",
  in_beoordeling: "Aanbieder reacties",
  plaatsing_intake: CARE_TERMS.workflow.plaatsingEnIntake,
};

export const DECISION_WORKSPACE_FLOW_STEPS = [
  { id: "casus_gestart" as const, label: "Aanmelding & zorgvraag", owner: CARE_TERMS.roles.aanmelder },
  { id: "klaar_voor_matching" as const, label: "Matching & validatie", owner: CARE_TERMS.roles.aanmelder },
  { id: "in_beoordeling" as const, label: "Aanbieder reacties", owner: CARE_TERMS.roles.zorgaanbieder },
  {
    id: "plaatsing_intake" as const,
    label: CARE_TERMS.workflow.plaatsingEnIntake,
    owner: `${CARE_TERMS.roles.aanmelder} / ${CARE_TERMS.roles.zorgaanbieder}`,
  },
] as const;

export function normalizeApiPhaseId(phaseId: string): string {
  const trimmed = phaseId.trim();
  if (!trimmed) {
    return "casus";
  }
  return trimmed.includes("-") ? trimmed.replace(/-/g, "_") : trimmed;
}

/**
 * Normalizes `phase` URL query values (Regiekamer filters, bookmarks).
 * Remaps legacy `wacht_op_validatie` to `klaar_voor_matching`. Returns `""` when absent.
 */
export function normalizeRegiekamerPhaseQueryParam(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return "";
  }
  const key = normalizeApiPhaseId(trimmed);
  if (key === "wacht_op_validatie") {
    return "klaar_voor_matching";
  }
  return key;
}

export function mapApiPhaseToDecisionUiPhase(phaseId: string): DecisionUiPhaseId {
  const key = normalizeApiPhaseId(phaseId);
  if (isDecisionUiPhaseId(key)) {
    return key;
  }
  return API_PHASE_TO_DECISION[key] ?? "casus_gestart";
}

export function isDecisionUiPhaseId(value: string): value is DecisionUiPhaseId {
  return (DECISION_UI_PHASE_IDS as readonly string[]).includes(value);
}

export function decisionUiPhaseBadgeLabel(id: DecisionUiPhaseId): string {
  return DECISION_UI_PHASE_LABELS[id];
}

export function decisionUiPhaseBadgeShellClass(id: DecisionUiPhaseId): string {
  switch (id) {
    case "casus_gestart":
      return "border-border/80 bg-muted/35 text-foreground";
    case "klaar_voor_matching":
      return "border-sky-500/40 bg-sky-500/12 text-sky-100";
    case "in_beoordeling":
      return "border-fuchsia-500/40 bg-fuchsia-500/12 text-fuchsia-100";
    case "plaatsing_intake":
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
  if (key === "gemeente_validatie") {
    return CARE_TERMS.workflow.gemeenteValidatie;
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
    case "INTAKE_STARTED":
    case "ACTIVE_PLACEMENT":
      return 3;
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
