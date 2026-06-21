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

const mockUseMatchingCandidates = vi.fn();

vi.mock("../../hooks/useMatchingCandidates", () => ({
  useMatchingCandidates: (...args: unknown[]) => mockUseMatchingCandidates(...args),
}));

function makeApiMatch(name: string, ranking: number) {
  return {
    casus_id: 1,
    zorgprofiel_id: 1,
    zorgaanbieder_id: ranking,
    aanbiederName: name,
    totaalscore: 0.82,
    score_inhoudelijke_fit: 0.8,
    score_regio_contract_fit: 0.85,
    score_capaciteit_wachttijd_fit: 0.75,
    score_complexiteit_veiligheid_fit: 0.7,
    score_performance_fit: 0.65,
    confidence_label: ranking === 1 ? "hoog" : "middel",
    fit_samenvatting: "Arrangement sluit grotendeels aan.",
    trade_offs: ["Capaciteit nog niet bevestigd"],
    verificatie_advies: "Controleer gemeentelijke validatie.",
    zorgbehoefte_categorie: "Wonen & verblijf",
    zorgbehoefte_categorie_code: "WONEN_VERBLIJF",
    zorgbehoefte_specifiek: "Woonvoorziening",
    zorgbehoefte_specifiek_code: "WONEN_VERBLIJF_WOONVOORZIENING",
    taxonomie_lijn: "Taxonomie: Wonen & verblijf → Woonvoorziening",
    taxonomie_code_lijn: "Taxonomiecode: WONEN_VERBLIJF → WONEN_VERBLIJF_WOONVOORZIENING",
    uitgesloten: false,
    uitsluitreden: "",
    ranking,
  };
}

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
    mockUseMatchingCandidates.mockReturnValue({
      matches: [
        makeApiMatch("Zorggroep A", 201),
        makeApiMatch("Zorggroep B", 202),
        makeApiMatch("Zorggroep C", 203),
      ],
      loading: false,
      error: null,
      incompleteCode: null,
      refetch: vi.fn(),
    });

    render(
      <MatchingPageWithMap caseId="C-MATCH-1" onBack={() => {}} onConfirmMatch={() => {}} />,
    );

    expect(await screen.findByRole("heading", { name: /Matching voor casus/i })).toBeVisible();

    const selectControls = screen.getAllByRole("radio", { name: /Selecteer Zorggroep/i });
    expect(selectControls.length).toBeGreaterThanOrEqual(1);
    await user.click(selectControls[0]);
    await user.click(screen.getByRole("button", { name: "Stuur naar aanbieder" }));

    expect(await screen.findByRole("dialog", { name: /Bevestig keuze/i })).toBeVisible();
    expect(screen.getByText(/te selecteren voor doorleiding/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^Annuleren$/i }));
    expect(screen.queryByRole("dialog", { name: /Bevestig keuze/i })).not.toBeInTheDocument();
  });

  it("matches API rows by provider id instead of provider display name", async () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-MATCH-1" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({
      providers: [
        makeProvider("201", "Zorggroep A", 2),
        makeProvider("202", "Zorggroep B", 3),
      ],
      loading: false,
      error: null,
      totalCount: 2,
      networkSummary: null,
      lastUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });
    mockUseMatchingCandidates.mockReturnValue({
      matches: [
        makeApiMatch("Verouderde naam uit API", 201),
      ],
      loading: false,
      error: null,
      incompleteCode: null,
      refetch: vi.fn(),
    });

    render(
      <MatchingPageWithMap caseId="C-MATCH-1" onBack={() => {}} onConfirmMatch={() => {}} />,
    );

    expect(await screen.findByRole("heading", { name: /Matching voor casus/i })).toBeVisible();
    expect(screen.getAllByText("Zorggroep A").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Verouderde naam uit API")).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio", { name: /Selecteer Zorggroep/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("shows submit errors as a visible blocker near the matching workspace", async () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-MATCH-1" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({
      providers: [makeProvider("201", "Zorggroep A", 2)],
      loading: false,
      error: null,
      totalCount: 1,
      networkSummary: null,
      lastUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });
    mockUseMatchingCandidates.mockReturnValue({
      matches: [makeApiMatch("Zorggroep A", 1)],
      loading: false,
      error: null,
      incompleteCode: null,
      refetch: vi.fn(),
    });

    render(
      <MatchingPageWithMap
        caseId="C-MATCH-1"
        onBack={() => {}}
        onConfirmMatch={() => {}}
        submitError="Kies eerst een casus of probeer opnieuw."
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Je kunt nog niet verder");
    expect(alert).toHaveTextContent("Kies eerst een casus of probeer opnieuw.");
  });

  it("requires override reason when selecting a non-top ranked provider", async () => {
    const user = userEvent.setup();
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-MATCH-1" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({
      providers: [
        makeProvider("1", "Zorggroep A", 2),
        makeProvider("2", "Zorggroep B", 3),
      ],
      loading: false,
      error: null,
      totalCount: 2,
      networkSummary: null,
      lastUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });
    mockUseMatchingCandidates.mockReturnValue({
      matches: [
        makeApiMatch("Zorggroep A", 1),
        makeApiMatch("Zorggroep B", 2),
      ],
      loading: false,
      error: null,
      incompleteCode: null,
      refetch: vi.fn(),
    });

    render(
      <MatchingPageWithMap caseId="C-MATCH-1" onBack={() => {}} onConfirmMatch={() => {}} />,
    );

    await screen.findByRole("heading", { name: /Matching voor casus/i });

    const selectControls = screen.getAllByRole("radio", { name: /Selecteer Zorggroep/i });
    expect(selectControls.length).toBeGreaterThanOrEqual(2);
    await user.click(selectControls[1]);
    await user.click(screen.getByRole("button", { name: "Stuur naar aanbieder" }));

    const dialog = await screen.findByRole("dialog", { name: /Afwijking van topaanbeveling/i });
    expect(dialog).toBeVisible();
    expect(screen.getByText(/Handmatige overschrijving vereist/i)).toBeVisible();

    const confirmBtn = screen.getByRole("button", { name: /Selecteren met toelichting/i });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: /Reden van overschrijving/i }), "Cliëntvoorkeur");
    expect(confirmBtn).not.toBeDisabled();
  });

  it("shows tradeoffs in the provider card when a match is selected", async () => {
    const user = userEvent.setup();
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-MATCH-1" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({
      providers: [makeProvider("1", "Zorggroep A", 2)],
      loading: false,
      error: null,
      totalCount: 1,
      networkSummary: null,
      lastUpdatedAt: Date.now(),
      refetch: vi.fn(),
    });
    mockUseMatchingCandidates.mockReturnValue({
      matches: [{ ...makeApiMatch("Zorggroep A", 1), trade_offs: ["Capaciteit nog niet bevestigd", "Reistijd hoog"] }],
      loading: false,
      error: null,
      incompleteCode: null,
      refetch: vi.fn(),
    });

    render(
      <MatchingPageWithMap caseId="C-MATCH-1" onBack={() => {}} onConfirmMatch={() => {}} />,
    );

    await screen.findByRole("heading", { name: /Matching voor casus/i });

    const articleCards = screen.getAllByRole("article");
    expect(articleCards.length).toBeGreaterThanOrEqual(1);

    await user.click(articleCards[0]);

    const card = articleCards[0];
    expect(card).toHaveTextContent("Afwegingen");
    expect(card).toHaveTextContent("Capaciteit nog niet bevestigd");
  });
});
