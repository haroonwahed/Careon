import { expect, test } from "@playwright/test";

type ApiResponse<T> = {
  ok: boolean;
  status: number;
  json: T | null;
  text: string;
};

type IntakeFormResponse = {
  initial_values: Record<string, unknown>;
  options: {
    case_coordinator?: Array<{ value: string; label: string }>;
    gemeente?: Array<{ value: string; label: string }>;
    preferred_region?: Array<{ value: string; label: string }>;
  };
};

type CreateCaseResponse = {
  ok: boolean;
  id: number;
  title: string;
  case_id: string;
  redirect_url: string;
};

type DecisionEvaluationResponse = {
  current_state: string;
  phase: string;
  next_best_action: { action: string; label: string } | null;
  blockers: Array<{ code: string; message: string; severity: string }>;
  alerts: Array<{ code: string; message: string; severity: string }>;
  risks: Array<{ code: string; message: string; severity: string }>;
};

type RegiekamerOverviewResponse = {
  totals: {
    active_cases: number;
    critical_blockers: number;
    high_priority_alerts: number;
    provider_sla_breaches: number;
    repeated_rejections: number;
    intake_delays: number;
  };
  items: Array<{
    case_id: number;
    title: string;
    priority_score: number;
    next_best_action: { action: string; label: string } | null;
    top_blocker: { code: string; message: string; severity: string } | null;
    top_alert: { code: string; message: string; severity: string } | null;
  }>;
};

const PASSWORD = process.env.E2E_PASSWORD || "pilot_demo_pass_123";
const GEMEENTE_USERNAME = process.env.E2E_GEMEENTE_USERNAME || "demo_gemeente";
const PROVIDER_ONE_USERNAME = process.env.E2E_PROVIDER_ONE_USERNAME || "demo_provider_brug";
const PROVIDER_TWO_USERNAME = process.env.E2E_PROVIDER_TWO_USERNAME || "demo_provider_kompas";
const PROVIDER_ONE_NAME = process.env.E2E_PROVIDER_ONE_NAME || "Jeugdzorg De Brug";
const PROVIDER_TWO_NAME = process.env.E2E_PROVIDER_TWO_NAME || "Kompas Jeugdzorg";
const MUNICIPALITY_NAME = process.env.E2E_MUNICIPALITY_NAME || "Gemeente Utrecht";
const REGION_NAME = process.env.E2E_REGION_NAME || "Regio Utrecht";
const CASE_TITLE = process.env.E2E_DEMO_CASE_TITLE || "Pilot demo casus: urgente jeugdzorg";
const BASE_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:8010";

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

async function postForm<T>(
  page: import("@playwright/test").Page,
  path: string,
  formData: Record<string, string>,
): Promise<ApiResponse<T>> {
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

async function loginAs(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("Wachtwoord").fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForLoadState("networkidle");
}

async function logout(page: import("@playwright/test").Page) {
  await postForm(page, "/logout/", { next: "/login/" });
  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
}

function findByFieldContains<T extends Record<string, unknown>>(
  items: Array<T> | undefined,
  field: string,
  needle: string,
): T {
  const match = (items || []).find((item) => String(item[field] || "").includes(needle));
  expect(match, `Expected to find ${needle}`).toBeTruthy();
  return match as T;
}

function findOptionByLabel<T extends { label: string }>(items: Array<T> | undefined, name: string): T {
  const match = (items || []).find((item) => item.label.includes(name));
  expect(match, `Expected to find ${name}`).toBeTruthy();
  return match as T;
}

async function getCaseId(page: import("@playwright/test").Page, title: string): Promise<number> {
  const response = await apiFetch<{ contracts: Array<{ id: number; title: string }> }>(page, `/care/api/cases/?q=${encodeURIComponent(title)}`);
  expect(response.ok).toBeTruthy();
  const match = response.json?.contracts.find((item) => item.title === title);
  expect(match, `Expected case ${title}`).toBeTruthy();
  return Number(match?.id);
}

function findOptionByContains<T extends { label: string }>(items: Array<T> | undefined, needle: string): T {
  const match = (items || []).find((item) => item.label.includes(needle));
  expect(match, `Expected to find option containing ${needle}`).toBeTruthy();
  return match as T;
}

async function getDecisionEvaluation(page: import("@playwright/test").Page, caseId: number): Promise<DecisionEvaluationResponse> {
  const response = await apiFetch<DecisionEvaluationResponse>(
    page,
    `/care/api/cases/${caseId}/decision-evaluation/`,
  );
  expect(response.ok, "Expected decision evaluation to load").toBeTruthy();
  return response.json as DecisionEvaluationResponse;
}

test.describe.configure({ mode: "serial" });

test("pilot demo part 1 creates case, summary, matching, rejection, and Regiekamer flag", async ({ page }) => {
  await page.goto(BASE_URL);
  await expect(page).toHaveTitle("CareOn - Zorgregieplatform");

  await loginAs(page, GEMEENTE_USERNAME, PASSWORD);

  const bootstrap = await apiFetch<IntakeFormResponse>(page, "/care/api/cases/intake-form/");
  expect(bootstrap.ok, "Expected intake form bootstrap").toBeTruthy();

  const municipality = findOptionByLabel(bootstrap.json?.options.gemeente, MUNICIPALITY_NAME);
  const region = findOptionByLabel(bootstrap.json?.options.preferred_region, REGION_NAME);
  const coordinator = findOptionByContains(bootstrap.json?.options.case_coordinator, GEMEENTE_USERNAME);

  const createPayload = {
    ...bootstrap.json?.initial_values,
    title: CASE_TITLE,
    start_date: new Date().toISOString().slice(0, 10),
    target_completion_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    assessment_summary: "",
    description: "Pilotdemo voor de keten: urgente jeugdvraag, providerafwijzing en rematch.",
    urgency: "HIGH",
    complexity: "MULTIPLE",
    zorgvorm_gewenst: "OUTPATIENT",
    preferred_care_form: "OUTPATIENT",
    preferred_region_type: "GEMEENTELIJK",
    preferred_region: region.value,
    gemeente: municipality.value,
    case_coordinator: coordinator.value,
    problematiek_types: "thuiszitproblematiek, gezinsstress",
  };

  const createResponse = await postJson<CreateCaseResponse>(page, "/care/api/cases/intake-create/", createPayload);
  expect(createResponse.ok, `Expected case creation to succeed: ${createResponse.text}`).toBeTruthy();
  const caseId = Number(createResponse.json?.case_id);
  expect(caseId).toBeGreaterThan(0);

  const summaryResponse = await postJson<{ ok: boolean; assessment: { caseId: string } }>(
    page,
    `/care/api/cases/${caseId}/assessment-decision/`,
    {
      decision: "",
      shortDescription: "Samenvatting gereed voor matching in de pilotdemo.",
      urgency: "HIGH",
      zorgtype: "OUTPATIENT",
    },
  );
  expect(summaryResponse.ok, `Expected summary step to succeed: ${summaryResponse.text}`).toBeTruthy();

  let evaluation = await getDecisionEvaluation(page, caseId);
  expect(evaluation.current_state).toBe("SUMMARY_READY");
  expect(evaluation.next_best_action?.action).toBe("START_MATCHING");

  const matchingResponse = await postJson<{ ok: boolean }>(
    page,
    `/care/api/cases/${caseId}/assessment-decision/`,
    {
      decision: "matching",
      shortDescription: "Door naar matching voor aanbiederselectie.",
      urgency: "HIGH",
      zorgtype: "OUTPATIENT",
      constraints: ["URGENT", "FAMILY_STRESS"],
    },
  );
  expect(matchingResponse.ok, `Expected matching step to succeed: ${matchingResponse.text}`).toBeTruthy();

  evaluation = await getDecisionEvaluation(page, caseId);
  expect(evaluation.current_state).toBe("MATCHING_READY");
  expect(evaluation.next_best_action?.action).toBe("SEND_TO_PROVIDER");

  const providers = await apiFetch<{ providers: Array<{ id: string; name: string }> }>(page, "/care/api/providers/");
  expect(providers.ok).toBeTruthy();
  const providerOne = findByFieldContains(providers.json?.providers, "name", PROVIDER_ONE_NAME);
  const providerTwo = findByFieldContains(providers.json?.providers, "name", PROVIDER_TWO_NAME);

  const sendResponse = await postJson<{ ok: boolean }>(
    page,
    `/care/api/cases/${caseId}/matching/action/`,
    { action: "assign", provider_id: providerOne.id },
  );
  expect(sendResponse.ok, `Expected send-to-provider to succeed: ${sendResponse.text}`).toBeTruthy();

  await logout(page);
  await loginAs(page, PROVIDER_ONE_USERNAME, PASSWORD);

  const rejectResponse = await postJson<{ ok: boolean }>(
    page,
    `/care/api/cases/${caseId}/provider-decision/`,
    {
      status: "REJECTED",
      rejection_reason_code: "PROVIDER_DECLINED",
      provider_comment: "Capaciteit en passend aanbod ontbreken voor deze casus.",
    },
  );
  expect(rejectResponse.ok, `Expected provider rejection to succeed: ${rejectResponse.text}`).toBeTruthy();

  await logout(page);
  await loginAs(page, GEMEENTE_USERNAME, PASSWORD);

  const overview = await apiFetch<RegiekamerOverviewResponse>(page, "/care/api/regiekamer/decision-overview/");
  expect(overview.ok, "Expected Regiekamer overview to load").toBeTruthy();
  expect(overview.json?.totals.high_priority_alerts).toBeGreaterThanOrEqual(1);

  const overviewItem = overview.json?.items.find((item) => item.title === CASE_TITLE);
  expect(overviewItem, "Expected rejected case in Regiekamer overview").toBeTruthy();
  expect(overviewItem?.next_best_action?.action).toBe("REMATCH_CASE");
  expect(overviewItem?.top_blocker?.code).toBe("PROVIDER_NOT_ACCEPTED");

  await page.goto(new URL("/dashboard/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Regiekamer" })).toBeVisible();
  await expect(page.getByTestId("regiekamer-summary-active")).toBeVisible();
  await expect(page.getByTestId("regiekamer-worklist-item").filter({ hasText: CASE_TITLE }).first()).toBeVisible();

  const worklistRow = page.getByTestId("regiekamer-worklist-item").filter({ hasText: CASE_TITLE }).first();
  await worklistRow.getByRole("button", { name: "Bekijk detail" }).click();
  await expect(page.getByText("Casuspad")).toBeVisible();
  await expect(page.getByText("Volgende stap")).toBeVisible();
});

test("pilot demo part 2 rematches, accepts, confirms placement, and starts intake", async ({ page }) => {
  await page.goto(BASE_URL);
  await loginAs(page, GEMEENTE_USERNAME, PASSWORD);
  const caseId = await getCaseId(page, CASE_TITLE);

  const providers = await apiFetch<{ providers: Array<{ id: string; name: string }> }>(page, "/care/api/providers/");
  expect(providers.ok).toBeTruthy();
  const providerTwo = findByFieldContains(providers.json?.providers, "name", PROVIDER_TWO_NAME);

  const rematchResponse = await postForm<{ ok: boolean }>(page, `/care/casussen/${caseId}/provider-response/action/`, {
    action: "trigger_rematch",
    next: `/care/casussen/${caseId}/?tab=plaatsing`,
  });
  expect(rematchResponse.ok, `Expected rematch trigger to succeed: ${rematchResponse.text}`).toBeTruthy();

  const rematchSendResponse = await postJson<{ ok: boolean }>(
    page,
    `/care/api/cases/${caseId}/matching/action/`,
    { action: "assign", provider_id: providerTwo.id },
  );
  expect(rematchSendResponse.ok, `Expected rematch assignment to succeed: ${rematchSendResponse.text}`).toBeTruthy();

  let evaluation = await getDecisionEvaluation(page, caseId);
  expect(evaluation.current_state).toBe("PROVIDER_REVIEW_PENDING");
  expect(evaluation.next_best_action?.action).toBe("WAIT_PROVIDER_RESPONSE");

  await logout(page);
  await loginAs(page, PROVIDER_TWO_USERNAME, PASSWORD);

  const acceptResponse = await postJson<{ ok: boolean }>(
    page,
    `/care/api/cases/${caseId}/provider-decision/`,
    {
      status: "ACCEPTED",
      provider_comment: "Passend aanbod en capaciteit beschikbaar.",
    },
  );
  expect(acceptResponse.ok, `Expected provider acceptance to succeed: ${acceptResponse.text}`).toBeTruthy();

  evaluation = await getDecisionEvaluation(page, caseId);
  expect(evaluation.current_state).toBe("PROVIDER_ACCEPTED");
  expect(evaluation.next_best_action?.action).toBe("CONFIRM_PLACEMENT");

  await logout(page);
  await loginAs(page, GEMEENTE_USERNAME, PASSWORD);

  const placementResponse = await postJson<{ ok: boolean }>(
    page,
    `/care/api/cases/${caseId}/placement-action/`,
    {
      status: "APPROVED",
      note: "Plaatsing bevestigd in pilotdemo.",
    },
  );
  expect(placementResponse.ok, `Expected placement confirmation to succeed: ${placementResponse.text}`).toBeTruthy();

  evaluation = await getDecisionEvaluation(page, caseId);
  expect(evaluation.current_state).toBe("PLACEMENT_CONFIRMED");
  expect(evaluation.next_best_action?.action).toBe("START_INTAKE");

  await logout(page);
  await loginAs(page, PROVIDER_TWO_USERNAME, PASSWORD);

  const intakeResponse = await postJson<{ ok: boolean }>(page, `/care/api/cases/${caseId}/intake-action/`, {});
  expect(intakeResponse.ok, `Expected intake start to succeed: ${intakeResponse.text}`).toBeTruthy();

  evaluation = await getDecisionEvaluation(page, caseId);
  expect(evaluation.current_state).toBe("INTAKE_STARTED");
});
