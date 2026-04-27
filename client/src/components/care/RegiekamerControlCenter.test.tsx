import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import type { RegiekamerDecisionOverview } from "../../lib/regiekamerDecisionOverview";
import { RegiekamerControlCenter } from "./RegiekamerControlCenter";

const mockUseRegiekamerDecisionOverview = vi.fn();

vi.mock("../../hooks/useRegiekamerDecisionOverview", () => ({
  useRegiekamerDecisionOverview: () => mockUseRegiekamerDecisionOverview(),
}));

function makeItem(overrides: Partial<RegiekamerDecisionOverview["items"][number]> = {}) {
  return {
    case_id: 101,
    case_reference: "#101",
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
        case_reference: "#102",
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
        case_reference: "#103",
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

describe("RegiekamerControlCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the overview and renders the summary cards", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RegiekamerControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Regiekamer" })).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-summary-active")).toBeInTheDocument();
    expect(screen.getByTestId("regiekamer-summary-critical")).toHaveTextContent("1");
    expect(screen.getByTestId("regiekamer-summary-alerts")).toHaveTextContent("1");
  });

  it("renders the priority worklist in score order", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RegiekamerControlCenter onCaseClick={vi.fn()} />);

    const rows = screen.getAllByTestId("regiekamer-worklist-item");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Casus A");
    expect(rows[0]).toHaveTextContent("Prioriteitsscore");
  });

  it("renders probleem, impact, eigenaar en vereiste actie on each worklist card", () => {
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RegiekamerControlCenter onCaseClick={vi.fn()} />);

    const first = screen.getAllByTestId("regiekamer-worklist-item")[0];
    expect(within(first).getByText("Probleem")).toBeInTheDocument();
    expect(within(first).getByText("Impact")).toBeInTheDocument();
    expect(within(first).getByText("Eigenaar")).toBeInTheDocument();
    expect(within(first).getByText("Vereiste actie")).toBeInTheDocument();
    expect(first).toHaveTextContent("Gemeente");
    expect(first).toHaveTextContent("Stuur naar aanbieder");
    expect(first).toHaveTextContent("Samenvatting is compleet.");
  });

  it("filters the worklist client-side", async () => {
    const user = userEvent.setup();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RegiekamerControlCenter onCaseClick={vi.fn()} />);

    await user.selectOptions(screen.getByRole("combobox", { name: "Prioriteit" }), "critical");
    expect(await screen.findAllByTestId("regiekamer-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus A")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Prioriteit" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Issue type" }), "intake");
    expect(await screen.findAllByTestId("regiekamer-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus C")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Issue type" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Rol ownership" }), "regie");
    expect(await screen.findAllByTestId("regiekamer-worklist-item")).toHaveLength(1);
    expect(screen.getByText("Casus B")).toBeInTheDocument();
  });

  it("renders the no-data empty state", () => {
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

    render(<RegiekamerControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByText("Geen actieve casussen.")).toBeInTheDocument();
  });

  it("renders the no-issues empty state", () => {
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
            priority_score: 0,
            top_blocker: null,
            top_risk: null,
            top_alert: null,
            issue_tags: [],
          }),
          makeItem({
            case_id: 104,
            case_reference: "#104",
            title: "Casus D",
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

    render(<RegiekamerControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByText("Geen signalen.")).toBeInTheDocument();
    expect(screen.getByText("De keten loopt zonder blokkades.")).toBeInTheDocument();
  });

  it("opens the existing case detail overlay by notifying the parent", () => {
    const onCaseClick = vi.fn();
    mockUseRegiekamerDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<RegiekamerControlCenter onCaseClick={onCaseClick} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Bekijk detail" })[0]);

    expect(onCaseClick).toHaveBeenCalledWith("101");
  });
});
