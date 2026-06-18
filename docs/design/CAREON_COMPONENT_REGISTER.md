# CareOn — component & design-system register

**Status:** Audit — **read-only**. No components changed.
**Date:** 2026-06-17
**Scope:** Part 3 of the audit brief. Inventory of the real shared frontend components and patterns, with a recommended status for each.
**Evidence:** code inspection of `client/src` (App.tsx, `components/care/*`, `components/ui/*`, `components/design/*`, `components/navigation/*`, `lib/*`). Runtime confirmed the SPA is the live surface (see [`../audits/CAREON_CURRENT_STATE_ASSESSMENT.md`](../audits/CAREON_CURRENT_STATE_ASSESSMENT.md)).

---

## 0. How the design system is wired (so the register makes sense)

- **Tokens are CSS-first:** `--care-*` custom properties in `globals.css` are the single source of truth; `design/tokens.ts` mirrors layout values for TS (one intentional accent hex `#7C4DFF`); `lib/operationalRhythm.ts` exports the vertical-rhythm scale.
- **Barrel / spine:** `components/care/CareDesignPrimitives.tsx` (~807 LOC) is the single import path for care pages — it defines some primitives and re-exports the rest from `CareUnifiedPage.tsx`, `CareSurface.tsx`, `CarePageScaffold.tsx`, `CareAppFrame.tsx`, `CaseStatusBadge.tsx` (with aliases such as `AppShell`, `PageHeader = CareUnifiedHeader`, `EmptyState = CareEmptyState`, `FlowPhaseBadge = CanonicalPhaseBadge`). **24 care pages import through it.** This barrel + CSS-first token model is the **healthy core**.
- **Lower layer:** `components/ui/*` = shadcn/Radix primitives (button, card, dialog, table, input, select, sheet…), token-based.
- **The work is pruning**, not rebuilding: several **orphaned shadow systems** re-implement what the canonical primitives already provide.

**Status legend:** **Approved** (canonical, keep) · **Experimental** (in use but isolated/inline-styled) · **Needs consolidation** (overlaps a canonical) · **Deprecated** (dead / superseded, remove after confirmation) · **Forbidden** (parallel system; do not extend or import).

---

## 1. Canonical core (Approved)

| Category | Component · file | Responsibility |
|---|---|---|
| App frame | `CareAppFrame` (alias `AppShell`) · `care/CareAppFrame.tsx` | Max-width + vertical-rhythm wrapper for every authenticated route |
| Header | `CareUnifiedHeader` (alias `PageHeader`) · `care/CareUnifiedPage.tsx` | Compact list/workspace title block |
| Attention/action | `CareAttentionBar`, `CareAttentionSurface`, `CareQueueInlineAction`, `CareDominantStatus` · `care/CareUnifiedPage.tsx` | Dominant attention/next-action surfaces in queues |
| Work rows / queue | `CareWorkRow` (alias `CareListRow`), `CarePrimaryList`, `CareOperationalQueueHeader`, `OPERATIONAL_QUEUE_GRID_*` · `care/CareUnifiedPage.tsx` | Canonical operational work-row + queue grid |
| Filters | `CareSearchFiltersBar`, `CareFilterTabGroup/Button`, `CareMetaChip` · `care/CareUnifiedPage.tsx`; `CareFilterDrawer` · `care/CareFilterDrawer.tsx` | Search + tab filters; slide-over drawer |
| Badges | `CaseStatusBadge` (alias `CareStatusBadge`) · `care/CaseStatusBadge.tsx`; `CanonicalPhaseBadge` (alias `FlowPhaseBadge`) · `care/CareUnifiedPage.tsx`; `CareBadge`, `PriorityBadge` · `CareDesignPrimitives.tsx`; `DecisionBadge` · `care/workflow/DecisionBadge.tsx` | Workflow-status / keten-phase / generic / decision badges |
| Alerts | `CareAlertCard`, `BlockingNotice`, `LoadingState`, `ErrorState` · `CareDesignPrimitives.tsx`; `CareContextHint` · `CareUnifiedPage.tsx`; `ApiErrorMessage` · `ui/ApiErrorMessage.tsx` | Inline alerts, blocking notice, loading/error, API error+retry |
| Empty state | `CareEmptyState` (alias `EmptyState`) · `care/CareSurface.tsx` | Canonical empty state |
| Cards/sections | `CareSection`, `CarePanel`, `CareWorkspaceSection`, `CareWorkListCard` · `CareDesignPrimitives.tsx` | Section/panel/worklist cards |
| Buttons | `Button` · `ui/button.tsx`; `PrimaryActionButton` · `CareDesignPrimitives.tsx` | Base + CareOn primary |
| Selects/forms | `CareOperationalSelect` · `CareDesignPrimitives.tsx`; `ui/form/input/select/dialog/sheet/alert-dialog` | Styled select; shadcn form/dialog primitives |
| Detail workspace | `CasusWorkspaceLayout` · `care/CasusWorkspaceLayout.tsx`; `CasePrimaryActionPanel`, `CaseTimelineHistoryList`, `CaseOperationalStepper` · `care/CaseExecutionWorkspaceSections.tsx` | Live case-detail layout + action/timeline (single consumer: `CaseExecutionPage`) |
| Nav | `Sidebar` · `navigation/Sidebar.tsx`; `TopBar` · `navigation/TopBar.tsx` | Role-aware sidebar; context switcher/theme/profile/search |
| Feature panels | `CaseDocumentsPanel`, `CaseMissingDataPanel`, `CaseSummaryEditor`, `ClassificationPanel`, `ValidationPanel`, `HandoverInfoPanel`, `CoordinationNotesPanel`, `ArrangementAlignmentPanel`, `PlacementValidationChecklist`, `InteractiveCaseCompletionCard` | Case-detail feature panels (token-based, feature-scoped) |
| Guidance | `components/guidance/*` (`GuidanceContextBanner`, `InlineHelpChip`, `ProgressiveGuidance`, `VideoHelpTrigger`) | Shared guidance, used by Matching/NieuweCasus/CaseExecution/Placement |
| Base | `ui/table.tsx`, `ui/skeleton.tsx`, `ui/ErrorBoundary.tsx` | shadcn table, skeleton, error boundary |

---

## 2. Needs consolidation (overlapping canonicals — pick one)

| Concern | Components | Recommendation |
|---|---|---|
| **Page shell** | `CarePageScaffold` (`care/CarePageScaffold.tsx`) **vs** `CarePageTemplate` (`care/CareUnifiedPage.tsx`) | Two "page shell" concepts. Choose one canonical scaffold; alias the other during migration. |
| **Detail layout** | `CareDetailPageTemplate` (+ `CareDetailHeader/CareWorkflowStrip/CareActionZone/CareDetailTabs/CareContextPanel/CareSection/CareFieldGrid/CareActivityList`) — **no page imports the template** — **vs** live `CasusWorkspaceLayout` | Fold the unused template kit into the live layout; resolve the **`CareSection` name collision** (exported by both `CareDesignPrimitives` and `CareDetailPageTemplate`). |
| **Metric / KPI** | `CareKPICard` · `care/CareKPICard.tsx`; `CareMetricBadge` · `CareUnifiedPage`; `CareMetricCard` · `CareCommandPrimitives`; `CareMetricCard` · `CareSurface`; `MetricStrip` · `design/MetricStrip` | **4–5 overlapping** metric implementations. Consolidate to one KPI primitive. |
| **Header variant** | `CarePageHeader` · `care/CareSurface.tsx` (inline styles) duplicates `CareUnifiedHeader` | Consolidate onto `CareUnifiedHeader`. |
| **Cards** | `CareSectionCard`/`CareInsightBanner` · `care/CareSurface.tsx` (inline styles) overlap `CareSection`/`CarePanel`/`CareContextHint` | Consolidate onto `CareDesignPrimitives` versions. |
| **Level badges** | `RiskBadge` · `care/RiskBadge.tsx`; `UrgencyBadge` · `care/UrgencyBadge.tsx`; `PriorityBadge` · `CareDesignPrimitives.tsx` | Near-identical level badges. Consolidate to one parameterized badge. |
| **Filter label** | `CareFilterLabel` · `care/CareSurface.tsx` | Minor; fold into filter bar. **Experimental.** |

---

## 3. Experimental (in use but isolated / inline-styled)

| Component · file | Note |
|---|---|
| `ProcessTimeline` · `design/ProcessTimeline.tsx` | The **only** live consumer of `components/design/*` (used by `CaseExecutionPage`); inline styling. Fold into care primitives, then retire the `design/` folder. |
| AI kit `components/ai/*` (`AIInsightPanel`, `AanbevolenActie`, `MatchExplanation`, `Risicosignalen`, `Samenvatting`, `SystemInsight`) | Only `ProviderProfilePage` imports any; mostly unused. Decide: adopt or retire. |
| `ui/sidebar.tsx` (shadcn) | Overlaps the custom `navigation/Sidebar`; unused by care nav. |

---

## 4. Deprecated (dead / superseded — remove after confirmation)

**Orphaned action panels (5, all 0 importers; live one is `CasePrimaryActionPanel`):** `care/ActionPanel.tsx`, `ui/ActionPanel.tsx`, `design/DominantActionPanel.tsx`, `ui/RecommendedActionBlock.tsx`, `design/NextBestAction.tsx`.

**Orphaned `components/design/*`:** `Worklist.tsx`, `MetricStrip.tsx`, `DominantActionPanel.tsx`, `NextBestAction.tsx` (keep only `ProcessTimeline`, see §3).

**Dead legacy (prior e-commerce app, 0 importers):** `components/EmptyState.tsx`, `PageHeader.tsx`, `SectionHeader.tsx`, `KPICard.tsx`, `StatusBadge.tsx`, `LoadingSkeleton.tsx`, `WorkflowPlaceholder.tsx`, plus `OrderRow`/`RevenueChart`/`ListingCardNew`/`Favorite*`/`Conversation*`/`*Chart` and `components/tracking/*`, `components/orders/*`.

**Superseded worklist primitive:** `CareWorklistEmpty` · `CareCommandPrimitives.tsx` (duplicate of `CareEmptyState`).

---

## 5. Forbidden (parallel design systems — do not extend or import)

| System · file | Why |
|---|---|
| `care/CareCommandPrimitives.tsx` (~15 exports: `CareWorklist`, `CareWorklistTabs/Toolbar/Row/ColumnHeader/Body/Empty/Pagination/FilterPanel`, `CareCommandShell`, `CareMetricStrip/Card`) | **Zero non-test importers**; fully re-implements the work-row/queue/metric system that `CareUnifiedPage` provides and pages actually use. A complete shadow design system — biggest single consolidation target. |
| `care/CasusControlCenter.tsx` | Explicitly quarantined (`@ts-nocheck`, "keep out of production navigation"); only referenced by `lib/casesData.ts` for types. Keep out of nav. |
| `care/CoordinationControlCenter.tsx` | Referenced only by a test; not in the live route tree. |

---

## 6. Hardcoded-styling offenders (token bypass)

| File | Severity | Note |
|---|---|---|
| `care/LoginPage.tsx` | **High** | 37 `style={{}}` blocks, 27 hex literals — entirely off-token. Priority refactor to `--care-*`. |
| `care/SystemAwarenessPage.tsx` | Medium | 10 inline styles + 5 hex — these are **SVG keten/geo phase stroke colors**; defensible, but promote to named tokens. |
| `MatchingPageWithMap`, `CareUnifiedPage`, `CareDesignPrimitives`, `CareSurface`, map components, `RapportagesPage`, `RegiosPage` | Low | 1–4 inline styles each, mostly dynamic dimensions/grid templates. |
| `ui/chart.tsx`, `design/tokens.ts` | Acceptable | shadcn chart defaults; the single documented accent hex. |

**Overall token adoption is strong** outside `LoginPage`. The register's actionable core is: (a) retire the shadow systems and dead legacy, (b) collapse the metric/KPI, page-shell, detail-layout, and level-badge overlaps, (c) refactor `LoginPage` onto tokens, (d) resolve the `CareSection` name collision.

---

## 7. Governance hook

New shared components must be added to this register with a status, and PRs should not introduce a second implementation of an Approved primitive (see [`../engineering/CAREON_ENGINEERING_STANDARDS.md`](../engineering/CAREON_ENGINEERING_STANDARDS.md) → component governance). A lint/guardrail that flags imports from Forbidden/Deprecated files is recommended (roadmap FE workstream).
