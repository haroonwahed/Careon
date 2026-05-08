/**
 * Settings workspace: navigation, URL sync, governance chrome.
 * Uses Playwright `baseURL` — Django (`E2E_BASE_URL`, default :8010) or Vite (`:3000` / env).
 */
import { expect, test } from "@playwright/test";
import { goSidebar, installCareApiStubs, spaDashboardPath } from "./helpers/careSpaApiStubs";

test.describe.configure({ mode: "serial", timeout: 90_000 });

async function stubDesignMode(page: import("@playwright/test").Page) {
  await page.route("**/settings/design-mode/**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, design_mode: "spa" }),
      });
      return;
    }
    await route.continue();
  });
}

test.describe("Instellingen workspace", () => {
  test.describe("via shell navigatie", () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("careon-theme", "dark");
      });
      await stubDesignMode(page);
      await installCareApiStubs(page);
      await page.goto(spaDashboardPath(baseURL), { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: /Regiekamer/i, level: 1 })).toBeVisible({ timeout: 45_000 });
      await goSidebar(page, "Instellingen");
      await expect(page.getByTestId("instellingen-workspace")).toBeVisible({ timeout: 30_000 });
    });

    test("sidebar switches section and syncs URL query", async ({ page }) => {
      await page.getByTestId("settings-nav-workflow-regie").click();
      await expect(page.getByRole("heading", { name: "Workflow & regie", level: 2 })).toBeVisible();
      await expect(page).toHaveURL(/[?&]section=workflow-regie/);
    });

    test("nav lists operational sections with stable test ids", async ({ page }) => {
      await expect(page.getByTestId("settings-nav-api-developers")).toBeVisible();
      await expect(page.getByTestId("settings-nav-documenten-privacy")).toBeVisible();
    });

    test("profile menu opens the dedicated profiel page and can hand off to instellingen", async ({ page }) => {
      await page.getByRole("button", { name: /test/i }).click();
      await page.getByRole("button", { name: "Profiel" }).click();
      await expect(page.getByRole("heading", { name: "Profiel", level: 1 })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(/persoonlijke accountprofiel/i)).toBeVisible();
      await page.getByRole("button", { name: "Naar instellingen" }).click();
      await expect(page.getByRole("heading", { name: /Operationele regie/i })).toBeVisible({ timeout: 30_000 });
    });
  });

  test.describe("diepe link", () => {
    test("opens section from URL query on direct load", async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("careon-theme", "dark");
      });
      await stubDesignMode(page);
      await installCareApiStubs(page);
      await page.goto("/instellingen?view=dashboard&section=audit-compliance", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("instellingen-workspace")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByRole("heading", { name: "Audit & compliance", level: 2 })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page).toHaveURL(/[?&]section=audit-compliance/);
    });
  });
});
