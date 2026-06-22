from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0090_zorgaanbieder_client_backfill'),
    ]

    operations = [
        migrations.AddField(
            model_name='placementrequest',
            name='capacity_committed',
            field=models.BooleanField(
                default=False,
                help_text='True nadat plaatsingsbevestiging capaciteit heeft afgetrokken.',
                verbose_name='Capaciteit gecommitteerd',
            ),
        ),
    ]
