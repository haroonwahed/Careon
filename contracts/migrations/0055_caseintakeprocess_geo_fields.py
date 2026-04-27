from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0054_providerregiodekking_service_radius_km'),
    ]

    operations = [
        migrations.AddField(
            model_name='caseintakeprocess',
            name='latitude',
            field=models.FloatField(
                blank=True,
                null=True,
                verbose_name='Latitude',
                help_text='Optionele coordinaten voor afstandsberekening.',
            ),
        ),
        migrations.AddField(
            model_name='caseintakeprocess',
            name='longitude',
            field=models.FloatField(
                blank=True,
                null=True,
                verbose_name='Longitude',
                help_text='Optionele coordinaten voor afstandsberekening.',
            ),
        ),
        migrations.AddField(
            model_name='caseintakeprocess',
            name='postcode',
            field=models.CharField(
                blank=True,
                max_length=10,
                verbose_name='Postcode',
                help_text='Globale casuslocatie voor afstands- en dekkingscontrole.',
            ),
        ),
    ]
