/**
 * Visual / layout regression for shared care list surfaces (SPA).
 *
 * Run (Vite dev server on 3000):
 *   E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-visual-regression.spec.ts
 *   (App opens the care shell at `/?view=dashboard`; origin is taken from E2E_SPA_URL.)
 *
 * API calls to `/care/api/*` are stubbed so the SPA does not follow Django login on 401.
 *
 * Optional full-page dumps for manual review:
 *   CARE_VISUAL_DUMP=1 E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-visual-regression.spec.ts
 *
 * CTA vs row double-open: covered by unit tests on CareWorkRow (button stopPropagation);
 * here we assert CTA is a nested <button> inside the row shell.
 */
import { expect, test, type Page, type Request } from "@playwright/test";
import {
  goSidebar,
  installCareApiStubs,
  isMatchingCaseDecisionEvalGet,
  SPA_BASE,
} from "./helpers/careSpaApiStubs";

/** Real Tab navigation so :focus-visible ring styles apply (programmatic focus() does not). */
async function focusFirstWorklistArticle(page: Page) {
  await page.keyboard.press("Tab");
  for (let i = 0; i < 45; i += 1) {
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el instanceof HTMLElement && el.matches("article[data-density=\"compact\"]");
    });
    if (focused) {
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error("Could not Tab-focus a compact worklist article");
}

async function maybeDump(page: Page, slug: string) {
  if (!process.env.CARE_VISUAL_DUMP) {
    return;
  }
  await page.screenshot({ path: `test-results/care-visual-${slug}.png`, fullPage: true });
}

test.describe.configure({ mode: "serial", timeout: 90_000 });

test.describe("Care list visual regression (SPA)", () => {
  test.beforeEach(async ({ page }) => {
    await installCareApiStubs(page);
    await page.goto(SPA_BASE, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible({ timeout: 45_000 });
  });

  test("Regiekamer: row rhythm, focus ring, CTA nested in row", async ({ page }) => {
    await maybeDump(page, "regiekamer-desktop");
    const rows = page.locator('article[data-density="compact"]');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const heights = await rows.evaluateAll((els) => els.slice(0, 10).map((el) => el.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(0);
    const minH = Math.min(...heights);
    const maxH = Math.max(...heights);
    expect(maxH - minH, "row heights should stay in a tight band (wrapping may add some px)").toBeLessThan(36);

    await focusFirstWorklistArticle(page);
    const focusedRow = page.locator('article[data-density="compact"]:focus');
    await expect(focusedRow).toBeVisible();
    const ringish = await focusedRow.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.boxShadow}|${s.outlineStyle}|${s.outlineWidth}`;
    });
    expect(ringish).not.toMatch(/^\|\s*none\s*\|\s*0(px)?\s*$/);

    const cta = focusedRow
      .locator('button[type="button"]')
      .filter({ hasText: /→|Open|Bekijk|Start|Vul|Controleer|Stuur|Valideer|Volg|Herplan|Naar/i })
      .first();
    await expect(cta).toBeVisible();
    const ctaInsideRow = await focusedRow.evaluate((row) => {
      const rowEl = row as HTMLElement;
      const btn = rowEl.querySelector("button[type=\"button\"]");
      return Boolean(btn && rowEl.contains(btn));
    });
    expect(ctaInsideRow, "CTA must be a descendant of the row so clicks can be isolated from row handler").toBe(true);
  });

  test("Regiekamer: CTA vs row title each open the casus once (single evaluation fetch)", async ({ page }) => {
    const row = page.getByTestId("regiekamer-worklist-item").filter({ hasText: /E2E matching casus/i }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    const cta = row.locator('button[type="button"]').first();
    const titleLine = row.locator("p.font-semibold").first();
    const workspaceTitle = page.getByText(/CASUS #.*— E2E matching casus/);
    const casePanel = page.getByTestId("case-context-panel");

    let decisionEvalGets = 0;
    const onRequest = (req: Request) => {
      if (isMatchingCaseDecisionEvalGet(req)) {
        decisionEvalGets += 1;
      }
    };
    page.on("request", onRequest);
    try {
      await cta.click();
      await expect(workspaceTitle).toBeVisible({ timeout: 30_000 });
      await expect(casePanel).toHaveCount(1);
      expect(decisionEvalGets, "one CTA click must not double-fetch decision evaluation").toBe(1);

      await page.getByRole("button", { name: /Terug naar casussen/i }).click();
      await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible({ timeout: 30_000 });
      await expect(casePanel).toHaveCount(0);

      decisionEvalGets = 0;
      await titleLine.click();
      await expect(workspaceTitle).toBeVisible({ timeout: 30_000 });
      await expect(casePanel).toHaveCount(1);
      expect(decisionEvalGets, "one row-body click must not double-fetch decision evaluation").toBe(1);
    } finally {
      page.off("request", onRequest);
    }
  });

  test("Casussen: werklijst-tabel + compacte rijen", async ({ page }) => {
    await goSidebar(page, "Casussen");
    await expect(page.getByRole("heading", { name: /^Casussen$/i })).toBeVisible({ timeout: 30_000 });
    await maybeDump(page, "casussen-desktop");

    const rows = page.locator('[data-testid="worklist"] tr[data-care-work-row]');
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    const heights = await rows.evaluateAll((els) => els.slice(0, 10).map((el) => el.getBoundingClientRect().height));
    expect(maxMinusMin(heights)).toBeLessThan(36);

    await page.setViewportSize({ width: 390, height: 900 });
    await expect(page.getByRole("heading", { name: /^Casussen$/i })).toBeVisible({ timeout: 30_000 });
    const firstRow = page.locator('[data-testid="worklist"] tr[data-care-work-row]').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    const phaseCell = firstRow.locator("td").nth(3);
    await expect(phaseCell.locator('[data-component="care-meta-chip"], [data-component="care-dominant-status"]')).not.toHaveCount(0);
    await maybeDump(page, "casussen-mobile");
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test("Matching: rows or empty state", async ({ page }) => {
    await goSidebar(page, "Matching");
    await expect(page.getByRole("heading", { name: /^Matching$/i })).toBeVisible({ timeout: 30_000 });
    await maybeDump(page, "matching-desktop");
    const rows = page.locator('article[data-density="compact"]');
    const empty = page.getByText("Geen casussen in matching");
    if (await empty.isVisible().catch(() => false)) {
      await expect(page.getByText(/Zodra samenvatting/i)).toBeVisible();
      return;
    }
    await expect(rows.first()).toBeVisible({ timeout: 30_000 });
    expect(maxMinusMin(await rows.evaluateAll((els) => els.slice(0, 8).map((el) => el.getBoundingClientRect().height)))).toBeLessThan(36);
  });

  test("Plaatsingen: tabs + rows or empty", async ({ page }) => {
    await goSidebar(page, "Plaatsingen");
    await expect(page.getByRole("heading", { name: /Plaatsingen/i })).toBeVisible({ timeout: 30_000 });
    await maybeDump(page, "plaatsingen-desktop");
    await expect(page.getByRole("tab", { name: /Te bevestigen/i })).toBeVisible();
    const rows = page.locator('article[data-density="compact"]');
    if ((await rows.count()) === 0) {
      await expect(page.getByText("Geen plaatsingen in dit overzicht")).toBeVisible();
      return;
    }
    await expect(rows.first()).toBeVisible();
  });

  test("Aanbieder beoordeling: rows or empty", async ({ page }) => {
    await goSidebar(page, "Aanbieder beoordeling");
    await expect(page.getByRole("heading", { name: /Aanbieder beoordeling/i })).toBeVisible({ timeout: 30_000 });
    await maybeDump(page, "beoordeling-desktop");
    const rows = page.locator('article[data-density="compact"]');
    if ((await rows.count()) === 0) {
      await expect(page.getByText("Geen casussen in deze fase")).toBeVisible();
      return;
    }
    await expect(rows.first()).toBeVisible();
    expect(maxMinusMin(await rows.evaluateAll((els) => els.slice(0, 8).map((el) => el.getBoundingClientRect().height)))).toBeLessThan(36);
  });

  test("Acties: sidebar badge matches open CareTask count (stub)", async ({ page }) => {
    const actiesNav = page.getByRole("navigation").getByRole("button", { name: /Acties/i }).first();
    await expect(actiesNav).toContainText("1");
    await goSidebar(page, "Acties");
    await expect(page.locator('article[data-density="compact"]')).toHaveCount(1);
  });

  test("Acties: leading icon + row shell when tasks exist", async ({ page }) => {
    await goSidebar(page, "Acties");
    await expect(page.getByRole("heading", { name: /^Acties$/i })).toBeVisible({ timeout: 30_000 });
    await maybeDump(page, "acties-desktop");
    const rows = page.locator('article[data-density="compact"]');
    const count = await rows.count();
    if (count === 0) {
      await expect(page.getByText("Geen openstaande acties")).toBeVisible();
      return;
    }
    const first = rows.first();
    await expect(first.locator("svg").first()).toBeVisible();
    const aligned = await first.evaluate((row) => {
      const el = row as HTMLElement;
      const lead = el.querySelector("[class*='mt-0.5'][class*='shrink-0']") as HTMLElement | null;
      /** Title stack — must not match the outer `flex-1` row wrapper (also has min-w-0 flex-1). */
      const title = el.querySelector(".min-w-0.flex-1.space-y-1") as HTMLElement | null;
      if (!lead || !title) {
        return false;
      }
      const lr = lead.getBoundingClientRect();
      const tr = title.getBoundingClientRect();
      return lr.right <= tr.left + 10;
    });
    expect(aligned, "leading icon column should sit left of title block").toBe(true);
  });

  test("Design system: unified shell on Regiekamer, Casussen, Matching, Acties, Signalen", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible();
    await expect(page.getByTestId("regiekamer-phase-board")).toBeVisible();
    await expect(page.getByPlaceholder(/Zoek casus, naam of type/i)).toBeVisible();

    await goSidebar(page, "Casussen");
    await expect(page.getByRole("heading", { name: /^Casussen$/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Zoek casussen, cliënten, aanbieders/i)).toBeVisible();

    await goSidebar(page, "Matching");
    await expect(page.getByRole("heading", { name: /^Matching$/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Zoek casus, client of regio/i)).toBeVisible();

    await goSidebar(page, "Acties");
    await expect(page.getByRole("heading", { name: /^Acties$/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Zoek acties of casus ID/i)).toBeVisible();

    await goSidebar(page, "Signalen");
    await expect(page.getByRole("heading", { name: /^Signalen$/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Zoek signalen\.\.\./i)).toBeVisible();
  });
});

function maxMinusMin(heights: number[]): number {
  if (heights.length === 0) {
    return 0;
  }
  return Math.max(...heights) - Math.min(...heights);
}
