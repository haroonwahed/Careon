# E2E runbook (Playwright)

This document clarifies **which Playwright suites exist**, **how to run them**, and **what typical failures mean**. It avoids mixing SPA-only flows with Django-backed pilot flows.

---

## SPA Playwright tests vs Django / pilot E2E tests

| Kind | What exercises | Typical `baseURL` | Backend |
|------|------------------|---------------------|---------|
| **SPA tests** | React shell in isolation (Vite dev server) | `http://127.0.0.1:3000` (see below) | Optional / mocked; no Django requirement for many design-system checks |
| **Django / pilot E2E** | Full stack: Django session, templates, `/login/`, `/register/`, `/dashboard/` SPA shell served by Django | `http://127.0.0.1:8010` or whatever **`manage.py runserver`** uses | **Required** — users and DB must match how tests log in |

Do not assume one server URL works for all suites. Copy-paste the commands from the sections below.

---

## SPA tests

These expect the **Vite dev app** on a fixed port so selectors and assets resolve consistently.

```bash
cd client && npm run dev -- --port 3000 --strictPort --host 127.0.0.1
```

Point Playwright at that origin:

```bash
export E2E_SPA_URL=http://127.0.0.1:3000
# Run the SPA-focused specs your project uses (paths may vary).
```

Use **`E2E_SPA_URL`** (or the env name your spec files read) so tests do not collide with Django’s usual `:8010` / rehearsal ports.

---

## Pilot demo tests (`pilot-demo.spec.ts`)

**Requirement:** run **`./scripts/pilot_demo.sh`**.

That script:

- Uses **`DJANGO_SETTINGS_MODULE=config.settings_rehearsal`** and **`db_rehearsal.sqlite3`**
- Migrates, flushes, and **seeds** users including **`demo_gemeente`** with **`pilot_demo_pass_123`** (defaults; overridable via env)
- Picks a free port when needed and sets **`E2E_BASE_URL`** accordingly
- Starts the server and runs the pilot Playwright story against **that** origin

Running `pilot-demo` manually without this seed → **invalid login** (users missing from your DB).

---

## Pilot smoke tests (`pilot-smoke.spec.ts`)

**Requirement:** the Django server must use the **same database** that contains the seeded **`e2e_owner`** user (default password **`e2e_pass_123`** unless overridden).

**Preferred:** run **`scripts/verify_ui.sh`**, which seeds **`e2e_owner`** (and related E2E data) via `manage.py shell` before or alongside UI checks — align **`DJANGO_SETTINGS_MODULE`** and DB with whatever server Playwright hits.

The smoke test **registers** a fresh user, then **logs in** as **`e2e_owner`** for later steps. If **`e2e_owner`** does not exist in that DB, login fails.

---

## Common failure meanings

| Symptom | Likely cause |
|---------|----------------|
| **Invalid credentials** / Dutch login error on `/login/` | Wrong **database** or **seed** for the users the test uses (`demo_gemeente`, `e2e_owner`, …), or wrong **`E2E_BASE_URL`** so you’re hitting another environment |
| **Connection refused** | Wrong **port** or **host** — server not running, or Playwright points at `:8010` while the process listens elsewhere |
| **Missing “Regiekamer” heading after register** | Not reaching a **hydrated SPA shell** after signup — e.g. still on Django-only page, JS bundle failed to load, or navigation never reached `/dashboard/` |

---

## What not to change when debugging these failures

Do **not** “fix” the above by editing **Regiekamer**, **CarePageScaffold**, or **design-system** tests/components unless there is a genuine product bug unrelated to environment alignment.

Most failures are **environment / seed / URL** mismatches — fix the runbook flow first.
