# Align production Postgres: source_system_id must allow NULL / default 0 for native casussen.

from django.db import migrations


def _relax_source_system_id_not_null(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_care_case'
              AND column_name = 'source_system_id'
            """
        )
        row = cursor.fetchone()
        if not row:
            return
        if row[0] == 'NO':
            cursor.execute(
                """
                ALTER TABLE contracts_care_case
                ALTER COLUMN source_system_id DROP NOT NULL
                """
            )
        cursor.execute(
            """
            UPDATE contracts_care_case
            SET source_system_id = 0
            WHERE source_system_id IS NULL
            """
        )
        cursor.execute(
            """
            ALTER TABLE contracts_care_case
            ALTER COLUMN source_system_id SET DEFAULT 0
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0070_carecase_source_system_id'),
    ]

    operations = [
        migrations.RunPython(_relax_source_system_id_not_null, migrations.RunPython.noop),
    ]
