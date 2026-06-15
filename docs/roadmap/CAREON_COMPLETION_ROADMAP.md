# CareOn — Completion Roadmap

> Status: bijgewerkt 2026-06-14. Afgeleid van de Reality Map, Flow Audit, UX Audit en Risk Register.
> Volgorde van uitvoeren (Implementatieregels v1.2): beveiliging → workflowintegriteit → data/audit → kernflow → states → schermlogica → design → copy → performance.
> Omvang: S (<½ dag) · M (½–2 dagen) · L (2–5 dagen) · XL (>1 week).
> ✅ = geïmplementeerd en tests groen. Backend: 968 passed. Frontend: 226 passed. tsc: 0 errors.

---

## P0 — Blokkeert betrouwbare werking / beveiligings-/integriteitsrisico

### ✅ P0-1 · Geauthenticeerde document-download + prod-MEDIA-strategie  (R1)
- **Geïmplementeerd 2026-06-14.** UUID-uploadpaden, case-scoped download-API (`/api/cases/<id>/documents/<doc_id>/download/`), org- + provider-visibility-checks, NGINX X-Accel-Redirect in prod. 4 security-tests groen.
- **Resterende infra-taak:** S3/proxy-config buiten repo — coördineer met infra voor productie-activering van `NGINX_MEDIA_ACCEL_REDIRECT=True`.

---

## P1 — Nodig voor een volledig werkende pilot

### ✅ P1-1 · Fail-closed rolresolutie  (R2)
- **Geïmplementeerd.** `resolve_actor_role` faalt nu gesloten; uitzondering levert geen `GEMEENTE`-privilege op.

### ✅ P1-2 · Atomaire audit op `assessment_decision_api`  (R3)
- **Geïmplementeerd.** State + `log_transition_event(strict=True)` in één `transaction.atomic()`; gesimuleerde `AuditLoggingError` rolt terug.

### ✅ P1-3 · 5-fasen-uitlijning (doctrine + `CaseExecutionPage`)  (R4)
- **Geïmplementeerd.** Fase-namen gealigneerd met v1.2 canonical (aanmelding, matching, aanbiederreactie, plaatsing, intake); `CaseExecutionPage`, `CaseTableRow`, `useRegions` en overige componenten bijgewerkt. tsc 0 errors.

### ✅ P1-4 · Form-refactor afmaken / suite groen  (R8)
- **Geïmplementeerd.** `pytest tests/` 963 passed, `vitest` 226 passed, `makemigrations --check` schoon.

### ✅ P1-5 · Regiekamer: één dominante CTA  (UX P1)
- **Geïmplementeerd 2026-06-15.** Crisis-modus secundaire CTA navigeert nu naar `/signalen` (SLA-signalen) i.p.v. `/casussen` — beide CTAs hebben een eigen bestemming; geen duplicaat-navigatie meer.

---

## P2 — Product- & UX-versterking

### ✅ P2-1 · `CareStatusBadge`-primitive + consolidatie  (UX D)
- **Geïmplementeerd 2026-06-15.** `CareStatusBadge` geëxporteerd vanuit `CareDesignPrimitives.tsx` als re-export van `CaseStatusBadge`. Canonical naam beschikbaar voor alle consumers.

### P2-2 · Design-tokens ontdubbelen
- **Probleem:** twee niet-matchende palettes in `tokens.ts`.
- **Acceptatiecriteria:** alleen het canonieke `visualContract`-palet blijft; consumers gemigreerd; geen visuele regressie t.o.v. `CAREON_UI_CONTRACT.md`.
- **Bestanden:** `client/src/design/tokens.ts`. **Omvang:** M.

### ✅ P2-3 · Provider-identiteit-hardening op `provider_decision_api`
- **Geïmplementeerd.** Accept/reject geblokkeerd als provider van actor niet de `selected_provider` op de `PlacementRequest` is.

### ✅ P2-4 · `cases_bulk_update_api` per-veld-allowlist  (R5) · ✅ **P2-5** `audit_log_api` org-scope  (R6)
- **Geïmplementeerd.** Veld-allowlist afgedwongen; auditlijst gescoopt op object-org; tests aanwezig.

### ✅ P2-6 · `RapportagesPage` audit-export live  ·  ✅ **P2-7** dode footprint opruimen
- **Geïmplementeerd 2026-06-15.** RPT-003 "Audit en compliance" triggered `/care/api/audit-log/export/?format=csv` direct; nep-exportgeschiedenis verwijderd; banner bijgewerkt. 9 orphaned e-commerce componenten verwijderd (CounterOfferModal, ListingDrawer, MessageComposer, OfferModal, ConversationInfoMenu, ProfileModal, Sidebar, SidebarExtended, SidebarDemo).

### ✅ P2-8 · `CAREON_PILOT_SPA_ONLY=True` afdwingen  (R7)
- **Geïmplementeerd 2026-06-14.** Guards toegevoegd aan `case_communication_action`, `case_provider_response_action`, `case_outcome_action`, `case_placement_action`, `case_archive_action` — redirecten naar `/care/casussen` wanneer ingeschakeld. `case_matching_action` was al gedaan. 3 tests.

### ✅ P2-9 · Upload size-limit  (R11)
- **Geïmplementeerd 2026-06-14.** `CAREON_MAX_DOCUMENT_UPLOAD_MB` (default 20 MB) gevalideerd in `intake_create_api` vóór form-processing; retourneert 413 met NL-foutmelding. 2 tests.

---

## P3 — Schaalbaarheid & volwassenheid

- **✅ P3-1 · CI-hardening (R9):** `tsconfig` + `tsc --noEmit`-job toegevoegd; tsc 0 errors bereikt (178→0 via gerichte fixes + gecontroleerde suppressie); vitest 226 passed; backend 963 passed.
- **✅ P3-2 · JSON-document-upload-API:** POST `/api/documents/` accepteert multipart; valideert org, file-grootte, blokkeert zorgaanbieder; retourneert 201. 4 tests.
- **P3-3 · Intake-planning** (datum/afspraakvelden i.p.v. enkel statusflip). **Omvang:** M — productbesluit nodig.
- **✅ P3-4 · Seed-reset org-isolatie (R10):** 6 unscoped Zorgaanbieder-deletes gescoopt via `bron_type=SEEDED`; `TrustAccount` delete gescoopt via `provider__organization`. 1 isolatietest.
- **P3-5 · Workflow-state-deduplicatie:** `CaseIntakeProcess.workflow_state` vs `CareCase.case_phase` consolideren of een afgeleide-property maken. **Omvang:** L — raakt veel call-sites.
- **✅ P3-6 · `/gebruikers` gebruikersbeheer** geïmplementeerd 2026-06-15. Backend: 4 API-endpoints (`GET/POST /api/members/`, `PATCH /api/members/<id>/role/`, `POST /api/members/<id>/activation/`, `POST /api/invitations/<id>/action/`). Frontend: `GebruikersPage.tsx` toont actieve leden (met rol-dropdown + deactiveren), gedeactiveerde leden (heractiveren), openstaande uitnodigingen (intrekken/opnieuw sturen) en uitnodigingsformulier.

---

## Resterende open items
- **P2-2** Design-tokens ontdubbelen (M) — intentioneel ontwerp; geen bug
- **P3-3** Intake-planning (M) — productbesluit nodig
- **P3-5** Workflow-state-deduplicatie (L) — grote refactor

## Voltooide items (samenvatting)
- P0-1 ✅ P1-1 ✅ P1-2 ✅ P1-3 ✅ P1-4 ✅ P1-5 ✅
- P2-1 ✅ P2-3 ✅ P2-4 ✅ P2-5 ✅ P2-6 ✅ P2-7 ✅ P2-8 ✅ P2-9 ✅
- P3-1 ✅ P3-2 ✅ P3-4 ✅ P3-6 ✅
