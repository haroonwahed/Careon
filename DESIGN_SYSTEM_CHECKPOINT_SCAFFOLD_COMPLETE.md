# Design system checkpoint — CarePageScaffold rollout complete

**Date:** scaffold rollout closure (Regiekamer / `SystemAwarenessPage` migrated).

---

## Summary

All **care route shells** that previously mounted **`CarePageTemplate` directly** now compose **`CarePageScaffold`**, except where the product intentionally uses **non-template patterns** (for example map-heavy **Zorgaanbieders**, which never used `CarePageTemplate`; see **`CARE_SHELL_CONTRACT.md`** and **`PAGE_GENERATOR_PATTERN.md`**).

- **`DIRECT_CARE_PAGE_TEMPLATE_EXCEPTIONS`** in `client/src/test/carePageTemplateDirectUsageGuard.test.ts` is **empty**: no bypass list for direct template usage in route components.
- **`CareUnifiedPage.tsx`** continues to **define** `CarePageTemplate`; **`CarePageScaffold`** wraps it — this is expected.

---

## Regiekamer (`SystemAwarenessPage.tsx`)

Regiekamer migrated with **`archetype="decision"`**. The full **attention stack** (dominant panel, metric strip, insight `<details>`, regie-actie queue) stays in **one composite `dominantAction`** so **order and placement stay above** `CareSearchFiltersBar` and the worklist — insights were **not** moved to the scaffold `insights` slot.

---

## Verification (recorded at checkpoint)

| Suite | Result |
|-------|--------|
| Vitest (`npm run test -- --run` in `client/`) | **83 passed** |
| Playwright (`care-design-system.spec.ts` + `care-visual-regression.spec.ts`, `E2E_SPA_URL` against local SPA) | **20 passed** |

Re-run these commands after future changes that touch care shells or the guard.

---

## Next steps (optional)

- Stricter **lint** or a **codemod** to forbid `CarePageTemplate` imports outside allowed modules — **not required** for this rollout to be considered complete.
- Keep **`PAGE_GENERATOR_PATTERN.md`** as the human-facing rulebook; keep the **Vitest guard** as the automated gate.
