# Staging/production drift: relax NOT NULL on legacy CareCase columns Django does not manage.

from django.db import migrations


def _relax_orphan_not_null_columns(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    CareCase = apps.get_model('contracts', 'CareCase')
    known = {field.column for field in CareCase._meta.local_fields}
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_care_case'
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
                UPDATE contracts_care_case
                SET {column_name} = {default_sql}
                WHERE {column_name} IS NULL
                """
            )
            if is_nullable == 'NO':
                cursor.execute(
                    f"""
                    ALTER TABLE contracts_care_case
                    ALTER COLUMN {column_name} DROP NOT NULL
                    """
                )
            cursor.execute(
                f"""
                ALTER TABLE contracts_care_case
                ALTER COLUMN {column_name} SET DEFAULT {default_sql}
                """
            )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0072_carecase_source_system_url'),
    ]

    operations = [
        migrations.RunPython(_relax_orphan_not_null_columns, migrations.RunPython.noop),
    ]
