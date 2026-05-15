/**
 * Minimal pilot-stack API helpers for Zorg OS golden-path E2E.
 * Requires Django rehearsal + seed_pilot_e2e (see docs/E2E_RUNBOOK.md).
 */

import { expect } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_MUNICIPALITY_NAME,
  E2E_PROVIDER_TWO_NAME,
  E2E_REGION_NAME,
  pilotDemoGemeentePassword,
  pilotDemoGemeenteUsername,
  pilotDemoProviderPassword,
  pilotDemoProviderTwoUsername,
} from "../pilotEnv";

export const GOLDEN_PATH_BASE_URL = E2E_BASE_URL;

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  text: string;
};

export type DecisionEvaluationResponse = {
  current_state: string;
  phase?: string;
  next_best_action: { action: string; label: string } | null;
};

export async function apiFetch<T>(
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

  const typed = response as ApiResponse<T>;
  if (typeof typed.text === "string" && typed.text.includes("<title>Inloggen - Careon</title>")) {
    return {
      ok: false,
      status: 401,
      json: null,
      text: "AUTH_REDIRECT_LOGIN_PAGE",
    };
  }
  return typed;
}

export async function postJson<T>(
  page: import("@playwright/test").Page,
  path: string,
  body: unknown,
): Promise<ApiResponse<T>> {
  return apiFetch<T>(page, path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function loginAs(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto(new URL("/login/", GOLDEN_PATH_BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw."),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login\/?$/);
}

export async function logout(page: import("@playwright/test").Page) {
  const csrf = await page.evaluate(() => {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  });
  await page.evaluate(async ({ csrf }) => {
    const body = new URLSearchParams({ next: "/login/", csrfmiddlewaretoken: csrf });
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
  await page.goto(new URL("/login/", GOLDEN_PATH_BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
}

function findOptionByLabel<T extends { label: string }>(items: Array<T> | undefined, name: string): T {
  const candidates = items || [];
  const match = candidates.find((item) => item.label.includes(name));
  if (match) return match;
  expect(candidates.length).toBeGreaterThan(0);
  return candidates[0] as T;
}

function findOptionByContains<T extends { label: string }>(items: Array<T> | undefined, needle: string): T {
  const match = (items || []).find((item) => item.label.includes(needle));
  expect(match).toBeTruthy();
  return match as T;
}

type IntakeFormResponse = {
  initial_values: Record<string, unknown>;
  options: {
    gemeente?: Array<{ value: string; label: string }>;
    preferred_region?: Array<{ value: string; label: string }>;
    case_coordinator?: Array<{ value: string; label: string }>;
  };
};

type CreateCaseResponse = {
  ok: boolean;
  id: number;
  title: string;
  case_id: string;
};

export async function getDecisionEvaluation(
  page: import("@playwright/test").Page,
  caseId: number,
): Promise<DecisionEvaluationResponse> {
  const response = await apiFetch<DecisionEvaluationResponse>(
    page,
    `/care/api/cases/${caseId}/decision-evaluation/`,
  );
  expect(response.ok, `decision-evaluation failed: ${response.text}`).toBeTruthy();
  return response.json as DecisionEvaluationResponse;
}

async function getCaseIdByTitle(page: import("@playwright/test").Page, title: string): Promise<number> {
  const response = await apiFetch<{ contracts: Array<{ id: number; title: string }> }>(
    page,
    `/care/api/cases/?q=${encodeURIComponent(title)}`,
  );
  expect(response.ok).toBeTruthy();
  const match = response.json?.contracts.find((item) => item.title === title);
  expect(match, `case titled "${title}"`).toBeTruthy();
  return Number(match?.id);
}

function findByFieldContains<T extends Record<string, unknown>>(
  items: Array<T> | undefined,
  field: string,
  needle: string,
): T {
  const match = (items || []).find((item) => String(item[field] || "").includes(needle));
  expect(match).toBeTruthy();
  return match as T;
}

/**
 * Seeds:
 * - Golden case: summary → matching → sent to provider two (awaiting provider).
 * - Decoy case: stops at SUMMARY_READY (never broadcast to provider).
 */
export async function seedGoldenPathCases(page: import("@playwright/test").Page): Promise<{
  goldenCaseId: number;
  goldenTitle: string;
  decoyCaseId: number;
  decoyTitle: string;
}> {
  const suffix = Date.now().toString(36);
  const goldenTitle = `Zorg OS Golden Path ${suffix}`;
  const decoyTitle = `Zorg OS Decoy ${suffix}`;
  const GEMEENTE_USERNAME = pilotDemoGemeenteUsername();
  const GEMEENTE_PASSWORD = pilotDemoGemeentePassword();

  await loginAs(page, GEMEENTE_USERNAME, GEMEENTE_PASSWORD);

  const bootstrap = await apiFetch<IntakeFormResponse>(page, "/care/api/cases/intake-form/");
  expect(bootstrap.ok).toBeTruthy();

  const municipality = (bootstrap.json?.options.gemeente || []).length > 0
    ? findOptionByLabel(bootstrap.json?.options.gemeente, E2E_MUNICIPALITY_NAME)
    : null;
  const region = (bootstrap.json?.options.preferred_region || []).length > 0
    ? findOptionByLabel(bootstrap.json?.options.preferred_region, E2E_REGION_NAME)
    : null;
  const coordinator = (bootstrap.json?.options.case_coordinator || []).length > 0
    ? findOptionByContains(bootstrap.json?.options.case_coordinator, GEMEENTE_USERNAME)
    : null;

  const basePayload = {
    ...bootstrap.json?.initial_values,
    start_date: new Date().toISOString().slice(0, 10),
    target_completion_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    assessment_summary: "",
    urgency: "HIGH",
    complexity: "MULTIPLE",
    zorgvorm_gewenst: "OUTPATIENT",
    preferred_care_form: "OUTPATIENT",
    preferred_region_type: "GEMEENTELIJK",
    preferred_region: region?.value ?? bootstrap.json?.initial_values.preferred_region,
    gemeente: municipality?.value ?? bootstrap.json?.initial_values.gemeente,
    case_coordinator: coordinator?.value ?? bootstrap.json?.initial_values.case_coordinator,
    problematiek_types: "thuiszitproblematiek",
  };

  const goldenCreate = await postJson<CreateCaseResponse>(page, "/care/api/cases/intake-create/", {
    ...basePayload,
    title: goldenTitle,
    description: "Golden path E2E — keten door gemeente en aanbieder.",
  });
  expect(goldenCreate.ok, goldenCreate.text).toBeTruthy();
  let goldenCaseId = Number(goldenCreate.json?.case_id ?? goldenCreate.json?.id);
  if (!Number.isFinite(goldenCaseId) || goldenCaseId <= 0) {
    goldenCaseId = await getCaseIdByTitle(page, goldenTitle);
  }

  const summaryGolden = await postJson(page, `/care/api/cases/${goldenCaseId}/assessment-decision/`, {
    decision: "",
    shortDescription: "Samenvatting gereed voor matching.",
    urgency: "HIGH",
    zorgtype: "OUTPATIENT",
    workflow_summary: {
      context: "Golden path samenvatting.",
      urgency: "HIGH",
      risks: ["FAMILY_STRESS"],
      missing_information: "",
      risks_none_ack: false,
    },
  });
  expect(summaryGolden.ok, String(summaryGolden.text)).toBeTruthy();

  const matchingGolden = await postJson(page, `/care/api/cases/${goldenCaseId}/assessment-decision/`, {
    decision: "matching",
    shortDescription: "Door naar matching.",
    urgency: "HIGH",
    zorgtype: "OUTPATIENT",
    constraints: ["URGENT"],
  });
  expect(matchingGolden.ok, String(matchingGolden.text)).toBeTruthy();

  const providers = await apiFetch<{ providers: Array<{ id: string; name: string }> }>(page, "/care/api/providers/");
  expect(providers.ok).toBeTruthy();
  const providerTwo = findByFieldContains(providers.json?.providers, "name", E2E_PROVIDER_TWO_NAME);

  const assignGolden = await postJson(page, `/care/api/cases/${goldenCaseId}/matching/action/`, {
    action: "assign",
    provider_id: providerTwo.id,
  });
  if (!assignGolden.ok) {
    // Seed shape may evolve: the case could already be in provider review, in which case the backend
    // correctly rejects re-assigning.
    expect(String(assignGolden.text)).toContain("Ongeldige workflow-overgang");
  }

  let evaluation = await getDecisionEvaluation(page, goldenCaseId);
  expect(evaluation.current_state).toBe("PROVIDER_REVIEW_PENDING");

  const decoyCreate = await postJson<CreateCaseResponse>(page, "/care/api/cases/intake-create/", {
    ...basePayload,
    title: decoyTitle,
    description: "Decoy — niet naar aanbieder verstuurd.",
  });
  expect(decoyCreate.ok, String(decoyCreate.text)).toBeTruthy();
  let decoyCaseId = Number(decoyCreate.json?.case_id ?? decoyCreate.json?.id);
  if (!Number.isFinite(decoyCaseId) || decoyCaseId <= 0) {
    decoyCaseId = await getCaseIdByTitle(page, decoyTitle);
  }

  const summaryDecoy = await postJson(page, `/care/api/cases/${decoyCaseId}/assessment-decision/`, {
    decision: "",
    shortDescription: "Alleen samenvatting — geen matching.",
    urgency: "NORMAL",
    zorgtype: "OUTPATIENT",
    workflow_summary: {
      context: "Decoy casus.",
      urgency: "NORMAL",
      risks: [],
      missing_information: "",
      risks_none_ack: true,
    },
  });
  expect(summaryDecoy.ok, String(summaryDecoy.text)).toBeTruthy();
  evaluation = await getDecisionEvaluation(page, decoyCaseId);
  expect(evaluation.current_state).toBe("SUMMARY_READY");

  await logout(page);

  return { goldenCaseId, goldenTitle, decoyCaseId, decoyTitle };
}

export async function postJsonPlacementApprove(
  page: import("@playwright/test").Page,
  caseId: number,
): Promise<void> {
  const response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${caseId}/placement-action/`, {
    status: "APPROVED",
    note: "Plaatsing bevestigd (golden path E2E).",
  });
  expect(response.ok, String(response.text)).toBeTruthy();
}

export async function postJsonIntakeStart(page: import("@playwright/test").Page, caseId: number): Promise<void> {
  const response = await postJson<{ ok: boolean }>(page, `/care/api/cases/${caseId}/intake-action/`, {});
  expect(response.ok, String(response.text)).toBeTruthy();
}

export function pilotProviderTwoCredentials() {
  return {
    username: pilotDemoProviderTwoUsername(),
    password: pilotDemoProviderPassword(),
  };
}
