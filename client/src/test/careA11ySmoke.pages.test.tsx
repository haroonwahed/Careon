import { screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SpaCase } from "../hooks/useCases";
import type { SpaProvider } from "../hooks/useProviders";
import type { SpaTask } from "../hooks/useTasks";
import type { RegiekamerDecisionOverview } from "../lib/regiekamerDecisionOverview";
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
vi.mock("../hooks/useRegiekamerDecisionOverview", () => ({
  useRegiekamerDecisionOverview: (...args: unknown[]) => mockUseOverview(...args),
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

function makeOverview(): RegiekamerDecisionOverview {
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
      urgency_applied: false,
      urgency_applied_since: "",
      diagnostiek: [],
      zorgvorm_gewenst: "",
      preferred_care_form: "",
      preferred_region_type: "",
      preferred_region: "",
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
      care_category_main: [{ value: "ggz", label: "GGZ" }],
      care_category_sub: [{ value: "ggz-jeugd", label: "Jeugd GGZ", mainCategoryId: "ggz" }],
      gemeente: [{ value: "utrecht", label: "Utrecht" }],
      regio: [{ value: "utrecht", label: "Utrecht" }],
      urgency: [
        { value: "low", label: "Laag" },
        { value: "medium", label: "Midden" },
        { value: "high", label: "Hoog" },
      ],
      complexity: [
        { value: "low", label: "Laag" },
        { value: "medium", label: "Midden" },
        { value: "high", label: "Hoog" },
      ],
      diagnostiek: [{ value: "trauma", label: "Trauma" }],
      zorgvorm_gewenst: [{ value: "ambulant", label: "Ambulant" }],
      preferred_care_form: [{ value: "ambulant", label: "Ambulant" }],
      preferred_region_type: [{ value: "lokaal", label: "Lokaal" }],
      preferred_region: [{ value: "utrecht", label: "Utrecht" }],
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
    const { container } = renderWithA11y(<NieuweCasusPage />);
    expect(await screen.findByRole("heading", { name: "Nieuwe casus" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stap 1: Basis/i })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("progressbar", { name: "Voortgang nieuwe casus" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bronregistratie koppelen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toelichting" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Volgende" })).toBeInTheDocument();
    await expectNoA11yViolations(container, "Nieuwe casus");
  });

  it("Casussen workflow surface", async () => {
    mockUseCases.mockReturnValue({
      cases: [makeCase({ id: "C-101", title: "Casus Utrecht", status: "intake", urgency: "warning" })],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseProviders.mockReturnValue({ providers: [makeProvider()] });

    const { container } = renderWithA11y(<WorkloadPage onCaseClick={vi.fn()} role="gemeente" canCreateCase onCreateCase={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Aanvragen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nieuwe aanvraag" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters$/i })).toBeInTheDocument();
    await expectNoA11yViolations(container, "Aanvragen");
  });

  it("Regiekamer / SystemAwarenessPage", async () => {
    mockUseOverview.mockReturnValue({ data: makeOverview(), loading: false, error: null, refetch: vi.fn() });

    const { container } = renderWithA11y(<SystemAwarenessPage onCaseClick={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /^Coördinatie$/i })).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-dominant-primary-cta")).toBeVisible();
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
