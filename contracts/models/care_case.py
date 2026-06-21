from django.db import models
from django.contrib.auth import get_user_model
from datetime import date
import os

from contracts.tenant_scoped import TenantScopedManager, apply_tenant_scope

User = get_user_model()


class CareCase(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Concept'
        PENDING = 'PENDING', 'Wacht op actie'
        IN_REVIEW = 'IN_REVIEW', 'In beoordeling'
        APPROVED = 'APPROVED', 'Goedgekeurd'
        ACTIVE = 'ACTIVE', 'Actief'
        EXPIRED = 'EXPIRED', 'Verlopen'
        TERMINATED = 'TERMINATED', 'Beëindigd'
        COMPLETED = 'COMPLETED', 'Afgerond'
        CANCELLED = 'CANCELLED', 'Geannuleerd'

    class CasePhase(models.TextChoices):
        INTAKE = 'intake', 'Intake'
        MATCHING = 'matching', 'Matching'
        PROVIDER_BEOORDELING = 'provider_beoordeling', 'Aanbiederbeoordeling'
        PLAATSING = 'plaatsing', 'Plaatsing'
        ACTIEF = 'actief', 'Actief'
        AFGEROND = 'afgerond', 'Afgerond'

    class ContractType(models.TextChoices):
        NDA = 'NDA', 'Intakeafspraak'
        MSA = 'MSA', 'Regieafspraak'
        SOW = 'SOW', 'Uitvoeringsafspraak'
        EMPLOYMENT = 'EMPLOYMENT', 'Personele inzet'
        LEASE = 'LEASE', 'Capaciteitsafspraak'
        LICENSE = 'LICENSE', 'Toegangsafspraak'
        VENDOR = 'VENDOR', 'Aanbiedersafspraak'
        PARTNERSHIP = 'PARTNERSHIP', 'Samenwerkingsafspraak'
        SETTLEMENT = 'SETTLEMENT', 'Afstemmingsafspraak'
        AMENDMENT = 'AMENDMENT', 'Wijzigingsafspraak'
        OTHER = 'OTHER', 'Other'

    class RiskLevel(models.TextChoices):
        GEEN_BIJZONDER_RISICO = 'GEEN_BIJZONDER_RISICO', 'Geen bijzonder risico'
        VERHOOGD_RISICO = 'VERHOOGD_RISICO', 'Verhoogd risico'
        ACUUT_RISICO = 'ACUUT_RISICO', 'Acuut risico'

    class Currency(models.TextChoices):
        EUR = 'EUR', 'EUR (€)'
        OTHER = 'OTHER', 'Other'

    organization = models.ForeignKey('contracts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='contracts')
    title = models.CharField(max_length=200)
    source_system = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text='Optional upstream system identifier for imported cases (empty for native casussen).',
    )
    source_system_id = models.IntegerField(
        null=True,
        blank=True,
        default=0,
        help_text='Optional legacy upstream system key (production Postgres drift).',
    )
    source_system_url = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text='Optional legacy upstream URL (production Postgres drift).',
    )
    contract_type = models.CharField(max_length=20, choices=ContractType.choices, default=ContractType.OTHER)
    content = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    preferred_provider = models.CharField(max_length=200, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=5, choices=Currency.choices, default=Currency.EUR)
    policy_framework = models.CharField(max_length=200, blank=True, help_text='Kader of beleidsgrondslag')
    service_region = models.CharField(max_length=200, blank=True, help_text='Regio of toepassingsgebied')
    language = models.CharField(max_length=50, default='English', blank=True)
    risk_level = models.CharField(max_length=25, choices=RiskLevel.choices, default=RiskLevel.GEEN_BIJZONDER_RISICO)
    data_transfer_flag = models.BooleanField(default=False, help_text='Involves cross-border data transfer (EU/US)')
    dpa_attached = models.BooleanField(default=False, help_text='Data Processing Agreement attached')
    scc_attached = models.BooleanField(default=False, help_text='Standard Contractual Clauses attached')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    auto_renew = models.BooleanField(default=False)
    notice_period_days = models.PositiveIntegerField(null=True, blank=True)
    termination_notice_date = models.DateField(null=True, blank=True)
    lifecycle_stage = models.CharField(max_length=20, choices=[
        ('DRAFTING', 'Voorbereiding'),
        ('INTERNAL_REVIEW', 'Interne beoordeling'),
        ('NEGOTIATION', 'Afstemming'),
        ('APPROVAL', 'Indicatie'),
        ('SIGNATURE', 'Bevestiging'),
        ('EXECUTED', 'Gestart'),
        ('OBLIGATION_TRACKING', 'Voortgangsbewaking'),
        ('RENEWAL', 'Herbeoordeling / afronding'),
        ('ARCHIVED', 'Gearchiveerd'),
    ], default='DRAFTING')
    case_phase = models.CharField(max_length=20, choices=CasePhase.choices, default=CasePhase.INTAKE)
    phase_entered_at = models.DateTimeField(null=True, blank=True, help_text='Timestamp when the case entered the current phase')
    client = models.ForeignKey('contracts.Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    matter = models.ForeignKey('contracts.CareConfiguration', on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_contracts')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        db_table = 'contracts_care_case'

    def __str__(self):
        return self.title

    @property
    def configuration(self):
        return self.matter

    @configuration.setter
    def configuration(self, value):
        self.matter = value

    @property
    def is_expiring_soon(self):
        if self.end_date and self.status == 'ACTIVE':
            days_until = (self.end_date - date.today()).days
            return 0 <= days_until <= 30
        return False

    @property
    def days_until_expiry(self):
        if self.end_date:
            return (self.end_date - date.today()).days
        return None


def _document_upload_path(instance, filename):
    """Local alias for document_upload_path — avoids cross-file import in field default."""
    import uuid as _uuid
    ext = os.path.splitext(filename)[1].lower()
    return f'documents/{_uuid.uuid4().hex}{ext}'


class Document(models.Model):
    class DocType(models.TextChoices):
        CONTRACT = 'CONTRACT', 'Casusdossier'
        AMENDMENT = 'AMENDMENT', 'Wijziging'
        EXHIBIT = 'EXHIBIT', 'Bijlage'
        CORRESPONDENCE = 'CORRESPONDENCE', 'Correspondence'
        MEMO = 'MEMO', 'Memorandum'
        RESEARCH = 'RESEARCH', 'Onderzoeksnotitie'
        TEMPLATE = 'TEMPLATE', 'Template'
        OTHER = 'OTHER', 'Other'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Concept'
        REVIEW = 'REVIEW', 'In beoordeling'
        APPROVED = 'APPROVED', 'Goedgekeurd'
        FINAL = 'FINAL', 'Definitief'
        ARCHIVED = 'ARCHIVED', 'Gearchiveerd'

    organization = models.ForeignKey('contracts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    title = models.CharField(max_length=300)
    document_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.OTHER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=_document_upload_path, blank=True, null=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    version = models.PositiveIntegerField(default=1)
    parent_document = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='versions')
    contract = models.ForeignKey(CareCase, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    matter = models.ForeignKey('contracts.CareConfiguration', on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    client = models.ForeignKey('contracts.Client', on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    tags = models.CharField(max_length=500, blank=True)
    external_handoff_reference = models.CharField(
        max_length=500,
        blank=True,
        default='',
        verbose_name='Externe handoffreferentie',
        help_text='Veilige verwijzing naar een extern systeem of een beveiligde uitwisseling. Geen persoonsgegevens.',
    )
    is_privileged = models.BooleanField(default=False)
    is_confidential = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} (v{self.version})'

    def save(self, *args, **kwargs):
        if self.file:
            self.file_size = self.file.size
            self.mime_type = getattr(self.file, 'content_type', '')
        super().save(*args, **kwargs)

    @property
    def case_record(self):
        return self.contract

    @case_record.setter
    def case_record(self, value):
        self.contract = value

    @property
    def configuration(self):
        return self.matter

    @configuration.setter
    def configuration(self, value):
        self.matter = value

    @property
    def file_extension(self):
        if self.file:
            return os.path.splitext(self.file.name)[1].lower()
        return ''


class TrustAccount(models.Model):
    class CareType(models.TextChoices):
        AMBULANT = 'AMBULANT', 'Ambulant'
        DAGBESTEDING = 'DAGBESTEDING', 'Dagbesteding'
        JEUGDHULP = 'JEUGDHULP', 'Jeugdhulp'
        GGZ = 'GGZ', 'GGZ'
        WLZ = 'WLZ', 'WLZ'
        OVERIG = 'OVERIG', 'Overig'

    provider = models.ForeignKey(
        'contracts.Client',
        on_delete=models.CASCADE,
        related_name='wait_time_entries',
        verbose_name='Aanbieder',
        null=True,
        blank=True,
    )
    region = models.CharField(max_length=120, default='', verbose_name='Regio / gemeente')
    care_type = models.CharField(max_length=20, choices=CareType.choices, default=CareType.AMBULANT, verbose_name='Zorgtype')
    wait_days = models.PositiveIntegerField(default=0, verbose_name='Gemiddelde wachttijd (dagen)')
    open_slots = models.PositiveIntegerField(default=0, verbose_name='Beschikbare plekken')
    waiting_list_size = models.PositiveIntegerField(default=0, verbose_name='Wachtlijst (aantal)')
    notes = models.TextField(blank=True, verbose_name='Toelichting')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Wachttijd'
        verbose_name_plural = 'Wachttijden'
        ordering = ['-updated_at']

    def __str__(self):
        provider_name = self.provider.name if self.provider else 'Onbekende aanbieder'
        return f'{provider_name} - {self.region} ({self.wait_days} dagen)'


class DeadlineQuerySet(models.QuerySet):
    """Custom queryset for Deadline with organization-scoping support."""
    def for_organization(self, organization):
        """Filter tasks that belong to a specific organization via case/configuration relations."""
        if not organization:
            return self.none()
        from django.db.models import Q
        return self.filter(
            Q(due_diligence_process__organization=organization)
            | Q(case_record__organization=organization)
            | Q(configuration__organization=organization)
        )


class DeadlineManager(models.Manager):
    """Custom manager for Deadline."""
    def get_queryset(self):
        return apply_tenant_scope(DeadlineQuerySet(self.model, using=self._db))

    def unscoped(self):
        return DeadlineQuerySet(self.model, using=self._db)

    def for_organization(self, organization):
        """Filter deadlines that belong to a specific organization."""
        return self.unscoped().for_organization(organization)


class Deadline(models.Model):
    class Priority(models.TextChoices):
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Middel'
        HIGH = 'HIGH', 'Hoog'
        URGENT = 'URGENT', 'Urgent'

    class TaskType(models.TextChoices):
        INTAKE_COMPLETE = 'INTAKE_COMPLETE', 'Intake afronden'
        ASSESSMENT_PERFORM = 'ASSESSMENT_PERFORM', 'Beoordeling uitvoeren'
        SELECT_MATCH = 'SELECT_MATCH', 'Match selecteren'
        CONTACT_PROVIDER = 'CONTACT_PROVIDER', 'Aanbieder contacteren'
        CONFIRM_PLACEMENT = 'CONFIRM_PLACEMENT', 'Plaatsing bevestigen'
        EVALUATE = 'EVALUATE', 'Evaluatie uitvoeren'

    class GenerationSource(models.TextChoices):
        MANUAL = 'MANUAL', 'Handmatig'
        INTAKE = 'INTAKE', 'Intake'
        ASSESSMENT = 'ASSESSMENT', 'Beoordeling'
        MATCHING = 'MATCHING', 'Matching'
        PLACEMENT = 'PLACEMENT', 'Plaatsing'

    due_diligence_process = models.ForeignKey(
        'contracts.CaseIntakeProcess',
        on_delete=models.CASCADE,
        related_name='followup_tasks',
        null=True,
        blank=True,
        verbose_name='Casus'
    )
    title = models.CharField(max_length=300, verbose_name='Taak')
    description = models.TextField(blank=True)
    task_type = models.CharField(max_length=30, choices=TaskType.choices, default=TaskType.INTAKE_COMPLETE, verbose_name='Type taak')
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    due_date = models.DateField()
    due_time = models.TimeField(null=True, blank=True)

    # Canonical relation names mapped to existing compatibility columns.
    configuration = models.ForeignKey('contracts.CareConfiguration', on_delete=models.CASCADE, null=True, blank=True, related_name='deadlines', db_column='configuration_id')
    case_record = models.ForeignKey(CareCase, on_delete=models.CASCADE, null=True, blank=True, related_name='deadlines', db_column='case_record_id')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='deadlines')
    auto_generated = models.BooleanField(default=False)
    generation_source = models.CharField(max_length=20, choices=GenerationSource.choices, default=GenerationSource.MANUAL)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_deadlines')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_deadlines')
    created_at = models.DateTimeField(auto_now_add=True)

    objects = DeadlineManager()

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f'Taak: {self.title} (deadline {self.due_date})'

    @property
    def is_overdue(self):
        return not self.is_completed and self.due_date < date.today()

    @property
    def days_remaining(self):
        if self.is_completed:
            return None
        return (self.due_date - date.today()).days

    @property
    def needs_reminder(self):
        if self.is_completed:
            return False
        days = (self.due_date - date.today()).days
        return 0 < days <= 2

    @property
    def intake(self):
        return self.due_diligence_process

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


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = 'CREATE', 'Created'
        UPDATE = 'UPDATE', 'Updated'
        DELETE = 'DELETE', 'Deleted'
        VIEW = 'VIEW', 'Viewed'
        LOGIN = 'LOGIN', 'Logged In'
        LOGOUT = 'LOGOUT', 'Logged Out'
        EXPORT = 'EXPORT', 'Exported'
        APPROVE = 'APPROVE', 'Approved'
        REJECT = 'REJECT', 'Rejected'

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    action = models.CharField(max_length=20, choices=Action.choices)
    model_name = models.CharField(max_length=100)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    object_repr = models.CharField(max_length=300, blank=True)
    changes = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f'{self.user} {self.get_action_display()} {self.model_name} #{self.object_id}'
