# Carelane Drill Log

## 2026-06-21: Pilot readiness drills (backup + rollback + core loop)

- Environment: local rehearsal + live Render origin + read-only Supabase counts
- Scope: pilot checklist items 8–9 ops gate (core loop, rollback procedure, support path)

### Commands

```bash
./scripts/run_full_pilot_rehearsal.sh
./scripts/run_backup_restore_drill.sh --verify-live-db
./scripts/run_rollback_rehearsal.sh
.venv/bin/python -m pytest tests/test_cross_tenant_isolation.py tests/test_resolve_actor_role_security.py \
  tests/test_tenant_db_backstop.py tests/test_auth_rate_limit.py tests/test_intake_schedule_api.py \
  tests/test_document_download_accel_fallback.py tests/test_spa_shell_lang.py -q
```

### Result

- `run_full_pilot_rehearsal.sh` → **GO** (`timeline_gate.go=true`)
- backup/restore drill → **pass** (rehearsal SQLite; live Postgres `27` cases / `31` decision logs)
- rollback rehearsal → **pass** (`/_health/` 200; live SHA `9f7aa53`)
- security gate pytest → **130 passed**
- Render Redis → **pending** Blueprint sync (`docs/ops/RENDER_INFRA_SYNC.md`)

### Follow-up

- Sync `render.yaml` on Render (Redis, health check, autoDeploy off)
- One manual dashboard rollback click during supervised window

---

## 2026-05-30: Production Rollout Record

- Environment: production rollout / evidence log template
- Scope: capture the final production handoff evidence after the next live deployment

### Release Metadata

- Release date: 2026-05-30
- Timezone: Europe/Amsterdam
- Release SHA: `ca146bdc`
- Branch: `main`
- Release captain: pending
- Backend owner: pending
- Ops owner: pending
- QA owner: pending

### Production Preflight

### Required production inputs

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

- Window proposed date: pending
- Window proposed start time: pending
- Window proposed end time: pending
- Window confirmed by: pending
- Example format: 2026-06-03 09:00-10:30 (replace with the actual window)
- Production window: pending
- Rollback owner: pending
- Backup reference: pending
- Backup timestamp: pending
- Monitoring access: pending
- Secrets/env readiness: pending

### Green light criteria

- Release captain, backend owner, ops owner, and QA owner are assigned.
- Production window is confirmed.
- Backup exists and is recent.
- Secrets/env readiness is confirmed.
- Monitoring access is confirmed.
- Rollback owner is confirmed.
- Local release-confidence checks are green.

### Start / Stop

- Start only when all green-light criteria are checked.
- Stop immediately on any abort trigger.
- If stopped, record the reason and move to rollback.

### Execution tasks

1. Confirm the window and owners.
2. Verify backup and access.
3. Checkout the SHA and run deploy steps.
4. Verify `check --deploy`, smoke, and monitoring.
5. Record sign-off and archive evidence.

### Contact order

1. Release captain: confirm go/no-go, window status, and sign-off authority.
2. Ops owner: confirm backup, access, restart, and monitoring.
3. Backend owner: run migrate, collectstatic, and deploy verification.
4. QA owner: run smoke checks and record results.

### Abort triggers

Stop the rollout and switch to rollback if any of these happen:

- `migrate --noinput` fails
- `check --deploy` fails
- Dashboard or canonical `/care/` route returns non-`200`
- Core workflow path returns `404` or `500`
- Terminology guard reports a regression
- Error rate or latency spikes beyond alert thresholds

### Production Deploy

- Checkout timestamp: pending
- Deployed SHA: pending
- `migrate --noinput`: pending
- `collectstatic --noinput`: pending
- Restart confirmation: pending
- App health check: pending

### Production Verification

- `check --deploy`: pending
- Terminology guard: pending
- Dashboard `200`: pending
- Canonical `/care/` `200`: pending
- Smoke result: pending
- Monitoring watch start: pending
- Monitoring watch end: pending

### Sign-Off

- All-clear timestamp: pending
- Open defects: pending
- Rollback not needed: pending
- Evidence bundle path: pending

### Follow-ups

- [ ] Fill in actual timestamps during rollout
- [ ] Copy final values from `docs/RELEASE_EXECUTION_SHEET_2026-05-30.md`
- [ ] Archive `check --deploy` and smoke output
- [ ] Add any incidents or rollback notes below

## 2026-05-31: Provider / Golden Path Rehearsal Rerun

- Environment: local rehearsal stack
- Scope: stabilize browser login waits and verify provider / golden path E2E coverage

### Result

- Updated the Playwright login wait from `networkidle` to `waitForURL(/dashboard/)` in:
  - `client/tests/e2e/helpers/goldenPathPilotApi.ts`
  - `client/tests/e2e/provider-review-smoke.spec.ts`
- Re-ran the provider smoke slice and the golden path rehearsal:
  - `9 passed`
  - `1 skipped`
  - `0 failed`
- Provider review coverage now runs against seeded pending-placement rehearsal data instead of timing out on login or queue discovery.

### Follow-up

- Production rollout items remain blocked on external production input.
- `RENDER_DEPLOY_HOOK_URL` remains optional.

---

## 2026-05-29: Release Evidence Review

- Environment: rehearsal / staging release artifacts
- Scope: current release handoff evidence, rollout blockers, and pilot-ready status

### Reviewed Evidence

- `reports/release_evidence_bundle.json` → `timeline_gate.go=true`, `no_go_reasons=[]`
- `./scripts/run_golden_path_e2e.sh --start-server` → **GO** (12 passed, 1 skipped)
- `./scripts/staging_pilot_signoff.sh` → **GO** on `https://carelane-web.onrender.com`
- `docs/RELEASE_ROLLOUT_CHECKLIST.md` → production preflight / deploy / verification / sign-off explicitly blocked until production evidence is filled

### Current Conclusion

- canonical `casus` flow is verified end-to-end on the rehearsal stack
- pilot rehearsal evidence is GO
- production rollout remains intentionally **not started**
- remaining open production evidence: secrets inventory, backup / restore drill, observability / alerting, rollback window

## 2026-04-10: Migration Rollback Drill

- Environment: local scratch SQLite databases
- Scope: `contracts` migration rollback and re-apply around `0006_approvalrequest_organization_and_more`

### Clean Scratch DB

Commands:

```bash
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py migrate --noinput
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py migrate contracts 0006_approvalrequest_organization_and_more --noinput
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py audit_null_organizations
```

Result:

- success
- reverse path from `0006` to `0005` completed
- re-apply to `0006` completed
- no `NULL organization` rows remained

### Populated Copy

Commands:

```bash
cp db.sqlite3 /tmp/carelane-drill.sqlite3
SQLITE_PATH=/tmp/carelane-drill.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
```

Result:

- failed
- error: `UNIQUE constraint failed: new__contracts_clausecategory.name`

Conclusion:

- populated downgrade is not currently safe after tenant-owned starter content was duplicated per org
- rollback from `0006` to `0005` needs a dedicated downgrade/data-collapse strategy before it should be attempted on real data

## 2026-04-10: Migration Rollback Drill Re-Run

- Environment: local scratch SQLite databases
- Scope: repeatability verification for `contracts` migration rollback and re-apply around `0006_approvalrequest_organization_and_more`

### Clean Scratch DB

Commands:

```bash
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py migrate --noinput
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py migrate contracts 0006_approvalrequest_organization_and_more --noinput
SQLITE_PATH=/tmp/carelane-drill-clean.sqlite3 python manage.py audit_null_organizations
```

Result:

- success
- reverse path from `0006` to `0005` completed
- re-apply to `0006` completed
- no `NULL organization` rows remained

### Populated Copy

Commands:

```bash
cp db.sqlite3 /tmp/carelane-drill.sqlite3
SQLITE_PATH=/tmp/carelane-drill.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
```

Result:

- failed
- error: `UNIQUE constraint failed: new__contracts_clausecategory.name`

Conclusion:

- rollback from `0006` to `0005` remains unsafe on populated tenant-owned data without a dedicated downgrade migration

## 2026-04-24: Release Check Validation

- Environment: local development workspace
- Scope: final release-confidence checks for workflow, dashboard, tenancy, and terminology

### Checks Run

Commands:

```bash
./.venv/bin/python manage.py check
./.venv/bin/python scripts/terminology_guard.py
./.venv/bin/python manage.py test tests.test_cross_tenant_isolation tests.test_dashboard_shell tests.test_intake_assessment_matching_flow tests.test_regiekamer_provider_response_monitor tests.test_placements_operational_contract_regression -v 1
```

Result:

- success
- `manage.py check` passed with no issues
- terminology guard passed with no banned legacy terms
- 96 targeted tests passed across tenant isolation, dashboard shell, workflow flow, regiekamer monitor, and placement regression suites

Conclusion:

- local release-confidence gate is green
- remaining go-live work is operational/process validation on staging and production, not code-level release blockers in the checked surfaces

## 2026-05-12: Staging HTTP smoke (Render)

- Environment: **Render staging** — `https://carelane-web.onrender.com`
- Scope: automated `scripts/go_live_http_smoke.sh` after aligning third check to `/?view=dashboard` (Whitenoise returned 404 for `/static/spa/?view=dashboard` while app was healthy)
- Repo reference at time of check: **`eb115a0`** (local workspace; redeploy may differ)

### Commands

```bash
BASE_URL=https://carelane-web.onrender.com ./scripts/go_live_http_smoke.sh
```

### Result

- success — `GET /` → 200, `GET /care/` → 200, `GET /?view=dashboard` → 200

### Not done here (requires your secrets / browser / people)

- `go_live_django_preflight.sh` against Render’s **real** `DATABASE_URL` + full prod env (not run from this agent)
- Manual browser smoke per `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md` §3–7 (gemeente + aanbieder)
- Sentry alert routing + on-call roster (operational)

### Conclusion

- staging origin responds on critical HTTP paths; treat browser + DB preflight as the next gate before calling pilot “signed off”
