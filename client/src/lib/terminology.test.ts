import { describe, expect, it } from "vitest";
import { CARE_TERMS } from "./terminology";

describe("CARE_TERMS", () => {
  it("exposes the canonical workflow labels", () => {
    expect(CARE_TERMS.workflow).toEqual({
      casus: "Aanvraag",
      samenvatting: "Zorgvraag",
      matching: "Matching",
      gemeenteValidatie: "Gemeentelijke validatie",
      aanbiederBeoordeling: "Aanbieder reacties",
      plaatsing: "Plaatsing",
      intake: "Intake",
      plaatsingEnIntake: "Plaatsing & uitstroom",
    });
  });
});
