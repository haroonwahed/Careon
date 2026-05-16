# CareOn release execution sheet — pilot rehearsal gate

Release date: **2026-05-16** (updated)  
Timezone: **Europe/Amsterdam**  
Release SHA: **`ca146bdc`** (staging sign-off GO; full demo seed on Render)  
Branch: **`main`**  

## Pilot rehearsal (pre-staging) — local

| Check | Command | Status | Notes |
|-------|---------|--------|-------|
| Full rehearsal + Playwright | `./scripts/run_full_pilot_rehearsal.sh --with-playwright` | **GO** (2026-05-15 ~07:35 UTC) | Steps 1–8 OK; Playwright **12 passed / 1 skipped** |
| Timeline gate | `reports/release_evidence_bundle.json` → `timeline_gate.go` | **GO** | `release_evidence_bundle: GO` |
| Bundle schema | `./.venv/bin/python scripts/verify_release_evidence_bundle.py reports/release_evidence_bundle.json` | **OK** | |
| Headless only (optional) | `./scripts/run_full_pilot_rehearsal.sh` | **GO** (earlier 2026-05-15) | Same reports under `reports/` |

## CI (GitHub Actions)

| Check | Command | Status | Notes |
|-------|---------|--------|-------|
| PR #1 merge | https://github.com/haroonwahed/Careon/pull/1 | **Merged** (squash) | CI green after CI fixes (Django 5.2.14, deploy SSL, grep, npm audit --omit=dev, clientLabel) |
| Pilot rehearsal workflow | `gh workflow run pilot-rehearsal.yml -f with_playwright=true` | **GO** (2026-05-15) | https://github.com/haroonwahed/Careon/actions/runs/25911242272 — artifact `pilot-rehearsal-25911242272` |

## Owner assignments

| Role | Primary | Backup |
|------|---------|--------|
| Release captain | Haroon Wahed | Backend owner |
| Backend owner | Haroon Wahed | Release captain |
| Ops owner | Haroon Wahed | Backend owner |
| QA owner | Haroon Wahed | Release captain |

## Staging deploy (fill timestamps in `Europe/Amsterdam`)

Use [`RELEASE_ROLLOUT_CHECKLIST.md`](./RELEASE_ROLLOUT_CHECKLIST.md) for full steps. Minimum smoke after staging deploy:

| Step | Owner | Target | Actual | Evidence |
|------|-------|--------|--------|----------|
| Staging preflight | Ops + Release captain | T-90m | **Done** (2026-05-16) | `main` on Render; `PILOT_AUTO_BOOTSTRAP=1`, `PILOT_FULL_DEMO_SEED=1`, `E2E_DEMO_PASSWORD=pilot_demo_pass_123` |
| Staging deploy | Backend + Ops | T-60m | **Done** | Deploy `ca146bdc` live; migrations `0071`–`0076` for Postgres drift |
| Staging smoke | QA | T-45m | **Done** | Shell **8/8**; `./scripts/staging_pilot_signoff.sh` **GO** (9 Playwright passed, 3 skipped) |
| Staging sign-off | Release captain | T-30m | **Done** | `https://careon-web.onrender.com`; provider deep smoke **6–9/9** |

**Staging smoke commands** (on staging host, rehearsal-equivalent DB or pilot seed):

```bash
export DJANGO_SETTINGS_MODULE=config.settings_rehearsal  # or staging settings
./scripts/run_full_pilot_rehearsal.sh
./.venv/bin/python scripts/verify_release_evidence_bundle.py reports/release_evidence_bundle.json
# Optional browser proof (same as local):
./scripts/run_full_pilot_rehearsal.sh --with-playwright
```

**Post-deploy UI** (live URL): gemeente `/care/casussen`, `/regiekamer`; provider `/care/beoordelingen` — see [`POST_DEPLOY_VERIFICATION_CHECKLIST.md`](./POST_DEPLOY_VERIFICATION_CHECKLIST.md).

## Production preflight (local, not promoted)

| Check | Command | Status | Notes |
|-------|---------|--------|-------|
| Go-live preflight | `./scripts/production_go_live_preflight.sh` | **GO** (2026-05-16) | 176 Must-band tests OK; client build OK; `check --deploy` needs `PREFLIGHT_POSTGRES_URL` or `STAGING_DATABASE_URL` (Render internal URL from dashboard) |
| Provider reject E2E | `provider-review-smoke` reject test | **Fix** (`eff34bd2`+) | Map SPA slug `geen_capaciteit` → `CAPACITY`; remove misleading placement-action fallback for providers |

## Production deploy

Copy production rows from [`RELEASE_EXECUTION_SHEET_TEMPLATE.md`](./RELEASE_EXECUTION_SHEET_TEMPLATE.md) when production promotion is scheduled.

## Evidence paths

- Local: `reports/rehearsal_report.json`, `reports/rehearsal_timeline_evidence.json`, `reports/release_evidence_bundle.json`, `reports/rehearsal_verify.log`
- CI artifact (after workflow on remote): GitHub Actions **Pilot rehearsal (release evidence)** → `reports/pilot-<run_id>/`
- Doctrine: [`PILOT_PROOF_PACKAGE.md`](./PILOT_PROOF_PACKAGE.md)
