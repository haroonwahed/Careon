# Free External Database Setup

If you need a free external PostgreSQL database for Render, the most practical option is a **Supabase Free** project.

Why this option:
- Supabase currently offers a free plan with free projects.
- Supabase provides a proper PostgreSQL connection string.
- Supabase’s session pooler supports IPv4 and IPv6, which is useful when your app host cannot rely on IPv6.

Alternative:
- Render also offers free PostgreSQL, but Render documents that free PostgreSQL instances now expire after 30 days. Use that only if you accept the expiration window.

## Recommended Setup: Supabase Free

Official references:
- [Supabase connection strings](https://supabase.com/docs/reference/postgres/connection-strings)
- [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk)

### 1. Create a free Supabase project

1. Sign in to Supabase.
2. Create a new project in a Free plan organization.
3. Keep the project name and password in a safe place.

Notes:
- Supabase Free currently allows two free projects.
- Free projects are the right fit for development and testing, not production care data.

### 2. Get the connection string

Open the project dashboard and click **Connect**.

Choose one of these:

- **Direct connection**
  - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.<project-ref>.supabase.co:5432/postgres`
  - Best for long-lived servers when IPv6 is available.
- **Session pooler**
  - Format: `postgres://postgres.<project-ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`
  - Best when you need IPv4 support for a persistent backend.

For Render deployments, the **session pooler** is the safer default if you are not sure about IPv6 support.

### 3. Set Render environment variables

In the Render service for `careon-web`, set:

| Variable | Example value |
|---|---|
| `DATABASE_URL` | `postgres://postgres.<project-ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres` |
| `ALLOWED_HOSTS` | `careon-web.onrender.com` |
| `CSRF_TRUSTED_ORIGINS` | `https://careon-web.onrender.com` |
| `DEFAULT_FROM_EMAIL` | `noreply@careon.nl` |

If you use a custom domain, add it to both `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`.

### 4. Redeploy Render

After saving the environment variables:

1. Redeploy the `careon-web` service.
2. Confirm startup logs no longer show the `DATABASE_URL` guard failure.
3. Confirm Django boots with `config.settings_production`.
4. Run `python manage.py check --deploy` from the deployed environment if available.

### 5. Verify the database connection

Use these checks after deploy:

```bash
python manage.py check --deploy
python scripts/terminology_guard.py
python manage.py showmigrations contracts
```

If the app still fails:

- verify the password is correct
- verify the project reference in the host name
- verify the connection string begins with `postgres://` or `postgresql://`
- verify `DEFAULT_FROM_EMAIL` is not the local placeholder

## Alternative: Render Free PostgreSQL

Official references:
- [Render Postgres docs](https://render.com/docs/postgresql)
- [Render databases and connection details](https://render.com/docs/databases)
- [Render free PostgreSQL expiry change](https://render.com/changelog/free-postgresql-instances-now-expire-after-30-days-previously-90-days)

Use this only if you are fine with the 30-day free-instance lifecycle.

### Steps

1. Create a new Render Postgres database.
2. Copy the internal or external connection string from the Render dashboard.
3. Set `DATABASE_URL` in the `careon-web` service to that full connection string.
4. Keep `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and `DEFAULT_FROM_EMAIL` configured.
5. Redeploy.

### Important note

Render app services and Render databases in the same region should use the internal URL where possible. For external tools, use the external URL.

## Related Repo Docs

- [`docs/RENDER_ENV_FIX_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RENDER_ENV_FIX_CHECKLIST.md)
- [`docs/RENDER_DEPLOYMENT_SETUP.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RENDER_DEPLOYMENT_SETUP.md)
- [`docs/RELEASE_ROLLOUT_CHECKLIST.md`](/Users/haroonwahed/Documents/Projects/Careon/docs/RELEASE_ROLLOUT_CHECKLIST.md)
