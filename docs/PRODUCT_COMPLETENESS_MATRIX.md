# Product Completeness Matrix

Historical snapshot.
This matrix tracks the remaining product-completeness model at the time it was written and should be treated as a planning reference, not a live contract.

Aanbieder Beoordeling date: 2026-04-24

## What This Measures

This matrix is not a go-live checklist.

It measures whether the product feels complete as a care-allocation system:
- all canonical workflow steps exist
- the right actor owns the right action
- the UX is coherent end to end
- the support surfaces are usable, not just present
- the operational model is consistent across pages, APIs, and docs

`100%` means the product is complete enough that we would not consider any major workflow, UX, or domain surface unfinished.

## Matrix

| Area | Completeness | What is complete | What is still incomplete |
|---|---:|---|---|
| Canonical case lifecycle | 84% | Case, samenvatting, matching, aanbieder beoordeling, plaatsing, and follow-up concepts are all present and linked to the core workflow | A few remaining screens and edge cases still need final coherence polish |
| Matching and provider review | 82% | Provider suggestions, match explanations, review/accept/reject logic, and visible decision surfaces exist | The review experience still needs final UX tightening and provider feedback loop polish |
| Intake and placement gating | 80% | The order of casus, samenvatting, matching, aanbieder beoordeling, plaatsing, and intake-overdracht is modeled and tested | Business rules still need a final pass across every entry point and future-facing UI/API path |
| Case workspace UX | 78% | Core case pages, tabs, actions, and server-rendered screens are present | The workspace still has a few migration-era shell and polish gaps |
| Regiekamer and operational oversight | 76% | Operational signals, dashboards, and decision surfaces exist | The intervention layer still needs sharper prioritization and fewer fallback patterns |
| Documents, tasks, and signals | 78% | Core support surfaces are implemented and linked to cases | The experience still needs refinement around navigation, defaults, and consistency of next-best actions |
| Organization and access management | 82% | Organizations, memberships, invitations, scoped queries, and role checks are in place | The admin and member experience could still be tightened for clarity and self-service completeness |
| Network models and configuration | 77% | Clients, municipalities, regions, budgets, and configuration models exist | Some supporting screens remain more operational than product-complete and still need consistency work |
| Governance, audit, and decision quality | 80% | Audit logging, decision logs, and governance contracts are present and visible in core flows | The decision layer still needs to be woven through every live surface as a first-class product feature |
| UI system and Dutch terminology | 80% | Dutch-first terminology and a coherent design system exist | Some screens still reflect migration-era compromises and need a final language/interaction pass |
| API and route consistency | 84% | The major API and route contracts exist and are broadly aligned | A few compatibility helpers still need retirement once the full product contract is fully stable |
| Test coverage and product confidence | 84% | The repo has broad tests across workflow, permissions, operational behavior, and release confidence | Coverage is strong, but still uneven across the remaining end-to-end product completeness scenarios |

## Overall Score

Estimated product completeness: **80%**

This is higher than a raw prototype, but it is still not a fully complete product.

## What Feels Complete Already

- Core entities and relationships are in place.
- The main care workflow is understandable and mostly executable.
- The system has real operational surfaces, not just CRUD screens.
- Tenant isolation and route scoping are much stronger after Sprint 1.
- The product has enough test depth to support structured completion work.

## What Still Feels Partial

- Some workflow steps still need final coherence polish.
- The UX still contains a few migration-era shell and interaction compromises.
- Decision and audit information exists, but still needs broader surface coverage.
- Some support pages are operationally useful but not yet polished enough to feel finished.
- The product still needs a final pass to harmonize the full user journey.

## Product Completeness Gaps

1. Finish the remaining workflow coherence polish so the app keeps one coherent domain path.
2. Remove the last shell/compatibility behavior where it is no longer needed.
3. Expand the decision layer so it is visible across more live product surfaces.
4. Polish the case workspace so every screen answers the next-action question clearly.
5. Tighten the operational surfaces so they read as part of one product, not adjacent modules.
6. Expand end-to-end tests around real user journeys and product-level success criteria.

## Completion Bands

- `0-49%`: clearly unfinished
- `50-74%`: functional but incomplete
- `75-89%`: nearly complete
- `90-100%`: product-complete

At **80%**, the app is functional, credible, and close to complete, but it is not yet product-complete.
