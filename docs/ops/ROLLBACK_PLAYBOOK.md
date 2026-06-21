# Carelane Rollback Playbook

**Purpose:** production-safe rollback instructions for release windows.
**Rule:** prefer a clean rollback over a partial, uncertain rollout.

## When to rollback

Rollback is appropriate when any of the following occur:

- production startup fails
- health checks fail repeatedly
- migrations fail or data integrity is uncertain
- canonical workflow breaks
- auth or redirect safety fails
- a regression blocks pilot or production users
- monitoring indicates severe error or latency spikes

## Who decides

- Release captain owns the final go/no-go and rollback decision.
- Backend owner confirms technical feasibility of the chosen rollback.
- Ops owner executes infrastructure changes.
- QA owner verifies the rollback result.
- Security / identity owner is consulted when auth or secrets are involved.

## Frontend rollback steps

1. Identify the last known-good frontend build artifact or commit.
2. Redeploy the prior build or restore the prior static bundle.
3. Confirm the SPA loads without console-breaking errors.
4. Verify canonical navigation and entry routes.
5. Verify the released SHA matches the rollback target.

## Backend rollback steps

1. Identify the last known-good deploy SHA.
2. Redeploy the prior backend release or restore the previous application image.
3. Restart the application cleanly.
4. Verify health and auth endpoints.
5. Verify canonical case read paths.

## Database migration rollback policy

- Prefer forward-fix migrations whenever data loss risk is high.
- Only run reverse migrations if they are explicitly designed and tested for that release.
- If rollback requires database restore, treat it as a controlled restore drill and re-verify the data set.
- Never improvise a schema rollback in production without operator approval.

## Feature flag or config rollback options

Rollback via configuration is preferred when the issue is isolated to:

- pilot UI flags
- SSO enablement
- monitoring endpoints
- rollout hooks
- optional demo/bootstrap behavior

Examples:

- disable `CARELANE_PILOT_UI`
- disable `CARELANE_PILOT_SPA_ONLY`
- disable `SSO_ENABLED`
- remove a bad `RENDER_DEPLOY_HOOK_URL`

## Post-rollback verification

- [ ] app starts cleanly
- [ ] health check returns `200`
- [ ] auth flow is stable
- [ ] canonical workflow routes resolve
- [ ] no new 5xx spike remains
- [ ] known-good release SHA is active
- [ ] incident notes are recorded
- [ ] stakeholders are informed

## Evidence

Record each rollback here.

- Date: **2026-06-21**
- Trigger: pilot readiness gate (procedure rehearsal, not production incident)
- Decision owner: Haroon Wahed
- Rollback target: Render deploy `9f7aa53` (previous deploy same SHA — click-through still required in window)
- Outcome: HTTP `/_health/` 200 after wake; deploy history captured
- Verification result: pass — `reports/rollback_drill/rollback_rehearsal_20260621T094728Z.json`
- Notes: run `./scripts/run_rollback_rehearsal.sh`; execute one dashboard rollback before external pilot

