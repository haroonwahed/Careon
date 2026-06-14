# CareOn — Technical Risk Register

> Status: eerste audit, 2026-06-14. Alle bevindingen zijn `VERIFIED` (code gelezen) tenzij gemarkeerd.
> Ernst: **P0** = blokkeert betrouwbare werking of beveiligings-/integriteitsrisico · **P1** = nodig voor werkende pilot · **P2** = versterking.

---

### R1 — Geen geauthenticeerde document-download in productie; media alleen onder `DEBUG`
- **Bewijs:** `config/urls.py:64-66` (`static(MEDIA_URL, …)` uitsluitend onder `settings.DEBUG`); `settings_production.py` definieert geen MEDIA-serving/`STORAGES`/S3; `api/views.py:2704` retourneert alleen `hasStoredFile`-metadata, nooit bytes; uploadpad voorspelbaar `documents/<id>/<filename>` (`models.py:38-39`).
- **Impact:** In productie zijn geüploade documenten óf onbereikbaar (kapotte UX) óf — als een reverse proxy `/media/` serveert — **zonder per-request-autorisatie downloadbaar** (PII/PHI-blootstelling). Voorspelbare paden maken enumeratie mogelijk.
- **Waarschijnlijkheid:** Middel (afhankelijk van deploy-config, niet in repo → `ASSUMPTION` op proxy).
- **Ernst:** **P0**
- **Getroffen rollen:** alle (vertrouwelijke casusdocumenten).
- **Bestanden:** `config/urls.py`, `config/settings_production.py`, `contracts/models.py`, `contracts/api/views.py`.
- **Maatregel:** geauthenticeerde, org-/zichtbaarheids-gescoopte download-view (`X-Accel-Redirect`/streaming) + UUID-uploadpaden; expliciete prod-MEDIA-strategie (S3 met signed URLs).
- **Afhankelijkheden:** geen.

### R2 — `resolve_actor_role` valt fail-open terug op `GEMEENTE`
- **Bewijs:** `contracts/workflow_state_machine.py:186-192` — `except Exception: … return WorkflowRole.GEMEENTE`.
- **Impact:** Bij een uitzondering tijdens rolresolutie (bijv. DB-hapering) krijgt een gebruiker gemeente-privileges. Voor een zorgaanbieder-account betekent dit het verkrijgen van gemeente-acties (matching valideren, plaatsing bevestigen). Fail-open op de kern-privilegecheck.
- **Waarschijnlijkheid:** Laag (vereist exception-pad), maar hoge impact.
- **Ernst:** **P1**
- **Getroffen rollen:** Zorgaanbieder (privilege-escalatie), Gemeente.
- **Bestanden:** `contracts/workflow_state_machine.py`, `contracts/permissions.py`.
- **Maatregel:** fail-closed — bij uitzondering autorisatie weigeren (raise/403), niet een privilege toekennen.
- **Afhankelijkheden:** geen. **Kleine, goed testbare slice.**

### R3 — `assessment_decision_api` commit transitie buiten transactie; audit erna
- **Bewijs:** `contracts/api/views.py:1514-1545` — state-save (`:1515-1518`) staat op functie-body-niveau (géén `transaction.atomic()`), audit-`try/except` volgt (`:1521-1545`) en retourneert 503 bij `AuditLoggingError` terwijl de transitie al gepersisteerd is. Contrast: `provider_decision_api`/`placement_action_api`/`intake_action_api` wikkelen state+strict-audit wél in `transaction.atomic()`.
- **Impact:** Een matching-goedkeuringstransitie kan plaatsvinden **zonder auditrecord** — schendt Technical Foundation §4 ("audit failure blocks/retries").
- **Waarschijnlijkheid:** Laag-middel (audit-fout vereist).
- **Ernst:** **P1**
- **Getroffen rollen:** Gemeente (non-repudiation/auditintegriteit).
- **Bestanden:** `contracts/api/views.py`.
- **Maatregel:** state-mutatie + `log_transition_event(strict=True)` in één `transaction.atomic()`.
- **Afhankelijkheden:** raakt R8 (tests momenteel rood). **Kleine slice.**

### R4 — Niet-canonieke staten `SUMMARY_READY` / `GEMEENTE_VALIDATED` als harde primaire gates
- **Bewijs:** `contracts/workflow_state_machine.py:68-73`; `api/views.py:1638-1726`.
- **Impact:** Schendt v1.2 §2.2/3.2/3.3 *als* primaire fasen gepresenteerd. v1.2 stáát gemeente-validatie als approval-status toe "when explicitly required" (NL gemeentelijke budget/juridische goedkeuring kwalificeert). Frontend klapt al samen (`decisionPhaseUi.ts`); doctrine-docs + `CaseExecutionPage` niet. Dus primair een **governance/presentatie**-risico, geen functionele blokkade.
- **Waarschijnlijkheid:** n.v.t. (consistentie/compliance).
- **Ernst:** **P1** (compliance) / niet-blokkerend functioneel.
- **Getroffen rollen:** alle (begrijpelijkheid workflow).
- **Bestanden:** `workflow_state_machine.py`, `client/src/components/care/CaseExecutionPage.tsx`, `AGENTS.md`, `docs/FOUNDATION_LOCK.md`.
- **Maatregel:** doctrine-docs aanlijnen op 5 zichtbare fasen; staten als sub-status/approval modelleren en presenteren; productowner bevestigt gemeente-validatie-gate als "explicitly required".
- **Afhankelijkheden:** productbesluit (laag-risico, v1.2 geeft de richting al).

### R5 — `cases_bulk_update_api` mass-assignment zonder per-veld-allowlist
- **Bewijs:** `contracts/api/views.py:859-894` — `queryset.update(**updates)` met ongefilterde body-keys, `@csrf_exempt`. Workflow-velden geblokkeerd (`:869-884`) en org+provider-gescoopt; overige `CareCase`-velden vrij muteerbaar.
- **Impact:** Mass-assignment van willekeurige casusvelden (niet cross-tenant). CSRF-exempt vergroot oppervlak.
- **Waarschijnlijkheid:** Middel.
- **Ernst:** **P2**
- **Getroffen rollen:** Gemeente/Admin.
- **Bestanden:** `contracts/api/views.py`.
- **Maatregel:** expliciete per-veld-allowlist + waar mogelijk CSRF herstellen.

### R6 — `audit_log_api` lekt audit cross-org voor multi-org gebruikers
- **Bewijs:** `contracts/api/views.py:2779-2782` — filtert op `user_id IN (leden actieve org)` i.p.v. op object-org.
- **Impact:** Een gebruiker in org A én B ziet eigen org-A-acties terwijl hij org B's auditlog bekijkt. Beperkte vertrouwelijkheidslek.
- **Waarschijnlijkheid:** Laag (vereist multi-org user).
- **Ernst:** **P2**
- **Bestanden:** `contracts/api/views.py`.
- **Maatregel:** auditlijst scopen op de organisatie van het gelogde object.

### R7 — Legacy HTML-transitie-endpoints default actief (parallel mutatie-oppervlak)
- **Bewijs:** `config/settings.py:317` (`CAREON_PILOT_SPA_ONLY` default `False`); `views.py:5410,5667,6181`. Gebruiken dezelfde state-machine + rolchecks, dus geen state-bypass, maar tweede onderhoudspad.
- **Impact:** Drift-risico tussen API en HTML-pad.
- **Waarschijnlijkheid:** Middel.
- **Ernst:** **P2**
- **Bestanden:** `config/settings.py`, `contracts/views.py`.
- **Maatregel:** `CAREON_PILOT_SPA_ONLY=True` in pilot/productie afdwingen; legacy-pad op termijn verwijderen.

### R8 — Half-geland form-refactor maakt 10 backend- + 3 frontend-tests rood; CI zou rood worden
- **Bewijs:** working-tree-wijzigingen in `contracts/forms.py` (+132/−29: nieuw `required=True jeugdhulpregio`, `preferred_region` naar queryset-validatie) + `contracts/views.py`; testpayloads niet bijgewerkt. Run: **10 failed, 942 passed** (`pytest tests/`), eerste fout `AssertionError: 400 != 200`, body `{"jeugdhulpregio":"This field is required"}`. Frontend: **3 failed, 223 passed** (vitest), incl. `operationalDesignLawsGuard LAW 08 (WorkloadPage missing CareWorkRow)`.
- **Impact:** Elke push faalt `platform-guardrails`. Geraakte tests bevatten de **audit-rollback (503/500)-garanties** → kernintegriteitsclaim momenteel lokaal onbewezen.
- **Waarschijnlijkheid:** Hoog (al rood).
- **Ernst:** **P1**
- **Bestanden:** `contracts/forms.py`, `contracts/views.py`, `tests/test_intake_assessment_matching_flow.py` e.a., `client/src/components/care/WorkloadPage.tsx`.
- **Maatregel:** refactor afmaken (test-payloads + UI synchroniseren) óf terugrollen; daarna suite groen krijgen vóór nieuwe slices.
- **Afhankelijkheden:** raakt Flow #1/#2 en R3-test.

### R9 — Geen frontend-typecheck, near-disabled pyright; `contracts/tests.py` buiten CI
- **Bewijs:** geen `tsconfig.json`/`typecheck`-script in `client/`; `pyrightconfig.json` op niet-bestaande `pythonVersion 3.15` met onderdrukte categorieën; `platform-guardrails.yml` draait alleen `pytest tests/` (niet `contracts/tests.py`, geen frontend-job).
- **Impact:** TS-typefouten ongedetecteerd; deel van de testdekking draait nooit in CI.
- **Waarschijnlijkheid:** Hoog.
- **Ernst:** **P2**
- **Bestanden:** `pyrightconfig.json`, `client/` (geen tsconfig), `.github/workflows/platform-guardrails.yml`.
- **Maatregel:** `tsconfig` + `tsc --noEmit`-job toevoegen; pyright corrigeren; `contracts/tests.py` in CI of migreren naar `tests/`.

### R10 — Auto-bootstrap + force-reset op gedeelde staging-DB
- **Bewijs:** `reset_pilot_environment` + `PILOT_FORCE_RESET=1` doen full wipe-and-reseed van `gemeente-demo`; `bootstrap_staging_pilot`/`PILOT_AUTO_BOOTSTRAP` seeden bij Render-boot. Geen test voor "force reset raakt non-demo orgs niet".
- **Impact:** Bij gedeelde DB en mis-gezette flag: destructieve reseed van echte pilot-data.
- **Waarschijnlijkheid:** Laag-middel.
- **Ernst:** **P2**
- **Bestanden:** `contracts/management/commands/reset_pilot_environment.py`, `bootstrap_staging_pilot.py`.
- **Maatregel:** harde org-scope-assertie + dry-run/confirmation; nooit non-demo orgs raken; test toevoegen.

### R11 — Geen bestandsgrootte-limiet bij upload; PII-scan leest alleen eerste 512KB
- **Bewijs:** `contracts/forms.py:92` (`min(file_size, 512_000)`), geen max-upload-validator.
- **Impact:** Grote bestanden passeren de PII-scan ongescand voorbij 512KB; storage/DoS-misbruik.
- **Ernst:** **P2**
- **Bestanden:** `contracts/forms.py`.
- **Maatregel:** max-bestandsgrootte afdwingen; scan-window heroverwegen.

---

## Bevindingen die NIET standhielden bij verificatie

> Transparantie over de audit zelf: één agent-bevinding is door directe code-lezing weerlegd.

- **"`provider_decision_api` mist providerzichtbaarheidscheck" (geclaimd P1)** — **WEERLEGD.** `_get_intake_for_case_api_id` roept `ensure_provider_case_visible_or_404(user, case_record)` aan (`api/views.py:319`) en `provider_decision_api` geeft `user=request.user` door (`:1995`). Zichtbaarheid is per-coördinator afgedwongen, niet alleen per-org. Resterend, zwakker punt: er is geen expliciete assertie dat de responder de specifieke `selected_provider` is (de check is op `responsible_coordinator == user`). → afgewaardeerd naar **P2-hardening** (Roadmap), niet R-niveau.

## Prioriteitsoverzicht

| Ernst | Risico's |
|---|---|
| **P0** | R1 |
| **P1** | R2, R3, R4, R8 |
| **P2** | R5, R6, R7, R9, R10, R11, + provider-identiteit-hardening |
