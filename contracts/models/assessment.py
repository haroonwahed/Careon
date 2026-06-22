from django.db import models
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from contracts.models.core import OutcomeReasonCode
from contracts.tenant_scoped import apply_tenant_scope

User = get_user_model()


class CaseAssessment(models.Model):
    """Care case assessment for intake review and matching preparation (Casusbeoordeling)"""

    class AssessmentStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Concept'
        UNDER_REVIEW = 'UNDER_REVIEW', 'In beoordeling door aanbieder'
        APPROVED_FOR_MATCHING = 'APPROVED_FOR_MATCHING', 'Goedgekeurd voor matching'
        NEEDS_INFO = 'NEEDS_INFO', 'Aanvullende info nodig'

    class RiskSignal(models.TextChoices):
        SAFETY = 'SAFETY', 'Veiligheid'
        ESCALATION = 'ESCALATION', 'Escalatie'
        DROPOUT_RISK = 'DROPOUT_RISK', 'Uitvalsignaal'
        INCOMPLETE_INTAKE = 'INCOMPLETE_INTAKE', 'Onvolledige intake'

    # Link to intake/case
    due_diligence_process = models.OneToOneField(
        'contracts.CaseIntakeProcess',
        on_delete=models.CASCADE,
        related_name='case_assessment',
        verbose_name='Casus'
    )

    # Assessment status
    assessment_status = models.CharField(
        max_length=32,
        choices=AssessmentStatus.choices,
        default=AssessmentStatus.DRAFT,
        verbose_name='Beoordeling door aanbieder status'
    )

    # Signals (multi-select via CharField with comma-separated values or use JSONField)
    risk_signals = models.CharField(
        max_length=200,
        blank=True,
        help_text='Komma-gescheiden signaalcodes',
        verbose_name='Signalen'
    )

    # Matching readiness
    matching_ready = models.BooleanField(
        default=False,
        verbose_name='Klaar voor matching'
    )
    reason_not_ready = models.TextField(
        blank=True,
        verbose_name='Reden indien niet klaar',
        help_text='Toelichting waarom nog niet klaar voor matching'
    )

    # Assessment notes
    notes = models.TextField(
        blank=True,
        verbose_name='Notities',
        help_text='Vrije notities bij beoordeling'
    )

    # Structured pilot summary (Casus → Samenvatting); keys: context, urgency, risks, missing_information
    workflow_summary = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Gestructureerde samenvatting',
    )

    # Track who performed assessment
    assessed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='case_assessments_performed',
        verbose_name='Beoordeeld door'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Casusbeoordeling'
        verbose_name_plural = 'Casusbeoordelingen'

    def __str__(self):
        return f'Casusbeoordeling: {self.intake.title} ({self.get_assessment_status_display()})'

    @property
    def intake(self):
        return self.due_diligence_process

    @intake.setter
    def intake(self, value):
        self.due_diligence_process = value

    def get_risk_signals_display(self):
        """Return list of signal labels."""
        if not self.risk_signals:
            return []
        codes = [s.strip() for s in self.risk_signals.split(',')]
        return [dict(self.RiskSignal.choices).get(code, code) for code in codes]

    def clean(self):
        super().clean()

        if self.assessment_status == self.AssessmentStatus.APPROVED_FOR_MATCHING and not self.matching_ready:
            raise ValidationError({
                'matching_ready': 'Een beoordeling door aanbieder kan pas gereed voor matching zijn als matching_ready aan staat.',
            })

        if self.matching_ready and self.assessment_status != self.AssessmentStatus.APPROVED_FOR_MATCHING:
            raise ValidationError({
                'assessment_status': 'Alleen een goedgekeurde beoordeling door aanbieder mag matching_ready zijn.',
            })

    def can_mark_ready_for_matching(self) -> tuple[bool, str]:
        if self.assessment_status != self.AssessmentStatus.APPROVED_FOR_MATCHING:
            return False, 'Beoordeling door aanbieder moet eerst goedgekeurd zijn voor matching.'
        if not self.matching_ready:
            return False, 'Beoordeling door aanbieder staat nog niet op gereed voor matching.'
        return True, ''


class PlacementRequestQuerySet(models.QuerySet):
    """Custom queryset for PlacementRequest with organization-scoping support."""

    def for_organization(self, organization):
        if not organization:
            return self.none()
        return self.filter(due_diligence_process__organization=organization)


class PlacementRequestManager(models.Manager):
    """Custom manager for PlacementRequest."""

    def get_queryset(self):
        return apply_tenant_scope(PlacementRequestQuerySet(self.model, using=self._db))

    def unscoped(self):
        return PlacementRequestQuerySet(self.model, using=self._db)

    def for_organization(self, organization):
        return self.unscoped().for_organization(organization)


class PlacementRequest(models.Model):
    class Meta:
        db_table = 'contracts_placementrequest'
        verbose_name = 'Placement Request'
        verbose_name_plural = 'Placement Requests'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Concept'
        IN_REVIEW = 'IN_REVIEW', 'In beoordeling'
        APPROVED = 'APPROVED', 'Goedgekeurd'
        REJECTED = 'REJECTED', 'Afgewezen'
        NEEDS_INFO = 'NEEDS_INFO', 'Aanvullende info nodig'

    # Backward-compatible alias used by older tests/code paths.
    Status.PENDING = Status.DRAFT

    class CareForm(models.TextChoices):
        LOW_THRESHOLD_CONSULT = 'LOW_THRESHOLD_CONSULT', 'Laagdrempelig consult'
        AMBULANT_SUPPORT = 'AMBULANT_SUPPORT', 'Ambulante ondersteuning'
        OUTPATIENT = 'OUTPATIENT', 'Ambulant (legacy)'
        DAY_TREATMENT = 'DAY_TREATMENT', 'Dagbehandeling'
        VOLUNTARY_OUT_OF_HOME = 'VOLUNTARY_OUT_OF_HOME', 'Vrijwillige uithuisplaatsing'
        RESIDENTIAL = 'RESIDENTIAL', 'Woon- of zorgvoorziening'
        CRISIS = 'CRISIS', 'Crisiszorg'
        CONTINUATION_PATHWAY = 'CONTINUATION_PATHWAY', 'Doorstroomtraject'

    class BudgetReviewStatus(models.TextChoices):
        NOT_REQUIRED = 'NOT_REQUIRED', 'Geen budgetcontrole vereist'
        PENDING = 'PENDING', 'Wacht op gemeentelijke financiële validatie'
        APPROVED = 'APPROVED', 'Doorstroom financieel akkoord'
        REJECTED = 'REJECTED', 'Wijs financieel af'
        NEEDS_INFO = 'NEEDS_INFO', 'Vraag onderbouwing op'
        DEFERRED = 'DEFERRED', 'Besluit uitgesteld'

    class ProviderResponseStatus(models.TextChoices):
        PENDING = 'PENDING', 'Nog niet vastgelegd'
        ACCEPTED = 'ACCEPTED', 'Geaccepteerd'
        REJECTED = 'REJECTED', 'Afgewezen'
        NEEDS_INFO = 'NEEDS_INFO', 'Aanvullende info nodig'
        WAITLIST = 'WAITLIST', 'Wachtlijst'
        NO_CAPACITY = 'NO_CAPACITY', 'Geen capaciteit'

    # Backward-compatible aliases used by older tests/code paths.
    ProviderResponseStatus.DECLINED = ProviderResponseStatus.REJECTED
    ProviderResponseStatus.NO_RESPONSE = ProviderResponseStatus.PENDING

    class PlacementQualityStatus(models.TextChoices):
        PENDING = 'PENDING', 'Nog niet vastgelegd'
        GOOD_FIT = 'GOOD_FIT', 'Goede plaatsing'
        AT_RISK = 'AT_RISK', 'Risico op uitval'
        BROKEN_DOWN = 'BROKEN_DOWN', 'Plaatsing vastgelopen'

    # Schema-compatibility fields; DB columns retained until a rename migration is applied.
    mark_text = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    goods_services = models.TextField(blank=True)
    filing_basis = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    client = models.ForeignKey('contracts.Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='trademark_requests')
    matter = models.ForeignKey('contracts.CareConfiguration', on_delete=models.SET_NULL, null=True, blank=True, related_name='trademark_requests')

    # Care indication flow fields
    due_diligence_process = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='indications',
        verbose_name='Casus'
    )
    proposed_provider = models.ForeignKey(
        'contracts.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='proposed_indications',
        verbose_name='Voorgestelde aanbieder'
    )
    selected_provider = models.ForeignKey(
        'contracts.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='selected_indications',
        verbose_name='Geselecteerde aanbieder'
    )
    care_form = models.CharField(
        max_length=32,
        choices=CareForm.choices,
        blank=True,
        verbose_name='Zorgvorm'
    )
    budget_review_status = models.CharField(
        max_length=20,
        choices=BudgetReviewStatus.choices,
        default=BudgetReviewStatus.NOT_REQUIRED,
        verbose_name='Budgetbeoordeling',
    )
    budget_review_note = models.TextField(blank=True, verbose_name='Toelichting budgetbesluit')
    budget_review_decided_at = models.DateTimeField(null=True, blank=True, verbose_name='Budgetbesluit op')
    budget_review_decided_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='budget_reviews_decided',
        verbose_name='Budgetbesluit door',
    )
    start_date = models.DateField(null=True, blank=True, verbose_name='Startdatum')
    duration_weeks = models.PositiveIntegerField(null=True, blank=True, verbose_name='Duur (weken, optioneel)')
    decision_notes = models.TextField(blank=True, verbose_name='Besluitnotities')
    provider_response_status = models.CharField(
        max_length=20,
        choices=ProviderResponseStatus.choices,
        default=ProviderResponseStatus.PENDING,
        verbose_name='Reactie aanbieder',
    )
    provider_response_reason_code = models.CharField(
        max_length=30,
        choices=OutcomeReasonCode.choices,
        default=OutcomeReasonCode.NONE,
        verbose_name='Redencode reactie aanbieder',
    )
    provider_response_notes = models.TextField(blank=True, verbose_name='Notities reactie aanbieder')
    provider_response_recorded_at = models.DateTimeField(null=True, blank=True, verbose_name='Reactie vastgelegd op')
    provider_response_recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_provider_responses',
        verbose_name='Reactie vastgelegd door',
    )
    provider_response_requested_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Aanvraag verstuurd op',
    )
    provider_response_deadline_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Reactiedeadline',
    )
    provider_response_last_reminder_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Laatste herinnering providerreactie',
    )
    placement_quality_status = models.CharField(
        max_length=20,
        choices=PlacementQualityStatus.choices,
        default=PlacementQualityStatus.PENDING,
        verbose_name='Plaatsingskwaliteit',
    )
    placement_quality_reason_code = models.CharField(
        max_length=30,
        default='NONE',
        verbose_name='Redencode plaatsingskwaliteit',
    )
    placement_quality_notes = models.TextField(blank=True, verbose_name='Notities plaatsingskwaliteit')
    placement_quality_recorded_at = models.DateTimeField(null=True, blank=True, verbose_name='Plaatsingskwaliteit vastgelegd op')
    placement_quality_recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_placement_quality_updates',
        verbose_name='Plaatsingskwaliteit vastgelegd door',
    )

    # Set to True once beschikbare_capaciteit has been decremented on the linked
    # CapaciteitRecord.  Guards against double-decrement on repeated confirms.
    capacity_committed = models.BooleanField(
        default=False,
        verbose_name='Capaciteit gecommitteerd',
        help_text='True nadat plaatsingsbevestiging capaciteit heeft afgetrokken.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PlacementRequestManager()

    def __str__(self):
        if self.intake:
            return f'Indicatie: {self.intake.title}'
        return f'Indicatie #{self.pk}'

    @property
    def intake(self):
        return self.due_diligence_process

    @intake.setter
    def intake(self, value):
        self.due_diligence_process = value

    def get_linked_assessment(self):
        intake = self.intake
        if intake is None:
            return None
        try:
            return intake.case_assessment
        except CaseAssessment.DoesNotExist:
            return None

    def can_transition_to_status(self, target_status):
        target_status = str(target_status or '').strip().upper()
        intake = self.intake
        assessment = self.get_linked_assessment()

        # Import here to avoid circular import
        from contracts.models.intake import CaseIntakeProcess

        if intake and intake.status == CaseIntakeProcess.ProcessStatus.ARCHIVED:
            return False, 'Casus is gearchiveerd.'

        if target_status == self.Status.IN_REVIEW:
            if not (self.selected_provider_id or self.proposed_provider_id):
                return False, 'Een aanbieder moet eerst geselecteerd zijn.'
            if intake and intake.status not in {
                CaseIntakeProcess.ProcessStatus.MATCHING,
                CaseIntakeProcess.ProcessStatus.DECISION,
            }:
                return False, 'Casus moet eerst in matching staan.'
            if assessment is None:
                return False, 'Beoordeling ontbreekt.'
            if assessment.assessment_status != CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING:
                return False, 'Beoordeling moet gereed zijn voor matching.'
            if not assessment.matching_ready:
                return False, 'Beoordeling moet eerst gereed zijn voor matching.'
            return True, ''

        if target_status == self.Status.APPROVED:
            if not self.selected_provider_id:
                return False, 'Een bevestigde plaatsing vereist een geselecteerde aanbieder.'
            if self.provider_response_status != self.ProviderResponseStatus.ACCEPTED:
                return False, 'Plaatsing kan pas worden bevestigd na acceptatie door de aanbieder.'
            from contracts.care_lifecycle_v12 import placement_budget_blocks_confirmation

            blocked, reason = placement_budget_blocks_confirmation(self)
            if blocked:
                return False, reason
            return True, ''

        if target_status == self.Status.REJECTED:
            if self.provider_response_status == self.ProviderResponseStatus.ACCEPTED:
                return False, 'Een geaccepteerde plaatsing kan niet als afgewezen worden gemarkeerd.'
            return True, ''

        if target_status == self.Status.NEEDS_INFO:
            if self.provider_response_status == self.ProviderResponseStatus.ACCEPTED:
                return False, 'Aanvullende informatie is niet nodig na acceptatie.'
            return True, ''

        return True, ''


class CaseCareEvaluation(models.Model):
    """Evaluatie in actieve zorg — planning, uitkomst en vervolg (gemeente eigenaar)."""

    class Status(models.TextChoices):
        UPCOMING = 'UPCOMING', 'Evaluatie gepland'
        OVERDUE = 'OVERDUE', 'Evaluatie achterstallig'
        COMPLETED = 'COMPLETED', 'Evaluatie afgerond'

    class Outcome(models.TextChoices):
        CONTINUE = 'CONTINUE', 'Voortzetten'
        TAPER = 'TAPER', 'Afbouwen'
        SCALE_UP = 'SCALE_UP', 'Opschalen'
        PREPARE_TRANSITION = 'PREPARE_TRANSITION', 'Doorstroom voorbereiden'
        CLOSE = 'CLOSE', 'Sluiten'

    due_diligence_process = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.CASCADE,
        related_name='care_evaluations',
        verbose_name='Casus',
    )
    due_date = models.DateField(verbose_name='Datum evaluatie')
    attendees = models.JSONField(default=list, blank=True, verbose_name='Aanwezigen')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPCOMING, verbose_name='Status')
    outcome = models.CharField(max_length=40, choices=Outcome.choices, blank=True, verbose_name='Uitkomst')
    follow_up_actions = models.TextField(blank=True, verbose_name='Vervolgacties')
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_care_evaluations',
        verbose_name='Laatst vastgelegd door',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', 'id']
        verbose_name = 'Zorgevaluatie'
        verbose_name_plural = 'Zorgevaluaties'

    def __str__(self):
        return f'Evaluatie {self.due_date} ({self.get_status_display()})'


class ProviderCareTransitionRequest(models.Model):
    """Aanbieder vraagt doorstroom/wijziging; gemeente beslist financieel (geen directe budgetmutatie)."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'In behandeling'
        WITHDRAWN = 'WITHDRAWN', 'Ingetrokken'
        CLOSED = 'CLOSED', 'Afgehandeld'

    class FinancialValidationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Wacht op financiële validatie'
        APPROVED = 'APPROVED', 'Doorstroom financieel akkoord'
        REJECTED = 'REJECTED', 'Wijs financieel af'
        NEEDS_INFO = 'NEEDS_INFO', 'Vraag onderbouwing op'
        DEFERRED = 'DEFERRED', 'Besluit uitgesteld'

    due_diligence_process = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.CASCADE,
        related_name='provider_transition_requests',
        verbose_name='Casus',
    )
    placement_request = models.ForeignKey(
        'contracts.PlacementRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transition_requests',
        verbose_name='Plaatsing',
    )
    proposed_care_form = models.CharField(max_length=32, verbose_name='Voorgestelde zorgvorm')
    reason = models.TextField(verbose_name='Reden')
    urgency = models.CharField(max_length=10, default='MEDIUM', verbose_name='Urgentie')
    estimated_financial_impact = models.TextField(blank=True, verbose_name='Geschatte financiële impact')
    requested_start_date = models.DateField(null=True, blank=True, verbose_name='Gewenste ingangsdatum')
    supporting_explanation = models.TextField(blank=True, verbose_name='Onderbouwing')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name='Verzoekstatus')
    financial_validation_status = models.CharField(
        max_length=20,
        choices=FinancialValidationStatus.choices,
        default=FinancialValidationStatus.PENDING,
        verbose_name='Financiële validatie',
    )
    financial_validation_note = models.TextField(blank=True, verbose_name='Toelichting gemeente')
    financial_validation_at = models.DateTimeField(null=True, blank=True, verbose_name='Financiële beslissing op')
    financial_validation_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_transition_requests',
        verbose_name='Financiële beslissing door',
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='submitted_transition_requests',
        verbose_name='Ingediend door',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Doorstroomverzoek aanbieder'
        verbose_name_plural = 'Doorstroomverzoeken aanbieder'

    def __str__(self):
        return f'Doorstroom #{self.pk} casus {self.due_diligence_process_id}'
