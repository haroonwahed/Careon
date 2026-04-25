# QA Checklist

Date: 2026-04-25

## Smoke Test Checklist

| Role | URL / Page | Action | Expected result | Pass / Fail | Notes |
| --- | --- | --- | --- | --- | --- |
| Guest | `/` | Open the public landing page | Public landing loads without errors and exposes the login/register entry points |  |  |
| Guest | `/register/` | Load the registration form | Registration form fields are visible and the page is usable |  |  |
| Guest | `/register/` | Submit a valid unique account | Registration completes and the account is created or the session transitions to the authenticated flow |  |  |
| Guest | `/login/` | Load the login form | Login form is visible and ready for credentials |  |  |
| Gemeente | `/login/` | Sign in with a valid pilot user | User lands in the authenticated workspace |  |  |
| Gemeente | `/static/spa/?view=dashboard` | Open the dashboard entry route | Regiekamer dashboard loads |  |  |
| Gemeente | `/static/spa/?view=dashboard` -> Casussen | Open the case list | Case list loads and active casussen are visible |  |  |
| Gemeente | Casussen list | Search by case title or ID | Search narrows the list to the requested casus |  |  |
| Gemeente | Casus detail overlay | Open a casus | Casus detail loads and shows the decision engine panel |  |  |
| Gemeente | Casus detail overlay | Read the next-best-action panel | The backend decision engine is shown with blockers, risks, and blocked actions |  |  |
| Gemeente | Casus detail / matching | Start matching for a ready casus | Matching becomes reachable only after summary readiness |  |  |
| Gemeente | Casus detail / aanbieder beoordeling | Send to provider | Provider review becomes visible and the next owner is the aanbieder |  |  |
| Gemeente | Casus detail / plaatsing | Attempt placement before acceptance | Placement is blocked with an explanatory message |  |  |
| Zorgaanbieder | Casus detail / aanbieder beoordeling | Accept the casus | Acceptance is stored and placement becomes available |  |  |
| Zorgaanbieder | Casus detail / aanbieder beoordeling | Reject the casus with a reason | Rejection is stored with a required reason code |  |  |
| Gemeente | Casus detail / plaatsing | Confirm placement after acceptance | Placement completes successfully |  |  |
| Zorgaanbieder | Casus detail / intake | Start intake after placement | Intake starts successfully |  |  |
| Gemeente | Casus detail / archive | Archive a completed casus | Casus is archived, disappears from active lists, and remains read-only |  |  |
| Any logged-in user | Header / account menu | Log out | Session ends and the user returns to the public or login page |  |  |

## Phase 2 Pilot Smoke Proof

- [ ] `python3 manage.py check` passes
- [ ] Backend integration test proves case creation
- [ ] Backend integration test proves summary/assessment is reachable before matching
- [ ] Backend integration test proves matching assignment works
- [ ] Backend integration test proves provider acceptance path works
- [ ] Backend integration test proves provider rejection path requires a reason
- [ ] Backend integration test proves placement is blocked before acceptance
- [ ] Backend integration test proves placement succeeds after acceptance
- [ ] Backend integration test proves archived casussen are hidden from active lists
- [ ] Backend integration test proves archived workflow actions fail closed
- [ ] Playwright smoke confirms login, register, dashboard, list, detail, workflow gating, archive, and logout

## Manual Regression Checklist

- [ ] Case creation still produces a traceable case record
- [ ] Case summary or intelligence output appears before provider review
- [ ] Matching remains explainable and does not act like final assignment
- [ ] Aanbieder Beoordeling remains the substantive review step
- [ ] Placement cannot proceed for unreviewed or rejected requests
- [ ] Intake cannot begin before provider acceptance and placement
- [ ] Provider rejection reasons are saved structurally and rejections without a reason are blocked
- [ ] Casus archiving only applies to completed records and removes them from active lists
- [ ] Browser smoke harness is available and run before release
- [ ] Audit trail captures state-changing actions
- [ ] Notifications do not break authenticated navigation
- [ ] Search, filters, and bulk actions still preserve the selected organization
- [ ] Permissions fail closed for non-authorized users
- [ ] Session expiry sends the user back to login cleanly

## Role-Based Checklist

- [ ] Gemeente user can create and triage casussen
- [ ] Gemeente user can route matching and follow bottlenecks
- [ ] Zorgaanbieder user can review inbound cases
- [ ] Zorgaanbieder user can accept or reject with reason
- [ ] Admin user can inspect organization-wide views
- [ ] Admin user can manage invitations or membership changes if enabled

## Empty And Error State Checklist

- [ ] Empty case list explains what to do next
- [ ] Empty matching result explains why no providers are available
- [ ] Empty signals view explains whether there is no active issue or if data failed to load
- [ ] Loading states are obvious on long-running pages
- [ ] Error states are visible and actionable
- [ ] 401 and 403 behavior returns the user to login or an appropriate denial page

## Production Readiness Checklist

- [ ] `DATABASE_URL` points at PostgreSQL in production
- [ ] `ALLOWED_HOSTS` is populated correctly
- [ ] `CSRF_TRUSTED_ORIGINS` is set correctly
- [ ] `DJANGO_SECRET_KEY` is not the default insecure value
- [ ] `DEFAULT_FROM_EMAIL` is not a local placeholder
- [ ] Static assets build successfully
- [ ] Migrations apply cleanly
- [ ] Health check endpoint returns success
- [ ] Error pages are non-technical and safe
- [ ] Logging is adequate for support
- [ ] Backups and restore plan exist
- [ ] Smoke tests run before release
- [ ] Browser smoke tests run before release
- [ ] Mobile layout is checked before release
- [ ] Archive/demo docs are clearly labeled as historical

## Suggested Test Order

1. Public/auth smoke.
2. Case create -> summary -> matching -> provider review -> placement -> intake.
3. Organization/role isolation.
4. Search, documents, signals, and audit trail.
5. Reports and provider-facing screens.
6. Production configuration and build verification.
