# Go-Live Plan

Foundation reference:

- `docs/ZORG_OS_FOUNDATION_APPROACH.md`
- `docs/FOUNDATION_LOCK.md`

This go-live plan assumes and enforces the system-first workflow and backend source-of-truth constraints from these documents.

Aanbieder Beoordeling date: 2026-04-24

This plan turns the go-live matrix into a practical release order. It is based on the current repository state, the release docs, and the release validation runs from 2026-04-24.

For a sprint-sized breakdown of the same work, see [`docs/SPRINT_PLAN.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/SPRINT_PLAN.md).

## Priority Order

### 1. Keep tenant isolation locked down

Why this is first:
- A cross-tenant leak would still be a launch blocker if it reappeared.
- It is a correctness and trust issue, not a cosmetic issue.
- The isolation layer is now green and must stay that way.

What to fix:
- list, detail, and update paths that could drift back to `200` where `404` or `403` is expected
- ownership/role checks on case, intake, placement, signal, task, document, and budget routes
- any shared queryset helpers that could bypass the active organization boundary

### 2. Preserve the canonical workflow route/API surface

Why this is second:
- The canonical flow is now wired again and should stay stable.
- Route drift here would fragment the product contract immediately.

What to fix:
- matching action endpoints
- aanbieder beoordeling decision endpoints
- placement detail endpoints
- any API name that could drift away from the route contract used by the tests and templates

### 3. Keep casus -> samenvatting -> matching -> aanbieder beoordeling -> plaatsing -> intake flow intact

Why this is third:
- The product promise depends on the flow staying operational, not just documented.
- The chain is now wired, but it still needs to remain coherent under future changes.

What to fix:
- ensure intake can create or link the case record correctly
- ensure samenvatting readiness feeds the matching surface
- ensure placement is only available after provider acceptance
- ensure follow-up states do not appear too early

### 4. Keep dashboard and matching pages aligned with the operational contract

Why this is fourth:
- The shell and content are now aligned, but they still need to stay aligned.
- Several UI tests expect live labels, CTA text, and state summaries.

What to fix:
- dashboard hero and action blocks
- matching page content and labels
- accessibility attributes used by the test suite
- canonical Dutch terminology in user-facing text

### 5. Keep the operational decision contract visible in live pages

Why this is fifth:
- The decision layer is now reflected in the live pages.
- It should continue to drive next-best action and audit behavior.

What to fix:
- recommended actions
- impact summaries
- attention bands
- bottleneck reasons
- decision logging when match recommendations are generated or acted on

### 6. Keep the critical regression tests green

Why this is sixth:
- The test suite is the best proxy for release confidence.
- The current critical set is green and should stay aligned with the contract.

What to fix:
- update tests only where the contract intentionally changes
- otherwise restore behavior so the tests pass as written
- keep route names, labels, and flow assumptions aligned

### 7. Keep placement and intake gating strict

Why this is seventh:
- The business rules depend on the order of acceptance, placement, and intake.
- Early intake or premature placement would violate the canonical flow.

What to fix:
- block intake before provider acceptance and placement
- block placement for rejected or unreviewed requests
- ensure accepted cases transition cleanly

### 8. Keep audit and governance logging complete

Why this is eighth:
- The app needs traceability for operational decisions.
- If a flow changes, the audit trail should show it.

What to fix:
- match recommendation logs
- decision events
- SLA transitions
- signal creation and state changes

### 9. Keep the UI and terminology Dutch-first

Why this is ninth:
- The product is Dutch-facing and workflow-native.
- Terminology drift creates confusion and weakens trust.

What to fix:
- replace leftover English-facing product labels where Dutch canonical terms exist
- align page titles, button labels, and helper copy
- keep legacy technical names out of user-facing screens

### 10. Run staging and production checks from the release checklist

Why this is tenth:
- A green test suite is necessary but not sufficient.
- The app still needs deployment verification, health checks, and rollback evidence.

What to fix:
- staging smoke tests
- production check commands
- migration and collectstatic behavior
- rollback readiness and evidence capture

## Delivery Sequence

1. Keep isolation and permissions locked down.
2. Preserve the canonical route/API surface.
3. Keep the workflow chain intact.
4. Keep dashboard and matching UI aligned.
5. Keep the operational decision layer visible.
6. Keep the critical regression suite green.
7. Keep gating and audit behavior strict.
8. Run the release checklist on staging.
9. Run the release checklist on production.
10. Record release evidence and sign off.

## Sub-Scores

These are directional sub-scores from the current state:

| Area | Readiness |
|---|---:|
| Frontend UI and content | 72% |
| Backend workflow and routing | 82% |
| Security and tenant isolation | 86% |
| Governance and audit | 80% |
| Testing and regression stability | 88% |
| Deployment and ops | 84% |

## What Would Move The Score Fastest

If you want the quickest route toward go-live, the highest leverage work is:

1. Release evidence capture on staging and production
2. Keep tenant isolation and permissions locked down
3. Preserve workflow route/API consistency
4. Keep dashboard and matching content aligned
5. Keep the critical tests green

## Go-Live Gate

Do not consider this app production-ready until:

- cross-tenant access remains blocked consistently
- core workflow routes continue to resolve correctly
- canonical flow remains enforced in code, not just docs
- dashboard and matching pages continue to show the expected operational content
- critical regression tests stay green
- staging and production checks pass cleanly with recorded evidence
