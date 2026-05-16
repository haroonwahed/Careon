# CareOn release execution sheet — pilot rehearsal gate

Release date: **2026-05-15**  
Timezone: **Europe/Amsterdam**  
Release SHA: **`49ed09dc`** (staging password sync; deploy hook workflow)  
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
| Staging preflight | Ops + Release captain | T-90m | **Blocked** (2026-05-16) | Live host still on SPA `index-CqItJNes.js`; `main` @ `49ed09dc` not built on Render (no auto-deploy in 15m poll). Use manual deploy or `RENDER_DEPLOY_HOOK_URL`. |
| Staging deploy | Backend + Ops | T-60m | **Pending** | Render: deploy latest `main`, clear build cache; env `PILOT_AUTO_BOOTSTRAP=1`, `E2E_DEMO_PASSWORD=pilot_demo_pass_123` |
| Staging smoke | QA | T-45m | **Partial** | Shell **8/8** OK; Playwright **0/3** (stale SPA + login). After deploy: `./scripts/staging_pilot_signoff.sh` |
| Staging sign-off | Release captain | T-30m | **Pending** | After `./scripts/staging_pilot_signoff.sh` GO |

**Staging smoke commands** (on staging host, rehearsal-equivalent DB or pilot seed):

```bash
export DJANGO_SETTINGS_MODULE=config.settings_rehearsal  # or staging settings
./scripts/run_full_pilot_rehearsal.sh
./.venv/bin/python scripts/verify_release_evidence_bundle.py reports/release_evidence_bundle.json
# Optional browser proof (same as local):
./scripts/run_full_pilot_rehearsal.sh --with-playwright
```

**Post-deploy UI** (live URL): gemeente `/care/casussen`, `/regiekamer`; provider `/care/beoordelingen` — see [`POST_DEPLOY_VERIFICATION_CHECKLIST.md`](./POST_DEPLOY_VERIFICATION_CHECKLIST.md).

## Production

Copy production rows from [`RELEASE_EXECUTION_SHEET_TEMPLATE.md`](./RELEASE_EXECUTION_SHEET_TEMPLATE.md) when the staging sign-off is complete.

## Evidence paths

- Local: `reports/rehearsal_report.json`, `reports/rehearsal_timeline_evidence.json`, `reports/release_evidence_bundle.json`, `reports/rehearsal_verify.log`
- CI artifact (after workflow on remote): GitHub Actions **Pilot rehearsal (release evidence)** → `reports/pilot-<run_id>/`
- Doctrine: [`PILOT_PROOF_PACKAGE.md`](./PILOT_PROOF_PACKAGE.md)
