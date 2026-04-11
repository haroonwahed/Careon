from django.db import migrations


def noop_forward(apps, schema_editor):
    # Phase marker migration: canonical Python-level relation aliases are additive.
    return


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0027_rename_risklog_to_caresignal'),
    ]

    operations = [
        migrations.RunPython(noop_forward, noop_reverse),
    ]
