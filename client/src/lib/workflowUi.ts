import type { CasusAction, CasusSignal, CasusTimelineEvent, ComputedCaseState } from "./phaseEngine";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";

export type WorkflowBoardColumn =
  | "casus"
  | "samenvatting"
  | "matching"
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
    case "aanbieder-beoordeling":
      return "Aanbieder Beoordeling";
    case "plaatsing":
      return "Plaatsing";
    case "intake":
      return "Intake";
  }
}

function nextActionTarget(column: WorkflowBoardColumn): WorkflowCaseView["nextBestActionUrl"] {
  switch (column) {
    case "matching":
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
    return insight.length > 180 ? `${insight.slice(0, 177).trim()}...` : insight;
  }

  const parts = [
    `${spaCase.zorgtype || "Zorgvraag"} in ${spaCase.regio || "onbekende regio"}.`,
    `Urgentie: ${urgencyLabel(spaCase.urgency).toLowerCase()}.`,
    missingDataItems.length > 0
      ? `Nog ${missingDataItems.length} invoerpunt${missingDataItems.length === 1 ? "" : "en"} afronden voor matching.`
      : "Klaar om samenvatting te bevestigen en door te zetten naar matching.",
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
    return { label: "Match confidence laag", score: 22, tone: "critical" };
  }

  if (providerCount === 1) {
    return {
      label: urgency === "critical" ? "Match confidence kwetsbaar" : "Match confidence middel",
      score: 58,
      tone: urgency === "critical" ? "warning" : "info",
    };
  }

  if (providerCount === 2) {
    return { label: "Match confidence middel", score: 73, tone: "info" };
  }

  return { label: "Match confidence sterk", score: 89, tone: "good" };
}

function resolveBoardColumn(spaCase: SpaCase, missingDataItems: string[]): WorkflowBoardColumn {
  switch (spaCase.status) {
    case "matching":
      return "matching";
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
    return summaryAvailable ? "Samenvatting gereed voor bevestiging" : "Samenvatting nog genereren";
  }

  switch (column) {
    case "casus":
      return "Basisgegevens voorbereiden";
    case "matching":
      return "Matchopties beoordelen";
    case "aanbieder-beoordeling":
      return "Aanbieder valideert casus";
    case "plaatsing":
      return "Plaatsing bevestigen";
    case "intake":
      return spaCase.status === "afgerond" ? "Intake afgerond" : "Intake uitvoeren";
  }
}

function resolveResponsibility(column: WorkflowBoardColumn): string {
  switch (column) {
    case "aanbieder-beoordeling":
    case "intake":
      return "Zorgaanbieder";
    default:
      return "Gemeente";
  }
}

function resolveProviderStatusLabel(column: WorkflowBoardColumn, providerName: string | null): { label: string | null; tone: WorkflowDecisionBadgeTone | null } {
  switch (column) {
    case "aanbieder-beoordeling":
      return { label: providerName ? "Pending" : "Nog niet verstuurd", tone: providerName ? "warning" : "neutral" };
    case "plaatsing":
    case "intake":
      return { label: "Accepted", tone: "good" };
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
        ? `Deze casus staat nog in de eerste stap omdat ${missingDataItems[0].toLowerCase()}.`
        : "Deze casus wacht nog op basisverrijking voordat de AI-samenvatting kan starten.";
    case "samenvatting":
      return summaryAvailable
        ? "De AI-samenvatting is beschikbaar en moet bevestigd worden voordat matching kan starten."
        : "Deze casus wacht op AI-interpretatie zodat matching inhoudelijk onderbouwd kan starten.";
    case "matching":
      return providerCount > 0
        ? `De samenvatting is bevestigd. Er zijn ${providerCount} passende aanbieder${providerCount === 1 ? "" : "s"} om te beoordelen.`
        : "De samenvatting is bevestigd, maar er is nog geen passend aanbod gevonden voor deze casus.";
    case "aanbieder-beoordeling":
      return "De gemeente heeft een voorstel gestuurd. De aanbieder moet nu inhoudelijk valideren of plaatsing haalbaar is.";
    case "plaatsing":
      return "De aanbieder heeft positief gereageerd. Plaatsing en overdracht moeten nu formeel bevestigd worden.";
    case "intake":
      return spaCase.status === "afgerond"
        ? "Plaatsing is bevestigd en de casus bevindt zich in intake of nazorg-afronding."
        : "De intake is de laatste stap voordat uitvoering of afronding zichtbaar wordt.";
  }
}

function resolvePrimaryAction(
  column: WorkflowBoardColumn,
  summaryAvailable: boolean,
  providerCount: number,
): { label: string; enabled: boolean; reason: string | null } {
  switch (column) {
    case "casus":
      return { label: "Vul casus aan", enabled: true, reason: null };
    case "samenvatting":
      return summaryAvailable
        ? { label: "Bekijk & bevestig", enabled: true, reason: null }
        : { label: "Genereer samenvatting", enabled: true, reason: null };
    case "matching":
      return providerCount > 0
        ? { label: "Start matching", enabled: true, reason: null }
        : { label: "Start matching", enabled: false, reason: "Geen passend aanbod beschikbaar" };
    case "aanbieder-beoordeling":
      return { label: "Volg beoordeling op", enabled: true, reason: null };
    case "plaatsing":
      return { label: "Bevestig plaatsing", enabled: true, reason: null };
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
      badges.push({ label: "Missing info", tone: spaCase.urgency === "critical" ? "critical" : "warning" });
    }
    if (spaCase.urgency === "critical" || spaCase.urgency === "warning") {
      badges.push({ label: "Risico", tone: spaCase.urgency === "critical" ? "critical" : "warning" });
    }
    if (summaryAvailable && missingDataItems.length === 0) {
      badges.push({ label: "Klaar voor matching", tone: "good" });
    }
  }

  if (column === "casus" && missingDataItems.length > 0) {
    badges.push({ label: `${missingDataItems.length} ontbrekend`, tone: "warning" });
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
      title: "Ontbrekende gegevens",
      description: item.missingDataItems.join(", "),
      isResolved: false,
    });
  }

  if (item.boardColumn === "matching" && item.matchConfidenceLabel) {
    signals.push({
      id: `${item.id}-match-confidence`,
      type: "matching",
      severity: item.matchConfidenceLabel.includes("laag") ? "critical" : item.matchConfidenceLabel.includes("middel") ? "warning" : "info",
      title: item.matchConfidenceLabel,
      description: "Gebruik dit signaal om te bepalen of de gemeente direct kan matchen of eerst moet escaleren.",
      isResolved: false,
    });
  }

  if (item.providerStatusLabel === "Pending") {
    signals.push({
      id: `${item.id}-provider-pending`,
      type: "aanbieder",
      severity: item.daysInCurrentPhase > 7 ? "warning" : "info",
      title: "Aanbiederreactie open",
      description: "De aanbieder moet de casus nog accepteren, afwijzen of aanvullende informatie vragen.",
      isResolved: false,
    });
  }

  if (item.blockReason) {
    signals.push({
      id: `${item.id}-blocked`,
      type: "matching",
      severity: "critical",
      title: "Workflow geblokkeerd",
      description: item.blockReason,
      isResolved: false,
    });
  }

  if (spaCase.problems.some((problem) => problem.type === "delayed")) {
    signals.push({
      id: `${item.id}-delay`,
      type: "wachttijd",
      severity: spaCase.urgency === "critical" ? "critical" : "warning",
      title: "Wachttijd loopt op",
      description: `Casus staat al ${spaCase.wachttijd} dagen open in de huidige stap.`,
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
      label: "Casus aangemaakt",
      actorName: "Gemeente",
      actorRole: "gemeente",
      date: `${Math.max(item.daysInCurrentPhase, 1)} dagen geleden`,
    },
    {
      id: `${item.id}-stage`,
      type: "phase_change",
      label: `Workflowstap: ${item.boardColumnLabel}`,
      actorName: item.responsibleParty,
      actorRole: item.responsibleParty === "Zorgaanbieder" ? "zorgaanbieder" : "gemeente",
      date: `Actief gedurende ${item.daysInCurrentPhase} dagen`,
    },
    {
      id: `${item.id}-action`,
      type: "action",
      label: `Volgende actie: ${item.primaryActionLabel}`,
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
  if (role === "admin") {
    return true;
  }

  if (party === "Gemeente") {
    return role === "gemeente";
  }

  if (party === "Zorgaanbieder") {
    return role === "zorgaanbieder";
  }

  return false;
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

  switch (item.boardColumn) {
    case "casus":
      responsibleParty = "Gemeente";
      nextActionLabel = item.missingDataItems.length > 0 ? "Vul casus aan" : "Genereer samenvatting";
      nextActionRoute = "casussen";
      break;
    case "samenvatting":
      responsibleParty = item.primaryActionLabel.toLowerCase().includes("genereer") ? "Systeem" : "Gemeente";
      nextActionLabel = item.primaryActionLabel.toLowerCase().includes("genereer") ? "Genereer samenvatting" : "Bevestig samenvatting";
      nextActionRoute = "casussen";
      break;
    case "matching":
      responsibleParty = "Gemeente";
      nextActionLabel = item.recommendedProvidersCount > 0 ? "Bekijk matchvoorstel" : "Start matching";
      nextActionRoute = "matching";
      secondaryActions = [
        { label: "Bekijk detail", route: "casussen" },
        { label: "Open matching", route: "matching" },
        { label: "Documenten", route: "casussen" },
      ];
      break;
    case "aanbieder-beoordeling":
      responsibleParty = "Zorgaanbieder";
      nextActionLabel = userRole === "zorgaanbieder" ? "Beoordeling uitvoeren" : "Bekijk aanbiederreactie";
      nextActionRoute = "beoordelingen";
      secondaryActions = userRole === "zorgaanbieder"
        ? [
            { label: "Accepteren", route: "beoordelingen" },
            { label: "Afwijzen", route: "beoordelingen" },
            { label: "Meer informatie vragen", route: "beoordelingen" },
          ]
        : [
            { label: "Bekijk detail", route: "casussen" },
            { label: "Bekijk status", route: "beoordelingen" },
            { label: "Historie", route: "casussen" },
          ];
      providerReviewActions = userRole === "zorgaanbieder" ? ["Accepteren", "Afwijzen", "Meer informatie vragen"] : [];
      break;
    case "plaatsing":
      responsibleParty = "Gemeente";
      nextActionLabel = "Plaatsing starten";
      nextActionRoute = "plaatsingen";
      secondaryActions = [
        { label: "Bekijk detail", route: "casussen" },
        { label: "Open plaatsing", route: "plaatsingen" },
        { label: "Historie", route: "casussen" },
      ];
      break;
    case "intake":
      responsibleParty = "Zorgaanbieder";
      nextActionLabel = userRole === "zorgaanbieder" ? "Intake voorbereiden" : "Bekijk intake";
      nextActionRoute = "intake";
      secondaryActions = [
        { label: "Bekijk detail", route: "casussen" },
        { label: "Open intake", route: "intake" },
        { label: "Historie", route: "casussen" },
      ];
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
    requiresCurrentUserAction: isRoleResponsible(responsibleParty, userRole),
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
