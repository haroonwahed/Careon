# Align Django model state with session_revocation_counter on UserProfile.
# Production Postgres may already have this column (NOT NULL) before Django tracked it.

from django.db import migrations, models


def _add_column_if_missing(apps, schema_editor):
    UserProfile = apps.get_model('contracts', 'UserProfile')
    table = UserProfile._meta.db_table
    qtable = schema_editor.quote_name(table)
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            cursor.execute(
                f"""
                ALTER TABLE {qtable}
                ADD COLUMN IF NOT EXISTS session_revocation_counter integer NOT NULL DEFAULT 0
                """
            )
            cursor.execute(
                f"""
                UPDATE {qtable}
                SET session_revocation_counter = 0
                WHERE session_revocation_counter IS NULL
                """
            )
            cursor.execute(
                f"""
                ALTER TABLE {qtable}
                ALTER COLUMN session_revocation_counter SET DEFAULT 0
                """
            )
        elif connection.vendor == 'sqlite':
            cursor.execute(f'PRAGMA table_info({table})')
            col_names = {row[1] for row in cursor.fetchall()}
            if 'session_revocation_counter' not in col_names:
                cursor.execute(
                    f'ALTER TABLE {qtable} ADD COLUMN session_revocation_counter '
                    f'INTEGER NOT NULL DEFAULT 0'
                )
        elif connection.vendor in ('mysql', 'mariadb'):
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = %s
                  AND column_name = 'session_revocation_counter'
                """,
                [table],
            )
            if not cursor.fetchone():
                cursor.execute(
                    f'ALTER TABLE {qtable} ADD COLUMN session_revocation_counter '
                    f'integer NOT NULL DEFAULT 0'
                )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0059_user_profile_backfill_and_signal_note'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_add_column_if_missing, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='userprofile',
                    name='session_revocation_counter',
                    field=models.PositiveIntegerField(
                        default=0,
                        help_text='Incremented to invalidate prior sessions after security-sensitive changes.',
                    ),
                ),
            ],
        ),
    ]
