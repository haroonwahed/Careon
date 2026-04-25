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
