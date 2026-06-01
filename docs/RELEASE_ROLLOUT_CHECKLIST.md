# CareOn Release Rollout Checklist

Foundation reference:

- `docs/START_HERE.md`
- `docs/Careon_Operational_Constitution_v2.md` / `docs/Careon_Operational_Constitution_v2.docx`
- `docs/ZORG_OS_FOUNDATION_APPROACH.md`
- `docs/FOUNDATION_LOCK.md`
- `docs/PILOT_PROOF_PACKAGE.md` (rehearsal GO/NO-GO bundle)
- `docs/PRODUCTION_RUNBOOK.md` (secrets, backups, observability, SSO)

Use these as the source-of-truth contract for canonical workflow order, actor ownership, and backend-enforced gating during rollout validation.

Use this for the staging-to-production handoff on a release that already has a green local validation set.

## GO / NO-GO at a glance

**GO only when**
- production window is confirmed
- all four owners are assigned
- rollback path is known
- backup is recent and referenced
- secrets/env are ready
- `OIDC_RP_CLIENT_SECRET` status is clear
- local release-confidence checks are green

**NO-GO when**
- any production input is still pending
  - reason: you do not yet have a complete go/no-go decision set.
- backup or secrets are unconfirmed
  - reason: restore and deploy safety cannot be verified.
- the rollout window is not scheduled
  - reason: there is no approved maintenance window to execute in.
- deploy verification cannot be run
  - reason: you cannot validate the release after changes are applied.
- monitoring access is unavailable
  - reason: you cannot safely observe or abort the live rollout.

## Required production inputs

Fill these before the production window starts:

- Release captain:
- Backend owner:
- Ops owner:
- QA owner:
- Production window date:
- Production window start:
- Production window end:
- Rollback owner:
- Rollback path:
- Backup reference:
- Backup timestamp:
- Secrets/env readiness:
- Monitoring access:
- `OIDC_RP_CLIENT_SECRET` rotation status:

## Go / No-Go checklist

Use this as the final preflight gate before the production window starts.

- [ ] Production window is confirmed and calendar-blocked.
- [ ] Release captain, backend owner, ops owner, and QA owner are assigned.
- [ ] Rollback owner and rollback path are confirmed.
- [ ] Backup reference and timestamp are recorded for the target environment.
- [ ] Secrets/env readiness is confirmed for production.
- [ ] Monitoring access is confirmed.
- [ ] `OIDC_RP_CLIENT_SECRET` rotation is complete or explicitly not needed.
- [ ] Local release-confidence checks are green.
- [ ] Production preflight is green on the intended release SHA.
- [ ] Deploy, migrate, collectstatic, and restart plan are ready.
- [ ] Smoke checks and monitoring watch window are scheduled.
- [ ] Sign-off owner understands the abort triggers and rollback decision point.

### Copy block

| Field | Value |
|-------|-------|
| Release captain |  |
| Backend owner |  |
| Ops owner |  |
| QA owner |  |
| Production window date |  |
| Production window start |  |
| Production window end |  |
| Rollback owner |  |
| Rollback path |  |
| Backup reference |  |
| Backup timestamp |  |
| Secrets/env readiness |  |
| Monitoring access |  |
| `OIDC_RP_CLIENT_SECRET` rotation status |  |

## Current release snapshot

Release ref:
- `main` @ `ca146bdc`

Latest reviewed evidence:
- `reports/release_evidence_bundle.json` → `timeline_gate.go=true`, `no_go_reasons=[]`
- `./scripts/run_golden_path_e2e.sh --start-server` → **GO** (2026-05-29; 12 passed, 1 skipped)
- Targeted provider / golden-path rerun → **GO** (2026-05-31; 9 passed, 1 skipped) after stabilizing Playwright login waits
- `./scripts/staging_pilot_signoff.sh` → **GO** on `https://careon-web.onrender.com`

Explicit blockers before production promotion:
- Production promotion has **not** started.
- Production secrets inventory is **not yet recorded** in this checklist.
- Backup / restore drill evidence is **not yet recorded** for the target production environment.
- Observability / alerting verification is **not yet recorded** for the target production environment.
- Rollback ownership is only prepared at the role level; production scheduling still needs a release window and timestamps.

For a **blank one-pager** to copy per release, see:
- [`docs/RELEASE_EXECUTION_SHEET_TEMPLATE.md`](./RELEASE_EXECUTION_SHEET_TEMPLATE.md)

For the current pilot-rehearsal execution sheet, see:
- [`docs/RELEASE_EXECUTION_SHEET_2026-05-15.md`](./RELEASE_EXECUTION_SHEET_2026-05-15.md)

For a concrete, dated example of how to fill this in, see:
- [`docs/RELEASE_EXECUTION_SHEET_2026-04-24.md`](./RELEASE_EXECUTION_SHEET_2026-04-24.md)

For the current working rollout draft, see:
- [`docs/RELEASE_EXECUTION_SHEET_2026-05-30.md`](./RELEASE_EXECUTION_SHEET_2026-05-30.md)

Use that sheet as the live scratchpad for the next production window and copy the final values into `docs/DRILL_LOG.md` when the rollout closes.

For the consolidated todo list / workplan, see:
- [`docs/WORKPLAN_2026-05-30.md`](./WORKPLAN_2026-05-30.md)

For the live post-deploy smoke path, see:
- [`docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md)

Release timing model:
- `T0` = production deploy start
- all timestamps below are target timestamps in `Europe/Amsterdam`
- record the actual execution timestamp beside each step during the rollout

Reference release SHA:
- `RELEASE_SHA="ca146bdc"`

## Release Control Sheet

| Role | Primary owner | Backup owner | Responsibility |
|---|---|---|---|
| Release captain | Product / engineering lead | Backend owner | Owns go/no-go, sign-off, and rollback decision |
| Backend owner | Application engineer | Release captain | Runs deploy, migrations, and post-deploy verification |
| Ops owner | Infrastructure / DevOps | Backend owner | Handles server access, restart, and monitoring checks |
| QA owner | Test / verification owner | Release captain | Runs smoke checks, confirms the canonical flow, records evidence |

## Open owner matrix

| Owner | Remaining production items | Required evidence / output |
|---|---|---|
| Release captain | Schedule the production window; confirm GO/NO-GO; own rollback decision; close final sign-off | Dated window, all-clear or abort call, owner sign-off in rollout evidence |
| Backend owner | Execute deploy steps on the target SHA; run migrations; verify app-level post-deploy health | Deploy SHA, migration output, restart confirmation, `check --deploy` output |
| Ops owner | Confirm secrets/env readiness; ensure backup exists; manage service restart and monitoring access | Backup reference, secrets inventory status, restart confirmation, monitoring watch start |
| QA owner | Run production smoke checks and terminology guard; verify canonical routes return `200` | Smoke result, route status codes, terminology guard output, follow-up defects |

## Target Rollout Timeline

| Step | Owner | Target timestamp | Actual timestamp | Evidence to capture |
|---|---|---|---|---|
| Staging preflight | Release captain + Ops owner | `T-90m` | 2026-05-16 | `ca146bdc`; Render env pilot bootstrap + demo seed |
| Staging deploy | Backend owner + Ops owner | `T-60m` | 2026-05-16 | Live on https://careon-web.onrender.com |
| Staging verification | QA owner | `T-45m` | 2026-05-16 | `staging_pilot_signoff.sh` GO (9 Playwright / 3 skipped) |
| Staging sign-off | Release captain | `T-30m` | 2026-05-16 | See `docs/RELEASE_EXECUTION_SHEET_2026-05-15.md` |
| Production preflight | Release captain + Ops owner | `T-15m` | — | BLOCKED: backup confirmation, change window confirmation, rollback owner confirmation still need production scheduling |
| Production deploy | Ops owner + Backend owner | `T0` | — | BLOCKED: checkout SHA, migrate, collectstatic, restart app only after production preflight is green |
| Production verification | QA owner + Release captain | `T+15m` | — | BLOCKED: `check --deploy`, terminology guard, smoke checks, monitoring watch start only after deploy |
| Production sign-off | Release captain | `T+45m` | — | BLOCKED: all-clear timestamp, evidence bundle, follow-up ticket list only after production watch window |

## 0. Rollout Preconditions

Do not start the rollout unless all of these are true:

- `RELEASE_SHA` is filled in and reviewed.
- The current branch has the intended release contents.
- Staging and production rollback steps are available.
- The release captain, backend owner, ops owner, and QA owner are assigned.
- The local release-confidence checks are green.

## 1. Staging Preflight

Owner:
- Release captain
- Ops owner

Target time:
- `T-90m`

Checklist:

- [ ] Confirm the target SHA.
- [ ] Confirm the latest backup exists and is recent enough.
- [ ] Confirm the staging host and app directory are correct.
- [ ] Confirm the rollout window is open.
- [ ] Confirm no active incident would conflict with the deploy.

Commands:

```bash
ssh "$STAGING_HOST"
cd "$APP_DIR"
source "$VENV_DIR/bin/activate"

git status --short
git fetch --all --tags
git log --oneline -5 "$RELEASE_SHA"
python manage.py showmigrations contracts
python manage.py check
ls -lth /backups/careon/ | head -5
```

Record:
- actual timestamp:
- backup reference:
- reviewer:

## 2. Staging Deploy

Owner:
- Backend owner
- Ops owner

Target time:
- `T-60m`

Checklist:

- [ ] Check out the target release SHA.
- [ ] Install or refresh dependencies if required.
- [ ] Run database migrations.
- [ ] Collect static assets.
- [ ] Restart the application service.

Commands:

```bash
ssh "$STAGING_HOST"
cd "$APP_DIR"
source "$VENV_DIR/bin/activate"

git fetch origin
git checkout "$RELEASE_SHA"
pip install -r requirements/runtime.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn-careon
```

Record:
- actual timestamp:
- deploy SHA:
- migration output:
- restart confirmation:

## 3. Staging Verification

Owner:
- QA owner

Target time:
- `T-45m`

Checklist:

- [ ] Run system checks.
- [ ] Run terminology guard.
- [ ] Run the release-critical test subset.
- [ ] Confirm the staging dashboard responds with `200`.
- [ ] Confirm the canonical `/care/` route responds with `200`.
- [ ] Confirm the workflow pages render without redirect loops or 500s.
- [ ] Confirm Dutch-first terminology appears in the visible surfaces.

Commands:

```bash
ssh "$STAGING_HOST"
cd "$APP_DIR"
source "$VENV_DIR/bin/activate"

python manage.py check
python scripts/terminology_guard.py
python manage.py showmigrations contracts
python manage.py test tests.test_cross_tenant_isolation -v 1
python manage.py test tests.test_dashboard_shell -v 1
python manage.py test tests.test_intake_assessment_matching_flow -v 1
curl -s -o /dev/null -w "%{http_code}\n" https://<staging-url>/static/spa/?view=dashboard
curl -s -o /dev/null -w "%{http_code}\n" https://<staging-url>/care/
```

Smoke path:

1. Sign in.
2. Open the dashboard.
3. Open the case list.
4. Open the intake list.
5. Open or create a case.
6. Confirm the intake -> samenvatting -> matching -> aanbieder beoordeling -> plaatsing -> intake flow renders cleanly.
7. Confirm no dead links, 404s, or 500s on the touched routes.

Record:
- actual timestamp:
- test output link:
- smoke result:
- open defects:

Do not proceed to production unless staging is green.

## 4. Production Preflight

Owner:
- Release captain
- Ops owner

Target time:
- `T-15m`

Checklist:

- [ ] Confirm staging sign-off.
- [ ] Confirm the backup exists and is recent.
- [ ] Confirm the change window is still open.
- [ ] Confirm rollback ownership.
- [ ] Confirm monitoring access.

Commands:

```bash
ssh "$PROD_HOST"
cd "$APP_DIR"
source "$VENV_DIR/bin/activate"

git status --short
git fetch --all --tags
git log --oneline -5 "$RELEASE_SHA"
python manage.py showmigrations contracts
python manage.py check --deploy
ls -lth /backups/careon/ | head -5
```

Record:
- actual timestamp: `—` (not started)
- backup reference: `—` (production backup evidence not yet captured)
- staging sign-off: `GO` on 2026-05-29
- rollback owner: release captain + ops owner (role-level assigned; production window still pending)

## 5. Production Deploy

Owner:
- Ops owner
- Backend owner

Target time:
- `T0`

Checklist:

- [ ] Check out the target release SHA.
- [ ] Install or refresh dependencies if required.
- [ ] Run database migrations.
- [ ] Collect static assets.
- [ ] Restart the application service.

Commands:

```bash
ssh "$PROD_HOST"
cd "$APP_DIR"
source "$VENV_DIR/bin/activate"

git fetch origin
git checkout "$RELEASE_SHA"
pip install -r requirements/runtime.txt
python manage.py migrate --noinput
python manage.py collectstatic --noinput
sudo systemctl restart gunicorn-careon
```

Record:
- actual timestamp: `—` (not started)
- deploy SHA: `ca146bdc` (target only; no production deploy yet)
- migration output: `—`
- restart confirmation: `—`

## 6. Production Verification

Owner:
- QA owner
- Release captain

Target time:
- `T+15m`

Checklist:

- [ ] Run `check --deploy`.
- [ ] Run the terminology guard.
- [ ] Confirm the production dashboard returns `200`.
- [ ] Confirm the canonical `/care/` route returns `200`.
- [ ] Confirm monitoring is stable for the first watch window.
- [ ] Confirm there is no spike in 5xx rate or latency on touched routes.

Commands:

```bash
ssh "$PROD_HOST"
cd "$APP_DIR"
source "$VENV_DIR/bin/activate"

python manage.py check --deploy
python scripts/terminology_guard.py
python manage.py showmigrations contracts
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/static/spa/?view=dashboard
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/care/
```

Watch window:

1. 5xx rate.
2. p95 latency on `/static/spa/?view=dashboard` and `/care/`.
3. Login success/failure rate.
4. Scheduled job heartbeat.

Record:
- actual timestamp: `—` (not started)
- smoke result: `—`
- monitoring start: `—`
- monitoring end: `—`

## 7. Sign-Off

Owner:
- Release captain

Target time:
- `T+45m`

Checklist:

- [ ] Production checks are green.
- [ ] Smoke tests are green.
- [ ] Monitoring is stable through the first watch window.
- [ ] Open defects are logged with an owner and next step.
- [ ] Release evidence is saved.

Record:
- actual timestamp: `—` (not started)
- all-clear timestamp: `—`
- open follow-ups: production promotion remains unscheduled; production evidence still missing
- rollback not needed: `—`

## 8. Abort Conditions

Stop rollout and switch to rollback if any of the following occur:

- `python manage.py migrate --noinput` fails
- `python manage.py check` or `check --deploy` fails
- `/static/spa/?view=dashboard` or `/care/` returns non-`200`
- core case/intake/aanbieder beoordeling/matching flow returns `404` or `500`
- error rate or latency spikes beyond alert thresholds
- terminology guard reports a regression

Rollback reference:

- [docs/ROLLBACK_RUNBOOK.md](/Users/haroonwahed/Documents/Projects/Careon/docs/ROLLBACK_RUNBOOK.md)

## 9. Release Evidence To Record

Capture these before closing the rollout:

1. deployed `RELEASE_SHA`
2. staging preflight timestamp
3. staging deploy timestamp
4. staging verification timestamp
5. production preflight timestamp
6. production deploy timestamp
7. production verification timestamp
8. production all-clear timestamp
9. migration output
10. `check` / `check --deploy` output
11. smoke-test results
12. any follow-up issues discovered

Record rollout evidence in:

- [docs/DRILL_LOG.md](/Users/haroonwahed/Documents/Projects/Careon/docs/DRILL_LOG.md)

## 10. Current status summary

- Pilot rehearsal and staging sign-off are **GO**.
- Release evidence bundle is **GO** with an empty `no_go_reasons` list.
- Production rollout remains **not started** and should stay explicitly blocked until the evidence items above are filled.
