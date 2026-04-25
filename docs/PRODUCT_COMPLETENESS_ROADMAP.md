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
