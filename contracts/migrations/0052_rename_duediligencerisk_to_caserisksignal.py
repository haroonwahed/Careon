from django.db import migrations


def rename_duediligence_risk_table(apps, schema_editor):
    connection = schema_editor.connection
    existing_tables = set(connection.introspection.table_names())
    old_table = 'contracts_duediligencerisk'
    new_table = 'contracts_caserisksignal'

    if old_table in existing_tables and new_table not in existing_tables:
        with connection.cursor() as cursor:
            cursor.execute(f'ALTER TABLE {old_table} RENAME TO {new_table}')


def reverse_rename_duediligence_risk_table(apps, schema_editor):
    connection = schema_editor.connection
    existing_tables = set(connection.introspection.table_names())
    old_table = 'contracts_duediligencerisk'
    new_table = 'contracts_caserisksignal'

    if new_table in existing_tables and old_table not in existing_tables:
        with connection.cursor() as cursor:
            cursor.execute(f'ALTER TABLE {new_table} RENAME TO {old_table}')


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0051_alter_caresignal_options'),
    ]

    operations = [
        migrations.RunPython(
            rename_duediligence_risk_table,
            reverse_rename_duediligence_risk_table,
        ),
    ]
