/**
 * Minimal "happy path" smoke for the four critical session edges:
 *   public landing  →  login  →  dashboard mounts  →  logout  →  back at /login/
 *
 * Complements `pilot-smoke.spec.ts` (which exercises register + casus detail).
 * This spec exists so that a single deploy gate can answer "can a returning
 * user with valid credentials sign in, see the regielaag, and sign out?"
 * without depending on registration or seeded case content.
 */
import { expect, test } from "@playwright/test";
import { E2E_BASE_URL, pilotSmokePassword, pilotSmokeUsername } from "./pilotEnv";

const BASE_URL = E2E_BASE_URL;
const USERNAME = pilotSmokeUsername();
const PASSWORD = pilotSmokePassword();

async function csrfFromCookie(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  });
}

test("public landing → login → dashboard → logout returns to /login/", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/CareOn|SaaS Careon|Zorgregie/i);
  await expect(
    page.getByRole("heading", { name: /Van casus tot intake in één regieomgeving/i }),
  ).toBeVisible();

  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(USERNAME);
  await page.getByLabel("Wachtwoord").fill(PASSWORD);
  await page.getByRole("button", { name: "Inloggen" }).click();

  await page.waitForURL(/\/dashboard\/?(\?.*)?$/, { timeout: 45_000 });
  await expect(
    page.getByTestId("care-sidebar"),
    "SPA shell did not mount on /dashboard/. Run ./scripts/prepare_pilot_e2e.sh.",
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible({ timeout: 45_000 });

  const csrf = await csrfFromCookie(page);
  await page.evaluate(async ({ csrf }) => {
    const body = new URLSearchParams({ csrfmiddlewaretoken: csrf, next: "/login/" });
    await fetch("/logout/", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-CSRFToken": csrf,
      },
      body,
    });
  }, { csrf });

  await page.goto(new URL("/dashboard/", BASE_URL).toString());
  await page.waitForURL(/\/login\/?(\?.*)?$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
});
