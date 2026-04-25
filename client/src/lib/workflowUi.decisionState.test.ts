import { describe, expect, it } from "vitest";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";
import { buildWorkflowCase, getCaseDecisionState } from "./workflowUi";

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-100",
    title: "Jeugd casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 2,
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
    currentCapacity: 2,
    maxCapacity: 8,
    waitingListLength: 0,
    averageWaitDays: 4,
    offersOutpatient: true,
    offersDayTreatment: false,
    offersResidential: false,
    offersCrisis: false,
    serviceArea: "Utrecht",
    specialFacilities: "",
    availableSpots: 2,
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

describe("getCaseDecisionState", () => {
  it("returns gemeente-safe action for provider review", () => {
    const item = buildWorkflowCase(makeCase({ status: "provider_beoordeling", wachttijd: 5 }), [makeProvider()]);
    const state = getCaseDecisionState(item, "gemeente");

    expect(state.nextActionLabel).toBe("Bekijk aanbiederreactie");
    expect(state.responsibleParty).toBe("Zorgaanbieder");
    expect(state.providerReviewActions).toEqual([]);
  });

  it("returns provider review actions for zorgaanbieder", () => {
    const item = buildWorkflowCase(makeCase({ status: "provider_beoordeling", wachttijd: 4 }), [makeProvider()]);
    const state = getCaseDecisionState(item, "zorgaanbieder");

    expect(state.nextActionLabel).toBe("Beoordeling uitvoeren");
    expect(state.providerReviewActions).toEqual(["Accepteren", "Afwijzen", "Meer informatie vragen"]);
  });

  it("returns placement CTA only after placement-ready phase", () => {
    const reviewItem = buildWorkflowCase(makeCase({ status: "provider_beoordeling" }), [makeProvider()]);
    const placementItem = buildWorkflowCase(makeCase({ status: "plaatsing" }), [makeProvider()]);

    const reviewState = getCaseDecisionState(reviewItem, "gemeente");
    const placementState = getCaseDecisionState(placementItem, "gemeente");

    expect(reviewState.nextActionLabel).not.toBe("Plaatsing starten");
    expect(placementState.nextActionLabel).toBe("Plaatsing starten");
  });

  it("maps incomplete intake to casus completion", () => {
    const item = buildWorkflowCase(
      makeCase({
        status: "intake",
        urgencyValidated: false,
        urgencyDocumentPresent: false,
      }),
      [makeProvider()],
    );
    const state = getCaseDecisionState(item, "gemeente");

    expect(state.nextActionLabel).toBe("Vul casus aan");
    expect(state.responsibleParty).toBe("Gemeente");
  });
});
