from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0019_contract_preferred_provider_column_rename'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='matter',
            table='contracts_care_configuration',
        ),
        migrations.AlterModelTable(
            name='contract',
            table='contracts_care_case',
        ),
    ]
