// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  SLA_TARGET_HOURS,
  formatDurationShort,
  getSlaCountdown,
  getSlaTarget,
  slaCountdownFromHours,
  slaTargetHoursForStatus,
} from "./careSla";

// ---------------------------------------------------------------------------
// SLA_TARGET_HOURS — thresholds must stay in lockstep with decision_engine.py
// ---------------------------------------------------------------------------
describe("SLA_TARGET_HOURS", () => {
  it("aanmelding = 24h (1 day)", () => expect(SLA_TARGET_HOURS.aanmelding).toBe(24));
  it("urgentIdle = 48h (2 days)", () => expect(SLA_TARGET_HOURS.urgentIdle).toBe(48));
  it("providerResponse = 72h (3 days)", () => expect(SLA_TARGET_HOURS.providerResponse).toBe(72));
  it("intakeStart = 120h (5 days)", () => expect(SLA_TARGET_HOURS.intakeStart).toBe(120));
});

// ---------------------------------------------------------------------------
// formatDurationShort
// ---------------------------------------------------------------------------
describe("formatDurationShort", () => {
  it("sub-hour → <1u", () => expect(formatDurationShort(0.4)).toBe("<1u"));
  it("whole hours → Nu", () => expect(formatDurationShort(3)).toBe("3u"));
  it("exactly 24h → 1d", () => expect(formatDurationShort(24)).toBe("1d"));
  it("48h → 2d", () => expect(formatDurationShort(48)).toBe("2d"));
  it("1d remainder < threshold → compact day form (3d+)", () => {
    // 49h = 2d 1h; days < 3 and remainder != 0 → "2d 1u"
    expect(formatDurationShort(49)).toBe("2d 1u");
  });
  it("72h or more without remainder → plain days", () => {
    expect(formatDurationShort(72)).toBe("3d");
  });
  it("negative values use absolute for display", () => {
    // breach scenario: remaining = -5
    expect(formatDurationShort(-5)).toBe("5u");
  });
});

// ---------------------------------------------------------------------------
// slaTargetHoursForStatus — SpaCase / WorkflowCaseView status resolver
// ---------------------------------------------------------------------------
describe("slaTargetHoursForStatus", () => {
  it("aanmelding-phase statuses → 24h", () => {
    expect(slaTargetHoursForStatus("casus")).toBe(24);
    expect(slaTargetHoursForStatus("samenvatting")).toBe(24);
    expect(slaTargetHoursForStatus("draft")).toBe(24);
    expect(slaTargetHoursForStatus("draft_case")).toBe(24);
  });

  it("provider review statuses → 72h", () => {
    expect(slaTargetHoursForStatus("provider_beoordeling")).toBe(72);
    expect(slaTargetHoursForStatus("aanbieder_beoordeling")).toBe(72);
  });

  it("placement/intake statuses → 120h", () => {
    expect(slaTargetHoursForStatus("plaatsing")).toBe(120);
    expect(slaTargetHoursForStatus("intake")).toBe(120);
  });

  it("matching (no formal SLA) → null", () => {
    expect(slaTargetHoursForStatus("matching")).toBeNull();
    expect(slaTargetHoursForStatus("gemeente_validatie")).toBeNull();
  });

  it("unknown status → null", () => {
    expect(slaTargetHoursForStatus("archive")).toBeNull();
    expect(slaTargetHoursForStatus("")).toBeNull();
  });

  it("urgent urgency tightens target (strictest-wins)", () => {
    // high urgency alone → 48h
    expect(slaTargetHoursForStatus("matching", "high")).toBe(48);
    // high + plaatsing: min(48, 120) = 48
    expect(slaTargetHoursForStatus("plaatsing", "high")).toBe(48);
    // high + casus: min(48, 24) = 24
    expect(slaTargetHoursForStatus("casus", "high")).toBe(24);
    // critical behaves identically to high
    expect(slaTargetHoursForStatus("plaatsing", "critical")).toBe(48);
    // "warning" (SpaCase urgency mapping for Hoog) treated as urgent
    expect(slaTargetHoursForStatus("plaatsing", "warning")).toBe(48);
  });

  it("normal urgency does not add urgentIdle candidate", () => {
    expect(slaTargetHoursForStatus("plaatsing", "low")).toBe(120);
    expect(slaTargetHoursForStatus("plaatsing", undefined)).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// getSlaTarget — CoordinationDecisionOverviewItem resolver
// ---------------------------------------------------------------------------
describe("getSlaTarget", () => {
  const item = (phase: string, urgency = "normal") => ({ phase, urgency, hours_in_current_state: 0 });

  it("aanmelding phases → 24h basis", () => {
    expect(getSlaTarget(item("casus"))?.hours).toBe(24);
    expect(getSlaTarget(item("samenvatting"))?.hours).toBe(24);
  });

  it("aanbieder_beoordeling → 72h", () => {
    expect(getSlaTarget(item("aanbieder_beoordeling"))?.hours).toBe(72);
    expect(getSlaTarget(item("aanbieder_beoordeling"))?.basis).toBe("Aanbiederreactie");
  });

  it("plaatsing → 120h, Intake-start basis", () => {
    const t = getSlaTarget(item("plaatsing"));
    expect(t?.hours).toBe(120);
    expect(t?.basis).toBe("Intake-start");
  });

  it("intake → 120h", () => {
    expect(getSlaTarget(item("intake"))?.hours).toBe(120);
  });

  it("matching phases → null (no formal SLA)", () => {
    expect(getSlaTarget(item("matching"))).toBeNull();
    expect(getSlaTarget(item("gemeente_validatie"))).toBeNull();
    expect(getSlaTarget(item("wacht_op_validatie"))).toBeNull();
  });

  it("high urgency → 48h wins over higher thresholds", () => {
    // urgent + plaatsing: min(48, 120) = 48
    expect(getSlaTarget(item("plaatsing", "high"))?.hours).toBe(48);
    expect(getSlaTarget(item("plaatsing", "high"))?.basis).toBe("Urgentie");
  });

  it("high urgency + aanmelding → 24h wins (strictest-wins)", () => {
    // urgent=48, aanmelding=24 → 24 wins
    expect(getSlaTarget(item("casus", "high"))?.hours).toBe(24);
    expect(getSlaTarget(item("casus", "high"))?.basis).toBe("Aanmelding");
  });

  it("critical urgency handled identically to high", () => {
    expect(getSlaTarget(item("plaatsing", "critical"))?.hours).toBe(48);
  });
});

// ---------------------------------------------------------------------------
// slaCountdownFromHours — generic countdown engine
// ---------------------------------------------------------------------------
describe("slaCountdownFromHours", () => {
  describe("no SLA (targetHours = null)", () => {
    it("returns hasSla=false, status=none", () => {
      const cd = slaCountdownFromHours(10, null);
      expect(cd.hasSla).toBe(false);
      expect(cd.status).toBe("none");
    });

    it("shows elapsed duration", () => {
      const cd = slaCountdownFromHours(10, null);
      expect(cd.label).toBe("10u");
    });

    it("sublabel shows contextLabel when provided", () => {
      const cd = slaCountdownFromHours(5, null, "Matching");
      expect(cd.sublabel).toBe("in Matching");
    });

    it("sublabel is empty without contextLabel", () => {
      const cd = slaCountdownFromHours(5, null);
      expect(cd.sublabel).toBe("");
    });
  });

  describe("breached (elapsed > target)", () => {
    it("status=breached when elapsed equals target", () => {
      const cd = slaCountdownFromHours(24, 24);
      expect(cd.status).toBe("breached");
      expect(cd.hasSla).toBe(true);
    });

    it("status=breached when elapsed exceeds target", () => {
      const cd = slaCountdownFromHours(30, 24);
      expect(cd.status).toBe("breached");
    });

    it("label format is '<duration> te laat'", () => {
      // elapsed=30, target=24 → remaining=-6 → |6| = 6u
      const cd = slaCountdownFromHours(30, 24);
      expect(cd.label).toBe("6u te laat");
    });

    it("sublabel shows SLA threshold", () => {
      const cd = slaCountdownFromHours(30, 24);
      expect(cd.sublabel).toBe("SLA 24u");
    });

    it("remainingHours is negative", () => {
      const cd = slaCountdownFromHours(30, 24);
      expect(cd.remainingHours).toBeLessThan(0);
    });
  });

  describe("soon (within 20% or 8h, whichever is larger)", () => {
    it("status=soon just before soon-threshold for a 24h SLA", () => {
      // soonThreshold = max(8, 24*0.2) = max(8, 4.8) = 8
      // remaining = 24 - 16 = 8 → exactly at threshold → soon
      const cd = slaCountdownFromHours(16, 24);
      expect(cd.status).toBe("soon");
    });

    it("status=ok just above soon-threshold", () => {
      // remaining = 24 - 15 = 9 > 8 → ok
      const cd = slaCountdownFromHours(15, 24);
      expect(cd.status).toBe("ok");
    });

    it("soon label starts with 'nog'", () => {
      const cd = slaCountdownFromHours(16, 24);
      expect(cd.label).toMatch(/^nog /);
    });

    it("status=soon for 120h SLA within 24h (20% = 24h)", () => {
      // soonThreshold = max(8, 120*0.2) = max(8, 24) = 24
      // remaining = 120 - 97 = 23 ≤ 24 → soon
      const cd = slaCountdownFromHours(97, 120);
      expect(cd.status).toBe("soon");
    });
  });

  describe("ok (plenty of time)", () => {
    it("status=ok well within deadline", () => {
      const cd = slaCountdownFromHours(1, 24);
      expect(cd.status).toBe("ok");
      expect(cd.hasSla).toBe(true);
    });

    it("label starts with 'nog'", () => {
      const cd = slaCountdownFromHours(1, 24);
      expect(cd.label).toMatch(/^nog /);
    });

    it("sublabel shows SLA threshold", () => {
      const cd = slaCountdownFromHours(1, 24);
      expect(cd.sublabel).toBe("SLA 24u");
    });

    it("remainingHours is positive", () => {
      const cd = slaCountdownFromHours(1, 24);
      expect(cd.remainingHours).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getSlaCountdown — integration: item → countdown
// ---------------------------------------------------------------------------
describe("getSlaCountdown", () => {
  const makeItem = (phase: string, hours: number, urgency = "normal") => ({
    phase,
    urgency,
    hours_in_current_state: hours,
    age_hours: hours,
  });

  it("aanmelding phase, well within 24h → ok", () => {
    const cd = getSlaCountdown(makeItem("casus", 2));
    expect(cd.status).toBe("ok");
    expect(cd.hasSla).toBe(true);
    expect(cd.sublabel).toBe("SLA 24u");
  });

  it("aanmelding phase, 20h elapsed → soon (within 8h threshold)", () => {
    // remaining = 24-20 = 4 ≤ 8 → soon
    const cd = getSlaCountdown(makeItem("casus", 20));
    expect(cd.status).toBe("soon");
  });

  it("aanmelding phase, 26h elapsed → breached", () => {
    const cd = getSlaCountdown(makeItem("casus", 26));
    expect(cd.status).toBe("breached");
    expect(cd.label).toMatch(/te laat/);
  });

  it("matching phase → hasSla=false (no formal SLA)", () => {
    const cd = getSlaCountdown(makeItem("matching", 48));
    expect(cd.hasSla).toBe(false);
    expect(cd.status).toBe("none");
    expect(cd.sublabel).toBe("in Matching");
  });

  it("plaatsing, 5h elapsed → ok with 120h target", () => {
    const cd = getSlaCountdown(makeItem("plaatsing", 5));
    expect(cd.status).toBe("ok");
    expect(cd.sublabel).toBe("SLA 120u");
  });

  it("high urgency + matching → 48h SLA applied (no longer none)", () => {
    // urgent overrides the matching=no-SLA default via getSlaTarget
    const cd = getSlaCountdown(makeItem("matching", 10, "high"));
    expect(cd.hasSla).toBe(true);
    expect(cd.sublabel).toBe("SLA 48u");
  });

  it("falls back to age_hours when hours_in_current_state is absent", () => {
    const item = { phase: "casus", urgency: "normal", age_hours: 5 };
    const cd = getSlaCountdown(item);
    expect(cd.status).toBe("ok");
  });

  it("defaults elapsed to 0 when both timing fields are absent", () => {
    const item = { phase: "casus", urgency: "normal" };
    const cd = getSlaCountdown(item);
    expect(cd.remainingHours).toBe(24);
  });
});
