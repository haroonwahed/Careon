# Go-live: one-page runbook

Use this **right before and right after** you point traffic at staging or production.  
Canonical detail lives in `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md`, `docs/RELEASE_ROLLOUT_CHECKLIST.md`, and `docs/ROLLBACK_RUNBOOK.md`.

## 0. Humans (cannot be scripted)

Assign **release captain**, **backend owner**, **ops owner**, **QA owner** (see rollout checklist).  
Confirm **backup** of the production DB exists before `migrate` on production.

## 1. Env on the target (staging or production)

Set at least:

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Real Postgres URL (`README.md` warns against placeholders). |
| `DJANGO_SECRET_KEY` | Strong secret; not `django-insecure-*`. |
| `ALLOWED_HOSTS` | Includes the public hostname. |
| `CSRF_TRUSTED_ORIGINS` | Includes `https://…` origin(s). |
| `DEFAULT_FROM_EMAIL` | Not `noreply@careon.local` (`config/settings_production.py`). |
| `DJANGO_SETTINGS_MODULE` | `config.settings_production` for prod checks. |
| `SENTRY_DSN` | Optional but strongly recommended for pilot (`docs/PILOT_E2E_STATUS.md`). |

## 2. Django preflight (from repo, with prod env loaded)

```bash
cd /path/to/Careon
set -a && source /path/to/your-prod-or-staging.env && set +a
./scripts/go_live_django_preflight.sh
```

Expect: `migrate --plan` empty or reviewed; `check --deploy` **0 issues**.

## 3. Apply migrations on the server

On the host (or your platform’s migrate step), after backup:

```bash
./.venv/bin/python manage.py migrate
```

## 4. HTTP smoke (from any machine with `curl`)

**Current pilot/staging web origin (public):** `https://careon-web.onrender.com`  
Override anytime with `BASE_URL` if you add another host.

```bash
cd /path/to/Careon
BASE_URL=https://careon-web.onrender.com ./scripts/go_live_http_smoke.sh
```

The script checks `/`, `/care/`, and `/?view=dashboard` (not `/static/spa/?view=dashboard`, which may 404 under Whitenoise while the site is still fine).

**CI:** GitHub Actions workflow `.github/workflows/staging-http-smoke.yml` runs the same script on a schedule; set repository variable `STAGING_BASE_URL` to override the default origin.

## 5. Browser smoke (manual, required)

Follow **§3–7** in `docs/POST_DEPLOY_VERIFICATION_CHECKLIST.md` (canonical workflow, roles, audit).

## 6. Evidence

Record deploy SHA, time, URLs, roles tested, pass/fail in `docs/DRILL_LOG.md` or your execution sheet.

## 7. If anything fails

Follow `docs/ROLLBACK_RUNBOOK.md` — do **not** sign off.
