#!/usr/bin/env python3
"""
Rehearsal E2E stack checks (no product behavior changes).

1) Django ORM + test client: same process as `seed_pilot_e2e` / `prepare_pilot_e2e.sh`
   (proves `db_rehearsal.sqlite3` users accept `E2E_DEMO_PASSWORD`).
2) Optional HTTP: session login + GET /care/api/me/ against `E2E_BASE_URL`
   (proves the *running* server uses a DB seeded with those credentials).

Usage (repo root):
  export DJANGO_SETTINGS_MODULE=config.settings_rehearsal
  export E2E_DEMO_PASSWORD=pilot_demo_pass_123
  export E2E_BASE_URL=http://127.0.0.1:8010   # optional for HTTP checks
  ./scripts/e2e_rehearsal_preflight.py [--no-http]

@see docs/E2E_RUNBOOK.md
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))


def _django_setup() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_rehearsal")
    import django

    django.setup()


def _resolve_demo_password() -> str:
    return (
        os.environ.get("E2E_DEMO_PASSWORD")
        or os.environ.get("E2E_PASSWORD")
        or "pilot_demo_pass_123"
    )


def _print_pilot_flags() -> None:
    from django.conf import settings

    pilot_ui = bool(getattr(settings, "CAREON_PILOT_UI", False))
    allow_switch = not pilot_ui
    print(
        f"[e2e_rehearsal_preflight] CAREON_PILOT_UI={pilot_ui!r} "
        f"=> permissions.allowRoleSwitch on /care/api/me/ => {allow_switch!r} "
        f"(False locks SPA shell to session; True allows demo TopBar switching)",
    )


def _check_orm_and_test_client(demo_pw: str, gemeente_u: str, provider_two_u: str) -> None:
    from django.contrib.auth import authenticate
    from django.test import Client

    for label, username in (
        ("gemeente", gemeente_u),
        ("provider (golden-path)", provider_two_u),
    ):
        u = authenticate(username=username, password=demo_pw)
        if u is None:
            print(
                f"[e2e_rehearsal_preflight] ORM ERROR: authenticate failed for {username!r} "
                f"with E2E_DEMO_PASSWORD (length={len(demo_pw)}). "
                f"Re-run ./scripts/prepare_pilot_e2e.sh with the same password.",
                file=sys.stderr,
            )
            raise SystemExit(1)
        print(f"[e2e_rehearsal_preflight] ORM OK: {label} {username!r}")

    client = Client()
    ok = client.login(username=gemeente_u, password=demo_pw)
    if not ok:
        print("[e2e_rehearsal_preflight] ERROR: Client.login failed for gemeente", file=sys.stderr)
        raise SystemExit(1)
    r = client.get("/care/api/me/")
    if r.status_code != 200:
        print(f"[e2e_rehearsal_preflight] ERROR: GET /care/api/me/ => {r.status_code}", file=sys.stderr)
        raise SystemExit(1)
    payload = json.loads(r.content.decode())
    if "workflowRole" not in payload:
        print("[e2e_rehearsal_preflight] ERROR: /care/api/me/ missing workflowRole", file=sys.stderr)
        raise SystemExit(1)
    print(
        f"[e2e_rehearsal_preflight] TestClient OK: /care/api/me/ workflowRole={payload.get('workflowRole')!r}",
    )


def _http_session_me(base_url: str, username: str, password: str) -> dict:
    base = base_url.rstrip("/")
    login_url = f"{base}/login/"
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(login_url, method="GET")
    try:
        with opener.open(req, timeout=15) as r:
            html = r.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        raise SystemExit(f"[e2e_rehearsal_preflight] HTTP ERROR: cannot GET {login_url}: {e}") from e

    m = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', html)
    if not m:
        raise SystemExit("[e2e_rehearsal_preflight] HTTP ERROR: csrfmiddlewaretoken not found on /login/")

    data = urllib.parse.urlencode(
        {
            "username": username,
            "password": password,
            "csrfmiddlewaretoken": m.group(1),
        },
    ).encode()
    req_post = urllib.request.Request(
        login_url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": login_url,
        },
    )
    try:
        with opener.open(req_post, timeout=15) as r2:
            r2.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(
            f"[e2e_rehearsal_preflight] HTTP ERROR: POST /login/ for {username!r} => {e.code}",
        ) from e

    me_url = f"{base}/care/api/me/"
    req_me = urllib.request.Request(me_url, method="GET")
    try:
        with opener.open(req_me, timeout=15) as r3:
            body = r3.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        raise SystemExit(
            f"[e2e_rehearsal_preflight] HTTP ERROR: GET /care/api/me/ for {username!r} => {e.code}",
        ) from e

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        hint = ""
        if "Inloggen - Careon" in body or "csrfmiddlewaretoken" in body:
            hint = (
                " Likely causes: (1) Django at E2E_BASE_URL uses a different database than "
                "`db_rehearsal.sqlite3` / wrong DJANGO_SETTINGS_MODULE; "
                "(2) POST /login/ failed — password mismatch vs seed."
            )
        raise SystemExit(
            "[e2e_rehearsal_preflight] HTTP ERROR: /care/api/me/ did not return JSON."
            + hint
            + f" First 180 chars: {body[:180]!r}",
        )


def _check_http(demo_pw: str, gemeente_u: str, provider_two_u: str, base_url: str) -> None:
    for label, username in (
        ("gemeente", gemeente_u),
        ("provider (Kompas / golden-path)", provider_two_u),
    ):
        me = _http_session_me(base_url, username, demo_pw)
        wf = me.get("workflowRole")
        perm = (me.get("permissions") or {}).get("allowRoleSwitch")
        print(
            f"[e2e_rehearsal_preflight] HTTP OK: {label} {username!r} "
            f"workflowRole={wf!r} allowRoleSwitch={perm!r}",
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Rehearsal E2E DB + optional HTTP preflight.")
    parser.add_argument(
        "--no-http",
        action="store_true",
        help="Skip HTTP checks (only ORM + Django test client).",
    )
    args = parser.parse_args()

    demo_pw = _resolve_demo_password()
    gemeente_u = os.environ.get("E2E_GEMEENTE_USERNAME", "demo_gemeente")
    provider_two_u = os.environ.get("E2E_PROVIDER_TWO_USERNAME", "demo_provider_kompas")
    base_url = (os.environ.get("E2E_BASE_URL") or "").strip()

    _django_setup()
    _print_pilot_flags()
    _check_orm_and_test_client(demo_pw, gemeente_u, provider_two_u)

    if args.no_http:
        print("[e2e_rehearsal_preflight] HTTP checks skipped (--no-http).")
        return

    if not base_url:
        print(
            "[e2e_rehearsal_preflight] WARNING: E2E_BASE_URL unset — skipping HTTP checks. "
            "Set E2E_BASE_URL and start Django (settings_rehearsal) to verify the live server.",
        )
        return

    print(f"[e2e_rehearsal_preflight] HTTP checks against {base_url!r} …")
    _check_http(demo_pw, gemeente_u, provider_two_u, base_url)
    print("[e2e_rehearsal_preflight] All checks passed.")


if __name__ == "__main__":
    main()
