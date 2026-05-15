# CareOn release execution sheet — pilot rehearsal gate

Release date: **2026-05-15**  
Timezone: **Europe/Amsterdam**  
Release SHA: **`5204b85`** (local rehearsal; commit on `main` — push branch with pilot changes before staging deploy)  
Branch: **`main`** (worktree had uncommitted pilot/E2E changes at rehearsal time)  

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
| Pilot rehearsal workflow | Push `.github/workflows/pilot-rehearsal.yml`, then `gh workflow run pilot-rehearsal.yml -f with_playwright=true` | **Pending push** | Workflow file not on remote yet at rehearsal time |

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
| Staging preflight | Ops + Release captain | T-90m | | SHA, backup ref, `manage.py check` |
| Staging deploy | Backend + Ops | T-60m | | migrate, collectstatic, restart |
| Staging smoke | QA | T-45m | | Below |
| Staging sign-off | Release captain | T-30m | | Open issues list |

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
