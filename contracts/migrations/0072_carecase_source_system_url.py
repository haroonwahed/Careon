# Production Postgres may require source_system_url on contracts_care_case.

from django.db import migrations, models


def _ensure_source_system_url_column(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_care_case'
              AND column_name = 'source_system_url'
            """
        )
        row = cursor.fetchone()
        if not row:
            cursor.execute(
                """
                ALTER TABLE contracts_care_case
                ADD COLUMN source_system_url varchar(500) NOT NULL DEFAULT ''
                """
            )
            return
        cursor.execute(
            """
            UPDATE contracts_care_case
            SET source_system_url = ''
            WHERE source_system_url IS NULL
            """
        )
        if row[0] == 'NO':
            cursor.execute(
                """
                ALTER TABLE contracts_care_case
                ALTER COLUMN source_system_url DROP NOT NULL
                """
            )
        cursor.execute(
            """
            ALTER TABLE contracts_care_case
            ALTER COLUMN source_system_url SET DEFAULT ''
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0071_carecase_source_system_id_nullable'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_ensure_source_system_url_column, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='carecase',
                    name='source_system_url',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text='Optional legacy upstream URL (production Postgres drift).',
                        max_length=500,
                    ),
                ),
            ],
        ),
    ]
