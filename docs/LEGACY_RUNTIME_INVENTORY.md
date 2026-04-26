# Legacy Runtime Inventory

Purpose: make the boundary between active Careon runtime code, compatibility shims, and archive candidates explicit.

This repository does **not** contain a separate external contract-management application. The only explicit legacy-language mention found in the runtime-facing tree is the terminology guard in `scripts/terminology_guard.py`, which blocks those words from user-facing text.

## Active runtime

These files are part of the Careon product runtime today:

- `contracts/provider_matching_service.py`
- `contracts/views.py`
- `contracts/api/views.py`

The matching engine itself is canonical Careon logic. It is not legacy-contract-management code.

## Compatibility shim

This file exists only to keep older imports working while the runtime still transitions:

- `contracts/legacy_backend/provider_matching_service.py`

Status:

- legacy-located
- runtime-required via current imports
- should not gain new product features

## Legacy-located archive candidate

This legacy surface has been removed:

- `contracts/legacy_backend/provider_filter_service.py` removed

Status:

- deleted from the repo
- provider-filter vocabulary now documented on the active provider workspace and matching surfaces

## Historical docs and conventions

These documents describe the migration and isolation rules around the legacy boundary:

- `docs/CAREON_STRUCTURAL_MIGRATION_PLAN.md`
- `docs/LEGACY_ARCHIVING_CONVENTIONS.md`
- `docs/PROVIDER_ARCHITECTURE.md`
- `docs/PROVIDER_DATA_ARCHITECTURE.md`
- `docs/CAREON_TRANSFORMATIEPLAN.md`
- `docs/CONTRACT_FRICTION_PLAN.md`

## What the inventory is *not*

- It is not a product backlog.
- It is not a legacy product cleanup plan.
- It is not a request to rename or delete active runtime code today.

## Practical rule

If a file is used by the active app and still lives in a legacy folder, treat it as compatibility-only until the runtime import path is moved to the canonical module.
