import hashlib
import json as _json
import uuid

from django.db import models
from django.contrib.auth import get_user_model

from contracts.models.providers import Zorgaanbieder

User = get_user_model()


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
