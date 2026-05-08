/**
 * Aanbieder beoordeling (gemeente monitoring) — stubbed API + full-page capture for visual review.
 *
 * Prerequisites: Vite dev server (default port 3000).
 *
 * Run:
 *   cd client && npm run dev -- --port 3000 --host 127.0.0.1
 *   E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/aanbieder-beoordeling-visual.spec.ts
 *
 * Optional pixel baseline (creates/updates Playwright snapshot PNG under test file snapshots folder):
 *   CARE_AB_SNAPSHOT=1 E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/aanbieder-beoordeling-visual.spec.ts --update-snapshots
 *
 * Output every run: test-results/aanbieder-beoordeling-current.png
 */
import { expect, test } from "@playwright/test";
import { installCareApiStubs, SPA_ORIGIN } from "./helpers/careSpaApiStubs";

test.describe.configure({ mode: "serial", timeout: 90_000 });

test.describe("Aanbieder beoordeling visual (SPA)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("careon-theme", "dark");
    });
    await installCareApiStubs(page);
  });

  test("renders gemeente monitoring layout and writes PNG dump @visual", async ({ page }) => {
    const origin = process.env.E2E_SPA_URL ?? process.env.PLAYWRIGHT_SPA_URL ?? SPA_ORIGIN.replace(/\/$/, "");
    const dashboardBeoordelingUrl = origin + "/beoordelingen?view=dashboard";

    await page.goto(dashboardBeoordelingUrl, {
      waitUntil: "domcontentloaded",
    });

    await expect(page.getByRole("heading", { name: "Aanbieder beoordeling" })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByTestId("aanbieder-beoordeling-gemeente-root")).toBeVisible();
    await expect(page.getByText(/Levvel Jeugd & Opvoedhulp/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Herinner aanbieders" })).toBeVisible();

    await page.screenshot({
      path: "test-results/aanbieder-beoordeling-current.png",
      fullPage: true,
    });

    if (process.env.CARE_AB_SNAPSHOT === "1") {
      await expect(page).toHaveScreenshot("aanbieder-beoordeling-full.png", {
        fullPage: true,
        animations: "disabled",
        maxDiffPixels: 25_000,
      });
    }
  });
});
