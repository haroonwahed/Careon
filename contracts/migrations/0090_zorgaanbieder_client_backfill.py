"""
Backfill Zorgaanbieder.client by exact name match against Client CORPORATION rows.

Rules:
  - Only links when exactly one CORPORATION Client has the same name (case-insensitive).
  - Ambiguous (multiple matches) or missing rows are logged and skipped — never guessed.
  - No existing data is deleted or modified beyond setting the FK.
"""

import logging

from django.db import migrations

logger = logging.getLogger(__name__)


def backfill_zorgaanbieder_client_links(apps, schema_editor):
    Zorgaanbieder = apps.get_model('contracts', 'Zorgaanbieder')
    Client = apps.get_model('contracts', 'Client')

    linked = 0
    skipped_no_match = []
    skipped_ambiguous = []
    skipped_already_linked = []

    for za in Zorgaanbieder.objects.filter(client__isnull=True).iterator():
        candidates = list(
            Client.objects.filter(
                client_type='CORPORATION',
                name__iexact=za.name,
                zorgaanbieder__isnull=True,  # not already claimed by another Zorgaanbieder
            )
        )

        if len(candidates) == 0:
            skipped_no_match.append(za.name)
            continue

        if len(candidates) > 1:
            skipped_ambiguous.append(za.name)
            continue

        za.client = candidates[0]
        za.save(update_fields=['client'])
        linked += 1

    if linked:
        logger.info('Zorgaanbieder-Client backfill: linked %d records', linked)
    if skipped_no_match:
        logger.warning(
            'Zorgaanbieder-Client backfill: no matching CORPORATION Client for %d providers: %s',
            len(skipped_no_match),
            ', '.join(skipped_no_match),
        )
    if skipped_ambiguous:
        logger.warning(
            'Zorgaanbieder-Client backfill: ambiguous name match for %d providers (skipped): %s',
            len(skipped_ambiguous),
            ', '.join(skipped_ambiguous),
        )
    if skipped_already_linked:
        logger.warning(
            'Zorgaanbieder-Client backfill: already linked, skipped: %s',
            ', '.join(skipped_already_linked),
        )


def reverse_backfill(apps, schema_editor):
    # Reversing the data migration clears all backfilled links.
    # Manually-created links (created after this migration ran) are also cleared —
    # acceptable since this is a dev/test-only rollback path.
    Zorgaanbieder = apps.get_model('contracts', 'Zorgaanbieder')
    Zorgaanbieder.objects.filter(client__isnull=False).update(client=None)


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0089_zorgaanbieder_client_link'),
    ]

    operations = [
        migrations.RunPython(
            backfill_zorgaanbieder_client_links,
            reverse_code=reverse_backfill,
        ),
    ]
