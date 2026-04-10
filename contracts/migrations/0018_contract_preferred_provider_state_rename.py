from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0016_duediligenceprocess_contract'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.RenameField(
                    model_name='contract',
                    old_name='counterparty',
                    new_name='preferred_provider',
                ),
                migrations.AlterField(
                    model_name='contract',
                    name='preferred_provider',
                    field=models.CharField(blank=True, db_column='counterparty', max_length=200),
                ),
            ],
            database_operations=[],
        ),
    ]