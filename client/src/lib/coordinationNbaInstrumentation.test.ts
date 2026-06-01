import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  COORDINATION_NBA_ROUTE,
  buildCoordinationNbaInstrumentationPayload,
  emitCoordinationNbaEvent,
  resetCoordinationNbaShownDedupeForTests,
  shouldEmitCoordinationNbaShown,
} from "./coordinationNbaInstrumentation";

describe("buildCoordinationNbaInstrumentationPayload", () => {
  it("builds the canonical payload shape (no title — telemetry privacy)", () => {
    const fixed = new Date("2026-05-01T12:00:00.000Z");
    const p = buildCoordinationNbaInstrumentationPayload({
      actionKey: "FOCUS_SLA",
      uiMode: "crisis",
      reasonCount: 1,
      now: fixed,
    });
    expect(p).toEqual({
      actionKey: "FOCUS_SLA",
      uiMode: "crisis",
      reasonCount: 1,
      route: COORDINATION_NBA_ROUTE,
      now: fixed,
    });
  });
});

describe("shouldEmitCoordinationNbaShown", () => {
  beforeEach(() => {
    resetCoordinationNbaShownDedupeForTests();
  });

  it("allows first emission and suppresses duplicate fingerprint within the window", () => {
    expect(shouldEmitCoordinationNbaShown("a|b", 200)).toBe(true);
    expect(shouldEmitCoordinationNbaShown("a|b", 200)).toBe(false);
  });

  it("allows a different fingerprint immediately", () => {
    expect(shouldEmitCoordinationNbaShown("a", 200)).toBe(true);
    expect(shouldEmitCoordinationNbaShown("b", 200)).toBe(true);
  });

  it("allows same fingerprint after window elapsed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    try {
      resetCoordinationNbaShownDedupeForTests();
      expect(shouldEmitCoordinationNbaShown("x", 100)).toBe(true);
      expect(shouldEmitCoordinationNbaShown("x", 100)).toBe(false);
      vi.setSystemTime(new Date(200));
      expect(shouldEmitCoordinationNbaShown("x", 100)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("emitCoordinationNbaEvent", () => {
  const fixed = new Date("2026-05-01T12:00:00.000Z");
  const payload = buildCoordinationNbaInstrumentationPayload({
    actionKey: "REVIEW_STABLE",
    uiMode: "stable",
    reasonCount: 0,
    now: fixed,
  });

  const expectedTelemetry = {
    event: "nba_shown" as const,
    route: COORDINATION_NBA_ROUTE,
    uiMode: "stable",
    actionKey: "REVIEW_STABLE",
    reasonCount: 0,
    timestamp: fixed.getTime(),
    schema_version: "v1" as const,
  };

  afterEach(() => {
    delete (window as unknown as { __REGIEKAMER_NBA_TRACK__?: unknown }).__REGIEKAMER_NBA_TRACK__;
    delete (window as unknown as { __REGIEKAMER_NBA_CONSENT__?: unknown }).__REGIEKAMER_NBA_CONSENT__;
  });

  it("invokes window.__REGIEKAMER_NBA_TRACK__ with CoordinationNbaTelemetryEvent when consent is granted and tracker is set", () => {
    const fn = vi.fn();
    (window as unknown as { __REGIEKAMER_NBA_TRACK__: typeof fn }).__REGIEKAMER_NBA_TRACK__ = fn;
    (window as unknown as { __REGIEKAMER_NBA_CONSENT__: boolean }).__REGIEKAMER_NBA_CONSENT__ = true;
    emitCoordinationNbaEvent("nba_shown", payload);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(expectedTelemetry);
  });

  it("does not invoke the tracker when consent is not granted (default)", () => {
    const fn = vi.fn();
    (window as unknown as { __REGIEKAMER_NBA_TRACK__: typeof fn }).__REGIEKAMER_NBA_TRACK__ = fn;
    emitCoordinationNbaEvent("nba_shown", payload);
    expect(fn).not.toHaveBeenCalled();
  });
});
