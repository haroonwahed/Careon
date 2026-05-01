# Zorg OS / Careon Design & UX Audit

Captured on: 2026-04-30  
Scope: audit-only, no production behavior changes  
Method: local route discovery, authenticated live browser review, Playwright screenshot capture, and screenshot inspection

## Executive Summary

Zorg OS is structurally a workflow-first product, but the current implementation is not yet fully coherent across all reachable surfaces.

The strongest parts of the app are the operational care lists and monitors: `/dashboard/`, `/care/casussen/`, `/care/beoordelingen/`, `/care/plaatsingen/`, `/care/signalen/`, and `/care/clients/`. These pages clearly support next-action thinking and mostly preserve the canonical Dutch workflow.

The weakest parts are legacy/debug/duplicate surfaces that still leak into the product: `/settings/design-mode/` returns raw JSON, `/care/workflows/1/` and `/care/workflows/step/1/update/` are dead 404s, `/care/reports/` and `/care/workflows/` feel like passive reporting rather than action support, and `/care/search/` is visually broken in the captured state.

Overall verdict: **partially ready**. The core workflow is usable, but the app is not yet demo-safe across every reachable page. The main workflow pages are aligned; the legacy/debug/admin/reporting edges still need cleanup.

## Method

- Discovered routes from `config/urls.py`, `contracts/urls.py`, and related routing files.
- Logged in as `pilot.owner` on the local instance.
- Captured screenshots for every reachable page with Playwright.
- Stored screenshots under: `/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots`
- Saved the route/screenshot manifest at: `/Users/haroonwahed/Documents/Projects/Careon/design-audit/audit-manifest.json`
- Checked screenshots manually for layout, hierarchy, workflow clarity, consistency, and legacy bleed.

Notes:
- No production code was changed for this audit.
- No meaningful console errors appeared on the successfully loaded pages.
- Theme state is inconsistent across captures: the app can appear in light mode or dark mode depending on saved state. The dashboard-style screenshot the user shared earlier is the canonical visual reference; the captured audit set exposed the lighter rendering path.

## Route Inventory

Status legend:
- **Keep** = active and acceptable for the current product
- **Fix** = active but inconsistent, weak, or partially legacy
- **Legacy** = not suitable for production flow, should be removed or isolated
- **Remove** = dead route / should not remain reachable

### Public / Auth

| Route | Page | Template / Component | Role | Status |
|---|---|---|---|---|
| `/` | Home | Public landing template | Public | Keep |
| `/login/` | Login | Auth template | Public | Keep |
| `/register/` | Register | Auth template | Public | Keep |
| `/profile/` | Profile | Authenticated profile page | Authenticated | Keep |
| `/settings/` | Settings | Settings page | Authenticated | Keep |
| `/settings/design-mode/` | Design mode | Debug/settings endpoint | Authenticated | Legacy |

### Core Workflow

| Route | Page | Template / Component | Role | Status |
|---|---|---|---|---|
| `/dashboard/` | Regiekamer | Dashboard shell / operational overview | Gemeente / admin | Keep |
| `/care/casussen/` | Casussen / Werkvoorraad | Case list template | Gemeente | Keep |
| `/care/casussen/new/` | Nieuwe casus | Case intake form | Gemeente | Fix |
| `/care/casussen/<pk>/` | Casus detail | Case detail template | Gemeente / provider context | Fix |
| `/care/cases/<pk>/` | Case workspace alias | SPA shell alias | Authenticated | Fix |
| `/care/matching/` | Matching | Matching workspace | Gemeente | Keep |
| `/care/beoordelingen/` | Aanbieder Beoordeling | Provider decision list | Zorgaanbieder | Keep |
| `/care/beoordelingen/<pk>/` | Beoordeling detail | Provider decision detail | Zorgaanbieder | Fix |
| `/care/plaatsingen/` | Plaatsingen | Placement list | Gemeente / provider | Keep |
| `/care/plaatsingen/<pk>/` | Plaatsing detail | Placement detail | Gemeente / provider | Fix |
| `/care/intake-overdracht/` | Intake-overdracht | Handoff / intake-transfer list | Gemeente / provider | Fix |

### Network / Support / Admin

| Route | Page | Template / Component | Role | Status |
|---|---|---|---|---|
| `/care/clients/` | Zorgaanbieders | Provider list | Gemeente / admin | Keep |
| `/care/clients/<pk>/` | Provider detail | Provider detail page | Gemeente / admin | Keep |
| `/care/gemeenten/` | Gemeenten | Municipality list | Admin | Fix |
| `/care/regio's/` | Regio’s | Region list | Admin | Keep |
| `/care/documents/` | Documents | Document list | Admin / case support | Fix |
| `/care/documents/<pk>/` | Document detail | Document detail | Admin / case support | Fix |
| `/care/tasks/` | Takenbord | Task board | Authenticated | Keep |
| `/care/signalen/` | Signalen | Signals list | Regiekamer / admin | Keep |
| `/care/signalen/<pk>/` | Signaal detail | Signal detail | Regiekamer / admin | Keep |
| `/care/budgets/` | Budget & capaciteit | Budget list | Admin | Fix |
| `/care/budgets/<pk>/` | Budget detail | Budget detail | Admin | Fix |
| `/care/deadlines/` | Deadlines / taken | Deadline list | Authenticated | Fix |
| `/care/wachttijden/` | Wachttijden | Wait time monitor | Admin / regiekamer | Keep |
| `/care/audit-log/` | Audit log | Audit trail list | Admin | Keep |
| `/care/reports/` | Rapportages & Regie | Reporting surface | Admin / management | Legacy |
| `/care/regiekamer/provider-responses/` | Provider response monitor | Operational monitor | Gemeente / regiekamer | Keep |
| `/care/organizations/team/` | Organisatieteam | Org team admin | Admin | Fix |
| `/care/organizations/activity/` | Organisatieactiviteit | Org activity | Admin | Fix |
| `/care/search/?q=test` | Search | Global search | Authenticated | Fix |
| `/care/notifications/` | Meldingen | Notifications | Authenticated | Fix |
| `/care/workflows/` | Workflows / reporting | Legacy workflow/reporting surface | Admin / legacy | Legacy |
| `/care/workflows/1/` | Workflow detail | Dead route | N/A | Remove |
| `/care/workflows/step/1/update/` | Workflow step update | Dead route | N/A | Remove |
| `/care/does-not-exist/` | 404 | Intentional 404 | N/A | Keep (test only) |

## Screenshot Index

| Screenshot | Page | Route |
|---|---|---|
| `01-home.png` | Home | `/` |
| `02-login.png` | Login | `/login/` |
| `03-register.png` | Register | `/register/` |
| `04-dashboard.png` | Dashboard / Regiekamer | `/dashboard/` |
| `05-regiekamer.png` | Regiekamer | `/dashboard/` |
| `06-casussen-list.png` | Casussen / Werkvoorraad | `/care/casussen/` |
| `07-casussen-create.png` | Nieuwe casus | `/care/casussen/new/` |
| `08-casus-detail-84.png` | Casus detail | `/care/casussen/84/` |
| `09-case-workspace-98.png` | Case workspace | `/care/cases/98/?tab=matching` |
| `10-matching.png` | Matching | `/care/matching/` |
| `11-beoordelingen-list.png` | Beoordeling door aanbieder | `/care/beoordelingen/` |
| `12-beoordeling-detail-35.png` | Beoordeling detail | `/care/beoordelingen/35/` |
| `13-plaatsingen-list.png` | Plaatsingen | `/care/plaatsingen/` |
| `14-plaatsing-detail-21.png` | Plaatsing detail | `/care/plaatsingen/21/` |
| `15-intake-overdracht.png` | Intake-overdracht | `/care/intake-overdracht/` |
| `16-clients-list.png` | Zorgaanbieders | `/care/clients/` |
| `17-client-detail-16.png` | Provider detail | `/care/clients/16/` |
| `18-gemeenten-list.png` | Gemeenten | `/care/gemeenten/` |
| `19-regios-list.png` | Regio’s | `/care/regio%27s/` |
| `20-documents-list.png` | Documenten | `/care/documents/` |
| `21-document-detail-11.png` | Document detail | `/care/documents/11/` |
| `22-tasks-list.png` | Takenbord | `/care/tasks/` |
| `23-signals-list.png` | Signalen | `/care/signalen/` |
| `24-signal-detail-12.png` | Signaal detail | `/care/signalen/12/` |
| `25-budgets-list.png` | Budget & capaciteit | `/care/budgets/` |
| `26-budget-detail-1.png` | Budget detail | `/care/budgets/1/` |
| `27-deadlines-list.png` | Deadlines / taken | `/care/deadlines/` |
| `28-wachttijden-list.png` | Wachttijden | `/care/wachttijden/` |
| `29-audit-log.png` | Audit log | `/care/audit-log/` |
| `30-reports.png` | Rapportages & Regie | `/care/reports/` |
| `31-provider-responses.png` | Provider response monitor | `/care/regiekamer/provider-responses/` |
| `32-organization-team.png` | Organisatieteam | `/care/organizations/team/` |
| `33-organization-activity.png` | Organisatieactiviteit | `/care/organizations/activity/` |
| `34-profile.png` | Profiel | `/profile/` |
| `35-settings.png` | Instellingen | `/settings/` |
| `36-design-mode.png` | Design mode debug | `/settings/design-mode/` |
| `37-search.png` | Search | `/care/search/?q=test` |
| `38-notifications.png` | Meldingen | `/care/notifications/` |
| `39-workflows.png` | Workflows / reporting | `/care/workflows/` |
| `40-workflow-detail-1.png` | Dead route 404 | `/care/workflows/1/` |
| `41-workflow-step-update-1.png` | Dead route 404 | `/care/workflows/step/1/update/` |
| `42-404.png` | Intentional 404 | `/care/does-not-exist/` |

## Page-by-Page Analysis

Abbreviations:
- **VH** = Visual hierarchy
- **LC** = Layout consistency
- **WC** = Workflow clarity
- **NBA** = Next-best-action clarity
- **NL** = Dutch terminology quality

### Public / Auth

| Page | Route | Screenshot | Scores (VH/LC/WC/NBA/NL) | Analysis |
|---|---|---|---|---|
| Home | `/` | `01-home.png` | `8/8/7/7/9` | First impression: credible, simple landing; issues: still fairly conventional; works well: clear product positioning and brand tone; inconsistent: not yet as operational as the app shell; flow: partial because it is pre-login; recommendation: keep concise and action-led. |
| Login | `/login/` | `02-login.png` | `8/8/8/8/10` | First impression: clean and low-friction; issues: minimal; works well: direct authentication path; inconsistent: visually calmer than some admin surfaces; flow: supports entry point only; recommendation: keep. |
| Register | `/register/` | `03-register.png` | `7/8/8/8/10` | First impression: straightforward but a little form-heavy; issues: generic account-creation feel; works well: clear submission path; inconsistent: less polished than dashboard shell; flow: supports onboarding only; recommendation: keep but tighten copy. |

### Core Workflow

| Page | Route | Screenshot | Scores (VH/LC/WC/NBA/NL) | Analysis |
|---|---|---|---|---|
| Dashboard / Regiekamer | `/dashboard/` | `04-dashboard.png`, `05-regiekamer.png` | `9/9/10/10/9` | First impression: strongest page in the app; issues: can become dense; works well: operational summary, alerts, and visible next action; inconsistent: if theme state flips, the same shell can read differently; flow: fully supports regiekamer intervention; recommendation: keep as source-of-truth shell. |
| Casussen / Werkvoorraad | `/care/casussen/` | `06-casussen-list.png` | `9/9/10/10/9` | First impression: strong operational list, closest to the canonical design; issues: a few rows remain text-dense; works well: search, tabs, “Vraagt aandacht” queue; inconsistent: earlier legacy table/card shells still exist in code history; flow: fully supports case triage; recommendation: keep and ensure all related list pages match this style. |
| Nieuwe casus | `/care/casussen/new/` | `07-casussen-create.png` | `7/8/9/8/10` | First impression: structured and usable; issues: long, form-heavy, more explanation than necessary; works well: stepwise intake structure; inconsistent: feels more like a wizard than the list-first shell; flow: supports case creation; recommendation: reduce copy density and keep next action obvious. |
| Casus detail | `/care/casussen/84/` | `08-casus-detail-84.png` | `7/8/10/9/10` | First impression: a real case workspace, but still a bit text-dense; issues: many sections compete for attention; works well: header, next step, workflow context; inconsistent: still more sectioned than the list pages; flow: strongly supports canonical flow; recommendation: continue compacting while keeping the same shell. |
| Case workspace | `/care/cases/98/?tab=matching` | `09-case-workspace-98.png` | `8/8/10/9/10` | First impression: strongest decision workspace; issues: dense and chip-heavy; works well: summary strip, process timeline, right-hand context rail; inconsistent: a bit more “workspace” than the row-first list pages; flow: excellent canonical support; recommendation: keep this as the case decision hub. |
| Matching | `/care/matching/` | `10-matching.png` | `8/8/10/9/9` | First impression: good operational matching page; issues: the lower area can still feel oversized, especially when empty/partial; works well: provider focus, filters, capacity/fit visibility; inconsistent: map/context surfaces vary more than the rest of the shell; flow: supports advisory matching; recommendation: keep row/list orientation and avoid dashboard-like blocks. |
| Beoordeling door aanbieder list | `/care/beoordelingen/` | `11-beoordelingen-list.png` | `8/8/10/9/10` | First impression: clear and operational; issues: a bit table-heavy, slightly repetitive; works well: provider decision queue; inconsistent: can still feel like a list admin view; flow: supports provider review; recommendation: keep the queue style but reduce text duplication. |
| Beoordeling detail | `/care/beoordelingen/35/` | `12-beoordeling-detail-35.png` | `7/8/10/9/10` | First impression: useful, but dense; issues: still too many blocks/labels competing; works well: decision context and CTA hierarchy; inconsistent: more panel-based than the list page; flow: supports provider-level beoordeling; recommendation: retain action-first layout, reduce nested chrome. |
| Plaatsingen list | `/care/plaatsingen/` | `13-plaatsingen-list.png` | `8/8/9/9/10` | First impression: usable operational list; issues: table-like feel remains; works well: clear state and action column; inconsistent: slightly more administrative than the casus list; flow: supports placement tracking; recommendation: keep compact and aligned with the Werkvoorraad style. |
| Plaatsing detail | `/care/plaatsingen/21/` | `14-plaatsing-detail-21.png` | `7/8/9/8/10` | First impression: functional but not elegant; issues: too much explanatory text, some redundant boxes; works well: shows handoff state; inconsistent: still closer to an admin form than a decision workspace; flow: supports placement gating; recommendation: reduce density and keep the next action prominent. |
| Intake-overdracht | `/care/intake-overdracht/` | `15-intake-overdracht.png` | `6/7/8/7/10` | First impression: feels duplicated and generic; issues: resembles placement more than a distinct intake-transfer workflow; works well: basic list/action structure; inconsistent: weak differentiation from placement; flow: partially supports the canonical flow but is not very clear; recommendation: clarify purpose or merge with placement/handoff. |

### Network / Support / Admin

| Page | Route | Screenshot | Scores (VH/LC/WC/NBA/NL) | Analysis |
|---|---|---|---|---|
| Zorgaanbieders list | `/care/clients/` | `16-clients-list.png` | `8/9/9/9/10` | First impression: one of the strongest network pages; issues: slightly busy, but manageable; works well: provider capacity/status signals and search/filtering; inconsistent: some row badges still feel legacy; flow: supports provider discovery; recommendation: keep. |
| Provider detail | `/care/clients/16/` | `17-client-detail-16.png` | `7/8/8/8/10` | First impression: helpful detail page; issues: right-side context can feel crowded; works well: provider profile, signals, and edit actions; inconsistent: more box-like than the list page; flow: supports provider admin; recommendation: keep, but simplify chrome. |
| Gemeenten list | `/care/gemeenten/` | `18-gemeenten-list.png` | `6/8/7/7/10` | First impression: too much explanatory copy at the top; issues: reads like a summary report rather than an operational page; works well: table underneath is serviceable; inconsistent: passive heading blocks; flow: only partially supports operational use; recommendation: compress intro copy and emphasize action. |
| Regio’s list | `/care/regio%27s/` | `19-regios-list.png` | `7/8/8/8/10` | First impression: okay, but plain; issues: not especially distinctive; works well: clear list semantics; inconsistent: less polished than the core workflow pages; flow: supports region admin; recommendation: keep and align spacing/typography with core shell. |
| Documents list | `/care/documents/` | `20-documents-list.png` | `6/7/7/7/9` | First impression: useful but noisy; issues: table-heavy, repeated action buttons, too much operational clutter; works well: file list is clear; inconsistent: still feels like admin/document management rather than workflow support; flow: partial; recommendation: collapse repeated actions and simplify copy. |
| Document detail | `/care/documents/11/` | `21-document-detail-11.png` | `7/8/8/8/9` | First impression: functional detail view; issues: can become text-heavy; works well: clear document context and case linkage; inconsistent: still more utility-like than workflow-first; flow: supports traceability; recommendation: reduce verbose helper blocks. |
| Takenbord | `/care/tasks/` | `22-tasks-list.png` | `7/8/8/8/10` | First impression: understandable board/list hybrid; issues: some passive empty/summary areas; works well: task grouping and ownership; inconsistent: a little generic compared with the core case shell; flow: supports operational follow-up; recommendation: keep concise. |
| Signalen list | `/care/signalen/` | `23-signals-list.png` | `8/8/9/8/10` | First impression: strong intervention list; issues: some row text is still dense; works well: signals are actionable and tied to case state; inconsistent: a bit more table-like than the dashboard; flow: strongly supports regiekamer intervention; recommendation: keep. |
| Signaal detail | `/care/signalen/12/` | `24-signal-detail-12.png` | `7/8/8/8/10` | First impression: clear but not exciting; issues: detail text still heavy; works well: traceability and case linkage; inconsistent: admin-like rather than operational; flow: supports investigation; recommendation: tighten copy. |
| Budget list | `/care/budgets/` | `25-budgets-list.png` | `6/8/7/7/10` | First impression: admin-centric; issues: feels like finance tooling, not care allocation; works well: data is present; inconsistent: weak tie to the case-first workflow; flow: partial; recommendation: de-emphasize passive reporting. |
| Budget detail | `/care/budgets/1/` | `26-budget-detail-1.png` | `6/8/7/7/10` | First impression: dense, utilitarian; issues: too many detail sections for the value delivered; works well: traceable budget record; inconsistent: looks like back-office software; flow: minimal; recommendation: simplify and narrow to only decision-relevant fields. |
| Deadlines list | `/care/deadlines/` | `27-deadlines-list.png` | `6/8/7/7/10` | First impression: generic utility page; issues: little sense of next action; works well: deadline data is visible; inconsistent: not strongly tied to the canonical flow; flow: partial; recommendation: add stronger ownership/action labeling. |
| Wachttijden list | `/care/wachttijden/` | `28-wachttijden-list.png` | `7/8/8/8/10` | First impression: operational and readable; issues: data-dense, but acceptable; works well: wait-time monitoring is clearly relevant; inconsistent: slightly dashboard-like; flow: supports triage; recommendation: keep. |
| Audit log | `/care/audit-log/` | `29-audit-log.png` | `7/8/7/7/9` | First impression: traceable, but passive; issues: dense and more forensic than operational; works well: event history is understandable; inconsistent: looks like a compliance screen; flow: supports auditability but not next action; recommendation: keep but don’t overuse it as a main nav destination. |
| Reports | `/care/reports/` | `30-reports.png` | `4/6/5/4/9` | First impression: weakest official page; issues: summary blocks, passive reporting, too much explanatory text, looks like a dashboard/reporting tool rather than Zorg OS; works well: basic info is present; inconsistent: most divergent from the canonical workflow; flow: poor; recommendation: redesign or demote heavily. |
| Provider response monitor | `/care/regiekamer/provider-responses/` | `31-provider-responses.png` | `8/8/9/8/10` | First impression: good operational monitor; issues: can become slightly dense; works well: alerts, queue state, and ownership are visible; inconsistent: still a monitor, not a case page; flow: strong support for intervention; recommendation: keep. |
| Organisatieteam | `/care/organizations/team/` | `32-organization-team.png` | `6/8/7/7/10` | First impression: functional admin page; issues: reads as tooling, not workflow; works well: invite/history/admin controls; inconsistent: boxy admin style; flow: only indirectly supports the product; recommendation: keep but separate clearly from daily workflow. |
| Organisatieactiviteit | `/care/organizations/activity/` | `33-organization-activity.png` | `4/7/5/4/9` | First impression: mostly empty and passive; issues: weak value, lots of whitespace; works well: activity trail exists; inconsistent: not actionable; flow: low; recommendation: either tighten meaning or reduce prominence. |
| Profiel | `/profile/` | `34-profile.png` | `6/8/7/7/10` | First impression: basic settings/profile form; issues: plain and utilitarian; works well: understandable account settings; inconsistent: not aligned with the strongest app pages; flow: support page only; recommendation: keep minimal. |
| Instellingen | `/settings/` | `35-settings.png` | `6/8/7/7/10` | First impression: standard settings page; issues: a bit plain; works well: predictable control points; inconsistent: not workflow-centric; flow: support page only; recommendation: keep minimal and consistent. |

### Legacy / Debug / Problem Pages

| Page | Route | Screenshot | Scores (VH/LC/WC/NBA/NL) | Analysis |
|---|---|---|---|---|
| Design mode | `/settings/design-mode/` | `36-design-mode.png` | `1/1/1/1/10` | First impression: raw JSON/debug response; issues: completely unacceptable as a user-facing page; works well: none in production context; inconsistent: total break from product UI; flow: none; recommendation: remove or strictly gate behind dev-only access. |
| Search | `/care/search/?q=test` | `37-search.png` | `2/6/3/3/9` | First impression: visually broken / awkward in the capture; issues: huge blank area and oversized graphic, not aligned with the rest of the app; works well: search intent is clear; inconsistent: the strongest outlier in the active UI; flow: partial; recommendation: redesign or hide until it matches the core shell. |
| Notifications | `/care/notifications/` | `38-notifications.png` | `5/8/5/5/10` | First impression: empty-state page; issues: no meaningful notification content in the captured state; works well: simple and understandable; inconsistent: too passive for a control system; flow: weak; recommendation: add real actionable notifications or reduce prominence. |
| Workflows | `/care/workflows/` | `39-workflows.png` | `4/6/5/4/9` | First impression: looks like reporting/legacy rather than workflow control; issues: duplicate shell behavior and weak distinction; works well: some high-level information exists; inconsistent: overlaps with `/care/reports/`; flow: low; recommendation: consolidate or remove. |
| Workflow detail 1 | `/care/workflows/1/` | `40-workflow-detail-1.png` | `0/0/0/0/0` | First impression: 404; issues: dead route; works well: nothing; inconsistent: should not be reachable; flow: none; recommendation: remove or redirect. |
| Workflow step update 1 | `/care/workflows/step/1/update/` | `41-workflow-step-update-1.png` | `0/0/0/0/0` | First impression: 404; issues: dead route; works well: nothing; inconsistent: should not exist in the product surface; flow: none; recommendation: remove or redirect. |
| Intentional 404 | `/care/does-not-exist/` | `42-404.png` | `0/0/0/0/0` | First impression: expected not-found page; issues: none, if used only for testing; works well: confirms error handling; inconsistent: only as a test route; flow: none; recommendation: keep only as a test artifact, not a nav target. |

## Top 10 Design Issues

1. `/settings/design-mode/` returns raw JSON and is not a valid product page.
2. `/care/workflows/1/` is a dead 404 route.
3. `/care/workflows/step/1/update/` is a dead 404 route.
4. `/care/search/?q=test` is visually broken relative to the rest of the app.
5. `/care/reports/` reads like passive reporting, not workflow support.
6. `/care/workflows/` duplicates reporting/legacy behavior and adds confusion.
7. `/care/gemeenten/` uses too much explanatory copy at the top.
8. `/care/documents/` is noisy and repetitive.
9. `/care/organization/activity/` is too empty/passive to feel productized.
10. Theme state is inconsistent between captures; the same app can appear to be two different products depending on saved theme.

## Top 10 Workflow / UX Issues

1. Some pages still look like reporting/admin surfaces rather than next-action workspaces.
2. The legacy `/care/workflows/` family conflicts with the canonical case flow.
3. Search does not currently feel like a first-class workflow aid.
4. The intake-overdracht page is not clearly differentiated from placement.
5. The new-casus form is still quite dense and needs stronger guidance.
6. The case detail and case workspace remain text-heavy in places.
7. Documents and audit pages support traceability but not quick action.
8. Notifications are empty/weak in the captured state, so they do not yet support proactive operations well.
9. Several admin/support pages do not clearly answer “what should I do next?”
10. The app still mixes polished workflow pages with legacy/debug/reporting surfaces, which weakens confidence for municipality/provider demos.

## Quick Wins

- Remove or hide `/settings/design-mode/` from any production navigation.
- Redirect or delete `/care/workflows/1/` and `/care/workflows/step/1/update/`.
- Collapse verbose intro copy on `/care/gemeenten/`.
- Simplify `/care/reports/` or move it out of primary navigation.
- Tame `/care/documents/` repeated actions.
- Make `/care/search/` visually consistent with the rest of the shell.
- Add meaningful empty-state actions for `/care/notifications/` and `/care/organization/activity/`.

## Larger Redesign Recommendations

- Consolidate all workflow-facing pages around one canonical operational shell so reporting/admin pages stop feeling like a separate product.
- Reduce legacy dashboard/reporting patterns across support pages and keep only the actions that matter to the canonical flow.
- Unify the visual grammar of list pages, detail pages, and monitors so there is no ambiguity between “work queue” and “report”.
- Make search, documents, notifications, and audit log more clearly connected to the case and regiekamer flow.
- Decide whether `/care/workflows/` is a productized surface or a leftover compatibility route; it currently reads as legacy.

## Components That Should Be Unified or Extracted

- Sidebar
- Top bar / global header
- Search/filter bar
- Operational list row
- Status chip / badge
- Next-best-action strip
- Case header
- Process timeline / step rail
- Attention / blocker rows
- Empty state block
- Table/list shell
- Right-side context rail
- Audit/event row
- Action button hierarchy

## Final Verdict

**Partially ready**

Reason:
- The core workflow pages are usable and mostly coherent.
- The app still contains legacy/debug/reporting routes that are not acceptable for a clean pilot demo.
- The search page, reports surface, and design-mode route are the clearest signs that the codebase still mixes two product eras.

## Deliverables

- Reviewed routes: all route entries listed in the route inventory above, including dead/debug routes.
- Screenshot folder path: `/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots`
- Report file path: `/Users/haroonwahed/Documents/Projects/Careon/design-audit/DESIGN_AUDIT_REPORT.md`
- Failed routes:
  - `/care/workflows/1/`
  - `/care/workflows/step/1/update/`
  - `/care/does-not-exist/` (intentional 404 for verification)
- Blockers encountered:
  - `/settings/design-mode/` returns raw JSON instead of a UI page.
  - Theme state is inconsistent between captures.
  - The browser screenshot API timed out, so Playwright headless capture was required.
  - No provider-role test user existed locally, so provider-role pages were reviewed from the available authenticated account and route structure.

