# Care SPA — page layout map

**Purpose:** Single reference for how authenticated Care routes apply the shared shell (`CareAppFrame`) versus `CarePageScaffold` versus bespoke layouts. Use when adding routes, refactoring pages, or aligning with Playwright design-system checks.

**Source of routing:** `client/src/components/examples/MultiTenantDemo.tsx` (sidebar `Page` id → component). URL mapping: `PAGE_TO_HREF` and `getInitialNavigation` in the same file.

**Related:** `DESIGN_SYSTEM_TESTING.md` (E2E contracts), `client/src/components/care/CarePageScaffold.tsx` (slot order), `client/src/design/tokens.ts` (layout/density constants).

---

## Global shell (all routed pages below)

| Layer | Component | Role |
| --- | --- | --- |
| App chrome | `Sidebar`, `TopBar` | Navigation, context switch |
| Scroll region | `main` → `CareAppFrame` | Max width `tokens.layout.pageMaxWidth` (1280px), gutters, default `gap-4` column rhythm |

**Casus overlay:** When `selectedCase` is set, `CaseExecutionPage` replaces the current list page inside the same `CareAppFrame` (URL may be `/care/cases/<id>/`).

---

## Layout categories

| Category | Pattern | Typical primitives |
| --- | --- | --- |
| **Unified list / settings** | `CarePageScaffold` → `CarePageTemplate` (`space-y-4`) → `CareUnifiedHeader` + optional `dominantAction` / `kpiStrip` / `filters` | `CareSearchFiltersBar`, `CareWorkRow`, `CareAttentionBar`, `CareSection`*, `FlowPhaseBadge`, `LoadingState` / `ErrorState` |
| **Casus workspace** | `CasusWorkspaceLayout` (not scaffold) | `FlowPhaseBadge`, `CasusWorkspaceStatusBadges`, `CareMetaChip`; `NextBestAction`, `ProcessTimeline` from `client/src/components/design/` |
| **Matching workspace** | `MatchingPageWithMap` (not scaffold) | Map + cards; `tokens` for workspace dimensions |
| **Intake create** | `NieuweCasusPage` long form (not scaffold) | shadcn inputs, local field classes, theme tokens (`border-border`, `bg-card`) |
| **Placeholder / legacy** | Inline JSX in router | `premium-card`, raw headings — **drift risk** |

\* `CareSection` family from `CareDesignPrimitives`.

---

## Gemeente routes

| Sidebar / `Page` | Approx. path | Layout | Primary component(s) | Notes |
| --- | --- | --- | --- | --- |
| Regiekamer | `/`, `/dashboard`, `/regiekamer` | Unified + dominant/KPI | `SystemAwarenessPage` | Larger title overrides; `CareAlertCard`, operational attention strip |
| Casussen | `/casussen` | Unified | `WorkloadPage` | Worklist; opens `CaseExecutionPage` on row/case click |
| Nieuwe casus | `/casussen/nieuw` | Custom form | `NieuweCasusPage` | No `CarePageScaffold` |
| Aanbieder beoordeling | `/beoordelingen` | Unified | `AanbiederBeoordelingPage` | Role `gemeente` |
| Matching | `/matching` | **Hybrid** | `MatchingPageWrapper` | List: `MatchingQueuePage` (unified). Detail: `MatchingPageWithMap` (custom) |
| Plaatsingen | `/plaatsingen` | **Hybrid** | `PlacementPageWrapper` | List: `PlacementTrackingPage` (unified). Detail: `PlacementPage` (unified) |
| Acties | `/acties` | Unified | `ActiesPage` | |
| Zorgaanbieders | `/zorgaanbieders` | Unified | `ZorgaanbiedersPage` | |
| Gemeenten | `/gemeenten` | Unified | `GemeentenPage` | |
| Regio's | `/regios` | Unified | `RegiosPage` | |
| Signalen | `/signalen` | Unified | `SignalenPage` | |
| Rapportages | `/rapportages` | Unified | `RapportagesPage` | |
| Documenten | `/documenten` | Unified | `DocumentenPage` | |
| Audittrail | `/audittrail` | Unified | `AudittrailPage` | |
| Instellingen | `/settings`, `/instellingen` | **Dedicated workspace** | `InstellingenPage` | Sidebar nav + `InstellingenSettingsExperience` (operational governance UI); not `CarePageScaffold` |
| *(overlay)* | `/care/cases/<id>/` | Casus workspace | `CaseExecutionPage` | Replaces main content when case selected |

---

## Zorgaanbieder routes

| Sidebar / `Page` | Approx. path | Layout | Primary component(s) |
| --- | --- | --- | --- |
| Intake | `/intake` | Unified | `IntakeListPage` |
| Mijn casussen | `/mijn-casussen` | Unified | `WorkloadPage` |
| Aanbieder beoordeling | `/beoordelingen` | Unified | `AanbiederBeoordelingPage` (role `zorgaanbieder`) |
| Documenten | `/documenten` | Unified | `DocumentenPage` |
| *(overlay)* | `/care/cases/<id>/` | Casus workspace | `CaseExecutionPage` |

---

## Admin routes

| Sidebar / `Page` | Approx. path | Layout | Primary component(s) |
| --- | --- | --- | --- |
| Regiekamer | `/regiekamer` | Unified | `SystemAwarenessPage` |
| Regio's | `/regios` | Unified | `RegiosPage` |
| Gebruikers | `/gebruikers` | **Placeholder** | Inline `premium-card` block in `MultiTenantDemo` |
| Aanbieder beoordeling | `/beoordelingen` | Unified | `AanbiederBeoordelingPage` (role `admin`) |
| Casussen / Matching / Plaatsingen / Acties / Signalen | various | **Placeholder** | Shared stub block in `MultiTenantDemo` |
| Nieuwe casus | `/casussen/nieuw` | Custom form | `NieuweCasusPage` |
| Rapportages | `/rapportages` | Unified | `RapportagesPage` |
| Instellingen | `/instellingen` | Dedicated workspace | `InstellingenPage` |
| *(overlay)* | `/care/cases/<id>/` | Casus workspace | `CaseExecutionPage` |

---

## Components with unified layout but not in main shell router

These use `CarePageScaffold` (or are demos) but are **not** mounted from `MultiTenantDemo` today — useful for Storybook, tests, or future wiring:

| Component | File | Notes |
| --- | --- | --- |
| `AssessmentQueuePage` | `client/src/components/care/AssessmentQueuePage.tsx` | Imported in `MultiTenantDemo` but **not rendered** (dead import — safe to remove or wire to a route) |
| `AssessmentDecisionPage` | `client/src/components/care/AssessmentDecisionPage.tsx` | Scaffold; no shell route reference |
| `ProviderProfilePage` | `client/src/components/care/ProviderProfilePage.tsx` | Used in `ProviderProfileDemo`, `SidebarDemo` |

---

## Maintenance checklist

1. **New list/settings page:** Prefer `CarePageScaffold` + `CareUnifiedHeader`; add `archetype` for traceability; keep order: header → dominant/KPI → filters → content.
2. **New full-screen workflow:** Document whether it is intentionally **custom** (like `MatchingPageWithMap`) or should migrate to scaffold.
3. **Casus detail:** Keep NBA + process timeline on the casus surface only (see `AGENTS.md` UI mode rules).
4. **E2E:** After route changes, update `client/tests/e2e/care-design-system.spec.ts` if headings or shell expectations change.

---

*Last aligned with router structure in `MultiTenantDemo` (Care SPA). Regenerate this table when adding `Page` enum entries or new role branches.*
