import type { CasusAction, CasusSignal, CasusTimelineEvent, ComputedCaseState } from "./phaseEngine";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";
import { canRoleExecuteAction, type CanonicalWorkflowAction } from "./workflowStateMachine";
import { getShortReasonLabel } from "./uxCopy";

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
  summarySnippet: string;
  whyInThisStep: string;
  responsibleParty: string;
  primaryActionLabel: string;
  primaryActionEnabled: boolean;
  primaryActionReason: string | null;
  decisionBadges: WorkflowDecisionBadgeView[];
  missingDataItems: string[];
  matchConfidenceLabel: string | null;
  matchConfidenceScore: number | null;
  providerStatusLabel: string | null;
  providerStatusTone: WorkflowDecisionBadgeTone | null;
  waitlistBucket: number;
  urgencyGrantedDate: string | null;
  intakeStartDate: string | null;
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

function boardColumnLabel(column: WorkflowBoardColumn): string {
  switch (column) {
    case "casus":
      return "Casus";
    case "samenvatting":
      return "Samenvatting";
    case "matching":
      return "Matching";
    case "gemeente-validatie":
      return "Gemeente Validatie";
    case "aanbieder-beoordeling":
      return "Beoordeling door aanbieder";
    case "plaatsing":
      return "Plaatsing";
    case "intake":
      return "Intake";
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
  const tags = [spaCase.zorgtype, ...spaCase.problems.map((problem) => problem.label)]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(tags)).slice(0, 3);
}

function buildMissingDataItems(spaCase: SpaCase): string[] {
  const missing: string[] = [];

  if (!spaCase.urgencyValidated) {
    missing.push("Urgentie is nog niet gevalideerd");
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

  const parts = [
    `${spaCase.zorgtype || "Zorgvraag"} · ${spaCase.regio || "Onbekende regio"}.`,
    `Urgentie: ${urgencyLabel(spaCase.urgency).toLowerCase()}.`,
    missingDataItems.length > 0
      ? `Nog ${missingDataItems.length} punt${missingDataItems.length === 1 ? "" : "en"} nodig.`
      : "Klaar voor matching.",
  ];

  return parts.join(" ");
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

function buildMatchConfidence(providerCount: number, urgency: SpaCase["urgency"]): { label: string; score: number; tone: WorkflowDecisionBadgeTone } | null {
  if (providerCount <= 0) {
    return { label: "Fit laag", score: 22, tone: "critical" };
  }

  if (providerCount === 1) {
    return {
      label: urgency === "critical" ? "Fit kwetsbaar" : "Fit middel",
      score: 58,
      tone: urgency === "critical" ? "warning" : "info",
    };
  }

  if (providerCount === 2) {
    return { label: "Fit middel", score: 73, tone: "info" };
  }

  return { label: "Fit sterk", score: 89, tone: "good" };
}

function resolveBoardColumn(spaCase: SpaCase, missingDataItems: string[]): WorkflowBoardColumn {
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
    return summaryAvailable ? "Samenvatting klaar" : "Samenvatting nodig";
  }

  switch (column) {
    case "casus":
      return "Basisgegevens";
    case "matching":
      return "Matchopties";
    case "gemeente-validatie":
      return "Gemeente validatie";
    case "aanbieder-beoordeling":
      return "Aanbieder beoordeelt";
    case "plaatsing":
      return "Plaatsing";
    case "intake":
      return spaCase.status === "afgerond" ? "Intake afgerond" : "Intake uitvoeren";
  }
}

function resolveResponsibility(column: WorkflowBoardColumn): string {
  switch (column) {
    case "aanbieder-beoordeling":
    case "intake":
      return "Zorgaanbieder";
    case "gemeente-validatie":
      return "Gemeente";
    default:
      return "Gemeente";
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
        ? "Samenvatting klaar"
        : "Wacht op samenvatting";
    case "matching":
      return providerCount > 0
        ? `${providerCount} aanbieder${providerCount === 1 ? "" : "s"} klaar`
        : "Nog geen aanbod";
    case "gemeente-validatie":
      return providerCount > 0
        ? "Matchvoorstel wacht op validatie"
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
): { label: string; enabled: boolean; reason: string | null } {
  switch (column) {
    case "casus":
      return { label: "Vul aan", enabled: true, reason: null };
    case "samenvatting":
      return summaryAvailable
        ? { label: "Bevestig", enabled: true, reason: null }
        : { label: "Genereer", enabled: true, reason: null };
    case "matching":
      return providerCount > 0
        ? { label: "Controleer matching", enabled: true, reason: null }
        : { label: "Match", enabled: false, reason: "Geen passend aanbod" };
    case "gemeente-validatie":
      return providerCount > 0
        ? { label: "Valideer en stuur door", enabled: true, reason: null }
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
  matchConfidence: { label: string; score: number; tone: WorkflowDecisionBadgeTone } | null,
  providerStatus: { label: string | null; tone: WorkflowDecisionBadgeTone | null },
): WorkflowDecisionBadgeView[] {
  const badges: WorkflowDecisionBadgeView[] = [];

  if (column === "samenvatting") {
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

  if (column === "matching" && matchConfidence) {
    badges.push({ label: matchConfidence.label, tone: matchConfidence.tone });
  }

  if (providerStatus.label && providerStatus.tone) {
    badges.push({ label: providerStatus.label, tone: providerStatus.tone });
  }

  if (spaCase.problems.some((problem) => problem.type === "delayed")) {
    badges.push({ label: "Wachttijd", tone: spaCase.urgency === "critical" ? "critical" : "warning" });
  }

  return badges.slice(0, 4);
}

function buildSignals(
  spaCase: SpaCase,
  item: Pick<WorkflowCaseView, "id" | "blockReason" | "matchConfidenceLabel" | "providerStatusLabel" | "missingDataItems" | "boardColumn" | "daysInCurrentPhase">,
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
      id: `${item.id}-match-confidence`,
      type: "matching",
      severity: item.matchConfidenceLabel.includes("laag") ? "critical" : item.matchConfidenceLabel.includes("middel") ? "warning" : "info",
      title: item.matchConfidenceLabel,
      description: "Volgende stap.",
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
  const signals = buildSignals(spaCase, item);
  const timelineEvents = buildTimeline(item);
  const allowedActions: CasusAction[] = [
    {
      id: `${item.id}-primary-action`,
      type: item.boardColumn === "matching"
        ? "start_matching"
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
  const boardColumn = resolveBoardColumn(spaCase, missingDataItems);
  const label = boardColumnLabel(boardColumn);
  const matchConfidence = boardColumn === "matching" ? buildMatchConfidence(regionalMatches.length, spaCase.urgency) : null;
  const providerStatus = resolveProviderStatusLabel(boardColumn, firstProvider?.name ?? null);
  const whyInThisStep = resolveWhyInThisStep(spaCase, boardColumn, missingDataItems, summaryAvailable, regionalMatches.length);
  const primaryAction = resolvePrimaryAction(boardColumn, summaryAvailable, regionalMatches.length);
  const isBlocked = !primaryAction.enabled || (boardColumn === "casus" && missingDataItems.length > 0);
  const blockReason = !primaryAction.enabled
    ? primaryAction.reason
    : boardColumn === "casus"
      ? missingDataItems[0] ?? null
      : null;

  const view: WorkflowCaseView = {
    id: spaCase.id,
    title: spaCase.title,
    clientLabel: spaCase.title || `Cliënt ${spaCase.id.slice(-4)}`,
    clientAge: stableAge(spaCase.id),
    careType: spaCase.zorgtype,
    region: spaCase.regio || "Onbekend",
    municipality: spaCase.regio || "Onbekend",
    lastUpdatedLabel: spaCase.wachttijd === 0 ? "Vandaag" : `${spaCase.wachttijd} dag${spaCase.wachttijd === 1 ? "" : "en"} geleden`,
    urgency: spaCase.urgency,
    urgencyLabel: urgencyLabel(spaCase.urgency),
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
    summarySnippet: buildSummarySnippet(spaCase, missingDataItems),
    whyInThisStep,
    responsibleParty: resolveResponsibility(boardColumn),
    primaryActionLabel: primaryAction.label,
    primaryActionEnabled: primaryAction.enabled,
    primaryActionReason: primaryAction.reason,
    decisionBadges: buildDecisionBadges(spaCase, boardColumn, missingDataItems, summaryAvailable, matchConfidence, providerStatus),
    missingDataItems,
    matchConfidenceLabel: matchConfidence ? `${matchConfidence.label} (${matchConfidence.score}%)` : null,
    matchConfidenceScore: matchConfidence?.score ?? null,
    providerStatusLabel: providerStatus.label,
    providerStatusTone: providerStatus.tone,
    waitlistBucket: spaCase.waitlistBucket,
    urgencyGrantedDate: spaCase.urgencyGrantedDate,
    intakeStartDate: spaCase.intakeStartDate,
  };

  view.workflowState = buildWorkflowState(spaCase, view);

  return view;
}

export function buildWorkflowCases(spaCases: SpaCase[], providers: SpaProvider[] = []): WorkflowCaseView[] {
  return spaCases.map((spaCase) => buildWorkflowCase(spaCase, providers));
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
      nextActionLabel = item.missingDataItems.length > 0 ? "Vul aan" : "Genereer";
      nextActionRoute = "casussen";
      requiredAction = "complete_summary";
      break;
    case "samenvatting":
      responsibleParty = item.primaryActionLabel.toLowerCase().includes("genereer") ? "Systeem" : "Gemeente";
      nextActionLabel = item.primaryActionLabel.toLowerCase().includes("genereer") ? "Genereer" : "Bevestig";
      nextActionRoute = "casussen";
      requiredAction = "complete_summary";
      break;
    case "matching":
      responsibleParty = "Gemeente";
      nextActionLabel = item.recommendedProvidersCount > 0 ? "Bekijk match" : "Start match";
      nextActionRoute = "matching";
      secondaryActions = [
        { label: "Detail", route: "casussen" },
        { label: "Matching", route: "matching" },
        { label: "Docs", route: "casussen" },
      ];
      requiredAction = item.recommendedProvidersCount > 0 ? "send_to_provider" : "start_matching";
      break;
    case "gemeente-validatie":
      responsibleParty = "Gemeente";
      nextActionLabel = "Valideer voorstel";
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
      nextActionLabel = userRole === "zorgaanbieder" ? "Beoordeel" : "Bekijk reactie";
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
      providerReviewActions = userRole === "zorgaanbieder" ? ["Accepteren", "Afwijzen", "Meer info"] : [];
      requiredAction = "provider_request_info";
      break;
    case "plaatsing":
      responsibleParty = "Gemeente";
      nextActionLabel = "Start plaatsing";
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
