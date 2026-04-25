# Contract Friction Plan

Aanbieder Beoordeling date: 2026-04-24

Baseline product completeness: **71%**

Estimated product completeness gain for this chunk: **8%**

This chunk is about removing duplicate contracts and cleanup-only compatibility layers that still make the app feel layered instead of singular.

## Scope

### Task 1: Remove duplicate API alias exports

What to do:
- delete pure Python API aliases that duplicate the canonical handler names
- keep the canonical handlers and route names intact

Expected impact:
- less contract ambiguity
- fewer accidental imports of the wrong handler name

Status:
- completed for the duplicate API aliases that were actually unused

### Task 2: Keep the workflow route contract singular

What to do:
- preserve the canonical workflow routes
- retain only the compatibility routes that still have an active runtime reason
- document the remaining compatibility path rather than letting it multiply

Expected impact:
- one obvious way to reach each workflow surface

### Task 3: Verify no active code depends on removed aliases

What to do:
- run targeted searches for the removed symbols
- run the focused workflow and routing tests after cleanup

Expected impact:
- ensures this chunk removes friction without creating breakage

Status:
- completed
- focused workflow and UI integrity tests passed after the cleanup

Additional note:
- `case_create` now renders the canonical server-side intake form again, so the guided intake copy remains part of the public contract.

## Exit Criteria

- duplicate handler aliases are removed
- canonical route names remain the public contract
- no tests fail because of alias cleanup
- the remaining compatibility paths are explicitly documented
