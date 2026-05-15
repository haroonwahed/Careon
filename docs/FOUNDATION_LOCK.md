# FOUNDATION LOCK

**Primary references (CareOn Operational Constitution v2 — canonical doctrine):**

- `docs/Careon_Operational_Constitution_v2.docx` — authoritative formatted master  
- `docs/Careon_Operational_Constitution_v2.md` — plain-text export (search, diffs, agent tooling)  
- `docs/ZORG_OS_FOUNDATION_APPROACH.md` — system-first build strategy (aligned to constitution v2)

**Implementation lock (code — not superseded by constitution prose):** from this section’s **Technical implementation mapping** onward, plus `contracts/workflow_state_machine.py`.

Legacy technical evidence for extended lifecycle APIs: `docs/ZORG_OS_V1_2_EVIDENCE.md` (historical).

---

## Canonical operational flow (Constitution v2) + technical notes

Constitution v2 operational chain: **Casus → Samenvatting → Matching → Gemeente Validatie → Aanbieder Beoordeling → Plaatsing → Intake.**

**Uitstroom / exit:** after placement + financing/arrangement validation, the trajectory **exits** the platform to external systems of record (expressed today via completion + **archive** semantics and UX copy — see persisted states below). The platform is not the permanent dossier home.

Additional **glossary labels** (aanmelding, anonimisatie, uitstroom wording in UI) remain valid where `docs/TERMINOLOGY.md` maps them to stable API `phase` keys.

The backend remains the **source of truth** for transitions and actor permissions.

---

## Technical implementation mapping

Persisted workflow states and API `phase` keys are **stable implementation identifiers** (see `contracts/workflow_state_machine.py`). UI may use constitution or glossary language while API keys stay unchanged until a coordinated major version.

### Product stage ↔ API `phase` ↔ persisted states (mapping)

| Product stage (constitution / glossary) | Typical API `phase` / notes | Persisted states (examples) |
|---------------|---------------------------|-----------------------------|
| Casus / aanmelding | `casus`, early intake routes | `WIJKTEAM_INTAKE`, `DRAFT_CASE`, … |
| Anonimisatie | (masking / policy; UX + future services) | Deterministic masking today; dedicated services phased |
| Samenvatting / zorgvraag | `samenvatting` readiness | `SUMMARY_READY`, assessment gates |
| Matching | `matching` | `MATCHING_READY` |
| Gemeente validatie | `gemeente_validatie` | `GEMEENTE_VALIDATED`, `BUDGET_REVIEW_PENDING`, … |
| Aanbieder beoordeling | `aanbieder_beoordeling` | `PROVIDER_REVIEW_PENDING`, … |
| Plaatsing | `plaatsing` | `PLACEMENT_CONFIRMED`, … |
| Intake | intake progression | `INTAKE_STARTED`, `ACTIVE_PLACEMENT` |
| Uitstroom | completion / archive semantics | `ARCHIVED` — trajectory exited platform (product language) |

**Rule:** changing API `phase` enum values requires a **versioned contract** + client migration plan.

### Workflow authority (code)

- `contracts/workflow_state_machine.py` — states, transitions, `evaluate_transition`, `derive_workflow_state`.  
- `contracts/api/views.py` — mutation endpoints.  
- `contracts/decision_engine.py` — read models for NBA, blockers, Regiekamer overview.  
- `client/src/lib/decisionPhaseUi.ts` — **presentation mapping only** (never authority).

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

> Product language centers the **Aanmelder**; technical enforcement still uses `WorkflowRole` until fine-grained actor profiles ship. **Roadmap:** `docs/ACTOR_PROFILES_ROADMAP.md`.  
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

## UI density & token guardrails (retained from superseded Design Constitution v1.3)

Operational surfaces must follow:

- **Metric / signal strips** — compact operational telemetry, not vanity KPIs (see visual density limits in `AGENTS.md`).  
- **Worklists** — rows, not card stacks; scanability over decoration.  
- **Process timelines** — compact, legible; no ornamental density.  
- **Next-best-action** — primary focal band; no competing hero CTAs.  
- **Design tokens** — no ad-hoc hex; extend theme tokens instead of magic numbers.

UI work must comply with `docs/Careon_Operational_Constitution_v2.md` (UX + visual language) **and** this section.

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
- Contract: `client/src/lib/arrangementAlignmentContract.ts` and `docs/Careon_Operational_Constitution_v2.md` section 4 (arrangementen) + staging notes in this document.  
- Do **not** ship implied guarantees of financial correctness.

**Staging (technical, former Technical Foundation v1.3):**

- **Stage 1 (current):** TypeScript contract `client/src/lib/arrangementAlignmentContract.ts` defines suggestion shape: `equivalence_confidence`, `tariff_alignment_estimate`, `uncertainty_notes`, `requires_human_confirmation`.  
- **Stage 2:** optional read-only API `GET .../arrangement-alignment-hint/` returning the same JSON schema **without** mutating financing records.  
- **Stage 3:** optional human-confirmed logging to audit trail when a hint influenced a decision.  
- **Forbidden:** persisting auto-approved tariffs without human action + audit reason.
