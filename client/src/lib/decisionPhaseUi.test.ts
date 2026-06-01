import { describe, expect, it } from "vitest";
import {
  mapApiPhaseToDecisionUiPhase,
  normalizeCoordinationPhaseQueryParam,
  resolveCaseExecutionPhasePresentation,
} from "./decisionPhaseUi";

describe("normalizeCoordinationPhaseQueryParam", () => {
  it("returns empty for absent or blank input", () => {
    expect(normalizeCoordinationPhaseQueryParam(null)).toBe("");
    expect(normalizeCoordinationPhaseQueryParam(undefined)).toBe("");
    expect(normalizeCoordinationPhaseQueryParam("   ")).toBe("");
  });

  it("maps legacy wacht_op_validatie bookmarks to klaar_voor_matching", () => {
    expect(normalizeCoordinationPhaseQueryParam("wacht_op_validatie")).toBe("klaar_voor_matching");
    expect(normalizeCoordinationPhaseQueryParam("wacht-op-validatie")).toBe("klaar_voor_matching");
  });

  it("passes through other phase keys unchanged", () => {
    expect(normalizeCoordinationPhaseQueryParam("matching")).toBe("matching");
    expect(normalizeCoordinationPhaseQueryParam("gemeente_validatie")).toBe("gemeente_validatie");
  });
});

describe("mapApiPhaseToDecisionUiPhase", () => {
  it("maps legacy wacht_op_validatie id to klaar_voor_matching", () => {
    expect(mapApiPhaseToDecisionUiPhase("wacht_op_validatie")).toBe("klaar_voor_matching");
  });

  it("does not treat WorkflowState enum as API phase (would fall back to casus_gestart)", () => {
    expect(mapApiPhaseToDecisionUiPhase("MATCHING_READY")).toBe("casus_gestart");
  });
});

describe("resolveCaseExecutionPhasePresentation", () => {
  it("uses evaluation phase when present", () => {
    const result = resolveCaseExecutionPhasePresentation({
      evaluationPhase: "matching",
      currentState: "DRAFT_CASE",
    });
    expect(result.apiPhase).toBe("matching");
    expect(result.decisionUiPhaseId).toBe("klaar_voor_matching");
    expect(result.badgeLabel).toBe("Matching & validatie");
  });

  it("derives API phase from canonical workflow state when evaluation phase absent", () => {
    const result = resolveCaseExecutionPhasePresentation({
      evaluationPhase: null,
      currentState: "MATCHING_READY",
    });
    expect(result.apiPhase).toBe("matching");
    expect(result.decisionUiPhaseId).toBe("klaar_voor_matching");
  });

  it("surfaces gemeente validatie sub-status on merged bucket", () => {
    const result = resolveCaseExecutionPhasePresentation({
      evaluationPhase: "gemeente_validatie",
      currentState: "GEMEENTE_VALIDATED",
    });
    expect(result.subStatusLabel).toBeTruthy();
    expect(result.decisionUiPhaseId).toBe("klaar_voor_matching");
  });
});
