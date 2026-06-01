import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";
import type { SpaTask } from "../hooks/useTasks";
import type { CoordinationDecisionOverview } from "../lib/coordinationDecisionOverview";
import { expectNoA11yViolations, renderWithA11y } from "./utils/a11y";
import { NieuweCasusPage } from "../components/care/NieuweCasusPage";
import { WorkloadPage } from "../components/care/WorkloadPage";
import { SystemAwarenessPage } from "../components/care/SystemAwarenessPage";
import { MatchingQueuePage } from "../components/care/MatchingQueuePage";
import { AanbiederBeoordelingPage } from "../components/care/AanbiederBeoordelingPage";
import { PlacementTrackingPage } from "../components/care/PlacementTrackingPage";
import { ActiesPage } from "../components/care/ActiesPage";

const mockUseCases = vi.fn();
const mockUseProviders = vi.fn();
const mockUseTasks = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseOverview = vi.fn();
const mockUseRailCollapsed = vi.fn();
const mockUseProviderEvaluations = vi.fn();
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock("../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));
vi.mock("../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));
vi.mock("../hooks/useTasks", () => ({
  useTasks: (...args: unknown[]) => mockUseTasks(...args),
}));
vi.mock("../hooks/useCurrentUser", () => ({
  useCurrentUser: (...args: unknown[]) => mockUseCurrentUser(...args),
}));
vi.mock("../hooks/useCoordinationDecisionOverview", () => ({
  useCoordinationDecisionOverview: (...args: unknown[]) => mockUseOverview(...args),
}));
vi.mock("../hooks/useRailCollapsed", () => ({
  useRailCollapsed: (...args: unknown[]) => mockUseRailCollapsed(...args),
}));
vi.mock("../hooks/useProviderEvaluations", () => ({
  useProviderEvaluations: (...args: unknown[]) => mockUseProviderEvaluations(...args),
  REJECTION_REASON_LABELS: {},
  INFO_REQUEST_TYPE_LABELS: {},
}));
vi.mock("../lib/apiClient", () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

function makeCase(overrides: Partial<SpaCase> = {}): SpaCase {
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
    arrangementProvider: "Aanbieder A",
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

function makeTask(overrides: Partial<SpaTask> = {}): SpaTask {
  return {
    id: "task-1",
    linkedCaseId: "case-1",
    title: "Casusgegevens invullen",
    caseTitle: "Test",
    actionStatus: "overdue",
    dueDate: "2026-05-08",
    assignedTo: "Jane Doe",
    priority: "URGENT",
    ...overrides,
  };
}

function makeOverview(): CoordinationDecisionOverview {
  return {
    generated_at: "2026-04-25T10:00:00Z",
    totals: {
      active_cases: 3,
      critical_blockers: 1,
      high_priority_alerts: 1,
      provider_sla_breaches: 1,
      repeated_rejections: 1,
      intake_delays: 1,
    },
    items: [
      {
        case_id: 101,
        case_reference: "C-101",
        title: "Casus A",
        current_state: "MATCHING_READY",
        phase: "matching",
        urgency: "high",
        assigned_provider: "Provider A",
        next_best_action: {
          action: "SEND_TO_PROVIDER",
          label: "Stuur naar aanbieder",
          priority: "high",
          reason: "Samenvatting is compleet.",
        },
        top_blocker: {
          code: "MISSING_SUMMARY",
          severity: "critical",
          message: "Samenvatting ontbreekt.",
          blocking_actions: ["START_MATCHING"],
        },
        top_risk: null,
        top_alert: {
          code: "NO_MATCH_AVAILABLE",
          severity: "high",
          title: "Nog geen matchingresultaat",
          message: "Start matching of kies een aanbieder.",
          recommended_action: "START_MATCHING",
          evidence: {},
        },
        blocker_count: 1,
        risk_count: 0,
        alert_count: 1,
        priority_score: 140,
        age_hours: 72,
        hours_in_current_state: 48,
        issue_tags: ["blockers", "alerts"],
        responsible_role: "gemeente",
        zorgbehoefte_categorie: "Wonen & verblijf",
        zorgbehoefte_categorie_code: "WONEN_VERBLIJF",
        zorgbehoefte_specifiek: "Woonvoorziening",
        zorgbehoefte_specifiek_code: "WONEN_VERBLIJF_WOONVOORZIENING",
        taxonomie_lijn: "Taxonomie: Wonen & verblijf → Woonvoorziening",
        taxonomie_code_lijn: "Taxonomiecode: WONEN_VERBLIJF → WONEN_VERBLIJF_WOONVOORZIENING",
      },
    ],
    governance_queues: {
      wijkteam_intakes_needing_assessment: [],
      zorgvraag_beoordeling_open: [],
      cases_waiting_gemeente_validation: [],
      budget_approvals_pending: [],
      provider_transition_requests_pending: [],
      evaluations_upcoming: [],
      evaluations_overdue: [],
      active_placements_care_intensity_changed: [],
    },
  };
}

beforeEach(() => {
  mockApiGet.mockResolvedValue({
    initial_values: {
      title: "",
      start_date: "",
      target_completion_date: "",
      care_category_main: "",
      care_category_sub: "",
      assessment_summary: "",
      gemeente: "",
      regio: "",
      urgency: "",
      complexity: "",
      has_urgency_declaration: false,
      urgency_applied: false,
      urgency_applied_since: "",
      diagnostiek: [],
      zorgvorm_gewenst: "",
      preferred_care_form: "",
      preferred_region_type: "JEUGDREGIO",
      preferred_region: "utrecht-stad",
      max_toelaatbare_wachttijd_dagen: "",
      leeftijd: "",
      setting_voorkeur: "",
      contra_indicaties: "",
      problematiek_types: "",
      client_age_category: "",
      family_situation: "",
      school_work_status: "",
      case_coordinator: "",
      description: "",
    },
    options: {
      care_category_main: [{ value: "WONEN_VERBLIJF", label: "Wonen & verblijf" }],
      care_category_sub: [{ value: "WONEN_VERBLIJF_WOONVOORZIENING", label: "Woonvoorziening", mainCategoryId: "WONEN_VERBLIJF" }],
      gemeente: [{ value: "utrecht", label: "Utrecht", urgencyDocumentRequestUrl: "https://www.utrecht.nl/wonen-en-leven/wonen/woning-zoeken/urgentie-voor-een-woning/" }],
      regio: [{ value: "utrecht-stad", label: "Utrecht Stad" }],
      urgency: [
        { value: "LOW", label: "Laag" },
        { value: "MEDIUM", label: "Midden" },
        { value: "HIGH", label: "Hoog" },
      ],
      complexity: [
        { value: "SIMPLE", label: "Enkelvoudig" },
        { value: "MULTIPLE", label: "Meervoudig" },
        { value: "SEVERE", label: "Intensief" },
      ],
      diagnostiek: [{ value: "trauma", label: "Trauma" }],
      zorgvorm_gewenst: [{ value: "ambulant", label: "Ambulant" }],
      preferred_care_form: [{ value: "ambulant", label: "Ambulant" }],
      preferred_region_type: [{ value: "JEUGDREGIO", label: "Jeugdregio" }],
      preferred_region: [{ value: "utrecht-stad", label: "Utrecht Stad" }],
      client_age_category: [{ value: "jeugd", label: "Jeugd" }],
      family_situation: [{ value: "thuis", label: "Thuis" }],
      case_coordinator: [{ value: "gemeente", label: "Gemeente" }],
    },
  });
  mockApiPost.mockResolvedValue({
    ok: true,
    id: 1,
    case_id: "CAS-1",
    title: "CLI-12345",
    source_reference: "BR-2026-ABCDEF",
    redirect_url: "/care/cases/CAS-1/",
  });
  mockUseCurrentUser.mockReturnValue({
    me: {
      id: 1,
      email: "t@test.nl",
      fullName: "Jane Doe",
      username: "jd",
      workflowRole: "gemeente" as const,
      organization: { id: 1, slug: "ams", name: "Gemeente Amsterdam" },
      permissions: { allowRoleSwitch: false },
      flags: { pilotUi: true, spaOnlyWorkflow: true },
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  mockUseRailCollapsed.mockReturnValue({ collapsed: false, toggle: vi.fn(), setCollapsed: vi.fn() });
  mockUseProviderEvaluations.mockReturnValue({
    submitDecision: vi.fn(),
    submitting: false,
    submitError: null,
    clearSubmitError: vi.fn(),
  });
});

describe("Care accessibility smoke: core pages", () => {
  it("Nieuwe casus wizard", async () => {
    const user = userEvent.setup();
    const { container } = renderWithA11y(<NieuweCasusPage />);
    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stap 1: Basisgegevens/i })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: "Geef basisgegevens op" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toelichting" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Volgende stap" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Woonplaatsbeginsel *" }));
    const municipalityInput = screen.getByPlaceholderText("Zoek gemeente...");
    await user.clear(municipalityInput);
    await user.type(municipalityInput, "Utrecht");
    const choice = document.querySelector('[cmdk-item][data-value="Utrecht"]') as HTMLElement | null;
    expect(choice).not.toBeNull();
    await user.click(choice!);
    expect(screen.getByLabelText("Regio *")).toHaveDisplayValue("Utrecht Stad");
    await user.click(screen.getByRole("button", { name: "Volgende stap" }));
    expect(screen.getByRole("heading", { name: "Zorgvraag" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Terug" }).length).toBe(1);
    expect(screen.getByRole("button", { name: "Vorige" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volgende" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Client heeft al een urgentieverklaring"));
    await user.upload(
      screen.getByLabelText("Urgentieverklaring *"),
      new File(["urgentieverklaring"], "urgentieverklaring.pdf", { type: "application/pdf" }),
    );
    await user.selectOptions(screen.getByLabelText("Zorgbehoefte categorie *"), "WONEN_VERBLIJF");
    await user.selectOptions(screen.getByLabelText("Specifieke zorgbehoefte"), "WONEN_VERBLIJF_WOONVOORZIENING");
    expect(await screen.findByLabelText("Specifieke zorgbehoefte")).toHaveValue("WONEN_VERBLIJF_WOONVOORZIENING");
    await user.selectOptions(screen.getByLabelText("Complexiteit *"), "MULTIPLE");
    await user.click(screen.getByRole("button", { name: "Waarom persoonsbeeld?" }));
    expect(screen.getByText("Beschrijf alleen de operationele context die nodig is voor beoordeling en matching.")).toBeInTheDocument();
    expect(screen.getByText("Laat namen, adressen, telefoons, e-mailadressen en BSN achterwege.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Persoonsbeeld *"), "Korte persoonsbeeldschets.");
    await user.click(screen.getByRole("button", { name: "Volgende" }));
    expect(screen.getByRole("heading", { name: "Regio & Verantwoordelijkheid" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Samenvatting voor verzending" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Casus aanmaken" }).length).toBeGreaterThan(1);
    await expectNoA11yViolations(container, "Nieuwe casus");
  }, 10000);

  it("Casussen workflow surface", async () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-101", title: "Casus Utrecht", status: "intake", urgency: "warning" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    const { container } = renderWithA11y(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" canCreateCase onCreateCase={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Casussen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nieuwe casus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters$/i })).toBeInTheDocument();
    await expectNoA11yViolations(container, "Casussen");
  });

  it("Coordination / SystemAwarenessPage", async () => {
    mockUseOverview.mockReturnValue({ data: makeOverview(), loading: false, error: null, refetch: vi.fn() });

    const { container } = renderWithA11y(<SystemAwarenessPage onCaseClick={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /^Operationele coördinatie$/i })).toBeInTheDocument();
    expect(screen.getByTestId("coordination-dominant-primary-cta")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ververs" })).toBeInTheDocument();
    await expectNoA11yViolations(container, "Coördinatie");
  });

  it("Matching queue", async () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-M1", title: "Cliënt A", status: "matching", urgencyValidated: false })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    const { container } = renderWithA11y(<MatchingQueuePage onCaseClick={vi.fn()} onNavigateToCasussen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Matching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vergelijk aanbieders" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Naar casussen" }).length).toBeGreaterThan(0);
    await expectNoA11yViolations(container, "Matching");
  });

  it("Aanbieder beoordeling", async () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-G1", title: "Monitor casus", status: "provider_beoordeling", arrangementProvider: "Levvel Jeugd & Opvoedhulp" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { container } = renderWithA11y(
      <AanbiederBeoordelingPage
        role="gemeente"
        onCaseClick={vi.fn()}
        onNavigateToMatching={vi.fn()}
        onNavigateToCasussen={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Reacties" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terug naar casus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ververs" })).toBeInTheDocument();
    await expectNoA11yViolations(container, "Reacties");
  });

  it("Plaatsingen", async () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-P1", title: "Cliënt B", status: "plaatsing", arrangementProvider: "Aanbieder X" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    const { container } = renderWithA11y(<PlacementTrackingPage onCaseClick={vi.fn()} onNavigateToMatching={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Plaatsingen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Naar matching" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bevestig plaatsing" })).toBeInTheDocument();
    await expectNoA11yViolations(container, "Plaatsingen");
  });

  it("Acties", async () => {
    mockUseTasks.mockReturnValue({
      tasks: [],
      loading: false,
      error: null,
      totalCount: 0,
      refetch: vi.fn(),
    });

    const { container } = renderWithA11y(<ActiesPage onCaseClick={vi.fn()} onNavigateToCasussen={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Acties" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open casussen" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ververs" })).toBeInTheDocument();
    await expectNoA11yViolations(container, "Acties");
  });
});
