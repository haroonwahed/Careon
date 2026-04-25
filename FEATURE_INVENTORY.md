# Feature Inventory

Date: 2026-04-25

## 1. Routes And Pages

### Surface classification snapshot

| Surface | Status |
| --- | --- |
| `/regiekamer`, `/casussen`, `/matching`, `/beoordelingen`, `/plaatsingen`, `/intake`, `/mijn-casussen`, `/zorgaanbieders`, `/gemeenten`, `/regios`, `/signalen` | `ACTIVE_PRODUCT` |
| `/documenten`, `/audittrail`, `/instellingen`, `/care/casussen/<int:pk>/archive/` | `SUPPORTING_INTERNAL` |
| `/rapportages` and the `RapportagesPage` export preview | `SUPPORTING_INTERNAL` / internal-only |
| `/gebruikers` in the sidebar legacy path | `LEGACY` |
| `client/src/components/examples/*` | `DEMO_ONLY` |
| `client/src/components/care/CasusControlCenter.tsx` | `UNKNOWN` until it is wired or explicitly archived |
| `client/src/components/provider/ProviderIntakeDashboard.tsx` | `DEMO_ONLY` and intentionally quarantined |

### Public and platform routes

- `/` - public landing page
- `/dashboard/` - compatibility dashboard entry
- `/login/`
- `/register/`
- `/logout/`
- `/profile/`
- `/settings/`
- `/settings/design-mode/`
- `/toggle-redesign/`
- `/_health/`
- `/admin/`

### Care API routes

- `/care/api/cases/`
- `/care/api/cases/bulk-update/`
- `/care/api/cases/intake-form/`
- `/care/api/cases/intake-create/`
- `/care/api/cases/<int:case_id>/matching-candidates/`
- `/care/api/cases/<int:case_id>/assessment-decision/`
- `/care/api/cases/<int:case_id>/matching/action/`
- `/care/api/cases/<int:case_id>/decision-evaluation/`
- `/care/api/cases/<int:case_id>/placement-detail/`
- `/care/api/cases/<int:case_id>/`
- `/care/api/cases/<str:case_ref>/`
- `/care/api/assessments/`
- `/care/api/placements/`
- `/care/api/signals/`
- `/care/api/tasks/`
- `/care/api/documents/`
- `/care/api/audit-log/`
- `/care/api/providers/`
- `/care/api/municipalities/`
- `/care/api/regions/`
- `/care/api/regions/health/`
- `/care/api/dashboard/`

### Care workspace routes

- `/care/clients/`, `/care/clients/new/`, `/care/clients/<int:pk>/`, `/care/clients/<int:pk>/edit/`
- `/care/gemeenten/`, `/care/gemeenten/new/`, `/care/gemeenten/<int:pk>/`, `/care/gemeenten/<int:pk>/edit/`
- `/care/regio's/`, `/care/regio's/new/`, `/care/regio's/<int:pk>/`, `/care/regio's/<int:pk>/edit/`
- `/care/configuraties/<int:pk>/`, `/care/configuraties/<int:pk>/edit/`
- `/care/documents/`, `/care/documents/new/`, `/care/documents/<int:pk>/`, `/care/documents/<int:pk>/edit/`
- `/care/deadlines/`, `/care/deadlines/new/`, `/care/deadlines/<int:pk>/edit/`, `/care/deadlines/<int:pk>/complete/`
- `/care/budgets/`, `/care/budgets/new/`, `/care/budgets/<int:pk>/`, `/care/budgets/<int:pk>/edit/`, `/care/budgets/<int:budget_pk>/add-expense/`
- `/care/taken/`, `/care/taken/new/`, `/care/taken/<int:pk>/edit/`
- `/care/tasks/`, `/care/tasks/board/`, `/care/tasks/new/`, `/care/tasks/<int:pk>/edit/`
- `/care/audit-log/`
- `/care/notifications/`, `/care/notifications/<int:pk>/read/`, `/care/notifications/mark-all-read/`
- `/care/organizations/switch/`, `/care/organizations/team/`, `/care/organizations/invitations/<uuid:token>/accept/`, `/care/organizations/invitations/<int:invite_id>/revoke/`, `/care/organizations/invitations/<int:invite_id>/resend/`, `/care/organizations/members/<int:membership_id>/role/`, `/care/organizations/members/<int:membership_id>/deactivate/`, `/care/organizations/members/<int:membership_id>/reactivate/`, `/care/organizations/activity/`, `/care/organizations/activity/export/`
- `/care/reports/`
- `/care/regiekamer/provider-responses/`
- `/care/search/`
- `/care/wachttijden/`, `/care/wachttijden/new/`, `/care/wachttijden/<int:pk>/`, `/care/wachttijden/<int:pk>/edit/`
- `/care/intakes/`, `/care/intakes/new/`, `/care/intakes/<int:pk>/`, `/care/intakes/<int:pk>/edit/`
- `/care/matching/`
- `/care/workflows/`, `/care/workflows/<int:pk>/`, `/care/workflows/step/<int:pk>/update/`
- `/care/plaatsingen/`, `/care/plaatsingen/new/`, `/care/plaatsingen/<int:pk>/`, `/care/plaatsingen/<int:pk>/edit/`
- `/care/intake-overdracht/`
- `/care/signalen/`, `/care/signalen/new/`, `/care/signalen/<int:pk>/`, `/care/signalen/<int:pk>/edit/`, `/care/signalen/<int:pk>/status/`
- `/care/risks/`, `/care/risks/<int:pk>/edit/`
- `/care/casussen/`, `/care/casussen/new/`, `/care/casussen/<int:pk>/`, `/care/casussen/<int:pk>/edit/`, `/care/casussen/<int:pk>/archive/`, `/care/casussen/<int:pk>/matching/action/`, `/care/casussen/<int:pk>/placement/action/`, `/care/casussen/<int:pk>/provider-response/action/`, `/care/casussen/<int:pk>/communicatie/action/`, `/care/casussen/<int:pk>/outcomes/action/`, `/care/casussen/<int:pk>/documenten/new/`, `/care/casussen/<int:pk>/taken/new/`, `/care/casussen/<int:pk>/signalen/new/`
- `/care/beoordelingen/`, `/care/beoordelingen/new/`, `/care/beoordelingen/<int:pk>/`, `/care/beoordelingen/<int:pk>/edit/`
- `/care/` - redirect to the SPA landing

### Legacy compatibility routes

- `/care/intakes/*` are redirects preserved for compatibility.
- `/care/plaatsingen/new/` redirects to matching.
- `/care/workflows/` routes to the reports dashboard.
- `/care/intake-overdracht/` points at placement listing.

## 2. Major Frontend Components

### Public and shell

- `client/src/App.tsx`
- `client/src/components/public/PublicLandingPage.tsx`
- `client/src/components/examples/MultiTenantDemo.tsx`
- `client/src/components/navigation/TopBar.tsx`
- `client/src/components/navigation/Sidebar.tsx`

### Active care workflow

- `client/src/components/care/RegiekamerControlCenter.tsx`
- `client/src/components/care/CasussenWorkflowPage.tsx`
- `client/src/components/care/CasusControlCenter.tsx`
- `client/src/components/care/CaseWorkflowDetailPage.tsx`
- `client/src/components/care/NieuweCasusPage.tsx`
- `client/src/components/care/AssessmentQueuePage.tsx`
- `client/src/components/care/AssessmentDecisionPage.tsx`
- `client/src/components/care/MatchingPageWrapper.tsx`
- `client/src/components/care/MatchingPageWithMap.tsx`
- `client/src/components/care/MatchingDecisionEnginePage.tsx`
- `client/src/components/care/PlacementPageWrapper.tsx`
- `client/src/components/care/PlacementPage.tsx`
- `client/src/components/care/PlacementTrackingPage.tsx`
- `client/src/components/care/IntakeListPage.tsx`
- `client/src/components/care/IntakeBriefing.tsx`
- `client/src/components/care/IntakeStatusTracker.tsx`

### Governance and operations

- `client/src/components/care/ZorgaanbiedersPage.tsx`
- `client/src/components/care/GemeentenPage.tsx`
- `client/src/components/care/RegiosPage.tsx`
- `client/src/components/care/SignalenPage.tsx`
- `client/src/components/care/ActiesPage.tsx`
- `client/src/components/care/DocumentenPage.tsx`
- `client/src/components/care/AudittrailPage.tsx`
- `client/src/components/care/RapportagesPage.tsx`
- `client/src/components/care/InstellingenPage.tsx`

### Provider-facing

- `client/src/components/provider/ProviderIntakeDashboard.tsx`
- `client/src/components/provider/ProviderCaseCard.tsx`
- `client/src/components/provider/ProviderKPIStrip.tsx`
- `client/src/components/provider/StatusBadge.tsx`
- `client/src/components/care/ProviderProfilePage.tsx`

### Shared UI primitives and composites

- `client/src/components/care/ActionPanel.tsx`
- `client/src/components/care/BulkActionBar.tsx`
- `client/src/components/care/CapacityIndicator.tsx`
- `client/src/components/care/CareKPICard.tsx`
- `client/src/components/care/CaseCard.tsx`
- `client/src/components/care/CaseStatusBadge.tsx`
- `client/src/components/care/CaseTableRow.tsx`
- `client/src/components/care/CaseTimeline.tsx`
- `client/src/components/care/CaseTriageCard.tsx`
- `client/src/components/care/CasussenBoardView.tsx`
- `client/src/components/care/CasussenFilterChips.tsx`
- `client/src/components/care/DocumentSection.tsx`
- `client/src/components/care/HandoverInfoPanel.tsx`
- `client/src/components/care/PlacementValidationChecklist.tsx`
- `client/src/components/care/PriorityActionCard.tsx`
- `client/src/components/care/ProviderMiniMap.tsx`
- `client/src/components/care/ProviderNetworkMap.tsx`
- `client/src/components/care/RiskBadge.tsx`
- `client/src/components/care/SelectedProviderCard.tsx`
- `client/src/components/care/SignalCard.tsx`
- `client/src/components/care/SimpleCaseCard.tsx`
- `client/src/components/care/SimpleCasusCard.tsx`
- `client/src/components/care/UrgencyBadge.tsx`
- `client/src/components/care/ValidationPanel.tsx`

### Templates

- `theme/templates/base.html`
- `theme/templates/registration/login.html`
- `theme/templates/registration/register.html`
- `theme/templates/contracts/matching_dashboard.html`
- `theme/templates/contracts/provider_response_monitor.html`
- `theme/templates/contracts/placement_list.html`
- `theme/templates/contracts/placement_detail.html`
- `theme/templates/contracts/placement_form.html`
- `theme/templates/contracts/intake_list.html`
- `theme/templates/contracts/intake_detail.html`
- `theme/templates/contracts/intake_form.html`
- `theme/templates/contracts/assessment_list.html`
- `theme/templates/contracts/assessment_detail.html`
- `theme/templates/contracts/assessment_form.html`
- Case-centered detail and form variants for documents, signals, regions, municipalities, clients, wait times, budgets, and tasks are present as dedicated templates alongside the SPA workflow.
- `theme/templates/contracts/document_list.html`, `document_detail.html`, `document_form.html`
- `theme/templates/contracts/signal_list.html`, `signal_detail.html`, `signal_form.html`
- `theme/templates/contracts/regional_list.html`, `regional_detail.html`, `regional_form.html`
- `theme/templates/contracts/municipality_list.html`, `municipality_detail.html`, `municipality_form.html`
- `theme/templates/contracts/client_list.html`, `client_detail.html`, `client_form.html`
- `theme/templates/contracts/waittime_list.html`, `waittime_detail.html`, `waittime_form.html`
- `theme/templates/contracts/budget_list.html`, `budget_detail.html`, `budget_form.html`, `expense_form.html`
- `theme/templates/contracts/task_board.html`, `task_form.html`
- `theme/templates/contracts/reports_dashboard.html`
- `theme/templates/contracts/search_results.html`

## 3. Backend Modules

- `config/settings.py` - base settings and environment handling
- `config/settings_production.py` - production safety checks
- `config/urls.py` - top-level routing
- `contracts/views.py` - main server-rendered views and workflow actions
- `contracts/api/views.py` - API layer for cases, matching, placements, signals, tasks, documents, providers, municipalities, regions, dashboard
- `contracts/models.py` - domain models and entities
- `contracts/forms.py` - form definitions and validation
- `contracts/permissions.py` - role and workflow permission helpers
- `contracts/middleware.py` - organization resolution and SPA shell migration
- `contracts/tenancy.py` - tenant selection helpers
- `contracts/governance.py` - decision logging, SLA transitions, and review summaries
- `contracts/decision_quality.py` - quality review helpers
- `contracts/decision_quality_workflow.py` - weekly review workflow
- `contracts/case_intelligence.py` - case summary/intelligence helpers
- `contracts/oversight_workspace.py` - municipality/region oversight payloads
- `contracts/provider_metrics.py` - provider behavior metrics
- `contracts/provider_pipeline.py` - provider workflow pipeline helpers
- `contracts/provider_pipeline_mapping.py` - provider sync mapping and validation
- `contracts/provider_matching_service.py` - matching service
- `contracts/provider_workspace.py` - provider-facing workspace assembly
- `contracts/decision_engine.py` - canonical decision evaluation for blockers, risks, alerts, and next-best action
- `contracts/provider_adapters.py` - provider integration adapters
- `contracts/waitlist.py` - waitlist helpers
- `contracts/navigation.py` - public and SPA route constants
- `contracts/auth_backends.py` - authentication backend hooks
- `contracts/admin.py` - Django admin registrations
- `contracts/context_processors.py` - feature flags for templates
- `contracts/domain/contracts.py` - domain abstractions
- `contracts/legacy_backend/*` - old provider-matching compatibility code
- `contracts/management/commands/*` - seed, sync, review, reminder, and import jobs

## 4. Database Models

| Model | Purpose |
| --- | --- |
| `Organization` | Tenant / organization boundary |
| `OrganizationMembership` | User membership and role per organization |
| `OrganizationInvitation` | Invitation lifecycle |
| `UserProfile` | User metadata and role |
| `CareCategoryMain` | Main care categories |
| `CareCategorySubcategory` | Subcategories for care categories |
| `RiskFactor` | Structured risk factors/signals |
| `Client` | Client/case owner entity |
| `ProviderProfile` | Provider metadata |
| `CareConfiguration` | Configuration and workflow settings |
| `CareCase` | Core case record |
| `Document` | Case and workflow documents |
| `TrustAccount` | Trust/accounting support entity |
| `Deadline` | Deadlines and reminders |
| `AuditLog` | Immutable audit trail |
| `SystemPolicyConfig` | Policy/config storage |
| `Notification` | Notification inbox items |
| `CaseAssessment` | Aanbieder Beoordeling records |
| `PlacementRequest` | Placement / handoff requests |
| `CaseDecisionLog` | Workflow decision history |
| `CareTask` | Operational tasks |
| `Tag` | Tagging support |
| `CareSignal` | Signals and alerts |
| `WorkflowTemplate` | Workflow template definitions |
| `WorkflowTemplateStep` | Template steps |
| `Workflow` | Workflow instance |
| `WorkflowStep` | Workflow step instance |
| `CaseIntakeProcess` | Intake process state |
| `IntakeTask` | Intake task record |
| `CaseRiskSignal` | Risk signal record |
| `Budget` | Budget governance |
| `BudgetExpense` | Budget line items |
| `MunicipalityConfiguration` | Municipality oversight/config |
| `RegionalConfiguration` | Region oversight/config |
| `DecisionQualityReview` | Decision quality review record |
| `DecisionQualityWeeklyReviewMark` | Weekly review summary mark |
| `Zorgaanbieder` | Provider organization |
| `AanbiederVestiging` | Provider location |
| `Zorgprofiel` | Care profile / specialism |
| `CapaciteitRecord` | Capacity data |
| `ContractRelatie` | Contract / relationship |
| `ProviderRegioDekking` | Regional coverage |
| `ProviderImportBatch` | Provider import batch |
| `BronImportBatch` | Source import batch |
| `BronRecordRaw` | Raw source row |
| `BronSyncLog` | Sync log |
| `ProviderStagingRecord` | Staging row |
| `ProviderSyncLog` | Sync log for provider sync |
| `ProviderSyncConflict` | Sync conflict record |
| `PrestatieProfiel` | Performance profile |
| `ContactpersoonAanbieder` | Provider contact person |
| `BronMappingIssue` | Source mapping issue |
| `MatchResultaat` | Matching result record |

## 5. APIs And Endpoints

| Endpoint | Purpose | Status |
| --- | --- | --- |
| `/care/api/cases/` | Case list and filters | Done |
| `/care/api/cases/bulk-update/` | Bulk case updates | Done |
| `/care/api/cases/intake-form/` | Intake form options | Done |
| `/care/api/cases/intake-create/` | Create intake-linked case | Done |
| `/care/api/cases/<int:case_id>/matching-candidates/` | Matching candidate payload | Done |
| `/care/api/cases/<int:case_id>/assessment-decision/` | Provider review decision payload | Done |
| `/care/api/cases/<int:case_id>/matching/action/` | Matching actions | Done |
| `/care/api/cases/<int:case_id>/placement-detail/` | Placement detail payload | Done |
| `/care/api/cases/<int:case_id>/` | Case detail | Done |
| `/care/api/cases/<str:case_ref>/` | String fallback for case lookup | Done |
| `/care/api/assessments/` | Assessment list | Done |
| `/care/api/placements/` | Placement list | Done |
| `/care/api/signals/` | Signals list | Done |
| `/care/api/tasks/` | Tasks list | Done |
| `/care/api/documents/` | Document list | Done |
| `/care/api/audit-log/` | Audit log list | Done |
| `/care/api/providers/` | Provider list | Done |
| `/care/api/municipalities/` | Municipality list | Done |
| `/care/api/regions/` | Region list | Done |
| `/care/api/regions/health/` | Region health summary | Done |
| `/care/api/dashboard/` | Dashboard summary | Done |

## 6. Integrations

| Integration | Purpose | Status |
| --- | --- | --- |
| Django session auth | Auth for the active app | Done |
| CSRF-aware fetch wrapper | Client-side API protection | Done |
| Optional OIDC (`mozilla_django_oidc`) | SSO path when enabled | Partial |
| `django_browser_reload` | Dev-only browser refresh | Done in dev |
| `debug_toolbar` | Dev-only debugging | Done in dev |
| PostgreSQL via `DATABASE_URL` | Production database | Partial |
| MapLibre / `react-map-gl` / Leaflet | Provider mapping UI | Partial |
| Google Maps embed in matching map view | Map preview in matching UI | Partial |
| Render deployment blueprint | Hosting/build pipeline | Partial |

## 7. Feature Inventory Table

| Feature / module | Purpose | Current status | Evidence from code | Relevant files | What still needs to happen | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Public auth shell | Entry, login, register, logout, and dashboard handoff | Done | Routes exist and tests cover the round trip | `config/urls.py`, `contracts/views.py`, `tests/test_public_auth_flow.py` | Keep it stable and smoke-tested | High |
| SPA shell migration | Serve the active care workspace through the SPA shell | Partially done | `SpaShellMigrationMiddleware` serves SPA shell on selected paths | `contracts/middleware.py`, `theme/static/spa/index.html` | Decide whether all active care pages should fully migrate or remain mixed | High |
| Case intake | Capture new casus data | Done | `case_create`, `intake_create_api`, case-flow tests | `contracts/urls.py`, `contracts/api/views.py`, `client/src/components/care/NieuweCasusPage.tsx` | Add delete/archive and more manual QA | High |
| Case list and workflow | Find, filter, and work cases | Done | `CasussenWorkflowPage`, board/list views, queue counts | `client/src/components/care/CasussenWorkflowPage.tsx`, `contracts/views.py` | Keep search/filter and role filtering stable | High |
| Case detail / control center | Show next action and case context | Done | `CaseWorkflowDetailPage` is the modal workflow hub | `client/src/components/care/CaseWorkflowDetailPage.tsx`, `contracts/views.py` | Ensure every branch has a clear next action | Critical |
| Samenvatting / intelligence | Surface case context and missing info | Partially done | Intelligence and decision-summary helpers exist | `contracts/case_intelligence.py`, `contracts/oversight_workspace.py` | Prove that the summary is visible and actionable in all live paths | High |
| Matching recommendation engine | Suggest best-fit providers | Done | Matching API and matching UI both exist; tests cover matching regression | `contracts/provider_matching_service.py`, `contracts/api/views.py`, `client/src/components/care/MatchingPageWithMap.tsx` | Keep explainability and rejection reasons visible | Critical |
| Aanbieder Beoordeling | Provider accepts/rejects with reasons | Done | Assessment decision API and queue/tests exist | `contracts/api/views.py`, `client/src/components/care/AssessmentQueuePage.tsx`, `client/src/components/care/AssessmentDecisionPage.tsx` | Continue to harden gating and permissions | Critical |
| Placement gating | Prevent placement before acceptance | Done | Placement regression tests cover the contract | `tests/test_placements_operational_contract_regression.py`, `contracts/api/views.py` | Keep it from regressing during refactors | Critical |
| Intake handoff | Start intake only after placement | Partially done | Intake flow exists and tests cover the canonical path | `client/src/components/care/IntakeListPage.tsx`, `contracts/api/views.py`, `tests/test_intake_assessment_matching_flow.py` | Add manual smoke coverage and clearer state labels | High |
| Regiekamer | Prioritize urgent cases and bottlenecks | Done | Control center and priority action logic exist | `client/src/components/care/RegiekamerControlCenter.tsx`, `contracts/oversight_workspace.py` | Keep it action-oriented, not dashboard-like | High |
| Provider workspace | Show inbound cases to providers | Partially done | Dedicated dashboard component exists, but it is not referenced from the live route map and remains demo-only | `client/src/components/provider/ProviderIntakeDashboard.tsx` | Keep quarantined unless it is reworked against real backend data | Low |
| Reporting | Provide operational exports and summaries | Partially done | Backend report page is intentionally internal-only; frontend export preview still reads as demo-like | `client/src/components/care/RapportagesPage.tsx`, `theme/templates/contracts/reports_dashboard.html` | Keep internal-only or replace with real backend reporting later | Medium |
| Decision engine | Evaluate a casus and surface blockers, risks, alerts, and next best action | Done | Backend `evaluate_case()` now powers the case detail panel and API response contract | `contracts/decision_engine.py`, `contracts/api/views.py`, `client/src/components/care/CaseWorkflowDetailPage.tsx`, `client/src/lib/decisionEvaluation.ts` | Keep frontend consumption read-only | High |
| Documents | Upload, list, and inspect case documents | Partially done | List/detail/form routes exist and case-scoped create routes exist | `contracts/urls.py`, `theme/templates/contracts/document_list.html`, `client/src/components/care/DocumentenPage.tsx` | Validate upload/save paths end to end | High |
| Audit trail | Trace who changed what and when | Partially done | Audit log model, list API, and UI exist | `contracts/models.py`, `contracts/api/views.py`, `client/src/components/care/AudittrailPage.tsx` | Verify completeness of log coverage across actions | High |
| Municipal / regional governance | Oversight of regions and municipalities | Partially done | Dedicated models, APIs, templates, and SPA pages exist | `contracts/models.py`, `contracts/api/views.py`, `client/src/components/care/GemeentenPage.tsx`, `client/src/components/care/RegiosPage.tsx` | Keep KPI surfaces consistent with live data | Medium |
| Signals / actions / tasks | Operational follow-up for blocked work | Done | Signals and task routes exist; action-oriented components are present | `contracts/urls.py`, `client/src/components/care/SignalenPage.tsx`, `client/src/components/care/ActiesPage.tsx` | Strengthen empty/error states and ownership clarity | High |
| Organization and tenancy | Multi-tenant access and invitations | Done | Membership, invite, and middleware logic are present | `contracts/models.py`, `contracts/middleware.py`, `contracts/permissions.py` | Keep permission tests passing as roles evolve | Critical |
| Search and navigation | Find cases, documents, providers, and actions | Done | Global search and top-bar search are wired | `contracts/urls.py`, `theme/templates/base.html`, `client/src/components/navigation/TopBar.tsx` | Keep search contracts aligned across SPA and templates | Medium |
| Workflow templates and config | Configure operational steps and settings | Partially done | Workflow and configuration routes exist | `contracts/models.py`, `contracts/urls.py`, `theme/templates/contracts/configuration_detail.html` | Decide which parts are operational versus admin-only | Medium |
| Legacy/demo surfaces | Preserve old examples and transformation docs | Broken as current guidance | Many demo/example docs and components still read like active product material | `client/src/components/examples/*`, `client/src/QUICKSTART.md`, `client/src/TRANSFORMATION_COMPLETE.md` | Mark as historical or move to archive | Low |
