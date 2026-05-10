# Locked pilot universe (ATC simulation)

The rehearsal/demo tenant is **not** “hope the seed works”. It is a **fixed board**:

- **1 gemeente** — organisation slug `gemeente-demo`
- **3 aanbieders** — Horizon Jeugdzorg, Kompas Zorg, Groei & Co (see `contracts.pilot_universe.PILOT_PROVIDER_CLIENT_NAMES`)
- **12 casussen** — `Demo Casus A` … `Demo Casus L` (`contracts.pilot_universe.PILOT_CASE_TITLES`)

## Canonical sources

| What | Where |
|------|--------|
| Manifest (titles, anchor clock, roles narrative) | `contracts/pilot_universe.py` |
| Workflow placement per case | `contracts/management/commands/seed_demo_data.py` (`_case_specs`) |
| E2E users wiring | `contracts/management/commands/seed_pilot_e2e.py` |
| Fixed simulation time for seeds | `manage.py seed_demo_data --locked-time` (or `PILOT_LOCKED_TIME=1`) |

## Simulation clock

`PILOT_LOCK_ANCHOR` (Europe/Amsterdam) is the **single “now”** when seeding with `--locked-time`: deadlines, contract dates, provider sync timestamps, and placement metadata derive from it so UI and APIs stay **byte-stable** across machines for screenshots and regression checks.

## Roles (deterministic)

| Actor | Login (after `seed_pilot_e2e`) | Profile |
|--------|--------------------------------|---------|
| Gemeente coordinator | `demo_gemeente` / `E2E_DEMO_PASSWORD` | ASSOCIATE |
| Horizon staff | `demo_provider_brug` | CLIENT |
| Kompas staff | `demo_provider_kompas` | CLIENT |
| Groei staff | `provider.groei@gemeente-demo.nl` (seed_demo_data) | CLIENT |

Full gemeente demo account from `seed_demo_data`: `test@gemeente-demo.nl` / `DemoTest123!`

## Case board (A→L)

Each row in `PILOT_CASE_FLOW_MATRIX` maps one casus to an **ATC-style lane** (casus → matching → aanbieder → plaatsing → intake). Use it for demos and screenshots instead of ad-hoc explanations.

## Prepare rehearsal DB

```bash
./scripts/prepare_pilot_e2e.sh
```

This runs `seed_demo_data --locked-time` then `seed_pilot_e2e`.

## Deterministic screenshots (Playwright)

`client/tests/e2e/pilot-screenshots.spec.ts` uses a **fixed viewport** and writes PNGs under each run’s `outputDir`. Requires Django + SPA per `docs/E2E_RUNBOOK.md`.
