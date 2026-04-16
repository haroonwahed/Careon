# Pilot Friday Dry-Run Deck - 2026 W16

Session date: 2026-04-17 (Friday)  
Duration: 90 minutes  
Lead: Team Lead / Reviewer  
Participants: Regiekamer Lead, Matching Operator, Care Coordinator, Product/Ops Support

---

## Slide 1 - Objective

Run a strict, repeatable weekly decision quality review that:
- improves matching quality,
- reduces waiting time caused by avoidable loop behavior,
- improves data quality in case handling and explanations.

Session success means:
- 5 to 6 cases reviewed end-to-end,
- each case has exactly one classification and one primary reason,
- recurring patterns captured,
- follow-up actions assigned with owner and due date.

---

## Slide 2 - Data Reality This Week

Live command snapshot (current):
- Candidate cases: 0
- Reviewed candidates: 0
- Completion rate: 0.0%
- Override frequency: 0.0%

Source: `weekly_decision_review_2026_W16.json`

Interpretation:
- Weekly pipeline and command path are healthy.
- Pilot is still in bootstrap state for real weekly case volume.
- This dry-run uses simulated week artifacts to train facilitation discipline before full live volume.

---

## Slide 3 - Week 1 Storyline (Simulated)

Operational trend from Monday to Wednesday:
- Repeated no-response and needs-info loops slowed progress.
- Override quality was mixed (some evidence-based, some weak).
- Missing-data issues repeatedly created stalled decisions.
- Team started using replay context to separate bad outcomes from bad decisions.

Main risk entering Friday:
- debate about waiting versus acting at SLA checkpoints can delay action quality.

---

## Slide 4 - Review Protocol (Must Enforce)

For each case, execute this sequence with no deviations:
1. facts only (recommendation, user action, outcome)
2. force one classification
3. force one primary reason
4. capture one evidence sentence
5. move on at timebox

Allowed classifications:
- SYSTEM_CORRECT
- USER_CORRECT
- BOTH_ACCEPTABLE
- BOTH_SUBOPTIMAL

Allowed reasons:
- missing data
- provider mismatch
- capacity issue
- SLA timing
- explanation unclear
- external constraint

---

## Slide 5 - Case Pack For Dry-Run

1. C-128
- Classification: SYSTEM_CORRECT
- Reason: external constraint
- Evidence: recommendation was valid at decision time; provider availability changed later.

2. C-124
- Classification: USER_CORRECT
- Reason: provider mismatch
- Evidence: local context improved care-fit and execution.

3. C-119
- Classification: BOTH_SUBOPTIMAL
- Reason: SLA timing
- Evidence: waiting decision increased escalation pressure with no added value.

4. C-117
- Classification: BOTH_SUBOPTIMAL
- Reason: missing data
- Evidence: incomplete intake context blocked both recommendation and action quality.

5. C-130
- Classification: USER_CORRECT
- Reason: capacity issue
- Evidence: no-capacity signal made rematch the better operational decision.

6. C-112 (optional)
- Classification: BOTH_ACCEPTABLE
- Reason: explanation unclear
- Evidence: override did not clearly improve outcome over baseline.

---

## Slide 6 - Pattern Summary

Recurring patterns:
1. missing data causes avoidable quality loss
2. provider capacity and no-response behavior heavily affects outcomes
3. override reason quality is inconsistent

System-side friction:
- needs-info loops feel repetitive without stronger changed-context cues
- SLA transition timing is seen as rigid in edge cases

Team-side friction:
- hesitation before classification
- emotional debate after visible negative outcomes

---

## Slide 7 - Action Register (From Simulation)

1. ACT-001
- Action: mandatory one-sentence evidence rule for every override
- Owner role: Care Coordinator
- Due: 2026-04-19
- Success signal: weak override rationale count drops week-over-week

2. ACT-002
- Action: missing-data closure pass for top 3 priority cases each morning
- Owner role: Team Lead
- Due: 2026-04-19
- Success signal: missing-data share drops next review

3. ACT-003
- Action: 15-minute SLA fairness huddle with two replay examples
- Owner role: Regiekamer Lead
- Due: 2026-04-18
- Success signal: fewer continue-wait decisions without evidence

4. ACT-004
- Action: provider friction watchlist and fallback path in triage
- Owner role: Matching Operator
- Due: 2026-04-19
- Success signal: fewer repeated rematches for same provider cluster

5. ACT-005
- Action: explanation checkpoint before final provider action on priority cases
- Owner role: Team Lead
- Due: 2026-04-19
- Success signal: replay reference appears in all reviewed case notes

---

## Slide 8 - Architecture and Trust Guardrails

Core flow continuity check:
- Intake: missing-data readiness is explicitly reviewed
- Analyse: replay evidence and reasoning are captured
- Match: recommendation and override quality are compared
- Plaatsing: outcome progression or stall is evaluated
- Monitoring: recurring patterns and action signals are tracked
- Optimalisatie: weekly actions are assigned and measured

Compliance and municipality-readiness check:
- explainability: every case has reason + evidence sentence
- auditability: case facts, classification, and owner actions are recorded
- role clarity: session participants and owners are explicit
- data minimization: review focuses on decision signals, not broad personal detail

---

## Slide 9 - Facilitator Script Anchors

Opening sentence:
- Today we are testing decision quality discipline, not assigning blame.

Non-negotiable enforcement:
- classification before discussion
- one reason per case
- move on when timebox ends

Intervention cues:
- if discussion drifts, return to facts and force classification
- if reason is vague, ask for one concrete primary reason
- if debate escalates, capture disagreement as a follow-up action and continue

---

## Slide 10 - End-Of-Session Outputs

The session is complete only if all outputs exist:
1. reviewed case list with classification and reason
2. recurring pattern list (system and team)
3. prioritized action register with owner and due date
4. close-question responses captured

Post-session update checklist:
1. update `PILOT_WEEK1_EXECUTION_STATUS_2026_W16.md`
2. append outcomes to weekly review sheet
3. update action register statuses
4. re-run weekly command at week close

Command:
- `.venv/bin/python manage.py weekly_decision_review --json --output docs/pilot_runs/weekly_decision_review_2026_W16.json`
