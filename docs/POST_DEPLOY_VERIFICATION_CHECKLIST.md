# Post-Deploy Verification Checklist

Foundation reference:

- `docs/ZORG_OS_FOUNDATION_APPROACH.md`
- `docs/FOUNDATION_LOCK.md`

All smoke checks below should validate the live app against this canonical workflow and backend guardrail contract.

Use this immediately after a Render redeploy that is expected to be production-ready.

## 0. Preconditions

Before you begin, confirm:

- the Render deploy finished successfully
- the app is serving the expected release SHA
- `DATABASE_URL` points to the live Supabase database
- `ALLOWED_HOSTS` includes the Render hostname
- `CSRF_TRUSTED_ORIGINS` includes the HTTPS Render origin
- `DEFAULT_FROM_EMAIL` is configured for production

## 1. Startup Verification

Check the deploy logs first.

Confirm all of these:

- no `DATABASE_URL` guard error
- no `ImproperlyConfigured` error from `config.settings_production`
- no migration failure during startup
- Gunicorn started cleanly

If the logs show a failure, stop here and fix the environment before continuing.

## 2. Application Health

Run these checks in the browser or with `curl`.

### Required URLs

- `/`
- `/static/spa/?view=dashboard`
- `/care/`

### Expected result

- all three URLs return `200`
- none of them redirect in a loop
- none of them return `500`

## 3. Canonical Workflow Smoke Test

Verify the full workflow in the live app:

1. Open a case (`Casus`).
2. Confirm the summary view (`Samenvatting`) renders.
3. Confirm matching suggestions render (`Matching`).
4. Confirm provider review (`Aanbieder Beoordeling`) is available.
5. Confirm placement only appears after provider acceptance (`Plaatsing`).
6. Confirm intake only starts after placement (`Intake`).

### Expected result

- every step is visible in the right order
- no step is reachable too early
- the Dutch canonical labels are visible
- the page shows the next correct action

## 4. Role and Permission Check

Verify at least one user from each relevant role:

- municipality user
- provider user
- admin or platform operator

Confirm:

- each role sees the correct action surface
- no cross-tenant data is visible
- detail routes return the right `404` or `403` behavior

## 5. Decision and Audit Check

Verify that important actions create visible traceability:

- provider acceptance or rejection is logged
- placement approval or rejection is logged
- matching recommendations have a visible decision surface
- audit or timeline entries are present where expected

## 6. Operational Surfaces Check

Verify the operational views that matter most:

- Regiekamer surfaces show actionable items
- provider response monitor shows real queue state
- placement list shows the correct provider state
- no placeholder English terminology remains in user-facing Dutch UX

## 7. Final Go/No-Go

Declare the release only if all of these are true:

- live startup is clean
- health checks return `200`
- canonical workflow smoke passes
- permissions are correct
- audit/decision behavior is visible
- operational surfaces look correct
- no new incidents or regressions were found

If any item fails, stop and file a rollback or hotfix task instead of signing off.

## 8. Record Evidence

Add the following to the drill log and rollout sheet:

- deploy timestamp
- verification timestamp
- URLs checked
- user roles checked
- observed result
- any follow-up issues

Related docs:

- [`docs/RELEASE_ROLLOUT_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RELEASE_ROLLOUT_CHECKLIST.md)
- [`docs/RELEASE_EXECUTION_SHEET_2026-04-24.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RELEASE_EXECUTION_SHEET_2026-04-24.md)
- [`docs/DRILL_LOG.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/DRILL_LOG.md)
