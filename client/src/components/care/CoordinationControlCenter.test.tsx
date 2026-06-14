// @ts-nocheck
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import type { CoordinationDecisionOverview } from "../../lib/coordinationDecisionOverview";
import { expectCoordinationMode } from "../../test/utils/modeGuards";
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

  it("loads the overview and renders Doorstroom and Werkvoorraad", () => {
  mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /^Regiekamer$/i })).toBeInTheDocument();
    expect(screen.getByTestId("coordination-phase-board")).toBeInTheDocument();
    expect(screen.getByTestId("coordination-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getByText("Doorstroom")).toBeInTheDocument();
    expect(screen.getByText("Werkvoorraad")).toBeInTheDocument();
    expect(screen.getByText("Actuele casussen die jouw aandacht vragen.")).toBeInTheDocument();
  });

  it("enforces coordination screen responsibility boundaries", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expectCoordinationMode();
    expect(screen.getByTestId("coordination-phase-board")).toBeInTheDocument();
    expect(screen.getByTestId("coordination-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filters$/i })).toBeInTheDocument();
    expect(screen.getByTestId("coordination-dominant-action")).toHaveAttribute("data-coordination-mode", "crisis");
    expect(screen.getByTestId("coordination-dominant-primary-cta")).toHaveTextContent(/Los kritieke blokkades op/i);

    expect(screen.queryByText(/Casusdetail|Case detail/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Genereer samenvatting" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Context$/)).not.toBeInTheDocument();
  });

  it("describes operationele coördinatie as an operational workspace and keeps the dominant action singular", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /^Regiekamer$/i })).toBeInTheDocument();
    expect(screen.getByText("Stuur op doorstroom, blokkades en urgente casussen.")).toBeInTheDocument();
    expect(screen.getAllByTestId("coordination-dominant-primary-cta")).toHaveLength(1);
    expect(screen.getByTestId("coordination-phase-board")).toBeInTheDocument();
    expect(screen.queryByText("Eigenaarschap volgt de taak")).not.toBeInTheDocument();
  });

  it("renders the doorstroom board with the Regiekamer flow steps", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("coordination-phase-board")).toBeInTheDocument();
    expect(screen.getByText("Doorstroom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bekijk gehele stroom/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Matching.*Klaar om te starten.*1/i })).toBeInTheDocument();
  });

  it("renders the priority worklist in score order", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    const rows = screen.getAllByTestId("coordination-worklist-item");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Casus A");
    expect(rows[0]).toHaveTextContent("Spoed");
    expect(rows[0]).toHaveTextContent("Wacht op gemeente");
    expect(rows[0]).toHaveTextContent("Vraag reactie aan");
  });

  it("renders compact card content on each worklist card", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    const first = screen.getAllByTestId("coordination-worklist-item")[0];
    expect(within(first).getByText("Casus A")).toBeInTheDocument();
    expect(first).toHaveTextContent("Regio ontbreekt");
    expect(first).toHaveTextContent("Samenvatting is compleet");
    expect(first).toHaveTextContent("2 dagen geleden");
    expect(first).toHaveTextContent("Vraag reactie aan");
    expect(within(first).getByRole("button", { name: /Vraag reactie aan/i })).toBeInTheDocument();
  });

  it("replaces visible gemeentevalidatie copy with neutral operational terminology", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        items: [
          makeItem({
            case_id: 104,
            case_reference: "C-104",
            title: "Casus D",
            phase: "matching",
            next_best_action: {
              action: "VALIDATE_MATCHING",
              label: "Valideer match",
              priority: "high",
              reason: "Gemeentevalidatie is verplicht vóór versturen naar aanbieder.",
            },
            top_blocker: {
              code: "GEMEENTE_VALIDATION_REQUIRED",
              severity: "critical",
              message: "Gemeentevalidatie is verplicht vóór versturen naar aanbieder.",
              blocking_actions: ["VALIDATE_MATCHING"],
            },
            top_alert: null,
            top_risk: null,
            issue_tags: ["blockers"],
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.queryByText(/Gemeentevalidatie/i)).not.toBeInTheDocument();
    const row = screen.getByTestId("coordination-worklist-item");
    expect(row).toHaveTextContent("Goedkeuring nodig vóór versturen naar aanbieder.");
    expect(within(row).getByRole("button", { name: /Controleer voorstel/i })).toBeInTheDocument();
  });

  it("uses an operational fallback when recent activity is unavailable", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        generated_at: "",
        items: [
          makeItem({
            case_id: 105,
            case_reference: "C-105",
            title: "Casus E",
            phase: "matching",
            hours_in_current_state: null,
            age_hours: null,
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    const row = screen.getByTestId("coordination-worklist-item");
    expect(row).toHaveTextContent("Geen recente activiteit");
    expect(within(row).queryByText("Onbekend")).not.toBeInTheDocument();
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

  it("uses summary CTA variants for existing, missing, and pending summary states", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
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
              action: "GENERATE_SUMMARY",
              label: "Wacht op verwerking",
              priority: "medium",
              reason: "Samenvatting wordt verwerkt.",
            },
            top_blocker: {
              code: "MISSING_SUMMARY",
              severity: "high",
              message: "Samenvatting wordt gemaakt.",
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

    expect(screen.getByRole("button", { name: "Vraag reactie aan" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Maak casus compleet" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Zorgvraag wordt automatisch verwerkt/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Generatie vereist/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Samenvatting wordt verwerkt/i).length).toBeGreaterThan(0);
  });

  it("surfaces intake delay as dominant action when it is the top scenario", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
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

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("coordination-dominant-action")).toHaveAttribute("data-coordination-mode", "intervention");
    expect(screen.getByTestId("coordination-dominant-action")).toHaveTextContent(/intake-vertraging/i);
    expect(screen.getByTestId("coordination-dominant-primary-cta")).toHaveTextContent(/Bekijk intake-aanvragen/i);
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
    fireEvent.click(screen.getByRole("button", { name: "Nieuwe casus" }));
    expect(onCreateCase).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Open aanvragen" }));
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
  });

  it("shows calm success when there are no operational blockers while still listing cases", () => {
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

    expect(screen.getByTestId("coordination-dominant-action")).toHaveAttribute("data-coordination-mode", "stable");
    expect(screen.getByTestId("coordination-uitvoerlijst")).toBeInTheDocument();
    expect(screen.getAllByTestId("coordination-worklist-item")).toHaveLength(2);
    fireEvent.click(
      within(screen.getByTestId("coordination-phase-board")).getByRole("button", { name: /Bekijk gehele stroom/i }),
    );
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
    // The button should hand off a "pipeline" focus hint so the worklist opens
    // operationally distinct from a plain /casussen navigation and from the
    // critical-cases shortcut. (One-shot, scoped to sessionStorage.)
    expect(window.sessionStorage.getItem("careon.casussen.preferredFocus")).toBe("pipeline");
    window.sessionStorage.removeItem("careon.casussen.preferredFocus");
  });

  it("uses canonical aanbieder-reacties label in flow chain and phase filter", async () => {
    const user = userEvent.setup();
    mockUseCoordinationDecisionOverview.mockReturnValue({
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

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("coordination-dominant-action")).toHaveAttribute("data-coordination-mode", "stable");
    expect(screen.getByTestId("coordination-phase-board")).toBeInTheDocument();
    expect(screen.getByTestId("coordination-phase-column-aanbiederreactie")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Filters$/i }));
    expect(screen.getByRole("option", { name: "Aanbiederreactie" })).toBeInTheDocument();
  });

  it("renders crisis dominant NBA with open-requests emphasis", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("coordination-dominant-action")).toHaveAttribute("data-coordination-mode", "crisis");
    expect(screen.getByTestId("coordination-dominant-primary-cta")).toHaveTextContent(/Los kritieke blokkades op/i);
  });

  it("renders critical alert regions with metric, text block, and actions", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getByTestId("coordination-dominant-action-content")).toHaveTextContent(/verhoogde coördinatie-aandacht/i);
    expect(screen.getByTestId("coordination-dominant-action-content")).toHaveTextContent("1 casus blokkeert de doorstroom");
    expect(screen.getByTestId("coordination-dominant-action-actions")).toHaveTextContent("Los kritieke blokkades op");
    expect(screen.getByTestId("coordination-dominant-action-actions")).toHaveTextContent("SLA-signalen bekijken");
  });

  it("places search and filters inside the Werkvoorraad section header", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    const workSection = screen.getByTestId("coordination-uitvoerlijst");
    expect(within(workSection).getByText("Werkvoorraad")).toBeInTheDocument();
    expect(within(workSection).getByTestId("care-search-control-stack")).toBeInTheDocument();
    expect(within(workSection).getByRole("searchbox", { name: /Zoek casussen, regio's, aanbieders/i })).toBeInTheDocument();
    expect(within(workSection).getByRole("button", { name: /^Filters$/i })).toBeInTheDocument();
  });

  it("keeps the flow card body focused on the active step only", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    const casusCard = screen.getByTestId("coordination-phase-column-aanmelding");
    expect(within(casusCard).getAllByText("Aanmelding")).toHaveLength(1);
    expect(within(casusCard).getByText("0")).toBeInTheDocument();
    expect(within(casusCard).queryByText("Aanbiederreactie")).not.toBeInTheDocument();
  });

  it("supplemental NBA link navigates to /casussen with a critical focus hand-off", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const onAppNavigate = vi.fn();
    try {
      window.sessionStorage.removeItem("careon.casussen.preferredFocus");
    } catch {
      // sessionStorage may be unavailable in some environments; ignore.
    }

    render(<CoordinationControlCenter onCaseClick={vi.fn()} onAppNavigate={onAppNavigate} />);

    expect(screen.queryByTestId("coordination-dominant-cases-link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("coordination-dominant-primary-cta"));
    expect(onAppNavigate).toHaveBeenCalledWith("/casussen");
    expect(window.sessionStorage.getItem("careon.casussen.preferredFocus")).toBe("critical");

    // Cleanup so subsequent tests start without lingering hand-off.
    window.sessionStorage.removeItem("careon.casussen.preferredFocus");
  });

  it("matching-urgenties tier uses filter-aligned primary label (no execution verbs)", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
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

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    const primary = screen.getByTestId("coordination-dominant-primary-cta");
    expect(primary).toHaveTextContent(/Bekijk matching-aanvragen/i);
    expect(primary.textContent?.toLowerCase() ?? "").not.toMatch(/herstart/);
  });

  it("opens the existing case detail overlay by notifying the parent", () => {
    const onCaseClick = vi.fn();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={onCaseClick} />);

    const firstWorklistRow = screen.getAllByTestId("coordination-worklist-item")[0];
    fireEvent.click(within(firstWorklistRow).getAllByRole("button")[0]);

    expect(onCaseClick).toHaveBeenCalledWith("101");
  });

  it("renders exactly one dominant primary CTA", () => {
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    expect(screen.getAllByTestId("coordination-dominant-primary-cta")).toHaveLength(1);
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

  it("clicking a quick-link phase row applies the keten filter", async () => {
    const user = userEvent.setup();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    await user.click(screen.getByTestId("coordination-phase-column-matching"));
    await user.click(screen.getByRole("button", { name: /^Filters$/i }));

    expect(screen.getByRole("combobox", { name: "Stap in de keten" })).toHaveValue("matching");
  });

  it("clicking a phase board column applies the phase filter", async () => {
    const user = userEvent.setup();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview(),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    await user.click(screen.getByTestId("coordination-phase-column-aanbiederreactie"));
    await user.click(screen.getByRole("button", { name: /^Filters$/i }));

    expect(screen.getByRole("combobox", { name: "Stap in de keten" })).toHaveValue("aanbiederreactie");
  });

  it("filters coordination rows by zorgbehoefte categorie and subcategorie", async () => {
    const user = userEvent.setup();
    mockUseCoordinationDecisionOverview.mockReturnValue({
      data: makeOverview({
        items: [
          makeItem(),
          makeItem({
            case_id: 104,
            case_reference: "C-104",
            title: "Casus D",
            zorgbehoefte_categorie: "Veiligheid & bescherming",
            zorgbehoefte_categorie_code: "VEILIGHEID_BESCHERMING",
            zorgbehoefte_specifiek: "Acute veiligheid",
            zorgbehoefte_specifiek_code: "VEILIGHEID_BESCHERMING_ACUTE_VEILIGHEID",
            taxonomie_lijn: "Taxonomie: Veiligheid & bescherming → Acute veiligheid",
            taxonomie_code_lijn: "Taxonomiecode: VEILIGHEID_BESCHERMING → VEILIGHEID_BESCHERMING_ACUTE_VEILIGHEID",
          }),
        ],
      }),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<CoordinationControlCenter onCaseClick={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /^Filters$/i }));
    expect(screen.getByLabelText("Zorgbehoefte categorie")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Zorgbehoefte categorie"), "VEILIGHEID_BESCHERMING");
    expect(screen.getByLabelText("Specifieke zorgbehoefte")).not.toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Specifieke zorgbehoefte"), "VEILIGHEID_BESCHERMING_ACUTE_VEILIGHEID");

    expect(screen.getByText("Casus D")).toBeInTheDocument();
    expect(screen.queryByText("Casus A")).not.toBeInTheDocument();
  });
});
