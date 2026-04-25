# Sprint 1 Plan: Trust Boundaries

Aanbieder Beoordeling date: 2026-04-24

Baseline readiness before this sprint: **62%**

Estimated total go-live impact of this sprint: **14%**

If sprint 1 is completed, readiness should move to roughly **76%**.

## Goal

Close the tenant-boundary gaps so list, detail, update, and API routes never expose another organization’s data and never fall back to broad queries when an organization context is missing.

## Task Breakdown

### Task 1: Harden shared tenant scoping

What to do:
- make the shared queryset helper return `none()` when there is no organization
- let it use model/queryset `for_organization()` methods when available
- add a scoped object lookup helper for detail-style routes

Expected impact:
- lower the risk of accidental broad reads
- reduce repeated scoping code across the app

### Task 2: Normalize placement scoping

What to do:
- give `PlacementRequest` a proper org-aware queryset/manager
- switch placement list/detail/update views to the shared org-scoped path
- use the same org-scoped path in placement-related APIs

Expected impact:
- placement routes behave like the other tenant-scoped models
- fewer hand-rolled filters in the workflow layer

### Task 3: Add tenant regression coverage

What to do:
- verify the shared helper returns empty results without an organization
- verify manager-scoped models still scope correctly through the helper
- verify scoped object lookup returns 404 when the case belongs to another org

Expected impact:
- protects the tenant boundary behavior from future regressions

## Exit Criteria

Sprint 1 is done when:
- helper-level scoping is defensive by default
- placement routes use the org-scoped path consistently
- tenant isolation tests pass
- there is no route that relies on an unscoped fallback for authenticated access

## Notes

- This sprint is intentionally narrow.
- It should improve security posture before the remaining workflow and UX work continues.
