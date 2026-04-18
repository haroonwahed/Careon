# Internal Pilot Week 1

## Goal

Validate trust in the core flow, not just technical correctness:

Casus -> Beoordeling -> Matching -> Plaatsing -> Opvolging

Success means users keep moving without help and believe the system is doing the right thing.

## Participants

- 1 to 2 casusregisseurs
- 1 admin
- 1 member with beperkte rol
- Maximum 4 to 5 people total

## Setup

1. Start the app with `bash scripts/dev_up.sh`.
2. If you need clean demo data, run `.venv/bin/python manage.py seed_redesign_data --reset`.
3. Confirm the UI stylesheet loads at `/static/css/dist/styles.css` before the first session.
4. Prepare one observer to take notes. Do not let the observer help during tasks.

## Session Rules

- Run one participant at a time.
- Ask them to think aloud.
- Do not explain navigation unless the product is fully blocked.
- Record exact pauses, wrong clicks, and questions.
- A pause longer than 3 seconds counts as hesitation.

## Scenarios

### Scenario 1: Happy flow

Participant tasks:

1. Nieuwe casus aanmaken.
2. Beoordeling toevoegen.
3. Naar matching gaan.
4. Een aanbieder kiezen.
5. Plaatsing openen.
6. Een taak toevoegen.
7. Een signaal toevoegen.
8. Een document toevoegen.
9. Terug naar de casus gaan en de status uitleggen.

Observe:

- hesitation
- wrong clicks
- confusion about the next step
- whether the participant asks if something saved correctly

### Scenario 2: Incomplete case

Participant tasks:

1. Open een casus zonder beoordeling.
2. Probeer naar matching te gaan.

Observe:

- whether the system guides or confuses
- whether the next step is obvious
- whether the participant leaves the case unnecessarily

### Scenario 3: Member read-only

Participant tasks:

1. Open een casus.
2. Try to edit or create follow-up items.

Observe:

- whether the product explains read-only status clearly
- whether blocking feels silent or understandable
- frustration signals

### Scenario 4: Edge behavior

Participant tasks:

1. Open a case without placement.
2. Open a case with signals.
3. Open a case with multiple tasks.

Observe:

- clarity versus overload
- whether the participant can prioritize
- whether they understand what needs attention first

## Observation Sheet

Record each issue using this format:

| Time | Scenario | Screen | What happened | User words | Severity |
| ---- | -------- | ------ | ------------- | ---------- | -------- |
| 09:12 | Happy flow | Assessment detail | User paused and scanned both CTA cards | "Where do I do this next?" | High |

Severity guidance:

- High: blocks flow, creates mistrust, or causes repeated permission confusion
- Medium: user recovers alone but hesitates or double-checks
- Low: minor friction with no visible loss of trust

## What To Listen For

Positive trust signals:

- "ok this makes sense"
- confident clicks without backtracking
- no save anxiety

Negative trust signals:

- "wait, what?"
- "where do I do this?"
- repeated backtracking
- hesitation before confirm actions
- asking whether a change saved

## Daily Log Review

Run this at the end of each pilot day:

```bash
.venv/bin/python scripts/pilot_log_summary.py
```

Use this when you want to rescan the full current log:

```bash
.venv/bin/python scripts/pilot_log_summary.py --all
```

Watch for these categories:

- `matching_invalid_intake_filter`
- `matching_forbidden`
- `case_update_forbidden`
- `assessment_create_forbidden`
- `assessment_update_forbidden`
- `case_scoped_create_forbidden`

Interpretation:

- Same route repeated means likely UX confusion.
- Same permission error repeated means roles are unclear in the UI.
- A single isolated event is not a pilot-priority fix.

## Pilot Cadence

### Day 1 to 2

- Run sessions.
- Observe only.
- Do not fix during the sessions.

### Day 3

- Review notes and log summary.
- Identify the top 3 friction points by repetition and severity.

### Day 4 to 5

- Fix only broken flows, misleading UI, permission confusion, or repeated user mistakes.
- Ignore visual polish, backend naming cleanup, architecture refactors, and one-off ideas.

## Week 1 Decision

### Go

- Users complete the full flow without help.
- No repeated confusion points.
- No critical permission surprises.
- Logs show no major misuse pattern.

### Hold

- Users get stuck in the same place.
- Matching or placement remains unclear.
- Case detail is not understood.
- Roles feel inconsistent.

### No-Go

- Users cannot complete the flow.
- Data ends up wrong or unclear.
- Trust is visibly low.
