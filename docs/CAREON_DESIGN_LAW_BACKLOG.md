# CareOn design law backlog

Ordered implementation backlog derived from `docs/CAREON_DESIGN_LAW_AUDIT_AND_ROADMAP.md`.

Purpose:

- convert the audit into execution order
- keep the work focused on the live SPA surfaces
- preserve the canonical workflow and the shared page grammar

Rule:

- complete items in order unless a higher item is blocked by a dependency outside the current change set
- do not start lower-priority visual work before the shared primitives are normalized

---

## P0. Shared grammar first

### 1. Normalize the shared page scaffold

Target files:

- `client/src/components/care/CarePageScaffold.tsx`
- `client/src/components/care/CareUnifiedPage.tsx`
- `client/src/components/care/CareDesignPrimitives.tsx`

Work:

- standardize the Attention Layer API
- standardize the Workflow Layer placement
- define one compact detail surface pattern
- remove inconsistent header/action spacing across operational pages

Why first:

- every page currently reimplements hierarchy slightly differently
- this is the lowest-cost way to reduce noise across the platform

Acceptance:

- attention, workflow, work surface, and detail surface can be composed without page-specific hacks
- no new page needs to invent its own grammar

### 2. Standardize the worklist row primitive

Target files:

- `client/src/components/care/CareDesignPrimitives.tsx`
- `client/src/components/care/WorkloadPage.tsx`
- `client/src/components/care/MatchingQueuePage.tsx`
- `client/src/components/care/PlacementTrackingPage.tsx`
- `client/src/components/care/ActiesPage.tsx`
- `client/src/components/care/AanbiederBeoordelingPage.tsx`
- `client/src/components/care/GemeentenPage.tsx`
- `client/src/components/care/ZorgaanbiedersPage.tsx`

Work:

- one row grammar for identity, state, owner, next action, urgency, and age
- remove duplicate metadata chips
- keep only one dominant action per row

Why second:

- the current row models are the most visible source of visual drift

Acceptance:

- every operational row reads in the same order
- no row feels like a table header disguised as a queue

### 3. Standardize attention surfaces

Target files:

- `client/src/components/care/CareDesignPrimitives.tsx`
- `client/src/components/care/SystemAwarenessPage.tsx`
- `client/src/components/care/PlacementTrackingPage.tsx`
- `client/src/components/care/AanbiederBeoordelingPage.tsx`

Work:

- define Neutral, Attention, and Critical variants
- enforce allowed and forbidden content
- reduce repeated prose in banners and hints

Why third:

- attention currently appears too often and with inconsistent density

Acceptance:

- attention surfaces remain rare
- each variant carries the same content rules everywhere

---

## P1. Highest-risk live pages

### 4. Rebuild `WorkloadPage`

Target file:

- `client/src/components/care/WorkloadPage.tsx`

Work:

- compress filters and tabs
- move ownership into the primary row reading order
- remove repeated helper copy
- make the dominant action visibly primary

Why here:

- this is the main aanvraag worklist and sets the baseline for the rest of the shell

Acceptance:

- the page reads as an operational queue, not a dashboard
- the first glance answers what needs attention, who owns it, and what happens next

### 5. Compress `CaseExecutionPage`

Target files:

- `client/src/components/care/CaseExecutionPage.tsx`
- `client/src/components/care/CaseExecutionWorkspaceSections.tsx`

Work:

- harden the order: hero, workflow, attention, ownership, decision, context
- collapse non-essential context by default
- remove duplicate state explanations from the same visual band

Why here:

- this is the mission-control screen and must become the reference for detail pages

Acceptance:

- no competing action cluster in the upper half
- the page feels operational, not dossier-like

### 6. Simplify `MatchingQueuePage`

Target file:

- `client/src/components/care/MatchingQueuePage.tsx`

Work:

- remove onboarding-style explainer weight
- keep one dominant CTA
- make match readiness, confidence, and owner visible in the row model

Why here:

- matching is advisory and should remain queue-first, not tutorial-first

Acceptance:

- empty and populated states share the same calm operational grammar

---

## P2. Chain surfaces

### 7. Compress `AanbiederBeoordelingPage`

Target file:

- `client/src/components/care/AanbiederBeoordelingPage.tsx`

Work:

- reduce duplicated audit text
- separate provider decision mode from municipality monitoring mode more clearly
- keep the response status dominant in the row

Why here:

- this page carries role-adaptive complexity and can easily drift into visual overload

Acceptance:

- one clear decision surface for the provider
- one clear monitoring surface for the municipality

### 8. Simplify `PlacementTrackingPage`

Target file:

- `client/src/components/care/PlacementTrackingPage.tsx`

Work:

- reduce repeated sequence reminders
- compress the context hint under the worklist
- make ambiguous evidence a small badge, not a paragraph

Why here:

- this surface should stay compact because it sits between acceptance and intake

Acceptance:

- placement status is readable without scanning paragraphs

### 9. Simplify `ActiesPage`

Target file:

- `client/src/components/care/ActiesPage.tsx`

Work:

- remove enterprise table feel
- reduce controls that do not change the next action
- connect each task more explicitly to a linked case state

Why here:

- this page is currently the most generic and most likely to regress into a classic task manager

Acceptance:

- the page reads as a care action queue, not a generic to-do list

### 10. Reframe `ZorgaanbiedersPage`

Target file:

- `client/src/components/care/ZorgaanbiedersPage.tsx`

Work:

- reduce discovery-tool behavior
- keep the dominant action tied to the active case context
- compress comparison metadata

Why here:

- provider browsing must remain advisory and operational, not marketplace-like

Acceptance:

- the page feels like a selection surface for a live case, not a directory

### 11. Reframe `GemeentenPage`

Target file:

- `client/src/components/care/GemeentenPage.tsx`

Work:

- collapse report-style columns
- replace table sprawl with a compact operational row model
- surface pressure and next action before analytics

Why here:

- this is the most table-like surface and the most in need of simplification

Acceptance:

- the page answers pressure, ownership, and next action without a spreadsheet feel

---

## P3. Lower-risk cleanup

### 12. Demote duplicate explanatory copy

Target files:

- all operational page components that repeat the same reason in banner, subtitle, and row

Work:

- remove copy that only solves hierarchy
- keep one source for the blocker explanation
- collapse repeated state labels

Acceptance:

- every screen gets shorter before it gets more complex

### 13. Normalize directory and network detail rails

Target files:

- `client/src/components/care/ZorgaanbiedersPage.tsx`
- `client/src/components/care/GemeentenPage.tsx`
- `client/src/components/care/PlacementTrackingPage.tsx`

Work:

- keep optional detail subordinate
- show detail only when it changes the decision

Acceptance:

- detail rail never competes with the work surface

### 14. Re-run route and import guardrails

Target files:

- `client/src/test/*`
- `client/src/components/care/*`

Work:

- verify that `NextBestAction` and `ProcessTimeline` remain case-detail only
- verify that metric-strip style surface stays out of non-coordination pages

Acceptance:

- the page grammar is enforced by tests, not memory

---

## Execution order

1. Shared page scaffold
2. Worklist row primitive
3. Attention surfaces
4. WorkloadPage
5. CaseExecutionPage
6. MatchingQueuePage
7. AanbiederBeoordelingPage
8. PlacementTrackingPage
9. ActiesPage
10. ZorgaanbiedersPage
11. GemeentenPage
12. Copy cleanup
13. Detail rail cleanup
14. Guardrails

---

## Definition of done

The backlog is complete when:

- every operational page can answer attention, owner, and next action in under 3 seconds
- list pages read as queues, not dashboards
- detail pages read as mission control, not dossiers
- attention surfaces remain rare
- the shared grammar is reused, not reauthored
