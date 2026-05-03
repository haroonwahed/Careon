import { describe, expect, it } from "vitest";
import { executeCaseAction } from "./caseDecisionActions";

describe("executeCaseAction", () => {
  it("navigates to matching for validation", async () => {
    const result = await executeCaseAction("98", "VALIDATE_MATCHING", {
      decisionEvaluation: {
        decision_context: {},
      } as never,
    });

    expect(result).toEqual({
      kind: "navigate",
      message: "Matching wordt geopend.",
      href: "/care/matching?openCase=98",
    });
  });
});
