import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0088_intake_appointment_planning'),
    ]

    operations = [
        migrations.AddField(
            model_name='zorgaanbieder',
            name='client',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='zorgaanbieder',
                to='contracts.client',
                help_text='Client-rij (CORPORATION) die voor plaatsing en provider-portal wordt gebruikt',
            ),
        ),
    ]
