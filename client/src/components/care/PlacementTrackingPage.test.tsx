import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { PlacementTrackingPage } from "./PlacementTrackingPage";

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

describe("PlacementTrackingPage", () => {
  it("shows intake stall attention when placement ages without intake", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-P2", title: "Stall", status: "plaatsing", wachttijd: 6, arrangementProvider: "Aanbieder Y" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<PlacementTrackingPage onCaseClick={vi.fn()} />);

    expect(screen.getByText(/≥5 dagen in plaatsing/i)).toBeInTheDocument();
  });

  it("uses unified tabs, header, and intake-oriented CTA", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-P1", title: "Cliënt B", status: "plaatsing", arrangementProvider: "Aanbieder X" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<PlacementTrackingPage onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Plaatsingen" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Te bevestigen ·/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bekijk intake" })).toBeInTheDocument();
  });
});
