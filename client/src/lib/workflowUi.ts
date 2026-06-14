import type { CasusAction, CasusSignal, CasusTimelineEvent, ComputedCaseState } from "./phaseEngine";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";
import { CARE_TERMS } from "./terminology";
import {
  canRoleExecuteAction,
  isCanonicalWorkflowState,
  type CanonicalWorkflowAction,
  type CanonicalWorkflowState,
} from "./workflowStateMachine";
import { getShortReasonLabel } from "./uxCopy";
import {
  deriveListMatchingAdvisory,
  signalSeverityForAdvisoryLabel,
  type MatchingAdvisoryAssessment,
} from "./matchingAdvisory";

/**
 * WORKFLOW UI TRUTH (temporary heuristics — list surfaces only)
 *
 * - **Authority:** persisted `workflow_state` + `/care/api/cases/{id}/decision-evaluation/` on case detail.
 * - **This module** builds queue/board views from `SpaCase` when batch evaluation is unavailable.
 * - **Not fabricated:** match fit % on lists; use `matchingAdvisory.ts` + case `decision-evaluation`.
 * - **Explicit fallbacks:** `resolveBoardColumnWithFallback` when `workflow_state` is missing on legacy payloads.
 * - **Placement rows:** `effectivePlacementCanonicalState` when snapshots omit state (see function docs).
 */

/**
 * Detects whether a primary-action label indicates a system-driven samenvatting
 * processing state. Recognizes both legacy ("Wacht op samenvatting") and current
 * ("Samenvatting wordt verwerkt") phrasings so callers stay backwards-compatible.
 */
function isSummaryProcessingLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return lower.includes("samenvatting wordt verwerkt") || lower.includes("wacht op samenvatting");
}

export type WorkflowBoardColumn =
  | "casus"
  | "samenvatting"
  | "matching"
  | "gemeente-validatie"
  | "aanbieder-beoordeling"
  | "plaatsing"
  | "intake";

export type WorkflowDecisionBadgeTone = "critical" | "warning" | "info" | "good" | "neutral";

export interface WorkflowDecisionBadgeView {
  label: string;
  tone: WorkflowDecisionBadgeTone;
}

export interface WorkflowCaseView {
  id: string;
  title: string;
  clientLabel: string;
  clientAge: number;
  careType: string;
  region: string;
  municipality: string;
  lastUpdatedLabel: string;
  urgency: SpaCase["urgency"];
  urgencyLabel: string;
  placementPressureBand: SpaCase["placementPressureBand"];
  placementPressureLabel: SpaCase["placementPressureLabel"];
  placementPressureReason: SpaCase["placementPressureReason"];
  placementPressureImplication: SpaCase["placementPressureImplication"];
  phase: SpaCase["status"];
  phaseLabel: string;
  boardColumn: WorkflowBoardColumn;
  boardColumnLabel: string;
  currentPhaseLabel: string;
  daysInCurrentPhase: number;
  tags: string[];
  nextBestAction: string;
  nextBestActionLabel: string;
  nextBestActionUrl: "casussen" | "beoordelingen" | "matching" | "plaatsingen" | "intake";
  isBlocked: boolean;
  blockReason: string | null;
  readyForMatching: boolean;
  readyForPlacement: boolean;
  recommendedProvidersCount: number;
  recommendedProviderName: string | null;
  intakeDateLabel: string | null;
  placementStatusLabel: string;
  workflowState: ComputedCaseState;
  /** Backend canonical state when present; drives placement sub-steps (confirm vs plan intake). */
  canonicalWorkflowState: CanonicalWorkflowState | null;
  summarySnippet: string;
  whyInThisStep: string;
  responsibleParty: string;
  primaryActionLabel: string;
  primaryActionEnabled: boolean;
  primaryActionReason: string | null;
  decisionBadges: WorkflowDecisionBadgeView[];
  missingDataItems: string[];
  /** Operational advisory label (no fabricated %). */
  matchConfidenceLabel: string | null;
  matchAdvisoryHint: string | null;
  /** @deprecated Always null — kept for type compatibility; do not render as %. */
  matchConfidenceScore: number | null;
  providerStatusLabel: string | null;
  providerStatusTone: WorkflowDecisionBadgeTone | null;
  waitlistBucket: number;
  urgencyGrantedDate: string | null;
  urgencyApplied?: boolean;
  urgencyAppliedSince?: string | null;
  intakeStartDate: string | null;
  /** Intake arrangement metadata (legacy/missing workflow_state inference). */
  arrangementTypeCode: string;
  arrangementProvider: string;
  arrangementEndDate: string | null;
  placementRequestStatus: string | null;
  placementProviderResponseStatus: string | null;
  zorgbehoefteCategorie?: string;
  zorgbehoefteCategorieCode?: string;
  zorgbehoefteSpecifiek?: string;
  zorgbehoefteSpecifiekCode?: string;
  taxonomieLijn?: string;
  taxonomieCodeLijn?: string;
}

export type CaseDecisionRole = "gemeente" | "zorgaanbieder" | "admin";
export type CaseDecisionSeverity = "critical" | "warning" | "info" | "good" | "neutral";
export type CaseResponsibleParty = "Gemeente" | "Zorgaanbieder" | "Systeem";

export interface CaseDecisionSecondaryAction {
  label: string;
  route: WorkflowCaseView["nextBestActionUrl"];
}

export interface CaseDecisionState {
  phaseLabel: string;
  statusLabel: string;
  responsibleParty: CaseResponsibleParty;
  severity: CaseDecisionSeverity;
  whyHere: string;
  nextActionLabel: string;
  nextActionRoute: WorkflowCaseView["nextBestActionUrl"];
  primaryActionEnabled: boolean;
  blockedReason: string | null;
  secondaryActions: CaseDecisionSecondaryAction[];
  requiresCurrentUserAction: boolean;
  providerReviewActions: string[];
}

function stableAge(seed: string): number {
  const digitTotal = seed
    .split("")
    .reduce((total, char) => total + (Number.isNaN(Number(char)) ? char.charCodeAt(0) : Number(char)), 0);
  return 10 + (digitTotal % 8);
}

function urgencyLabel(urgency: SpaCase["urgency"]): string {
  switch (urgency) {
    case "critical":
      return "Kritiek";
    case "warning":
      return "Hoog";
    case "normal":
      return "Normaal";
    default:
      return "Laag";
  }
}

function placementPressureLabel(band: SpaCase["placementPressureBand"], fallbackUrgency: SpaCase["urgency"]): string {
  if (band === "critical") {
    return "Spoed";
  }
  if (band === "high") {
    return "Hoog";
  }
  if (band === "normal") {
    return "Normaal";
  }
  if (band === "low") {
    return "Laag";
  }
  return urgencyLabel(fallbackUrgency);
}

function placementPressureTone(band: SpaCase["placementPressureBand"]): WorkflowDecisionBadgeTone {
  switch (band) {
    case "critical":
      return "critical";
    case "high":
      return "warning";
    case "normal":
      return "info";
    case "low":
      return "good";
    default:
      return "neutral";
  }
}

function boardColumnLabel(column: WorkflowBoardColumn): string {
  switch (column) {
    case "casus":
      return CARE_TERMS.workflow.casus;
    case "samenvatting":
      return CARE_TERMS.workflow.samenvatting;
    case "matching":
      return CARE_TERMS.workflow.matching;
    case "gemeente-validatie":
      return CARE_TERMS.workflow.gemeenteValidatie;
    case "aanbieder-beoordeling":
      return CARE_TERMS.workflow.aanbiederBeoordeling;
    case "plaatsing":
      return CARE_TERMS.workflow.plaatsing;
    case "intake":
      return CARE_TERMS.workflow.intake;
  }
}

function nextActionTarget(column: WorkflowBoardColumn): WorkflowCaseView["nextBestActionUrl"] {
  switch (column) {
    case "matching":
    case "gemeente-validatie":
      return "matching";
    case "aanbieder-beoordeling":
      return "beoordelingen";
    case "plaatsing":
      return "plaatsingen";
    case "intake":
      return "intake";
    default:
      return "casussen";
  }
}

function buildTags(spaCase: SpaCase): string[] {
  const taxonomyTags = [
    spaCase.zorgbehoefteCategorie,
    spaCase.zorgbehoefteSpecifiek,
    spaCase.taxonomieLijn,
    spaCase.taxonomieCodeLijn,
  ];
  const tags = [spaCase.zorgtype, ...taxonomyTags, ...spaCase.problems.map((problem) => problem.label)]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(tags)).slice(0, 4);
}

function buildMissingDataItems(spaCase: SpaCase): string[] {
  const missing: string[] = [];

  if (!spaCase.urgencyValidated) {
    missing.push(spaCase.urgencyApplied ? "Urgentieverklaring aangevraagd" : "Urgentie is nog niet gevalideerd");
  }

  if (!spaCase.urgencyDocumentPresent) {
    missing.push("Onderbouwing of intakebijlage ontbreekt");
  }

  if (!spaCase.regio || spaCase.regio === "—") {
    missing.push("Regio ontbreekt");
  }

  return missing;
}

function buildSummarySnippet(spaCase: SpaCase, missingDataItems: string[]): string {
  const insight = spaCase.systemInsight.trim();

  if (insight) {
    return insight.length > 120 ? `${insight.slice(0, 117).trim()}...` : insight;
  }

  const pressureLabel = placementPressureLabel(spaCase.placementPressureBand, spaCase.urgency);
  const pressureReason = (spaCase.placementPressureReason || "").trim();
  const parts = [
    `${spaCase.zorgtype || "Zorgvraag"} · ${spaCase.regio || "Onbekende regio"}.`,
    spaCase.placementPressureReason
      ? `Plaatsingsdruk: ${pressureLabel.toLowerCase()}.`
      : `Urgentie: ${urgencyLabel(spaCase.urgency).toLowerCase()}.`,
    pressureReason ? pressureReason : "",
    missingDataItems.length > 0
      ? `Nog ${missingDataItems.length} punt${missingDataItems.length === 1 ? "" : "en"} nodig.`
      : "Zoek passende zorgcapaciteit.",
  ];

  return parts.filter(Boolean).join(" ");
}

function buildRegionalMatches(spaCase: SpaCase, providers: SpaProvider[]): SpaProvider[] {
  const normalizedRegion = (spaCase.regio || "").trim().toLowerCase();
  const regionMatches = providers.filter((provider) => {
    const labels = [provider.region, provider.city, provider.regionLabel, provider.municipalityLabel, ...provider.allRegionLabels]
      .filter(Boolean)
      .map((value) => value.trim().toLowerCase());

    return normalizedRegion.length > 0 && labels.includes(normalizedRegion);
  });

  const candidates = regionMatches.length > 0 ? regionMatches : providers;

  return candidates
    .filter((provider) => provider.availableSpots >= 0)
    .sort((left, right) => right.availableSpots - left.availableSpots || left.averageWaitDays - right.averageWaitDays);
}

function buildMatchingAdvisory(
  boardColumn: WorkflowBoardColumn,
  spaCase: SpaCase,
  providerCount: number,
  summaryAvailable: boolean,
  isBlocked: boolean,
): MatchingAdvisoryAssessment | null {
  return deriveListMatchingAdvisory({
    boardColumn,
    providerCount,
    urgency: spaCase.urgency,
    summaryAvailable,
    isBlocked,
  });
}

function boardColumnFromWorkflowState(workflowState: CanonicalWorkflowState): WorkflowBoardColumn {
  switch (workflowState) {
    case "WIJKTEAM_INTAKE":
    case "ZORGVRAAG_BEOORDELING":
    case "DRAFT_CASE":
      return "casus";
    case "SUMMARY_READY":
      return "samenvatting";
    case "MATCHING_READY":
      return "matching";
    case "GEMEENTE_VALIDATED":
      return "gemeente-validatie";
    case "PROVIDER_REVIEW_PENDING":
      return "aanbieder-beoordeling";
    case "PROVIDER_ACCEPTED":
    case "BUDGET_REVIEW_PENDING":
    case "PLACEMENT_CONFIRMED":
      return "plaatsing";
    case "INTAKE_STARTED":
    case "ACTIVE_PLACEMENT":
    case "ARCHIVED":
      return "intake";
    case "PROVIDER_REJECTED":
      return "matching";
  }
}

function resolveBoardColumnWithFallback(spaCase: SpaCase, missingDataItems: string[]): WorkflowBoardColumn {
  // Temporary fallback for legacy/mock payloads that still lack workflow_state.
  if (spaCase.workflowState && isCanonicalWorkflowState(spaCase.workflowState)) {
    return boardColumnFromWorkflowState(spaCase.workflowState);
  }

  // Legacy heuristic path (kept explicit until all clients/mock data include workflow_state).
  switch (spaCase.status) {
    case "matching":
      return spaCase.urgencyValidated ? "gemeente-validatie" : "matching";
    case "provider_beoordeling":
      return "aanbieder-beoordeling";
    case "plaatsing":
      return "plaatsing";
    case "afgerond":
      return "intake";
    case "intake":
    default:
      return missingDataItems.length > 0 ? "casus" : "samenvatting";
  }
}

function resolveCurrentPhaseLabel(spaCase: SpaCase, column: WorkflowBoardColumn, summaryAvailable: boolean): string {
  if (column === "samenvatting") {
    return summaryAvailable ? `${CARE_TERMS.workflow.samenvatting} vastgelegd` : `${CARE_TERMS.workflow.samenvatting} wordt verwerkt`;
  }

  switch (column) {
    case "casus":
      return "Basisgegevens";
    case "matching":
      return "Matchopties";
    case "gemeente-validatie":
      return CARE_TERMS.workflow.gemeenteValidatie;
    case "aanbieder-beoordeling":
      return CARE_TERMS.workflow.aanbiederBeoordeling;
    case "plaatsing":
      return CARE_TERMS.workflow.plaatsing;
    case "intake":
      return spaCase.status === "afgerond"
        ? `${CARE_TERMS.workflow.intake} afgerond`
        : `${CARE_TERMS.workflow.intake} uitvoeren`;
  }
}

function resolveResponsibility(column: WorkflowBoardColumn): string {
  switch (column) {
    case "aanbieder-beoordeling":
    case "intake":
      return CARE_TERMS.roles.zorgaanbieder;
    case "gemeente-validatie":
      return CARE_TERMS.roles.gemeente;
    default:
      return CARE_TERMS.roles.aanmelder;
  }
}

function resolveProviderStatusLabel(column: WorkflowBoardColumn, providerName: string | null): { label: string | null; tone: WorkflowDecisionBadgeTone | null } {
  switch (column) {
    case "aanbieder-beoordeling":
      return { label: providerName ? "Verstuurd" : "Nog niet verstuurd", tone: providerName ? "warning" : "neutral" };
    case "plaatsing":
    case "intake":
      return { label: "Geaccepteerd", tone: "good" };
    default:
      return { label: null, tone: null };
  }
}

function resolveWhyInThisStep(
  spaCase: SpaCase,
  column: WorkflowBoardColumn,
  missingDataItems: string[],
  summaryAvailable: boolean,
  providerCount: number,
): string {
  switch (column) {
    case "casus":
      return missingDataItems.length > 0
        ? getShortReasonLabel(missingDataItems[0])
        : "Klaar voor samenvatting";
    case "samenvatting":
      return summaryAvailable
        ? "Samenvatting gereed"
        : "Samenvatting wordt verwerkt";
    case "matching":
      return providerCount > 0
        ? `${providerCount} matchvoorstel${providerCount === 1 ? "" : "len"} klaar voor validatie`
        : "Nog geen matchvoorstel";
    case "gemeente-validatie":
      return providerCount > 0
        ? "Gemeente moet matchvoorstel valideren"
        : "Wacht op matchvoorstel";
    case "aanbieder-beoordeling":
      return "Wacht op beoordeling";
    case "plaatsing":
      return "Wacht op bevestiging";
    case "intake":
      return spaCase.status === "afgerond"
        ? "Intake afgerond"
        : "Intake volgt";
  }
}

function resolvePrimaryAction(
  column: WorkflowBoardColumn,
  summaryAvailable: boolean,
  providerCount: number,
  hasMissingData: boolean,
): { label: string; enabled: boolean; reason: string | null } {
  switch (column) {
    case "casus":
      if (hasMissingData) {
        return { label: "Vul casus aan", enabled: true, reason: null };
      }
      return summaryAvailable
        ? { label: "Start matching", enabled: true, reason: null }
        : { label: "Samenvatting wordt verwerkt", enabled: false, reason: null };
    case "samenvatting":
      return summaryAvailable
        ? { label: "Bevestig", enabled: true, reason: null }
        : { label: "Samenvatting wordt verwerkt", enabled: false, reason: null };
    case "matching":
      return providerCount > 0
        ? { label: "Controleer matchadvies", enabled: true, reason: null }
        : { label: "Start matching", enabled: false, reason: "Geen passend aanbod voor advies" };
    case "gemeente-validatie":
      return providerCount > 0
        ? { label: "Valideer match en stuur door", enabled: true, reason: null }
        : { label: "Valideer en stuur door", enabled: false, reason: "Geen voorstel om te valideren" };
    case "aanbieder-beoordeling":
      return { label: "Opvolgen", enabled: true, reason: null };
    case "plaatsing":
      return { label: "Bevestig", enabled: true, reason: null };
    case "intake":
      return { label: "Open intake", enabled: true, reason: null };
  }
}

function buildDecisionBadges(
  spaCase: SpaCase,
  column: WorkflowBoardColumn,
  missingDataItems: string[],
  summaryAvailable: boolean,
  matchAdvisory: MatchingAdvisoryAssessment | null,
  providerStatus: { label: string | null; tone: WorkflowDecisionBadgeTone | null },
): WorkflowDecisionBadgeView[] {
  const badges: WorkflowDecisionBadgeView[] = [];

  if (column === "samenvatting") {
    if (spaCase.placementPressureBand) {
      badges.push({ label: `Plaatsingsdruk ${placementPressureLabel(spaCase.placementPressureBand, spaCase.urgency)}`, tone: placementPressureTone(spaCase.placementPressureBand) });
    }
    if (missingDataItems.length > 0) {
      badges.push({ label: "Info ontbreekt", tone: spaCase.urgency === "critical" ? "critical" : "warning" });
    }
    if (spaCase.urgency === "critical" || spaCase.urgency === "warning") {
      badges.push({ label: "Risico", tone: spaCase.urgency === "critical" ? "critical" : "warning" });
    }
    if (summaryAvailable && missingDataItems.length === 0) {
      badges.push({ label: "Klaar", tone: "good" });
    }
  }

  if (column === "casus" && missingDataItems.length > 0) {
    badges.push({ label: `${missingDataItems.length} open`, tone: "warning" });
  }

  if (matchAdvisory) {
    badges.push({ label: matchAdvisory.label, tone: matchAdvisory.tone });
  }

  if (providerStatus.label && providerStatus.tone) {
    badges.push({ label: providerStatus.label, tone: providerStatus.tone });
  }

  if (spaCase.problems.some((problem) => problem.type === "delayed")) {
    badges.push({ label: "Wachttijd", tone: spaCase.urgency === "critical" ? "critical" : "warning" });
  }

  if (spaCase.urgencyApplied && !spaCase.urgencyValidated) {
    badges.push({ label: "Urgentie aangevraagd", tone: spaCase.urgency === "critical" ? "critical" : "warning" });
  }

  if (!badges.some((badge) => badge.label.startsWith("Plaatsingsdruk")) && spaCase.placementPressureBand) {
    badges.push({ label: `Plaatsingsdruk ${placementPressureLabel(spaCase.placementPressureBand, spaCase.urgency)}`, tone: placementPressureTone(spaCase.placementPressureBand) });
  }

  return badges.slice(0, 4);
}

function buildSignals(
  spaCase: SpaCase,
  item: Pick<WorkflowCaseView, "id" | "blockReason" | "matchConfidenceLabel" | "matchAdvisoryHint" | "providerStatusLabel" | "missingDataItems" | "boardColumn" | "daysInCurrentPhase">,
): CasusSignal[] {
  const signals: CasusSignal[] = [];

  if (item.missingDataItems.length > 0) {
    signals.push({
      id: `${item.id}-missing-data`,
      type: "risico",
      severity: "warning",
      title: "Info ontbreekt",
      description: item.missingDataItems.slice(0, 2).map((value) => getShortReasonLabel(value)).join(" · "),
      isResolved: false,
    });
  }

  if (item.boardColumn === "matching" && item.matchConfidenceLabel) {
    signals.push({
      id: `${item.id}-match-advisory`,
      type: "matching",
      severity: signalSeverityForAdvisoryLabel(item.matchConfidenceLabel),
      title: item.matchConfidenceLabel,
      description: item.matchAdvisoryHint ?? "Advies controleren en voorbereiden voor gemeentevalidatie.",
      isResolved: false,
    });
  }

  if (item.providerStatusLabel === "Verstuurd") {
    signals.push({
      id: `${item.id}-provider-pending`,
      type: "aanbieder",
      severity: item.daysInCurrentPhase > 7 ? "warning" : "info",
      title: "Reactie open",
      description: "Wacht op reactie.",
      isResolved: false,
    });
  }

  if (spaCase.placementPressureBand === "high" || spaCase.placementPressureBand === "critical") {
    signals.push({
      id: `${item.id}-placement-pressure`,
      type: "matching",
      severity: spaCase.placementPressureBand === "critical" ? "critical" : "warning",
      title: `Plaatsingsdruk ${placementPressureLabel(spaCase.placementPressureBand, spaCase.urgency)}`,
      description: spaCase.placementPressureReason ?? spaCase.placementPressureImplication ?? "Versnelde opvolging nodig.",
      isResolved: false,
    });
  }

  if (item.blockReason) {
    signals.push({
      id: `${item.id}-blocked`,
      type: "matching",
      severity: "critical",
      title: "Geblokkeerd",
      description: getShortReasonLabel(item.blockReason),
      isResolved: false,
    });
  }

  if (spaCase.problems.some((problem) => problem.type === "delayed")) {
    signals.push({
      id: `${item.id}-delay`,
      type: "wachttijd",
      severity: spaCase.urgency === "critical" ? "critical" : "warning",
      title: "Wachttijd loopt op",
      description: `Al ${spaCase.wachttijd} dagen vast.`,
      isResolved: false,
    });
  }

  return signals;
}

function buildTimeline(
  item: Pick<WorkflowCaseView, "id" | "boardColumnLabel" | "primaryActionLabel" | "responsibleParty" | "daysInCurrentPhase">,
): CasusTimelineEvent[] {
  return [
    {
      id: `${item.id}-created`,
      type: "created",
      label: "Aangemaakt",
      actorName: "Gemeente",
      actorRole: "gemeente",
      date: `${Math.max(item.daysInCurrentPhase, 1)} d geleden`,
    },
    {
      id: `${item.id}-stage`,
      type: "phase_change",
      label: item.boardColumnLabel,
      actorName: item.responsibleParty,
      actorRole: item.responsibleParty === "Zorgaanbieder" ? "zorgaanbieder" : "gemeente",
      date: `${item.daysInCurrentPhase} d actief`,
    },
    {
      id: `${item.id}-action`,
      type: "action",
      label: item.primaryActionLabel,
      actorName: item.responsibleParty,
      actorRole: item.responsibleParty === "Zorgaanbieder" ? "zorgaanbieder" : "gemeente",
      date: "Nu",
    },
  ];
}

function buildWorkflowState(
  spaCase: SpaCase,
  item: Pick<WorkflowCaseView, "id" | "whyInThisStep" | "primaryActionLabel" | "responsibleParty" | "blockReason" | "boardColumnLabel" | "daysInCurrentPhase" | "matchConfidenceLabel" | "providerStatusLabel" | "missingDataItems" | "boardColumn">,
): ComputedCaseState {
  // @ts-ignore
  const signals = buildSignals(spaCase, item);
  const timelineEvents = buildTimeline(item);
  const allowedActions: CasusAction[] = [
    {
      id: `${item.id}-primary-action`,
      // @ts-ignore
      type: item.boardColumn === "matching"
        ? "start_matching"
        : item.boardColumn === "gemeente-validatie"
          ? "review_matching"
        : item.boardColumn === "aanbieder-beoordeling"
          ? "follow_up_provider"
          : item.boardColumn === "plaatsing"
            ? "verstuur_plaatsingsverzoek"
            : item.boardColumn === "intake"
              ? "plan_intake"
              : "edit_basisgegevens",
      label: item.primaryActionLabel,
      priority: "primary",
      assignedTo: item.responsibleParty,
      dueAt: null,
    },
  ];

  return {
    nextAction: item.primaryActionLabel,
    nextActionDetail: item.whyInThisStep,
    decisionType: item.blockReason ? "critical" : spaCase.urgency === "critical" ? "warning" : "action",
    signals,
    allowedActions,
    timelineEvents,
    blockerReason: item.blockReason,
    isReadOnly: false,
  };
}

export function buildWorkflowCase(spaCase: SpaCase, providers: SpaProvider[] = []): WorkflowCaseView {
  const regionalMatches = buildRegionalMatches(spaCase, providers);
  const firstProvider = regionalMatches[0] ?? null;
  const missingDataItems = buildMissingDataItems(spaCase);
  const summaryAvailable = Boolean(spaCase.systemInsight.trim());
  const boardColumn = resolveBoardColumnWithFallback(spaCase, missingDataItems);
  const label = boardColumnLabel(boardColumn);
  const providerStatus = resolveProviderStatusLabel(boardColumn, firstProvider?.name ?? null);
  const whyInThisStep = resolveWhyInThisStep(spaCase, boardColumn, missingDataItems, summaryAvailable, regionalMatches.length);
  const primaryAction = resolvePrimaryAction(boardColumn, summaryAvailable, regionalMatches.length, missingDataItems.length > 0);
  const isBlocked = !primaryAction.enabled || (boardColumn === "casus" && missingDataItems.length > 0);
  const blockReason = !primaryAction.enabled
    ? primaryAction.reason
    : boardColumn === "casus"
      ? missingDataItems[0] ?? null
      : null;
  const matchAdvisory = buildMatchingAdvisory(
    boardColumn,
    spaCase,
    regionalMatches.length,
    summaryAvailable,
    isBlocked,
  );

  const view: WorkflowCaseView = {
    id: spaCase.id,
    title: spaCase.title,
    clientLabel: spaCase.title || `Casus ${spaCase.id.slice(-4)}`,
    clientAge: stableAge(spaCase.id),
    careType: spaCase.zorgtype,
    region: spaCase.regio || "Onbekend",
    municipality: spaCase.regio || "Onbekend",
    lastUpdatedLabel: spaCase.wachttijd === 0 ? "Vandaag" : `${spaCase.wachttijd} dag${spaCase.wachttijd === 1 ? "" : "en"} geleden`,
    urgency: spaCase.urgency,
    urgencyLabel: urgencyLabel(spaCase.urgency),
    placementPressureBand: spaCase.placementPressureBand,
    placementPressureLabel: spaCase.placementPressureLabel,
    placementPressureReason: spaCase.placementPressureReason,
    placementPressureImplication: spaCase.placementPressureImplication,
    phase: spaCase.status,
    phaseLabel: label,
    boardColumn,
    boardColumnLabel: label,
    currentPhaseLabel: resolveCurrentPhaseLabel(spaCase, boardColumn, summaryAvailable),
    daysInCurrentPhase: spaCase.wachttijd,
    tags: buildTags(spaCase),
    nextBestAction: primaryAction.label,
    nextBestActionLabel: primaryAction.label,
    nextBestActionUrl: nextActionTarget(boardColumn),
    isBlocked,
    blockReason,
    readyForMatching: boardColumn === "matching",
    readyForPlacement: boardColumn === "plaatsing",
    recommendedProvidersCount: regionalMatches.length,
    recommendedProviderName: firstProvider?.name ?? null,
    intakeDateLabel: boardColumn === "intake"
      ? (spaCase.intakeStartDate ?? "Intake in uitvoering of afgerond")
      : boardColumn === "plaatsing"
        ? "Plan intake na bevestiging"
        : null,
    placementStatusLabel: boardColumn === "plaatsing"
      ? "Wacht op bevestiging"
      : boardColumn === "intake"
        ? "Overgedragen aan intake"
        : "Nog niet gestart",
    workflowState: {} as ComputedCaseState,
    canonicalWorkflowState:
      spaCase.workflowState && isCanonicalWorkflowState(spaCase.workflowState) ? spaCase.workflowState : null,
    summarySnippet: buildSummarySnippet(spaCase, missingDataItems),
    whyInThisStep,
    responsibleParty: resolveResponsibility(boardColumn),
    primaryActionLabel: primaryAction.label,
    primaryActionEnabled: primaryAction.enabled,
    primaryActionReason: primaryAction.reason,
    decisionBadges: buildDecisionBadges(spaCase, boardColumn, missingDataItems, summaryAvailable, matchAdvisory, providerStatus),
    missingDataItems,
    matchConfidenceLabel: matchAdvisory?.label ?? null,
    matchAdvisoryHint: matchAdvisory?.hint ?? null,
    matchConfidenceScore: null,
    providerStatusLabel: providerStatus.label,
    providerStatusTone: providerStatus.tone,
    waitlistBucket: spaCase.waitlistBucket,
    urgencyGrantedDate: spaCase.urgencyGrantedDate,
    urgencyApplied: spaCase.urgencyApplied,
    urgencyAppliedSince: spaCase.urgencyAppliedSince,
    intakeStartDate: spaCase.intakeStartDate,
    arrangementTypeCode: spaCase.arrangementTypeCode ?? "",
    arrangementProvider: spaCase.arrangementProvider ?? "",
    arrangementEndDate: spaCase.arrangementEndDate ?? null,
    placementRequestStatus: spaCase.placementRequestStatus ?? null,
    placementProviderResponseStatus: spaCase.placementProviderResponseStatus ?? null,
    zorgbehoefteCategorie: spaCase.zorgbehoefteCategorie ?? "",
    zorgbehoefteCategorieCode: spaCase.zorgbehoefteCategorieCode ?? "",
    zorgbehoefteSpecifiek: spaCase.zorgbehoefteSpecifiek ?? "",
    zorgbehoefteSpecifiekCode: spaCase.zorgbehoefteSpecifiekCode ?? "",
    taxonomieLijn: spaCase.taxonomieLijn ?? "",
    taxonomieCodeLijn: spaCase.taxonomieCodeLijn ?? "",
  };

  view.workflowState = buildWorkflowState(spaCase, view);

  return view;
}

export function buildWorkflowCases(spaCases: SpaCase[], providers: SpaProvider[] = []): WorkflowCaseView[] {
  return spaCases.map((spaCase) => buildWorkflowCase(spaCase, providers));
}

/**
 * Effective canonical sub-step for placement rows when API omits workflow_state but intake
 * carries arrangement metadata or latest PlacementRequest snapshot (API mirrors derive_workflow_state).
 */
export function effectivePlacementCanonicalState(item: WorkflowCaseView): CanonicalWorkflowState | null {
  if (item.canonicalWorkflowState) return item.canonicalWorkflowState;
  if (item.phase !== "plaatsing") return null;
  const end = item.arrangementEndDate?.trim();
  if (end) return "PLACEMENT_CONFIRMED";
  const prs = item.placementRequestStatus?.trim();
  if (prs === "APPROVED") return "PLACEMENT_CONFIRMED";
  const prrs = item.placementProviderResponseStatus?.trim();
  if (prrs === "ACCEPTED") return "PROVIDER_ACCEPTED";
  return null;
}

/** Tab bucket aligned with row sub-step (canonical, arrangement, placement snapshot), not raw day count alone. */
export type PlacementTrackingBucket = "te-bevestigen" | "lopend" | "afgerond";

export function placementTrackingTabBucket(item: WorkflowCaseView): PlacementTrackingBucket {
  if (item.phase === "afgerond") return "afgerond";
  const eff = effectivePlacementCanonicalState(item);
  if (eff === "PLACEMENT_CONFIRMED") return "lopend";
  if (eff === "PROVIDER_ACCEPTED") return "te-bevestigen";
  return item.daysInCurrentPhase <= 2 ? "te-bevestigen" : "lopend";
}

/** Plaatsing row has no workflow/arrangement/placement snapshot — CTA is heuristic; user should verify in dossier. */
export function placementTrackingSubstepAmbiguous(item: WorkflowCaseView): boolean {
  return item.phase === "plaatsing" && effectivePlacementCanonicalState(item) === null;
}

/** Row status on placement tracking (per case, not the active tab filter). */
export function placementTrackingRowStatusLabel(item: WorkflowCaseView): string {
  if (item.phase === "afgerond") return "Afgerond";
  if (item.phase !== "plaatsing") return item.phaseLabel;
  const canonical = effectivePlacementCanonicalState(item);
  if (canonical === "PLACEMENT_CONFIRMED") return "Lopend";
  if (canonical === "PROVIDER_ACCEPTED") return "Te bevestigen";
  return item.daysInCurrentPhase <= 2 ? "Te bevestigen" : "Lopend";
}

/** Row CTA for placement tracking from workflow state (with days fallback when canonical state is missing). */
export function placementTrackingRowAction(item: WorkflowCaseView): {
  actionLabel: string;
  actionVariant: "primary" | "ghost";
} {
  if (item.phase === "afgerond") {
    return { actionLabel: "Bekijk afronding", actionVariant: "ghost" };
  }
  if (item.phase !== "plaatsing") {
    return {
      actionLabel: item.primaryActionLabel,
      actionVariant: item.primaryActionEnabled && !item.isBlocked ? "primary" : "ghost",
    };
  }
  const canonical = effectivePlacementCanonicalState(item);
  const label =
    canonical === "PLACEMENT_CONFIRMED"
      ? "Plan intake"
      : canonical === "PROVIDER_ACCEPTED"
        ? "Bevestig plaatsing"
        : item.daysInCurrentPhase <= 2
          ? "Bevestig plaatsing"
          : "Plan intake";
  return {
    actionLabel: label,
    actionVariant: item.primaryActionEnabled && !item.isBlocked ? "primary" : "ghost",
  };
}

function isRoleResponsible(party: CaseResponsibleParty, role: CaseDecisionRole): boolean {
  const partyAction: CanonicalWorkflowAction = party === "Zorgaanbieder" ? "provider_request_info" : "complete_summary";
  return canRoleExecuteAction(role, partyAction);
}

export function getCaseDecisionState(item: WorkflowCaseView, userRole: CaseDecisionRole): CaseDecisionState {
  const statusLabel = item.currentPhaseLabel;
  let responsibleParty: CaseResponsibleParty = item.responsibleParty === "Zorgaanbieder" ? "Zorgaanbieder" : "Gemeente";
  let nextActionLabel = item.primaryActionLabel;
  let nextActionRoute: WorkflowCaseView["nextBestActionUrl"] = item.nextBestActionUrl;
  let secondaryActions: CaseDecisionSecondaryAction[] = [
    { label: "Bekijk detail", route: "casussen" },
    { label: "Historie", route: "casussen" },
    { label: "Documenten", route: "casussen" },
  ];
  let providerReviewActions: string[] = [];
  let requiredAction: CanonicalWorkflowAction = "complete_summary";

  switch (item.boardColumn) {
    case "casus":
      responsibleParty = "Gemeente";
      nextActionLabel = item.missingDataItems.length > 0
        ? "Vul casus aan"
        : isSummaryProcessingLabel(item.primaryActionLabel)
          ? "Samenvatting wordt verwerkt"
          : "Start matching";
      nextActionRoute = "casussen";
      requiredAction = "complete_summary";
      break;
    case "samenvatting":
      responsibleParty = isSummaryProcessingLabel(item.primaryActionLabel) ? "Systeem" : "Gemeente";
      nextActionLabel = isSummaryProcessingLabel(item.primaryActionLabel) ? "Samenvatting wordt verwerkt" : "Bevestig";
      nextActionRoute = "casussen";
      requiredAction = "complete_summary";
      break;
    case "matching":
      responsibleParty = "Gemeente";
      nextActionLabel = item.recommendedProvidersCount > 0 ? "Controleer matchadvies" : "Start matching";
      nextActionRoute = "matching";
      secondaryActions = [
        { label: "Detail", route: "casussen" },
        { label: "Matching", route: "matching" },
        { label: "Docs", route: "casussen" },
      ];
      requiredAction = "start_matching";
      break;
    case "gemeente-validatie":
      responsibleParty = "Gemeente";
      nextActionLabel = "Valideer matching";
      nextActionRoute = "matching";
      secondaryActions = [
        { label: "Controleer factoren", route: "matching" },
        { label: "Pas voorstel aan", route: "matching" },
        { label: "Start rematch", route: "matching" },
      ];
      requiredAction = "validate_matching";
      break;
    case "aanbieder-beoordeling":
      responsibleParty = "Zorgaanbieder";
      nextActionLabel = userRole === "zorgaanbieder" ? "Beoordeling uitvoeren" : "Bekijk aanbiederreactie";
      nextActionRoute = "beoordelingen";
      secondaryActions = userRole === "zorgaanbieder"
        ? [
            { label: "Accepteren", route: "beoordelingen" },
            { label: "Afwijzen", route: "beoordelingen" },
            { label: "Meer info", route: "beoordelingen" },
          ]
        : [
            { label: "Detail", route: "casussen" },
            { label: "Status", route: "beoordelingen" },
            { label: "Historie", route: "casussen" },
          ];
      providerReviewActions = userRole === "zorgaanbieder" ? ["Accepteren", "Afwijzen", "Meer informatie vragen"] : [];
      requiredAction = "provider_request_info";
      break;
    case "plaatsing":
      responsibleParty = "Gemeente";
      nextActionLabel = "Bevestig plaatsing";
      nextActionRoute = "plaatsingen";
      secondaryActions = [
        { label: "Detail", route: "casussen" },
        { label: "Plaatsing", route: "plaatsingen" },
        { label: "Historie", route: "casussen" },
      ];
      requiredAction = "confirm_placement";
      break;
    case "intake":
      responsibleParty = "Zorgaanbieder";
      nextActionLabel = userRole === "zorgaanbieder" ? "Bereid intake" : "Bekijk intake";
      nextActionRoute = "intake";
      secondaryActions = [
        { label: "Detail", route: "casussen" },
        { label: "Intake", route: "intake" },
        { label: "Historie", route: "casussen" },
      ];
      requiredAction = "start_intake";
      break;
  }

  const severity: CaseDecisionSeverity = item.isBlocked
    ? "critical"
    : item.urgency === "critical"
      ? "critical"
      : item.urgency === "warning"
        ? "warning"
        : item.daysInCurrentPhase > 7
          ? "warning"
          : "info";

  return {
    phaseLabel: item.phaseLabel,
    statusLabel,
    responsibleParty,
    severity,
    whyHere: item.whyInThisStep,
    nextActionLabel,
    nextActionRoute,
    primaryActionEnabled: item.primaryActionEnabled,
    blockedReason: item.blockReason,
    secondaryActions,
    requiresCurrentUserAction: isRoleResponsible(responsibleParty, userRole) && canRoleExecuteAction(userRole, requiredAction),
    providerReviewActions,
  };
}

export function previousStepTarget(page: "beoordelingen" | "matching" | "plaatsingen"): WorkflowCaseView["nextBestActionUrl"] {
  switch (page) {
    case "beoordelingen":
      return "matching";
    case "matching":
      return "casussen";
    case "plaatsingen":
      return "beoordelingen";
  }
}
