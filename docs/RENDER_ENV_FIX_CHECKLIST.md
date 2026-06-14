# Render Environment Fix Checklist

Use this when a Render deploy fails because production settings are missing or malformed.

## Problem Statement

The production startup path requires a real PostgreSQL `DATABASE_URL`. If Render has an empty value or a placeholder value, startup fails before Django can finish booting.

## Local staticfiles refresh for UI verification

When you are checking CareOn theme or login page changes locally, stale hashed static assets can make the page look unchanged or broken even after the source CSS/template has been updated. This is a local render-verify issue, not a product defect.

### Symptoms of stale staticfiles

- CSS or JS changes do not appear in the browser after editing templates or theme assets.
- The page renders with old styling, missing layout changes, or fallback/error output.
- A new local server session still serves an older hashed asset path from the manifest.

### Refresh command

Run this from the project root when you need a fresh local render verification:

```bash
DATABASE_URL=sqlite:///db.sqlite3 python manage.py collectstatic --noinput
```

If your local environment uses the bundled Codex runtime Python, use that interpreter instead of the system Python.

### Verification step

After refreshing, restart the local Django server and reload the page you are checking. Confirm the updated CSS/template now renders as expected.

### Generated artifacts

`collectstatic` writes generated files under `staticfiles/`. Keep those artifacts out of commits unless the project convention explicitly requires them for the change you are making.

## Start command drift (your logs look “old”)

If deploy logs still show **`Starting careon-web revision=`** and **“Set it on the careon-web service”**, but this repo’s **`render.yaml`** uses **`Starting web revision=`**, different `DATABASE_URL` error text, and a direct **gunicorn startup** after `render_startup_checks.py`, then Render is **not** running the current `startCommand` from Git — usually because the service has a **manual Start Command** saved in the dashboard (from an older setup) that overrides the blueprint.

**Fix:** Render requires a **non-empty** Start Command. Use a **one-liner** so it never drifts from the repo:

```bash
bash scripts/render_start_command.sh
```

Put that in **Dashboard → your web service → Settings → Start Command**, save, redeploy. The real logic lives in **`scripts/render_start_command.sh`** on `main` (same script `render.yaml` uses).

Alternatively, copy-paste the full script from that file if your deploy layout cannot run `bash` from the repo root (unusual on Render).

## Required Variables

Fill these in on **the Python web service that runs your Django start command** (in `render.yaml` the default name is `careon-web`; your dashboard name may differ).

| Variable | Required value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require` | Must be a real PostgreSQL DSN. `postgres://` is also accepted. |
| `ALLOWED_HOSTS` | `<your-render-service-hostname>,<your-custom-domain-if-any>` | Use the actual public hostnames that should serve the app. |
| `CSRF_TRUSTED_ORIGINS` | `https://<your-render-service-hostname>,https://<your-custom-domain-if-any>` | Must include every HTTPS origin that submits forms. |
| `DEFAULT_FROM_EMAIL` | `noreply@careon.nl` or your real outbound sender | Must not stay at the local default value. |

### Recommended (avoid broken public links / tune throughput)

| Variable | Example | Notes |
|---|---|---|
| `SPA_ORIGIN` | `https://careon-web.onrender.com` | No trailing slash. Required so Django landing nav (`SPA_ORIGIN/login/`) does not default to `http://127.0.0.1:3000`. |
| `GUNICORN_WORKERS` | `2` | Optional override for `gunicorn --workers`. If unset, Render’s `WEB_CONCURRENCY` is used, then `2`. Raise only if the instance has enough RAM. |

## Fill-In Steps

1. Open the Render dashboard.
2. Select your **web** service (the one using this repo’s `startCommand` / gunicorn), not a static site or worker.
3. Open the Environment section.
4. Set `DATABASE_URL` to the PostgreSQL connection string from Render or your external database.
5. Set `ALLOWED_HOSTS` to the actual public hostnames.
6. Set `CSRF_TRUSTED_ORIGINS` to the HTTPS origins that will submit forms.
7. Set `DEFAULT_FROM_EMAIL` to the production sender address.
8. Save the changes.
9. Redeploy the service.
10. Verify the startup log shows `Starting web revision=...`, then `DATABASE_URL validated.` (or the detailed shape if `DATABASE_URL_VERBOSE_LOG` is enabled), then startup-check and gunicorn lines, and no guard failure from `render_startup_checks.py`.

## Validation Commands

After redeploying, confirm the service starts cleanly and the environment is valid.

```bash
python manage.py check --deploy
python scripts/terminology_guard.py
python manage.py showmigrations contracts
```

If startup still fails:

- confirm `DATABASE_URL` starts with `postgresql://` or `postgres://`
- confirm the password portion is percent-encoded if it contains reserved characters like `,`, `@`, `:` or `*`
- if you use Supabase's session pooler, confirm the username is `postgres.<project-ref>` rather than plain `postgres`
- if you use a direct Supabase host (`db.<project-ref>.supabase.co`) on Render, switch to the Supabase session pooler; direct IPv6-only routes can fail from Render
- confirm the database host is reachable from Render
- confirm `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` include the actual Render URL
- confirm `DEFAULT_FROM_EMAIL` is not the local placeholder
- if the logs still mention a migrate step during startup, override drift is still in effect; reset the service Start Command to `bash scripts/render_start_command.sh`

## Related Docs

- [`docs/FREE_EXTERNAL_DB_SETUP.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/FREE_EXTERNAL_DB_SETUP.md)
- [`docs/RENDER_DEPLOYMENT_SETUP.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RENDER_DEPLOYMENT_SETUP.md)
- [`docs/RELEASE_ROLLOUT_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RELEASE_ROLLOUT_CHECKLIST.md)
- [`docs/RELEASE_EXECUTION_SHEET_2026-05-30.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RELEASE_EXECUTION_SHEET_2026-05-30.md)
