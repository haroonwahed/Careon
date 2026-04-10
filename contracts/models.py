from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
from datetime import date
import uuid
import os

User = get_user_model()


def document_upload_path(instance, filename):
    return f'documents/{instance.matter.id if instance.matter else "general"}/{filename}'


class Organization(models.Model):
    name = models.CharField(max_length=200, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class OrganizationMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = 'OWNER', 'Owner'
        ADMIN = 'ADMIN', 'Admin'
        MEMBER = 'MEMBER', 'Member'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organization_memberships')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'user')
        ordering = ['organization__name', 'user__username']

    def __str__(self):
        return f'{self.user.username} @ {self.organization.name} ({self.role})'


class OrganizationInvitation(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REVOKED = 'REVOKED', 'Revoked'
        EXPIRED = 'EXPIRED', 'Expired'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=OrganizationMembership.Role.choices, default=OrganizationMembership.Role.MEMBER)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_organization_invitations')
    invited_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='accepted_organization_invitations')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['email', 'status']),
        ]

    def __str__(self):
        return f'Invite {self.email} to {self.organization.name} ({self.get_status_display()})'


class UserProfile(models.Model):
    class Role(models.TextChoices):
        PARTNER = 'PARTNER', 'Partner'
        SENIOR_ASSOCIATE = 'SENIOR_ASSOCIATE', 'Senior Associate'
        ASSOCIATE = 'ASSOCIATE', 'Associate'
        PARALEGAL = 'PARALEGAL', 'Regiemedewerker'
        LEGAL_ASSISTANT = 'LEGAL_ASSISTANT', 'Zorgassistent'
        ADMIN = 'ADMIN', 'Administrator'
        CLIENT = 'CLIENT', 'Cliënt'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ASSOCIATE)
    phone = models.CharField(max_length=20, blank=True)
    bar_number = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
    hourly_rate = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.get_full_name() or self.user.username} ({self.get_role_display()})'

    @property
    def can_approve(self):
        return self.role in [self.Role.PARTNER, self.Role.SENIOR_ASSOCIATE, self.Role.ADMIN]

    @property
    def is_attorney(self):
        return self.role in [self.Role.PARTNER, self.Role.SENIOR_ASSOCIATE, self.Role.ASSOCIATE]


# ============================================
# CARE-FOCUSED MODELS (INTAKE & ASSESSMENT)
# ============================================

class CareCategoryMain(models.Model):
    """Main care question categories (Hoofdcategorieën Zorgvraag)"""
    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Care Category (Main)'
        verbose_name_plural = 'Care Categories (Main)'

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CareCategorySubcategory(models.Model):
    """Subcategories for care questions (Subcategorieën Zorgvraag)"""
    class Meta:
        ordering = ['order', 'name']
        verbose_name = 'Care Subcategory'
        verbose_name_plural = 'Care Subcategories'

    main_category = models.ForeignKey(CareCategoryMain, on_delete=models.CASCADE, related_name='subcategories')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.main_category.name} → {self.name}'


class RiskFactor(models.Model):
    """Signal factors for client profile"""
    class Meta:
        ordering = ['name']
        verbose_name = 'Signaalfactor'
        verbose_name_plural = 'Signaalfactoren'

    FACTOR_CHOICES = [
        ('DEBT', 'Schulden'),
        ('VIOLENCE', 'Geweld'),
        ('ADDICTION', 'Verslaving'),
        ('MENTAL_HEALTH', 'Psychische problematiek'),
        ('HOMELESSNESS', 'Huisvesting'),
        ('SOCIAL_ISOLATION', 'Sociale isolatie'),
        ('EMPLOYMENT', 'Werkloosheid'),
        ('LEGAL', 'Regelgevingsvragen'),
        ('TRAUMA', 'Trauma'),
        ('OTHER', 'Anderszins'),
    ]

    name = models.CharField(max_length=100, unique=True, choices=FACTOR_CHOICES)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.get_name_display()


class Client(models.Model):
    class ClientType(models.TextChoices):
        INDIVIDUAL = 'INDIVIDUAL', 'Individuele client'
        CORPORATION = 'CORPORATION', 'Aanbiederorganisatie'
        LLC = 'LLC', 'LLC'
        PARTNERSHIP = 'PARTNERSHIP', 'Samenwerkingsverband'
        GOVERNMENT = 'GOVERNMENT', 'Gemeente / overheid'
        NON_PROFIT = 'NON_PROFIT', 'Non-profit'
        OTHER = 'OTHER', 'Other'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        INACTIVE = 'INACTIVE', 'Inactive'
        PROSPECTIVE = 'PROSPECTIVE', 'Prospective'
        FORMER = 'FORMER', 'Former'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='clients')
    name = models.CharField(max_length=200)
    client_type = models.CharField(max_length=20, choices=ClientType.choices, default=ClientType.INDIVIDUAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    zip_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, default='United States')
    tax_id = models.CharField(max_length=50, blank=True)
    website = models.URLField(blank=True)
    industry = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    primary_contact = models.CharField(max_length=200, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=20, blank=True)
    responsible_attorney = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='responsible_clients')
    originating_attorney = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='originated_clients')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_clients')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    @property
    def total_billed(self):
           # Represent active caseload volume as a simple count-backed metric.
        return Decimal(self.contracts.filter(status__in=['DRAFT', 'IN_REVIEW', 'PENDING', 'APPROVED', 'ACTIVE']).count())

    @property
    def outstanding_balance(self):
        # Legacy billing pressure replaced by unresolved placement pressure.
        return Decimal(self.contracts.filter(status__in=['PENDING', 'IN_REVIEW']).count())

    @property
    def active_matters_count(self):
        return self.matters.filter(status='ACTIVE').count()


class ProviderProfile(models.Model):
    """Care provider/aanbieder target groups and capabilities"""
    class Meta:
        verbose_name = 'Provider Profile'
        verbose_name_plural = 'Provider Profiles'

    client = models.OneToOneField(Client, on_delete=models.CASCADE, related_name='provider_profile',
                                  help_text='Link to care provider/aanbieder')
    
    # Target age groups
    target_age_0_4 = models.BooleanField(default=False, verbose_name='Target: 0–4')
    target_age_4_12 = models.BooleanField(default=False, verbose_name='Target: 4–12')
    target_age_12_18 = models.BooleanField(default=False, verbose_name='Target: 12–18')
    target_age_18_plus = models.BooleanField(default=False, verbose_name='Target: 18+')
    
    # Target care categories
    target_care_categories = models.ManyToManyField(CareCategoryMain, blank=True, related_name='provider_profiles',
                                                     verbose_name='Zorgvraagcategorieën')
    
    # Target care forms
    offers_outpatient = models.BooleanField(default=False, verbose_name='Aanbod: Ambulant')
    offers_day_treatment = models.BooleanField(default=False, verbose_name='Aanbod: Dagbehandeling')
    offers_residential = models.BooleanField(default=False, verbose_name='Aanbod: Residentieel')
    offers_crisis = models.BooleanField(default=False, verbose_name='Aanbod: Crisisopvang')
    
    # Complexity levels
    handles_simple = models.BooleanField(default=False, verbose_name='Kan: Enkelvoudig')
    handles_multiple = models.BooleanField(default=False, verbose_name='Kan: Meervoudig')
    handles_severe = models.BooleanField(default=False, verbose_name='Kan: Zwaar')
    
    # Urgency levels
    handles_low_urgency = models.BooleanField(default=False, verbose_name='Kan: Laag')
    handles_medium_urgency = models.BooleanField(default=False, verbose_name='Kan: Middel')
    handles_high_urgency = models.BooleanField(default=False, verbose_name='Kan: Hoog')
    handles_crisis_urgency = models.BooleanField(default=False, verbose_name='Kan: Crisis')
    
    # Capacity & availability
    current_capacity = models.PositiveIntegerField(default=0, verbose_name='Huidige beschikbaarheid (aantal plaatsen)')
    max_capacity = models.PositiveIntegerField(default=0, verbose_name='Maximale capaciteit')
    waiting_list_length = models.PositiveIntegerField(default=0, verbose_name='Wachtlijst lengte')
    average_wait_days = models.PositiveIntegerField(default=0, verbose_name='Gemiddelde wachttijd (dagen)')
    
    # Additional info
    special_facilities = models.TextField(blank=True, verbose_name='Speciale faciliteiten')
    service_area = models.CharField(max_length=500, blank=True, verbose_name='Dienstgebied')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Provider Profile: {self.client.name}'


class Matter(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        PENDING = 'PENDING', 'Pending'
        CLOSED = 'CLOSED', 'Closed'
        ON_HOLD = 'ON_HOLD', 'On Hold'

    class Scope(models.TextChoices):
        GEMEENTE = 'GEMEENTE', 'Gemeente'
        REGIO = 'REGIO', 'Regio'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='matters')
    configuration_id = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='matters', null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.GEMEENTE, help_text='Municipality or Regional scope')
    care_domains = models.ManyToManyField(CareCategoryMain, blank=True, related_name='municipality_configurations')
    linked_providers = models.ManyToManyField(Client, blank=True, related_name='municipality_configurations')
    is_active = models.BooleanField(default=True)
    responsible_care_coordinator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='responsible_configurations')
    responsible_team = models.CharField(max_length=200, blank=True)
    intake_creator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_configurations')
    team_members = models.ManyToManyField(User, blank=True, related_name='matter_team')
    open_date = models.DateField(default=date.today)
    close_date = models.DateField(null=True, blank=True)
    max_wait_days = models.PositiveIntegerField(null=True, blank=True)
    priority_rules = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_confidential = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_matters')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contracts_care_configuration'

    def __init__(self, *args, **kwargs):
        legacy_practice = kwargs.pop('practice_area', None)
        kwargs.pop('billing_type', None)
        kwargs.pop('budget_amount', None)
        if 'matter_number' in kwargs and 'configuration_id' not in kwargs:
            kwargs['configuration_id'] = kwargs.pop('matter_number')
        if 'responsible_attorney' in kwargs and 'responsible_care_coordinator' not in kwargs:
            kwargs['responsible_care_coordinator'] = kwargs.pop('responsible_attorney')
        if 'originating_attorney' in kwargs and 'intake_creator' not in kwargs:
            kwargs['intake_creator'] = kwargs.pop('originating_attorney')
        super().__init__(*args, **kwargs)
        self._legacy_practice_area = legacy_practice

    def __str__(self):
        return f'{self.configuration_id} - {self.title}'

    def save(self, *args, **kwargs):
        if not self.configuration_id:
            last = Matter.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            self.configuration_id = f'CFG-{next_num:05d}'
        super().save(*args, **kwargs)

    @property
    def matter_number(self):
        return self.configuration_id

    @matter_number.setter
    def matter_number(self, value):
        self.configuration_id = value

    @property
    def responsible_attorney(self):
        return self.responsible_care_coordinator

    @responsible_attorney.setter
    def responsible_attorney(self, value):
        self.responsible_care_coordinator = value

    @property
    def originating_attorney(self):
        return self.intake_creator

    @originating_attorney.setter
    def originating_attorney(self, value):
        self.intake_creator = value

    @property
    def practice_area(self):
        return self._legacy_practice_area or ''

    def get_practice_area_display(self):
        return 'Zorgdomeinen gestuurd'

    @property
    def billing_type(self):
        return ''

    def get_billing_type_display(self):
        return 'Niet van toepassing'

    @property
    def budget_amount(self):
        return None

    @property
    def total_time_billed(self):
        entries_manager = getattr(self, 'time_entries', None)
        if entries_manager is None:
            return Decimal('0')
        entries = entries_manager.filter(is_billable=True)
        total = sum(e.hours for e in entries)
        return total

    @property
    def total_amount_billed(self):
        entries_manager = getattr(self, 'time_entries', None)
        if entries_manager is None:
            return Decimal('0')
        entries = entries_manager.filter(is_billable=True)
        total = sum(e.total_amount for e in entries)
        return total

    @property
    def provider_total(self):
        linked_count = self.linked_providers.count()
        if linked_count:
            return linked_count
        return 1 if self.client_id else 0

    @property
    def care_domains_display(self):
        names = list(self.care_domains.values_list('name', flat=True))
        if names:
            return ', '.join(names)
        return 'Niet ingesteld'

    @property
    def average_wait_days(self):
        provider_ids = list(self.linked_providers.values_list('id', flat=True))
        if not provider_ids and self.client_id:
            provider_ids = [self.client_id]
        wait_qs = TrustAccount.objects.filter(provider_id__in=provider_ids)
        value = wait_qs.aggregate(avg=models.Avg('wait_days'))['avg']
        return round(float(value), 1) if value is not None else None

    @property
    def case_total(self):
        return self.contracts.count()

    @property
    def capacity_status(self):
        avg_wait = self.average_wait_days
        if avg_wait is None:
            return 'Onbekend'
        if self.max_wait_days is None:
            return 'Geen norm'
        return 'Op schema' if avg_wait <= self.max_wait_days else 'Over norm'


# Canonical care-native alias retained while schema and field names stay stable.
CareConfiguration = Matter


class Contract(models.Model):
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
        BEOORDELING = 'beoordeling', 'Beoordeling'
        MATCHING = 'matching', 'Matching'
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
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Middel'
        HIGH = 'HIGH', 'Hoog'
        CRITICAL = 'CRITICAL', 'Kritiek'

    class Currency(models.TextChoices):
        USD = 'USD', 'USD ($)'
        EUR = 'EUR', 'EUR (€)'
        GBP = 'GBP', 'GBP (£)'
        CHF = 'CHF', 'CHF (Fr)'
        CAD = 'CAD', 'CAD (C$)'
        AUD = 'AUD', 'AUD (A$)'
        OTHER = 'OTHER', 'Other'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='contracts')
    title = models.CharField(max_length=200)
    contract_type = models.CharField(max_length=20, choices=ContractType.choices, default=ContractType.OTHER)
    content = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    preferred_provider = models.CharField(max_length=200, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=5, choices=Currency.choices, default=Currency.USD)
    governing_law = models.CharField(max_length=200, blank=True, help_text='Kader of beleidsgrondslag')
    jurisdiction = models.CharField(max_length=200, blank=True, help_text='Regio of toepassingsgebied')
    language = models.CharField(max_length=50, default='English', blank=True)
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices, default=RiskLevel.LOW)
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
        ('ARCHIVED', 'Archived'),
    ], default='DRAFTING')
    case_phase = models.CharField(max_length=20, choices=CasePhase.choices, default=CasePhase.INTAKE)
    phase_entered_at = models.DateTimeField(null=True, blank=True, help_text='Timestamp when the case entered the current phase')
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    matter = models.ForeignKey('Matter', on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_contracts')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contracts_care_case'

    def __str__(self):
        return self.title

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


CareCase = Contract


class Document(models.Model):
    class DocType(models.TextChoices):
        CONTRACT = 'CONTRACT', 'Casusdossier'
        AMENDMENT = 'AMENDMENT', 'Wijziging'
        EXHIBIT = 'EXHIBIT', 'Bijlage'
        CORRESPONDENCE = 'CORRESPONDENCE', 'Correspondence'
        COURT_FILING = 'COURT_FILING', 'Formele indiening'
        PLEADING = 'PLEADING', 'Onderbouwing'
        DISCOVERY = 'DISCOVERY', 'Discovery'
        MEMO = 'MEMO', 'Memorandum'
        RESEARCH = 'RESEARCH', 'Onderzoeksnotitie'
        INVOICE = 'INVOICE', 'Archived Financial Record'
        TEMPLATE = 'TEMPLATE', 'Template'
        OTHER = 'OTHER', 'Other'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Concept'
        REVIEW = 'REVIEW', 'In beoordeling'
        APPROVED = 'APPROVED', 'Goedgekeurd'
        FINAL = 'FINAL', 'Definitief'
        ARCHIVED = 'ARCHIVED', 'Gearchiveerd'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    title = models.CharField(max_length=300)
    document_type = models.CharField(max_length=20, choices=DocType.choices, default=DocType.OTHER)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=document_upload_path, blank=True, null=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    version = models.PositiveIntegerField(default=1)
    parent_document = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='versions')
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    matter = models.ForeignKey(Matter, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    tags = models.CharField(max_length=500, blank=True)
    is_privileged = models.BooleanField(default=False)
    is_confidential = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
        Client,
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
        """Filter tasks that belong to a specific organization via case or legacy relations."""
        if not organization:
            return self.none()
        from django.db.models import Q
        return self.filter(
            Q(due_diligence_process__organization=organization)
            | Q(contract__organization=organization)
            | Q(matter__organization=organization)
        )


class DeadlineManager(models.Manager):
    """Custom manager for Deadline."""
    def get_queryset(self):
        return DeadlineQuerySet(self.model, using=self._db)
    
    def for_organization(self, organization):
        """Filter deadlines that belong to a specific organization."""
        return self.get_queryset().for_organization(organization)


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
        'DueDiligenceProcess',
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
    
    # Legacy fields retained for compatibility with historical data.
    matter = models.ForeignKey(Matter, on_delete=models.CASCADE, null=True, blank=True, related_name='deadlines')
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True, related_name='deadlines')
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


class CaseAssessment(models.Model):
    """Care case assessment for intake review and matching preparation (Casusbeoordeling)"""
    
    class AssessmentStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Concept'
        UNDER_REVIEW = 'UNDER_REVIEW', 'In beoordeling'
        APPROVED_FOR_MATCHING = 'APPROVED_FOR_MATCHING', 'Goedgekeurd voor matching'
        NEEDS_INFO = 'NEEDS_INFO', 'Aanvullende info nodig'

    class RiskSignal(models.TextChoices):
        SAFETY = 'SAFETY', 'Veiligheid'
        ESCALATION = 'ESCALATION', 'Escalatie'
        DROPOUT_RISK = 'DROPOUT_RISK', 'Uitvalsignaal'
        INCOMPLETE_INTAKE = 'INCOMPLETE_INTAKE', 'Onvolledige intake'

    # Link to intake/case
    due_diligence_process = models.OneToOneField(
        'DueDiligenceProcess',
        on_delete=models.CASCADE,
        related_name='case_assessment',
        verbose_name='Casus'
    )

    # Assessment status
    assessment_status = models.CharField(
        max_length=32,
        choices=AssessmentStatus.choices,
        default=AssessmentStatus.DRAFT,
        verbose_name='Beoordeling status'
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
        return f'Casusbeoordeling: {self.due_diligence_process.title} ({self.get_assessment_status_display()})'
    
    def get_risk_signals_display(self):
        """Return list of signal labels."""
        if not self.risk_signals:
            return []
        codes = [s.strip() for s in self.risk_signals.split(',')]
        return [dict(self.RiskSignal.choices).get(code, code) for code in codes]


class TrademarkRequest(models.Model):
    class Meta:
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
        OUTPATIENT = 'OUTPATIENT', 'Ambulant'
        DAY_TREATMENT = 'DAY_TREATMENT', 'Dagbehandeling'
        RESIDENTIAL = 'RESIDENTIAL', 'Residentieel'
        CRISIS = 'CRISIS', 'Crisisopvang'

    # Legacy fields (kept for backward compatibility)
    mark_text = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)
    goods_services = models.TextField(blank=True)
    filing_basis = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='trademark_requests')
    matter = models.ForeignKey(Matter, on_delete=models.SET_NULL, null=True, blank=True, related_name='trademark_requests')

    # Care indication flow fields
    due_diligence_process = models.ForeignKey(
        'DueDiligenceProcess',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='indications',
        verbose_name='Casus'
    )
    proposed_provider = models.ForeignKey(
        Client,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='proposed_indications',
        verbose_name='Voorgestelde aanbieder'
    )
    selected_provider = models.ForeignKey(
        Client,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='selected_indications',
        verbose_name='Geselecteerde aanbieder'
    )
    care_form = models.CharField(
        max_length=20,
        choices=CareForm.choices,
        blank=True,
        verbose_name='Zorgvorm'
    )
    start_date = models.DateField(null=True, blank=True, verbose_name='Startdatum')
    duration_weeks = models.PositiveIntegerField(null=True, blank=True, verbose_name='Duur (weken, optioneel)')
    decision_notes = models.TextField(blank=True, verbose_name='Besluitnotities')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.due_diligence_process:
            return f'Indicatie: {self.due_diligence_process.title}'
        return self.mark_text or f'Indicatie #{self.pk}'


# Canonical care-native alias retained while the schema still uses the legacy model name.
PlacementRequest = TrademarkRequest


class LegalTaskQuerySet(models.QuerySet):
    """Custom queryset for LegalTask with organization-scoping support."""
    def for_organization(self, organization):
        """Filter legal tasks that belong to a specific organization via contract or matter."""
        if not organization:
            return self.none()
        from django.db.models import Q
        return self.filter(
            Q(contract__organization=organization) | Q(matter__organization=organization)
        )


class LegalTaskManager(models.Manager):
    """Custom manager for LegalTask."""
    def get_queryset(self):
        return LegalTaskQuerySet(self.model, using=self._db)
    
    def for_organization(self, organization):
        """Filter legal tasks that belong to a specific organization."""
        return self.get_queryset().for_organization(organization)


class LegalTask(models.Model):
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
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True)
    matter = models.ForeignKey(Matter, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = LegalTaskManager()

    def __str__(self):
        return self.title


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class RiskLogQuerySet(models.QuerySet):
    """Custom queryset for RiskLog with organization-scoping support."""
    def for_organization(self, organization):
        """Filter signals that belong to a specific organization."""
        if not organization:
            return self.none()
        from django.db.models import Q
        return self.filter(
            Q(due_diligence_process__organization=organization)
            | Q(contract__organization=organization)
            | Q(matter__organization=organization)
        )


class RiskLogManager(models.Manager):
    """Custom manager for RiskLog."""
    def get_queryset(self):
        return RiskLogQuerySet(self.model, using=self._db)
    
    def for_organization(self, organization):
        """Filter risk logs that belong to a specific organization."""
        return self.get_queryset().for_organization(organization)


class RiskLog(models.Model):
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
        'DueDiligenceProcess',
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

    # Legacy links (kept for compatibility with existing data)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True)
    matter = models.ForeignKey(Matter, on_delete=models.CASCADE, null=True, blank=True, related_name='risks')
    mitigation_plan = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = RiskLogManager()

    def __str__(self):
        if self.title:
            return self.title
        if self.due_diligence_process:
            return f'{self.get_signal_type_display()} - {self.due_diligence_process.title}'
        return self.get_signal_type_display()


class ComplianceChecklist(models.Model):
    class RegulationType(models.TextChoices):
        GDPR = 'GDPR', 'GDPR'
        HIPAA = 'HIPAA', 'HIPAA'
        SOX = 'SOX', 'Sarbanes-Oxley'
        PCI = 'PCI', 'PCI DSS'
        OTHER = 'OTHER', 'Other'

    title = models.CharField(max_length=200)
    description = models.TextField()
    regulation_type = models.CharField(max_length=20, choices=RegulationType.choices)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class ChecklistItem(models.Model):
    checklist = models.ForeignKey(ComplianceChecklist, on_delete=models.CASCADE, related_name='items')
    title = models.CharField(max_length=200, default='Untitled Item')
    description = models.TextField(blank=True)
    is_completed = models.BooleanField(default=False)
    completed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.title


class WorkflowTemplate(models.Model):
    class Category(models.TextChoices):
        CONTRACT_REVIEW = 'CONTRACT_REVIEW', 'Contract Review'
        DUE_DILIGENCE = 'DUE_DILIGENCE', 'Due Diligence'
        TRADEMARK = 'TRADEMARK', 'Trademark'
        COMPLIANCE = 'COMPLIANCE', 'Compliance'
        GENERAL = 'GENERAL', 'General'

    name = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.GENERAL)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class WorkflowTemplateStep(models.Model):
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.CASCADE, related_name='steps')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    estimated_duration = models.DurationField(null=True, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.template.name} - {self.name}"


class Workflow(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class WorkflowStep(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        SKIPPED = 'SKIPPED', 'Skipped'

    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='steps')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.workflow.title} - {self.name}"


class DueDiligenceProcess(models.Model):
    """Care/intake & assessment processes (Intakes & Beoordelingen)"""
    class ProcessStatus(models.TextChoices):
        INTAKE = 'INTAKE', 'Intake'
        ASSESSMENT = 'ASSESSMENT', 'Beoordeling'
        MATCHING = 'MATCHING', 'Matching'
        DECISION = 'DECISION', 'Matchbesluit'
        COMPLETED = 'COMPLETED', 'Afgerond'
        ON_HOLD = 'ON_HOLD', 'In wacht'

    class Urgency(models.TextChoices):
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Middel'
        HIGH = 'HIGH', 'Hoog'
        CRISIS = 'CRISIS', 'Crisis'

    class Complexity(models.TextChoices):
        SIMPLE = 'SIMPLE', 'Enkelvoudig'
        MULTIPLE = 'MULTIPLE', 'Meervoudig'
        SEVERE = 'SEVERE', 'Zwaar'

    class CareForm(models.TextChoices):
        OUTPATIENT = 'OUTPATIENT', 'Ambulant'
        DAY_TREATMENT = 'DAY_TREATMENT', 'Dagbehandeling'
        RESIDENTIAL = 'RESIDENTIAL', 'Residentieel'
        CRISIS = 'CRISIS', 'Crisisopvang'

    class AgeCategory(models.TextChoices):
        EARLY_CHILDHOOD = '0_4', '0–4'
        CHILDHOOD = '4_12', '4–12'
        ADOLESCENT = '12_18', '12–18'
        ADULT = '18_PLUS', '18+'

    class FamilySituation(models.TextChoices):
        HOME_DWELLING = 'HOME_DWELLING', 'Thuiswonend'
        DIVORCED_PARENTS = 'DIVORCED_PARENTS', 'Gescheiden ouders'
        FOSTER_CARE = 'FOSTER_CARE', 'Pleegzorg'
        INSTITUTION = 'INSTITUTION', 'Instelling'
        OTHER = 'OTHER', 'Anders'

    # Organization & basic info
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='due_diligence_processes')
    contract = models.OneToOneField('Contract', on_delete=models.SET_NULL, null=True, blank=True, related_name='due_diligence_process')
    title = models.CharField(max_length=200, verbose_name='Casusidentificatie', help_text='Bijv. voornaam + initialiteit')
    status = models.CharField(max_length=20, choices=ProcessStatus.choices, default=ProcessStatus.INTAKE, verbose_name='Status')
    
    # Case coordination
    lead_attorney = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='dd_processes', verbose_name='Casusregisseur')
    
    # Dates
    start_date = models.DateField(verbose_name='Intakedatum')
    target_completion_date = models.DateField(verbose_name='Doeldatum matchbesluit')
    
    # CARE-SPECIFIC: Zorgvraag (Care Question)
    care_category_main = models.ForeignKey(CareCategoryMain, on_delete=models.SET_NULL, null=True, blank=True, related_name='intakes_main', verbose_name='Hoofdcategorie zorgvraag')
    care_category_sub = models.ForeignKey(CareCategorySubcategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='intakes_sub', verbose_name='Subcategorie zorgvraag')
    
    # CARE-SPECIFIC: Matching dimensions
    urgency = models.CharField(max_length=10, choices=Urgency.choices, default=Urgency.MEDIUM, verbose_name='Urgentie')
    complexity = models.CharField(max_length=20, choices=Complexity.choices, default=Complexity.SIMPLE, verbose_name='Complexiteit')
    preferred_care_form = models.CharField(max_length=20, choices=CareForm.choices, default=CareForm.OUTPATIENT, verbose_name='Gewenste zorgvorm')
    
    # CARE-SPECIFIC: Client profile
    client_age_category = models.CharField(max_length=10, choices=AgeCategory.choices, null=True, blank=True, verbose_name='Leeftijdscategorie cliënt')
    family_situation = models.CharField(max_length=20, choices=FamilySituation.choices, null=True, blank=True, verbose_name='Gezinssituatie')
    has_other_support = models.BooleanField(default=False, verbose_name='Betrokken hulp (ja/nee)')
    other_support_description = models.TextField(blank=True, verbose_name='Beschrijving betrokken hulp')
    school_work_status = models.CharField(max_length=200, blank=True, verbose_name='School- / werkstatus')
    
    # Risk factors (many-to-many)
    risk_factors = models.ManyToManyField(RiskFactor, blank=True, related_name='intakes', verbose_name='Risicofactoren')
    
    # Descriptive assessment
    assessment_summary = models.TextField(blank=True, verbose_name='Intake samenvatting', help_text='Hulpvraag samenvatting, urgentie, aandachtspunten')
    description = models.TextField(blank=True, verbose_name='Aanvullende opmerkingen')
    
    # Legacy fields (kept for migration compatibility)
    transaction_type = models.CharField(max_length=20, blank=True)
    target_company = models.CharField(max_length=200, blank=True)
    deal_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Intake & Beoordeling'
        verbose_name_plural = 'Intakes & Beoordelingen'

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'


class DueDiligenceTask(models.Model):
    class TaskStatus(models.TextChoices):
        PENDING = 'PENDING', 'Open'
        IN_PROGRESS = 'IN_PROGRESS', 'In uitvoering'
        COMPLETED = 'COMPLETED', 'Afgerond'
        BLOCKED = 'BLOCKED', 'Geblokkeerd'

    class TaskCategory(models.TextChoices):
        LEGAL = 'LEGAL', 'Regelgeving'
        FINANCIAL = 'FINANCIAL', 'Budget'
        OPERATIONAL = 'OPERATIONAL', 'Operationeel'
        TECHNICAL = 'TECHNICAL', 'Technisch'
        REGULATORY = 'REGULATORY', 'Toetsing'
        COMMERCIAL = 'COMMERCIAL', 'Samenwerking'

    process = models.ForeignKey(DueDiligenceProcess, on_delete=models.CASCADE, related_name='dd_tasks')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=TaskCategory.choices)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    due_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'due_date']

    def __str__(self):
        return f'{self.process.title} - {self.title}'


class DueDiligenceRisk(models.Model):
    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Middel'
        HIGH = 'HIGH', 'Hoog'

    class RiskCategory(models.TextChoices):
        LEGAL = 'LEGAL', 'Regelgeving & toetsing'
        FINANCIAL = 'FINANCIAL', 'Budget'
        OPERATIONAL = 'OPERATIONAL', 'Operationeel'
        REPUTATIONAL = 'REPUTATIONAL', 'Reputatie'
        STRATEGIC = 'STRATEGIC', 'Strategisch'

    process = models.ForeignKey(DueDiligenceProcess, on_delete=models.CASCADE, related_name='dd_risks')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=RiskCategory.choices)
    description = models.TextField()
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices)
    likelihood = models.CharField(max_length=10, choices=RiskLevel.choices)
    impact = models.CharField(max_length=10, choices=RiskLevel.choices)
    mitigation_strategy = models.TextField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    identified_date = models.DateField(auto_now_add=True)
    target_resolution_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.process.title} - {self.title} ({self.risk_level})'


# Canonical care-native aliases retained while schema and field names stay stable.
CaseIntakeProcess = DueDiligenceProcess
IntakeTask = DueDiligenceTask
CaseRiskSignal = DueDiligenceRisk


class Budget(models.Model):
    class ScopeType(models.TextChoices):
        GEMEENTE = 'GEMEENTE', 'Gemeente'
        REGIO = 'REGIO', 'Regio'

    class CareType(models.TextChoices):
        OUTPATIENT = 'OUTPATIENT', 'Ambulant'
        DAY_TREATMENT = 'DAY_TREATMENT', 'Dagbehandeling'
        RESIDENTIAL = 'RESIDENTIAL', 'Residentieel'
        CRISIS = 'CRISIS', 'Crisisopvang'

    # Legacy quarter choices retained for backward compatibility.
    class Quarter(models.TextChoices):
        Q1 = 'Q1', 'Q1'
        Q2 = 'Q2', 'Q2'
        Q3 = 'Q3', 'Q3'
        Q4 = 'Q4', 'Q4'

    organization = models.ForeignKey(
        'Organization', on_delete=models.CASCADE, null=True, blank=True,
        related_name='budgets',
    )

    # Care-oriented structure
    scope_type = models.CharField(max_length=20, choices=ScopeType.choices, default=ScopeType.GEMEENTE, verbose_name='Gemeente / regio type')
    scope_name = models.CharField(max_length=150, default='', blank=True, verbose_name='Gemeente / regio')
    target_group = models.CharField(max_length=150, default='', blank=True, verbose_name='Doelgroep')
    care_type = models.CharField(max_length=20, choices=CareType.choices, default=CareType.OUTPATIENT, verbose_name='Zorgtype')
    year = models.PositiveIntegerField()

    # Legacy fields retained for compatibility.
    quarter = models.CharField(max_length=2, choices=Quarter.choices, blank=True, default='')
    department = models.CharField(max_length=100, blank=True, default='')

    allocated_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0'))], verbose_name='Totaal budget')
    description = models.TextField(blank=True)

    linked_providers = models.ManyToManyField(
        Client,
        blank=True,
        related_name='capacity_budgets',
        verbose_name='Gekoppelde aanbieders',
        help_text='Optioneel: koppel aanbieders aan dit budget.'
    )
    linked_cases = models.ManyToManyField(
        'DueDiligenceProcess',
        blank=True,
        related_name='capacity_budgets',
        verbose_name='Gekoppelde casussen'
    )
    linked_placements = models.ManyToManyField(
        'TrademarkRequest',
        blank=True,
        related_name='capacity_budgets',
        verbose_name='Gekoppelde plaatsingen'
    )

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['organization', 'year', 'scope_type', 'scope_name', 'target_group', 'care_type']

    def __str__(self):
        return f'{self.get_scope_type_display()} {self.scope_name} - {self.target_group} ({self.year})'

    @property
    def spent_amount(self):
        return self.expenses.aggregate(total=models.Sum('amount'))['total'] or Decimal('0')

    @property
    def remaining_amount(self):
        return self.allocated_amount - self.spent_amount

    @property
    def is_over_budget(self):
        return self.spent_amount > self.allocated_amount

    @property
    def utilization_percentage(self):
        if not self.allocated_amount:
            return Decimal('0')
        return (self.spent_amount / self.allocated_amount) * Decimal('100')

    @property
    def case_count(self):
        return self.linked_cases.count()


class BudgetExpense(models.Model):
    class Category(models.TextChoices):
        LEGAL_FEES = 'LEGAL_FEES', 'Toetsingskosten'
        CONSULTING = 'CONSULTING', 'Consulting'
        SOFTWARE = 'SOFTWARE', 'Software'
        TRAVEL = 'TRAVEL', 'Travel'
        OFFICE = 'OFFICE', 'Office Supplies'
        OTHER = 'OTHER', 'Other'

    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='expenses')
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal('0'))])
    category = models.CharField(max_length=20, choices=Category.choices)
    date = models.DateField()
    receipt_url = models.URLField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.budget} - {self.description} (${self.amount})'


class NegotiationThread(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='negotiation_threads')
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.contract.title} - {self.title}"


class SignatureRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SENT = 'SENT', 'Sent'
        VIEWED = 'VIEWED', 'Viewed'
        SIGNED = 'SIGNED', 'Signed'
        DECLINED = 'DECLINED', 'Declined'
        EXPIRED = 'EXPIRED', 'Expired'
        CANCELLED = 'CANCELLED', 'Cancelled'

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='signature_requests')
    document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name='signature_requests')
    signer_name = models.CharField(max_length=200)
    signer_email = models.EmailField()
    signer_role = models.CharField(max_length=100, blank=True, help_text='Bijv. Teamleider, Regiecoordinator')
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    external_id = models.CharField(max_length=200, blank=True, help_text='External provider reference ID')
    sent_at = models.DateTimeField(null=True, blank=True)
    viewed_at = models.DateTimeField(null=True, blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    declined_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    execution_certificate_url = models.URLField(blank=True)
    order = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f'{self.contract.title} - {self.signer_name} ({self.get_status_display()})'


ProviderResponseRequest = SignatureRequest


class DataInventoryRecord(models.Model):
    class LawfulBasis(models.TextChoices):
        CONSENT = 'CONSENT', 'Toestemming'
        CONTRACT = 'CONTRACT', 'Uitvoering zorgtraject'
        LEGAL_OBLIGATION = 'LEGAL_OBLIGATION', 'Wettelijke verplichting'
        VITAL_INTEREST = 'VITAL_INTEREST', 'Vitaal belang'
        PUBLIC_INTEREST = 'PUBLIC_INTEREST', 'Publiek belang'
        LEGITIMATE_INTEREST = 'LEGITIMATE_INTEREST', 'Gerechtvaardigd belang'

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    data_categories = models.TextField(help_text='Categories of personal data processed')
    data_subjects = models.TextField(help_text='Categories of data subjects')
    purpose = models.TextField(help_text='Purpose of processing')
    lawful_basis = models.CharField(max_length=25, choices=LawfulBasis.choices)
    retention_period = models.CharField(max_length=200, help_text='e.g. 7 years, until consent withdrawn')
    recipients = models.TextField(blank=True, help_text='Categories of recipients')
    third_country_transfers = models.BooleanField(default=False)
    transfer_safeguards = models.TextField(blank=True, help_text='SCC, DPF, adequacy decision, etc.')
    technical_measures = models.TextField(blank=True, help_text='Encryption, pseudonymization, etc.')
    organizational_measures = models.TextField(blank=True, help_text='Access controls, training, etc.')
    dpia_required = models.BooleanField(default=False, help_text='Data Protection Impact Assessment required')
    dpia_completed = models.BooleanField(default=False)
    controller = models.CharField(max_length=200, blank=True)
    processor = models.CharField(max_length=200, blank=True)
    dpo_contact = models.CharField(max_length=200, blank=True)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='data_inventory')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class DSARRequest(models.Model):
    class RequestType(models.TextChoices):
        ACCESS = 'ACCESS', 'Right of Access'
        RECTIFICATION = 'RECTIFICATION', 'Right to Rectification'
        ERASURE = 'ERASURE', 'Right to Erasure'
        RESTRICT = 'RESTRICT', 'Right to Restrict Processing'
        PORTABILITY = 'PORTABILITY', 'Right to Data Portability'
        OBJECTION = 'OBJECTION', 'Right to Object'

    class Status(models.TextChoices):
        RECEIVED = 'RECEIVED', 'Received'
        VERIFIED = 'VERIFIED', 'Identity Verified'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        DENIED = 'DENIED', 'Denied'
        EXTENDED = 'EXTENDED', 'Extended'

    reference_number = models.CharField(max_length=50, unique=True)
    request_type = models.CharField(max_length=15, choices=RequestType.choices)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.RECEIVED)
    requester_name = models.CharField(max_length=200)
    requester_email = models.EmailField()
    requester_id_verified = models.BooleanField(default=False)
    description = models.TextField()
    response = models.TextField(blank=True)
    denial_reason = models.TextField(blank=True)
    received_date = models.DateField()
    due_date = models.DateField(help_text='Must respond within 30 days (GDPR)')
    completed_date = models.DateField(null=True, blank=True)
    extended = models.BooleanField(default=False, help_text='Extension requested (up to 60 additional days)')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='dsar_requests')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_dsars')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'DSAR Request'

    def __str__(self):
        return f'{self.reference_number} - {self.get_request_type_display()}'

    def save(self, *args, **kwargs):
        if not self.reference_number:
            last = DSARRequest.objects.order_by('-id').first()
            next_num = (last.id + 1) if last else 1
            self.reference_number = f'DSAR-{next_num:05d}'
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        if self.status not in ['COMPLETED', 'DENIED'] and self.due_date:
            return date.today() > self.due_date
        return False


class Subprocessor(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    service_type = models.CharField(max_length=200, help_text='e.g. Cloud hosting, Payment processing')
    country = models.CharField(max_length=100)
    is_eu_based = models.BooleanField(default=False)
    dpa_in_place = models.BooleanField(default=False)
    scc_in_place = models.BooleanField(default=False)
    dpf_certified = models.BooleanField(default=False, help_text='Data Privacy Framework certified')
    data_categories = models.TextField(blank=True, help_text='Types of data shared')
    contact_email = models.EmailField(blank=True)
    contract_start_date = models.DateField(null=True, blank=True)
    contract_end_date = models.DateField(null=True, blank=True)
    last_audit_date = models.DateField(null=True, blank=True)
    risk_level = models.CharField(max_length=10, choices=[
        ('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'),
    ], default='LOW')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name} ({self.country})'


class TransferRecord(models.Model):
    class TransferMechanism(models.TextChoices):
        ADEQUACY = 'ADEQUACY', 'Adequacy Decision'
        SCC = 'SCC', 'Standard Contractual Clauses'
        BCR = 'BCR', 'Binding Corporate Rules'
        DPF = 'DPF', 'Data Privacy Framework'
        CONSENT = 'CONSENT', 'Explicit Consent'
        DEROGATION = 'DEROGATION', 'Derogation'

    title = models.CharField(max_length=200)
    source_country = models.CharField(max_length=100)
    destination_country = models.CharField(max_length=100)
    transfer_mechanism = models.CharField(max_length=15, choices=TransferMechanism.choices)
    data_categories = models.TextField(help_text='Types of data transferred')
    subprocessor = models.ForeignKey(Subprocessor, on_delete=models.SET_NULL, null=True, blank=True, related_name='transfers')
    contract = models.ForeignKey(Contract, on_delete=models.SET_NULL, null=True, blank=True, related_name='data_transfers')
    tia_completed = models.BooleanField(default=False, help_text='Transfer Impact Assessment completed')
    supplementary_measures = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    start_date = models.DateField(null=True, blank=True)
    review_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.title} ({self.source_country} → {self.destination_country})'


class RetentionPolicy(models.Model):
    class Category(models.TextChoices):
        CONTRACTS = 'CONTRACTS', 'Contracts'
        CLIENT_DATA = 'CLIENT_DATA', 'Client Data'
        EMPLOYEE_DATA = 'EMPLOYEE_DATA', 'Employee Data'
        FINANCIAL = 'FINANCIAL', 'Financial Records'
        CORRESPONDENCE = 'CORRESPONDENCE', 'Correspondence'
        LITIGATION = 'LITIGATION', 'Litigation Files'
        COMPLIANCE = 'COMPLIANCE', 'Compliance Records'
        OTHER = 'OTHER', 'Other'

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField(blank=True)
    retention_period_days = models.PositiveIntegerField(help_text='Retention period in days')
    legal_basis = models.TextField(blank=True, help_text='Legal requirement for retention')
    deletion_method = models.CharField(max_length=200, blank=True, help_text='How data is destroyed')
    auto_delete = models.BooleanField(default=False)
    review_frequency_days = models.PositiveIntegerField(default=365)
    last_reviewed = models.DateField(null=True, blank=True)
    next_review = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Retention policies'

    def __str__(self):
        return f'{self.title} ({self.retention_period_days} days)'


class ApprovalRule(models.Model):
    class TriggerType(models.TextChoices):
        VALUE_ABOVE = 'VALUE_ABOVE', 'Contract Value Above'
        JURISDICTION = 'JURISDICTION', 'Specific Jurisdiction'
        CONTRACT_TYPE = 'CONTRACT_TYPE', 'Contract Type'
        RISK_LEVEL = 'RISK_LEVEL', 'Risk Level'
        DATA_TRANSFER = 'DATA_TRANSFER', 'Cross-border Data Transfer'

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    trigger_type = models.CharField(max_length=20, choices=TriggerType.choices)
    trigger_value = models.CharField(max_length=200, help_text='Threshold value or matching text')
    approval_step = models.CharField(max_length=20, choices=[
        ('LEGAL', 'Legal Review'),
        ('FINANCE', 'Finance Review'),
        ('PRIVACY', 'Privacy Review'),
        ('EXECUTIVE', 'Executive Approval'),
        ('COMPLIANCE', 'Compliance Review'),
    ])
    approver_role = models.CharField(max_length=20, choices=UserProfile.Role.choices)
    specific_approver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approval_rules')
    sla_hours = models.PositiveIntegerField(default=48, help_text='SLA in hours for approval')
    escalation_after_hours = models.PositiveIntegerField(default=72, help_text='Auto-escalate after hours')
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.name} ({self.get_trigger_type_display()})'


class ApprovalRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        ESCALATED = 'ESCALATED', 'Escalated'

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='approval_requests')
    rule = models.ForeignKey(ApprovalRule, on_delete=models.SET_NULL, null=True, blank=True)
    approval_step = models.CharField(max_length=50)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approval_assignments')
    comments = models.TextField(blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approval_decisions')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.contract.title} - {self.approval_step} ({self.get_status_display()})'


# ============================================
# MUNICIPALITY & REGIONAL CONFIGURATION MODELS
# ============================================

class MunicipalityConfiguration(models.Model):
    """Gemeente-level configuration for care network management"""
    
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Actief'
        INACTIVE = 'INACTIVE', 'Inactief'
        DRAFT = 'DRAFT', 'Concept'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='municipality_configs')
    
    # Municipality info
    municipality_name = models.CharField(max_length=150, verbose_name='Gemeente')
    municipality_code = models.CharField(max_length=50, blank=True, verbose_name='Gemeentecode')
    
    # Configuration management
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, verbose_name='Status')
    
    # Care configuration
    care_domains = models.ManyToManyField(CareCategoryMain, blank=True, related_name='municipality_configs', verbose_name='Zorgdomeinen')
    linked_providers = models.ManyToManyField(Client, blank=True, related_name='municipality_configs', verbose_name='Gekoppelde aanbieders')
    
    # Performance management
    max_wait_days = models.PositiveIntegerField(null=True, blank=True, verbose_name='Maximale wachttijd (dagen)')
    priority_rules = models.TextField(blank=True, verbose_name='Prioriteringsregels')
    
    # Contact & administration
    responsible_attorney = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='municipality_configs', verbose_name='Verantwoordelijke')
    notes = models.TextField(blank=True, verbose_name='Notities')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_municipality_configs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['municipality_name']
        verbose_name = 'Gemeente Configuratie'
        verbose_name_plural = 'Gemeente Configuraties'
        unique_together = ('organization', 'municipality_code')

    def __str__(self):
        return f'{self.municipality_name} (gemeente)'

    @property
    def provider_count(self):
        return self.linked_providers.count()

    @property
    def care_domains_display(self):
        names = list(self.care_domains.values_list('name', flat=True))
        if names:
            return ', '.join(names)
        return 'Niet ingesteld'


class RegionalConfiguration(models.Model):
    """Regio-level configuration for multi-municipality care coordination"""
    
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Actief'
        INACTIVE = 'INACTIVE', 'Inactief'
        DRAFT = 'DRAFT', 'Concept'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='regional_configs')
    
    # Region info
    region_name = models.CharField(max_length=150, verbose_name='Regio')
    region_code = models.CharField(max_length=50, blank=True, verbose_name='Regiode')
    
    # Configuration management
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, verbose_name='Status')
    
    # Served municipalities
    served_municipalities = models.ManyToManyField(MunicipalityConfiguration, blank=True, related_name='regions', verbose_name='Bediende gemeenten')
    
    # Care configuration
    care_domains = models.ManyToManyField(CareCategoryMain, blank=True, related_name='regional_configs', verbose_name='Zorgdomeinen')
    linked_providers = models.ManyToManyField(Client, blank=True, related_name='regional_configs', verbose_name='Gekoppelde aanbieders')
    
    # Performance management
    max_wait_days = models.PositiveIntegerField(null=True, blank=True, verbose_name='Maximale wachttijd (dagen)')
    priority_rules = models.TextField(blank=True, verbose_name='Prioriteringsregels')
    
    # Contact & administration
    responsible_attorney = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='regional_configs', verbose_name='Verantwoordelijke')
    notes = models.TextField(blank=True, verbose_name='Notities')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_regional_configs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['region_name']
        verbose_name = 'Regio Configuratie'
        verbose_name_plural = 'Regio Configuraties'
        unique_together = ('organization', 'region_code')

    def __str__(self):
        return f'{self.region_name} (regio)'

    @property
    def provider_count(self):
        return self.linked_providers.count()

    @property
    def municipality_count(self):
        return self.served_municipalities.count()

    @property
    def care_domains_display(self):
        names = list(self.care_domains.values_list('name', flat=True))
        if names:
            return ', '.join(names)
        return 'Niet ingesteld'
