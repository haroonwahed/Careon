# CareOn — End-to-End Flow Audit

> Status: eerste audit, 2026-06-14. Bron: code-inspectie (`VERIFIED`) tenzij anders vermeld.
> Canonieke workflow (v1.2): **Aanmelding → Matching → Aanbiederreactie → Plaatsing → Intake**.
> Legenda status: ✅ werkt end-to-end · 🟡 gedeeltelijk · 🔴 gebroken/ontbreekt.

## Kolommen
flow · actor · startpunt · backend · frontend · autorisatie · audit · testdekking · status · blokkade · aanbevolen actie

---

| # | Flow | Actor | Startpunt (endpoint / scherm) | Backend | Frontend | Autorisatie | Audit | Testdekking | Status | Blokkade | Aanbevolen actie |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Aanmelding aanmaken | Gemeente / Zorgaanbieder | `POST /api/cases/intake-create/` (`api/views.py:2371`) · `NieuweCasusPage` | ✅ `intake_create_api`, transactioneel + strict audit (503 bij auditfout) | ✅ `apiClient` | ✅ rol + org-scope | ✅ `log_transition_event` | ✅ `test_intake_assessment_matching_flow` (nu rood door working-tree, zie R8) | 🟡 | Working-tree form-refactor (`jeugdhulpregio` verplicht) breekt POST-payload → 10 tests rood | Test-payloads + form synchroniseren of refactor terugdraaien |
| 2 | Aanmelding compleet / klaar voor matching | Gemeente | `POST /api/cases/<id>/assessment-decision/` (`api/views.py:1365`) · `AssessmentDecisionPage` | 🟡 `assessment_decision_api`: **state-save NIET in `transaction.atomic()`** vóór audit (`:1514-1545`) | ✅ | ✅ `_require_workflow_role` | 🔴 **audit ná commit**: bij `AuditLoggingError` → 503 maar transitie al gepersisteerd | 🟡 rollback-test bestaat maar valt onder R8 | 🟡 | Niet-atomaire audit = transitie zonder auditrecord (R3) | State + strict-audit in één `transaction.atomic()` wikkelen |
| 3 | Matching starten | Gemeente | (geen los endpoint — zit in stap 2, `decision='matching'`, `api/views.py:1547`) | 🟡 zij-effect van assessment-decision; persist-fail → 503 ná state-advance | 🟡 geen aparte "start matching"-actie | ✅ | ✅ | 🟡 | 🟡 | Geen idempotent "start matching"-endpoint; casus kan in `MATCHING_READY` staan zonder kandidaten | Los, idempotent `start-matching`-endpoint overwegen (P2) |
| 4 | Match aanbevelen + uitleggen | Platform/Gemeente | `GET /api/cases/<id>/matching-candidates/` (`api/views.py:1192`) · `MatchingPageWithMap` | ✅ `MatchEngine` deterministisch, `persist=False` | ✅ `useMatchingCandidates` | ✅ | n.v.t. (read) | ✅ `test_governance_audit`, matching-tests | ✅ | — | Behouden; advisory + trade-offs + `verificatie_advies` aanwezig (`provider_matching_service.py:588-603`) |
| 5 | Provider selecteren / match valideren | Gemeente | `POST /api/cases/<id>/matching/action/` (`action=confirm_validation`) (`api/views.py:1580`) | ✅ transactioneel + audit; creëert DRAFT `PlacementRequest` | ✅ | ✅ rol GEMEENTE | ✅ | ✅ `test_workflow_foundation_lock` | ✅ | Voert door `GEMEENTE_VALIDATED` (niet-canonieke primaire staat, zie Flow-noot) | Behouden als *approval-status*, niet als primaire fase tonen |
| 6 | Aanbiedingsverzoek versturen | Gemeente | `POST .../matching/action/` (`action=send_to_provider`) (`api/views.py:1764`) | ✅ verifieert `proposed_provider` == gevalideerde keuze; → `PROVIDER_REVIEW_PENDING` | ✅ | ✅ | ✅ | ✅ | ✅ | — | Behouden |
| 7 | Provider accepteert / weigert / vraagt info | Zorgaanbieder | `POST /api/cases/<id>/provider-decision/` (`api/views.py:1964`) · `AanbiederreactiePage` | ✅ `transaction.atomic()` + `select_for_update`-lock; weigering vereist `reason_code` | ✅ `PrimaryActionButton` | ✅ rol ZORGAANBIEDER + **zichtbaarheid** via `ensure_provider_case_visible_or_404` (`api/views.py:319,1995`) | ✅ strict | ✅ `provider-review-smoke.spec` | ✅ | Identiteit-check is per-coördinator, niet expliciet `== selected_provider` (P2-hardening) | Voeg assertie toe: responder is de `selected_provider` |
| 8 | Plaatsing bevestigen | Gemeente | `POST /api/cases/<id>/placement-action/` (`status=APPROVED`) (`api/views.py:2154`) | ✅ transactioneel + audit; → `PLACEMENT_CONFIRMED` | ✅ `PlacementPage`, CTA gated op `providerAccepted && allValid` | ✅ | ✅ | ✅ `test_phase2_pilot_stabilization` (R8-impact) | ✅ | — | Behouden; UI weerspiegelt backend-state correct |
| 9 | Intake plannen | Zorgaanbieder | `POST /api/cases/<id>/intake-action/` (`api/views.py:2281`) · `IntakeListPage` | 🟡 zet alleen `INTAKE_STARTED`; **geen afsprakenplanning/datum** | 🟡 | ✅ | ✅ | 🟡 | 🟡 | "Intake plannen" is alleen statusflip, geen agenda/datumstap | Productbesluit: minimale intake-datum/afspraakvelden toevoegen (P2) |
| 10 | Document uploaden | Gemeente / Zorgaanbieder | `POST /casussen/<pk>/documenten/new/` (HTML, `views.py:8268`) | 🔴 **geen JSON-API**; `documents_api` is GET-only | 🔴 SPA kan niet in-flow uploaden | ✅ metadata-scope + PII-scan (`forms.py:384`) | 🟡 | 🟡 | 🔴 | Geen geauthenticeerde download-route in productie (media alleen onder `DEBUG`, `config/urls.py:64-66`) | **R1**: geauthenticeerde download-view + JSON-upload-API |
| 11 | Handmatige override | Gemeente / Admin | binnen matching/placement-acties (override met actor+reden) | ✅ override vereist actor + reden, geauditeerd | 🟡 | ✅ | ✅ | 🟡 | ✅ | — | Behouden; voldoet aan v1.2 §6 |
| 12 | Status-/workflowtransitie (algemeen) | alle | alle mutatie-endpoints → `evaluate_transition` | ✅ valideert rol/actie + huidige→doelstaat; overslaan geblokkeerd | ✅ frontend kan **geen** state forceren (geen endpoint accepteert client-`workflow_state`) | ✅ | ✅ (m.u.v. stap 2) | ✅ `test_workflow_integrity`, `test_workflow_foundation_lock` | ✅ | Legacy HTML-transitie-endpoints (`views.py`) default actief = parallel oppervlak | `CAREON_PILOT_SPA_ONLY=True` in pilot afdwingen |
| 13 | Cross-tenant / cross-role toegangspoging | aanvaller | elk case-scoped endpoint | ✅ `get_scoped_object_or_404` filtert op org → 404; providerzichtbaarheid via `Exists(PlacementRequest)` | ✅ | ✅ object-level | ✅ | ✅ `test_cross_tenant_isolation` (88 tests) | ✅ | `audit_log_api` lekt audit cross-org voor multi-org users (`api/views.py:2779`); `cases_bulk_update_api` mass-assignment (R5/R6) | Scope auditlist op object-org; per-veld allowlist op bulk-update |

---

## Flow-noot: niet-canonieke staten in de keten

De backend dwingt tussen Aanmelding en Aanbiederreactie twee extra harde gates af:

- `DRAFT_CASE → SUMMARY_READY → MATCHING_READY` ("Samenvatting", `workflow_state_machine.py:70-71`)
- `MATCHING_READY → GEMEENTE_VALIDATED → PROVIDER_REVIEW_PENDING` ("Gemeente Validatie", `:72-73`)

v1.2 verbiedt deze als **primaire fasen**, maar staat ze toe als **artefact/approval-status** (Technical Foundation §2.2). De frontend klapt ze al samen tot de 5 canonieke fasen (`decisionPhaseUi.ts`). `SUMMARY_READY` wordt bovendien auto-gebootstrapt (`workflow_summary_gate.py:57`), dus is geen handmatige stap.

**Conclusie:** dit is geen functionele blokkade maar een **presentatie/governance-uitlijning**. Aanbeveling: doctrine-docs + `CaseExecutionPage` aanlijnen op 5 zichtbare fasen, gemeente-validatie tonen als status/taak binnen Matching, niet als fase. Zie Roadmap P1-2.

## Samenvatting per status

- ✅ **Werkt end-to-end:** stappen 4, 5, 6, 7, 8, 11, 12, 13.
- 🟡 **Gedeeltelijk:** 1 (test-breuk), 2 (audit-atomiciteit), 3 (geen los endpoint), 9 (alleen statusflip).
- 🔴 **Gebroken/ontbreekt:** 10 (documentupload/-download in productie).
