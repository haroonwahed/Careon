from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0028_canonical_relation_alias_phase_marker'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_deadline RENAME COLUMN contract_id TO case_record_id',
                    reverse_sql='ALTER TABLE contracts_deadline RENAME COLUMN case_record_id TO contract_id',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_deadline RENAME COLUMN matter_id TO configuration_id',
                    reverse_sql='ALTER TABLE contracts_deadline RENAME COLUMN configuration_id TO matter_id',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_caretask RENAME COLUMN contract_id TO case_record_id',
                    reverse_sql='ALTER TABLE contracts_caretask RENAME COLUMN case_record_id TO contract_id',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_caretask RENAME COLUMN matter_id TO configuration_id',
                    reverse_sql='ALTER TABLE contracts_caretask RENAME COLUMN configuration_id TO matter_id',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_caresignal RENAME COLUMN contract_id TO case_record_id',
                    reverse_sql='ALTER TABLE contracts_caresignal RENAME COLUMN case_record_id TO contract_id',
                ),
                migrations.RunSQL(
                    sql='ALTER TABLE contracts_caresignal RENAME COLUMN matter_id TO configuration_id',
                    reverse_sql='ALTER TABLE contracts_caresignal RENAME COLUMN configuration_id TO matter_id',
                ),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='deadline',
                    name='contract',
                    field=models.ForeignKey(blank=True, db_column='case_record_id', null=True, on_delete=models.CASCADE, related_name='deadlines', to='contracts.carecase'),
                ),
                migrations.AlterField(
                    model_name='deadline',
                    name='matter',
                    field=models.ForeignKey(blank=True, db_column='configuration_id', null=True, on_delete=models.CASCADE, related_name='deadlines', to='contracts.careconfiguration'),
                ),
                migrations.AlterField(
                    model_name='caretask',
                    name='contract',
                    field=models.ForeignKey(blank=True, db_column='case_record_id', null=True, on_delete=models.CASCADE, to='contracts.carecase'),
                ),
                migrations.AlterField(
                    model_name='caretask',
                    name='matter',
                    field=models.ForeignKey(blank=True, db_column='configuration_id', null=True, on_delete=models.CASCADE, related_name='tasks', to='contracts.careconfiguration'),
                ),
                migrations.AlterField(
                    model_name='caresignal',
                    name='contract',
                    field=models.ForeignKey(blank=True, db_column='case_record_id', null=True, on_delete=models.CASCADE, to='contracts.carecase'),
                ),
                migrations.AlterField(
                    model_name='caresignal',
                    name='matter',
                    field=models.ForeignKey(blank=True, db_column='configuration_id', null=True, on_delete=models.CASCADE, related_name='risks', to='contracts.careconfiguration'),
                ),
            ],
        ),
    ]
