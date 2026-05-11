# MFA-related columns on UserProfile (may already exist on Supabase before Django tracked them).

from django.db import migrations, models


def _add_mfa_aux_columns(apps, schema_editor):
    UserProfile = apps.get_model('contracts', 'UserProfile')
    table = UserProfile._meta.db_table
    qtable = schema_editor.quote_name(table)
    connection = schema_editor.connection

    with connection.cursor() as cursor:
        if connection.vendor == 'postgresql':
            for sql in (
                f'ALTER TABLE {qtable} ADD COLUMN IF NOT EXISTS mfa_verified_at timestamptz NULL',
                f'ALTER TABLE {qtable} ADD COLUMN IF NOT EXISTS mfa_enrollment_code_expires_at timestamptz NULL',
                f'ALTER TABLE {qtable} ADD COLUMN IF NOT EXISTS mfa_enrollment_code_sent_at timestamptz NULL',
                f"ALTER TABLE {qtable} ADD COLUMN IF NOT EXISTS mfa_enrollment_code_hash varchar(128) NOT NULL DEFAULT ''",
                f"ALTER TABLE {qtable} ADD COLUMN IF NOT EXISTS mfa_recovery_code_hashes jsonb NOT NULL DEFAULT '[]'::jsonb",
            ):
                cursor.execute(sql)
            cursor.execute(
                f"""
                UPDATE {qtable} SET mfa_enrollment_code_hash = ''
                WHERE mfa_enrollment_code_hash IS NULL
                """
            )
            cursor.execute(
                f"""
                UPDATE {qtable} SET mfa_recovery_code_hashes = '[]'::jsonb
                WHERE mfa_recovery_code_hashes IS NULL
                """
            )
            cursor.execute(
                f'ALTER TABLE {qtable} ALTER COLUMN mfa_enrollment_code_hash SET DEFAULT \'\''
            )
            cursor.execute(
                f"ALTER TABLE {qtable} ALTER COLUMN mfa_recovery_code_hashes SET DEFAULT '[]'::jsonb"
            )
        elif connection.vendor == 'sqlite':
            cursor.execute(f'PRAGMA table_info({table})')
            col_names = {row[1] for row in cursor.fetchall()}
            specs = (
                ('mfa_verified_at', f'ALTER TABLE {qtable} ADD COLUMN mfa_verified_at datetime NULL'),
                (
                    'mfa_enrollment_code_expires_at',
                    f'ALTER TABLE {qtable} ADD COLUMN mfa_enrollment_code_expires_at datetime NULL',
                ),
                (
                    'mfa_enrollment_code_sent_at',
                    f'ALTER TABLE {qtable} ADD COLUMN mfa_enrollment_code_sent_at datetime NULL',
                ),
                (
                    'mfa_enrollment_code_hash',
                    f"ALTER TABLE {qtable} ADD COLUMN mfa_enrollment_code_hash varchar(128) NOT NULL DEFAULT ''",
                ),
                (
                    'mfa_recovery_code_hashes',
                    f"ALTER TABLE {qtable} ADD COLUMN mfa_recovery_code_hashes TEXT NOT NULL DEFAULT '[]'",
                ),
            )
            for col, sql in specs:
                if col not in col_names:
                    cursor.execute(sql)
        elif connection.vendor in ('mysql', 'mariadb'):
            for col, ddl in (
                ('mfa_verified_at', 'datetime(6) NULL'),
                ('mfa_enrollment_code_expires_at', 'datetime(6) NULL'),
                ('mfa_enrollment_code_sent_at', 'datetime(6) NULL'),
                ('mfa_enrollment_code_hash', "varchar(128) NOT NULL DEFAULT ''"),
                ('mfa_recovery_code_hashes', 'json NOT NULL DEFAULT (json_array())'),
            ):
                cursor.execute(
                    """
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name = %s
                      AND column_name = %s
                    """,
                    [table, col],
                )
                if not cursor.fetchone():
                    cursor.execute(f'ALTER TABLE {qtable} ADD COLUMN {col} {ddl}')


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0061_userprofile_mfa_enabled'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_add_mfa_aux_columns, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='userprofile',
                    name='mfa_verified_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='userprofile',
                    name='mfa_enrollment_code_expires_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='userprofile',
                    name='mfa_enrollment_code_hash',
                    field=models.CharField(
                        blank=True,
                        default='',
                        help_text='Hash of a pending MFA enrollment code; empty when not enrolling.',
                        max_length=128,
                    ),
                ),
                migrations.AddField(
                    model_name='userprofile',
                    name='mfa_enrollment_code_sent_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='userprofile',
                    name='mfa_recovery_code_hashes',
                    field=models.JSONField(
                        default=list,
                        help_text='Hashes of issued MFA recovery codes; empty list when none.',
                    ),
                ),
            ],
        ),
    ]
