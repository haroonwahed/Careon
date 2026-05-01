# Careon / Zorg OS — design system audit

**Datum:** 2026-04-30  
**Canon:** **`/regiekamer`** (SPA: `SystemAwarenessPage`) — operationele helderheid, aandachtslaag, `CarePageTemplate` + `CareUnifiedHeader` + `CareSearchFiltersBar` + compacte rijen.  
**Secundair:** **`/casussen`** (`WorkloadPage`) — werkvoorraad, filters, `CareWorkRow`.  
**Fase-voorbeeld:** **`/matching`** (`MatchingQueuePage`) — geen globale design-waarheid boven Regiekamer/Casussen.

**Productprincipe:** Zorg OS is een **beslissysteem**; elke pagina moet naar de **volgende best actie** leiden (bestaande data, geen decoratie).

---

## 1. Audited routes (authenticated SPA shell)

Paden komen overeen met `MultiTenantDemo` + `Sidebar` (gemeente-context), tenzij anders vermeld.

| Route / pagina | Component | `CarePageTemplate` | `CareWorkRow` / lijst | `CareSearchFiltersBar` | Opmerking |
|----------------|-----------|--------------------|------------------------|-------------------------|------------|
| `/regiekamer` | `SystemAwarenessPage` | Ja | Ja (`CareWorkRow`) | Ja | Canon; metric strip `data-testid="metric-strip"`. |
| `/casussen` | `WorkloadPage` | Ja | Ja | Ja | Sibling van Regiekamer. |
| `/matching` | `MatchingQueuePage` | Ja | Ja | Ja | Fase-specifiek; zelfde shell. |
| `/plaatsingen` | `PlacementTrackingPage` | Ja | Ja | Ja | Tabs via `CareFilterTabGroup`. |
| `/beoordelingen` (Wacht op aanbieder) | `AanbiederBeoordelingPage` | Ja | Ja | Ja | Gemeente + aanbieder layouts. |
| `/acties` | `ActiesPage` | Ja | Ja | Ja | Snelfilters waren `premium-card`; **deze pass** token-cards + `CareEmptyState`. |
| `/signalen` | `SignalenPage` | Ja | Nee (eigen signal-kaarten) | Ja | Lijstpatroon afwijkend van `CareWorkRow` — **follow-up** (major). |
| `/zorgaanbieders` | `ZorgaanbiedersPage` | **Nee** | **Nee** | **Nee** (`Input` + custom) | Kaart/kaart-layout, veel `premium-card` — **major** inconsistentie. |
| `/regios` | `RegiosPage` | **Nee** | **Nee** | Alleen `CareSearchFiltersBar` | Mix custom headers + `premium-card` — **major**. |
| `/gemeenten` | `GemeentenPage` | Gedeeltelijk | Variabel | Ja | Controleren op volledige `CarePageTemplate`-pariteit — **minor/major** afhankelijk van scherm. |
| `/documenten` | `DocumentenPage` | **Nee** | **Nee** | Ja | Supporting surface; `premium-card` in content — **minor**. |
| `/audittrail` | `AudittrailPage` | **Nee** | **Nee** | Ja | **Minor**. |
| `/rapportages` | `RapportagesPage` | **Nee** | **Nee** | **Nee** | `DEMO_ONLY` + `premium-card` — verwacht lichter; **minor** (oppervlak gemarkeerd in nav). |
| Casus workspace / detail | `CaseExecutionPage` | Layout via `CasusWorkspaceLayout` | NBA + timeline | N.v.t. | Bewust ander patroon (dossier); **acceptabel** mits tokens/hiërarchie kloppen. |
| Matching detail | `MatchingPageWithMap` | Deels | `premium-card` panels | N.v.t. | **Major** visuele drift t.o.v. lijst-shell — follow-up migratie naar gedeelde card tokens. |
| Nieuwe casus / intake | `NieuweCasusPage`, `IntakeListPage` | `IntakeListPage`: ja | Gemengd | Ja | `IntakeListPage` gebruikt nog `premium-card` op rijen — **minor**. |
| Instellingen | `InstellingenPage` | Legacy-achtig | — | — | **Minor** (niet-kern workflow). |

**Django HTML-dashboard** (`theme/templates/dashboard.html`): apart kanaal t.o.v. SPA; niet in scope van deze SPA-audit.

---

## 2. Design system rules — bevindingen

### 2.1 Layout / shell (**major** waar `CarePageTemplate` ontbreekt)

- **Consistent:** Regiekamer, Casussen, Matching, Plaatsingen, Acties (na deze pass), Signalen (shell), Workload, veel beslisstromen.
- **Inconsistent:** `ZorgaanbiedersPage`, `RegiosPage`, delen van document/audit/rapportages — eigen grids en `premium-card`.

### 2.2 Page headers (**minor–major**)

- `CareUnifiedHeader` + subtitle + optionele metric: aanwezig op canonische care-pagina’s.
- Zorgaanbieders/Regios: custom titels; geen gedeelde header-component.

### 2.3 Aandacht / beslisslaag (**major** op signalen-lijst)

- Regiekamer: `CareAttentionBar`, metric strip, NBA in rij-CTA.
- Signalen: wel operationele content, maar **niet** dezelfde `CareWorkRow`-rij — herschikking naar gedeelde rij zou grote refactor zijn (documented follow-up).

### 2.4 Zoek- en filterbalk (**minor**)

- `CareSearchFiltersBar` deelt hoogte, border, “Meer filters”-patroon op meeste workflow-pagina’s.
- Zorgaanbieders: eigen `Input` + panel — afwijkend.

### 2.5 Werkrijen (**major** waar geen `CareWorkRow`)

- Matching/Regiekamer/Casussen/Acties/Plaatsingen/Aanbieder: gedeeld rooster.
- Signalen, Zorgaanbieders, Regios: eigen rij/kaartpatronen.

### 2.6 Status chips (**minor**)

- Dominante status veelal via `CareDominantStatus` + `CareMetaChip`.
- Losse `text-*-500` in o.a. `DocumentenPage` type-config — geleidelijk naar tokens/chips trekken.

### 2.7 CTA’s (**minor**)

- `CareWorkRow`: één primaire ghost-CTA rechts; rij-click vs CTA met propagation guard.
- Sommige pagina’s (signalen) hebben meerdere acties per item — productkeuze, niet in deze pass gewijzigd.

### 2.8 Navigatie (**opgelost eerder; zie ACTIES-audit**)

- Acties-badge gelijkgetrokken met open CareTasks (`MultiTenantDemo` + `countOpenCareTasks`).

### 2.9 Dark theme (**minor**)

- `premium-card` vs `border-border/70 bg-card/75`: visuele drift; migratie naar één oppervlak-token-set aanbevolen.

### 2.10 Legacy UI (**major** concentraties)

- **`premium-card`** nog wijdverspreid: `MatchingPageWithMap`, `PlacementPage`, `ProviderProfilePage`, `RapportagesPage`, `NieuweCasusPage`, enz.
- **Follow-up:** page-by-page vervanging door `CarePageTemplate` + token-consistente secties waar geen dossier-specifiek layout nodig is.

---

## 3. Severity-samenvatting

| Severity | Voorbeeld | Actie deze pass |
|----------|-----------|-----------------|
| **Critical** | Geen blocker gevonden dat auth care-route volledige legacy Django-template rendert i.p.v. SPA (dashboard → SPA shell). | — |
| **Major** | Zorgaanbieders/Regios buiten `CarePageTemplate`; Signalen-lijst ≠ `CareWorkRow`; Matching detail `premium-card`. | **Documenteren** + kleine Acties-alignment. |
| **Minor** | Documenten/Audit/Instellingen/rapportages; losse kleuren op chips. | Documenteren. |

---

## 4. Implemented in this pass

| Wijziging | Reden |
|-----------|--------|
| `ActiesPage`: snelfilter-knoppen van `premium-card` → `rounded-xl border border-border/70 bg-card/75` + focus ring (zelfde taal als `CareWorkRow`-oppervlakken). | Zichtbare divergentie t.o.v. Regiekamer/Casussen tokens. |
| `ActiesPage`: fout- en lege staat via `CareEmptyState` (zelfde patroon als Matching/Plaatsingen). | Lege/fout-states unificeren. |
| `care-visual-regression.spec.ts`: test “Design system: unified shell…” + Acties empty selector op tekst. | Regressie op headers + search placeholders + metric strip. |
| Ongebruikt type `ActionType` verwijderd uit `ActiesPage`. | Opruimen. |

**Niet gewijzigd (bewust):** workflow-logica, API’s, backend, `MatchingPageWithMap`/`ZorgaanbiedersPage`/`RegiosPage` (te groot / onduidelijk risico zonder UX-review).

---

## 5. Aanbevolen follow-ups (prioriteit)

1. **`ZorgaanbiedersPage` + `RegiosPage`:** inkapselen in `CarePageTemplate` + `CareUnifiedHeader`; filters naar `CareSearchFiltersBar`; kaarten naar gedeelde “surface” utility of dunne wrapper-component.  
2. **`SignalenPage`:** overweeg `CareWorkRow` of een dunne `CareSignalRow` met dezelfde grid als `CareWorkRow` (functioneel gelijk, visueel sibling).  
3. **`MatchingPageWithMap` / `PlacementPage`:** verminder `premium-card`; gebruik zelfde border/bg als `CareUnifiedPage`.  
4. **Chip- en status-tokenmatrix:** één mappingbestand (urgent, blokkade, wacht, …) i.p.v. losse `text-*` in document-views.  
5. **TopBar `notificationCount={7}`:** demo-constant; vervangen door echte telling of verwijderen om verwarring te voorkomen.

---

## 6. Tests & checks uitgevoerd

| Commando | Resultaat |
|----------|-----------|
| `cd client && npx vitest run src/components/care/CareUnifiedPage.test.tsx` | OK |
| `cd client && npx vitest run src/lib/actiesTaskSemantics.test.ts` | OK |
| `cd client && E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-visual-regression.spec.ts` | **9 passed** (Vite op :3000) |
| `python3 manage.py check` | **Niet uitgevoerd** (geen Django in sandbox-omgeving) — lokaal in venv draaien. |

---

## 7. Gewijzigde bestanden (deze audit-pass)

- `client/src/components/care/ActiesPage.tsx`  
- `client/tests/e2e/care-visual-regression.spec.ts`  
- `design-audit/DESIGN_SYSTEM_AUDIT.md` (dit bestand)

---

## 8. Risico’s

- **Visuele regressie** op Acties-snelfilters: kleur/selected state iets subtieler dan harde `border-2 border-red-500` — functioneel hetzelfde.  
- **E2E placeholders** kunnen breken bij copy-wijzigingen; bewust strak gekozen regexes.

---

## 9. Acceptantiecriteria — status

| Criterium | Status |
|-----------|--------|
| Regiekamer = canonische taal | **Ja** (referentie; geen wijziging nodig). |
| Casussen & Matching voelen als siblings | **Grotendeels ja** (reeds gemigreerd). |
| Grote care-workflow-pagina’s delen shell/rij/filters | **Grotendeels ja**; uitzonderingen Zorgaanbieders/Regios/Signalen-rij. |
| Geen “kapotte” legacy auth-route in SPA-shell | **Geen critical** bevinding in code-review. |
| Volgende best actie duidelijk | **Per pagina variabel**; NBA waar `CareWorkRow` + `CaseExecutionPage` — verbeter follow-ups. |
| Tests groen | **Ja** (frontend scope); Django-check **documented skip**. |

**Eindoordeel:** Design system is **deels enforced** op kern-workflow; **major drift** blijft op netwerk/overzicht-pagina’s en matching-detail. Deze pass verkleint drift op **Acties** en voegt **E2E shell-regressie** toe.
