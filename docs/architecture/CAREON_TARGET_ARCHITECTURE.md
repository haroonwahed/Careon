# CareOn — target architecture

**Status:** Proposed — **read-only**. No production code changed.
**Date:** 2026-06-17
**Scope:** Consolidates the desired end-state across backend, frontend, and the SPA/Django boundary. Extends (does not duplicate) the backend detail in [`../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md`](../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md) and the `views.py` ADR.

---

## 1. Principles

1. **Backend is the source of truth** for state, permissions, and workflow gates (unchanged doctrine, `FOUNDATION_LOCK`, `AGENTS.md`).
2. **One-way layering.** Dependencies point downward only; no layer imports a layer above it.
3. **One canonical implementation per concept** — one matching path, one page-shell, one work-row, one KPI primitive, one action panel.
4. **The SPA is the product surface; Django serves data + shell + a small set of true server pages.** Vestigial server-rendered CRUD is retired, not maintained in parallel.
5. **Explainable, advisory intelligence only** (matching/arrangement stay advisory; no opaque ranking) — unchanged.

---

## 2. Backend target (summary; full detail in the backend audit)

```
HTTP        contracts/views/*   (thin; HTTP→response only)   ─┐
HTTP        contracts/api/*     (already modular)            ─┤ import ↓ only
Domain      contracts/domain/*  (matching, geo, scoring, case_flow; request-free, unit-tested)
Service     provider_matching_service, workflow_state_machine, decision_engine, governance
Data        contracts/models.py (+ future split), migrations
```

**Hard rule (guardrail-enforced):** `domain/*` and `api/*` must **never** import `views/*`. Today `contracts/api/matching.py` imports two helpers *from* `contracts.views` — the inverted dependency that the `views.py` decomposition must fix by moving those helpers into `domain/`. **One canonical matching path:** consolidate the in-view matching helpers with `provider_matching_service.MatchEngine`.

## 3. Frontend target

```
Pages            components/care/<Page>.tsx        (one archetype each; compose primitives only)
Routing/shell    SPA shell + role-aware router      (move out of components/examples/ into a real location)
Design system    components/care/CareDesignPrimitives.tsx  (barrel; the ONLY cross-page import path)
                 → CareUnifiedPage / CareAppFrame / CaseStatusBadge / CasusWorkspaceLayout
Base UI          components/ui/*                     (shadcn/Radix primitives)
Tokens           globals.css (--care-*)  ·  design/tokens.ts  ·  lib/operationalRhythm.ts
```

**Target rules:**
- Every page declares one of the five archetypes (see page-archetypes doc) and imports shared UI only through the `CareDesignPrimitives` barrel.
- **No parallel design systems.** `CareCommandPrimitives`, the five orphan action panels, the orphan `components/design/*`, and the dead e-commerce components are retired (see component register §4–5).
- **One implementation per concept:** collapse the 4–5 metric/KPI variants, the two page-shell concepts, the two detail-layout kits, and the three level-badges.
- **Tokens, not hex:** `LoginPage` is refactored onto `--care-*`; SVG visual colors promoted to named tokens.
- The production router is relocated out of `components/examples/MultiTenantDemo.tsx` to a non-misleading path (e.g. `components/app/AppShellRouter.tsx`) — behaviour-neutral move.

## 4. SPA ↔ Django boundary (target)

| Concern | Target owner |
|---|---|
| Authenticated app pages (Regiekamer, Casussen, Matching, Plaatsingen, Aanbieders, Documenten, Instellingen, admin) | **SPA**, via `/care/api/*` JSON |
| JSON data + mutations + workflow gates + audit | **Django API** (`contracts/api/*`) — source of truth |
| SPA shell, auth pages (`/login/`), `/profile/`, ops/health/build-info | **Django server-rendered** (small, deliberate set) |
| Legacy server-rendered CRUD CBVs (clients/documents/budgets/tasks/audit-log/gemeenten/regio's) that currently resolve to the SPA shell | **Retire** after confirming the SPA fully covers them; until then, mark vestigial and exclude from the views split's "active" surface |

**API contract hygiene (target):** stop leaking legacy terminology into payloads (the cases list key `contracts` → `cases`) and de-duplicate alias endpoints (`regiekamer` vs `coordination` decision-overview) — **both are breaking changes requiring an explicit product/versioning decision** (see §6).

## 5. Cross-cutting standards (target)

- **Layer-direction + module-size guardrail tests** (backend) and **forbidden-import lint** (frontend, blocking imports from Deprecated/Forbidden component files).
- **Reproducible verification:** containerized test env + branch-triggerable CI (Playwright + a11y + visual regression), per the backend audit §8. This is the precondition for safe refactors.
- **Design-token governance + component register** as the single source of truth for shared UI (engineering standards doc).

## 6. Decisions requiring explicit product approval

These change observable contracts and must not be done silently:

1. **Rename cases API key `contracts` → `cases`** (and related legacy symbol renames) — breaking API change; needs version/migration plan.
2. **De-duplicate `regiekamer`/`coordination` decision-overview endpoints** — confirm they are truly equivalent before collapsing.
3. **Retire vestigial server-rendered CRUD CBVs** — confirm no integration/bookmark depends on them.
4. **Introduce (or formally decline) a first-class Cliënten page** — currently a routed-but-missing surface.
5. **Relocate the production router** out of `components/examples/` — behaviour-neutral but touches the app entry point.

## 7. Relationship to other tracks

This target is realized by the three roadmap workstreams (backend/workflow integrity; frontend/component/design-system standardization; page archetypes & controlled migration) in [`../roadmap/CAREON_STANDARDIZATION_ROADMAP.md`](../roadmap/CAREON_STANDARDIZATION_ROADMAP.md). The `views.py` decomposition (its own ADR) is the keystone of the backend track; the component-register pruning is the keystone of the frontend track.
