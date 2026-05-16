# Zorg OS v1.3 — strategic realignment evidence

> **Historical / non-guidance.** Evidence snapshot for the v1.3 realignment wave. Current doctrine: `docs/Careon_Operational_Constitution_v2.md` and `docs/FOUNDATION_LOCK.md`.

**Date:** 2026-05-11  
**Scope:** product philosophy, UX/navigation/copy, canonical documentation, guardrail tests.  
**Note:** Source files from `~/Downloads/CareOn_ZorgOS_v1_3_Updated_Documentation/` were **not present** on the build machine; canonical markdown was authored **into the repo** at the paths below.

---

## 1. Canonical documents (current)

| Path | Purpose |
|------|---------|
| `docs/Careon_Operational_Constitution_v2.docx` | Authoritative operational doctrine (Word master) |
| `docs/Careon_Operational_Constitution_v2.md` | Plain-text export (search, diffs, agents) |
| `docs/FOUNDATION_LOCK.md` | Persisted workflow states, API phases, endpoints, decision engine, UI density guardrails |
| `docs/CareOn_Business_OS_v1_3.md` | Positioning & commercial guardrails |

**Superseded markdown (content removed):** the former v1.3 trio at `docs/Zorg_OS_Product_System_Core_v1_3.md`, `docs/Zorg_OS_Technical_Foundation_v1_3.md`, and `docs/CareOn_Design_Constitution_v1_3.md` — **stub redirect pages** now live at those paths so external links keep working; canonical content is Constitution v2 + `FOUNDATION_LOCK.md`.

**Historical:** the table below recorded the v1.3 documentation pack (2026-05-11). It is retained for traceability only.

| Path (historical) | Purpose |
|------|---------|
| `docs/CareOn_Design_Constitution_v1_3.md` | Visual/density/NBA/terminology law |
| `docs/Zorg_OS_Product_System_Core_v1_3.md` | Product boundaries, actors, flow |
| `docs/Zorg_OS_Technical_Foundation_v1_3.md` | Backend truth, mapping, arrangement API staging |

**Legacy supersession**

- Product canon: **Operational Constitution v2** supersedes the v1.3 markdown trio above.  
- Implementation log for extended APIs: `docs/ZORG_OS_V1_2_EVIDENCE.md` (historical technical evidence).

---

## 2. Updated pages & surfaces (SPA)

| Area | Change |
|------|--------|
| `client/src/components/navigation/Sidebar.tsx` | Labels: Coördinatie, Aanvragen, Reacties; sections DOORSTROOM / CAPACITEIT; comments aanmelder-first. |
| `client/src/components/care/SystemAwarenessPage.tsx` | Page title **Coördinatie**; popover describes operational workspace; **worklist NBA labels** use `imperativeLabelForActionCode` (e.g. Vraag reactie aanbieder, Vul aanvraag aan) instead of legacy `Stuur naar aanbieder` / `Vul casus aan` overrides in `normalizeWorklistActionLabel`. |
| `client/src/components/care/WorkloadPage.tsx` | Title **Aanvragen**; loading/error copy. |
| `client/src/components/care/AanbiederBeoordelingPage.tsx` | Title **Reacties**; info popovers; attention bar CTA **Naar aanvragen**. |
| `client/src/lib/terminology.ts` | CARE_TERMS workflow + surfaces aligned to v1.3 language. |
| `client/src/lib/decisionPhaseUi.ts` | Phase labels + owners (Aanmelder vs Zorgaanbieder vs Gemeente where relevant). |
| `client/src/lib/nbaImperativeLabels.ts` | Lighter operational copy (avoid “casus” overload). |
| `client/src/lib/arrangementAlignmentContract.ts` | Contract for arrangement hints; optional `staging_deterministic` on API payloads. |
| `contracts/data/jeugdwet_jz21_productcodes.json` | Export van **Standaardproductcodelijst Jeugdwet (JZ21)** (iStandaarden xlsx feb 2025; ~450 productcodes). |
| `contracts/jeugdwet_jz21_lookup.py` | Lookup op officiële JZ21-productcode (exact + woordgrenzen; langste match). |
| `scripts/build_jeugdwet_jz21_productcodes_json.py` | Herbouw JSON van de officiële xlsx-URL. |
| `docs/ARRANGEMENT_OFFICIAL_SOURCES.md` | Bronnen + vernieuwingsinstructie. |
| `contracts/arrangement_alignment_catalog.py` | Aanvullende heuristiek na JZ21 (PGB/ZIN vóór ambulant). |
| `contracts/arrangement_alignment.py` + `GET .../arrangement-alignment/` | Eerst JZ21, dan heuristiek; zelfde VIEW-gate als decision evaluation. |
| `client/src/components/care/ArrangementAlignmentPanel.tsx` + `CaseExecutionPage.tsx` | **Uitstroom** banner when `ARCHIVED`; arrangement panel (gemeente/admin) loads alignment hints. |
| `docs/AANMELDER_WORKFLOWROLE_MAPPING.md` | Product **Aanmelder** vs technical `WorkflowRole` mapping. |

---

## 3. Terminology shifts (user-visible)

| Before (heavy / legacy) | After (v1.3) |
|-------------------------|--------------|
| Regiekamer (governance cockpit) | **Coördinatie** (operationele coördinatie-werkruimte) |
| Casussen (dossier list) | **Aanvragen** |
| Aanbieder beoordeling | **Reacties** |
| “Casus” in several NBA strings | **Aanvraag** / operational verbs |

**Preserved (API):** `phase` keys such as `gemeente_validatie`, `aanbieder_beoordeling` remain for compatibility (see `docs/FOUNDATION_LOCK.md`).

---

## 4. Workflows & state machines

- **No** change to `WorkflowState` enum values in this pass (avoids migration + client breakage).  
- **Product flow** documented in `FOUNDATION_LOCK.md` + `docs/Careon_Operational_Constitution_v2.md`; implementation mapping table added.  
- **Uitstroom** expressed as product language tied to completion + archive semantics.

---

## 5. Permissions & backend

- **No** change to `WorkflowRole` or mutation matrix in this pass.  
- Actor copy reframed to **Aanmelder** in UX; backend still enforces `gemeente` / `zorgaanbieder` / `admin`.

---

## 6. Removed / softened assumptions (UX/docs)

- “Municipality as omnipresent primary operator” in navigation comments and several headings.  
- “Regiekamer = control tower” phrasing in tests and info popover.  
- Guardrail that **banned** the words `uitstroom` / `anonimisatie` in all active sources (conflicted with v1.3 product language) — **replaced** with v1.3-aligned anchors.

---

## 7. Tests updated

- `tests/test_product_architecture_guardrails.py` — new canonical anchors in `FOUNDATION_LOCK.md`, `FEATURE_INVENTORY.md`, `PRODUCT_COMPLETENESS_ROADMAP.md`.  
- Client tests expecting headings **Regiekamer**, **Casussen**, **Aanbieder beoordeling** updated to new strings.  
- `tests/test_decision_engine.py` — `test_arrangement_alignment_api_is_read_only_advisory` for `GET .../arrangement-alignment/`.  
- `tests/test_arrangement_alignment_catalog.py` — catalog matching (PGB vóór ambulant, ZIN, trajectfunctie, …).  
- `tests/test_jeugdwet_jz21_lookup.py` — JZ21 JSON-lookup (exact + embedded code).  
- `client/src/components/care/ArrangementAlignmentPanel.test.tsx` — panel laadstatus, succes, fout, lege hints.

---

## 8. Routes (unchanged)

- `/regiekamer` (and dashboard entry) still route to the same React surface; only **labels** changed.  
- `/casussen`, `/beoordelingen` paths unchanged.

---

## 9. Screenshots

Not captured in this evidence run (headless). Recommend manual capture: Coördinatie, Aanvragen, Reacties, case execution after deploy.

---

## 10. Remaining inconsistencies & risks (mitigations shipped 2026-05-11)

| Item | Status |
|------|--------|
| `WorkflowRole.GEMEENTE` vs product **Aanmelder** | **Documented:** `docs/AANMELDER_WORKFLOWROLE_MAPPING.md` + link from `FOUNDATION_LOCK.md`. Optional `actor_profile` remains future work. |
| No persisted `UITSTROOM` enum | **Product mapping:** `ARCHIVED` documented as *uitstroom* in `FOUNDATION_LOCK.md`; **UI:** uitstroom banner on case detail when `current_state === ARCHIVED` (`CaseExecutionPage`). |
| Arrangement intelligence | **Mitigated:** `GET /care/api/cases/<id>/arrangement-alignment/` (read-only, deterministic staging) + `ArrangementAlignmentPanel` on case detail for gemeente/admin; contract in `client/src/lib/arrangementAlignmentContract.ts`. |
| Mixed English/Dutch in code comments | **Unchanged (low):** gradual cleanup when touching files. |
| Internal keys `regiekamer`, test ids `regiekamer-*` | **Deferred:** rename only in a dedicated refactor (high blast radius on e2e). |

---

## 11. Verification

- `uv run pytest` (full suite): **836 passed** (2026-05-11, includes JZ21 lookup + arrangement tests).  
- `npm test -- --run` (client Vitest): **171 passed** in 35 files (2026-05-11), including `ArrangementAlignmentPanel`.  
- `npm run build` (client) — run after related UI changes in this alignment pass.
