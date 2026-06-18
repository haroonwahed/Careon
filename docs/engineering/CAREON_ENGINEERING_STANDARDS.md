# CareOn — engineering & product standards

**Status:** Proposed standard — **read-only**. No code, tests, workflows, or config changed.
**Date:** 2026-06-17
**Scope:** Part 6 of the audit brief. Codifies the working standards implied by the current (strong) practices, plus the gaps this audit found. Where a standard names a guardrail or CI step, that is a **proposal to adopt**, not an executed change.

> Grounded in observed practice: 93 pytest modules, 13 Playwright specs, 6 CI workflows (`platform-guardrails`, `pilot-rehearsal`, `staging-http-smoke`, `staging-pilot-signoff`, `ui-verification`, `render-deploy-hook`), pre-commit, pyright, terminology guard, tenant-integrity audit, a design-token check script, and an existing ADR folder.

---

## 1. Definition of Ready (DoR)

A change is ready to start when: the problem and user/role are stated; the affected **archetype** (frontend) or **layer** (backend) is identified; acceptance criteria and the **three operational questions** (what needs attention / why blocked / next best action) are answered for any user-facing surface; workflow/tenant/permission impact is named; test approach is sketched; and any **breaking contract change** (API key, URL, status semantics) is flagged for product approval.

## 2. Definition of Done (DoD)

- Code + tests landed; **pytest + Playwright + Platform Guardrails green**; `compileall` clean; pyright clean; terminology guard + tenant-integrity audit pass.
- No change to URLs, view names, template context keys, or API response shapes unless explicitly approved and versioned.
- Frontend: imports shared UI only via the `CareDesignPrimitives` barrel; no new parallel primitive; tokens not hex; component register updated if a shared component changed.
- Docs updated in the **same PR** (ADR/roadmap/register/source-of-truth doc).
- For workflow-touching changes: `test_cross_tenant_isolation` + `test_workflow_foundation_lock` unchanged and passing.

## 3. Branch & PR strategy

- Trunk-based on `main`; short-lived `feat/*`, `fix/*`, `refactor/*` branches; small reviewable PRs (refactors are move-dominated diffs).
- One concern per PR; behaviour-neutral refactors labelled as such and verified by unchanged tests.
- **Clean up stale branches/worktrees** — the repo currently carries `worktree-agent-*` (with a broken git-worktree registration) and several `copilot/*` branches; large refactors should sequence to minimize conflict with these.
- PR description states: archetype/layer, contract impact, test evidence, and rollback note.

## 4. Code-review rules

- At least the workflow/tenant gates, permission checks, and API response shapes are reviewed for behaviour preservation.
- Reviewer confirms: no upward-layer import (`domain`/`api` must not import `views`); no Deprecated/Forbidden component import; no new hex where a token exists; no silent contract change.
- Use the `engineering:code-review` skill conventions (security, N+1, edge cases, error handling).

## 5. Test strategy

- **Backend unit:** pure domain logic (`contracts/domain/*` once extracted) — geo/scoring/flow — tested without the HTTP layer.
- **Backend integration:** Django test client over `/care/api/*` and server pages; tenant isolation and workflow gates are first-class suites.
- **Contract tests (add):** (a) a **URL-contract test** asserting every named route in `config/urls.py`/`contracts/urls.py` resolves and `reverse` round-trips; (b) **API response-shape tests** pinning payload keys for the SPA's endpoints (guards against accidental shape drift like the `contracts` key); (c) characterization tests for cross-layer helpers before they move.
- **Frontend unit:** Vitest for component logic.
- **E2E:** Playwright specs for golden paths (login, provider review, golden-path, staging shell) — already present; extend to cover each archetype's golden reference.
- **Visual regression:** `care-visual-regression.spec.ts` exists; make it a gating CI job.
- **Accessibility:** **gap today** — add automated a11y checks (e.g. axe in Playwright) to CI; target WCAG 2.1 AA per the existing `design:accessibility-review` intent.
- **Typechecking:** pyright (backend) + `tsc --noEmit` (frontend) in CI.

## 6. Design-token governance

- `--care-*` CSS custom properties in `globals.css` are the single source of truth; `design/tokens.ts` mirrors layout values; `lib/operationalRhythm.ts` owns vertical rhythm.
- **No hardcoded colors** in components; the existing `scripts/check_careon_design_tokens.py` (`npm run check:careon-design`) is the enforcement hook — make it CI-blocking.
- New visual constants (e.g. map phase colors) are added as **named tokens**, not inline hex.
- Refactor known offenders (`LoginPage.tsx`) onto tokens.

## 7. Component governance

- The **component register** ([`../design/CAREON_COMPONENT_REGISTER.md`](../design/CAREON_COMPONENT_REGISTER.md)) is authoritative. Every shared component has a status: Approved / Experimental / Needs consolidation / Deprecated / Forbidden.
- **Rules:** import shared UI only through the `CareDesignPrimitives` barrel; do not create a second implementation of an Approved primitive; do not import Deprecated/Forbidden files (propose a blocking lint rule); adding a shared component requires a register entry in the same PR.
- Consolidation targets (metric/KPI, page-shell, detail-layout, level-badges, shadow systems) are tracked in the roadmap FE workstream.

## 8. Rules for new pages

A new page must: (1) declare one of the five **archetypes**; (2) compose only Approved primitives via the barrel; (3) match the relevant **golden reference** (`WorkloadPage` for A2, `CaseExecutionPage` for A3); (4) answer the three operational questions on the surface; (5) provide empty/loading/error states via canonical primitives; (6) be token-only; (7) add JSON contract tests for any new endpoint it consumes. Deviations from the archetype must be named and approved.

## 9. ADR / product-decision / design-decision process

- **ADR** (`docs/adr/ADR-*.md`) for architecture/technology/structure decisions — context, options, trade-offs, consequences, action items (template already in use).
- **Product decision** log (`DECISIONS.md`) for scope/workflow/policy decisions — especially the **breaking-contract decisions** flagged in the target architecture (cases `contracts`→`cases` key, endpoint de-dup, retiring vestigial CBVs, Cliënten page, router relocation).
- **Design decision:** changes to the UI contract, tokens, archetypes, or the component register's Approved set are recorded against `CAREON_UI_CONTRACT.md` + the register.
- Each decision links to the source-of-truth doc it updates; thin pointer files stay thin.

## 10. CI guardrails (current + proposed)

**Current (keep):** Platform Guardrails (pytest 3.12, compileall, terminology guard, tenant-integrity audit, Postgres deploy-check), pilot-rehearsal, staging smokes, ui-verification, pre-commit.

**Proposed additions (do not execute yet — see roadmap R1/R2):**
1. `workflow_dispatch` on `platform-guardrails.yml` so a branch run is triggerable on demand (closes the agent verification loop via the GitHub connector).
2. Playwright + visual-regression + a11y jobs gating on branch.
3. Backend **layer-direction** test (`domain`/`api` must not import `views`) and **module-size ceiling** test.
4. Frontend **forbidden-import lint** (block Deprecated/Forbidden component files) and make the **design-token check** CI-blocking.
5. Containerized dev/test env (`.devcontainer` + `docker compose`) pinning Python 3.12 and the full dependency set, so verification is reproducible on any host (the current sandbox cannot run a trustworthy Python/Playwright baseline — see backend audit §8).

These standards are sequenced for adoption in [`../roadmap/CAREON_STANDARDIZATION_ROADMAP.md`](../roadmap/CAREON_STANDARDIZATION_ROADMAP.md).
