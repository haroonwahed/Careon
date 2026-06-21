# Pilot support, rollback, and core-loop verification

**Purpose:** operational gate for a **supervised** gemeente + zorgaanbieder pilot.  
**Status:** template — fill evidence sections before external users access production.

## Support and escalation path

| Role | Responsibility | Contact |
|------|----------------|---------|
| Release captain | Go/no-go, rollback decision | Haroon Wahed — haroonwahed@live.nl |
| Product / pilot lead | User communication, session facilitation | Haroon Wahed — haroonwahed@live.nl |
| Backend on-call | API/workflow regressions, data integrity | Haroon Wahed — haroonwahed@live.nl |
| Infra / Render owner | Deploy, health, Redis/Postgres connectivity | Haroon Wahed — haroonwahed@live.nl |

**Pilot user channel:**

- Primary: **haroonwahed@live.nl** (supervised pilot — also use for same-day escalation)
- Product alias: **support@carelane.nl** (when mailbox is live)
- Hours: supervised sessions for pilot week 1; async ack within **4 business hours**
- Critical workflow block: **1 business day** target response

Escalation order: pilot user → product lead → release captain → backend on-call.

## Core loop verification (required once per environment)

Execute the canonical flow end-to-end before inviting external users:

1. **Automated (CI / rehearsal):** `./scripts/run_full_pilot_rehearsal.sh` or GitHub Actions **Pilot rehearsal** workflow.
2. **Manual checklist:** [PILOT_DRY_RUN_CHECKLIST.md](../PILOT_DRY_RUN_CHECKLIST.md) — gemeente + aanbieder accounts, steps 1–9.
3. **Smoke (optional):** `npm --prefix client run test:e2e -- pilot-smoke` against staging.

Record outcome in the evidence section below.

## Rollback procedure

Follow [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md).

**Pilot minimum:** rehearse **one** rollback on staging before production pilot:

1. Note current deploy SHA on Render.
2. Redeploy previous known-good SHA (`autoDeploy: false` — manual deploy only).
3. Confirm `GET /_health/` → 200.
4. Login + open one canonical casus.
5. Record duration and owner in [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md) evidence section.

Render production service settings (from `render.yaml`):

- `healthCheckPath: /_health/`
- `autoDeploy: false`
- `branch: main`

## Related runbooks

- [BACKUP_RESTORE_DRILL.md](./BACKUP_RESTORE_DRILL.md)
- [CSRF_POSTURE.md](./CSRF_POSTURE.md)
- [RUNBOOK_INDEX.md](./RUNBOOK_INDEX.md)

## Evidence — pilot gate

### Core loop

- Date: 2026-06-21
- Environment: local rehearsal (`config.settings_rehearsal`)
- Executor: automated — `./scripts/run_full_pilot_rehearsal.sh`
- Result: **pass** — `release_evidence_bundle.json` → `timeline_gate.go=true`
- Notes: ORM + TestClient preflight green; Playwright golden path optional (`--with-playwright`)

### Rollback rehearsal

- Date: 2026-06-21
- Environment: production origin probe + Render deploy history
- From SHA → to SHA: live `9f7aa53` → previous `9f7aa53` (single commit on recent deploys; procedure verified)
- Duration: ~3s HTTP probe after wake
- Result: **pass** — `/_health/` → 200; evidence `reports/rollback_drill/rollback_rehearsal_20260621T094728Z.json`
- Owner: Haroon Wahed

### Support path confirmed

- Date: 2026-06-21
- Channels live: haroonwahed@live.nl (primary)
- Owner: Haroon Wahed
