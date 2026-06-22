# Pilot Success Metrics

**Version:** 1.0  
**Review cadence:** Weekly (Week 1, 2, 4)  
**Decision use:** Week 4 Go/No-Go  

---

## Metric tiers

| Tier | Meaning |
|------|---------|
| **P0 — Blocking** | A single failure here stops the pilot or triggers immediate rollback |
| **P1 — Required** | Must pass at Week 4 for a positive Go/No-Go decision |
| **P2 — Target** | Defines a successful pilot; shortfalls are acceptable with documented explanation |
| **P3 — Informational** | Tracked for post-pilot planning; no pass/fail threshold |

---

## P0 — Blocking (zero tolerance)

| Metric | Threshold | Measurement |
|--------|-----------|-------------|
| Data isolation breach | 0 incidents | Any report of Org A seeing Org B's data |
| Unhandled 5xx on core workflow | < 3 in any 24h window | Sentry error count on matching/placement APIs |
| Audit log corruption | 0 incidents | Any GovernanceLogImmutableError triggered unexpectedly; any audit row missing |
| Capacity double-booking | 0 incidents | Two simultaneous placements consuming the same final slot |

**Trigger:** Any P0 breach activates the Go/No-Go stop condition immediately. See `docs/ops/pilot/08_GO_NOGO_FRAMEWORK.md`.

---

## P1 — Required (must pass at Week 4)

### Workflow completion rate

| Metric | Target | Source |
|--------|--------|--------|
| Aanmelding → MATCHING_READY completion | ≥ 90% of started cases | Case workflow state transitions in DB |
| GEMEENTE_VALIDATED → PROVIDER_REVIEW_PENDING | ≥ 90% of validated cases | Matching action API logs |
| PROVIDER_REVIEW_PENDING → (ACCEPTED or REJECTED) | ≥ 80% receive a response within 5 business days | Provider decision API timestamps |
| PLACEMENT_CONFIRMED rate | ≥ 70% of accepted cases reach confirmation | Placement action API |

### System reliability

| Metric | Target | Source |
|--------|--------|--------|
| Uptime | ≥ 99% during business hours (08:00–18:00 CET) | Render health check `/_health/` |
| API p95 latency (core workflow) | ≤ 2 seconds | Render logs / Locust load test |
| Sentry P1/P2 incidents resolved | ≤ 2 open at any time | Sentry dashboard |

### User adoption

| Metric | Target | Source |
|--------|--------|--------|
| All provisioned gebruikers logged in at least once | 100% | Django auth session logs |
| At least one full case completed (aanmelding → confirmed) | ≥ 1 case | DB query |

---

## P2 — Target (defines successful pilot)

### Workflow efficiency

| Metric | Target | Source |
|--------|--------|--------|
| Average time aanmelding → PROVIDER_REVIEW_PENDING | ≤ 3 business days | `CaseIntakeProcess.updated_at` delta |
| Average time PROVIDER_REVIEW_PENDING → decision | ≤ 3 business days | Provider response timestamp delta |
| Rematch rate (PROVIDER_REJECTED → MATCHING_READY) | ≤ 30% of cases | Workflow state transition counts |

### Notification delivery

| Metric | Target | Source |
|--------|--------|--------|
| Provider in-app notification created on every send_to_provider | 100% | `Notification` table count |
| Email delivered without error | ≥ 90% | Application log — no ERROR on `notify_provider_review_requested` |
| Provider acts within 48h of notification | ≥ 60% | Notification `created_at` vs. provider decision `updated_at` |

### Data quality

| Metric | Target | Source |
|--------|--------|--------|
| Cases with complete audit trail | 100% | AuditLog rows per CaseIntakeProcess |
| Cases using fabricated data only (no real BSN/PII) | 100% | Pilot lead spot check |
| Provider contact email configured | 100% of pilot providers | `Client.primary_contact_email` non-empty |

---

## P3 — Informational (post-pilot planning)

| Metric | Why it matters for Phase 2 |
|--------|---------------------------|
| Average matching candidates shown per case | Informs whether provider coverage is sufficient |
| Proportion of cases using override vs. top match | Signals whether matching algorithm needs tuning |
| Provider capacity utilisation at end of pilot | Informs whether capacity data is accurate |
| Number of support contacts per user per week | Signals training needs or UX gaps |
| Week 1 vs. Week 4 completion times | Shows whether users are getting faster (adoption curve) |
| Number of cases where no candidate was shown | Signals gap in regional provider coverage |

---

## Measurement schedule

| When | What to measure |
|------|----------------|
| **Day 1** | Provisioning complete; first login by all users |
| **Day 3** | First case through full workflow |
| **End of Week 1** | P0 review + P1 baseline + support contact count |
| **End of Week 2** | P1 progress + P2 first read + notification delivery rate |
| **End of Week 4** | Full P0/P1/P2 evaluation → Go/No-Go |

---

## Measurement queries

Run these from the Render shell (`python manage.py shell`):

```python
from contracts.models import CaseIntakeProcess, Notification
from contracts.workflow_state_machine import WorkflowState

# Cases by workflow state
from django.db.models import Count
print(CaseIntakeProcess.objects.values('workflow_state').annotate(n=Count('pk')))

# Notification delivery rate
total = Notification.objects.filter(notification_type='APPROVAL').count()
print(f"Total provider notifications: {total}")

# Cases with no audit log (should be 0)
from contracts.models import CareCase, AuditLog
from django.db.models import OuterRef, Subquery, Exists
cases_without_audit = CareCase.objects.annotate(
    has_audit=Exists(AuditLog.objects.filter(object_id=OuterRef('pk'), model_name='CareCase'))
).filter(has_audit=False).count()
print(f"Cases without any audit log: {cases_without_audit}")
```
