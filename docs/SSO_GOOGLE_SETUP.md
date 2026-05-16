# Google SSO Setup (OIDC)

This project supports Google SSO via OIDC using `mozilla-django-oidc`.

## 1. Google Cloud setup

1. Create/select a project in Google Cloud Console.
2. Configure OAuth consent screen.
3. Create OAuth 2.0 Client ID (Web application).
4. Add **Authorized redirect URIs** (must match `OIDC_PUBLIC_BASE_URL` + `/oidc/callback/` exactly):
   - Local: `http://127.0.0.1:8000/oidc/callback/`
   - Production: `https://<your-public-host>/oidc/callback/` (e.g. `https://careon-web.onrender.com/oidc/callback/`)
   - Optional: `http://localhost:8000/oidc/callback/` if you use `localhost` instead of `127.0.0.1`

## 2. Configure environment

Set these before starting Django:

```bash
export SSO_ENABLED=true
export OIDC_RP_CLIENT_ID="<GOOGLE_CLIENT_ID>"
export OIDC_RP_CLIENT_SECRET="<GOOGLE_CLIENT_SECRET>"
export OIDC_OP_DISCOVERY_ENDPOINT="https://accounts.google.com/.well-known/openid-configuration"
export OIDC_RP_SCOPES="openid email profile"

# Canonical Django origin for Google redirect_uri (NOT the Vite :3000 port)
export OIDC_PUBLIC_BASE_URL="http://127.0.0.1:8000"
# Production example:
# export OIDC_PUBLIC_BASE_URL="https://careon-web.onrender.com"
```

Optional restrictions:

```bash
# Comma-separated list. If set, only these email domains can sign in via SSO.
export SSO_ALLOWED_EMAIL_DOMAINS="yourcompany.com"
```

## 3. Install dependency and run

```bash
.venv/bin/pip install mozilla-django-oidc
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

## 4. Test

- Open `/login/`
- Click **Sign in with SSO**

## Notes

- Password login remains available.
- Users are matched by email and auto-provisioned if they do not exist.
- If `SSO_ALLOWED_EMAIL_DOMAINS` is configured, Google users outside those domains are denied.
