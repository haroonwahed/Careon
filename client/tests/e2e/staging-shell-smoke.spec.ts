/**
 * Staging-shell smoke (dual role): gemeente werklijst + operationele coördinatie routes mount
 * with the same stack as pilot E2E (`prepare_pilot_e2e`, `settings_rehearsal`).
 *
 * Run (from client/):
 *   npx playwright test tests/e2e/staging-shell-smoke.spec.ts
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
} from "./pilotEnv";

const BASE_URL = E2E_BASE_URL;

async function login(page: import("@playwright/test").Page, username: string, password: string): Promise<void> {
  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw."),
    "Login failed — run ./scripts/prepare_pilot_e2e.sh and demo credentials.",
  ).toHaveCount(0);
}

test("gemeente smoke: casussen werkvoorraad shell mounts", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoGemeenteUsername(), pilotDemoGemeentePassword());
  await page.goto(new URL("/care/casussen", BASE_URL).toString());
  await expect(page.getByTestId("care-sidebar")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("casussen-uitvoerlijst")).toBeVisible({ timeout: 45_000 });
});

test("gemeente smoke: Regiekamer shell mounts", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoGemeenteUsername(), pilotDemoGemeentePassword());
  await page.goto(new URL("/regiekamer", BASE_URL).toString());
  await expect(page.getByTestId("care-sidebar")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /Coördinatie/i })).toBeVisible({ timeout: 45_000 });
});

test("provider smoke: Reacties route still mounts (cross-check)", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());
  await page.goto(new URL("/care/beoordelingen", BASE_URL).toString());
  await expect(page.getByTestId("care-sidebar")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /Reacties/i })).toBeVisible({ timeout: 45_000 });
});
