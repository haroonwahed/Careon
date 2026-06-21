# Render infrastructure sync (pilot)

**Purpose:** align live Render services with `render.yaml` (Redis, health check, auto-deploy).

## Current gap (2026-06-21)

Live service `carelane` (`srv-d8rb0gmgvqtc73er8lpg`) was created manually and does **not** yet include:

| Setting | `render.yaml` | Live service |
|---------|---------------|--------------|
| `carelane-redis` | declared | **missing** — create via Blueprint |
| `healthCheckPath` | `/_health/` | empty — set in dashboard |
| `autoDeploy` | `false` | `yes` — disable in dashboard |
| `GUNICORN_WORKERS` | `1` (until Redis live) | uses Render default |

## Provision Redis + sync Blueprint

1. Render Dashboard → **Blueprints** → **New Blueprint Instance** (or sync existing) → point at `haroonwahed/Carelane` repo, branch `main`, file `render.yaml`.
2. Confirm resources created:
   - `carelane-redis` (Key Value, Frankfurt)
   - `carelane` web service env `REDIS_URL` linked from Redis
   - optional `carelane-staging` (separate Supabase project required)
3. On web service **Environment**, verify:
   - `REDIS_URL` populated
   - `NGINX_MEDIA_ACCEL_REDIRECT=false`
   - `GUNICORN_WORKERS=1` (raise to `2` only after Redis health confirmed)
4. **Settings → Health Check Path:** `/_health/`
5. **Settings → Auto-Deploy:** **Off** (manual deploy via deploy hook or dashboard)
6. Redeploy once after env changes.

## Verify after sync

```bash
curl -sf https://carelane.onrender.com/_health/
./scripts/run_rollback_rehearsal.sh
```

Redis smoke (SSH or one-off job):

```bash
# After REDIS_URL is set on the web service
python -c "import os,redis; r=redis.from_url(os.environ['REDIS_URL']); r.ping(); print('PONG')"
```

## CLI limits

Render CLI v2.17 cannot create Key Value (Redis) services — use Blueprint or dashboard. Health check path updates via CLI may not persist; use dashboard if CLI returns empty `healthCheckPath`.
