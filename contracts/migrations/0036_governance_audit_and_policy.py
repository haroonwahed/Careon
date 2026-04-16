from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0035_provider_response_orchestration'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemPolicyConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=120)),
                ('value', models.JSONField(blank=True, null=True)),
                ('scope', models.CharField(choices=[('global', 'Global'), ('municipality', 'Municipality')], default='global', max_length=20)),
                ('active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['key', 'scope'],
                'unique_together': {('key', 'scope')},
            },
        ),
        migrations.CreateModel(
            name='CaseDecisionLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('MATCH_RECOMMENDED', 'Match recommended'), ('PROVIDER_SELECTED', 'Provider selected'), ('RESEND_TRIGGERED', 'Resend triggered'), ('REMATCH_TRIGGERED', 'Rematch triggered'), ('CONTINUE_WAITING', 'Continue waiting'), ('SLA_ESCALATION', 'SLA escalation')], max_length=40)),
                ('system_recommendation', models.JSONField(blank=True, null=True)),
                ('recommendation_context', models.JSONField(blank=True, default=dict)),
                ('user_action', models.CharField(blank=True, max_length=120)),
                ('action_source', models.CharField(default='system', max_length=40)),
                ('sla_state', models.CharField(blank=True, max_length=40)),
                ('adaptive_flags', models.JSONField(blank=True, default=dict)),
                ('override_type', models.CharField(blank=True, max_length=40)),
                ('recommended_value', models.JSONField(blank=True, null=True)),
                ('actual_value', models.JSONField(blank=True, null=True)),
                ('optional_reason', models.TextField(blank=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('case', models.ForeignKey(db_column='case_id', on_delete=django.db.models.deletion.CASCADE, related_name='decision_logs', to='contracts.caseintakeprocess')),
                ('placement', models.ForeignKey(blank=True, db_column='placement_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='decision_logs', to='contracts.placementrequest')),
                ('provider', models.ForeignKey(blank=True, db_column='provider_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='case_decision_logs', to='contracts.client')),
            ],
            options={
                'db_table': 'contracts_casedecisionlog',
                'ordering': ['timestamp', 'id'],
            },
        ),
        migrations.AddIndex(
            model_name='systempolicyconfig',
            index=models.Index(fields=['key', 'scope', 'active'], name='contracts_s_key_6a5d57_idx'),
        ),
        migrations.AddIndex(
            model_name='casedecisionlog',
            index=models.Index(fields=['case', 'timestamp'], name='contracts_c_case_id_f8c805_idx'),
        ),
        migrations.AddIndex(
            model_name='casedecisionlog',
            index=models.Index(fields=['event_type', 'timestamp'], name='contracts_c_event_t_5ef067_idx'),
        ),
    ]
