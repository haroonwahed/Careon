from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0031_replace_legal_codes_with_governance'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_care_case RENAME COLUMN governing_law TO policy_framework',
                    reverse_sql='ALTER TABLE contracts_care_case RENAME COLUMN policy_framework TO governing_law',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_care_case RENAME COLUMN jurisdiction TO service_region',
                    reverse_sql='ALTER TABLE contracts_care_case RENAME COLUMN service_region TO jurisdiction',
                ),
            ],
            state_operations=[
                migrations.RenameField(
                    model_name='carecase',
                    old_name='governing_law',
                    new_name='policy_framework',
                ),
                migrations.RenameField(
                    model_name='carecase',
                    old_name='jurisdiction',
                    new_name='service_region',
                ),
            ],
        ),
    ]
