# Frontend UI mode audit (workflow-first)

**Rules source:** `AGENTS.md` (“UI MODE ENFORCEMENT”) + `FOUNDATION_LOCK.md` (“UI density & token guardrails”).

## Intended placement

| Pattern | Allowed routes / surfaces |
|---------|----------------------------|
| **Metric / KPI strip** (`CareKPICard`, `OperationalSignalStrip`, Regiekamer metrics) | **Operationele coördinatie** — primary: `/regiekamer` (`SystemAwarenessPage` via shell). |
| **Worklist** | **Aanvragen-werkvoorraad** — e.g. `/casussen`, matching queue patterns that are list-first. |
| **`NextBestAction` + `ProcessTimeline` design components** | **Aanvraag detail / execution** only (`CaseExecutionPage` — verified: only consumer of `NextBestAction` / `ProcessTimeline` imports in `client/src`). |

## Audit results (static, repo scan)

| Finding | Severity | Notes |
|---------|----------|-------|
| `NextBestAction` / `ProcessTimeline` | **OK** | Only `CaseExecutionPage.tsx` imports design `NextBestAction` / `ProcessTimeline`. Enforced by `tests/test_product_architecture_guardrails.py`. |
| `MetricStrip` design primitive | **N/A** | Defined in `client/src/components/design/MetricStrip.tsx`; **no route imports** — operational metrics use `CareKPICard` / scaffolds instead. |
| `ProviderKPIStrip` in `ProviderIntakeDashboard` | **OK (quarantined)** | `ProviderIntakeDashboard` is **`DEMO_ONLY`** and **not** imported from `MultiTenantDemo` / live shell (`FEATURE_INVENTORY.md`). No Regiekamer `MetricStrip` leakage from this file. |
| `ActiesPage`, `MatchingQueuePage` use `CareKPICard` | **OK** | Routed as gemeente **coordination / queue** surfaces only (`currentPage === "acties"` → `ActiesPage`; `matching` → `MatchingPageWrapper` → `MatchingQueuePage` in `MultiTenantDemo.tsx`). Casus execution (design NBA / timeline) remains on `CaseExecutionPage` when `selectedCase` is set. |
| `CasusControlCenter` (legacy layout) | **Low** | `QUARANTINED_LEGACY` in `FEATURE_INVENTORY.md` — not linked from the SPA route tree; alternate layout with `DecisionStrip` / `PhaseBar` retained for reference only. |

## Verified 2026-05-14 — active zorgaanbieder shell (`MultiTenantDemo.tsx`)

Live provider pages (no `ProviderIntakeDashboard`): **`intake`** → `IntakeListPage`; **`mijn-casussen`** → `WorkloadPage` (worklist); **`nieuwe-casus`** → `NieuweCasusPage`; **`beoordelingen`** → `AanbiederBeoordelingPage` (`CarePageScaffold` archetype `worklist`, compact **`CareMetricBadge`** in the metric slot — not the Regiekamer KPI grid); **`documenten`** → `DocumentenPage`. Matches **scan-first worklist** + **no casus-detail NBA** on these list routes.

## Next actions (engineering)

1. Before adding screens: grep for `CareKPICard`, `NextBestAction`, `ProcessTimeline` and assert route matches table above.
2. Prefer **one dominant CTA** per region (`Careon_Operational_Constitution_v2.md` §9.2).
3. **Import boundary:** `tests/test_product_architecture_guardrails.py` fails if design `NextBestAction` / `ProcessTimeline` are imported outside `CaseExecutionPage.tsx`.
