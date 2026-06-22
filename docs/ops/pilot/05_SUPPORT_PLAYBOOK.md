# Pilot Support Playbook

**Audience:** Pilot Operations Lead handling support requests  
**Scope:** 30-day supervised pilot  
**SLA:** P1 = same business day; P2 = 4 business hours; P3 = next business day  

---

## Severity definitions

| Level | Definition | Examples |
|-------|-----------|---------|
| **P1** | Pilot blocked — no user can progress | Login broken, app returns 500, data isolation breach |
| **P2** | Workflow blocked for ≥ 1 user | Case stuck in wrong state, provider not notified, email not sending |
| **P3** | Degraded but functional | Slow responses, confusing UI, notification bell wrong count |

Upgrade P2 → P1 if it affects all users or involves data integrity.

---

## Playbook 1 — User cannot log in

**Reported as:** "Ik kan niet inloggen" / "Login fails"

```
1. Ask: exact error message? (wrong password / account locked / 500 error)

2. Wrong password:
   → From Render shell:
   python manage.py shell -c "
   from django.contrib.auth import get_user_model
   User = get_user_model()
   u = User.objects.get(username='<USERNAME>')
   u.set_password('TEMP_NEW_PASSWORD')
   u.save()
   print('Password reset.')
   "
   → Send new temp password via secure channel
   → Instruct user to change immediately

3. Account locked (too many attempts):
   → From Render shell:
   python manage.py shell -c "
   from django.contrib.auth import get_user_model
   User = get_user_model()
   u = User.objects.get(username='<USERNAME>')
   u.is_active = True
   u.save()
   print('Unlocked.')
   "

4. 500 error on login page:
   → Check Sentry — likely a DB or settings issue
   → Escalate to infrastructure check (/_health/)
```

---

## Playbook 2 — Case stuck in wrong workflow state

**Reported as:** "Case toont verkeerde status" / "Kan stap niet voltooien"

```
1. Ask user: case reference (case ID from URL), current displayed state, 
   expected state, last action they took.

2. Check actual state:
   python manage.py shell -c "
   from contracts.models import CaseIntakeProcess
   intake = CaseIntakeProcess.objects.get(pk=<CASE_ID>)
   print(f'State: {intake.workflow_state}')
   print(f'Status: {intake.status}')
   "

3. Valid state transitions only:
   MATCHING_READY → GEMEENTE_VALIDATED → PROVIDER_REVIEW_PENDING
   → PROVIDER_ACCEPTED → PLACEMENT_CONFIRMED
   PROVIDER_REJECTED → MATCHING_READY  (only rematch path)

4. If state is correct but UI shows wrong value:
   → Hard refresh (Ctrl+Shift+R). SPA may have stale state.

5. If state is genuinely wrong (e.g., GEMEENTE_VALIDATED when placement was confirmed):
   → Do NOT manually set workflow_state via shell without explicit lead approval
   → Log the discrepancy: case ID, expected state, actual state, how it got there
   → Treat as potential code bug; check Sentry for errors around that case
   → Only correct manually if blocking pilot and you understand the cause

6. Document the incident in PILOT_INCIDENT_LOG.md
```

---

## Playbook 3 — Provider not receiving notifications

**Reported as:** "Aanbieder heeft geen melding ontvangen"

```
1. Verify in-app notification was created:
   python manage.py shell -c "
   from contracts.models.governance import Notification
   from contracts.models import CaseIntakeProcess
   intake = CaseIntakeProcess.objects.get(pk=<INTAKE_ID>)
   notifs = Notification.objects.filter(
       message__contains=str(intake.pk),
       notification_type='APPROVAL'
   )
   print(f'{notifs.count()} notification(s) created')
   for n in notifs:
       print(f'  recipient={n.recipient.username} is_read={n.is_read}')
   "

2. If 0 notifications:
   → The send_to_provider action may have failed silently (check Sentry)
   → Check application log for:
     "notify_provider_review_requested: provider client X has no active members"
     (provider org has no users — see provisioning fix)

3. If notification exists but email not received:
   a) Check application log for:
      "notify_provider_review_requested: no contact email for provider client X"
      → Fix: set Client.primary_contact_email
      python manage.py shell -c "
      from contracts.models import Client
      c = Client.objects.get(pk=<CLIENT_ID>)
      c.primary_contact_email = 'correct@provider.nl'
      c.save(update_fields=['primary_contact_email'])
      "
   b) Check for:
      "notify_provider_review_requested: failed to send email"
      → EMAIL_HOST or credentials misconfigured
      → Verify EMAIL_HOST in Render environment variables
      → Test: python manage.py shell -c "
        from django.core.mail import send_mail
        send_mail('Test', 'Test body', None, ['you@test.nl'])
        print('Sent.')
        "

4. If email config confirmed broken:
   → Set EMAIL_HOST credentials in Render dashboard
   → Trigger a test send
   → Consider: manually inform provider via direct message while email is fixed
```

---

## Playbook 4 — Capacity error (409 on placement confirmation)

**Reported as:** "Plaatsing mislukt — geen capaciteit" / 409 error in browser network tab

```
1. This is working as designed. The 409 means the provider's capacity is 0 
   or was consumed by a concurrent request.

2. Check current capacity:
   python manage.py shell -c "
   from contracts.models.providers import Zorgaanbieder
   from contracts.models import Client
   client = Client.objects.get(pk=<PROVIDER_CLIENT_ID>)
   za = getattr(client, 'zorgaanbieder', None)
   if za:
       for v in za.vestigingen.all():
           for cr in v.capaciteit_records.order_by('-recorded_at')[:1]:
               print(f'Vestiging={v.name} beschikbaar={cr.beschikbare_capaciteit} open_slots={cr.open_slots}')
   else:
       print('No Zorgaanbieder linked')
   "

3. If capacity is 0 but should be higher:
   → Contact pilot lead for capacity record update
   → Do NOT update capacity records via shell without lead approval
   → For pilot: capacity can be manually adjusted by creating a new CapaciteitRecord

4. If capacity is > 0 but still getting 409:
   → Possible race condition resolved correctly (second of two concurrent requests)
   → Reload page and try again
   → If persistent: Sentry investigation needed
```

---

## Playbook 5 — Potential cross-tenant data leak

**Reported as:** "Ik zie casussen van een andere organisatie"

**TREAT AS P1. Act immediately.**

```
1. Ask user: what did they see, exactly? (screenshot if possible)
   Do not ask them to navigate further.

2. Immediately check for real leakage:
   python manage.py shell -c "
   from contracts.models import CareCase
   # Check if any case is visible outside its org
   from contracts.tenancy import get_user_organization
   from django.contrib.auth import get_user_model
   User = get_user_model()
   u = User.objects.get(username='<REPORTING_USER>')
   from contracts.models import Organization
   org = get_user_organization(u)
   if org:
       print(f'User org: {org.slug}')
       # Check for cases not in their org visible in API response
       other_cases = CareCase.objects.exclude(organization=org).count()
       print(f'Cases in other orgs (should be inaccessible): {other_cases}')
   "

3. If real leakage confirmed:
   a) Immediately disable the affected user account:
      python manage.py shell -c "
      from django.contrib.auth import get_user_model
      User = get_user_model()
      u = User.objects.get(username='<USER>')
      u.is_active = False
      u.save()
      print('Account disabled.')
      "
   b) Notify all affected organisation contacts
   c) Raise P1 incident — do NOT proceed with pilot until root cause is found
   d) Document incident timestamp, affected users, data scope
   e) This is a potential AVG breach — document for 72h notification assessment

4. If false alarm (user confused about which org context they're in):
   → Explain the context switcher in the top bar
   → Document as P3 UX issue
```

---

## Playbook 6 — Application returning 500 errors

**Reported as:** Error page, blank screen, or API returning 500

```
1. Check /_health/:
   curl -s https://www.carelane.nl/_health/
   → {"status": "ok"} = app is up; problem is specific to that endpoint
   → {"db": "error"} = database issue; check Supabase connection pool
   → 500 or no response = app is down; check Render service status

2. Check Sentry for the error:
   → Look for the stack trace; the error message usually identifies the cause
   → Note correlation_id from the error (shown in Render logs and Sentry)

3. Check Render logs:
   → Dashboard → carelane-web → Logs
   → Filter for ERROR or CRITICAL level

4. Common causes during pilot:
   a) DB connection pool exhausted (Supabase free tier = 10 connections max)
      → Reduce GUNICORN_WORKERS to 1 in Render env vars
   b) Redis unavailable
      → Check carelane-redis service in Render dashboard
   c) New deploy with broken code
      → Immediately rollback via Render dashboard (< 2 min)

5. If resolution not clear within 15 minutes:
   → Rollback to last known good deploy
   → Notify pilot users of the interruption
   → Investigate root cause on staging before redeploying
```

---

## Playbook 7 — Audit log concerns

**Reported as:** "We can't see an event that should be logged" or concern about completeness

```
1. Query audit log for the specific case:
   python manage.py shell -c "
   from contracts.models import AuditLog
   entries = AuditLog.objects.filter(
       model_name='CaseIntakeProcess',
       object_id=<INTAKE_ID>
   ).order_by('timestamp')
   for e in entries:
       print(f'{e.timestamp} | {e.action} | {e.user} | {e.object_repr}')
   "

2. Verify state transition events are present:
   from contracts.models import CaseDecisionLog
   logs = CaseDecisionLog.objects.filter(case_id=<INTAKE_ID>).order_by('timestamp')
   for l in logs:
       print(f'{l.timestamp} | {l.event_type} | {l.user_action}')

3. If a log is missing:
   → Check if the action was completed in the UI (vs. interrupted)
   → Check Sentry for errors around that time
   → GovernanceLogImmutableError in logs = someone attempted to modify a row (security alert)

4. Audit log is append-only. Missing logs = action did not complete, not tampering.
```

---

## Support log template

For every P1/P2 incident, log in `PILOT_INCIDENT_LOG.md`:

```markdown
## Incident — [DATE]

- **Reporter:** [user/org name]
- **Severity:** P1 / P2 / P3
- **Time reported:** HH:MM CET
- **Description:** [what they reported]
- **Root cause:** [what was found]
- **Resolution:** [what was done]
- **Time resolved:** HH:MM CET
- **User impact:** [who was affected, for how long]
- **Follow-up required:** yes/no — [if yes, what]
```
