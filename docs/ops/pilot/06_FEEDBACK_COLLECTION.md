# Pilot Feedback Collection Process

**Audience:** Pilot Operations Lead  
**Goal:** Collect structured, actionable feedback from municipality and provider users  
**Principle:** Observe first, ask second, do not lead the witness  

---

## Feedback channels

| Channel | Who | When | Format |
|---------|-----|------|--------|
| **End-of-session notes** (operator) | Pilot lead | After every supervised session | `PILOT_INCIDENT_LOG.md` + free-form notes |
| **Week 1 check-in call** | Gemeente coordinator | End of Week 1 | 30-min structured call |
| **Week 2 written survey** | All pilot users | End of Week 2 | Short form (see below) |
| **Week 4 review call** | Gemeente + provider contacts | Week 4 | 45-min structured call |
| **Ad-hoc bug/friction report** | Any user | Any time | Email to haroonwahed@live.nl |
| **Pilot lead daily log** | Pilot lead | Every day | Brief (≤ 5 lines) in `PILOT_DAILY_LOG.md` |

---

## Week 1 check-in call (gemeente coordinator)

**Duration:** 30 minutes  
**Format:** Video or phone; pilot lead takes notes during call

### Questions to ask

**Workflow experience**
1. "Walk me through the first case you created. Where did you get stuck or confused?"
2. "When you sent a case to a provider, what happened next? Was it clear?"
3. "Is there anything in the workflow that doesn't match how your team currently works?"

**Notifications**
4. "Did the provider confirm they received the notification? Via bell or email?"
5. "Is the notification timing acceptable — or do you need to follow up separately?"

**Data and audit**
6. "Have you checked the audit log? Did it show what you expected?"
7. "Are you confident you're seeing only your organisation's data?"

**Open**
8. "What was the worst moment of using the system this week?"
9. "What worked better than you expected?"
10. "Is there anything that would make you not want to continue?"

### Signals that escalate to Product (note, but do not promise fixes)
- Any mention of a workflow step that doesn't correspond to real process
- Any confusion about roles or who should act next
- Any mention of a missing feature that is also a current workaround in their existing process

---

## Week 2 written survey (all users)

Send via email. Keep it to 5 questions. Do not use a form tool that requires account creation.

**Subject:** Carelane pilot — korte terugkoppeling week 2

```
Hallo [naam],

Bedankt voor je deelname aan de Carelane-pilot.
Ik heb 5 korte vragen. Antwoorden mogen in steekwoorden.

1. Hoe soepel verliep het aanmaken/afhandelen van casussen? (1–5, 5=perfect)
   Toelichting (optioneel):

2. Heb je de notificaties ontvangen die je verwachtte? (ja / nee / deels)
   Toelichting:

3. Wat kostte je het meeste moeite of tijd?

4. Wat werkte beter dan je verwacht had?

5. Zou je dit systeem aan een collega aanbevelen voor soortgelijk werk? (ja / nee / misschien)
   Waarom:

Je hoeft dit niet uitgebreid te beantwoorden. Stuur terug naar haroonwahed@live.nl.

Dank!
```

---

## Week 4 review call (gemeente + provider contact)

**Duration:** 45 minutes  
**Format:** Separate calls per organisation, or joint call if both agree  

### Structured review agenda

**0–5 min:** Thank participants. Confirm data from metrics report (see `04_SUCCESS_METRICS.md`).

**5–20 min — Workflow review**
- "How many cases did you complete end-to-end?"
- "What was the typical turnaround time for a full case?"
- "Did the provider response workflow work for your team? What needed extra communication outside the system?"
- "Were there cases you couldn't complete? Why?"

**20–30 min — Trust and compliance**
- "Do you feel confident the case data stayed within your organisation?"
- "Did the audit log meet your documentation needs for this pilot?"
- "Would you be comfortable using this in a supervised production context?"

**30–40 min — Problems and gaps**
- "What are the top 2 things that would need to change for this to replace your current workflow?"
- "Were there any moments where you worked around the system rather than with it?"

**40–45 min — Forward look**
- "If we ran another 30-day pilot, what would you want to test?"
- "Would your organisation want to continue on this platform?"

### What to record from this call
- **Blockers** — things preventing adoption
- **Workarounds** — things users did instead of what the system expects
- **Positive signals** — specific moments that worked well
- **Phase 2 candidates** — features explicitly requested

---

## Pilot lead daily log

Create `docs/ops/pilot/PILOT_DAILY_LOG.md`. Add a line each day:

```markdown
## 2026-06-23
- Gemeente coordinator onboarded. First case created successfully.
- Provider De Brug logged in; received notification. Response: pending.
- No incidents.

## 2026-06-24
- Gemeente sent 2 cases. One provider accepted, one pending.
- P3: Notification bell showed 0 after marking read — stale count. Noted.
```

---

## Categorising feedback

When logging any feedback (from any source), categorise it:

| Category | Tag | Example |
|----------|-----|---------|
| Workflow gap | `[WORKFLOW]` | "I can't cancel a case once it's in matching" |
| UX confusion | `[UX]` | "I didn't know what PROVIDER_REVIEW_PENDING meant" |
| Bug | `[BUG]` | "Email notification not arriving" |
| Missing feature | `[FEATURE]` | "I need to be able to add notes to a case" |
| Performance | `[PERF]` | "Loading candidates takes > 10 seconds" |
| Out of scope | `[OOS]` | "Can this connect to iWlz?" |
| Positive signal | `[POSITIVE]` | "The audit log export saved us 2 hours" |

Do not commit to fixes during the pilot. Respond with: "Noted, we'll review this after the pilot."

---

## Feedback file template

Maintain `docs/pilot/PILOT_FEEDBACK_LOG_V2.md` (extends the V1 that already exists):

```markdown
## Feedback — [DATE] — [SOURCE: gemeente/provider/observation]

**Category:** [UX/WORKFLOW/BUG/FEATURE/PERF/OOS/POSITIVE]
**Severity for pilot:** [Blocks pilot / Degrades pilot / Non-blocking]
**Verbatim (if applicable):** "[quote]"
**Observed behaviour:** 
**Expected behaviour:**
**Action taken:** noted / will fix / deferred to Phase 2 / explained to user
```
