# CareOn Drill Log

## 2026-04-10: Migration Rollback Drill

- Environment: local scratch SQLite databases
- Scope: `contracts` migration rollback and re-apply around `0006_approvalrequest_organization_and_more`

### Clean Scratch DB

Commands:

```bash
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py migrate --noinput
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py migrate contracts 0006_approvalrequest_organization_and_more --noinput
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py audit_null_organizations
```

Result:

- success
- reverse path from `0006` to `0005` completed
- re-apply to `0006` completed
- no `NULL organization` rows remained

### Populated Copy

Commands:

```bash
cp db.sqlite3 /tmp/careon-drill.sqlite3
SQLITE_PATH=/tmp/careon-drill.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
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
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py migrate --noinput
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py migrate contracts 0006_approvalrequest_organization_and_more --noinput
SQLITE_PATH=/tmp/careon-drill-clean.sqlite3 python manage.py audit_null_organizations
```

Result:

- success
- reverse path from `0006` to `0005` completed
- re-apply to `0006` completed
- no `NULL organization` rows remained

### Populated Copy

Commands:

```bash
cp db.sqlite3 /tmp/careon-drill.sqlite3
SQLITE_PATH=/tmp/careon-drill.sqlite3 python manage.py migrate contracts 0005_add_org_fk_to_budget_and_due_diligence --noinput
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

- Environment: **Render staging** — `https://careon-web.onrender.com`
- Scope: automated `scripts/go_live_http_smoke.sh` after aligning third check to `/?view=dashboard` (Whitenoise returned 404 for `/static/spa/?view=dashboard` while app was healthy)
- Repo reference at time of check: **`eb115a0`** (local workspace; redeploy may differ)

### Commands

```bash
BASE_URL=https://careon-web.onrender.com ./scripts/go_live_http_smoke.sh
```

### Result

- success — `GET /` → 200, `GET /care/` → 200, `GET /?view=dashboard` → 200

### Not done here (requires your secrets / browser / people)

- `go_live_django_preflight.sh` against Render’s **real** `DATABASE_URL` + full prod env (not run from this agent)
- Manual browser smoke per `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md` §3–7 (gemeente + aanbieder)
- Sentry alert routing + on-call roster (operational)

### Conclusion

- staging origin responds on critical HTTP paths; treat browser + DB preflight as the next gate before calling pilot “signed off”
