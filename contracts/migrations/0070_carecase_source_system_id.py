# Production Postgres may require source_system_id on contracts_care_case.

from django.db import migrations, models


def _ensure_source_system_id_column(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_care_case'
              AND column_name = 'source_system_id'
            """
        )
        row = cursor.fetchone()
        if not row:
            cursor.execute(
                """
                ALTER TABLE contracts_care_case
                ADD COLUMN source_system_id integer NULL
                """
            )
            return
        if row[0] == 'YES':
            return
        cursor.execute(
            """
            UPDATE contracts_care_case
            SET source_system_id = 0
            WHERE source_system_id IS NULL
            """
        )
        cursor.execute(
            """
            ALTER TABLE contracts_care_case
            ALTER COLUMN source_system_id SET DEFAULT 0
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0069_carecase_source_system'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_ensure_source_system_id_column, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='carecase',
                    name='source_system_id',
                    field=models.IntegerField(
                        blank=True,
                        default=None,
                        help_text='Optional legacy upstream system key (production Postgres drift).',
                        null=True,
                    ),
                ),
            ],
        ),
    ]
