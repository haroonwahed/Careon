/**
 * Shared SPA E2E helpers: dashboard entry URL and deterministic `/care/api/*` GET stubs
 * so Playwright does not hit Django 401/login during list/workspace tests.
 */
import type { Page, Request } from "@playwright/test";

export const SPA_ORIGIN =
  process.env.E2E_SPA_URL || process.env.PLAYWRIGHT_SPA_URL || "http://127.0.0.1:3000";

/** Public route is `/`; MultiTenantDemo loads when `view=dashboard` (see App.tsx). */
export const SPA_BASE = `${SPA_ORIGIN.replace(/\/$/, "")}/?view=dashboard`;

export const E2E_MATCHING_CASE_ID = "e2e-matching-1";

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** Minimal payload so CaseExecutionPage can render after opening a casus from the list. */
export function buildDecisionEvaluationStub(caseId: string) {
  const now = new Date().toISOString();
  return {
    case_id: caseId,
    current_state: "MATCHING_READY",
    phase: "matching",
    coverage_basis: "known",
    coverage_status: "ok",
    confidence_score: 0.72,
    confidence_reason: "Stub voor E2E.",
    next_best_action: {
      action: "VALIDATE_MATCHING",
      label: "Matching valideren",
      priority: "high",
      reason: "Controleer het matchadvies voordat je doorzet.",
    },
    blockers: [],
    risks: [],
    alerts: [],
    allowed_actions: [{ action: "VALIDATE_MATCHING", label: "Matching valideren", allowed: true }],
    blocked_actions: [
      { action: "START_MATCHING", label: "Matching starten", reason: "Niet nodig in deze stub.", allowed: false },
      { action: "SEND_TO_PROVIDER", label: "Naar aanbieder", reason: "Nog niet toegestaan.", allowed: false },
      { action: "CONFIRM_PLACEMENT", label: "Plaatsing", reason: "Nog niet toegestaan.", allowed: false },
      { action: "START_INTAKE", label: "Intake", reason: "Nog niet toegestaan.", allowed: false },
    ],
    decision_context: {
      required_data_complete: true,
      has_summary: true,
      has_matching_result: true,
      latest_match_confidence: 0.7,
      provider_review_status: "none",
      provider_rejection_count: 0,
      latest_rejection_reason: "",
      placement_confirmed: false,
      intake_started: false,
      case_age_hours: 24,
      hours_in_current_state: 6,
      urgency: "normal",
      capacity_signals: [],
      selected_provider_id: null,
      selected_provider_name: null,
    },
    timeline_signals: {
      latest_event_type: "case_updated",
      latest_event_at: now,
      recent_events: [] as Array<{
        event_type: string;
        user_action: string;
        timestamp: string;
        action_source: string;
      }>,
    },
  };
}

/** Partial override for `/care/api/regiekamer/decision-overview/` (E2E only). */
export type RegiekamerOverviewStubPatch = {
  generated_at?: string;
  totals?: Partial<{
    active_cases: number;
    critical_blockers: number;
    high_priority_alerts: number;
    provider_sla_breaches: number;
    repeated_rejections: number;
    intake_delays: number;
  }>;
  items?: unknown[];
};

/** Stub GET /care/api/* so Vite→Django proxy 401 does not redirect to login during E2E. */
export async function installCareApiStubs(page: Page, options?: { regiekamerOverview?: RegiekamerOverviewStubPatch }) {
  const casesPayload = {
    contracts: [
      {
        id: "e2e-matching-1",
        title: "E2E matching casus",
        status: "IN_REVIEW",
        case_phase: "matching",
        risk_level: "MEDIUM",
        service_region: "Utrecht",
        contract_type: "MSA",
        preferred_provider: "",
        content: "Samenvatting en matchcontext voor visuele regressie.",
        owner: "e2e",
        created_at: isoDaysAgo(5),
        updated_at: isoDaysAgo(1),
        urgency_validated: true,
        urgency_document_present: true,
        workflow_state: "MATCHING_READY",
      },
      {
        id: "e2e-provider-1",
        title: "E2E aanbieder casus",
        status: "IN_REVIEW",
        case_phase: "provider_beoordeling",
        risk_level: "HIGH",
        service_region: "Utrecht",
        contract_type: "MSA",
        preferred_provider: "Horizon Jeugdzorg",
        content: "Verstuurd naar aanbieder.",
        owner: "e2e",
        created_at: isoDaysAgo(8),
        updated_at: isoDaysAgo(2),
        urgency_validated: true,
        urgency_document_present: true,
        arrangement_provider: "Horizon Jeugdzorg",
        workflow_state: "PROVIDER_REVIEW_PENDING",
      },
      {
        id: "e2e-place-1",
        title: "E2E plaatsing casus",
        status: "IN_REVIEW",
        case_phase: "plaatsing",
        risk_level: "MEDIUM",
        service_region: "Utrecht",
        contract_type: "MSA",
        preferred_provider: "Horizon Jeugdzorg",
        content: "Plaatsing wacht op bevestiging.",
        owner: "e2e",
        created_at: isoDaysAgo(1),
        updated_at: isoDaysAgo(0),
        urgency_validated: true,
        urgency_document_present: true,
        arrangement_provider: "Horizon Jeugdzorg",
        workflow_state: "PLACEMENT_CONFIRMED",
      },
      {
        id: "e2e-summary-1",
        title: "E2E samenvatting casus",
        status: "DRAFT",
        case_phase: "intake",
        risk_level: "LOW",
        service_region: "Utrecht",
        contract_type: "NDA",
        preferred_provider: "",
        content: "Korte inhoud voor werkvoorraad.",
        owner: "e2e",
        created_at: isoDaysAgo(3),
        updated_at: isoDaysAgo(1),
        urgency_validated: true,
        urgency_document_present: true,
        workflow_state: "SUMMARY_READY",
      },
    ],
    total_count: 4,
    page: 1,
    page_size: 100,
    total_pages: 1,
  };

  const providersPayload = {
    providers: [
      {
        id: "p-e2e-1",
        name: "Horizon Jeugdzorg",
        city: "Utrecht",
        status: "active",
        currentCapacity: 5,
        maxCapacity: 10,
        waitingListLength: 2,
        averageWaitDays: 14,
        offersOutpatient: true,
        offersDayTreatment: true,
        offersResidential: false,
        offersCrisis: false,
        serviceArea: "Utrecht",
        specialFacilities: "Jeugd, GGZ",
        latitude: 52.09,
        longitude: 5.12,
        hasCoordinates: true,
        locationLabel: "Utrecht",
        regionLabel: "Utrecht",
        municipalityLabel: "Utrecht",
        secondaryRegionLabels: [],
        allRegionLabels: ["Utrecht"],
      },
      {
        id: "p-e2e-2",
        name: "Sterrenslag Jeugdzorg",
        city: "Utrecht",
        status: "active",
        currentCapacity: 2,
        maxCapacity: 8,
        waitingListLength: 0,
        averageWaitDays: 3,
        offersOutpatient: true,
        offersDayTreatment: false,
        offersResidential: false,
        offersCrisis: false,
        serviceArea: "Utrecht",
        specialFacilities: "Jeugd",
        latitude: 52.1,
        longitude: 5.11,
        hasCoordinates: true,
        locationLabel: "Utrecht",
        regionLabel: "Utrecht",
        municipalityLabel: "Utrecht",
        secondaryRegionLabels: [],
        allRegionLabels: ["Utrecht"],
      },
      {
        id: "p-e2e-3",
        name: "De Linde Utrecht",
        city: "Utrecht",
        status: "active",
        currentCapacity: 0,
        maxCapacity: 6,
        waitingListLength: 4,
        averageWaitDays: 21,
        offersOutpatient: true,
        offersDayTreatment: false,
        offersResidential: true,
        offersCrisis: false,
        serviceArea: "Utrecht",
        specialFacilities: "Jeugd, crisis",
        latitude: 52.08,
        longitude: 5.13,
        hasCoordinates: true,
        locationLabel: "Utrecht",
        regionLabel: "Utrecht",
        municipalityLabel: "Utrecht",
        secondaryRegionLabels: [],
        allRegionLabels: ["Utrecht"],
      },
    ],
    total_count: 3,
  };

  const regiekamerPayload = {
    generated_at: new Date().toISOString(),
    totals: {
      active_cases: 4,
      critical_blockers: 1,
      high_priority_alerts: 1,
      provider_sla_breaches: 1,
      repeated_rejections: 0,
      intake_delays: 0,
    },
    items: [
      {
        case_id: "e2e-matching-1",
        case_reference: "REF-E2E-M1",
        title: "E2E matching casus",
        current_state: "MATCHING_READY",
        phase: "matching",
        urgency: "critical",
        assigned_provider: "Horizon Jeugdzorg",
        next_best_action: {
          action: "VALIDATE_MATCHING",
          label: "Controleer matchadvies",
          priority: "high",
          reason: "E2E stub",
        },
        top_blocker: {
          code: "E2E_BLOCK",
          severity: "critical",
          message: "Blokkade voor visuele regressie",
        },
        top_risk: null,
        top_alert: null,
        blocker_count: 1,
        risk_count: 0,
        alert_count: 0,
        priority_score: 130,
        age_hours: 120,
        hours_in_current_state: 200,
        issue_tags: ["blockers"],
        responsible_role: "gemeente",
      },
      {
        case_id: "e2e-provider-1",
        case_reference: "REF-E2E-P1",
        title: "E2E aanbieder casus",
        current_state: "PROVIDER_REVIEW_PENDING",
        phase: "aanbieder_beoordeling",
        urgency: "normal",
        assigned_provider: "Horizon Jeugdzorg",
        next_best_action: {
          action: "WAIT_PROVIDER_RESPONSE",
          label: "Volg aanbieder",
          priority: "medium",
          reason: "E2E stub",
        },
        top_blocker: null,
        top_risk: { code: "E2E_RISK", severity: "medium", message: "Capaciteitsrisico" },
        top_alert: null,
        blocker_count: 0,
        risk_count: 1,
        alert_count: 0,
        priority_score: 45,
        age_hours: 48,
        hours_in_current_state: 36,
        issue_tags: ["risks"],
        responsible_role: "zorgaanbieder",
      },
    ],
  };

  const mergedRegiekamerPayload =
    options?.regiekamerOverview != null
      ? {
          ...regiekamerPayload,
          ...options.regiekamerOverview,
          totals: {
            ...regiekamerPayload.totals,
            ...options.regiekamerOverview.totals,
          },
          items: options.regiekamerOverview.items ?? regiekamerPayload.items,
          generated_at: options.regiekamerOverview.generated_at ?? regiekamerPayload.generated_at,
        }
      : regiekamerPayload;

  const tasksPayload = {
    tasks: [
      {
        id: "task-e2e-1",
        title: "Bel cliënt voor intake",
        description: "Telefonische check voor E2E layout.",
        priority: "high",
        status: "OPEN",
        actionStatus: "today",
        linkedCaseId: "e2e-matching-1",
        caseTitle: "E2E matching casus",
        assignedTo: "Jane Doe",
        dueDate: isoDaysAgo(-1).slice(0, 10),
        createdAt: isoDaysAgo(2),
      },
    ],
    total_count: 1,
  };

  const intakeFormPayload = {
    initial_values: {
      title: "",
      start_date: "",
      target_completion_date: "",
      care_category_main: "",
      care_category_sub: "",
      assessment_summary: "",
      gemeente: "",
      regio: "",
      urgency: "",
      complexity: "",
      urgency_applied: false,
      urgency_applied_since: "",
      diagnostiek: [],
      zorgvorm_gewenst: "",
      preferred_care_form: "",
      preferred_region_type: "",
      preferred_region: "",
      max_toelaatbare_wachttijd_dagen: "",
      leeftijd: "",
      setting_voorkeur: "",
      contra_indicaties: "",
      problematiek_types: "",
      client_age_category: "",
      family_situation: "",
      school_work_status: "",
      case_coordinator: "",
      description: "",
    },
    options: {
      care_category_main: [{ value: "ggz", label: "GGZ" }],
      care_category_sub: [{ value: "ggz-jeugd", label: "Jeugd GGZ", mainCategoryId: "ggz" }],
      gemeente: [{ value: "utrecht", label: "Utrecht" }],
      regio: [{ value: "utrecht", label: "Utrecht" }],
      urgency: [
        { value: "low", label: "Laag" },
        { value: "medium", label: "Midden" },
        { value: "high", label: "Hoog" },
      ],
      complexity: [
        { value: "low", label: "Laag" },
        { value: "medium", label: "Midden" },
        { value: "high", label: "Hoog" },
      ],
      diagnostiek: [{ value: "trauma", label: "Trauma" }],
      zorgvorm_gewenst: [{ value: "ambulant", label: "Ambulant" }],
      preferred_care_form: [{ value: "ambulant", label: "Ambulant" }],
      preferred_region_type: [{ value: "lokaal", label: "Lokaal" }],
      preferred_region: [{ value: "utrecht", label: "Utrecht" }],
      client_age_category: [{ value: "jeugd", label: "Jeugd" }],
      family_situation: [{ value: "thuis", label: "Thuis" }],
      case_coordinator: [{ value: "gemeente", label: "Gemeente" }],
    },
  };

  await page.route("**/care/api/**", async (route) => {
    const method = route.request().method();
    const pathname = new URL(route.request().url()).pathname.replace(/\/{2,}/g, "/");
    const pathNoTrailing = pathname.replace(/\/+$/, "") || "/";

    if (method === "POST" && pathNoTrailing === "/care/api/cases/intake-create") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          id: 99,
          case_id: "99",
          title: "CLI-12345",
          redirect_url: "/care/cases/99/",
        }),
      });
      return;
    }

    if (method !== "GET") {
      await route.continue();
      return;
    }
    const fulfill = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (pathNoTrailing === "/care/api/me" || pathNoTrailing === "/care/api/me/") {
      await fulfill({
        id: 1,
        email: "e2e@example.com",
        fullName: "E2E Gemeente",
        username: "e2e_gemeente",
        workflowRole: "gemeente",
        organization: { id: 1, name: "Utrecht" },
        permissions: { allowRoleSwitch: true },
        flags: { pilotUi: true, spaOnlyWorkflow: false },
      });
      return;
    }
    if (pathNoTrailing === "/care/api/cases") {
      await fulfill(casesPayload);
      return;
    }
    if (pathNoTrailing === "/care/api/providers") {
      await fulfill(providersPayload);
      return;
    }
    if (
      pathNoTrailing === "/care/api/regiekamer/decision-overview"
      || pathname.includes("/regiekamer/decision-overview")
    ) {
      await fulfill(mergedRegiekamerPayload);
      return;
    }
    if (pathNoTrailing === "/care/api/tasks") {
      await fulfill(tasksPayload);
      return;
    }
    if (pathNoTrailing === "/care/api/cases/intake-form") {
      await fulfill(intakeFormPayload);
      return;
    }
    if (pathNoTrailing === "/care/api/provider-evaluations") {
      await fulfill({ evaluations: [], total_count: 0 });
      return;
    }
    if (pathNoTrailing === "/care/api/assessments") {
      /** One incomplete assessment so Signalen always has ≥1 deterministic row in E2E (not a backend contract). */
      await fulfill({
        assessments: [
          {
            id: "e2e-asmt-1",
            caseId: "e2e-matching-1",
            caseTitle: "E2E matching casus",
            regio: "Utrecht",
            wachttijd: 5,
            status: "UNDER_REVIEW",
            matchingReady: false,
            riskSignals: ["SAFETY"],
            notes: "E2E stub",
            assessedBy: "e2e",
            createdAt: "2024-01-01T00:00:00.000Z",
          },
        ],
        total_count: 1,
      });
      return;
    }
    if (pathNoTrailing === "/care/api/regions/health") {
      await fulfill({ regions: [], total_count: 0 });
      return;
    }
    if (pathNoTrailing === "/care/api/regions") {
      await fulfill({ regions: [], total_count: 0 });
      return;
    }

    const decisionMatch = pathname.match(/^\/care\/api\/cases\/([^/]+)\/decision-evaluation\/?$/);
    if (decisionMatch) {
      await fulfill(buildDecisionEvaluationStub(decisionMatch[1] ?? ""));
      return;
    }

    await route.continue();
  });
}

export function isMatchingCaseDecisionEvalGet(req: Request): boolean {
  return (
    req.method() === "GET"
    && req.url().includes(E2E_MATCHING_CASE_ID)
    && req.url().includes("/decision-evaluation")
  );
}

/**
 * SPA shell entry: Vite dev (`:3000`, `:5173`) uses `/?view=dashboard`; Django serves `/dashboard/`.
 * Use with Playwright `page.goto(spaDashboardPath(baseURL))` so CI and local dev both work.
 */
export function spaDashboardPath(baseURL?: string | null): string {
  const b = baseURL ?? "";
  if (
    process.env.E2E_SPA_URL
    || process.env.PLAYWRIGHT_SPA_URL
    || /:(3000|5173)\b/.test(b)
  ) {
    return "/?view=dashboard";
  }
  return "/dashboard/";
}

/** Sidebar items are `<button>` rows inside `<nav>`. */
export async function goSidebar(page: Page, label: string) {
  await page.getByRole("button", { name: new RegExp(label, "i") }).first().click();
}
