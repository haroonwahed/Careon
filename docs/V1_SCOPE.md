# CareOn / Zorg OS — v1 execution scope

**Effective:** 2026-05-14  
**Status:** Active for the current sprint wave (see `docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`).

## Phase 0 — closure (aligned & frozen)

**Closed as of 2026-05-14** for the v1 wave. Items below are either **done** or **explicitly deferred** with a recorded decision (no open “unknown” scope).

| Gate | Outcome |
|------|---------|
| **0.1 Delivery lens** | **Provider-chain-first** is the default (§1). Gemeente-rehearsal-first reorder is documented in `docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md` (Alternate lenses). |
| **0.2 v1 boundary** | **§2** — in-scope orchestration vs out-of-scope ERP/AI/rename churn. |
| **0.3 `CasusControlCenter`** | **QUARANTINED_LEGACY** — not in the SPA route tree; `FEATURE_INVENTORY.md` + in-file quarantine notice. |
| **0.4 `assessment` contract** | **§3** — keep `CaseAssessment` + `assessment` URLs/keys **internal-stable** for this wave; no rename without dual-read migration plan. |
| **Identifiers: `regiekamer` / `UITSTROOM`** | **Deferred** — not Phase 0 deliverables. Follow **`PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md`** (Could / Won’t): no `regiekamer` key rename and no persisted `UITSTROOM` enum until a signed migration plan exists. |
| **Legacy / archive docs** | **Process rule:** any time an older doc is edited, add a clear **historical / non-guidance** banner at the top. Repo-wide sweeps remain in **`docs/PRODUCT_COMPLETENESS_ROADMAP.md`** Sprint C (ongoing hygiene, not a v1 blocker). |
| **Browser smoke (landing → login → dashboard → logout)** | **Automated baseline** lives in client E2E / guardrails where configured; expand when CI enables Playwright against a fixed rehearsal URL. |

Phase 0 does **not** require shipping deferred Could/Won’t items; closure means **decisions and boundaries are written**, not that every future refactor is finished.

## Phase 1 Must-band — baseline delivered (engineering)

The **Must** rows in `docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md` (1–4) are addressed to a **credible baseline** in code and tests below. **Ongoing** work (CI green on `main`, rehearsal GO/NO-GO, staging smoke both roles) stays a **release ritual**, not a one-time ticket.

| Must row | Baseline delivered in repo |
|----------|----------------------------|
| **1 Tenant + visibility** | `tests/test_cross_tenant_isolation.py`: linked-placement visibility, list APIs, case-scoped GETs, **POST/PATCH mutations** across tenants, **`cases_bulk_update_api`** no-op for other-org IDs, **`case_evaluations_api` POST** and **`transition_request_financial_api` POST** cross-tenant **404**. Extend the same patterns when new case-scoped endpoints ship. |
| **2 Workflow gates** | **No change to doctrine in this pass** — gates remain in `contracts/workflow_state_machine.py` + API. **Verify** after every provider-facing change: `tests/test_workflow_foundation_lock.py`, `tests/test_decision_engine.py`, pilot rehearsal / timeline checks per `docs/PILOT_PROOF_PACKAGE.md`. |
| **3 CI stop-the-line** | Guardrails are the **source of truth** on `main` (pytest, deploy check, client audit/build). Contributors keep them green; agents cannot substitute for hosted CI. |
| **4 Structured provider decisions** | API: **`provider_response_reason_code`**, **`provider_response_notes`** on placement detail for monitoring. UI: gemeente + zorgaanbieder **Reacties** audit copy, **NEEDS_INFO** placement evidence, info-request **modal** test hooks + Vitest/Playwright smoke paths. |

**P1 Should (read-model handoff, shipped):** `GET /care/api/provider-evaluations/` rows include optional **`municipalityName`**, **`entryRoute`** / **`entryRouteLabel`**, **`aanmelderActorProfile`** / **`aanmelderActorProfileLabel`** (from linked intake, read-only). **Row 6 hints:** **`matchFitSummary`**, **`matchTradeOffsHint`**, **`matchScore`** from persisted **`MatchResultaat`**; **`arrangementHintLine`** + **`arrangementHintDisclaimer`**; **row 9:** **`caseCoordinatorLabel`**. The zorgaanbieder **Reacties** card shows compact lines when present; gemeente **Matching** page consumes **`matching-candidates`** when available (`MatchingPageWithMap`, **`aanbiederName`** on API). Rehearsal seed sets wijkteam route + aanmelder-profiel on the Horizon SLA casus (`seed_demo_data` / `CASE_TITLES[11]`). Evidence: `tests/test_cross_tenant_isolation.py`, `tests/test_seed_demo_data.py`, `client/src/components/care/AanbiederBeoordelingPage.test.tsx`, `client/src/components/care/MatchingPageWithMap.test.tsx`, `client/tests/e2e/provider-review-smoke.spec.ts`.

## 1. Delivery lens (Phase 0.1)

**Provider-chain-first** is the default ordering for engineering and product until explicitly superseded.

Priorities in order:

1. Tenant isolation and **linked-placement visibility** for zorgaanbieder users  
2. Workflow gates on provider paths (backend remains source of truth)  
3. Structured provider responses and **auditability**  
4. CI, pilot rehearsal evidence, and staging smoke  

If the next release is **gemeente pilot / rehearsal only** with **no** provider accounts, use the **gemeente-rehearsal-first** ordering in `docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md` (Alternate lenses) and demote provider Playwright until providers exist.

## 2. v1 product boundary

**In scope:** Operational **coordination** for the canonical flow (casus → samenvatting → matching → gemeente validatie → aanbieder beoordeling → plaatsing → intake), advisory matching, gemeente financing/arrangement compatibility gate, Regiekamer-style signals where implemented, and **machine-readable** pilot rehearsal artifacts.

**Explicitly out of scope for this wave:** Full anonimisatie / autonomous AI routes (DPIA and security sign-off), structural `regiekamer` identifier renames, persisted dedicated **uitstroom** state without a migration plan, replacing `WorkflowRole` with full actor-profile IAM (P1 remains **read-model hints** only), and any feature that implies automatic placement or financial correctness.

**Surface map:** `FEATURE_INVENTORY.md` (`ACTIVE_PRODUCT`, `SUPPORTING_INTERNAL`, `QUARANTINED_LEGACY`, `DEMO_ONLY`).

## 3. `assessment` contract (Phase 0.4)

**Decision:** Keep **`CaseAssessment`**, **`assessment` JSON keys**, and REST paths including **`/care/api/cases/<case_id>/assessment-decision/`** and **`assessments_api`** as the **stable internal technical contract** for the gemeente samenvatting / matching-readiness step.

- Visible product language stays aligned with **Samenvatting** and constitution wording; technical identifiers are not renamed in this wave.  
- A future public rename (for example toward `case_summary`) requires a **written dual-read migration** (API + SPA + tests) before schema or URL churn — do not rename opportunistically during provider-path stabilization.

## 4. References

| Document | Role |
|----------|------|
| `docs/V1_SHIP_CHECKLIST.md` | **Merge-ready** PR + rehearsal + staging smoke checkboxes |
| `docs/PRODUCT_ENGINEERING_BACKLOG_PRIORITIZED.md` | Top-15 execution order |
| `docs/PILOT_PROOF_PACKAGE.md` | GO/NO-GO rehearsal |
| `docs/FOUNDATION_LOCK.md` | WorkflowState / phase keys |
| `docs/Careon_Operational_Constitution_v2.md` | Doctrine and UX law |
| `AGENTS.md` | Agent and contributor rules |
