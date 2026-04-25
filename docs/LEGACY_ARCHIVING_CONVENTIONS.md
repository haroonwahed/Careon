# Legacy Archiving Conventions

Scope: keep inactive or experimental code isolated without breaking the active Zorgregie spine.

## Rules

1. Do not import from legacy/archive folders into active runtime code.
2. If runtime still depends on a legacy module, treat it as a blocker and document migration plan.
3. Archive first, delete later after at least one successful validation cycle.
4. Keep a README.md in each legacy/archive folder with file status and deletion candidacy.
5. New experiments belong in archive/legacy folders, not active runtime folders.

## Legacy Runtime Rule

- Active runtime modules must not import from legacy folders.
- Matching runtime uses contracts/provider_matching_service.py.

## Validation Minimum

- npm run build --prefix client
- ./.venv/bin/python manage.py check
- targeted workflow tests for intake/aanbieder beoordeling/matching flow
