# E2E runbook (Playwright)

**Canonical pilot stack:** use **`./scripts/prepare_pilot_e2e.sh`** then run Django with **`config.settings_rehearsal`** and the same **`E2E_BASE_URL`**. This single path seeds **both** `pilot-demo` and `pilot-smoke` users in **`db_rehearsal.sqlite3`**, builds the SPA into **`theme/static/spa/`**, and documents exact passwords.

**Verified green snapshot + hygiene:** see **[PILOT_E2E_STATUS.md](PILOT_E2E_STATUS.md)**.

---

## Happy path (pilot E2E from a clean state)

From the **repository root**:

```bash
./scripts/prepare_pilot_e2e.sh
```

This will:

- Run **`npm ci`** / **`npm install`** in `client/` and **`npm run build`** (Vite → `theme/static/spa/`)
- **Fail** if `theme/static/spa/index.html` is missing after build
- Install **Playwright Chromium**
- **`migrate`** and **`flush`** the **rehearsal** SQLite DB
- Run **`manage.py seed_pilot_e2e`** (users below)

Then start Django **with the same settings module** the script used (or **restart** if `runserver` was already running — the process must load current `config.settings_rehearsal` and pick up a fresh `npm run build`):

```bash
export DJANGO_SETTINGS_MODULE=config.settings_rehearsal
./.venv/bin/python manage.py runserver 127.0.0.1:8010
```

**Critical:** Only **one** `runserver` should use **`db_rehearsal.sqlite3`**. If another process already listens on **`8010`**, you may be hitting a **different** Django instance (wrong DB / wrong users) — stop it or change **`E2E_BASE_URL`** / **`E2E_PORT`** consistently.

**Rehearsal static / SPA:** `config.settings_rehearsal` defaults **`DEBUG=True`** (override with `DJANGO_DEBUG=0` / `DEBUG=0` if you need production-like static handling). That ensures **new Vite chunk files** under `theme/static/spa/assets/` are served after each build. With `DEBUG=False`, `CompressedManifestStaticFilesStorage` + Whitenoise can **404** freshly hashed JS until `collectstatic` regenerates the manifest — the HTML shell may load while **`/static/spa/assets/index-….js` returns 404**, so React never mounts and Playwright times out on `care-sidebar`.

---

### One-command Zorg OS golden path (recommended)

From the **repository root**, after ensuring port **`8010`** is free **or** passing **`--start-server`**:

```bash
./scripts/run_golden_path_e2e.sh
```

With an existing SPA build (skip Vite if `theme/static/spa/index.html` is fresh):

```bash
./scripts/run_golden_path_e2e.sh --skip-build
```

If nothing listens on **`E2E_BASE_URL`** yet, start rehearsal Django in the background for this run only:

```bash
./scripts/run_golden_path_e2e.sh --start-server
```

If **`8010`** is already taken by another Django (often **`DJANGO_SETTINGS_MODULE` ≠ `config.settings_rehearsal`**), do **not** use `--start-server` on that port — the script will exit with a clear error. Use a free port and keep prepare + server + Playwright aligned:

```bash
export E2E_PORT=8011
export E2E_BASE_URL=http://127.0.0.1:8011
./scripts/run_golden_path_e2e.sh --skip-build --start-server
```

The script runs **`prepare_pilot_e2e.sh`** (pass **`--skip-build`** through to skip **`npm run build`** when **`theme/static/spa/`** is already current), then **`scripts/e2e_rehearsal_preflight.py`** (DB + HTTP checks), then **`tests/e2e/zorg-os-golden-path.spec.ts`**.

**Manual equivalent (two terminals):**

1. Prepare + seed + build (same as above): `./scripts/prepare_pilot_e2e.sh`
2. Server: `export DJANGO_SETTINGS_MODULE=config.settings_rehearsal` && `manage.py runserver 127.0.0.1:8010`
3. Preflight (ORM + live **`/care/api/me/`**):

   ```bash
   export E2E_BASE_URL=http://127.0.0.1:8010
   export E2E_DEMO_PASSWORD=pilot_demo_pass_123
   ./.venv/bin/python scripts/e2e_rehearsal_preflight.py
   ```

4. Playwright (from **`client/`**): `npm run test:e2e:golden-path`

**Optional env file:** copy **`client/.env.e2e.example`** → **`client/.env.e2e`** (gitignored). Playwright loads it when present; shell exports still win.

---

### Pilot demo / smoke Playwright (manual order)

In another terminal (from `client/`), align env with the script output and run preflight, then pilot specs:

```bash
export E2E_BASE_URL=http://127.0.0.1:8010
export E2E_DEMO_PASSWORD=pilot_demo_pass_123
export E2E_SMOKE_PASSWORD=e2e_pass_123
npx playwright test tests/e2e/pilot-stack-preflight.spec.ts
npx playwright test tests/e2e/pilot-smoke.spec.ts tests/e2e/pilot-demo.spec.ts
```

**Zorg OS golden path** (same rehearsal stack; Playwright only):

```bash
cd client
npm run test:e2e:golden-path
# equivalent: npx playwright test tests/e2e/zorg-os-golden-path.spec.ts
```

Optional: **`./scripts/prepare_pilot_e2e.sh --preflight`** after the server is up — the script will run preflight only if **`$E2E_BASE_URL/login/`** responds.

**`--skip-build`:** skip `npm run build` if you already have a fresh `theme/static/spa/index.html`.

---

## Canonical pilot E2E env contract

| Variable | Role | Default (in code / prepare script) |
|----------|------|--------------------------------------|
| **`E2E_BASE_URL`** | Django origin for Playwright | `http://127.0.0.1:8010` |
| **`E2E_PORT`** | Used only by **`prepare_pilot_e2e.sh`** to default **`E2E_BASE_URL`** in its printed hint | `8010` |
| **`E2E_PROFILE`** | Preflight scope: `pilot-demo` (default), `pilot-smoke`, or `all` | `pilot-demo` |
| **`DJANGO_DEBUG`**, **`DEBUG`** | Rehearsal: default **`True`** in `config.settings_rehearsal` so new Vite chunks are served; set to **`0`/`false`** for stricter static behavior | `True` (rehearsal) |
| **`E2E_DEMO_PASSWORD`** | `demo_gemeente`, `demo_provider_brug`, `demo_provider_kompas` | `pilot_demo_pass_123` |
| **`E2E_SMOKE_PASSWORD`** | `e2e_owner` (pilot-smoke) | `e2e_pass_123` |
| **`E2E_PASSWORD`** | **Legacy only:** if set, used as fallback when `E2E_DEMO_PASSWORD` or `E2E_SMOKE_PASSWORD` is unset | — |
| **`E2E_USERNAME`** | Smoke account username | `e2e_owner` |
| **`E2E_GEMEENTE_USERNAME`** | Demo gemeente | `demo_gemeente` |
| **`E2E_PROVIDER_ONE_USERNAME`**, **`E2E_PROVIDER_TWO_USERNAME`** | Demo providers | `demo_provider_brug`, `demo_provider_kompas` |
| **`E2E_GEMEENTE_PASSWORD`**, **`E2E_PROVIDER_PASSWORD`** | Optional per-role overrides | default to demo tier password |

Resolver logic lives in **`client/tests/e2e/pilotEnv.ts`** (explicit tier passwords, then legacy `E2E_PASSWORD`, then defaults).

**Database:** `DJANGO_SETTINGS_MODULE=config.settings_rehearsal` → `db_rehearsal.sqlite3` at the repo root.

**Not the canonical pilot path:** `manage.py seed_demo_data` uses **`test@gemeente-demo.nl`** / **`DemoTest123!`**. Use that only if you intentionally point tests at that DB and set env vars accordingly.

---

## Seeded users (after `prepare_pilot_e2e.sh` + `seed_pilot_e2e`)

| User | Password env | Value (default) |
|------|----------------|-----------------|
| `demo_gemeente` | `E2E_DEMO_PASSWORD` | `pilot_demo_pass_123` |
| `demo_provider_brug` | `E2E_DEMO_PASSWORD` | `pilot_demo_pass_123` |
| `demo_provider_kompas` | `E2E_DEMO_PASSWORD` | `pilot_demo_pass_123` |
| `e2e_owner` | `E2E_SMOKE_PASSWORD` | `e2e_pass_123` |

Organization slug: **`pilot-demo-org`**.

---

## SPA vs Django-backed tests

| Kind | Notes |
|------|--------|
| **`care-design-system.spec.ts`**, **`care-visual-regression.spec.ts`** | SPA + stubs; typically **`E2E_SPA_URL`** / Vite — see helpers in `tests/e2e/helpers/`. |
| **Pilot specs** | Require Django **`settings_rehearsal`**, built SPA under **`theme/static/spa/`**, and **`seed_pilot_e2e`**. |

---

## Preflight (`pilot-stack-preflight.spec.ts`)

**`E2E_PROFILE`** filters checks:

| Value | Runs |
|-------|------|
| **`pilot-demo`** (default) | Demo gemeente + provider login + dashboard as demo user |
| **`pilot-smoke`** | Smoke owner login + dashboard as smoke user |
| **`all`** | Demo + smoke logins and both dashboard checks |

Use **`E2E_PROFILE=all`** after **`prepare_pilot_e2e.sh`** when you want both tiers in one preflight run. The default **`pilot-demo`** avoids failing when only demo users are seeded or when you are debugging the demo flow alone.

Example:

```bash
E2E_PROFILE=pilot-demo npx playwright test tests/e2e/pilot-stack-preflight.spec.ts
```

---

## Legacy scripts (still valid)

- **`./scripts/pilot_demo.sh`** — rehearsal flush + old inline seed + Playwright **part 1/2** demo only (does not create `e2e_owner` by default).
- **`./scripts/verify_ui.sh`** — default Django DB + **`e2e_owner`** seed for UI verification.

Prefer **`prepare_pilot_e2e.sh`** + **`seed_pilot_e2e`** for a **single** repeatable pilot profile.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| **Invalid login** / Dutch password error | Wrong DB (**must** use `settings_rehearsal` for canonical seed), wrong **`E2E_DEMO_PASSWORD` / `E2E_SMOKE_PASSWORD`**, or **`E2E_BASE_URL`** points at another server. Re-run **`prepare_pilot_e2e.sh`**. Run **`./.venv/bin/python scripts/e2e_rehearsal_preflight.py`** — if ORM passes but HTTP fails, the **running server** is not using **`db_rehearsal.sqlite3`** (wrong **`DJANGO_SETTINGS_MODULE`** or another process on the port). |
| **`care-sidebar` missing** | SPA bundle/static shell did not mount — run **`./scripts/prepare_pilot_e2e.sh`** (no `--skip-build`) so **`theme/static/spa/index.html`** exists. |
| **Regiekamer `h1` missing** | Same as above, or Django not serving the SPA shell for `/dashboard/`. |
| **Wrong DB** | **`DJANGO_SETTINGS_MODULE`** mismatch — Playwright hits rehearsal seed but server uses default **`settings`** → different SQLite file. Also: **port already in use** — another process bound the port (e.g. `8010`) so **`runserver` failed** and requests hit a different instance/DB. |
| **`database is locked` (SQLite) on API** | **Two** `runserver` processes (or any two writers) on the same **`db_rehearsal.sqlite3`**. Use **one** rehearsal server, or only one process accessing that file. |
| **`E2E_BASE_URL` / port surprises** | If your shell sets **`E2E_BASE_URL`** or **`E2E_PORT`**, prepare and Playwright may use a non-default port. For the stock **`http://127.0.0.1:8010`**, run `unset E2E_BASE_URL E2E_PORT` or set them explicitly. |
| **SPA static missing** | No **`npm run build`** in **`client/`** → no **`theme/static/spa/index.html`**. |
| **Main JS bundle 404** (`/static/spa/assets/index-*.js`) | Rehearsal with **`DEBUG=False`** and a **new** Vite hash — **restart** with `config.settings_rehearsal` (default **`DEBUG=True`**) or run **`collectstatic`**. Quick check: `curl -I "$E2E_BASE_URL/static/spa/assets/<hash from index.html>.js"`. |
| **Playwright browser missing** | Run **`npx playwright install chromium`** (prepare script does this). |
| **Connection refused** | Django not listening on **`E2E_BASE_URL`** host/port. |

---

## What not to “fix” in product code first

Do **not** change Regiekamer / shell components when pilot failures match the table above — align **prepare script**, **env**, **settings module**, and **built SPA** first.
