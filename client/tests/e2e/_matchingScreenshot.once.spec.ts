/**
 * One-off visual capture for Matching page — remove after review or keep behind skip.
 */
import { expect, test } from "@playwright/test";
import { installCareApiStubs } from "./helpers/careSpaApiStubs";

test.describe.configure({ mode: "serial" });

test("capture matching page full page @visual", async ({ page }) => {
  const origin = process.env.MATCHING_PAGE_ORIGIN ?? "http://127.0.0.1:3000";
  await page.addInitScript(() => {
    window.localStorage.setItem("careon-theme", "dark");
  });
  await installCareApiStubs(page);
  await page.goto(`${origin}/matching?openCase=e2e-matching-1`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByRole("heading", { name: /Matching/i })).toBeVisible({ timeout: 45_000 });
  await page.screenshot({
    path: "test-results/matching-page-current.png",
    fullPage: true,
  });
});
