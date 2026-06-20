from django.db import models
from django.contrib.auth import get_user_model
from decimal import Decimal
from datetime import date

User = get_user_model()


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

    organization = models.ForeignKey('contracts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='clients')
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
    target_care_categories = models.ManyToManyField('contracts.CareCategoryMain', blank=True, related_name='provider_profiles',
                                                     verbose_name='Zorgvraagcategorieën')
    target_care_subcategories = models.ManyToManyField(
        'contracts.CareCategorySubcategory',
        blank=True,
        related_name='provider_profiles',
        verbose_name='Specifieke zorgbehoeften',
    )
    served_regions = models.ManyToManyField(
        'contracts.RegionalConfiguration',
        blank=True,
        related_name='provider_profiles',
        verbose_name='Bediende regio\'s',
    )
    secondary_served_regions = models.ManyToManyField(
        'contracts.RegionalConfiguration',
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
    handles_high_complex = models.BooleanField(default=False, verbose_name='Kan: Hoogcomplex')

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

    organization = models.ForeignKey('contracts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='matters')
    configuration_id = models.CharField(max_length=50, unique=True)
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='matters', null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.GEMEENTE, help_text='Municipality or Regional scope')
    care_domains = models.ManyToManyField('contracts.CareCategoryMain', blank=True, related_name='municipality_configurations')
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
        from contracts.models.care_case import TrustAccount
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
