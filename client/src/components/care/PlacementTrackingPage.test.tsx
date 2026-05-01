import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.getByRole("button", { name: "Bevestig plaatsing" })).toBeInTheDocument();
  });

  it("shows Plan intake when placement is confirmed in canonical state (row-level, not tab)", async () => {
    const user = userEvent.setup();
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-PC",
          title: "Cliënt C",
          status: "plaatsing",
          wachttijd: 1,
          workflowState: "PLACEMENT_CONFIRMED",
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<PlacementTrackingPage onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Lopend ·/ }));
    expect(screen.getByRole("button", { name: "Plan intake" })).toBeInTheDocument();
  });

  it("infers Plan intake from placement APPROVED without workflow_state", async () => {
    const user = userEvent.setup();
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-PA",
          title: "Cliënt A",
          status: "plaatsing",
          wachttijd: 1,
          workflowState: undefined,
          placementRequestStatus: "APPROVED",
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<PlacementTrackingPage onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Lopend ·/ }));
    expect(screen.getByRole("button", { name: "Plan intake" })).toBeInTheDocument();
  });

  it("infers Plan intake from arrangement end date without workflow_state", async () => {
    const user = userEvent.setup();
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          id: "C-PE",
          title: "Cliënt E",
          status: "plaatsing",
          wachttijd: 1,
          workflowState: undefined,
          arrangementEndDate: "2027-08-15",
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<PlacementTrackingPage onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: /Lopend ·/ }));
    expect(screen.getByRole("button", { name: "Plan intake" })).toBeInTheDocument();
  });
});
