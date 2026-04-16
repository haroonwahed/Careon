from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0040_add_decision_quality_review'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DecisionQualityWeeklyReviewMark',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.PositiveIntegerField()),
                ('week', models.PositiveSmallIntegerField()),
                ('reason', models.CharField(blank=True, max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'case',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='decision_quality_review_marks',
                        to='contracts.caseintakeprocess',
                    ),
                ),
                (
                    'marked_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='decision_quality_review_marks',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'placement',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='decision_quality_review_marks',
                        to='contracts.placementrequest',
                    ),
                ),
            ],
            options={
                'db_table': 'contracts_decisionqualityweeklyreviewmark',
                'ordering': ['-year', '-week', '-created_at'],
                'unique_together': {('case', 'year', 'week')},
            },
        ),
        migrations.AddIndex(
            model_name='decisionqualityweeklyreviewmark',
            index=models.Index(fields=['year', 'week', 'created_at'], name='dq_week_mark_idx'),
        ),
        migrations.AddIndex(
            model_name='decisionqualityweeklyreviewmark',
            index=models.Index(fields=['case', 'year', 'week'], name='dq_case_week_idx'),
        ),
    ]
