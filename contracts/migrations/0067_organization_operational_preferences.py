# Organization operational preferences; production Postgres may already have these columns.

from django.db import migrations, models


def _pg_default_for_unknown_column(column_name: str, data_type: str, udt_name: str) -> tuple[str, str]:
    if udt_name == 'bool' or data_type == 'boolean':
        return f'{column_name} = false', 'false'
    if data_type in {'integer', 'bigint', 'smallint'}:
        return f'{column_name} = 0', '0'
    if udt_name in {'json', 'jsonb'}:
        return f"{column_name} = '{{}}'::jsonb", "'{}'::jsonb"
    if udt_name.startswith('_'):
        return f"{column_name} = '{{}}'", "'{}'"
    if udt_name in {'timestamptz', 'timestamp'} or 'timestamp' in data_type:
        return f'{column_name} = NOW()', 'NOW()'
    if udt_name == 'date' or data_type == 'date':
        return f'{column_name} = CURRENT_DATE', 'CURRENT_DATE'
    if udt_name == 'uuid':
        return f'{column_name} = gen_random_uuid()', 'gen_random_uuid()'
    if data_type in {'character varying', 'text'} or udt_name == 'varchar':
        return f"{column_name} = ''", "''"
    # Skip exotic types — leave NULL repair to manual ops rather than invalid literals.
    raise ValueError(
        f'Cannot infer Postgres default for {column_name!r} ({data_type}/{udt_name})'
    )


def _pg_repair_organization_notnull_defaults(cursor, table: str) -> None:
    cursor.execute(
        """
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND is_nullable = 'NO'
          AND column_default IS NULL
          AND column_name <> 'id'
        """,
        [table],
    )
    qtable = f'"{table}"'
    for column_name, data_type, udt_name in cursor.fetchall():
        try:
            set_clause, default_literal = _pg_default_for_unknown_column(
                column_name, data_type, udt_name
            )
        except ValueError:
            continue
        qcol = f'"{column_name}"'
        cursor.execute(
            f"""
            UPDATE {qtable}
            SET {set_clause}
            WHERE {qcol} IS NULL
            """
        )
        cursor.execute(
            f"""
            ALTER TABLE {qtable}
            ALTER COLUMN {qcol} SET DEFAULT {default_literal}
            """
        )


def _add_boolean_column(cursor, qtable: str, table: str, column_name: str, *, default: bool, connection) -> None:
    default_sql = 'true' if default else 'false'
    default_int = '1' if default else '0'
    if connection.vendor == 'postgresql':
        cursor.execute(
            f"""
            ALTER TABLE {qtable}
            ADD COLUMN IF NOT EXISTS {column_name} boolean NOT NULL DEFAULT {default_sql}
            """
        )
        cursor.execute(
            f"""
            UPDATE {qtable}
            SET {column_name} = {default_sql}
            WHERE {column_name} IS NULL
            """
        )
        cursor.execute(
            f"""
            ALTER TABLE {qtable}
            ALTER COLUMN {column_name} SET DEFAULT {default_sql}
            """
        )
    elif connection.vendor == 'sqlite':
        cursor.execute(f'PRAGMA table_info({table})')
        col_names = {row[1] for row in cursor.fetchall()}
        if column_name not in col_names:
            cursor.execute(
                f'ALTER TABLE {qtable} ADD COLUMN {column_name} '
                f'INTEGER NOT NULL DEFAULT {default_int}'
            )
    elif connection.vendor in ('mysql', 'mariadb'):
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = %s
              AND column_name = %s
            """,
            [table, column_name],
        )
        if not cursor.fetchone():
            cursor.execute(
                f'ALTER TABLE {qtable} ADD COLUMN {column_name} '
                f'tinyint(1) NOT NULL DEFAULT {default_int}'
            )


def _add_varchar_column(
    cursor,
    qtable: str,
    table: str,
    column_name: str,
    *,
    max_length: int,
    default: str,
    connection,
) -> None:
    escaped_default = default.replace("'", "''")
    if connection.vendor == 'postgresql':
        cursor.execute(
            f"""
            ALTER TABLE {qtable}
            ADD COLUMN IF NOT EXISTS {column_name} varchar({max_length}) NOT NULL DEFAULT '{escaped_default}'
            """
        )
        cursor.execute(
            f"""
            UPDATE {qtable}
            SET {column_name} = '{escaped_default}'
            WHERE {column_name} IS NULL
            """
        )
        cursor.execute(
            f"""
            ALTER TABLE {qtable}
            ALTER COLUMN {column_name} SET DEFAULT '{escaped_default}'
            """
        )
    elif connection.vendor == 'sqlite':
        cursor.execute(f'PRAGMA table_info({table})')
        col_names = {row[1] for row in cursor.fetchall()}
        if column_name not in col_names:
            cursor.execute(
                f"ALTER TABLE {qtable} ADD COLUMN {column_name} "
                f"varchar({max_length}) NOT NULL DEFAULT '{escaped_default}'"
            )
    elif connection.vendor in ('mysql', 'mariadb'):
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = %s
              AND column_name = %s
            """,
            [table, column_name],
        )
        if not cursor.fetchone():
            cursor.execute(
                f"ALTER TABLE {qtable} ADD COLUMN {column_name} "
                f"varchar({max_length}) NOT NULL DEFAULT '{escaped_default}'"
            )


def _add_organization_preference_columns(apps, schema_editor):
    Organization = apps.get_model('contracts', 'Organization')
    table = Organization._meta.db_table
    qtable = schema_editor.quote_name(table)
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        _add_boolean_column(cursor, qtable, table, 'daily_digest', default=True, connection=connection)
        _add_boolean_column(cursor, qtable, table, 'critical_alerts', default=True, connection=connection)
        _add_boolean_column(cursor, qtable, table, 'auto_escalation', default=True, connection=connection)
        _add_varchar_column(
            cursor,
            qtable,
            table,
            'default_region',
            max_length=120,
            default='',
            connection=connection,
        )
        _add_varchar_column(
            cursor,
            qtable,
            table,
            'default_timezone',
            max_length=64,
            default='Europe/Amsterdam',
            connection=connection,
        )
        _add_varchar_column(
            cursor,
            qtable,
            table,
            'default_language',
            max_length=16,
            default='nl',
            connection=connection,
        )
        _add_varchar_column(
            cursor,
            qtable,
            table,
            'default_theme',
            max_length=32,
            default='system',
            connection=connection,
        )
        _add_varchar_column(
            cursor,
            qtable,
            table,
            'logo_url',
            max_length=500,
            default='',
            connection=connection,
        )
        _add_varchar_column(
            cursor,
            qtable,
            table,
            'contact_email',
            max_length=254,
            default='',
            connection=connection,
        )
        _add_varchar_column(
            cursor,
            qtable,
            table,
            'notification_email',
            max_length=254,
            default='',
            connection=connection,
        )
        if connection.vendor == 'postgresql':
            _pg_repair_organization_notnull_defaults(cursor, table)


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0066_organization_require_mfa'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_add_organization_preference_columns, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='organization',
                    name='daily_digest',
                    field=models.BooleanField(
                        default=True,
                        help_text='Send operational digest notifications to organization members.',
                    ),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='critical_alerts',
                    field=models.BooleanField(
                        default=True,
                        help_text='Surface critical chain blockers to authorized members.',
                    ),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='auto_escalation',
                    field=models.BooleanField(
                        default=True,
                        help_text='Allow automatic escalation when cases stall in the chain.',
                    ),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='default_region',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text='Default region label for intake and matching context.',
                        max_length=120,
                    ),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='default_timezone',
                    field=models.CharField(blank=True, default='Europe/Amsterdam', max_length=64),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='default_language',
                    field=models.CharField(blank=True, default='nl', max_length=16),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='default_theme',
                    field=models.CharField(blank=True, default='system', max_length=32),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='logo_url',
                    field=models.CharField(blank=True, default='', max_length=500),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='contact_email',
                    field=models.EmailField(blank=True, default='', max_length=254),
                ),
                migrations.AddField(
                    model_name='organization',
                    name='notification_email',
                    field=models.EmailField(
                        blank=True,
                        default='',
                        help_text='Optional shared inbox for operational notifications.',
                        max_length=254,
                    ),
                ),
            ],
        ),
    ]
