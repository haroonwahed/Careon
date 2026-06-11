import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS = join(ROOT, "..", "AGENTS.md");

describe("AGENTS UI rules", () => {
  it("keeps the CareOn UI rules section in the root AGENTS file", () => {
    const agents = readFileSync(AGENTS, "utf8");

    expect(agents).toContain("## CareOn UI Rules for Codex");
    expect(agents).toContain("docs/design/CAREON_UI_CONTRACT.md");
    expect(agents).toContain("docs/design/CAREON_PAGE_PATTERNS.md");
    expect(agents).toContain("CarePageScaffold");
    expect(agents).toContain("CareTopBar");
    expect(agents).toContain("CareSidebar");
    expect(agents).toContain("PrimaryActionButton");
    expect(agents).toContain("SecondaryActionButton");
    expect(agents).toContain("CareStatusBadge");
    expect(agents).toContain("one dominant CTA max");
    expect(agents).toContain("one alert/attention surface max");
    expect(agents).toContain("one workvoorraad section");
  });
});
