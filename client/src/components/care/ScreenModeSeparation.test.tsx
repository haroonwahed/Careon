import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockUseCases = vi.fn();
const mockUseProviders = vi.fn();
const mockUseRegiekamerDecisionOverview = vi.fn();
const mockFetchCaseDecisionEvaluation = vi.fn();
const mockExecuteCaseAction = vi.fn();

vi.mock("../../hooks/useCases", () => ({
  useCases: (...args: unknown[]) => mockUseCases(...args),
}));

vi.mock("../../hooks/useProviders", () => ({
  useProviders: (...args: unknown[]) => mockUseProviders(...args),
}));

vi.mock("../../hooks/useRegiekamerDecisionOverview", () => ({
  useRegiekamerDecisionOverview: () => mockUseRegiekamerDecisionOverview(),
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

import { SystemAwarenessPage as RegiekamerControlCenter } from "./RegiekamerControlCenter";
import { WorkloadPage as CasussenWorkflowPage } from "./CasussenWorkflowPage";
import { CaseExecutionPage as CaseWorkflowDetailPage } from "./CaseExecutionPage";

function setupSharedMocks() {
  mockUseCases.mockReturnValue({
    cases: [
      {
        id: "C-100",
        title: "Pilot casus",
        regio: "Utrecht",
        zorgtype: "Ambulante zorg",
        wachttijd: 2,
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
      },
    ],
    loading: false,
    error: null,
    refetch: vi.fn(),
  });

  mockUseProviders.mockReturnValue({
    providers: [
      {
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
      },
    ],
  });

  mockUseRegiekamerDecisionOverview.mockReturnValue({
    data: {
      generated_at: "2026-04-25T10:00:00Z",
      totals: {
        active_cases: 1,
        critical_blockers: 1,
        high_priority_alerts: 1,
        provider_sla_breaches: 0,
        repeated_rejections: 0,
        intake_delays: 0,
      },
      items: [
        {
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
          top_alert: null,
          blocker_count: 1,
          risk_count: 0,
          alert_count: 0,
          priority_score: 100,
          age_hours: 10,
          hours_in_current_state: 10,
          issue_tags: ["blockers"],
          responsible_role: "gemeente",
        },
      ],
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });

  mockFetchCaseDecisionEvaluation.mockResolvedValue({
    case_id: "C-100",
    current_state: "MATCHING_READY",
    phase: "matching",
    coverage_basis: "geo_distance",
    coverage_status: "inside_radius",
    factor_breakdown: {
      specialization: 0.9,
      capacity: 0.8,
      region: 0.9,
      urgency: 0.8,
      complexity: 0.8,
    },
    weaknesses: [],
    tradeoffs: [],
    confidence_score: 0.84,
    confidence_reason: "Match is onderbouwd.",
    warning_flags: { specialization_gap: false, urgency_mismatch: false },
    verification_guidance: [],
    next_best_action: {
      action: "SEND_TO_PROVIDER",
      label: "Stuur naar aanbieder",
      priority: "high",
      reason: "Samenvatting is compleet.",
    },
    blockers: [],
    risks: [],
    alerts: [],
    allowed_actions: [{ action: "SEND_TO_PROVIDER", label: "Stuur naar aanbieder", allowed: true }],
    blocked_actions: [],
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
      recent_events: [],
    },
  });
  mockExecuteCaseAction.mockResolvedValue({ kind: "mutation", message: "Actie uitgevoerd." });
}

describe("Screen mode separation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSharedMocks();
  });

  it("enforces screen mode separation across core pages", async () => {
    render(<RegiekamerControlCenter onCaseClick={vi.fn()} />);
    const regiekamerDominant = screen.getByTestId("regiekamer-dominant-action");
    expect(regiekamerDominant).toBeInTheDocument();
    expect(regiekamerDominant).toHaveAttribute("data-regiekamer-mode", "crisis");
    expect(screen.queryByTestId("next-best-action")).not.toBeInTheDocument();
    cleanup();

    render(<CasussenWorkflowPage onCaseClick={vi.fn()} />);
    const worklist = screen.getByTestId("worklist");
    expect(worklist).toBeInTheDocument();
    expect(worklist).toHaveAttribute("data-density", "compact");
    expect(screen.queryByTestId("regiekamer-dominant-action")).not.toBeInTheDocument();
    cleanup();

    render(<CaseWorkflowDetailPage caseId="C-100" onBack={vi.fn()} />);
    const nextBestAction = await screen.findByTestId("next-best-action");
    expect(nextBestAction).toBeInTheDocument();
    expect(nextBestAction).toHaveAttribute("data-priority", "primary");
    const processTimeline = screen.getByTestId("case-process-timeline");
    expect(processTimeline).toHaveAttribute("data-density", "compact");
    expect(screen.queryByTestId("regiekamer-dominant-action")).not.toBeInTheDocument();
    expect(screen.queryByTestId("worklist")).not.toBeInTheDocument();
  });
});
