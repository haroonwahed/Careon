# CareOn Release Rollout Checklist

> Purpose: copy/paste-ready release procedure for staging first, then production.
> Use this for schema-changing CareOn releases, especially care-native migration rollout.

---

## 0. Fill In These Values First

Replace these placeholders before running commands:

```bash
export RELEASE_SHA="<git-sha-to-deploy>"
export STAGING_HOST="deploy@<staging-host>"
export PROD_HOST="deploy@<prod-host>"
export APP_DIR="/opt/careon"
export VENV_DIR="/opt/careon/.venv"
```

For the current branch handoff, the candidate release is:

```bash
export RELEASE_SHA="4e6be13"
```

---

## 1. Staging Preflight

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

Required before continuing:

- working tree is clean
- backup exists and is recent
- target `RELEASE_SHA` is visible locally

---

## 2. Staging Deploy

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

---

## 3. Staging Verification

Run these on staging immediately after deploy:

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
curl -s -o /dev/null -w "%{http_code}\n" https://<staging-url>/dashboard/
curl -s -o /dev/null -w "%{http_code}\n" https://<staging-url>/care/
```

Manual smoke pass on staging:

1. Sign in.
2. Open dashboard.
3. Open case list.
4. Open intake list.
5. Create or open a case.
6. Confirm intake -> assessment -> matching flow renders without 404/500.
7. Confirm care-native labels are visible and no `/contracts/` redirects are required.

Do not proceed to production unless staging is clean.

---

## 4. Production Preflight

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

Required before continuing:

- confirmed change window
- confirmed rollback owner
- confirmed recent backup
- confirmed staging signoff

---

## 5. Production Deploy

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

---

## 6. Production Verification

```bash
ssh "$PROD_HOST"
cd "$APP_DIR"
source "$VENV_DIR/bin/activate"

python manage.py check --deploy
python scripts/terminology_guard.py
python manage.py showmigrations contracts
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/dashboard/
curl -s -o /dev/null -w "%{http_code}\n" https://<prod-url>/care/
```

Then watch these for 30-60 minutes:

1. 5xx rate.
2. p95 latency on `/dashboard/` and `/care/`.
3. Reminder scheduler heartbeat.
4. Login success/failure rate.

---

## 7. Abort Conditions

Stop rollout and switch to rollback procedure if any of the following occur:

- `python manage.py migrate --noinput` fails
- `python manage.py check` or `check --deploy` fails
- dashboard or `/care/` returns non-200
- core case/intake/assessment/matching flow returns 404/500
- error rate or latency spikes beyond alert thresholds

Rollback reference:

- [docs/ROLLBACK_RUNBOOK.md](/Users/haroonwahed/Documents/Projects/Careon/docs/ROLLBACK_RUNBOOK.md)

---

## 8. Release Evidence To Record

Capture these before closing the rollout:

1. deployed `RELEASE_SHA`
2. migration output
3. `check` / `check --deploy` output
4. smoke-test results
5. timestamp of production all-clear
6. any follow-up issues discovered

Record drill or rollout evidence in:

- [docs/DRILL_LOG.md](/Users/haroonwahed/Documents/Projects/Careon/docs/DRILL_LOG.md)