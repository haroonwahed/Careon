# CareOn Screen Uniformity Matrix

Scope: repository-wide screen / route-family audit for CareOn UI uniformity.  
Method: route aliases are collapsed when they render the same visible surface; non-route demo components are listed as duplicate/retirement candidates rather than counted as active screens.  
Counted inventory: 50 route/screen families.

## Reading Guide

- **A. UNIFORM**: aligned with the Care shell and primitives.
- **B. ACCEPTABLE EXCEPTION**: intentionally different for public/auth/permission flows, but still on-brand.
- **C. NORMALIZATION REQUIRED**: active screen with unjustified drift in shell, spacing, surfaces, or interaction density.
- **D. LEGACY / MIGRATION CANDIDATE**: still maintained or reachable, but based on the older Django/template system.
- **E. DUPLICATE / RETIREMENT CANDIDATE**: dead, demo-only, or duplicated surface that should be removed or consolidated rather than restyled.

## Matrix

| Screen | Route | Family | Archetype | Active status | Classification | Shell | Header | Surfaces | Buttons | Status/badges | Density/spacing | Responsive | Main inconsistency | Recommended action | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public landing | `/` | public marketing | public marketing | active | B | `base_fullscreen.html` public shell | Public nav + hero | `public-shell`, `ds-card`, public section cards | `glow-btn`, `public-btn-primary`, `public-btn-secondary` | Small hero chip and module meta | Loose hero rhythm, intentional marketing spacing | Stacks to single column | Different by design; not an operational page | Keep as intentional public exception | small |
| Auth trio | `/login/`, `/register/`, `/logout/` | auth | authentication | active | B | `base_fullscreen.html` auth shell | Split auth card with brand row | `careon-login-*`, `auth-layout`, glass/dark auth surfaces | Primary submit, theme toggle, SSO link/button | Form errors, help text, password toggle | Compact split-screen auth rhythm | Stacks on mobile; summary follows form | Different by design; secure access family | Keep as intentional auth exception | small |
| Permission denied | `/geen-toegang/` | exception | access / error | active | B | SPA exception shell | `CareUnifiedHeader` + `ErrorState` | Dark error surface with safe copy | `PrimaryActionButton`, outline fallback | Status-driven copy only | Tight, single-purpose error layout | Renders as compact mobile exception | Intentionally distinct but still Care-branded | Keep; verify error focus and link reachability | small |
| Shell chrome / sidebar | all authenticated SPA screens | shell | chrome | active | A | `CareAppFrame` + `TopBar` + `Sidebar` | TopBar + shell nav | Fixed rail, border, card surfaces | Icon rail, collapse button, context switchers | Small nav badges | Shared shell geometry with restrained active states | Collapses; rail remains fixed | Wave 1 normalized the rail contrast and surface language | Retain; monitor in later waves | small |
| Regiekamer / coordination | `/dashboard/`, `/coordination/` | care SPA | command | active | A | `CareAppFrame`, `TopBar`, `Sidebar` | `CareUnifiedHeader` | `CareAttentionBar`, KPI strip, queue/work rows, `CareWorkspaceSection` | `PrimaryActionButton`, ghost secondary buttons | `CareMetricBadge`, dominant attention bar | Compact command layout with clear priority | Responsive command page | None; this is the canonical command archetype | Retain | small |
| Werkvoorraad / casussen | `/casussen/`, `/mijn-casussen/`, `/care/casussen/` | care SPA | queue / worklist | active | A | Care shell + frame | `CareOperationalQueueHeader` | `CareWorkRow`, worklist card, attention strip | Inline CTA button per row | Dominant status chips, urgency badges | Compact responsive queue rows with no fixed wide grid | Stacks and compresses cleanly at tested laptop / zoom sizes | Wave 1 removed the horizontal overflow risk | Retain; standardize remaining queues in later waves | medium |
| Nieuwe casus | `/casussen/nieuw/`, `/care/casussen/new/` | care SPA | workspace / form | active | A | Care shell + frame | `CareUnifiedHeader` / form header | Dark form sections, wizard-ish blocks | Primary form submit + secondary cancel | Inline validation and step markers | Compact form rhythm | Stacks cleanly | Form density is acceptable; no major drift | Retain | small |
| Casusdetail / execution | `/care/cases/<id>/`, `/cases/<id>/` | care SPA | detail / decision workspace | active | A | Care shell + frame | `CareUnifiedHeader`, process timeline | `ProcessTimeline`, `ArrangementAlignmentPanel`, custom workspace sections | Primary actions + overflow menu | Timeline markers and decision chips | Dense but compact detail page | Collapses to single column detail | Wave 1 restored canonical workflow wording and tightened the panel hierarchy | Retain; keep custom panels under review for later consolidation | medium |
| Aanbiederreactie | `/beoordelingen/`, `/care/beoordelingen/` | care SPA | queue | active | A | Care shell + frame | `CareOperationalQueueHeader` | `CareWorkRow`, queue sections | Primary row CTA + supporting actions | Compact status badges | Queue-appropriate density | Responsive row stack | None material; fits the queue archetype | Retain | small |
| Matching | `/matching/`, `/care/matching/` | care SPA | queue / decision support | active | A | Care shell + frame | `CareOperationalQueueHeader` | `CareWorkRow`, supporting surfaces, explainability blocks | Primary row CTA + secondary detail links | Advisory badges and fit/status chips | Compact and scannable | Responsive queue + detail split | None material; matches the queue archetype | Retain | small |
| Plaatsingen | `/plaatsingen/`, `/care/plaatsingen/` | care SPA | queue | active | A | Care shell + frame | `CareOperationalQueueHeader` | `CareWorkRow`, placement summary panels | Primary row CTA + secondary actions | Placement state chips | Compact queue density | Responsive list/side detail | None material | Retain | small |
| Acties | `/acties/` | care SPA | queue | active | A | Care shell + frame | `CareOperationalQueueHeader` | `CareWorkRow`, alerts, worklist cards | Primary CTA per item | Action-state badges | Queue rhythm, compact rows | Responsive queue | None material | Retain | small |
| Network reference trio | `/zorgaanbieders/`, `/gemeenten/`, `/regios/` | care SPA | network | active | A | Care shell + frame | `CareUnifiedHeader` | Directory cards, maps, reference panels | Primary explore / filter actions | Domain badges and availability chips | Balanced reference layout | Responsive cards and maps | None material; the trio shares one design language | Retain | small |
| Signalen | `/signalen/`, `/care/signalen/`, `/care/risks/` | care SPA | queue / signal list | active | A | Care shell + frame | `CareOperationalQueueHeader` | `CareWorkRow`, signal cards | Primary row CTA + filters | Risk / urgency badges | Compact signal density | Responsive list | None material | Retain | small |
| Support / evidence surfaces | `/rapportages/`, `/documenten/`, `/audittrail/`, `/intake/` | care SPA | exception / support | active | A | Care shell + frame | `CareUnifiedHeader` | `CareSection`, evidence cards, work rows | Primary action plus supporting links | Evidence / status chips | Tight but readable | Responsive sections | No major drift; these are the supporting surfaces | Retain | small |
| Users (admin-only inline) | `/gebruikers/` | care SPA | admin / internal | active | B | Care shell + frame | Inline heading block | Premium card placeholder | Primary action only | Minimal internal labels | Compact, single-purpose | Responsive panel | Intentional admin-only exception | Keep as internal-only exception | small |
| Profile / settings / system / admin | `/profile/`, `/settings/`, `/ops/system-state/`, `/admin/` | legacy utility | profile / settings / internal | active | D | `base.html` legacy shell or plain HTML | Legacy headings and page titles | `profile-*`, `settings-*`, raw HTML system table | `btn btn-primary`, `btn btn-secondary`, inline form buttons | `ds-*` badges, pills, and legacy labels | Less compact; larger gaps and hardcoded widths | Mixed responsive quality | Different shell and visual language from Care shell | Migrate to Care shell or retire if no longer product-critical | medium |
| Legacy `/care/` CRUD families | `/care/clients/*`, `/care/gemeenten/*`, `/care/configuraties/*`, `/care/documents/*`, `/care/deadlines/*`, `/care/budgets/*`, `/care/taken/*`, `/care/tasks/*`, `/care/notifications/*`, `/care/organizations/*` | legacy Django | CRUD / configuration | reachable in repo; shell-swallowed in practice | D | Legacy Django templates under `base.html` | `ds-list-header`, `ds-detail-header`, page titles | `ds-card`, `panel`, `card`, `stat`, hardcoded `bg-*` surfaces | `btn btn-primary`, `btn btn-secondary`, `btn btn-ghost` | `ds-badge`, `badge-*`, legacy chips | Often 1440px-centered, inconsistent padding | Mixed; some list pages compress better than others | Migrate cluster-by-cluster to Care primitives; do not restyle piecemeal | large |
| Legacy monitoring / search / workflow families | `/care/reports/`, `/care/coordination/provider-responses/`, `/care/regiekamer/provider-responses/`, `/care/search/`, `/care/wachttijden/*`, `/care/intakes/*`, `/care/matching/`, `/care/workflows/*`, `/care/plaatsingen/*`, `/care/signalen/*`, `/care/risks/*`, `/care/casussen/*`, `/care/beoordelingen/*` | legacy Django | dashboards / monitors / workflow CRUD | reachable in repo; shell-swallowed in practice | D | Legacy Django templates under `base.html` | `ds-analytics-*`, `mrd-*`, `page-wrap`, `queue-row` headers | `ds-analytics-shell`, `ds-analytics-kpi-card`, `queue-row`, `panel`, `ds-card` | `btn btn-primary`, `btn btn-secondary`, `btn btn-ghost` | Mixed badge families and action chips | Frequently wider and more decorative than Care SPA | Mixed; some surfaces are dense analytics dashboards, others are older CRUD forms | Migrate or retire in the same pass as the main `/care/` cluster | large |
| Legacy dashboard / demos / orphaned screens | `theme/templates/dashboard.html`, `theme/templates/contracts/matching_dashboard.html`, `theme/templates/contracts/provider_response_monitor.html`, `theme/templates/contracts/reports_dashboard.html`, `theme/templates/components_demo.html`, `client/src/components/care/AssessmentQueuePage.tsx`, `client/src/components/care/AssessmentDecisionPage.tsx`, `client/src/components/care/ProviderProfilePage.tsx`, `client/src/components/examples/*` | duplicate / demo / orphan | dashboard / profile / showcase | mostly unused or not route-mounted | E | Mixed: legacy HTML templates or standalone example shells | Mixed and one-off | Mixed custom panels, pills, demo cards, showcase-only layouts | Mixed / inconsistent | Mixed | Often visually interesting but not part of the product shell | Retire, consolidate, or hide behind explicit developer/demo entry points | medium |

## Largest Inconsistencies

1. The legacy `/care/` Django families still depend on `ds-*`, `btn-*`, `card`, and `panel` systems instead of the Care shell and primitives.
2. The shell chrome/sidebar was normalized in Wave 1, but the legacy utility shells and demo surfaces still differ.
3. `WorkloadPage` no longer carries the hardcoded 72rem overflow risk; the remaining inconsistency is in the older legacy route clusters.
4. `CaseExecutionPage` now follows the canonical workflow wording; the remaining drift is mainly in the older legacy Django families and orphan/demo screens.
5. The orphan / demo screens (`AssessmentDecisionPage`, `ProviderProfilePage`, `AssessmentQueuePage`, and `client/src/components/examples/*`) are not product screens and should be retired rather than normalized.

## Appendix A. Legacy Route Clusters

These are the route clusters that should be treated as legacy / migration or retirement candidates even if they still exist in the repository:

- `/care/clients/*`
- `/care/gemeenten/*`
- `/care/configuraties/*`
- `/care/documents/*`
- `/care/deadlines/*`, `/care/taken/*`, `/care/tasks/*`
- `/care/budgets/*`
- `/care/notifications/*`
- `/care/organizations/*`
- `/care/reports/`
- `/care/coordination/provider-responses/`
- `/care/regiekamer/provider-responses/`
- `/care/search/`
- `/care/wachttijden/*`
- `/care/intakes/*`
- `/care/matching/`
- `/care/workflows/*`
- `/care/plaatsingen/*`
- `/care/signalen/*`, `/care/risks/*`
- `/care/casussen/*`
- `/care/beoordelingen/*`
