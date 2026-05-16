# Ensure scim_external_id allows omitted values on INSERT (staging Postgres drift).

from django.db import migrations


def _relax_scim_not_null(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_organizationmembership'
              AND column_name = 'scim_external_id'
            """
        )
        row = cursor.fetchone()
        if not row:
            return
        cursor.execute(
            """
            UPDATE contracts_organizationmembership
            SET scim_external_id = ''
            WHERE scim_external_id IS NULL
            """
        )
        if row[0] == 'NO':
            cursor.execute(
                """
                ALTER TABLE contracts_organizationmembership
                ALTER COLUMN scim_external_id DROP NOT NULL
                """
            )
        cursor.execute(
            """
            ALTER TABLE contracts_organizationmembership
            ALTER COLUMN scim_external_id SET DEFAULT ''
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0074_relax_orphan_not_null_deadline'),
    ]

    operations = [
        migrations.RunPython(_relax_scim_not_null, migrations.RunPython.noop),
    ]
