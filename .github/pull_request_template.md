## Definition of Ready (DoR)

> Source: [`docs/engineering/CARELANE_ENGINEERING_STANDARDS.md`](../docs/engineering/CARELANE_ENGINEERING_STANDARDS.md) §1

- [ ] Problem and user/role are stated
- [ ] Affected **archetype** (frontend) or **layer** (backend) is identified
- [ ] Acceptance criteria defined; if UI: the three operational questions (what needs attention / why blocked / next action) are answered
- [ ] Workflow, tenant, and permission impact is named
- [ ] Test approach sketched
- [ ] Any **breaking contract change** (API key, URL, status semantics) flagged for product approval

---

## Summary

- What changed:
- Why:

## Risk and Scope

- Tenant isolation impact: `none | low | medium | high`
- RBAC/permissions impact: `none | low | medium | high`
- Migration impact: `none | backward-compatible | breaking`
- Data/privacy impact: `none | low | medium | high`

## Doctrine Compliance (Required For UI Changes)

- [ ] This change follows `docs/Carelane_Operational_Constitution_v2.md` (and `docs/Carelane_Operational_Constitution_v2.docx` where sign-off matters)
- [ ] Workflow, permissions, or API changes respect `docs/FOUNDATION_LOCK.md` and `contracts/workflow_state_machine.py`
- [ ] This change follows `docs/CARELANE_VISUAL_DOCTRINE.md`
- [ ] This change follows `docs/CARELANE_DOCTRINE_ENFORCEMENT_PHASE2.md`
- [ ] No new primitive was introduced without explicit approval
- [ ] No canonical primitive was bypassed with a local alternative
- [ ] No local spacing system was introduced
- [ ] No hardcoded semantic colors (`#hex`, `rgba(...)`) were introduced
- [ ] No competing primary actions were introduced in the same operational section
- [ ] This does not increase dashboard density/noise
- [ ] This does not reduce operational clarity (state/why/owner/next action)
- [ ] This does not introduce decorative/non-operational UI
- [ ] Institutional trust and calmness are preserved
- [ ] Realism is improved or unchanged

### Doctrine Scoring (0-5 each, required for UI PRs)

- Doctrine alignment:
- Realism:
- Operational clarity:
- Hierarchy discipline:
- Orchestration clarity:
- Trustworthiness:

### Violation Tagging (Required)

- [ ] `no violation`
- [ ] `P2 polish deviation`
- [ ] `P1 coherence drift`
- [ ] `P0 critical system violation` (must include mitigation plan)

If unresolved `P0` exists, this PR must not merge.

## Verification

- [ ] Onboarding path reviewed: `docs/START_HERE.md`
- [ ] If release-sensitive: pilot rehearsal / evidence expectations in `docs/PILOT_PROOF_PACKAGE.md`
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

## Definition of Done (DoD)

> Source: [`docs/engineering/CARELANE_ENGINEERING_STANDARDS.md`](../docs/engineering/CARELANE_ENGINEERING_STANDARDS.md) §2  
> Verify with: `make verify` (or `scripts/verify.sh`)

- [ ] `pytest tests/ -q` green; no regressions
- [ ] `tsc --noEmit` (frontend) + pyright (backend) clean
- [ ] Terminology guard + tenant-integrity audit pass
- [ ] No silent change to URLs, view names, context keys, or API response shapes
- [ ] Frontend: shared UI via barrel only; no new hex where a token exists
- [ ] If a shared component changed: [`docs/design/CARELANE_COMPONENT_REGISTER.md`](../docs/design/CARELANE_COMPONENT_REGISTER.md) updated in this PR
- [ ] Docs updated in this PR (ADR / roadmap / register / source-of-truth doc as applicable)
- [ ] For workflow-touching changes: `test_cross_tenant_isolation` + `test_workflow_foundation_lock` green

## Evidence

- Screenshots / logs / links:
