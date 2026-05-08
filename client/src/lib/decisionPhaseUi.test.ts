import { describe, expect, it } from "vitest";
import {
  mapApiPhaseToDecisionUiPhase,
  normalizeRegiekamerPhaseQueryParam,
} from "./decisionPhaseUi";

describe("normalizeRegiekamerPhaseQueryParam", () => {
  it("returns empty for absent or blank input", () => {
    expect(normalizeRegiekamerPhaseQueryParam(null)).toBe("");
    expect(normalizeRegiekamerPhaseQueryParam(undefined)).toBe("");
    expect(normalizeRegiekamerPhaseQueryParam("   ")).toBe("");
  });

  it("maps legacy wacht_op_validatie bookmarks to klaar_voor_matching", () => {
    expect(normalizeRegiekamerPhaseQueryParam("wacht_op_validatie")).toBe("klaar_voor_matching");
    expect(normalizeRegiekamerPhaseQueryParam("wacht-op-validatie")).toBe("klaar_voor_matching");
  });

  it("passes through other phase keys unchanged", () => {
    expect(normalizeRegiekamerPhaseQueryParam("matching")).toBe("matching");
    expect(normalizeRegiekamerPhaseQueryParam("gemeente_validatie")).toBe("gemeente_validatie");
  });
});

describe("mapApiPhaseToDecisionUiPhase", () => {
  it("maps legacy wacht_op_validatie id to klaar_voor_matching", () => {
    expect(mapApiPhaseToDecisionUiPhase("wacht_op_validatie")).toBe("klaar_voor_matching");
  });
});
