#!/usr/bin/env python3

from __future__ import annotations

import os
import sys
from urllib.parse import urlparse


def _normalize_database_url(database_url: str) -> str:
    """Strip accidental outer quotes (Render / .env copy-paste)."""
    url = database_url.strip()
    for _ in range(2):
        if len(url) < 2:
            break
        q = url[0]
        if q in '"\'' and url.endswith(q):
            inner = url[1:-1].strip()
            low = inner.lower()
            if low.startswith(("postgres://", "postgresql://")):
                url = inner
                continue
        break
    return url


def database_url_shape(database_url: str) -> str:
    url = database_url.strip()
    if not url:
        return "<missing>"

    parsed = urlparse(url)
    username = parsed.username or "<missing-user>"
    host = parsed.hostname or "<missing-host>"
    port = parsed.port or 5432
    database = parsed.path.lstrip("/") or "<missing-db>"
    return f"{parsed.scheme}://{username}@{host}:{port}/{database}"


def validate_database_url(database_url: str) -> tuple[bool, str]:
    url = _normalize_database_url(database_url)
    if not url:
        return False, "ERROR: DATABASE_URL is missing from the Render runtime environment."

    parsed = urlparse(url)
    shape = database_url_shape(url)

    if parsed.scheme not in {"postgres", "postgresql"}:
        low = url.lower().strip()
        embedded_pg = ("postgresql://" in low or "postgres://" in low) and not low.startswith(
            ("postgres://", "postgresql://")
        )
        hint = ""
        if embedded_pg:
            hint = (
                " A full postgres URL appears inside the value but not at the start — "
                "remove leading junk, duplicate host fragments, or JSON-style quotes in the middle; "
                "use a single line postgresql://user:password@host:port/dbname ."
            )
        elif " " in url.split("@", 1)[0]:
            hint = (
                " There is a space before '@' in the userinfo — use a colon between username and password "
                "(postgresql://username:password@host/...), and URL-encode special characters in the password."
            )
        return False, (
            "ERROR: DATABASE_URL must start with postgresql:// or postgres://."
            f"{hint} Current shape: {shape}"
        )

    if not parsed.hostname:
        return False, f"ERROR: DATABASE_URL is missing a hostname. Check the part after '@'. Current shape: {shape}"

    if not parsed.path or parsed.path == "/":
        return False, f"ERROR: DATABASE_URL is missing a database name. Check the path after the host. Current shape: {shape}"

    if parsed.hostname.endswith("pooler.supabase.com") and parsed.username == "postgres":
        return (
            False,
            "ERROR: Supabase session pooler URLs must use username 'postgres.<project-ref>' "
            f"instead of plain 'postgres'. Current shape: {shape}. "
            "Copy the session pooler connection string from Supabase Connect.",
        )

    if (
        os.environ.get("RENDER", "").strip().lower() == "true"
        and parsed.hostname
        and parsed.hostname.startswith("db.")
        and parsed.hostname.endswith(".supabase.co")
    ):
        return (
            False,
            "ERROR: Render deployments should use the Supabase session pooler URL, not the direct "
            f"database host. Current shape: {shape}. "
            "Use the connection string that starts with "
            "'postgres://postgres.<project-ref>:...@aws-0-<region>.pooler.supabase.com:5432/postgres'. "
            "The direct db.<project-ref>.supabase.co host may fail from Render when IPv6 is not available. "
            "If Render logs still show a migrate step during startup, the service is probably running an "
            "older manual Start Command override instead of the repo script; set it to "
            "'bash scripts/render_start_command.sh' and redeploy.",
        )

    return True, (
        f"DATABASE_URL detected: {shape}"
    )


def _verbose_database_url_log() -> bool:
    return os.environ.get("DATABASE_URL_VERBOSE_LOG", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def main() -> int:
    ok, message = validate_database_url(os.environ.get("DATABASE_URL", ""))
    stream = sys.stdout if ok else sys.stderr
    if ok:
        print(message if _verbose_database_url_log() else "DATABASE_URL validated.", file=stream)
    else:
        print(message, file=stream)
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
