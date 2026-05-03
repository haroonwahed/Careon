import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { AssessmentQueuePage } from "./AssessmentQueuePage";

const mockUseCases = vi.fn();
const mockUseProviders = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-AQ-1",
    title: "Test",
    regio: "Utrecht",
    zorgtype: "Ambulant",
    wachttijd: 2,
    status: "provider_beoordeling",
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
    name: "A",
    city: "Utrecht",
    status: "active",
    currentCapacity: 1,
    maxCapacity: 10,
    waitingListLength: 0,
    averageWaitDays: 1,
    offersOutpatient: true,
    offersDayTreatment: false,
    offersResidential: false,
    offersCrisis: false,
    serviceArea: "Utrecht",
    specialFacilities: "",
    availableSpots: 1,
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

describe("AssessmentQueuePage", () => {
  it("uses unified shell and shows table when cases exist in queue phases", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-T1", status: "provider_beoordeling" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<AssessmentQueuePage />);

    expect(screen.getByRole("heading", { name: /Aanbieder beoordeling/i })).toBeInTheDocument();
    expect(screen.getByText("C-T1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Openen/i })).toBeInTheDocument();
  });
});
