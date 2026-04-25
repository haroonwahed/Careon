# Project Status

Date: 2026-04-25

## Executive Summary

This codebase is a Dutch care-allocation workflow application, not a generic dashboard. The canonical flow is:

`Casus -> Samenvatting -> Matching -> Aanbieder Beoordeling -> Plaatsing -> Intake`

The live product is usable for a constrained pilot or demo, and the core workflow gating is in place. It is not production-ready yet. The biggest gap is that the repository still contains a mix of live workflow code, legacy compatibility seams, and demo/example surfaces, so the product is not yet cleanly separable into "real customer path" versus "reference material."

Phase 2 stabilization has now added safe casus archiving, hidden archived cases from default active lists, and labeled the remaining reporting surface as internal rather than customer-facing. Full browser automation is still not configured, so the pilot journey is currently proven by backend/integration tests plus manual smoke guidance.

### Readiness verdict

- Demo-ready: yes
- MVP-ready: mostly yes for a constrained pilot
- Production-ready: no

### Why this is the current verdict

- The canonical public/auth flow works and is covered by tests.
- The intake -> matching -> provider review -> placement -> intake gating works and is covered by tests.
- The Django system check passes in the bundled runtime.
- The client build passes.
- Active navigation now hides demo-only and legacy pages.
- Placement confirmation is backend-aware and blocked until provider acceptance.
- Provider rejection now requires a stored reason code.
- Casussen can now be safely archived; archived cases disappear from default active queues and remain readable for authorized staff.
- The reporting page is explicitly labeled internal instead of being implied as operational truth.
- Several surfaces are still demo-only or partially wired, especially reporting and some provider-facing views.
- There are still compatibility aliases, historical docs, and mock/demo artifacts in the repo.
- Some actions are not implemented as full CRUD flows, especially delete/archive behavior.

## What Works

- Public landing, login, register, logout, and dashboard entry routing.
- SPA shell delivery for the active care workspace.
- Case creation and case detail workflows.
- Matching candidate generation and provider comparison.
- Provider review / Aanbieder Beoordeling gating.
- Placement gating after provider acceptance.
- Intake handoff after placement.
- Case-scoped document, task, and signal actions.
- Tenant isolation and role/permission coverage in tests.
- Audit trail, notifications, organizations, municipalities, regions, and core configuration pages.
- API endpoints for cases, matching, assessments, placements, signals, tasks, documents, audit log, providers, municipalities, regions, and dashboard summary.

## What Is Partially Done

- The SPA still uses compatibility routes and a middleware-based shell migration seam.
- Reporting exists, but part of the visible export behavior is still frontend-generated demo text and should stay internal until replaced.
- Some pages show useful operational data, but they are not backed by fully real workflow actions yet.
- Some provider-facing surfaces are present but not integrated into the live route map.
- Some current page logic still leans on legacy adapter layers or mock-shaped data contracts.
- The placement page still uses legacy adapters for part of its display model, even though the confirm step now respects the backend gate.

## What Is Broken or Missing

- Archive exists for casussen, but not for every core entity yet.
- A few pages still have demo-only actions or console-driven placeholder handlers, but the active navigation now hides the worst offenders.
- The repo still has archive and design-doc material that can be mistaken for current product guidance.
- The `assessment` naming decision is still unresolved as a product/platform contract decision.
- Mobile behavior and browser smoke coverage are not fully proven across all live surfaces.
- At least one API path emits a pagination ordering warning during tests.

## Known Risks

- Compatibility aliases may keep obsolete surfaces alive longer than intended.
- Demo/example components still exist alongside live workflow components, which makes it easy to misread scope.
- The SPA shell migration is feature-flagged and can hide differences between the server-rendered and SPA-backed paths.
- Some workflow state is expressed through internal naming that still does not perfectly match the Dutch product vocabulary.
- Several areas are functionally correct in tests but not yet validated with a full manual smoke pass.

## Verification

The following checks passed in the bundled project runtime:

- `python3 manage.py check`
- `python3 manage.py test tests.test_public_auth_flow tests.test_dashboard_shell tests.test_intake_assessment_matching_flow tests.test_placements_operational_contract_regression tests.test_provider_response_orchestration tests.test_phase2_pilot_stabilization -v 2`
- earlier targeted workflow and terminology tests for matching, provider response monitoring, and oversight behavior
- `npm --prefix client run build`

## Next Recommended Actions

1. Finish the remaining demo-only/provider-facing surface audit and document the quarantine boundaries.
2. Extend archive/soft-delete behavior to any other core entity that still lacks it, or explicitly scope those entities out.
3. Add a real browser automation harness or keep the manual smoke checklist current and enforced.
4. Make a product decision on whether `assessment` remains internal or gets a Dutch rename.
5. Clean up legacy docs and design notes that still read like current guidance.
6. Remove or ignore generated build noise from the working tree before shipping.
