# AGENTS.md

## Project Identity

This repository implements **Zorg OS**, a Dutch care-allocation decision system for municipalities and care providers.

The product is workflow-first and case-centric. It should guide the right actor to the next correct action, not behave like a passive dashboard.

## Canonical Flow

Treat this sequence as the source of truth for code, UI, copy, database behavior, tests, and docs:

**Casus -> Samenvatting -> Matching -> Aanbieder Beoordeling -> Plaatsing -> Intake**

### Step Meaning

1. **Casus**
   - Municipality creates the case.
   - Capture the minimum valid intake data.
   - The case is the source of truth.

2. **Samenvatting**
   - The system creates a concise summary.
   - It clarifies context, urgency, and missing information.
   - It is not provider review or final decision-making.

3. **Matching**
   - The system proposes best-fit providers.
   - Matching must be explainable.
   - Municipality uses this to route the case for provider review.

4. **Aanbieder Beoordeling**
   - The provider validates fit, capacity, risks, and suitability.
   - The provider accepts or rejects with reason.
   - Substantive review authority belongs here.

5. **Plaatsing**
   - Placement happens only after provider acceptance.
   - It confirms assignment and handoff readiness.

6. **Intake**
   - Intake starts only after acceptance and placement.
   - It marks the start of the care trajectory.

## Non-Negotiable Rules

When modifying code, never violate these rules:

1. Do not restore the old flow where municipality performs substantive beoordeling before provider review.
2. Do not allow intake before provider acceptance and placement.
3. Do not allow placement for rejected or unreviewed provider requests.
4. Do not treat matching as final assignment.
5. Keep every major action traceable from the case.
6. Do not turn the product into a reporting dashboard without next-best action.
7. Use Dutch product terminology in user-facing UX where canonical Dutch terms exist.

## Terminology

Use these terms consistently in code, labels, docs, and tests when they are part of the product surface:

- Casus
- Samenvatting
- Matching
- Aanbieder Beoordeling
- Plaatsing
- Intake
- Intake-overdracht
- Zorgaanbieder
- Gemeente
- Regiekamer
- Signalen
- Volgende beste actie

Avoid or replace:

- "Assessment" when **Beoordeling** is intended in Dutch UX
- Municipality-led substantive beoordeling as a business step
- Ambiguous "overdracht" when **intake-overdracht** is meant
- Generic status-dashboard language that hides the next action

## Product And UX Principles

### Workflow-First

The UI should guide operational sequence, not expose disconnected records or generic CRUD screens.

### Every Page Answers One Question

Each page should make clear:

- where the case is now
- why it is here
- what blocks progress
- what the next action is
- who owns that action

### Action Over Decoration

Prefer:

- clear CTA banners
- progression states
- reason codes
- evidence panels
- blocking validation
- next-best-action patterns

Avoid:

- dead-end pages
- decorative widgets with no operational value
- status-only cards with no outcome
- vague labels like "open" or "pending" without context

### Calm Professional Tone

Visual tone should feel trustworthy, modern, calm, operational, and high signal.

## Architecture Guidance

Assume these conceptual layers:

- Case layer as the anchor entity
- Workflow/view layer for orchestration
- Intelligence layer for summary, missing info, risk signals, and next-best action
- Matching engine for provider recommendations and explainability
- Provider evaluation layer for accept/reject and feedback
- Outcome layer for placement, intake progress, and learning loops

## Matching Rules

When touching matching logic or UI:

- Keep recommendations explainable.
- Show why a provider is suggested.
- Preserve factor breakdowns where available.
- Preserve or improve confidence calibration.
- Capture provider rejection reasons structurally.
- Use real domain factors such as care type, urgency, region, capacity, specialization, complexity, and special needs.

Do not:

- rank providers with opaque labels only
- hide trade-offs
- claim certainty when the data is weak
- drop auditability for "smart" UX shortcuts

## Regiekamer Rules

The Regiekamer is an intervention layer.

It should emphasize:

- missing critical information
- absent summary
- no viable match
- weak match needing verification
- provider rejection
- pending provider review beyond SLA
- capacity risk
- delayed placement or intake follow-up

It should not become:

- a generic analytics homepage
- a dumping ground for every metric
- a page with alerts that have no actionable owner

Every signal should answer:

- what is wrong
- why it matters
- who should act
- what action is expected now

## Data And Model Expectations

Expected domain objects include concepts like:

- Case
- Case summary / intelligence output
- Matching result / recommendation
- Provider evaluation
- Placement
- Intake / intake-overdracht state
- Timeline events / audit log

When evolving schema:

- prefer additive, auditable changes
- avoid breaking historical traceability
- keep reason codes structured where possible
- favor explicit workflow states over vague booleans

## Guardrails For Code Changes

Before changing code, inspect existing patterns and preserve what is canonical.

### You Must Not

- rename domain concepts casually
- move business authority to the wrong actor
- collapse distinct workflow phases into one
- break route names, templates, or labels that are already canonical without a strong reason
- introduce mock data into production paths unless explicitly requested
- replace Dutch domain copy with generic English copy in user-facing areas

### You Should

- make minimal, coherent changes
- preserve backward-compatible behavior where reasonable
- keep copy, statuses, routes, and templates aligned
- update tests and docs when behavior changes
- prefer fixing root causes over patch stacking

## Working Style

### Before Coding

1. Read the relevant files end to end.
2. Trace the workflow impact across UI, backend, templates, tests, and docs.
3. Identify whether the change affects business flow, terminology, state transitions, permissions, matching logic, or reporting/regiekamer logic.
4. Then implement.

### While Coding

- Make changes that are narrow but complete.
- Update all affected layers, not just one file.
- Keep names consistent across models, views, templates, and tests.
- Prefer explicitness over magic.

### Default Execution Protocol

When a task is framed as "carry it out" or a follow-on cleanup/hardening pass, work in this order:

1. Inspect the live user-facing path first and treat it as the primary scope.
2. Fix the root cause in shared helpers or source-of-truth layers before patching individual screens.
3. Sweep adjacent legacy or example surfaces only if they still leak into the active product, terminology, or user flow.
4. Keep the change set cohesive and avoid unrelated refactors unless they unblock the requested work.
5. Verify with the smallest meaningful test set plus a build/smoke check for touched client surfaces.
6. Report any remaining legacy-only leftovers separately instead of mixing them into the active path.

### Terminology Sweep Rule

If a change updates the canonical workflow or product terminology, propagate the new wording through:

- shared route or workflow helpers
- live pages in the active app path
- validation and signal components
- legacy surfaces only when they are rendered or linked from the active app

Do not spend time rewriting docs/examples/tests that are not part of the user-facing flow unless the task explicitly asks for it.

### After Coding

Run the most relevant checks available, such as:

- targeted tests for the changed area
- linting or formatting if configured
- framework validation commands
- manual smoke checks for touched routes or templates

At minimum, verify:

- no broken workflow transitions
- no template errors
- no dead links or buttons
- no login loops or 500s on touched routes

## Documentation Rules

If you change the core flow, update affected:

- blueprint docs
- executive summary docs
- design strategy docs
- system bible docs
- inline comments that describe workflow
- user-facing labels and helper text

Documentation must reflect the canonical flow, not historical leftovers.

## Testing Expectations

For workflow-sensitive changes, cover at least:

- case creation
- summary availability and missing information handling
- matching generation and explanation
- provider acceptance and rejection
- placement gating
- intake gating
- regiekamer signal behavior when relevant

Prefer tests that validate business rules, not just rendering.

## Copy And UI Writing Rules

Write user-facing copy that is concise, operational, calm, specific, and Dutch-first where the product is Dutch-facing.

Good copy tells the user what happened and what to do next.
Bad copy is vague, generic, or purely technical.

## Conflict Resolution

If implementation evidence conflicts with older docs or leftover code, prefer the canonical flow above and align the codebase toward it.

This file takes precedence over stale handover notes and outdated comments. Legal, security, and platform constraints still override this file.

## Definition Of Done

A task is done only when:

- the requested change works
- the canonical workflow is intact
- terminology is consistent
- touched tests pass or are updated appropriately
- affected docs or labels are aligned
- no obvious regressions remain in the touched flow
