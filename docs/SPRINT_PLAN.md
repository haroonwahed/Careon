# Sprint Plan

Aanbieder Beoordeling date: 2026-04-24

Current readiness baseline after Sprint 1: **76%**

This plan divides the remaining go-live work into delivery sprints. The percentages below are estimates of the **total go-live scope**, not just the remaining 38%.

If a sprint is completed in order, the cumulative readiness becomes:

`current readiness + sprint share of total work`

## Sprint 1: Trust Boundaries

Share of total go-live work: **14%**

Status: **Completed on 2026-04-24**

Focus:
- tenant isolation
- permissions consistency
- org-scoped list/detail/update behavior
- 404/403 contract alignment

If completed: **76%** readiness

Why first:
- This is the highest-trust blocker.
- A boundary leak is a launch blocker regardless of UI polish.

## Sprint 2: Workflow Contracts

Share of total go-live work: **12%**

Focus:
- aanbieder beoordeling decision endpoints
- matching action endpoints
- placement detail endpoints
- intake creation linking
- canonical route aliases

If completed: **88%** readiness

Why second:
- The app cannot go live if the main workflow chain still depends on missing or renamed routes.
- This sprint makes the operational flow executable, not just documented.

## Sprint 3: Operational UX

Share of total go-live work: **6%**

Focus:
- dashboard content
- matching content
- shell parity
- Dutch-first labels and copy
- next-best-action visibility

If completed: **94%** readiness

Why third:
- This is where the app becomes usable as a workflow product instead of a set of technical pages.
- It closes the gap between correct behavior and correct user experience.

## Sprint 4: Governance, Regression, and Release

Share of total go-live work: **6%**

Focus:
- audit and decision logging
- regression suite alignment
- staging validation
- rollback confidence
- release checklist evidence

If completed: **100%** readiness

Why last:
- The business flow must be stable before final release hardening.
- This sprint turns the app from “works in parts” into “safe to ship”.

## Summary Table

| Sprint | Share of total go-live work | Cumulative readiness if completed |
|---|---:|---:|
| Sprint 1: Trust Boundaries | 14% | 76% |
| Sprint 2: Workflow Contracts | 12% | 88% |
| Sprint 3: Operational UX | 6% | 94% |
| Sprint 4: Governance, Regression, and Release | 6% | 100% |

## Notes

- These percentages are intentionally conservative and should be adjusted if scope changes.
- The readiness numbers assume the sprints are completed in order.
- If a sprint is only partially completed, use the share as a rough progress estimate, not a release verdict.
