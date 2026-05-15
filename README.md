# CareOn (Zorg OS)

**CareOn / Zorg OS** is a **regulated operational coordination layer** for care placement and chain progression under capacity scarcity. It implements workflow-first **aanvragen** coordination, **gemeente** financing/arrangement validation, and **zorgaanbieder** responses — with the backend as the **source of truth** for state and permissions.

This repository is **production-oriented infrastructure**, not a Figma-only prototype. Visual exploration history may exist separately; **canonical product and engineering law** lives in the docs below.

## Start here

**→ [`docs/START_HERE.md`](docs/START_HERE.md)** — canonical reading order, ship checklist, and links to roadmaps.

**Doctrine:** [`docs/Careon_Operational_Constitution_v2.md`](docs/Careon_Operational_Constitution_v2.md) (export) · [`docs/Careon_Operational_Constitution_v2.docx`](docs/Careon_Operational_Constitution_v2.docx) (Word master) · [`docs/FOUNDATION_LOCK.md`](docs/FOUNDATION_LOCK.md) (states, API phases, endpoints, UI density).

**Agents / contributors:** [`AGENTS.md`](AGENTS.md).

**Release evidence (GO/NO-GO):** [`docs/PILOT_PROOF_PACKAGE.md`](docs/PILOT_PROOF_PACKAGE.md) — includes the **default pilot rehearsal ritual** (GitHub Actions artifact + local `./scripts/run_full_pilot_rehearsal.sh`).

**Prioritized product/engineering backlog:** [`docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`](docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md) — MoSCoW + top-15 execution order (**provider-chain-first** default; pilot/rehearsal as alternate lens in that doc).

**Production operations:** [`docs/PRODUCTION_RUNBOOK.md`](docs/PRODUCTION_RUNBOOK.md) (secrets, backups, observability, OIDC).

## Running the code

### Frontend (Vite dev client)

```bash
cd client && npm install && npm run dev
```

### Backend (Django)

Use Python **3.12** and a dedicated virtual environment:

```bash
python3.12 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip
pip install -r requirements/dev.txt
export DJANGO_SECRET_KEY=test-not-for-production
python manage.py migrate
python manage.py runserver
```

### Python tests

```bash
export DJANGO_SECRET_KEY=test-not-for-production
python -m pytest tests/ -q
```

`requirements/dev.txt` includes `pytest` and `pytest-django`; `pytest.ini` sets `DJANGO_SETTINGS_MODULE=config.settings_test`. CI mirrors this via [`.github/workflows/platform-guardrails.yml`](.github/workflows/platform-guardrails.yml) (pytest, terminology guard, tenant audit, security scans, **deploy check with Postgres**).

## Render deployment

The repository includes a Render blueprint in `render.yaml`.

It provisions:

- one Django web service

The blueprint is configured for Render's free web plan. If Render still asks for payment, your account or selected region likely does not have free instances available, and Render will require a paid plan at creation time.

The build step installs Python and Node dependencies, builds the React client, copies the generated SPA into `theme/static/spa`, then runs `collectstatic` and `migrate`.

If `DATABASE_URL` is not available yet during build, the Render blueprint now uses a temporary SQLite database under `/tmp` for Django management commands. Production runtime still requires a real PostgreSQL `DATABASE_URL`.

This setup expects an external PostgreSQL database. Add its connection string manually as `DATABASE_URL` in Render.

Do not paste placeholder values like `:port` into `DATABASE_URL`. Use a real connection string, for example:

- `postgresql://careon_user:super-secret-password@db.example.com:5432/careon?sslmode=require`

Before first production traffic, set these host-specific values in Render:

- `DATABASE_URL`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- `DEFAULT_FROM_EMAIL`

The blueprint already wires `DJANGO_SECRET_KEY` and `DJANGO_SETTINGS_MODULE=config.settings_production`.
