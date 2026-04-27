from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0052_rename_duediligencerisk_to_caserisksignal'),
    ]

    operations = [
        migrations.AddField(
            model_name='caseintakeprocess',
            name='workflow_state',
            field=models.CharField(
                blank=True,
                choices=[
                    ('DRAFT_CASE', 'Casus aangemaakt'),
                    ('SUMMARY_READY', 'Samenvatting gereed'),
                    ('MATCHING_READY', 'Matching gereed'),
                    ('GEMEENTE_VALIDATED', 'Gemeente gevalideerd'),
                    ('PROVIDER_REVIEW_PENDING', 'Aanbiederbeoordeling open'),
                    ('PROVIDER_ACCEPTED', 'Aanbieder geaccepteerd'),
                    ('PROVIDER_REJECTED', 'Aanbieder afgewezen'),
                    ('PLACEMENT_CONFIRMED', 'Plaatsing bevestigd'),
                    ('INTAKE_STARTED', 'Intake gestart'),
                    ('ARCHIVED', 'Gearchiveerd'),
                ],
                default='',
                help_text='Persistente workflowstate voor canonical flow-validatie.',
                max_length=40,
                verbose_name='Workflowstatus',
            ),
        ),
    ]
