import { describe, expect, it } from "vitest";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";
import {
  buildWorkflowCase,
  effectivePlacementCanonicalState,
  placementTrackingRowAction,
  placementTrackingRowStatusLabel,
  placementTrackingTabBucket,
} from "./workflowUi";

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-1",
    title: "Casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 1,
    status: "plaatsing",
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
    arrangementProvider: "Aanbieder X",
    arrangementEndDate: null,
    placementRequestStatus: null,
    placementProviderResponseStatus: null,
    workflowState: undefined,
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

describe("placementTrackingTabBucket", () => {
  it("buckets PROVIDER_ACCEPTED to te-bevestigen even when days are high", () => {
    const item = buildWorkflowCase(
      makeCase({ wachttijd: 10, workflowState: "PROVIDER_ACCEPTED" }),
      [makeProvider()],
    );
    expect(placementTrackingTabBucket(item)).toBe("te-bevestigen");
  });

  it("buckets PLACEMENT_CONFIRMED to lopend even when days are low", () => {
    const item = buildWorkflowCase(
      makeCase({ wachttijd: 1, workflowState: "PLACEMENT_CONFIRMED" }),
      [makeProvider()],
    );
    expect(placementTrackingTabBucket(item)).toBe("lopend");
  });

  it("buckets afgerond phase to afgerond tab", () => {
    const item = buildWorkflowCase(makeCase({ status: "afgerond", wachttijd: 0 }), [makeProvider()]);
    expect(placementTrackingTabBucket(item)).toBe("afgerond");
  });
});

describe("placementTrackingRowAction / placementTrackingRowStatusLabel", () => {
  it("uses canonical PLACEMENT_CONFIRMED for Plan intake even when days are low", () => {
    const item = buildWorkflowCase(
      makeCase({ wachttijd: 1, workflowState: "PLACEMENT_CONFIRMED" }),
      [makeProvider()],
    );
    expect(placementTrackingRowAction(item)).toEqual({
      actionLabel: "Plan intake",
      actionVariant: "primary",
    });
    expect(placementTrackingRowStatusLabel(item)).toBe("Lopend");
  });

  it("uses canonical PROVIDER_ACCEPTED for Bevestig plaatsing even when days are high", () => {
    const item = buildWorkflowCase(
      makeCase({ wachttijd: 10, workflowState: "PROVIDER_ACCEPTED" }),
      [makeProvider()],
    );
    expect(placementTrackingRowAction(item)).toEqual({
      actionLabel: "Bevestig plaatsing",
      actionVariant: "primary",
    });
    expect(placementTrackingRowStatusLabel(item)).toBe("Te bevestigen");
  });

  it("infers PLACEMENT_CONFIRMED from placement APPROVED when workflow_state is absent", () => {
    const item = buildWorkflowCase(
      makeCase({
        workflowState: undefined,
        wachttijd: 1,
        placementRequestStatus: "APPROVED",
        placementProviderResponseStatus: "ACCEPTED",
      }),
      [makeProvider()],
    );
    expect(effectivePlacementCanonicalState(item)).toBe("PLACEMENT_CONFIRMED");
    expect(placementTrackingRowAction(item).actionLabel).toBe("Plan intake");
  });

  it("infers PROVIDER_ACCEPTED from placement provider ACCEPTED when workflow_state is absent", () => {
    const item = buildWorkflowCase(
      makeCase({
        workflowState: undefined,
        wachttijd: 10,
        placementRequestStatus: "IN_REVIEW",
        placementProviderResponseStatus: "ACCEPTED",
      }),
      [makeProvider()],
    );
    expect(effectivePlacementCanonicalState(item)).toBe("PROVIDER_ACCEPTED");
    expect(placementTrackingRowAction(item).actionLabel).toBe("Bevestig plaatsing");
    expect(placementTrackingRowStatusLabel(item)).toBe("Te bevestigen");
  });

  it("infers PLACEMENT_CONFIRMED from arrangement end date when workflow_state is absent", () => {
    const item = buildWorkflowCase(
      makeCase({
        workflowState: undefined,
        wachttijd: 1,
        arrangementEndDate: "2027-12-31",
      }),
      [makeProvider()],
    );
    expect(effectivePlacementCanonicalState(item)).toBe("PLACEMENT_CONFIRMED");
    expect(placementTrackingRowAction(item).actionLabel).toBe("Plan intake");
    expect(placementTrackingRowStatusLabel(item)).toBe("Lopend");
  });

  it("falls back to days when canonical state is absent", () => {
    const early = buildWorkflowCase(makeCase({ wachttijd: 1, workflowState: undefined }), [makeProvider()]);
    const late = buildWorkflowCase(makeCase({ wachttijd: 4, workflowState: undefined }), [makeProvider()]);
    expect(placementTrackingRowAction(early).actionLabel).toBe("Bevestig plaatsing");
    expect(placementTrackingRowStatusLabel(early)).toBe("Te bevestigen");
    expect(placementTrackingRowAction(late).actionLabel).toBe("Plan intake");
    expect(placementTrackingRowStatusLabel(late)).toBe("Lopend");
  });

  it("ghost CTA for afgerond", () => {
    const item = buildWorkflowCase(makeCase({ status: "afgerond", wachttijd: 0 }), [makeProvider()]);
    expect(placementTrackingRowAction(item)).toEqual({
      actionLabel: "Bekijk afronding",
      actionVariant: "ghost",
    });
    expect(placementTrackingRowStatusLabel(item)).toBe("Afgerond");
  });
});
