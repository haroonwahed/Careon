# Design system checkpoint — `6e31c2a`

**Commit:** `6e31c2a`

## What was stabilized

- Care Shell contract documentation (`CARE_SHELL_CONTRACT.md`) and cross-reference from `DESIGN_SYSTEM_TESTING.md`.
- Shared **DominantActionPanel** on Regiekamer; E2E stubs (path normalization for `/care/api/*`) and timing/selector fixes so suites stay green against the SPA.
- Design-system and visual-regression Playwright specs aligned with the Care Shell contract (no weakening of intent; Casussen mobile overflow targets the trailing chip strip structurally).

## Pages aligned (shared list / filter patterns)

- **`/signalen`** — `CareSearchFiltersBar` + severity tabs; `CareWorkRow` via `SignalWorkRow`; legacy severity card grid removed.
- **`/acties`** — `CareSearchFiltersBar` + status tabs; `CareWorkRow`; legacy three-column quick-filter cards removed.

(Regiekamer and related surfaces were part of the same stabilization commit: dominant action panel, metric strip, disclosures, shared search stack.)

## Controlled exception: `/zorgaanbieders`

Documented in **`CARE_SHELL_CONTRACT.md`** as an **intentional exception**: map-first / matching network view uses `zorgaanbieders-filter-panel`, provider cards, and `ProviderNetworkMap`—not the default `CarePageTemplate` + `CareSearchFiltersBar` + `CareWorkRow` stack. Bounds (E2E expectations, no duplicate filter bars, token/dark notes) are spelled out there.

## Playwright results (this checkpoint)

| Suite | Result |
|--------|--------|
| `tests/e2e/care-design-system.spec.ts` | **11 passed** |
| `tests/e2e/care-visual-regression.spec.ts` | **9 passed** |

## Required local E2E setup

Bind Vite to IPv4 so `E2E_SPA_URL=http://127.0.0.1:3000` matches the server:

```bash
cd client
npm run dev -- --port 3000 --strictPort --host 127.0.0.1
```

Then:

```bash
cd client
E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-design-system.spec.ts
E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-visual-regression.spec.ts
```

## Next recommended step (not implemented here)

**Page Generator Pattern** — a single composable scaffold (template, header, filters, list, stable hooks) so new care pages default to the contract. Deferred until explicitly picked up.
