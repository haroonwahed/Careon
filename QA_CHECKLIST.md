# QA Checklist

Date: 2026-04-25

## Smoke Test Checklist

- [ ] Open the public landing page at `/`
- [ ] Log in successfully
- [ ] Confirm the dashboard entry route works
- [ ] Log out and return to the public landing page
- [ ] Open the main case list
- [ ] Verify archived cases are hidden from the default active case list
- [ ] Verify admin/internal users can reveal archived casussen with the archived filter
- [ ] Search for a case by ID and by client name
- [ ] Open a case detail page
- [ ] Confirm the case shows the next best action
- [ ] Start matching from a case that is ready for matching
- [ ] Review the top provider recommendations and explanation text
- [ ] Confirm provider acceptance / rejection actions are visible and gated correctly
- [ ] Confirm placement is blocked until provider acceptance is present
- [ ] Confirm intake cannot start before placement
- [ ] Open the signals page and confirm it shows actionable items
- [ ] Open documents and verify document detail/upload flows
- [ ] Open audit trail and confirm recent actions appear
- [ ] Open reports and verify the page is clearly labeled internal/internal-use only or backed by real data
- [ ] Switch organization / role context if available
- [ ] Verify the app remains usable at tablet width

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
- [ ] Manual browser smoke confirms dashboard, list, detail, placement, and logout still work

## Manual Regression Checklist

- [ ] Case creation still produces a traceable case record
- [ ] Case summary or intelligence output appears before provider review
- [ ] Matching remains explainable and does not act like final assignment
- [ ] Aanbieder Beoordeling remains the substantive review step
- [ ] Placement cannot proceed for unreviewed or rejected requests
- [ ] Intake cannot begin before provider acceptance and placement
- [ ] Provider rejection reasons are saved structurally and rejections without a reason are blocked
- [ ] Casus archiving only applies to completed records and removes them from active lists
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
