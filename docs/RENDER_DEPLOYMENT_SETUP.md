# Render Deployment Setup Guide

## Prerequisites

This guide explains how to deploy Careon to Render with proper database configuration.

## Initial Deployment Steps

### 1. Create a PostgreSQL Database (Recommended)

- In Render dashboard, create a new PostgreSQL instance.
- Render will automatically generate a `DATABASE_URL` and add it to your environment.
- This is the preferred approach for production.

### 2. Manual Database URL Setup (Alternative)

If using an external PostgreSQL database:

- In your Render service settings, go to **Environment** variables.
- Set `DATABASE_URL` to your PostgreSQL connection string:

```text
postgresql://username:password@host:port/dbname
```

- Ensure the connection string uses `postgresql://` or `postgres://` protocol.

### 3. Configure Other Required Environment Variables

The following variables must be set in Render's dashboard. They have `sync: false` in `render.yaml`.

| Variable | Example | Purpose |
| -------- | ------- | ------- |
| `ALLOWED_HOSTS` | `your-app.render.com` | Allowed domain names |
| `CSRF_TRUSTED_ORIGINS` | `https://your-app.render.com` | CSRF validation origins |
| `DEFAULT_FROM_EMAIL` | `noreply@careon.nl` | Email sender address |

### Staging pilot (demo logins + Playwright)

When the staging DB is empty or missing `demo_gemeente`, set:

| Variable | Example | Purpose |
| -------- | ------- | ------- |
| `PILOT_AUTO_BOOTSTRAP` | `1` | On web boot: `migrate` then `bootstrap_staging_pilot`. |
| `E2E_DEMO_PASSWORD` | `pilot_demo_pass_123` | Password for `demo_gemeente` and demo provider users (must match Playwright). |

If `demo_gemeente` already exists, boot runs `seed_pilot_e2e` only (password sync). Full wipe: set `PILOT_FORCE_RESET=1` in the dashboard, redeploy **once**, then remove it.

**Auto-deploy from GitHub:** the service has `autoDeploy: yes` on `main`. CI can also trigger deploys via workflow **Render deploy (staging)** using either:

- GitHub secret `RENDER_DEPLOY_HOOK_URL` (dashboard deploy hook), or
- GitHub secret `RENDER_API_KEY` + repository variable `RENDER_SERVICE_ID` (`srv-d7h4h5jbc2fs738ol9a0`) — POST to Render API `/v1/services/{id}/deploys`.

Sign-off from CI or laptop:

```bash
./scripts/wait_staging_spa_deploy.sh   # optional: wait for new SPA hash
./scripts/staging_pilot_signoff.sh
```

Remote seed (when `STAGING_DATABASE_URL` is available locally or in CI secrets): `./scripts/staging_pilot_signoff.sh --seed` or `--force-reset`.

## Deployment Flow

### Build Phase

1. Install Python and Node.js dependencies. Full Django tests run in GitHub Actions (for example `.github/workflows/platform-guardrails.yml`), not on Render build; `render.yaml` runs `manage.py check` after `pip install` as a fast configuration gate.
2. Build the frontend.
3. Collect Django static files.
4. If `DATABASE_URL` is set, run Django migrations.
5. If `DATABASE_URL` is not set, skip migrations and use the SQLite fallback for build.

### Startup Phase

1. Run production startup checks.
2. Start Gunicorn server on port `$PORT`.

## Troubleshooting

### Error: "could not translate host name to address"

**Cause:** `DATABASE_URL` is either not set or contains an invalid hostname such as `your_db_host`.

**Solution:**

1. Check Render dashboard -> Environment variables.
2. Verify `DATABASE_URL` is properly set.
3. Redeploy the service.

For a field-by-field checklist of the production environment values, see:

- [`docs/RENDER_ENV_FIX_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RENDER_ENV_FIX_CHECKLIST.md)

### Migrations Not Running

- If `DATABASE_URL` is empty, build-time migrations are skipped.
- Manually run migrations:

```bash
render bash
python manage.py migrate --settings=config.settings
```

### Static Files Not Loading

- Ensure `npm run build` succeeds in build logs.
- Check that `theme/static/spa/` is properly populated with SPA assets.

## Database-First vs Build-First Approach

**Current Implementation (Recommended):**

- Build phase tries to run migrations only if DB is available.
- Startup phase runs production startup checks before starting the app.
- This keeps boot fast and avoids blocking on a long or locked migration during Render startup.

**Benefits:**

- Migrations can still run during build when the database is available.
- Build succeeds even if the database is not ready yet.
- Multiple replicas can coexist because startup no longer competes over the same migration step.
