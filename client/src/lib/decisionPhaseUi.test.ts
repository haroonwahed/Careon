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

  it("maps legacy validation bookmarks to matching", () => {
    expect(normalizeCoordinationPhaseQueryParam("wacht_op_validatie")).toBe("matching");
    expect(normalizeCoordinationPhaseQueryParam("wacht-op-validatie")).toBe("matching");
  });

  it("passes through the canonical phase keys unchanged", () => {
    expect(normalizeCoordinationPhaseQueryParam("matching")).toBe("matching");
    expect(normalizeCoordinationPhaseQueryParam("aanbiederreactie")).toBe("aanbiederreactie");
  });
});

describe("mapApiPhaseToDecisionUiPhase", () => {
  it("maps legacy validation id to matching", () => {
    expect(mapApiPhaseToDecisionUiPhase("wacht_op_validatie")).toBe("matching");
  });

  it("does not treat WorkflowState enum as API phase (would fall back to aanmelding)", () => {
    expect(mapApiPhaseToDecisionUiPhase("MATCHING_READY")).toBe("aanmelding");
  });
});

describe("resolveCaseExecutionPhasePresentation", () => {
  it("uses evaluation phase when present", () => {
    const result = resolveCaseExecutionPhasePresentation({
      evaluationPhase: "matching",
      currentState: "DRAFT_CASE",
    });
    expect(result.apiPhase).toBe("matching");
    expect(result.decisionUiPhaseId).toBe("matching");
    expect(result.badgeLabel).toBe("Matching");
  });

  it("derives API phase from canonical workflow state when evaluation phase absent", () => {
    const result = resolveCaseExecutionPhasePresentation({
      evaluationPhase: null,
      currentState: "MATCHING_READY",
    });
    expect(result.apiPhase).toBe("matching");
    expect(result.decisionUiPhaseId).toBe("matching");
  });

  it("surfaces gemeente validatie sub-status on merged bucket", () => {
    const result = resolveCaseExecutionPhasePresentation({
      evaluationPhase: "gemeente_validatie",
      currentState: "GEMEENTE_VALIDATED",
    });
    expect(result.subStatusLabel).toBeTruthy();
    expect(result.decisionUiPhaseId).toBe("matching");
  });
});
