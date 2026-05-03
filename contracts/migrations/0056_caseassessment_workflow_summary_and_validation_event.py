from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0055_caseintakeprocess_geo_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='caseassessment',
            name='workflow_summary',
            field=models.JSONField(blank=True, default=dict, verbose_name='Gestructureerde samenvatting'),
        ),
    ]
