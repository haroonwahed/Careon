"""
Operational observability: correlation IDs for logs and responses, escalation helpers.

Binds a per-request correlation id (contextvars) so structured logs and audit trails align.
"""

from __future__ import annotations

import logging
import re
import uuid
from contextvars import ContextVar
from typing import Any

_correlation_id_var: ContextVar[str | None] = ContextVar("careon_correlation_id", default=None)

_REQUEST_ID_HEADER_IN = ("HTTP_X_REQUEST_ID", "HTTP_X_CORRELATION_ID")
_REQUEST_ID_HEADER_OUT = "X-Request-ID"
_MAX_INBOUND_ID_LEN = 128
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_.:@+-]+$")


logger = logging.getLogger("contracts.observability")

CACHE_KEY_LAST_API_FAILURE = "careon:last_api_failure"
CACHE_KEY_LATEST_REHEARSAL = "careon:latest_rehearsal_run"


def record_api_failure(request, *, status_code: int) -> None:
    """Persist last failed API call metadata for /ops/system-state (no PHI)."""
    from django.core.cache import cache
    from django.utils import timezone

    cid = getattr(request, "correlation_id", None)
    cache.set(
        CACHE_KEY_LAST_API_FAILURE,
        {
            "request_id": str(cid) if cid else None,
            "path": getattr(request, "path", ""),
            "method": getattr(request, "method", ""),
            "status_code": status_code,
            "recorded_at": timezone.now().isoformat(),
        },
        timeout=None,
    )


def record_rehearsal_run(*, command: str = "reset_pilot_environment") -> None:
    """Mark a deterministic pilot reset / rehearsal for operators."""
    from django.core.cache import cache
    from django.utils import timezone

    cache.set(
        CACHE_KEY_LATEST_REHEARSAL,
        {
            "at": timezone.now().isoformat(),
            "via": command,
        },
        timeout=None,
    )


class CorrelationIdFilter(logging.Filter):
    """Injects correlation_id on log records (default '-') for structured formatters."""

    def filter(self, record: logging.LogRecord) -> bool:
        cid = get_correlation_id()
        record.correlation_id = cid if cid else "-"
        return True


def get_correlation_id() -> str | None:
    return _correlation_id_var.get()


def set_correlation_id(value: str | None) -> None:
    _correlation_id_var.set(value)


def clear_correlation_id() -> None:
    _correlation_id_var.set(None)


def normalize_inbound_request_id(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if len(s) > _MAX_INBOUND_ID_LEN:
        return None
    if not _SAFE_ID_RE.match(s):
        return None
    return s


def bind_correlation_from_request(request) -> str:
    """Set correlation id from inbound headers or generate one; attach to request."""
    inbound = None
    for key in _REQUEST_ID_HEADER_IN:
        inbound = normalize_inbound_request_id(request.META.get(key))
        if inbound:
            break
    cid = inbound or str(uuid.uuid4())
    set_correlation_id(cid)
    request.correlation_id = cid  # type: ignore[attr-defined]
    return cid


def log_escalation_hint(code: str, *, extra: dict[str, Any] | None = None) -> None:
    """Structured escalation / control-tower signal (no PHI)."""
    cid = get_correlation_id() or "-"
    payload = {"escalation_code": code, "correlation_id": cid}
    if extra:
        payload.update(extra)
    logger.warning("escalation_hint %s", payload)


def log_api_outcome(
    *,
    path: str,
    method: str,
    status_code: int,
    duration_ms: float,
    user_label: str,
) -> None:
    """Log API request outcome (paths under /care/api/ only; caller filters)."""
    from django.conf import settings

    access_all = getattr(settings, "CAREON_API_ACCESS_LOG_ALL", False)
    if status_code < 400 and not access_all:
        return

    cid = get_correlation_id() or "-"
    msg = (
        "api_outcome path=%s method=%s status=%s duration_ms=%.2f user=%s correlation_id=%s"
        % (path, method, status_code, duration_ms, user_label, cid)
    )
    if status_code >= 500:
        logger.error(msg)
    elif status_code >= 400:
        logger.warning(msg)
    else:
        logger.info(msg)
