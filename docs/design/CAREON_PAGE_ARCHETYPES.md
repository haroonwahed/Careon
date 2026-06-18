# CareOn — page archetypes & golden references

**Status:** Audit / standard proposal — **read-only**. No components changed.
**Date:** 2026-06-17
**Scope:** Parts 4 & 5 of the audit brief. Defines the official CareOn page archetypes, assigns every primary page to one, and names two golden-reference pages.
**Inputs:** [`CAREON_COMPONENT_REGISTER.md`](CAREON_COMPONENT_REGISTER.md), [`../audits/CAREON_CURRENT_STATE_ASSESSMENT.md`](../audits/CAREON_CURRENT_STATE_ASSESSMENT.md), and the existing `docs/design/CAREON_UI_CONTRACT.md`.

> All archetypes inherit the **CareOn UI contract** (layout, spacing, radii, surfaces, CTAs) and the canonical primitives in the component register. An archetype defines *which slots exist and in what order*; the UI contract defines *how each slot looks*.

---

## The five official archetypes

1. **A1 — Operational overview** (situational awareness across the keten)
2. **A2 — Work queue / listing** (scan-first list of work items)
3. **A3 — Detail / workspace** (single entity across its lifecycle)
4. **A4 — Matching / decision** (compare options and commit a decision)
5. **A5 — Admin / configuration** (manage reference & config data)

Every primary surface must map to exactly one. Deviations must be named and justified (last column of §6).

---

## A1 — Operational overview

- **Purpose:** answer "what across the whole operation needs attention now?"
- **Fixed structure:** `CareAppFrame` → `CareUnifiedHeader` → optional context/awareness visual (e.g. keten/geo map) → KPI strip → **attention queues** (`CareAttentionBar` + `CareWorkRow` lists) grouped by phase/urgency.
- **Header:** title + period/scope context. **Context info:** totals, phase/risk breakdown. **Primary CTA:** open the highest-priority item.
- **Filters:** light (scope/phase toggles), not heavy faceting. **Main content:** prioritized attention lists. **Secondary:** governance queues. **Side panel:** optional (selected-item context).
- **Status patterns:** canonical phase + status badges; SLA countdown. **Actions:** navigate-to-case; inline triage.
- **Empty/loading/error:** `CareEmptyState` / `LoadingState` / `ApiErrorMessage`. **Responsive:** map collapses above lists on narrow widths. **Allowed exceptions:** bespoke awareness visual (SVG map) may use named visual tokens.

## A2 — Work queue / listing

- **Purpose:** "scan a set of work items and pick the next one."
- **Fixed structure:** `CareAppFrame` → `CareUnifiedHeader` → `CareSearchFiltersBar` + `CareFilterTabGroup` → `CarePrimaryList` of `CareWorkRow` → pagination.
- **Header:** title + count. **Context:** active filter summary. **Primary CTA:** open item (row) / create new (header). **Filters:** prominent (search + tabs + optional `CareFilterDrawer`).
- **Main content:** the row list. **Secondary:** none or a thin summary. **Side panel:** none (selection opens detail/overlay).
- **Status patterns:** status/phase/priority badges per row; SLA countdown. **Actions:** row open + limited inline actions.
- **Empty/loading/error:** canonical primitives. **Responsive:** rows reflow to stacked cards on narrow widths. **Allowed exceptions:** role-specific column sets (gemeente vs provider).

## A3 — Detail / workspace

- **Purpose:** "work a single entity through its lifecycle; know what's blocked and what's next."
- **Fixed structure:** `CareAppFrame` → detail header (title, status, identifiers) → **workflow strip / timeline** → 2/3-column `CasusWorkspaceLayout`: main = phase content + feature panels; side = context + **primary action panel (NBA)**.
- **Header:** entity title + canonical status/phase badges. **Context info:** owner, priority, elapsed, key identifiers. **Primary CTA:** the next best action (single, dominant). **Filters:** none (tabs/sections instead).
- **Main content:** phase-appropriate panels (summary, classification, validation, documents, matching/placement). **Secondary:** timeline/history. **Side panel:** required — context + NBA.
- **Status patterns:** phase stepper + status + decision badges; blocking notice when gated. **Actions:** phase transitions via guarded action panel; dialogs for mutations.
- **Empty/loading/error:** per-panel. **Responsive:** side panel drops below main on narrow widths. **Allowed exceptions:** phase-specific panels may vary by lifecycle stage.

## A4 — Matching / decision

- **Purpose:** "compare options for a case and commit a defensible decision."
- **Fixed structure:** `CareAppFrame` → header (case context) → split: candidate list/scoring **+** map/visual → explainability (fit, trade-offs, score) → decision action zone.
- **Header:** case + scope. **Context info:** case summary completeness; arrangement hints (advisory). **Primary CTA:** select/propose provider (decision). **Filters:** candidate filters (capacity/region/care-form).
- **Main content:** ranked candidates with explainability. **Secondary:** map. **Side panel:** selected-candidate detail.
- **Status patterns:** match score + fit summary + trade-off hints; advisory (non-binding) arrangement banner. **Actions:** accept / reject / request-info with reason capture + audit.
- **Empty/loading/error:** canonical; amber banner when summary incomplete (demo-score fallback). **Responsive:** map collapses. **Allowed exceptions:** map presentation; explainability copy.

## A5 — Admin / configuration

- **Purpose:** "manage reference and configuration data (users, gemeenten, regio's, providers directory, documents)."
- **Fixed structure:** `CareAppFrame` → `CareUnifiedHeader` → optional filter bar → table/list → create/edit dialog or sub-page.
- **Header:** title + create CTA. **Context:** scope/count. **Primary CTA:** create/add. **Filters:** simple search.
- **Main content:** table/list. **Secondary:** none. **Side panel:** optional detail.
- **Status patterns:** activation/role badges where relevant. **Actions:** CRUD via dialogs, permission-gated (EDIT = owner/admin).
- **Empty/loading/error:** canonical. **Responsive:** table → stacked. **Allowed exceptions:** read-only directories (providers) may omit create.

---

## 6. Assignment of every primary page to an archetype

| Page · component | Archetype | Conformance / deviation |
|---|---|---|
| Regiekamer · `SystemAwarenessPage` | **A1** | Conforms; bespoke SVG map is an allowed A1 exception |
| Casussen werklijst / Aanmeldingen · `WorkloadPage` | **A2** | Conforms — **golden-reference candidate** |
| Mijn-casussen (provider) · `WorkloadPage` | **A2** | Conforms (role-filtered) |
| Intake (provider) · `IntakeListPage` | **A2** | Conforms; provider columns |
| Nieuwe casus · `NieuweCasusPage` | **A3** (create variant) | Conforms but **oversized (2.3k LOC)**; guided form is an A3 create deviation |
| Casusdetail · `CaseExecutionPage` | **A3** | Conforms — **golden-reference (detail)** |
| Matching · `MatchingPageWithMap` | **A4** | Conforms |
| Aanbiederreacties · `AanbiederreactiePage` / `AanbiederPortaalPage` | **A4** (gemeente) / **A2** (provider portal) | Two variants; provider portal is queue-like (A2) |
| Plaatsingen · `PlacementPage` / `PlacementTrackingPage` | **A2** + **A3** | List (A2) + tracking detail (A3) |
| Aanbieders · `ZorgaanbiedersPage` / `ProviderProfilePage` | **A5** + **A3** | Directory (A5) + profile (A3) |
| Documenten · `DocumentenPage` | **A2** | Conforms |
| Signalen · `SignalenPage` | **A2** | Conforms |
| Acties · `ActiesPage` | **A2** | Conforms |
| Rapportages · `RapportagesPage` | **A1**/**A5** | Reporting hybrid; inline styles to clean |
| Gemeenten · `GemeentenPage`, Regio's · `RegiosPage`, Gebruikers · `GebruikersPage` | **A5** | Conform |
| Audittrail · `AudittrailPage` | **A2** (read-only) | Conforms |
| Instellingen · `InstellingenPage` | **A5** | Conforms |
| Profiel · (Django `/profile/`) | **A5** | Server-rendered exception (not SPA) |
| **Cliënten** | **A5** (expected) | **Missing page** — server route exists, no SPA surface (gap) |

---

## 7. Golden reference pages

### 7.1 Overview / work-queue golden reference → **`WorkloadPage.tsx` (A2)**
- **Why:** it already composes the canonical A2 stack end-to-end (`CareUnifiedHeader` → `CareSearchFiltersBar`/`CareFilterTabGroup` → `CarePrimaryList`/`CareWorkRow`), is backed by the real `/care/api/cases/` payload, and is the most-used surface.
- **Keep:** the filter-bar + work-row composition; canonical badges; pagination; empty/loading/error via canonical primitives.
- **Fix before sealing as reference:** confirm no inline-style drift; ensure the row's three-question signalling (attention / why-blocked / next-action) is explicit, not just status color; verify responsive row→card reflow.
- **Migration pattern for other A2 pages (Signalen, Documenten, Acties, Audittrail, provider portal):** replace any bespoke list/header with the `WorkloadPage` composition; delete local list primitives in favour of `CareWorkRow`.

### 7.2 Detail golden reference → **`CaseExecutionPage.tsx` (A3)**
- **Why:** it is the richest, most coherent A3 surface — `CasusWorkspaceLayout` 2/3-column, `ProcessTimeline`, `CasePrimaryActionPanel` (NBA), and the validation/missing-data/classification panels together answer Q1/Q2/Q3 best in the product.
- **Keep:** the workspace layout; NBA action panel; timeline; feature-panel pattern; guarded transitions.
- **Fix before sealing as reference:** fold `design/ProcessTimeline` into the care primitives (retire `design/`); consolidate `CasusWorkspaceLayout` with the unused `CareDetailPageTemplate` kit and resolve the `CareSection` name collision; ensure the side panel reflow is responsive; confirm tokens (no inline drift).
- **Migration pattern for other A3 pages (Placement tracking, Provider profile, Nieuwe casus):** adopt `CasusWorkspaceLayout` + NBA panel; move feature content into panels; for `NieuweCasusPage`, decompose the 2.3k-LOC monolith into the panel pattern.

---

## 8. Controlled migration rule

No page may introduce a new shell, header, list, badge, or action-panel pattern. New or refactored pages must (a) declare their archetype, (b) compose only Approved primitives, and (c) match the relevant golden reference. Enforced via the page-creation checklist in [`../engineering/CAREON_ENGINEERING_STANDARDS.md`](../engineering/CAREON_ENGINEERING_STANDARDS.md) and sequenced in [`../roadmap/CAREON_STANDARDIZATION_ROADMAP.md`](../roadmap/CAREON_STANDARDIZATION_ROADMAP.md) (page-archetype workstream).
