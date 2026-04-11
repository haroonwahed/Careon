from django.db import migrations


def forwards(apps, schema_editor):
    table_names = set(schema_editor.connection.introspection.table_names())
    with schema_editor.connection.cursor() as cursor:
        if 'contracts_riskfactor' in table_names:
            cursor.execute(
                "UPDATE contracts_riskfactor SET name = %s WHERE name = %s",
                ['GOVERNANCE', 'LEGAL'],
            )
        if 'contracts_intaketask' in table_names:
            cursor.execute(
                "UPDATE contracts_intaketask SET category = %s WHERE category = %s",
                ['GOVERNANCE', 'LEGAL'],
            )
        # Historical installs may have either table name depending on migration path.
        for risk_table in ('contracts_caserisksignal', 'contracts_duediligencerisk'):
            if risk_table in table_names:
                cursor.execute(
                    f"UPDATE {risk_table} SET category = %s WHERE category = %s",
                    ['GOVERNANCE', 'LEGAL'],
                )


def backwards(apps, schema_editor):
    table_names = set(schema_editor.connection.introspection.table_names())
    with schema_editor.connection.cursor() as cursor:
        if 'contracts_riskfactor' in table_names:
            cursor.execute(
                "UPDATE contracts_riskfactor SET name = %s WHERE name = %s",
                ['LEGAL', 'GOVERNANCE'],
            )
        if 'contracts_intaketask' in table_names:
            cursor.execute(
                "UPDATE contracts_intaketask SET category = %s WHERE category = %s",
                ['LEGAL', 'GOVERNANCE'],
            )
        for risk_table in ('contracts_caserisksignal', 'contracts_duediligencerisk'):
            if risk_table in table_names:
                cursor.execute(
                    f"UPDATE {risk_table} SET category = %s WHERE category = %s",
                    ['LEGAL', 'GOVERNANCE'],
                )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0030_rename_relation_fields_to_canonical_names'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
