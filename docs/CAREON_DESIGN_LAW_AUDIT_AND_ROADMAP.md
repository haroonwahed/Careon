# CareOn design law audit and implementation roadmap

Date of audit: 2026-06-05

This document audits the current CareOn SPA against the CareOn Design Laws and turns the result into a concrete implementation roadmap.

Scope used for the audit:

- `SystemAwarenessPage` for Coordinatie
- `WorkloadPage` for Aanvragen
- `MatchingPageWrapper` and `MatchingQueuePage` for Matching
- `AanbiederBeoordelingPage` for Reacties
- `PlacementPageWrapper` and `PlacementTrackingPage` for Plaatsingen
- `ActiesPage` for Acties
- `CaseExecutionPage` for Casus Detail
- `ZorgaanbiedersPage` for Zorgaanbieders
- `GemeentenPage` for Gemeenten

This audit uses the current live shell and the current implementation patterns in `client/src/components/care/` and `client/src/components/examples/MultiTenantDemo.tsx`.

---

## Executive summary

CareOn is already moving in the right direction:

- the shell is stable
- the shared page scaffold exists
- worklist rows are more disciplined than a generic enterprise table
- the canonical workflow is visible in multiple places

The remaining problem is consistency, not invention.

The current application still leaks these patterns:

- page-specific hero treatments that compete with the worklist
- duplicate metadata chips and repeated status labels
- multiple action clusters on the same surface
- network and directory pages that still feel like exploration tools instead of operational surfaces
- case detail that is strong structurally, but still carries too much explanatory and contextual material in the same visual band

The main implementation priority is to converge everything onto one page grammar:

1. Attention Layer
2. Workflow Layer
3. Work Surface
4. Detail Surface

Anything that does not support those four layers should be demoted, collapsed, or removed.

---

## Phase 1. Platform audit

### 1) Coordinatie

Live surface:

- `SystemAwarenessPage` at `/dashboard` and `/coordination`

Current purpose:

- platform-wide operational control center for blocked cases, urgent queues, and workflow pressure

Actual purpose perceived by a first-time user:

- a command center with a worklist, a phase board, a right rail, and a dominant next action

Violations of CareOn Design Laws:

- the page still carries too many simultaneous control elements
- the right rail and the main worklist both compete for attention
- the phase board, metrics, and quick actions can read as three separate products on one page

Unnecessary elements:

- repeated explanatory copy under the dominant action when the state is already obvious
- secondary guidance blocks when the worklist already explains the blocker

Missing elements:

- stronger suppression of non-critical metadata in the worklist rows
- stricter separation between operational signals and general navigation

Information hierarchy issues:

- the page answers the "what needs attention" question well, but not always in one glance
- the worklist and phase board both try to explain the same thing

Action hierarchy issues:

- too many secondary entry points in the right rail and quick actions cluster
- the dominant CTA is clear, but supporting actions are still too visible

Ownership visibility issues:

- ownership is present, but it is often spread across chips instead of being framed as the primary fact

Scores:

- Scanability: 7/10
- Action Clarity: 8/10
- Noise Level: 6/10
- Ownership Clarity: 7/10
- Workflow Clarity: 8/10
- Overall UX: 7/10

### 2) Aanvragen

Live surface:

- `WorkloadPage` at `/casussen`

Current purpose:

- the primary worklist for open cases and workflow progression

Actual purpose perceived by a first-time user:

- an operational queue for the next case to move forward

Violations of CareOn Design Laws:

- the page still behaves partly like a dashboard because the summary band, attention band, filters, tabs, and worklist all have strong visual weight
- some row metadata is still duplicated across multiple chips

Unnecessary elements:

- helper text that repeats what the row already says
- repeated filter labels that do not change the next action

Missing elements:

- more explicit ownership in the row's primary reading order
- stricter removal of internal or technical phase detail from the row surface

Information hierarchy issues:

- the attention banner is good, but it sits close enough to the header to compete with the main list
- the filters are better than a table toolbar, but still read as a separate UI layer instead of a light control strip

Action hierarchy issues:

- the row action is good, but some surrounding buttons make the page feel more navigational than operational

Ownership visibility issues:

- ownership is available, but not always the first thing the eye lands on after the case reference

Scores:

- Scanability: 8/10
- Action Clarity: 8/10
- Noise Level: 7/10
- Ownership Clarity: 7/10
- Workflow Clarity: 8/10
- Overall UX: 8/10

### 3) Matching

Live surface:

- `MatchingPageWrapper` and `MatchingQueuePage` at `/matching`

Current purpose:

- advisory matching queue for cases ready to be matched

Actual purpose perceived by a first-time user:

- a staging area for recommended matches, with filters and a short process explainer

Violations of CareOn Design Laws:

- the empty state currently carries too much instructional structure
- the workflow explainer below the hero makes the page feel like onboarding when it should feel like an operational queue

Unnecessary elements:

- multi-step process copy on the empty state when the page already has a canonical workflow path elsewhere
- duplicated "open aanvragen" and "naar casussen" actions when one dominant action is enough

Missing elements:

- stronger representation of match confidence and trade-off summary in the row model
- clearer tie between recommended match and the reason it is recommended

Information hierarchy issues:

- the empty state competes with the page header rather than sitting underneath it as a calm instruction band

Action hierarchy issues:

- the page has two similarly visible navigation CTAs
- the page needs one dominant action: open the queue or move to cases

Ownership visibility issues:

- ownership is not always present in the first screenful when the queue is empty

Scores:

- Scanability: 7/10
- Action Clarity: 7/10
- Noise Level: 6/10
- Ownership Clarity: 6/10
- Workflow Clarity: 8/10
- Overall UX: 7/10

### 4) Reacties

Live surface:

- `AanbiederBeoordelingPage` at `/beoordelingen`

Current purpose:

- provider response queue and municipality monitoring view for invited providers

Actual purpose perceived by a first-time user:

- a response workspace with a strong attention band and a case-by-case review flow

Violations of CareOn Design Laws:

- the page is role-adaptive, but the role switch is still too visually present in the same surface
- the municipality view and provider view share too much scaffolding, which makes the page feel broader than one operational purpose
- the tabs inside the page can read like secondary navigation rather than phase-specific detail

Unnecessary elements:

- repeated audit copy in the feedback areas when the evidence line already carries the reason
- "intro" style content when the queue has cases to process

Missing elements:

- a more compact and persistent response status summary in the queue row
- stronger visual distinction between "you need to decide" and "you are monitoring"

Information hierarchy issues:

- the page combines queue, detail, evidence, and role guidance on the same visual priority level

Action hierarchy issues:

- the decision panel is clear for the provider, but the municipality monitoring actions still occupy too much surface area

Ownership visibility issues:

- ownership is the key feature of this page, but it is still diluted across reaction status, SLA text, evidence text, and tabs

Scores:

- Scanability: 7/10
- Action Clarity: 8/10
- Noise Level: 6/10
- Ownership Clarity: 7/10
- Workflow Clarity: 8/10
- Overall UX: 7/10

### 5) Plaatsingen

Live surface:

- `PlacementPageWrapper` and `PlacementTrackingPage` at `/plaatsingen`

Current purpose:

- track the handoff from acceptance to placement confirmation and intake

Actual purpose perceived by a first-time user:

- a controlled follow-up queue for placement confirmation and intake timing

Violations of CareOn Design Laws:

- the page still includes explanatory prose that could be reduced once the row model is stronger
- the attention band and contextual hint partially repeat the same message

Unnecessary elements:

- repeated reminder text about the sequence between acceptance, placement, and intake

Missing elements:

- stronger row-level separation between ambiguous placement evidence and confirmed placement
- more visible owner label for each row

Information hierarchy issues:

- the page is close to the target pattern, but the hint below the worklist still competes with the operational queue

Action hierarchy issues:

- the matching CTA is appropriately secondary, but the page still uses a help-style context hint where a denser operational footer would be better

Ownership visibility issues:

- the owner is implied through the flow, but not always explicit in the row reading order

Scores:

- Scanability: 8/10
- Action Clarity: 8/10
- Noise Level: 7/10
- Ownership Clarity: 7/10
- Workflow Clarity: 8/10
- Overall UX: 8/10

### 6) Acties

Live surface:

- `ActiesPage` at `/acties`

Current purpose:

- task queue for pending operational actions across cases

Actual purpose perceived by a first-time user:

- a general task execution list with priorities and due dates

Violations of CareOn Design Laws:

- this page is still the most generic enterprise-style surface in the current shell
- the filters and stats make it feel closer to a classic task manager than a care coordination queue

Unnecessary elements:

- multiple sort and filter controls that do not change the decision path
- priority chips repeated on every row when the row itself already carries urgency through ordering and status

Missing elements:

- a more explicit link from each task to the owning case state
- stronger next-action wording instead of generic task completion wording

Information hierarchy issues:

- the header metrics are useful, but they draw the eye before the actual action queue

Action hierarchy issues:

- the page does not yet have a single obvious dominant action per row

Ownership visibility issues:

- ownership exists as assignment metadata, but it should be the first operational signal in the row after the title

Scores:

- Scanability: 6/10
- Action Clarity: 6/10
- Noise Level: 5/10
- Ownership Clarity: 6/10
- Workflow Clarity: 5/10
- Overall UX: 6/10

### 7) Casus Detail

Live surface:

- `CaseExecutionPage` at `/care/cases/:id`

Current purpose:

- mission control for one case, including workflow state, attention points, evidence, timeline, and actions

Actual purpose perceived by a first-time user:

- an operational detail workspace that is much closer to the target than the list pages

Violations of CareOn Design Laws:

- the page is strong, but it still risks over-explaining context in the same band as the decision surface
- the context and history sections can compete with the primary action cluster if they are not collapsed aggressively

Unnecessary elements:

- duplicate context that already exists in the header, attention band, or timeline
- repeated explanatory lines that restate the same blocker

Missing elements:

- a sharper separation between the hero facts and the decision surface
- a stronger rule for when context is collapsed versus expanded

Information hierarchy issues:

- the page is structurally correct, but the density still needs more compression in the upper half

Action hierarchy issues:

- the primary decision is visible, but some secondary actions still feel equally important in the current layout

Ownership visibility issues:

- ownership is present, but it should be even closer to the hero and the current state

Scores:

- Scanability: 8/10
- Action Clarity: 8/10
- Noise Level: 7/10
- Ownership Clarity: 8/10
- Workflow Clarity: 9/10
- Overall UX: 8/10

### 8) Zorgaanbieders

Live surface:

- `ZorgaanbiedersPage` at `/zorgaanbieders`

Current purpose:

- provider network overview and capacity/match browsing

Actual purpose perceived by a first-time user:

- a provider directory with filters, sorting, and a map

Violations of CareOn Design Laws:

- the map-and-list combination still feels like a discovery tool rather than a strict operational surface
- the best-match mode is strong, but the page can still feel like a search product if filters dominate

Unnecessary elements:

- capacity and wait metadata repeated in too many places
- optional filters that are not always necessary for the current case

Missing elements:

- stronger signal that the page is advisory and not assignational
- a cleaner row or card primitive for provider comparison

Information hierarchy issues:

- the map can dominate the list if it is too visually strong

Action hierarchy issues:

- "select best match" should remain the dominant action when a case context is present

Ownership visibility issues:

- ownership is mostly indirect here, so it needs to be expressed as "who can respond" and "who owns capacity" rather than as a generic status label

Scores:

- Scanability: 7/10
- Action Clarity: 7/10
- Noise Level: 6/10
- Ownership Clarity: 6/10
- Workflow Clarity: 7/10
- Overall UX: 7/10

### 9) Gemeenten

Live surface:

- `GemeentenPage` at `/gemeenten`

Current purpose:

- municipal overview of capacity, urgency, and blocked cases

Actual purpose perceived by a first-time user:

- a municipal network table that helps identify pressure points

Violations of CareOn Design Laws:

- the page is still the most table-like surface in the live shell
- too many columns are visible at once for a screen that should mostly answer "what needs attention?"

Unnecessary elements:

- repeated columns for status, wait, owner, and next step when most of those should be compacted into a single operational summary

Missing elements:

- a more obvious top-line attention state per municipality
- stronger row compression and less column sprawl

Information hierarchy issues:

- the table reads left-to-right like an analytic report instead of an operational queue

Action hierarchy issues:

- the action is on the row, but the page is not built around one dominant action per municipality

Ownership visibility issues:

- ownership is visible only after the reader has already parsed too many columns

Scores:

- Scanability: 5/10
- Action Clarity: 5/10
- Noise Level: 4/10
- Ownership Clarity: 5/10
- Workflow Clarity: 5/10
- Overall UX: 5/10

---

## Phase 2. Unified information architecture

### Required layers

1. Attention Layer
   - the smallest possible surface that explains why the page matters now
   - shows blocker, urgency, or status shift
2. Workflow Layer
   - shows the canonical phase or queue position
   - must make the next stage readable without scrolling
3. Work Surface
   - the actionable list, decision panel, or case queue
   - this is where the user spends time
4. Detail Surface
   - supporting facts, history, evidence, and context
   - must never compete with the work surface

### Exact rules

- Every operational page must have at least layers 1 and 3.
- Every detail page must have all four layers.
- A page may omit the Detail Surface only if the work surface already carries the required facts and the page is not a detail page.
- The Attention Layer is rare. If it is always present, it stops being attention.
- The Workflow Layer must be visible before the user scrolls on all primary operational pages.
- The Work Surface must own the visual center of the page.
- The Detail Surface must be collapsible or visually subordinate unless the page is explicitly a detail page.
- No page may present two equally strong action clusters.
- No page may use a second card stack to "explain" a hierarchy problem.

### Layer requirement by page

| Page | Attention | Workflow | Work Surface | Detail Surface |
| --- | --- | --- | --- | --- |
| Coordinatie | Required | Required | Required | Optional, right rail only |
| Aanvragen | Required | Required | Required | Optional, collapsed |
| Matching | Required | Required | Required | Optional, minimal |
| Reacties | Required | Required | Required | Required, but subordinate |
| Plaatsingen | Required | Required | Required | Optional |
| Acties | Required | Optional | Required | Optional |
| Casus Detail | Required | Required | Required | Required |
| Zorgaanbieders | Required | Optional | Required | Optional, only for selected provider |
| Gemeenten | Required | Optional | Required | Optional, only for selected row |

### Architecture rule set

- List pages should use one hero band, one attention band, one worklist surface, and one detail rail at most.
- Detail pages should use a hero, a workflow strip, a dominant action band, then context and evidence sections.
- Network pages should default to list-first and reveal detail only on selection.
- Any page that starts to resemble a dashboard must be re-authored as a queue or a detail workspace.

---

## Phase 3. Worklist redesign

### Standard worklist model

Every CareOn worklist should use the same row grammar:

- left: case/provider/municipality identity
- center-left: current state
- center-right: owner and next action
- right: age or waiting time
- far right: one dominant action

The scan order must be:

1. Identity
2. State
3. Owner
4. Next action
5. Urgency
6. Age

### WorkloadPage

Required columns:

- case reference
- current state
- owner
- next action
- urgency
- age in state

Optional columns:

- region
- provider
- short reason
- placement pressure

Removed columns:

- internal phase name
- duplicate urgency badges
- duplicate owner badges
- verbose helper text

Grouping logic:

- by current queue status first
- then by urgency band
- then by waiting age

Sorting logic:

- critical first
- oldest in state second
- then stable sort by case reference

Row layout:

- one compact row
- one dominant action
- one support chip for state
- one metadata cluster for region/provider only when relevant

### MatchingQueuePage

Required columns:

- case reference
- match readiness
- owner
- next step
- urgency
- wait age

Optional columns:

- region
- care type
- fit summary
- confidence

Removed columns:

- onboarding-style step explainer in the main body
- duplicate "open cases" and "to cases" CTAs

Grouping logic:

- ready for matching
- urgent
- blocked

Sorting logic:

- readiness bucket
- then urgency
- then wait age

Row layout:

- compact queue row
- one "open" action
- fit/confidence only when it changes the choice

### AanbiederBeoordelingPage

Required columns:

- case reference
- invited provider
- response status
- deadline or SLA
- owner
- next action

Optional columns:

- rejection reason
- info request type
- note preview

Removed columns:

- duplicate audit copy
- duplicate tabs that just restate the same phase
- full sentence status copy repeated in every row

Grouping logic:

- active queue first
- processed items second
- monitoring items last

Sorting logic:

- open items first
- oldest response age first

Row layout:

- current response status should be the dominant chip
- one action per row: remind, open, or inspect

### PlacementTrackingPage

Required columns:

- case reference
- placement status
- provider
- next action
- age in placement state

Optional columns:

- intake date
- ambiguity flag
- masking of person identity

Removed columns:

- repeated sequence explanation
- duplicate placement terminology

Grouping logic:

- te bevestigen
- lopend
- afgerond

Sorting logic:

- unconfirmed first
- then stalled
- then completed

Row layout:

- compact status row
- ambiguous evidence should appear as a small badge, not a paragraph

### ActiesPage

Required columns:

- task title
- linked case
- owner
- due state
- urgency
- next action

Optional columns:

- region
- provider
- short reason

Removed columns:

- enterprise-style task table chrome
- duplicate sort/filter controls

Grouping logic:

- mine
- waiting
- all

Sorting logic:

- urgency
- due date
- case reference

Row layout:

- title first
- due state second
- owner third
- one action only

### ZorgaanbiedersPage

Required columns:

- provider name
- region
- capacity state
- wait time
- matchability
- next action

Optional columns:

- specialisation
- open slots
- distance or proximity

Removed columns:

- any column that is only there for analytics
- any filter that does not influence the current case selection

Grouping logic:

- best match
- shortest wait
- most capacity
- nearby

Sorting logic:

- dependent on selected case context first
- then operational fit

Row layout:

- one provider row/card per provider
- the dominant action should be "select" or "inspect", never "browse more"

### GemeentenPage

Required columns:

- municipality name
- pressure state
- blocked count
- urgent count
- owner or governance status
- next action

Optional columns:

- region
- average wait
- population

Removed columns:

- report-like column proliferation
- columns that repeat the same pressure signal in different words

Grouping logic:

- by pressure state
- then by urgency

Sorting logic:

- blocked first
- urgent second
- then average wait

Row layout:

- compact operational row, not a wide report table

---

## Phase 4. Casus detail redesign

The Casus Detail page must feel like mission control.

### 1) Hero

Belongs here:

- case reference
- current state
- current owner
- urgency
- one-line blocker or next action

Must not belong here:

- long context paragraphs
- history dump
- duplicate metadata chips

### 2) Workflow Progress

Belongs here:

- the canonical flow
- current step
- completed steps
- blocked step

Must not belong here:

- detailed copy for every step
- secondary navigation buttons

### 3) Attention Surface

Belongs here:

- current blocker
- missing data
- delay
- risk
- one dominant action

Must not belong here:

- explanation essays
- multiple actions
- dashboard KPIs

### 4) Ownership Surface

Belongs here:

- who owns the next move
- why that actor owns it
- whether the user can act now

Must not belong here:

- historic role descriptions
- general organization metadata

### 5) Decision Surface

Belongs here:

- the next decision
- the current options
- validation state
- evidence needed

Must not belong here:

- unrelated case background
- duplicated timeline content

### 6) Context Surface

Belongs here:

- only the context that changes the decision
- only the evidence that explains the current branch
- timeline and audit links

Must not belong here:

- everything else

### Case detail rule

If a block does not help decide the next move, it should be collapsed by default.

---

## Phase 5. Attention surface system

### Neutral

When it appears:

- the case is moving normally
- there is no blocker that changes the next action

Allowed content:

- current state
- owner
- next action
- one compact CTA

Forbidden content:

- paragraph copy
- multi-action clusters
- charts or KPI blocks

When it disappears:

- when a page has no active decision pressure and the work surface is already self-explanatory

### Attention

When it appears:

- something requires focus, but the case is not blocked
- a delay, weak match, or pending review needs visibility

Allowed content:

- short issue summary
- owner
- one dominant action
- one supporting fact

Forbidden content:

- multiple equal CTAs
- nested cards
- duplicate summary text

When it disappears:

- as soon as the user has acknowledged the issue or the next step is obvious

### Critical

When it appears:

- the workflow is blocked
- a deadline is exceeded
- intake or placement is stalled

Allowed content:

- strongest state signal
- owner
- one primary CTA
- one concise reason

Forbidden content:

- general guidance
- long helper text
- dashboard decoration

When it disappears:

- when the blocking condition is cleared or the case moves to the next workflow step

### Rarity rule

Attention surfaces must stay rare.

If too many pages need them, the underlying row model is too weak.

---

## Phase 6. Visual simplification

These are the highest-value removals or collapses that do not reduce clarity:

### Across the shell

- remove duplicate summary chips that repeat the same state already visible in the hero
- collapse repeated helper sentences under attention bands when the row already contains the same reason
- reduce secondary navigation buttons that only move to the same next surface

### Coordinatie

- remove overlapping explanation between phase board and worklist
- collapse right-rail text that restates the worklist headline
- remove non-critical quick links when the dominant action is already obvious

### Aanvragen

- remove any repeated urgency or wait copy that appears in both the row and the banner
- compress filter controls so they do not become the visual focus
- remove duplicate phase labels that are already implied by the current queue group

### Matching

- remove the process explainer from the main empty state after the user has seen the page once
- remove one of the two top CTAs if both lead to the same operational path
- collapse the instructional step strip when real rows are present

### Reacties

- remove repeated audit prose from the response evidence surface
- remove municipality-only guidance from the provider decision surface
- collapse the tab set if it only restates the same workflow phase

### Plaatsingen

- remove duplicate sequence reminders between acceptance and intake
- compress the context hint below the worklist
- remove repeated status explanation from row-level badges

### Acties

- remove generic task-manager styling where the case-based workflow can be shown directly
- remove filters that do not change the next action
- collapse duplicate priority signals into one urgency display

### Casus Detail

- remove duplicate identity chips across hero and context
- collapse context blocks that do not change the current decision
- remove extra action buttons from the same decision surface

### Zorgaanbieders

- remove provider metadata that does not change the selected case decision
- collapse map chrome if the list already answers the selection question
- remove repeated capacity labels where the row already shows capacity state

### Gemeenten

- remove report-style columns that are only analytic repeats of the same pressure signal
- collapse the table into an operational row model
- remove long narrative text from each municipality row

---

## Concrete implementation roadmap

### P0. Normalize the shared page grammar

Target files:

- `client/src/components/care/CarePageScaffold.tsx`
- `client/src/components/care/CareUnifiedPage.tsx`
- `client/src/components/care/CareDesignPrimitives.tsx`

Deliverables:

- one standard attention band API
- one standard workflow strip API
- one row primitive contract
- one compact detail surface contract

### P1. Rebuild the worklist rows

Target files:

- `client/src/components/care/WorkloadPage.tsx`
- `client/src/components/care/MatchingQueuePage.tsx`
- `client/src/components/care/PlacementTrackingPage.tsx`
- `client/src/components/care/ActiesPage.tsx`
- `client/src/components/care/AanbiederBeoordelingPage.tsx`
- `client/src/components/care/GemeentenPage.tsx`
- `client/src/components/care/ZorgaanbiedersPage.tsx`

Deliverables:

- consistent row grammar
- fewer metadata chips
- one dominant action per row
- explicit owner and next step

### P2. Compress the case detail page

Target files:

- `client/src/components/care/CaseExecutionPage.tsx`
- `client/src/components/care/CaseExecutionWorkspaceSections.tsx`

Deliverables:

- hero, workflow, attention, ownership, decision, context in a fixed order
- fewer competing action clusters
- stronger default collapse for non-essential context

### P3. Standardize attention surfaces

Target files:

- `client/src/components/care/CareDesignPrimitives.tsx`
- `client/src/components/care/SystemAwarenessPage.tsx`
- `client/src/components/care/PlacementTrackingPage.tsx`
- `client/src/components/care/AanbiederBeoordelingPage.tsx`

Deliverables:

- neutral, attention, critical variants
- strict content rules
- rare usage by design

### P4. Simplify network and directory pages

Target files:

- `client/src/components/care/ZorgaanbiedersPage.tsx`
- `client/src/components/care/GemeentenPage.tsx`

Deliverables:

- less table feel
- better advisory framing
- clearer selection path

### P5. Delete or demote duplicate explanatory copy

Target files:

- all operational page components that repeat the same state in banner, subtitle, and row

Deliverables:

- shorter page headers
- less inline explanation
- more visual trust through compression

### Priority order

1. `WorkloadPage`
2. `CaseExecutionPage`
3. `MatchingQueuePage`
4. `AanbiederBeoordelingPage`
5. `PlacementTrackingPage`
6. `ActiesPage`
7. `ZorgaanbiedersPage`
8. `GemeentenPage`
9. shared primitives

### Success criteria

- every operational page answers:
  - what needs attention
  - who owns it
  - what happens next
- no page feels like a CRM or report bundle
- the worklist is always the primary surface
- detail pages feel like mission control, not dossiers

---

## Final recommendation

CareOn does not need a visual reinvention.
It needs a strict reduction pass.

The next release should focus on:

- compressing worklists
- removing duplicate metadata
- tightening case detail
- standardizing attention surfaces
- demoting directory/table behavior wherever it appears

That will move the product from "a collection of screens" to "a unified operational control platform" without breaking the workflow doctrine.
