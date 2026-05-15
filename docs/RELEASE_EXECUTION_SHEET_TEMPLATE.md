# CareOn release execution sheet (template)

Copy this file to `docs/RELEASE_EXECUTION_SHEET_<YYYY-MM-DD>.md` (or store outside the repo) and fill every field during the rollout. Cross-link the dated sheet from `docs/RELEASE_ROLLOUT_CHECKLIST.md` for that release.

**Related:** `docs/RELEASE_ROLLOUT_CHECKLIST.md`, `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`, `docs/PILOT_PROOF_PACKAGE.md`

---

## Release metadata

| Field | Value |
|-------|--------|
| Release date | |
| Timezone | `Europe/Amsterdam` |
| `RELEASE_SHA` | |
| Branch | |
| Staging window (start–end) | |
| Production window (start–end) | |

## Owner assignments

| Role | Primary | Backup |
|------|---------|--------|
| Release captain | | |
| Backend owner | | |
| Ops owner | | |
| QA owner | | |

## Staging

| Step | Planned time | Actual time | Evidence / notes |
|------|----------------|-------------|------------------|
| Preflight (backup, SHA, window) | | | |
| Deploy (checkout, deps, migrate, static, restart) | | | |
| Verification (`check`, smoke, canonical flow) | | | |
| Sign-off | | | |

## Production

| Step | Planned time | Actual time | Evidence / notes |
|------|----------------|-------------|------------------|
| Preflight (rollback owner, backup) | | | |
| Deploy | | | |
| Verification (`check --deploy`, smoke, monitoring) | | | |
| Sign-off | | | |

## Rollback / incidents

| Event | Time | Action | Owner |
|-------|------|--------|-------|
| | | | |

## Follow-ups

- [ ] Tickets filed:
- [ ] Evidence archived (CI artifact / bundle path):
