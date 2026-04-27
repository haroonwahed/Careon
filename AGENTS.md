---
description: 
alwaysApply: true
---

# AGENTS.md

## Project Identity

This repository implements **Zorg OS**, a workflow-first Dutch care allocation system.

Zorg OS is a **decision system**, not a dashboard.

The system enforces:
- correct sequencing of actions
- correct ownership of decisions
- full traceability of every step

The system must always guide the correct actor to the **next best action**.

---

## Canonical Flow (Source of Truth)

**Casus → Samenvatting → Matching → Gemeente Validatie → Aanbieder Beoordeling → Plaatsing → Intake**

This flow governs:

- code
- UI
- data
- API behavior
- tests
- documentation

This flow is **non-negotiable**.

---

## Core Principle

The backend is the source of truth.

- All workflow rules must be enforced in the backend
- UI may guide but must never enforce logic
- Invalid transitions must be rejected at API level

---

## Decision Ownership (CRITICAL)

### Gemeente
- Creates casus
- Reviews AI output (summary + matching)
- Validates or adjusts matching
- Decides which provider receives the case

### Zorgaanbieder
- Performs beoordeling (accept/reject)
- Provides structured rejection reasons
- Executes placement
- Initiates intake

### System (AI)
- Generates summary
- Performs matching
- Suggests next-best-action
- NEVER makes final decisions

---

## Non-Negotiable Rules

Never violate:

1. No intake before placement
2. No placement before provider acceptance
3. No provider beoordeling before gemeente validatie
4. Municipality cannot perform provider-level decisions
5. Matching is advisory only (never assignment)
6. Workflow steps may not be skipped or reordered
7. Every state transition must be auditable
8. UX must show next-best action + actor + reason

---

## State Machine (STRICT)

Allowed transitions:

DRAFT → SUMMARY_READY  
SUMMARY_READY → MATCHING_READY  
MATCHING_READY → GEMEENTE_VALIDATED  
GEMEENTE_VALIDATED → PROVIDER_REVIEW  
PROVIDER_REVIEW → ACCEPTED  
PROVIDER_REVIEW → REJECTED  
ACCEPTED → PLACED  
PLACED → INTAKE  
INTAKE → DONE  

REJECTED → MATCHING_READY (retry flow)

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
- skip municipality validation

---

## Gemeente Validatie Rules

This is a mandatory decision gate.

Must allow:
- approve matching
- adjust selection
- request re-matching

Must NOT allow:
- provider-level acceptance/rejection
- bypass of provider beoordeling

---

## Regiekamer Rules

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

Regiekamer is:
→ a control tower, not a dashboard

---

## Execution Model (MANDATORY)

### Step 1 — Task Classification

Classify tasks as:

- Frontend UX
- Backend Workflow
- Matching
- Regiekamer
- Test/QA

---

### Step 2 — Skill Routing

Infer automatically:

- UI / layout → Frontend
- API / models → Backend
- scoring → Matching
- alerts → Regiekamer
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

→ Canonical Flow wins
