from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0029_canonical_relation_db_columns_phase1'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RenameField(
                    model_name='deadline',
                    old_name='contract',
                    new_name='case_record',
                ),
                migrations.RenameField(
                    model_name='deadline',
                    old_name='matter',
                    new_name='configuration',
                ),
                migrations.RenameField(
                    model_name='caretask',
                    old_name='contract',
                    new_name='case_record',
                ),
                migrations.RenameField(
                    model_name='caretask',
                    old_name='matter',
                    new_name='configuration',
                ),
                migrations.RenameField(
                    model_name='caresignal',
                    old_name='contract',
                    new_name='case_record',
                ),
                migrations.RenameField(
                    model_name='caresignal',
                    old_name='matter',
                    new_name='configuration',
                ),
            ],
        ),
    ]
