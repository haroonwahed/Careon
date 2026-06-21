"""Thread/async-safe tenant context for ORM backstop scoping."""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Iterator, Optional

_organization_id: ContextVar[Optional[int]] = ContextVar('tenant_organization_id', default=None)
_bypass: ContextVar[bool] = ContextVar('tenant_scoping_bypass', default=False)
# Set True only during HTTP request view execution (after org is resolved).
# Outside requests (management commands, tests, seeds) this stays False so
# ORM queries fail-open rather than returning empty querysets.
_in_request: ContextVar[bool] = ContextVar('tenant_in_request', default=False)


def get_organization_id() -> Optional[int]:
    return _organization_id.get()


def set_organization_id(organization_id: Optional[int]) -> None:
    _organization_id.set(organization_id)


def is_bypass_active() -> bool:
    return _bypass.get()


def is_in_request() -> bool:
    return _in_request.get()


def set_in_request(value: bool) -> None:
    _in_request.set(value)


def clear() -> None:
    _organization_id.set(None)
    _bypass.set(False)
    _in_request.set(False)


@contextmanager
def bypass_tenant_scope() -> Iterator[None]:
    """Disable tenant backstop for management commands, seeds, and admin bulk ops."""
    token: Token = _bypass.set(True)
    try:
        yield
    finally:
        _bypass.reset(token)


@contextmanager
def tenant_scope(organization_id: Optional[int]) -> Iterator[None]:
    """Bind an organization id for the duration of a block (tests, scripts)."""
    token: Token = _organization_id.set(organization_id)
    try:
        yield
    finally:
        _organization_id.reset(token)
