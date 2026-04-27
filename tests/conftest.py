"""
Pytest defaults for the Careon Django suite.

Many tests inherit from ``unittest.TestCase`` (not ``django.test.TestCase``).
Under ``pytest-django``, those tests do not get DB access unless marked.
``manage.py test`` historically still exercised ORM-backed code paths, so we
auto-apply ``django_db`` to collected tests that do not already declare it.
"""

from __future__ import annotations

import pytest


def pytest_collection_modifyitems(config, items) -> None:  # type: ignore[no-untyped-def]
    for item in items:
        if item.get_closest_marker("django_db") is None:
            item.add_marker(pytest.mark.django_db)
