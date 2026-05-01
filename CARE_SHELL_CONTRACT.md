# Care Shell Contract (Zorg OS)

Enforceable rules for the authenticated Care SPA shell: layout, tokens, shared primitives, and Regiekamer operating modes. The backend remains the source of truth for workflow; this document governs **presentation and discoverability** only.

---

## 1. Care app shell rules

- **Single chrome**: `data-testid="care-app-shell"` wraps sidebar + top bar + `main` (`care-app-main`). One `<main>` in the document.
- **No parallel “legacy” shells**: list/work pages use `CarePageTemplate`; avoid duplicate outer wrappers or second navigation trees.
- **Vertical rhythm**: use `CARE_UNIFIED_PAGE_STACK` (`space-y-4`) inside `CarePageTemplate` unless a route-specific exception is documented below.

---

## 2. Allowed page templates

| Template | Use |
|----------|-----|
| **`CarePageTemplate`** | Standard list/work routes: header → optional attention → optional filters → body. |
| **Case workspace** | `CaseExecutionPage` (or equivalent) when `selectedCase` / `/care/cases/:id` is active: NBA + single context panel; not a second full chrome. |
| **Map/special** | e.g. Zorgaanbieders map: may omit `CareSearchFiltersBar` in favor of a documented filter surface (`zorgaanbieders-filter-panel`). |

---

## 3. Token rules

- **No raw one-off colors** for surfaces and text: use theme tokens, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-card`, and existing Tailwind theme keys with **`dark:`** companions where needed.
- **Extend `client/src/design/tokens.ts`** when a semantic is missing; do not inline arbitrary hex/rgb for new UI.
- **Density**: respect visual density rules in `AGENTS.md` (compact strips, rows, timelines).

---

## 4. Spacing, radius, surface hierarchy

- **Section stack**: attention (dominant action + optional metric strip) → filters → list; use consistent `rounded-xl` for primary sections and `border-border/50` (or tokenized equivalent).
- **Metric strip**: max height ~56px effective; `data-testid="metric-strip"` on Regiekamer compact strip only where the contract allows **MetricStrip** (Regiekamer).
- **No dense dashboard blocks above the fold** on list routes: avoid multi-card grids before the primary worklist; one dominant action panel + compact strip is the cap for Regiekamer.

---

## 5. Page header contract

- **Component**: `CareUnifiedHeader` with `data-testid="care-unified-header"`.
- **Content**: `title` (h1 context via page), `subtitle`, optional `actions` (secondary verbs like refresh).
- **Single h1 discipline**: prefer one primary heading per route in main content (`care-design-system` asserts bounded h1 count).

---

## 6. Search / filter contract

- **Standard lists**: `CareSearchFiltersBar` + `data-testid="care-search-control-stack"` + `care-search-input` with non-empty `aria-label`.
- **No duplicated filter bars**: one search/filter stack per page; “Meer filters” collapsible as implemented—do not add a second horizontal filter strip for the same dataset.
- **Exceptions**: Zorgaanbieders (map) uses `zorgaanbieders-filter-panel`; documented in tests.

---

## 7. CareWorkRow contract

- Rows expose `data-care-work-row` (or Regiekamer-specific row tags where applicable).
- Middle column: `CareDominantStatus` (`data-component="care-dominant-status"`) and/or `CareMetaChip` (`data-component="care-meta-chip"`).
- Row CTAs: bounded count (see design-system E2E); primary row action must not duplicate the page-level dominant action.

---

## 8. KPI strip contract

- **Regiekamer**: compact metric strip only (`metric-strip`), not full `MetricStrip` from design package elsewhere.
- **Casussen**: no Regiekamer metric strip; list-first.
- **MetricStrip** (`client/src/components/design/MetricStrip.tsx`): **Regiekamer-only** usage per `AGENTS.md` (if used as the rich strip, keep it scoped—compact strip on Regiekamer is the current implementation).

---

## 9. Disclosure / insight contract

- **`details` / `summary`**: used for non-blocking explanations (“Waarom gebeurt dit?”, flow insight).
- **Default**: **collapsed** (`open` attribute not set); users expand when stable/optimization affordances need depth.
- **Do not** stack multiple competing disclosure banners at the top; max two insight blocks on Regiekamer in stable/optimization.

---

## 10. Dominant next-best-action contract

- **Single panel** per route that uses it: `DominantActionPanel` with `data-component="care-dominant-action-panel"` and a route-specific `data-testid` on the root (e.g. `regiekamer-dominant-action`).
- **Layout**: text left; primary + optional secondary actions right from `sm` breakpoint (`sm:flex-row sm:items-center sm:justify-between`).
- **One primary CTA** at page level; optional secondary/outline. No multiple primary-weight banners (`data-component="care-attention-bar"` count must stay at 0 on canonical Regiekamer).
- **Copy** lives in the **caller**, not inside `DominantActionPanel`.

---

## 11. Regiekamer modes

| Mode | When (conceptual) | Dominant panel | Metric strip | Insight `details` | Regie-acties queue |
|------|-------------------|----------------|------------|-------------------|---------------------|
| **crisis** | Blockers / SLA / critical pressure | Urgent tone; “Los blokkades op” / SLA CTA | Yes | **Hidden** | Hidden |
| **intervention** | Targeted intervention (e.g. matching weak) | Attention tone | Yes | **Hidden** | Shown |
| **stable** | Low noise, healthy funnel | Calm tone; werkvoorraad CTA | Yes | **Shown** (collapsed by default) | Shown |
| **optimization** | Capacity for improvement narrative | Calm/attention; analyse CTA | Yes | **Shown** (collapsed by default) | Shown |

`data-regiekamer-mode` on the dominant panel reflects the active mode for tests and analytics.

---

## 12. Forbidden patterns

| Pattern | Why |
|---------|-----|
| Raw one-off colors | Breaks dark theme and auditability |
| Duplicated filter bars | Double maintenance and UX noise |
| Multiple competing primary CTAs | Violates “next best action” |
| Legacy shells / duplicate chrome | Breaks landmark and sidebar contract |
| Dense dashboard blocks above the fold | Hides the worklist; violates action-over-decoration |
| Regiekamer-specific copy inside `DominantActionPanel` | Primitive must stay domain-agnostic |

---

## 13. Route × component audit

SPA routing: `MultiTenantDemo` maps paths (e.g. `/regiekamer`) to page components. Casus workspace: URL `/care/cases/:id` → `CaseExecutionPage` when a case is selected.

| Route | Page template | Header | Search / filter | Row / list | KPI / metric | Dominant action / decision | Known drift | Recommended fix | Priority |
|-------|---------------|--------|-----------------|------------|--------------|----------------------------|-------------|-----------------|----------|
| `/regiekamer` | `CarePageTemplate` | `CareUnifiedHeader` | `CareSearchFiltersBar` | Regiekamer worklist + `data-care-work-row` / `regiekamer-worklist-item` | `CompactMetricStrip` (`metric-strip`) | `DominantActionPanel` + mode dataset | Historical inline panel removed | Keep contract tests green | P0 |
| `/casussen` | `CarePageTemplate` | `CareUnifiedHeader` | `CareSearchFiltersBar` | `CareWorkRow` / worklist | None at page top | Row CTAs + workspace NBA | — | Align any new KPIs with contract | P1 |
| `/matching` | `CarePageTemplate` (via `MatchingQueuePage`) | `CareUnifiedHeader` | `CareSearchFiltersBar` | `CareWorkRow`; detail: `MatchingPageWithMap` | — | Dialog confirmation on select | Wrapper adds second step | Document two-step as intentional | P2 |
| `/acties` | `CarePageTemplate` | `CareUnifiedHeader` | `CareSearchFiltersBar` + tabs | `CareWorkRow` | — | Row CTAs (Open casus) | — | See **Route alignment notes** | P2 |
| `/signalen` | `CarePageTemplate` | `CareUnifiedHeader` | `CareSearchFiltersBar` + tabs | `CareWorkRow` / **`signalen-worklist`** | — | Row / navigate | — | See **Route alignment notes** | P2 |
| `/zorgaanbieders` | Custom layout in `ZorgaanbiedersPage` (not `CarePageTemplate`) | Custom page header (not `CareUnifiedHeader`) | `zorgaanbieders-filter-panel` (no `care-search-control-stack`) | `ProviderNetworkMap` + **provider card** list (not `CareWorkRow`) | Inline stat chips in header | Map + card actions / **Selecteer** (advisory) | **Intentional exception** — see below | Tighten tokens / a11y only until product opts into shared list | P2 |
| `/regios` | Mixed: see `RegiosPage` | Present | `CareSearchFiltersBar` | Region list | — | Navigation hooks | — | — | P2 |
| `/beoordelingen` | `CarePageTemplate` | `CareUnifiedHeader` | `CareSearchFiltersBar` | Queue rows | — | Row + detail flows | Detail vs list dual template | Accept until unified | P2 |
| `/plaatsingen` | `CarePageTemplate` (`PlacementTrackingPage`) | `CareUnifiedHeader` | `CareSearchFiltersBar` | List rows | — | Row → `PlacementPage` | Wrapper detail is separate surface | Document | P2 |
| Casus workspace `/care/cases/:id` | Workspace shell inside `main` | Workspace header context | Workspace-specific | Case execution UI | Context panel | `next-best-action` | — | Keep single NBA | P0 |

### Route alignment notes

#### `/signalen` — aligned

- Uses shared **`CareSearchFiltersBar`** with **`CareFilterTabGroup`** in the `tabs` slot (severity: Alles, Kritiek, Waarschuwing, Info).
- Uses **`CareWorkRow`** via **`SignalWorkRow`** (`data-care-work-row`, container **`signalen-worklist`**).
- **No `DominantActionPanel`** by design: Signalen is **multi-signal / multi-action** (each row carries its own navigations).
- Legacy **severity card grid** (three large tiles above the search stack) **removed**.

#### `/acties` — aligned

- Uses shared **`CareSearchFiltersBar`** with **`CareFilterTabGroup`** in the `tabs` slot (Alles, Te laat, Vandaag, Binnenkort).
- Uses **`CareWorkRow`** per open task; sections **Te laat** / **Vandaag** / **Binnenkort** remain as **group labels** over the worklist, not dashboard KPI tiles above filters.
- **No `DominantActionPanel`** by design: many tasks can be open in parallel; the actionable **next step** is **per row** (e.g. **Open casus**), not a single page-level banner.
- Legacy **three-column quick-filter card grid** above the search stack **removed**.

#### `/zorgaanbieders` — **intentional exception** (map / matching network)

This route stays **out of** the default **`CarePageTemplate` + `CareSearchFiltersBar` + `CareWorkRow`** stack **by design**, unless product later chooses to refactor.

**Current structure**

| Area | Implementation |
|------|----------------|
| Shell | Plain **`div`** column (`max-w`, gaps), **not** `CarePageTemplate`. |
| Header | Custom **`h1`** + subtitle + optional **`activeCaseContext`** line; **not** `CareUnifiedHeader` / **`care-unified-header`**. |
| Metrics | Inline “capaciteit / wachttijd / zichtbaar / Live” chips in the header card — **not** Regiekamer **`metric-strip`**. |
| Filters | **`data-testid="zorgaanbieders-filter-panel"`**: search **`Input`**, **Filters** toggle, collapsible region/type/capacity **`select`s**, **sort** dropdown, **split/full map** toggle — **not** `CareSearchFiltersBar` / **`care-search-control-stack`**. |
| Primary content | **`ProviderNetworkMap`** (split or full) + **provider cards** (`<article>` grid with match badges, reasoning block, **Selecteer** / **Bekijk profiel**) — **not** `CareWorkRow` / `data-care-work-row`. |

**Why divergence is justified**

- **Job-to-be-done** is **network + geography + advisory matching**, not a sequential casus **worklist**. Map–list **selection sync** and **sort modes** (best match, wachttijd, capaciteit, dichtbij) are first-class; stuffing them into `CareSearchFiltersBar` tabs/slots would either duplicate controls or bloat shared primitives.
- **`CareWorkRow`** is tuned for **case/task progression** (compact row, bounded CTAs). Provider rows need **richer cards** (capacity tone, specialization chips, reasoning line, map hover) — a different density contract.
- **Matching is advisory** (`AGENTS.md`); the page’s **Selecteer** flow is intentionally exploratory with **toast** feedback, not the same as gemeente validation gates elsewhere.

**Controlled boundaries (keep the exception “tight”)**

- **E2E**: `care-design-system.spec.ts` **excludes** this route from the shared **`CareSearchFiltersBar`** sweep and instead asserts **`zorgaanbieders-filter-panel`**, search placeholder, and **Filters** (`DESIGN_SYSTEM_TESTING.md`).
- **Do not** add a second duplicate filter bar for the same dataset.
- **Token discipline**: many **`slate-*` / `bg-white`** surfaces include **`dark:`** companions; avoid new **light-only** panels in **`care-app-main`** (design-system dark heuristic still applies).

**Smallest safe migration (when/if prioritized)**

- **Non-UI**: extend tests/docs only.  
- **Low-touch UI**: align search field with **accessible name** parity (`aria-label` / placeholder) and optional **`data-testid`** aligned with contract **without** replacing the whole panel.  
- **Larger refactor** (full `CareSearchFiltersBar` + row primitive): only with explicit product approval — risk of flattening map-first UX.

---

## 14. References

- `AGENTS.md` — canonical flow and UI mode enforcement.
- `client/tests/e2e/care-design-system.spec.ts` — automated checks for shell, Regiekamer, rows, dark theme.
- `client/src/components/design/DominantActionPanel.tsx` — shared dominant action primitive.

---

## 15. Migration backlog (this PR scope)

- **Done**: `DominantActionPanel` + Regiekamer adoption; disclosures default collapsed; contract doc; **`/signalen`** and **`/acties`** filter strips aligned (tabs + `CareSearchFiltersBar`; legacy card grids removed).
- **Later**: adopt `DominantActionPanel` on other routes only where product confirms a dominant NBA; migrate any remaining one-off attention stacks; extend audit table as routes evolve.
