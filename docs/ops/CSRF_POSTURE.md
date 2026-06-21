# CSRF posture — Carelane JSON write APIs

**Status:** decided for supervised pilot (2026-06-19)  
**Owner:** backend / security  
**Applies to:** Django session-cookie auth + React SPA on same origin (`/care/`)

## Decision

Mutating JSON API endpoints under `/care/api/` rely on **Django session authentication with CSRF enforcement**, not `@csrf_exempt`.

- There are **no** `@csrf_exempt` decorators on current `contracts/` API views.
- The SPA obtains a CSRF token via `@ensure_csrf_cookie` on auth and shell routes (`contracts/api/auth.py`, `contracts/views/system.py`).
- Browser `fetch` calls include the `X-CSRFToken` header (or form field) for unsafe methods, consistent with Django’s same-site session model.

## Why this is acceptable for pilot

| Control | Implementation |
|--------|------------------|
| Same-origin default | SPA and API share origin; cookies are `SameSite=Lax` (production settings). |
| CSRF token required | Django `CsrfViewMiddleware` rejects POST/PATCH/DELETE without a valid token. |
| Session fixation | Standard Django login rotates session key on authenticate. |
| Cross-site writes | Third-party sites cannot read the CSRF cookie/token for same-origin API calls. |

OIDC / SSO login paths use Django’s built-in CSRF on the authorization redirect flow.

## Explicit non-goals (pilot)

- Bearer-token / JWT-only API access for browser clients (not in scope).
- Double-submit cookie on a separate API subdomain (single Render service today).

## Verification

- Grep guard: `rg '@csrf_exempt' contracts/` must return **no matches** before release.
- Manual: unauthenticated POST to a mutating endpoint → **403** CSRF failure or **302** login redirect.
- CI: auth integration tests exercise session login; platform guardrails run full pytest.

## Follow-up (production hardening)

- Document CSRF token refresh behaviour after long-lived SPA sessions.
- If a future mobile or third-party integration uses cookie sessions off-origin, require token auth or explicit CORS + CSRF strategy review.

## Evidence

- Date reviewed:
- Reviewer:
- `rg '@csrf_exempt' contracts/` result:
- Notes:
