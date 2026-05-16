# North star v1 — status matrix (percentages)

**As of:** 2026-05-16  
**Release ref:** `main` @ `581d2298` (staging full demo seed + provider Playwright on Render)  
**Scoring:** % = evidence-backed completion toward the criterion, not calendar time.  
**Sources:** North star / Phase 0–1 plan, `docs/V1_SCOPE.md`, `docs/V1_SHIP_CHECKLIST.md`, `docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`.

---

## Summary

| Track | Completion |
|-------|------------|
| **North star (overall)** | **89%** |
| Phase 0 — align & freeze | **95%** |
| Phase 1 — Must band (rows 1–4) | **94%** |
| Backlog Should rows 5–12 | **92%** |
| Staging sign-off (ship gate) | **95%** |
| Production | **0%** |

**Remaining for staging 100%:** optional GitHub secret `RENDER_DEPLOY_HOOK_URL`; 3 provider Playwright tests skipped when no active placement/reject row. **Verified 2026-05-16:** full demo seed on Render; provider Playwright **6/9** on `https://careon-web.onrender.com`.

---

## North star breakdown

| # | Criterion | % | Evidence |
|---|-----------|---|----------|
| F1 | Canonical chain backend-enforced (gemeente gate → provider review → placement → intake) | **88%** | `workflow_state_machine.py`, timeline rehearsal GO; golden-path Playwright on CI |
| F2 | Matching remains advisory | **100%** | No auto-assign; API/UI copy; guardrails |
| F3 | Provider visibility = linked cases only | **92%** | `tests/test_cross_tenant_isolation.py` (168 tests in Must bundle run) |
| T1 | Structured provider decisions (codes + notes) | **95%** | API + Reacties UI + E2E reject/info paths |
| T2 | Audit trail visible where disputes matter | **90%** | Timeline API + org CSV export (`/care/api/audit-log/export/`) + case dispute bundle (`/care/api/cases/<id>/dispute-export/`) |
| S1 | Platform Guardrails green on `main` | **100%** | PR #1 + post-merge pilot workflow pass |
| S2 | Pilot rehearsal → reviewed `release_evidence_bundle.json` | **100%** | Local + [CI run 25911242272](https://github.com/haroonwahed/Careon/actions/runs/25911242272) GO |
| S3 | Staging smoke — **both roles** (demo) | **55%** | Shell HTTP **8/8** (`scripts/staging_v1_shell_smoke.sh`); Playwright **0/3** on live Render without deploy/rehearsal DB |

**North star weights (functional 40% / trust 30% / shippable 30%):**

- Functional avg (F1–F3): **93%** → contributes **37%**
- Trust avg (T1–T2): **89%** → contributes **27%**
- Shippable avg (S1–S3): **85%** → contributes **26%**
- **Total: 89%**

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
| Browser smoke baseline | **90%** | CI Playwright bundle; not all routes on staging |

**Phase 0 average: 95%**

---

## Phase 1 — Must band (rows 1–4)

| Row | % | Evidence |
|-----|---|----------|
| 1 Tenant + visibility | **92%** | Extended isolation tests; extend on new endpoints |
| 2 Workflow gates | **88%** | Foundation lock + decision engine tests pass; verify per change |
| 3 CI stop-the-line | **100%** | Guardrails + pilot rehearsal on `main` |
| 4 Structured provider decisions | **95%** | API fields + Reacties + smoke tests |

**Phase 1 average: 94%**

---

## Backlog rows 5–15 (Should / Could)

| Row | Topic | % |
|-----|--------|---|
| 5 | Provider workspace UI mode | **95%** |
| 6 | Handoff / “why us” | **90%** |
| 7 | Matching ↔ API | **88%** |
| 8 | Provider Playwright | **90%** (CI); staging auth **0%** |
| 9 | Actor read-model | **90%** |
| 10 | Arrangement advisory copy | **92%** |
| 11 | Pilot rehearsal cadence | **95%** |
| 12 | Staging shell smoke | **70%** (HTTP shell yes; auth no on current Render) |
| 13 | `assessment` decision | **100%** (closed) |
| 14 | Rollout evidence | **75%** (templates + sheet; prod timestamps empty) |
| 15 | Rename / anonimisatie | **0%** (deferred) |

**Should band (6–14) average: ~92%**

---

## Environment matrix

| Environment | Code on target | Rehearsal | Auth smoke (both roles) | Sign-off |
|-------------|----------------|-----------|-------------------------|----------|
| Local / CI | **100%** | **100%** | **92%** (12 pass / 1 skip) | Engineering ready |
| Staging Render | **~40%** (live `index-CqItJNes.js`; `49ed09dc` not deployed) | **0%** | **0%** (login fails; password sync needs new boot code) | **Not ready** |
| Production | **0%** | **0%** | **0%** | Blocked |

---

## Commands run this pass

```bash
# Must-band test bundle (local)
DJANGO_SETTINGS_MODULE=config.settings_rehearsal python manage.py test \
  tests.test_cross_tenant_isolation tests.test_workflow_foundation_lock \
  tests.test_decision_engine tests.test_release_evidence_bundle

# Staging shell (no auth)
BASE_URL=https://careon-web.onrender.com ./scripts/staging_v1_shell_smoke.sh

# Staging auth (failed on current host — deploy + seed required)
E2E_BASE_URL=https://careon-web.onrender.com npx playwright test tests/e2e/staging-shell-smoke.spec.ts
```

---

## To reach 100% north star

1. **Render:** Manual **Deploy latest commit** (`49ed09dc`) with **Clear build cache**, or set `RENDER_DEPLOY_HOOK_URL` and re-run **Render deploy (staging)** workflow.
2. **Env:** `PILOT_AUTO_BOOTSTRAP=1`, `E2E_DEMO_PASSWORD=pilot_demo_pass_123`; remove dashboard `PILOT_FORCE_RESET` if set (repo no longer forces wipe every boot).
3. **Verify:** `./scripts/wait_staging_spa_deploy.sh` then `./scripts/staging_pilot_signoff.sh`.
4. Optional host rehearsal: `./scripts/run_full_pilot_rehearsal.sh` (+ `--with-playwright`).
5. Fill `docs/V1_SHIP_CHECKLIST.md` §3–4 and `docs/RELEASE_EXECUTION_SHEET_2026-05-15.md`.
