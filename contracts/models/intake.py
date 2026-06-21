from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.validators import MinValueValidator
from datetime import date
from decimal import Decimal

from contracts.models.core import RegionType, OutcomeReasonCode, _generate_source_reference
from contracts.models.care_case import CareCase
from contracts.models.assessment import CaseAssessment, PlacementRequest
from contracts.models.regional import RegionalConfiguration
from contracts.tenant_scoped import TenantScopedManager

User = get_user_model()


class CaseIntakeProcess(models.Model):
    """Care/intake & matching processes (Intakes & Matching)"""
    class WorkflowState(models.TextChoices):
        WIJKTEAM_INTAKE = 'WIJKTEAM_INTAKE', 'Wijkteam intake'
        ZORGVRAAG_BEOORDELING = 'ZORGVRAAG_BEOORDELING', 'Zorgvraag beoordeling'
        DRAFT_CASE = 'DRAFT_CASE', 'Casus aangemaakt'
        SUMMARY_READY = 'SUMMARY_READY', 'Samenvatting gereed'
        MATCHING_READY = 'MATCHING_READY', 'Matching gereed'
        GEMEENTE_VALIDATED = 'GEMEENTE_VALIDATED', 'Gemeente gevalideerd'
        PROVIDER_REVIEW_PENDING = 'PROVIDER_REVIEW_PENDING', 'Aanbiederbeoordeling open'
        PROVIDER_ACCEPTED = 'PROVIDER_ACCEPTED', 'Aanbieder geaccepteerd'
        BUDGET_REVIEW_PENDING = 'BUDGET_REVIEW_PENDING', 'Budgetcontrole'
        PROVIDER_REJECTED = 'PROVIDER_REJECTED', 'Aanbieder afgewezen'
        PLACEMENT_CONFIRMED = 'PLACEMENT_CONFIRMED', 'Plaatsing bevestigd'
        INTAKE_STARTED = 'INTAKE_STARTED', 'Intake gestart'
        ACTIVE_PLACEMENT = 'ACTIVE_PLACEMENT', 'Actieve plaatsing'
        ARCHIVED = 'ARCHIVED', 'Gearchiveerd'

    class ProcessStatus(models.TextChoices):
        INTAKE = 'INTAKE', 'Intake'
        MATCHING = 'MATCHING', 'Matching'
        DECISION = 'DECISION', 'Matchbesluit'
        COMPLETED = 'COMPLETED', 'Afgerond'
        ON_HOLD = 'ON_HOLD', 'In wacht'
        ARCHIVED = 'ARCHIVED', 'Gearchiveerd'

    class Urgency(models.TextChoices):
        LOW = 'LOW', 'Laag'
        MEDIUM = 'MEDIUM', 'Normaal'
        HIGH = 'HIGH', 'Hoog'
        CRISIS = 'CRISIS', 'Crisis'

    class Complexity(models.TextChoices):
        ENKELVOUDIG = 'ENKELVOUDIG', 'Enkelvoudig'
        MEERVOUDIG = 'MEERVOUDIG', 'Meervoudig'
        HOOGCOMPLEX = 'HOOGCOMPLEX', 'Hoogcomplex'

    class CareIntensity(models.TextChoices):
        LICHT = 'LICHT', 'Licht'
        REGULIER = 'REGULIER', 'Regulier'
        INTENSIEF = 'INTENSIEF', 'Intensief'

    class ClassificationStatus(models.TextChoices):
        SYSTEM_PROPOSED = 'SYSTEM_PROPOSED', 'Systeemvoorstel'
        CONFIRMED = 'CONFIRMED', 'Professioneel bevestigd'
        OVERRIDDEN = 'OVERRIDDEN', 'Professioneel gewijzigd'
        NEEDS_REVIEW = 'NEEDS_REVIEW', 'Nog te beoordelen'

    class CareForm(models.TextChoices):
        LOW_THRESHOLD_CONSULT = 'LOW_THRESHOLD_CONSULT', 'Laagdrempelig consult'
        AMBULANT_SUPPORT = 'AMBULANT_SUPPORT', 'Ambulante ondersteuning'
        OUTPATIENT = 'OUTPATIENT', 'Ambulant (legacy)'
        DAY_TREATMENT = 'DAY_TREATMENT', 'Dagbehandeling'
        VOLUNTARY_OUT_OF_HOME = 'VOLUNTARY_OUT_OF_HOME', 'Vrijwillige uithuisplaatsing'
        RESIDENTIAL = 'RESIDENTIAL', 'Woon- of zorgvoorziening'
        CRISIS = 'CRISIS', 'Crisiszorg'
        CONTINUATION_PATHWAY = 'CONTINUATION_PATHWAY', 'Doorstroomtraject'

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
    organization = models.ForeignKey('contracts.Organization', on_delete=models.CASCADE, null=True, blank=True, related_name='due_diligence_processes')
    contract = models.OneToOneField('contracts.CareCase', on_delete=models.SET_NULL, null=True, blank=True, related_name='due_diligence_process')
    title = models.CharField(
        max_length=200,
        verbose_name='Casuslabel',
        help_text='Gebruik een pseudoniem of operationeel label. Geen naam, initialen of andere identificerende gegevens.',
    )
    source_reference = models.CharField(
        max_length=64,
        blank=True,
        default='',
        db_index=True,
        verbose_name='Bronreferentie',
        help_text='Automatisch gegenereerde referentie voor de bronkoppeling.',
    )
    status = models.CharField(max_length=20, choices=ProcessStatus.choices, default=ProcessStatus.INTAKE, verbose_name='Status')
    workflow_state = models.CharField(
        max_length=48,
        choices=WorkflowState.choices,
        blank=True,
        default='',
        verbose_name='Workflowstatus',
        help_text='Persistente workflowstate voor canonical flow-validatie.',
    )

    class EntryRoute(models.TextChoices):
        STANDARD = 'STANDARD', 'Standaard casus'
        WIJKTEAM = 'WIJKTEAM', 'Wijkteam intake'

    class AanmelderActorProfile(models.TextChoices):
        """
        Product-/kanaalclassificatie voor wie de aanmelding initieerde.
        Niet gebruikt voor autorisatie — blijft op WorkflowRole (gemeente / zorgaanbieder / admin).
        """

        ONBEKEND = 'ONBEKEND', 'Onbekend / legacy'
        WIJKTEAM = 'WIJKTEAM', 'Wijkteam (instroom WIJKTEAM)'
        GEMEENTE_AMBTELIJK = 'GEMEENTE_AMBTELIJK', 'Gemeente-account (standaardroute)'
        ZORGAANBIEDER_ORG = 'ZORGAANBIEDER_ORG', 'Zorgaanbieder-organisatie'
        ADMIN = 'ADMIN', 'Platformbeheer'

    class PlacementPressureHorizon(models.TextChoices):
        TODAY = 'TODAY', 'Vandaag'
        THREE_DAYS = '3_DAYS', '3 dagen'
        ONE_WEEK = '1_WEEK', '1 week'
        TWO_WEEKS = '2_WEEKS', '2 weken'
        MORE_THAN_TWO_WEEKS = '>2_WEEKS', '>2 weken'

    entry_route = models.CharField(
        max_length=20,
        choices=EntryRoute.choices,
        default=EntryRoute.STANDARD,
        verbose_name='Instroomroute',
        help_text='Wijkteam: familie kan worden geregistreerd vóór externe zorg.',
    )
    aanmelder_actor_profile = models.CharField(
        max_length=32,
        choices=AanmelderActorProfile.choices,
        default=AanmelderActorProfile.ONBEKEND,
        db_index=True,
        verbose_name='Aanmelder-profiel (product)',
        help_text=(
            'Niet-autoriserende classificatie voor rapportage/audit. '
            'Rechten en workflow blijven gekoppeld aan WorkflowRole op de gebruiker.'
        ),
    )

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
    target_completion_date = models.DateField(verbose_name='Streefdatum matching')

    # CARE-SPECIFIC: Zorgvraag (Care Question)
    care_category_main = models.ForeignKey('contracts.CareCategoryMain', on_delete=models.SET_NULL, null=True, blank=True, related_name='intakes_main', verbose_name='Zorgbehoefte categorie')
    care_category_sub = models.ForeignKey('contracts.CareCategorySubcategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='intakes_sub', verbose_name='Specifieke zorgbehoefte')

    # CARE-SPECIFIC: Matching dimensions
    urgency = models.CharField(max_length=10, choices=Urgency.choices, default=Urgency.MEDIUM, verbose_name='Urgentie')
    complexity = models.CharField(max_length=15, choices=Complexity.choices, blank=True, default='', verbose_name='Complexiteit')
    care_intensity = models.CharField(
        max_length=10,
        choices=CareIntensity.choices,
        blank=True,
        default='',
        verbose_name='Zorgintensiteit',
    )
    proposed_complexity = models.CharField(
        max_length=15,
        choices=Complexity.choices,
        blank=True,
        default='',
        verbose_name='Voorgestelde complexiteit',
    )
    proposed_care_intensity = models.CharField(
        max_length=10,
        choices=CareIntensity.choices,
        blank=True,
        default='',
        verbose_name='Voorgestelde zorgintensiteit',
    )
    classification_rationale = models.JSONField(
        null=True,
        blank=True,
        verbose_name='Classificatie-onderbouwing',
        help_text='Criteria en uitleg van het systeemvoorstel.',
    )
    complexity_status = models.CharField(
        max_length=20,
        choices=ClassificationStatus.choices,
        default=ClassificationStatus.SYSTEM_PROPOSED,
        verbose_name='Status complexiteit',
    )
    care_intensity_status = models.CharField(
        max_length=20,
        choices=ClassificationStatus.choices,
        default=ClassificationStatus.SYSTEM_PROPOSED,
        verbose_name='Status zorgintensiteit',
    )
    complexity_confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='confirmed_complexities',
        verbose_name='Complexiteit bevestigd door',
    )
    complexity_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Complexiteit bevestigd op',
    )
    care_intensity_confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='confirmed_care_intensities',
        verbose_name='Zorgintensiteit bevestigd door',
    )
    care_intensity_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Zorgintensiteit bevestigd op',
    )
    complexity_override_reason = models.TextField(
        blank=True,
        default='',
        verbose_name='Reden wijziging complexiteit',
    )
    care_intensity_override_reason = models.TextField(
        blank=True,
        default='',
        verbose_name='Reden wijziging zorgintensiteit',
    )
    placement_pressure_horizon = models.CharField(
        max_length=20,
        choices=PlacementPressureHorizon.choices,
        default=PlacementPressureHorizon.MORE_THAN_TWO_WEEKS,
        verbose_name='Huidige situatie houdbaar tot',
        help_text='Hoe lang de huidige situatie operationeel houdbaar is zonder escalatie.',
    )
    safety_pressure = models.BooleanField(
        default=False,
        verbose_name='Veiligheidsdruk',
        help_text='Geeft aan of vertraging een veiligheidsrisico oplevert.',
    )
    time_sensitive_arrangement = models.BooleanField(
        default=False,
        verbose_name='Tijdskritisch arrangement',
        help_text='Geeft aan of funding of juridische timing de doorstroom versnelt.',
    )
    escalation_needed = models.BooleanField(
        default=False,
        verbose_name='Escalatie nodig',
        help_text='Geeft aan of snelle gemeente- of providerafstemming nodig is.',
    )
    placement_pressure_notes = models.TextField(
        blank=True,
        verbose_name='Plaatsingsdruk toelichting',
        help_text='Korte operationele toelichting zonder direct herleidbare persoonsgegevens.',
    )
    preferred_care_form = models.CharField(max_length=32, choices=CareForm.choices, default=CareForm.OUTPATIENT, verbose_name='Gewenste zorgvorm')
    preferred_region_type = models.CharField(
        max_length=20,
        choices=RegionType.choices,
        default=RegionType.GEMEENTELIJK,
        verbose_name='Voorkeur regiotype',
    )
    preferred_region = models.ForeignKey(
        'contracts.RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='preferred_intakes',
        verbose_name='Voorkeursregio',
    )
    gemeente = models.ForeignKey(
        'contracts.MunicipalityConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='intake_processes',
        verbose_name='Gemeente',
    )
    herkomst_gemeente = models.ForeignKey(
        'contracts.MunicipalityConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='origin_intake_processes',
        verbose_name='Herkomstgemeente',
    )
    verantwoordelijke_gemeente = models.ForeignKey(
        'contracts.MunicipalityConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='responsibility_intake_processes',
        verbose_name='Verantwoordelijke gemeente',
    )
    verblijfsgemeente = models.ForeignKey(
        'contracts.MunicipalityConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='residence_intake_processes',
        verbose_name='Verblijfsgemeente',
    )
    regio = models.ForeignKey(
        'contracts.RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_intakes',
        verbose_name='Geresolveerde regio',
        help_text='Deterministisch afgeleid uit gemeente; stabiel tenzij gemeente wijzigt.',
    )
    zorgregio = models.ForeignKey(
        'contracts.RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='zorgregio_intakes',
        verbose_name='Zorgregio',
    )
    plaatsingsregio = models.ForeignKey(
        'contracts.RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plaatsingsregio_intakes',
        verbose_name='Plaatsingsregio',
    )
    contractregio = models.ForeignKey(
        'contracts.RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contractregio_intakes',
        verbose_name='Contractregio',
    )
    escalatie_regio = models.ForeignKey(
        'contracts.RegionalConfiguration',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='escalatie_intakes',
        verbose_name='Escalatieregio',
    )
    responsibility_reason = models.TextField(blank=True, verbose_name='Verantwoordingsreden')
    responsibility_last_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Laatste herbeoordeling',
    )
    requires_revalidation = models.BooleanField(
        default=False,
        verbose_name='Herbeoordeling vereist',
        help_text='Wordt automatisch geactiveerd wanneer route- of regiogrenzen verschuiven.',
    )
    zorgvorm_gewenst = models.CharField(
        max_length=32,
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
    postcode = models.CharField(
        max_length=10,
        blank=True,
        verbose_name='Postcode',
        help_text='Globale casuslocatie voor afstands- en dekkingscontrole.',
    )
    latitude = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Latitude',
        help_text='Optionele coordinaten voor afstandsberekening.',
    )
    longitude = models.FloatField(
        null=True,
        blank=True,
        verbose_name='Longitude',
        help_text='Optionele coordinaten voor afstandsberekening.',
    )

    # Risk factors (many-to-many)
    risk_factors = models.ManyToManyField('contracts.RiskFactor', blank=True, related_name='intakes', verbose_name='Risicofactoren')

    # Descriptive assessment
    assessment_summary = models.TextField(
        blank=True,
        verbose_name='Intake samenvatting',
        help_text='Pseudonieme beschrijving van de casus. Geen namen, adressen, contactgegevens of BSN.',
    )
    description = models.TextField(
        blank=True,
        verbose_name='Aanvullende opmerkingen',
        help_text='Alleen operationele context zonder direct herleidbare persoonsgegevens.',
    )
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

    # ── Intake appointment planning ───────────────────────────────────────────
    intake_appointment_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Geplande intake-afspraak',
        help_text='Datum en tijdstip van de geplande intake bij de aanbieder.',
    )
    intake_appointment_location = models.CharField(
        max_length=200,
        blank=True,
        default='',
        verbose_name='Locatie intake-afspraak',
        help_text='Locatieomschrijving zonder direct herleidbare persoonsgegevens.',
    )
    intake_appointment_notes = models.TextField(
        blank=True,
        default='',
        verbose_name='Notities intake-afspraak',
        help_text='Voorbereiding of agendapunten; geen medische of herleidbare informatie.',
    )
    intake_appointment_conducted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_intake_appointments',
        verbose_name='Intakecoordinator',
    )

    # ── Urgency validation (gemeente-controlled) ──────────────────────────────
    urgency_validated = models.BooleanField(
        default=False,
        verbose_name='Urgentie gevalideerd',
        help_text='Mag alleen worden ingesteld door gemeente, en alleen als urgentieverklaring is bijgevoegd.',
    )
    has_urgency_declaration = models.BooleanField(
        default=False,
        verbose_name='Client heeft al een urgentieverklaring',
        help_text='Geeft aan dat de client al een bestaande urgentieverklaring heeft die geüpload kan worden.',
    )
    urgency_applied = models.BooleanField(
        default=False,
        verbose_name='Urgentieverklaring aangevraagd',
        help_text='Geeft aan dat de urgentieverklaring is aangevraagd bij de gemeente of het loket.',
    )
    urgency_applied_since = models.DateField(
        null=True,
        blank=True,
        verbose_name='Urgentieverklaring aangevraagd op',
        help_text='Datum waarop de urgentieverklaring is aangevraagd.',
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

    objects = TenantScopedManager()

    class Meta:
        db_table = 'contracts_caseintakeprocess'
        ordering = ['-created_at']
        verbose_name = 'Intake & Beoordeling'
        verbose_name_plural = 'Intakes & Beoordelingen'

    def __str__(self):
        return f'{self.title} ({self.get_status_display()})'

    def _resolve_region_from_municipality(self, municipality):
        if municipality is None:
            return None
        active_region = (
            municipality.regions.filter(status=RegionalConfiguration.Status.ACTIVE)
            .order_by('region_type', 'region_name')
            .first()
        )
        if active_region is not None:
            return active_region
        return municipality.regions.order_by('region_type', 'region_name').first()

    def _region_label(self, region):
        if region is None:
            return ''
        return region.region_name or region.region_code or ''

    @classmethod
    def derive_placement_pressure(cls, *, horizon, target_completion_date=None, start_date=None, safety_pressure=False, time_sensitive_arrangement=False, escalation_needed=False, today=None):
        from datetime import date as _date

        today = today or _date.today()
        score = 0
        reasons: list[str] = []
        label = 'Laag'
        implication = 'Normale routing'

        horizon_value = str(horizon or '').strip().upper()
        horizon_score_map = {
            cls.PlacementPressureHorizon.TODAY: 4,
            cls.PlacementPressureHorizon.THREE_DAYS: 3,
            cls.PlacementPressureHorizon.ONE_WEEK: 2,
            cls.PlacementPressureHorizon.TWO_WEEKS: 1,
            cls.PlacementPressureHorizon.MORE_THAN_TWO_WEEKS: 0,
        }
        horizon_reason_map = {
            cls.PlacementPressureHorizon.TODAY: 'Huidige situatie houdbaar tot vandaag',
            cls.PlacementPressureHorizon.THREE_DAYS: 'Huidige situatie houdbaar tot 3 dagen',
            cls.PlacementPressureHorizon.ONE_WEEK: 'Huidige situatie houdbaar tot 1 week',
            cls.PlacementPressureHorizon.TWO_WEEKS: 'Huidige situatie houdbaar tot 2 weken',
            cls.PlacementPressureHorizon.MORE_THAN_TWO_WEEKS: 'Huidige situatie houdbaar langer dan 2 weken',
        }
        score += horizon_score_map.get(horizon_value, 0)
        if horizon_value in horizon_reason_map:
            reasons.append(horizon_reason_map[horizon_value])

        if target_completion_date is not None:
            days_until_deadline = (target_completion_date - today).days
            if days_until_deadline <= 0:
                score += 4
                reasons.append('Uiterste plaatsingsdatum is bereikt of verlopen')
            elif days_until_deadline <= 3:
                score += 3
                reasons.append('Uiterste plaatsingsdatum valt binnen 3 dagen')
            elif days_until_deadline <= 14:
                score += 2
                reasons.append('Uiterste plaatsingsdatum valt binnen 14 dagen')

        if start_date is not None:
            days_until_start = (start_date - today).days
            if days_until_start <= 0:
                score += 2
                reasons.append('Gewenste startdatum is vandaag of eerder')
            elif days_until_start <= 14:
                score += 2
                reasons.append('Gewenste startdatum valt binnen 14 dagen')

        if safety_pressure:
            score += 3
            reasons.append('Veiligheidsdruk aanwezig')
            implication = 'Spoedroute actief' if score >= 8 else 'Snellere routing nodig'

        if time_sensitive_arrangement:
            score += 2
            reasons.append('Tijdskritisch arrangement')

        if escalation_needed:
            score += 2
            reasons.append('Escalatie nodig')

        if score >= 8 or (safety_pressure and escalation_needed and horizon_value in {cls.PlacementPressureHorizon.TODAY, cls.PlacementPressureHorizon.THREE_DAYS}):
            band = 'CRITICAL'
            label = 'Spoed'
            implication = 'Spoedroute actief'
        elif score >= 5:
            band = 'HIGH'
            label = 'Hoog'
            implication = 'Snelle plaatsing en strakkere opvolging nodig'
        elif score >= 2:
            band = 'NORMAL'
            label = 'Normaal'
            implication = 'Normale routing'
        else:
            band = 'LOW'
            label = 'Laag'
            implication = 'Ruimte voor inhoudelijke matching'

        reason = ' · '.join(reasons[:3]) if reasons else 'Plaatsingsdruk lijkt stabiel.'
        return {
            'band': band,
            'urgency': {
                'LOW': cls.Urgency.LOW,
                'NORMAL': cls.Urgency.MEDIUM,
                'HIGH': cls.Urgency.HIGH,
                'CRITICAL': cls.Urgency.CRISIS,
            }[band],
            'label': label,
            'reason': reason,
            'implication': implication,
            'score': min(score, 10),
        }

    def placement_pressure_assessment(self):
        return self.derive_placement_pressure(
            horizon=self.placement_pressure_horizon,
            target_completion_date=self.target_completion_date,
            start_date=self.start_date,
            safety_pressure=self.safety_pressure,
            time_sensitive_arrangement=self.time_sensitive_arrangement,
            escalation_needed=self.escalation_needed,
        )

    def derive_operational_urgency(self) -> str:
        return self.placement_pressure_assessment()['urgency']

    def _municipality_label(self, municipality):
        if municipality is None:
            return ''
        return municipality.municipality_name or municipality.municipality_code or ''

    def _derive_responsibility_reason(self, municipality_region, *, route_regions, municipality_changed, has_source_data):
        if not has_source_data:
            return 'Onvoldoende regiogegevens; handmatige herbeoordeling nodig.'

        parts = []
        if self.verantwoordelijke_gemeente_id and self.herkomst_gemeente_id:
            if self.verantwoordelijke_gemeente_id == self.herkomst_gemeente_id:
                parts.append('Woonplaatsbeginsel blijft bij herkomstgemeente')
            else:
                parts.append('Verantwoordelijke gemeente wijkt af van herkomstgemeente')
        elif self.verantwoordelijke_gemeente_id:
            parts.append('Verantwoordelijke gemeente vastgelegd')
        elif self.gemeente_id:
            parts.append('Verantwoordelijke gemeente volgt aanmelding')

        if municipality_region is not None:
            parts.append(f'Zorgregio: {self._region_label(municipality_region)}')

        unique_region_ids = [region.id for region in route_regions if region is not None]
        if len(set(unique_region_ids)) > 1:
            parts.append('Route overschrijdt regiogrens')
        if municipality_changed:
            parts.append('Gemeentewijziging vraagt herbeoordeling')

        if not parts:
            parts.append('Gemeentelijke route en regio zijn in lijn')
        return ' · '.join(parts)

    def _has_routing_source_data(self):
        return any(
            [
                self.gemeente_id,
                self.herkomst_gemeente_id,
                self.verantwoordelijke_gemeente_id,
                self.verblijfsgemeente_id,
                self.regio_id,
                self.zorgregio_id,
                self.plaatsingsregio_id,
                self.contractregio_id,
                self.escalatie_regio_id,
                self.preferred_region_id,
            ]
        )

    @property
    def routing_summary(self):
        return {
            'herkomstGemeente': {
                'id': str(self.herkomst_gemeente_id) if self.herkomst_gemeente_id else '',
                'label': self._municipality_label(self.herkomst_gemeente),
            },
            'verantwoordelijkeGemeente': {
                'id': str(self.verantwoordelijke_gemeente_id) if self.verantwoordelijke_gemeente_id else '',
                'label': self._municipality_label(self.verantwoordelijke_gemeente),
            },
            'zorgregio': {
                'id': str(self.zorgregio_id) if self.zorgregio_id else '',
                'label': self._region_label(self.zorgregio),
            },
            'plaatsingsregio': {
                'id': str(self.plaatsingsregio_id) if self.plaatsingsregio_id else '',
                'label': self._region_label(self.plaatsingsregio),
            },
            'verblijfsgemeente': {
                'id': str(self.verblijfsgemeente_id) if self.verblijfsgemeente_id else '',
                'label': self._municipality_label(self.verblijfsgemeente),
            },
            'contractregio': {
                'id': str(self.contractregio_id) if self.contractregio_id else '',
                'label': self._region_label(self.contractregio),
            },
            'escalatieRegio': {
                'id': str(self.escalatie_regio_id) if self.escalatie_regio_id else '',
                'label': self._region_label(self.escalatie_regio),
            },
            'responsibilityReason': self.responsibility_reason or '',
            'responsibilityLastReviewedAt': self.responsibility_last_reviewed_at.isoformat() if self.responsibility_last_reviewed_at else None,
            'requiresRevalidation': bool(self.requires_revalidation),
        }

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
        if not self.source_reference:
            self.source_reference = _generate_source_reference()

        previous_gemeente_id = None
        previous_state = None
        if self.pk:
            previous_gemeente_id = (
                CaseIntakeProcess.objects
                .filter(pk=self.pk)
                .values_list('gemeente_id', flat=True)
                .first()
            )
            previous_state = (
                CaseIntakeProcess.objects.filter(pk=self.pk)
                .values(
                    'gemeente_id',
                    'herkomst_gemeente_id',
                    'verantwoordelijke_gemeente_id',
                    'verblijfsgemeente_id',
                    'regio_id',
                    'zorgregio_id',
                    'plaatsingsregio_id',
                    'contractregio_id',
                    'escalatie_regio_id',
                    'responsibility_reason',
                    'responsibility_last_reviewed_at',
                    'requires_revalidation',
                )
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

        municipality_region = self._resolve_region_from_municipality(self.gemeente)
        if self.gemeente_id and not self.herkomst_gemeente_id:
            self.herkomst_gemeente = self.gemeente
        if self.gemeente_id and not self.verantwoordelijke_gemeente_id:
            self.verantwoordelijke_gemeente = self.gemeente
        if self.gemeente_id and not self.verblijfsgemeente_id:
            self.verblijfsgemeente = self.gemeente
        if municipality_region is not None and not self.zorgregio_id:
            self.zorgregio = municipality_region
        if not self.zorgregio_id and self.regio_id:
            self.zorgregio = self.regio
        if not self.plaatsingsregio_id and self.regio_id:
            self.plaatsingsregio = self.regio
        if not self.plaatsingsregio_id and self.zorgregio_id:
            self.plaatsingsregio = self.zorgregio
        if not self.contractregio_id and self.preferred_region_id:
            self.contractregio = self.preferred_region
        if not self.contractregio_id and self.zorgregio_id:
            self.contractregio = self.zorgregio
        if not self.escalatie_regio_id and self.plaatsingsregio_id:
            self.escalatie_regio = self.plaatsingsregio
        if not self.escalatie_regio_id and self.contractregio_id:
            self.escalatie_regio = self.contractregio

        route_regions = [self.zorgregio, self.plaatsingsregio, self.contractregio, self.escalatie_regio]
        municipality_changed = bool(previous_gemeente_id and previous_gemeente_id != self.gemeente_id)
        self.requires_revalidation = bool(
            len({region.id for region in route_regions if region is not None}) > 1
            or (
                self.verantwoordelijke_gemeente_id
                and self.herkomst_gemeente_id
                and self.verantwoordelijke_gemeente_id != self.herkomst_gemeente_id
            )
            or (
                self.verantwoordelijke_gemeente_id
                and self.verblijfsgemeente_id
                and self.verantwoordelijke_gemeente_id != self.verblijfsgemeente_id
            )
            or municipality_changed
        )

        has_source_data = self._has_routing_source_data()
        if not has_source_data:
            self.requires_revalidation = True

        if (
            previous_state is None
            or previous_state.get('responsibility_reason') in {'', None}
            or previous_state.get('requires_revalidation') != self.requires_revalidation
            or previous_state.get('gemeente_id') != self.gemeente_id
        ):
            self.responsibility_reason = self._derive_responsibility_reason(
                municipality_region,
                route_regions=route_regions,
                municipality_changed=municipality_changed,
                has_source_data=has_source_data,
            )
            self.responsibility_last_reviewed_at = timezone.now()

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
            self.Urgency.LOW: CareCase.RiskLevel.GEEN_BIJZONDER_RISICO,
            self.Urgency.MEDIUM: CareCase.RiskLevel.GEEN_BIJZONDER_RISICO,
            self.Urgency.HIGH: CareCase.RiskLevel.VERHOOGD_RISICO,
            self.Urgency.CRISIS: CareCase.RiskLevel.ACUUT_RISICO,
        }
        contract_type_map = {
            self.CareForm.OUTPATIENT: CareCase.ContractType.MSA,
            self.CareForm.DAY_TREATMENT: CareCase.ContractType.SOW,
            self.CareForm.RESIDENTIAL: CareCase.ContractType.LEASE,
            self.CareForm.CRISIS: CareCase.ContractType.NDA,
        }

        region_label = ''
        for region in (self.plaatsingsregio, self.zorgregio, self.regio, self.contractregio, self.preferred_region):
            if region is not None:
                region_label = region.region_name
                break
        if not region_label and self.gemeente_id and self.gemeente:
            region_label = self.gemeente.municipality_name

        case_record = CareCase.objects.create(
            organization=self.organization,
            title=self.title,
            source_system='zorg_os',
            source_system_id=0,
            source_system_url='',
            contract_type=contract_type_map.get(self.zorgvorm_gewenst or self.preferred_care_form, CareCase.ContractType.OTHER),
            content=(self.assessment_summary or self.description or '').strip(),
            status=CareCase.Status.PENDING,
            service_region=region_label,
            risk_level=risk_map.get(self.urgency, CareCase.RiskLevel.GEEN_BIJZONDER_RISICO),
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
        'contracts.Organization', on_delete=models.CASCADE, null=True, blank=True,
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
        'contracts.Client',
        blank=True,
        related_name='capacity_budgets',
        verbose_name='Gekoppelde aanbieders',
        help_text='Optioneel: koppel aanbieders aan dit budget.'
    )
    linked_cases = models.ManyToManyField(
        'contracts.CaseIntakeProcess',
        blank=True,
        related_name='capacity_budgets',
        verbose_name='Gekoppelde casussen'
    )
    linked_placements = models.ManyToManyField(
        'contracts.PlacementRequest',
        blank=True,
        related_name='capacity_budgets',
        verbose_name='Gekoppelde plaatsingen'
    )

    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = TenantScopedManager()

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
