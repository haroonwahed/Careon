# Zorg OS v1.2 — wijkteam-instroom, zorgvormen, budgetcontrole, evaluaties, doorstroomverzoeken.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0062_userprofile_mfa_aux_columns'),
    ]

    operations = [
        migrations.AlterField(
            model_name='caseintakeprocess',
            name='workflow_state',
            field=models.CharField(
                blank=True,
                choices=[
                    ('WIJKTEAM_INTAKE', 'Wijkteam intake'),
                    ('ZORGVRAAG_BEOORDELING', 'Zorgvraag beoordeling'),
                    ('DRAFT_CASE', 'Casus aangemaakt'),
                    ('SUMMARY_READY', 'Samenvatting gereed'),
                    ('MATCHING_READY', 'Matching gereed'),
                    ('GEMEENTE_VALIDATED', 'Gemeente gevalideerd'),
                    ('PROVIDER_REVIEW_PENDING', 'Aanbiederbeoordeling open'),
                    ('PROVIDER_ACCEPTED', 'Aanbieder geaccepteerd'),
                    ('BUDGET_REVIEW_PENDING', 'Budgetcontrole'),
                    ('PROVIDER_REJECTED', 'Aanbieder afgewezen'),
                    ('PLACEMENT_CONFIRMED', 'Plaatsing bevestigd'),
                    ('INTAKE_STARTED', 'Intake gestart'),
                    ('ACTIVE_PLACEMENT', 'Actieve plaatsing'),
                    ('ARCHIVED', 'Gearchiveerd'),
                ],
                default='',
                help_text='Persistente workflowstate voor canonical flow-validatie.',
                max_length=48,
                verbose_name='Workflowstatus',
            ),
        ),
        migrations.AddField(
            model_name='caseintakeprocess',
            name='entry_route',
            field=models.CharField(
                choices=[('STANDARD', 'Standaard casus'), ('WIJKTEAM', 'Wijkteam intake')],
                default='STANDARD',
                help_text='Wijkteam: familie kan worden geregistreerd vóór externe zorg.',
                max_length=20,
                verbose_name='Instroomroute',
            ),
        ),
        migrations.AlterField(
            model_name='caseintakeprocess',
            name='preferred_care_form',
            field=models.CharField(
                choices=[
                    ('LOW_THRESHOLD_CONSULT', 'Laagdrempelig consult'),
                    ('AMBULANT_SUPPORT', 'Ambulante ondersteuning'),
                    ('OUTPATIENT', 'Ambulant (legacy)'),
                    ('DAY_TREATMENT', 'Dagbehandeling'),
                    ('VOLUNTARY_OUT_OF_HOME', 'Vrijwillige uithuisplaatsing'),
                    ('RESIDENTIAL', 'Woon- of zorgvoorziening'),
                    ('CRISIS', 'Crisiszorg'),
                    ('CONTINUATION_PATHWAY', 'Doorstroomtraject'),
                ],
                default='OUTPATIENT',
                max_length=32,
                verbose_name='Gewenste zorgvorm',
            ),
        ),
        migrations.AlterField(
            model_name='caseintakeprocess',
            name='zorgvorm_gewenst',
            field=models.CharField(
                blank=True,
                choices=[
                    ('LOW_THRESHOLD_CONSULT', 'Laagdrempelig consult'),
                    ('AMBULANT_SUPPORT', 'Ambulante ondersteuning'),
                    ('OUTPATIENT', 'Ambulant (legacy)'),
                    ('DAY_TREATMENT', 'Dagbehandeling'),
                    ('VOLUNTARY_OUT_OF_HOME', 'Vrijwillige uithuisplaatsing'),
                    ('RESIDENTIAL', 'Woon- of zorgvoorziening'),
                    ('CRISIS', 'Crisiszorg'),
                    ('CONTINUATION_PATHWAY', 'Doorstroomtraject'),
                ],
                max_length=32,
                verbose_name='Zorgvorm gewenst (matching)',
            ),
        ),
        migrations.AlterField(
            model_name='placementrequest',
            name='care_form',
            field=models.CharField(
                blank=True,
                choices=[
                    ('LOW_THRESHOLD_CONSULT', 'Laagdrempelig consult'),
                    ('AMBULANT_SUPPORT', 'Ambulante ondersteuning'),
                    ('OUTPATIENT', 'Ambulant (legacy)'),
                    ('DAY_TREATMENT', 'Dagbehandeling'),
                    ('VOLUNTARY_OUT_OF_HOME', 'Vrijwillige uithuisplaatsing'),
                    ('RESIDENTIAL', 'Woon- of zorgvoorziening'),
                    ('CRISIS', 'Crisiszorg'),
                    ('CONTINUATION_PATHWAY', 'Doorstroomtraject'),
                ],
                max_length=32,
                verbose_name='Zorgvorm',
            ),
        ),
        migrations.AddField(
            model_name='placementrequest',
            name='budget_review_decided_at',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Budgetbesluit op'),
        ),
        migrations.AddField(
            model_name='placementrequest',
            name='budget_review_decided_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='budget_reviews_decided',
                to=settings.AUTH_USER_MODEL,
                verbose_name='Budgetbesluit door',
            ),
        ),
        migrations.AddField(
            model_name='placementrequest',
            name='budget_review_note',
            field=models.TextField(blank=True, verbose_name='Toelichting budgetbesluit'),
        ),
        migrations.AddField(
            model_name='placementrequest',
            name='budget_review_status',
            field=models.CharField(
                choices=[
                    ('NOT_REQUIRED', 'Geen budgetcontrole vereist'),
                    ('PENDING', 'Wacht op gemeentelijke financiële validatie'),
                    ('APPROVED', 'Doorstroom financieel akkoord'),
                    ('REJECTED', 'Wijs financieel af'),
                    ('NEEDS_INFO', 'Vraag onderbouwing op'),
                    ('DEFERRED', 'Besluit uitgesteld'),
                ],
                default='NOT_REQUIRED',
                max_length=20,
                verbose_name='Budgetbeoordeling',
            ),
        ),
        migrations.AlterField(
            model_name='casedecisionlog',
            name='event_type',
            field=models.CharField(
                choices=[
                    ('MATCH_RECOMMENDED', 'Match recommended'),
                    ('PROVIDER_SELECTED', 'Provider selected'),
                    ('RESEND_TRIGGERED', 'Resend triggered'),
                    ('PROVIDE_MISSING_INFO', 'Missing info provided'),
                    ('REMATCH_TRIGGERED', 'Rematch triggered'),
                    ('CONTINUE_WAITING', 'Continue waiting'),
                    ('SLA_ESCALATION', 'SLA state transition'),
                    ('CASE_COMMUNICATION', 'Case communication'),
                    ('STATE_TRANSITION', 'Workflow state transition'),
                    ('GEMEENTE_VALIDATION', 'Gemeente validatie matching'),
                    ('BUDGET_DECISION', 'Budgetbesluit gemeente'),
                    ('EVALUATION_OUTCOME', 'Evaluatie-uitkomst'),
                    ('TRANSITION_REQUEST', 'Doorstroomverzoek'),
                    ('FINANCIAL_VALIDATION', 'Financiële validatie doorstroom'),
                ],
                max_length=40,
            ),
        ),
        migrations.CreateModel(
            name='CaseCareEvaluation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('due_date', models.DateField(verbose_name='Datum evaluatie')),
                ('attendees', models.JSONField(blank=True, default=list, verbose_name='Aanwezigen')),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('UPCOMING', 'Evaluatie gepland'),
                            ('OVERDUE', 'Evaluatie achterstallig'),
                            ('COMPLETED', 'Evaluatie afgerond'),
                        ],
                        default='UPCOMING',
                        max_length=20,
                        verbose_name='Status',
                    ),
                ),
                (
                    'outcome',
                    models.CharField(
                        blank=True,
                        choices=[
                            ('CONTINUE', 'Voortzetten'),
                            ('TAPER', 'Afbouwen'),
                            ('SCALE_UP', 'Opschalen'),
                            ('PREPARE_TRANSITION', 'Doorstroom voorbereiden'),
                            ('CLOSE', 'Sluiten'),
                        ],
                        max_length=40,
                        verbose_name='Uitkomst',
                    ),
                ),
                ('follow_up_actions', models.TextField(blank=True, verbose_name='Vervolgacties')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'due_diligence_process',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='care_evaluations',
                        to='contracts.caseintakeprocess',
                        verbose_name='Casus',
                    ),
                ),
                (
                    'recorded_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='recorded_care_evaluations',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Laatst vastgelegd door',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Zorgevaluatie',
                'verbose_name_plural': 'Zorgevaluaties',
                'ordering': ['due_date', 'id'],
            },
        ),
        migrations.CreateModel(
            name='ProviderCareTransitionRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('proposed_care_form', models.CharField(max_length=32, verbose_name='Voorgestelde zorgvorm')),
                ('reason', models.TextField(verbose_name='Reden')),
                ('urgency', models.CharField(default='MEDIUM', max_length=10, verbose_name='Urgentie')),
                ('estimated_financial_impact', models.TextField(blank=True, verbose_name='Geschatte financiële impact')),
                ('requested_start_date', models.DateField(blank=True, null=True, verbose_name='Gewenste ingangsdatum')),
                ('supporting_explanation', models.TextField(blank=True, verbose_name='Onderbouwing')),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('PENDING', 'In behandeling'),
                            ('WITHDRAWN', 'Ingetrokken'),
                            ('CLOSED', 'Afgehandeld'),
                        ],
                        default='PENDING',
                        max_length=20,
                        verbose_name='Verzoekstatus',
                    ),
                ),
                (
                    'financial_validation_status',
                    models.CharField(
                        choices=[
                            ('PENDING', 'Wacht op financiële validatie'),
                            ('APPROVED', 'Doorstroom financieel akkoord'),
                            ('REJECTED', 'Wijs financieel af'),
                            ('NEEDS_INFO', 'Vraag onderbouwing op'),
                            ('DEFERRED', 'Besluit uitgesteld'),
                        ],
                        default='PENDING',
                        max_length=20,
                        verbose_name='Financiële validatie',
                    ),
                ),
                ('financial_validation_note', models.TextField(blank=True, verbose_name='Toelichting gemeente')),
                ('financial_validation_at', models.DateTimeField(blank=True, null=True, verbose_name='Financiële beslissing op')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'created_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='submitted_transition_requests',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Ingediend door',
                    ),
                ),
                (
                    'due_diligence_process',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='provider_transition_requests',
                        to='contracts.caseintakeprocess',
                        verbose_name='Casus',
                    ),
                ),
                (
                    'financial_validation_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='validated_transition_requests',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Financiële beslissing door',
                    ),
                ),
                (
                    'placement_request',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='transition_requests',
                        to='contracts.placementrequest',
                        verbose_name='Plaatsing',
                    ),
                ),
            ],
            options={
                'verbose_name': 'Doorstroomverzoek aanbieder',
                'verbose_name_plural': 'Doorstroomverzoeken aanbieder',
                'ordering': ['-created_at'],
            },
        ),
    ]
