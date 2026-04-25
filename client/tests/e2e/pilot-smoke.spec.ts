import { expect, test } from "@playwright/test";

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  text: string;
};

const ACCEPT_CASE_TITLE = process.env.E2E_ACCEPT_CASE_TITLE || "E2E Pilot Accept Path";
const REJECT_CASE_TITLE = process.env.E2E_REJECT_CASE_TITLE || "E2E Pilot Reject Path";
const E2E_PASSWORD = process.env.E2E_PASSWORD || "e2e_pass_123";
const E2E_USERNAME = process.env.E2E_USERNAME || "e2e_owner";
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

  await page.goto("/register/");
  await expect(page.getByRole("heading", { name: "Maak je account aan" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("E-mailadres").fill(email);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByLabel("Bevestig wachtwoord").fill(password);
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
}

async function loginAs(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/login/");
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
}

async function logout(page: import("@playwright/test").Page) {
  await postForm(page, "/logout/", { next: "/login/" });
  await page.goto("/login/");
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
}

async function openDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard/");
  await expect(page.getByRole("heading", { name: "Regiekamer" })).toBeVisible();
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
  await expect(page.getByText("Volgende stap").first()).toBeVisible();
  await expect(page.getByText("Casuspad")).toBeVisible();
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

test.describe.configure({ mode: "serial" });

test("pilot smoke covers login, register, workflow gates, and archive", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("CareOn - Zorgregieplatform");
  await expect(page.getByRole("heading", { name: /Het regiecentrum voor/i })).toBeVisible();

  await registerTempUser(page);
  await logout(page);
  await loginAs(page, E2E_USERNAME, E2E_PASSWORD);
  await openDashboard(page);

  const acceptCaseId = await getCaseIdByTitle(page, ACCEPT_CASE_TITLE);
  const rejectCaseId = await getCaseIdByTitle(page, REJECT_CASE_TITLE);
  const providerId = await getProviderIdByName(page, PROVIDER_NAME);

  await openCasus(page, ACCEPT_CASE_TITLE);
  await expect(page.getByRole("button", { name: "Samenvatting genereren" }).first()).toBeVisible();

  let response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/assessment-decision/`, {
    decision: "",
    shortDescription: "Samenvatting is aangemaakt voor pilot-smoke.",
    urgency: "MEDIUM",
    zorgtype: "OUTPATIENT",
  });
  expect(response.ok).toBeTruthy();
  await page.reload();
  await openCasus(page, ACCEPT_CASE_TITLE);
  await expect(page.getByRole("button", { name: "Start matching" }).first()).toBeVisible();

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/assessment-decision/`, {
    decision: "matching",
    shortDescription: "Samenvatting bevestigd en casus is klaar voor matching.",
    urgency: "MEDIUM",
    zorgtype: "OUTPATIENT",
  });
  expect(response.ok).toBeTruthy();
  await page.reload();
  await openCasus(page, ACCEPT_CASE_TITLE);
  await expect(page.getByRole("button", { name: "Stuur naar aanbieder" }).first()).toBeVisible();

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/matching/action/`, {
    action: "assign",
    provider_id: providerId,
  });
  expect(response.ok).toBeTruthy();
  await page.reload();
  await openCasus(page, ACCEPT_CASE_TITLE);
  await expect(page.getByRole("button", { name: "Wacht op aanbiederreactie" }).first()).toBeVisible();

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/placement-action/`, {
    status: "APPROVED",
  });
  expect(response.ok).toBeFalsy();
  expect(response.status).toBe(400);
  expect(response.text).toContain("Ongeldige workflow-overgang");

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/provider-decision/`, {
    status: "ACCEPTED",
    provider_comment: "Geschikt voor pilot-smoke.",
  });
  expect(response.ok).toBeTruthy();
  await page.reload();
  await openCasus(page, ACCEPT_CASE_TITLE);
  await expect(page.getByRole("button", { name: "Bevestig plaatsing" }).first()).toBeVisible();

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/intake-action/`, {});
  expect(response.ok).toBeFalsy();
  expect(response.status).toBe(400);
  expect(response.text).toContain("Ongeldige workflow-overgang");

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/placement-action/`, {
    status: "APPROVED",
    note: "Plaatsing bevestigd vanuit pilot-smoke.",
  });
  expect(response.ok).toBeTruthy();
  await page.reload();
  await openCasus(page, ACCEPT_CASE_TITLE);
  await expect(page.getByRole("button", { name: "Start intake" }).first()).toBeVisible();

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${acceptCaseId}/intake-action/`, {});
  expect(response.ok).toBeTruthy();
  await page.reload();
  await openCasus(page, ACCEPT_CASE_TITLE);
  await expect(page.getByRole("button", { name: "Monitor casus" }).first()).toBeVisible();

  response = await postForm<{ ok: boolean }>(page, `/care/casussen/${acceptCaseId}/archive/`, {});
  expect(response.ok).toBeTruthy();
  await page.reload();
  await page.locator("aside nav").getByRole("button", { name: /^Casussen/ }).click();
  await expect(page.getByText(ACCEPT_CASE_TITLE, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: REJECT_CASE_TITLE })).toBeVisible();

  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${rejectCaseId}/assessment-decision/`, {
    decision: "",
    shortDescription: "Samenvatting is aangemaakt voor pilot-smoke.",
    urgency: "MEDIUM",
    zorgtype: "OUTPATIENT",
  });
  expect(response.ok).toBeTruthy();
  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${rejectCaseId}/assessment-decision/`, {
    decision: "matching",
    shortDescription: "Casus kan naar aanbiederbeoordeling.",
    urgency: "MEDIUM",
    zorgtype: "OUTPATIENT",
  });
  expect(response.ok).toBeTruthy();
  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${rejectCaseId}/matching/action/`, {
    action: "assign",
    provider_id: providerId,
  });
  expect(response.ok).toBeTruthy();
  response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${rejectCaseId}/provider-decision/`, {
    status: "REJECTED",
    rejection_reason_code: "CAPACITY",
    provider_comment: "Geen capaciteit voor deze casus.",
  });
  expect(response.ok).toBeTruthy();
  await page.reload();
  await openCasus(page, REJECT_CASE_TITLE);
  await expect(page.getByText("Geblokkeerde acties")).toBeVisible();
  await expect(page.getByText("Vereiste vorige stap:", { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Terug naar casussen" }).click();
  await expect(page.getByRole("heading", { name: REJECT_CASE_TITLE })).toBeVisible();

  await logout(page);
});
