# Careon – Copilot Instructions

## Project Facts

- **Stack**: Django 5.2.5, Python 3.15, Tailwind CSS (django-tailwind), SQLite (dev), PostgreSQL (prod)
- **App module**: `contracts/` — all models, views, forms, urls, and templates live here
- **URL namespace**: `careon:` (mounted at `/care/` in `config/urls.py`)
- **Templates**: `theme/templates/` — base layout, components, per-view templates
- **CSS source**: `theme/static_src/src/` — edit here, not in `staticfiles/`
- **Dev server**: `bash scripts/dev_up.sh` → HTTPS on `https://127.0.0.1:8000/`
- **Tests**: `python manage.py test tests/` or individual test modules in `tests/`
- **Terminology guard**: `python scripts/terminology_guard.py` — must pass before every commit
- **Pre-commit**: `.pre-commit-config.yaml` uses `.venv/bin/python`

## Canonical Model Map

All models are in `contracts/models.py`. These are the authoritative names:

| Concept | Model | Notes |
|---|---|---|
| Case | `CareCase` | Central object — everything belongs to a case |
| Intake & assessment process | `CaseIntakeProcess` | Was `DueDiligenceProcess` — use `CaseIntakeProcess` |
| Assessment | `CaseAssessment` | Belongs to `CaseIntakeProcess` |
| Placement / Indication | `PlacementRequest` | `related_name='indications'` on `CaseIntakeProcess` |
| Task | `Deadline` | User-facing care tasks / follow-ups |
| Care task | `CareTask` | Workflow-bound task steps |
| Provider | `Client` (with `ProviderProfile`) | Zorgaanbieder |
| Municipality config | `MunicipalityConfiguration` | NOT a case — do not route to case list |
| Region config | `RegionalConfiguration` | NOT a case — do not route to case list |
| Signal | `CareSignal`, `CaseRiskSignal` | Risk/care signals on a case |
| Budget | `Budget`, `BudgetExpense` | Belongs to a case |
| Workflow | `Workflow`, `WorkflowStep` | Template-driven care flow steps |
| Organisation | `Organization`, `OrganizationMembership` | Multi-tenant root |

`TrustAccount` and `CareConfiguration` are legacy holdovers — treat as low-priority technical debt.

## Core User Flow

```
CASE → INTAKE → ASSESSMENT → MATCHING → INDICATION → PLACEMENT → FOLLOW-UP
```

Every view, form, url, and template must reinforce this linear flow. Child objects (assessments, tasks, placements, signals, budget) must navigate back to their parent case.

## Non-Negotiables

- Do not redesign the UI. Preserve dark theme, sidebar layout, card components, spacing, visual hierarchy.
- Do not add legacy legal/CLM/CMS terminology to any user-facing surface.
- Do not route Casussen to `CareConfiguration`, `MunicipalityConfiguration`, or `RegionalConfiguration`.
- Do not leave half-migrated terminology in templates or forms.
- `careon:` is the URL namespace — never use `contracts:` in templates.
- Always run `python scripts/terminology_guard.py` after changes to Python/template files.

## Banned Terms (user-facing)

`contract`, `matter`, `legal`, `trademark`, `filing`, `counterparty`, `trust account`, `IOLTA`, `billing`, `attorney`, `practice area`, `ethical wall`, `legal hold`, `opposing party`, `court name`

These may exist in ORM field names / DB columns as compatibility shims — that is intentional and low-priority. Do not surface them in templates, labels, or context keys.

## Care-Native Vocabulary

Use these consistently: `casus / case`, `intake`, `beoordeling / assessment`, `matching`, `indicatie / indication`, `plaatsing / placement`, `opvolging / follow-up`, `signalen`, `zorgaanbieders / providers`, `gemeenten / municipalities`, `regio's / regions`, `wachttijden / wait times`, `capaciteit`, `budget`, `regie / coordination`, `gegevensbeheer / privacy`

## Sidebar Navigation (target state)

Dashboard · Casussen · Taken · Matching · Zorgaanbieders · Gemeenten · Regio's · Capaciteit & budget · Wachttijden · Rapportages & regie · Documenten · Privacy & gegevensbeheer · Instellingen

Intake, assessment, indication, placement are sub-flows inside a case — not primary sidebar entries.

## UX Standards

- Every screen must make the next action obvious.
- Empty states must tell the user what to do next.
- KPI cards should link to the relevant list/action where possible.
- Tasks = daily work queue, not a generic dump.
- Users must always be able to start a new case from one clear entry point ("Nieuwe casus").

## Before Making Any Change

1. Inspect the relevant models, views, urls, forms, and templates first.
2. State briefly what is wrong.
3. Propose the smallest coherent fix.
4. Implement it fully.
5. Check for ripple effects across urls, views, forms, templates, and tests.

## Task Classification and Skill Routing

Before acting on a request, first classify the task type:

- architecture
- data ingestion
- matching logic
- backend/API
- frontend/UX
- compliance/security

Then prefer the most relevant available skill for that task.

If multiple skills apply, prioritize in this order:

1. architecture constraints
2. domain compliance
3. task-specific implementation skill

If no skill is clearly relevant, fall back to general instructions and preserve current architecture.

## Implementation Priority Order

1. `CareCase` list/detail/create is the most important flow — fix this before anything else
2. Wire `CaseIntakeProcess` into the case detail view
3. Wire `CaseAssessment` into the case flow
4. Make matching visible and actionable from the case
5. Make `PlacementRequest` (indication) visible and actionable
6. Clean remaining terminology and routing confusion

## Code Quality

- Follow existing project patterns where healthy.
- Update urls, views, forms, templates, and tests together — never just one layer.
- If a model rename is risky, fix frontend and routing first, then propose the migration separately.
- Prefer incremental refactors. No chaotic rewrites.
- When finding conflicting logic, document which version is authoritative.
- No new dependencies without a clear reason.

## Audit Standard

Be critical, not polite. Look for: wrong model usage, broken routing, duplicate concepts, legacy naming in templates, dead-end UX, missing list/detail/create flows, inconsistent terminology, missing empty states, models with no user-facing flow, mock features presented as real.
