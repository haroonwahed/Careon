# Backfill UserProfile for users created before automatic provisioning (e.g. production Render).

from django.db import migrations


def forwards(apps, schema_editor):
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
