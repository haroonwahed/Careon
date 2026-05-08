# CareOn Doctrine Enforcement — Phase 2

## Purpose

This document operationalizes the CareOn Visual Doctrine into measurable and enforceable system behavior.

Phase 2 is **not** a redesign phase.  
It is an enforcement phase to prevent drift into inconsistency, conceptual UI, dashboard noise, and ad hoc implementation.

This artifact is the official enforcement layer for:

- PR reviews
- UI reviews
- component proposals
- workflow/page additions
- landing and shell updates

---

## Core Enforcement Objective

Every UI decision must be evaluated against:

- operational clarity
- institutional trust
- realism
- hierarchy discipline
- orchestration consistency
- calmness
- role-awareness
- doctrine alignment

The target state is a single governed operational system, not page-by-page design.

---

## 1) Doctrine Compliance Checklist (Mandatory)

Use this checklist on every UI-impacting PR.

### A. Operational Clarity

Can users immediately understand:

1. what is happening
2. why it is happening
3. who owns it
4. what the safest next action is

Flag if present:

- ambiguity
- unclear ownership
- hidden next-best-action
- conceptual abstraction replacing explicit workflow semantics

### B. Visual Calmness

Does the surface feel calm, composed, operational, and trustworthy?

Flag if present:

- visual shouting
- badge storms
- attention competition
- contrast wars
- dashboard clutter

### C. System Realism

Does the UI feel like real operational software used by institutions?

Flag if present:

- fake workflow art
- decorative topology
- conceptual orchestration graphics
- unrealistic demo widgets
- placeholder pseudo-data blocks presented as real operations

### D. CTA Hierarchy

Does each operational section contain one clear dominant next-best action?

Flag if present:

- competing primaries
- oversized CTA clusters
- utility actions overshadowing operational actions
- unclear action priority

### E. Typography Hierarchy

Is hierarchy primarily communicated through typography, spacing, and density?

Flag if present:

- border-dependent hierarchy
- glow-based hierarchy
- excessive segmentation
- badge-based over-structuring

### F. Density Governance

Is complexity controlled and readable?

Flag if present:

- stacked card walls
- dashboard soup
- overloaded simultaneous emphasis
- weak scanability
- unresolved visual congestion

### G. Role-Aware Orchestration

Does the interface clearly communicate role boundaries and ownership?

Flag if present:

- role ambiguity
- uncontrolled visibility
- uncertain operational responsibility
- action affordances for the wrong actor

### H. Doctrine Alignment

Does the surface feel institutional, infrastructural, calm, trustworthy, and operational?

Flag if present:

- startup aesthetics
- gimmicks
- AI marketing energy
- generic SaaS admin patterns
- flashy “innovation theater”

---

## 2) Compliance Scoring Framework

Each reviewed surface receives six scores from 0 to 5:

1. Doctrine alignment
2. Realism
3. Operational clarity
4. Hierarchy discipline
5. Orchestration clarity
6. Trustworthiness

### Score Rubric

- **5.0** = exemplary, canonical reference quality
- **4.0–4.9** = strong, minor polish deviations only
- **3.0–3.9** = acceptable with notable drift
- **2.0–2.9** = weak coherence, requires corrective work
- **0.0–1.9** = unacceptable, reject for redesign/rework

### Decision Thresholds

- **Pass**: average >= 4.0 and no P0 violations
- **Warning**: average 3.0–3.9 or >= 1 P1 violation
- **Reject**: average < 3.0 or any unresolved P0

Hard rule: unresolved P0 always blocks merge regardless of average score.

---

## 3) Canonical Reference Standard

These are the visual source surfaces for CareOn:

### Primary Canonical Surface

- `Regiekamer` (`SystemAwarenessPage`)

### Secondary Canonical Surfaces

- `Casussen` (`WorkloadPage`)
- `MatchingQueue` (`MatchingQueuePage`)
- `PlacementTracking` (`PlacementTrackingPage`)
- `Acties` (`ActiesPage`)

### Canonical Behavior Model

All non-marketing surfaces should align to these references for:

- spacing rhythm
- hierarchy model
- CTA behavior
- density model
- motion restraint
- panel behavior
- typography cadence
- orchestration semantics (state/owner/next action)

If a new surface diverges, it must include an explicit approved exception.

---

## 4) Violation Taxonomy

All issues must be labeled P0/P1/P2.

### P0 — Critical System Violations (Merge Blockers)

Examples:

- hardcoded semantic colors
- competing primary actions
- bespoke loading/error/empty states
- local hierarchy systems that bypass canonical primitives
- incorrect role/ownership action exposure

### P1 — Coherence Drift (Must Plan + Track)

Examples:

- spacing rhythm inconsistency
- duplicate primitive patterns
- local typography patterns
- custom panel variants outside sanctioned primitives

### P2 — Polish Deviations (Queue for Cleanup)

Examples:

- minor motion timing differences
- subtle compositional inconsistency
- icon alignment/padding polish gaps

---

## 5) Primitive Enforcement Ruleset

### 5.1 Approved Primitive Set (Authoritative)

Core layout and composition:

- `CarePageScaffold`
- `CareSection`, `CareSectionHeader`, `CareSectionBody`
- `CareSearchFiltersBar`
- `CareWorkRow` / workflow row derivatives

Core actions:

- `PrimaryActionButton` (dominant action)
- button variants aligned to canonical semantics (primary/secondary/utility/destructive)

Core state:

- `LoadingState`
- `EmptyState`
- `ErrorState`
- `NoAccessState` (to be introduced as canonical state primitive where absent)

Core operational semantics:

- canonical phase/status badges and ownership indicators
- shared urgency/status tone mappings

### 5.2 Deprecated / Restricted Patterns

- page-local panel systems that duplicate canonical section/panel behavior
- page-local timeline systems when a canonical timeline exists
- page-local semantic chip/badge color maps
- ad hoc state shells (custom loader/error/empty blocks)

### 5.3 Extension Rules

No local alternatives are allowed unless formally approved.

An extension request must include:

1. reason canonical primitive is insufficient
2. proposed API and constraints
3. migration impact
4. plan to avoid primitive duplication

No approval means no merge.

---

## 6) Realism Standard (Operational Credibility Gate)

Reject:

- decorative orchestration
- fake topology visuals
- conceptual dashboard art
- placeholder bars/widgets posing as operational insight
- fake AI visual gimmicks

Require:

- believable workflow semantics
- realistic state transitions
- authentic institutional structure
- role-true ownership and action flows
- concrete operational language

Definition of realism pass:

“This screen could plausibly be used by municipalities and providers in real operations today.”

---

## 7) Subtraction Review Framework

Every review must include explicit subtraction prompts:

1. What can be removed?
2. What is visually louder than necessary?
3. What duplicates hierarchy?
4. What is purely decorative?
5. What adds noise without adding clarity?

Doctrine bias:

- restraint over accumulation
- compositional calm over feature stacking

No net-new visual complexity without net-new operational clarity.

---

## 8) Governance Workflow (Required)

### 8.1 Review Sequence

1. **Doctrine pre-check** (author self-check using checklist A-H)
2. **Implementation review** (primitive/tokens compliance)
3. **Design governance review** (P0/P1/P2 classification + scoring)
4. **Merge decision** (pass/warning/reject)

### 8.2 Required PR Template Fields (UI changes)

- affected surfaces
- dominant action definition per changed section
- state handling approach (loading/empty/error/no-access)
- role/ownership implications
- doctrine checklist results (A-H)
- six-score matrix
- violation list with P-level

### 8.3 Merge Policy

- Any unresolved P0 => reject
- Warning-level PRs (3.x average) require a linked follow-up issue
- Repeated P1 category violations trigger targeted refactor wave assignment

---

## 9) Phase 2 Outputs and Ownership

This document is the official Phase 2 governance artifact and must be referenced by:

- design reviews
- frontend PR reviews
- system convergence planning
- visual QA

Recommended ownership:

- Product Design Lead (doctrine steward)
- Frontend Lead (implementation enforcement)
- Workflow Owner (operational clarity + role correctness)

---

## 10) Final Enforcement Standard

CareOn must continuously converge toward:

- related surfaces
- intentional hierarchy
- calm operational clarity
- infrastructural trust
- institutional maturity

CareOn is no longer evaluated by individual page quality alone.  
It is evaluated as one coherent operational intelligence system.

