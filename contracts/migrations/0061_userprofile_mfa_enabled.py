# Track mfa_enabled on UserProfile; production Postgres may already have this column.

from django.db import migrations, models


def _add_mfa_enabled_if_missing(apps, schema_editor):
    UserProfile = apps.get_model('contracts', 'UserProfile')
    table = UserProfile._meta.db_table
    qtable = schema_editor.quote_name(table)
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                f"""
                ALTER TABLE {qtable}
                ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false
                """
            )
            cursor.execute(
                f"""
                UPDATE {qtable}
                SET mfa_enabled = false
                WHERE mfa_enabled IS NULL
                """
            )
            cursor.execute(
                f"""
                ALTER TABLE {qtable}
                ALTER COLUMN mfa_enabled SET DEFAULT false
                """
            )
        elif connection.vendor == 'sqlite':
            cursor.execute(f'PRAGMA table_info({table})')
            col_names = {row[1] for row in cursor.fetchall()}
            if 'mfa_enabled' not in col_names:
                cursor.execute(
                    f'ALTER TABLE {qtable} ADD COLUMN mfa_enabled '
                    f'INTEGER NOT NULL DEFAULT 0'
                )
        elif connection.vendor in ('mysql', 'mariadb'):
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = %s
                  AND column_name = 'mfa_enabled'
                """,
                [table],
            )
            if not cursor.fetchone():
                cursor.execute(
                    f'ALTER TABLE {qtable} ADD COLUMN mfa_enabled '
                    f'tinyint(1) NOT NULL DEFAULT 0'
                )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0060_userprofile_session_revocation_counter'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_add_mfa_enabled_if_missing, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='userprofile',
                    name='mfa_enabled',
                    field=models.BooleanField(
                        default=False,
                        help_text='Whether multi-factor authentication is enabled for this account.',
                    ),
                ),
            ],
        ),
    ]
