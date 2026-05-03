import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  REGIEKAMER_NBA_ROUTE,
  buildRegiekamerNbaInstrumentationPayload,
  emitRegiekamerNbaEvent,
  resetRegiekamerNbaShownDedupeForTests,
  shouldEmitRegiekamerNbaShown,
} from "./regiekamerNbaInstrumentation";

describe("buildRegiekamerNbaInstrumentationPayload", () => {
  it("builds the canonical payload shape (no title — telemetry privacy)", () => {
    const fixed = new Date("2026-05-01T12:00:00.000Z");
    const p = buildRegiekamerNbaInstrumentationPayload({
      actionKey: "FOCUS_SLA",
      uiMode: "crisis",
      reasonCount: 1,
      now: fixed,
    });
    expect(p).toEqual({
      actionKey: "FOCUS_SLA",
      uiMode: "crisis",
      reasonCount: 1,
      route: REGIEKAMER_NBA_ROUTE,
      now: fixed,
    });
  });
});

describe("shouldEmitRegiekamerNbaShown", () => {
  beforeEach(() => {
    resetRegiekamerNbaShownDedupeForTests();
  });

  it("allows first emission and suppresses duplicate fingerprint within the window", () => {
    expect(shouldEmitRegiekamerNbaShown("a|b", 200)).toBe(true);
    expect(shouldEmitRegiekamerNbaShown("a|b", 200)).toBe(false);
  });

  it("allows a different fingerprint immediately", () => {
    expect(shouldEmitRegiekamerNbaShown("a", 200)).toBe(true);
    expect(shouldEmitRegiekamerNbaShown("b", 200)).toBe(true);
  });

  it("allows same fingerprint after window elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    try {
      resetRegiekamerNbaShownDedupeForTests();
      expect(shouldEmitRegiekamerNbaShown("x", 100)).toBe(true);
      expect(shouldEmitRegiekamerNbaShown("x", 100)).toBe(false);
      vi.setSystemTime(new Date(200));
      expect(shouldEmitRegiekamerNbaShown("x", 100)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("emitRegiekamerNbaEvent", () => {
  const fixed = new Date("2026-05-01T12:00:00.000Z");
  const payload = buildRegiekamerNbaInstrumentationPayload({
    actionKey: "REVIEW_STABLE",
    uiMode: "stable",
    reasonCount: 0,
    now: fixed,
  });

  const expectedTelemetry = {
    event: "nba_shown" as const,
    route: REGIEKAMER_NBA_ROUTE,
    uiMode: "stable",
    actionKey: "REVIEW_STABLE",
    reasonCount: 0,
    timestamp: fixed.getTime(),
    schema_version: "v1" as const,
  };

  afterEach(() => {
    delete (window as unknown as { __REGIEKAMER_NBA_TRACK__?: unknown }).__REGIEKAMER_NBA_TRACK__;
  });

  it("invokes window.__REGIEKAMER_NBA_TRACK__ with RegiekamerNbaTelemetryEvent when set", () => {
    const fn = vi.fn();
    (window as unknown as { __REGIEKAMER_NBA_TRACK__: typeof fn }).__REGIEKAMER_NBA_TRACK__ = fn;
    emitRegiekamerNbaEvent("nba_shown", payload);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expectedTelemetry);
  });
});
