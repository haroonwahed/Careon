import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { MatchingQueuePage } from "./MatchingQueuePage";

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
    status: "matching",
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

describe("MatchingQueuePage", () => {
  it("shows Controleer match when matching is blocked (no advies)", () => {
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-M0",
          title: "Capaciteit test",
          status: "matching",
          urgencyValidated: false,
          regio: "Groningen",
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [] });

    render(<MatchingQueuePage onCaseClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Controleer matchadvies" })).toBeInTheDocument();
  });

  it("uses unified header, search, and work row CTA copy", () => {
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-M1",
          title: "Cliënt A",
          status: "matching",
          urgencyValidated: false,
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<MatchingQueuePage onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Matching" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Zoek casus, client of regio/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vergelijk aanbieders" })).toBeInTheDocument();
    expect(screen.queryByText(/Operatieve aandacht/i)).not.toBeInTheDocument();
  });
});
