from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('contracts', '0036_governance_audit_and_policy'),
    ]

    operations = [
        migrations.AddField(
            model_name='casedecisionlog',
            name='actor',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='case_decision_logs',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='casedecisionlog',
            name='actor_kind',
            field=models.CharField(
                choices=[('system', 'System'), ('user', 'User'), ('service', 'Service')],
                default='system',
                max_length=20,
            ),
        ),
    ]
