import { describe, expect, it } from "vitest";
import type {
  RegiekamerDecisionOverviewItem,
  RegiekamerDecisionOverviewTotals,
} from "./regiekamerDecisionOverview";
import {
  deriveAttentionSignals,
  derivePhaseBoard,
  getDominantPhaseColumn,
  REGIEKAMER_FLOW_PHASES,
} from "./regiekamerCommandCenter";

function item(partial: Partial<RegiekamerDecisionOverviewItem>): RegiekamerDecisionOverviewItem {
  return {
    case_id: 1,
    case_reference: "#1",
    title: "T",
    current_state: "X",
    phase: "matching",
    urgency: "normal",
    assigned_provider: "",
    next_best_action: null,
    top_blocker: null,
    top_risk: null,
    top_alert: null,
    blocker_count: 0,
    risk_count: 0,
    alert_count: 0,
    priority_score: 50,
    age_hours: 1,
    hours_in_current_state: 1,
    issue_tags: [],
    responsible_role: "gemeente",
    ...partial,
  };
}

function totals(partial: Partial<RegiekamerDecisionOverviewTotals>): RegiekamerDecisionOverviewTotals {
  return {
    active_cases: 1,
    critical_blockers: 0,
    high_priority_alerts: 0,
    provider_sla_breaches: 0,
    repeated_rejections: 0,
    intake_delays: 0,
    ...partial,
  };
}

describe("deriveAttentionSignals", () => {
  it("returns max 4 signals with real counts only", () => {
    const rows = [
      item({
        phase: "matching",
        urgency: "high",
        risk_count: 1,
        alert_count: 0,
      }),
      item({
        case_id: 2,
        phase: "gemeente_validatie",
        urgency: "normal",
      }),
    ];
    const t = totals({
      repeated_rejections: 2,
      intake_delays: 1,
    });
    const sigs = deriveAttentionSignals(rows, t, 3);
    expect(sigs.length).toBeLessThanOrEqual(4);
    expect(sigs.every((s) => s.count > 0)).toBe(true);
    expect(sigs.find((s) => s.id === "no_match")?.count).toBe(3);
    expect(sigs.find((s) => s.id === "rejections")?.count).toBe(2);
  });

  it("maps matching-urgent filter to alerts+klaar_voor_matching (view, not execution)", () => {
    const sigs = deriveAttentionSignals([], totals({}), 2);
    expect(sigs[0]?.filter).toEqual({ issue: "alerts", phase: "klaar_voor_matching", priority: "all" });
  });
});

describe("derivePhaseBoard", () => {
  it("covers all decision buckets with counts and samples", () => {
    const rows = [
      item({ case_id: 1, phase: "matching" }),
      item({ case_id: 2, phase: "matching" }),
      item({ case_id: 4, phase: "gemeente_validatie" }),
      item({ case_id: 3, phase: "intake" }),
    ];
    const board = derivePhaseBoard(rows, 2);
    expect(board).toHaveLength(REGIEKAMER_FLOW_PHASES.length);
    const m = board.find((c) => c.phase === "klaar_voor_matching");
    expect(m?.count).toBe(3);
    expect(m?.sample).toHaveLength(2);
    const dom = getDominantPhaseColumn(board);
    expect(dom?.phase).toBe("klaar_voor_matching");
  });
});
