# CareOn Release Execution Sheet

Release date:
- `2026-04-24`

Timezone:
- `Europe/Amsterdam`

Release SHA:
- `dbd4d6f`

Branch:
- `main`

Deploy window:
- staging: `2026-04-24 15:30` to `2026-04-24 16:25`
- production: `2026-04-24 16:40` to `2026-04-24 17:45`

## Current Status

Local release-confidence checks completed:

- `2026-04-24T15:20:56+0200`
- `python manage.py check` passed
- `python scripts/terminology_guard.py` passed

Remote rollout status:

- blocked until staging and production hostnames are provided
- the repo only contains generic placeholder values for `STAGING_HOST` and `PROD_HOST`
- no remote deploy was executed

## Owner Assignments

| Role | Owner | Backup |
|---|---|---|
| Release captain | Haroon Wahed | Backend owner |
| Backend owner | Haroon Wahed | Release captain |
| Ops owner | Haroon Wahed | Backend owner |
| QA owner | Haroon Wahed | Release captain |

## Rollout Steps

### 1. Staging preflight

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 15:30`

Checklist:

- [ ] Confirm `dbd4d6f` is the intended release SHA.
- [ ] Confirm the staging backup is recent and restorable.
- [ ] Confirm the current branch matches the intended release contents.
- [ ] Confirm no open incident blocks the rollout window.
- [ ] Confirm staging access, app directory, and virtualenv paths.

Current note:

- remote host not yet supplied
- local preflight validation already passed

Evidence:

- actual time:
- backup reference:
- incident check:

### 2. Staging deploy

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 15:45`

Checklist:

- [ ] Checkout `dbd4d6f`.
- [ ] Install or refresh runtime dependencies if required.
- [ ] Run migrations.
- [ ] Collect static assets.
- [ ] Restart the staging application service.

Evidence:

- actual time:
- migration output:
- restart confirmation:

### 3. Staging verification

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 16:05`

Checklist:

- [ ] Run `python manage.py check`.
- [ ] Run `python scripts/terminology_guard.py`.
- [ ] Run the release-critical regression subset.
- [ ] Confirm `/static/spa/?view=dashboard` returns `200`.
- [ ] Confirm `/care/` returns `200`.
- [ ] Smoke the canonical workflow from casus to intake.

Evidence:

- actual time:
- test output link:
- smoke result:
- defects found:

### 4. Staging sign-off

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 16:25`

Checklist:

- [ ] Confirm the staging smoke is green.
- [ ] Confirm no new regressions were introduced.
- [ ] Confirm production is still safe to continue.

Evidence:

- actual time:
- sign-off status:
- follow-up items:

### 5. Production preflight

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 16:40`

Checklist:

- [ ] Confirm staging sign-off.
- [ ] Confirm rollback instructions are available.
- [ ] Confirm the production backup is recent.
- [ ] Confirm the production change window is still open.
- [ ] Confirm monitoring access is available.

Current note:

- remote host not yet supplied
- production deploy is not executable from the current repo context

Evidence:

- actual time:
- rollback owner:
- backup reference:

### 6. Production deploy

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 17:00`

Checklist:

- [ ] Checkout `dbd4d6f`.
- [ ] Install or refresh runtime dependencies if required.
- [ ] Run migrations.
- [ ] Collect static assets.
- [ ] Restart the production application service.

Evidence:

- actual time:
- migration output:
- restart confirmation:

### 7. Production verification

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 17:20`

Checklist:

- [ ] Run `python manage.py check --deploy`.
- [ ] Run `python scripts/terminology_guard.py`.
- [ ] Confirm `/static/spa/?view=dashboard` returns `200`.
- [ ] Confirm `/care/` returns `200`.
- [ ] Watch 5xx rate, latency, and login success for the first window.

Evidence:

- actual time:
- smoke result:
- monitoring window:
- defects found:

### 8. Production sign-off

- Owner: Haroon Wahed
- Backup: Haroon Wahed
- Planned time: `2026-04-24 17:45`

Checklist:

- [ ] Confirm all production checks are green.
- [ ] Confirm monitoring stayed stable.
- [ ] Record the all-clear timestamp.
- [ ] Record any follow-up tickets.

Evidence:

- actual time:
- all-clear timestamp:
- follow-up tickets:

## Rollback Trigger

Stop the rollout and follow the rollback runbook if any of these occur:

- migrations fail
- system checks fail
- `/static/spa/?view=dashboard` or `/care/` returns non-`200`
- the canonical workflow breaks
- error rate or latency exceeds the alert threshold
- terminology guard reports a regression

Rollback reference:
- [`docs/ROLLBACK_RUNBOOK.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/ROLLBACK_RUNBOOK.md)

## Evidence Record

Record the following in the drill log after the rollout:

1. deployed SHA
2. staging preflight time
3. staging deploy time
4. staging verification time
5. staging sign-off time
6. production preflight time
7. production deploy time
8. production verification time
9. production sign-off time
10. all-clear timestamp
11. follow-up issues

For the exact live smoke sequence, use:

- [`docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md)

Log reference:
- [`docs/DRILL_LOG.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/DRILL_LOG.md)
