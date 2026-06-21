"""
Management command: prune_audit_logs

Deletes AuditLog rows older than the configured retention window.
Default retention: 365 days (1 year). Override via AUDIT_LOG_RETENTION_DAYS.

Usage:
  python manage.py prune_audit_logs              # dry-run, prints count
  python manage.py prune_audit_logs --execute    # actually deletes

Scheduling: run monthly via a cron job or Render cron service.
The command is idempotent and safe to run multiple times.
"""
from __future__ import annotations

import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Prune AuditLog rows older than the retention window (default 365 days).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--execute',
            action='store_true',
            default=False,
            help='Actually delete rows. Without this flag the command runs as a dry-run.',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=None,
            help='Override retention window in days (default: AUDIT_LOG_RETENTION_DAYS setting or 365).',
        )

    def handle(self, *args, **options):
        from contracts.models import AuditLog

        retention_days = options['days'] or int(
            getattr(settings, 'AUDIT_LOG_RETENTION_DAYS', 365)
        )
        cutoff = timezone.now() - timedelta(days=retention_days)

        qs = AuditLog.objects.filter(timestamp__lt=cutoff)
        count = qs.count()

        if options['execute']:
            deleted, _ = qs.delete()
            self.stdout.write(
                self.style.SUCCESS(
                    f'Deleted {deleted} AuditLog rows older than {retention_days} days (cutoff: {cutoff.date()}).'
                )
            )
            logger.info(
                'prune_audit_logs: deleted %d rows older than %d days (cutoff %s)',
                deleted, retention_days, cutoff.date(),
            )
        else:
            self.stdout.write(
                f'Dry-run: {count} AuditLog rows would be deleted '
                f'(older than {retention_days} days, cutoff: {cutoff.date()}). '
                f'Pass --execute to delete.'
            )
