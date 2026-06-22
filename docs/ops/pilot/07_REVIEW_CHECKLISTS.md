# Pilot Review Checklists

**Audience:** Pilot Operations Lead  
**Use:** Run at the end of Week 1, Week 2, and Week 4  
**Output:** Mark each item, note evidence, escalate blockers  

---

## End of Week 1 Checklist

**Purpose:** Confirm pilot is operational and users are moving through the workflow.  
**Owner:** Pilot Operations Lead  
**Time required:** ~30 minutes  

### 1. User activation

```
[ ] All provisioned gemeente accounts have logged in at least once
    Evidence: ________________________

[ ] All provisioned provider accounts have logged in at least once
    Evidence: ________________________

[ ] No login failures unresolved
    Open issues: ____________________
```

### 2. Workflow coverage

```
[ ] At least 1 case created (Aanmelding → CaseIntakeProcess exists)
[ ] At least 1 case reached MATCHING_READY
[ ] At least 1 case sent to provider (PROVIDER_REVIEW_PENDING)
[ ] At least 1 provider response received (ACCEPTED or REJECTED)

Cases in flight by state:
  INTAKE:                    ___
  MATCHING_READY:            ___
  GEMEENTE_VALIDATED:        ___
  PROVIDER_REVIEW_PENDING:   ___
  PROVIDER_ACCEPTED:         ___
  PLACEMENT_CONFIRMED:       ___
  PROVIDER_REJECTED:         ___
```

Run to fill in:
```python
# From Render shell
from contracts.models import CaseIntakeProcess
from django.db.models import Count
for r in CaseIntakeProcess.objects.values('workflow_state').annotate(n=Count('pk')):
    print(r)
```

### 3. Notifications

```
[ ] In-app notification created for every send_to_provider action
    Count: ___  (should equal PROVIDER_REVIEW_PENDING transitions)

[ ] No "failed to send email" ERROR in application logs
    Log check date/time: ________________________

[ ] At least 1 provider confirmed receipt of notification (email or bell)
    Confirmed by: ___________________________
```

### 4. Integrity

```
[ ] /_health/ returns {"status": "ok", "db": "ok", "cache": "ok"}
    Checked at: ________________________

[ ] Sentry shows 0 P1/P2 open incidents
    Sentry URL checked: _________________

[ ] Audit log API returns rows for completed cases (spot-check 1 case)
    Case ID spot-checked: _______________

[ ] No cross-tenant data leak reported
    (If yes: STOP PILOT — see P1 playbook)
```

### 5. Support load

```
Support contacts this week:
  Total contacts:    ___
  P1 incidents:      ___
  P2 incidents:      ___
  P3 incidents:      ___
  
Unresolved issues carried to Week 2:
  1. _________________
  2. _________________
```

### Week 1 verdict

```
[ ] Green — all critical items checked, pilot continues normally
[ ] Amber — minor issues, continue with specific watch items: ____________
[ ] Red — blocking issue, pilot paused: _________________________________
```

---

## End of Week 2 Checklist

**Purpose:** Assess adoption curve and identify patterns before the final review.  
**Owner:** Pilot Operations Lead  
**Time required:** ~45 minutes  

### 1. Cumulative workflow metrics

```
Total cases created:                    ___
Reached PROVIDER_REVIEW_PENDING:        ___  (target: ≥ 90% of started)
Received a provider response:           ___  (target: ≥ 80%)
Reached PLACEMENT_CONFIRMED:            ___  (target: ≥ 70% of accepted)
Cases rematched (PROVIDER_REJECTED):    ___  (target: ≤ 30%)
```

### 2. Time-to-completion

```
Average days aanmelding → PROVIDER_REVIEW_PENDING:  ___  (target: ≤ 3 days)
Average days PROVIDER_REVIEW_PENDING → response:   ___  (target: ≤ 3 days)
```

Run to fill in (approximate — full calculation in Week 4):
```python
from contracts.models import CaseIntakeProcess
from django.db.models import F
# Manual inspection for now — filter cases with timestamps
intakes = CaseIntakeProcess.objects.filter(
    workflow_state__in=['PROVIDER_REVIEW_PENDING','PROVIDER_ACCEPTED','PLACEMENT_CONFIRMED']
).values('pk','created_at','updated_at','workflow_state')[:10]
for i in intakes:
    delta = (i['updated_at'] - i['created_at']).days
    print(f"ID={i['pk']} state={i['workflow_state']} days={delta}")
```

### 3. Notification delivery

```
Total APPROVAL notifications created:              ___
"No contact email" WARNING count in logs:          ___  (target: 0)
"Failed to send email" ERROR count in logs:        ___  (target: 0)
Providers with email configured (from Client):     ___  (should be 100%)
```

Check:
```python
from contracts.models import Client
missing_email = Client.objects.filter(
    client_type='CORPORATION',
    primary_contact_email=''
).count()
print(f"Providers missing email: {missing_email}")
```

### 4. User feedback

```
Week 2 survey sent:    [ ] Yes  [ ] No
Responses received:    ___  out of  ___  users

Summary of week 2 survey responses:
  Average workflow score (1–5):  ___
  Notification delivery:         satisfied / partial / not satisfied
  Biggest friction point:        ________________________
  Top positive signal:           ________________________
```

### 5. System health

```
[ ] Uptime ≥ 99% this week (check Render uptime graph)
[ ] No P1 incidents since Week 1 review
[ ] API p95 latency within range (check Render request logs)
[ ] Audit log complete for all confirmed cases
```

### 6. Pilot data compliance

```
[ ] Spot-check 3 cases — no real BSN or personal names found
    Cases checked: ___, ___, ___
[ ] No real address data in case descriptions
```

### Week 2 verdict

```
[ ] Green — on track for positive Week 4 Go/No-Go
[ ] Amber — specific metrics at risk: ____________________
            Mitigation: _______________________________
[ ] Red — blocking issue, pilot paused: _________________
```

---

## End of Week 4 Checklist

**Purpose:** Final review for Go/No-Go decision.  
**Owner:** Pilot Operations Lead  
**Time required:** ~2 hours (including review calls)  

### 1. P0 — Final breach check

```
[ ] Zero data isolation incidents throughout pilot
[ ] Zero capacity double-bookings
[ ] Zero audit log corruption incidents
[ ] Sentry: zero P0 events in final week
```

If any P0 breach: **STOP — activate No-Go condition.**

### 2. P1 metrics — final evaluation

```
Workflow completion rate (aanmelding → MATCHING_READY):  ___  (target: ≥ 90%)
send_to_provider rate (validated → sent):                ___  (target: ≥ 90%)
Provider response rate within 5 days:                   ___  (target: ≥ 80%)
PLACEMENT_CONFIRMED rate:                               ___  (target: ≥ 70%)

System uptime (business hours):                         ___%  (target: ≥ 99%)
API p95 latency:                                        ___ s  (target: ≤ 2s)

All users logged in at least once:                      [ ] Yes  [ ] No
At least 1 full case completed:                         [ ] Yes  [ ] No
```

### 3. P2 metrics — pilot quality

```
Average time aanmelding → PROVIDER_REVIEW_PENDING:  ___ days  (target: ≤ 3)
Average time PROVIDER_REVIEW_PENDING → response:    ___ days  (target: ≤ 3)
Rematch rate:                                       ___%  (target: ≤ 30%)

Email delivery error rate:                          ___%  (target: ≤ 10%)
Cases with complete audit trail:                    ___%  (target: 100%)
Providers with email configured:                    ___%  (target: 100%)
```

### 4. User feedback summary

```
Week 4 review call completed:     [ ] Gemeente  [ ] Provider
Survey response rate:             ___  out of  ___

Net recommendation (would use again):  Yes ___ / No ___ / Maybe ___

Top 3 blocking concerns (if any):
  1. ____________________________________________
  2. ____________________________________________
  3. ____________________________________________

Top 3 positive outcomes:
  1. ____________________________________________
  2. ____________________________________________
  3. ____________________________________________

Features requested for Phase 2 (top 3):
  1. ____________________________________________
  2. ____________________________________________
  3. ____________________________________________
```

### 5. Operational sustainability check

```
[ ] Support load manageable (< 2 P2 incidents per week on average)
[ ] No unresolved P1 incidents
[ ] Pilot lead can support a 90-day extension without additional headcount
[ ] Provider email confirmed working end-to-end
```

### 6. Final Go/No-Go input

Complete before calling the decision:

```
P0 breaches:          ___  (must be 0 for Go)
P1 metrics all met:   [ ] Yes  [ ] No  [ ] Partially (see notes)
P2 targets met:       [ ] Yes  [ ] No  [ ] Partially (see notes)
User net positive:    [ ] Yes  [ ] No

Recommendation from this checklist:  GO / NO-GO / CONDITIONAL GO
Notes: _______________________________________________
```

Hand this to `docs/ops/pilot/08_GO_NOGO_FRAMEWORK.md` for the final decision.
