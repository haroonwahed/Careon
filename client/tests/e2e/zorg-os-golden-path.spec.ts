/**
 * End-user golden path: gemeente surfaces → matching advisory UI → provider scope →
 * accept (UI) → placement (API, gemeente) → intake readiness (API + provider intake route).
 *
 * Prerequisite: ./scripts/prepare_pilot_e2e.sh, Django settings_rehearsal, built SPA.
 * @see docs/E2E_RUNBOOK.md
 */

import { expect, test } from "@playwright/test";
import {
  getDecisionEvaluation,
  GOLDEN_PATH_BASE_URL,
  loginAs,
  logout,
  pilotProviderTwoCredentials,
  postJsonIntakeStart,
  postJsonPlacementApprove,
  seedGoldenPathCases,
} from "./helpers/goldenPathPilotApi";
import { pilotDemoGemeentePassword, pilotDemoGemeenteUsername } from "./pilotEnv";

async function clickSidebarNav(page: import("@playwright/test").Page, label: RegExp | string) {
  await page.locator('[aria-label="Hoofdnavigatie"] button').filter({ hasText: label }).click();
}

test.describe.configure({ mode: "serial" });

test("Zorg OS golden path — gemeente → matching → provider scope → accept → plaatsing → intake", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const seeded = await seedGoldenPathCases(page);
  const gemeenteUser = pilotDemoGemeenteUsername();
  const gemeentePw = pilotDemoGemeentePassword();
  const providerCreds = pilotProviderTwoCredentials();

  await loginAs(page, gemeenteUser, gemeentePw);

  await page.goto(`${GOLDEN_PATH_BASE_URL}/dashboard/`);
  await expect(page.getByRole("heading", { name: "Regiekamer" })).toBeVisible();
  await expect(page.getByTestId("care-sidebar")).toBeVisible();

  const regiekamerPrimaryCount = await page.getByTestId("regiekamer-dominant-primary-cta").count();
  expect(regiekamerPrimaryCount, "max één dominante primaire Regiekamer-actie").toBeLessThanOrEqual(1);

  await clickSidebarNav(page, "Casussen");
  await expect(page.getByTestId("care-page-scaffold")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Casussen" })).toBeVisible();

  await page.goto(`${GOLDEN_PATH_BASE_URL}/care/cases/${seeded.goldenCaseId}/`);
  await expect(page.getByTestId("next-best-action")).toBeVisible();
  await expect(page.getByText(/Aanbieder beoordeling/).first()).toBeVisible();

  let evaluation = await getDecisionEvaluation(page, seeded.goldenCaseId);
  expect(evaluation.next_best_action?.action).toBeTruthy();

  await clickSidebarNav(page, "Matching");
  await expect(page.getByRole("heading", { name: "Matching" })).toBeVisible();
  await page.getByRole("button", { name: "Pagina-uitleg" }).click();
  await expect(page.getByText(/Vergelijk fit/i).first()).toBeVisible();

  const gemeenteTitles = await page.evaluate(async () => {
    const r = await fetch("/care/api/cases/");
    const j = (await r.json()) as { contracts?: Array<{ title: string }> };
    return (j.contracts ?? []).map((c) => c.title);
  });
  expect(gemeenteTitles).toContain(seeded.goldenTitle);
  expect(gemeenteTitles).toContain(seeded.decoyTitle);

  await logout(page);

  await loginAs(page, providerCreds.username, providerCreds.password);
  await page.goto(`${GOLDEN_PATH_BASE_URL}/dashboard/`);
  await page.waitForLoadState("networkidle");

  const providerTitles = await page.evaluate(async () => {
    const r = await fetch("/care/api/cases/");
    const j = (await r.json()) as { contracts?: Array<{ title: string }> };
    return (j.contracts ?? []).map((c) => c.title);
  });
  expect(providerTitles.join(" | ")).toContain(seeded.goldenTitle);
  expect(providerTitles).not.toContain(seeded.decoyTitle);

  await clickSidebarNav(page, /Aanbieder beoordeling/);
  await expect(page.getByRole("heading", { name: "Aanbieder beoordeling" })).toBeVisible({ timeout: 30_000 });

  /** Primary queue anchor (requires SPA build that ships this test id — run prepare without --skip-build after UI changes). */
  const activeSection = page.getByTestId("provider-beoordeling-actieve-sectie");
  await expect(activeSection).toBeVisible({ timeout: 45_000 });

  await expect(activeSection.getByText(seeded.goldenTitle)).toBeVisible();

  const acceptBtn = activeSection.getByRole("button", { name: "Accepteren" });
  const rejectBtn = activeSection.getByRole("button", { name: "Afwijzen" });
  await expect(acceptBtn).toBeVisible({ timeout: 30_000 });
  await expect(rejectBtn).toBeVisible();

  await acceptBtn.click();
  await activeSection.locator("label").filter({ hasText: "Capaciteit beschikbaar" }).click();
  await activeSection.locator("label").filter({ hasText: "Intake mogelijk binnen termijn" }).click();
  const startInput = activeSection.locator(`#start-${seeded.goldenCaseId}`);
  await startInput.fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  await activeSection.getByRole("button", { name: "Bevestig acceptatie" }).click();

  // Decision state (authoritative). After accept + cases refetch, the casus leaves the open
  // beoordeling queue in the UI — do not require "Casus geaccepteerd" inside the active-section
  // locator (that section unmounts when the case is no longer `provider_beoordeling`).
  await expect
    .poll(async () => (await getDecisionEvaluation(page, seeded.goldenCaseId)).current_state)
    .toBe("PROVIDER_ACCEPTED");

  await expect
    .poll(async () => {
      const phase = await page.evaluate(
        async ({ casePk, title }: { casePk: number; title: string }) => {
          const resp = await fetch("/care/api/cases/");
          const j = (await resp.json()) as {
            contracts?: Array<{ id: number; title: string; case_phase: string }>;
          };
          const row = (j.contracts ?? []).find((c) => c.id === casePk || c.title === title);
          return row?.case_phase ?? "";
        },
        { casePk: seeded.goldenCaseId, title: seeded.goldenTitle },
      );
      return phase;
    })
    .toBe("plaatsing");

  await logout(page);

  await loginAs(page, gemeenteUser, gemeentePw);
  evaluation = await getDecisionEvaluation(page, seeded.goldenCaseId);
  expect(evaluation.current_state).toBe("PROVIDER_ACCEPTED");
  expect(evaluation.next_best_action?.action).toBe("CONFIRM_PLACEMENT");

  await postJsonPlacementApprove(page, seeded.goldenCaseId);
  evaluation = await getDecisionEvaluation(page, seeded.goldenCaseId);
  expect(evaluation.current_state).toBe("PLACEMENT_CONFIRMED");
  expect(evaluation.next_best_action?.action).toBe("START_INTAKE");

  await logout(page);

  await loginAs(page, providerCreds.username, providerCreds.password);
  await page.goto(`${GOLDEN_PATH_BASE_URL}/dashboard/`);
  await clickSidebarNav(page, "Intake");
  await expect(page.getByRole("heading", { name: /Intake/i })).toBeVisible();

  await postJsonIntakeStart(page, seeded.goldenCaseId);
  evaluation = await getDecisionEvaluation(page, seeded.goldenCaseId);
  expect(evaluation.current_state).toBe("INTAKE_STARTED");
});
