# CareOn — Completion Roadmap

> Status: eerste audit, 2026-06-14. Afgeleid van de Reality Map, Flow Audit, UX Audit en Risk Register.
> Volgorde van uitvoeren (Implementatieregels v1.2): beveiliging → workflowintegriteit → data/audit → kernflow → states → schermlogica → design → copy → performance.
> Omvang: S (<½ dag) · M (½–2 dagen) · L (2–5 dagen) · XL (>1 week).

---

## P0 — Blokkeert betrouwbare werking / beveiligings-/integriteitsrisico

### P0-1 · Geauthenticeerde document-download + prod-MEDIA-strategie  (R1)
- **Probleem:** geen geauthenticeerde download-route; media alleen onder `DEBUG`; voorspelbare paden → PII-blootstelling of kapotte UX in productie.
- **Gewenste uitkomst:** documenten alleen downloadbaar door een geautoriseerde actor binnen org + zichtbaarheidsscope; geen directe `/media/`-toegang.
- **Bestanden:** `config/urls.py`, `config/settings_production.py`, `contracts/api/views.py`, `contracts/models.py` (`document_upload_path`).
- **Acceptatiecriteria:** (1) `GET /api/cases/<id>/documents/<doc_id>/download/` streamt bytes alleen na org- + `ensure_provider_case_visible_or_404`-check; (2) cross-tenant/niet-gelinkte provider → 404; (3) prod serveert geen directe media-paden; (4) uploadpaden niet-enumereerbaar (UUID).
- **Teststrategie:** authz-test (juiste actor 200, verkeerde 404), prod-settings-test dat geen media-URLpattern bestaat.
- **Risico:** deploy-config (S3/proxy) buiten repo — coördineer met infra. **Omvang:** L. **Afhankelijkheden:** geen.

---

## P1 — Nodig voor een volledig werkende pilot

### P1-1 · Fail-closed rolresolutie  (R2)  ← **aanbevolen eerste slice**
- **Probleem:** `resolve_actor_role` valt fail-open terug op `GEMEENTE` bij elke uitzondering.
- **Gewenste uitkomst:** bij niet-resolveerbare rol wordt autorisatie geweigerd, niet toegekend.
- **Bestanden:** `contracts/workflow_state_machine.py:186-192`.
- **Acceptatiecriteria:** (1) een uitzondering tijdens resolutie levert geen `GEMEENTE` op maar een expliciete weiger-uitkomst (403/raise) afgevangen door callers; (2) bestaande happy-path rollen ongewijzigd; (3) test bewijst dat een gesimuleerde resolutiefout géén gemeente-privileges geeft.
- **Teststrategie:** unit-test met gemockte exception; regressietest op normale rolresolutie.
- **Risico:** laag (gedragsverandering alleen op foutpad). **Omvang:** S. **Afhankelijkheden:** geen.

### P1-2 · Atomaire audit op `assessment_decision_api`  (R3)
- **Probleem:** transitie wordt buiten transactie gecommit; audit-fout → 503 maar state al gepersisteerd.
- **Gewenste uitkomst:** state-mutatie en strict-audit slagen of falen samen.
- **Bestanden:** `contracts/api/views.py:1500-1568`.
- **Acceptatiecriteria:** (1) state + `log_transition_event(strict=True)` in één `transaction.atomic()`; (2) gesimuleerde `AuditLoggingError` rolt de transitie terug en retourneert 503; (3) consistent met `provider_decision_api`-patroon.
- **Teststrategie:** hergebruik/herstel `test_intake_create_*_audit_fails`-patroon voor deze endpoint.
- **Risico:** laag. **Omvang:** S. **Afhankelijkheden:** P1-4 (tests groen).

### P1-3 · 5-fasen-uitlijning (doctrine + `CaseExecutionPage`)  (R4)
- **Probleem:** doctrine-docs + sommige componenten tonen `Samenvatting`/`Gemeente Validatie`/`Beoordeling` als primaire fasen; v1.2 erkent 5.
- **Gewenste uitkomst:** overal 5 zichtbare fasen; samenvatting/gemeente-validatie als status/taak; "beoordeling" → "Aanbiederreactie".
- **Bestanden:** `client/src/components/care/CaseExecutionPage.tsx`, `AudittrailPage.tsx`, `BoardView.tsx`, `phaseEngine.ts`, `AGENTS.md`, `docs/FOUNDATION_LOCK.md`, `docs/Careon_Operational_Constitution_v2.md`.
- **Acceptatiecriteria:** (1) geen UI-oppervlak toont een niet-canonieke fase als primair; (2) doctrine-docs verwijzen naar v1.2 als bindend en beschrijven 5 fasen; (3) terminologie-guard uitgebreid met NL-fase-canon; (4) productowner bevestigt gemeente-validatie als "explicitly required" approval-status.
- **Teststrategie:** uitbreiden `terminology.test.ts` + nieuwe guard; snapshot van fase-badges.
- **Risico:** productbesluit (laag — v1.2 geeft richting). **Omvang:** M. **Afhankelijkheden:** geen.

### P1-4 · Form-refactor afmaken / suite groen  (R8)
- **Probleem:** working-tree `jeugdhulpregio`/`preferred_region`-refactor maakt 10 backend- + 3 frontend-tests rood (incl. audit-rollback-garanties).
- **Gewenste uitkomst:** `pytest tests/` en `vitest` groen op werkboom.
- **Bestanden:** `contracts/forms.py`, `contracts/views.py`, betrokken `tests/*`, `client/src/components/care/WorkloadPage.tsx`.
- **Acceptatiecriteria:** (1) intake-create-payloads bevatten `jeugdhulpregio` of het veld is correct optioneel/afgeleid; (2) `WorkloadPage` herstelt `CareWorkRow`; (3) `pytest tests/` + `vitest run` 0 failures; (4) makemigrations-check blijft schoon.
- **Teststrategie:** de bestaande suite is de acceptatie.
- **Risico:** middel (refactor-intentie moet duidelijk zijn — afmaken vs terugrollen). **Omvang:** M. **Afhankelijkheden:** blokkeert veilige verdere slices.

### P1-5 · Regiekamer: één dominante CTA  (UX P1)  ← **beste eerste UX-slice**
- **Probleem:** twee concurrerende dominante CTA's gekoppeld aan dezelfde actie.
- **Gewenste uitkomst:** één dominante NBA-knop via `PrimaryActionButton`.
- **Bestanden:** `client/src/components/care/SystemAwarenessPage.tsx:1609-1654`.
- **Acceptatiecriteria:** (1) precies één visueel-dominante primaire actie op het oppervlak; (2) gebruikt `PrimaryActionButton`; (3) design-law-guard groen.
- **Teststrategie:** vitest design-law-guard + snapshot.
- **Risico:** laag. **Omvang:** S. **Afhankelijkheden:** P1-4.

---

## P2 — Product- & UX-versterking

### P2-1 · `CareStatusBadge`-primitive + consolidatie  (UX D)
- **Probleem:** verplichte primitive ontbreekt; status verspreid over ≥5 one-offs.
- **Acceptatiecriteria:** `CareStatusBadge` bestaat, dekt de bestaande statusvarianten, vervangt minstens `CaseStatusBadge`/`CareDominantStatus`-gebruik; geen visuele regressie.
- **Bestanden:** `client/src/components/care/CareDesignPrimitives.tsx` + call-sites. **Omvang:** M.

### P2-2 · Design-tokens ontdubbelen
- **Probleem:** twee niet-matchende palettes in `tokens.ts`.
- **Acceptatiecriteria:** alleen het canonieke `visualContract`-palet blijft; consumers gemigreerd; geen visuele regressie t.o.v. `CAREON_UI_CONTRACT.md`.
- **Bestanden:** `client/src/design/tokens.ts`. **Omvang:** M.

### P2-3 · Provider-identiteit-hardening op `provider_decision_api`
- **Probleem:** responder wordt gecheckt op `responsible_coordinator == user`, niet expliciet `== selected_provider`.
- **Acceptatiecriteria:** accept/reject alleen toegestaan als de provider van de actor de `selected_provider` op de `PlacementRequest` is; test bewijst weigering anders.
- **Bestanden:** `contracts/api/views.py:1994-2010`. **Omvang:** S.

### P2-4 · `cases_bulk_update_api` per-veld-allowlist  (R5) · **P2-5** `audit_log_api` org-scope  (R6)
- **Acceptatiecriteria:** allowlist afgedwongen + CSRF waar mogelijk; auditlijst gescoopt op object-org met cross-org-test. **Bestanden:** `contracts/api/views.py`. **Omvang:** S elk.

### P2-6 · `RapportagesPage` echt maken of markeren  ·  **P2-7** dode footprint opruimen
- **Acceptatiecriteria:** Rapportages koppelt aan echte export/audit-API óf toont expliciet "in ontwikkeling" (geen nepdatums); e-commerce libs + `examples/*` + dode provider-dashboards verwijderd, bundel kleiner, geen live referenties gebroken. **Omvang:** M / M.

### P2-8 · `CAREON_PILOT_SPA_ONLY=True` afdwingen  (R7)  ·  **P2-9** upload size-limit  (R11)
- **Acceptatiecriteria:** legacy HTML-transities geblokkeerd in pilot-config; max-bestandsgrootte afgedwongen met test. **Omvang:** S elk.

---

## P3 — Schaalbaarheid & volwassenheid

- **P3-1 · CI-hardening (R9):** `tsconfig` + `tsc --noEmit`-job, frontend-test-job, pyright corrigeren, `contracts/tests.py` in CI. **Omvang:** M.
- **P3-2 · JSON-document-upload-API** (vervangt legacy HTML-form) + SPA-uploadflow. **Omvang:** M.
- **P3-3 · Intake-planning** (datum/afspraakvelden i.p.v. enkel statusflip). **Omvang:** M — productbesluit nodig.
- **P3-4 · Seed-reset org-isolatie (R10):** harde scope-assertie + dry-run; test "force reset raakt non-demo orgs niet". **Omvang:** S.
- **P3-5 · Workflow-state-deduplicatie:** `CaseIntakeProcess.workflow_state` vs `CareCase.case_phase` consolideren of een afgeleide-property maken. **Omvang:** L — raakt veel call-sites.
- **P3-6 · `/gebruikers` gebruikersbeheer** implementeren. **Omvang:** L.

---

## Aanbevolen uitvoervolgorde (eerste sprint)
1. **P1-4** (suite groen — fundament voor veilige wijzigingen)
2. **P1-1** (fail-closed rol — kleinste security-slice)
3. **P1-2** (atomaire audit)
4. **P0-1** (document-download — grootste pilotblocker, coördinatie met infra)
5. **P1-5** (Regiekamer één CTA — eerste UX-slice)
6. **P1-3** (5-fasen-uitlijning)
