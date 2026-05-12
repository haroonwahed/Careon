import { describe, expect, it } from "vitest";
import type { CaseDecisionState, WorkflowCaseView } from "../../lib/workflowUi";
import type { CasusWorkboardClassification } from "./casusWorkboardClassification";
import { deriveOperatieveWachtrijGroep, operatieveGroepSortIndex } from "./casusOperatieveWachtrijGroep";

function minimalItem(overrides: Partial<WorkflowCaseView>): WorkflowCaseView {
  return {
    id: "X-1",
    title: "T",
    clientLabel: "Cliënt",
    clientAge: 40,
    careType: "Zorg",
    region: "Utrecht",
    municipality: "Utrecht",
    lastUpdatedLabel: "1 dag geleden",
    urgency: "normal",
    urgencyLabel: "Normaal",
    phase: "intake",
    phaseLabel: "Intake",
    boardColumn: "casus",
    boardColumnLabel: "Casus",
    currentPhaseLabel: "Basis",
    daysInCurrentPhase: 1,
    tags: [],
    nextBestAction: "",
    nextBestActionLabel: "",
    nextBestActionUrl: "casussen",
    isBlocked: false,
    blockReason: null,
    readyForMatching: false,
    readyForPlacement: false,
    recommendedProvidersCount: 0,
    recommendedProviderName: null,
    intakeDateLabel: null,
    placementStatusLabel: "",
    workflowState: {} as WorkflowCaseView["workflowState"],
    canonicalWorkflowState: null,
    summarySnippet: "",
    whyInThisStep: "",
    responsibleParty: "Gemeente",
    primaryActionLabel: "Actie",
    primaryActionEnabled: true,
    primaryActionReason: null,
    decisionBadges: [],
    missingDataItems: [],
    matchConfidenceLabel: null,
    matchConfidenceScore: null,
    providerStatusLabel: null,
    providerStatusTone: null,
    waitlistBucket: 1,
    urgencyGrantedDate: null,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "",
    arrangementEndDate: null,
    placementRequestStatus: null,
    placementProviderResponseStatus: null,
    ...overrides,
  };
}

function minimalDecision(overrides: Partial<CaseDecisionState>): CaseDecisionState {
  return {
    phaseLabel: "Fase",
    statusLabel: "Status",
    responsibleParty: "Gemeente",
    severity: "info",
    whyHere: "",
    nextActionLabel: "Volgende",
    nextActionRoute: "casussen",
    primaryActionEnabled: true,
    blockedReason: null,
    secondaryActions: [],
    requiresCurrentUserAction: true,
    providerReviewActions: [],
    ...overrides,
  };
}

function minimalClassification(overrides: Partial<CasusWorkboardClassification>): CasusWorkboardClassification {
  return {
    section: "attention",
    reasonCode: "blocked",
    debug: {
      assignedBucket: "attention",
      winningRule: "blocked",
      signals: {
        isBlocked: false,
        primaryActionEnabled: true,
        missingDataItems: [],
        requiresCurrentUserAction: true,
        responsibleParty: "Gemeente",
        boardColumn: "casus",
        providerStatusLabel: null,
      },
      nextActionRoute: "casussen",
    },
    ...overrides,
  };
}

describe("deriveOperatieveWachtrijGroep", () => {
  it("maps waiting-provider classification to wacht-op-aanbieder", () => {
    const item = minimalItem({ boardColumn: "aanbieder-beoordeling" });
    const decision = minimalDecision({ responsibleParty: "Zorgaanbieder" });
    const c = minimalClassification({ section: "waiting-provider", reasonCode: "waiting_provider" });
    expect(deriveOperatieveWachtrijGroep(item, decision, c)).toBe("wacht-op-aanbieder");
  });

  it("maps gemeente-validatie column to financiele-validatie", () => {
    const item = minimalItem({ boardColumn: "gemeente-validatie" });
    const decision = minimalDecision({});
    const c = minimalClassification({ section: "stable", reasonCode: "stable" });
    expect(deriveOperatieveWachtrijGroep(item, decision, c)).toBe("financiele-validatie");
  });

  it("maps financial language in blockedReason to financiele-validatie", () => {
    const item = minimalItem({ boardColumn: "matching" });
    const decision = minimalDecision({ blockedReason: "Financiële dekking ontbreekt" });
    const c = minimalClassification({ section: "attention", reasonCode: "blocked" });
    expect(deriveOperatieveWachtrijGroep(item, decision, c)).toBe("financiele-validatie");
  });

  it("maps matching column to klaar-voor-matching when not financial", () => {
    const item = minimalItem({ boardColumn: "matching" });
    const decision = minimalDecision({ blockedReason: null, whyHere: "Nog geen matchvoorstel" });
    const c = minimalClassification({ section: "stable", reasonCode: "stable" });
    expect(deriveOperatieveWachtrijGroep(item, decision, c)).toBe("klaar-voor-matching");
  });

  it("maps attention + missing data to wacht-op-aanmelder", () => {
    const item = minimalItem({ boardColumn: "casus", missingDataItems: ["Urgentie ontbreekt"] });
    const decision = minimalDecision({});
    const c = minimalClassification({ section: "attention", reasonCode: "missing_data" });
    expect(deriveOperatieveWachtrijGroep(item, decision, c)).toBe("wacht-op-aanmelder");
  });

  it("sort index increases along OPERATIEVE_WACHTLIJN_VOLGORDE", () => {
    expect(operatieveGroepSortIndex("wacht-op-aanmelder")).toBeLessThan(operatieveGroepSortIndex("wacht-op-aanbieder"));
  });
});
