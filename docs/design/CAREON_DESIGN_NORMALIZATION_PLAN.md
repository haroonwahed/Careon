# CareOn Design Normalization Plan

This plan converts the uniformity audit into an implementation order.  
No product behavior, routes, permissions, workflow rules, or backend logic should change unless a separate workflow/architecture task explicitly authorizes it.

## Canonical Rules To Preserve

### Canonical shell

- `CareAppFrame` is the page content frame for authenticated surfaces.
- `TopBar` is the top chrome.
- `Sidebar` is the left shell rail.
- Content width should stay bound by `tokens.layout.pageMaxWidth` and the Care rhythm tokens, not page-local widths.

### Canonical header

- `CareUnifiedHeader` is the default page header pattern.
- It should remain compact, rounded, and shared across the modern shell.
- Use the header `metric` slot for a single status chip row when needed.

### Canonical spacing

- Page stack rhythm: `CARE_RHYTHM.page` / `pageMobile`.
- Section rhythm: `CARE_RHYTHM.section` / `sectionMobile`.
- Quiet separation: `CARE_RHYTHM.quiet`.
- Control groups: `CARE_RHYTHM.control`.
- Queue headers and rows should stay on the operational rhythm values, not ad hoc `space-y-*` stacks.

### Canonical surface hierarchy

- Background foundation: `tokens.visualContract.background`.
- Primary surface: `tokens.visualContract.surface1`.
- Elevated surface: `tokens.visualContract.surface2`.
- Borders: `tokens.visualContract.border`.
- Radius: `cardRadius = 24px`, `sectionCardRadius = 22px`.

### Canonical button hierarchy

- One dominant CTA per surface.
- Primary CTA: `tokens.visualContract.primaryCta` via `PrimaryActionButton`.
- Warning / attention CTA: `tokens.visualContract.warningCta`.
- Secondary CTA: outline / ghost only when the action is supporting, not competing.

### Canonical status / badge rules

- `CareMetricBadge` for status chips in headers.
- `CareMetaChip` for compact metadata.
- `CareDominantStatus` for queue status labels.
- `CanonicalPhaseBadge` for decision/workflow phase chips.
- Keep badges compact, semantically named, and non-neon.

## P0. Trust, Accessibility, or Major Interaction Inconsistency

Wave 1 status: items 1-3 below were implemented and verified in the authenticated shell.

1. **Normalize the shell chrome / sidebar**  
   - Why: the sidebar was visually louder than the rest of the Care shell and read like a separate product system.
   - Files: `client/src/components/navigation/Sidebar.tsx`, `client/src/components/navigation/TopBar.tsx`.
   - Result: reduced glow and branded ornamentation, kept the same rail geometry, and aligned active states with the rest of the shell.
   - Risk if ignored: the shell keeps feeling split between “product” and “marketing chrome”.

2. **Fix `WorkloadPage` horizontal overflow risk**  
   - Why: the `min-w-[72rem]` queue grid was wider than the rest of the shell and was the most obvious source of zoom / laptop overflow.
   - Files: `client/src/components/care/WorkloadPage.tsx`, `client/src/components/care/CareUnifiedPage.tsx`.
   - Result: moved the page to the canonical operational queue geometry (`CareOperationalQueueHeader` / `CareWorkRow`) and removed fixed wide assumptions.
   - Risk if ignored: the page will continue to clip or require horizontal scrolling on smaller laptops and browser zoom.

3. **Bring `CaseExecutionPage` back onto the canonical workflow language**  
   - Why: it mixed modern care primitives with custom timeline panels and legacy phase wording.
   - Files: `client/src/components/care/CaseExecutionPage.tsx`, `client/src/components/care/CaseExecutionWorkspaceSections.tsx`, `client/src/lib/decisionPhaseUi.ts`.
   - Result: aligned visible labels and section order with the canonical flow contract, and reused shared section surfaces instead of bespoke one-off blocks.
   - Risk if ignored: the most important detail page keeps teaching a slightly different workflow than the rest of the product.

## P1. Active Product Screens Outside the Care System

1. **Normalize the active queue screens that still rely on custom page-local styling**  
   - Target files: `client/src/components/care/AanbiederreactiePage.tsx`, `client/src/components/care/MatchingQueuePage.tsx`, `client/src/components/care/PlacementTrackingPage.tsx`, `client/src/components/care/SignalenPage.tsx`.
   - Fix: prefer `CarePageScaffold`, `CareOperationalQueueHeader`, `CareWorkRow`, `CareWorkspaceSection`, and approved alert surfaces over locally invented row systems.
   - Risk if ignored: queue screens stay visually close in intent but not in execution, which weakens the operational rhythm.

2. **Bring the active reference / network pages into the same tonal family**  
   - Target files: `client/src/components/care/ZorgaanbiedersPage.tsx`, `client/src/components/care/GemeentenPage.tsx`, `client/src/components/care/RegiosPage.tsx`.
   - Fix: keep them compact, use the shared header and surface rules, and avoid unique badge or card variants.
   - Risk if ignored: directory pages will keep feeling like separate reference tools rather than one Care platform.

3. **Keep the active support / evidence pages visually quieter**  
   - Target files: `client/src/components/care/RapportagesPage.tsx`, `client/src/components/care/DocumentenPage.tsx`, `client/src/components/care/AudittrailPage.tsx`, `client/src/components/care/IntakeListPage.tsx`.
   - Fix: keep them on the exception / support archetype with one dominant CTA and one attention surface max.
   - Risk if ignored: support pages start drifting toward dashboards with excessive density.

4. **Ensure the admin-only shell content stays clearly internal**  
   - Target file: `client/src/components/examples/MultiTenantDemo.tsx` for the `gebruikers` inline surface.
   - Fix: keep the admin surface visually quieter than the product pages and avoid introducing a new chrome style.
   - Risk if ignored: internal admin content can become visually indistinguishable from end-user flows.

## P2. Legacy Migration and Duplicate Component Systems

1. **Retire or migrate the legacy `/care/` Django clusters**  
   - Cluster files: `contracts/urls.py`, `contracts/views.py`, `theme/templates/contracts/*.html`.
   - Fix: move the surviving functionality to the Care shell and remove the old `ds-*` / `btn-*` surface families once parity exists.
   - Risk if ignored: the repo will keep shipping two product languages at once.

2. **Merge the legacy account / utility surfaces into the Care shell or retire them**  
   - Files: `theme/templates/profile.html`, `theme/templates/settings_hub.html`, `theme/templates/ops/system_state.html`, `theme/templates/base.html`.
   - Fix: either replatform them onto the Care primitives or explicitly mark them as admin / support utilities that are not part of the main product shell.
   - Risk if ignored: account and utility pages remain visibly behind the rest of the product.

3. **Remove dead or duplicate product templates**  
   - Files: `theme/templates/dashboard.html`, `theme/templates/contracts/matching_dashboard.html`, `theme/templates/contracts/provider_response_monitor.html`, `theme/templates/contracts/reports_dashboard.html`.
   - Fix: delete or keep only as test fixtures if they are not route targets anymore.
   - Risk if ignored: route drift and stale screenshots keep coming back.

4. **Retire example and showcase screens that are not route-mounted**  
   - Files: `client/src/components/examples/*`, `client/src/components/care/AssessmentQueuePage.tsx`, `client/src/components/care/AssessmentDecisionPage.tsx`, `client/src/components/care/ProviderProfilePage.tsx`.
   - Fix: keep them only if they are referenced in demos or tests; otherwise move them out of the product surface area.
   - Risk if ignored: new contributors will keep treating demo artifacts as product screens.

## P3. Minor Visual Polish

1. Tighten spacing on the still-active SPA directory / support pages.
2. Keep badges compact and semantically named.
3. Avoid custom colors for state when the shared status chips already communicate it.
4. Preserve the calm dark foundation; do not add extra glows, gradients, or layered borders unless a surface is intentionally elevated.

## Suggested Execution Order

1. Shell chrome / sidebar
2. Workload overflow and queue geometry
3. Case execution canonical-flow alignment
4. Active queue / support page standardization
5. Legacy utility pages
6. Legacy `/care/` migration or retirement
7. Demo / showcase cleanup
