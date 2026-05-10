"""
Deployment truth payload for operator-facing /build-info (staff-only).

Deploy platforms should set CAREON_GIT_SHA, CAREON_DEPLOY_TIMESTAMP, CAREON_ENVIRONMENT,
and CAREON_SEED_VERSION where possible. Values fall back to sane defaults for local dev.
"""

from __future__ import annotations

import os
import re
from typing import Any

from django.conf import settings


def _first_env(*keys: str) -> str:
    for key in keys:
        raw = os.environ.get(key)
        if raw is not None and str(raw).strip():
            return str(raw).strip()
    return ""


def _read_revision_file() -> str:
    path = getattr(settings, "BASE_DIR", None)
    if path is None:
        return ""
    revision = path / "REVISION"
    try:
        return revision.read_text(encoding="utf-8").strip()[:64]
    except OSError:
        return ""


def _commit_sha() -> str:
    sha = _first_env(
        "CAREON_GIT_SHA",
        "RENDER_GIT_COMMIT",
        "GIT_COMMIT",
        "GITHUB_SHA",
        "COMMIT_SHA",
        "HEROKU_SLUG_COMMIT",
        "K_REVISION",
        "SOURCE_VERSION",
    )
    if sha:
        return sha
    return _read_revision_file()


def _deploy_timestamp() -> str:
    return _first_env("CAREON_DEPLOY_TIMESTAMP", "DEPLOY_TIMESTAMP", "BUILD_TIMESTAMP")


def _environment_name() -> str:
    name = _first_env(
        "CAREON_ENVIRONMENT",
        "SENTRY_ENVIRONMENT",
        "RENDER_ENVIRONMENT",
        "ENVIRONMENT",
    )
    if name:
        return name
    mod = _first_env("DJANGO_SETTINGS_MODULE") or getattr(settings, "DJANGO_SETTINGS_MODULE", "")
    if mod:
        leaf = mod.rsplit(".", 1)[-1]
        if leaf.startswith("settings_"):
            return leaf.replace("settings_", "", 1)
        if leaf == "settings":
            return "default"
    return "development"


def _seed_version() -> str:
    env = _first_env("CAREON_SEED_VERSION", "SEED_VERSION")
    if env:
        return env
    try:
        from contracts.pilot_universe import PILOT_MANIFEST_VERSION
    except ImportError:
        return "unknown"
    return PILOT_MANIFEST_VERSION


def _contracts_migration_tail() -> str | None:
    from django.db.migrations.recorder import MigrationRecorder

    row = (
        MigrationRecorder.Migration.objects.filter(app="contracts")
        .order_by("-applied")
        .first()
    )
    if row is None:
        return None
    return row.name


def gather_build_info() -> dict[str, Any]:
    from django.db.migrations.recorder import MigrationRecorder

    contracts_migration = _contracts_migration_tail()
    payload: dict[str, Any] = {
        "schema": 1,
        "commit_sha": _commit_sha(),
        "deploy_timestamp": _deploy_timestamp() or None,
        "environment": _environment_name(),
        "seed_version": _seed_version(),
        "django_settings_module": getattr(settings, "DJANGO_SETTINGS_MODULE", None)
        or os.environ.get("DJANGO_SETTINGS_MODULE", ""),
        "migration_version": {
            "contracts": contracts_migration,
        },
        "migrations_applied_total": MigrationRecorder.Migration.objects.count(),
    }
    # Human-readable single line for scripts (latest contracts migration filename).
    if contracts_migration:
        m = re.match(r"^(\d+)_", contracts_migration)
        payload["migration_version"]["contracts_revision"] = m.group(1) if m else None
    return payload


def gather_ops_cockpit() -> dict[str, Any]:
    """Operator cockpit: deployment truth + freeze phase + rehearsal / failure signals."""
    from django.core.cache import cache

    from contracts.observability import CACHE_KEY_LAST_API_FAILURE, CACHE_KEY_LATEST_REHEARSAL

    payload = gather_build_info()
    payload["schema"] = 2
    freeze = getattr(settings, "FEATURE_FREEZE_ACTIVE", True)
    payload["feature_freeze_phase"] = "active" if freeze else "lifted"
    payload["latest_rehearsal_run"] = cache.get(CACHE_KEY_LATEST_REHEARSAL)
    payload["latest_failed_request"] = cache.get(CACHE_KEY_LAST_API_FAILURE)
    return payload
