# Recent drift migrations (0068–0072) only altered PostgreSQL. Apply matching columns on SQLite/local DBs.

from django.db import migrations


def _table_columns(schema_editor, table_name: str) -> set[str]:
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'sqlite':
            cursor.execute(f'PRAGMA table_info({table_name})')
            return {row[1] for row in cursor.fetchall()}
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            [table_name],
        )
        return {row[0] for row in cursor.fetchall()}


def _add_column_if_missing(schema_editor, table_name: str, column_name: str, ddl: str) -> None:
    if column_name in _table_columns(schema_editor, table_name):
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f'ALTER TABLE {table_name} ADD COLUMN {ddl}')


def _apply_sqlite_drift_columns(apps, schema_editor):
    if schema_editor.connection.vendor == 'postgresql':
        return

    _add_column_if_missing(
        schema_editor,
        'contracts_organizationmembership',
        'scim_external_id',
        "scim_external_id varchar(255) NOT NULL DEFAULT ''",
    )
    _add_column_if_missing(
        schema_editor,
        'contracts_care_case',
        'source_system',
        "source_system varchar(100) NOT NULL DEFAULT ''",
    )
    _add_column_if_missing(
        schema_editor,
        'contracts_care_case',
        'source_system_id',
        'source_system_id integer NULL DEFAULT 0',
    )
    _add_column_if_missing(
        schema_editor,
        'contracts_care_case',
        'source_system_url',
        "source_system_url varchar(500) NOT NULL DEFAULT ''",
    )


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0076_deadline_relax_orphan_not_null'),
    ]

    operations = [
        migrations.RunPython(_apply_sqlite_drift_columns, migrations.RunPython.noop),
    ]
