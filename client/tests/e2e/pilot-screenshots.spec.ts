/**
 * Fixed viewport captures for pilot documentation — same seed + --locked-time ⇒ stable pixels.
 * Run after `./scripts/prepare_pilot_e2e.sh` and Django (settings_rehearsal) on E2E_BASE_URL.
 */
import path from "path";
import { expect, test } from "@playwright/test";
import { E2E_BASE_URL, pilotDemoGemeentePassword, pilotDemoGemeenteUsername } from "./pilotEnv";

const BASE_URL = E2E_BASE_URL;

test.use({
  colorScheme: "light",
  reducedMotion: "reduce",
  viewport: { width: 1440, height: 900 },
});

async function loginGemeente(page: import("@playwright/test").Page): Promise<void> {
  const username = pilotDemoGemeenteUsername();
  const password = pilotDemoGemeentePassword();
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
    await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible({ timeout: 45_000 });

    const out = path.join(testInfo.outputDir, "pilot-regiekamer-1440x900.png");
    await page.screenshot({ path: out, fullPage: true });
  });
});
