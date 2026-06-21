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
    id: "CO-2026-C533C8",
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
    urgencyApplied: false,
    urgencyAppliedSince: null,
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
  it("shows the placement attention surface and active worklist", () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ workflowState: "PROVIDER_ACCEPTED" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(
      <PlacementTrackingPage
        onCaseClick={vi.fn()}
        onNavigateToMatching={vi.fn()}
        onNavigateToAanbiederreacties={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Plaatsingen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bevestiging nodig/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Bevestig plaatsing" }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("plaatsingen-werkvoorraad")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Voorbereid 1" })).toBeInTheDocument();
  });

  it("shows Plan intake once the placement is confirmed and a start date exists", async () => {
    const user = userEvent.setup();
    mockUseCases.mockReturnValue({
      cases: [
        makeCase({
          workflowState: "PLACEMENT_CONFIRMED",
          intakeStartDate: "2026-06-20",
        }),
      ],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(<PlacementTrackingPage onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("tab", { name: "Startdatum 1" }));
    expect(screen.getAllByRole("button", { name: "Plan intake" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Startdatum gepland")).toBeInTheDocument();
  });

  it("renders the calm empty state when there are no active placements", () => {
    mockUseCases.mockReturnValue({
      cases: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    render(
      <PlacementTrackingPage
        onCaseClick={vi.fn()}
        onNavigateToMatching={vi.fn()}
        onNavigateToAanbiederreacties={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Plaatsingen" })).toBeInTheDocument();
    expect(screen.getByText("Geen openstaande plaatsingen")).toBeInTheDocument();
  });
});
