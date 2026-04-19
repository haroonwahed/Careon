"""
Provider Data Pipeline — Orchestrator.

This module owns the full import lifecycle:
  1. Open / reuse a ProviderImportBatch
  2. Land raw records into ProviderStagingRecord (immutable)
  3. Validate and fingerprint each record
  4. Resolve source ↔ canonical entity (by AGB-code or source_id)
  5. Detect conflicts on protected fields
  6. Promote valid records into canonical tables
  7. Log every action in ProviderSyncLog

External data NEVER reaches canonical tables without passing through
validate_and_stage() followed by promote_batch().

Usage:
    pipeline = ProviderPipeline(source_system="agbregister_v2",
                                 triggered_by="scheduler")
    batch = pipeline.open_batch()
    pipeline.ingest(batch, records)   # list of raw dicts from adapter
    pipeline.promote_batch(batch)
"""

from __future__ import annotations

import logging
from typing import Any, Iterable

from django.db import transaction
from django.utils import timezone

from .models import (
    AanbiederVestiging,
    BronImportBatch,
    BronRecordRaw,
    BronSyncLog,
    CapaciteitRecord,
    ContractRelatie,
    Organization,
    ProviderImportBatch,
    ProviderStagingRecord,
    ProviderSyncConflict,
    ProviderSyncLog,
    Zorgaanbieder,
    Zorgprofiel,
)
from .provider_pipeline_mapping import (
    compute_confidence_score,
    map_payload_to_canonical,
    validate_canonical_data,
)

logger = logging.getLogger(__name__)


# Fields where a source conflict should NOT auto-overwrite the canonical value.
# These require explicit human resolution.
PROTECTED_FIELDS: frozenset[str] = frozenset({
    "name",
    "agb_code",
    "kvk_number",
    "provider_type",
})

QUARANTINE_CONFIDENCE_THRESHOLD = 0.5
REGISTRY_SOURCE_HINTS = ("agb", "vektis", "registry")
CONTRACT_SOURCE_HINTS = ("contract", "municipal")


class ProviderPipeline:
    """
    Orchestrates the full provider data import lifecycle.

    Thread-safety: one pipeline instance per import run. Do not reuse
    across concurrent imports.
    """

    def __init__(
        self,
        source_system: str,
        source_version: str = "",
        triggered_by: str = "system",
        organization: Organization | None = None,
    ) -> None:
        self.source_system = source_system
        self.source_version = source_version
        self.triggered_by = triggered_by
        self.organization = organization  # optional: scope contract relations
        self._bron_batch_cache: dict[int, BronImportBatch] = {}

    # ------------------------------------------------------------------
    # Phase 1 — Open batch
    # ------------------------------------------------------------------

    def open_batch(self) -> ProviderImportBatch:
        batch = ProviderImportBatch.objects.create(
            source_system=self.source_system,
            source_version=self.source_version,
            triggered_by=self.triggered_by,
            status=ProviderImportBatch.BatchStatus.RUNNING,
            started_at=timezone.now(),
        )
        bron_batch = BronImportBatch.objects.create(
            provider_batch=batch,
            bron_type=self.source_system,
            batch_naam=f"{self.source_system}-{batch.batch_ref}",
            status=BronImportBatch.Status.RUNNING,
            gestart_op=batch.started_at,
        )
        self._bron_batch_cache[batch.pk] = bron_batch
        logger.info("Pipeline batch opened: %s [%s]", batch.batch_ref, self.source_system)
        return batch

    def _get_or_create_bron_batch(self, batch: ProviderImportBatch) -> BronImportBatch:
        cached = self._bron_batch_cache.get(batch.pk)
        if cached:
            return cached
        bron_batch = getattr(batch, 'bron_batch', None)
        if bron_batch is None:
            bron_batch = BronImportBatch.objects.create(
                provider_batch=batch,
                bron_type=self.source_system,
                batch_naam=f"{self.source_system}-{batch.batch_ref}",
                status=BronImportBatch.Status.RUNNING,
                gestart_op=batch.started_at or timezone.now(),
            )
        self._bron_batch_cache[batch.pk] = bron_batch
        return bron_batch

    # ------------------------------------------------------------------
    # Phase 2 — Ingest: land raw records into staging (immutable)
    # ------------------------------------------------------------------

    def ingest(self, batch: ProviderImportBatch, records: Iterable[dict]) -> int:
        """
        Write raw records to staging table. Returns count of staged records.
        No normalization happens here — staging is immutable raw evidence.
        """
        count = 0
        bron_batch = self._get_or_create_bron_batch(batch)
        for raw in records:
            source_id = str(raw.get("source_id") or raw.get("id") or "")
            if not source_id:
                logger.warning("Skipping record without source_id in batch %s", batch.batch_ref)
                continue

            fingerprint = ProviderStagingRecord.compute_fingerprint(raw)

            ProviderStagingRecord.objects.create(
                batch=batch,
                source_id=source_id,
                source_agb_code=str(raw.get("agb_code") or raw.get("agb") or ""),
                source_kvk=str(raw.get("kvk") or raw.get("kvk_number") or ""),
                raw_payload=raw,
                payload_fingerprint=fingerprint,
            )
            BronRecordRaw.objects.create(
                import_batch=bron_batch,
                external_source=self.source_system,
                external_id=source_id,
                payload_json=raw,
                record_hash=fingerprint,
                normalisatie_status='PENDING',
            )
            count += 1

        batch.total_records = count
        batch.save(update_fields=["total_records"])
        bron_batch.totaal_records = count
        bron_batch.save(update_fields=['totaal_records'])
        logger.info("Ingested %d records into batch %s", count, batch.batch_ref)
        return count

    # ------------------------------------------------------------------
    # Phase 3 — Validate staging records
    # ------------------------------------------------------------------

    def validate_batch(self, batch: ProviderImportBatch) -> None:
        """
        Validate all PENDING staging records for a batch.
        Updates validation_status, validation_errors, and confidence_score in-place.
        """
        pending = ProviderStagingRecord.objects.filter(
            batch=batch,
            validation_status=ProviderStagingRecord.ValidationStatus.PENDING,
        )
        for staging in pending:
            canonical_data = map_payload_to_canonical(staging.raw_payload)
            errors = validate_canonical_data(canonical_data)
            confidence = compute_confidence_score(canonical_data, errors)

            if errors:
                if confidence < QUARANTINE_CONFIDENCE_THRESHOLD:
                    staging.validation_status = ProviderStagingRecord.ValidationStatus.QUARANTINED
                else:
                    staging.validation_status = ProviderStagingRecord.ValidationStatus.INVALID
            else:
                staging.validation_status = ProviderStagingRecord.ValidationStatus.VALID

            staging.validation_errors = errors
            staging.confidence_score = confidence
            staging.save(update_fields=["validation_status", "validation_errors", "confidence_score"])

            bron_batch = self._get_or_create_bron_batch(batch)
            BronRecordRaw.objects.filter(
                import_batch=bron_batch,
                external_id=staging.source_id,
                record_hash=staging.payload_fingerprint,
            ).update(
                normalisatie_status=staging.validation_status,
                foutmelding='; '.join(errors) if errors else '',
                verwerkt_op=timezone.now(),
            )

    # ------------------------------------------------------------------
    # Phase 4 — Promote: write valid records into canonical tables
    # ------------------------------------------------------------------

    def promote_batch(self, batch: ProviderImportBatch) -> dict[str, int]:
        """
        Promote all VALID staging records from a batch into canonical tables.
        Returns summary counts: created, updated, skipped, conflicted, quarantined.
        """
        self.validate_batch(batch)

        summary = {
            "created": 0, "updated": 0, "skipped": 0,
            "conflicted": 0, "quarantined": 0,
        }

        valid_records = ProviderStagingRecord.objects.filter(
            batch=batch,
            validation_status=ProviderStagingRecord.ValidationStatus.VALID,
        )

        for staging in valid_records:
            try:
                action, provider = self._promote_one(batch, staging)
                summary[action] += 1
            except Exception as exc:  # noqa: BLE001
                logger.exception(
                    "Error promoting staging record %s: %s", staging.source_id, exc
                )
                staging.validation_status = ProviderStagingRecord.ValidationStatus.QUARANTINED
                staging.validation_errors = [str(exc)]
                staging.save(update_fields=["validation_status", "validation_errors"])
                summary["quarantined"] += 1

        # Update quarantined count from staging table
        summary["quarantined"] += ProviderStagingRecord.objects.filter(
            batch=batch,
            validation_status=ProviderStagingRecord.ValidationStatus.QUARANTINED,
        ).count()

        self._close_batch(batch, summary)
        return summary

    @transaction.atomic
    def _promote_one(
        self,
        batch: ProviderImportBatch,
        staging: ProviderStagingRecord,
    ) -> tuple[str, Zorgaanbieder]:
        """
        Promote a single staging record.
        Returns (action, Zorgaanbieder) — action is one of the summary keys.
        """
        canonical_data = map_payload_to_canonical(staging.raw_payload)

        # --- Entity resolution ---
        provider, is_new = self._resolve_provider(canonical_data, staging)

        if is_new:
            action = self._create_canonical(batch, staging, canonical_data, provider)
        else:
            # Check for fingerprint match (no change)
            existing_staging = (
                ProviderStagingRecord.objects.filter(
                    canonical_provider=provider,
                    payload_fingerprint=staging.payload_fingerprint,
                    validation_status=ProviderStagingRecord.ValidationStatus.PROMOTED,
                )
                .exclude(pk=staging.pk)
                .first()
            )
            if existing_staging:
                staging.validation_status = ProviderStagingRecord.ValidationStatus.PROMOTED
                staging.canonical_provider = provider
                staging.save(update_fields=["validation_status", "canonical_provider"])
                ProviderSyncLog.objects.create(
                    staging_record=staging,
                    canonical_provider=provider,
                    action=ProviderSyncLog.SyncAction.SKIPPED,
                    message="Geen wijziging gedetecteerd (identieke fingerprint)",
                )
                return "skipped", provider

            action = self._update_canonical(batch, staging, canonical_data, provider)

        # Always upsert vestiging + capacity + zorgprofiel
        vestiging = self._upsert_vestiging(provider, canonical_data)
        self._append_capacity(vestiging, batch, canonical_data)
        self._upsert_zorgprofiel(provider, canonical_data)

        if self.organization:
            self._upsert_contract_relatie(provider, batch, canonical_data)

        staging.validation_status = ProviderStagingRecord.ValidationStatus.PROMOTED
        staging.canonical_provider = provider
        staging.save(update_fields=["validation_status", "canonical_provider"])

        return action, provider

    # ------------------------------------------------------------------
    # Entity resolution
    # ------------------------------------------------------------------

    def _resolve_provider(
        self, canonical_data: dict, staging: ProviderStagingRecord
    ) -> tuple[Zorgaanbieder, bool]:
        """
        Look up existing Zorgaanbieder by AGB-code, then KVK, then source_id.
        Returns (provider, is_new).
        """
        agb = canonical_data.get("agb_code")
        kvk = canonical_data.get("kvk_number")

        if agb:
            qs = Zorgaanbieder.objects.filter(agb_code=agb)
            if qs.exists():
                return qs.first(), False

        if kvk:
            qs = Zorgaanbieder.objects.filter(kvk_number=kvk)
            if qs.exists():
                return qs.first(), False

        # Fall back: check if we've seen this source_id before
        prev = ProviderStagingRecord.objects.filter(
            batch__source_system=self.source_system,
            source_id=staging.source_id,
            canonical_provider__isnull=False,
        ).exclude(pk=staging.pk).select_related("canonical_provider").first()

        if prev and prev.canonical_provider:
            return prev.canonical_provider, False

        # New provider
        provider = Zorgaanbieder(
            agb_code=agb or "",
            kvk_number=kvk or "",
            name=canonical_data.get("name") or staging.source_id,
            short_name=canonical_data.get("short_name") or "",
            provider_type=canonical_data.get("provider_type") or "OVERIG",
            website=canonical_data.get("website") or "",
            email=canonical_data.get("email") or "",
            phone=canonical_data.get("phone") or "",
            last_source_system=self.source_system,
            last_import_batch=staging.batch,
        )
        provider.save()
        return provider, True

    # ------------------------------------------------------------------
    # Canonical write helpers
    # ------------------------------------------------------------------

    def _create_canonical(
        self,
        batch: ProviderImportBatch,
        staging: ProviderStagingRecord,
        data: dict,
        provider: Zorgaanbieder,
    ) -> str:
        ProviderSyncLog.objects.create(
            staging_record=staging,
            canonical_provider=provider,
            action=ProviderSyncLog.SyncAction.CREATED,
            field_diffs={
                k: {"from": None, "to": str(v)}
                for k, v in data.items()
                if v not in (None, "", 0, False)
            },
        )
        BronSyncLog.objects.create(
            bron_type=self.source_system,
            external_id=staging.source_id,
            interne_entiteit_type='Zorgaanbieder',
            interne_entiteit_id=str(provider.pk),
            actie='CREATE',
            status='SUCCESS',
            melding='Canonieke zorgaanbieder aangemaakt',
        )
        return "created"

    def _update_canonical(
        self,
        batch: ProviderImportBatch,
        staging: ProviderStagingRecord,
        data: dict,
        provider: Zorgaanbieder,
    ) -> str:
        diffs: dict[str, Any] = {}
        conflicts: list[tuple[str, str, str]] = []

        field_map = {
            "name": "name",
            "short_name": "short_name",
            "provider_type": "provider_type",
            "website": "website",
            "email": "email",
            "phone": "phone",
        }

        # Only update KVK/AGB if currently empty (first-time enrichment)
        if not provider.agb_code and data.get("agb_code"):
            provider.agb_code = data["agb_code"]
            diffs["agb_code"] = {"from": "", "to": data["agb_code"]}

        if not provider.kvk_number and data.get("kvk_number"):
            provider.kvk_number = data["kvk_number"]
            diffs["kvk_number"] = {"from": "", "to": data["kvk_number"]}

        for canon_field, model_attr in field_map.items():
            incoming = data.get(canon_field) or ""
            current = getattr(provider, model_attr, "")

            if incoming == current:
                continue

            if canon_field in PROTECTED_FIELDS and current:
                # Raise a conflict — do not overwrite
                conflicts.append((canon_field, str(incoming), str(current)))
            else:
                diffs[canon_field] = {"from": str(current), "to": str(incoming)}
                setattr(provider, model_attr, incoming)

        provider.last_source_system = self.source_system
        provider.last_import_batch = batch
        provider.save()

        if conflicts:
            for field_name, source_val, canon_val in conflicts:
                ProviderSyncConflict.objects.get_or_create(
                    staging_record=staging,
                    canonical_provider=provider,
                    field_name=field_name,
                    defaults={
                        "source_value": source_val,
                        "canonical_value": canon_val,
                        "resolution_status": ProviderSyncConflict.ResolutionStatus.UNRESOLVED,
                    },
                )

        action_type = (
            ProviderSyncLog.SyncAction.CONFLICTED if conflicts else
            ProviderSyncLog.SyncAction.UPDATED if diffs else
            ProviderSyncLog.SyncAction.SKIPPED
        )

        ProviderSyncLog.objects.create(
            staging_record=staging,
            canonical_provider=provider,
            action=action_type,
            field_diffs=diffs,
            message=f"{len(conflicts)} conflicten" if conflicts else "",
        )

        BronSyncLog.objects.create(
            bron_type=self.source_system,
            external_id=staging.source_id,
            interne_entiteit_type='Zorgaanbieder',
            interne_entiteit_id=str(provider.pk),
            actie='UPDATE',
            status='CONFLICTED' if conflicts else ('UPDATED' if diffs else 'SKIPPED'),
            melding=f"{len(conflicts)} conflicten" if conflicts else '',
        )

        return "conflicted" if conflicts else ("updated" if diffs else "skipped")

    # ------------------------------------------------------------------
    # Sub-entity helpers
    # ------------------------------------------------------------------

    def _upsert_vestiging(
        self, provider: Zorgaanbieder, data: dict
    ) -> AanbiederVestiging:
        vestiging_code = data.get("vestiging_code") or "PRIMARY"
        vestiging, _ = AanbiederVestiging.objects.update_or_create(
            zorgaanbieder=provider,
            vestiging_code=vestiging_code,
            defaults={
                "name": data.get("name") or "",
                "address": data.get("address") or "",
                "city": data.get("city") or "",
                "postcode": data.get("postcode") or "",
                "region": data.get("region") or "",
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "is_primary": vestiging_code == "PRIMARY",
            },
        )
        return vestiging

    def _append_capacity(
        self,
        vestiging: AanbiederVestiging,
        batch: ProviderImportBatch,
        data: dict,
    ) -> CapaciteitRecord | None:
        """Append a new capacity snapshot only when source supplied all core values."""
        source_label = str(self.source_system or "").lower()
        if any(hint in source_label for hint in REGISTRY_SOURCE_HINTS):
            logger.info(
                "Skipping capacity append for vestiging=%s in batch=%s; registry source does not own operational fields",
                vestiging.pk,
                batch.batch_ref,
            )
            return None

        required = (
            data.get("open_slots"),
            data.get("waiting_list_size"),
            data.get("avg_wait_days"),
            data.get("max_capacity"),
        )
        if any(value is None for value in required):
            logger.info(
                "Skipping capacity append for vestiging=%s in batch=%s; incomplete operational source data",
                vestiging.pk,
                batch.batch_ref,
            )
            return None

        return CapaciteitRecord.objects.create(
            vestiging=vestiging,
            import_batch=batch,
            open_slots=int(data.get("open_slots") or 0),
            waiting_list_size=int(data.get("waiting_list_size") or 0),
            avg_wait_days=int(data.get("avg_wait_days") or 0),
            max_capacity=int(data.get("max_capacity") or 0),
            totale_capaciteit=int(data.get("totale_capaciteit") or data.get("max_capacity") or 0),
            beschikbare_capaciteit=int(data.get("beschikbare_capaciteit") or data.get("open_slots") or 0),
            wachtlijst_aantal=int(data.get("wachtlijst_aantal") or data.get("waiting_list_size") or 0),
            gemiddelde_wachttijd_dagen=int(data.get("gemiddelde_wachttijd_dagen") or data.get("avg_wait_days") or 0),
            direct_pleegbaar=bool(data.get("direct_pleegbaar", False)),
            capaciteit_type=str(data.get("capaciteit_type") or "").strip(),
            toelichting_capaciteit="Bronimport operationele capaciteit",
            betrouwbaarheid_score=data.get("betrouwbaarheid_score"),
            laatst_bijgewerkt_op=timezone.now(),
            laatst_bijgewerkt_door=self.triggered_by,
        )

    def _upsert_zorgprofiel(
        self, provider: Zorgaanbieder, data: dict
    ) -> Zorgprofiel:
        profile_defaults = {
            "biedt_ambulant": data.get("biedt_ambulant") or False,
            "biedt_dagbehandeling": data.get("biedt_dagbehandeling") or False,
            "biedt_residentieel": data.get("biedt_residentieel") or False,
            "biedt_crisis": data.get("biedt_crisis") or False,
            "biedt_thuisbegeleiding": data.get("biedt_thuisbegeleiding") or False,
            "leeftijd_0_4": data.get("leeftijd_0_4") or False,
            "leeftijd_4_12": data.get("leeftijd_4_12") or False,
            "leeftijd_12_18": data.get("leeftijd_12_18") or False,
            "leeftijd_18_plus": data.get("leeftijd_18_plus") or False,
            "complexiteit_enkelvoudig": data.get("complexiteit_enkelvoudig") or False,
            "complexiteit_meervoudig": data.get("complexiteit_meervoudig") or False,
            "complexiteit_zwaar": data.get("complexiteit_zwaar") or False,
            "urgentie_laag": data.get("urgentie_laag") or False,
            "urgentie_middel": data.get("urgentie_middel") or False,
            "urgentie_hoog": data.get("urgentie_hoog") or False,
            "urgentie_crisis": data.get("urgentie_crisis") or False,
            "regio_codes": data.get("regio_codes") or "",
            "specialisaties": data.get("specialisaties") or "",
        }
        # Zorgprofiel is now a FK (not OneToOne) — use get-or-create pattern
        # to maintain backward compat: one profile per provider in the v1 pipeline.
        profile = Zorgprofiel.objects.filter(zorgaanbieder=provider).first()
        if profile is None:
            profile = Zorgprofiel.objects.create(
                zorgaanbieder=provider,
                **profile_defaults,
            )
        else:
            for field, value in profile_defaults.items():
                setattr(profile, field, value)
            profile.save(update_fields=list(profile_defaults.keys()))
        return profile

    def _upsert_contract_relatie(
        self,
        provider: Zorgaanbieder,
        batch: ProviderImportBatch,
        data: dict,
    ) -> ContractRelatie | None:
        if not self.organization:
            return None

        source_label = str(self.source_system or "").lower()
        if any(hint in source_label for hint in REGISTRY_SOURCE_HINTS) and not any(
            hint in source_label for hint in CONTRACT_SOURCE_HINTS
        ):
            logger.info(
                "Skipping ContractRelatie for provider=%s in batch=%s; registry source is not an authoritative contract source",
                provider.pk,
                batch.batch_ref,
            )
            return None

        contract_type = str(data.get("contract_type") or "").strip()
        raw_status = str(data.get("contract_status") or "").upper()
        contract_start = data.get("contract_start")
        contract_end = data.get("contract_end")
        zorgvormen_contract = data.get("zorgvormen_contract") or []
        gemeente_contract = str(data.get("gemeente_contract") or "").strip()
        regio_contract = str(data.get("regio_contract") or data.get("region") or "").strip()

        has_contract_evidence = any([
            contract_type,
            raw_status,
            contract_start,
            contract_end,
            bool(zorgvormen_contract),
            gemeente_contract,
            regio_contract,
        ])
        if not has_contract_evidence:
            logger.info(
                "Skipping ContractRelatie for provider=%s in batch=%s; no contract source fields supplied",
                provider.pk,
                batch.batch_ref,
            )
            return None

        if not contract_type:
            contract_type = "ONBEKEND"

        status_map = {
            "ACTIEF": ContractRelatie.ContractStatus.ACTIEF,
            "ACTIVE": ContractRelatie.ContractStatus.ACTIEF,
            "VERLOPEN": ContractRelatie.ContractStatus.VERLOPEN,
            "EXPIRED": ContractRelatie.ContractStatus.VERLOPEN,
            "OPGESCHORT": ContractRelatie.ContractStatus.OPGESCHORT,
            "SUSPENDED": ContractRelatie.ContractStatus.OPGESCHORT,
            "CONCEPT": ContractRelatie.ContractStatus.CONCEPT,
            "UNKNOWN": ContractRelatie.ContractStatus.CONCEPT,
            "ONBEKEND": ContractRelatie.ContractStatus.CONCEPT,
        }
        status = status_map.get(raw_status, ContractRelatie.ContractStatus.CONCEPT)
        actief_contract = status == ContractRelatie.ContractStatus.ACTIEF

        relation, _ = ContractRelatie.objects.update_or_create(
            zorgaanbieder=provider,
            organization=self.organization,
            contract_type=contract_type,
            defaults={
                "status": status,
                "start_date": contract_start or None,
                "end_date": contract_end or None,
                "gemeente": gemeente_contract,
                "regio": regio_contract,
                "zorgvormen_contract": zorgvormen_contract,
                "actief_contract": actief_contract,
                "opmerkingen_contract": "Contractstatus onbekend" if not raw_status else "",
                "import_batch": batch,
            },
        )
        return relation

    # ------------------------------------------------------------------
    # Close batch
    # ------------------------------------------------------------------

    def _close_batch(
        self, batch: ProviderImportBatch, summary: dict[str, int]
    ) -> None:
        total = sum(summary.values())
        has_errors = summary.get("quarantined", 0) > 0

        batch.processed_records = total
        batch.created_records = summary["created"]
        batch.updated_records = summary["updated"]
        batch.skipped_records = summary["skipped"]
        batch.conflicted_records = summary["conflicted"]
        batch.quarantined_records = summary["quarantined"]
        batch.status = (
            ProviderImportBatch.BatchStatus.PARTIAL if has_errors else
            ProviderImportBatch.BatchStatus.COMPLETED
        )
        batch.completed_at = timezone.now()
        batch.save(update_fields=[
            "processed_records", "created_records", "updated_records",
            "skipped_records", "conflicted_records", "quarantined_records",
            "status", "completed_at",
        ])

        bron_batch = self._get_or_create_bron_batch(batch)
        bron_batch.status = (
            BronImportBatch.Status.PARTIAL if has_errors else BronImportBatch.Status.COMPLETED
        )
        bron_batch.afgerond_op = batch.completed_at
        bron_batch.geslaagd_records = summary['created'] + summary['updated'] + summary['skipped']
        bron_batch.gefaald_records = summary['quarantined']
        bron_batch.warnings_count = summary['conflicted']
        bron_batch.save(update_fields=[
            'status', 'afgerond_op', 'geslaagd_records', 'gefaald_records', 'warnings_count'
        ])

        logger.info(
            "Batch %s closed: created=%d updated=%d skipped=%d "
            "conflicted=%d quarantined=%d",
            batch.batch_ref,
            summary["created"], summary["updated"], summary["skipped"],
            summary["conflicted"], summary["quarantined"],
        )
