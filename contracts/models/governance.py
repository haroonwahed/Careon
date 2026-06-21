from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator

from contracts.models.care_case import AuditLog, CareCase
from contracts.models.client import CareConfiguration
from contracts.tenant_scoped import apply_tenant_scope

User = get_user_model()


class SystemPolicyConfig(models.Model):
    class Scope(models.TextChoices):
        GLOBAL = 'global', 'Global'
        MUNICIPALITY = 'municipality', 'Municipality'

    key = models.CharField(max_length=120)
    value = models.JSONField(null=True, blank=True)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.GLOBAL)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['key', 'scope']
        unique_together = [('key', 'scope')]
        indexes = [
            models.Index(fields=['key', 'scope', 'active']),
        ]

    def __str__(self):
        return f'{self.key} ({self.scope})'


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        DEADLINE = 'DEADLINE', 'Deadline herinnering'
        TASK = 'TASK', 'Taaktoewijzing'
        CONTRACT = 'CONTRACT', 'Casusupdate'
        APPROVAL = 'APPROVAL', 'Indicatieverzoek'
        SYSTEM = 'SYSTEM', 'Systeem'
        BILLING = 'BILLING', 'Capaciteitsbudget'

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices)
    title = models.CharField(max_length=300)
    message = models.TextField()
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} -> {self.recipient.username}'


class GovernanceLogImmutableError(Exception):
    """Raised when attempting to mutate or delete an immutable governance record.

    CaseDecisionLog rows are append-only by design. This exception is raised
    at the ORM layer when an update or delete is attempted.

    Limitation (pilot): raw SQL or direct DB access bypasses this guard.
    Full DB-level immutability would require database triggers or a dedicated
    append-only audit store; that is out of scope for the current pilot phase.
    """


class _ImmutableQuerySet(models.QuerySet):
    """QuerySet that blocks bulk mutations on governance records.

    Applies to CaseDecisionLog only. Prevents accidental bulk .update()
    or .delete() calls from corrupting the governance audit trail.
    """
    _GUARD = (
        "CaseDecisionLog is append-only: bulk update() and delete() are "
        "not permitted via the ORM. Use create() to append new events only."
    )

    def update(self, **kwargs):  # type: ignore[override]
        raise GovernanceLogImmutableError(self._GUARD)

    def delete(self):  # type: ignore[override]
        raise GovernanceLogImmutableError(self._GUARD)


class _CaseDecisionLogManager(models.Manager):
    def get_queryset(self):
        return _ImmutableQuerySet(self.model, using=self._db)


class CaseDecisionLog(models.Model):
    class ActorKind(models.TextChoices):
        SYSTEM = 'system', 'System'
        USER = 'user', 'User'
        SERVICE = 'service', 'Service'

    class EventType(models.TextChoices):
        MATCH_RECOMMENDED = 'MATCH_RECOMMENDED', 'Match recommended'
        PROVIDER_SELECTED = 'PROVIDER_SELECTED', 'Provider selected'
        RESEND_TRIGGERED = 'RESEND_TRIGGERED', 'Resend triggered'
        PROVIDE_MISSING_INFO = 'PROVIDE_MISSING_INFO', 'Missing info provided'
        REMATCH_TRIGGERED = 'REMATCH_TRIGGERED', 'Rematch triggered'
        CONTINUE_WAITING = 'CONTINUE_WAITING', 'Continue waiting'
        SLA_ESCALATION = 'SLA_ESCALATION', 'SLA state transition'
        CASE_COMMUNICATION = 'CASE_COMMUNICATION', 'Case communication'
        STATE_TRANSITION = 'STATE_TRANSITION', 'Workflow state transition'
        GEMEENTE_VALIDATION = 'GEMEENTE_VALIDATION', 'Gemeente validatie matching'
        BUDGET_DECISION = 'BUDGET_DECISION', 'Budgetbesluit gemeente'
        EVALUATION_OUTCOME = 'EVALUATION_OUTCOME', 'Evaluatie-uitkomst'
        TRANSITION_REQUEST = 'TRANSITION_REQUEST', 'Doorstroomverzoek'
        FINANCIAL_VALIDATION = 'FINANCIAL_VALIDATION', 'Financiële validatie doorstroom'

    # FK to the live case record. SET_NULL so governance evidence is not
    # destroyed if the operational case record is deleted or archived.
    # The stable identifier is always preserved in `case_id_snapshot`.
    case = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decision_logs',
        db_column='case_id',
    )
    # Immutable copy of the case PK at the time of the event. Outlives the FK.
    case_id_snapshot = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Stable case identifier preserved for audit even after case deletion.',
    )
    placement = models.ForeignKey(
        'contracts.PlacementRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decision_logs',
        db_column='placement_id',
    )
    # Immutable copy of the placement PK at the time of the event.
    placement_id_snapshot = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Stable placement identifier preserved for audit even after placement deletion.',
    )
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    system_recommendation = models.JSONField(null=True, blank=True)
    recommendation_context = models.JSONField(default=dict, blank=True)
    user_action = models.CharField(max_length=120, blank=True)
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='case_decision_logs',
    )
    actor_kind = models.CharField(
        max_length=20,
        choices=ActorKind.choices,
        default=ActorKind.SYSTEM,
    )
    action_source = models.CharField(max_length=40, default='system')
    provider = models.ForeignKey(
        'contracts.Client',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='case_decision_logs',
        db_column='provider_id',
    )
    sla_state = models.CharField(max_length=40, blank=True)
    adaptive_flags = models.JSONField(default=dict, blank=True)
    override_type = models.CharField(max_length=40, blank=True)
    recommended_value = models.JSONField(null=True, blank=True)
    actual_value = models.JSONField(null=True, blank=True)
    optional_reason = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    objects = _CaseDecisionLogManager()

    class Meta:
        db_table = 'contracts_casedecisionlog'
        ordering = ['timestamp', 'id']
        indexes = [
            models.Index(fields=['case', 'timestamp']),
            models.Index(fields=['event_type', 'timestamp']),
            # Indexed directly so replay works efficiently even when the FK is NULL.
            models.Index(fields=['case_id_snapshot'], name='cdl_case_snapshot_idx'),
        ]

    def save(self, *args, **kwargs):
        # Enforce append-only: existing rows must never be mutated.
        if self.pk is not None:
            raise GovernanceLogImmutableError(
                "CaseDecisionLog rows are immutable. "
                "Existing rows cannot be updated — use create() to append a new event."
            )
        # Auto-populate stable snapshots from FK values on first insert.
        if self.case_id is not None and not self.case_id_snapshot:
            self.case_id_snapshot = self.case_id
        if self.placement_id is not None and not self.placement_id_snapshot:
            self.placement_id_snapshot = self.placement_id
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # type: ignore[override]
        raise GovernanceLogImmutableError(
            "CaseDecisionLog rows are immutable. "
            "Individual deletion is not permitted. "
            "Governance records must be retained for audit traceability."
        )

    def __str__(self):
        case_ref = self.case_id_snapshot or self.case_id or '?'
        return f'{case_ref} {self.event_type} @{self.timestamp.isoformat()}'


class _CaseTimelineEventQuerySet(models.QuerySet):
    """Operational timeline rows are append-only — bulk updates/deletes are forbidden."""

    _GUARD = (
        "CaseTimelineEvent is append-only operational history. "
        "Do not update or delete rows via the ORM in application code."
    )

    def delete(self):  # type: ignore[override]
        raise GovernanceLogImmutableError(self._GUARD)

    def update(self, **kwargs):  # type: ignore[override]
        raise GovernanceLogImmutableError(self._GUARD)


class _CaseTimelineEventManager(models.Manager):
    def get_queryset(self):
        return apply_tenant_scope(_CaseTimelineEventQuerySet(self.model, using=self._db))

    def unscoped(self):
        return _CaseTimelineEventQuerySet(self.model, using=self._db)


class CaseTimelineEvent(models.Model):
    """
    Append-only operational timeline for a CareCase (not mutable case state).

    Records workflow-relevant milestones for audit/replay orientation.
    """

    class EventType(models.TextChoices):
        GEMEENTE_VALIDATION_APPROVED = (
            'GEMEENTE_VALIDATION_APPROVED',
            'Gemeente validatie afgerond',
        )
        PLACEMENT_REQUEST_CREATED = (
            'PLACEMENT_REQUEST_CREATED',
            'Plaatsingsaanvraag vastgelegd',
        )
        PROVIDER_REVIEW_OPENED = (
            'PROVIDER_REVIEW_OPENED',
            'Aanbiederbeoordeling geopend',
        )
        WORKFLOW_BLOCKED = 'WORKFLOW_BLOCKED', 'Workflow geblokkeerd'
        WORKFLOW_ESCALATED = 'WORKFLOW_ESCALATED', 'Workflow escalatie'

    organization = models.ForeignKey(
        'contracts.Organization',
        on_delete=models.CASCADE,
        related_name='case_timeline_events',
    )
    care_case = models.ForeignKey(
        'contracts.CareCase',
        on_delete=models.CASCADE,
        related_name='timeline_events',
    )
    event_type = models.CharField(max_length=80, choices=EventType.choices)
    occurred_at = models.DateTimeField(db_index=True)
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='case_timeline_events',
    )
    actor_role = models.CharField(max_length=40, blank=True)
    source = models.CharField(
        max_length=120,
        blank=True,
        help_text='Origin surface (e.g. matching_action_api).',
    )
    request_id = models.CharField(max_length=128, blank=True)
    release_id = models.CharField(max_length=120, blank=True)
    build_sha = models.CharField(max_length=64, blank=True)
    from_phase = models.CharField(max_length=40, blank=True)
    to_phase = models.CharField(max_length=40, blank=True)
    reason_code = models.CharField(max_length=80, blank=True)
    summary = models.TextField(blank=True)
    decision_log = models.ForeignKey(
        CaseDecisionLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='timeline_events',
    )
    audit_log = models.ForeignKey(
        AuditLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='case_timeline_events',
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = _CaseTimelineEventManager()

    class Meta:
        db_table = 'contracts_casetimelineevent'
        ordering = ['occurred_at', 'id']
        indexes = [
            models.Index(fields=['care_case', 'occurred_at']),
            models.Index(fields=['organization', 'occurred_at']),
        ]

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise GovernanceLogImmutableError(
                'CaseTimelineEvent rows are immutable — append new rows only.'
            )
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):  # type: ignore[override]
        raise GovernanceLogImmutableError(
            'CaseTimelineEvent rows cannot be deleted via the ORM.'
        )


class CareTaskQuerySet(models.QuerySet):
    """Custom queryset for CareTask with organization-scoping support."""
    def for_organization(self, organization):
        """Filter care tasks that belong to a specific organization via case/configuration relations."""
        if not organization:
            return self.none()
        from django.db.models import Q
        return self.filter(
            Q(case_record__organization=organization) | Q(configuration__organization=organization)
        )


class CareTaskManager(models.Manager):
    """Custom manager for CareTask."""
    def get_queryset(self):
        return apply_tenant_scope(CareTaskQuerySet(self.model, using=self._db))

    def unscoped(self):
        return CareTaskQuerySet(self.model, using=self._db)

    def for_organization(self, organization):
        """Filter care tasks that belong to a specific organization."""
        return self.unscoped().for_organization(organization)


class CareTask(models.Model):
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    title = models.CharField(max_length=200)
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    case_record = models.ForeignKey(CareCase, on_delete=models.CASCADE, null=True, blank=True, db_column='case_record_id')
    configuration = models.ForeignKey(CareConfiguration, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks', db_column='configuration_id')
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CareTaskManager()

    class Meta:
        db_table = 'contracts_caretask'

    def __str__(self):
        return self.title

    @property
    def contract(self):
        return self.case_record

    @contract.setter
    def contract(self, value):
        self.case_record = value

    @property
    def matter(self):
        return self.configuration

    @matter.setter
    def matter(self, value):
        self.configuration = value


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class CareSignalQuerySet(models.QuerySet):
    """Custom queryset for CareSignal with organization-scoping support."""
    def for_organization(self, organization):
        """Filter signals that belong to a specific organization via case/configuration relations."""
        if not organization:
            return self.none()
        from django.db.models import Q
        return self.filter(
            Q(due_diligence_process__organization=organization)
            | Q(case_record__organization=organization)
            | Q(configuration__organization=organization)
        )


class CareSignalManager(models.Manager):
    """Custom manager for CareSignal."""
    def get_queryset(self):
        return apply_tenant_scope(CareSignalQuerySet(self.model, using=self._db))

    def unscoped(self):
        return CareSignalQuerySet(self.model, using=self._db)

    def for_organization(self, organization):
        """Filter care signals that belong to a specific organization."""
        return self.unscoped().for_organization(organization)


class CareSignal(models.Model):
    class SignalType(models.TextChoices):
        SAFETY = 'SAFETY', 'Veiligheid'
        ESCALATION = 'ESCALATION', 'Escalatie'
        NO_MATCH = 'NO_MATCH', 'Geen match'
        WAIT_EXCEEDED = 'WAIT_EXCEEDED', 'Wachttijd overschreden'
        CAPACITY_ISSUE = 'CAPACITY_ISSUE', 'Capaciteit probleem'
        INTAKE_INCOMPLETE = 'INTAKE_INCOMPLETE', 'Intake incompleet'
        DROPOUT_RISK = 'DROPOUT_RISK', 'Uitval risico'

    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Middel'
        HIGH = 'HIGH', 'Hoog'
        CRITICAL = 'CRITICAL', 'Kritisch'

    class SignalStatus(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        IN_PROGRESS = 'IN_PROGRESS', 'In opvolging'
        RESOLVED = 'RESOLVED', 'Afgerond'

    title = models.CharField(max_length=200, blank=True, verbose_name='Titel (optioneel)')
    due_diligence_process = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='signals',
        verbose_name='Casus'
    )
    signal_type = models.CharField(max_length=30, choices=SignalType.choices, default=SignalType.SAFETY, verbose_name='Type signaal')
    description = models.TextField(verbose_name='Omschrijving')
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices, default=RiskLevel.MEDIUM, verbose_name='Urgentie')
    status = models.CharField(max_length=20, choices=SignalStatus.choices, default=SignalStatus.OPEN, verbose_name='Status')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_signals', verbose_name='Verantwoordelijke')
    follow_up = models.TextField(blank=True, verbose_name='Opvolging')

    # Canonical relation names mapped to existing compatibility columns.
    case_record = models.ForeignKey(CareCase, on_delete=models.CASCADE, null=True, blank=True, db_column='case_record_id')
    configuration = models.ForeignKey(CareConfiguration, on_delete=models.CASCADE, null=True, blank=True, related_name='risks', db_column='configuration_id')
    mitigation_plan = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CareSignalManager()

    class Meta:
        db_table = 'contracts_caresignal'
        verbose_name = 'Signaal'
        verbose_name_plural = 'Signalen'
        ordering = ['-created_at', '-id']

    def __str__(self):
        if self.title:
            return self.title
        if self.intake:
            return f'{self.get_signal_type_display()} - {self.intake.title}'
        return self.get_signal_type_display()

    @property
    def intake(self):
        return self.due_diligence_process

    @intake.setter
    def intake(self, value):
        self.due_diligence_process = value

    @property
    def contract(self):
        return self.case_record

    @contract.setter
    def contract(self, value):
        self.case_record = value

    @property
    def matter(self):
        return self.configuration

    @matter.setter
    def matter(self, value):
        self.configuration = value


class DecisionQualityReview(models.Model):
    """Pilot-focused decision quality evaluation."""

    class DecisionQuality(models.TextChoices):
        """Assessment of decision quality."""
        SYSTEM_CORRECT = 'SYSTEM_CORRECT', 'System recommendation was correct'
        USER_CORRECT = 'USER_CORRECT', 'User override was correct'
        BOTH_ACCEPTABLE = 'BOTH_ACCEPTABLE', 'Both paths acceptable'
        BOTH_SUBOPTIMAL = 'BOTH_SUBOPTIMAL', 'Both paths had issues'

    class OverrideType(models.TextChoices):
        """Classification of override pattern."""
        PROVIDER_SELECTION = 'provider_selection', 'Provider selection override'
        ACTION_OVERRIDE = 'action_override', 'Action override (resend/rematch/wait)'

    class PrimaryReason(models.TextChoices):
        """Root cause or decision factor."""
        MISSING_DATA = 'missing_data', 'Missing or incomplete data'
        PROVIDER_MISMATCH = 'provider_mismatch', 'Provider fit mismatch'
        CAPACITY_ISSUE = 'capacity_issue', 'Capacity or availability issue'
        SLA_TIMING = 'sla_timing', 'SLA timing concern'
        EXPLANATION_UNCLEAR = 'explanation_unclear', 'System explanation unclear'
        EXTERNAL_CONSTRAINT = 'external_constraint', 'External constraint or policy'
        OTHER = 'other', 'Other reason'

    # Core relationships
    case = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.PROTECT,
        related_name='quality_reviews',
        help_text='Case being reviewed',
    )
    placement = models.ForeignKey(
        'contracts.PlacementRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quality_reviews',
        help_text='Placement context (if applicable)',
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decision_quality_reviews',
        help_text='Person who performed the review',
    )

    # Decision snapshots (immutable)
    system_recommendation = models.JSONField(
        null=True,
        blank=True,
        help_text='Snapshot of system recommendation from decision log',
    )
    actual_decision = models.JSONField(
        null=True,
        blank=True,
        help_text='Snapshot of actual user action/system decision taken',
    )

    # Outcome assessment
    outcome = models.TextField(
        blank=True,
        help_text='What actually happened (placement result, provider response, etc.)',
    )
    decision_quality = models.CharField(
        max_length=20,
        choices=DecisionQuality.choices,
        default=DecisionQuality.BOTH_ACCEPTABLE,
        help_text='Quality assessment of system vs user decision',
    )

    # Override tracking
    override_present = models.BooleanField(
        default=False,
        help_text='Was there a user override of system recommendation?',
    )
    override_type = models.CharField(
        max_length=30,
        choices=OverrideType.choices,
        blank=True,
        help_text='Type of override if override_present is True',
    )

    # Root cause / reasoning
    primary_reason = models.CharField(
        max_length=30,
        choices=PrimaryReason.choices,
        default=PrimaryReason.OTHER,
        help_text='Primary reason for the quality assessment',
    )
    notes = models.TextField(
        blank=True,
        help_text='Additional context or observations from the review',
    )

    # Metadata
    review_timestamp = models.DateTimeField(auto_now_add=False, help_text='When the review was performed')
    created_at = models.DateTimeField(auto_now_add=True, help_text='When this record was created')

    class Meta:
        db_table = 'contracts_decisionqualityreview'
        ordering = ['-review_timestamp', '-created_at']
        indexes = [
            models.Index(fields=['case', 'review_timestamp']),
            models.Index(fields=['decision_quality', 'review_timestamp']),
            models.Index(fields=['override_present', 'review_timestamp']),
            models.Index(fields=['primary_reason', 'review_timestamp']),
        ]
        verbose_name = 'Decision Quality Review'
        verbose_name_plural = 'Decision Quality Reviews'

    def __str__(self):
        return f'Quality review for case {self.case_id} ({self.get_decision_quality_display()})'


class DecisionQualityWeeklyReviewMark(models.Model):
    """Pilot-scoped marker used to organize weekly decision-quality reviews."""

    case = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.CASCADE,
        related_name='decision_quality_review_marks',
    )
    placement = models.ForeignKey(
        'contracts.PlacementRequest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decision_quality_review_marks',
    )
    year = models.PositiveIntegerField()
    week = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    reason = models.CharField(max_length=200, blank=True)
    marked_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='decision_quality_review_marks',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'contracts_decisionqualityweeklyreviewmark'
        ordering = ['-year', '-week', '-created_at']
        unique_together = [('case', 'year', 'week')]
        indexes = [
            models.Index(fields=['year', 'week', 'created_at']),
            models.Index(fields=['case', 'year', 'week']),
        ]

    def __str__(self):
        return f'Weekly review mark for case {self.case_id} (Y{self.year}-W{self.week})'
