import { describe, expect, it } from "vitest";
import {
  REGIEKAMER_NBA_OPTIMIZATION_MIN_ACTIVE,
  REGIEKAMER_NBA_RISK_THRESHOLD,
  computeRegiekamerNextBestAction,
} from "./regiekamerNextBestAction";

function baseTotals() {
  return {
    critical_blockers: 0,
    provider_sla_breaches: 0,
    high_priority_alerts: 0,
    intake_delays: 0,
  };
}

describe("computeRegiekamerNextBestAction", () => {
  it("prioritizes blokkades over SLA, matching, intake and risks", () => {
    const r = computeRegiekamerNextBestAction({
      totals: {
        ...baseTotals(),
        critical_blockers: 2,
        provider_sla_breaches: 5,
      },
      activeCases: 10,
      noMatchUrgentCount: 3,
    });
    expect(r.primaryAction.actionKey).toBe("FOCUS_BLOCKERS");
    expect(r.panel.uiMode).toBe("crisis");
    expect(r.impactHint).toMatch(/SLA-signal/);
  });

  it("uses SLA tier when no blockers", () => {
    const r = computeRegiekamerNextBestAction({
      totals: {
        ...baseTotals(),
        provider_sla_breaches: 2,
      },
      activeCases: 4,
      noMatchUrgentCount: 1,
    });
    expect(r.primaryAction.actionKey).toBe("FOCUS_SLA");
    expect(r.title).toMatch(/SLA-signal/);
    expect(r.panel.linkCount).toBe(2);
  });

  it("prioritizes matching failures before intake delays", () => {
    const intakeFirst = computeRegiekamerNextBestAction({
      totals: {
        ...baseTotals(),
        intake_delays: 5,
      },
      activeCases: 3,
      noMatchUrgentCount: 1,
    });
    expect(intakeFirst.primaryAction.actionKey).toBe("FOCUS_MATCHING");

    const intakeOnly = computeRegiekamerNextBestAction({
      totals: {
        ...baseTotals(),
        intake_delays: 4,
      },
      activeCases: 3,
      noMatchUrgentCount: 0,
    });
    expect(intakeOnly.primaryAction.actionKey).toBe("FOCUS_INTAKE");
    expect(intakeOnly.title).toMatch(/intake-vertraging/);
  });

  it("surfaces risks after the four priority tiers", () => {
    const r = computeRegiekamerNextBestAction({
      totals: {
        ...baseTotals(),
        high_priority_alerts: REGIEKAMER_NBA_RISK_THRESHOLD,
      },
      activeCases: 2,
      noMatchUrgentCount: 0,
    });
    expect(r.primaryAction.actionKey).toBe("FOCUS_RISKS");
    expect(r.secondaryAction?.actionKey).toBe("SLA_PROVIDER_REMINDERS");
    expect(r.panel.uiMode).toBe("intervention");
  });

  it("does not surface risks below threshold", () => {
    const r = computeRegiekamerNextBestAction({
      totals: {
        ...baseTotals(),
        high_priority_alerts: REGIEKAMER_NBA_RISK_THRESHOLD - 1,
      },
      activeCases: 2,
      noMatchUrgentCount: 0,
    });
    expect(r.primaryAction.actionKey).not.toBe("FOCUS_RISKS");
  });

  it("chooses optimization when volume is high and signals are quiet", () => {
    const r = computeRegiekamerNextBestAction({
      totals: baseTotals(),
      activeCases: REGIEKAMER_NBA_OPTIMIZATION_MIN_ACTIVE,
      noMatchUrgentCount: 0,
    });
    expect(r.primaryAction.actionKey).toBe("OPEN_REPORTS");
    expect(r.panel.uiMode).toBe("optimization");
  });

  it("defaults to stable when volume is low and signals are quiet", () => {
    const r = computeRegiekamerNextBestAction({
      totals: baseTotals(),
      activeCases: REGIEKAMER_NBA_OPTIMIZATION_MIN_ACTIVE - 1,
      noMatchUrgentCount: 0,
    });
    expect(r.primaryAction.actionKey).toBe("REVIEW_STABLE");
    expect(r.panel.uiMode).toBe("stable");
  });

  it("rounds fractional totals defensively", () => {
    const r = computeRegiekamerNextBestAction({
      totals: {
        critical_blockers: 0.6,
        provider_sla_breaches: 0,
        high_priority_alerts: 0,
        intake_delays: 0,
      },
      activeCases: 1,
      noMatchUrgentCount: 0,
    });
    expect(r.primaryAction.actionKey).toBe("FOCUS_BLOCKERS");
    expect(r.title).toMatch(/1 kritieke blokkade/);
  });
});
