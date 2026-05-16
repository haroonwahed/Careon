# Align CareCase with production Postgres (source_system NOT NULL drift).

from django.db import migrations, models


def _ensure_source_system_column(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_care_case'
              AND column_name = 'source_system'
            """
        )
        if cursor.fetchone():
            cursor.execute(
                """
                UPDATE contracts_care_case
                SET source_system = ''
                WHERE source_system IS NULL
                """
            )
            cursor.execute(
                """
                ALTER TABLE contracts_care_case
                ALTER COLUMN source_system SET DEFAULT ''
                """
            )
            return
        cursor.execute(
            """
            ALTER TABLE contracts_care_case
            ADD COLUMN source_system varchar(100) NOT NULL DEFAULT ''
            """
        )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0068_organizationmembership_scim_external_id'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_ensure_source_system_column, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='carecase',
                    name='source_system',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text='Optional upstream system identifier for imported cases (empty for native casussen).',
                        max_length=100,
                    ),
                ),
            ],
        ),
    ]
