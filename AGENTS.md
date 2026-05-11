---
description: 
alwaysApply: true
---

# AGENTS.md

## Project Identity

This repository implements **Zorg OS / CareOn** — a **neutral orchestration layer for anonymous youth-care matching and throughflow coordination under capacity scarcity**. It is **not** an ECD, municipal ERP, or permanent dossier platform.

### Operating phase (temporary): infrastructure maturity

Ship **stability, observability, deterministic pilot/rehearsal, deploy truth, tests, and workflow integrity** first.

**Strategic v1.3 realignment (active):** product philosophy, UX, terminology, and documentation align with `docs/Zorg_OS_Product_System_Core_v1_3.md`. Net-new **autonomous** AI features remain out of scope; **advisory** arrangement alignment is explicitly productized (see `docs/Zorg_OS_Technical_Foundation_v1_3.md` + `client/src/lib/arrangementAlignmentContract.ts`).

Operational rehearsal artifacts and GO/NO-GO interpretation for **`./scripts/run_full_pilot_rehearsal.sh`** → **`docs/PILOT_PROOF_PACKAGE.md`** (not product marketing; evidence chain for humans/agents).

Zorg OS is a **decision system** and **coordination workspace**, not a passive analytics dashboard.

The system enforces:
- correct sequencing of actions
- correct ownership of decisions
- full traceability of every step

The system must always guide the correct actor to the **next best action**.

---

## Canonical Flow (Source of Truth — v1.3 product language)

**Aanmelding → Anonimisatie → Zorgvraag → Matching → Aanbieder reacties → Voorkeursmatch → Gemeentelijke validatie → Plaatsing → Uitstroom**

**Exit principle:** after successful placement and financing/arrangement validation, the trajectory **exits** the platform; ownership continues in external systems.

**Technical mapping:** persisted `WorkflowState` / API `phase` keys remain the implementation contract until a coordinated major version (see `docs/Zorg_OS_Technical_Foundation_v1_3.md`, `docs/FOUNDATION_LOCK.md`).

This flow governs:

- code
- UI
- data
- API behavior
- tests
- documentation

This flow is **non-negotiable** at the product level; implementation identifiers may differ during migration.

---

## Core Principle

The backend is the source of truth.

- All workflow rules must be enforced in the backend
- UI may guide but must never enforce logic
- Invalid transitions must be rejected at API level

---

## Decision Ownership (CRITICAL)

### Aanmelder (primary operational user — product)
- Initiates anonymous / pseudonymous requests and capacity search
- Reviews provider responses and progresses placement **within policy**
- Typical sources: wijkteam, jeugdbescherming, zorgaanbieder, crisisdienst (technical role may still be `gemeente` until actor profiles ship)

### Gemeente (financing & arrangement compatibility)
- Validates financing and arrangement compatibility
- Stimulates chain participation
- **Does not** perform provider accept/reject on behalf of zorgaanbieders

### Zorgaanbieder
- Exposes honourable capacity signals
- Performs accept/reject / info responses with structured reasons
- Executes placement steps and intake handoff where applicable

### Platform (AI)
- Supports anonymization patterns, matching, and **advisory** arrangement alignment
- Suggests next-best-action
- NEVER makes final placement or financial decisions

---

## Non-Negotiable Rules

Never violate:

1. No intake before placement
2. No placement before provider acceptance
3. No provider reacties before gemeentelijke validatie where the workflow requires that gate
4. Municipality cannot perform provider-level decisions
5. Matching is advisory only (never assignment)
6. Workflow steps may not be skipped or reordered
7. Every state transition must be auditable
8. UX must show next-best action + actor + reason

---

## State Machine (STRICT — technical)

Authoritative transitions live in `contracts/workflow_state_machine.py` (e.g. `DRAFT_CASE` → `SUMMARY_READY` → `MATCHING_READY` → `GEMEENTE_VALIDATED` → `PROVIDER_REVIEW_PENDING` → … → `ARCHIVED`).

Rules:
- No skipping states
- No reordering
- All transitions must include:
  - actor (who)
  - timestamp (when)
  - reason (why)

---

## Product Principles

### Workflow First
UI must guide progression, not display static data.

### Every Page Must Show
- current state
- why this state exists
- blocker (if any)
- responsible actor
- next-best action

### Action Over Decoration
Prefer:
- CTA banners
- blockers
- reason codes
- evidence

Avoid:
- passive dashboards
- dead-end pages
- cosmetic metrics

---

## Matching Rules

Matching must:

- produce top candidates
- include fit score (0–100)
- include confidence level
- include factor breakdown:
  - specialization
  - capacity
  - region
  - urgency
  - complexity

- explain trade-offs
- provide verification guidance

Matching must NOT:

- assign providers automatically
- hide uncertainty
- skip gemeentelijke validatie when the workflow requires that gate

---

## Gemeentelijke validatie (financiering & arrangement)

This is a mandatory **compatibility / financing** gate — not a substitute for provider judgment.

Must allow:
- approve or adjust matching selection from a financing/arrangement perspective
- request re-matching when compatibility is unclear

Must NOT allow:
- provider-level acceptance/rejection on behalf of zorgaanbieders
- bypass of aanbieder reacties when the workflow requires them

---

## Operationele coördinatie (voorheen Regiekamer)

Each signal must show:

- problem
- impact
- owner
- required action

System must detect:
- missing data
- weak matches
- delays
- repeated rejections
- capacity risks

Operationele coördinatie is:
→ a **coordination workspace**, not a surveillance or ERP dashboard

---

## Execution Model (MANDATORY)

### Step 1 — Task Classification

Classify tasks as:

- Frontend UX
- Backend Workflow
- Matching
- Operationele coördinatie
- Test/QA

---

### Step 2 — Skill Routing

Infer automatically:

- UI / layout → Frontend
- API / models → Backend
- scoring → Matching
- alerts → operationele coördinatie
- validation → Test/QA

If multi-domain:
- split into steps
- execute sequentially

---

### Step 3 — Scope Control

- Only inspect necessary files
- Never scan full repo unless required
- If unclear → ASK

---

### Step 4 — Structured Execution

Internally define:

TASK TYPE  
GOAL  
SCOPE  
CONSTRAINTS  
VERIFY  

---

### Step 5 — Implementation Rules

- Minimal but complete changes
- Fix root cause only
- No unnecessary rewrites
- Keep naming consistent

---

### Step 6 — Simplicity Rule

Prefer:
- simple solutions
- no speculative abstractions
- no unrelated refactors

---

### Step 7 — Output Requirements

Always return:

- changed files
- explanation
- verification result
- remaining risks

---

## Risk Classification

### LOW RISK
- UI changes
- copy updates

→ execute immediately

---

### MEDIUM RISK
- API changes
- model updates

→ verify affected flows

---

### HIGH RISK
- workflow transitions
- matching logic
- provider beoordeling
- placement/intake logic

→ STOP

Must:
1. explain impact
2. list affected flows
3. describe risks
4. wait for confirmation

---

## Verification Rules

### LOW
- UI renders correctly

### MEDIUM
- run tests
- validate logic

### HIGH
Must verify:

- no intake before placement
- no placement before acceptance
- no provider beoordeling before gemeente validation
- matching remains advisory

---

## Data Rules

- prefer additive changes
- preserve history
- use structured reason codes
- no vague booleans

---

## Audit Rules

Every action must log:

- actor
- action
- timestamp
- reason

Audit trail must be immutable.

---

## Safety Rule

If uncertain about:

- workflow
- decision ownership
- actor responsibility

→ STOP and ask

Never guess.

---

## Definition of Done

A task is complete only when:

- functionality works
- canonical flow is intact
- decision ownership is respected
- verification matches risk level
- no regressions exist

---

## Final Rule

If anything conflicts:

→ Canonical product flow (v1.3) wins; technical state names follow `docs/FOUNDATION_LOCK.md`

---

## UI MODE ENFORCEMENT

- MetricStrip → ONLY operationele coördinatie (route: `/regiekamer`)
- Worklist → ONLY aanvragen-werkvoorraad (route: `/casussen` e.d.)
- NextBestAction → ONLY aanvraag detail
- ProcessTimeline → ONLY aanvraag detail

Never create duplicate components.

If unsure → REMOVE element.

---

## Design Token Discipline

- Never introduce new hardcoded colors or spacing.
- Always use tokens or existing Tailwind theme keys.

If a value is missing:
→ extend tokens  
→ do NOT inline it

---

## VISUAL DENSITY RULES

- No oversized cards unless explicitly required
- KPI/status metrics must remain compact strips
- Operational signals must remain compact alert rows
- Worklist rows must remain rows, not cards
- Process timelines must remain compact and connected
- Do not add large decorative spacing
- Do not create nested card layouts
- Vertical space belongs primarily to the work/list/action area
- If a component grows too large, compress it before adding new UI

Conceptual hard limits:
- Metric strip: max ~56px
- Operational signal row: max ~64px
- Process timeline: max ~72px
- Worklist row: max ~64px
- Next-best-action: max ~156px
