from django.db import models
from django.contrib.auth import get_user_model

from contracts.models.core import RegionType
from contracts.tenant_scoped import TenantScopedManager

User = get_user_model()


class MunicipalityConfiguration(models.Model):
    """Gemeente-level configuration for care network management"""

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Actief'
        INACTIVE = 'INACTIVE', 'Inactief'
        DRAFT = 'DRAFT', 'Concept'

    organization = models.ForeignKey('contracts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='municipality_configs')

    # Municipality info
    municipality_name = models.CharField(max_length=150, verbose_name='Gemeente')
    municipality_code = models.CharField(max_length=50, blank=True, verbose_name='Gemeentecode')
    brp_code = models.CharField(
        max_length=50,
        blank=True,
        default='',
        db_index=True,
        verbose_name='BRP-code',
    )
    province = models.CharField(max_length=100, blank=True, default='', verbose_name='Provincie')

    # Configuration management
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE, verbose_name='Status')
    active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name='Actief',
        help_text='Afgeleide vlag op basis van status; gebruikt voor snelle filtering.',
    )

    # Care configuration
    care_domains = models.ManyToManyField('contracts.CareCategoryMain', blank=True, related_name='municipality_configs', verbose_name='Zorgdomeinen')
    linked_providers = models.ManyToManyField('contracts.Client', blank=True, related_name='municipality_configs', verbose_name='Gekoppelde aanbieders')

    # Performance management
    max_wait_days = models.PositiveIntegerField(null=True, blank=True, verbose_name='Maximale wachttijd (dagen)')
    priority_rules = models.TextField(blank=True, verbose_name='Prioriteringsregels')
    urgency_document_request_url = models.URLField(
        blank=True,
        default='',
        verbose_name='Link urgentieverklaring aanvragen',
        help_text='Officiële pagina of loket waar een urgentieverklaring aangevraagd kan worden.',
    )

    # Contact & administration
    responsible_coordinator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='municipality_configs',
        verbose_name='Verantwoordelijke',
    )
    woonplaatsbeginsel_contact = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='woonplaatsbeginsel_municipalities',
        verbose_name='Woonplaatsbeginsel contact',
    )
    budget_owner = models.CharField(max_length=200, blank=True, default='', verbose_name='Budgetverantwoordelijke')
    contract_policies = models.JSONField(default=list, blank=True, verbose_name='Contractpolicies')
    notes = models.TextField(blank=True, verbose_name='Notities')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_municipality_configs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        ordering = ['municipality_name']
        verbose_name = 'Gemeente Configuratie'
        verbose_name_plural = 'Gemeente Configuraties'
        unique_together = ('organization', 'municipality_code')

    def __str__(self):
        return self.municipality_name

    def save(self, *args, **kwargs):
        self.active = self.status == self.Status.ACTIVE
        super().save(*args, **kwargs)

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

    organization = models.ForeignKey('contracts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='regional_configs')

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
    active = models.BooleanField(
        default=True,
        db_index=True,
        verbose_name='Actief',
        help_text='Afgeleide vlag op basis van status; gebruikt voor snelle filtering.',
    )

    # Served municipalities
    served_municipalities = models.ManyToManyField(MunicipalityConfiguration, blank=True, related_name='regions', verbose_name='Bediende gemeenten')

    # Care configuration
    care_domains = models.ManyToManyField('contracts.CareCategoryMain', blank=True, related_name='regional_configs', verbose_name='Zorgdomeinen')
    linked_providers = models.ManyToManyField('contracts.Client', blank=True, related_name='regional_configs', verbose_name='Gekoppelde aanbieders')

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
    escalatie_contact = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalatie_regios',
        verbose_name='Escalatiecontact',
    )
    notes = models.TextField(blank=True, verbose_name='Notities')

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_regional_configs')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantScopedManager()

    class Meta:
        ordering = ['region_name']
        verbose_name = 'Regio Configuratie'
        verbose_name_plural = 'Regio Configuraties'
        unique_together = ('organization', 'region_code')

    def __str__(self):
        return f'{self.region_name} ({self.get_region_type_display().lower()})'

    def save(self, *args, **kwargs):
        self.active = self.status == self.Status.ACTIVE
        super().save(*args, **kwargs)

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
