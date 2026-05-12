# FOUNDATION LOCK

**Primary references (v1.3 — canonical):**

- `docs/Zorg_OS_Product_System_Core_v1_3.md` — product boundaries & actors  
- `docs/Zorg_OS_Technical_Foundation_v1_3.md` — implementation mapping & API discipline  
- `docs/CareOn_Design_Constitution_v1_3.md` — UX / visual law  
- `docs/ZORG_OS_FOUNDATION_APPROACH.md` — system-first build strategy (being aligned to v1.3)

Legacy technical evidence for extended lifecycle APIs: `docs/ZORG_OS_V1_2_EVIDENCE.md` (historical).

---

## Canonical product flow (v1.3)

**Aanmelding → Anonimisatie → Zorgvraag → Matching → Aanbieder reacties → Voorkeursmatch → Gemeentelijke validatie → Plaatsing → Uitstroom**

The platform is **temporary orchestration infrastructure**: after placement + financing/arrangement validation, the trajectory **exits** to external systems of record (**uitstroom**). It is not the permanent home of the dossier.

The backend remains the **source of truth** for transitions and actor permissions.

---

## Technical implementation mapping

Persisted workflow states and API `phase` keys are **stable implementation identifiers** (see `contracts/workflow_state_machine.py`). UI may use v1.3 product language while API keys stay unchanged until a coordinated major version.

### Canonical States (persisted)

- `DRAFT_CASE`
- `SUMMARY_READY`
- `MATCHING_READY`
- `GEMEENTE_VALIDATED`
- `PROVIDER_REVIEW_PENDING`
- `PROVIDER_ACCEPTED`
- `PROVIDER_REJECTED`
- `BUDGET_REVIEW_PENDING`
- `PLACEMENT_CONFIRMED`
- `INTAKE_STARTED`
- `ACTIVE_PLACEMENT`
- `ARCHIVED` — **product:** *uitstroom* / traject afgesloten (geen permanente dossierstatus in dit platform).

### Zorg OS v1.2 extensions (technical)

Additional workflow states: `WIJKTEAM_INTAKE`, `ZORGVRAAG_BEOORDELING`. Wijkteam-instroom: `CaseIntakeProcess.entry_route = WIJKTEAM`. Zorgvormen en budget: `PlacementRequest.budget_review_status`, `contracts/care_lifecycle_v12.py`. Evaluaties en doorstroom: `CaseCareEvaluation`, `ProviderCareTransitionRequest`.

---

## Actor ownership (technical roles)

> Product language centers the **Aanmelder**; technical enforcement still uses `WorkflowRole` until fine-grained actor profiles ship.  
> **Mapping (aanmelder ↔ rollen):** see `docs/AANMELDER_WORKFLOWROLE_MAPPING.md`.  
> **Productmetadata:** `CaseIntakeProcess.aanmelder_actor_profile` (gezet bij intake-create) is **niet** voor autorisatie en **niet** in SPA case-JSON; alleen persistentie + admin/exports.

- **gemeente** (`WorkflowRole.GEMEENTE`)
  - create_case
  - start_matching
  - validate_matching
  - send_to_provider
  - confirm_placement
  - archive_case
  - rematch
  - budget decisions (where applicable)
- **zorgaanbieder** (`WorkflowRole.ZORGAANBIEDER`)
  - create_case (zelfde intake-create endpoint als gemeente; keten blijft gemeente-validatie vóór toewijzing)
  - provider_accept
  - provider_reject
  - provider_request_info
  - start_intake
- **admin**
  - all actions

---

## Enforced Mutation Endpoints

- `/care/api/cases/intake-create/`
- `/care/api/cases/<id>/assessment-decision/`
- `/care/api/cases/<id>/matching/action/`
- `/care/api/cases/<id>/provider-decision/`
- `/care/api/cases/<id>/placement-action/`
- `/care/api/cases/<id>/intake-action/`
- `/care/casussen/<id>/matching/action/`
- `/care/casussen/<id>/provider-response/action/`
- `/care/casussen/<id>/outcomes/action/`
- `/care/casussen/<id>/placement/action/`
- `/care/casussen/<id>/archive/`

---

## Audit Requirements

Every valid transition writes append-only evidence in `CaseDecisionLog` using event type `STATE_TRANSITION` with:

- case id
- actor user id
- actor role
- old state
- new state
- action
- source endpoint
- optional reason/note

---

## Read-only advisory APIs (no workflow mutation)

- `GET /care/api/cases/<id>/arrangement-alignment/` — arrangement equivalence hints (staging): **JZ21** → **NZa zorgproduct** → **iWlz-codelijsten** → heuristiek (`contracts/arrangement_alignment_catalog.py`); databestanden en bron-URL’s in `docs/ARRANGEMENT_OFFICIAL_SOURCES.md`. Zelfde case **VIEW** als `decision-evaluation`; payload bevat altijd `requires_human_confirmation: true` (contract).

---

## Hard Guards

- No provider review bypass from matching directly to placement.
- No placement confirmation before provider acceptance.
- No intake start before placement confirmation.
- No archive before intake started/completed.

---

## Decision Engine

The backend decision engine is the single source for operational guidance on an **aanvraag** (case). It powers coordination alerts, page banners, CTA visibility, blocked action reasons, and future matching intelligence.

### Purpose

- Evaluate the current state of an aanvraag.
- Return blockers, risks, alerts, next-best-action guidance, allowed actions, blocked actions, and explanation context.
- Keep decision authority in the backend so the frontend only renders the result.

### Output Shape

`evaluate_case(case, actor=None, actor_role=None) -> dict`

The payload is JSON-serializable and includes:

- `case_id`
- `current_state`
- `phase`
- `next_best_action`
- `blockers`
- `risks`
- `alerts`
- `allowed_actions`
- `blocked_actions`
- `decision_context`
- `timeline_signals`

### Blocker Rules

- `MISSING_REQUIRED_CASE_DATA`
- `MISSING_SUMMARY`
- `MATCHING_NOT_READY`
- `PROVIDER_NOT_ACCEPTED`
- `PLACEMENT_NOT_CONFIRMED`
- `CASE_ARCHIVED`

### Risk Rules

- `LOW_MATCH_CONFIDENCE`
- `REPEATED_PROVIDER_REJECTIONS`
- `CAPACITY_RISK`
- `HIGH_URGENCY_IDLE`
- `INTAKE_DELAYED`

### Alert Rules

- `INCOMPLETE_CASE`
- `MISSING_SUMMARY`
- `NO_MATCH_AVAILABLE`
- `WEAK_MATCH_NEEDS_VERIFICATION`
- `PROVIDER_REJECTED_CASE`
- `PROVIDER_REVIEW_PENDING_SLA`
- `PLACEMENT_BLOCKED`
- `INTAKE_NOT_STARTED`
- `ARCHIVED_CASE`

### Next-Best-Action Priority

1. Resolve critical blockers  
2. Complete missing aanvraag data  
3. Generate or check summary / zorgvraag readiness  
4. Start matching  
5. Send selected match to provider  
6. Wait or follow up provider responses  
7. Handle provider rejection  
8. Confirm placement after acceptance  
9. Start intake after placement  
10. Complete trajectory / uitstroom handoff  
11. Archive completed aanvraag  

### API Endpoint

- `GET /care/api/cases/<id>/decision-evaluation/`
- `GET /care/api/regiekamer/decision-overview/`

Both endpoints require authentication, respect case visibility permissions, and are read-only. They do not mutate data or create audit events.

### Coordination overview (Regiekamer API)

`GET /care/api/regiekamer/decision-overview/` powers the live **operationele coördinatie** surface.

- It is derived from `evaluate_case()` and reuses the backend decision contract.
- It returns active aanvragen only and excludes archived cases.
- It exposes totals, priority ordering, top blocker/risk/alert summaries, and next-best-action hints for rendering only.
- It does not own workflow authority and the frontend must not infer blockers or next actions on its own.

### Frontend Consumption Rule

- The frontend may display decision evaluation output.
- The frontend may not reimplement decision authority.
- The frontend must treat the backend decision engine as the source of truth for blockers, next-best action, and blocked-action reasons.

## Aanvraag detail surface

The active aanvraag detail page is the operational command surface for one throughflow.

It must render backend decision evaluation directly and show:

- current phase and status
- next-best action
- blockers, risks, and alerts
- allowed and blocked actions for the current role
- decision context for transparency
- recent timeline signals when available

### UI Rules

- CTA visibility comes from `evaluate_case`.
- Blocked action reasons come from `evaluate_case`.
- The frontend may call mutation endpoints, but it must refetch decision evaluation after every successful action.
- The frontend may not infer workflow transitions from local status checks on this page.

---

## v1.3 product evolution (anonymization, uitstroom, arrangement intelligence)

These capabilities are **named product commitments** in v1.3. Technical delivery is **phased**; do not imply features are fully automated until endpoints + tests exist.

### Anonimisatie

- Product language treats **anonimisatie** as a first-class stage of the orchestration layer.  
- Today: deterministic masking / safe display patterns may apply in UI.  
- Next: dedicated services/routes require explicit permissions, audit events, DPIA alignment, and tests **before** production claims.

### Uitstroom

- **Uitstroom** is the product term for **trajectory exit** after placement + financing/arrangement validation; externally owned continuation.  
- Today: expressed via completion + **archive** semantics and UX copy — not a separate persisted `UITSTROOM` state (optional future migration).

### Arrangement intelligence

- **AI-assisted arrangement alignment** suggests semantic equivalence and tariff alignment **with explicit uncertainty**; humans remain accountable.  
- Contract: `client/src/lib/arrangementAlignmentContract.ts` and `docs/Zorg_OS_Technical_Foundation_v1_3.md`.  
- Do **not** ship implied guarantees of financial correctness.
