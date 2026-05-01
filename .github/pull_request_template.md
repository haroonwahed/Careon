## Summary

- What changed:
- Why:

## Risk and Scope

- Tenant isolation impact: `none | low | medium | high`
- RBAC/permissions impact: `none | low | medium | high`
- Migration impact: `none | backward-compatible | breaking`
- Data/privacy impact: `none | low | medium | high`

## Verification

- [ ] `python manage.py check`
- [ ] `python manage.py test tests.test_cross_tenant_isolation -v 1`
- [ ] `python manage.py audit_null_organizations`
- [ ] Manual smoke paths validated (if UI behavior changed)

## UI Responsibility Check

- [ ] This PR respects Screen Responsibility Rules
- [ ] No KPI strip added outside Regiekamer
- [ ] No casus list added to Casus Detail
- [ ] No next-best-action added outside Casus Detail
- [ ] No mixed UI modes on any screen
- [ ] No new hardcoded colors/spacing; tokens or Tailwind theme keys only
- [ ] Missing visual values were added to tokens (not inlined)

## UI MODE ENFORCEMENT (CRITICAL)

Every screen belongs to exactly ONE mode:

Regiekamer → awareness  
Casussen → triage  
Casus Detail → execution  

Violation examples:
- KPI strip inside casus detail
- Casus list inside casus detail
- Next-best-action inside Regiekamer

These are ALWAYS bugs.

If detected:
- remove immediately
- do not “adapt” or “restyle”

## Tests

- [ ] Relevant mode guard tests pass
- [ ] No regressions in `CaseWorkflowDetailPage`
- [ ] No regressions in `Regiekamer`
- [ ] No regressions in `Casussen`

## Release and Rollback

- Deploy steps:
- Rollback steps:
- Feature flag / kill switch (if any):

## Evidence

- Screenshots / logs / links:
