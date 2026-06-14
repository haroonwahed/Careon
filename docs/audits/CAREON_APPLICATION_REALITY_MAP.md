# CareOn — Application Reality Map

> Status: eerste audit (Fase A–C), datum 2026-06-14.
> Bindende bron van waarheid: **CareOn Technical Foundation v1.2** + **CareOn Product & Design Constitution v1.2**.
> Deze map beschrijft wat CareOn *daadwerkelijk* is op basis van code-inspectie, niet wat de docs claimen. Elke claim is `VERIFIED` (code gelezen) of `ASSUMPTION` (afgeleid).

---

## 1. Systeemoverzicht

CareOn is een **operationele regielaag voor zorgtoewijzing onder schaarste**: het begeleidt een zorgvraag van aanmelding tot intake, met de gemeente/regievoerder als regisseur en de zorgaanbieder als reagerende partij. Het is een werkend Django + React systeem met een echte, server-afgedwongen workflow-state-machine, echte multi-tenancy, een deterministische (regelgebaseerde) matchingengine en append-only auditlogging. Het is **geen** mock-prototype: de SPA praat via een CSRF-bewuste client met echte Django-API-endpoints.

De kern is technisch volwassener dan typische pilots. De grootste problemen zitten niet in "werkt het", maar in **doctrine-drift** (de codebase is gebouwd op een ouder 7-fasen-model dat v1.2 terugbrengt naar 5), **documentafhandeling in productie**, **fail-open autorisatie-randgevallen**, en een **grote dode/legacy frontend-footprint**.

## 2. Architectuur

| Laag | Technologie | Locatie | VERIFIED? |
|---|---|---|---|
| Backend framework | Django 5.2, Python 3.12 | `manage.py`, `config/settings.py` | VERIFIED |
| Backend-app (domein) | Eén app: `contracts/` (~60 modules) | `contracts/` | VERIFIED |
| API-stijl | Function-based JSON views (geen DRF) onder `/care/api/...` | `contracts/api/views.py`, `contracts/urls.py` | VERIFIED |
| Frontend framework | React 18 + Vite + TypeScript + Tailwind + Radix UI | `client/` | VERIFIED |
| Frontend routing | **Geen React Router**; hand-gerolde `pushState`-router in `components/examples/MultiTenantDemo.tsx` (de productie-shell) | `client/src/App.tsx:98`, `MultiTenantDemo.tsx` | VERIFIED |
| Data | SQLite (dev/fallback), Postgres (productie via `DATABASE_URL`) | `config/settings.py`, `settings_production.py` | VERIFIED |
| Auth | Django sessie-auth + optioneel OIDC/SSO (Azure/Google) | `auth_backends.py`, `oidc_middleware.py`, `SSO_ENABLED` | VERIFIED |
| Multi-tenancy | `OrganizationMiddleware` + per-request org-scoping op queryset/objectniveau | `contracts/middleware.py:147-177`, `contracts/tenancy.py` | VERIFIED |
| Deploy | Render (`render.yaml`, gunicorn, SPA gebouwd in `theme/static/spa`), Replit dev | `render.yaml`, `.replit` | VERIFIED |

**Belangrijk architectuurfeit:** de echte applicatie-shell leeft in `client/src/components/examples/MultiTenantDemo.tsx` — ondanks de map `examples/`. Dit is een groot, hand-gerold conditioneel render-bestand zonder route-guards of lazy-loading. (VERIFIED, `App.tsx:98`.)

## 3. Hoofdmodules (backend `contracts/`)

| Module | Verantwoordelijkheid | VERIFIED? |
|---|---|---|
| `workflow_state_machine.py` | Canonieke state-machine: 14 interne `WorkflowState`-waarden, toegestane transities, rol→actie-matrix, transitie-audit | VERIFIED |
| `care_lifecycle_v12.py` | v1.2 lifecycle-uitbreidingen | VERIFIED (naam), inhoud deels |
| `models.py` | `CareCase`, `CaseIntakeProcess`, `CaseAssessment`, `PlacementRequest`, `Document`, `CaseDecisionLog`, `AuditLog`, providerdata | VERIFIED |
| `provider_matching_service.py` | Deterministische, regelgebaseerde matchingengine met uitleg + trade-offs | VERIFIED |
| `provider_pipeline.py` / `provider_adapters.py` | ETL voor providerdata (staging→validate→promote), echte adapters (CSV/AGB/HTTP) + fixture | VERIFIED |
| `permissions.py` | Object-level autorisatie, providerzichtbaarheid via `PlacementRequest` | VERIFIED |
| `tenancy.py` | Org-scoping helpers (`get_scoped_object_or_404`) | VERIFIED |
| `governance.py` | `log_case_decision_event` (strict audit, blokkeert bij falen) | VERIFIED |
| `api/views.py` | Alle workflow-mutatie-endpoints | VERIFIED |
| `views.py` | Legacy server-rendered HTML-views (parallelle mutatie-oppervlakte) | VERIFIED |

## 4. Rollen (autorisatiemodel)

Enforced via `WorkflowRole` (`workflow_state_machine.py`). Er bestaan **drie** technische rollen; "Aanmelder" en "Platform/AI" zijn *product*-concepten zonder eigen technische rol.

| Rol (technisch) | Mag | Mag NIET | VERIFIED? |
|---|---|---|---|
| `GEMEENTE` | Casus aanmaken/compleet maken, matching valideren, plaatsing bevestigen, regie | Provider accept/reject uitvoeren | VERIFIED (`_ROLE_ACTIONS`) |
| `ZORGAANBIEDER` | Capaciteitssignalen, gestructureerd accepteren/weigeren/info-verzoek, intake starten; mag ook casus aanmaken | Gemeente-validatie/plaatsing bevestigen | VERIFIED |
| `ADMIN` | Alle acties | — | VERIFIED |
| *Aanmelder* (product) | Geen eigen rol — wordt afgedwongen als `GEMEENTE` of `ZORGAANBIEDER` | — | VERIFIED (doctrine + code) |

**Randgeval (risico):** `resolve_actor_role` valt bij elke uitzondering **fail-open terug op `GEMEENTE`** (`workflow_state_machine.py:186-192`). Zie Risk Register R2.

## 5. Datadomeinen

- **Casus / aanmelding:** `CareCase` (UI-fase via `CasePhase`-enum, 6 waarden `models.py:529-535`) + `CaseIntakeProcess` (gezaghebbende `workflow_state`). **Workflow-state is gedupliceerd** over twee modellen, in aparte `save()`-calls geschreven.
- **Beoordeling/samenvatting:** `CaseAssessment` (intern "assessment" = de Samenvatting/Zorgvraag-stap; drie namen voor één concept).
- **Plaatsing/aanbiederreactie:** `PlacementRequest` (`proposed_provider`/`selected_provider`, `provider_response_status`, `recorded_by`).
- **Providerdata:** `Zorgprofiel`, `Vestiging`, `CapaciteitRecord`, `ContractRelatie`, `ProviderRegioDekking`, `PrestatieProfiel`.
- **Documenten:** `Document` (`is_confidential`, voorspelbaar uploadpad `documents/<id>/<filename>`).
- **Audit:** `CaseDecisionLog` (append-only, immutable, `models.py:1501-1618`) + `AuditLog` (model-change log).
- **Geo/regio:** Jeugdregio-backbone, NL-referentiegeo, `RegionalConfiguration`/`MunicipalityConfiguration`.

## 6. Routes & schermen (frontend)

Volledige route-inventaris staat in `CAREON_PRODUCT_UX_AUDIT.md` §A. Kernsamenvatting:

- **Echte, op API aangesloten operationele pagina's:** Regiekamer/Coördinatie (`SystemAwarenessPage`), Aanmeldingen (`WorkloadPage`), Matching (`MatchingPageWithMap`/`MatchingQueuePage`), Reacties/Aanbiederreactie (`AanbiederreactiePage`), Plaatsingen (`PlacementPage`/`PlacementTrackingPage`), Acties, Casusdetail (`CaseExecutionPage`), Intake (`IntakeListPage`), plus Zorgaanbieders/Gemeenten/Regio's/Signalen/Documenten/Audittrail/Instellingen.
- **Mock/statisch in een live pagina:** `RapportagesPage` (hardcoded `reportTemplates` + `exportHistory` met nepdatums). (VERIFIED)
- **Stub:** `/gebruikers` (inline placeholder). (VERIFIED)
- **Dode/legacy footprint:** complete ongerelateerde e-commerce codebase (~20 componenten + 8 datalibs, 0 live referenties), alle `components/examples/*`-demo's, dode provider-dashboards. (VERIFIED via grep)

## 7. Kernflows (canoniek, v1.2)

`Aanmelding → Matching → Aanbiederreactie → Plaatsing → Intake`

De backend dwingt deze volgorde af en staat geen overslaan toe behalve via expliciete, geauditeerde transities (`_ALLOWED_TRANSITIONS`, `evaluate_transition`). Volledige end-to-end-status per stap: zie `CAREON_END_TO_END_FLOW_AUDIT.md`.

**Kerntegenstelling (doctrine-drift):** de codebase implementeert intern een **7-staps** model met `SUMMARY_READY` ("Samenvatting") en `GEMEENTE_VALIDATED` ("Gemeente Validatie") als verplichte, niet-overslaanbare staten (`workflow_state_machine.py:68-73`). v1.2 zegt dat dit géén primaire fasen zijn. De **frontend** klapt deze al correct samen tot de 5 canonieke fasen (`client/src/lib/decisionPhaseUi.ts:18-32`), maar de in-repo doctrine-docs (AGENTS.md, FOUNDATION_LOCK.md) en sommige componenten (`CaseExecutionPage`, "legacy phase wording") doen dat nog niet. v1.2 stáát een gemeente-validatie als *approval-status* toe "when explicitly required" — dus de oplossing is presentatie/governance, niet de staat verwijderen. Zie Roadmap P1.

## 8. Wat werkt / gedeeltelijk / mock / legacy

| Categorie | Onderdelen |
|---|---|
| **Werkt end-to-end (VERIFIED)** | Multi-tenant isolatie (object-level), providerzichtbaarheid via `PlacementRequest`, state-machine transitie-enforcement, matchingengine (advisory + uitleg + trade-offs, geen auto-transitie), append-only audit op transities, provider accept/reject/info-flow, plaatsing bevestigen, intake starten |
| **Gedeeltelijk** | "Start matching" heeft geen losse endpoint (zit verstopt in `assessment-decision`); intake = alleen statusflip, geen afsprakenplanning; documentupload alleen via legacy HTML-form, geen JSON-API |
| **Mock/demo** | `RapportagesPage` (statische data), `/gebruikers` (stub), `components/examples/*` (dood), legacy e-commerce libs (dood) |
| **Legacy (parallel oppervlak)** | Server-rendered HTML-transitie-endpoints in `views.py` zijn default actief (`CAREON_PILOT_SPA_ONLY=False`, `settings.py:317`) |

## 9. Technische afhankelijkheden & config

- **Run:** backend `python manage.py runserver` (settings `config.settings`, SQLite-fallback); frontend `cd client && npm run dev`. Demo-account: `test@gemeente-demo.nl` / `DemoTest123!`. Seed-master: `seed_demo_data`, daarna `seed_pilot_e2e`. (VERIFIED, zie `START_HERE.md`.)
- **Feature flags:** `CAREON_PILOT_SPA_ONLY`, `CAREON_PILOT_UI`, `FEATURE_FREEZE_ACTIVE` (default True), `SSO_ENABLED`, `PILOT_AUTO_BOOTSTRAP`, `PILOT_FORCE_RESET`.
- **CI (`platform-guardrails.yml`):** draait alleen `pytest tests/` + `compileall` + terminology-guard + prod `check --deploy`. **Geen** frontend-test/typecheck/build-job; `contracts/tests.py` valt buiten CI.
- **Statische type-veiligheid is effectief afwezig:** `pyrightconfig.json` staat op niet-bestaande `pythonVersion 3.15` met onderdrukte categorieën; **geen `tsconfig.json` en geen typecheck-script in `client/`**.

## 10. Belangrijkste afhankelijkheden voor pilot-waardigheid

1. Documentafhandeling in productie (geen geauthenticeerde download-route) — zie Risk R1.
2. Doctrine/UI-uitlijning op het v1.2 5-fasen-model.
3. Half-geland form-refactor in de working tree dat 10 backend-tests + 3 frontend-tests rood maakt (zie Flow Audit & Risk R8).
