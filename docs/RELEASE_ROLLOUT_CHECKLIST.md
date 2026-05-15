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

For a **blank one-pager** to copy per release, see:
- [`docs/RELEASE_EXECUTION_SHEET_TEMPLATE.md`](./RELEASE_EXECUTION_SHEET_TEMPLATE.md)

For the current pilot-rehearsal execution sheet, see:
- [`docs/RELEASE_EXECUTION_SHEET_2026-05-15.md`](./RELEASE_EXECUTION_SHEET_2026-05-15.md)

For a concrete, dated example of how to fill this in, see:
- [`docs/RELEASE_EXECUTION_SHEET_2026-04-24.md`](./RELEASE_EXECUTION_SHEET_2026-04-24.md)

For the live post-deploy smoke path, see:
- [`docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md)

Release timing model:
- `T0` = production deploy start
- all timestamps below are target timestamps in `Europe/Amsterdam`
- record the actual execution timestamp beside each step during the rollout

Reference release SHA:
- `RELEASE_SHA="<git-sha-to-deploy>"`

## Release Control Sheet

| Role | Primary owner | Backup owner | Responsibility |
|---|---|---|---|
| Release captain | Product / engineering lead | Backend owner | Owns go/no-go, sign-off, and rollback decision |
| Backend owner | Application engineer | Release captain | Runs deploy, migrations, and post-deploy verification |
| Ops owner | Infrastructure / DevOps | Backend owner | Handles server access, restart, and monitoring checks |
| QA owner | Test / verification owner | Release captain | Runs smoke checks, confirms the canonical flow, records evidence |

## Target Rollout Timeline

| Step | Owner | Target timestamp | Actual timestamp | Evidence to capture |
|---|---|---|---|---|
| Staging preflight | Release captain + Ops owner | `T-90m` |  | Clean working tree, current backup, target SHA visible, `manage.py check` available |
| Staging deploy | Backend owner + Ops owner | `T-60m` |  | Checkout SHA, install dependencies, migrate, collectstatic, restart app |
| Staging verification | QA owner | `T-45m` |  | `check`, terminology guard, targeted tests, HTTP 200s on key routes |
| Staging sign-off | Release captain | `T-30m` |  | Staging URL smoke result, canonical flow confirmation, open issues list |
| Production preflight | Release captain + Ops owner | `T-15m` |  | Backup confirmation, change window confirmation, rollback owner confirmation |
| Production deploy | Ops owner + Backend owner | `T0` |  | Checkout SHA, migrate, collectstatic, restart app |
| Production verification | QA owner + Release captain | `T+15m` |  | `check --deploy`, terminology guard, smoke checks, monitoring watch start |
| Production sign-off | Release captain | `T+45m` |  | All-clear timestamp, evidence bundle, follow-up ticket list |

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
git log --oneline -5 origin/chore/careon-flow-normalization
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
git log --oneline -5 origin/chore/careon-flow-normalization
python manage.py showmigrations contracts
python manage.py check --deploy
ls -lth /backups/careon/ | head -5
```

Record:
- actual timestamp:
- backup reference:
- staging sign-off:
- rollback owner:

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
- actual timestamp:
- deploy SHA:
- migration output:
- restart confirmation:

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
- actual timestamp:
- smoke result:
- monitoring start:
- monitoring end:

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
- actual timestamp:
- all-clear timestamp:
- open follow-ups:
- rollback not needed:

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
