"""
Migration: Add PROVIDE_MISSING_INFO event type and rename SLA_ESCALATION label.

DDL changes: none (CharField choices are not enforced at DB level for SQLite/Postgres
varchar).  This migration updates Django's migration state so that:
  - CaseDecisionLog.EventType.PROVIDE_MISSING_INFO is recognised by the ORM
  - The SLA_ESCALATION human label is updated to 'SLA state transition'

A state-only AlterField is emitted so the migration graph remains clean and
future `makemigrations --check` runs do not produce spurious diffs.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0038_casedecisionlog_retention_safety'),
    ]

    operations = [
        migrations.AlterField(
            model_name='casedecisionlog',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('MATCH_RECOMMENDED', 'Match recommended'),
                    ('PROVIDER_SELECTED', 'Provider selected'),
                    ('RESEND_TRIGGERED', 'Resend triggered'),
                    ('PROVIDE_MISSING_INFO', 'Missing info provided'),
                    ('REMATCH_TRIGGERED', 'Rematch triggered'),
                    ('CONTINUE_WAITING', 'Continue waiting'),
                    ('SLA_ESCALATION', 'SLA state transition'),
                ],
                max_length=40,
            ),
        ),
    ]
