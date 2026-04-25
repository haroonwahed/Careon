# Careon Structural Migration Plan

Foundation reference:

- `docs/ZORG_OS_FOUNDATION_APPROACH.md`
- `docs/FOUNDATION_LOCK.md`

All migration decisions in this plan must remain compatible with the canonical workflow and backend source-of-truth constraints.

## Goal

Replace the remaining legacy contract-platform runtime symbols and data model names with Careon-native terminology without breaking tenant isolation, URLs, admin flows, or production data.

## What This Plan Covers

- Runtime model and service symbols that still use legal or contract-management semantics.
- API and route alias cleanup.
- Database schema renames that need forward migrations rather than text replacement.
- Validation and rollout sequencing for a safe multi-PR migration.

## What This Plan Does Not Cover

- Historical migration files that should remain immutable.
- Generated environment artifacts such as local virtualenv activation scripts.
- Cosmetic text-only cleanup already handled in templates and active docs.

## Current Structural Hotspots

Primary hotspots still tied to old semantics:

- `Contract` model and related API/service code.
- `Matter` model and list/detail flows that currently represent configuration dossiers.
- `DueDiligenceProcess`, `DueDiligenceTask`, `DueDiligenceRisk` workflow models.
- `TrademarkRequest` as a placement/indicatie surrogate.
- `SignatureRequest` as a provider-response/approval surface.
- Legacy optional modules such as `Invoice`, `TimeEntry`, `EthicalWall`, `LegalHold`, clause library, and counterparties.

## Proposed Target Naming

Recommended steady-state mapping:

| Current symbol | Target symbol | Notes |
| --- | --- | --- |
| `Contract` | `CareCase` | Chosen. Matches current user-facing case semantics and avoids generic `Record` naming. |
| `Matter` | `CareConfiguration` | Chosen. Avoids collision with generic framework/config terminology. |
| `DueDiligenceProcess` | `CaseIntakeProcess` | Reflects intake and aanbieder beoordeling flow. |
| `DueDiligenceTask` | `IntakeTask` | Narrower operational meaning. |
| `DueDiligenceRisk` | `CaseRiskSignal` | Matches current UI wording. |
| `TrademarkRequest` | `PlacementRequest` | Current runtime usage already behaves this way. |
| `SignatureRequest` | `ProviderResponseRequest` | Chosen. `ApprovalRequest` already exists and covers a separate decision flow. |
| `contracts` app namespace | keep temporarily, migrate later | Namespace rename is high blast radius and should come last. |

## Frozen Naming Decisions

These names are now the canonical targets for the migration sequence and should be treated as fixed unless a product requirement changes:

- `Contract` -> `CareCase`
- `Matter` -> `CareConfiguration`
- `DueDiligenceProcess` -> `CaseIntakeProcess`
- `DueDiligenceTask` -> `IntakeTask`
- `DueDiligenceRisk` -> `CaseRiskSignal`
- `TrademarkRequest` -> `PlacementRequest`
- `SignatureRequest` -> `ProviderResponseRequest`

Rationale:

- `CareCase` aligns with the current dashboard and route semantics (`casus`, `case_*`).
- `CareConfiguration` matches the live configuration UI while avoiding overly generic `Configuration` naming.
- `ProviderResponseRequest` avoids collision with the existing `ApprovalRequest` model and better fits the current dashboard wording around provider reaction.

## Migration Principles

- Keep behavior stable while renaming symbols.
- Prefer additive transitions with aliases before destructive removals.
- Separate Python symbol renames from database column/table renames when possible.
- Never edit historical migration files.
- Keep rollout evidence and rehearsals updated after each migration phase.

## Phase Plan

### Phase 1: Remove Dead Compatibility and Optional Legacy Modules

Scope:

- Inventory and confirm live runtime status for `Invoice`, `TimeEntry`, `EthicalWall`, `LegalHold`, clause library, and counterparties.
- Keep historical migrations/evidence intact while removing or neutralizing any remaining live-runtime residue.

Deliverables:

- Updated decision record in `docs/CAREON_LEGACY_REMOVAL_MATRIX.md` showing these module families are already removed from live runtime.
- Cleanup of any active-code residue that still presents those modules as current Careon product scope.

Validation gates:

- `tests.test_cross_tenant_isolation`
- `tests.test_redesign_components`
- `tests.test_case_repository_features`

### Phase 2: Rename Placement and Intake Workflow Symbols

Scope:

- Rename `TrademarkRequest` to `PlacementRequest`.
- Rename `DueDiligenceProcess` family to intake/case-process equivalents.
- Update forms, views, admin, and tests.

Current status:

- `PlacementRequest` is now the canonical Python model/form/admin symbol while `TrademarkRequest` remains as a compatibility alias.
- Active tests now prefer `placement_*` routes; legacy `trademark_request_*` aliases are still kept for compatibility.
- `CaseIntakeProcess`, `IntakeTask`, and `CaseRiskSignal` are now the canonical Python aliases; legacy `DueDiligence*` symbols remain for schema compatibility.
- Active tests now prefer `intake_*` routes; legacy `due_diligence_*` aliases are still kept for compatibility.
- Live runtime links now reverse to `intake_*` detail routes first; `due_diligence_*` remains as compatibility-only routing.
- `CareConfiguration` is now the canonical Python model/form/view alias while `Matter` remains as the schema-facing compatibility class.
- Active runtime routes now use `CareConfiguration*View` classes behind the existing `configuration_*` aliases; legacy `Matter*` view names remain compatibility-only in Python.
- `ProviderResponseRequest` is now the canonical Python model/form alias while `SignatureRequest` remains as the schema-facing compatibility class.

Implementation strategy:

- First rename Python classes and imports with compatibility aliases.
- Then add forward migrations for table and foreign-key rename operations if desired.

Validation gates:

- Dashboard
- Workflow dashboard
- Intake screens
- Placement-related tests and smoke flows

### Phase 3: Split Case Records from Configurations Cleanly

Scope:

- Rename `Matter` to `Configuration`.
- Keep route aliases during transition: `case_*` and `configuration_*` should point intentionally, not accidentally.
- Update templates so list/detail pages no longer mix configuration and case semantics.

Implementation strategy:

- Rename Python model and queryset usage first.
- Add model alias layer for one release if necessary.
- Only then perform DB-level rename migrations.

Validation gates:

- Configuration list/detail/create/update flows
- Search results
- Dashboard counts that consume configuration data

### Phase 4: Rename `Contract` to Care-Native Case Model

Scope:

- Replace `Contract` in models, services, forms, API payloads, and dashboard aggregations.
- Rename repository/service methods that still expose `contract_ids`, `contract_type`, and similar inputs.

Current status:

- `CareCase` is now the canonical Python model/form/admin symbol while `Contract` remains the schema-facing compatibility class.
- Repository services and domain DTOs now prefer `CareCase` and case-oriented local naming.
- Case detail and bulk-update APIs now prefer `case_*` naming while still accepting legacy `contract_*` compatibility inputs.
- Active repository, reminders, tenant-isolation, and UI integrity tests now create `CareCase` records directly.

Implementation strategy:

- Introduce the new model name as a Python alias over the same table first.
- Migrate serializer and API field names with backward-compatible adapters.
- After callers are updated, add schema/table rename migrations if needed.

Validation gates:

- Repository APIs
- Bulk update flows
- Dashboard metrics
- Notifications/reminders
- Tenant isolation

### Phase 5: Namespace and App-Layer Cleanup

Scope:

- Replace `careon:` URL naming where still misleading.
- Decide whether to keep the `contracts` Django app label or introduce a new app and compatibility shim.

Implementation strategy:

- Only start after model and service symbols are stable.
- Route aliases should remain for at least one release cycle.

## Database Strategy

Recommended order for DB work:

1. Rename Python symbols without changing tables.
2. Introduce compatibility aliases and adapters.
3. Add forward migrations for column/table renames in isolated PRs.
4. Rehearse on copied production-sized data.
5. Update evidence docs and rollback notes.

High-risk schema items:

- Foreign keys into `Contract` and `Matter`.
- Audit log references.
- Reminder and notification relationships.
- Dashboard queries joining workflow and approval tables.

## Suggested PR Sequence

1. Remove out-of-scope legacy modules.
2. Rename workflow and placement symbols.
3. Rename `Matter` to `Configuration` semantics in code.
4. Rename `Contract` to the chosen Careon case model.
5. Clean API payload names and service method signatures.
6. Clean route names and optional app namespace.

Each PR should include:

- Focused tests.
- `manage.py check`.
- Updated rollout/evidence commands if any test module names change.

## Required Validation Pack

Minimum regression pack after each structural PR:

```bash
python manage.py check
python manage.py test tests.test_case_repository_features -v 1
python manage.py test tests.test_redesign_components -v 1
python manage.py test tests.test_mentions_ai_reminders -v 1
python manage.py test tests.test_cross_tenant_isolation -v 1
```

For model/schema phases, also run:

```bash
python manage.py showmigrations contracts
python manage.py migrate --plan
```

## Decision Needed Before Execution

Naming decisions are now frozen above. Phase execution can proceed without additional naming review unless product scope changes.
