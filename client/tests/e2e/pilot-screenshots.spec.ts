/**
 * Fixed viewport captures for pilot documentation — same seed + --locked-time ⇒ stable pixels.
 * Run after `./scripts/prepare_pilot_e2e.sh` and Django (settings_rehearsal) on E2E_BASE_URL.
 */
import path from "path";
import { expect, test } from "@playwright/test";
import { E2E_BASE_URL, pilotSmokePassword, pilotSmokeUsername } from "./pilotEnv";

const BASE_URL = E2E_BASE_URL;

test.use({
  colorScheme: "dark",
  reducedMotion: "reduce",
  viewport: { width: 1440, height: 900 },
});

async function loginGemeente(page: import("@playwright/test").Page): Promise<void> {
  const username = pilotSmokeUsername();
  const password = pilotSmokePassword();
  await page.addInitScript(() => {
    window.localStorage.setItem("careon-theme", "dark");
  });
  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  const loginError = page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw.");
  await expect(loginError).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login\/?$/);
}

test.describe("pilot deterministic screenshots", () => {
  test("regiekamer dashboard (full page)", async ({ page }, testInfo) => {
    await loginGemeente(page);
    await page.goto(new URL("/dashboard/", BASE_URL).toString());
    await expect(page.getByTestId("care-sidebar")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("heading", { name: /Coördinatie/i })).toBeVisible({ timeout: 45_000 });

    const out = path.join(testInfo.outputDir, "pilot-regiekamer-1440x900.png");
    await page.screenshot({ path: out, fullPage: true });
  });

  test("/login redirects authenticated users to the new dashboard", async ({ page }) => {
    await loginGemeente(page);
    await page.goto(new URL("/login/", BASE_URL).toString());
    await expect(page).not.toHaveURL(/\/login\/?$/);
    await expect(page.getByRole("heading", { name: /Coördinatie/i })).toBeVisible({ timeout: 45_000 });
  });

  test("nieuwe casus uses the available workspace width", async ({ page }, testInfo) => {
    await loginGemeente(page);
    await page.goto(new URL("/casussen/nieuw", BASE_URL).toString());
    await expect(page.getByRole("heading", { name: /^Nieuwe casus$/i })).toBeVisible({ timeout: 45_000 });

    await page.getByLabel("Bronregistratie *").selectOption("jeugdplatform");
    await page.getByLabel("Zoek bronreferentie *").fill("ZS-2026-8821");

    const out = path.join(testInfo.outputDir, "pilot-nieuwe-casus-1440x900.png");
    await page.screenshot({ path: out, fullPage: true });

    await page.getByRole("button", { name: "Volgende stap" }).click();
    await expect(page.getByRole("heading", { name: /^Zorgvraag$/i })).toBeVisible({ timeout: 45_000 });
    const step2Out = path.join(testInfo.outputDir, "pilot-nieuwe-casus-step2-1440x900.png");
    await page.screenshot({ path: step2Out, fullPage: true });

    await page.getByLabel("Hoofdcategorie *").selectOption({ index: 1 });
    await page.getByRole("radiogroup", { name: "Complexiteit" }).getByRole("radio", { name: "Meervoudig" }).click();
    await page.getByRole("radiogroup", { name: "Urgentie" }).getByRole("radio", { name: "Middel" }).click();
    await page.getByRole("button", { name: "Volgende" }).click();
    await expect(page.getByRole("heading", { name: /Samenvatting voor verzending/i })).toBeVisible({ timeout: 45_000 });
    const step3Out = path.join(testInfo.outputDir, "pilot-nieuwe-casus-step3-1440x900.png");
    await page.screenshot({ path: step3Out, fullPage: true });
  });

  test("settings page uses the new slim authenticated shell", async ({ page }, testInfo) => {
    await loginGemeente(page);
    await page.goto(new URL("/settings/", BASE_URL).toString());
    await expect(page.getByRole("heading", { name: /Operationele regie/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Careon ZORGREGIE")).toHaveCount(0);
    await expect(page.getByText("CASUSMANAGEMENT")).toHaveCount(0);
    await expect(page.getByText("Rapportages & regie")).toHaveCount(0);

    const out = path.join(testInfo.outputDir, "pilot-settings-1440x900.png");
    await page.screenshot({ path: out, fullPage: true });
  });
});
