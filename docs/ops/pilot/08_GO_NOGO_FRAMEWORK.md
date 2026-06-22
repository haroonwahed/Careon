# Go / No-Go Decision Framework

**Version:** 1.0  
**Decision date:** End of Week 4 of pilot  
**Decision owner:** Pilot Operations Lead  
**Input required:** Week 4 checklist from `07_REVIEW_CHECKLISTS.md`  

---

## Purpose

This framework produces a structured, defensible decision on whether to proceed from the 30-day supervised pilot to a 90-day operational pilot (or a different course of action). It is not a subjective judgement — it is a mechanical application of criteria the team agreed before the pilot started.

---

## Decision tree

Work through each gate in order. **Stop at the first No-Go condition.**

### Gate 0 — Hard stop conditions (any one triggers immediate No-Go)

```
[ ] No data isolation breach occurred at any point during the pilot
[ ] No capacity double-booking occurred during the pilot
[ ] No GovernanceLogImmutableError was raised unexpectedly (audit tampering attempt or code bug)
[ ] No AVG/GDPR reportable incident occurred
```

**If any gate 0 item is unchecked:** No-Go. The pilot is suspended pending a root-cause review. Do not proceed to Gate 1 until the incident is resolved and a remediation plan is documented.

---

### Gate 1 — System viability (all must pass for Go)

| Criterion | Pass threshold | Actual | Pass? |
|-----------|---------------|--------|-------|
| Uptime (business hours) | ≥ 99% | ___ | [ ] |
| Core API p95 latency | ≤ 2 seconds | ___ | [ ] |
| All users activated (logged in ≥ once) | 100% | ___ | [ ] |
| At least 1 case completed end-to-end | 1 case | ___ | [ ] |
| No unresolved P1 incidents at decision time | 0 | ___ | [ ] |

**If any Gate 1 criterion fails:** No-Go unless the failure has a documented, remediated root cause and the criterion was met for the final 7 days of the pilot.

---

### Gate 2 — Workflow completion (must meet all for full Go; miss one → Conditional Go)

| Criterion | Pass threshold | Actual | Pass? |
|-----------|---------------|--------|-------|
| Aanmelding → MATCHING_READY | ≥ 90% | ___ | [ ] |
| GEMEENTE_VALIDATED → PROVIDER_REVIEW_PENDING | ≥ 90% | ___ | [ ] |
| Provider response within 5 business days | ≥ 80% | ___ | [ ] |
| PLACEMENT_CONFIRMED rate | ≥ 70% | ___ | [ ] |

---

### Gate 3 — Notification reliability (must meet for Go)

| Criterion | Pass threshold | Actual | Pass? |
|-----------|---------------|--------|-------|
| In-app notification on every send_to_provider | 100% | ___ | [ ] |
| Email delivery error rate | ≤ 10% | ___ | [ ] |
| All pilot providers have contact email configured | 100% | ___ | [ ] |

---

### Gate 4 — User trust

| Criterion | Pass threshold | Actual | Pass? |
|-----------|---------------|--------|-------|
| Net recommendation (would use again) | Majority Yes or Maybe | ___ | [ ] |
| No participant reported loss of trust in data isolation | 0 reports | ___ | [ ] |
| Support load manageable without additional headcount | Pilot lead confirms | ___ | [ ] |

---

## Outcomes

### Go ✅

**Conditions:** Gate 0 fully passes + Gate 1 fully passes + ≥ 3/4 Gate 2 criteria pass + Gate 3 passes + Gate 4 passes.

**Action:**
1. Schedule 90-day operational pilot kickoff call within 10 business days
2. Agree scope expansion (additional municipalities or providers)
3. Commission Phase 2 feature backlog from feedback collected
4. Brief all participants on extended pilot scope and rules
5. Document any conditions attached to the Go decision

---

### Conditional Go ⚠️

**Conditions:** Gate 0 passes + Gate 1 passes + one or more Gate 2/3/4 criteria fail, but failures have documented explanations and remediation plans.

**Action:**
1. Document the failing criteria and the specific remediation committed
2. Set a re-check date (2 weeks into the 90-day pilot) to verify remediation
3. Proceed with the 90-day pilot **with the specific failing area under heightened monitoring**
4. If re-check fails: convert to No-Go and suspend

**Conditional Go examples:**
- Email delivery rate was 85% because EMAIL_HOST was misconfigured for 3 days → fixed; conditional Go with Week 2 re-check
- One municipality coordinator never logged in due to leave → activation at 80%; conditional Go when they activate in Week 5
- Rematch rate was 35% but all cases eventually confirmed → conditional Go with provider communication improvement plan

---

### No-Go ✗

**Conditions:** Any Gate 0 failure, OR Gate 1 failure without documented remediation, OR ≥ 2 Gate 2 criteria failing without explanation.

**Action:**
1. Suspend pilot operations immediately
2. Notify all participants within 24 hours
3. Document the blocking reason in `PILOT_INCIDENT_LOG.md`
4. Convene a root-cause review within 5 business days
5. Define a remediation plan with specific, testable exit criteria
6. Schedule a re-pilot no earlier than 4 weeks from the suspension date

**No-Go examples:**
- Any data isolation breach → suspend; root-cause; re-pilot after fix + security review
- Uptime < 95% due to recurring Redis instability → suspend; fix infrastructure; re-pilot
- Zero provider responses (0% Gate 2.3) because providers did not use the system → suspend; redesign the onboarding approach

---

## Decision record template

Complete and commit this record to `docs/ops/pilot/PILOT_DECISION_RECORD.md` when the decision is made.

```markdown
# Pilot Go/No-Go Decision Record

**Date:** YYYY-MM-DD  
**Pilot period:** YYYY-MM-DD → YYYY-MM-DD  
**Decision:** GO / CONDITIONAL GO / NO-GO  
**Decision made by:** [name]  

## Gate results

| Gate | Result | Notes |
|------|--------|-------|
| Gate 0 — Hard stops | PASS / FAIL | |
| Gate 1 — System viability | PASS / FAIL | |
| Gate 2 — Workflow completion | PASS / PARTIAL / FAIL | |
| Gate 3 — Notification reliability | PASS / FAIL | |
| Gate 4 — User trust | PASS / FAIL | |

## Key data points

- Cases created: ___
- Cases completed (PLACEMENT_CONFIRMED): ___
- Rematch rate: ___%
- Uptime: ___%
- Email delivery: ___%
- Support P1 incidents: ___
- Support P2 incidents: ___

## User sentiment summary

[3–5 sentences from Week 4 review calls]

## Conditions attached (Conditional Go only)

1. [Condition]: [Deadline] — [Who monitors]
2. ...

## Decision rationale

[2–3 paragraph narrative on why this decision was made, what was strong, what was weak, and what the 90-day pilot or re-pilot should focus on]

## Next steps

- [ ] [Action 1] — by [date] — [owner]
- [ ] [Action 2] — ...
```

---

## Escalation

If the pilot lead and a key stakeholder disagree on the decision:

1. Default to the more conservative outcome (Conditional Go > Go; No-Go > Conditional Go)
2. Document the disagreement in the decision record
3. Attach a dissenting note if requested
4. The pilot lead's decision stands for operational purposes; escalation to steering committee is available within 5 business days if a stakeholder formally objects
