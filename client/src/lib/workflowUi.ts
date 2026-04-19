import { computeCaseState, type ComputedCaseState } from "./phaseEngine";
import { toPhaseCasus } from "./careLegacyAdapters";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";

export type WorkflowBoardColumn = "nieuw" | "klaar-voor-matching" | "bij-aanbieder" | "in-intake" | "afgerond";

export interface WorkflowCaseView {
  id: string;
  title: string;
  clientLabel: string;
  clientAge: number;
  careType: string;
  region: string;
  municipality: string;
  urgency: SpaCase["urgency"];
  urgencyLabel: string;
  phase: SpaCase["status"];
  phaseLabel: string;
  boardColumn: WorkflowBoardColumn;
  daysInCurrentPhase: number;
  tags: string[];
  nextBestAction: string;
  nextBestActionLabel: string;
  nextBestActionUrl: "casussen" | "matching" | "plaatsingen" | "intake";
  isBlocked: boolean;
  blockReason: string | null;
  readyForMatching: boolean;
  readyForPlacement: boolean;
  recommendedProvidersCount: number;
  recommendedProviderName: string | null;
  intakeDateLabel: string | null;
  placementStatusLabel: string;
  workflowState: ComputedCaseState;
  // Urgency validation
  urgencyValidated: boolean;
  urgencyDocumentPresent: boolean;
  urgencyGrantedDate: string | null;
  waitlistBucket: number;           // 0 = validated urgent first, 1 = FCFS
  intakeStartDate: string | null;   // aanmeldingsdatum (startdatum casus)
  // Arrangement metadata
  arrangementTypeCode: string;
  arrangementProvider: string;
  arrangementEndDate: string | null;
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

function phaseLabel(phase: SpaCase["status"]): string {
  switch (phase) {
    case "intake":
      return "Klaar voor matching";
    case "matching":
      return "In matching";
    case "provider_beoordeling":
      return "Bij aanbieder";
    case "plaatsing":
      return "Plaatsing / intake";
    case "afgerond":
      return "Afgerond";
    default:
      return "Nieuw";
  }
}

function boardColumn(phase: SpaCase["status"]): WorkflowBoardColumn {
  switch (phase) {
    case "intake":
      return "klaar-voor-matching";
    case "matching":
      return "klaar-voor-matching";
    case "provider_beoordeling":
      return "bij-aanbieder";
    case "plaatsing":
      return "in-intake";
    case "afgerond":
      return "afgerond";
    default:
      return "nieuw";
  }
}

function nextActionTarget(phase: SpaCase["status"]): WorkflowCaseView["nextBestActionUrl"] {
  switch (phase) {
    case "intake":
      return "matching";
    case "matching":
      return "matching";
    case "provider_beoordeling":
      return "casussen";
    case "plaatsing":
      return "plaatsingen";
    case "afgerond":
      return "intake";
    default:
      return "casussen";
  }
}

function buildTags(spaCase: SpaCase): string[] {
  const tags = [spaCase.zorgtype, ...spaCase.problems.map((problem) => problem?.label)]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(tags)).slice(0, 2);
}

export function buildWorkflowCase(spaCase: SpaCase, providers: SpaProvider[] = []): WorkflowCaseView {
  const providerMatches = providers.filter((provider) => {
    const providerRegion = provider.region || provider.city;
    return providerRegion === spaCase.regio && provider.availableSpots >= 0;
  });
  const phaseCasus = toPhaseCasus(spaCase, providers);
  const workflowState = computeCaseState(phaseCasus, "gemeente");
  const firstProvider = providerMatches[0] ?? null;
  const blockedProblem = spaCase.problems.find((problem) => problem.type === "no-match") ?? null;

  return {
    id: spaCase.id,
    title: spaCase.title,
    clientLabel: spaCase.title || `Cliënt ${spaCase.id.slice(-4)}`,
    clientAge: stableAge(spaCase.id),
    careType: spaCase.zorgtype || "Onbekend",
    region: spaCase.regio || "Onbekend",
    municipality: spaCase.regio || "Onbekend",
    urgency: spaCase.urgency,
    urgencyLabel: urgencyLabel(spaCase.urgency),
    phase: spaCase.status,
    phaseLabel: phaseLabel(spaCase.status),
    boardColumn: boardColumn(spaCase.status),
    daysInCurrentPhase: spaCase.wachttijd,
    tags: buildTags(spaCase),
    nextBestAction: workflowState.nextAction,
    nextBestActionLabel: workflowState.nextAction,
    nextBestActionUrl: nextActionTarget(spaCase.status),
    isBlocked: spaCase.status === "matching" && blockedProblem !== null,
    blockReason: blockedProblem?.label ?? workflowState.blockerReason,
    readyForMatching: spaCase.status === "intake" || spaCase.status === "matching",
    readyForPlacement: spaCase.status === "plaatsing",
    recommendedProvidersCount: providerMatches.length,
    recommendedProviderName: firstProvider?.name ?? null,
    intakeDateLabel: spaCase.status === "plaatsing" ? "Intake voorbereiden" : spaCase.status === "provider_beoordeling" ? "Wacht op reactie" : null,
    placementStatusLabel: spaCase.status === "provider_beoordeling"
      ? "In beoordeling"
      : spaCase.status === "plaatsing"
        ? "Intake loopt"
        : spaCase.status === "afgerond"
          ? "Afgerond"
          : "Lopend",
    workflowState,
    // Urgency validation
    urgencyValidated: spaCase.urgencyValidated,
    urgencyDocumentPresent: spaCase.urgencyDocumentPresent,
    urgencyGrantedDate: spaCase.urgencyGrantedDate,
    waitlistBucket: spaCase.waitlistBucket,
    intakeStartDate: spaCase.intakeStartDate,
    // Arrangement metadata
    arrangementTypeCode: spaCase.arrangementTypeCode,
    arrangementProvider: spaCase.arrangementProvider,
    arrangementEndDate: spaCase.arrangementEndDate,
  };
}

export function buildWorkflowCases(spaCases: SpaCase[], providers: SpaProvider[] = []): WorkflowCaseView[] {
  return spaCases.map((spaCase) => buildWorkflowCase(spaCase, providers));
}

export function previousStepTarget(page: "matching" | "plaatsingen"): WorkflowCaseView["nextBestActionUrl"] {
  switch (page) {
    case "matching":
      return "casussen";
    case "plaatsingen":
      return "matching";
  }
}