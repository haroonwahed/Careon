# CareOn — standardization roadmap

**Status:** Proposed — **read-only**. No code, tests, workflows, or components changed. Implementation not started.
**Date:** 2026-06-17
**Scope:** Synthesizes the audit set into three sequenced workstreams + a first-phase top-10. Stays inside the Infrastructure Maturity Phase (no net-new features).
**Inputs:** [`../audits/CAREON_CURRENT_STATE_ASSESSMENT.md`](../audits/CAREON_CURRENT_STATE_ASSESSMENT.md), [`../architecture/CAREON_TARGET_ARCHITECTURE.md`](../architecture/CAREON_TARGET_ARCHITECTURE.md), [`../design/CAREON_PAGE_ARCHETYPES.md`](../design/CAREON_PAGE_ARCHETYPES.md), [`../design/CAREON_COMPONENT_REGISTER.md`](../design/CAREON_COMPONENT_REGISTER.md), [`../engineering/CAREON_ENGINEERING_STANDARDS.md`](../engineering/CAREON_ENGINEERING_STANDARDS.md), [`../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md`](../CAREON_BACKEND_QUALITY_AUDIT_2026Q2.md), and [`../adr/ADR-CONTRACTS-VIEWS-DECOMPOSITION.md`](../adr/ADR-CONTRACTS-VIEWS-DECOMPOSITION.md).

---

## 0. Shared enabler (must precede risky work in any workstream)

**WS0 — Reproducible verification.** Containerized dev/test env + branch-triggerable CI (Playwright + a11y + visual regression), and the guardrail tests (layer-direction, module-size, forbidden-import, token-check). *Rationale:* the assistant sandbox cannot run a trustworthy Python/Playwright baseline; CI-on-branch is the authoritative gate. Until WS0 lands, only pure-additive or doc work is "responsible."

---

## Workstream A — Backend architecture & workflow integrity

| Phase | Goal | Scope | Risk | Depends on | Deliverables | Exit criteria | Out of scope |
|---|---|---|---|---|---|---|---|
| A1 | Safety net | URL-contract test, layer-direction test, module-size ceiling test | Low | WS0 | 3 guardrail tests | All green on `main`; no source moved | Any view move |
| A2 | Package shell | `views.py` → `views/__init__.py` verbatim | Low–Med | A1 | Package + unchanged imports | URLs/imports/SPA shell resolve in CI | Logic change |
| A3 | Domain seam | Extract geo/matching/provider_profile/case_flow to `contracts/domain/`; repoint `api/matching.py` off `views` | Med | A2 | `domain/*` + unit tests | Inverted dependency gone; tenant+workflow suites green | Matching consolidation |
| A4 | Thin views | Carve low-risk (shell/ops/CRUD) then workflow-critical modules | Med | A3 | `contracts/views/*` package | Per-PR green; behaviour unchanged | Vestigial CBV removal |
| A5 | Matching consolidation | One canonical matching path (`MatchEngine` vs in-view) | Med | A4 | Single matching entry; deleted dup | Matching tests green on one path | Model split |
| A6 | Retire vestigial CBVs | Remove server CRUD shadowed by SPA (approval-gated) | Med | A4 + approval | Smaller views surface | Confirmed no consumer; routes/tests updated | `models.py` |
| A7 | `models.py` ADR | Plan migration-aware model split | High | A5 | ADR stub | ADR accepted | Execution |

## Workstream B — Frontend, component & design-system standardization

| Phase | Goal | Scope | Risk | Depends on | Deliverables | Exit criteria | Out of scope |
|---|---|---|---|---|---|---|---|
| B1 | Lock the register | Adopt component register as source of truth + forbidden-import lint + CI token check | Low | WS0 | Lint + register | Lint blocks Deprecated/Forbidden imports; token check gating | Mass refactor |
| B2 | Delete dead code | Remove 0-importer legacy (e-commerce components, orphan action panels, orphan `design/*`) | Low | B1 | Smaller tree | Build green; no import breaks | In-use components |
| B3 | Retire shadow systems | Remove/forbid `CareCommandPrimitives`; relocate `ProcessTimeline` into care primitives; quarantine `CasusControlCenter`/`CoordinationControlCenter` | Med | B2 | One worklist/queue system | No parallel system imported | New features |
| B4 | Collapse overlaps | One KPI/metric primitive; one page-shell; one detail-layout (resolve `CareSection` collision); one level-badge | Med | B3 | Consolidated primitives | Pages compile on canonical set | Visual redesign |
| B5 | Token hygiene | Refactor `LoginPage` onto tokens; promote SVG colors to named tokens | Low–Med | B1 | Token-clean offenders | Token check passes repo-wide | — |
| B6 | Relocate router | Move production router out of `components/examples/` (approval-gated, behaviour-neutral) | Med | B1 + approval | Honest entry point | Routes unchanged; e2e green | Router rewrite |

## Workstream C — Page archetypes & controlled migration

| Phase | Goal | Scope | Risk | Depends on | Deliverables | Exit criteria | Out of scope |
|---|---|---|---|---|---|---|---|
| C1 | Seal golden references | Finish `WorkloadPage` (A2) + `CaseExecutionPage` (A3) as references (token/responsive/3-question fixes) | Low–Med | B4 | 2 sealed references | References meet archetype spec; visual-reg baseline | Other pages |
| C2 | Migrate A2 pages | Signalen, Documenten, Acties, Audittrail, provider portal → `WorkloadPage` pattern | Med | C1 | A2 pages on canonical stack | Each matches reference; e2e+visual green | A3/A4 |
| C3 | Migrate A3 pages | Placement tracking, Provider profile, decompose `NieuweCasusPage` (2.3k LOC) → workspace + panels | Med–High | C1 | A3 pages on canonical layout | Each matches reference | A4 |
| C4 | A4/A5 + gaps | Matching/Aanbiederreacties polish; admin pages to A5; **decide Cliënten page**; **API contract decisions** (cases key, endpoint de-dup) | Med | C2/C3 + approval | Consistent A4/A5; resolved gaps | Approved + shipped or formally deferred | — |

---

## First-phase priorities (max 10)

1. **WS0 — containerized test env + `workflow_dispatch` CI** (Playwright/a11y/visual jobs). *Enabler for everything.*
2. **A1 — backend guardrail tests** (URL-contract, layer-direction, module-size). *Pure-additive safety net.*
3. **B1 — adopt component register + forbidden-import lint + CI token check.** *Stops the bleeding.*
4. **B2 — delete 0-importer dead code** (legacy e-commerce, 5 orphan action panels, orphan `design/*`). *Low-risk surface reduction.*
5. **A2 — `views.py` → package shell** (verbatim). *Reversible foundation for the keystone refactor.*
6. **A3 — extract domain seam + fix the `api/matching.py → views` inverted dependency.** *Highest architectural value.*
7. **B3 — retire the `CareCommandPrimitives` shadow system; relocate `ProcessTimeline`.** *Removes the biggest FE duplication.*
8. **C1 — seal `WorkloadPage` + `CaseExecutionPage` as golden references.** *Anchors page migration.*
9. **B5 — refactor `LoginPage` onto tokens.** *Closes the worst token-bypass.*
10. **Product-decision pass** on the breaking/ambiguous items (cases API key `contracts`→`cases`, `regiekamer`/`coordination` endpoint de-dup, retire vestigial CBVs, Cliënten page, router relocation). *Unblocks A6/B6/C4.*

**Sequencing note:** 1→2/3 are parallel-safe additive work; 4 before 5/6; 7 after 4; 8 after the FE consolidation reaches the references; 10 can run in parallel as a decision track (no code).

---

## Decisions requiring explicit product approval (gate these phases)

Carried from the target architecture; each blocks the listed phase until approved: cases API key rename (A6/C4), endpoint de-duplication (C4), vestigial CBV retirement (A6), first-class Cliënten page (C4), production-router relocation (B6). See [`../architecture/CAREON_TARGET_ARCHITECTURE.md`](../architecture/CAREON_TARGET_ARCHITECTURE.md) §6.

## Explicitly out of scope (this roadmap)

Net-new product features; `models.py` execution (ADR only, A7); visual redesign beyond token/structure standardization; replacing the hand-rolled router with react-router (relocation only); any change executed before WS0 provides reproducible verification.
