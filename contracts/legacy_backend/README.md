# Legacy Backend Archive

Purpose: isolate historical provider matching services that were moved out of main backend modules.

## Archived Files

| File | Category | Why Archived | Reusable Ideas | Deletion Candidate |
| --- | --- | --- | --- | --- |
| provider_matching_service.py | Uncertain business logic | Historical deterministic matching engine with explainability fields and hard exclusions | High (eligibility gates, explainability, trade-off output) | No, currently blocked by active dependency |

## Runtime Status

- Important blocker: active imports exist in contracts/views.py and contracts/api/views.py for provider_matching_service.py.
- This means the module is currently legacy-located but runtime-required.
- Do not remove until a non-legacy matching service is introduced and contracts/views.py is migrated.

## Handling Rule

- No new features in this folder.
- Only compatibility/stability fixes are allowed.
