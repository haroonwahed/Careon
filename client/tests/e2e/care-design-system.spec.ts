/**
 * Design-system contract tests for the authenticated Careon SPA (gemeente role).
 * Protects shell chrome, shared list/search primitives, decision surfaces, and light a11y/dark checks.
 *
 * @see DESIGN_SYSTEM_TESTING.md at repository root.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_MATCHING_CASE_ID,
  goSidebar,
  installCareApiStubs,
  SPA_BASE,
  SPA_ORIGIN,
} from "./helpers/careSpaApiStubs";

test.describe.configure({ mode: "serial", timeout: 90_000 });

async function assertShell(page: Page) {
  await expect(page.getByTestId("care-app-shell")).toBeVisible();
  await expect(page.getByTestId("care-sidebar")).toBeVisible();
  await expect(page.getByTestId("care-top-bar")).toBeVisible();
  await expect(page.getByTestId("care-app-main")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
}

async function assertCareSearchStack(page: Page) {
  await expect(page.getByTestId("care-search-control-stack")).toBeVisible();
  const input = page.getByTestId("care-search-input");
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute("aria-label", /.+/);
}

/** Rows built on CareWorkRow expose `data-care-work-row`; Regiekamer also tags items with `data-testid="regiekamer-worklist-item"`. */
async function assertOperationalRowContract(page: Page) {
  const workRows = page.locator("[data-care-work-row]");
  const regieRows = page.getByTestId("regiekamer-worklist-item");
  const count = await workRows.count();
  const regieCount = await regieRows.count();
  expect(count + regieCount, "expected at least one operational row or regiekamer row").toBeGreaterThan(0);
  const row = count > 0 ? workRows.first() : regieRows.first();
  await expect(row).toBeVisible();
  const primaryCtas = row.locator('button[type="button"]');
  expect(await primaryCtas.count(), "each row should expose a small number of explicit buttons (primary CTA + optional controls)").toBeLessThanOrEqual(3);
  const dominant = row.locator('[data-component="care-dominant-status"]');
  const chips = row.locator('[data-component="care-meta-chip"]');
  expect(await dominant.count() + await chips.count(), "row should surface status or metadata chips").toBeGreaterThan(0);
}

test.describe("Care design system (SPA)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("careon-theme", "dark");
    });
    await installCareApiStubs(page);
    await page.goto(SPA_BASE, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Regiekamer/i, level: 1 })).toBeVisible({ timeout: 45_000 });
  });

  test("shell + landmarks: target gemeente routes stay inside unified chrome", async ({ page }) => {
    const routes: Array<{ nav: string; heading: RegExp | string }> = [
      { nav: "Regiekamer", heading: /Regiekamer/i },
      { nav: "Casussen", heading: /^Casussen$/i },
      { nav: "Matching", heading: /^Matching$/i },
      { nav: "Acties", heading: /^Acties$/i },
      { nav: "Signalen", heading: /^Signalen$/i },
      { nav: "Zorgaanbieders", heading: /Zorgaanbieders/i },
      { nav: "Regio's", heading: "Regio's" },
      { nav: "Aanbieder beoordeling", heading: /Aanbieder beoordeling/i },
      { nav: "Plaatsingen", heading: /Plaatsingen/i },
    ];

    for (const { nav, heading } of routes) {
      await goSidebar(page, nav);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible({ timeout: 30_000 });
      await assertShell(page);
      await expect(page.getByText(/Django administration/i)).toHaveCount(0);
    }
  });

  test("Regiekamer (canonical): dominant action, phase board, disclosures, shared search + Meer filters", async ({
    page,
  }) => {
    await assertShell(page);
    /** Stubbed GET must finish before `hasActiveData` renders the dominant panel (expect default is 10s). */
    await expect(page.getByTestId("regiekamer-dominant-action")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-component="care-dominant-action-panel"]')).toHaveCount(1);
    const dominantPanelTop = await page.getByTestId("regiekamer-dominant-action").evaluate((el) => el.getBoundingClientRect().top);
    expect(dominantPanelTop, "dominant action panel should appear above the fold").toBeLessThan(420);
    await expect(page.getByTestId("regiekamer-phase-board")).toBeVisible();
    await expect(page.getByTestId("care-unified-header")).toBeVisible();
    const competingAttentionBars = page.locator('[data-component="care-attention-bar"]');
    expect(await competingAttentionBars.count()).toBeLessThanOrEqual(0);
    await expect(page.getByTestId("regiekamer-dominant-action")).toHaveCount(1);
    await expect(page.getByTestId("regiekamer-dominant-action")).toHaveAttribute("data-regiekamer-mode", "crisis");
    await expect(page.getByTestId("regiekamer-insight-why")).toHaveCount(0);
    await expect(page.getByTestId("regiekamer-insight-flow")).toHaveCount(0);
    await expect(page.getByTestId("regiekamer-action-queue")).toHaveCount(0);
    const dominantPrimary = page.getByTestId("regiekamer-dominant-primary-cta");
    await expect(dominantPrimary).toBeVisible();
    await dominantPrimary.focus();
    await expect(dominantPrimary).toBeFocused();
    await assertCareSearchStack(page);
    await expect(page.getByTestId("care-more-filters-toggle")).toBeVisible();
  });

  test("shared CareSearchFiltersBar on list-heavy pages (incl. Zorgaanbieders)", async ({ page }) => {
    const pages: Array<{ nav: string; heading: RegExp | string }> = [
      { nav: "Casussen", heading: /^Casussen$/i },
      { nav: "Matching", heading: /^Matching$/i },
      { nav: "Acties", heading: /^Acties$/i },
      { nav: "Signalen", heading: /^Signalen$/i },
      { nav: "Plaatsingen", heading: /Plaatsingen/i },
      { nav: "Regio's", heading: "Regio's" },
    ];
    for (const { nav, heading } of pages) {
      await goSidebar(page, nav);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible({ timeout: 30_000 });
      await assertCareSearchStack(page);
    }

    await goSidebar(page, "Zorgaanbieders");
    await expect(page.getByRole("heading", { name: /Zorgaanbieders/i, level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("zorgaanbieders-filter-panel")).toBeVisible();
    await assertCareSearchStack(page);
    await expect(page.getByPlaceholder(/Zoek op naam, specialisatie of regio/i)).toBeVisible();
    await expect(page.getByTestId("care-more-filters-toggle")).toBeVisible();
    await expect(page.getByRole("button", { name: /Meer filters/i })).toBeVisible();
  });

  test("operational rows: Casussen + Matching + Regiekamer + Signalen share work-row contract", async ({ page }) => {
    await assertOperationalRowContract(page);

    await goSidebar(page, "Casussen");
    await expect(page.getByTestId("worklist")).toBeVisible({ timeout: 30_000 });
    await assertOperationalRowContract(page);

    await goSidebar(page, "Matching");
    await expect(page.getByRole("heading", { name: /^Matching$/i, level: 1 })).toBeVisible({ timeout: 30_000 });
    const emptyMatching = page.getByText("Geen casussen in matching");
    if (!(await emptyMatching.isVisible().catch(() => false))) {
      await assertOperationalRowContract(page);
    }

    await goSidebar(page, "Signalen");
    await expect(page.getByRole("heading", { name: /^Signalen$/i, level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("signalen-worklist")).toBeVisible({ timeout: 30_000 });
    await assertOperationalRowContract(page);
  });

  test("casus workspace: next-best-action + single context panel", async ({ page }) => {
    await goSidebar(page, "Casussen");
    await expect(page.getByRole("heading", { name: /^Casussen$/i, level: 1 })).toBeVisible({ timeout: 30_000 });
    // Scope to Casussen worklist — Regiekamer may surface the same stub casus in embedded rows.
    const row = page
      .getByTestId("worklist")
      .locator("[data-care-work-row]")
      .filter({ hasText: /E2E matching casus/i })
      .first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    // Row body opens the workspace; the row CTA may navigate to a workflow route instead.
    const titleLine = row.locator("p.font-semibold").first();
    await titleLine.click();
    await expect(page.getByTestId("next-best-action")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("case-context-panel")).toHaveCount(1);
    const cta = page.getByTestId("next-best-action").getByRole("button", { name: /Valideer matching/i });
    await cta.focus();
    await expect(cta).toBeFocused();
    await expect(cta).toBeVisible();
  });

  test("dark theme: html.dark present; flag light-only Tailwind surfaces in main", async ({ page }) => {
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(hasDark, "localStorage careon-theme=dark should yield html.dark for portal-safe theming").toBe(true);

    const legacySurfaces = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="care-app-main"]');
      if (!root) {
        return { whites: 0, grayFills: 0 };
      }
      const candidates = root.querySelectorAll<HTMLElement>("*");
      let whites = 0;
      let grayFills = 0;
      candidates.forEach((el) => {
        const c = el.className;
        if (typeof c !== "string") {
          return;
        }
        if (c.includes("dark:")) {
          return;
        }
        if (/\bbg-white\b/.test(c)) {
          whites += 1;
        }
        if (/\bbg-gray-(50|100)\b/.test(c) || /\bbg-slate-50\b/.test(c)) {
          grayFills += 1;
        }
      });
      return { whites, grayFills };
    });
    expect(
      legacySurfaces.whites,
      "In dark mode, avoid legacy Tailwind panels that only set bg-white without a dark: surface token",
    ).toBe(0);
    expect(
      legacySurfaces.grayFills,
      "In dark mode, avoid light gray fills (gray-50/100, slate-50) without a dark: companion on the same element",
    ).toBe(0);
  });

  test("accessibility smoke: one main, sidebar nav, bounded h1 count in main", async ({ page }) => {
    await assertShell(page);
    await expect(page.getByTestId("care-sidebar").getByRole("navigation")).toBeVisible();

    const h1InMain = page.locator('[data-testid="care-app-main"] h1');
    expect(await h1InMain.count()).toBeLessThanOrEqual(3);
  });

  test("Matching workspace: Selecteer opens confirmation (advisory, not instant assign)", async ({ page }) => {
    await goSidebar(page, "Matching");
    await expect(page.getByRole("heading", { name: /^Matching$/i, level: 1 })).toBeVisible({ timeout: 30_000 });
    const row = page.locator("[data-care-work-row]").filter({ hasText: /e2e-matching-1/i }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    await expect(page.getByRole("button", { name: /Aanbevolen matches|Top 3 aanbevelingen/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Selecteer(&| & )?verzoek|^Selecteer$/i }).first().click();
    await expect(page.getByRole("dialog", { name: /Bevestig keuze/i })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/aanbiederbeoordeling/i)).toBeVisible();
    await page.getByRole("button", { name: /^Annuleren$/i }).click();
    await expect(page.getByRole("dialog", { name: /Bevestig keuze/i })).toHaveCount(0);
  });
});

const STABLE_REGIEKAMER_ITEMS = [
  {
    case_id: "st-1",
    case_reference: "ST-1",
    title: "Stable casus A",
    current_state: "PLACED",
    phase: "plaatsing",
    urgency: "low",
    assigned_provider: "Test",
    next_best_action: { action: "MONITOR_CASE", label: "Monitor", priority: "low", reason: "stub" },
    top_blocker: null,
    top_risk: null,
    top_alert: null,
    blocker_count: 0,
    risk_count: 0,
    alert_count: 0,
    priority_score: 42,
    age_hours: 10,
    hours_in_current_state: 5,
    issue_tags: [] as string[],
    responsible_role: "regie",
  },
  {
    case_id: "st-2",
    case_reference: "ST-2",
    title: "Stable casus B",
    current_state: "INTAKE",
    phase: "intake",
    urgency: "low",
    assigned_provider: "Test",
    next_best_action: { action: "START_INTAKE", label: "Start", priority: "low", reason: "stub" },
    top_blocker: null,
    top_risk: null,
    top_alert: null,
    blocker_count: 0,
    risk_count: 0,
    alert_count: 0,
    priority_score: 35,
    age_hours: 8,
    hours_in_current_state: 3,
    issue_tags: [] as string[],
    responsible_role: "zorgaanbieder",
  },
];

test.describe("Regiekamer adaptive modes (SPA)", () => {
  async function darkTheme(page: Page) {
    await page.addInitScript(() => {
      window.localStorage.setItem("careon-theme", "dark");
    });
  }

  test("stable: calm banner + phase board + uitvoerlijst + Prioriteer werkvoorraad", async ({ page }) => {
    await darkTheme(page);
    await installCareApiStubs(page, {
      regiekamerOverview: {
        totals: {
          active_cases: 5,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          intake_delays: 0,
          repeated_rejections: 0,
        },
        items: STABLE_REGIEKAMER_ITEMS,
      },
    });
    await page.goto(SPA_BASE, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Regiekamer/i, level: 1 })).toBeVisible({ timeout: 45_000 });
    const panel = page.getByTestId("regiekamer-dominant-action");
    await expect(panel).toHaveCount(1);
    await expect(panel).toHaveAttribute("data-regiekamer-mode", "stable");
    await expect(page.getByTestId("regiekamer-dominant-primary-cta")).toHaveText(/Prioriteer werkvoorraad|Open werkvoorraad/);
    await expect(page.getByTestId("regiekamer-calm-state")).toContainText("Geen operationele blokkades");
    await expect(page.getByTestId("regiekamer-phase-board")).toBeVisible();
    await expect(page.getByTestId("regiekamer-uitvoerlijst")).toBeVisible();
    await expect(page.getByTestId("regiekamer-worklist-item")).toHaveCount(2);
    await expect(page.getByTestId("regiekamer-insight-why")).toHaveCount(0);
    await expect(page.getByTestId("regiekamer-insight-flow")).toHaveCount(0);
  });

  test("optimization: Analyseer doorstroom + phase board (no legacy insight panels)", async ({ page }) => {
    await darkTheme(page);
    await installCareApiStubs(page, {
      regiekamerOverview: {
        totals: {
          active_cases: 12,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          intake_delays: 0,
          repeated_rejections: 0,
        },
        items: STABLE_REGIEKAMER_ITEMS,
      },
    });
    await page.goto(SPA_BASE, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Regiekamer/i, level: 1 })).toBeVisible({ timeout: 45_000 });
    const panel = page.getByTestId("regiekamer-dominant-action");
    await expect(panel).toHaveAttribute("data-regiekamer-mode", "optimization");
    await expect(page.getByTestId("regiekamer-dominant-primary-cta")).toHaveText(/Analyseer doorstroom|Open doorstroomrapport/);
    await expect(page.getByTestId("regiekamer-phase-board")).toBeVisible();
    await expect(page.getByTestId("regiekamer-uitvoerlijst")).toBeVisible();
    await expect(page.getByTestId("regiekamer-insight-why")).toHaveCount(0);
    await expect(page.getByTestId("regiekamer-insight-flow")).toHaveCount(0);
  });

  test("intervention: matching zwak — Bekijk matching-urgenties, operatieve aandacht + uitvoerlijst", async ({
    page,
  }) => {
    await darkTheme(page);
    await installCareApiStubs(page, {
      regiekamerOverview: {
        totals: {
          active_cases: 3,
          critical_blockers: 0,
          high_priority_alerts: 0,
          provider_sla_breaches: 0,
          intake_delays: 0,
          repeated_rejections: 0,
        },
        items: [
          {
            case_id: "int-1",
            case_reference: "INT-1",
            title: "Match probleem",
            current_state: "MATCHING_READY",
            phase: "matching",
            urgency: "high",
            assigned_provider: "",
            next_best_action: {
              action: "VALIDATE_MATCHING",
              label: "Valideer matching",
              priority: "high",
              reason: "stub",
            },
            top_blocker: null,
            top_risk: null,
            top_alert: null,
            blocker_count: 0,
            risk_count: 0,
            alert_count: 0,
            priority_score: 95,
            age_hours: 48,
            hours_in_current_state: 24,
            issue_tags: ["alerts"],
            responsible_role: "gemeente",
          },
        ],
      },
    });
    await page.goto(SPA_BASE, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Regiekamer/i, level: 1 })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("regiekamer-dominant-action")).toHaveAttribute("data-regiekamer-mode", "intervention");
    await expect(page.getByTestId("regiekamer-dominant-primary-cta")).toHaveText(
      /Bekijk matching-urgenties|Open matchingoverzicht|Bekijk matching-aanvragen/,
    );
    await expect(page.getByTestId("regiekamer-insight-why")).toHaveCount(0);
    await expect(page.getByTestId("regiekamer-dominant-action")).toContainText(/matching|casus/i);
    await expect(page.getByTestId("regiekamer-uitvoerlijst")).toBeVisible();
  });
});

test.describe("Matching openCase deep link (SPA)", () => {
  test("opens map workspace for the case in the query string", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("careon-theme", "dark");
    });
    await installCareApiStubs(page);
    await page.goto(
      `${SPA_ORIGIN.replace(/\/$/, "")}/care/matching?openCase=${encodeURIComponent(E2E_MATCHING_CASE_ID)}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.getByTestId("care-app-shell")).toBeVisible({ timeout: 45_000 });
    await expect(
      page.getByRole("heading", { name: /Matching voor Casus|Matching — Casus/i }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
