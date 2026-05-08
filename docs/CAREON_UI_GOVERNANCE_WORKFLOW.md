# CareOn UI Governance Workflow

## Purpose

This document operationalizes doctrine enforcement in day-to-day implementation and review.

It complements:

- `docs/CAREON_VISUAL_DOCTRINE.md`
- `docs/CAREON_DOCTRINE_ENFORCEMENT_PHASE2.md`

---

## 1) Canonical Primitive Enforcement

### Approved primitives (authoritative)

- `CarePageScaffold`
- `CareSection`, `CareSectionHeader`, `CareSectionBody`
- `CarePanel` (for panel surfaces)
- `CareSearchFiltersBar`
- `CareWorkRow` / workflow-row derivatives
- `PrimaryActionButton`
- `LoadingState`, `EmptyState`, `ErrorState`, `NoAccessState`
- canonical status/phase/ownership indicators (shared semantic mappings)

### Prohibited bypasses

- page-local panel wrappers where `CarePanel` / `CareSection` applies
- page-local status color maps for urgency/phase semantics
- page-local loading/error/empty shells
- local CTA systems that bypass primary/secondary/utility semantics

### Extension rule

No local alternatives unless formally approved via a documented exception:

1. why canonical primitive is insufficient
2. proposed API
3. migration strategy
4. sunset plan for duplicates

---

## 2) Canonical Visual Source Of Truth

### Primary reference

- Regiekamer (`SystemAwarenessPage`)

### Secondary references

- Casussen (`WorkloadPage`)
- MatchingQueue (`MatchingQueuePage`)
- PlacementTracking (`PlacementTrackingPage`)
- Acties (`ActiesPage`)

All new or refactored surfaces must align with these references for:

- hierarchy rhythm
- spacing rhythm
- density model
- CTA behavior
- state behavior
- operational tone
- realism level

---

## 3) Side-by-Side Coherence Review (Mandatory For Major UI Changes)

Evaluate these surfaces together:

- Regiekamer
- Casussen
- Matching
- Plaatsingen
- Intake
- Aanbieders

Review dimensions:

- spacing consistency
- typography consistency
- density consistency
- realism consistency
- CTA consistency
- orchestration feel
- operational calmness

Required output in review notes:

1. shared strengths
2. drift points
3. P0/P1/P2 classification
4. accepted alignment actions

---

## 4) Violation Taxonomy (Execution)

### P0 — Critical system violations (block merge)

- hardcoded semantic colors
- competing primary actions
- bespoke loading/error/empty state shells
- local hierarchy systems bypassing canonical primitives
- role/ownership action mismatches

### P1 — Coherence drift (must be planned)

- spacing rhythm inconsistency
- duplicate primitive variants
- local typography structure
- custom panel variants

### P2 — Polish deviations

- minor motion timing drift
- subtle composition misalignment
- icon alignment/padding polish gaps

---

## 5) P0 Convergence Start Targets

This workflow starts with structural stability only (no redesign):

1. remove hardcoded semantic colors
2. enforce one dominant CTA per operational section
3. normalize loading/error/empty/no-access states
4. converge duplicate panel implementations onto `CarePanel`
5. normalize duplicate status/timeline semantics

---

## 6) Status/Timeline Semantic Prep (Low-Risk)

Duplicate mappings currently exist across multiple files and must converge toward canonical semantics:

- status/urgency chip mappings:
  - `client/src/components/care/CaseTableRow.tsx`
  - `client/src/components/care/CaseCard.tsx`
  - `client/src/components/care/CasussenFilterChips.tsx`
- timeline event tone/icon mappings:
  - `client/src/components/care/CaseTimeline.tsx`
  - timeline-specific semantics embedded in `client/src/components/care/CaseExecutionPage.tsx`

Phase-2 prep rule:

- extract only obvious shared semantic maps when low risk
- do not redesign timeline visuals during P0
- preserve behavior while reducing duplicated tone logic

---

## 7) Subtraction Gate

Every UI review must answer:

- what can be removed?
- what is louder than necessary?
- what duplicates hierarchy?
- what is decorative only?
- what adds noise without clarity?

Preference: restraint over accumulation.

