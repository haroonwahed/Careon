# Track require_mfa on Organization; production Postgres may already have this column.

from django.db import migrations, models


def _add_require_mfa_if_missing(apps, schema_editor):
    Organization = apps.get_model('contracts', 'Organization')
    table = Organization._meta.db_table
    qtable = schema_editor.quote_name(table)
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                f"""
                ALTER TABLE {qtable}
                ADD COLUMN IF NOT EXISTS require_mfa boolean NOT NULL DEFAULT false
                """
            )
            cursor.execute(
                f"""
                UPDATE {qtable}
                SET require_mfa = false
                WHERE require_mfa IS NULL
                """
            )
            cursor.execute(
                f"""
                ALTER TABLE {qtable}
                ALTER COLUMN require_mfa SET DEFAULT false
                """
            )
        elif connection.vendor == 'sqlite':
            cursor.execute(f'PRAGMA table_info({table})')
            col_names = {row[1] for row in cursor.fetchall()}
            if 'require_mfa' not in col_names:
                cursor.execute(
                    f'ALTER TABLE {qtable} ADD COLUMN require_mfa '
                    f'INTEGER NOT NULL DEFAULT 0'
                )
        elif connection.vendor in ('mysql', 'mariadb'):
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = %s
                  AND column_name = 'require_mfa'
                """,
                [table],
            )
            if not cursor.fetchone():
                cursor.execute(
                    f'ALTER TABLE {qtable} ADD COLUMN require_mfa '
                    f'tinyint(1) NOT NULL DEFAULT 0'
                )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0065_caseintakeprocess_aanmelder_actor_profile'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_add_require_mfa_if_missing, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='organization',
                    name='require_mfa',
                    field=models.BooleanField(
                        default=False,
                        help_text='When enabled, members must complete MFA before access.',
                    ),
                ),
            ],
        ),
    ]
