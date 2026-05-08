import { expect, test } from "@playwright/test";
import {
  E2E_BASE_URL,
  pilotSmokePassword,
  pilotSmokeUsername,
} from "./pilotEnv";

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  text: string;
};

const ACCEPT_CASE_TITLE = process.env.E2E_ACCEPT_CASE_TITLE || "E2E Pilot Accept Path";
const REJECT_CASE_TITLE = process.env.E2E_REJECT_CASE_TITLE || "E2E Pilot Reject Path";
const BASE_URL = E2E_BASE_URL;
const E2E_USERNAME = pilotSmokeUsername();
const E2E_PASSWORD = pilotSmokePassword();
const PROVIDER_NAME = process.env.E2E_PROVIDER_NAME || "E2E Provider";

async function apiFetch<T>(
  page: import("@playwright/test").Page,
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const csrf = await page.evaluate(() => {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  });

  const response = await page.evaluate(async ({ path, options, csrf }) => {
    const headers = new Headers(options.headers || {});
    if (options.method && options.method.toUpperCase() !== "GET") {
      headers.set("X-CSRFToken", csrf);
    }
    if (!headers.has("Content-Type") && options.method && options.method.toUpperCase() !== "GET") {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      text,
      json,
    };
  }, { path, options, csrf });

  return response as ApiResponse<T>;
}

async function postJson<T>(page: import("@playwright/test").Page, path: string, body: unknown): Promise<ApiResponse<T>> {
  return apiFetch<T>(page, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function postForm<T>(page: import("@playwright/test").Page, path: string, formData: Record<string, string>): Promise<ApiResponse<T>> {
  const csrf = await page.evaluate(() => {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  });

  return page.evaluate(async ({ path, formData, csrf }) => {
    const body = new URLSearchParams(formData);
    body.set("csrfmiddlewaretoken", csrf);
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "X-CSRFToken": csrf,
      },
      body,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      text,
      json: null,
    };
  }, { path, formData, csrf }) as Promise<ApiResponse<T>>;
}

async function registerTempUser(page: import("@playwright/test").Page) {
  const suffix = Date.now().toString(36);
  const username = `pilot_${suffix}`;
  const email = `${username}@example.com`;
  const password = `X9!vR2#kP8@qL4`;

  await page.goto(new URL("/register/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Maak je account aan" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByLabel("Bevestig wachtwoord").fill(password);
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  /** SignUpView logs the user in and redirects to `/dashboard/` (MultiTenantDemo shell). */
  await page.waitForURL(/\/dashboard\/?(\?.*)?$/, { timeout: 45_000 });
  await expect(
    page.getByTestId("care-sidebar"),
    "SPA bundle/static shell did not mount. Build SPA and collect static before running pilot E2E. Run ./scripts/prepare_pilot_e2e.sh (docs/E2E_RUNBOOK.md).",
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /Regiekamer/i })).toBeVisible({ timeout: 45_000 });
}

async function loginAs(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw."),
    "Login failed. Run ./scripts/prepare_pilot_e2e.sh (seeds e2e_owner); set E2E_SMOKE_PASSWORD / E2E_USERNAME. See docs/E2E_RUNBOOK.md.",
  ).toHaveCount(0);
}

async function logout(page: import("@playwright/test").Page) {
  await postForm(page, "/logout/", { next: "/login/" });
  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
}

async function openDashboard(page: import("@playwright/test").Page) {
  await page.goto(new URL("/dashboard/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Regiekamer" })).toBeVisible();
  await expect(page.getByTestId("care-sidebar")).toBeVisible();
}

async function openCasus(page: import("@playwright/test").Page, caseTitle: string) {
  await page.evaluate(() => {
    const sidebarButtons = Array.from(document.querySelectorAll("aside button"));
    const target = sidebarButtons.find((button) => (button.textContent || "").includes("Casussen"));
    if (!target) {
      throw new Error("Sidebar Casussen button not found");
    }
    (target as HTMLButtonElement).click();
  });
  await expect(page.getByRole("heading", { name: "Casussen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: caseTitle })).toBeVisible();
  const caseCard = page.locator("article").filter({ hasText: caseTitle }).first();
  await expect(caseCard).toBeVisible();
  await caseCard.getByRole("button", { name: "Bekijk detail" }).click();
  await expect(page.getByRole("button", { name: "Terug naar casussen" })).toBeVisible();
}

async function getCaseIdByTitle(page: import("@playwright/test").Page, title: string): Promise<number> {
  const response = await apiFetch<{ contracts: Array<{ id: number; title: string }> }>(page, `/care/api/cases/?q=${encodeURIComponent(title)}`);
  expect(response.ok, `Expected case lookup for ${title} to succeed`).toBeTruthy();
  const match = response.json?.contracts.find((item) => item.title === title);
  expect(match, `Expected to find seeded case ${title}`).toBeTruthy();
  return Number(match?.id);
}

async function getProviderIdByName(page: import("@playwright/test").Page, name: string): Promise<number> {
  const response = await apiFetch<{ providers: Array<{ id: string; name: string }> }>(page, `/care/api/providers/?q=${encodeURIComponent(name)}`);
  expect(response.ok, `Expected provider lookup for ${name} to succeed`).toBeTruthy();
  const match = response.json?.providers.find((item) => item.name === name);
  expect(match, `Expected to find seeded provider ${name}`).toBeTruthy();
  return Number(match?.id);
}

async function getAccessibleRegiekamerTitle(page: import("@playwright/test").Page): Promise<string> {
  const [overviewResponse, casesResponse] = await Promise.all([
    apiFetch<{ items: Array<{ title: string }> }>(page, "/care/api/regiekamer/decision-overview/"),
    apiFetch<{ contracts: Array<{ title: string }> }>(page, "/care/api/cases/"),
  ]);

  expect(overviewResponse.ok, "Expected Regiekamer decision overview to load").toBeTruthy();
  expect(casesResponse.ok, "Expected visible cases list to load").toBeTruthy();

  const visibleTitles = new Set((casesResponse.json?.contracts ?? []).map((item) => item.title));
  const match = (overviewResponse.json?.items ?? []).find((item) => visibleTitles.has(item.title));
  expect(match, "Expected at least one Regiekamer item to be visible in the case list").toBeTruthy();
  return String(match?.title);
}

async function getFirstVisibleCaseTitle(page: import("@playwright/test").Page): Promise<string> {
  const response = await apiFetch<{ contracts: Array<{ title: string }> }>(page, "/care/api/cases/");
  expect(response.ok, "Expected visible case list to load").toBeTruthy();
  const title = response.json?.contracts?.[0]?.title;
  expect(title, "Expected at least one visible case").toBeTruthy();
  return String(title);
}

test.describe.configure({ mode: "serial" });

test("pilot smoke covers login, register, Regiekamer, and casus detail", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle(/CareOn|SaaS Careon|Zorgregie/i);
  await expect(page.getByRole("heading", { name: /Van casus tot intake in één regieomgeving/i })).toBeVisible();

  await registerTempUser(page);
  await logout(page);
  await loginAs(page, E2E_USERNAME, E2E_PASSWORD);
  await openDashboard(page);

  const worklistItems = page.getByTestId("regiekamer-worklist-item");
  if (await worklistItems.count()) {
    const visibleCaseTitle = await getFirstVisibleCaseTitle(page);
    await openCasus(page, visibleCaseTitle);
    await expect(page.getByRole("button", { name: "Terug naar casussen" })).toBeVisible();
  }
});
