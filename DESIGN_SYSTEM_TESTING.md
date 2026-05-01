# Design system testing (Careon / Zorg OS SPA)

This document describes the Playwright **design system contract** suite for the authenticated React shell (`MultiTenantDemo` at `/?view=dashboard`). It complements `client/tests/e2e/care-visual-regression.spec.ts` (layout rhythm, focus, CTA fetch behaviour).

## Relationship to the Care Shell Contract

- **[`CARE_SHELL_CONTRACT.md`](./CARE_SHELL_CONTRACT.md)** defines the Care Shell **rules** (templates, tokens, layout contracts, Regiekamer modes, forbidden patterns).
- **This document** explains **how** those rules are **enforced** in automation: Playwright specs in `client/tests/e2e/care-design-system.spec.ts` and `client/tests/e2e/care-visual-regression.spec.ts`.
- **`DominantActionPanel`** (`client/src/components/design/DominantActionPanel.tsx`) is the current **reference primitive** for page-level next-best-action UI; routes such as Regiekamer compose it with copy, actions, and `data-*` hooks (see the contract for the full dominant-action rules).

## What the suite protects

- **App shell**: stable `data-testid` hooks on the outer shell, sidebar, top bar, and scrollable main area; exactly one `<main>` landmark.
- **Page headers**: presence of `CareUnifiedHeader` (`data-testid="care-unified-header"`) on migrated list pages; title + operational subtitle pattern.
- **Decision layer (Regiekamer)**: single dominant next-action panel (`data-testid="regiekamer-dominant-action"`, `data-regiekamer-mode` = `crisis` | `intervention` | `stable` | `optimization`), compact metric strip (`metric-strip`), disclosures **only** in `stable` / `optimization` (hidden in `crisis` / `intervention`), **no** competing `CareAttentionBar` rows above the fold.
- **Shared search / filters**: `CareSearchFiltersBar` contract (`care-search-control-stack`, `care-search-input` with `aria-label`, optional `care-more-filters-toggle` where the page enables secondary filters).
- **Operational rows**: `CareWorkRow` exposes `data-care-work-row`, status via `data-component="care-dominant-status"`, metadata via `data-component="care-meta-chip"`, and a bounded number of row-level buttons.
- **Casus workspace**: `next-best-action` and `case-context-panel` render after opening a stubbed casus from the werkvoorraad (the spec clicks the **row title**; the row CTA may route to another workflow screen instead of the workspace).
- **Dark theme smoke**: with `localStorage.careon-theme=dark`, `document.documentElement` has class `dark`, and the main column avoids light-only Tailwind fills: `bg-white`, `bg-gray-50` / `bg-gray-100`, or `bg-slate-50` **without** a `dark:` token on the same element (legacy panel leakage heuristic; elements that only use `hover:` light fills are skipped when any `dark:` variant exists on the node).
- **Light a11y**: sidebar contains a `<nav>`; bounded number of `h1` elements inside main (guards accidental heading sprawl).

## Canonical references

- **`/regiekamer`** — canonical operational shell (dominant action + metric strip + disclosures + shared filters + `CareWorkRow` list).
- **`/casussen`** — secondary reference for worklists, triage tabs, chips, and row CTAs.
- **`/matching`** — must stay aligned with the same `CarePageTemplate` / `CareSearchFiltersBar` / `CareWorkRow` family.

## Routes covered

Gemeente sidebar navigation in `care-design-system.spec.ts`:

| Route | Notes |
|-------|--------|
| `/regiekamer` | Dominant action, metric strip, disclosures, Meer filters |
| `/casussen` | Shared search bar + worklist |
| `/matching` | Shared search bar; rows optional if empty state |
| `/acties` | Shared search + task rows |
| `/signalen` | Shared search + summary chips; list rows use `CareWorkRow` (`signalen-worklist`) |
| `/zorgaanbieders` | **Intentionally not** `CareSearchFiltersBar` (map-centric layout). Suite asserts `zorgaanbieders-filter-panel`, search placeholder, and **Filters** — same tokenized slate surfaces as the rest of the care shell (`bg-white` / `bg-slate-50` always paired with `dark:` on the same node). |
| `/regios` | Shared search bar (no Meer filters on current page) |
| `/beoordelingen` (Wacht op aanbieder) | Operational list |
| `/plaatsingen` | Tabs inside shared search stack |
| Casus workspace | Opened from werkvoorraad CTA |

## How to run

1. Start the Vite client (default `http://127.0.0.1:3000`).
2. From `client/`:

```bash
E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-design-system.spec.ts
```

Optional: run together with visual regression:

```bash
E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-design-system.spec.ts tests/e2e/care-visual-regression.spec.ts
```

Shared API stubs live in `client/tests/e2e/helpers/careSpaApiStubs.ts` so list pages load without Django session.

## What a failure means

| Failure area | Likely cause |
|--------------|----------------|
| Missing `care-app-shell` / `care-sidebar` / `care-top-bar` / `care-app-main` | Layout refactor broke `MultiTenantDemo`, `Sidebar`, or `TopBar` wiring |
| Missing `care-search-control-stack` on a migrated list page | Page stopped using `CareSearchFiltersBar` or render is gated behind an error state |
| Missing `aria-label` on `care-search-input` | `CareSearchFiltersBar` `Input` lost accessible name |
| Row contract (status / chips / buttons) | `CareWorkRow` or child slots regressed; or list empty when stub expected data |
| `html` lacks `dark` | Theme bootstrap / `localStorage` key `careon-theme` not applied |
| Light-surface heuristic (`bg-white` / gray-50 / slate-50 without `dark:`) | New panel added without dark-mode token classes on the same element |
| Workspace `next-best-action` missing | `CaseExecutionPage` or decision-evaluation stub contract drift |

## Adding a new page to the suite

1. **Prefer gemeente routes** inside `MultiTenantDemo` so stubs in `installCareApiStubs` still apply; extend the helper with any new `GET /care/api/...` the page needs so it does not 401 to Django login.
2. Add a `{ nav, heading }` entry to the **shell** loop in `care-design-system.spec.ts` using the exact sidebar button label regex.
3. If the page is **list-heavy**, decide whether it must use `CareSearchFiltersBar`:
   - If yes, add it to the **shared search** test (or a new focused test) and ensure `searchPlaceholder` is meaningful (drives `aria-label`).
   - If no (e.g. map-first), document the exception in this file and add an explicit contract (placeholder + filter affordances) in the spec.
4. If rows should follow **CareWorkRow**, render through `CareWorkRow` so `data-care-work-row` and chip/status `data-component` attributes appear; optionally pass a stable `testId` for row-specific assertions.
5. Run the commands above until green.

## Known gaps / risks

- **Zorgaanbieders** keeps a dedicated map/filter panel (`data-testid="zorgaanbieders-filter-panel"`) instead of `CareSearchFiltersBar`; this is intentional; visual language stays slate tokens + explicit dark companions.
- **Dark surface check** remains heuristic (class string inspection on the DOM node, skipping any element whose `class` includes `dark:`), not pixel or snapshot testing — it will not catch wrong *computed* colors if classes are dynamic elsewhere.
- **Backend / API contracts** are not modified by production code; Playwright stubs in `careSpaApiStubs.ts` may need updates when API shapes change.
