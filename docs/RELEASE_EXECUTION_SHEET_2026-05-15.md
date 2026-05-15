# CareOn release execution sheet — pilot rehearsal gate

Release date: **2026-05-15**  
Timezone: **Europe/Amsterdam**  
Release SHA: **`88061c88`** (squash merge of PR #1 to `main`)  
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
| Staging preflight | Ops + Release captain | T-90m | **Pending** | Deploy **`88061c88`** to `https://careon-web.onrender.com` (Render auto-deploy if wired) |
| Staging deploy | Backend + Ops | T-60m | **Pending** | migrate, collectstatic, restart |
| Staging smoke | QA | T-45m | **Partial** (2026-05-15) | Shell **8/8** `staging_v1_shell_smoke.sh` **OK**; Playwright auth **failed** on Render (pre-deploy SPA + non-rehearsal DB). Host rehearsal **after deploy**. |
| Staging sign-off | Release captain | T-30m | **Pending** | After host rehearsal + authenticated routes |

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
