# Acties functionaliteit — audit & herstel

**Datum:** 2026-04-30  
**Context:** Op `/dashboard/` (SPA-shell) toonde de zijbalk **Acties (18)** terwijl de Acties-pagina **0 te laat / 0 vandaag / 0 binnenkort** en *Geen openstaande acties* toonde.

---

## 1. Databronnen (voor fix)

| Oppervlak | Bron | Endpoint / logica |
|-----------|------|-------------------|
| **Zijbalk badge Acties** | `MultiTenantDemo` → `queueCounts.acties` | **Geen** `/care/api/tasks/`. Telde **workflow-cases** met `isBlocked \|\| urgency === "critical" \|\| daysInCurrentPhase > 10` (`buildWorkflowCases` + `useCases` / `useProviders`). |
| **Acties-pagina lijst + buckets** | `ActiesPage` → `useTasks({ q: "" })` | **`GET /care/api/tasks/`** (`tasks_api` in `contracts/api/views.py`). Velden o.a. `actionStatus`: `overdue` / `today` / `upcoming` / `completed` afgeleid van `CareTask.status` en `due_date` t.o.v. vandaag. |
| **Counters te laat / vandaag / binnenkort** | Zelfde `tasks` array, client-side filters op `actionStatus`. | Voltooide taken (`completed`) worden uitgesloten. |

### Backend taken-API (samenvatting)

- Query: `CareTask.objects.for_organization(organization)` minus gearchiveerde cases.  
- Geen default uitsluiting van `COMPLETED` in de queryset; `actionStatus` in JSON zet `completed` voor `COMPLETED`/`CANCELLED`.  
- `due_date` is verplicht op het `CareTask`-model (`DateField`), dus geen `None`-vergelijk in de loop voor normale records.

### Conclusie databronnen

De badge **“Acties (18)”** matcheerde **casussen die aandacht vragen**, niet **open CareTasks**. De Acties-pagina toont uitsluitend **CareTasks**. Dat verklaart elke discrepantie waarbij er veel “werk” in de keten is maar **0** geregistreerde taken (of omgekeerd).

---

## 2. Reproductie (observatie)

- **Netwerk:** `GET /care/api/tasks/?page_size=100` levert de lijst voor de pagina.  
- **Sidebar:** Badge kwam uit `queueCounts` zonder deze call.  
- **Gevolg:** Sidebar kon bv. 18 tonen (cases) en de pagina 0 rijen (geen tasks).

Geen screenshots in repo; gedrag gereproduceerd via codepad + stub-E2E (`care-visual-regression.spec.ts`).

---

## 3. Filtering / zoekgedrag

- Standaard: geen zoektekst, status **alle** → alle **open** taken (niet `completed`) in de drie secties.  
- **Zoekbord:** titel + `linkedCaseId`; kan de lijst leeg maken terwijl er nog open taken zijn.  
- **Snelfilters** (Te laat / Vandaag / Binnenkort): filteren op `actionStatus`.

---

## 4. Lege staat

**Voor fix:** Lege staat kon optreden terwijl de sidebar een hoog getal toonde — inconsistent.  

**Na fix:**

- Zonder filters/zoek: lege staat alleen als er echt geen open taken zijn (`countOpenCareTasks(tasks) === 0`).  
- Met filters/zoek: copy legt uit dat er nog **N** openstaande taken zijn en vraagt filter/zoek aan te passen.

---

## 5. Badge-semantiek (na fix)

- **Acties (N)** in de sidebar (gemeente-shell) = **zelfde definitie als de Acties-pagina:** aantal **open** CareTasks (`actionStatus !== "completed"`), op basis van dezelfde `useTasks`-response (zelfde endpoint, zelfde `page_size`-limiet als de pagina — zie risico’s).

Andere badges (Casussen, Matching, …) blijven op workflow-case-tellingen; alleen **Acties** is gelijkgetrokken met de takenpagina.

---

## 6. Verwacht gedrag ( gekozen )

- Sidebar **Acties** = aantal open taken volgens API-response (zelfde open-definitie als de lijst zonder extra filters).  
- **Te laat + Vandaag + Binnenkort** som = aantal getoonde open taken in de standaardweergave (elke open taak valt in precies één bucket volgens backend `actionStatus`).  
- Geen valse tellingen of dummy rijen.

---

## 7. Regressie-tests

| Laag | Bestand | Dekking |
|------|---------|---------|
| Unit | `client/src/lib/actiesTaskSemantics.test.ts` | `isOpenCareTask` / `countOpenCareTasks` |
| E2E | `client/tests/e2e/care-visual-regression.spec.ts` | Stub: sidebar **Acties** bevat **1** en pagina heeft **1** rij |

---

## 8. Verificatie (uitgevoerd)

- `cd client && npx vitest run src/lib/actiesTaskSemantics.test.ts` — **2 tests passed**  
- `cd client && E2E_SPA_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/care-visual-regression.spec.ts` — **8 tests passed** (Vite op poort 3000)  
- Backend niet gewijzigd voor deze fix.

---

## 9. Gewijzigde bestanden

- `client/src/lib/actiesTaskSemantics.ts` — gedeelde definitie “open taak”.  
- `client/src/lib/actiesTaskSemantics.test.ts` — unit tests.  
- `client/src/components/examples/MultiTenantDemo.tsx` — `useTasks` + `queueCounts.acties` = `countOpenCareTasks(careTasks)`.  
- `client/src/components/care/ActiesPage.tsx` — `isOpenCareTask` + duidelijkere lege staat bij filters/zoek.  
- `client/tests/e2e/care-visual-regression.spec.ts` — E2E badge vs lijst.  
- `design-audit/ACTIES_FUNCTIONALITY_AUDIT.md` — dit document.

---

## 10. Resterende risico’s

1. **Dubbele fetch:** `MultiTenantDemo` en `ActiesPage` roepen elk `useTasks` aan → twee `GET /care/api/tasks/` bij gebruik van het dashboard. Functioneel correct; eventueel later dedupliceren (context of lifted state).  
2. **Paginatie:** telling gebruikt de eerste `page_size` (100) items; als er >100 open taken zijn, kan badge vs volledige totaal afwijken tot de API een totaal-open-telling levert of de client alle pagina’s ophaalt.  
3. **Andere rollen:** `badgeOverrides` geldt alleen voor **gemeente**; admin-nav gebruikt nog statische default badges in `Sidebar.tsx` — buiten scope van deze bug.

---

## 11. Eindoordeel

**Voor fix:** Acties-pagina kon correct zijn terwijl de sidebar een **ander concept** telde → **functioneel misleidend** (geen pure API-bug).  

**Na fix:** **Acties werkt consistent** voor de gemeente-shell: badge en lijst gebruiken dezelfde open-taak-definitie en dezelfde API-laag; lege staat met filters is verklaarbaar.

**Verdict:** *Partially broken (UX/data-semantics); na fix: **Acties works** (voor gedefinieerde scope hierboven).*
