# Pilot Deployment Runbook

**Version:** 1.0  
**Owner:** Pilot Operations Lead  
**Audience:** Operator executing the first production deployment  
**Last updated:** 2026-06-22  

---

## 1. Pre-deployment checklist (complete before touching Render)

All items must be ✅ before proceeding. If any are ✗, stop and resolve first.

```
[ ] Git: main branch is green on CI
[ ] Git: all four blockers merged (migrations 0089–0093 present)
[ ] Git: no uncommitted changes on the deployment branch

[ ] Render: DATABASE_URL points at PRODUCTION Supabase project (not staging)
[ ] Render: SECRET_KEY is set (render.yaml generateValue: true handles first deploy)
[ ] Render: ALLOWED_HOSTS=www.carelane.nl (or pilot subdomain)
[ ] Render: CSRF_TRUSTED_ORIGINS=https://www.carelane.nl
[ ] Render: DEFAULT_FROM_EMAIL=noreply@carelane.nl
[ ] Render: EMAIL_HOST set (SMTP provider hostname)
[ ] Render: EMAIL_HOST_USER set
[ ] Render: EMAIL_HOST_PASSWORD set
[ ] Render: REDIS_URL wired from carelane-redis service (blueprint handles this)
[ ] Render: SENTRY_DSN set (Sentry project for production)
[ ] Render: CARELANE_INVITE_ONLY_ONBOARDING=1
[ ] Render: PILOT_AUTO_BOOTSTRAP not set (or "0") on production service
```

---

## 2. Deploy sequence

### Step 1 — Trigger deploy

```bash
# Option A: push to main (if auto-deploy is enabled in Render)
git push origin main

# Option B: manual deploy via Render dashboard
# Dashboard → carelane-web → Manual Deploy → Deploy latest commit
```

### Step 2 — Watch build logs (Render dashboard → Logs)

Expected sequence:
```
==> Building...
==> pip install -r requirements/base.txt
==> python manage.py collectstatic
==> python manage.py migrate
  Running migrations:
    No migrations to apply.          ← correct; all migrations pre-applied
==> Gunicorn starting...
```

**Stop if you see:**
- `ImproperlyConfigured` — missing required env var; check pre-deployment checklist
- `RuntimeWarning: EMAIL_HOST is not configured` — set EMAIL_HOST before inviting users
- Any `django.db.utils` errors — DB connection problem; check DATABASE_URL
- Migration failure — do not proceed; see §6 Rollback

### Step 3 — Health check

```bash
curl -s https://www.carelane.nl/_health/ | python3 -m json.tool
# Expected: {"status": "ok", "db": "ok", "cache": "ok"}
```

If `db: "error"`: check Supabase connection pool and DATABASE_URL.  
If `cache: "error"`: check Redis service is running in Render blueprint.

### Step 4 — Smoke test (unauthenticated)

```bash
# Must return 401 or redirect to login, not 500
curl -s -o /dev/null -w "%{http_code}" https://www.carelane.nl/care/api/me/
# Expected: 401

# Must return 200
curl -s -o /dev/null -w "%{http_code}" https://www.carelane.nl/_health/
# Expected: 200
```

---

## 3. Post-deploy user provisioning

**This must happen after deploy, before handing credentials to pilot users.**

### 3a. Create the gemeente coordinator account

```bash
# Connect to Render shell (Dashboard → carelane-web → Shell)
python manage.py shell << 'EOF'
from django.contrib.auth import get_user_model
from contracts.models import Organization, OrganizationMembership, UserProfile

User = get_user_model()

# Replace with real values
USERNAME = "gemeente_coordinator"
EMAIL = "coordinator@gemeente-pilot.nl"
PASSWORD = "CHANGE_BEFORE_SHARING"     # use a strong random password
ORG_SLUG = "gemeente-pilot"            # must match your org slug

org, _ = Organization.objects.get_or_create(
    slug=ORG_SLUG,
    defaults={"name": "Gemeente Pilot", "contact_email": EMAIL}
)
u = User.objects.create_user(USERNAME, EMAIL, PASSWORD)
OrganizationMembership.objects.create(
    organization=org, user=u, role="OWNER", is_active=True
)
UserProfile.objects.update_or_create(
    user=u, defaults={"role": "ASSOCIATE"}
)
print(f"Created {USERNAME} in {org.name}")
EOF
```

### 3b. Create provider user accounts

Repeat for each pilot zorgaanbieder:

```bash
python manage.py shell << 'EOF'
from django.contrib.auth import get_user_model
from contracts.models import Organization, OrganizationMembership, Client, UserProfile

User = get_user_model()

PROVIDER_NAME = "Aanbieder De Brug"
PROVIDER_SLUG = "aanbieder-de-brug"
PROVIDER_EMAIL = "plaatsingen@debrug.nl"
USERNAME = "aanbieder_brug"
PASSWORD = "CHANGE_BEFORE_SHARING"

org, _ = Organization.objects.get_or_create(
    slug=PROVIDER_SLUG,
    defaults={
        "name": PROVIDER_NAME,
        "contact_email": PROVIDER_EMAIL,
        "notification_email": PROVIDER_EMAIL,
    }
)
u = User.objects.create_user(USERNAME, PROVIDER_EMAIL, PASSWORD)
OrganizationMembership.objects.create(
    organization=org, user=u, role="OWNER", is_active=True
)
UserProfile.objects.update_or_create(
    user=u, defaults={"role": "ASSOCIATE"}
)

# Link Client to their Organization for notification routing
Client.objects.filter(
    organization__isnull=True,
    name__icontains="De Brug",
    client_type="CORPORATION"
).update(organization=org)

print(f"Created provider user {USERNAME} in {org.name}")
EOF
```

### 3c. Verify Zorgaanbieder → Client linkage

```bash
python manage.py shell << 'EOF'
from contracts.models.providers import Zorgaanbieder

unlinked = Zorgaanbieder.objects.filter(client__isnull=True)
if unlinked.exists():
    print("WARNING — unlinked Zorgaanbieders:")
    for za in unlinked:
        print(f"  ID={za.pk} name={za.name}")
else:
    print("All Zorgaanbieders are linked to a Client. OK.")
EOF
```

If unlinked entries exist, run:
```bash
python manage.py shell << 'EOF'
from contracts.models.providers import Zorgaanbieder
from contracts.models import Client

# Manual link — replace values
za = Zorgaanbieder.objects.get(name="Aanbieder De Brug")
client = Client.objects.get(name="Aanbieder De Brug", client_type="CORPORATION")
if za.client_id != client.pk:
    za.client = client
    za.save(update_fields=["client"])
    print("Linked.")
EOF
```

---

## 4. Post-provisioning verification

Run this before sending credentials to pilot users:

```
[ ] Login as gemeente coordinator → /care/ loads without error
[ ] Create a new case intake (Aanmelding)  
[ ] Advance through matching → MATCHING_READY
[ ] Send to provider (send_to_provider action)
[ ] Login as provider user → notification bell shows > 0
[ ] Provider accepts case → PROVIDER_ACCEPTED
[ ] Gemeente confirms placement → PLACEMENT_CONFIRMED
[ ] Audit log API (/care/api/audit-log/) returns rows scoped to org
[ ] /_health/ still returns {"status": "ok"}
```

---

## 5. Credentials handover

Send credentials **separately** from the login URL:

- Login URL: `https://www.carelane.nl/care/`
- Username: via secure channel (Signal, encrypted email)
- Password: via different channel
- Instruct user to change password on first login

Log the handover date in `docs/ops/pilot/PILOT_HANDOVER_LOG.md`.

---

## 6. Rollback procedure

If anything fails after deploy:

### Option A — Render rollback (< 2 min)
```
Render dashboard → carelane-web → Deploys → previous deploy → Rollback
```

### Option B — Code rollback
```bash
git revert HEAD
git push origin main
# Render auto-deploys from the revert commit
```

### If migration was applied and causes problems:
```bash
# From Render shell — only reverse the last migration
python manage.py migrate contracts 0092   # go back one step
# Then rollback the code deploy
```

Full rollback procedure: `docs/ops/ROLLBACK_PLAYBOOK.md`

---

## 7. Environment reference

| Variable | Where set | Required |
|----------|-----------|---------|
| `DATABASE_URL` | Render dashboard | ✅ |
| `DJANGO_SECRET_KEY` | Render (auto-generated) | ✅ |
| `ALLOWED_HOSTS` | render.yaml value | ✅ |
| `CSRF_TRUSTED_ORIGINS` | render.yaml value | ✅ |
| `DEFAULT_FROM_EMAIL` | Render dashboard | ✅ |
| `EMAIL_HOST` | Render dashboard | ✅ for email |
| `EMAIL_HOST_USER` | Render dashboard | ✅ for email |
| `EMAIL_HOST_PASSWORD` | Render dashboard | ✅ for email |
| `REDIS_URL` | Render blueprint (auto) | ✅ |
| `SENTRY_DSN` | Render dashboard | ✅ for monitoring |
| `CARELANE_INVITE_ONLY_ONBOARDING` | render.yaml `"1"` | ✅ |
| `PILOT_AUTO_BOOTSTRAP` | Not set on production | ✅ |
