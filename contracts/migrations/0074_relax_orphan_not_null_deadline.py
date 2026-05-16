# Production Postgres may still have legacy deadline_type NOT NULL while Django uses task_type.

from django.db import migrations


def _align_deadline_legacy_columns(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_deadline'
              AND column_name = 'deadline_type'
            """
        )
        if not cursor.fetchone():
            return
        cursor.execute(
            """
            UPDATE contracts_deadline
            SET deadline_type = COALESCE(NULLIF(task_type, ''), 'OTHER')
            WHERE deadline_type IS NULL
            """
        )
        cursor.execute(
            """
            ALTER TABLE contracts_deadline
            ALTER COLUMN deadline_type SET DEFAULT 'OTHER'
            """
        )
        cursor.execute(
            """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_deadline'
              AND column_name = 'deadline_type'
            """
        )
        row = cursor.fetchone()
        if row and row[0] == 'NO':
            cursor.execute(
                """
                ALTER TABLE contracts_deadline
                ALTER COLUMN deadline_type DROP NOT NULL
                """
            )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0073_carecase_relax_orphan_not_null'),
    ]

    operations = [
        migrations.RunPython(_align_deadline_legacy_columns, migrations.RunPython.noop),
    ]
