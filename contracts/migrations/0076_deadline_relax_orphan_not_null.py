# Relax NOT NULL on legacy Deadline columns removed from Django state (e.g. reminder_days).

from django.db import migrations


def _relax_orphan_not_null_columns(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    Deadline = apps.get_model('contracts', 'Deadline')
    known = {field.column for field in Deadline._meta.local_fields}
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_deadline'
            """
        )
        for column_name, data_type, is_nullable, column_default in cursor.fetchall():
            if column_name in known:
                continue
            if is_nullable == 'YES' and column_default is not None:
                continue
            if 'char' in data_type or data_type == 'text':
                default_sql = "''"
            elif data_type in ('integer', 'bigint', 'smallint'):
                default_sql = '0'
            elif data_type == 'boolean':
                default_sql = 'false'
            else:
                continue
            cursor.execute(
                f"""
                UPDATE contracts_deadline
                SET {column_name} = {default_sql}
                WHERE {column_name} IS NULL
                """
            )
            if is_nullable == 'NO':
                cursor.execute(
                    f"""
                    ALTER TABLE contracts_deadline
                    ALTER COLUMN {column_name} DROP NOT NULL
                    """
                )
            cursor.execute(
                f"""
                ALTER TABLE contracts_deadline
                ALTER COLUMN {column_name} SET DEFAULT {default_sql}
                """
            )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0075_organizationmembership_scim_nullable'),
    ]

    operations = [
        migrations.RunPython(_relax_orphan_not_null_columns, migrations.RunPython.noop),
    ]
