import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CARE_PAGE_ARCHETYPES } from "../lib/pageArchetypes";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARE_DIR = join(ROOT, "components/care");

function readCareFile(name: string): string {
  return readFileSync(join(CARE_DIR, name), "utf8");
}

function careTsxFiles(): string[] {
  return readdirSync(CARE_DIR).filter((name) => name.endsWith(".tsx") && !name.includes(".test."));
}

/** Pages declared as operational queues (scaffold archetype=queue). */
const QUEUE_PAGE_FILES = [
  "WorkloadPage.tsx",
  "ActiesPage.tsx",
  "MatchingQueuePage.tsx",
  "PlacementTrackingPage.tsx",
  "IntakeListPage.tsx",
  "SignalenPage.tsx",
  "AanbiederreactiePage.tsx",
  "AssessmentQueuePage.tsx",
  "DocumentenPage.tsx",
  "PlacementTrackingPage.tsx",
];

const QUEUE_LIST_GUARD_FILES = [
  "WorkloadPage.tsx",
  "ActiesPage.tsx",
  "MatchingQueuePage.tsx",
  "PlacementTrackingPage.tsx",
  "IntakeListPage.tsx",
  "SignalenPage.tsx",
  "AanbiederreactiePage.tsx",
  "SystemAwarenessPage.tsx",
];

describe("operationalDesignLawsGuard", () => {
  it("LAW 02 — CareKPICard only on command (Coordination) page", () => {
    const violations: string[] = [];
    for (const file of careTsxFiles()) {
      if (file === "CareKPICard.tsx") continue;
      const source = readCareFile(file);
      if (!/\bCareKPICard\b/.test(source)) continue;
      if (file !== "SystemAwarenessPage.tsx") {
        violations.push(file);
      }
    }
    expect(violations, `CareKPICard is command-only. Violations: ${violations.join(", ")}`).toEqual([]);
  });

  it("LAW 01/02 — no KPI stat grids in kpiStrip outside Coordination", () => {
    const violations: string[] = [];
    for (const file of careTsxFiles()) {
      if (file === "SystemAwarenessPage.tsx" || file === "CarePageScaffold.tsx") continue;
      const source = readCareFile(file);
      if (!/kpiStrip=\{/.test(source)) continue;
      if (/md:grid-cols-[234]/.test(source) && /\bCareKPICard\b/.test(source)) {
        violations.push(file);
      }
      if (/kpiStrip=\{[\s\S]*?grid-cols-2[\s\S]*?text-\[20px\]/.test(source) && file !== "SystemAwarenessPage.tsx") {
        violations.push(`${file} (inline stat grid)`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("LAW 05 — no fabricated matching score helpers", () => {
    const source = readCareFile("MatchingPageWithMap.tsx");
    expect(source).not.toMatch(/function getMatchScore/);
    expect(source).not.toMatch(/return 94/);
    expect(source).not.toMatch(/Math\.max\(52,\s*66/);
  });

  it("LAW 06 — Coordination NBA must not route to rapportages optimization", () => {
    const nba = readFileSync(join(ROOT, "lib/coordinationNextBestAction.ts"), "utf8");
    const page = readCareFile("SystemAwarenessPage.tsx");
    expect(nba).not.toMatch(/OPEN_REPORTS/);
    expect(nba).not.toMatch(/uiMode:\s*"optimization"/);
    expect(page).not.toMatch(/\/rapportages/);
    expect(page).toMatch(/FOCUS_PIPELINE/);
  });

  it("LAW 05 — workflow list surfaces do not fabricate match confidence percentages", () => {
    const workflowUi = readFileSync(join(ROOT, "lib/workflowUi.ts"), "utf8");
    expect(workflowUi).not.toMatch(/function buildMatchConfidence/);
    expect(workflowUi).toMatch(/matchConfidenceScore:\s*null/);
    const matchingQueue = readCareFile("MatchingQueuePage.tsx");
    expect(matchingQueue).not.toMatch(/Fit sterk \(\d+%\)/);
    expect(matchingQueue).not.toMatch(/matchConfidenceScore/);
  });

  it("LAW 05 — no Sparkles gimmick on matching workspace", () => {
    const source = readCareFile("MatchingPageWithMap.tsx");
    expect(source).not.toMatch(/\bSparkles\b/);
  });

  it("LAW 09 — CarePageScaffold uses consolidation archetypes only", () => {
    const violations: string[] = [];
    const legacy = ["decision", "worklist", "signal-action"];
    for (const file of careTsxFiles()) {
      const source = readCareFile(file);
      if (!/CarePageScaffold/.test(source)) continue;
      for (const bad of legacy) {
        if (new RegExp(`archetype="${bad}"`).test(source)) {
          violations.push(`${file}: ${bad}`);
        }
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("declared archetypes on scaffold are valid", () => {
    const allowed = new Set<string>(CARE_PAGE_ARCHETYPES);
    for (const file of careTsxFiles()) {
      const source = readCareFile(file);
      const matches = source.matchAll(/archetype="([a-z]+)"/g);
      for (const match of matches) {
        expect(allowed.has(match[1]), `${file} has unknown archetype ${match[1]}`).toBe(true);
      }
    }
  });

  it("LAW 08 — queue surfaces use CareWorkRow for dispatch lists", () => {
    const violations: string[] = [];
    for (const file of QUEUE_LIST_GUARD_FILES) {
      const source = readCareFile(file);
      if (!/\bCareWorkRow\b/.test(source)) {
        violations.push(`${file}: missing CareWorkRow`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("LAW 08 — no full-width primary CTA bars inside queue list components", () => {
    const violations: string[] = [];
    const pattern = /h-11\s+min-h-11\s+w-full|w-full\s+justify-center\s+rounded-xl[^"]*text-\[13px\]\s+font-semibold/;
    for (const file of QUEUE_LIST_GUARD_FILES) {
      const source = readCareFile(file);
      if (pattern.test(source)) {
        violations.push(file);
      }
    }
    expect(violations, `Full-width queue CTAs: ${violations.join(", ")}`).toEqual([]);
  });

  it("LAW 08 — Intake queue must not use panel-surface case cards", () => {
    const source = readCareFile("IntakeListPage.tsx");
    expect(source).not.toMatch(/panel-surface\s+p-4/);
  });

  it("LAW 08 — CareWorkRow uses shared operational grid geometry", () => {
    const source = readCareFile("CareUnifiedPage.tsx");
    const rowStart = source.indexOf("export function CareWorkRow");
    const rowEnd = source.indexOf("export const CareListRow", rowStart);
    const rowSource = source.slice(rowStart, rowEnd);
    expect(rowSource).toContain("OPERATIONAL_QUEUE_GRID_CLASS");
  });

  it("LAW 08 — columnar queues use CareOperationalQueueHeader", () => {
    const violations: string[] = [];
    const mustHeader = [
      "WorkloadPage.tsx",
      "ActiesPage.tsx",
      "MatchingQueuePage.tsx",
      "PlacementTrackingPage.tsx",
      "IntakeListPage.tsx",
      "SignalenPage.tsx",
      "SystemAwarenessPage.tsx",
      "AssessmentQueuePage.tsx",
    ];
    for (const file of mustHeader) {
      const source = readCareFile(file);
      if (!/\bCareOperationalQueueHeader\b/.test(source)) {
        violations.push(file);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("LAW 10 — queue werkvoorraad shells use CareWorkspaceSection rhythm", () => {
    const mustWorkspace = [
      "WorkloadPage.tsx",
      "ActiesPage.tsx",
      "MatchingQueuePage.tsx",
      "PlacementTrackingPage.tsx",
      "SignalenPage.tsx",
      "SystemAwarenessPage.tsx",
    ];
    const violations: string[] = [];
    for (const file of mustWorkspace) {
      const source = readCareFile(file);
      if (!/\bCareWorkspaceSection\b/.test(source)) {
        violations.push(`${file}: missing CareWorkspaceSection`);
      }
      if (/CareSectionBody className="space-y-3"/.test(source)) {
        violations.push(`${file}: legacy space-y-3 section body`);
      }
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("LAW 10 — operational rhythm tokens are defined in design tokens", () => {
    const tokens = readFileSync(join(ROOT, "design/tokens.ts"), "utf8");
    expect(tokens).toMatch(/rhythm:\s*\{/);
    expect(tokens).toMatch(/filterQueue:/);
    expect(tokens).toMatch(/queueHeader:/);
  });

});
