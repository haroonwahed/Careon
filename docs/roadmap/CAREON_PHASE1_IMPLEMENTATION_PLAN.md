# CareOn — Phase 1 implementation plan (governance, verification & guardrails)

**Status:** Plan — **read-only / awaiting approval**. Nothing in this document has been executed.
**Date:** 2026-06-17
**Scope:** Phase 1 = the governance, verification, and guardrail items **only**. Explicitly excludes any `views.py` decomposition, domain-logic moves, component deletion, `CareCommandPrimitives` removal, `LoginPage` refactor, router relocation, page migration, API renames, or any product-behaviour change.
**Companions:** [`CAREON_STANDARDIZATION_ROADMAP.md`](CAREON_STANDARDIZATION_ROADMAP.md), [`../engineering/CAREON_ENGINEERING_STANDARDS.md`](../engineering/CAREON_ENGINEERING_STANDARDS.md), [`../design/CAREON_COMPONENT_REGISTER.md`](../design/CAREON_COMPONENT_REGISTER.md), [`../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md`](../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md).

---

## Guiding rules for Phase 1 (from the approved corrections)

- **Everything is additive or grandfathered.** No guard may turn CI red on day one for existing code. New guards ship with an **explicit allowlist of current known violations** and fail only on *new* violations.
- **Dependency direction & responsibilities are the real criteria** — not line counts. No hard LOC failure is introduced in Phase 1 (module-size stays a later, report-only concern).
- **No code moves, no deletions, no refactors.** Phase 1 builds the *fences*, not the *renovations*.
- The **views-package transition correction** (legacy.py + thin `__init__` + explicit re-exports + contract tests) is *only specified* here; the URL-contract test (item 4) is designed up-front to guard that future transition.

---

## Per-item plans

### Item 1 — `workflow_dispatch` for the relevant CI workflow

| Field | Detail |
|---|---|
| **Item** | Make Platform Guardrails (and UI Verification) manually/branch triggerable |
| **Goal** | Allow a verification run on any branch on demand, so the agent/human can gate work without opening a PR |
| **Exact files** | `.github/workflows/platform-guardrails.yml`, `.github/workflows/ui-verification.yml` |
| **Change type** | Additive YAML (`on: workflow_dispatch:` added alongside existing `pull_request`/`push`) |
| **Risk** | Very low (trigger only; no job logic change) |
| **Dependencies** | None |
| **Verification** | Trigger each workflow on a throwaway branch via the GitHub UI/API; confirm a run starts and passes unchanged |
| **Rollback** | Remove the `workflow_dispatch:` lines |
| **Product decision needed?** | No |
| **Exit criteria** | Both workflows runnable on demand on any branch; existing triggers/behaviour unchanged |

### Item 2 — Reliable Playwright smoke tests in CI

| Field | Detail |
|---|---|
| **Item** | A dedicated, deterministic Playwright smoke job |
| **Goal** | Run the existing golden-path/shell e2e specs reliably in CI on branch and PR |
| **Exact files** | New job in `.github/workflows/ui-verification.yml` (or a new `.github/workflows/e2e-smoke.yml`); reuses `client/playwright.config.ts`, `client/tests/e2e/{pilot-smoke,provider-review-smoke,staging-shell-smoke,zorg-os-golden-path}.spec.ts`, and existing orchestration scripts (`scripts/staging_v1_shell_smoke.sh`, the pilot `run_golden_path_e2e`/`run_full_pilot_rehearsal.sh --with-playwright` flow). A small seed step uses `contracts/management/commands/seed_redesign_data.py` |
| **Change type** | Additive CI job (+ possibly a thin `scripts/ci_e2e_smoke.sh` wrapper) |
| **Risk** | Medium — e2e flakiness; `playwright.config.ts` `webServer` only starts the **Vite SPA (:3000)**, so the job must **also** boot Django (`migrate` + `runserver :8010`) with seeded data and set `E2E_BASE_URL`/`E2E_SPA_URL`. This is the main reliability work |
| **Dependencies** | Item 1 (so it's branch-triggerable); Playwright browser install (`playwright install --with-deps`) |
| **Verification** | Job green ≥3 consecutive runs on a branch; flake rate measured; traces/screenshots retained on failure (already configured) |
| **Rollback** | Disable/remove the job; no app code touched |
| **Product decision needed?** | No |
| **Exit criteria** | Deterministic green smoke (login → casussen → case detail → provider review) on branch + PR, with a documented seed + dual-server startup; flake rate acceptable (e.g. <2%) |

### Item 3 — One official verification command/script

| Field | Detail |
|---|---|
| **Item** | A single canonical "verify" entry point |
| **Goal** | One documented command that runs the authoritative local/CI verification (pytest + guards + typecheck), so "is it green?" has one answer |
| **Exact files** | New `scripts/verify.sh` **and/or** a `verify:` target in `Makefile` (which already has `test`, `lint`, `typecheck`, `test-e2e`); it composes existing steps — `python -m pytest tests/ -q`, `python -m compileall config contracts`, `python scripts/terminology_guard.py`, `python -m pyright contracts config`, `npm --prefix client run typecheck`, and the new guards (items 4,5,7,8) |
| **Change type** | Additive wrapper (no new logic; calls existing tools) |
| **Risk** | Low |
| **Dependencies** | Items 4,5,7,8 (so the command includes them once they exist) |
| **Verification** | `make verify` / `scripts/verify.sh` runs locally and in CI and matches CI outcome; README/standards reference it |
| **Rollback** | Delete the script/target |
| **Product decision needed?** | No |
| **Exit criteria** | One command reproduces the CI gate; documented in `README.md` + engineering standards |

### Item 4 — URL-contract test (route + view-export surface)

| Field | Detail |
|---|---|
| **Item** | Test pinning the current URL + cross-module import surface |
| **Goal** | Guarantee every named route resolves and every externally-imported view symbol stays importable — the safety net that makes the **future** views-package transition safe |
| **Exact files** | New `tests/test_url_contract.py`; reads `config/urls.py` + `contracts/urls.py`; asserts the cross-module import surface documented in the backend audit (`_assign_provider_to_intake`, `_prepare_waitlist_proposal_for_intake`, `_build_matching_suggestions_for_intake`, `_provider_profile_match_surface`, `sync_case_flow_state`, `build_provider_response_monitor`, `build_provider_response_overview`) plus all `careon_views.*` attribute references |
| **Change type** | Additive test (characterizes current behaviour; pins it) |
| **Risk** | Low (read-only assertions over existing routing) |
| **Dependencies** | None |
| **Verification** | Test passes against current `main`; deliberately breaking a re-export/route locally makes it fail |
| **Rollback** | Delete the test |
| **Product decision needed?** | No |
| **Exit criteria** | Test green on `main`; covers (a) `reverse()`/`resolve()` round-trip for every named route, (b) importability of all listed cross-module symbols, (c) `careon_views` attribute presence for every URL handler. **Designed to guard the later `views/legacy.py` + thin `__init__` + explicit re-export transition** |

### Item 5 — Dependency-direction guard

| Field | Detail |
|---|---|
| **Item** | Guard: `contracts/api/` and `contracts/domain/` must not import `contracts.views` |
| **Goal** | Enforce one-way layering (target architecture) and prevent new inverted dependencies / import cycles |
| **Exact files** | New `tests/test_dependency_direction.py` **or** an added case in `tests/test_product_architecture_guardrails.py` (established home for static guards); scans `contracts/api/**` and `contracts/domain/**` for `from contracts.views` / `import contracts.views` |
| **Change type** | Additive test **with an explicit grandfather allowlist** |
| **Risk** | Low — **but note:** `contracts/api/matching.py` **currently** imports `_assign_provider_to_intake`, `_prepare_waitlist_proposal_for_intake` from `contracts.views`. The guard must ship with this **one known violation allowlisted** so CI stays green; it fails only on *new* violations. (Removing the allowlisted violation is the later A3 domain-seam work — out of Phase 1 scope.) |
| **Dependencies** | None |
| **Verification** | Test passes with allowlist on current `main`; adding a new `contracts.views` import in `api/` or `domain/` makes it fail; the allowlist entry is documented with a TODO pointing at A3 |
| **Rollback** | Delete the test |
| **Product decision needed?** | No |
| **Exit criteria** | Guard green on `main` via a documented, minimal allowlist (the single `api/matching.py` violation); any *new* upward import fails CI |

### Item 6 — Component register as formal source of truth

| Field | Detail |
|---|---|
| **Item** | Make the component register authoritative |
| **Goal** | One canonical list of shared components + statuses that PRs must respect |
| **Exact files** | `docs/design/CAREON_COMPONENT_REGISTER.md` (exists); reference it from `.github/PULL_REQUEST_TEMPLATE.md` and `docs/engineering/CAREON_ENGINEERING_STANDARDS.md`; optional `tests/test_component_register.py` asserting the file exists and parses (status labels present) |
| **Change type** | Additive (doc references + optional presence test) |
| **Risk** | Very low |
| **Dependencies** | None |
| **Verification** | PR template links the register; optional test green |
| **Rollback** | Revert the reference lines |
| **Product decision needed?** | No (designation is a process decision, not a product/behaviour change) |
| **Exit criteria** | Register cited as source of truth in PR template + standards; statuses are the reference for item 7 |

### Item 7 — Guard against new imports from Deprecated/Forbidden components

| Field | Detail |
|---|---|
| **Item** | Block *new* imports of Deprecated/Forbidden component files |
| **Goal** | Stop the shadow systems and dead code from spreading while they await removal |
| **Exact files** | New `scripts/check_component_register_imports.py` (follows the existing grep-based "Contract components guard" pattern already in `ui-verification.yml`); CI step in `.github/workflows/ui-verification.yml`. Scans `client/src/**` for imports of files marked Forbidden/Deprecated in the register (e.g. `CareCommandPrimitives`, the five orphan action panels, orphan `components/design/*`, dead legacy components) |
| **Change type** | Additive guard **with grandfather allowlist** of any current imports (e.g. `design/ProcessTimeline` is **Experimental, not Forbidden** → allowed; CareCommandPrimitives has 0 importers → safe to forbid new) |
| **Risk** | Low — must enumerate current importers and allowlist them so CI stays green; **no files are deleted** |
| **Dependencies** | Item 6 (register defines the lists) |
| **Verification** | Guard passes on `main` (with allowlist); adding a new import of a Forbidden/Deprecated file fails; static **and** dynamic import patterns (`import(...)`) are scanned |
| **Rollback** | Remove the CI step/script |
| **Product decision needed?** | No |
| **Exit criteria** | New imports of register-Forbidden/Deprecated files fail CI; existing imports grandfathered and listed; **deletion explicitly deferred** (see post-Phase-1) |

### Item 8 — Token governance for new/changed frontend code

| Field | Detail |
|---|---|
| **Item** | Make the design-token check enforce on changed FE code |
| **Goal** | Prevent new hardcoded colors/inline-style drift; require `--care-*` tokens |
| **Exact files** | `scripts/check_careon_design_tokens.py` (exists; `npm run check:careon-design`); add a **diff-scoped** CI step in `.github/workflows/ui-verification.yml` that runs it on changed `client/src` files |
| **Change type** | Additive CI step; **grandfather** existing offenders (notably `LoginPage.tsx`, and SVG phase colors in `SystemAwarenessPage.tsx`) via an allowlist |
| **Risk** | Low–medium — must scope to changed files / allowlist current offenders so CI stays green (no `LoginPage` refactor in Phase 1) |
| **Dependencies** | None |
| **Verification** | Adding a hex literal to a changed component fails the step; touching `LoginPage` does not retroactively fail unless new hex is added |
| **Rollback** | Remove the CI step |
| **Product decision needed?** | No |
| **Exit criteria** | New/changed FE code must be token-only to pass CI; existing offenders grandfathered with a tracked list |

### Item 9 — Definition of Ready (DoR)

| Field | Detail |
|---|---|
| **Item** | Adopt the DoR as governance |
| **Goal** | Every change starts with problem/role, archetype/layer, the three operational questions, workflow/permission impact, test approach, and any breaking-contract flag |
| **Exact files** | `.github/PULL_REQUEST_TEMPLATE.md` (DoR checklist section) + `docs/engineering/CAREON_ENGINEERING_STANDARDS.md` §1 (source) |
| **Change type** | Additive (process doc + template checklist) |
| **Risk** | Very low |
| **Dependencies** | None |
| **Verification** | New PRs render the DoR checklist; standards doc is the canonical definition |
| **Rollback** | Revert template section |
| **Product decision needed?** | No |
| **Exit criteria** | DoR checklist present in PR template and referenced from standards |

### Item 10 — Definition of Done (DoD)

| Field | Detail |
|---|---|
| **Item** | Adopt the DoD as governance |
| **Goal** | Consistent merge bar: green CI; no silent URL/view/context/API-shape change; barrel-only FE imports; tokens not hex; docs/register updated in-PR; tenant+workflow suites unchanged |
| **Exact files** | `.github/PULL_REQUEST_TEMPLATE.md` (DoD checklist) + `docs/engineering/CAREON_ENGINEERING_STANDARDS.md` §2 |
| **Change type** | Additive (process doc + template checklist) |
| **Risk** | Very low |
| **Dependencies** | Items 3,4,5,7,8 (the DoD references the canonical verify command + guards) |
| **Verification** | New PRs render the DoD checklist; the "green CI" line maps to item 3's command |
| **Rollback** | Revert template section |
| **Product decision needed?** | No |
| **Exit criteria** | DoD checklist in PR template; tied to the one official verification command |

---

## Recommended PR sequence

1. **PR-A — Item 1** (`workflow_dispatch`). Unblocks on-demand verification. *(additive)*
2. **PR-B — Item 4** (URL-contract test) + **Item 5** (dependency-direction guard, allowlisted). Backend safety net + layering fence. *(additive/grandfathered)*
3. **PR-C — Item 6** (register as SoT) + **Item 9/10** (DoR/DoD in PR template). Process foundation. *(additive)*
4. **PR-D — Item 7** (forbidden-import guard) + **Item 8** (token governance), both diff-scoped/allowlisted. FE fences. *(additive/grandfathered)*
5. **PR-E — Item 2** (Playwright smoke job). Highest-effort reliability work; lands after the cheap guards. *(additive)*
6. **PR-F — Item 3** (one official verify command). Last, so it can compose items 4,5,7,8. *(additive)*

## Parallelization

- **Parallel-safe:** PR-A, PR-B, PR-C, PR-D are independent (different files: CI YAML, `tests/`, docs/PR-template, `scripts/` + UI YAML).
- **Must follow:** PR-F (verify command) after PR-B/PR-D (it wraps their guards); PR-E may run in parallel but is the slowest to stabilize.
- DoD (item 10) text referencing the verify command should land or be updated with PR-F.

## CI runs required

- **Per PR:** Platform Guardrails (pytest incl. new URL-contract + dependency-direction tests), UI Verification (vitest, typecheck, + new forbidden-import + token steps), and (from PR-E) the Playwright smoke job. `deploy-production-check` and `security-scans` unchanged.
- **On demand:** the same workflows via `workflow_dispatch` (PR-A).

## Fully additive changes (no existing behaviour touched)

Items **1, 3, 4, 6, 9, 10** are purely additive. Items **5, 7, 8** are additive in code but ship with **grandfather allowlists** so they do not fail CI on existing violations. Item **2** is a new CI job (additive) but carries reliability risk, not behaviour risk.

## Explicitly remains AFTER Phase 1 (not in this plan)

- `views.py` decomposition — including the corrected transition: `contracts/views/legacy.py` holds the current implementation, `contracts/views/__init__.py` stays thin with **explicit** re-exports of all public/semi-public symbols, guarded by the item-4 contract test (A2/A3).
- Moving domain logic (geo/matching/scoring/case_flow) and removing the item-5 allowlisted `api/matching.py → views` violation (A3).
- **Module-size check** — later, and only **report/warn**, with existing large modules **grandfathered**; never a standalone hard failure.
- **Dead-code removal** — only after a component clears a full check for: static imports, dynamic imports, registries, routes, tests, stories, string references, and runtime usage. Phase 1 *guards* against new usage but deletes nothing.
- `CareCommandPrimitives` removal, `LoginPage` token refactor, router relocation, page migration, API renames (cases `contracts`→`cases`, endpoint de-dup), Cliënten page — all later and several **require explicit product approval**.
- **Golden references:** `WorkloadPage.tsx` and `CaseExecutionPage.tsx` remain **candidate** references. Before sealing, define their functional, UX, responsive, and accessibility **exit criteria** (a later governance task, not Phase 1).

---

## Approval gate

No item above will be implemented until this Phase 1 plan is approved. On approval, execution proceeds in the PR sequence, each PR green (via the one official verification command) before the next.
