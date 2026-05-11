# Zorg OS — Technical Foundation v1.3

## 1. Non-negotiables

- **Backend is source of truth** for workflow transitions, permissions, and decision evaluation.  
- **Strict authorization** and **append-only audit** (`CaseDecisionLog`, governance events) remain mandatory.  
- **Provider visibility boundaries** — no cross-tenant data leaks; respect organization scoping.  
- **Invalid transitions rejected at API** — UI is explanatory only.

---

## 2. Product flow vs implementation mapping

Product language (v1.3) maps to **existing** persisted workflow states and API `phase` identifiers to avoid breaking clients mid-stream. UI may show v1.3 labels while API keys stay stable until a coordinated major version.

| Product stage | Typical API `phase` / notes | Persisted states (examples) |
|---------------|---------------------------|-----------------------------|
| Aanmelding | `casus`, early intake routes | `WIJKTEAM_INTAKE`, `DRAFT_CASE`, … |
| Anonimisatie | (masking / policy; UX + future services) | Deterministic masking today; dedicated services phased |
| Zorgvraag | `samenvatting` readiness | `SUMMARY_READY`, assessment gates |
| Matching | `matching` | `MATCHING_READY` |
| Aanbieder reacties | `aanbieder_beoordeling` | `PROVIDER_REVIEW_PENDING`, … |
| Voorkeursmatch | selection + send | `GEMEENTE_VALIDATED`, transitions to provider |
| Gemeentelijke validatie | `gemeente_validatie` | `GEMEENTE_VALIDATED`, `BUDGET_REVIEW_PENDING`, … |
| Plaatsing | `plaatsing` | `PLACEMENT_CONFIRMED`, … |
| Uitstroom | completion / archive semantics | `INTAKE_STARTED`, `ACTIVE_PLACEMENT`, `ARCHIVED` — **product language** for “trajectory exited platform” |

**Rule:** changing API `phase` enum values requires a **versioned contract** + client migration plan.

---

## 3. Workflow authority

Authoritative code:

- `contracts/workflow_state_machine.py` — states, transitions, `evaluate_transition`, `derive_workflow_state`.  
- `contracts/api/views.py` — mutation endpoints.  
- `contracts/decision_engine.py` — read models for NBA, blockers, Regiekamer overview.

Frontend files under `client/src/lib/decisionPhaseUi.ts` are **presentation mapping only**.

---

## 4. Roles (technical)

`WorkflowRole` today: `gemeente`, `zorgaanbieder`, `admin`.

**v1.3 alignment (incremental):** multiple real-world actors (wijkteam, crisis, …) may authenticate through the same technical role until **fine-grained actor profiles** exist. Product copy uses **Aanmelder**; permissions still enforce backend gates.

---

## 5. Arrangement intelligence (technical contract)

**Stage 1 (current):** TypeScript contract `client/src/lib/arrangementAlignmentContract.ts` defines suggestion shape: `equivalence_confidence`, `tariff_alignment_estimate`, `uncertainty_notes`, `requires_human_confirmation`.

**Stage 2:** optional read-only API `GET .../arrangement-alignment-hint/` returning the same JSON schema **without** mutating financing records.

**Stage 3:** optional human-confirmed logging to audit trail when a hint influenced a decision.

**Forbidden:** persisting auto-approved tariffs without human action + audit reason.

---

## 6. Exit / uitstroom (technical)

There is **no separate `UITSTROOM` workflow state** today; **uitstroom** is expressed as:

- Successful placement + intake completion path, then  
- `ARCHIVED` / closed operational status with explicit copy that the **trajectory continues externally**.

Future: optional explicit `TRAJECTORY_EXITED` state **only** if migrations + tests are scoped.

---

## 7. Regiekamer API

`GET /care/api/regiekamer/decision-overview/` remains read-only, derived from `evaluate_case`.  
Payload may gain optional `operational_workspace` metadata in a backward-compatible way when needed.

---

## 8. Testing & evidence

Strategic changes must update:

- `docs/ZORG_OS_V1_3_STRATEGIC_REALIGNMENT_EVIDENCE.md`  
- Guardrail tests under `tests/test_product_architecture_guardrails.py` when canonical text anchors move.

---

## 9. Migration from v1.2 docs

Implementation evidence for the extended gemeente lifecycle APIs remains in `docs/ZORG_OS_V1_2_EVIDENCE.md` (historical). **v1.3** supersedes **product philosophy** and UX canon; technical endpoints listed there may still apply until refactored.
