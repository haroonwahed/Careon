# Product Completeness Roadmap

This roadmap covers the remaining work after the live app path, canonical workflow, and primary terminology cleanup are already in place.

Current product completeness baseline: **88-92%**

## Todo List

- [x] Close route friction on the canonical entry points.
- [x] Finish the last visible workflow vocabulary gaps in live templates.
- [x] Mark clearly historical docs and examples so they do not read like current guidance.
- [ ] Keep browser smoke checks and workflow gating tests green.
- [ ] Decide whether the stable `assessment` contract stays internal or gets a formal migration.

## Task Checklist

### Sprint A: Route Friction
- [x] Point `/care/` at the SPA landing instead of the retired case list.
- [x] Keep the public landing, login, logout, and SPA dashboard entry aligned.
- [x] Preserve only the minimal compatibility seams needed by old links and tests.

### Sprint B: Workflow Vocabulary
- [x] Normalize the visible live-template language to `Aanbieder Beoordeling`.
- [x] Remove the last visible “beoordeling” wording from the public landing and intake surfaces where it implied the old flow.
- [ ] Finish any remaining live-template copy edges if they appear in manual smoke testing.

### Sprint C: Legacy Isolation
- [x] Mark the large transformation overviews as historical references.
- [ ] Mark any remaining archive/example docs that still read like active guidance.
- [ ] Keep historical material out of the active product path.

### Sprint D: Confidence and Hardening
- [x] Expand route smoke coverage for landing -> login -> dashboard -> logout.
- [ ] Expand browser smoke coverage for landing -> login -> dashboard -> logout.
- [ ] Keep workflow gating tests green as the codebase changes.
- [ ] Keep the client build green.

### Sprint E: Contract Decision
- [ ] Decide whether `assessment` remains an internal stable contract or gets a formal migration.
- [ ] If migrating, draft the rename plan before touching schema or API routes.

## What remains

The remaining work falls into four buckets:

1. Compatibility seams that still exist for historical reasons.
2. A few workflow and route edges that still point at older defaults.
3. Legacy documentation and examples that are no longer part of the live product.
4. Confidence work: smoke tests, release checks, and small UX hardening items.

## Execution Sequence

Use this order for the remaining work. The goal is to finish the product without introducing schema churn unless we deliberately choose a migration.

### Step 1: Close Route Friction

Goal:
- make the canonical entry points consistent
- reduce legacy redirects that still point to old defaults

Current work items:
- route `/care/` to the SPA landing instead of the retired case list
- keep `/dashboard/` as a compatibility seam only where tests or redirects still require it
- keep the public landing, login, and logout contract aligned
- confirm the canonical SPA dashboard entry remains `/static/spa/?view=dashboard`

Status:
- complete for the live path
- keep only the minimal compatibility seams needed to avoid breaking existing links

Why first:
- route inconsistency is the fastest way for the product to still feel unfinished

### Step 2: Finish Workflow Vocabulary

Goal:
- keep visible language aligned with the canonical flow
- remove old product terms from remaining user-facing surfaces

Current work items:
- sweep any remaining visible labels in templates, helper text, and empty states
- keep internal identifiers unchanged unless they are user-facing
- keep the canonical Dutch flow visible in the live product

Status:
- live UX mostly complete
- remaining work is the last visible edge labels and any copy that still reads like legacy scaffolding
- current visible pass is effectively done; only manual smoke-test leftovers remain

### Step 3: Isolate Legacy Material

Goal:
- keep archived docs and examples clearly historical
- avoid mixing old exploration artifacts with live product guidance

Current work items:
- mark archive/example docs as historical where they are still useful
- reduce confusion in old design notes and screenshots
- keep active docs focused on the current route and workflow contract

Status:
- in progress
- the live product should stay clean even if archive material remains historical
- historical docs marked so far should stay read-only reference material

### Step 4: Confidence and Hardening

Goal:
- make the system feel complete under real use

Current work items:
- add or maintain browser smoke tests for landing, login, dashboard, logout
- keep workflow gating tests passing
- keep build and release checks green
- address any small performance or bundle-size issues if they become user-visible

Status:
- ongoing
- this is the final proof layer after the app is behaviorally correct

### Step 5: Contract Decision

Goal:
- choose the future of the `assessment` technical contract

Current work items:
- decide whether to keep `assessment` as stable internal language
- if not, define the migration scope before any code change

Status:
- not started
- this is a product/platform decision, not a copy pass

## Recommended next slice

If we keep working immediately, the highest-value next slice is:

1. Finish the visible workflow vocabulary sweep on any remaining live templates or helper text.
2. Mark archive material clearly as historical where it still matters.
3. Expand the browser smoke checks to cover the public landing -> login -> dashboard -> logout round trip.

That order preserves product clarity first, then repository clarity, then proof.

## Completion rule

This phase is done when:
- the public entry, login, dashboard, and logout flows all route to the intended surfaces
- the live workflow follows the canonical product language
- the remaining references are either internal contract names or explicitly historical
- the targeted tests and client build pass

## Pilot Backlog

This is the concrete follow-on backlog after the canonical workflow and the first live walkthrough are already working. The ordering is intentional: pilot value first, then UX clarity, then longer-term platform work.

## Implementation Checklist

### Task 1: Protect the pilot workflow

Owner:
- Backend shell and tenancy

Files:
- `contracts/middleware.py`
- `contracts/tenancy.py`
- `contracts/views.py`
- `contracts/api/views.py`
- `tests/test_spa_shell_middleware.py`
- `tests/test_organization_middleware.py`
- `tests/test_public_auth_flow.py`

Exact first task:
- Verify that authenticated requests to `/dashboard/`, `/care/casussen/`, `/care/matching/`, `/care/beoordelingen/`, `/care/plaatsingen/`, and `/care/signalen/` return a usable 200 response on the live Render service after login.

Acceptance:
- No authenticated shell route 500s.
- The canonical walkthrough stays on the product surface instead of falling back to an error page.
- Archived cases remain hidden from active views.

Verification:
- Verified on 2026-04-26 against the live Render service after login:
  - `/dashboard/`
  - `/care/casussen/`
  - `/care/matching/`
  - `/care/beoordelingen/`
  - `/care/plaatsingen/`
  - `/care/signalen/`
  - All returned 200 responses.

### Task 2: Tighten live filters and provider profile surfaces

Owner:
- Workflow and matching backend

Files:
- `contracts/views.py`
- `contracts/forms.py`
- `contracts/models.py`
- `contracts/provider_matching_service.py`
- `client/src/components/care/*.tsx`
- `theme/templates/contracts/*.html`

Acceptance:
- Any explicit filters we expose are backed by real data fields.
- Provider profile edits remain consistent with matching inputs.
- Contra-indications are shown in a usable, operational way.

Verification:
- Completed against the live provider workspace and matching surfaces:
  - `client_list` now filters on real provider fields for `care_form` and `age_band`
  - `matching_dashboard` now exposes live provider filters for care form, age band, region-fit, and capacity
  - provider profile surfaces now show matching inputs and clear edit actions
  - targeted regression suites passed

### Task 3: Defer AI and uitstroom work

Owner:
- Product architecture

Files:
- `contracts/models.py`
- `contracts/views.py`
- `contracts/provider_matching_service.py`
- `client/src/components/care/*.tsx`

Acceptance:
- AI anonymization remains deferred by design and does not get a dedicated route, action, or UX surface unless the product explicitly requires it.
- Deterministic masking or truncation helpers may exist, but they are not treated as an AI anonymization workflow.
- A separate uitstroom model or surface is not created unless discharge becomes a first-class product surface.
- Any future AI or uitstroom surface must define its route, permission, audit trail, and tests before launch.

### 1. Must-have for pilot

Goal:
- Keep the operational care flow executable end to end.

Tasks:
- Confirm case creation and case opening stay on the canonical path.
- Keep missing summary states visible until the summary is ready.
- Keep matching, provider review, placement, and intake gated in the correct order.
- Keep provider rejection, weak-match flagging, and rematch visible in the live flow.
- Keep archived cases out of active lists and Regiekamer surfaces.
- Keep document upload available on the case.
- Keep provider capacity and wait-time data available for matching decisions.
- Keep Regiekamer focused on blockers, weak matches, SLA delays, and next-best-action.

Files likely touched:
- `contracts/views.py`
- `contracts/api/views.py`
- `contracts/models.py`
- `contracts/middleware.py`
- `theme/templates/contracts/*.html`
- `tests/test_intake_assessment_matching_flow.py`
- `tests/test_regiekamer_decision_overview.py`

### 2. Nice-to-have

Goal:
- Make the matching and intake experience more explicit without changing the underlying workflow authority.

Tasks:
- Add an explicit filter surface for leeftijd, diagnoses, afstand, and geslacht where the data supports it.
- Make contra-indications easier to inspect in the active UI.
- Give provider profile management a clearer operational home.
- Add a clearer zorgvrager surface if the product needs one separate from municipality/case ownership.
- Improve the instroom/wachtlijst view so available capacity is easier to read.

Files likely touched:
- `contracts/views.py`
- `contracts/forms.py`
- `contracts/models.py`
- `contracts/provider_matching_service.py`
- `client/src/components/care/*.tsx`
- `theme/templates/contracts/*.html`

### 3. Later / not needed for go-live

Goal:
- Keep future platform ideas clearly separated from the pilot scope.

Tasks:
- Add AI anonymization only if there is a real product requirement and a safe implementation plan.
- Create a dedicated uitstroom model only if discharge becomes a first-class product surface.
- Expand BI/reporting only if it serves an operational decision and not a passive dashboard.
- Rework the provider domain model only if a real usage gap appears in matching or intake.

Files likely touched:
- `contracts/models.py`
- `contracts/views.py`
- `contracts/provider_matching_service.py`
- `client/src/components/care/*.tsx`

## Recommended Execution Order

If we start implementation from this backlog, do it in this order:

1. Protect the pilot workflow.
2. Tighten the live filters and provider profile surfaces.
3. Defer AI anonymization and uitstroom modeling until there is a concrete request for them.

This keeps the product operational rather than turning it into a reporting or experimentation layer.
