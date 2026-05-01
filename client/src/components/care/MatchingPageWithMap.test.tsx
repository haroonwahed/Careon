import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { MatchingPageWithMap } from "./MatchingPageWithMap";

const mockUseCases = vi.fn();
const mockUseProviders = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));

vi.mock("../../lib/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("./ProviderNetworkMap", () => ({
  ProviderNetworkMap: () => <div data-testid="mock-provider-map" />,
}));

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-MATCH-1",
    title: "E2E matching casus",
    regio: "Utrecht",
    zorgtype: "Jeugdzorg",
    wachttijd: 6,
    status: "matching",
    urgency: "warning",
    problems: [{ type: "capacity", label: "Capaciteit onder druk" }],
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

function makeProvider(id: string, name: string, spots: number): SpaProvider {
  return {
    id,
    name,
    city: "Utrecht",
    status: "active",
    currentCapacity: spots,
    maxCapacity: 12,
    waitingListLength: 1,
    averageWaitDays: 5,
    offersOutpatient: true,
    offersDayTreatment: false,
    offersResidential: false,
    offersCrisis: false,
    serviceArea: "Utrecht",
    specialFacilities: "Jeugd",
    availableSpots: spots,
    region: "Utrecht",
    type: "ambulant",
    specializations: ["Jeugd"],
    latitude: 52.09,
    longitude: 5.12,
    hasCoordinates: true,
    locationLabel: "Utrecht",
    regionLabel: "Utrecht",
    municipalityLabel: "Utrecht",
    secondaryRegionLabels: [],
    allRegionLabels: ["Utrecht"],
  };
}

describe("MatchingPageWithMap", () => {
  it("opens Bevestig keuze when Selecteer is used (no direct assignment)", async () => {
    const user = userEvent.setup();
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-MATCH-1", urgency: "critical", wachttijd: 8 })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({
      providers: [
        makeProvider("201", "Zorggroep A", 2),
        makeProvider("202", "Zorggroep B", 3),
        makeProvider("203", "Zorggroep C", 0),
      ],
      loading: false,
      error: null,
      totalCount: 3,
      networkSummary: null,
      lastUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });

    render(
      <MatchingPageWithMap caseId="C-MATCH-1" onBack={() => {}} onConfirmMatch={() => {}} />,
    );

    expect(await screen.findByRole("heading", { name: /Top 3 aanbevelingen/i })).toBeVisible();

    const selectButtons = screen.getAllByRole("button", { name: /Selecteer/i });
    expect(selectButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(selectButtons[0]);

    expect(await screen.findByRole("dialog", { name: /Bevestig keuze/i })).toBeVisible();
    expect(screen.getByText(/voorkeurskeuze vast voor deze doorleiding/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^Annuleren$/i }));
    expect(screen.queryByRole("dialog", { name: /Bevestig keuze/i })).not.toBeInTheDocument();
  });
});
