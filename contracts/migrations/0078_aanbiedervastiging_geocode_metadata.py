from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0077_sqlite_postgres_drift_columns'),
    ]

    operations = [
        migrations.AddField(
            model_name='aanbiedervestiging',
            name='coordinate_source',
            field=models.CharField(
                blank=True,
                help_text='Herkomst van latitude/longitude (vestiging, geocode_pdok, geocode_google)',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='aanbiedervestiging',
            name='geocoded_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Tijdstip van laatste geocodering',
                null=True,
            ),
        ),
    ]
