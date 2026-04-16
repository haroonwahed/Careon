"""
Migration: CaseDecisionLog retention safety + append-only model hardening.

Changes:
  1. case FK: CASCADE → SET_NULL (governance evidence survives case deletion)
  2. Add case_id_snapshot  — stable identifier, outlives the FK
  3. placement FK: SET_NULL already; ensure null/blank=True (guard against earlier variant)
  4. Add placement_id_snapshot — stable identifier, outlives the FK
  5. Add cdl_case_snapshot_idx on case_id_snapshot for replay efficiency

The ImmutableQuerySet / save / delete guards are ORM-layer only and require no
DDL changes — they live in the model class.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0037_casedecisionlog_actor_attribution'),
    ]

    operations = [
        # 1. Alter case FK: swap CASCADE for SET_NULL so deleting a case
        #    does not cascade-destroy the governance audit trail.
        migrations.AlterField(
            model_name='casedecisionlog',
            name='case',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='decision_logs',
                to='contracts.caseintakeprocess',
                db_column='case_id',
            ),
        ),
        # 2. Add stable case snapshot field.
        migrations.AddField(
            model_name='casedecisionlog',
            name='case_id_snapshot',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text='Stable case identifier preserved for audit even after case deletion.',
            ),
        ),
        # 3. Add stable placement snapshot field.
        migrations.AddField(
            model_name='casedecisionlog',
            name='placement_id_snapshot',
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text='Stable placement identifier preserved for audit even after placement deletion.',
            ),
        ),
        # 4. Index for snapshot-based replay (case FK may be NULL post-deletion).
        migrations.AddIndex(
            model_name='casedecisionlog',
            index=models.Index(
                fields=['case_id_snapshot'],
                name='cdl_case_snapshot_idx',
            ),
        ),
    ]
