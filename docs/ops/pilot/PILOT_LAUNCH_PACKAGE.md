# Carelane Pilot Launch Package

**Tag:** pilot-v1  
**Prepared:** 2026-06-22  
**Prepared by:** Pilot Operations Lead  

---

## Pilot URL

```
https://www.carelane.nl/care/
```

---

## Login instructions

Credentials are sent via **two separate channels** (URL + username via one channel, password via a different secure channel).

| User | Username | Role | Org |
|------|----------|------|-----|
| Gemeente Coordinator | `pilot_gemeente_coord` | OWNER — Gemeente | Pilot Gemeente Alpha |
| Provider Alpha Contact | `pilot_provider_alpha` | OWNER — Provider | Pilot Aanbieder Alpha |
| Provider Beta Contact | `pilot_provider_beta` | OWNER — Provider | Pilot Aanbieder Beta |

**Change password on first login.**

---

## Onboarding agenda

### Day 1 (Morning) — Gemeente Coordinator
- [ ] Receive login credentials (two channels)
- [ ] Login at `https://www.carelane.nl/care/`
- [ ] Change password
- [ ] Read [Municipality Onboarding Guide](02_MUNICIPALITY_ONBOARDING.md) (15 min)
- [ ] Complete First Session Checklist in that guide
- [ ] Create first test case: "Pilotcasus 001" (fabricated data)
- [ ] Advance case to MATCHING_READY
- [ ] Call with pilot lead: 30 min walkthrough

### Day 1 (Afternoon) — Provider Alpha
- [ ] Receive login credentials (two channels)
- [ ] Login at `https://www.carelane.nl/care/`
- [ ] Change password
- [ ] Read [Provider Onboarding Guide](03_PROVIDER_ONBOARDING.md) (10 min)
- [ ] Complete First Session Checklist in that guide

### Day 2 — First live case through full workflow
- [ ] Gemeente sends "Pilotcasus 001" to Provider Alpha
- [ ] Provider Alpha receives in-app notification + email
- [ ] Provider Alpha accepts or declines
- [ ] Gemeente confirms placement (if accepted) OR rematches (if declined)
- [ ] Gemeente reviews audit log for the case

---

## Support contact

**Pilot Lead:** haroonwahed@live.nl  
**Support email:** support@carelane.nl  

| Severity | Response time |
|----------|--------------|
| P1 — Workflow blocked for all users | Same business day |
| P2 — Workflow blocked for 1 user | 4 business hours |
| P3 — Degraded / cosmetic | Next business day |

Full support procedures: [Support Playbook](05_SUPPORT_PLAYBOOK.md)

---

## Success metrics

Pilot is considered successful if, at Week 4:
- Zero data isolation incidents
- ≥ 90% of cases advance from Aanmelding to MATCHING_READY
- ≥ 80% of provider assignments receive a response within 5 business days
- ≥ 70% of accepted cases reach PLACEMENT_CONFIRMED
- System uptime ≥ 99% during business hours

Full metrics: [Pilot Success Metrics](04_SUCCESS_METRICS.md)

---

## Week 1 review checklist

See [Review Checklists — End of Week 1](07_REVIEW_CHECKLISTS.md#end-of-week-1-checklist).

Key items:
- All users activated (logged in ≥ once)
- At least 1 case sent to provider
- At least 1 provider response received
- `/_health/` returns `{"status": "ok"}`
- No P1 incidents unresolved
- No cross-tenant data leak reported

---

## Known limitations (pilot scope)

From [PILOT_KNOWN_LIMITATIONS.md](../../PILOT_KNOWN_LIMITATIONS.md):

1. **No external system integration** — no iWlz/VECOZO connection in this pilot.
2. **No real-time push** — provider notifications arrive at login; no WebSocket push.
3. **Email best-effort** — email delivery is fire-and-forget; in-app notification is the reliable channel.
4. **Capacity requires operator update** — capacity increments/decrements are automatic, but the initial capacity values for new providers require operator setup via shell.
5. **No cancel/undo after PLACEMENT_CONFIRMED** — rematching a confirmed placement requires operator action.
6. **Fabricated data only** — no real client BSN, addresses, or personal information during this pilot.
7. **Concurrency test skipped on SQLite** — the SELECT FOR UPDATE concurrency guard is verified on PostgreSQL (Render production) only; the test is correctly skipped in local SQLite.
8. **Manual user provisioning** — new pilot users require operator shell access; no self-registration.

---

## Rollback plan

### Immediate rollback (< 2 min)
```
Render dashboard → carelane-web → Deploys → pilot-v1 deploy → Rollback
```

### Code rollback
```bash
git tag -l   # confirm pilot-v1 tag exists
git push origin pilot-v1   # Render redeploys from tag
```

### Database
- No automatic rollback for data written during pilot
- Rollback to pre-pilot state requires restoring from Supabase backup
- Supabase backup cadence: daily (Render PostgreSQL managed backup)

Full rollback procedure: [Rollback Playbook](../ROLLBACK_PLAYBOOK.md)

---

## Operator actions still required

Before handing credentials to users:

1. **Set EMAIL_HOST credentials in Render dashboard** — `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`. Without this, provider email notifications will not be delivered (in-app notifications still work).

2. **Verify Render production service health** — run `curl https://www.carelane.nl/_health/` and confirm `{"status":"ok","db":"ok","cache":"ok"}`.

3. **Confirm Zorgaanbieder linkage for all pilot providers** — run from Render shell:
   ```python
   from contracts.models.providers import Zorgaanbieder
   for za in Zorgaanbieder.objects.filter(client__isnull=True):
       print(f"UNLINKED: {za.name}")
   ```

---

## Freeze policy from pilot-v1

After tagging `pilot-v1`, only the following changes are permitted on `main`:

| Change type | Allowed |
|------------|---------|
| Security fixes (CVE, auth bypass, data exposure) | ✅ |
| Pilot-blocking bugs (case stuck, 500 on core flow) | ✅ |
| P1 infrastructure fixes | ✅ |
| Test fixes (not affecting production code) | ✅ |
| New features | ✗ |
| Refactors | ✗ |
| Documentation beyond ops docs | ✗ |
| Non-pilot-blocking bug fixes | ✗ (defer to Phase 2) |

Any non-emergency change requires written agreement from the Pilot Operations Lead before merge.
