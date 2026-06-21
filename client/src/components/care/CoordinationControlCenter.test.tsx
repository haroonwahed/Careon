// @ts-nocheck
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import type { CoordinationDecisionOverview } from "../../lib/coordinationDecisionOverview";
import { CoordinationControlCenter } from "./CoordinationControlCenter";

const mockUseCoordinationDecisionOverview = vi.fn();

vi.mock("../../hooks/useCoordinationDecisionOverview", () => ({
  useCoordinationDecisionOverview: () => mockUseCoordinationDecisionOverview(),
}));

vi.mock("../../hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({
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
  }),
}));

function makeItem(overrides: Partial<CoordinationDecisionOverview["items"][number]> = {}) {
  return {
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
    ...overrides,
  };
}

function makeOverview(overrides: Partial<CoordinationDecisionOverview> = {}): CoordinationDecisionOverview {
  return {
    generated_at: "2026-04-25T10:00:00Z",
    totals: {
      active_cases: 3,
      critical_blockers: 1,
      high_priority_alerts: 1,
      provider_sla_breaches: 1,
      repeated_rejections: 1,
      intake_delays: 1,
      urgency_applications_open: 0,
    },
    items: [
      makeItem(),
      makeItem({
        case_id: 102,
        case_reference: "C-102",
        title: "Casus B",
        current_state: "PROVIDER_REVIEW_PENDING",
        phase: "aanbieder_beoordeling",
        urgency: "medium",
        assigned_provider: "Provider B",
        next_best_action: {
          action: "FOLLOW_UP_PROVIDER",
          label: "Volg aanbieder op",
          priority: "critical",
          reason: "SLA is overschreden.",
        },
        top_blocker: null,
        top_risk: {
          code: "REPEATED_PROVIDER_REJECTIONS",
          severity: "high",
          message: "Casus is meerdere keren afgewezen.",
          evidence: {},
        },
        top_alert: {
          code: "PROVIDER_REVIEW_PENDING_SLA",
          severity: "high",
          title: "Aanbieder beoordeling wacht te lang",
          message: "Volg de aanbieder op.",
          recommended_action: "FOLLOW_UP_PROVIDER",
          evidence: {},
        },
        blocker_count: 0,
        risk_count: 1,
        alert_count: 1,
        priority_score: 80,
        hours_in_current_state: 80,
        issue_tags: ["risks", "alerts", "SLA", "rejection"],
        responsible_role: "coordinatie",
      }),
      makeItem({
        case_id: 103,
        case_reference: "C-103",
        title: "Casus C",
        current_state: "PLACEMENT_CONFIRMED",
        phase: "plaatsing",
        urgency: "low",
        assigned_provider: "Provider C",
        next_best_action: {
          action: "START_INTAKE",
          label: "Start intake",
          priority: "medium",
          reason: "Plaatsing is bevestigd.",
        },
        top_blocker: null,
        top_risk: {
          code: "INTAKE_DELAYED",
          severity: "medium",
          message: "Intake is nog niet gestart.",
          evidence: {},
        },
        top_alert: {
          code: "INTAKE_NOT_STARTED",
          severity: "warning",
          title: "Intake is nog niet gestart",
          message: "Plan de intake-overdracht.",
          recommended_action: "START_INTAKE",
          evidence: {},
        },
        blocker_count: 0,
        risk_count: 1,
        alert_count: 1,
        priority_score: 55,
        hours_in_current_state: 26,
        issue_tags: ["risks", "alerts", "intake"],
        responsible_role: "zorgaanbieder",
      }),
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
    ...overrides,
  };
}

describe("CoordinationControlCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Regiekamer shell with the operational worklist", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("regiekamer-page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Regiekamer$/i })).toBeInTheDocument();
    expect(screen.getByTestId("coordination-uitvoerlijst")).toBeInTheDocument();
  });

  it("renders the priority worklist ordered by SLA urgency", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    const rows = screen.getAllByTestId("coordination-worklist-item");
    expect(rows).toHaveLength(3);
    // Self-sorting worklist: most-breached SLA first. Casus B (8u te laat) leads,
    // then Casus A (<1u te laat), then the on-track Casus C.
    expect(rows[0]).toHaveTextContent("Casus B");
    expect(rows[0]).toHaveTextContent("C-102");
    expect(rows[0]).toHaveTextContent("Herinner aanbieder");
    expect(rows[1]).toHaveTextContent("Casus A");
    expect(rows[1]).toHaveTextContent("Vraag reactie aan");
    expect(rows[2]).toHaveTextContent("Casus C");
    expect(rows[2]).toHaveTextContent("Plan intake");
  });

  it("renders compact row content with case, blokkade, owner and next-action", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    // Locate the Casus A row regardless of worklist ordering.
    const rows = screen.getAllByTestId("coordination-worklist-item");
    const casusA = rows.find((row) => within(row).queryByText("Casus A"));
    expect(casusA).toBeDefined();
    expect(within(casusA!).getByText("Casus A")).toBeInTheDocument();
    expect(casusA!).toHaveTextContent("C-101");
    expect(casusA!).toHaveTextContent("Matching");
    // Blokkade title + message surfaced from top_blocker/top_alert.
    expect(casusA!).toHaveTextContent("Nog geen matchingresultaat");
    expect(casusA!).toHaveTextContent("Samenvatting ontbreekt.");
    // Owner avatar + name and the SLA sublabel.
    expect(casusA!).toHaveTextContent("Jane D.");
    expect(casusA!).toHaveTextContent("SLA 48u");
    expect(within(casusA!).getByRole("button", { name: /Vraag reactie aan/i })).toBeInTheDocument();
  });

  it("never renders mixed summary CTA labels", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        items: [
          makeItem({
            next_best_action: {
              action: "GENERATE_SUMMARY",
              label: "Casus onvolledig",
              priority: "high",
              reason: "Samenvatting ontbreekt.",
            },
            top_blocker: {
              code: "MISSING_SUMMARY",
              severity: "critical",
              message: "Samenvatting ontbreekt.",
              blocking_actions: ["GENERATE_SUMMARY"],
            },
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Genereer samenvatting/i })).not.toBeInTheDocument();
  });

  it("filters the worklist client-side", async () => {
    const user = userEvent.setup();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Filters$/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Prioriteit" }), "critical");
    expect(await screen.findAllByTestId("coordination-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus A")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Prioriteit" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "intake");
    expect(await screen.findAllByTestId("coordination-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus C")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Rol" }), "coordinatie");
    expect(await screen.findAllByTestId("coordination-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus B")).toBeInTheDocument();
  });

  it("renders the no-data empty state with werkvoorraad CTA when navigation is available", () => {
    const onAppNavigate = vi.fn();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        totals: {
          active_cases: 0,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          repeated_rejections: 0,
          intake_delays: 0,
        },
        items: [],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} onAppNavigate={onAppNavigate} />);

    expect(screen.getByText("Geen actieve aanvragen.")).toBeInTheDocument();
    expect(
      screen.getByText(/Open de werkvoorraad voor lopende aanvragen/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open aanvragen" }));
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
  });

  it("renders Nieuwe casus on empty state when canCreateCase", () => {
    const onCreateCase = vi.fn();
    const onAppNavigate = vi.fn();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        totals: {
          active_cases: 0,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          repeated_rejections: 0,
          intake_delays: 0,
        },
        items: [],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <CoordinationControlCenter
        onCaseClick={vi.fn()}
        onAppNavigate={onAppNavigate}
        canCreateCase
        onCreateCase={onCreateCase}
      />,
    );

    expect(screen.getByText(/start een nieuwe doorstroom/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Nieuwe aanmelding" })[0]);
    expect(onCreateCase).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open aanvragen" }));
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
  });

  it("lists cases calmly when there are no operational blockers", () => {
    const onAppNavigate = vi.fn();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        totals: {
          active_cases: 2,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          repeated_rejections: 0,
          intake_delays: 0,
        },
        items: [
          makeItem({
            phase: "plaatsing",
            urgency: "low",
            priority_score: 0,
            top_blocker: null,
            top_risk: null,
            top_alert: null,
            issue_tags: [],
          }),
          makeItem({
            case_id: 104,
            case_reference: "C-104",
            title: "Casus D",
            phase: "plaatsing",
            urgency: "low",
            priority_score: 0,
            top_blocker: null,
            top_risk: null,
            top_alert: null,
            issue_tags: [],
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} onAppNavigate={onAppNavigate} />);

    expect(screen.getByTestId("coordination-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getAllByTestId("coordination-worklist-item")).toHaveLength(2);
  });

  it("opens the existing case detail by notifying the parent", () => {
    const onCaseClick = vi.fn();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={onCaseClick} />);

    // Worklist is SLA-sorted, so the first row is Casus B (case_id 102). The
    // "Volgende actie" button hands the row id to the parent.
    const firstRow = screen.getAllByTestId("coordination-worklist-item")[0];
    fireEvent.click(within(firstRow).getByRole("button", { name: /Herinner aanbieder/i }));

    expect(onCaseClick).toHaveBeenCalledWith("102");
  });

  it("keeps urgency applications out of the Regiekamer hero copy", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        totals: {
          active_cases: 1,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          repeated_rejections: 0,
          intake_delays: 0,
          urgency_applications_open: 3,
        },
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.queryByText(/Urgentie aangevraagd: 3/i)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Regiekamer$/i })).toBeInTheDocument();
  });
});
