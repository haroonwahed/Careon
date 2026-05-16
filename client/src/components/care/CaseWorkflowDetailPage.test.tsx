import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { DecisionEvaluation } from "../../lib/decisionEvaluation";
import { expectCasusDetailMode } from "../../test/utils/modeGuards";
import { CaseExecutionPage } from "./CaseExecutionPage";

const mockUseCases = vi.fn();
const mockFetchCaseDecisionEvaluation = vi.fn();
const mockExecuteCaseAction = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../lib/decisionEvaluation", async () => {
  const actual = await vi.importActual<typeof import("../../lib/decisionEvaluation")>("../../lib/decisionEvaluation");
  return {
    ...actual,
    fetchCaseDecisionEvaluation: (...args: unknown[]) => mockFetchCaseDecisionEvaluation(...args),
    fetchCaseArrangementAlignment: vi.fn().mockResolvedValue({
      case_id: "C-100",
      generated_at: "2026-05-11T00:00:00Z",
      equivalence_hints: [
        {
          source_label: "PGB",
          target_label: "Referentie (test)",
          equivalence_confidence: 0.5,
          rationale: "Teststub voor arrangement-advies.",
          uncertainty: "high",
        },
      ],
      tariff_alignment: {
        estimated_delta_pct: null,
        notes: "Teststub.",
        uncertainty: "high",
      },
      requires_human_confirmation: true,
    }),
  };
});

vi.mock("../../lib/caseDecisionActions", () => ({
  executeCaseAction: (...args: unknown[]) => mockExecuteCaseAction(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function makeCase(overrides: Partial<SpaCase> = {}): SpaCase {
  return {
    id: "C-100",
    title: "Pilot casus",
    regio: "Utrecht",
    zorgtype: "Ambulante zorg",
    wachttijd: 8,
    status: "matching",
    urgency: "warning",
    problems: [],
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

function makeDecisionEvaluation(overrides: Partial<DecisionEvaluation> = {}): DecisionEvaluation {
  return {
    case_id: "C-100",
    current_state: "MATCHING_READY",
    phase: "matching",
    coverage_basis: "geo_distance",
    coverage_status: "inside_radius",
    factor_breakdown: {
      specialization: 0.91,
      capacity: 0.87,
      region: 0.84,
      urgency: 0.82,
      complexity: 0.85,
    },
    weaknesses: [],
    tradeoffs: [],
    confidence_score: 0.84,
    confidence_reason: "De match is goed onderbouwd met stabiele factoren.",
    warning_flags: {
      specialization_gap: false,
      urgency_mismatch: false,
    },
    verification_guidance: [],
    next_best_action: {
      action: "SEND_TO_PROVIDER",
      label: "Stuur naar aanbieder",
      priority: "high",
      reason: "De samenvatting is compleet en de aanbieder kan nu beoordelen.",
    },
    blockers: [],
    risks: [],
    alerts: [],
    allowed_actions: [
      {
        action: "SEND_TO_PROVIDER",
        label: "Stuur naar aanbieder",
        allowed: true,
      },
    ],
    blocked_actions: [
      {
        action: "START_INTAKE",
        label: "Intake starten",
        reason: "Intake kan pas starten nadat plaatsing is bevestigd.",
        allowed: false,
      },
    ],
    decision_context: {
      required_data_complete: true,
      has_summary: true,
      has_matching_result: true,
      latest_match_confidence: 0.84,
      provider_review_status: "PENDING",
      provider_rejection_count: 0,
      latest_rejection_reason: "",
      placement_confirmed: false,
      intake_started: false,
      case_age_hours: 18,
      hours_in_current_state: 4,
      urgency: "warning",
      capacity_signals: [],
      selected_provider_id: "P-1",
      selected_provider_name: "Zorgaanbieder A",
    },
    timeline_signals: {
      latest_event_type: "STATE_TRANSITION",
      latest_event_at: "2026-04-25T10:00:00Z",
      recent_events: [
        {
          event_type: "STATE_TRANSITION",
          user_action: "Matching gestart",
          timestamp: "2026-04-25T09:45:00Z",
          action_source: "ui",
        },
      ],
    },
    ...overrides,
  };
}

function setupCase(detail: DecisionEvaluation) {
  mockUseCases.mockReturnValue({
    cases: [makeCase()],
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  mockFetchCaseDecisionEvaluation.mockResolvedValue(detail);
  mockExecuteCaseAction.mockResolvedValue({ kind: "mutation", message: "Actie uitgevoerd." });
}

describe("CaseExecutionPage workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders focused decision workspace structure", async () => {
    setupCase(makeDecisionEvaluation());
    const { container } = render(<CaseExecutionPage caseId="C-100" onBack={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Terug naar casussen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Casusacties" })).toBeInTheDocument();
    expect(await screen.findByText(/Bijgewerkt:/)).toBeInTheDocument();
    expect(await screen.findByText("Operationele keten")).toBeInTheDocument();
    expect(screen.getByTestId("casus-hero-band")).toBeInTheDocument();
    const heroBand = screen.getByTestId("casus-hero-band");
    expect(within(heroBand).getByRole("button", { name: /Start matching|Stuur naar aanbieder/i })).toBeInTheDocument();
    expect(screen.getAllByText("Casusacties").length).toBeGreaterThanOrEqual(1);
    expect(container.innerHTML).not.toContain("mx-auto max-w-[1440px]");
    expect(container.innerHTML).not.toContain(`#${"111827"}`);
    expect(container.innerHTML).not.toContain(`#${"080E1A"}`);
  });

  it("does not render global KPI labels on casus detail while keeping execution sections", async () => {
    setupCase(makeDecisionEvaluation({
      blockers: [
        {
          code: "MISSING_SUMMARY",
          severity: "critical",
          message: "Samenvatting ontbreekt. Matching kan nog niet starten.",
          blocking_actions: ["START_MATCHING"],
        },
      ],
    }));

    render(<CaseExecutionPage caseId="C-100" onBack={vi.fn()} />);

    expectCasusDetailMode();
    expect(screen.getByTestId("casus-hero-band")).toBeInTheDocument();
    expect(screen.getByText("Operationele keten")).toBeInTheDocument();
    expect((await screen.findAllByText("Casusgegevens onvolledig")).length).toBeGreaterThan(0);
    expect(screen.getByText("Matching nog niet gestart.")).toBeInTheDocument();
    const heroBand = screen.getByTestId("casus-hero-band");
    expect(within(heroBand).getByRole("button", { name: /Start matching|Controleer casusstatus/i })).toBeInTheDocument();
    expect(screen.queryByTestId("worklist")).not.toBeInTheDocument();

    expect(screen.queryByText("Casussen")).not.toBeInTheDocument();
    expect(screen.queryByText("Blokkades")).not.toBeInTheDocument();
    expect(screen.queryByText("Alerts")).not.toBeInTheDocument();
    expect(screen.queryByText("SLA")).not.toBeInTheDocument();
    expect(screen.queryByText("Afwijzingen")).not.toBeInTheDocument();
    expect(screen.getByText("Plaatsing & uitstroom")).toBeInTheDocument();
  });

  it("shows dominant blocked state and missing-summary guidance", async () => {
    setupCase(makeDecisionEvaluation({
      current_state: "DRAFT_CASE",
      blockers: [
        {
          code: "MISSING_SUMMARY",
          severity: "critical",
          message: "Samenvatting ontbreekt. Matching kan nog niet starten.",
          blocking_actions: ["START_MATCHING", "SEND_TO_PROVIDER"],
        },
      ],
      next_best_action: {
        action: "GENERATE_SUMMARY",
        label: "Vul casus aan",
        priority: "high",
        reason: "Samenvatting ontbreekt.",
      },
      allowed_actions: [],
    }));

    render(<CaseExecutionPage caseId="C-100" onBack={vi.fn()} />);
    expect((await screen.findAllByText("Casusgegevens onvolledig")).length).toBeGreaterThan(0);
    expect(screen.getByText("Matching nog niet gestart.")).toBeInTheDocument();
  });

  it("keeps metadata row visible for decision context cases", async () => {
    setupCase(makeDecisionEvaluation({
      confidence_score: 0.52,
      confidence_reason: "Confidence is laag.",
      warning_flags: { specialization_gap: true, urgency_mismatch: false },
      decision_context: {
        ...makeDecisionEvaluation().decision_context,
        provider_rejection_count: 2,
        latest_rejection_reason: "Regio past niet.",
        urgency: "critical",
      },
      alerts: [
        {
          code: "PROVIDER_REVIEW_PENDING_SLA",
          severity: "high",
          title: "SLA-risico",
          message: "Reactietijd overschreden.",
          recommended_action: "REMATCH_CASE",
          evidence: {},
        },
      ],
    }));

    render(<CaseExecutionPage caseId="C-100" onBack={vi.fn()} />);
    expect(await screen.findByText("Kerngegevens")).toBeInTheDocument();
    expect(screen.getByText("Actiehouder")).toBeInTheDocument();
    expect(screen.getByText("Aandachtspunten")).toBeInTheDocument();
  });

  it("keeps primary action wired to existing action executor", async () => {
    setupCase(makeDecisionEvaluation());
    render(<CaseExecutionPage caseId="C-100" onBack={vi.fn()} />);

    const heroBand = screen.getByTestId("casus-hero-band");
    const primaryButtons = await within(heroBand).findAllByRole("button", { name: /Start matching|Stuur naar aanbieder/i });
    const clickable = primaryButtons.filter((button) => !button.hasAttribute("disabled"));
    expect(clickable.length).toBeGreaterThan(0);
    fireEvent.click(clickable[0]);

    await waitFor(() => {
      expect(mockExecuteCaseAction).toHaveBeenCalledWith(
        "C-100",
        "SEND_TO_PROVIDER",
        expect.objectContaining({ role: "gemeente" }),
      );
    });
  });
});
