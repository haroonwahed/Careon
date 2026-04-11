from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0026_remove_approvalrequest_assigned_to_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_risklog RENAME TO contracts_caresignal',
                    reverse_sql='ALTER TABLE contracts_caresignal RENAME TO contracts_risklog',
                ),
            ],
            state_operations=[
                migrations.RenameModel(
                    old_name='RiskLog',
                    new_name='CareSignal',
                ),
                migrations.AlterModelTable(
                    name='caresignal',
                    table='contracts_caresignal',
                ),
            ],
        ),
    ]
