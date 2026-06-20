from django.db import models

from contracts.models.providers import Zorgaanbieder, Zorgprofiel


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
        'contracts.CareCase',
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
