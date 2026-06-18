# CareOn — current-state assessment (runtime + page audit)

**Status:** Audit — **read-only**. No production code, tests, workflows, or components changed.
**Date:** 2026-06-17
**Scope:** Completes Part 1 (runtime/page inspection) and Part 2 (page audit) of the broad audit brief.
**Companions:** backend/architecture detail in [`../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md`](../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md); component detail in [`../design/CAREON_COMPONENT_REGISTER.md`](../design/CAREON_COMPONENT_REGISTER.md); archetypes in [`../design/CAREON_PAGE_ARCHETYPES.md`](../design/CAREON_PAGE_ARCHETYPES.md). Not duplicated here.

---

## 1. Method & evidence basis (how this was assessed)

Two evidence sources were combined; each finding below is tagged **[runtime]**, **[code]**, or **[both]**.

**Runtime.** The Django backend was booted headless from the repository (`manage.py runserver`, `config.settings`, SQLite) and exercised in two ways: (a) unauthenticated `curl` of top-level routes; (b) an authenticated in-process probe using Django's test `Client.force_login` as seeded users of each role, hitting the real page and JSON-API routes and recording status codes and payload shapes. Screenshots were **not** obtainable (see §1.2), so "concrete runtime evidence" here means HTTP status, redirect/auth behaviour, rendered-HTML size/markers, and live JSON payload keys/counts.

**Code.** The React SPA (`client/src`), Django routing (`config/urls.py`, `contracts/urls.py`), views, and templates were read directly.

### 1.1 Runtime environment notes

- Boot succeeded under a sandbox Python with the repo's own dependency set; **two environment-only shims** were required and do **not** reflect production: a stub `PIL` (real Pillow is a platform binary unavailable in-sandbox) and forcing the default `ModelBackend` for `force_login` (the OIDC backend imports a platform crypto binary). These affect only the probe harness, not app logic.
- The committed `db.sqlite3` is **schema-stale** relative to current migrations (`OperationalError: no such column: contracts_caseintakeprocess.care_intensity`); the probe used a migrated copy. **[runtime]** — see Risk R-DB in §3.

### 1.2 What could and could not be assessed

| Item | Status |
|------|--------|
| Route availability & auth-gating | **Assessed [runtime]** — curl + authenticated probe |
| JSON-API payload shape per role (the SPA's real data) | **Assessed [runtime]** — owner + member probed |
| Page structure, components, tokens, states | **Assessed [code]** — SPA is client-rendered; curl/probe returns only the shell |
| Pixel rendering / visual regression / responsive behaviour | **Not assessed** — no browser/display in sandbox; requires a Playwright/Chrome pass on a real host |
| `zorgaanbieder` (provider) role surfaces in runtime | **Partially [code]** — seeded users are OWNER/ADMIN/MEMBER of regie/gemeente orgs; provider-portal runtime not exercised |
| `admin` role surfaces in runtime | **Not assessed [runtime]** — assessed via code only |

### 1.3 Roles observed **[runtime]**

Authorization is **organization-membership based** with roles `OWNER`, `ADMIN`, `MEMBER` (confirmed: 86 users, 71 orgs). The *workflow* actor role (gemeente / zorgaanbieder / admin) is **contextual**, surfaced by `/care/api/me/` as `workflowRole` + `permissions` + `flags`, and drives SPA navigation gating in `MultiTenantDemo.tsx`. **[both]** Probed users: `pilot.owner` (OWNER), `pilot.member` (MEMBER). Read-endpoint access was **at parity** between owner and member (both saw 9 cases, identical overviews), consistent with the documented rule "VIEW/COMMENT/AI for any active member; EDIT for owners/admins/creator".

### 1.4 Routes actually exercised **[runtime]**

| Route | Result | Reading |
|-------|--------|---------|
| `/` | 200, 20 KB server HTML | Public landing renders |
| `/login/` | 200, 18.7 KB | Login renders |
| `/_health/` | 200 (2 B) | Health OK |
| `/build-info/`, `/ops/system-state/` | 302 | Auth-gated (correct) |
| `/dashboard/` | 200, 721 B | **SPA shell** (client-rendered app) |
| `/care/`, `/admin/` | 302 | Auth-gated (correct) |
| `/care/api/me/` | 200 | `id,email,fullName,username,workflowRole,organization,permissions,flags` |
| `/care/api/dashboard/` | 200 | `totalCases,activeCases,openSignals,criticalSignals,pendingTasks,phaseBreakdown,riskBreakdown` |
| `/care/api/cases/` | 200 | list under key **`contracts`** (9), paginated — legacy naming leaks into payload |
| `/care/api/regiekamer/decision-overview/` | 200 | `generated_at,totals(8),items(9),governance_queues(8)` |
| `/care/api/coordination/decision-overview/` | 200 | **identical shape** to regiekamer endpoint — alias/duplication |
| `/care/api/placements/` | 200 | `placements(4)` |
| `/care/api/provider-evaluations/` | 200 | `evaluations(4)` |
| `/care/api/providers/` | 200 | `providers(3)` + `workspace_summary(8)` |
| `/care/api/signals/` | 200 | `signals(9)` |
| `/care/api/tasks/` | 200 | `tasks(0)` (empty) |
| `/care/api/documents/` | 200 | `documents(7)` |
| `/care/api/audit-log/` | 200 | `entries(5)` |
| `/care/api/municipalities/`, `/care/api/regions/` | 200 | `municipalities(2)`, `regions(1)` |
| `/care/api/cases/1/` (+ matching/timeline/placement-detail) | 404 | Case id 1 not in probed user's org → **tenant isolation enforced at runtime** |
| `/care/clients/`, `/documents/`, `/budgets/`, `/tasks/`, `/audit-log/`, `/gemeenten/` (Django CBV routes) | 200, **721 B SPA shell** | These server-rendered CBVs return the SPA shell, not bespoke HTML → the SPA owns these surfaces; the CBVs are largely **vestigial** |
| `/profile/` | 200, 6.5 KB Django HTML | Genuinely server-rendered (title "Profiel - Careon") |
| `/settings/` | 200, 721 B SPA shell | SPA-owned |

**Headline runtime finding:** the **SPA is the product surface**; most Django class-based views in `contracts/views.py` (clients, documents, budgets, tasks, audit-log, gemeenten, regio's) resolve to the SPA shell at runtime and are effectively superseded by the SPA + JSON APIs. This materially reinforces the backend audit's verdict that `views.py` carries a large amount of secondary/vestigial server-rendered code.

---

## 2. Page audit (primary surfaces)

The SPA has **no react-router**; navigation is a hand-rolled `pushState` router in `components/examples/MultiTenantDemo.tsx`, role-gated. Each page below is scored on the brief's dimensions and the three operational questions:
**Q1 What needs attention now? · Q2 Why is something blocked? · Q3 What is the next best action?**

Legend for the three questions: **✓** answered well · **~** partial · **✗** not answered.

### 2.1 Regiekamer / operational overview — `SystemAwarenessPage.tsx` **[both]**
- **Purpose / role / phase:** cross-keten operational awareness for gemeente/coördinator; spans all phases. **Dominant task:** triage what needs action. **Dominant CTA:** open the case needing attention.
- **Data (runtime):** `regiekamer/decision-overview` → `totals(8)`, `items(9)`, `governance_queues(8)`.
- **Structure:** app frame → header → SVG keten/geo map (phase-colored) → attention/queue lists. Uses canonical `CareAttentionBar`, `CareWorkRow`, phase badges.
- **States:** loading/error via `ApiErrorMessage`; empty via `CareEmptyState`. **Responsive/a11y:** **not verified** (no runtime render); SVG map colors are inline hex (defensible special case).
- **Q1 ✓ / Q2 ~ / Q3 ✓** — surfaces attention and next action well; "why blocked" is implied by phase/SLA rather than always explicit.

### 2.2 Aanmeldingen / Casussen werklijst — `WorkloadPage.tsx` **[both]**
- **Purpose:** primary work queue of cases. **Phase:** all. **Dominant task:** scan & pick the next case. **Dominant CTA:** open case.
- **Data (runtime):** `/care/api/cases/` → 9 items (key `contracts`), paginated.
- **Structure:** header → filter/tab bar (`CareSearchFiltersBar`, `CareFilterTabGroup`) → `CarePrimaryList` of `CareWorkRow`. Status/phase via canonical badges.
- **Q1 ✓ / Q2 ~ / Q3 ✓** — strong list-scan model; blocking reasons surfaced as status, not always as explicit cause.

### 2.3 Nieuwe casus (create) — `NieuweCasusPage.tsx` (2,255 LOC) **[code]**
- **Purpose:** intake/case creation with guided completion. **Dominant CTA:** create / continue. **Notable:** very large single component; guided field wrappers; backend validation.
- **States:** guided/empty handled; **size is a maintainability risk** (see roadmap FE workstream).
- **Q1 ✓ / Q2 ✓ / Q3 ✓** within the form; missing-data drives next action well.

### 2.4 Casusdetail / execution — `CaseExecutionPage.tsx` (1,475 LOC) **[both]**
- **Purpose:** single-case workspace across the lifecycle. **Layout:** `CasusWorkspaceLayout` (2/3-column), `ProcessTimeline`, `CasePrimaryActionPanel`, feature panels (documents, missing-data, classification, validation, arrangement-alignment).
- **Data (runtime):** per-case detail/timeline/summary endpoints exist; tenant-scoped (404 cross-org confirmed).
- **Q1 ✓ / Q2 ✓ / Q3 ✓** — the strongest "what needs attention / why blocked / next best action" surface in the product (NBA + validation + timeline together). **Recommended detail golden reference** (see archetypes §5).

### 2.5 Matching / decision — `MatchingPageWithMap.tsx` (1,390 LOC) **[both]**
- **Purpose:** match a case to providers with explainability + map. **Data (runtime):** `matching-candidates` endpoint (tenant-scoped). Consumes real payload; legacy demo scores only as fallback when summary incomplete.
- **Q1 ✓ / Q2 ✓ (explainability: fit/trade-offs/score) / Q3 ✓** — decision-oriented; arrangement hints are advisory (compliant).

### 2.6 Aanbiederreacties — `AanbiederreactiePage.tsx` (gemeente) / `AanbiederPortaalPage.tsx` (provider) **[both]**
- **Purpose:** provider responses to placement requests. **Data (runtime):** `provider-evaluations` (4). Two role-specific variants. **Why-us** handoff block present.
- **Q1 ✓ / Q2 ✓ / Q3 ✓** for gemeente; **provider variant not runtime-verified**.

### 2.7 Plaatsingen — `PlacementPage.tsx` / `PlacementTrackingPage.tsx` **[both]**
- **Purpose:** placements + tracking. **Data (runtime):** `placements` (4). Shared `CareSlaCountdown`.
- **Q1 ✓ / Q2 ~ / Q3 ✓**.

### 2.8 Intake (provider) — `IntakeListPage.tsx` **[code]** — zorgaanbieder-gated; not runtime-verified for that role.

### 2.9 Cliënten — **no dedicated SPA page exists** **[both]**
- Server route `/care/clients/` exists (Django `ClientListView`) but resolves to the SPA shell at runtime, and the SPA has **no clients page component**. **Gap / inconsistency:** clients are referenced in workflows but lack a first-class surface. **Q1 ✗ / Q2 ✗ / Q3 ✗** (no page).

### 2.10 Aanbieders — `ZorgaanbiedersPage.tsx` (+ `ProviderProfilePage.tsx`) **[both]**
- **Data (runtime):** `providers` (3) + `workspace_summary`. **Q1 ~ / Q2 ~ / Q3 ~** — more directory than action surface.

### 2.11 Documenten — `DocumentenPage.tsx` **[both]** — `documents` (7) runtime. List/scan; states via canonical primitives.

### 2.12 System/admin — `GebruikersPage`, `GemeentenPage`, `RegiosPage`, `AudittrailPage`, `RapportagesPage`, `SignalenPage`, `ActiesPage` **[both]** — config/listing surfaces; `municipalities(2)`, `regions(1)`, `audit entries(5)`, `signals(9)` runtime. Admin role not runtime-verified.

### 2.13 Profiel — folds into `InstellingenPage`; `/profile/` is a real Django page (6.5 KB) **[both]**.

### 2.14 Instellingen — `InstellingenPage` → `InstellingenSettingsExperience.tsx` (974 LOC) **[both]** — SPA-owned (`/settings/` → shell).

### 2.15 Cross-cutting page-audit findings
- **Consistency [code]:** list pages share canonical primitives (`CareWorkRow`, filter bar, badges) → good structural consistency. The exception is `LoginPage.tsx` (37 inline styles, 27 hex literals — off-token).
- **The 3 questions [both]:** best answered on **Casusdetail** and **Matching**; weakest on **directory/config** pages and the **missing Cliënten** surface.
- **Empty/loading/error [code]:** canonical `CareEmptyState` / `LoadingState` / `ErrorState` / `ApiErrorMessage` exist and are widely used; a few orphan duplicates exist (register).
- **Responsive & a11y [not assessed]:** require a browser pass; flagged as an explicit gap and a roadmap item (visual-regression + a11y in CI).

---

## 3. Material risks surfaced by this assessment

- **R-DB [runtime]:** committed `db.sqlite3` lags migrations → fresh checkouts/demos can 500 on core APIs until migrated. Recommend not committing a stale dev DB, or document a `migrate` bootstrap step.
- **R-VEST [both]:** large vestigial server-rendered CBV surface in `views.py` (clients/documents/budgets/tasks/audit-log/gemeenten resolve to the SPA shell). Confirms and amplifies the `views.py` decomposition priority.
- **R-DUP-API [runtime]:** `regiekamer` and `coordination` decision-overview endpoints return identical shapes — candidate alias to consolidate.
- **R-NAME [runtime]:** cases API returns the list under key `contracts` — legacy terminology leaking into a live contract (changing it is a breaking API change → governance decision).
- **R-CLIENTS [both]:** no first-class Cliënten surface despite a server route.
- **R-SHELL-ROUTER [code]:** the production router lives in `components/examples/MultiTenantDemo.tsx` — a misleading location for a core surface.

These feed the standardization roadmap's page-migration and backend workstreams. Component-level risks (shadow design systems, dead components, off-token `LoginPage`) are catalogued in the component register.
