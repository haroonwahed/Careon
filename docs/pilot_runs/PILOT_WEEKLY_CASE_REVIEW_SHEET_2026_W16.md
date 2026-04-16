# Pilot Weekly Case Review Sheet

Week: 2026-W16  
Session lead: Team Lead / Reviewer  
Participants: Regiekamer Lead, Matching Operator, Care Coordinator, Product/Ops Support  
Duration: 90 minutes

Execution status: DRY-RUN EXECUTED ON 2026-04-15 (facilitator rehearsal)  
Live participant validation: scheduled for 2026-04-17

## Case Review Loop (5 to 6 cases max)

### Case 1 - C-128
Facts only:
- System recommendation: Provider A
- User action: accepted recommendation
- Outcome: provider rejected later

Question:
- Given what we knew at the time, was this the right decision?

Classification:
- SYSTEM_CORRECT

Primary reason:
- external constraint

Evidence sentence:
- Recommendation fit was valid at decision time; downstream rejection came from provider-side availability shift.

### Case 2 - C-124
Facts only:
- System recommendation: Provider B
- User action: selected Provider C
- Outcome: successful progression to placement

Question:
- Given what we knew at the time, was this the right decision?

Classification:
- USER_CORRECT

Primary reason:
- provider mismatch

Evidence sentence:
- Local context on care fit and practical coordination favored Provider C and improved execution quality.

### Case 3 - C-119
Facts only:
- System recommendation: resend at SLA checkpoint
- User action: continued waiting once
- Outcome: escalation pressure increased, no progress

Question:
- Given what we knew at the time, was this the right decision?

Classification:
- BOTH_SUBOPTIMAL

Primary reason:
- SLA timing

Evidence sentence:
- System signal was delayed in user adoption and wait decision did not create new value; timeline worsened.

### Case 4 - C-117
Facts only:
- System recommendation: proceed with matching path
- User action: delayed due to missing intake data completion
- Outcome: case stalled and required repeat review

Question:
- Given what we knew at the time, was this the right decision?

Classification:
- BOTH_SUBOPTIMAL

Primary reason:
- missing data

Evidence sentence:
- Neither recommendation nor action succeeded because essential intake context was incomplete.

### Case 5 - C-130
Facts only:
- System recommendation: Provider D
- User action: switched to Provider E after no-capacity signal
- Outcome: progressed after rematch

Question:
- Given what we knew at the time, was this the right decision?

Classification:
- USER_CORRECT

Primary reason:
- capacity issue

Evidence sentence:
- Capacity shift made original recommendation non-viable; operator adjustment improved outcome.

### Case 6 (optional) - C-112
Facts only:
- System recommendation: Provider X with clear rationale
- User action: override to Provider Y with weak reason
- Outcome: no clear improvement

Question:
- Given what we knew at the time, was this the right decision?

Classification:
- BOTH_ACCEPTABLE

Primary reason:
- explanation unclear

Evidence sentence:
- Override rationale did not clearly improve decision quality; both options were workable but reasoning quality was weak.

## Pattern Check (10 to 15 min)
Recurring patterns only:
1. Missing data still drives avoidable decision quality loss.
2. Provider behavior (capacity/no-response) influences outcomes more than expected.
3. Override quality varies from evidence-based to unstructured.

Where system struggled:
1. Needs-info loops feel repetitive without stronger context cues.
2. SLA transitions are correct but perceived as too rigid in edge cases.

Where team struggled:
1. Classification hesitation early in session.
2. Emotional argument tendency after visible negative outcomes.

## Session Close (5 min)
Would you use this weekly:
- Yes, if timebox is strict and case count stays capped.

What felt unclear or annoying:
- Repeated resend loops without obvious new context.

What would make this 10x more useful:
- Better in-session cueing for what changed since last action.

Dry-run verdict:
- Approve with conditions
- Conditions before live Friday run:
   1. Keep strict 90-minute timebox and forced classification rule.
   2. Ensure replay evidence is visible for each shortlisted case.
   3. Confirm owner names in action register before session close.

## Actions
1. Action: Introduce mandatory one-sentence evidence rule for every override in daily execution.
   - Owner: Care Coordinator
   - Due date: 2026-04-19
   - Success signal: weak override rationale count drops week-over-week
2. Action: Add morning missing-data closure pass for top 3 priority cases.
   - Owner: Team Lead
   - Due date: 2026-04-19
   - Success signal: missing data primary reason share decreases in next review
3. Action: Run 15-minute SLA fairness huddle using two real replay examples.
   - Owner: Regiekamer Lead
   - Due date: 2026-04-18
   - Success signal: fewer continue-wait decisions without evidence
