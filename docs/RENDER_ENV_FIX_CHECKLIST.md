# Render Environment Fix Checklist

Use this when a Render deploy fails because production settings are missing or malformed.

## Problem Statement

The production startup path requires a real PostgreSQL `DATABASE_URL`. If Render has an empty value or a placeholder value, startup fails before Django can finish booting.

## Required Variables

Fill these in on the Render service for `careon-web`.

| Variable | Required value | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require` | Must be a real PostgreSQL DSN. `postgres://` is also accepted. |
| `ALLOWED_HOSTS` | `<your-render-service-hostname>,<your-custom-domain-if-any>` | Use the actual public hostnames that should serve the app. |
| `CSRF_TRUSTED_ORIGINS` | `https://<your-render-service-hostname>,https://<your-custom-domain-if-any>` | Must include every HTTPS origin that submits forms. |
| `DEFAULT_FROM_EMAIL` | `noreply@careon.nl` or your real outbound sender | Must not stay at the local default value. |

## Fill-In Steps

1. Open the Render dashboard.
2. Select the `careon-web` service.
3. Open the Environment section.
4. Set `DATABASE_URL` to the PostgreSQL connection string from Render or your external database.
5. Set `ALLOWED_HOSTS` to the actual public hostnames.
6. Set `CSRF_TRUSTED_ORIGINS` to the HTTPS origins that will submit forms.
7. Set `DEFAULT_FROM_EMAIL` to the production sender address.
8. Save the changes.
9. Redeploy the service.
10. Verify the startup log shows `DATABASE_URL detected: ...` and no longer shows the guard failure.

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
- confirm the database host is reachable from Render
- confirm `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` include the actual Render URL
- confirm `DEFAULT_FROM_EMAIL` is not the local placeholder

## Related Docs

- [`docs/FREE_EXTERNAL_DB_SETUP.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/FREE_EXTERNAL_DB_SETUP.md)
- [`docs/RENDER_DEPLOYMENT_SETUP.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RENDER_DEPLOYMENT_SETUP.md)
- [`docs/RELEASE_ROLLOUT_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RELEASE_ROLLOUT_CHECKLIST.md)
- [`docs/RELEASE_EXECUTION_SHEET_2026-04-24.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RELEASE_EXECUTION_SHEET_2026-04-24.md)
