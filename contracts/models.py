from django.db import models
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.utils import timezone
from decimal import Decimal
from datetime import date
import uuid
import os

User = get_user_model()


class RegionType(models.TextChoices):
    GEMEENTELIJK = 'GEMEENTELIJK', 'Gemeentelijk'
    JEUGDREGIO = 'JEUGDREGIO', 'Jeugdregio'
    ROAZ = 'ROAZ', 'ROAZ'
    GGD = 'GGD', 'GGD'
    ZORGKANTOOR = 'ZORGKANTOOR', 'Zorgkantoor'


class OutcomeReasonCode(models.TextChoices):
    NONE = 'NONE', 'Geen specifieke reden'
    CAPACITY = 'CAPACITY', 'Capaciteit'
    WAITLIST = 'WAITLIST', 'Wachtlijst'
    CLIENT_DECLINED = 'CLIENT_DECLINED', 'Client heeft afgezien'
    PROVIDER_DECLINED = 'PROVIDER_DECLINED', 'Aanbieder heeft afgewezen'
    NO_SHOW = 'NO_SHOW', 'Niet verschenen'
    NO_RESPONSE = 'NO_RESPONSE', 'Geen reactie'
    CARE_MISMATCH = 'CARE_MISMATCH', 'Zorgvraag past niet'
    REGION_MISMATCH = 'REGION_MISMATCH', 'Regio past niet'
    SAFETY_RISK = 'SAFETY_RISK', 'Veiligheidsrisico'
    ADMINISTRATIVE_BLOCK = 'ADMINISTRATIVE_BLOCK', 'Administratieve blokkade'
    OTHER = 'OTHER', 'Anders'


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
        ('GOVERNANCE', 'Regelgevingsvragen'),
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
    responsible_coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responsible_clients',
    )
    intake_coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='originated_clients',
    )
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
    served_regions = models.ManyToManyField(
        'RegionalConfiguration',
        blank=True,
        related_name='provider_profiles',
        verbose_name='Bediende regio\'s',
    )
    secondary_served_regions = models.ManyToManyField(
        'RegionalConfiguration',
        blank=True,
        related_name='provider_profiles_secondary',
        verbose_name='Secundaire bediende regio\'s',
    )
    
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


class CareConfiguration(models.Model):
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

    def __str__(self):
        return f'{self.configuration_id} - {self.title}'

    def save(self, *args, **kwargs):
        if not self.configuration_id:
            last = CareConfiguration.objects.order_by('-id').first()
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
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Middel'
        HIGH = 'HIGH', 'Hoog'
        CRITICAL = 'CRITICAL', 'Kritiek'

    class Currency(models.TextChoices):
        EUR = 'EUR', 'EUR (€)'
        OTHER = 'OTHER', 'Other'

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, null=True, blank=True, related_name='contracts')
    title = models.CharField(max_length=200)
    contract_type = models.CharField(max_length=20, choices=ContractType.choices, default=ContractType.OTHER)
    content = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    preferred_provider = models.CharField(max_length=200, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=5, choices=Currency.choices, default=Currency.EUR)
    policy_framework = models.CharField(max_length=200, blank=True, help_text='Kader of beleidsgrondslag')
    service_region = models.CharField(max_length=200, blank=True, help_text='Regio of toepassingsgebied')
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
        ('ARCHIVED', 'Gearchiveerd'),
    ], default='DRAFTING')
    case_phase = models.CharField(max_length=20, choices=CasePhase.choices, default=CasePhase.INTAKE)
    phase_entered_at = models.DateTimeField(null=True, blank=True, help_text='Timestamp when the case entered the current phase')
    client = models.ForeignKey('Client', on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    matter = models.ForeignKey('CareConfiguration', on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
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
    contract = models.ForeignKey(CareCase, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
    matter = models.ForeignKey(CareConfiguration, on_delete=models.CASCADE, null=True, blank=True, related_name='documents')
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
        'CaseIntakeProcess',
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
    configuration = models.ForeignKey(CareConfiguration, on_delete=models.CASCADE, null=True, blank=True, related_name='deadlines', db_column='configuration_id')
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
        'CaseIntakeProcess',
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
                'matching_ready': 'Een beoordeling kan pas gereed voor matching zijn als matching_ready aan staat.',
            })

        if self.matching_ready and self.assessment_status != self.AssessmentStatus.APPROVED_FOR_MATCHING:
            raise ValidationError({
                'assessment_status': 'Alleen een goedgekeurde beoordeling mag matching_ready zijn.',
            })

    def can_mark_ready_for_matching(self) -> tuple[bool, str]:
        if self.assessment_status != self.AssessmentStatus.APPROVED_FOR_MATCHING:
            return False, 'Beoordeling moet eerst goedgekeurd zijn voor matching.'
        if not self.matching_ready:
            return False, 'Beoordeling staat nog niet op gereed voor matching.'
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
        return PlacementRequestQuerySet(self.model, using=self._db)

    def for_organization(self, organization):
        return self.get_queryset().for_organization(organization)


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
        OUTPATIENT = 'OUTPATIENT', 'Ambulant'
        DAY_TREATMENT = 'DAY_TREATMENT', 'Dagbehandeling'
        RESIDENTIAL = 'RESIDENTIAL', 'Residentieel'
        CRISIS = 'CRISIS', 'Crisisopvang'

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
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='trademark_requests')
    matter = models.ForeignKey(CareConfiguration, on_delete=models.SET_NULL, null=True, blank=True, related_name='trademark_requests')

    # Care indication flow fields
    due_diligence_process = models.ForeignKey(
        'CaseIntakeProcess',
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
        choices=OutcomeReasonCode.choices,
        default=OutcomeReasonCode.NONE,
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
            if intake and intake.status not in {
                CaseIntakeProcess.ProcessStatus.MATCHING,
                CaseIntakeProcess.ProcessStatus.DECISION,
            }:
                return False, 'Casus moet eerst in matching staan.'
            if self.provider_response_status != self.ProviderResponseStatus.ACCEPTED:
                return False, 'Plaatsing kan pas worden bevestigd na acceptatie door de aanbieder.'
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

    # FK to the live case record. SET_NULL so governance evidence is not
    # destroyed if the operational case record is deleted or archived.
    # The stable identifier is always preserved in `case_id_snapshot`.
    case = models.ForeignKey(
        'CaseIntakeProcess',
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
        'PlacementRequest',
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
        Client,
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
        return CareTaskQuerySet(self.model, using=self._db)
    
    def for_organization(self, organization):
        """Filter care tasks that belong to a specific organization."""
        return self.get_queryset().for_organization(organization)


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
        return CareSignalQuerySet(self.model, using=self._db)
    
    def for_organization(self, organization):
        """Filter care signals that belong to a specific organization."""
        return self.get_queryset().for_organization(organization)


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
        'CaseIntakeProcess',
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


class WorkflowTemplate(models.Model):
    class Category(models.TextChoices):
        CONTRACT_REVIEW = 'CONTRACT_REVIEW', 'Zorgovereenkomst review'
        DUE_DILIGENCE = 'DUE_DILIGENCE', 'Intake & Beoordeling'
        TRADEMARK = 'TRADEMARK', 'Plaatsingscoordinatie'
        COMPLIANCE = 'COMPLIANCE', 'Compliance'
        GENERAL = 'GENERAL', 'Algemeen'

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
    contract = models.ForeignKey(CareCase, on_delete=models.CASCADE, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    @property
    def case_record(self):
        return self.contract

    @case_record.setter
    def case_record(self, value):
        self.contract = value


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


class CaseIntakeProcess(models.Model):
    """Care/intake & matching processes (Intakes & Matching)"""
    class ProcessStatus(models.TextChoices):
        INTAKE = 'INTAKE', 'Intake'
        MATCHING = 'MATCHING', 'Matching'
        DECISION = 'DECISION', 'Matchbesluit'
        COMPLETED = 'COMPLETED', 'Afgerond'
        ON_HOLD = 'ON_HOLD', 'In wacht'
        ARCHIVED = 'ARCHIVED', 'Gearchiveerd'

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

    class IntakeOutcomeStatus(models.TextChoices):
        PENDING = 'PENDING', 'Nog niet vastgelegd'
        COMPLETED = 'COMPLETED', 'Afgerond'
        CANCELLED = 'CANCELLED', 'Geannuleerd'
        NO_SHOW = 'NO_SHOW', 'Niet verschenen'

    # Organization & basic info
    organization = models.ForeignKey('Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='due_diligence_processes')
    contract = models.OneToOneField('CareCase', on_delete=models.SET_NULL, null=True, blank=True, related_name='due_diligence_process')
    title = models.CharField(max_length=200, verbose_name='Casusidentificatie', help_text='Bijv. voornaam + initialiteit')
    status = models.CharField(max_length=20, choices=ProcessStatus.choices, default=ProcessStatus.INTAKE, verbose_name='Status')
    
    # Case coordination
    case_coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dd_processes',
        verbose_name='Casusregisseur',
    )
    
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
    preferred_region_type = models.CharField(
        max_length=20,
        choices=RegionType.choices,
        default=RegionType.GEMEENTELIJK,
        verbose_name='Voorkeur regiotype',
    )
    preferred_region = models.ForeignKey(
        'RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='preferred_intakes',
        verbose_name='Voorkeursregio',
    )
    gemeente = models.ForeignKey(
        'MunicipalityConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='intake_processes',
        verbose_name='Gemeente',
    )
    regio = models.ForeignKey(
        'RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_intakes',
        verbose_name='Geresolveerde regio',
        help_text='Deterministisch afgeleid uit gemeente; stabiel tenzij gemeente wijzigt.',
    )
    zorgvorm_gewenst = models.CharField(
        max_length=20,
        choices=CareForm.choices,
        blank=True,
        verbose_name='Zorgvorm gewenst (matching)',
    )
    problematiek_types = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Problematiektypes',
    )
    contra_indicaties = models.TextField(
        blank=True,
        verbose_name='Contra-indicaties',
    )
    max_toelaatbare_wachttijd_dagen = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Maximaal toelaatbare wachttijd (dagen)',
    )
    leeftijd = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name='Leeftijd (jaren)',
    )
    setting_voorkeur = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Settingvoorkeur',
        help_text='Bijv. open, besloten, semi_besloten, thuis.',
    )
    
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
    intake_outcome_status = models.CharField(
        max_length=20,
        choices=IntakeOutcomeStatus.choices,
        default=IntakeOutcomeStatus.PENDING,
        verbose_name='Uitkomst intake',
    )
    intake_outcome_reason_code = models.CharField(
        max_length=30,
        choices=OutcomeReasonCode.choices,
        default=OutcomeReasonCode.NONE,
        verbose_name='Redencode intake-uitkomst',
    )
    intake_outcome_notes = models.TextField(blank=True, verbose_name='Notities intake-uitkomst')
    intake_outcome_recorded_at = models.DateTimeField(null=True, blank=True, verbose_name='Intake-uitkomst vastgelegd op')
    intake_outcome_recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_intake_outcomes',
        verbose_name='Intake-uitkomst vastgelegd door',
    )
    
    # ── Urgency validation (gemeente-controlled) ──────────────────────────────
    # urgency_validated may only be set to True by gemeente users and only when
    # urgency_document is present. When validated, urgency_granted_date drives
    # waitlist priority instead of start_date.
    urgency_validated = models.BooleanField(
        default=False,
        verbose_name='Urgentie gevalideerd',
        help_text='Mag alleen worden ingesteld door gemeente, en alleen als urgentieverklaring is bijgevoegd.',
    )
    urgency_document = models.FileField(
        upload_to='urgency_documents/%Y/%m/',
        null=True,
        blank=True,
        verbose_name='Urgentieverklaring',
        help_text='Verplicht voordat urgentie kan worden gevalideerd.',
    )
    urgency_granted_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Datum urgentieverlening',
        help_text='Datum waarop urgentie door gemeente is vastgesteld. Bepaalt prioriteitsvolgorde bij urgente casussen.',
    )
    urgency_validated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_urgencies',
        verbose_name='Urgentie gevalideerd door',
    )
    urgency_validated_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Urgentie gevalideerd op',
    )

    # ── Arrangement metadata ──────────────────────────────────────────────────
    # Stores the care arrangement details once a placement is confirmed.
    arrangement_type_code = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='Arrangementcode',
        help_text='Bijv. ZIN-dagbehandeling, PGB-ambulant.',
    )
    arrangement_provider = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='Arrangementaanbieder',
        help_text='Naam of referentie van de aanbieder die het arrangement uitvoert.',
    )
    arrangement_end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='Einddatum arrangement',
        help_text='Verwachte of bevestigde einddatum van het zorgtraject.',
    )

    # Legacy fields (kept for migration compatibility)
    transaction_type = models.CharField(max_length=20, blank=True)
    target_company = models.CharField(max_length=200, blank=True)
    deal_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'contracts_caseintakeprocess'
        ordering = ['-created_at']
        verbose_name = 'Intake & Beoordeling'
        verbose_name_plural = 'Intakes & Beoordelingen'

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'

    def save(self, *args, **kwargs):
        # Keep nullable payloads from older form/API clients from violating DB constraints.
        if self.contra_indicaties is None:
            self.contra_indicaties = ''
        if self.problematiek_types is None:
            self.problematiek_types = []
        if self.zorgvorm_gewenst is None:
            self.zorgvorm_gewenst = ''
        if self.setting_voorkeur is None:
            self.setting_voorkeur = ''

        previous_gemeente_id = None
        if self.pk:
            previous_gemeente_id = (
                CaseIntakeProcess.objects
                .filter(pk=self.pk)
                .values_list('gemeente_id', flat=True)
                .first()
            )

        if self.zorgvorm_gewenst and self.preferred_care_form != self.zorgvorm_gewenst:
            self.preferred_care_form = self.zorgvorm_gewenst
        elif not self.zorgvorm_gewenst and self.preferred_care_form:
            self.zorgvorm_gewenst = self.preferred_care_form

        should_resolve_region = (
            bool(self.gemeente_id)
            and (
                not self.regio_id
                or not self.pk
                or previous_gemeente_id != self.gemeente_id
            )
        )

        if should_resolve_region:
            gemeente = self.gemeente
            resolved_region = None
            if gemeente is not None:
                resolved_region = (
                    gemeente.regions.filter(status=RegionalConfiguration.Status.ACTIVE)
                    .order_by('region_type', 'region_name')
                    .first()
                )
                if resolved_region is None:
                    resolved_region = gemeente.regions.order_by('region_type', 'region_name').first()

            self.regio = resolved_region
            if resolved_region and not self.preferred_region_id:
                self.preferred_region = resolved_region
            if resolved_region and not self.preferred_region_type:
                self.preferred_region_type = resolved_region.region_type

        if not self.regio_id and self.preferred_region_id:
            self.regio = self.preferred_region

        super().save(*args, **kwargs)

    def get_latest_assessment(self):
        try:
            return self.case_assessment
        except CaseAssessment.DoesNotExist:
            return None

    def get_latest_placement(self):
        return self.indications.select_related('selected_provider', 'proposed_provider').order_by('-updated_at', '-created_at').first()

    @property
    def is_archived(self):
        return self.status == self.ProcessStatus.ARCHIVED

    def can_enter_matching(self) -> tuple[bool, str]:
        if self.status == self.ProcessStatus.ARCHIVED:
            return False, 'Casus is gearchiveerd.'
        if self.status == self.ProcessStatus.COMPLETED:
            return False, 'Casus is afgerond en kan niet opnieuw naar matching zonder heropening.'
        if self.status == self.ProcessStatus.ON_HOLD:
            return False, 'Casus staat op wacht.'

        assessment = self.get_latest_assessment()
        if assessment is None:
            return False, 'Beoordeling ontbreekt.'
        if assessment.assessment_status != CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING:
            return False, 'Beoordeling moet eerst gereed zijn voor matching.'
        if not assessment.matching_ready:
            return False, 'Beoordeling staat nog niet op gereed voor matching.'
        return True, ''

    def can_start_provider_review(self) -> tuple[bool, str]:
        placement = self.get_latest_placement()
        if placement is None:
            return False, 'Plaatsing ontbreekt.'
        return placement.can_transition_to_status(PlacementRequest.Status.IN_REVIEW)

    def ensure_case_record(self, created_by=None):
        if self.contract_id:
            return self.contract

        risk_map = {
            self.Urgency.LOW: CareCase.RiskLevel.LOW,
            self.Urgency.MEDIUM: CareCase.RiskLevel.MEDIUM,
            self.Urgency.HIGH: CareCase.RiskLevel.HIGH,
            self.Urgency.CRISIS: CareCase.RiskLevel.CRITICAL,
        }
        contract_type_map = {
            self.CareForm.OUTPATIENT: CareCase.ContractType.MSA,
            self.CareForm.DAY_TREATMENT: CareCase.ContractType.SOW,
            self.CareForm.RESIDENTIAL: CareCase.ContractType.LEASE,
            self.CareForm.CRISIS: CareCase.ContractType.NDA,
        }

        region_label = ''
        if self.regio_id and self.regio:
            region_label = self.regio.region_name
        elif self.preferred_region_id and self.preferred_region:
            region_label = self.preferred_region.region_name
        elif self.gemeente_id and self.gemeente:
            region_label = self.gemeente.municipality_name

        case_record = CareCase.objects.create(
            organization=self.organization,
            title=self.title,
            contract_type=contract_type_map.get(self.zorgvorm_gewenst or self.preferred_care_form, CareCase.ContractType.OTHER),
            content=(self.assessment_summary or self.description or '').strip(),
            status=CareCase.Status.PENDING,
            service_region=region_label,
            risk_level=risk_map.get(self.urgency, CareCase.RiskLevel.MEDIUM),
            start_date=self.start_date,
            end_date=self.target_completion_date,
            case_phase=CareCase.CasePhase.INTAKE,
            phase_entered_at=timezone.now(),
            created_by=created_by,
        )
        self.contract = case_record
        super().save(update_fields=['contract'])
        return case_record

    @property
    def case_record(self):
        return self.contract

    @case_record.setter
    def case_record(self, value):
        self.contract = value

    # ── Urgency validation helpers ─────────────────────────────────────────────

    @property
    def urgency_document_present(self) -> bool:
        """True when an urgency document has been uploaded."""
        return bool(self.urgency_document)

    def can_validate_urgency(self) -> tuple[bool, str]:
        """
        Returns (True, '') when urgency validation is allowed.
        Returns (False, reason) when blocked.

        Rules:
        - Document must be present (urgency_document_present)
        - urgency must not already be validated
        """
        if not self.urgency_document_present:
            return False, 'Urgentie vereist een geldige urgentieverklaring'
        if self.urgency_validated:
            return False, 'Urgentie is al gevalideerd'
        return True, ''

    # ── Waitlist priority ─────────────────────────────────────────────────────

    @property
    def waitlist_priority_key(self) -> tuple:
        """
        Returns a sort key for waitlist ordering:
        - Validated urgent cases first, ordered by urgency_granted_date ascending
        - Non-urgent cases second, ordered by start_date ascending (FCFS)

        Lower tuple = higher priority (use with ascending sort).
        """
        from datetime import date as _date
        sentinel_date = _date(9999, 12, 31)

        if self.urgency_validated and self.urgency_granted_date:
            return (0, self.urgency_granted_date, sentinel_date)
        return (1, sentinel_date, self.start_date or sentinel_date)


class IntakeTask(models.Model):
    class TaskStatus(models.TextChoices):
        PENDING = 'PENDING', 'Open'
        IN_PROGRESS = 'IN_PROGRESS', 'In uitvoering'
        COMPLETED = 'COMPLETED', 'Afgerond'
        BLOCKED = 'BLOCKED', 'Geblokkeerd'

    class TaskCategory(models.TextChoices):
        GOVERNANCE = 'GOVERNANCE', 'Regelgeving'
        FINANCIAL = 'FINANCIAL', 'Budget'
        OPERATIONAL = 'OPERATIONAL', 'Operationeel'
        TECHNICAL = 'TECHNICAL', 'Technisch'
        REGULATORY = 'REGULATORY', 'Toetsing'
        COMMERCIAL = 'COMMERCIAL', 'Samenwerking'

    process = models.ForeignKey(CaseIntakeProcess, on_delete=models.CASCADE, related_name='dd_tasks')
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
        db_table = 'contracts_intaketask'
        ordering = ['order', 'due_date']

    def __str__(self):
        return f'{self.process.title} - {self.title}'


class CaseRiskSignal(models.Model):
    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Middel'
        HIGH = 'HIGH', 'Hoog'

    class RiskCategory(models.TextChoices):
        GOVERNANCE = 'GOVERNANCE', 'Regelgeving & toetsing'
        FINANCIAL = 'FINANCIAL', 'Budget'
        OPERATIONAL = 'OPERATIONAL', 'Operationeel'
        REPUTATIONAL = 'REPUTATIONAL', 'Reputatie'
        STRATEGIC = 'STRATEGIC', 'Strategisch'

    process = models.ForeignKey(CaseIntakeProcess, on_delete=models.CASCADE, related_name='dd_risks')
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

    class Meta:
        db_table = 'contracts_caserisksignal'

    def __str__(self):
        return f'{self.process.title} - {self.title} ({self.risk_level})'


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
        'CaseIntakeProcess',
        blank=True,
        related_name='capacity_budgets',
        verbose_name='Gekoppelde casussen'
    )
    linked_placements = models.ManyToManyField(
        'PlacementRequest',
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
    province = models.CharField(max_length=100, blank=True, default='', verbose_name='Provincie')
    
    # Configuration management
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, verbose_name='Status')
    
    # Care configuration
    care_domains = models.ManyToManyField(CareCategoryMain, blank=True, related_name='municipality_configs', verbose_name='Zorgdomeinen')
    linked_providers = models.ManyToManyField(Client, blank=True, related_name='municipality_configs', verbose_name='Gekoppelde aanbieders')
    
    # Performance management
    max_wait_days = models.PositiveIntegerField(null=True, blank=True, verbose_name='Maximale wachttijd (dagen)')
    priority_rules = models.TextField(blank=True, verbose_name='Prioriteringsregels')
    
    # Contact & administration
    responsible_coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='municipality_configs',
        verbose_name='Verantwoordelijke',
    )
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
    region_type = models.CharField(
        max_length=20,
        choices=RegionType.choices,
        default=RegionType.GEMEENTELIJK,
        db_index=True,
        verbose_name='Regiotype',
    )
    region_name = models.CharField(max_length=150, verbose_name='Regio')
    region_code = models.CharField(max_length=50, blank=True, verbose_name='Regiode')
    province = models.CharField(max_length=100, blank=True, default='', verbose_name='Provincie')
    
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
    responsible_coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='regional_configs',
        verbose_name='Verantwoordelijke',
    )
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
        return f'{self.region_name} ({self.get_region_type_display().lower()})'

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


# ============================================
# DECISION QUALITY LAYER (PILOT EVALUATION)
# ============================================

class DecisionQualityReview(models.Model):
    """Pilot-focused decision quality evaluation.

    This model enables structured review of system recommendations vs actual user
    decisions. It captures snapshots of the decision context, outcome assessment,
    override patterns, and reasons for divergence. Used for weekly pilot reviews
    and quality metrics aggregation.

    All data is stored as snapshots to avoid future drift as operational data
    changes. This model is *reference-only* and should not affect operational
    workflows or reconciliation logic.

    Governance alignment: implicitly references CaseDecisionLog entries via
    case_id and placement_id; actor attribution preserved via reviewed_by.
    """

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
        'CaseIntakeProcess',
        on_delete=models.PROTECT,
        related_name='quality_reviews',
        help_text='Case being reviewed',
    )
    placement = models.ForeignKey(
        'PlacementRequest',
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
        'CaseIntakeProcess',
        on_delete=models.CASCADE,
        related_name='decision_quality_review_marks',
    )
    placement = models.ForeignKey(
        'PlacementRequest',
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


# Legacy model aliases removed. Use canonical Care* / Intake* / Placement* symbols.


# ============================================================
# PROVIDER DATA PIPELINE — CANONICAL INTERNAL MODEL
# UI and matching engine MUST read exclusively from these tables.
# External data is never promoted directly; always flows through staging.
# ============================================================

import hashlib
import json as _json


class Zorgaanbieder(models.Model):
    """Canonical provider entity. System of record for all provider data."""

    class ProviderType(models.TextChoices):
        RESIDENTIEEL = 'RESIDENTIEEL', 'Residentiële zorg'
        AMBULANT = 'AMBULANT', 'Ambulante begeleiding'
        DAGBEHANDELING = 'DAGBEHANDELING', 'Dagbehandeling'
        THUISBEGELEIDING = 'THUISBEGELEIDING', 'Thuisbegeleiding'
        CRISISOPVANG = 'CRISISOPVANG', 'Crisisopvang'
        OVERIG = 'OVERIG', 'Overig'

    class TrustLevel(models.TextChoices):
        VERIFIED = 'VERIFIED', 'Geverifieerd'
        PROVISIONAL = 'PROVISIONAL', 'Voorlopig'
        UNVERIFIED = 'UNVERIFIED', 'Niet geverifieerd'
        SUSPENDED = 'SUSPENDED', 'Opgeschort'

    class NormalisatieStatus(models.TextChoices):
        PENDING = 'PENDING', 'Wacht op normalisatie'
        NORMALIZED = 'NORMALIZED', 'Genormaliseerd'
        PARTIAL = 'PARTIAL', 'Gedeeltelijk genormaliseerd'
        FAILED = 'FAILED', 'Normalisatie mislukt'

    class ReviewStatus(models.TextChoices):
        PENDING = 'PENDING', 'Wacht op review'
        APPROVED = 'APPROVED', 'Goedgekeurd'
        FLAGGED = 'FLAGGED', 'Gemarkeerd voor controle'
        REJECTED = 'REJECTED', 'Afgewezen'

    class BronType(models.TextChoices):
        MANUAL = 'manual', 'Handmatig ingevoerd'
        SEEDED = 'seeded', 'Seed data'
        CSV_IMPORT = 'csv_import', 'CSV import'
        API = 'api', 'API synchronisatie'

    # Canonical identifier — AGB-code when available, else system UUID
    canonical_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    agb_code = models.CharField(max_length=20, blank=True, db_index=True,
                                help_text='AGB-code als extern primair sleutel')
    kvk_number = models.CharField(max_length=20, blank=True, db_index=True)
    name = models.CharField(max_length=300)
    short_name = models.CharField(max_length=100, blank=True)
    handelsnaam = models.CharField(max_length=300, blank=True,
                                   help_text='Handelsnaam zoals geregistreerd bij KVK')
    omschrijving_kort = models.TextField(blank=True,
                                         help_text='Korte beschrijving voor matching context')
    provider_type = models.CharField(max_length=30, choices=ProviderType.choices,
                                     default=ProviderType.OVERIG)
    trust_level = models.CharField(max_length=20, choices=TrustLevel.choices,
                                   default=TrustLevel.PROVISIONAL)
    is_active = models.BooleanField(default=True)
    landelijk_dekkend = models.BooleanField(default=False,
                                            help_text='Aanbieder is nationaal actief')
    logo = models.CharField(max_length=500, blank=True,
                             help_text='URL of pad naar logo-afbeelding')
    website = models.URLField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)

    # -----------------------------------------------------------------------
    # Source traceability
    # -----------------------------------------------------------------------
    last_source_system = models.CharField(max_length=100, blank=True)
    last_import_batch = models.ForeignKey(
        'ProviderImportBatch',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_providers',
    )
    bron_type = models.CharField(
        max_length=20, choices=BronType.choices,
        default=BronType.MANUAL, blank=True,
        help_text='Herkomst van de data',
    )
    bron_id = models.CharField(max_length=200, blank=True,
                               help_text='Primaire sleutel in het bronsysteem')
    bron_laatst_gesynchroniseerd_op = models.DateTimeField(
        null=True, blank=True,
        help_text='Tijdstip van de laatste synchronisatie vanuit bron',
    )

    # -----------------------------------------------------------------------
    # Internal quality flags
    # -----------------------------------------------------------------------
    is_handmatig_verrijkt = models.BooleanField(
        default=False,
        help_text='Intern verrijkt door een medewerker (niet overschrijfbaar door import)',
    )
    is_handmatig_overschreven = models.BooleanField(
        default=False,
        help_text='Veld(en) handmatig overschreven — beschermd tegen automatische sync',
    )
    normalisatie_status = models.CharField(
        max_length=20, choices=NormalisatieStatus.choices,
        default=NormalisatieStatus.PENDING,
    )
    review_status = models.CharField(
        max_length=20, choices=ReviewStatus.choices,
        default=ReviewStatus.PENDING,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_zorgaanbieder'
        ordering = ['name']
        indexes = [
            models.Index(fields=['agb_code']),
            models.Index(fields=['kvk_number']),
            models.Index(fields=['trust_level', 'is_active']),
        ]

    def __str__(self):
        return f'{self.name} ({self.agb_code or self.canonical_id})'


class AanbiederVestiging(models.Model):
    """Physical location/branch of a Zorgaanbieder."""

    zorgaanbieder = models.ForeignKey(
        Zorgaanbieder, on_delete=models.CASCADE, related_name='vestigingen'
    )
    vestiging_code = models.CharField(max_length=50, blank=True, db_index=True,
                                      help_text='Externe vestigingscode')
    name = models.CharField(max_length=300, blank=True)
    agb_code_vestiging = models.CharField(max_length=20, blank=True, db_index=True,
                                          help_text='AGB-code specifiek voor deze vestiging')
    # Address fields — straat/huisnummer stored separately for geocoding
    straat = models.CharField(max_length=200, blank=True)
    huisnummer = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=500, blank=True,
                               help_text='Volledig adres (legacy/fallback)')
    city = models.CharField(max_length=100, blank=True)
    postcode = models.CharField(max_length=10, blank=True)
    gemeente = models.CharField(max_length=100, blank=True,
                                help_text='Gemeente (officieel)')
    provincie = models.CharField(max_length=100, blank=True)
    region = models.CharField(max_length=100, blank=True,
                              help_text='Canonical regio code')
    regio_jeugd = models.CharField(max_length=100, blank=True,
                                   help_text='Jeugdzorg regio-indeling')
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    telefoon_vestiging = models.CharField(max_length=30, blank=True)
    email_vestiging = models.EmailField(blank=True)
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    # Bron traceability
    bron_type = models.CharField(max_length=20, blank=True)
    bron_id = models.CharField(max_length=200, blank=True)
    bron_laatst_gesynchroniseerd_op = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_aanbiedervestiging'
        ordering = ['zorgaanbieder__name', 'city']
        unique_together = [('zorgaanbieder', 'vestiging_code')]

    def __str__(self):
        return f'{self.zorgaanbieder.name} — {self.city or self.vestiging_code}'


class Zorgprofiel(models.Model):
    """
    Care profile — primary matching entity.

    Can be linked at vestiging level (preferred) or organization level (legacy v1 pipeline).
    A vestiging can have multiple profiles for different care forms.
    """

    # Primary FK: vestiging-level profile (preferred for new records)
    aanbieder_vestiging = models.ForeignKey(
        AanbiederVestiging,
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='zorgprofielen',
        help_text='Vestiging waaraan dit profiel gekoppeld is',
    )
    # Legacy FK: organization-level profile (backward compat with v1 pipeline)
    zorgaanbieder = models.ForeignKey(
        Zorgaanbieder,
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='zorgprofielen',
        help_text='Zorgaanbieder op organisatieniveau',
    )

    # -------------------------------------------------------------------
    # Care form and domain
    # -------------------------------------------------------------------
    zorgvorm = models.CharField(max_length=50, blank=True,
                                help_text='Primaire zorgvorm: ambulant, residentieel, etc.')
    zorgdomein = models.CharField(max_length=100, blank=True,
                                  help_text='Zorgdomein: jeugd, volwassenen, lvb, etc.')

    # -------------------------------------------------------------------
    # Target group
    # -------------------------------------------------------------------
    doelgroep_leeftijd_van = models.PositiveSmallIntegerField(null=True, blank=True)
    doelgroep_leeftijd_tot = models.PositiveSmallIntegerField(null=True, blank=True)
    geslacht_beperking = models.CharField(max_length=20, blank=True)

    # -------------------------------------------------------------------
    # Problematiek and clinical suitability
    # -------------------------------------------------------------------
    problematiek_types = models.JSONField(default=list, blank=True,
                                          help_text='Lijst van behandelde problematiek-types')
    contra_indicaties = models.TextField(blank=True)
    intensiteit = models.CharField(max_length=50, blank=True,
                                   help_text='licht / middel / intensief / hoog_intensief')
    setting_type = models.CharField(max_length=50, blank=True,
                                    help_text='open / besloten / semi_besloten')

    # Clinical suitability flags
    crisis_opvang_mogelijk = models.BooleanField(default=False)
    lvb_geschikt = models.BooleanField(default=False)
    autisme_geschikt = models.BooleanField(default=False)
    trauma_geschikt = models.BooleanField(default=False)
    ggz_comorbiditeit_mogelijk = models.BooleanField(default=False)
    verslavingsproblematiek_mogelijk = models.BooleanField(default=False)
    veiligheidsrisico_hanteerbaar = models.BooleanField(default=False)
    omschrijving_match_context = models.TextField(blank=True)

    # -------------------------------------------------------------------
    # Care forms (v1 compat — kept for pipeline backward compat)
    # -------------------------------------------------------------------
    biedt_ambulant = models.BooleanField(default=False)
    biedt_dagbehandeling = models.BooleanField(default=False)
    biedt_residentieel = models.BooleanField(default=False)
    biedt_crisis = models.BooleanField(default=False)
    biedt_thuisbegeleiding = models.BooleanField(default=False)

    # Age groups served (v1 compat)
    leeftijd_0_4 = models.BooleanField(default=False)
    leeftijd_4_12 = models.BooleanField(default=False)
    leeftijd_12_18 = models.BooleanField(default=False)
    leeftijd_18_plus = models.BooleanField(default=False)

    # Complexity levels (v1 compat)
    complexiteit_enkelvoudig = models.BooleanField(default=False)
    complexiteit_meervoudig = models.BooleanField(default=False)
    complexiteit_zwaar = models.BooleanField(default=False)

    # Urgency levels (v1 compat)
    urgentie_laag = models.BooleanField(default=False)
    urgentie_middel = models.BooleanField(default=False)
    urgentie_hoog = models.BooleanField(default=False)
    urgentie_crisis = models.BooleanField(default=False)

    # Region scope
    regio_codes = models.CharField(max_length=1000, blank=True,
                                   help_text='Kommagescheiden canonieke regiocodes')
    specialisaties = models.TextField(blank=True)
    actief = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_zorgprofiel'
        indexes = [
            models.Index(fields=['aanbieder_vestiging']),
            models.Index(fields=['zorgaanbieder']),
            models.Index(fields=['zorgvorm']),
        ]

    def __str__(self):
        owner = self.aanbieder_vestiging or self.zorgaanbieder
        return f'Zorgprofiel: {owner}'


class CapaciteitRecord(models.Model):
    """
    Point-in-time capacity snapshot per vestiging.
    Appended on every sync; never overwritten — provides full history.
    """

    vestiging = models.ForeignKey(
        AanbiederVestiging, on_delete=models.CASCADE, related_name='capaciteit_records'
    )
    import_batch = models.ForeignKey(
        'ProviderImportBatch', on_delete=models.CASCADE, related_name='capaciteit_records'
    )
    # Optional link to specific care profile
    zorgprofiel = models.ForeignKey(
        'Zorgprofiel', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='capaciteit_records',
    )
    # v1 compat fields — kept for existing pipeline
    open_slots = models.PositiveIntegerField(default=0)
    waiting_list_size = models.PositiveIntegerField(default=0)
    avg_wait_days = models.PositiveIntegerField(default=0)
    max_capacity = models.PositiveIntegerField(default=0)
    recorded_at = models.DateTimeField(default=timezone.now)

    # Extended capacity fields
    capaciteit_type = models.CharField(max_length=50, blank=True,
                                       help_text='totaal / residentieel / ambulant / dagbehandeling')
    totale_capaciteit = models.PositiveIntegerField(default=0)
    beschikbare_capaciteit = models.PositiveIntegerField(default=0)
    wachtlijst_aantal = models.PositiveIntegerField(default=0)
    gemiddelde_wachttijd_dagen = models.PositiveIntegerField(default=0)
    direct_pleegbaar = models.BooleanField(default=False)
    beschikbaar_vanaf = models.DateField(null=True, blank=True)
    toelichting_capaciteit = models.TextField(blank=True)
    betrouwbaarheid_score = models.FloatField(
        null=True, blank=True,
        help_text='0.0–1.0; betrouwbaarheid van de capaciteitsopgave',
    )
    laatst_bijgewerkt_op = models.DateTimeField(null=True, blank=True)
    laatst_bijgewerkt_door = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'provider_capaciteitrecord'
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['vestiging', '-recorded_at']),
            models.Index(fields=['import_batch']),
            models.Index(fields=['zorgprofiel', '-recorded_at']),
        ]

    def __str__(self):
        return (
            f'{self.vestiging} — {self.open_slots} open / '
            f'{self.waiting_list_size} wachtend ({self.recorded_at:%Y-%m-%d})'
        )


class ContractRelatie(models.Model):
    """
    Contractual relationship between a Zorgaanbieder and an Organization (gemeente).
    UI reads this to filter providers per organisation context.
    """

    class ContractStatus(models.TextChoices):
        ACTIEF = 'ACTIEF', 'Actief'
        VERLOPEN = 'VERLOPEN', 'Verlopen'
        OPGESCHORT = 'OPGESCHORT', 'Opgeschort'
        CONCEPT = 'CONCEPT', 'Concept'

    zorgaanbieder = models.ForeignKey(
        Zorgaanbieder, on_delete=models.CASCADE, related_name='contract_relaties'
    )
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='provider_contracten'
    )
    contract_type = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=ContractStatus.choices,
                               default=ContractStatus.ACTIEF)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    # Extended contract fields
    gemeente = models.CharField(max_length=200, blank=True,
                                help_text='Gemeente als tekst (naast Organization FK)')
    regio = models.CharField(max_length=200, blank=True)
    zorgvormen_contract = models.JSONField(default=list, blank=True,
                                           help_text='Gecontracteerde zorgvormen')
    actief_contract = models.BooleanField(default=True)
    voorkeursaanbieder = models.BooleanField(
        default=False,
        help_text='Aanbieder is voorkeursaanbieder voor deze gemeente/regio',
    )
    opmerkingen_contract = models.TextField(blank=True)

    # Traceability
    import_batch = models.ForeignKey(
        'ProviderImportBatch', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='contract_relaties'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_contractrelatie'
        unique_together = [('zorgaanbieder', 'organization', 'contract_type')]
        ordering = ['-start_date']

    def __str__(self):
        return f'{self.zorgaanbieder.name} ↔ {self.organization.name} ({self.status})'


class ProviderRegioDekking(models.Model):
    """Actieve regiodekking per aanbieder/vestiging voor matching."""

    class DekkingStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Actief'
        INACTIVE = 'INACTIVE', 'Inactief'
        DRAFT = 'DRAFT', 'Concept'
        SUSPENDED = 'SUSPENDED', 'Opgeschort'

    class BronType(models.TextChoices):
        MANUAL = 'manual', 'Handmatig ingevoerd'
        SEEDED = 'seeded', 'Seed data'
        CSV_IMPORT = 'csv_import', 'CSV import'
        API = 'api', 'API synchronisatie'

    zorgaanbieder = models.ForeignKey(
        Zorgaanbieder,
        on_delete=models.CASCADE,
        related_name='regio_dekkingen',
    )
    aanbieder_vestiging = models.ForeignKey(
        AanbiederVestiging,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='regio_dekkingen',
    )
    regio = models.ForeignKey(
        RegionalConfiguration,
        on_delete=models.CASCADE,
        related_name='provider_dekkingen',
    )
    is_primair_dekkingsgebied = models.BooleanField(default=True)
    zorgvormen = models.JSONField(default=list, blank=True)
    doelgroepen = models.JSONField(default=list, blank=True)
    contract_actief = models.BooleanField(default=True)
    capaciteit_meerekenen = models.BooleanField(default=True)
    reisafstand_score = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text='0.0–1.0 score voor bereikbaarheid/reisafstand.',
    )
    dekking_status = models.CharField(
        max_length=20,
        choices=DekkingStatus.choices,
        default=DekkingStatus.ACTIVE,
    )
    toelichting = models.TextField(blank=True)
    bron_type = models.CharField(
        max_length=20,
        choices=BronType.choices,
        default=BronType.MANUAL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_regiodekking'
        ordering = ['-is_primair_dekkingsgebied', 'regio__region_name', '-updated_at']
        unique_together = [('zorgaanbieder', 'aanbieder_vestiging', 'regio')]
        indexes = [
            models.Index(fields=['zorgaanbieder', 'regio', 'dekking_status']),
            models.Index(fields=['regio', 'contract_actief']),
        ]

    def __str__(self):
        vestiging = self.aanbieder_vestiging.name if self.aanbieder_vestiging else 'alle vestigingen'
        return f'{self.zorgaanbieder.name} · {self.regio.region_name} · {vestiging}'


# ============================================================
# PROVIDER DATA PIPELINE — STAGING / IMPORT LAYER
# ============================================================

class ProviderImportBatch(models.Model):
    """
    Metadata record for one import run from one source system.
    Immutable after completion — never edit a finished batch.
    """

    class BatchStatus(models.TextChoices):
        PENDING = 'PENDING', 'In wachtrij'
        RUNNING = 'RUNNING', 'Bezig'
        COMPLETED = 'COMPLETED', 'Voltooid'
        PARTIAL = 'PARTIAL', 'Deels voltooid'
        FAILED = 'FAILED', 'Mislukt'

    batch_ref = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    source_system = models.CharField(max_length=100,
                                     help_text='Identifier van het bronsysteem (bijv. "agbregister_v2")')
    source_version = models.CharField(max_length=50, blank=True)
    triggered_by = models.CharField(max_length=200, blank=True,
                                    help_text='Gebruiker of scheduler die de import gestart heeft')
    status = models.CharField(max_length=20, choices=BatchStatus.choices,
                               default=BatchStatus.PENDING)
    total_records = models.PositiveIntegerField(default=0)
    processed_records = models.PositiveIntegerField(default=0)
    created_records = models.PositiveIntegerField(default=0)
    updated_records = models.PositiveIntegerField(default=0)
    skipped_records = models.PositiveIntegerField(default=0)
    conflicted_records = models.PositiveIntegerField(default=0)
    quarantined_records = models.PositiveIntegerField(default=0)
    error_summary = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_importbatch'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['source_system', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'Batch {self.batch_ref} [{self.source_system}] {self.status}'


class BronImportBatch(models.Model):
    """Named staging batch entity for datasource imports (CSV/API/manual)."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'In wachtrij'
        RUNNING = 'RUNNING', 'Bezig'
        COMPLETED = 'COMPLETED', 'Voltooid'
        PARTIAL = 'PARTIAL', 'Deels voltooid'
        FAILED = 'FAILED', 'Mislukt'

    provider_batch = models.OneToOneField(
        ProviderImportBatch,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='bron_batch',
    )
    bron_type = models.CharField(max_length=50)
    batch_naam = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    gestart_op = models.DateTimeField(null=True, blank=True)
    afgerond_op = models.DateTimeField(null=True, blank=True)
    totaal_records = models.PositiveIntegerField(default=0)
    geslaagd_records = models.PositiveIntegerField(default=0)
    gefaald_records = models.PositiveIntegerField(default=0)
    warnings_count = models.PositiveIntegerField(default=0)
    foutenlog = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_bronimportbatch'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['bron_type', '-created_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'BronBatch {self.batch_naam} [{self.bron_type}] {self.status}'


class BronRecordRaw(models.Model):
    """Immutable raw source records linked to a BronImportBatch."""

    import_batch = models.ForeignKey(
        BronImportBatch,
        on_delete=models.CASCADE,
        related_name='raw_records',
    )
    external_source = models.CharField(max_length=100)
    external_id = models.CharField(max_length=200, db_index=True)
    payload_json = models.JSONField()
    record_hash = models.CharField(max_length=64, db_index=True)
    normalisatie_status = models.CharField(max_length=20, default='PENDING')
    foutmelding = models.TextField(blank=True)
    verwerkt_op = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_bronrecordraw'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['import_batch', 'external_id']),
            models.Index(fields=['external_source']),
            models.Index(fields=['normalisatie_status']),
        ]

    def __str__(self):
        return f'BronRecord {self.external_source}:{self.external_id} ({self.normalisatie_status})'


class BronSyncLog(models.Model):
    """Datasource sync log with canonical entity references."""

    bron_type = models.CharField(max_length=50)
    external_id = models.CharField(max_length=200, blank=True)
    interne_entiteit_type = models.CharField(max_length=100)
    interne_entiteit_id = models.CharField(max_length=100, blank=True)
    actie = models.CharField(max_length=30)
    status = models.CharField(max_length=30)
    melding = models.TextField(blank=True)
    uitgevoerd_op = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_bronsynclog'
        ordering = ['-uitgevoerd_op']
        indexes = [
            models.Index(fields=['bron_type', '-uitgevoerd_op']),
            models.Index(fields=['interne_entiteit_type', 'interne_entiteit_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'BronSync {self.bron_type}:{self.external_id} {self.actie}/{self.status}'


class ProviderStagingRecord(models.Model):
    """
    Raw immutable record landed from external source.
    Never mutated after insert — serves as audit evidence and replay source.
    """

    class ValidationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Wacht op validatie'
        VALID = 'VALID', 'Geldig'
        INVALID = 'INVALID', 'Ongeldig'
        QUARANTINED = 'QUARANTINED', 'In quarantaine'
        PROMOTED = 'PROMOTED', 'Gepromoveerd naar canoniek'
        CONFLICTED = 'CONFLICTED', 'Conflict gedetecteerd'

    batch = models.ForeignKey(
        ProviderImportBatch, on_delete=models.CASCADE, related_name='staging_records'
    )
    # External identity fields — used for entity resolution
    source_id = models.CharField(max_length=200, db_index=True,
                                 help_text='Primaire sleutel in het bronsysteem')
    source_agb_code = models.CharField(max_length=20, blank=True, db_index=True)
    source_kvk = models.CharField(max_length=20, blank=True)

    # Raw payload — immutable after insert
    raw_payload = models.JSONField(help_text='Onbewerkte data van het bronsysteem')

    # Fingerprint for change detection (SHA-256 of sorted raw_payload)
    payload_fingerprint = models.CharField(max_length=64, db_index=True)

    validation_status = models.CharField(
        max_length=20, choices=ValidationStatus.choices,
        default=ValidationStatus.PENDING
    )
    validation_errors = models.JSONField(default=list, blank=True)
    confidence_score = models.FloatField(default=1.0,
                                         help_text='0.0–1.0; lager = minder betrouwbaar')

    # Link to canonical record after promotion
    canonical_provider = models.ForeignKey(
        Zorgaanbieder, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='staging_records'
    )

    ingested_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_stagingrecord'
        ordering = ['-ingested_at']
        indexes = [
            models.Index(fields=['batch', 'source_id']),
            models.Index(fields=['source_agb_code']),
            models.Index(fields=['validation_status']),
            models.Index(fields=['payload_fingerprint']),
        ]

    def __str__(self):
        return f'StagingRecord {self.source_id} [{self.batch.source_system}] {self.validation_status}'

    @staticmethod
    def compute_fingerprint(raw_payload: dict) -> str:
        serialised = _json.dumps(raw_payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(serialised.encode()).hexdigest()


class ProviderSyncLog(models.Model):
    """
    Audit log entry per staging record per canonical entity.
    Records the action taken and field-level diffs.
    """

    class SyncAction(models.TextChoices):
        CREATED = 'CREATED', 'Aangemaakt'
        UPDATED = 'UPDATED', 'Bijgewerkt'
        SKIPPED = 'SKIPPED', 'Overgeslagen (geen wijziging)'
        CONFLICTED = 'CONFLICTED', 'Conflict — wacht op resolutie'
        QUARANTINED = 'QUARANTINED', 'In quarantaine geplaatst'

    staging_record = models.ForeignKey(
        ProviderStagingRecord, on_delete=models.CASCADE, related_name='sync_logs'
    )
    canonical_provider = models.ForeignKey(
        Zorgaanbieder, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='sync_logs'
    )
    action = models.CharField(max_length=20, choices=SyncAction.choices)
    field_diffs = models.JSONField(default=dict, blank=True,
                                   help_text='{"field": {"from": old, "to": new}}')
    message = models.TextField(blank=True)
    logged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_synclog'
        ordering = ['-logged_at']
        indexes = [
            models.Index(fields=['canonical_provider', '-logged_at']),
            models.Index(fields=['action']),
        ]

    def __str__(self):
        return f'SyncLog {self.action} — {self.staging_record.source_id} @ {self.logged_at:%Y-%m-%d %H:%M}'


class ProviderSyncConflict(models.Model):
    """
    A field-level conflict between incoming source data and the current canonical value.
    Requires manual resolution or auto-resolution via policy.
    """

    class ResolutionStatus(models.TextChoices):
        UNRESOLVED = 'UNRESOLVED', 'Niet opgelost'
        ACCEPTED_SOURCE = 'ACCEPTED_SOURCE', 'Bronwaarde geaccepteerd'
        ACCEPTED_CANONICAL = 'ACCEPTED_CANONICAL', 'Canonieke waarde behouden'
        MANUAL = 'MANUAL', 'Handmatig opgelost'

    staging_record = models.ForeignKey(
        ProviderStagingRecord, on_delete=models.CASCADE, related_name='conflicts'
    )
    canonical_provider = models.ForeignKey(
        Zorgaanbieder, on_delete=models.CASCADE, related_name='conflicts'
    )
    field_name = models.CharField(max_length=100)
    source_value = models.TextField()
    canonical_value = models.TextField()
    resolution_status = models.CharField(
        max_length=25, choices=ResolutionStatus.choices,
        default=ResolutionStatus.UNRESOLVED
    )
    resolved_by = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='resolved_conflicts'
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_syncconflict'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['resolution_status']),
            models.Index(fields=['canonical_provider', 'field_name']),
        ]

    def __str__(self):
        return (
            f'Conflict {self.field_name} — {self.canonical_provider.name} '
            f'[{self.resolution_status}]'
        )


# ============================================================
# NEW PROVIDER DOMAIN MODELS — v2 architecture
# ============================================================


class PrestatieProfiel(models.Model):
    """
    Performance profile per Zorgprofiel.

    Computed periodically from completed plaatsing/intake cycles.
    Protected field — never overwritten by external sync.
    """

    zorgprofiel = models.OneToOneField(
        Zorgprofiel,
        on_delete=models.CASCADE,
        related_name='prestatie_profiel',
    )
    aantal_matches = models.PositiveIntegerField(default=0)
    aantal_plaatsingen = models.PositiveIntegerField(default=0)
    aantal_afwijzingen = models.PositiveIntegerField(default=0)
    succesratio_match_naar_plaatsing = models.FloatField(
        null=True, blank=True,
        help_text='Ratio matches die leiden tot plaatsing (0.0–1.0)',
    )
    gemiddelde_reactietijd_uren = models.FloatField(
        null=True, blank=True,
        help_text='Gemiddelde reactietijd van aanbieder na match-verzoek',
    )
    gemiddelde_doorlooptijd_dagen = models.FloatField(
        null=True, blank=True,
        help_text='Gemiddelde doorlooptijd van plaatsing (eerste contact tot start)',
    )
    intake_no_show_ratio = models.FloatField(
        null=True, blank=True,
        help_text='Fractie intakes waarbij cliënt niet verschijnt',
    )
    plaatsing_voortijdig_beeindigd_ratio = models.FloatField(
        null=True, blank=True,
        help_text='Fractie plaatsingen voortijdig beëindigd',
    )
    kwalitatieve_opmerking = models.TextField(blank=True)
    laatst_berekend_op = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_prestatieprofilerel'
        verbose_name = 'Prestatieprofiel'
        verbose_name_plural = 'Prestatieprofielen'

    def __str__(self):
        return f'Prestaties: {self.zorgprofiel}'


class ContactpersoonAanbieder(models.Model):
    """Contact person at a provider — for match/contract/intake communication."""

    zorgaanbieder = models.ForeignKey(
        Zorgaanbieder,
        on_delete=models.CASCADE,
        related_name='contactpersonen',
    )
    aanbieder_vestiging = models.ForeignKey(
        AanbiederVestiging,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='contactpersonen',
    )
    naam = models.CharField(max_length=200)
    functie = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    telefoon = models.CharField(max_length=30, blank=True)
    is_primair_match_contact = models.BooleanField(default=False)
    is_primair_contract_contact = models.BooleanField(default=False)
    is_primair_intake_contact = models.BooleanField(default=False)
    actief = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'provider_contactpersoon'
        ordering = ['naam']
        indexes = [
            models.Index(fields=['zorgaanbieder', 'actief']),
        ]

    def __str__(self):
        return f'{self.naam} ({self.functie}) — {self.zorgaanbieder.name}'


class BronMappingIssue(models.Model):
    """
    Mapping/normalization issue identified during CSV/API import.

    Different from ProviderSyncConflict (which is about canonical field conflicts).
    BronMappingIssue covers cases where a source field could not be mapped to
    a canonical field at all, or the mapping is ambiguous.
    """

    class IssueType(models.TextChoices):
        UNKNOWN_VALUE = 'UNKNOWN_VALUE', 'Onbekende bronwaarde'
        AMBIGUOUS_MAPPING = 'AMBIGUOUS_MAPPING', 'Ambigue mapping'
        MISSING_FIELD = 'MISSING_FIELD', 'Verplicht veld ontbreekt'
        TYPE_MISMATCH = 'TYPE_MISMATCH', 'Type mismatch'
        FORMAT_ERROR = 'FORMAT_ERROR', 'Formaat fout'
        CUSTOM = 'CUSTOM', 'Overig'

    import_batch = models.ForeignKey(
        BronImportBatch,
        on_delete=models.CASCADE,
        related_name='mapping_issues',
    )
    external_id = models.CharField(max_length=200, blank=True)
    issue_type = models.CharField(max_length=30, choices=IssueType.choices)
    veldnaam = models.CharField(max_length=100, blank=True,
                                help_text='Naam van het bronveld dat het issue veroorzaakte')
    bronwaarde = models.TextField(blank=True)
    voorgestelde_mapping = models.TextField(
        blank=True,
        help_text='Aanbevolen mapping-aanpassing (handmatig ingevuld of door systeem)',
    )
    opgelost = models.BooleanField(default=False)
    opgelost_op = models.DateTimeField(null=True, blank=True)
    opgelost_door = models.ForeignKey(
        User,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='opgeloste_mapping_issues',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_bronmappingissue'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['import_batch', 'opgelost']),
            models.Index(fields=['issue_type']),
        ]

    def __str__(self):
        return f'MappingIssue [{self.issue_type}] {self.veldnaam}={self.bronwaarde!r}'


class MatchResultaat(models.Model):
    """
    Matching decision output: one record per provider candidate per casus.

    Created by the matching engine. Read-only after creation.
    Protected — never overwritten by external sync.
    """

    class ConfidenceLabel(models.TextChoices):
        HOOG = 'HOOG', 'Hoge zekerheid'
        MIDDEL = 'MIDDEL', 'Gemiddelde zekerheid'
        LAAG = 'LAAG', 'Lage zekerheid'
        ONZEKER = 'ONZEKER', 'Onzeker — data onvolledig'

    # Case reference — FK to CareCase when available, else raw ID
    casus = models.ForeignKey(
        'CareCase',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='match_resultaten',
    )
    casus_id_extern = models.CharField(
        max_length=100, blank=True,
        help_text='Casusidentificatie wanneer geen FK beschikbaar',
    )

    # Matched provider
    zorgprofiel = models.ForeignKey(
        Zorgprofiel,
        on_delete=models.CASCADE,
        related_name='match_resultaten',
    )
    zorgaanbieder = models.ForeignKey(
        Zorgaanbieder,
        on_delete=models.CASCADE,
        related_name='match_resultaten',
    )

    # -----------------------------------------------------------------------
    # Score components (each 0.0–1.0)
    # -----------------------------------------------------------------------
    totaalscore = models.FloatField(default=0.0, help_text='Gewogen totaalscore 0.0–1.0')
    score_inhoudelijke_fit = models.FloatField(default=0.0)
    score_capaciteit = models.FloatField(default=0.0)
    score_contract_regio = models.FloatField(default=0.0)
    score_complexiteit = models.FloatField(default=0.0)
    score_performance = models.FloatField(default=0.0)
    score_regio_contract_fit = models.FloatField(default=0.0)
    score_capaciteit_wachttijd_fit = models.FloatField(default=0.0)
    score_complexiteit_veiligheid_fit = models.FloatField(default=0.0)
    score_performance_fit = models.FloatField(default=0.0)

    # -----------------------------------------------------------------------
    # Explainability
    # -----------------------------------------------------------------------
    confidence_label = models.CharField(
        max_length=10, choices=ConfidenceLabel.choices,
        default=ConfidenceLabel.ONZEKER,
    )
    fit_samenvatting = models.TextField(
        blank=True,
        help_text='Mensleesbare samenvatting van de match-redenering',
    )
    trade_offs = models.JSONField(
        default=list, blank=True,
        help_text='Lijst van trade-offs: [{"factor": "...", "toelichting": "..."}]',
    )
    verificatie_advies = models.TextField(
        blank=True,
        help_text='Aanbeveling voor verificatie-stap voor een coördinator',
    )

    # -----------------------------------------------------------------------
    # Exclusion
    # -----------------------------------------------------------------------
    uitgesloten = models.BooleanField(default=False)
    uitsluitreden = models.CharField(max_length=200, blank=True)

    ranking = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Rangorde binnen de kandidatenlijst voor deze casus',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'provider_matchresultaat'
        ordering = ['ranking', '-totaalscore']
        indexes = [
            models.Index(fields=['casus', 'ranking']),
            models.Index(fields=['zorgaanbieder', '-totaalscore']),
            models.Index(fields=['uitgesloten']),
        ]

    def __str__(self):
        return (
            f'Match #{self.ranking}: {self.zorgaanbieder.name} '
            f'(score {self.totaalscore:.2f}) casus={self.casus_id or self.casus_id_extern}'
        )

    @property
    def casus_id(self):
        return self.casus.pk if self.casus else None
