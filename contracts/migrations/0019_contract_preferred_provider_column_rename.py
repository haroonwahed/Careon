from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0018_contract_preferred_provider_state_rename'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'ALTER TABLE contracts_contract '
                        'RENAME COLUMN counterparty TO preferred_provider;'
                    ),
                    reverse_sql=(
                        'ALTER TABLE contracts_contract '
                        'RENAME COLUMN preferred_provider TO counterparty;'
                    ),
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='contract',
                    name='preferred_provider',
                    field=models.CharField(blank=True, max_length=200),
                ),
            ],
        ),
    ]