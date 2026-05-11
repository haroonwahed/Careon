# Backfill UserProfile for users created before automatic provisioning (e.g. production Render).

from django.db import migrations


def forwards(apps, schema_editor):
    connection = schema_editor.connection
    # Some production Postgres DBs gained NOT NULL columns before Django state included them;
    # ORM inserts omit unknown columns and Postgres rejects NULL. (information_schema is PG-only.)
    if connection.vendor == 'postgresql':
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'contracts_userprofile'
                  AND column_name = 'session_revocation_counter'
                """
            )
            if cursor.fetchone():
                cursor.execute(
                    """
                    UPDATE contracts_userprofile
                    SET session_revocation_counter = 0
                    WHERE session_revocation_counter IS NULL
                    """
                )
                cursor.execute(
                    """
                    ALTER TABLE contracts_userprofile
                        ALTER COLUMN session_revocation_counter SET DEFAULT 0
                    """
                )

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
