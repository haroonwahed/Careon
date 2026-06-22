# Carelane — Production Readiness Status

**Last updated:** 2026-06-21
**Branch:** main
**Tests:** 968 backend passed · 226 frontend passed · tsc 0 errors

---

## 30-day pilot items

| # | Item | Status | Evidence |
|---|------|--------|---------|
| 1 | HTTPS + HSTS on Render | ✅ done | render.yaml `headers` block |
| 2 | ALLOWED_HOSTS + CSRF_TRUSTED_ORIGINS locked | ✅ done | settings_production.py |
| 3 | Sentry DSN wired, PII off | ✅ done | sentry-sdk[django]==2.59.0, send_default_pii=False |
| 4 | Tenant isolation CI gate | ✅ done | .github/workflows/platform-guardrails.yml |
| 5 | Audit log on state transitions | ✅ done | log_transition_event(strict=True) |
| 6 | Rollback rehearsal logged | ✅ done | ROLLBACK_PLAYBOOK.md evidence section |
| 7 | Health check endpoint | ✅ done | /_health/ → contracts/views/system.py:54 |
| 8 | Backup restore drill | ✅ done | BACKUP_RESTORE_DRILL.md |
| 9 | CSRF enforcement (SPA @csrf_exempt removed) | ✅ done | contracts/api/intake.py, cases.py, classification.py |
| 10 | Fail-closed tenant DB backstop | ✅ done | tenant_scoped.py + _in_request ContextVar |
| 11 | Invite-only onboarding gate | ✅ done | CARELANE_INVITE_ONLY_ONBOARDING env var |

---

## 90-day items

| # | Item | Status | Evidence |
|---|------|--------|---------|
| 12 | Observability: Sentry + structured logging + correlation IDs | ✅ done | OperationalObservabilityMiddleware, OBSERVABILITY_CHECKLIST.md |
| 13 | Staging isolation (separate DB, separate Render service) | ✅ done | render.yaml carelane-staging + settings_staging.py |
| 14 | Dead CBV removal (CaseIntakeListView) | ✅ done | contracts/views/intake.py, contracts/views/__init__.py |
| 15 | E2E staging smoke test unskipped | ✅ done | client/tests/e2e/staging-shell-smoke.spec.ts |
| 16 | CSRF posture documented | ✅ done | docs/ops/CSRF_POSTURE.md |
| 17 | Audit log retention command (prune_audit_logs) | ✅ done | contracts/management/commands/prune_audit_logs.py |
| 18 | Invite-only activation flag in render.yaml | ✅ done | render.yaml CARELANE_INVITE_ONLY_ONBOARDING: "1" |

---

## Production readiness checklist additions (this session)

| Item | Deliverable | Location |
|------|------------|---------|
| Incident runbook + on-call path | P1/P2/P3 severity, 6 common playbooks, AVG 72h breach guidance | docs/ops/INCIDENT_RUNBOOK.md |
| Load test at expected peak | Locust script: gemeente + provider roles, p95 ≤ 2 s threshold | scripts/loadtest.py |
| Load test dependencies | requirements/loadtest.txt (locust==2.37.1) | requirements/loadtest.txt |

---

## Running the load test

```bash
pip install -r requirements/loadtest.txt

# Against local dev server (seed data required):
locust -f scripts/loadtest.py --host http://localhost:8000 \
  --users 5 --spawn-rate 1 --run-time 2m

# Against staging (headless, thresholds printed at end):
GEMEENTE_USER=demo_gemeente GEMEENTE_PASS=<pass> \
PROVIDER_USER=demo_aanbieder1 PROVIDER_PASS=<pass> \
locust -f scripts/loadtest.py --headless \
  --host https://carelane-staging.onrender.com \
  --users 15 --spawn-rate 2 --run-time 3m
```

Thresholds enforced by the script: p95 ≤ 2000 ms, error rate < 1 %.
Exit code 1 if either threshold is breached.

---

## Known gaps (accepted risks, not blocking pilot)

| Gap | Risk | Mitigation |
|-----|------|-----------|
| CaseDecisionLog not tenant-scoped | No direct org FK — cross-join required | Accessed only via tenant-scoped CareCase; indirect isolation |
| Redis free tier (Render) | allkeys-lru eviction | Rate limit degrades to per-worker LocMemCache; app stays up |
| ~~Media files on ephemeral Render FS~~ | ~~Files lost on redeploy~~ | ✅ Fixed: Render Disk (1 GB, `/opt/render/project/storage`) + `MEDIA_ROOT` env var |
| ~~1 gunicorn worker~~ | ~~Low throughput ceiling~~ | ✅ Fixed: `GUNICORN_WORKERS: "2"` — Redis in same Blueprint, guard in settings_production.py |
