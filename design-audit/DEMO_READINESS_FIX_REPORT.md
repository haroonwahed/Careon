# Demo Readiness Fix Report

## Summary
- Disabled normal demo exposure of Django debug behavior by defaulting `DEBUG` to off and adding branded 403/404/500 handlers.
- Hardened legacy and internal route surfaces so missing or unauthorized access now lands on safe Dutch error pages instead of raw debug output.
- Reworked the Matching page into an action-first workflow view with an operational attention strip and clearer next-best-action CTAs.
- Lightened the Nieuwe casus form with progressive disclosure, clearer helper text, and a stronger save flow.
- Standardized theme handling to persist across app shells and default to the polished light theme.
- Resolved the dashboard SPA asset 404s by rebuilding the SPA bundle, collecting static assets, and enabling WhiteNoise finder-based serving for the local demo runtime.

## Routes Fixed
- `/care/workflows/1/` now resolves to a safe branded 404 when no valid record is available.
- `/care/workflows/step/1/update/` now resolves to a safe branded 404 when no valid record is available.
- `/care/search/?q=test` now renders a product-safe empty search state in Dutch.
- Forbidden access pages now render the branded 403 state instead of raw text.
- Missing pages now render the branded 404 state instead of the Django debug page.
- Unhandled server errors now use the branded 500 template.
- `/dashboard/` now loads the SPA shell assets without 404s in the local demo runtime.

## Pages Redesigned
- Matching page:
  - Added an `Operatieve aandacht` section at the top.
  - Reworded the page toward action and validation instead of passive inspection.
  - Made the next-best-action CTA dominant on case/provider cards.
  - Kept filters available but visually secondary.
- Nieuwe casus page:
  - Reduced visual weight by collapsing advanced sections behind `<details>`.
  - Added stronger helper text for required fields.
  - Changed the main CTA to `Opslaan en naar samenvatting`.
  - Added a secondary `Concept bewaren` CTA.
- Search results:
  - Replaced bare fallback output with a Dutch empty-state card and safe navigation.
- Error states:
  - Added branded Dutch 403, 404, and 500 pages that do not reveal stack traces, route lists, or settings.

## Screenshots
Captured during browser smoke:
- [Dashboard fixed](/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots/dashboard-fixed.png)
- [Nieuwe casus](/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots/new-case.png)
- [Matching](/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots/matching.png)
- [Search empty](/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots/search-empty.png)
- [Workflow legacy 404](/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots/workflow-legacy-404.png)
- [Workflow step 404](/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots/workflow-step-404.png)
- [403 forbidden](/Users/haroonwahed/Documents/Projects/Careon/design-audit/screenshots/forbidden-403.png)

No before screenshots were captured in this workspace, so this audit is after-only.

## Tests Run
- `python3 manage.py check`
- `python3 manage.py collectstatic --noinput`
- `python3 manage.py test tests.test_public_auth_flow tests.test_spa_shell_middleware tests.test_ui_click_integrity -v 1`
- `python3 manage.py test tests.test_matching_operational_contract_regression tests.test_intake_assessment_matching_flow -v 1`
- `python3 manage.py test tests.test_ui_click_integrity -v 1`
- `curl -I` verification for `/static/spa/assets/index-C5j6imHB.js`, `/static/spa/assets/vendor-maps-D3lSGwsN.js`, `/static/spa/assets/index-RJ8nCWSL.css`, and `/static/spa/assets/vendor-maps-DNVN2dqC.css`
- `curl -I` verification for `/dashboard/`
- Playwright browser smoke against the local app for:
  - `/care/casussen/new/`
  - `/care/matching/`
  - `/care/search/?q=test`
  - `/care/workflows/1/`
  - `/care/workflows/step/1/update/`
  - `/care/organizations/activity/export/` as a non-owner user for the 403 state

## Files Changed
- [config/settings.py](/Users/haroonwahed/Documents/Projects/Careon/config/settings.py)
- [config/settings_production.py](/Users/haroonwahed/Documents/Projects/Careon/config/settings_production.py)
- [config/urls.py](/Users/haroonwahed/Documents/Projects/Careon/config/urls.py)
- [contracts/error_pages.py](/Users/haroonwahed/Documents/Projects/Careon/contracts/error_pages.py)
- [contracts/middleware.py](/Users/haroonwahed/Documents/Projects/Careon/contracts/middleware.py)
- [contracts/views.py](/Users/haroonwahed/Documents/Projects/Careon/contracts/views.py)
- [theme/templates/base.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/base.html)
- [theme/templates/base_fullscreen.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/base_fullscreen.html)
- [theme/templates/components/error_state.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/components/error_state.html)
- [theme/templates/403.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/403.html)
- [theme/templates/404.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/404.html)
- [theme/templates/500.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/500.html)
- [theme/templates/contracts/matching_dashboard.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/contracts/matching_dashboard.html)
- [theme/templates/contracts/search_results.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/contracts/search_results.html)
- [theme/templates/contracts/intake_form.html](/Users/haroonwahed/Documents/Projects/Careon/theme/templates/contracts/intake_form.html)
- [tests/test_ui_click_integrity.py](/Users/haroonwahed/Documents/Projects/Careon/tests/test_ui_click_integrity.py)

## Remaining Risks
- The dashboard shell still depends on the SPA bundle staying in sync with `theme/static/spa/` and the collected staticfiles output; a future frontend rebuild must be followed by `collectstatic` in this runtime.
- `Concept bewaren` is present as a secondary CTA on the Nieuwe casus form, but there is no separate draft-only backend flow added in this pass.
- I did not rewrite other SPA-only surfaces outside the requested scope.

## Known Limitations
- This audit was scoped to demo safety and the requested pages/routes, not a full app-wide redesign.
- The workspace already contained many unrelated modifications; I left those intact and only patched the requested surfaces.
- The browser smoke here used a local development server, not a production deployment stack.

## Root Cause
- `/dashboard/` rendered `theme/static/spa/index.html`, which referenced hashed SPA bundle files under `/static/spa/assets/`.
- The SPA bundle existed in `theme/static/spa`, but the local demo runtime was not serving those assets correctly until the static pipeline was rebuilt and WhiteNoise finder-based serving was enabled.
- Rebuilding the SPA with `npm run build` and running `collectstatic --noinput` synchronized the bundle output, and `WHITENOISE_USE_FINDERS=True` made the local runserver serve the app-directory static files reliably.
