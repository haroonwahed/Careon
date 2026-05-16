# Production runbook (operators)

Audience: **hosting / security / gemeente IT** preparing pilot or production. This is **not** product marketing.

## 1. Secrets and rotation

| Secret | Typical store | Rotation |
|--------|----------------|----------|
| `DJANGO_SECRET_KEY` | Render / vault | Rotate on staff offboarding or yearly; requires session invalidate |
| `DATABASE_URL` | Managed Postgres provider | Use provider rotation workflow; update Render env; brief maintenance window |
| `OIDC_RP_CLIENT_SECRET` | IdP + Render | Follow IdP client secret rotation; update both sides same window |
| `SENTRY_DSN` (optional) | Sentry project | Rotate if leaked; no PII in events (`send_default_pii=False` in `config/settings_production.py`) |

**Rule:** never commit secrets; verify `.gitignore` and CI logs do not echo env values.

## 2. Database backups and restore drills

- **Backups:** enable automated daily backups on the Postgres service (Render add-on or external provider). Retention ≥ pilot policy (often 7–35 days).
- **Restore drill (quarterly):** restore latest backup to a **non-production** database; run `manage.py migrate --plan` and smoke `/_health/` + login; document outcome in your change log.
- **Rehearsal DB:** local / CI uses `config.settings_rehearsal` and SQLite — **do not** point rehearsal scripts at production `DATABASE_URL`.

## 3. Observability

| Signal | Where |
|--------|--------|
| HTTP health | `GET /_health/` — returns **200**; emits `X-Request-ID` (see `tests/test_observability_middleware.py`) |
| Structured logs | Django `LOGGING` in `config/settings.py` — correlation id filter on operational loggers |
| Errors (optional) | Sentry when `SENTRY_DSN` set — environment + release via `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` (git SHA) |

**Alerting (recommended):** alert on **5xx rate**, **health check failure**, **DB connection errors**, and **disk full** on the app + DB tier. Wire alerts to on-call, not email-only black holes.

## 4. SSO / OIDC per environment

Controlled by `SSO_ENABLED` (`config/settings.py`). When `SSO_ENABLED=1`:

- Required: `OIDC_RP_CLIENT_ID`, `OIDC_RP_CLIENT_SECRET`, and either `OIDC_OP_DISCOVERY_ENDPOINT` **or** full endpoint set (`OIDC_OP_AUTHORIZATION_ENDPOINT`, `OIDC_OP_TOKEN_ENDPOINT`, `OIDC_OP_USER_ENDPOINT`, `OIDC_OP_JWKS_ENDPOINT`).
- Redirect safety: `OIDC_REDIRECT_ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` must include the **public** app URL (https).
- **Pilot:** use a dedicated IdP client per environment (acceptatie vs productie); never share prod client secrets with dev laptops.

## 5. TLS and Django deploy checks

Production settings enforce HTTPS cookies and HSTS (`config/settings_production.py`). CI runs `manage.py check --deploy` against Postgres to catch misconfiguration before release.

## 6. CI: `deploy-production-check` troubleshooting

GitHub Actions job **`deploy-production-check`** (`.github/workflows/platform-guardrails.yml`) mirrors production settings with a **throwaway Postgres** service. If it fails:

| Symptom | Likely fix |
|---------|------------|
| `ImproperlyConfigured` on import | Add missing env vars to that job’s `env:` block (same names as production). `config/settings_production.py` requires non-empty `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DEFAULT_FROM_EMAIL` (not `noreply@careon.local`), PostgreSQL `DATABASE_URL`, and a non-`django-insecure-*` `DJANGO_SECRET_KEY`. |
| `migrate` errors | Ensure migrations are compatible with Postgres 16; fix forward in a normal PR (do not relax production checks). |
| Intermittent DB connection refused | The workflow waits on `127.0.0.1:5432`; if failures persist, increase the wait loop or Postgres `health-retries`. |
| `npm audit` / `npm ci` failures | Resolve or bump vulnerable dependencies in `client/` or `theme/static_src/`; audits are intentionally strict (`--audit-level=high`). |

## 7. Local preflight before production promotion

From a release-candidate checkout:

```bash
./scripts/production_go_live_preflight.sh
```

Optional Postgres deploy check: set `PREFLIGHT_POSTGRES_URL` (production) or `STAGING_DATABASE_URL` (Render **Internal Database URL** from the staging Postgres dashboard) plus `DJANGO_SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `DEFAULT_FROM_EMAIL`. Then complete [`docs/RELEASE_ROLLOUT_CHECKLIST.md`](./RELEASE_ROLLOUT_CHECKLIST.md).

## 8. Incident contacts

Define in your org (not in git): primary engineering, gemeente security officer, hosting vendor support IDs.
