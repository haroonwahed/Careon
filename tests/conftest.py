"""
Pytest defaults for the Careon Django suite.

Many tests inherit from ``unittest.TestCase`` (not ``django.test.TestCase``).
Under ``pytest-django``, those tests do not get DB access unless marked.
``manage.py test`` historically still exercised ORM-backed code paths, so we
auto-apply ``django_db`` to collected tests that do not already declare it.

Tests marked ``no_database`` opt out (pure unit tests, no DB fixtures).

``tests.test_render_startup_checks`` is also skipped: that module must not
import pytest so ``manage.py test`` succeeds on Render (runtime.txt has no pytest).
"""

from __future__ import annotations

import pytest

_NO_AUTO_DJANGO_DB_MODULES = frozenset(
    {
        "tests.test_render_startup_checks",
    }
)


def pytest_collection_modifyitems(config, items) -> None:  # type: ignore[no-untyped-def]
    for item in items:
        if item.get_closest_marker("no_database"):
            continue
        mod = getattr(item, "module", None)
        mod_name = getattr(mod, "__name__", "") if mod is not None else ""
        if mod_name in _NO_AUTO_DJANGO_DB_MODULES:
            continue
        if item.get_closest_marker("django_db") is None:
            item.add_marker(pytest.mark.django_db)
