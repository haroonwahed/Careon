# FOUNDATION LOCK

Primary reference: see docs/ZORG_OS_FOUNDATION_APPROACH.md for the system-first foundation approach.

## Canonical Workflow

Casus -> Samenvatting -> Matching -> Aanbieder Beoordeling -> Plaatsing -> Intake

The backend is the source of truth for transitions and actor ownership.

## Canonical States

- DRAFT_CASE
- SUMMARY_READY
- MATCHING_READY
- PROVIDER_REVIEW_PENDING
- PROVIDER_ACCEPTED
- PROVIDER_REJECTED
- PLACEMENT_CONFIRMED
- INTAKE_STARTED
- ARCHIVED

## Actor Ownership

- gemeente
  - create_case
  - complete_summary
  - start_matching
  - send_to_provider
  - confirm_placement
  - archive_case
  - rematch
- zorgaanbieder
  - provider_accept
  - provider_reject
  - provider_request_info
  - start_intake
- admin
  - all actions

## Enforced Mutation Endpoints

- `/care/api/cases/intake-create/`
- `/care/api/cases/<id>/assessment-decision/`
- `/care/api/cases/<id>/matching/action/`
- `/care/api/cases/<id>/provider-decision/`
- `/care/api/cases/<id>/placement-action/`
- `/care/api/cases/<id>/intake-action/`
- `/care/casussen/<id>/matching/action/`
- `/care/casussen/<id>/provider-response/action/`
- `/care/casussen/<id>/outcomes/action/`
- `/care/casussen/<id>/placement/action/`
- `/care/casussen/<id>/archive/`

## Audit Requirements

Every valid transition writes append-only evidence in `CaseDecisionLog` using event type `STATE_TRANSITION` with:

- case id
- actor user id
- actor role
- old state
- new state
- action
- source endpoint
- optional reason/note

## Hard Guards

- No provider review bypass from matching directly to placement.
- No placement confirmation before provider acceptance.
- No intake start before placement confirmation.
- No archive before intake started/completed.

## Decision Engine

The backend decision engine is the single source for operational guidance on a casus. It powers regiekamer alerts, page banners, CTA visibility, blocked action reasons, and future matching intelligence.

### Purpose

- Evaluate the current state of a casus.
- Return blockers, risks, alerts, next-best-action guidance, allowed actions, blocked actions, and explanation context.
- Keep decision authority in the backend so the frontend only renders the result.

### Output Shape

`evaluate_case(case, actor=None, actor_role=None) -> dict`

The payload is JSON-serializable and includes:

- `case_id`
- `current_state`
- `phase`
- `next_best_action`
- `blockers`
- `risks`
- `alerts`
- `allowed_actions`
- `blocked_actions`
- `decision_context`
- `timeline_signals`

### Blocker Rules

- `MISSING_REQUIRED_CASE_DATA`
- `MISSING_SUMMARY`
- `MATCHING_NOT_READY`
- `PROVIDER_NOT_ACCEPTED`
- `PLACEMENT_NOT_CONFIRMED`
- `CASE_ARCHIVED`

### Risk Rules

- `LOW_MATCH_CONFIDENCE`
- `REPEATED_PROVIDER_REJECTIONS`
- `CAPACITY_RISK`
- `HIGH_URGENCY_IDLE`
- `INTAKE_DELAYED`

### Alert Rules

- `INCOMPLETE_CASE`
- `MISSING_SUMMARY`
- `NO_MATCH_AVAILABLE`
- `WEAK_MATCH_NEEDS_VERIFICATION`
- `PROVIDER_REJECTED_CASE`
- `PROVIDER_REVIEW_PENDING_SLA`
- `PLACEMENT_BLOCKED`
- `INTAKE_NOT_STARTED`
- `ARCHIVED_CASE`

### Next-Best-Action Priority

1. Resolve critical blockers
2. Complete missing case data
3. Generate or check summary
4. Start matching
5. Send selected match to provider
6. Wait or follow up provider review
7. Handle provider rejection
8. Confirm placement after acceptance
9. Start intake after placement
10. Monitor case
11. Archive completed case

### API Endpoint

- `GET /care/api/cases/<id>/decision-evaluation/`
- `GET /care/api/regiekamer/decision-overview/`

Both endpoints require authentication, respect case visibility permissions, and are read-only. They do not mutate data or create audit events.

### Regiekamer Lite Overview

`GET /care/api/regiekamer/decision-overview/` powers the live Regiekamer Lite triage surface.

- It is derived from `evaluate_case()` and reuses the backend decision contract.
- It returns active casussen only and excludes archived cases.
- It exposes totals, priority ordering, top blocker/risk/alert summaries, and next-best-action hints for rendering only.
- It does not own workflow authority and the frontend must not infer blockers or next actions on its own.

### Frontend Consumption Rule

- The frontend may display decision evaluation output.
- The frontend may not reimplement decision authority.
- The frontend must treat the backend decision engine as the source of truth for blockers, next-best action, and blocked-action reasons.

## Casus Detail Surface

The active casus detail page is the operational command surface for one casus.

It must render backend decision evaluation directly and show:

- current phase and status
- next-best action
- blockers, risks, and alerts
- allowed and blocked actions for the current role
- decision context for transparency
- recent timeline signals when available

### UI Rules

- CTA visibility comes from `evaluate_case`.
- Blocked action reasons come from `evaluate_case`.
- The frontend may call mutation endpoints, but it must refetch decision evaluation after every successful action.
- The frontend may not infer workflow transitions from local status checks on this page.

## Deferred By Design

Some capabilities are intentionally not productized yet. Treat them as explicit non-goals for the current live flow.

### AI-based anonymization

- Do not introduce a dedicated AI anonymization route, action, or UX surface unless there is a concrete product requirement and an approved implementation plan.
- Deterministic display masking or truncation helpers may exist for safe rendering, but those are not a user-facing anonymization workflow.
- If AI anonymization is ever added, define the route, permission, audit trail, and test coverage first.

### Uitstroom

- Do not create a separate first-class uitstroom model or surface unless discharge becomes a distinct product requirement.
- Use the existing placement, intake, completion, and archive states as the current outcome layer.
- Any future uitstroom product surface must be designed deliberately, not inferred from existing workflow shortcuts.
