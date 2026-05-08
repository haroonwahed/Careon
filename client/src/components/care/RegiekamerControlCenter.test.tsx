import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import type { RegiekamerDecisionOverview } from "../../lib/regiekamerDecisionOverview";
import { expectRegiekamerMode } from "../../test/utils/modeGuards";
import { SystemAwarenessPage } from "./SystemAwarenessPage";

const mockUseRegiekamerDecisionOverview = vi.fn();

vi.mock("../../hooks/useRegiekamerDecisionOverview", () => ({
  useRegiekamerDecisionOverview: () => mockUseRegiekamerDecisionOverview(),
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

function makeItem(overrides: Partial<RegiekamerDecisionOverview["items"][number]> = {}) {
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
    ...overrides,
  };
}

function makeOverview(overrides: Partial<RegiekamerDecisionOverview> = {}): RegiekamerDecisionOverview {
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
        responsible_role: "regie",
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
    ...overrides,
  };
}

describe("SystemAwarenessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the overview and renders De regiestroom, right rail, and Werkvoorraad", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /^Regiekamer$/i })).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-phase-board")).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-right-rail")).toBeInTheDocument();
    expect(screen.getByText("De regiestroom")).toBeInTheDocument();
    expect(screen.getByText("Werkvoorraad")).toBeInTheDocument();
    expect(within(screen.getByTestId("regiekamer-uitvoerlijst")).getByText(/\d+\s+casussen/)).toBeInTheDocument();
  });

  it("enforces regiekamer screen responsibility boundaries", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expectRegiekamerMode();
    expect(screen.getByTestId("regiekamer-phase-board")).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ververs" })).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-dominant-action")).toHaveAttribute("data-regiekamer-mode", "crisis");
    expect(screen.getByTestId("regiekamer-dominant-primary-cta")).toHaveTextContent(/Los blokkades op/i);

    expect(screen.queryByText(/Casusdetail|Case detail/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Genereer samenvatting" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Context$/)).not.toBeInTheDocument();
  });

  it("describes Regiekamer as the control tower and keeps the dominant action singular", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    fireEvent.click(screen.getByTestId("regiekamer-page-info"));
    expect(screen.getByText(/Regiekamer is een control tower/i)).toBeInTheDocument();
    expect(screen.getByText(/volgende actie, eigenaar en reden/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("regiekamer-dominant-primary-cta")).toHaveLength(1);
    expect(screen.getByTestId("regiekamer-phase-board")).toBeInTheDocument();
  });

  it("renders the priority worklist in score order", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    const rows = screen.getAllByTestId("regiekamer-worklist-item");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Casus A");
    expect(rows[0]).toHaveTextContent("Kritiek");
    expect(rows[0]).toHaveTextContent("Vul casus aan");
  });

  it("renders compact card content on each worklist card", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    const first = screen.getAllByTestId("regiekamer-worklist-item")[0];
    expect(within(first).getByText("Casus A")).toBeInTheDocument();
    expect(first).toHaveTextContent("Gemeente");
    expect(first).toHaveTextContent("Casusgegevens onvolledig");
    expect(within(first).getByRole("button", { name: /Vul casus aan/i })).toBeInTheDocument();
  });

  it("never renders mixed summary CTA labels", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview({
        items: [
          makeItem({
            next_best_action: {
              action: "GENERATE_SUMMARY",
              label: "Casusgegevens onvolledig",
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

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Genereer samenvatting/i })).not.toBeInTheDocument();
  });

  it("uses summary CTA variants for existing, missing, and pending summary states", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview({
        items: [
          makeItem({
            case_id: 301,
            case_reference: "C-301",
            title: "Samenvatting beschikbaar",
            top_blocker: null,
            next_best_action: {
              action: "SEND_TO_PROVIDER",
              label: "Stuur naar aanbieder",
              priority: "medium",
              reason: "Samenvatting is gereed en de aanbieder kan nu beoordelen.",
            },
          }),
          makeItem({
            case_id: 302,
            case_reference: "C-302",
            title: "Samenvatting ontbreekt",
            next_best_action: {
              action: "GENERATE_SUMMARY",
              label: "Vul casus aan",
              priority: "high",
              reason: "Generatie vereist.",
            },
            top_blocker: {
              code: "MISSING_SUMMARY",
              severity: "critical",
              message: "Samenvatting ontbreekt.",
              blocking_actions: ["GENERATE_SUMMARY"],
            },
          }),
          makeItem({
            case_id: 303,
            case_reference: "C-303",
            title: "Samenvatting in verwerking",
            next_best_action: {
              action: "SEND_TO_PROVIDER",
              label: "Stuur naar aanbieder",
              priority: "high",
              reason: "Samenvatting wordt verwerkt.",
            },
            top_blocker: {
              code: "MISSING_SUMMARY",
              severity: "high",
              message: "Samenvatting wordt gemaakt.",
              blocking_actions: ["START_MATCHING"],
            },
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Stuur naar aanbieder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vul casus aan" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Samenvatting wordt automatisch verwerkt/i })).not.toBeInTheDocument();
    expect(screen.getAllByText("Casusgegevens onvolledig").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Samenvatting wordt automatisch verwerkt").length).toBeGreaterThan(0);
  });

  it("surfaces intake delay as dominant action when it is the top scenario", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview({
        totals: {
          active_cases: 2,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          repeated_rejections: 0,
          intake_delays: 2,
        },
        items: [
          makeItem({
            case_id: 201,
            case_reference: "C-201",
            title: "Casus intake",
            phase: "intake",
            current_state: "INTAKE_PENDING",
            urgency: "medium",
            top_blocker: null,
            top_risk: {
              code: "INTAKE_DELAYED",
              severity: "medium",
              message: "Intake vertraagd.",
              evidence: {},
            },
            top_alert: null,
            blocker_count: 0,
            priority_score: 62,
            hours_in_current_state: 36,
            issue_tags: ["intake", "risks"],
          }),
          makeItem({
            case_id: 202,
            case_reference: "C-202",
            title: "Casus rustig",
            phase: "plaatsing",
            current_state: "PLACEMENT_CONFIRMED",
            urgency: "low",
            top_blocker: null,
            top_risk: null,
            top_alert: null,
            blocker_count: 0,
            priority_score: 40,
            hours_in_current_state: 12,
            issue_tags: [],
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("regiekamer-dominant-action")).toHaveAttribute("data-regiekamer-mode", "intervention");
    expect(screen.getByTestId("regiekamer-dominant-action")).toHaveTextContent(/intake-vertraging/i);
    expect(screen.getByTestId("regiekamer-dominant-primary-cta")).toHaveTextContent(/Bekijk intakecasussen/i);
  });

  it("filters the worklist client-side", async () => {
    const user = userEvent.setup();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Filters$/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Prioriteit" }), "critical");
    expect(await screen.findAllByTestId("regiekamer-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus A")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Prioriteit" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "intake");
    expect(await screen.findAllByTestId("regiekamer-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus C")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Rol" }), "regie");
    expect(await screen.findAllByTestId("regiekamer-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus B")).toBeInTheDocument();
  });

  it("renders the no-data empty state with werkvoorraad CTA when navigation is available", () => {
    const onAppNavigate = vi.fn();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
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

    render(<SystemAwarenessPage onCaseClick={vi.fn()} onAppNavigate={onAppNavigate} />);

    expect(screen.getByText("Geen actieve casussen.")).toBeInTheDocument();
    expect(
      screen.getByText(/Open de werkvoorraad voor bestaande dossiers/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open casussen" }));
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
  });

  it("renders Nieuwe casus on empty state when canCreateCase", () => {
    const onCreateCase = vi.fn();
    const onAppNavigate = vi.fn();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
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
      <SystemAwarenessPage
        onCaseClick={vi.fn()}
        onAppNavigate={onAppNavigate}
        canCreateCase
        onCreateCase={onCreateCase}
      />,
    );

    expect(screen.getByText(/maak een nieuwe casus aan/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nieuwe casus" }));
    expect(onCreateCase).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open casussen" }));
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
  });

  it("shows calm success when there are no operational blockers while still listing cases", () => {
    const onAppNavigate = vi.fn();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
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

    render(<SystemAwarenessPage onCaseClick={vi.fn()} onAppNavigate={onAppNavigate} />);

    expect(screen.getByTestId("regiekamer-calm-state")).toHaveTextContent("Geen operationele blokkades");
    expect(screen.getByTestId("regiekamer-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getAllByTestId("regiekamer-worklist-item")).toHaveLength(2);
    fireEvent.click(
      within(screen.getByTestId("regiekamer-phase-board")).getByRole("button", { name: /Bekijk gehele stroom/i }),
    );
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
  });

  it("uses canonical Aanbieder beoordeling in flow chain and phase filter", async () => {
    const user = userEvent.setup();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview({
        totals: {
          active_cases: 5,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          repeated_rejections: 0,
          intake_delays: 0,
        },
        items: [
          makeItem({
            case_id: 901,
            case_reference: "C-901",
            title: "Rustige keten",
            phase: "plaatsing",
            current_state: "PLACEMENT_CONFIRMED",
            urgency: "low",
            top_blocker: null,
            top_risk: null,
            top_alert: null,
            priority_score: 22,
            blocker_count: 0,
            risk_count: 0,
            alert_count: 0,
            issue_tags: [],
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("regiekamer-dominant-action")).toHaveAttribute("data-regiekamer-mode", "stable");
    expect(screen.getByTestId("regiekamer-phase-board")).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-phase-column-plaatsing_intake")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Filters$/i }));
    expect(screen.getByRole("option", { name: "In beoordeling" })).toBeInTheDocument();
  });

  it("renders crisis dominant NBA with Los blokkades op", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("regiekamer-dominant-action")).toHaveAttribute("data-regiekamer-mode", "crisis");
    expect(screen.getByTestId("regiekamer-dominant-primary-cta")).toHaveTextContent(/Los blokkades op/i);
  });

  it("renders critical alert regions with metric, text block, and actions", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("regiekamer-dominant-action-metric")).toHaveTextContent("1");
    expect(screen.getByTestId("regiekamer-dominant-action-content")).toHaveTextContent(/kritieke blokkades actief/i);
    expect(screen.getByTestId("regiekamer-dominant-action-content")).toHaveTextContent("1 casus — gemeentelijke actie nodig");
    expect(screen.getByTestId("regiekamer-dominant-action-actions")).toHaveTextContent("Los blokkades op");
  });

  it("places search and filters inside the Werkvoorraad section header", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    const workSection = screen.getByTestId("regiekamer-uitvoerlijst");
    expect(within(workSection).getByText("Werkvoorraad")).toBeInTheDocument();
    expect(within(workSection).getByTestId("care-search-control-stack")).toBeInTheDocument();
    expect(within(workSection).getByRole("searchbox", { name: /Zoek casussen, cliënten, aanbieders/i })).toBeInTheDocument();
    expect(within(workSection).getByRole("button", { name: /^Filters$/i })).toBeInTheDocument();
  });

  it("does not duplicate flow titles inside flow card body", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    const casusCard = screen.getByTestId("regiekamer-phase-column-casus_gestart");
    expect(within(casusCard).getAllByText("Casus gestart")).toHaveLength(1);
    expect(within(casusCard).getByText("Geblokkeerd")).toBeInTheDocument();
    expect(within(casusCard).queryByText("Klaar voor matching")).not.toBeInTheDocument();
  });

  it("supplemental NBA link describes in-page filters, not navigation to /casussen", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("regiekamer-dominant-cases-link")).toHaveTextContent(
      /Bekijk kritieke casussen \(1\)/,
    );
  });

  it("matching-urgenties tier uses filter-aligned primary label (no execution verbs)", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview({
        totals: {
          active_cases: 1,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          repeated_rejections: 0,
          intake_delays: 0,
        },
        items: [
          makeItem({
            case_id: 501,
            case_reference: "C-501",
            title: "Matching urgent",
            phase: "matching",
            urgency: "high",
            top_blocker: null,
            blocker_count: 0,
            risk_count: 0,
            alert_count: 1,
            issue_tags: ["alerts"],
            priority_score: 90,
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    const primary = screen.getByTestId("regiekamer-dominant-primary-cta");
    expect(primary).toHaveTextContent(/Bekijk matchingcasussen/i);
    expect(primary.textContent?.toLowerCase() ?? "").not.toMatch(/herstart/);
  });

  it("opens the existing case detail overlay by notifying the parent", () => {
    const onCaseClick = vi.fn();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={onCaseClick} />);

    const firstWorklistRow = screen.getAllByTestId("regiekamer-worklist-item")[0];
    fireEvent.click(firstWorklistRow);

    expect(onCaseClick).toHaveBeenCalledWith("101");
  });

  it("renders exactly one dominant primary CTA", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    expect(screen.getAllByTestId("regiekamer-dominant-primary-cta")).toHaveLength(1);
  });

  it("clicking a quick-link phase row applies the keten filter", async () => {
    const user = userEvent.setup();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    await user.click(screen.getByTestId("regiekamer-quick-phase-klaar_voor_matching"));
    await user.click(screen.getByRole("button", { name: /^Filters$/i }));

    expect(screen.getByRole("combobox", { name: "Stap in de keten" })).toHaveValue("klaar_voor_matching");
  });

  it("clicking a phase board column applies the phase filter", async () => {
    const user = userEvent.setup();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SystemAwarenessPage onCaseClick={vi.fn()} />);

    await user.click(screen.getByTestId("regiekamer-phase-column-in_beoordeling"));
    await user.click(screen.getByRole("button", { name: /^Filters$/i }));

    expect(screen.getByRole("combobox", { name: "Stap in de keten" })).toHaveValue("in_beoordeling");
  });
});
