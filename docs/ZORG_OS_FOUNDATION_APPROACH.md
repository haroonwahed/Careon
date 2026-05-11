# Zorg OS - Foundation Approach

System-First Build Strategy (aligned to **Zorg OS v1.3** — see `docs/Zorg_OS_Product_System_Core_v1_3.md`).

## 1. Core Principle

Zorg OS is workflow-first and **throughflow-centric** (aanvraag / orchestration), not a permanent dossier platform.

The platform must guide the right actor to the next correct action and prevent out-of-order progression.

The backend owns workflow truth. UI and API consumers are adapters, not policy owners.

## 2. Core Workflow (Non-Negotiable — v1.3 product language)

Aanmelding → Anonimisatie → Zorgvraag → Matching → Aanbieder reacties → Voorkeursmatch → Gemeentelijke validatie → Plaatsing → **Uitstroom**

Rules:

- The **Aanmelder** initiates the trajectory; technical roles may still map to `gemeente` / `zorgaanbieder` until finer profiles exist.
- Zorgvraag / summary clarifies context and missing information, but is not a final placement decision.
- Matching proposes explainable **zorgcapaciteit** candidates and does not auto-assign.
- **Gemeentelijke validatie** covers financing / arrangement compatibility — not provider accept/reject on behalf of aanbieders.
- **Aanbieder reacties** are the substantive accept/reject / info decisions by zorgaanbieder.
- Plaatsing is only valid after provider acceptance.
- Intake only starts after placement confirmation where applicable.
- **Uitstroom**: after validated placement + financing alignment, the trajectory exits the platform; external systems own continuation.

## 3. Core Domain Model

Required domain entities:

- Aanvraag anchor (CareCase + CaseIntakeProcess as operational throughflow record, not a permanent ECD dossier)
- Case summary and readiness (CaseAssessment)
- Match output and recommendation evidence
- Provider evaluation decision
- Placement outcome (PlacementRequest)
- Intake status and timeline
- Audit trail (CaseDecisionLog)

Design expectations:

- Use explicit workflow states over vague booleans.
- Keep actor ownership explicit per action.
- Keep reason codes structured for explainability and audit.
- Preserve traceability from aanmelding through placement and **uitstroom** handoff.

## 4. State Machine

Canonical workflow states:

- DRAFT_CASE
- SUMMARY_READY
- MATCHING_READY
- GEMEENTE_VALIDATED
- PROVIDER_REVIEW_PENDING
- PROVIDER_ACCEPTED
- PROVIDER_REJECTED
- PLACEMENT_CONFIRMED
- INTAKE_STARTED
- ARCHIVED

Canonical actions:

- create_case
- complete_summary
- start_matching
- validate_matching
- send_to_provider
- provider_accept
- provider_reject
- provider_request_info
- confirm_placement
- start_intake
- archive_case
- rematch

Role ownership policy:

- gemeente: create_case, complete_summary, start_matching, validate_matching, send_to_provider, confirm_placement, archive_case, rematch
- zorgaanbieder: provider_accept, provider_reject, provider_request_info, start_intake
- admin/regie: all actions

## 5. Backend as Source of Truth

All state-changing actions must be guarded and validated server-side before persistence.

Implementation baseline in this repository:

- State machine and role policy module: contracts/workflow_state_machine.py
- Transition event type: CaseDecisionLog.EventType.STATE_TRANSITION
- API guard surfaces:
  - /care/api/cases/intake-create/
  - /care/api/cases/<id>/assessment-decision/
  - /care/api/cases/<id>/matching/action/
  - /care/api/cases/<id>/provider-decision/
  - /care/api/cases/<id>/placement-action/
  - /care/api/cases/<id>/intake-action/
- Server action guard surfaces:
  - /care/casussen/<id>/matching/action/
  - /care/casussen/<id>/provider-response/action/
  - /care/casussen/<id>/outcomes/action/
  - /care/casussen/<id>/placement/action/
  - /care/casussen/<id>/archive/

Audit contract:

- Every accepted transition appends a CaseDecisionLog STATE_TRANSITION row.
- Transition evidence captures old state, new state, action, actor role, actor id, and source endpoint.
- Audit logging is append-only and must never block operational progression.

## Foundation Adoption Rule

When conflicts appear between legacy behavior and this approach, align code and UX toward this foundation and preserve the canonical flow above.
