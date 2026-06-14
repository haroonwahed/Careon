# CareOn — Product & UX Audit

> Status: eerste audit, 2026-06-14. Bron: code-inspectie van `client/src` (`VERIFIED`) tenzij anders vermeld.
> Toetsingskader: **Product & Design Constitution v1.2** — 5 canonieke fasen, één dominante CTA per oppervlak, next-best-action, geen vage labels, hergebruik van goedgekeurde primitives, rustige operationele esthetiek.

---

## A. Route- / pagina-inventaris

Geen React Router; productie-shell is `components/examples/MultiTenantDemo.tsx` (`App.tsx:98`). Rol: G=gemeente, Z=zorgaanbieder, A=admin.

| Route | Component | Rol | Fase | Data |
|---|---|---|---|---|
| `/` | `public/PublicLandingPage` | anon | — | REAL (marketing) |
| `/login` `/register` `/logout` | redirect → Django auth | anon | — | REAL |
| `/dashboard` `/coordination` | `care/SystemAwarenessPage` (Regiekamer) | G/A | alle 5 | REAL |
| `/casussen` | `care/WorkloadPage` (Aanmeldingen) | G/A | Aanmelding | REAL |
| `/casussen/nieuw` | `care/NieuweCasusPage` | G/A/Z | Aanmelding | REAL |
| `/beoordelingen` | `care/AanbiederreactiePage` (Reacties) | G/A/Z | Aanbiederreactie | REAL |
| `/matching` | `MatchingQueuePage` / `MatchingPageWithMap` | G/A | Matching | REAL |
| `/plaatsingen` | `PlacementPage` / `PlacementTrackingPage` | G/A | Plaatsing | REAL |
| `/acties` | `care/ActiesPage` | G/A | cross | REAL |
| `/intake` | `care/IntakeListPage` | Z | Intake | REAL |
| `/mijn-casussen` | `care/WorkloadPage` | Z | Aanmelding | REAL |
| `/zorgaanbieders` `/gemeenten` `/regios` `/signalen` `/documenten` `/audittrail` `/instellingen` | resp. care-pagina's | G/A(/Z) | — | REAL |
| `/care/cases/<id>/` | `care/CaseExecutionPage` (overlay) | alle | alle | REAL |
| `/rapportages` | `care/RapportagesPage` | A | — | **MOCK** (statisch, `:42,72`) |
| `/gebruikers` | inline placeholder | A | — | **STUB** (`MultiTenantDemo.tsx:861`) |
| `/geen-toegang` | `care/AccessDeniedPage` | alle | — | REAL |

**Dood/legacy (0 live referenties, VERIFIED):** alle `components/examples/*`, `care/AssessmentQueuePage` (geïmporteerd, nooit gerenderd), `provider/ProviderIntakeDashboard`, `provider/ProviderKPIStrip`, en een complete ongerelateerde e-commerce codebase (`lib/{ordersData,stockData,listingsData,…}.ts` + `OrderRow/ProductTable/RevenueChart/KPICard/SalesChart`).

---

## B. Per-scherm bevindingen (operationele pagina's)

### Regiekamer — `care/SystemAwarenessPage.tsx`
- **Doel:** ✅ helder ("Stuur op doorstroom, blokkades en urgente casussen", `:1606`). Mag de volle 5-fasen tonen (Constitution §4.1).
- **Primaire gebruiker:** Gemeente/Admin.
- **Dominante actie:** 🔴 **Twee concurrerende dominante CTA's** — header-knop "Los blokkades op" (`:1616`, ruwe `<Button>`) én de amber dominant-card-CTA "Los kritieke blokkades op" (`:1633`), beide gekoppeld aan dezelfde `runModePrimary`-handler. Plus een derde secundaire knop. Schendt "ONE dominant CTA".
- **Next-best-action:** ✅ labels zijn imperatief en concreet ("Bekijk kritieke aanvragen", `coordinationNextBestAction.ts`).
- **Aanbeveling:** verwijder de header-CTA óf de card-CTA; gebruik `PrimaryActionButton`. **Beste eerste UX-slice na security/integriteit.**

### Aanmeldingen — `care/WorkloadPage.tsx`
- **Doel:** ✅ helder (`:424`).
- **Dominante actie:** 🟡 twee CTA's met *verschillende* intentie — "Nieuwe aanmelding" (navigatie) + "Maak casus compleet" (backlog-NBA). Acceptabel maar beide ruwe `<Button>` i.p.v. `PrimaryActionButton`.
- **Designschuld:** `operationalDesignLawsGuard` faalt — pagina gebruikt niet langer de verplichte `CareWorkRow` (working-tree-refactor). Ook gevlagd voor `min-w-[72rem]`-overflow.
- **Aanbeveling:** `CareWorkRow` herstellen, CTA's via primitives.

### Reacties / Aanbiederreactie — `care/AanbiederreactiePage.tsx`
- **Doel:** ✅ sterkste pagina. Eén `PrimaryActionButton` (`:469`), heldere titel + actiegerichte subtitel, correcte `CarePageScaffold`. **Geen bevindingen — referentiekwaliteit.**

### Matching — `care/MatchingPageWithMap.tsx`
- **Doel:** ✅ echte data. 🟡 veel scenario-controls in dropdown ("Vergroot zoekgebied", "Toon topaanbevelingen") + per-rij-acties → CTA-verdunning. Kaartcontext verzacht dit.
- **Aanbeveling:** één dominante "Stuur naar aanbieder"-actie laten domineren; scenario's als secundair.

### Plaatsingen — `care/PlacementPage.tsx`
- **Doel:** ✅ goed. Eén `PrimaryActionButton` gated op `providerAccepted && allValid` (`:291`) — **weerspiegelt backend-state correct**, dwingt niets af. Bevestigingsmodal. Geen bevindingen.

### Beoordeling/Samenvatting — `care/AssessmentDecisionPage.tsx`
- **Copy-risico:** 🟡 sectiekoppen "Samenvatting" (`:166,332`) en titel "Aanbieder beoordeling" (`:138,167`). "Samenvatting" als contentlabel is toegestaan; "beoordeling" als terminologie is doctrine-drift (zie C).

### Casusdetail — `care/CaseExecutionPage.tsx`
- 🟡 Gevlagd in `CAREON_SCREEN_UNIFORMITY_MATRIX` voor "legacy phase wording". **Hoogste prioriteit voor 5-fasen-uitlijning** (Roadmap P1-2).

---

## C. Copy- & terminologieproblemen (doctrine-drift)

De zichtbare workflow-labels verschillen tussen drie "gezaghebbende" bronnen (VERIFIED via docs-synthese):

| Stap | Doctrine (AGENTS.md / Constitution v2 / FOUNDATION_LOCK) | `terminology.ts` (verzonden UI) | v1.2 (bindend) |
|---|---|---|---|
| 2 | **Samenvatting** | "Zorgvraag" | géén primaire fase |
| 4 | **Gemeente Validatie** | "Gemeentelijke validatie" | géén primaire fase |
| 5 | **Aanbieder Beoordeling** | "Aanbieder reacties" | **Aanbiederreactie** |

- "Beoordeling" is een verboden primaire-fase-term in v1.2 maar leeft nog in `AssessmentDecisionPage`, `AudittrailPage:72,248`, `BoardView.tsx:32`, `phaseEngine.ts:244`.
- **Positief:** de nav zegt al correct "Reacties"/"Aanbiederreactie", en `decisionPhaseUi.ts` klapt niet-canonieke API-fasen samen tot de 5. Geen van de expliciet verboden vage labels ("Bekijk aandacht", "Analyseer proces", "Workflow optimaliseren", "Aandacht vereist") overleeft in live care-code (VERIFIED). Automatisering wordt correct als statustekst getoond ("wordt automatisch verwerkt"), niet als CTA.
- **Geen guard:** `scripts/terminology_guard.py` controleert alleen op verouderde contractbeheer-systeemlabels, niet op de NL-fase-canon.

---

## D. Designproblemen (primitives & visueel)

**Primitive-inventaris (8 goedgekeurd):** 7 bestaan, 1 ontbreekt.

| Primitive | Bestaat | Adoptie |
|---|---|---|
| CarePageScaffold | ✅ | Breed (~22 bestanden) |
| PageHeroHeader | ✅ (alias) | Laag (1 ref) |
| PrimaryActionButton | ✅ | Partieel (9 refs); Regiekamer & Workload omzeilen met ruwe `<Button>` |
| CareAlertCard | ✅ | Matig (8) |
| FlowPhaseBadge | ✅ (alias `CanonicalPhaseBadge`) | Laag (3) maar centraal |
| CareWorkRow | ✅ | Matig (11) |
| CareSection | ✅ | Breed (16) |
| **CareStatusBadge** | 🔴 **ONTBREEKT** | 0 — status verspreid over ≥5 one-offs (`CaseStatusBadge`, `UrgencyBadge`, `RiskBadge`, `CareMetaChip`, `CareDominantStatus`) |

**Design-token-tegenstrijdigheid (VERIFIED):** `client/src/design/tokens.ts` bevat **twee** palettes: het canonieke `visualContract` (`background #070B18`, `surface1 #0E1424`) én een parallel basispalet (`bg #0B1020`, `surface #151B2E`) dat niet matcht — terwijl `CAREON_UI_CONTRACT.md` zich het enige contract noemt.

---

## E. Functionele gaten

1. `RapportagesPage` toont **gefabriceerde** rapport/export-data met nepdatums in een verzonden pagina → geloofwaardigheidsrisico in pilot.
2. `/gebruikers` is een lege stub (gebruikersbeheer ontbreekt).
3. Documentupload werkt niet in de SPA-flow (alleen legacy HTML); download werkt niet in productie (R1).
4. Intake "plannen" heeft geen datum/afspraakvelden.

---

## F. Aanbevelingen (geprioriteerd, samengevat — detail in Roadmap)

1. **Regiekamer: één dominante CTA** — verwijder concurrent, gebruik `PrimaryActionButton`. (UX P1, beste eerste UX-slice)
2. **5-fasen-uitlijning** — `CaseExecutionPage` + doctrine-docs aanlijnen; "beoordeling" → "Aanbiederreactie"; gemeente-validatie als status, niet als fase.
3. **`CareStatusBadge` introduceren** en de ≥5 one-off badges consolideren.
4. **Tokens ontdubbelen** — verwijder het niet-canonieke basispalet uit `tokens.ts`.
5. **`RapportagesPage`** — koppel aan echte audit/export-API of markeer expliciet als "in ontwikkeling".
6. **Dode footprint opruimen** — verwijder e-commerce libs, `examples/*`, dode provider-dashboards (verlaagt bundel + ruis).
7. **`CareWorkRow`** herstellen in `WorkloadPage`; CTA's via primitives.
