from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0053_caseintakeprocess_workflow_state'),
    ]

    operations = [
        migrations.AddField(
            model_name='providerregiodekking',
            name='service_radius_km',
            field=models.FloatField(
                blank=True,
                null=True,
                validators=[django.core.validators.MinValueValidator(0.0)],
                help_text='Optionele maximale service-radius in kilometers voor geo-matching.',
            ),
        ),
    ]
