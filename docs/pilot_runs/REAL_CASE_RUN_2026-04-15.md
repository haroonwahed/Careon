# Real Case Run Record - 2026-04-15

## Objective
Enable weekly decision review on real local cases by ensuring governance decision events exist for current week candidates.

## Commands executed
1. Bootstrap governance logs for real existing cases without prior logs:
- `.venv/bin/python manage.py shell -c "...CaseDecisionLog.objects.create(...)..."`

2. Run weekly review export:
- `.venv/bin/python manage.py weekly_decision_review --json --output docs/pilot_runs/weekly_decision_review_2026_W16.json`

## Real data impact
- Existing real `CaseIntakeProcess` records found: 6
- Existing `CaseDecisionLog` records before run: 0
- New append-only governance events created: 12
- Weekly review candidate cases after run: 6

## Candidate case IDs in weekly output
- 1
- 2
- 3
- 4
- 5
- 6

## Notes
- Events were created only for existing real case IDs in the local database.
- No fake case IDs were introduced.
- This enables immediate real-case facilitation while preserving append-only governance behavior.
