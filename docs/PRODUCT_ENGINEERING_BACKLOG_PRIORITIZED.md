# Product & engineering backlog — prioritized

**Audience:** product + engineering leads planning the next slices of work.  
**Default lens:** **Provider-chain-first** (zorgaanbieder adoption: capacity, review UX, structured responses, **linked-case-only visibility**, auditability). If your next release is **pilot gemeente / rehearsal** or **internal rehearsal only**, use the **Alternate lenses** section to reorder the Should band.

**Companion:** full debt catalog lives across `docs/PRODUCT_COMPLETENESS_ROADMAP.md`, `docs/GO_LIVE_MATRIX.md`, `docs/FOUNDATION_LOCK.md`, `docs/ZORG_OS_V1_3_STRATEGIC_REALIGNMENT_EVIDENCE.md`, `docs/ACTOR_PROFILES_ROADMAP.md`, `docs/FRONTEND_UI_MODE_AUDIT.md`, `docs/MATCHING_EXPLAINABILITY.md`, `docs/CAREON_STRUCTURAL_MIGRATION_PLAN.md`, `docs/CONTRACT_FRICTION_PLAN.md`.

---

## How to read this backlog

| Tag | Meaning |
|-----|---------|
| **M — Must** | Blocks credible provider rollout, violates workflow/tenant/visibility law, or breaks CI safety nets. |
| **S — Should** | Materially improves provider operations or chain clarity; ship soon after Must. |
| **C — Could** | Valuable polish or long-horizon structural work; schedule when capacity allows. |
| **W — Won’t (now)** | Explicitly deferred until policy/architecture sign-off. |

**Ordering rule (provider-default):** **visibility + workflow integrity for zorgaanbieder** first, then **response/decision UX + audit**, then **shared chain surfaces** (matching payload clarity, gemeente hints), then **platform/docs** churn.

---

## Top 15 (execution order) — provider-chain-first

| # | Item | Tag | Provider lens | Effort | Risk if ignored |
|---|------|-----|---------------|--------|-----------------|
| 1 | **Tenant + visibility:** providers only see **linked** cases/requests; extend **`test_cross_tenant_isolation`** and API tests when adding placement/review surfaces (`FOUNDATION_LOCK`, placement visibility rules). | M | Core | Med | Data leak / regulatory breach. |
| 2 | **Workflow gates on provider paths:** no intake before placement confirmation; no bypass of gemeente-validated chain where required — re-verify after every provider UX/API change (`GO_LIVE_MATRIX`, state machine). | M | Core | Med | Illegal progression; liability. |
| 3 | Keep **pytest + provider pipeline suites + Platform Guardrails** green; failing **`deploy-production-check`** / **`npm audit`** = stop-the-line. | M | Core | Low | Bad releases on provider-facing envs. |
| 4 | **Structured provider decisions:** `rejection_reason_code` / notes + **audit visibility** in UI where actors need proof (not buried logs only) — align API + SPA (`contracts/api/views.py`, case detail / beoordeling flows). | M | Adoption | Med | Disputes; no accountability. |
| 5 | **Provider workspace coherence:** `ProviderIntakeDashboard` / review queues — KPI strip **only** in provider context, lists scan-first, no casus-detail NBA leakage (`FRONTEND_UI_MODE_AUDIT`). | S | UX | Med | Confusing or constitution-breaking UI. |
| 6 | **“Why us” clarity:** gemeente→provider handoff fields (short rationale, urgency, arrangement summary **as hints**) surfaced on provider review — without implying auto-financial correctness (`MATCHING_EXPLAINABILITY`, arrangement contract). | S | Trust | Med | Feels arbitrary / hostile to providers. |
| 7 | **Wire matching UI to real API payloads** on gemeente side **and** ensure provider-facing summaries consume the same truth (no divergent demo numbers) (`MatchingPageWithMap`, APIs). | S | Chain | High | Split-brain between actors. |
| 8 | **Browser smoke (provider path):** login (provider) → open assigned review → **info / accept / reject** → verify audit or timeline signal — expand Playwright or CI `with_playwright` for this path. | S | Confidence | Med | Regressions in hottest path. |
| 9 | **Actor read-model (P1):** show initiator / route context on provider surfaces **read-only** (no `WorkflowRole` auth change yet) (`ACTOR_PROFILES_ROADMAP`). | S | Clarity | Med | “Who sent this?” confusion. |
| 10 | **Arrangement intelligence copy on shared surfaces:** gemeente sees hints; provider copy must not read as guaranteed budget (`client/.../ArrangementAlignmentPanel`, shared banners). | S | Compliance | Med | Misinterpreted guarantees. |
| 11 | **Pilot rehearsal + `release_evidence_bundle.json` review** on cadence — still joint evidence for gemeente+provider timeline gates (`PILOT_PROOF_PACKAGE.md`). | S | Joint | Low | NO-GO without paper trail. |
| 12 | **Staging smoke (full shell):** authenticated routes for **both** roles after deploy (`/care/beoordelingen/`, plaatsingen, casussen, dashboard). | S | Ops | Low | Broken demos for either actor. |
| 13 | **`assessment` contract decision** — **closed:** internal stable contract for this wave (`docs/V1_SCOPE.md` §3; `PRODUCT_COMPLETENESS_ROADMAP` Step 5). | S | Platform | Low–Med | API/doc drift hurts integrations. |
| 14 | **Rollout evidence:** staging/prod checklist with **timestamps + owners** (`RELEASE_ROLLOUT_CHECKLIST.md`). | S | Ops | Low | Weak go-live audit. |
| 15 | **Anonimisatie / structural rename / `regiekamer` key rename** — batch as **Could** until provider path stable (rows map to former 13–15; pick after #12). | C | Later | High | Churn during adoption. |

---

## MoSCoW summary (themes) — under provider-default

### Must (provider safety + law)

- Visibility + tenant isolation (row 1).
- Provider-path workflow integrity (row 2).
- CI safety nets (row 3).
- Structured decisions + audit surfaces (row 4).
- Backend remains SoT; matching stays advisory (`AGENTS.md`, `FOUNDATION_LOCK`).

### Should (next sprint band)

- Provider workspace + handoff clarity (rows 5–7).
- Provider browser smoke (row 8).
- Actor read-model for context (row 9).
- Arrangement copy discipline (row 10).
- Joint pilot evidence + staging smoke (rows 11–12).
- `assessment` decision + rollout evidence (rows 13–14).

**Progress note (2026-05-15):** Rows **6, 8, A** — Reacties **“Waarom deze aanvraag bij jullie ligt”** (`provider-review-why-us-block`); Playwright asserts why-us + reject → **Verwerkte aanvragen** + API `REJECTED`; `run_full_pilot_rehearsal.sh --with-playwright` rebuilds SPA, auto-**`--start-server`**; `run_golden_path_e2e` resets DB before browser smoke. Pilot gate: headless rehearsal **GO** + Playwright **12 passed / 1 skipped** — [`RELEASE_EXECUTION_SHEET_2026-05-15.md`](./RELEASE_EXECUTION_SHEET_2026-05-15.md). Remaining: row **15** Could-band renames; optional accept-panel E2E when seeded card exposes capacity field.

**Progress note (2026-05-14):** Rows **6–9** — **baseline shipped:** provider evaluations expose **match explainability** (`matchFitSummary`, `matchTradeOffsHint`, `matchScore`), **arrangement hints** + disclaimer, **case coordinator** label; Reacties shows compact lines. **Matching** (`MatchingPageWithMap`) loads **`/care/api/cases/<id>/matching-candidates/`** when the samenvatting is complete; API rows include **`aanbiederName`** for client-side join; incomplete summary shows an amber status banner; otherwise legacy demo scores remain fallback. **Playwright** (`provider-review-smoke.spec.ts`): handoff UI + **timeline GET** smoke + **reject submit** (last test, mutates seeded case) + accept / info modal checks. **`staging-shell-smoke.spec.ts`:** gemeente **`/care/casussen`** + **`/regiekamer`** + provider Reacties mount. **ArrangementAlignmentPanel:** compact **advisory banner** (no budget/tarief guarantee; provider-facing arrangement is indicatief). **Pilot CI:** `run_full_pilot_rehearsal.sh` passes **`--reports-dir "$REPORT_DIR"`** into **`release_evidence_bundle`** so timeline inputs and **`release_evidence_bundle.json`** land in the same artifact folder as GitHub Actions; **`scripts/verify_release_evidence_bundle.py`** validates bundle shape post-rehearsal. **Row 5:** `docs/FRONTEND_UI_MODE_AUDIT.md` re-verified active provider routes + quarantine note; **`test_product_architecture_guardrails`** enforces design **`NextBestAction` / `ProcessTimeline`** imports only on **`CaseExecutionPage`**. **Row 14:** **`docs/RELEASE_EXECUTION_SHEET_TEMPLATE.md`** + checklist links. Remaining: richer “why us” marketing copy (row 6 polish), optional Playwright in **`with_playwright`** rehearsal (row 8 CI), **row 15** Could-band renames (defer).

### Could (after provider path is stable)

- Anonimisatie full service path (DPIA-gated).
- CareOn structural terminology migration.
- Timeline export / hash-chains (`CASE_TIMELINE_V1.md` future).
- Page-local `<style>` remediation; EN/NL comment cleanup; geo TODO in `contracts/views.py` when schema lands.
- **`regiekamer` / test id rename** — dedicated refactor (`ZORG_OS_V1_3_STRATEGIC_REALIGNMENT_EVIDENCE` §10).

### Won’t (now)

- Opaque ML matching / unexplainable ranking (`MATCHING_EXPLAINABILITY.md`).
- Persisted `UITSTROOM` enum without migration plan.
- Replacing `WorkflowRole` with fine-grained auth before P1 read-model.
- Net-new autonomous AI modules (`INFRASTRUCTURE_MATURITY_PHASE.md`).

---

## Alternate lens: pilot gemeente / rehearsal readiness

Use this ordering when **gemeente pilot + GO/NO-GO evidence** dominates:

1. Rows **11 → 3 → 12** first (pilot artifact ritual, CI, full shell smoke).
2. Then **7 → 10** (matching + arrangement on gemeente surfaces).
3. Then **1–2–4–5–6–8–9** as in the provider-default table — provider work stays **Must** for chain safety, but **gemeente rehearsal** can own scheduling of rows 11–12 before deep provider UX polish if the pilot has no provider users yet.

**Demote when gemeente-only rehearsal:** row 8 (provider Playwright) until provider accounts exist.

---

## Alternate lens: internal rehearsal only

1. Rows **3, 11, 8** (CI, pilot job artifact, minimal smoke).
2. Row **13** (`assessment` decision) to reduce internal confusion.
3. Defer **14** (rollout timestamps) until a target host exists; defer **15** wholesale.

---

## Completion signal (this backlog “wave”)

- **Must** band: all green on `main` for **2 consecutive weeks** + at least one **provider-path** smoke (manual or Playwright) documented.
- **Should** band: **≥70%** done or rescheduled with reason in git history.
- **Won’t** band: unchanged unless product signs scope change.

---

## Maintenance

When closing an item, update the canonical source doc (roadmap, audit, or matrix) in the **same PR** so this file stays a thin **ordering** layer, not a second source of truth.
