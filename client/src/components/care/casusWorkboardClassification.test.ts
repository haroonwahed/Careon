import { describe, expect, it } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { buildWorkflowCases, getCaseDecisionState } from "../../lib/workflowUi";
import { classifyCasusWorkboardState } from "./casusWorkboardClassification";

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-1",
    title: "Casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 1,
    status: "intake",
    urgency: "normal",
    problems: [],
    systemInsight: "",
    recommendedAction: "",
    urgencyValidated: true,
    urgencyDocumentPresent: true,
    urgencyGrantedDate: null,
    waitlistBucket: 1,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "",
    arrangementEndDate: null,
    ...overrides,
  };
}

function makeProvider(): SpaProvider {
  return {
    id: "P-1",
    name: "Zorgaanbieder A",
    city: "Utrecht",
    status: "active",
    currentCapacity: 3,
    maxCapacity: 12,
    waitingListLength: 1,
    averageWaitDays: 5,
    offersOutpatient: true,
    offersDayTreatment: false,
    offersResidential: false,
    offersCrisis: false,
    serviceArea: "Utrecht",
    specialFacilities: "",
    availableSpots: 3,
    region: "Utrecht",
    type: "ambulant",
    specializations: [],
    latitude: null,
    longitude: null,
    hasCoordinates: false,
    locationLabel: "Utrecht",
    regionLabel: "Utrecht",
    municipalityLabel: "Utrecht",
    secondaryRegionLabels: [],
    allRegionLabels: ["Utrecht"],
  };
}

function classify(spaCase: SpaCase, role: "gemeente" | "zorgaanbieder" = "gemeente") {
  const item = buildWorkflowCases([spaCase], [makeProvider()])[0];
  const decision = getCaseDecisionState(item, role);
  return classifyCasusWorkboardState(item, decision);
}

describe("classifyCasusWorkboardState", () => {
  it("classifies blocked case as attention", () => {
    const result = classify(makeCase({ status: "matching", recommendedAction: "Start matching", urgencyValidated: false }));
    expect(result.section).toBe("attention");
    expect(result.reasonCode).toBe("missing_data");
  });

  it("classifies missing urgency as attention", () => {
    const result = classify(makeCase({ urgencyValidated: false, urgencyDocumentPresent: true }));
    expect(result.section).toBe("attention");
    expect(result.reasonCode).toBe("missing_data");
  });

  it("classifies waiting provider case as waiting-provider", () => {
    const result = classify(makeCase({ status: "provider_beoordeling", wachttijd: 5 }), "gemeente");
    expect(result.section).toBe("waiting-provider");
    expect(result.reasonCode).toBe("waiting_provider");
  });

  it("classifies no immediate action as stable", () => {
    const result = classify(makeCase({ status: "matching", urgencyValidated: true, urgencyDocumentPresent: true }), "zorgaanbieder");
    expect(result.section).toBe("stable");
    expect(result.reasonCode).toBe("stable");
  });

  it("uses highest-priority bucket when multiple signals apply", () => {
    const result = classify(makeCase({ status: "provider_beoordeling", urgencyValidated: false, urgencyDocumentPresent: false }), "gemeente");
    expect(result.section).toBe("attention");
    expect(result.reasonCode).toBe("missing_data");
  });

  it("returns blocked reason code when action is disabled without missing data", () => {
    const result = classifyCasusWorkboardState(
      {
        isBlocked: true,
        missingDataItems: [],
        boardColumn: "matching",
        providerStatusLabel: null,
      } as never,
      {
        primaryActionEnabled: false,
        requiresCurrentUserAction: false,
        responsibleParty: "Gemeente",
        nextActionRoute: "matching",
      } as never,
    );
    expect(result.reasonCode).toBe("blocked");
  });

  it("returns current user action reason code when applicable", () => {
    const result = classifyCasusWorkboardState(
      {
        isBlocked: false,
        missingDataItems: [],
        boardColumn: "matching",
        providerStatusLabel: null,
      } as never,
      {
        primaryActionEnabled: true,
        requiresCurrentUserAction: true,
        responsibleParty: "Gemeente",
        nextActionRoute: "matching",
      } as never,
    );
    expect(result.reasonCode).toBe("current_user_action");
  });
});

