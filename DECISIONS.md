# CareOn Decisions

## Canonical Documentation

- `README.md` is the single operational overview for setup, running, auth, reminders, and tests.
- `DECISIONS.md` is the single decisions log.
- Duplicate or stale handover docs are removed instead of being kept as parallel sources of truth.

## Multi-Tenant Authorization

- Organization membership is the basis of tenant access.
- Roles are `OWNER`, `ADMIN`, and `MEMBER`.
- Contract permission logic is centralized in `contracts/permissions.py`.
- `VIEW`, `COMMENT`, and `AI` actions are allowed for any active organization member.
- `EDIT` is restricted to owners/admins and the contract creator.

## Reminder Execution Model

- Renewal and expiration reminders run through management commands, not cron-specific code.
- `send_contract_reminders` performs one-off creation.
- `run_reminder_scheduler` runs the same logic in a long-lived loop.
- The web server and reminder scheduler are intentionally separate processes.

## Local Development Workflow

- Default local app URL is `http://127.0.0.1:8000`.
- `scripts/dev_up.sh` starts or adopts the dev server on port `8000` and starts the reminder scheduler.
- `scripts/dev_down.sh` stops both processes using pid files under `logs/`.

## Auth and Routing

- Login route is `/login/`, not `/accounts/login/`.
- Register route is `/register/`.
- Post-login redirect is `/dashboard/`.

## UI and Test Compatibility

- The redesign contract list and dashboard markers covered by the test suite are part of the supported UI surface.
- Template changes should preserve tested user-facing markers unless the tests are intentionally updated in the same change.
- Light/dark mode on auth pages is implemented with CSS variables rather than hardcoded colors.

## Pilot Operations Governance

- Week 16 pilot execution uses a simulation-backed Friday dry-run deck as the mandatory facilitation artifact before relying on live weekly case volume.
- Friday sessions must enforce forced classification, forced primary reason, and one evidence sentence per case.
- Pilot quality outcomes are tracked through: matching quality signals, waiting-time loop reduction, and data-quality improvements in case completeness and explanations.
- On 2026-04-15, pilot mode moved from planning to live daily execution using a dated worksheet and command-backed evidence snapshot.
- On 2026-04-15, Friday facilitation moved to execution readiness with a pattern-covered case shortlist and pre-populated weekly case review sheet.
- On 2026-04-15, dry-run execution results were recorded, action owners were assigned, and completion-gate status was formalized with live-case validation pending.
- On 2026-04-15, real-case execution was activated in local pilot environment by creating append-only governance events for existing case IDs and refreshing weekly output to 6 candidate cases.