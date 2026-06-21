# Carelane Backup / Restore Drill

**Purpose:** evidence record for backup and restore readiness.  
**Stack:** Supabase Postgres (eu-west-1) + Render web service + optional Redis.

## Backup scope

The backup must cover:

- Postgres application data (Supabase — primary source of truth)
- migrations/schema state (in repo; verify after restore)
- uploaded documents in Django media storage (if not on Supabase storage — confirm deployment)
- operational audit trails (`AuditLog`, `CaseDecisionLog`, timeline events)

Exclude:

- local build artifacts (`client/build/`, `theme/static/spa/` — rebuild from CI)
- ephemeral Redis cache (safe to lose; reprovision empty)

## Supabase backup source (production)

Supabase Pro includes **daily automated backups** and point-in-time recovery (PITR) where enabled.

Before the drill:

1. Open Supabase project → **Database → Backups**.
2. Confirm latest backup timestamp and retention window.
3. Record project ref, region (`eu-west-1`), and backup identifier.

**Do not** run a production restore into production without explicit approval. Use a **staging / drill** project or Supabase branch.

## Restore scenario

Use a realistic failure scenario, for example:

- accidental deletion of a case / placement record
- bad migration requiring restore to a known-good point
- operator error during pilot data reset

The restore target should be a **non-production** validation environment unless leadership explicitly approves production restore.

## Restore steps (Supabase → staging Render)

1. **Record** source backup identifier and timestamp (Supabase dashboard).
2. **Provision** restore target:
   - Option A: new Supabase project restored from backup / PITR fork.
   - Option B: Supabase **branch** from backup (if available on plan).
3. **Point staging Render** `DATABASE_URL` at the restored database (Settings → Environment).
4. **Deploy** the same application SHA as production (or known-good tag).
5. **Migrate** if schema lag: `python manage.py migrate --noinput` (forward-only; do not reverse in prod without playbook approval).
6. **Start** service; verify `GET /_health/` → 200.
7. **Verify** canonical workflow (see [PILOT_DRY_RUN_CHECKLIST.md](../PILOT_DRY_RUN_CHECKLIST.md) steps 1–3 minimum).
8. **Verify** audit: known case has `CaseDecisionLog` rows and `AuditLog` entries.
9. **Document** RPO (data age at restore point) and RTO (wall-clock restore duration).

## Verification checklist

- [ ] Supabase backup visible and timestamp recorded
- [ ] Restore target identified (non-prod)
- [ ] Restore completed without errors
- [ ] Application boots against restored data
- [ ] `/_health/` returns `200`
- [ ] Login succeeds with a known test user
- [ ] One canonical case renders correctly
- [ ] Audit / timeline entries present for that case
- [ ] Document download works (`NGINX_MEDIA_ACCEL_REDIRECT=false` on Render)
- [ ] No data truncation or corruption observed
- [ ] Restore duration recorded
- [ ] Evidence attached to rollout record

## Target objectives (fill after first drill)

| Metric | Target (pilot) | Observed |
|--------|----------------|----------|
| RPO | ≤ 24 h (daily backup) or PITR window | **≤ 24 h** (Supabase automated; prod PITR not exercised) |
| RTO | ≤ 4 h (staging rehearsal) | **< 1 s** local SQLite; prod branch restore TBD |

## Quick SQL sanity check (post-restore)

```sql
SELECT COUNT(*) FROM contracts_carecase;
SELECT COUNT(*) FROM contracts_casedecisionlog;
SELECT MAX(created_at) FROM contracts_casedecisionlog;
```

## Evidence: first completed drill

- Date: **2026-06-21**
- Backup source: rehearsal SQLite + read-only Supabase Postgres (`27` cases / `31` decision logs)
- Restore target: local `db_rehearsal.sqlite3` (non-prod)
- Backup size / age at restore point: **2,457,600 bytes** / point-in-time copy
- Restore duration: **< 1 s**
- RPO observed: **0** (local file copy); Supabase daily backup assumed
- RTO observed: **< 1 s** local; production Supabase branch restore pending
- Verification result: **pass**
- Owner: Haroon Wahed
- Notes: `reports/backup_drill/backup_restore_drill_20260621T094702Z.json`; refresh via `./scripts/run_backup_restore_drill.sh --verify-live-db`
