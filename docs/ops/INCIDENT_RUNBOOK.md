# Carelane — Incident Runbook

**Purpose:** step-by-step response procedure for production incidents.
**Owner:** Release captain — Haroon Wahed (haroonwahed@live.nl)
**Related docs:** [ROLLBACK_PLAYBOOK.md](./ROLLBACK_PLAYBOOK.md) · [PILOT_SUPPORT_AND_VERIFICATION.md](./PILOT_SUPPORT_AND_VERIFICATION.md) · [BACKUP_RESTORE_DRILL.md](./BACKUP_RESTORE_DRILL.md)

---

## Severity levels

| Level | Definition | Response target | Examples |
|-------|-----------|-----------------|---------|
| **P1** | Production is down or data is at risk | Immediate — 15 min | App returns 5xx, auth broken, suspected data breach, DB down |
| **P2** | Core workflow blocked for ≥1 user | 1 business hour | Document download fails, intake creation fails, matching action errors |
| **P3** | Degraded but functional | 4 business hours | Slow responses, non-critical UI error, email not sending |

Upgrade a P2 → P1 if it affects all users or involves data integrity.

---

## Detection sources

| Source | What it catches |
|--------|----------------|
| Sentry (SENTRY_DSN) | Unhandled exceptions, 500 errors — alerts you before users report |
| Render health check (`/_health/`) | App process crash, DB unreachable |
| User report via support@carelane.nl | Anything Sentry misses |
| Render dashboard | Deploy failures, service restarts, log spikes |
| Supabase dashboard | Connection pool exhaustion, replication lag, storage pressure |

---

## On-call contacts

| Role | Name | Contact | When to page |
|------|------|---------|-------------|
| Release captain / backend on-call | Haroon Wahed | haroonwahed@live.nl | Any P1 |
| Infra / Render | Haroon Wahed | haroonwahed@live.nl | Render service or Redis issues |
| Pilot user escalation | Haroon Wahed | haroonwahed@live.nl | User-blocking P2+ |

Escalation order for a P1: **detect → page release captain → diagnose → rollback or hotfix → verify → communicate**.

---

## P1 response procedure (first 15 minutes)

1. **Acknowledge** — confirm you have the incident. Note the time.
2. **Assess scope** — is it all users, one org, one route? Check Sentry and Render logs.
3. **Preserve evidence** — copy the relevant Sentry event URL and Render log window before rolling back.
4. **Decide: rollback or forward-fix?**
   - Rollback if the regression was introduced by the last deploy and a known-good SHA exists.
   - Forward-fix only if the issue predates the last deploy and rolling back would not help.
5. **Execute** — see playbooks below.
6. **Verify** — `GET /_health/` → 200, then open a canonical casus.
7. **Communicate** — notify pilot users (email to support channel) within 30 minutes.
8. **Record** — fill the evidence section at the bottom of this document.

---

## Common incident playbooks

### App returns 5xx / is unreachable

```
1. Render dashboard → check service status and recent deploys.
2. If a recent deploy: redeploy previous SHA (autoDeploy: false — manual trigger).
   See ROLLBACK_PLAYBOOK.md for step-by-step.
3. If no recent deploy: check logs for OOM, gunicorn worker crash, or DB error.
4. /_health/ hitting DB — if DB is the culprit, see "Database unreachable" below.
5. After redeploy: GET /_health/ → 200, login, open one casus.
```

### Database unreachable

```
1. Supabase dashboard → Project → Reports → check connection pool and errors.
2. If Supabase maintenance/outage: check status.supabase.com.
   Wait for resolution — no action required on Render side.
3. If connection pool exhausted: reduce GUNICORN_WORKERS to 1 in Render env vars,
   redeploy. Pool size = 25 by default; 1 worker × ~5 connections = safe margin.
4. If corruption suspected: stop writes (set maintenance mode or take service down),
   restore from backup per BACKUP_RESTORE_DRILL.md.
```

### Auth is broken (login returns error / redirect loop)

```
1. Check Sentry for the exact exception class and stack.
2. Common causes:
   a. DJANGO_SECRET_KEY rotated without session flush → users have invalid sessions.
      Fix: redeploy with old key, or flush sessions (django-admin clearsessions).
   b. OIDC misconfiguration (SSO_ENABLED=true but keys wrong) → disable SSO temporarily.
      Set SSO_ENABLED=0 in Render env vars and redeploy.
   c. ALLOWED_HOSTS / CSRF_TRUSTED_ORIGINS mismatch after domain change.
      Add the new domain to both env vars and redeploy.
3. Verify: open /care/login/, submit valid credentials, reach dashboard.
```

### Suspected cross-tenant data exposure (IDOR)

```
TREAT AS P1. DO NOT delay.

1. Immediately identify which user and which org are involved (Sentry + AuditLog).
2. Revoke the affected user's session:
   python manage.py shell -c "
   from django.contrib.sessions.models import Session
   from django.contrib.auth import get_user_model
   User = get_user_model()
   u = User.objects.get(username='AFFECTED_USER')
   Session.objects.filter(session_key__in=[
       s.session_key for s in Session.objects.all()
       if s.get_decoded().get('_auth_user_id') == str(u.pk)
   ]).delete()
   "
3. Preserve the AuditLog row (do not delete — it is append-only evidence).
4. Notify affected org within 72 hours per AVG Article 33.
5. Root-cause: check if get_scoped_object_or_404 was bypassed or a new view
   was added without the tenant backstop. See tenant_scoped.py.
6. Write a regression test before deploying a fix.
```

### Document download returns empty / 403

```
1. Check NGINX_MEDIA_ACCEL_REDIRECT in Render env vars.
   It must be "false" on Render (no nginx). If "true", set to "false" and redeploy.
2. If "false" and still failing, check FileField path and S3/media config.
3. Verify: login as gemeente, open a casus with a document, download it.
```

### Redis unreachable (rate limits / cache errors)

```
1. Render dashboard → carelane-redis service → check status.
2. If Redis is down, Django falls back to LocMemCache (per-worker) automatically.
   Rate limits are non-functional but the app stays up.
3. Restart the Redis service from the Render dashboard.
4. If persistent: set GUNICORN_WORKERS=1 so single-worker LocMemCache is consistent.
5. Verify: POST to auth login endpoint 6× — should get 429 on the 6th attempt.
```

---

## Communication template (P1)

```
Subject: [Carelane] Production incident — <brief description>

Hi <pilot contact>,

We are currently investigating an issue with Carelane:

- What is affected: <route / workflow / all users>
- Impact: <cannot log in / cannot save intakes / slow responses>
- Started at: <time>
- Status: investigating / fix deployed / resolved

We will update you within <30 min / 1 hour> or as soon as the issue is resolved.

— Carelane team
```

---

## Post-incident review (within 48 hours)

Required for every P1, recommended for P2.

1. Timeline: what happened and when.
2. Root cause: one sentence.
3. Detection gap: how long between incident start and detection?
4. Fix: what was changed.
5. Prevention: what test or guard would have caught this before production.
6. Action items: owner + due date.

Record below in the evidence section.

---

## Evidence log

| Date | Severity | Description | Duration | Owner | Resolution |
|------|----------|-------------|----------|-------|-----------|
| — | — | No incidents recorded | — | — | — |
