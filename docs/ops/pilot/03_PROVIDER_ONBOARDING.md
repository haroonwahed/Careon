# Provider (Zorgaanbieder) Onboarding Guide

**Audience:** Pilot Operations Lead onboarding a provider contact  
**Time required:** ~20 minutes  
**Prerequisites:** Provider user account created, Zorgaanbieder linked to Client record  

---

## What you do in this system

As a provider (zorgaanbieder), Carelane notifies you when a municipality has selected your organisation for a care case. Your role is:

1. Receive a notification when a case is sent to you
2. Review the case details
3. Accept or decline the placement request

You do **not** see cases assigned to other providers, and you cannot see the full case list of the municipality.

---

## Accounts and access

### Your login

- **Login URL:** `https://www.carelane.nl/care/`
- **Username:** provided by your contact at the municipality or pilot lead
- **Temporary password:** provided via separate secure channel

Change your password on first login.

### What you can see

| Feature | Provider access |
|---------|----------------|
| Cases assigned to your organisation | ✅ Yes |
| Other organisations' cases | ✅ No |
| Audit log | No (gemeente-only feature) |
| Matching candidates | No (gemeente-only feature) |
| Your own notification inbox | ✅ Yes |

---

## How notifications work

### In-app bell

When the municipality sends a case to your organisation, the bell icon in the top bar shows an unread count. Click the bell to see the notification.

The notification contains:
- A reference number for the case
- A prompt to log in and respond

### Email notification

You will also receive an email to the address registered for your organisation. The email comes from `noreply@carelane.nl` and contains the case reference and a prompt to log in.

> If you are not receiving emails, contact the pilot lead. Your contact email may need to be updated in the system.

---

## Responding to a case

### Step 1 — Find the case

After login, navigate to **Casussen** in the sidebar. Cases assigned to your organisation appear here with status **PROVIDER_REVIEW_PENDING**.

### Step 2 — Review the case

Click on a case to open it. You will see:
- The care form requested
- Urgency level
- Start date
- Region

### Step 3 — Respond

In the case detail panel, you will see two actions:

**Accepteren (Accept)**
- Click to accept the placement
- The case moves to PROVIDER_ACCEPTED
- The municipality is notified
- Your capacity is decremented by 1 in the system

**Afwijzen (Decline)**
- Click to decline the placement
- You may be asked to provide a reason
- The case returns to the municipality for rematching
- Your capacity is not affected

---

## Capacity

The system tracks available capacity per organisation. When you accept a placement:
- Available capacity decreases by 1 automatically
- The system prevents double-booking: if two requests arrive simultaneously, only one will succeed

If capacity reaches 0 for your organisation, the matching engine will not assign new cases to you until capacity is updated. Contact the pilot lead if your capacity settings need adjustment.

---

## Pilot data rules

This pilot uses fabricated data only:
- Case references are test cases — not real clients
- Do not act as if these are real placements for reporting or invoicing purposes
- Do not enter real client information anywhere in the system during this pilot

---

## What to do when something goes wrong

| Problem | What to do |
|---------|-----------|
| You didn't receive an email for a case | Check spam folder. Contact pilot lead if not there. |
| You can't see a case the gemeente says they sent | Contact pilot lead with the case reference. |
| You accepted a case by mistake | Contact pilot lead immediately — capacity rollback requires operator action. |
| You see unexpected data (another org's cases) | Stop and contact pilot lead as P1. |
| System error or blank page | Note the URL and contact pilot lead. |

**Support contact:** haroonwahed@live.nl  
**Response time:** same business day during supervised pilot weeks

---

## First session checklist

```
[ ] Login succeeds at https://www.carelane.nl/care/
[ ] Bell icon visible in top navigation bar
[ ] Navigate to Casussen — see at least one case in PROVIDER_REVIEW_PENDING
[ ] Click case to view details
[ ] Accept OR decline the test case
[ ] Confirm case status updates correctly
[ ] Check email inbox — received notification email for the test case
[ ] Logout successfully
```

---

## Contact

All questions during the pilot go to the pilot lead first:

**Pilot lead:** haroonwahed@live.nl  
**Response:** same business day (week 1 supervised); 4 business hours for blocked workflow
