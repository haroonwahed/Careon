from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0091_placementrequest_capacity_committed'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditlog',
            name='organization',
            field=models.ForeignKey(
                blank=True,
                db_index=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='audit_logs',
                to='contracts.organization',
            ),
        ),
    ]
