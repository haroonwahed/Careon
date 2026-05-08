import { describe, expect, it } from "vitest";
import { getAllSettingsSectionIds, isSettingsSectionId } from "./instellingenNav";

describe("instellingenNav", () => {
  it("validates section ids", () => {
    expect(isSettingsSectionId("workflow-regie")).toBe(true);
    expect(isSettingsSectionId("not-a-section")).toBe(false);
  });

  it("lists unique nav ids", () => {
    const ids = getAllSettingsSectionIds();
    expect(ids.length).toBeGreaterThan(5);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
