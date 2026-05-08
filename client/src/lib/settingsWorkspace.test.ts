import { describe, expect, it } from "vitest";
import {
  readSectionFromSearch,
  SETTINGS_SECTION_QUERY_PARAM,
} from "./settingsWorkspace";

describe("settingsWorkspace", () => {
  it("parses valid section from query string", () => {
    expect(readSectionFromSearch(`?${SETTINGS_SECTION_QUERY_PARAM}=workflow-regie`)).toBe("workflow-regie");
    expect(readSectionFromSearch(`${SETTINGS_SECTION_QUERY_PARAM}=matching-engine`)).toBe("matching-engine");
  });

  it("returns null for unknown or missing section", () => {
    expect(readSectionFromSearch("?section=unknown-id")).toBeNull();
    expect(readSectionFromSearch("")).toBeNull();
    expect(readSectionFromSearch("?other=x")).toBeNull();
  });
});
