# Start here — Zorg OS / CareOn

This repository is **CareOn (Zorg OS)**: a **regulated operational coordination layer** for care placement under scarcity. It is **not** a generic SaaS bundle, municipal ERP, or permanent youth-care dossier.

## Read first (canonical)

| Document | Use when |
|----------|----------|
| [`Careon_Operational_Constitution_v2.md`](./Careon_Operational_Constitution_v2.md) | Product doctrine, UX law, roles, non-negotiables |
| [`Careon_Operational_Constitution_v2.docx`](./Careon_Operational_Constitution_v2.docx) | Same content — formatted master for sign-off |
| [`FOUNDATION_LOCK.md`](./FOUNDATION_LOCK.md) | Persisted `WorkflowState`, API `phase` keys, mutation endpoints, decision engine, UI density guardrails |
| [`PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`](./PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md) | **MoSCoW + top-15** execution order for product/engineering debt (**provider-chain-first** default; pilot/rehearsal in alternate lens) |
| [`AGENTS.md`](../AGENTS.md) | Agent and contributor operating rules (workflow-first, UI modes, risk class) |
| [`PILOT_PROOF_PACKAGE.md`](./PILOT_PROOF_PACKAGE.md) | Deterministic pilot rehearsal + **release ritual** (GO/NO-GO artifacts) |
| [`V1_SCOPE.md`](./V1_SCOPE.md) | **v1 wave:** Phase 0 closure + Phase 1 Must baseline + `assessment` contract |

Supporting: [`ZORG_OS_FOUNDATION_APPROACH.md`](./ZORG_OS_FOUNDATION_APPROACH.md), [`TERMINOLOGY.md`](./TERMINOLOGY.md), [`AANMELDER_WORKFLOWROLE_MAPPING.md`](./AANMELDER_WORKFLOWROLE_MAPPING.md).

## Run locally

1. **Backend:** Python 3.12 venv, `pip install -r requirements/dev.txt`, `export DJANGO_SECRET_KEY=…`, `python manage.py migrate`, `python manage.py runserver` (see root [`README.md`](../README.md)).
2. **Frontend SPA:** `cd client && npm i && npm run dev` (or build into `theme/static/spa` for Django-hosted SPA — see README).

## Ship checklist (short)

**Merge-ready checkbox list:** [`V1_SHIP_CHECKLIST.md`](./V1_SHIP_CHECKLIST.md) (PR Guardrails + pilot evidence + staging smoke both roles).

1. **CI green** on PR (`Platform Guardrails`: pytest, terminology, tenant audit, security scans, production `check --deploy` with Postgres).
2. **Pilot rehearsal** — workflow artifact from [`pilot-rehearsal.yml`](../.github/workflows/pilot-rehearsal.yml) or locally `./scripts/run_full_pilot_rehearsal.sh`; review `release_evidence_bundle.json` ([`PILOT_PROOF_PACKAGE.md`](./PILOT_PROOF_PACKAGE.md)).
3. **Production** — [`PRODUCTION_RUNBOOK.md`](./PRODUCTION_RUNBOOK.md) (secrets, DB backup/restore drill, observability, SSO).

## Roadmaps (known debt)

- [`V1_SHIP_CHECKLIST.md`](./V1_SHIP_CHECKLIST.md) — Merge-ready CI + pilot evidence + staging smoke (operational gate).
- [`V1_SCOPE.md`](./V1_SCOPE.md) — **Phase 0 closed** + **Phase 1 Must baseline** + `assessment` contract (single page).
- [`PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`](./PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md) — **single prioritized queue** (Must/Should/Could/Won’t + top 15).
- [`ACTOR_PROFILES_ROADMAP.md`](./ACTOR_PROFILES_ROADMAP.md) — Aanmelder vs `WorkflowRole` alignment.
- [`FRONTEND_UI_MODE_AUDIT.md`](./FRONTEND_UI_MODE_AUDIT.md) — Metric strip / NBA / timeline placement rules.
- [`MATCHING_EXPLAINABILITY.md`](./MATCHING_EXPLAINABILITY.md) — Advisory matching, factors, rejection signals.
