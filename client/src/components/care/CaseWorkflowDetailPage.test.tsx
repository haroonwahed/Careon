import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SpaCase } from "../../hooks/useCases";
import type { DecisionEvaluation } from "../../lib/decisionEvaluation";
import { CaseWorkflowDetailPage } from "./CaseWorkflowDetailPage";

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
      {
        action: "CONFIRM_PLACEMENT",
        label: "Plaatsing bevestigen",
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

describe("CaseWorkflowDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads decision evaluation and shows the decision banner, timeline, and allowed actions", async () => {
    setupCase(makeDecisionEvaluation());

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Stuur naar aanbieder" })).toBeInTheDocument();
    expect(screen.getByText("Casuspad")).toBeInTheDocument();
    expect(screen.getByText("Blokkades")).toBeInTheDocument();
    expect(screen.getByText("Risico's")).toBeInTheDocument();
    expect(screen.getByText("Alerts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plaatsing bevestigen" })).toBeInTheDocument();
    expect(screen.getByText("Vereiste vorige stap: Plaatsing")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accepteren" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Afwijzen" })).not.toBeInTheDocument();
  });

  it("shows blockers, risks, alerts, and blocked action explanations", async () => {
    setupCase(makeDecisionEvaluation({
      blockers: [
        {
          code: "MISSING_SUMMARY",
          severity: "critical",
          message: "Samenvatting ontbreekt. Matching kan nog niet starten.",
          blocking_actions: ["START_MATCHING", "SEND_TO_PROVIDER"],
        },
      ],
      risks: [
        {
          code: "LOW_MATCH_CONFIDENCE",
          severity: "medium",
          message: "Match confidence is laag. Controleer match onderbouwing.",
          evidence: {},
        },
      ],
      alerts: [
        {
          code: "PROVIDER_REVIEW_PENDING_SLA",
          severity: "high",
          title: "Aanbieder beoordeling wacht te lang",
          message: "De aanbieder heeft nog niet gereageerd.",
          recommended_action: "FOLLOW_UP_PROVIDER",
          evidence: {},
        },
      ],
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByText("Samenvatting ontbreekt. Matching kan nog niet starten.")).toBeInTheDocument();
    expect(screen.getAllByText("Match confidence is laag. Controleer match onderbouwing.").length).toBeGreaterThan(0);
    expect(screen.getByText("Aanbieder beoordeling wacht te lang")).toBeInTheDocument();
    expect(screen.getByText("Blokkeert: Matching starten")).toBeInTheDocument();
  });

  it("respects role-specific action visibility", async () => {
    setupCase(
      makeDecisionEvaluation({
        allowed_actions: [
          {
            action: "PROVIDER_ACCEPT",
            label: "Accepteren",
            allowed: true,
          },
          {
            action: "PROVIDER_REJECT",
            label: "Afwijzen",
            allowed: true,
          },
          {
            action: "PROVIDER_REQUEST_INFO",
            label: "Meer informatie vragen",
            allowed: true,
          },
        ],
        next_best_action: {
          action: "PROVIDER_ACCEPT",
          label: "Accepteren",
          priority: "high",
          reason: "De aanbieder kan nu besluiten.",
        },
      }),
    );

    render(<CaseWorkflowDetailPage caseId="C-100" role="zorgaanbieder" onBack={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Accepteren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Afwijzen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plaatsing bevestigen" })).not.toBeInTheDocument();
  });

  it("refetches decision evaluation after a successful action", async () => {
    setupCase(makeDecisionEvaluation());

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    const actionButton = await screen.findByRole("button", { name: "Stuur naar aanbieder" });
    fireEvent.click(actionButton);

    await waitFor(() => {
      expect(mockExecuteCaseAction).toHaveBeenCalledWith(
        "C-100",
        "SEND_TO_PROVIDER",
        expect.objectContaining({
          role: "gemeente",
        }),
      );
    });

    await waitFor(() => {
      expect(mockFetchCaseDecisionEvaluation).toHaveBeenCalledTimes(2);
    });
  });

  it("surfaces backend action errors in the casus detail surface", async () => {
    setupCase(makeDecisionEvaluation());
    mockExecuteCaseAction.mockRejectedValueOnce(new Error("Actie niet toegestaan."));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    const actionButton = await screen.findByRole("button", { name: "Stuur naar aanbieder" });
    fireEvent.click(actionButton);

    expect((await screen.findAllByText("Actie niet toegestaan."))[0]).toBeInTheDocument();
  });
});
