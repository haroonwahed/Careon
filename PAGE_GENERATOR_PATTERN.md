# Page Generator Pattern (Care Shell)

Composable scaffold for authenticated Care SPA routes so new pages **assemble** the approved shell instead of reinventing layout.

**Implementation:** `client/src/components/care/CarePageScaffold.tsx`  
**Normative rules:** `CARE_SHELL_CONTRACT.md`  
**E2E:** `DESIGN_SYSTEM_TESTING.md`, `client/tests/e2e/care-design-system.spec.ts`  
**Direct-template guard:** `client/src/test/carePageTemplateDirectUsageGuard.test.ts`

---

## Enforcement

- **New care pages should use `CarePageScaffold` by default** (compose header / filters / body slots; keep domain logic in the route).
- **Direct `CarePageTemplate` usage in `client/src/components/care/*.tsx` requires a documented exception** with a one-line reason in `DIRECT_CARE_PAGE_TEMPLATE_EXCEPTIONS` inside `client/src/test/carePageTemplateDirectUsageGuard.test.ts`, until that route is migrated.

Pages that **never** use `CarePageTemplate` (e.g. map-heavy **`Zorgaanbieders`**) are not guard violations; they stay **controlled exceptions** under `CARE_SHELL_CONTRACT.md`.

---

## Purpose

- One **obvious** way to order: header → optional attention → filters → content → optional insights.
- **Stable `data-testid` / `data-*` hooks** for design-system and product tests.
- **Archetype** label for documentation and analytics (`data-care-page-archetype`), not hidden routing logic.

---

## When to use it

- New or refactored **gemeente** (or shared) care routes that live inside **`MultiTenantDemo`** chrome and follow the standard list/decision layout.
- When you need **CareUnifiedHeader** + optional **DominantActionPanel** + optional KPI strip + **CareSearchFiltersBar** + body.

---

## When not to use it

- **Case workspace** (`CaseExecutionPage`, `/care/cases/:id`) — different NBA + context contract.
- **Controlled exceptions** documented in `CARE_SHELL_CONTRACT.md` (e.g. **`/zorgaanbieders`** map/network page) — keep their bespoke layout until product chooses to unify.
- **Fullscreen or non–care-shell** experiences.

---

## Allowed page archetypes

| Archetype | `data-care-page-archetype` | Typical use |
|-----------|----------------------------|-------------|
| **1. Decision page** | `decision` | Single dominant operational choice + metrics + worklist (e.g. **Regiekamer**). |
| **2. Worklist page** | `worklist` | Header + search + primary list rows (e.g. **Casussen**). |
| **3. Signal / action page** | `signal-action` | Filters/tabs + many row-level actions (e.g. **Signalen**, **Acties**). |
| **4. Controlled exception page** | `exception` | Documented deviation from shared bar/row stack (only if you still wrap for test ids — **Zorgaanbieders** usually **does not** use this scaffold). |

Archetype does **not** change behavior inside `CarePageScaffold`; it encodes intent for tests and tooling.

---

## Required composition order

1. **Header** — `CareUnifiedHeader` (inside `care-page-header`); optional **eyebrow** above; optional **`metric`** slot under subtitle.
2. **Optional dominant action** — e.g. `DominantActionPanel` (page-level NBA).
3. **Optional KPI strip** — e.g. Regiekamer compact `metric-strip` (block below dominant, above filters).
4. **Optional search / filter** — e.g. `CareSearchFiltersBar` (`care-search-control-stack`).
5. **Content / list** — `care-page-content`; rows, empty states, loading.
6. **Optional insights / disclosures** — `care-page-insights` (`<details>`, explainers).

This mirrors **`CarePageTemplate`**: `header` → `attention` (dominant + KPI) → `filters` → `children` (+ insights as extra children with spacing from `CARE_UNIFIED_PAGE_STACK`).

---

## Required test hooks

| Hook | Role |
|------|------|
| `care-page-scaffold` | Root wrapper (default); override via `testId` if a page needs a second scaffold (rare). |
| `data-care-page-archetype` | One of `decision` \| `worklist` \| `signal-action` \| `exception`. |
| `care-page-header` | Wraps eyebrow + **`care-unified-header`**. |
| `care-unified-header` | Still rendered by `CareUnifiedHeader` (existing contract). |
| `care-page-content` | Main body. |
| `care-page-insights` | Present only when `insights` prop is set. |

Existing route hooks (e.g. `care-search-control-stack`, `metric-strip`, row `data-care-work-row`) stay on the **slots** you pass in.

---

## Copy rules

- **Dutch-first**, operational clarity (`AGENTS.md`).
- **No Regiekamer-specific strings** inside shared primitives like `DominantActionPanel` — copy lives in the route.
- **Eyebrow**: short, uppercase tracking optional; use sparingly.

---

## CTA rules

- **One primary** page-level CTA when using `dominantAction` (NBA panel).
- **Row-level** CTAs stay bounded (`CareWorkRow` contract); no duplicate primary banners (`care-attention-bar` discipline for Regiekamer).

---

## Examples (reference routes)

| Route | Archetype | Notes |
|-------|-----------|--------|
| **Regiekamer** | `decision` | `DominantActionPanel` + compact metric strip + search + worklist; insights in stable/optimization. *(Not migrated to scaffold in generator v1 — reference only.)* |
| **Casussen** | `worklist` | Header metric badge + tabs + search + `CareWorkRow`. |
| **Signalen** | `signal-action` | Tabs + search + `SignalWorkRow`. |
| **Acties** | `signal-action` | Uses **`CarePageScaffold`** (with **Casussen** / `WorkloadPage`). |
| **Zorgaanbieders** | `exception` | Map + cards + `zorgaanbieders-filter-panel`; **do not** force this scaffold until product approves. |

---

## Changelog

- **Generator v1:** `CarePageScaffold` + `PAGE_GENERATOR_PATTERN.md` + **Acties** adoption + Vitest contract tests.
- **Generator v1.1:** **Casussen** (`WorkloadPage`) on scaffold + Vitest guard for direct `CarePageTemplate` usage (allowlisted legacy routes only).
