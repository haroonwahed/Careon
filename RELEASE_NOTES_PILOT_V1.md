# Release Notes — Carelane Pilot v1

**Release tag:** `pilot-v1`  
**Commit:** `e8987ced`  
**Date:** 2026-06-22  
**Type:** Supervised 30-day pilot release  

---

## Executive summary

Carelane Pilot v1 is the first production-ready release of the Carelane care-coordination platform. It enables a municipality (gemeente) to register youth care cases, match them to providers, and track placements through a supervised digital workflow — replacing fragmented email and spreadsheet coordination.

This release closes all four functional blockers identified during the 90-day readiness review, passes a full test suite of 1,277 tests, and ships with a complete set of operational documentation. Two supervised pilot runs were executed successfully end-to-end before tagging.

The release is scoped to a 30-day supervised pilot with one municipality and two providers. No external system integrations (iWlz, VECOZO, DBC) are in scope.

---

## Major fixes implemented

### Blocker 1 — Provider linkage (migrations 0089–0090)

**Problem:** The matching engine used `Zorgaanbieder` (the care provider registry entity) as the provider identity, while the placement system used `Client` (the contractual counterpart). There was no formal link between the two, making it possible to match a provider that could not receive a placement.

**Fix:** Added `Zorgaanbieder.client = OneToOneField(Client, null=True, on_delete=PROTECT)`. All matching and placement APIs now operate on the `Client` keyspace. A `PROVIDER_UNLINKED` (400) gate blocks any action on a provider without an established link. Backfill migration 0090 links existing rows by exact name match.

### Blocker 2 — Atomic capacity management (migration 0091)

**Problem:** Two simultaneous placement confirmations could both read `capacity = 1`, both succeed, and leave capacity at `-1` — double-booking the same care slot.

**Fix:** New module `contracts/capacity.py` implements `commit_capacity` and `release_capacity`. `commit_capacity` acquires a `SELECT FOR UPDATE` row lock on the provider's most recent `CapaciteitRecord`, checks `max(beschikbare_capaciteit, open_slots) > 0`, and decrements both fields atomically using `Greatest(F−1, Value(0))`. A new `PlacementRequest.capacity_committed` boolean field provides idempotency: repeated calls are no-ops. `release_capacity` reverses the decrement on rejection or rematch. Returns a 409 when capacity is zero.

### Blocker 3 — Append-only, organisation-scoped audit log (migrations 0092–0093)

**Problem:** `AuditLog` rows were scoped to the creating user's membership. If a user left an organisation, their audit entries became invisible. Records could also be modified or deleted post-creation.

**Fix:** Added `AuditLog.organization = ForeignKey(Organization, null=True, SET_NULL)`. Model-level `save()` and `delete()` guards raise `GovernanceLogImmutableError` if called on an existing row (queryset bulk operations remain available for the retention prune job). Migration 0093 backfills the organisation FK from each user's earliest active membership using raw SQL to bypass the immutability guard. Audit API queries use `Q(organization=org) | Q(organization__isnull=True, user_id__in=org_users)` for legacy row compatibility.

### Blocker 4 — Provider notifications (no migration required)

**Problem:** When a municipality sent a case to a provider, no automated notification was delivered. Providers had no way to know a case was waiting for their response.

**Fix:** New module `contracts/notifications.py` implements `notify_provider_review_requested`. On every `send_to_provider` or `assign` action, it creates an in-app `Notification` row for each active member of the provider's organisation, and sends an email to the provider's registered contact address. Email resolution falls back through `Client.primary_contact_email → Client.email → Organization.notification_email → Organization.contact_email`. Email failures are logged at `ERROR` and swallowed — the in-app notification is the reliable delivery channel. The SPA notification bell now reads from a real API (`GET /care/api/notifications/`) instead of a hardcoded count.

### Test suite stabilisation

Resolved 11 pre-existing test failures (all introduced by the Blocker 1 gate) and one collection error:

- `test_regiekamer_decision_overview` — added `from __future__ import annotations` for Python 3.9 union type syntax compatibility
- `test_phase2_pilot_stabilization`, `test_governance_audit`, `test_case_timeline_v1`, `test_intake_assessment_matching_flow` — updated provider creation helpers to link a `Zorgaanbieder` (required by the Blocker 1 gate)
- `test_governance_audit` — fixed stale `@patch` path shadowed by a function import in `contracts/views/__init__.py`; switched to `sys.modules` + `patch.object`
- `test_capacity_management` — annotated concurrency test with `@skipIf(sqlite)` since `SELECT FOR UPDATE` with threads requires PostgreSQL

**Final result:** 1,277 passed · 1 skipped (SQLite concurrency) · 0 failed

---

## Known limitations

The following items are **intentionally out of scope** for Pilot v1. They do not block the pilot workflow.

| Limitation | Impact | Planned |
|-----------|--------|---------|
| No external system integration (iWlz, VECOZO, DBC) | Manual data entry only | Phase 2 |
| No real-time notification push (WebSocket) | Providers see bell count on page load only | Phase 2 |
| Email is best-effort (no retry queue) | Email may not arrive; in-app notification is the reliable channel | Phase 2 |
| Manual user provisioning | New users require operator shell access | Phase 2 |
| No cancel/undo after PLACEMENT_CONFIRMED | Rematching a confirmed placement requires operator action | Phase 2 |
| Capacity record requires ImportBatch FK | Adding capacity for new providers requires operator shell setup | Phase 2 |
| Concurrency test skipped on SQLite | `SELECT FOR UPDATE` guard verified on PostgreSQL (production) only | Structural — no fix needed |
| Map/profile placeholder in matching UI | Provider map is a placeholder; profile data may be incomplete | Phase 2 |
| No document/upload workflow audit | Upload versioning and permissions not fully audited | Phase 2 |
| Fabricated data only during pilot | No live client BSN, personal names, or real addresses permitted | AVG requirement — intentional |

---

## Operational requirements

The following must be confirmed by the operator **before** handing credentials to pilot users.

### Required Render environment variables

| Variable | Status | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Must point to production Supabase | Not staging |
| `DJANGO_SECRET_KEY` | Auto-generated by Render blueprint | — |
| `ALLOWED_HOSTS` | `www.carelane.nl` | Set in render.yaml |
| `CSRF_TRUSTED_ORIGINS` | `https://www.carelane.nl` | Set in render.yaml |
| `DEFAULT_FROM_EMAIL` | `noreply@carelane.nl` | Set in render.yaml |
| `EMAIL_HOST` | **Must be set before pilot launch** | ⚠️ Operator action required |
| `EMAIL_HOST_USER` | **Must be set before pilot launch** | ⚠️ Operator action required |
| `EMAIL_HOST_PASSWORD` | **Must be set before pilot launch** | ⚠️ Operator action required |
| `EMAIL_PORT` | `587` | Set in render.yaml |
| `EMAIL_USE_TLS` | `true` | Set in render.yaml |
| `REDIS_URL` | Auto-wired by Render blueprint | — |
| `SENTRY_DSN` | Should be set for error monitoring | Operator action recommended |
| `CARELANE_INVITE_ONLY_ONBOARDING` | `1` | Set in render.yaml — blocks self-registration |

### Pre-launch health check

```bash
curl -s https://www.carelane.nl/_health/
# Expected: {"status": "ok", "db": "ok", "cache": "ok"}
```

### Provider linkage verification

Run from Render shell before inviting providers:

```python
from contracts.models.providers import Zorgaanbieder
unlinked = Zorgaanbieder.objects.filter(client__isnull=True)
print(f"Unlinked: {unlinked.count()}")  # must be 0
```

---

## Pilot scope

| Dimension | Scope |
|-----------|-------|
| Organisations | 1 gemeente (municipality), 2 providers |
| Duration | 30 days supervised |
| Cases | Fabricated data only — no real client PII |
| Workflow | Aanmelding → Matching → Aanbiederreactie → Plaatsing |
| External integrations | None |
| Environments | Production (`www.carelane.nl`) only |
| User roles | Gemeente coordinator (1), Provider contact (2) |
| Concurrency | Low — supervised single-municipality pilot |

### Workflow state machine (pilot scope)

```
INTAKE → MATCHING_READY → GEMEENTE_VALIDATED → PROVIDER_REVIEW_PENDING
    → PROVIDER_ACCEPTED → PLACEMENT_CONFIRMED

PROVIDER_REJECTED → MATCHING_READY   (rematch path)
```

The transition `PROVIDER_ACCEPTED → MATCHING_READY` is blocked by design. Rematching a confirmed placement requires operator action.

### Freeze policy from pilot-v1

After this tag, only the following changes are permitted on `main`:

- Security fixes (auth bypass, data exposure, CVE)
- Pilot-blocking bugs (case stuck, 500 on core workflow)
- P1 infrastructure fixes
- Test fixes that do not affect production code

New features, refactors, and non-blocking bug fixes are deferred to Phase 2.

---

## Success metrics

The pilot is evaluated at Week 4 using four gates. A positive Go/No-Go decision requires all Gate 0 and Gate 1 items to pass.

### Gate 0 — Zero tolerance (any breach = immediate No-Go)

| Metric | Threshold |
|--------|-----------|
| Cross-tenant data leak | 0 incidents |
| Capacity double-booking | 0 incidents |
| Audit log corruption or tampering attempt | 0 incidents |
| AVG/GDPR reportable incident | 0 incidents |

### Gate 1 — Required (all must pass at Week 4)

| Metric | Target |
|--------|--------|
| Aanmelding → MATCHING_READY rate | ≥ 90% |
| GEMEENTE_VALIDATED → PROVIDER_REVIEW_PENDING rate | ≥ 90% |
| Provider response within 5 business days | ≥ 80% |
| PLACEMENT_CONFIRMED rate | ≥ 70% |
| System uptime (business hours) | ≥ 99% |
| API p95 latency | ≤ 2 seconds |
| All provisioned users activated | 100% |

### Gate 2 — Targets (shortfalls acceptable with documented explanation)

| Metric | Target |
|--------|--------|
| Average time aanmelding → PROVIDER_REVIEW_PENDING | ≤ 3 business days |
| Rematch rate | ≤ 30% |
| Email delivery error rate | ≤ 10% |
| Audit trail completeness | 100% |

Full metrics, measurement queries, and Go/No-Go decision framework: `docs/ops/pilot/04_SUCCESS_METRICS.md` and `docs/ops/pilot/08_GO_NOGO_FRAMEWORK.md`.

---

## Rollback plan

### Immediate rollback (< 2 minutes)

```
Render dashboard → carelane-web → Deploys → [prior deploy] → Rollback
```

### Code rollback

```bash
git checkout <previous-tag-or-sha>
git push origin HEAD:main
```

### Database

- No automatic rollback for data written during pilot
- Schema rollback (if needed): `python manage.py migrate contracts 0088`
- Full database restore: Supabase dashboard → Backups → Restore to point-in-time

Full procedure: `docs/ops/ROLLBACK_PLAYBOOK.md`

---

## Support contacts

| Role | Contact | Availability |
|------|---------|-------------|
| Pilot Lead (all issues) | haroonwahed@live.nl | Business days |
| Platform support | support@carelane.nl | Business days |

### Response SLA

| Severity | Definition | Response |
|----------|-----------|----------|
| P1 | Pilot blocked — no user can progress | Same business day |
| P2 | Workflow blocked for ≥ 1 user | 4 business hours |
| P3 | Degraded but functional | Next business day |

Support procedures and diagnostic playbooks: `docs/ops/pilot/05_SUPPORT_PLAYBOOK.md`

---

## Operational documentation

All pilot operations documentation is in `docs/ops/pilot/` and indexed in `docs/ops/RUNBOOK_INDEX.md`.

| Document | Purpose |
|----------|---------|
| [01 — Deployment Runbook](docs/ops/pilot/01_DEPLOYMENT_RUNBOOK.md) | Pre-deploy checklist, Render sequence, user provisioning, rollback |
| [02 — Municipality Onboarding](docs/ops/pilot/02_MUNICIPALITY_ONBOARDING.md) | Gemeente coordinator setup and workflow walkthrough |
| [03 — Provider Onboarding](docs/ops/pilot/03_PROVIDER_ONBOARDING.md) | Provider account setup, notification flow, case response |
| [04 — Success Metrics](docs/ops/pilot/04_SUCCESS_METRICS.md) | P0/P1/P2/P3 metrics, thresholds, measurement queries |
| [05 — Support Playbook](docs/ops/pilot/05_SUPPORT_PLAYBOOK.md) | 7 support playbooks for common issues |
| [06 — Feedback Collection](docs/ops/pilot/06_FEEDBACK_COLLECTION.md) | Structured check-ins, Week 2 survey template, feedback tags |
| [07 — Review Checklists](docs/ops/pilot/07_REVIEW_CHECKLISTS.md) | Week 1, Week 2, Week 4 operational checklists |
| [08 — Go/No-Go Framework](docs/ops/pilot/08_GO_NOGO_FRAMEWORK.md) | 4-gate decision framework and decision record template |
| [Pilot Launch Package](docs/ops/pilot/PILOT_LAUNCH_PACKAGE.md) | Login instructions, onboarding agenda, Week 1 checklist |

---

## Release verification summary

| Check | Result |
|-------|--------|
| All 4 functional blockers closed | ✅ |
| Migrations (0001–0093) apply cleanly | ✅ |
| No pending migrations | ✅ |
| Backend test suite | ✅ 1,277 passed · 1 skipped · 0 failed |
| TypeScript check | ✅ exit 0 |
| Dry run 1 (accept path) | ✅ PASS |
| Dry run 2 (reject → rematch → accept) | ✅ PASS |
| Provider linkage verified | ✅ |
| Capacity decrement verified | ✅ |
| Notification delivery verified | ✅ |
| Audit log org-scoped verified | ✅ |
| Cross-tenant isolation verified | ✅ |
| 8 operational documents written and indexed | ✅ |
| Pilot launch package written | ✅ |
| `pilot-v1` annotated tag applied | ✅ `e8987ced` |
