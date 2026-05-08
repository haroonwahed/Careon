/**
 * Stack checks before pilot-smoke / pilot-demo (real Django + built SPA).
 *
 * E2E_PROFILE:
 * - pilot-demo (default) — gemeente + provider login + dashboard Regiekamer
 * - pilot-smoke — e2e_owner login + dashboard Regiekamer
 * - all — demo + smoke (run after `./scripts/prepare_pilot_e2e.sh` seeds both tiers)
 *
 * Env: E2E_BASE_URL, E2E_DEMO_PASSWORD, E2E_SMOKE_PASSWORD (see pilotEnv.ts)
 *
 * @see docs/E2E_RUNBOOK.md
 */
import { expect, test } from "@playwright/test";
import {
  E2E_BASE_URL,
  pilotDemoGemeentePassword,
  pilotDemoGemeenteUsername,
  pilotDemoProviderOneUsername,
  pilotDemoProviderPassword,
  pilotDemoProviderTwoUsername,
  pilotSmokePassword,
  pilotSmokeUsername,
} from "./pilotEnv";

const SPA_MOUNT_FAILURE =
  "SPA bundle/static shell did not mount. Build SPA and collect static before running pilot E2E. Run ./scripts/prepare_pilot_e2e.sh (see docs/E2E_RUNBOOK.md).";

const PROFILE_RAW = (process.env.E2E_PROFILE ?? "pilot-demo").trim().toLowerCase();
const PROFILE =
  PROFILE_RAW === "pilot-demo" || PROFILE_RAW === "pilot-smoke" || PROFILE_RAW === "all"
    ? PROFILE_RAW
    : "pilot-demo";

function runPilotDemo(): boolean {
  return PROFILE === "all" || PROFILE === "pilot-demo";
}

function runPilotSmoke(): boolean {
  return PROFILE === "all" || PROFILE === "pilot-smoke";
}

test.describe.configure({ mode: "serial" });

test("base URL serves the login page", async ({ request }) => {
  const res = await request.get(`${E2E_BASE_URL}/login/`);
  expect(res.ok(), `GET ${E2E_BASE_URL}/login/ — start Django (DJANGO_SETTINGS_MODULE=config.settings_rehearsal).`).toBeTruthy();
  const text = await res.text();
  expect(text).toContain("Welkom terug");
});

test("pilot-demo: gemeente login succeeds", async ({ page }) => {
  test.skip(!runPilotDemo(), `skipped: E2E_PROFILE=${PROFILE}`);
  await page.goto(`${E2E_BASE_URL}/login/`);
  await page.getByLabel("Gebruikersnaam").fill(pilotDemoGemeenteUsername());
  await page.getByLabel("Wachtwoord").fill(pilotDemoGemeentePassword());
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw.")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login\/?$/);
});

test("pilot-demo: provider login succeeds", async ({ page }) => {
  test.skip(!runPilotDemo(), `skipped: E2E_PROFILE=${PROFILE}`);
  await page.goto(`${E2E_BASE_URL}/login/`);
  await page.getByLabel("Gebruikersnaam").fill(pilotDemoProviderOneUsername());
  await page.getByLabel("Wachtwoord").fill(pilotDemoProviderPassword());
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw.")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login\/?$/);
});

test("pilot-demo: provider TWO (Kompas / golden-path) login succeeds", async ({ page }) => {
  test.skip(!runPilotDemo(), `skipped: E2E_PROFILE=${PROFILE}`);
  await page.goto(`${E2E_BASE_URL}/login/`);
  await page.getByLabel("Gebruikersnaam").fill(pilotDemoProviderTwoUsername());
  await page.getByLabel("Wachtwoord").fill(pilotDemoProviderPassword());
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw.")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login\/?$/);
});

test("pilot-smoke: owner login succeeds", async ({ page }) => {
  test.skip(!runPilotSmoke(), `skipped: E2E_PROFILE=${PROFILE}`);
  await page.goto(`${E2E_BASE_URL}/login/`);
  await page.getByLabel("Gebruikersnaam").fill(pilotSmokeUsername());
  await page.getByLabel("Wachtwoord").fill(pilotSmokePassword());
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw.")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login\/?$/);
});

test("dashboard: care-sidebar + Regiekamer (demo user)", async ({ page }) => {
  test.skip(!runPilotDemo(), `skipped: E2E_PROFILE=${PROFILE}`);
  await page.goto(`${E2E_BASE_URL}/login/`);
  await page.getByLabel("Gebruikersnaam").fill(pilotDemoGemeenteUsername());
  await page.getByLabel("Wachtwoord").fill(pilotDemoGemeentePassword());
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await page.goto(`${E2E_BASE_URL}/dashboard/`);
  await expect(page.getByTestId("care-sidebar"), SPA_MOUNT_FAILURE).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible({ timeout: 30_000 });
});

test("dashboard: care-sidebar + Regiekamer (smoke user)", async ({ page }) => {
  test.skip(!runPilotSmoke(), `skipped: E2E_PROFILE=${PROFILE}`);
  await page.goto(`${E2E_BASE_URL}/login/`);
  await page.getByLabel("Gebruikersnaam").fill(pilotSmokeUsername());
  await page.getByLabel("Wachtwoord").fill(pilotSmokePassword());
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await page.goto(`${E2E_BASE_URL}/dashboard/`);
  await expect(page.getByTestId("care-sidebar"), SPA_MOUNT_FAILURE).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible({ timeout: 30_000 });
});
