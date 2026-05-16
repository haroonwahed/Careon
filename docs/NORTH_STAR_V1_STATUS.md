# North star v1 — status matrix (percentages)

**As of:** 2026-05-16  
**Release ref:** `main` @ `ca146bdc` (staging sign-off GO; full demo seed on Render)  
**Scoring:** % = evidence-backed completion toward the criterion, not calendar time.  
**Visual:** open `careon-progress-matrix.canvas.tsx` in Cursor (Canvases).  
**Sources:** North star / Phase 0–1 plan, `docs/V1_SCOPE.md`, `docs/V1_SHIP_CHECKLIST.md`, `docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`.

---

## Summary

| Track | Completion |
|-------|------------|
| **North star (overall)** | **94%** |
| Phase 0 — align & freeze | **92%** |
| Phase 1 — Must band (rows 1–4) | **94%** |
| Backlog Should rows 5–12 | **94%** |
| Staging sign-off (ship gate) | **95%** |
| Production | **0%** |

**Remaining for 100%:** optional `RENDER_DEPLOY_HOOK_URL`; 3 provider Playwright tests skipped without active pending placement row; production promotion not started.

**Verified 2026-05-16:** `./scripts/staging_pilot_signoff.sh` **GO** on `https://careon-web.onrender.com`; `reset_pilot_environment` succeeds on Render Postgres after migrations `0071`–`0076`.

---

## North star breakdown

| # | Criterion | % | Evidence |
|---|-----------|---|----------|
| F1 | Canonical chain backend-enforced (gemeente gate → provider review → placement → intake) | **88%** | `workflow_state_machine.py`, timeline rehearsal GO; golden-path Playwright on CI |
| F2 | Matching remains advisory | **100%** | No auto-assign; API/UI copy; guardrails |
| F3 | Provider visibility = linked cases only | **92%** | `tests/test_cross_tenant_isolation.py` + export endpoint isolation |
| T1 | Structured provider decisions (codes + notes) | **95%** | API + Reacties UI + E2E info/decision paths |
| T2 | Audit trail visible where disputes matter | **90%** | Timeline API + org CSV export + case dispute bundle |
| S1 | Platform Guardrails green on `main` | **100%** | Guardrails + pilot rehearsal on `main` |
| S2 | Pilot rehearsal → reviewed `release_evidence_bundle.json` | **100%** | Local + CI GO |
| S3 | Staging smoke — **both roles** (demo) | **92%** | Shell **8/8**; `staging_pilot_signoff` **GO** (9 Playwright passed, 3 skipped) |

**North star weights (functional 40% / trust 30% / shippable 30%):**

- Functional avg (F1–F3): **93%** → contributes **37%**
- Trust avg (T1–T2): **93%** → contributes **28%**
- Shippable avg (S1–S3): **97%** → contributes **29%**
- **Total: 94%**

---

## Phase 0 — align & freeze

| Gate | % | Notes |
|------|---|--------|
| 0.1 Delivery lens (provider-chain-first) | **100%** | `docs/V1_SCOPE.md` §1 |
| 0.2 v1 boundary | **100%** | §2 in-scope / out-of-scope |
| 0.3 `CasusControlCenter` quarantined | **100%** | `FEATURE_INVENTORY.md` |
| 0.4 `assessment` contract frozen | **100%** | §3 stable internal contract |
| `regiekamer` / `UITSTROOM` identifiers | **100%** | Explicitly deferred (decision = done) |
| Legacy doc banners / sweeps | **50%** | Process rule; not repo-wide complete |
| Browser smoke baseline | **95%** | CI + staging Playwright in sign-off |

**Phase 0 average: 92%**

---

## Phase 1 — Must band (rows 1–4)

| Row | % | Evidence |
|-----|---|----------|
| 1 Tenant + visibility | **92%** | Isolation tests; audit/dispute export cross-tenant |
| 2 Workflow gates | **88%** | Foundation lock + decision engine tests |
| 3 CI stop-the-line | **100%** | Guardrails + pilot rehearsal on `main` |
| 4 Structured provider decisions | **95%** | API fields + Reacties + provider smoke |

**Phase 1 average: 94%**

---

## Backlog rows 5–15 (Should / Could)

| Row | Topic | % |
|-----|--------|---|
| 5 | Provider workspace UI mode | **95%** |
| 6 | Handoff / “why us” | **90%** |
| 7 | Matching ↔ API | **88%** |
| 8 | Provider Playwright | **95%** (CI + staging 6–9/9 deep) |
| 9 | Actor read-model / profile policy | **92%** |
| 10 | Arrangement advisory copy | **92%** |
| 11 | Pilot rehearsal cadence | **95%** |
| 12 | Staging shell smoke | **95%** (sign-off GO) |
| 13 | `assessment` decision | **100%** (closed) |
| 14 | Rollout evidence | **80%** (templates + preflight script; prod empty) |
| 15 | Rename / anonimisatie | **0%** (deferred) |

**Should band (6–14) average: ~94%**

---

## Environment matrix

| Environment | Code on target | Rehearsal | Auth smoke (both roles) | Sign-off |
|-------------|----------------|-----------|-------------------------|----------|
| Local / CI | **100%** | **100%** | **95%** | Engineering ready |
| Staging Render | **100%** | **75%** | **92%** | **GO** (`ca146bdc`) |
| Production | **0%** | **0%** | **0%** | Blocked |

---

## Commands (verify)

```bash
BASE_URL=https://careon-web.onrender.com ./scripts/staging_v1_shell_smoke.sh
E2E_BASE_URL=https://careon-web.onrender.com E2E_DEMO_PASSWORD=pilot_demo_pass_123 ./scripts/staging_pilot_signoff.sh
```

---

## To reach 100% north star

1. **Optional:** set `RENDER_DEPLOY_HOOK_URL` in GitHub secrets for push-triggered Render deploys.
2. **Optional:** seed a casus with active pending placement so 3 skipped provider Playwright tests run.
3. **Production:** run `docs/PRODUCTION_RUNBOOK.md` + `./scripts/production_go_live_preflight.sh` with real Postgres; fill rollout checklists.
