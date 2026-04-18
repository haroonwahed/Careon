# Zorg OS Pilot Operations Playbook

Version: Pilot v1  
Audience: Care coordinators, matching operators, Regiekamer leads, team leads/reviewers, product/ops support

---

## 1. Pilot Overview

### Purpose of the pilot
The pilot validates that Zorg OS improves real care-allocation operations in day-to-day work, not only technical correctness.

Core operational flow:
Casus -> Beoordeling -> Matching -> Plaatsing -> Intake

### What success looks like in practical terms
- Teams use Zorg OS as the default workspace for case progression.
- Cases move forward with fewer stalls in provider-response and placement steps.
- SLA and escalation signals trigger timely action instead of late firefighting.
- Weekly decision reviews produce concrete, owned process improvements.
- Teams can explain why decisions were made using replay and audit evidence.

### What the system is expected to change in daily operations
- From ad-hoc follow-up to structured action ownership.
- From opaque decisions to explainable recommendation + action trails.
- From delayed escalations to controlled SLA-based intervention.
- From individual memory to team learning through weekly quality loops.

---

## 2. Roles and Responsibilities

### Care Coordinator
Primary responsibilities:
- Keep casus information complete and current.
- Ensure intake and assessment quality before matching decisions.
- Coordinate client-facing and case-context updates.

What they do in the system:
- Update casus details, constraints, and relevant context.
- Complete/validate Beoordeling inputs.
- Confirm whether recommendation assumptions still match real-world case facts.

Decisions they own:
- Data completeness and readiness for matching.
- Whether new case context requires reassessment.
- Whether a proposed provider path is still feasible for the client.

### Matching Operator
Primary responsibilities:
- Execute matching and placement actions with operational discipline.
- Handle provider response loops (resend, info follow-up, rematch).
- Keep recommendation-to-action transitions explicit and logged.

What they do in the system:
- Run matching and review explainability.
- Trigger provider-response actions and rematch when needed.
- Record override rationale when deviating from recommendation.

Decisions they own:
- Provider selection execution choice.
- Follow-up action at provider-response checkpoints.
- Escalation to Regiekamer lead when risk or ambiguity rises.

### Regiekamer Lead
Primary responsibilities:
- Run control-tower triage and protect flow continuity.
- Prioritize high-risk cases and assign owners.
- Ensure SLA/escalation signals result in timely action.

What they do in the system:
- Monitor high-priority and stuck cases.
- Validate next-owner and next-action status.
- Escalate and unblock cross-case operational bottlenecks.

Decisions they own:
- Priority order of intervention.
- Escalation path and urgency handling.
- Immediate action assignment for stalled or forced-action cases.

### Team Lead / Reviewer
Primary responsibilities:
- Lead weekly decision-quality review sessions.
- Convert patterns into operational improvements.
- Guard consistency and decision defensibility.

What they do in the system:
- Run weekly_decision_review command.
- Review case replay and classify decision quality.
- Track action items and follow-up ownership.

Decisions they own:
- Decision quality classification outcomes.
- Which patterns require process intervention.
- Which issues need product/ops support escalation.

### Product / Ops Support
Primary responsibilities:
- Support pilot stability and issue resolution.
- Turn validated pilot findings into improvement backlog.
- Protect pilot scope and execution discipline.

What they do in the system:
- Monitor pilot usage and technical reliability.
- Support command outputs, governance logs, and troubleshooting.
- Help teams frame findings into actionable interventions.

Decisions they own:
- Whether findings require operational coaching, config tuning, or product change.
- Priority and sequencing of pilot-safe fixes.
- Readiness recommendation for post-pilot rollout phase.

---

## 3. Daily Operating Routine

### Morning: Regiekamer Triage (30-45 minutes)
Goal: establish control and ownership for the day.

What to look at:
- SLA breaches and escalations.
- Cases with no clear next action.
- Cases with repeated provider-response friction (resend/rematch loops).
- High urgency cases with risk signals.

What action to take:
- Assign clear owner per high-priority case.
- Confirm immediate next action and deadline.
- Escalate blocked cases to Regiekamer lead immediately.

Signals that matter:
- ESCALATED or FORCED_ACTION states.
- Repeated pending/needs_info states without progress.
- Multiple recent action overrides in same case.

### Midday: Execution Block (60-120 minutes)
Goal: move cases forward, resolve loops, reduce waiting time.

What to look at:
- Provider responses due or overdue.
- NEEDS_INFO cases cycling without closure.
- Cases where recommendation no longer fits updated context.

What action to take:
- Execute resend or missing-info follow-up quickly.
- Trigger rematch when capacity/rejection patterns persist.
- Record override reasons when recommendation is not followed.

Signals that matter:
- Hours waiting vs SLA state.
- Provider no-capacity/waitlist trends.
- Confidence mismatch between recommendation and practical feasibility.

### End of Day: Control Check (20-30 minutes)
Goal: prevent silent carryover risk to next day.

What to look at:
- Exceptions and unresolved escalations.
- Overrides without clear reason quality.
- Cases that changed status but still lack next owner/action.

What action to take:
- Close or reassign unresolved exceptions.
- Add missing rationale notes before day close.
- Flag top unresolved risks for next morning triage.

Signals that matter:
- Missing rationale in override events.
- Cases with stale status despite multiple actions.
- Unreviewed critical cases with forced-action signals.

---

## 4. Weekly Decision Review Routine

Command used:
python manage.py weekly_decision_review --year <YYYY> --week <WW>

Recommended session cadence:
- Frequency: weekly
- Duration: 60-90 minutes
- Leader: Team Lead / Reviewer
- Participants: Regiekamer Lead, Matching Operator(s), Care Coordinator(s), Product/Ops Support (observer + action owner support)

Step-by-step flow:
1. Run the command and review the terminal summary.
2. Select 5-10 cases (prioritize high-risk, override-heavy, and suboptimal outcomes).
3. For each case, review replay + recommendation + action + outcome.
4. Classify decision quality.
5. Capture primary reason and short evidence note.
6. Discuss patterns across cases and agree follow-up actions.

Session output required:
- Reviewed case list with final classification.
- Top 3 recurring patterns for the week.
- Action list with owner, deadline, and expected effect.
- Escalations to Product/Ops Support (if needed).

---

## 5. Decision Quality Rubric (Operational Version)

### SYSTEM_CORRECT
Plain meaning:
- The recommendation was the right call given available case context.

Use when:
- User action matched recommendation or alternative did not materially improve outcome.

Common mistakes:
- Using this because outcome was later positive for unrelated reasons.
- Ignoring missing data at decision time.

### USER_CORRECT
Plain meaning:
- The override was better than the recommendation for this case context.

Use when:
- Operator had relevant context not reflected in recommendation and outcome improved.

Common mistakes:
- Marking USER_CORRECT without specific override rationale.
- Treating preference-only changes as quality improvements.

### BOTH_ACCEPTABLE
Plain meaning:
- Both system and user paths were defensible options.

Use when:
- Difference was tactical, not quality-critical.

Common mistakes:
- Using BOTH_ACCEPTABLE to avoid making a clear judgment.
- Using it when one option clearly had less risk.

### BOTH_SUBOPTIMAL
Plain meaning:
- Neither path was good enough for case needs.

Use when:
- Process gaps, missing intake quality, or operational constraints undermined both options.

Common mistakes:
- Blaming model only; often this points to intake/process constraints.
- Leaving notes too vague to support follow-up action.

### Primary Reasons (simple guidance)
- missing data: key case information was absent/stale.
- provider mismatch: provider fit was weak for case requirements.
- capacity issue: timing/capacity prevented execution quality.
- SLA timing: escalation timing drove poor decision flow.
- explanation unclear: recommendation rationale was hard to trust/interpret.
- external constraint: policy/family/municipality constraints dominated.

Rule of thumb:
Pick one primary reason that best explains the decision gap and write one sentence of evidence.

---

## 6. How to Interpret Weekly Output

### Decision quality distribution
What good looks like:
- SYSTEM_CORRECT and BOTH_ACCEPTABLE are stable majority.
- USER_CORRECT and BOTH_SUBOPTIMAL are present but explainable.

Warning signs:
- Rapid growth in BOTH_SUBOPTIMAL.
- Abrupt swings week-to-week without operational context.

Do not overinterpret:
- One week alone is not a trend. Use at least 3-4 weekly cycles.

### Override rate
What good looks like:
- Overrides are reasoned and pattern-based, not random.

Warning signs:
- High override volume with weak or repetitive rationale.
- Overrides clustered around specific workflow step without corrective action.

Do not overinterpret:
- High override rate is not automatically bad if reasons are valid and outcomes improve.

### Top reasons
What good looks like:
- Top reasons are specific and actionable.
- Teams can map each reason to a practical improvement owner.

Warning signs:
- Excessive use of generic reasons (for example, other).
- Same reason repeated without intervention over multiple weeks.

Do not overinterpret:
- Reasons reflect current pilot reality; they are not final product truth.

### Case summaries
What good looks like:
- Recommendation vs actual summary is clear and defensible.
- Outcome and rationale align.

Warning signs:
- Missing outcome context.
- Action trail does not explain final decision.

Do not overinterpret:
- Single-case anomalies should inform review, not immediate policy change.

---

## 7. Action Loop (Most Important)

After every weekly review, translate findings into owned actions.

### Finding: High overrides
Action:
- Audit explainability clarity and intake data quality for top affected case types.
Owner:
- Team Lead + Care Coordinator + Product/Ops Support.
Tracking:
- Weekly action register with owner/deadline; check next two weekly cycles for override quality change.

### Finding: Many BOTH_SUBOPTIMAL
Action:
- Review upstream intake and assessment readiness gates; tighten handoff quality.
Owner:
- Care Coordinator lead + Team Lead.
Tracking:
- Track reduction in BOTH_SUBOPTIMAL share and fewer stalled cases.

### Finding: SLA issues (overdue/escalated/forced-action concentration)
Action:
- Reconfirm ownership rules and escalation timing; adjust operational thresholds/work split if needed.
Owner:
- Regiekamer Lead + Matching Operator lead.
Tracking:
- Daily SLA breach counts and weekly escalation trend.

### Finding: Provider issues (capacity/rejection patterns)
Action:
- Run provider discussion and allocation strategy review; improve planning and alternatives.
Owner:
- Regiekamer Lead + Team Lead.
Tracking:
- Provider-level friction pattern in weekly review output.

Principle:
Provider-related findings are operational learning inputs, not punishment tools.

---

## 8. Pilot Do's and Don'ts

### DO
- Use Zorg OS as the primary workflow each day.
- Trust recommendations, then verify with case context.
- Capture real override reasons every time.
- Review real pilot cases, not hypothetical examples.

### DON'T
- Add new features during the pilot unless safety-critical.
- Override without explicit rationale.
- Ignore SLA and escalation signals.
- Treat pilot metrics as final product truth.

---

## 9. Common Pitfalls

### Pitfall: Users ignore recommendations
How to detect:
- High overrides with low-quality rationale.
How to respond:
- Coach explainability usage; review 3-5 cases together in replay mode.

### Pitfall: Overreliance on system without thinking
How to detect:
- SYSTEM_CORRECT overused while case context warnings are missed.
How to respond:
- Reinforce trust-but-verify rule in daily and weekly routines.

### Pitfall: Misunderstanding adaptive behavior
How to detect:
- Team confusion around SLA transitions or action expectations.
How to respond:
- 15-minute refresher with real case examples from last week.

### Pitfall: SLA fatigue
How to detect:
- Escalation signals repeatedly acknowledged but not acted on.
How to respond:
- Tighten ownership assignment in morning triage and end-of-day control checks.

### Pitfall: Poor data quality
How to detect:
- Frequent missing data reason or unclear recommendation interpretation.
How to respond:
- Add intake completeness checks and coordinator accountability.

---

## 10. Pilot Success Criteria

### Success signals
- Teams actively use the system in daily operations.
- Decisions are faster and more consistent across similar cases.
- Override patterns are explainable and evidence-based.
- Replay supports productive, non-defensive case discussion.
- Users can defend decisions with audit trail and rationale.

### Failure signals
- Workflow is bypassed in favor of side channels.
- SLA escalations rise without ownership response.
- Overrides are frequent but not explainable.
- Weekly review sessions produce no concrete follow-up actions.
- Teams cannot explain why key decisions were made.

---

## 11. What Happens After the Pilot

### Evaluation approach
At pilot close, evaluate:
- Adoption quality: daily usage discipline by role.
- Operational impact: waiting-time pressure, stall reduction, action timeliness.
- Decision quality: pattern stability and explainability.
- Data quality: completeness and consistency at intake/assessment stages.

### Outcome paths

Rollout decision:
- Choose when adoption is consistent, decision quality is defensible, and action loop is functioning.

Second pilot decision:
- Choose when value is visible but role discipline/process consistency needs another controlled cycle.

Redesign decision:
- Choose when core flow breaks repeatedly, decision signals are not trusted, or operational ownership fails.

### Final pilot deliverables
- Pilot outcome summary.
- Confirmed strengths and failure points.
- Prioritized action backlog with ownership.
- Recommendation: rollout, second pilot, or redesign.

---

## Quick-Start Checklist (For Week 1)

1. Run daily morning triage in Regiekamer.
2. Execute midday provider-response actions.
3. Complete end-of-day control check.
4. Run weekly_decision_review command at fixed weekly slot.
5. Review 5-10 real cases and classify quality.
6. Publish action list with owner and deadline.
7. Re-check actions in next weekly session.

---

## 12. Week 1 Pilot Simulation (Realistic)

Use this as a facilitation script for pilot week 1.  
Objective: validate visibility, action discipline, and learning loop quality under real operational pressure.

### Monday: Looks Clean on Paper

Initial state:
- 18 active cases
- 6 priority
- 3 AT_RISK
- 1 OVERDUE

Expected team reaction:
- "We finally see everything in one place"

Morning actions:
- Assign ownership for all priority/stuck cases.
- Check missing data on top-risk cases.
- Review recommendation explanations before actioning.

What usually goes right:
- Team quickly sees what is urgent and what is blocked.
- Matching explanations are actually read.

What usually goes wrong:
- First override appears with weak structure: "I know provider X is better".

Operational interpretation:
- Treat this as a signal, not a failure.
- Immediate follow-up: require explicit rationale quality for overrides from day 1.

Midday execution reality:
- Typical responses: accepted, needs info, no response mix.
- System suggests resend/provide_missing_info actions clearly.

Common friction:
- "Let’s wait a bit longer, I don’t want to spam them".

Operational interpretation:
- First visible conflict: system timing logic vs human relationship logic.
- Action: capture this as a structured "wait vs act" discussion item for Friday review.

End-of-day check:
- Review moved/stuck/unclear-ownership counts.
- Record at least one concrete ownership correction before close.

### Tuesday: Reality Creeps In

Morning state change:
- Some AT_RISK cases escalate.
- New cases arrive.
- Backlog pressure starts.

Critical question that appears:
- "Why is this case escalated already?"

Operational interpretation:
- SLA fairness perception starts here.
- Action: run a short SLA explanation huddle with one real case example.

Midday loop issue:
- needs_info -> info sent -> provider silent -> resend suggested.

Common friction:
- "Didn’t we already do that?"

Operational interpretation:
- The system feels repetitive unless progression context is explicit.
- Action: when resending, add one short note explaining what changed since prior action.

End-of-day signal:
- Cases bouncing, one clear mismatch, repeated wait-vs-act debates.

### Wednesday: Trust Is Tested

Most important day of week 1.

What changes:
- Team speed improves.
- Explanation reading discipline may drop.
- Instinct-based actions rise.

Critical incident pattern:
- System recommends provider A -> user accepts -> provider rejects later.

Risk statement:
- Trust drops if discussion becomes "system wrong" only.

Operational response:
- Use replay immediately.
- Separate three questions:
	1. Was recommendation defensible at decision time?
	2. Was key data missing?
	3. Was outcome changed by external/provider behavior?

Rule:
- Trust survives when decision trace is explainable, even with negative outcomes.

### Thursday: Patterns Emerge

Expected clusters:
- Overrides concentrated in complex cases.
- Repeated needs_info loops.
- Provider patterns: slow response, frequent no capacity.

Value moment:
- Team recognizes repeated case types and avoidable friction.

Operational response:
- Build Friday case set to include each pattern cluster.
- Do not optimize UI/features; optimize case handling decisions.

### Friday: First Weekly Decision Review

Run command:
python manage.py weekly_decision_review

Expected output style:
- candidate cases
- reviewed/unreviewed counts
- quality distribution
- override frequency
- top reasons

Session execution:
1. Pick 5-8 mixed cases (accepted, overridden, escalated, rematched).
2. Review recommendation -> action -> outcome -> replay context.
3. Classify each case.
4. Capture one primary reason with one evidence sentence.
5. Extract cross-case patterns.

### Friday Facilitation Protocol (90 minutes, strict)

Use this exact structure in pilot week 1 and 2.

#### 1) Set the room (5 minutes)
- State one rule: structured learning, not blame.
- Confirm: discussion must stay in the system evidence trail.

#### 2) Case review loop (60 minutes)
- Review 5-6 cases maximum.
- For each case, enforce this sequence:

Step 1: Show facts only (no opinions)
- System recommendation
- User action
- Outcome

Step 2: Ask one decision question
- "Given what we knew at the time, was this the right decision?"

Step 3: Force one classification
- SYSTEM_CORRECT
- USER_CORRECT
- BOTH_ACCEPTABLE
- BOTH_SUBOPTIMAL

Rule:
- No debate without selecting one classification first.

Step 4: Force one primary reason
- missing data
- provider mismatch
- capacity issue
- SLA timing
- explanation unclear
- external constraint

Step 5: Move on
- Do not over-discuss a single case.
- If unresolved, park as follow-up and continue.

#### 3) Pattern check (10-15 minutes)
Ask exactly:
- "What did we see multiple times?"
- "Where did the system struggle?"
- "Where did we struggle?"

Capture only recurring patterns.

#### 4) Close (5 minutes)
Ask three blunt questions:
- "Would you actually use this weekly?"
- "What felt unclear or annoying?"
- "What would make this 10x more useful?"

### What facilitators must observe (behavior, not just answers)

Watch for:
- Hesitation before classification.
- Confusion between SYSTEM_CORRECT and USER_CORRECT.
- Vague reasons that cannot drive action.
- Skipping explanation/replay evidence.
- Emotional argument instead of structured decision reasoning.

### Fix immediately vs ignore for now

Fix immediately only when:
- People do not understand categories.
- Output is confusing in real session use.
- Replay does not help explain decisions.
- Command output is unusable for case discussion.

Ignore for now:
- "UI could be nicer"
- "Add more AI"
- "Automate this"
- "Need more filters"

These are valid future ideas, but pilot-noise at this stage.

### Session success criteria

At the end of 90 minutes, you are pilot-ready if:
- People can classify decisions consistently.
- People can explain why with evidence.
- People identify recurring patterns.
- Discussion quality is structured, not ad-hoc.

Typical week-1 classifications you should expect:
- SYSTEM_CORRECT with unlucky downstream rejection.
- USER_CORRECT when local context was not in system data.
- BOTH_SUBOPTIMAL where both path and override were weak.

### Week 1 Outcome Frame

What should improve immediately:
- Clearer next action.
- Better stuck-case visibility.
- More structured team discussion.

What should be exposed (and is healthy to expose):
- Data quality gaps.
- Human intuition conflicts.
- SLA perception tension.
- Provider behavior impact.

What should not be expected in week 1:
- Perfect recommendations.
- Zero overrides.
- Full trust without challenge.

### Week 1 Success vs Failure Check

Success after week 1:
- People use the system in live flow.
- Discussions use replay and evidence.
- Weekly review yields concrete patterns and actions.

Failure after week 1:
- Recommendations are ignored by default.
- Overrides are random and unstructured.
- SLA signals are repeatedly ignored.
- Decision discussions move outside the system.

Final week-1 truth:
- The pilot is not proving "the system is always right".
- The pilot is proving decisions are visible, structured, and improvable.
