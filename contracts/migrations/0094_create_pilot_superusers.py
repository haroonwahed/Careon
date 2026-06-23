from django.db import migrations


PILOT_SUPERUSERS = [
    {"username": "luuk@carelane.nl", "email": "luuk@carelane.nl", "first_name": "Luuk", "password": "ChangeMeNow1!"},
    {"username": "sina@carelane.nl", "email": "sina@carelane.nl", "first_name": "Sina", "password": "ChangeMeNow2!"},
]


def create_superusers(apps, schema_editor):
    User = apps.get_model("auth", "User")
    for spec in PILOT_SUPERUSERS:
        if not User.objects.filter(username=spec["username"]).exists():
            user = User(
                username=spec["username"],
                email=spec["email"],
                first_name=spec["first_name"],
                is_staff=True,
                is_superuser=True,
            )
            user.set_password(spec["password"])
            user.save()


def delete_superusers(apps, schema_editor):
    User = apps.get_model("auth", "User")
    User.objects.filter(username__in=[s["username"] for s in PILOT_SUPERUSERS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("contracts", "0093_auditlog_backfill_organization"),
    ]

    operations = [
        migrations.RunPython(create_superusers, delete_superusers),
    ]
