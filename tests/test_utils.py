"""Shared helpers for Django tests (minimal utilities only)."""

from __future__ import annotations

from django.conf import settings


def middleware_without_spa_shell() -> list[str]:
    """Drop SpaShellMigrationMiddleware so legacy Django HTML views execute.

    Use only on targeted test classes/methods — never globally in settings.
    """
    return [m for m in settings.MIDDLEWARE if m != 'contracts.middleware.SpaShellMigrationMiddleware']
