/**
 * Provider-path smoke: rehearsal login → Reacties (aanbieder) → optional decision-evaluation GET.
 * When `/care/api/provider-evaluations/` returns rows, asserts intake handoff read-model keys exist.
 * Asserts `GET .../timeline/` for a provider-review case (audit trail signal).
 * End-to-end reject submit (last test; mutates seeded rehearsal case).
 *
 * Prereq: same stack as pilot E2E (`./scripts/prepare_pilot_e2e.sh`, `config.settings_rehearsal`, demo users).
 *
 * Run (from client/):
 *   npm run test:e2e:provider-review
 *
 * @see docs/E2E_RUNBOOK.md
 */
import { expect, test } from "@playwright/test";
import {
  E2E_BASE_URL,
  E2E_MUNICIPALITY_NAME,
  pilotDemoProviderOneUsername,
  pilotDemoProviderPassword,
} from "./pilotEnv";
import { postJson } from "./helpers/goldenPathPilotApi";

const BASE_URL = E2E_BASE_URL;

type CasesPayload = {
  contracts?: Array<{ id: string | number; title?: string; status?: string; case_phase?: string }>;
};

type ProviderEvaluationsPayload = { evaluations?: Record<string, unknown>[] };

async function login(page: import("@playwright/test").Page, username: string, password: string): Promise<void> {
  await page.goto(new URL("/login/", BASE_URL).toString());
  await expect(page.getByRole("heading", { name: "Welkom terug" })).toBeVisible();
  await page.getByLabel("Gebruikersnaam").fill(username);
  await page.getByLabel("Wachtwoord", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Inloggen" }).click();
  await page.waitForURL(/\/dashboard\/?(\?.*)?$/, { timeout: 45_000 });
  await expect(
    page.getByText("Ongeldige gebruikersnaam of wachtwoord. Probeer opnieuw."),
    "Login failed — run ./scripts/prepare_pilot_e2e.sh and use E2E_DEMO_PASSWORD / demo provider users.",
  ).toHaveCount(0);
}

async function apiFetch<T>(page: import("@playwright/test").Page, path: string): Promise<{
  ok: boolean;
  status: number;
  json: T | null;
}> {
  return page.evaluate(async (relativePath) => {
    const response = await fetch(relativePath, { credentials: "same-origin" });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json: json as T | null };
  }, path);
}

/** Pending review for the logged-in provider (linked placement), not any org-wide casus. */
async function pendingLinkedProviderCaseId(page: import("@playwright/test").Page): Promise<string | null> {
  const res = await apiFetch<ProviderEvaluationsPayload>(page, "/care/api/provider-evaluations/");
  if (!res.ok) return null;
  const row = (res.json?.evaluations ?? []).find(
    (r) => String(r.status ?? "").toUpperCase() === "PENDING",
  );
  return row?.caseId != null ? String(row.caseId) : null;
}

test.describe.configure({ mode: "serial" });

test("provider smoke: login and open Reacties (SPA)", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());
  await page.goto(new URL("/care/beoordelingen", BASE_URL).toString());
  await expect(page.getByTestId("care-sidebar")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole("heading", { name: /Aanbiederreactie/i })).toBeVisible({ timeout: 45_000 });
});

test("provider smoke: provider-evaluations rows include handoff read-model keys when list is non-empty", async ({
  page,
}) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());

  const cases = await apiFetch<CasesPayload>(page, "/care/api/cases/?q=");
  expect(cases.ok, `cases API should load (${cases.status})`).toBeTruthy();
  const pending = (cases.json?.contracts ?? []).find((c) => c.case_phase === "provider_beoordeling");

  const res = await apiFetch<ProviderEvaluationsPayload>(page, "/care/api/provider-evaluations/");
  expect(res.ok, `provider-evaluations should load (${res.status})`).toBeTruthy();
  const rows = res.json?.evaluations ?? [];
  test.skip(rows.length === 0, "No provider evaluations — skip handoff schema assertion");

  const row =
    pending != null
      ? rows.find((r) => String(r.caseId) === String(pending.id)) ?? rows[0]!
      : rows[0]!;
  expect(row).toHaveProperty("municipalityName");
  expect(row).toHaveProperty("entryRoute");
  expect(row).toHaveProperty("entryRouteLabel");
  expect(row).toHaveProperty("aanmelderActorProfile");
  expect(row).toHaveProperty("aanmelderActorProfileLabel");
  if (pending != null && String(row.caseId) === String(pending.id)) {
    expect(String(row.municipalityName ?? "").length).toBeGreaterThan(0);
    expect(String(row.entryRouteLabel ?? "").length).toBeGreaterThan(0);
    expect(String(row.aanmelderActorProfileLabel ?? "").length).toBeGreaterThan(0);
  }
});

test("provider smoke: active review shows handoff read-model line when pending", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());
  await page.goto(new URL("/care/beoordelingen", BASE_URL).toString());

  const res = await apiFetch<ProviderEvaluationsPayload>(page, "/care/api/provider-evaluations/");
  expect(res.ok, `provider-evaluations should load (${res.status})`).toBeTruthy();
  const rows = res.json?.evaluations ?? [];
  const row = rows.find(
    (r) =>
      String(r.status ?? "").toUpperCase() === "PENDING" &&
      String(r.municipalityName ?? "").trim().length > 0 &&
      String(r.entryRouteLabel ?? "").trim().length > 0 &&
      String(r.aanmelderActorProfileLabel ?? "").trim().length > 0,
  );
  test.skip(!row, "No PENDING evaluation with handoff labels — skip why-us UI assertion");

  const cases = await apiFetch<CasesPayload>(page, "/care/api/cases/?q=");
  expect(cases.ok, `cases API should load (${cases.status})`).toBeTruthy();
  const pending = (cases.json?.contracts ?? []).find((c) => String(c.id) === String(row!.caseId));
  test.skip(!pending, "Handoff evaluation case not in provider_beoordeling list — skip UI assertion");

  await expect(page.getByTestId("care-unified-header").getByRole("heading", { name: "Aanbiederreactie" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByTestId("aanbiederreactie-worklist")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId(`aanbiederreactie-row-${row!.caseId}`)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Volg aanbiederreactie op").first()).toBeVisible({ timeout: 45_000 });
});

test("provider smoke: case timeline API returns events for a visible provider_beoordeling case", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());

  const caseId = await pendingLinkedProviderCaseId(page);
  test.skip(!caseId, "No PENDING linked provider evaluation — skip timeline assertion");

  const tl = await apiFetch<{ events?: unknown[] }>(page, `/care/api/cases/${caseId}/timeline/`);
  expect(tl.status, `timeline should be 200, got ${tl.status}`).toBe(200);
  expect(Array.isArray(tl.json?.events), "timeline payload should include events array").toBeTruthy();
});

test("provider smoke: placement-detail for a visible provider_beoordeling case includes response fields", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());

  const caseId = await pendingLinkedProviderCaseId(page);
  test.skip(!caseId, "No PENDING linked provider evaluation — skip API assertion");

  const detail = await apiFetch<{ placement?: Record<string, unknown> }>(
    page,
    `/care/api/cases/${caseId}/placement-detail/`,
  );
  expect(detail.status, `placement-detail should be 200, got ${detail.status}`).toBe(200);
  expect(detail.json?.placement, "placement-detail should include placement object").toBeTruthy();
  const p = detail.json!.placement!;
  expect(p).toHaveProperty("providerResponseStatus");
  expect(p).toHaveProperty("providerResponseReasonCode");
  expect(p).toHaveProperty("providerResponseNotes");
});

test("provider smoke: pending review row exposes the next action", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());
  await page.goto(new URL("/care/beoordelingen", BASE_URL).toString());

  const caseId = await pendingLinkedProviderCaseId(page);
  test.skip(!caseId, "No PENDING linked provider evaluation — skip row assertion");

  const row = page.getByTestId(`aanbiederreactie-row-${caseId}`);
  await expect(row).toBeVisible({ timeout: 45_000 });
  await expect(row.getByText("Volgende actie")).toBeVisible();
  await expect(row.getByRole("button", { name: "Volg aanbiederreactie op" })).toBeVisible();
});

test("provider smoke: pending review row remains navigable without modal", async ({
  page,
}) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());
  await page.goto(new URL("/care/beoordelingen", BASE_URL).toString());

  const caseId = await pendingLinkedProviderCaseId(page);
  test.skip(!caseId, "No PENDING linked provider evaluation — skip row assertion");

  const row = page.getByTestId(`aanbiederreactie-row-${caseId}`);
  await expect(row).toBeVisible({ timeout: 45_000 });
  await expect(row.getByText("Laatste activiteit")).toBeVisible();
  await expect(row.getByText("Volgende actie")).toBeVisible();
  await expect(row.getByRole("button", { name: /Volg aanbiederreactie op|Selecteer andere aanbieder|Bevestig plaatsing/ })).toBeVisible();
});

test("provider smoke: decision-evaluation succeeds for a visible provider_beoordeling case", async ({ page }) => {
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());

  const caseId = await pendingLinkedProviderCaseId(page);
  test.skip(!caseId, "No PENDING linked provider evaluation — skip API assertion");

  const evalRes = await apiFetch<Record<string, unknown>>(
    page,
    `/care/api/cases/${caseId}/decision-evaluation/`,
  );
  expect(evalRes.status, `decision-evaluation should be 200, got ${evalRes.status}`).toBe(200);
  expect(evalRes.json?.current_state, "evaluation payload should include workflow state").toBeTruthy();
});

/**
 * Mutates the seeded provider-review case — kept last so earlier serial tests still see PENDING.
 */
test("provider smoke: reject flow submits and shows rejected summary", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(BASE_URL);
  await login(page, pilotDemoProviderOneUsername(), pilotDemoProviderPassword());
  await page.goto(new URL("/care/beoordelingen", BASE_URL).toString());

  const caseId = await pendingLinkedProviderCaseId(page);
  test.skip(!caseId, "No PENDING linked provider evaluation — skip reject submit assertion");

  await postJson(page, `/care/api/cases/${caseId}/provider-decision/`, {
    status: "REJECTED",
    rejection_reason_code: "geen_capaciteit",
    provider_comment: "E2E afwijzing — voldoende tekens voor validatie.",
  });

  const evalAfter = await apiFetch<ProviderEvaluationsPayload>(page, "/care/api/provider-evaluations/");
  expect(evalAfter.ok).toBeTruthy();
  const updated = (evalAfter.json?.evaluations ?? []).find((r) => String(r.caseId) === caseId);
  expect(updated?.status, "evaluation should be REJECTED after submit").toBe("REJECTED");

  await page.reload();
  const row = page.getByTestId(`aanbiederreactie-row-${caseId}`);
  await expect(row).toBeVisible({ timeout: 45_000 });
  await expect(row).toContainText("Afgewezen");
});
