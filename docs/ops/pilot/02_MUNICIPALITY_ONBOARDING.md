# Gemeente Onboarding Guide

**Audience:** Pilot Operations Lead onboarding a municipality coordinator  
**Time required:** ~45 minutes (operator + coordinator together)  
**Prerequisites:** Deployment Runbook completed, account credentials ready  

---

## What this pilot is

Carelane is a digital coordination tool for matching youth care clients to providers. During this 30-day supervised pilot, your organisation uses Carelane to:

1. Register a care case (aanmelding)
2. Review matching suggestions and select a provider
3. Monitor provider response
4. Confirm placement
5. View audit history

**What this pilot is not:**
- A replacement for your zaaksysteem or DBC administration
- A legally binding process system
- Connected to external iWlz/VECOZO systems (pilot scope)

---

## Accounts and access

### Your accounts

You will receive:
- **Login URL:** `https://www.carelane.nl/care/`
- **Username:** provided separately
- **Temporary password:** provided via separate secure channel

**Change your password on first login.** The system enforces `login_required` on all pages.

### Roles in the system

| Role | What they can do |
|------|-----------------|
| **Gemeente (OWNER/ADMIN)** | All intake, matching, placement, audit access |
| **Zorgaanbieder** | Review assigned cases only; no audit log access |

Your coordinator account has the Gemeente role. Provider accounts are managed separately.

### Adding team members

To add a second coordinator:
1. Go to **Instellingen** (top-right profile icon)
2. Navigate to **Team / Leden**
3. Enter email address and role (Admin or Member)
4. The invite system will create an account

> **Note:** `CARELANE_INVITE_ONLY_ONBOARDING` is active. New accounts are only created through the invite flow — not by self-registration. This protects your tenant data.

---

## The case workflow

### Step 1 — Aanmelding (Register a case)

1. Click **Nieuwe casus** in the left sidebar
2. Fill in:
   - Client reference (use anonymous reference in pilot — no real BSN)
   - Zorgvorm gewenst (care form)
   - Urgency level
   - Start date
3. Submit → case lands in **Intake** status

> **Pilot rule:** Use fabricated data. No real client names, BSN, or addresses. Use references like "Testclient A" or "Pilotcasus 001".

### Step 2 — Assessment

1. Open the case → navigate to **Beoordeling**
2. Complete the assessment form
3. Mark assessment as **Goedgekeurd voor matching**
4. Case advances to **Matching Ready**

### Step 3 — Matching

1. Open case → navigate to **Matching**
2. The system shows ranked matching candidates based on care form, capacity, and region
3. Review candidates
4. Select preferred provider
5. Click **Valideer selectie** (gemeente validation step)
6. Click **Verzend naar aanbieder** → case moves to **PROVIDER_REVIEW_PENDING**

The selected provider now receives:
- An in-app notification (bell icon on their account)
- An email to their registered contact address

### Step 4 — Aanbiederreactie (Waiting for provider)

The case is now with the provider. You can see the status in your case list.

- **PROVIDER_REVIEW_PENDING** — awaiting response
- **PROVIDER_ACCEPTED** — provider accepted
- **PROVIDER_REJECTED** — provider declined; you can rematch

If a provider rejects:
1. Case returns to **MATCHING_READY**
2. Select a different provider and repeat Step 3

### Step 5 — Plaatsing bevestigen

After provider acceptance:
1. Open case → navigate to **Plaatsing**
2. Review placement details
3. Click **Bevestig plaatsing**
4. Case moves to **PLACEMENT_CONFIRMED**
5. Provider capacity is decremented automatically

### Step 6 — Monitoring

After placement confirmation, the case enters the monitoring phase. You can:
- View case timeline
- See decision log
- Export audit log (CSV or JSON) via **Audit log** in the sidebar

---

## Audit log

The audit log records every meaningful action. Access it via **Audit log** in the sidebar.

- Scoped to your organisation — you see your cases only
- Records survive if a user leaves your team (org-scoped, not user-scoped)
- Export available for compliance review

---

## What to do when something goes wrong

| Problem | What to do |
|---------|-----------|
| Can't log in | Check username/password. Contact support (see below). |
| Case is stuck in wrong state | Do not try to force-advance. Contact support with the case reference. |
| Provider says they didn't receive a notification | Check provider email; if missing, contact support to verify `EMAIL_HOST` config. |
| You see another organisation's data | Stop immediately. Contact support as P1. |
| Page shows an error message | Note the URL and error text. Contact support. |

**Support contact:** haroonwahed@live.nl  
**Response time:** same business day during pilot week 1; 4 hours for workflow-blocking issues

---

## Pilot data rules

1. **No real client data.** Use fabricated names and references.
2. **No real BSN numbers.** Use test references only.
3. **No production provider addresses.** Use generalised location (postcode region only).
4. **Report any real data you accidentally enter** to the pilot lead immediately.

These rules are required for AVG compliance during the trial period.

---

## First session checklist

Complete this on Day 1 before involving any providers:

```
[ ] Login succeeds
[ ] Can see the case list (empty is fine)
[ ] Create one test case: "Pilotcasus 001" (fabricated data)
[ ] Advance to MATCHING_READY
[ ] See at least one matching candidate
[ ] Send to a test provider
[ ] Confirm provider received notification (via email or in-app bell)
[ ] Return to audit log — see the transition event logged
[ ] Logout and log back in
```

If any step fails, contact support before proceeding.

---

## Frequently asked questions

**Q: Can multiple coordinators work on the same case?**  
A: Yes. Any team member with the Gemeente role can act on any case in your organisation.

**Q: What happens to cases when the pilot ends?**  
A: Data persists on the platform. No automatic deletion. Export your audit log before the pilot ends.

**Q: Can we add more providers during the pilot?**  
A: Yes, contact the pilot lead. New providers need a user account and their Zorgaanbieder must be linked in the system.

**Q: Is the matching recommendation binding?**  
A: No. Matching is advisory. You can override the top match and select any available provider.

**Q: What if we need to rematch?**  
A: If a provider rejects, the case returns to MATCHING_READY automatically. If you want to rematch a confirmed placement, contact the pilot lead — this requires operator action.
