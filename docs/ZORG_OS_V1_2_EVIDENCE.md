# Zorg OS v1.2 — implementatie-evidence (kort)

> **Superseded for product canon:** strategy, UX law, and terminology are governed by **v1.3** (`docs/Zorg_OS_Product_System_Core_v1_3.md`, `docs/FOUNDATION_LOCK.md`, `docs/ZORG_OS_V1_3_STRATEGIC_REALIGNMENT_EVIDENCE.md`). Dit document blijft relevant als **technische** evidence voor de v1.2 API- en schema-uitbreidingen totdat die worden vervangen of samengevoegd.

## Gewijzigde bestanden (belangrijkste)

- `contracts/models.py` — workflowstates, zorgvormen, `entry_route`, budgetvelden op `PlacementRequest`, modellen `CaseCareEvaluation`, `ProviderCareTransitionRequest`, audit `EventType`-uitbreidingen.
- `contracts/workflow_state_machine.py` — transitietabel, acties, `derive_workflow_state`.
- `contracts/care_lifecycle_v12.py` — budget/zorgvormregels, serialisatie evaluaties.
- `contracts/decision_engine.py` — fasen/prioriteit, `governance_queues` in Regiekamer-overview.
- `contracts/api/views.py` — provider accept + budget, intake-create wijkteam, placement detail, nieuwe endpoints (early lifecycle, budget, monitoring, evaluaties, doorstroom).
- `contracts/urls.py` — routes voor v1.2 API’s.
- `contracts/migrations/0063_governance_v12_lifecycle.py` — schema.
- `client/src/lib/workflowStateMachine.ts`, `client/src/lib/workflowUi.ts` — canonieke states/kolommen.
- `tests/test_governance_v12_lifecycle.py`, `tests/test_workflow_integrity.py` — nieuwe/aangepaste tests.
- `docs/FOUNDATION_LOCK.md` — verwijzing naar v1.2.

## Nieuwe states / enums / modellen

- **WorkflowState:** `WIJKTEAM_INTAKE`, `ZORGVRAAG_BEOORDELING`, `BUDGET_REVIEW_PENDING`, `ACTIVE_PLACEMENT`.
- **WorkflowAction:** o.a. `COMPLETE_WIJKTEAM_INTAKE`, `COMPLETE_ZORGVRAAG_ASSESSMENT`, `BUDGET_*`, `ACTIVATE_PLACEMENT_MONITORING`, `SUBMIT_TRANSITION_REQUEST`, `RESOLVE_TRANSITION_FINANCIAL`.
- **CaseIntakeProcess.EntryRoute:** `STANDARD`, `WIJKTEAM`.
- **CareForm (intake/plaatsing):** o.a. `LOW_THRESHOLD_CONSULT`, `AMBULANT_SUPPORT`, `VOLUNTARY_OUT_OF_HOME`, `CONTINUATION_PATHWAY` (+ legacy `OUTPATIENT` / `DAY_TREATMENT`).
- **PlacementRequest.BudgetReviewStatus:** `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`, `NEEDS_INFO`, `DEFERRED`.
- **CaseCareEvaluation:** status (`UPCOMING`, `OVERDUE`, `COMPLETED`), uitkomst (`CONTINUE`, `TAPER`, …).
- **ProviderCareTransitionRequest:** verzoek + `FinancialValidationStatus`.
- **CaseDecisionLog.EventType:** `BUDGET_DECISION`, `EVALUATION_OUTCOME`, `TRANSITION_REQUEST`, `FINANCIAL_VALIDATION`.

## UI / routes (API)

- `POST /care/api/cases/intake-create/` — optioneel `entry_route: "WIJKTEAM"`.
- `POST /care/api/cases/<case_id>/early-lifecycle/` — `complete_wijkteam`, `open_casus_from_zorgvraag`.
- `POST /care/api/cases/<case_id>/budget-decision/` — gemeente budgetbesluit.
- `POST /care/api/cases/<case_id>/activate-monitoring/` — `INTAKE_STARTED` → `ACTIVE_PLACEMENT`.
- `GET|POST /care/api/cases/<case_id>/evaluations/` — lijst / plan evaluatie (POST gemeente).
- `PATCH /care/api/cases/<case_id>/evaluations/<evaluation_id>/` — status/uitkomst.
- `POST /care/api/cases/<case_id>/transition-request/` — aanbieder (ingelogd als zorgaanbieder).
- `POST /care/api/cases/<case_id>/transition-request/<transition_id>/financial/` — gemeente financiële validatie.
- `GET /care/api/regiekamer/decision-overview/` — bevat nu `governance_queues` (wachtrijen).

## Tests toegevoegd

- `tests/test_governance_v12_lifecycle.py` — budgetblokkade, provider accept (residentieel vs ambulant), wijkteam intake-create, financiële validatie doorstroom.

## Verificatie

- Volledige suite: `823 passed` (lokaal met `uv run pytest`).

## Resterende risico’s

- **SPA:** `executeCaseAction` roept budget-, early-lifecycle- en activate-monitoring-endpoints aan; aparte schermen voor evaluaties/transities blijven API-first tot ze expliciet in de casus-UX worden gebouwd.
- **Budget afwijzen:** backend zet casus op `MATCHING_READY`, reset aanbieder/plaatsing conform rematch en zet marker `[BUDGET_REJECT_REMATCH]`; zie `GovernanceV12BudgetRejectRematchTests`.
- **`ACTIVE_PLACEMENT`:** na geslaagde `START_INTAKE` ketent de provider-flow automatisch door naar `ACTIVE_PLACEMENT` wanneer de state machine dit toestaat; aparte `activate-monitoring`-call blijft beschikbaar voor handmatige correcties.
- Migratie `0063` moet op elke omgeving draaien vóór productie-deploy.
