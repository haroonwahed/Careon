# V1 ship checklist (merge-ready)

Use this on **every PR toward v1** and **before** promoting a build to staging or pilot hosts.  
Scope context: **`docs/V1_SCOPE.md`**. Prioritized queue: **`docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`**.

---

## 1. PR / `main` — Platform Guardrails

- [ ] **`pytest`** — full suite or the default job matrix in CI (not only a local subset).
- [ ] **Platform Guardrails** workflow green (terminology, tenant isolation audit, security scans, production `check --deploy` with Postgres — per `.github/workflows/platform-guardrails.yml`).
- [ ] **Client** — `npm ci` / `npm run build` (or CI equivalent); respect repo **audit** policy if enforced in CI.

**PR owner:** _______________ **Date:** _______________

---

## 2. Pilot rehearsal — release evidence

- [ ] **`./scripts/run_full_pilot_rehearsal.sh`** completed for this candidate **or** workflow **Pilot rehearsal (release evidence)** run for the commit/tag (see `docs/PILOT_PROOF_PACKAGE.md`).
- [ ] **`release_evidence_bundle.json`** downloaded and reviewed (**timeline gate** GO / NO-GO + `no_go_reasons` empty on GO).
- [ ] If **Playwright** was enabled (`with_playwright`): browser artifact / log reviewed for regressions on the rehearsed path.

**Reviewer:** _______________ **Date:** _______________

---

## 3. Staging — shell smoke (both technical roles)

**Automated (no auth):** `BASE_URL=https://your-staging-host ./scripts/staging_v1_shell_smoke.sh` — checks `/`, `/care/*` shells, `/dashboard/`, `/login/` (see `docs/NORTH_STAR_V1_STATUS.md`).

After deploy to **staging** (or the agreed rehearsal URL):

| # | Actor | Route / check | OK |
|---|--------|----------------|-----|
| 1 | Gemeente or admin | `/care/casussen/` — list loads | [ ] |
| 2 | Gemeente or admin | `/care/matching/` — surface loads | [ ] |
| 3 | Gemeente or admin | `/care/beoordelingen/` — Reacties monitoring loads | [ ] |
| 4 | Gemeente or admin | Dashboard / werkruimte entry — **200**, no shell **500** | [ ] |
| 5 | Zorgaanbieder (linked) | `/care/beoordelingen/` — queue + decision UI loads | [ ] |
| 6 | Zorgaanbieder | Linked casus detail / execution — **404** only for **unlinked** cases (no leakage) | [ ] |

**Tester:** _______________ **Date / build:** _______________

---

## 4. Optional — before production promotion

- [ ] **`docs/RELEASE_ROLLOUT_CHECKLIST.md`** — owners and timestamps filled for this release.
- [ ] **`docs/PRODUCTION_RUNBOOK.md`** — secrets, backup drill, observability verified for the target environment.

---

## References

| Document | Role |
|----------|------|
| `docs/V1_SCOPE.md` | Phase 0 closure + Phase 1 Must baseline |
| `docs/PILOT_PROOF_PACKAGE.md` | Rehearsal commands + artifact meanings |
| `docs/START_HERE.md` | Local run + ship summary |
