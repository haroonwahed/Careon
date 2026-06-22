"""
Backfill AuditLog.organization_id from the writer's primary organization membership.

Rules:
  - If the user has exactly one active membership, use that organization.
  - If the user has multiple active memberships, use the earliest-created one (deterministic).
  - If the user has no active memberships (deleted, de-provisioned), leave NULL.
  - If user_id is NULL, leave organization NULL.

Rows already backfilled (organization_id IS NOT NULL) are skipped.
"""

from django.db import migrations


def backfill_organization(apps, schema_editor):
    AuditLog = apps.get_model('contracts', 'AuditLog')
    OrganizationMembership = apps.get_model('contracts', 'OrganizationMembership')

    # Build a user_id → organization_id map from the earliest active membership.
    user_to_org = {}
    for mem in (
        OrganizationMembership.objects
        .filter(is_active=True)
        .order_by('user_id', 'id')
        .values('user_id', 'organization_id')
    ):
        uid = mem['user_id']
        if uid not in user_to_org:  # keep the earliest
            user_to_org[uid] = mem['organization_id']

    batch_size = 500
    qs = (
        AuditLog.objects
        .filter(user_id__isnull=False, organization_id__isnull=True)
        .values_list('pk', 'user_id')
    )
    updates = []
    for pk, user_id in qs.iterator(chunk_size=batch_size):
        org_id = user_to_org.get(user_id)
        if org_id is not None:
            updates.append((pk, org_id))
        if len(updates) >= batch_size:
            _flush_updates(AuditLog, updates)
            updates = []
    if updates:
        _flush_updates(AuditLog, updates)


def _flush_updates(AuditLog, updates):
    from django.db import connection
    table = AuditLog._meta.db_table
    # Use raw SQL to bypass the ORM-level save() immutability guard that will
    # be added AFTER this migration runs on a new database. The guard does not
    # exist yet at migration time and we explicitly want to set organization_id.
    with connection.cursor() as cur:
        for pk, org_id in updates:
            cur.execute(
                f'UPDATE {table} SET organization_id = %s WHERE id = %s',
                [org_id, pk],
            )


def reverse_backfill(apps, schema_editor):
    AuditLog = apps.get_model('contracts', 'AuditLog')
    from django.db import connection
    table = AuditLog._meta.db_table
    with connection.cursor() as cursor:
        cursor.execute(f'UPDATE {table} SET organization_id = NULL')


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0092_auditlog_organization'),
    ]

    operations = [
        migrations.RunPython(backfill_organization, reverse_code=reverse_backfill),
    ]
