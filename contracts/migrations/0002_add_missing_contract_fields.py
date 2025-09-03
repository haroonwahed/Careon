
# Generated manually to fix missing fields

from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('contracts', '0001_initial'),
    ]

    operations = [
        # Add missing fields to Contract model
        migrations.AddField(
            model_name='contract',
            name='counterparty',
            field=models.CharField(max_length=200, blank=True),
        ),
        migrations.AddField(
            model_name='contract',
            name='value',
            field=models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True),
        ),
        migrations.AddField(
            model_name='contract',
            name='start_date',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='contract',
            name='end_date',
            field=models.DateField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='contract',
            name='created_by',
            field=models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, to=settings.AUTH_USER_MODEL),
        ),
        
        # Update Contract status choices to match current model
        migrations.AlterField(
            model_name='contract',
            name='status',
            field=models.CharField(max_length=20, choices=[('DRAFT', 'Draft'), ('PENDING', 'Pending'), ('ACTIVE', 'Active'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')], default='DRAFT'),
        ),
        
        # Make content field optional
        migrations.AlterField(
            model_name='contract',
            name='content',
            field=models.TextField(blank=True),
        ),
        
        # Add missing fields to other models that may be missing
        migrations.AddField(
            model_name='compliancechecklist',
            name='contract',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, null=True, blank=True, to='contracts.contract'),
        ),
        migrations.AddField(
            model_name='compliancechecklist',
            name='created_by',
            field=models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, to=settings.AUTH_USER_MODEL),
        ),
        
        migrations.AddField(
            model_name='checklistitem',
            name='completed_by',
            field=models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, blank=True, to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='checklistitem',
            name='completed_at',
            field=models.DateTimeField(null=True, blank=True),
        ),
        
        migrations.AddField(
            model_name='risklog',
            name='contract',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, null=True, blank=True, to='contracts.contract'),
        ),
        migrations.AddField(
            model_name='risklog',
            name='created_by',
            field=models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, to=settings.AUTH_USER_MODEL),
        ),
        
        # Update RiskLog risk_level choices to match current model
        migrations.AlterField(
            model_name='risklog',
            name='risk_level',
            field=models.CharField(max_length=10, choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('CRITICAL', 'Critical')], default='MEDIUM'),
        ),
        
        # Rename field in RiskLog
        migrations.RenameField(
            model_name='risklog',
            old_name='mitigation_strategy',
            new_name='mitigation_plan',
        ),
        
        # Add missing fields to LegalTask
        migrations.AddField(
            model_name='legaltask',
            name='contract',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, null=True, blank=True, to='contracts.contract'),
        ),
        
        # Add missing fields to WorkflowTemplate
        migrations.AddField(
            model_name='workflowtemplate',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        
        # Update WorkflowTemplateStep fields
        migrations.RenameField(
            model_name='workflowtemplatestep',
            old_name='title',
            new_name='name',
        ),
        migrations.RemoveField(
            model_name='workflowtemplatestep',
            name='estimated_duration_days',
        ),
        migrations.AddField(
            model_name='workflowtemplatestep',
            name='estimated_duration',
            field=models.DurationField(null=True, blank=True),
        ),
        migrations.AlterField(
            model_name='workflowtemplatestep',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='workflowtemplatestep',
            name='order',
            field=models.PositiveIntegerField(default=0),
        ),
        
        # Add missing fields to Workflow
        migrations.AddField(
            model_name='workflow',
            name='contract',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, null=True, blank=True, to='contracts.contract'),
        ),
        
        # Update WorkflowStep fields
        migrations.RenameField(
            model_name='workflowstep',
            old_name='title',
            new_name='name',
        ),
        migrations.AlterField(
            model_name='workflowstep',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.RemoveField(
            model_name='workflowstep',
            name='due_date',
        ),
        migrations.AddField(
            model_name='workflowstep',
            name='due_date',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AlterField(
            model_name='workflowstep',
            name='order',
            field=models.PositiveIntegerField(default=0),
        ),
        
        # Add NegotiationThread fields that are missing
        migrations.RemoveField(
            model_name='negotiationthread',
            name='round_number',
        ),
        migrations.RemoveField(
            model_name='negotiationthread',
            name='internal_note',
        ),
        migrations.RemoveField(
            model_name='negotiationthread',
            name='external_note',
        ),
        migrations.RemoveField(
            model_name='negotiationthread',
            name='attachment',
        ),
        migrations.RemoveField(
            model_name='negotiationthread',
            name='timestamp',
        ),
        migrations.RemoveField(
            model_name='negotiationthread',
            name='author',
        ),
        
        migrations.AddField(
            model_name='negotiationthread',
            name='title',
            field=models.CharField(max_length=200, default='Negotiation Note'),
        ),
        migrations.AddField(
            model_name='negotiationthread',
            name='content',
            field=models.TextField(default=''),
        ),
        migrations.AddField(
            model_name='negotiationthread',
            name='created_by',
            field=models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, null=True, to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='negotiationthread',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
    ]
