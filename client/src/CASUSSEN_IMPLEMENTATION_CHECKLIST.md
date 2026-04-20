# Casussen Implementation Status

Last updated: 2026-04-20

## Scope

This checklist tracks the implementation state of the Casussen and related workflow surfaces after the matching-to-provider-beoordeling refactor.

## What Is Done

### Workflow and Routing

- [x] Casus creation flows route into the case-centric shell.
- [x] Matching assignment API is wired for SPA usage.
- [x] Assignment now transitions case phase to `provider_beoordeling`.
- [x] Provider response handoff semantics are reflected in UI copy and flow.
- [x] Placement pages are aligned to post-provider-acceptance semantics.

### Frontend Surfaces

- [x] Casussen list and workflow pages updated.
- [x] Matching page and wrapper integrated with new handoff behavior.
- [x] New assessment decision surface implemented.
- [x] New matching decision engine surface implemented.
- [x] Sidebar and navigation links aligned with current pages.

### Backend and Data Model

- [x] API endpoints for matching and assessment decision wired.
- [x] Urgency validation and arrangement fields added (migration 0048).
- [x] Provider beoordelingsfase introduced (migration 0049).
- [x] Waitlist prioritization helper introduced in `contracts/waitlist.py`.

### Validation

- [x] Client build passes.
- [x] `manage.py check` passes in project venv.
- [x] Targeted integration tests for intake/assessment/matching and operational contract flows pass.

## What Still Needs Doing

### Release Hardening

- [ ] Run full backend regression suite, not only targeted tests.
- [ ] Add frontend integration tests for new decision and handoff pages.
- [ ] Add/verify pagination ordering for signals endpoints to remove unordered pagination risk.

### Product and UX Follow-ups

- [ ] Complete inline drawer embedding for signal/document/task create-edit flows in case detail shell.
- [ ] Refine geo source model with explicit provider/case coordinates when schema support is introduced.

### Operations

- [ ] Standardize on a stable Python runtime (3.11/3.12) for reproducible dependency installs.
- [ ] Verify migration rollout and smoke checks in rehearsal/production environments.

## Current Readiness

### Overall

- **Status:** Feature-complete for the current refactor scope, with remaining hardening tasks.
- **Confidence:** High for targeted workflow paths, medium for full-system regression until full-suite validation is complete.

### Recommended Next Milestone

- Complete release hardening items and capture a formal release signoff for rollout.
