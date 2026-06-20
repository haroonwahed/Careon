from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid

from contracts.models.regional import RegionalConfiguration


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
        'contracts.ProviderImportBatch',
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
    coordinate_source = models.CharField(
        max_length=20,
        blank=True,
        help_text='Herkomst van latitude/longitude (vestiging, geocode_pdok, geocode_google)',
    )
    geocoded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='Tijdstip van laatste geocodering',
    )
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
        'contracts.ProviderImportBatch', on_delete=models.CASCADE, related_name='capaciteit_records'
    )
    # Optional link to specific care profile
    zorgprofiel = models.ForeignKey(
        Zorgprofiel, null=True, blank=True,
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
        'contracts.Organization', on_delete=models.CASCADE, related_name='provider_contracten'
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
        'contracts.ProviderImportBatch', null=True, blank=True,
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

    class WachtlijstStatus(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        BEPERKT = 'BEPERKT', 'Beperkt'
        GESLOTEN = 'GESLOTEN', 'Gesloten'

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
    capaciteit = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Capaciteit',
        help_text='Indicatieve beschikbare capaciteit in deze regiodekking.',
    )
    crisis_beschikbaar = models.BooleanField(default=False, verbose_name='Crisis beschikbaar')
    wachtlijst_status = models.CharField(
        max_length=20,
        choices=WachtlijstStatus.choices,
        default=WachtlijstStatus.OPEN,
        verbose_name='Wachtlijststatus',
    )
    reisafstand_score = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text='0.0–1.0 score voor bereikbaarheid/reisafstand.',
    )
    service_radius_km = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0.0)],
        help_text='Optionele maximale service-radius in kilometers voor geo-matching.',
    )
    dekking_status = models.CharField(
        max_length=20,
        choices=DekkingStatus.choices,
        default=DekkingStatus.ACTIVE,
    )
    toelichting = models.TextField(blank=True)
    notes = models.TextField(blank=True, verbose_name='Notities')
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

    def save(self, *args, **kwargs):
        if self.notes and not self.toelichting:
            self.toelichting = self.notes
        elif self.toelichting and not self.notes:
            self.notes = self.toelichting
        super().save(*args, **kwargs)


AanbiederRegioKoppeling = ProviderRegioDekking


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
