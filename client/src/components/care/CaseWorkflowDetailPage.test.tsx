import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByRole("button", { name: "Bevestig" })).toBeInTheDocument();
    expect(screen.getByText("Vorige stap: Plaatsing")).toBeInTheDocument();
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

    expect((await screen.findAllByText(/Samenvatting ontbreekt/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Match confidence is laag. Controleer match onderbouwing.").length).toBeGreaterThan(0);
    expect(screen.getByText("Aanbieder beoordeling wacht te lang")).toBeInTheDocument();
    expect(screen.getByText("Blokkeert: Matching starten")).toBeInTheDocument();
  });

  it("renders missing-data checklist and disables primary CTA when blockers exist", async () => {
    setupCase(makeDecisionEvaluation({
      blockers: [
        {
          code: "INCOMPLETE_CASE",
          severity: "high",
          message: "Casus is nog niet compleet.",
          blocking_actions: ["GENERATE_SUMMARY"],
        },
      ],
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByTestId("missing-data-checklist")).toBeInTheDocument();
    expect(screen.getByText("Vul ontbrekende casusgegevens aan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stuur naar aanbieder" })).toBeDisabled();
    expect(screen.getByText("Los eerst de open blokkades op via de checklist.")).toBeInTheDocument();
  });

  it("renders geo confidence badge for distance-based coverage", async () => {
    setupCase(makeDecisionEvaluation({
      coverage_basis: "geo_distance",
      coverage_status: "inside_radius",
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);
    expect(await screen.findByText("Distance-based")).toBeInTheDocument();
  });

  it("renders geo confidence badge for region fallback coverage", async () => {
    setupCase(makeDecisionEvaluation({
      coverage_basis: "region_fallback",
      coverage_status: "region_fallback_match",
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);
    expect(await screen.findByText("Region fallback")).toBeInTheDocument();
  });

  it("renders geo confidence badge for unknown coverage", async () => {
    setupCase(makeDecisionEvaluation({
      coverage_basis: "unknown",
      coverage_status: "unknown",
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);
    expect(await screen.findByText("Geo unknown")).toBeInTheDocument();
  });

  it("renders low-confidence panel and keeps CTA enabled when no hard blockers exist", async () => {
    setupCase(makeDecisionEvaluation({
      confidence_score: 0.52,
      confidence_reason: "Confidence is laag door beperkte dekking en specialistische mismatch.",
      blockers: [],
      warning_flags: {
        specialization_gap: true,
        urgency_mismatch: false,
      },
      factor_breakdown: {
        specialization: 0.41,
        capacity: 0.82,
        region: 0.54,
        urgency: 0.79,
        complexity: 0.77,
      },
      weaknesses: [
        "Specialisatie sluit niet volledig aan.",
        "Regionale dekking is beperkt.",
      ],
      verification_guidance: [
        "Verifieer specialistische dekking met aanbieder.",
        "Controleer reisafstand met gezin.",
        "Leg risicoweging vast.",
      ],
      tradeoffs: [
        "Hogere kwaliteit maar langere reistijd.",
        "Sneller beschikbaar maar minder specialistisch profiel.",
        "Reserveoptie met lagere fitscore.",
      ],
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByTestId("low-confidence-panel")).toBeInTheDocument();
    expect(screen.getByText("Waarom extra controleren?")).toBeInTheDocument();
    expect(screen.getByText("Confidence is laag door beperkte dekking en specialistische mismatch.")).toBeInTheDocument();
    expect(screen.getByText(/Specialisatie \(41%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Regio \(54%\)/)).toBeInTheDocument();
    expect(screen.getByText(/Verifieer specialistische dekking/)).toBeInTheDocument();
    expect(screen.getByText(/Controleer reisafstand met gezin/)).toBeInTheDocument();
    expect(screen.queryByText("Leg risicoweging vast.")).not.toBeInTheDocument();
    expect(screen.getByText(/Hogere kwaliteit maar langere reistijd/)).toBeInTheDocument();
    expect(screen.getByText(/Sneller beschikbaar maar minder specialistisch profiel/)).toBeInTheDocument();
    expect(screen.queryByText("Reserveoptie met lagere fitscore.")).not.toBeInTheDocument();
    expect(screen.getByText("Controleer deze punten vóór versturen naar aanbieder.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stuur naar aanbieder" })).toBeEnabled();
  });

  it("does not render low-confidence panel for strong confidence without warnings", async () => {
    setupCase(makeDecisionEvaluation({
      confidence_score: 0.89,
      weaknesses: [],
      warning_flags: {
        specialization_gap: false,
        urgency_mismatch: false,
      },
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Stuur naar aanbieder" })).toBeInTheDocument();
    expect(screen.queryByTestId("low-confidence-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("Waarom extra controleren?")).not.toBeInTheDocument();
  });

  it("renders rejection-loop coach after repeated provider rejection", async () => {
    setupCase(makeDecisionEvaluation({
      decision_context: {
        ...makeDecisionEvaluation().decision_context,
        provider_rejection_count: 3,
        latest_rejection_reason: "Onvoldoende specialistische expertise voor deze casus.",
      },
      next_best_action: {
        action: "REMATCH_CASE",
        label: "Her-matchen",
        priority: "high",
        reason: "Herhaal matching met aangepaste context.",
      },
      alerts: [
        {
          code: "PROVIDER_REVIEW_PENDING_SLA",
          severity: "high",
          title: "Aanbieder beoordeling wacht te lang",
          message: "Opvolging nodig.",
          recommended_action: "REMATCH_CASE",
          evidence: {},
        },
      ],
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByTestId("rejection-loop-panel")).toBeInTheDocument();
    expect(screen.getByText("Waarom loopt deze casus vast?")).toBeInTheDocument();
    expect(screen.getByText("Afwijzingen door aanbieders: 3")).toBeInTheDocument();
    expect(screen.getByText(/Laatste reden: Onvoldoende specialistische expertise/)).toBeInTheDocument();
    expect(screen.getByText(/Patroon: specialistische match is nog onvoldoende overtuigend/)).toBeInTheDocument();
    expect(screen.getByText(/Verrijk casusgegevens/)).toBeInTheDocument();
    expect(screen.getByText(/Controleer zorgvorm/)).toBeInTheDocument();
    expect(screen.getByText("Voorkom herhaling: kies eerst een gerichte interventie.")).toBeInTheDocument();
  });

  it("does not render rejection-loop coach without rejection loop signals", async () => {
    setupCase(makeDecisionEvaluation({
      decision_context: {
        ...makeDecisionEvaluation().decision_context,
        provider_rejection_count: 1,
        latest_rejection_reason: "",
      },
      risks: [],
      alerts: [],
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Stuur naar aanbieder" })).toBeInTheDocument();
    expect(screen.queryByTestId("rejection-loop-panel")).not.toBeInTheDocument();
  });

  it("keeps CTA governed by existing rules during rejection loop guidance", async () => {
    setupCase(makeDecisionEvaluation({
      blockers: [],
      decision_context: {
        ...makeDecisionEvaluation().decision_context,
        provider_rejection_count: 2,
        latest_rejection_reason: "Regio past niet bij aanbieder.",
      },
      next_best_action: {
        action: "SEND_TO_PROVIDER",
        label: "Stuur naar aanbieder",
        priority: "high",
        reason: "Nieuwe selectie kan worden aangeboden.",
      },
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByTestId("rejection-loop-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stuur naar aanbieder" })).toBeEnabled();
  });

  it("renders time-pressure strip for high urgency and shows owner/action/reason", async () => {
    setupCase(makeDecisionEvaluation({
      decision_context: {
        ...makeDecisionEvaluation().decision_context,
        urgency: "critical",
      },
      blockers: [],
      next_best_action: {
        action: "SEND_TO_PROVIDER",
        label: "Stuur naar aanbieder",
        priority: "high",
        reason: "Urgente casus vraagt directe opvolging.",
      },
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    const strip = await screen.findByTestId("time-pressure-strip");
    expect(strip).toBeInTheDocument();
    expect(within(strip).getByText("Tijdkritische casus")).toBeInTheDocument();
    expect(within(strip).getByText(/Eigenaar:/)).toBeInTheDocument();
    expect(within(strip).getByText(/Volgende stap:/)).toBeInTheDocument();
    expect(within(strip).getByText(/Urgente casus vraagt directe opvolging/)).toBeInTheDocument();
  });

  it("renders time-pressure strip for SLA risk", async () => {
    setupCase(makeDecisionEvaluation({
      decision_context: {
        ...makeDecisionEvaluation().decision_context,
        urgency: "normal",
        hours_in_current_state: 80,
      },
      next_best_action: {
        action: "MONITOR_CASE",
        label: "Casus monitoren",
        priority: "medium",
        reason: "SLA opvolging nodig.",
      },
      alerts: [
        {
          code: "PROVIDER_REVIEW_PENDING_SLA",
          severity: "high",
          title: "SLA-risico",
          message: "Reactietijd overschreden.",
          recommended_action: "FOLLOW_UP_PROVIDER",
          evidence: {},
        },
      ],
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByTestId("time-pressure-strip")).toBeInTheDocument();
    expect(screen.getByText(/SLA-risico gedetecteerd/)).toBeInTheDocument();
  });

  it("does not render time-pressure strip for normal priority without risk", async () => {
    setupCase(makeDecisionEvaluation({
      decision_context: {
        ...makeDecisionEvaluation().decision_context,
        urgency: "normal",
        hours_in_current_state: 10,
      },
      next_best_action: {
        action: "MONITOR_CASE",
        label: "Casus monitoren",
        priority: "medium",
        reason: "Reguliere opvolging.",
      },
      alerts: [],
      risks: [],
    }));

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);

    expect(await screen.findByRole("button", { name: "Casus monitoren" })).toBeInTheDocument();
    expect(screen.queryByTestId("time-pressure-strip")).not.toBeInTheDocument();
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
            label: "Meer info",
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
    expect(screen.queryByRole("button", { name: "Bevestig" })).not.toBeInTheDocument();
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
