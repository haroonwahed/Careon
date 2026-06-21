"""Audit log retention policy — filters read/export surfaces, never deletes rows."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from django.conf import settings
from django.db.models import QuerySet
from django.utils import timezone


def audit_log_retention_days() -> int:
    return int(getattr(settings, 'CARELANE_AUDIT_LOG_RETENTION_DAYS', 2555))


def audit_log_retention_cutoff() -> Optional[datetime]:
    """
    Oldest timestamp included in audit read/export queries.
    Returns None when retention is disabled (0 or negative days).
    """
    days = audit_log_retention_days()
    if days <= 0:
        return None
    return timezone.now() - timedelta(days=days)


def apply_audit_log_retention(queryset: QuerySet) -> QuerySet:
    cutoff = audit_log_retention_cutoff()
    if cutoff is None:
        return queryset
    return queryset.filter(timestamp__gte=cutoff)
