import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { tokens } from "../design/tokens";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT = join(ROOT, "..", "..", "docs", "design", "CAREON_UI_CONTRACT.md");

describe("CareOn UI contract", () => {
  it("pins the hard visual values", () => {
    const contract = readFileSync(CONTRACT, "utf8");
    expect(contract).toContain("Sidebar width: `280px` desktop");
    expect(contract).toContain("Topbar height: `72px`");
    expect(contract).toContain("Main content max width: `none`");
    expect(contract).toContain("Page horizontal padding: `32px`");
    expect(contract).toContain("Page top padding: `56px`");
    expect(contract).toContain("Card radius: `24px`");
    expect(contract).toContain("Section card radius: `22px`");
    expect(contract).toContain("Primary CTA color: `#7C4DFF`");
    expect(contract).toContain("Warning CTA color: `#F5A900`");
    expect(contract).toContain("Background: `#070B18`");
    expect(contract).toContain("Surface 1: `#0E1424`");
    expect(contract).toContain("Surface 2: `#121A2C`");
    expect(contract).toContain("Border: `rgba(148,163,184,0.12)`");
  });

  it("mirrors the contract in design tokens", () => {
    expect(tokens.visualContract).toEqual({
      sidebarWidth: "280px",
      topbarHeight: "72px",
      mainContentMaxWidth: "none",
      pageHorizontalPadding: "32px",
      pageTopPadding: "56px",
      cardRadius: "24px",
      sectionCardRadius: "22px",
      primaryCta: "#7C4DFF",
      warningCta: "#F5A900",
      background: "#070B18",
      surface1: "#0E1424",
      surface2: "#121A2C",
      border: "rgba(148,163,184,0.12)",
    });
  });
});
