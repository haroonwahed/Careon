# Pilot E2E — verified rehearsal state

**Last verified:** 2026-05-09  
**Role:** Canonical **rehearsal** verification path (not production deploy). Use with `config.settings_rehearsal` and `db_rehearsal.sqlite3`.  
**Detail / env contract:** [E2E_RUNBOOK.md](E2E_RUNBOOK.md)

## Pilot Readiness

- Verified baseline: design guardrail PASS, axe smoke PASS, focused care tests PASS, golden-path E2E PASS
- Latest pass state: no P0/P1 findings, no workflow/API/permission regressions observed
- Confidence: ready for pilot/demo walkthrough

## Pilot Resources

- [PILOT_WALKTHROUGH_CHECKLIST.md](PILOT_WALKTHROUGH_CHECKLIST.md)
- [PILOT_WALKTHROUGH_SCRIPT.md](PILOT_WALKTHROUGH_SCRIPT.md)
- [PILOT_KNOWN_LIMITATIONS.md](PILOT_KNOWN_LIMITATIONS.md)
- [RELEASE_READINESS_SUMMARY.md](RELEASE_READINESS_SUMMARY.md)
- [PILOT_TEST_SCRIPT.md](PILOT_TEST_SCRIPT.md)
- [PILOT_OBSERVER_CHECKLIST.md](PILOT_OBSERVER_CHECKLIST.md)

## Recommended Walkthrough Order

1. Nieuwe casus
2. Casussen
3. Regiekamer
4. Matching
5. Aanbieder beoordeling
6. Plaatsingen
7. Acties

**End-user pilot handover:** [PILOT_WALKTHROUGH_CHECKLIST.md](PILOT_WALKTHROUGH_CHECKLIST.md) · [PILOT_WALKTHROUGH_SCRIPT.md](PILOT_WALKTHROUGH_SCRIPT.md) · [PILOT_KNOWN_LIMITATIONS.md](PILOT_KNOWN_LIMITATIONS.md) · [RELEASE_READINESS_SUMMARY.md](RELEASE_READINESS_SUMMARY.md)

---

## What changed (environment + docs only)

| File | Purpose |
|------|--------|
| `config/settings_rehearsal.py` | Rehearsal defaults **`DEBUG=True`** (overridable via `DJANGO_DEBUG` / `DEBUG`); import **`_bool_env`**. Ensures new Vite chunks under `theme/static/spa/` are servable after each build when using the rehearsal settings module. **No** change to workflow, matching, or provider API rules. |
| `docs/E2E_RUNBOOK.md` | Restart hint, static/404 troubleshooting, SQLite lock, `E2E_BASE_URL` / `E2E_PORT`, `E2E_PROFILE`, rehearsal `DEBUG`. |
| `scripts/prepare_pilot_e2e.sh` | Reminder to **restart** Django after build/settings changes; pointer to runbook. |

**Not modified for this path:** Regiekamer UI, workflow engines, matching logic, provider authorization, or Playwright assertions (except any stale doc references elsewhere).

---

## Commands run (reference sequence)

From repository root:

```bash
./scripts/prepare_pilot_e2e.sh
```

Start **one** Django process:

```bash
export DJANGO_SETTINGS_MODULE=config.settings_rehearsal
./.venv/bin/python manage.py runserver 127.0.0.1:8010
```

From `client/` (align passwords with prepare output):

```bash
export E2E_BASE_URL=http://127.0.0.1:8010
export E2E_DEMO_PASSWORD=pilot_demo_pass_123
export E2E_SMOKE_PASSWORD=e2e_pass_123

npx playwright test tests/e2e/pilot-stack-preflight.spec.ts
E2E_PROFILE=all npx playwright test tests/e2e/pilot-stack-preflight.spec.ts
npx playwright test tests/e2e/pilot-smoke.spec.ts tests/e2e/pilot-demo.spec.ts
npx playwright test tests/e2e/care-design-system.spec.ts tests/e2e/care-visual-regression.spec.ts
```

---

## Final pass/fail (verified green)

| Suite | Result |
|--------|--------|
| `pilot-stack-preflight.spec.ts` (default `E2E_PROFILE=pilot-demo`) | **4 passed / 2 skipped** (smoke subset skipped by design) |
| `pilot-stack-preflight.spec.ts` (`E2E_PROFILE=all`) | **6 passed** |
| `pilot-smoke.spec.ts` + `pilot-demo.spec.ts` | **3 passed** (full pilot-demo including provider rejection) |
| `care-design-system.spec.ts` + `care-visual-regression.spec.ts` | **21 passed** |

---

## Root causes fixed (operations / settings — not product shortcuts)

1. **SPA shell without React:** Fresh Vite hashed JS returned **404** while older chunks returned **200** — rehearsal stack had **`DEBUG=False`**, so dev static URL patterns were absent and Whitenoise + manifest storage did not serve the new chunk. **Fix:** rehearsal **`DEBUG` default True** + **restart** `runserver` after build or settings change.
2. **`database is locked` (SQLite):** Two Django processes (e.g. two ports) writing **`db_rehearsal.sqlite3`**. **Fix:** exactly **one** rehearsal server for that file.
3. **Wrong origin in Playwright:** Shell **`E2E_BASE_URL`** / **`E2E_PORT`** pointed at a dead or alternate port. **Fix:** **`unset`** or set **`E2E_BASE_URL`** explicitly to the running server.

---

## Operational checklist (before Playwright)

1. Run **`./scripts/prepare_pilot_e2e.sh`** (or `--skip-build` only if `theme/static/spa/index.html` is already fresh).
2. Start **`runserver`** with **`DJANGO_SETTINGS_MODULE=config.settings_rehearsal`**.
3. Confirm **one** listener on the chosen port; **no** second `runserver` on the same SQLite DB.
4. **`curl -I`** the main bundle URL taken from `theme/static/spa/index.html` (e.g. `/static/spa/assets/index-….js`) → **200**.
5. Export **`E2E_BASE_URL`** (and tier passwords) explicitly; run preflight then pilot specs.

---

## Product rules — not weakened

This rehearsal path does **not** relax Regiekamer UI behavior, workflow state transitions, advisory matching semantics, or provider visibility / authorization (placement + `responsible_coordinator` / API gates remain the source of truth in code). Changes were limited to **rehearsal Django settings**, **prepare/runbook documentation**, and **operational hygiene**.

---

## Known E2E hygiene rules

- Use **one** Django rehearsal server only (one process owning **`db_rehearsal.sqlite3`** for that run).
- **Restart** the server after SPA build or **`settings_rehearsal`** / static-related changes.
- Verify the **current** Vite bundle URL returns **200** before Playwright (`curl -I` on the hashed asset from `index.html`).
- Keep **`E2E_BASE_URL`** explicit and aligned with the running server (avoid stale shell exports).
- Avoid **multiple writers** on **`db_rehearsal.sqlite3`** (no parallel `runserver` instances on the same file).

---

## Rollback plan (pilot)

Roll back when any of the following is observed in production within 24h of cutover:

- A workflow transition completes despite a blocked state (placement before acceptance, intake before placement, provider beoordeling before gemeente validatie). **Severity: P0.**
- The list endpoint exposes raw `case_geo` (postcode/coordinates). **Severity: P0** (privacy).
- Authorization regression: a role can act on a case outside its decision-ownership boundary (e.g. gemeente acts as provider, or vice versa). **Severity: P0.**
- Matching elevates from advisory to assignment (auto-assigning providers, hiding rejection options). **Severity: P0.**
- Audit trail missing for any state transition. **Severity: P1** (auditability requirement).
- ≥2 municipality operators report being blocked on a step with no recoverable next-best-action surface. **Severity: P1.**

### Rollback procedure

1. **Confirm scope** — record case IDs, timestamps, and the suspect transition or endpoint. Capture `audit_log` excerpts.
2. **Freeze new casus intake** at the gemeente surface. Do not freeze in-flight matching/placement/intake (stranding cases is worse than stale UI).
3. **Identify the offending commit.** The most recent merges to `main` are listed via `git log --oneline -20`. Each readiness commit isolates one concern (privacy fix, terminology, automation semantics).
4. **Revert path:**
   - Frontend-only regression: build the previous SPA tag and redeploy the static bundle.
     ```bash
     git checkout <prev_tag>
     (cd client && npm run build)
     # redeploy theme/static/spa/
     ```
   - Backend regression: revert the offending commit on a hotfix branch and redeploy.
     ```bash
     git checkout -b hotfix/rollback-<short-id> <prev_tag>
     # cherry-pick safe commits if needed
     ```
   - Schema regression: not expected (no new migrations in the readiness pass — `manage.py migrate --plan` returns empty). If a migration *is* the issue, follow `docs/E2E_RUNBOOK.md` rehearsal steps before applying any down-migration.
5. **Re-verify the canonical flow** on the rolled-back build:
   ```bash
   .venv/bin/pytest --tb=line -q
   (cd client && npx vitest run --no-cache && npm run check:careon-design && npm run build)
   ```
   Expected: 763 backend + 167 frontend tests green; design guardrail PASS; SPA build succeeds.
6. **Notify the pilot gemeente** with the cause, scope of impact, and the safe set of actions still available.
7. **Open a post-mortem ticket** with the affected canonical-flow rule (per `AGENTS.md`) and the verification gap that allowed it through.

### What is NOT a rollback trigger

- Cosmetic copy variance, layout density complaints, or single-user confusion (handle via a pilot copy-fix patch).
- Slowness on heavy worklists (capture metrics; tune; do not roll back).
- Failing E2E *visual* baseline (capture artefact; reconcile baseline; do not roll back).
- One operator's "I don't know what to do here" feedback (route to walkthrough refinement, not rollback).

### Pre-cutover sign-off (must all be green)

| Check | Command | Status |
|-------|---------|--------|
| Backend unit/integration | `.venv/bin/pytest --tb=line -q` | 763 / 763 passed |
| Frontend unit/component | `(cd client && npx vitest run --no-cache)` | 167 / 167 passed |
| Design-token guardrail | `(cd client && npm run check:careon-design)` | PASS |
| Production SPA build | `(cd client && npm run build)` | PASS |
| Migrations applied + clean | `.venv/bin/python manage.py migrate --plan` | "No planned migration operations." |
| Demo surface audit | grep + import-trace of `client/src/components/examples/*` | Only `MultiTenantDemo` is wired; rest tree-shaken |
| Privacy: `case_geo` only on detail | `tests/test_case_api_workflow_state.py::test_case_geo_is_exposed_in_detail_but_not_raw_in_list` | passing |
| Active-source guardrail | `tests/test_product_architecture_guardrails.py::test_active_user_facing_sources_do_not_expose_ai_anonymization_or_uitstroom` | passing |

### Items still requiring a human (cannot be agent-verified)

- Two-actor manual smoke (gemeente regisseur + zorgaanbieder beoordelaar) on a fresh staging DB.
- DPO/AVG sign-off walkthrough.
- Production `SECRET_KEY`, `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` review (Django `check --deploy` flags 5 settings; verify they are overridden in your production settings layer, not `settings_rehearsal`).
- Sentry / error-monitoring DSN wiring + alert routing for the pilot gemeente.
- Pilot communication plan (escalation contact, hours of cover, expected response SLA).
