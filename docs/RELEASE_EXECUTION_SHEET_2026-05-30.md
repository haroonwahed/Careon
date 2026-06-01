# CareOn release execution sheet — 2026-05-30

Working draft for the next rollout. Fill this during the actual staging-to-production handoff and keep the evidence in sync with `docs/RELEASE_ROLLOUT_CHECKLIST.md`.

**Related:** `docs/RELEASE_ROLLOUT_CHECKLIST.md`, `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`, `docs/PILOT_PROOF_PACKAGE.md`

---

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
- backup or secrets are unconfirmed
- the rollout window is not scheduled
- deploy verification cannot be run
- monitoring access is unavailable

---

## Release metadata

| Field | Value |
|-------|--------|
| Release date | 2026-05-30 |
| Timezone | `Europe/Amsterdam` |
| `RELEASE_SHA` | `ca146bdc` |
| Branch | `main` |
| Staging window (start–end) | `GO` already recorded on 2026-05-29 |
| Production window (start–end) | not scheduled |

## Owner assignments

| Role | Primary | Backup |
|------|---------|--------|
| Release captain | Product / engineering lead | Backend owner |
| Backend owner | Application engineer | Release captain |
| Ops owner | Infrastructure / DevOps | Backend owner |
| QA owner | Test / verification owner | Release captain |

## Staging

| Step | Planned time | Actual time | Evidence / notes |
|------|----------------|-------------|------------------|
| Preflight (backup, SHA, window) | done | 2026-05-29 | Staging sign-off already GO |
| Deploy (checkout, deps, migrate, static, restart) | done | 2026-05-29 | `ca146bdc` on staging Render |
| Verification (`check`, smoke, canonical flow) | done | 2026-05-29 | `staging_pilot_signoff.sh` GO |
| Sign-off | done | 2026-05-29 | Staging sign-off GO |

## Production

Use this section during the actual production handoff. Fill each field in order and keep `docs/RELEASE_ROLLOUT_CHECKLIST.md` in sync.

### Required production inputs

Fill these before starting the production window:

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

If a field is not known yet, leave it blank and mark it `pending` in the rollout checklist instead of guessing.

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

### Window scheduling

| Field | Value |
|-------|--------|
| Proposed date | pending |
| Proposed start time | pending |
| Proposed end time | pending |
| Confirmed by | pending |
| Notes | pending |
| Example format | `2026-06-03 09:00-10:30` (replace with the actual window) |

### Green light criteria

- [ ] Release captain, backend owner, ops owner, and QA owner are assigned.
- [ ] Production window is confirmed.
- [ ] Backup exists and is recent.
- [ ] Secrets/env readiness is confirmed.
- [ ] Monitoring access is confirmed.
- [ ] Rollback owner is confirmed.
- [ ] Local release-confidence checks are green.

### Go / No-Go checklist

| Item | Status |
|------|--------|
| Production window is confirmed and calendar-blocked | pending |
| Release captain, backend owner, ops owner, and QA owner are assigned | pending |
| Rollback owner and rollback path are confirmed | pending |
| Backup reference and timestamp are recorded | pending |
| Secrets/env readiness is confirmed | pending |
| Monitoring access is confirmed | pending |
| `OIDC_RP_CLIENT_SECRET` rotation is complete or explicitly not needed | pending |
| Local release-confidence checks are green | pending |
| Production preflight is green on the intended release SHA | pending |
| Deploy, migrate, collectstatic, and restart plan are ready | pending |
| Smoke checks and monitoring watch window are scheduled | pending |
| Sign-off owner understands abort triggers and rollback decision point | pending |

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

### Run order

1. Confirm production window and rollback ownership.
2. Confirm backup reference and timestamp.
3. Confirm secrets/env readiness and monitoring access.
4. Record checkout and deploy SHA.
5. Run migrations.
6. Collect static assets.
7. Restart the service.
8. Run `check --deploy`, terminology guard, and smoke checks.
9. Start monitoring watch window.
10. Record sign-off and evidence bundle path.

### Quick checklist

- [ ] Window open
- [ ] Rollback owner confirmed
- [ ] Backup confirmed
- [ ] Secrets/env confirmed
- [ ] Monitoring access confirmed
- [ ] SHA checked out
- [ ] Migrations applied
- [ ] Static collected
- [ ] Service restarted
- [ ] `check --deploy` clean
- [ ] Smoke tests green
- [ ] Watch window started
- [ ] Watch window ended
- [ ] Sign-off recorded

### Preflight evidence

| Field | Value |
|-------|--------|
| Production window confirmed | pending |
| Rollback owner confirmed | pending |
| Backup reference | pending |
| Backup age / timestamp | pending |
| Monitoring access confirmed | pending |
| Secrets/env readiness confirmed | pending |

| Step | Planned time | Actual time | Evidence / notes |
|------|----------------|-------------|------------------|
| Preflight (rollback owner, backup) | pending | | Production promotion not started |
| Deploy | pending | | Wait for production window and backup confirmation |
| Verification (`check --deploy`, smoke, monitoring) | pending | | Wait for deploy |
| Sign-off | pending | | Wait for monitoring watch window |

### Production checklist

- [ ] Production window is confirmed and open.
- [ ] Rollback owner is confirmed.
- [ ] Backup reference is recorded.
- [ ] Backup timestamp is recorded.
- [ ] Secrets and environment readiness are confirmed.
- [ ] Monitoring access is confirmed.
- [ ] Deploy SHA is recorded.
- [ ] Checkout timestamp is recorded.
- [ ] `migrate --noinput` has completed successfully.
- [ ] `collectstatic --noinput` has completed successfully.
- [ ] Service restart is confirmed.
- [ ] `check --deploy` output is recorded.
- [ ] Terminology guard output is recorded.
- [ ] Dashboard returns `200`.
- [ ] Canonical `/care/` route returns `200`.
- [ ] Smoke test result is recorded.
- [ ] Monitoring watch start is recorded.
- [ ] Monitoring watch end is recorded.
- [ ] All-clear timestamp is recorded.
- [ ] Open defects are logged with owner and next step.
- [ ] Evidence bundle path is recorded.

### Production deploy details

| Field | Value |
|-------|--------|
| Deployed SHA | pending |
| Checkout timestamp | pending |
| `migrate --noinput` output | pending |
| `collectstatic --noinput` output | pending |
| Restart confirmation | pending |
| App health check | pending |

### Production verification details

| Field | Value |
|-------|--------|
| `check --deploy` output | pending |
| Terminology guard output | pending |
| Dashboard `200` | pending |
| Canonical `/care/` `200` | pending |
| Smoke test result | pending |
| Monitoring watch start | pending |
| Monitoring watch end | pending |

### Sign-off details

| Field | Value |
|-------|--------|
| All-clear timestamp | pending |
| Open defects | pending |
| Rollback not needed | pending |
| Evidence bundle path | pending |

## Rollback / incidents

| Event | Time | Action | Owner |
|-------|------|--------|-------|
| | | | |

## Follow-ups

- [ ] Production window scheduled
- [ ] Production backup reference recorded
- [ ] Production deploy SHA recorded
- [ ] `check --deploy` output archived
- [ ] Smoke-test results archived
- [ ] Evidence bundle / drill log updated
