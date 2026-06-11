import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { SpaProvider } from "../../hooks/useProviders";
import { expectCasussenMode } from "../../test/utils/modeGuards";
import type { CaseDecisionState, WorkflowCaseView } from "../../lib/workflowUi";
import { WorkloadPage } from "./WorkloadPage";

const mockUseCases = vi.fn();
const mockUseProviders = vi.fn();
const mockBuildWorkflowCases = vi.fn();
const mockGetCaseDecisionState = vi.fn();
const mockClassifyCasusWorkboardState = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));

vi.mock("../../lib/workflowUi", () => ({
  buildWorkflowCases: (...args: unknown[]) => mockBuildWorkflowCases(...args),
  getCaseDecisionState: (...args: unknown[]) => mockGetCaseDecisionState(...args),
}));

vi.mock("./casusWorkboardClassification", () => ({
  classifyCasusWorkboardState: (...args: unknown[]) => mockClassifyCasusWorkboardState(...args),
}));

function makeCase(overrides: Partial<SpaCase>): SpaCase {
  return {
    id: "C-1",
    title: "Casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 1,
    status: "intake",
    urgency: "critical",
    problems: [],
    systemInsight: "",
    recommendedAction: "",
    urgencyValidated: false,
    urgencyDocumentPresent: false,
    urgencyGrantedDate: null,
    waitlistBucket: 1,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "",
    arrangementEndDate: null,
    zorgbehoefteCategorie: "Wonen & verblijf",
    zorgbehoefteCategorieCode: "WONEN_VERBLIJF",
    zorgbehoefteSpecifiek: "Woonvoorziening",
    zorgbehoefteSpecifiekCode: "WONEN_VERBLIJF_WOONVOORZIENING",
    taxonomieLijn: "Taxonomie: Wonen & verblijf → Woonvoorziening",
    taxonomieCodeLijn: "Taxonomiecode: WONEN_VERBLIJF → WONEN_VERBLIJF_WOONVOORZIENING",
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

function makeWorkflowView(overrides: Partial<WorkflowCaseView> = {}): WorkflowCaseView {
  return {
    id: "C-1",
    title: "Casus",
    clientLabel: "Cliënt",
    clientAge: 14,
    careType: "Jeugdhulp",
    region: "Rotterdam Rijnmond",
    municipality: "Rotterdam",
    lastUpdatedLabel: "1 dag geleden",
    urgency: "critical",
    urgencyLabel: "Spoed",
    placementPressureBand: "critical",
    placementPressureLabel: "Spoed",
    placementPressureReason: "",
    placementPressureImplication: "",
    phase: "casus",
    phaseLabel: "Aanmelding",
    boardColumn: "casus",
    boardColumnLabel: "Aanmelding",
    currentPhaseLabel: "Aanmelding",
    daysInCurrentPhase: 1,
    tags: ["Jeugdhulp"],
    nextBestAction: "Maak casus compleet",
    nextBestActionLabel: "Maak casus compleet",
    nextBestActionUrl: "casussen",
    isBlocked: true,
    blockReason: "Casusaanvulling vereist",
    readyForMatching: false,
    readyForPlacement: false,
    recommendedProvidersCount: 0,
    recommendedProviderName: null,
    intakeDateLabel: null,
    placementStatusLabel: "",
    workflowState: "blocked" as never,
    canonicalWorkflowState: null,
    summarySnippet: "",
    whyInThisStep: "De casus is onvolledig en kan nog niet door naar matching.",
    responsibleParty: "Gemeente",
    primaryActionLabel: "Maak casus compleet",
    primaryActionEnabled: true,
    primaryActionReason: null,
    decisionBadges: [],
    missingDataItems: ["Casusaanvulling vereist"],
    matchConfidenceLabel: null,
    matchAdvisoryHint: null,
    matchConfidenceScore: null,
    providerStatusLabel: null,
    providerStatusTone: null,
    waitlistBucket: 1,
    urgencyGrantedDate: null,
    urgencyApplied: false,
    urgencyAppliedSince: null,
    intakeStartDate: null,
    arrangementTypeCode: "",
    arrangementProvider: "",
    arrangementEndDate: null,
    placementRequestStatus: null,
    placementProviderResponseStatus: null,
    zorgbehoefteCategorie: "Gedrag & ontwikkeling",
    zorgbehoefteCategorieCode: "GEDRAG_EN_ONTWIKKELING",
    zorgbehoefteSpecifiek: "Zelfredzaamheid",
    zorgbehoefteSpecifiekCode: "GEDRAG_EN_ONTWIKKELING_ZELFREDZAAMHEID",
    taxonomieLijn: "Taxonomie: Gedrag & ontwikkeling → Zelfredzaamheid",
    taxonomieCodeLijn: "Taxonomiecode: GEDRAG_EN_ONTWIKKELING → GEDRAG_EN_ONTWIKKELING_ZELFREDZAAMHEID",
    ...overrides,
  } as WorkflowCaseView;
}

function makeDecisionState(overrides: Partial<CaseDecisionState> = {}): CaseDecisionState {
  return {
    phaseLabel: "Aanmelding",
    statusLabel: "Casus onvolledig",
    responsibleParty: "Gemeente",
    severity: "critical",
    whyHere: "De casus is onvolledig en kan nog niet door naar matching.",
    nextActionLabel: "Maak casus compleet",
    nextActionRoute: "casussen",
    primaryActionEnabled: true,
    blockedReason: "Casusaanvulling vereist",
    secondaryActions: [],
    requiresCurrentUserAction: true,
    providerReviewActions: [],
    ...overrides,
  };
}

function mockData(cases: SpaCase[], views: WorkflowCaseView[] = [makeWorkflowView()]) {
  mockUseCases.mockReturnValue({
    cases,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });

  mockUseProviders.mockReturnValue({
    providers: [makeProvider()],
  });

  mockBuildWorkflowCases.mockReturnValue(views);
  mockGetCaseDecisionState.mockReturnValue(makeDecisionState());
  mockClassifyCasusWorkboardState.mockReturnValue({ section: "attention" });
}

describe("WorkloadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the approved operational Aanmeldingen state", () => {
    const views = [
      makeWorkflowView({
        id: "CO-2026-C533C8",
        title: "Aanvraag 41",
        region: "Rotterdam Rijnmond",
        municipality: "Rotterdam",
        lastUpdatedLabel: "5 dagen geleden",
        urgency: "critical",
        urgencyLabel: "Spoed",
        placementPressureLabel: "Spoed",
      }),
    ];

    mockData([makeCase({ id: "C-101", title: "Casus Utrecht" })], views);
    mockGetCaseDecisionState.mockImplementation((item: WorkflowCaseView) => {
      if (item.id === "CO-2026-C533C8") {
        return makeDecisionState({
          phaseLabel: "Casus onvolledig",
          statusLabel: "Casus onvolledig",
          whyHere: "Casusaanvulling vereist",
          blockedReason: "Casusaanvulling vereist",
          nextActionLabel: "Maak casus compleet",
        });
      }
      return makeDecisionState();
    });

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" canCreateCase onCreateCase={vi.fn()} />);

    expectCasussenMode();
    expect(screen.getByRole("heading", { name: "Aanmeldingen" })).toBeInTheDocument();
    expect(screen.getByText("Controleer nieuwe zorgvragen en maak casussen klaar voor matching.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nieuwe aanmelding" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overzicht" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Archief" })).toBeInTheDocument();
    expect(screen.getByText("WACHT OP JOUW ACTIE")).toBeInTheDocument();
    expect(screen.getByText("1 casus heeft jouw aandacht nodig")).toBeInTheDocument();
    expect(screen.getByText("De casus is onvolledig en kan nog niet door naar matching.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Maak casus compleet" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /Filters/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Werkvoorraad" })).toBeInTheDocument();
    expect(screen.getByText("CO-2026-C533C8")).toBeInTheDocument();
    expect(screen.getByText("Aanvraag 41")).toBeInTheDocument();
    expect(screen.getByText("Rotterdam Rijnmond")).toBeInTheDocument();
    expect(screen.getByText("Gedrag & ontwikkeling")).toBeInTheDocument();
    expect(screen.getByText("Zelfredzaamheid")).toBeInTheDocument();
    expect(screen.getByText("Casus onvolledig")).toBeInTheDocument();
    expect(screen.getByText("Casusaanvulling vereist")).toBeInTheDocument();
    expect(screen.getByText("5 dagen geleden")).toBeInTheDocument();
    expect(screen.queryByText("Geen casussen.")).not.toBeInTheDocument();
    expect(screen.getByTestId("worklist-pagination-hint")).toHaveTextContent("1–1 van 1 aanmeldingen");
    expect(screen.getByRole("tab", { name: "Alle aanmeldingen 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Onvolledig 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Wacht op aanmelder 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Klaar voor matching 0" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Archief 0" })).toBeInTheDocument();
  });

  it("keeps the dominant action aligned with the row action", () => {
    const onCaseClick = vi.fn();
    mockData([makeCase({ id: "C-103", title: "Casus blokkade" })]);

    render(<WorkloadPage onCaseClick={onCaseClick} role="gemeente" canCreateCase onCreateCase={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Maak casus compleet" })[0]);
    expect(onCaseClick).toHaveBeenCalledWith("C-1");
  });

  it("switches the phase filter without collapsing the page shell", () => {
    mockData([makeCase({ id: "C-201", title: "Casus filter test" })]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    fireEvent.click(screen.getByRole("tab", { name: "Wacht op aanmelder 1" }));

    expect(screen.getByRole("heading", { name: "Aanmeldingen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Werkvoorraad" })).toBeInTheDocument();
    expect(screen.queryByText("Geen casussen.")).not.toBeInTheDocument();
  });

  it("shows the inline empty state only when no rows are visible", () => {
    mockData([makeCase({ id: "C-202", title: "Casus archief filter" })]);

    render(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" />);

    fireEvent.click(screen.getByRole("tab", { name: "Archief 0" }));

    expect(screen.getByRole("heading", { name: "Werkvoorraad" })).toBeInTheDocument();
    expect(screen.getByText("Geen casussen.")).toBeInTheDocument();
    expect(screen.getByText("Pas filters aan.")).toBeInTheDocument();
    expect(screen.queryByTestId("worklist-pagination-hint")).not.toBeInTheDocument();
  });
});
