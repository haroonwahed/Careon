# Technical Debt

Date: 2026-04-25

## High-Risk Debt

| Item | Why it is debt | Risk | Suggested follow-up |
| --- | --- | --- | --- |
| Demo/example surfaces live beside the real workflow | The repo contains active code, examples, and archive docs with similar naming | Medium | Keep live navigation filtered and continue quarantining demo-only surfaces |
| Compatibility aliases still exist for old routes | They keep legacy paths alive and make the active surface harder to reason about | Medium | Keep only the aliases that are required by tests or external links |
| `assessment` remains an internal contract name in several places | The business language is Dutch-first, but the technical contract is still mixed | Medium | Decide whether to keep it internal or plan a rename migration |
| Frontend-only report exports | The user can download content that is not backed by a real report pipeline | High | Keep the page clearly internal until a real backend report pipeline exists |
| `ProviderIntakeDashboard` is not wired to the live route map | The component exists but is not part of the current navigation contract | Low | Keep it quarantined as demo-only unless it is reworked against real backend data |
| Mock data layer still exists in `client/src/lib/casesData.ts` | It is useful for examples, but it can be mistaken for live source of truth | Medium | Keep it as demo-only and stop referencing it from live documentation |

## Duplicates And Overlap

- `contracts/provider_matching_service.py` and `contracts/legacy_backend/provider_matching_service.py` both imply matching logic ownership.
- `contracts/views.py` and `contracts/api/views.py` both contain workflow logic, which is fine, but the split is easy to misread.
- The active SPA shell and the server-rendered templates overlap on some routes because of the migration middleware.
- The repo contains many duplicate-looking docs under `client/src/`, `docs/`, and archive folders that describe older UI states.

## Dead Code Or Probably Dead Surfaces

- `client/src/components/provider/ProviderIntakeDashboard.tsx` is currently unreferenced and explicitly quarantined as demo-only.
- `client/src/components/care/CasusControlCenter.tsx` appears to be a legacy workflow shell and should remain quarantined until it is either wired or archived.
- `client/src/components/examples/*` are demo surfaces and should not be treated as active product code.
- `client/src/components/legacy_archive/*` is historical reference material, not active workflow code.
- `theme/templates/contracts/reports_dashboard.html` is intentionally labeled internal; keep it internal-only unless a real backend-backed reporting story is ready.
- `contracts/management/commands/audit_null_organizations.py` describes itself as a compatibility audit placeholder.
- `contracts/governance.py` and `contracts/operational_decision_contract.py` contain `pass` branches that should be revisited if they are still intended to execute.

## Refactor Candidates

- Split the live workflow helpers from the historical/demo helpers more clearly.
- Separate presentation-only components from API-backed components in the client.
- Extract the repeated route alias behavior into a smaller compatibility layer if the aliases stay.
- Replace ad hoc report export text with a proper reporting service.
- Reduce coupling between the SPA shell migration and the server-rendered shell contract.

## Risky Areas

- SPA shell migration middleware can mask route differences during testing.
- Mixed demo/live route coverage makes it easy to ship a page that looks complete but is not fully wired.
- Workflow terminology changes can accidentally break older tests if the contract is not isolated.
- Pagination and ordering assumptions should be normalized before more list views are added.
- Map integration adds an external dependency path that needs graceful fallback handling.
- The current SPA build exceeds Vite's 500 kB chunk warning, which will hurt load time unless it is split up.
- The SPA build still exceeds Vite's 500 kB chunk warning; the low-risk split has been deferred rather than forced.
- Provider rejection now requires a reason code and placement approval is backend-gated, so those specific workflow risks have been reduced.
- Casus archiving is now safe for completed records, but other core entities still need an explicit retention/archive policy.
- A seeded Playwright smoke harness now exists, but it is a release smoke guard rather than a full browser test suite.

## Lower-Priority Cleanup

- Remove generated build noise and local OS artifacts from the working tree before release.
- Cull or archive old transformation documents that still read like current implementation notes.
- Replace placeholder console logging in active code with real actions or explicit TODOs if it is intentionally incomplete.
