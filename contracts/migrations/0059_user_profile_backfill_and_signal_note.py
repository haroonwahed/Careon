# Backfill UserProfile for users created before automatic provisioning (e.g. production Render).

from django.db import migrations


def _pg_userprofile_repair_notnull_defaults(cursor):
    """Columns that may exist on managed Postgres (e.g. Supabase) before Django migration state."""
    repairs = (
        ('session_revocation_counter', 'session_revocation_counter = 0', '0'),
        ('mfa_enabled', 'mfa_enabled = false', 'false'),
        ("mfa_enrollment_code_hash", "mfa_enrollment_code_hash = ''", "''"),
        ("mfa_recovery_code_hashes", "mfa_recovery_code_hashes = '[]'::jsonb", "'[]'::jsonb"),
    )
    for column_name, set_clause, default_literal in repairs:
        cursor.execute(
            """
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'contracts_userprofile'
              AND column_name = %s
            """,
            [column_name],
        )
        if not cursor.fetchone():
            continue
        cursor.execute(
            f"""
            UPDATE contracts_userprofile
            SET {set_clause}
            WHERE {column_name} IS NULL
            """
        )
        cursor.execute(
            f"""
            ALTER TABLE contracts_userprofile
                ALTER COLUMN {column_name} SET DEFAULT {default_literal}
            """
        )


def forwards(apps, schema_editor):
    connection = schema_editor.connection
    # Some production Postgres DBs gained NOT NULL columns before Django state included them;
    # ORM inserts omit unknown columns and Postgres rejects NULL. (information_schema is PG-only.)
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            _pg_userprofile_repair_notnull_defaults(cursor)

    User = apps.get_model('auth', 'User')
    UserProfile = apps.get_model('contracts', 'UserProfile')
    for user in User.objects.iterator():
        role = 'ADMIN' if user.is_superuser else 'ASSOCIATE'
        UserProfile.objects.get_or_create(user=user, defaults={'role': role})


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0058_case_timeline_event_v1'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
