import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CARE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../components/care");

/**
 * Route-level care pages must compose CarePageScaffold, not CarePageTemplate directly.
 * Add a row here only with a short reason; remove when migrated to CarePageScaffold.
 *
 * @see PAGE_GENERATOR_PATTERN.md
 */
const DIRECT_CARE_PAGE_TEMPLATE_EXCEPTIONS: ReadonlyMap<string, string> = new Map([
  [
    "AanbiederBeoordelingPage.tsx",
    "Multiple embedded list/workspace templates; scaffold migration tracked separately.",
  ],
  ["AssessmentQueuePage.tsx", "Not yet migrated to CarePageScaffold."],
  ["IntakeListPage.tsx", "Not yet migrated to CarePageScaffold."],
  ["MatchingQueuePage.tsx", "Not yet migrated to CarePageScaffold."],
  ["PlacementTrackingPage.tsx", "Not yet migrated to CarePageScaffold."],
  ["SignalenPage.tsx", "Not yet migrated to CarePageScaffold."],
  [
    "SystemAwarenessPage.tsx",
    "Regiekamer / system-awareness experience; bespoke shell until unified scaffold rollout.",
  ],
]);

const IGNORE_FILES = new Set(["CareUnifiedPage.tsx", "CarePageScaffold.tsx"]);

function fileUsesCarePageTemplate(source: string): boolean {
  return /\bCarePageTemplate\b/.test(source);
}

describe("carePageTemplateDirectUsageGuard", () => {
  it("fails when a care route uses CarePageTemplate without a documented exception", () => {
    const files = readdirSync(CARE_DIR).filter((name) => name.endsWith(".tsx") && !name.includes(".test."));
    const violations: string[] = [];

    for (const file of files) {
      if (IGNORE_FILES.has(file)) continue;
      const source = readFileSync(join(CARE_DIR, file), "utf8");
      if (!fileUsesCarePageTemplate(source)) continue;
      if (DIRECT_CARE_PAGE_TEMPLATE_EXCEPTIONS.has(file)) continue;
      violations.push(file);
    }

    expect(
      violations,
      [
        "These files reference CarePageTemplate directly. Prefer CarePageScaffold for new layout.",
        "If intentional, add an entry to DIRECT_CARE_PAGE_TEMPLATE_EXCEPTIONS in",
        "client/src/test/carePageTemplateDirectUsageGuard.test.ts (with reason).",
        "",
        ...violations.map((f) => `  - ${f}`),
      ].join("\n"),
    ).toEqual([]);
  });

  it("exception list has no stale entries (file missing or no longer uses CarePageTemplate)", () => {
    for (const [file, reason] of DIRECT_CARE_PAGE_TEMPLATE_EXCEPTIONS) {
      const path = join(CARE_DIR, file);
      let source: string;
      try {
        source = readFileSync(path, "utf8");
      } catch {
        throw new Error(`Remove stale guard exception: ${file} (${reason})`);
      }
      expect(source, `${file} was migrated — remove from DIRECT_CARE_PAGE_TEMPLATE_EXCEPTIONS`).toMatch(
        /\bCarePageTemplate\b/,
      );
    }
  });
});
