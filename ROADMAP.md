# Delivery Roadmap

Date: 2026-04-25

## Phase 2 Stabilization Status

- Completed: safe casus archive/soft-delete, archived-case hiding in active lists, and internal labeling for the remaining reports surface.
- Completed: backend/integration smoke coverage for the canonical pilot journey and archive/permission gates.
- Completed: a seeded Playwright browser smoke harness for the canonical pilot journey, with the release smoke currently passing.
- Still open: the remaining provider-facing quarantine sweep, the long-term reporting decision if it ever becomes customer-facing, and the SPA bundle split if we decide to tackle it.

## Phase 1: Stabilize The App

| Task title | Why it matters | Affected files/modules | Complexity | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Remove or wire demo-only active surfaces | Demo surfaces inside the live workspace make it unclear what is real | `client/src/components/provider/ProviderIntakeDashboard.tsx`, `client/src/components/care/RapportagesPage.tsx`, `client/src/components/examples/*` | Medium | None | No live customer path depends on console-only or frontend-only demo actions; live navigation hides demo-only pages |
| Add missing delete/archive behavior for core entities | Real users need a clear way to retire records, not just create/update them | `contracts/views.py`, `contracts/urls.py`, `theme/templates/contracts/*`, `client/src/components/care/*` | Large | Permission model | Delete/archive flows exist or the product clearly scopes them out everywhere |
| Fix remaining workflow warnings and validation gaps | Small data quality issues turn into production support issues | `contracts/api/views.py`, `contracts/models.py`, `tests/*` | Small | None | Known warnings are resolved or explicitly justified, and validation failures are covered by tests |
| Lock provider rejection reasons and placement gating | The app must not allow ambiguous provider decisions or premature placement | `contracts/views.py`, `client/src/components/care/PlacementPage.tsx`, `tests/test_provider_response_orchestration.py`, `tests/test_placements_operational_contract_regression.py` | Small | None | Provider rejection requires a reason; placement cannot confirm before provider acceptance |

## Phase 2: Complete Core User Flows

| Task title | Why it matters | Affected files/modules | Complexity | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Add browser smoke coverage for the full canonical route path | The app needs to prove that the live route path works end to end | `tests/test_public_auth_flow.py`, browser smoke tooling, `config/urls.py` | Medium | Phase 1 route stability | Landing -> login -> dashboard -> case flow -> logout works in a browser smoke pass |
| Validate the full case lifecycle against live data | The product promise is case progression, not page rendering | `contracts/api/views.py`, `contracts/views.py`, `client/src/components/care/CaseWorkflowDetailPage.tsx` | Large | Workflow gating | A case can move from Casus through Intake without manual repair or hidden assumptions |
| Lock down permission checks on workflow actions | The wrong actor must not be able to change key state | `contracts/permissions.py`, `contracts/views.py`, `contracts/api/views.py`, `tests/*` | Medium | Current auth model | Role-specific actions fail closed and have regression tests |

## Phase 3: Polish UI/UX

| Task title | Why it matters | Affected files/modules | Complexity | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Normalize empty, loading, and error states | Users need clear feedback instead of silent emptiness | `client/src/components/care/*`, `theme/templates/contracts/*` | Medium | Core flows stable | Every important page has a sensible empty/loading/error state |
| Finish the terminology sweep on active surfaces | Dutch terminology is part of product clarity | `client/src/components/care/*`, `theme/templates/contracts/*`, `contracts/forms.py` | Small | None | No active customer path uses avoidable English where a canonical Dutch term exists |
| Make the live pages more mobile-safe | Managers and providers will use this outside desktop | `client/src/components/care/*`, `theme/templates/contracts/*`, `theme/static/css/*` | Medium | None | Key pages remain usable at tablet and mobile widths |

## Phase 4: Add Missing Business Features

| Task title | Why it matters | Affected files/modules | Complexity | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Replace frontend demo reporting with real backend reporting | Operational reporting must come from source data | `contracts/api/views.py`, `contracts/views.py`, `client/src/components/care/RapportagesPage.tsx` | Large | Data model clarity | Reports are backed by persisted data and no longer depend on demo-only export text |
| Wire a real provider-facing workspace | Providers need a real inbox/intake surface | `client/src/components/provider/*`, `contracts/views.py`, `contracts/api/views.py` | Large | Matching/placement contract | Providers can review, accept, reject, and follow cases in the intended live path |
| Complete document lifecycle support | Documents are a core part of case traceability | `contracts/models.py`, `contracts/views.py`, `contracts/api/views.py`, `theme/templates/contracts/document_*` | Medium | Upload/storage behavior | Documents can be added, viewed, and validated in a case-scoped workflow |

## Phase 5: Production Readiness

| Task title | Why it matters | Affected files/modules | Complexity | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Harden deployment configuration and secrets | Misconfiguration is the fastest way to break a customer rollout | `config/settings.py`, `config/settings_production.py`, `render.yaml`, docs | Medium | None | Production startup fails fast on bad config and passes on real config |
| Add release smoke and rollback checks | Production needs a repeatable safety net | `docs/*`, CI scripts, tests, deployment pipeline | Medium | Core flow stability | A release checklist can be run without guessing and with a rollback path |
| Confirm observability and supportability | If it breaks, someone has to diagnose it quickly | `contracts/middleware.py`, logging config, deployment docs | Medium | Deployment readiness | Error reporting, logs, and basic health checks exist for the active path |

## Phase 6: Nice-To-Have Improvements

| Task title | Why it matters | Affected files/modules | Complexity | Dependency | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Improve matching explainability visuals | Better trade-off explanation improves trust | `client/src/components/care/MatchingPageWithMap.tsx`, `contracts/provider_matching_service.py` | Medium | Matching contract stable | Users can see why a provider was suggested and what the trade-offs are |
| Expand analytics and forecasting | Helps Regiekamer users anticipate bottlenecks | `contracts/oversight_workspace.py`, `contracts/provider_metrics.py`, `client/src/components/care/RegiekamerControlCenter.tsx` | Medium | Stable data definitions | Forecast and bottleneck views are useful without becoming a generic dashboard |
