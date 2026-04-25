# Implementation Backlog

Aanbieder Beoordeling date: 2026-04-23

This backlog is ordered for launch readiness. The first chunk is the one I am implementing now.

## Chunk 1: Stop The SPA Shell From Overriding Canonical Routes

Goal:
- Keep the redesign shell available when explicitly enabled.
- Let canonical server-rendered `/care/*` routes render normally by default.

Status:
- Completed on 2026-04-24.

Files:
- `contracts/middleware.py`
- `config/settings.py`
- `tests/test_dashboard_shell.py`
- `tests/test_redesign_layout.py`
- `tests/test_redesign_components.py`

Tasks:
- Gate the SPA shell migration middleware behind the redesign feature flag.
- Keep the `X-Careon-Ui-Surface` marker for redesign mode.
- Ensure default requests hit the underlying Django views again.
- Re-run the shell, dashboard, and redesign tests.

## Chunk 2: Harden Tenant Isolation

Goal:
- Make every list/detail/update route return the correct object or a 404/403 for another organization.

Files:
- `contracts/tenancy.py`
- `contracts/views.py`
- `contracts/permissions.py`
- `contracts/models.py`
- `tests/test_cross_tenant_isolation.py`
- `tests/test_role_permission_alignment.py`

Tasks:
- Add a shared scoped lookup helper for org-aware detail/update routes.
- Normalize list/detail/update scoping for direct org FK models and relation-scoped models.
- Enforce consistent 404/403 behavior on cross-org access.

Status:
- Completed on 2026-04-24.

## Chunk 3: Reconnect Workflow Route Contracts

Goal:
- Restore route names and page behavior expected by the workflow tests.

Files:
- `contracts/urls.py`
- `contracts/views.py`
- `contracts/api/views.py`
- `tests/test_intake_assessment_matching_flow.py`
- `tests/test_matching_recommendations.py`

Tasks:
- Restore missing or renamed workflow endpoints.
- Keep redirect aliases aligned with canonical names.
- Make matching, aanbieder beoordeling, and placement actions resolve consistently.

Status:
- Completed on 2026-04-24.
- The redesign shell is now route-scoped and org-aware.
- Workflow API compatibility shims are live for aanbieder beoordeling, matching, placement, and intake creation.
- The canonical guided intake form now renders again on `case_create`.

## Chunk 4: Integrate Decision Logging

Goal:
- Ensure operational decision events are logged during live workflow actions.

Files:
- `contracts/governance.py`
- `contracts/operational_decision_contract.py`
- `contracts/views.py`
- `tests/test_governance_audit.py`

Tasks:
- Emit match recommendation logs reliably.
- Keep audit trails append-only and org-scoped.
- Verify decision fields are consumed in the live pages.

Status:
- Completed on 2026-04-24.
- Matching, provider response, and placement approval actions now write decision-log entries.
- The placement approval path now contributes to the replayable case timeline.

## Chunk 5: Polish Operational Surfaces

Goal:
- Make the regiekamer, provider-response monitor, and placement list read like one coherent Dutch workflow product.

Files:
- `contracts/views.py`
- `theme/templates/contracts/provider_response_monitor.html`
- `theme/templates/contracts/placement_list.html`
- `tests/test_regiekamer_provider_response_monitor.py`
- `tests/test_placements_operational_contract_regression.py`

Tasks:
- Normalize Dutch-first labels on operational queue pages.
- Surface the shared decision contract explicitly in placement lists.
- Keep escalation and impact summaries visible only when relevant.
- Preserve safe fallbacks for missing provider data.

Status:
- Completed on 2026-04-24.
- Provider-response monitor labels are now Dutch-first.
- Placement rows now show the shared next-best-action, impact summary, stall reason, and escalation text safely.

## Chunk 6: Re-run Release Checks

Files:
- `docs/RELEASE_ROLLOUT_CHECKLIST.md`
- `docs/ROLLBACK_RUNBOOK.md`
- `docs/DRILL_LOG.md`

Tasks:
- Re-run targeted tests.
- Validate staging deployment steps.
- Record remaining gaps before production.

Status:
- Completed on 2026-04-24.
- `python manage.py check` passed.
- `python scripts/terminology_guard.py` passed.
- Targeted regression suites for tenant isolation, dashboard shell, workflow flow, regiekamer monitor, and placement regression passed.
