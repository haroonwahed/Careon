import { describe, expect, it } from "vitest";
import { CARE_TERMS } from "./terminology";

describe("CARE_TERMS", () => {
  it("exposes the canonical workflow labels", () => {
    expect(CARE_TERMS.workflow).toEqual({
      casus: "Casus",
      samenvatting: "Samenvatting",
      matching: "Matching",
      gemeenteValidatie: "Gemeente validatie",
      aanbiederBeoordeling: "Aanbieder beoordeling",
      plaatsing: "Plaatsing",
      intake: "Intake",
      plaatsingEnIntake: "Plaatsing & intake",
    });
  });
});
