# Go-Live Readiness Matrix

Foundation reference:

- `docs/ZORG_OS_FOUNDATION_APPROACH.md`
- `docs/FOUNDATION_LOCK.md`

Readiness scoring in this matrix should be evaluated against the system-first workflow and backend source-of-truth rules defined there.

Aanbieder Beoordeling date: 2026-04-24

## How To Read This

- `100%` means the area is done to a level that does not block a live rollout.
- Scores below are estimated from the current repository state, docs, and the critical tests I ran on 2026-04-24.
- The overall score is a simple average of the areas below.

## Matrix

| Area | Current readiness | What is already in place | What still needs doing |
|---|---:|---|---|
| Core workflow and state flow | 82% | Canonical Zorg OS flow is documented, core routing exists, workflow services and decision layers are present | Finish the last workflow polish passes so the page/API behavior feels fully singular across the app |
| Matching and provider review | 84% | Matching architecture, provider profile model, explainability docs, matching services, and operational decision surfaces exist | Keep match recommendations visible in the live pages and finish the final provider feedback loop polish |
| Intake and placement gating | 80% | The repo contains models, tests, and docs for casus, samenvatting, matching, aanbieder beoordeling, plaatsing, and follow-up states | Keep intake blocked until acceptance and placement, and confirm all remaining entry points follow the canonical contract |
| Tenant isolation and permissions | 86% | Multi-tenant concepts, permissions code, scoped query helpers, and isolation tests exist | Keep 404/403 behavior consistent and verify no new entry points bypass the org boundary contract |
| UI shell, content, and Dutch terminology | 72% | Design specs, SPA shell, and terminology docs are present | Finish the last migration-era shell/content exceptions and keep the Dutch UX terminology consistent everywhere users see it |
| Governance, audit, and operational decision layer | 80% | Operational decision contract, governance modules, audit logging, and release validation checks exist | Make sure every important operational decision is reflected in live page behavior and remains audit-visible |
| Testing and regression reliability | 88% | The repo has a broad test surface covering workflow, permissions, matching, governance, and UI behavior, and the critical checks are currently green | Keep the release-critical suites green and broaden end-to-end coverage for the remaining product-completeness gaps |
| Deploy and ops readiness | 84% | Health checks, release checklist, rollback runbook, settings, and deployment docs exist | Complete the staging and production rollout evidence with actual timestamps and owner sign-off |

## Overall Score

Average readiness: **82%**

That means the app is past the prototype stage, but it is not yet at a safe go-live level.

## Main Go-Live Blockers

1. The remaining product work is polish, not foundational repair.
2. Some UI and workflow surfaces still carry migration-era or compatibility behavior.
3. Staging and production rollout evidence still needs to be captured against the current green build.
4. End-to-end product confidence can still be broadened beyond the current regression set.

## What Needs To Happen To Reach 100%

- All case, intake, matching, placement, and follow-up routes must continue to resolve and behave consistently.
- Tenant boundaries must continue to hold on every list/detail/update path.
- The UI must keep the canonical Dutch workflow labels and next-best actions in place.
- Matching and provider review must stay explainable and operational, not just documented.
- Audit and governance logging must remain observable in real flows.
- The critical test suite must stay green and aligned with the implemented routes and templates.
- Staging and production checks must pass the release checklist and record evidence cleanly.

## Practical Readiness Bands

- `0-49%`: not launchable
- `50-74%`: usable in parts, but still too risky for go-live
- `75-89%`: close, but needs final hardening and release evidence
- `90-100%`: go-live ready

At **82%**, this app is in the `close, but needs final hardening` band. The app is now materially release-shaped, but the rollout evidence still needs to be captured before sign-off.
