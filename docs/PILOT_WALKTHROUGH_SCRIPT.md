# Pilot walkthrough script

This is a short presenter script for a demo or pilot walkthrough. Keep the pace slow and let the UI explain the workflow.

## Opening

“I’m going to walk through the current CareOn pilot baseline. The product is a decision system, not a dashboard. I’ll show the main care flow from casus creation through intake, and I’ll point out where the system is guiding the next best action.”

## Set the frame

“The baseline for this walkthrough is verified:

- design guardrail: pass
- accessibility smoke: pass
- focused care tests: pass
- golden-path end-to-end: pass

So I’m using the current UI as the reference state.”

## Walkthrough flow

### 1. Nieuwe casus

“We start with Nieuwe casus. This is the intake entry point. The main thing to watch is whether the form tells you what the source reference is, what can be entered now, and what step comes next.”

Ask:

- “Is it clear what belongs in the source/reference field?”
- “Do the labels make the next step obvious?”

### 2. Casussen

“Casussen is the worklist. The row open action and the primary CTA should be separate. The list should show the current state, the owner, and the next action without making you guess.”

Ask:

- “Do you see the difference between opening a row and using the page CTA?”
- “Is the worklist readable at a glance?”

### 3. Regiekamer

“Regiekamer is the control tower. It should show the problem, the impact, the owner, and the required action. The dominant action should be singular and obvious.”

Ask:

- “What is the one thing this page wants you to do right now?”
- “Does the page explain why that action matters?”

### 4. Matching

“Matching is advisory only. It should help the gemeente validate the selection before anything moves to aanbieder beoordeling.”

Ask:

- “Do the filters and matching controls feel like guidance, not assignment?”
- “Is the validation boundary clear?”

### 5. Aanbieder beoordeling

“This page is the provider review gate. The important check here is that the decision/action buttons are still reachable and that the role boundary remains clear.”

Ask:

- “Do you understand who is deciding here?”
- “Are the next actions easy to find?”

### 6. Plaatsingen

“Plaatsingen comes after provider acceptance. The screen should show placement tracking, status, and any blockers without hiding the sequence.”

Ask:

- “Is it clear that placement follows acceptance?”
- “Can you read the status without relying on color alone?”

### 7. Acties

“Acties is the operational queue. It should stay keyboard-usable and make filters and sorting obvious without turning into a dashboard.”

Ask:

- “Is there a clear distinction between filtering and acting?”
- “Can you get to the next task without extra explanation?”

## Close

“That is the baseline walkthrough. If anything felt unclear, I’ll capture the exact screen and label, then we can decide whether it is a wording fix, a workflow issue, or a UX gap.”

