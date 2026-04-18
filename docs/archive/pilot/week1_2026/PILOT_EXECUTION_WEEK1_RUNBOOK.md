# Zorg OS Pilot Execution Week 1 Runbook

Use this document to run the pilot in real time.

## Scope
- Pilot objective: prove decisions become visible, structured, and improvable.
- Core flow: Casus -> Beoordeling -> Matching -> Plaatsing -> Intake.
- Duration: 5 working days.

## Team Setup
- Regiekamer Lead: owns morning triage and escalation control.
- Matching Operator: owns midday execution and provider-response actions.
- Care Coordinator: owns intake quality and missing-data closure.
- Team Lead or Reviewer: owns Friday review facilitation.
- Product or Ops Support: owns session support and follow-up tracking.

## Day 0 Preparation Checklist
- Confirm all pilot users can sign in.
- Confirm weekly command works: .venv/bin/python manage.py weekly_decision_review.
- Confirm shared location for artifacts: docs/pilot_runs.
- Confirm one facilitator and one note taker.
- Confirm standing meeting slots:
  - Morning triage: 30 to 45 min
  - Midday execution check: 30 min
  - End of day control check: 20 to 30 min
  - Friday review: 90 min

## Daily Routine

### Morning Regiekamer Triage
- Open priority queue and escalation list.
- Assign owner and next action for each high-priority case.
- Confirm no case is ownerless after triage.

Output required:
- Updated daily log entry in docs/templates/PILOT_DAILY_STANDUP_LOG.md copy.

### Midday Execution
- Process provider responses.
- Resolve needs-info loops.
- Trigger resend or rematch where required.
- Capture reason whenever recommendation is overridden.

Output required:
- Notes on loops, friction, and notable overrides.

### End of Day Control
- Count moved, stuck, and unresolved cases.
- Capture unclear ownership and stale actions.
- Add risks for next morning triage.

Output required:
- End-of-day section completed in daily log.

## Friday Weekly Review Session Script (90 min)

### 1. Open Session (5 min)
- State objective: learning, not blame.
- Confirm strict method: classify first, discuss second.

### 2. Case Review Loop (60 min, 5 to 6 cases max)
For each case:
1. Show facts only:
   - system recommendation
   - user action
   - outcome
2. Ask one question:
   - Given what we knew at the time, was this the right decision?
3. Force one classification:
   - SYSTEM_CORRECT
   - USER_CORRECT
   - BOTH_ACCEPTABLE
   - BOTH_SUBOPTIMAL
4. Force one reason:
   - missing data
   - provider mismatch
   - capacity issue
   - SLA timing
   - explanation unclear
   - external constraint
5. Move on.

### 3. Pattern Check (10 to 15 min)
Ask:
- What did we see multiple times?
- Where did the system struggle?
- Where did we struggle?

Record only recurring patterns.

### 4. Close (5 min)
Ask:
- Would you actually use this weekly?
- What felt unclear or annoying?
- What would make this 10x more useful?

## Facilitator Observation Checklist
- Hesitation to classify.
- Confusion between SYSTEM_CORRECT and USER_CORRECT.
- Vague reason selection.
- Skipping replay evidence.
- Emotional argument replacing structured reasoning.

## Fix Now Rules
Fix immediately only if:
- Categories are misunderstood.
- Weekly command output is confusing in session.
- Replay cannot explain decisions.
- Output is not usable in discussion.

Ignore for now:
- UI polish requests.
- New AI feature ideas.
- New filters unless blocking session flow.
- Automation ideas not needed for pilot execution.

## End of Week Decision Gate
Pilot is ready to continue if:
- Team can classify decisions consistently.
- Team can explain why with evidence.
- Recurring patterns are identified.
- Actions are assigned with owners and deadlines.

Escalate to redesign if:
- Weekly review cannot be run as structured process.
- Decisions are discussed outside system evidence.
- Overrides remain random and unreasoned.
