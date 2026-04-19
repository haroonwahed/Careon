"""
Tests for the provider data pipeline.

Covers:
  - Mapping rules and normalization (unit tests, no DB)
  - Validation rules (unit tests)
  - Confidence scoring
  - Pipeline ingestion, validation, and promotion (integration tests)
  - Conflict detection on protected fields
  - Idempotency: duplicate fingerprint → SKIPPED
  - Quarantine: invalid records with low confidence
  - Staging record immutability check
  - Management command dry-run smoke test
"""

from __future__ import annotations

from io import StringIO
from pathlib import Path
from tempfile import NamedTemporaryFile

from django.test import TestCase

from contracts.models import (
    AanbiederVestiging,
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
from contracts.provider_adapters import CsvFileAdapter, FixtureAdapter
from contracts.provider_pipeline import ProviderPipeline
from contracts.provider_pipeline_mapping import (
    compute_confidence_score,
    map_payload_to_canonical,
    normalize_agb_code,
    normalize_kvk,
    normalize_postcode,
    normalize_provider_type,
    normalize_region_code,
    normalize_region_list,
    validate_canonical_data,
)


# ---------------------------------------------------------------------------
# Mapping / normalization unit tests
# ---------------------------------------------------------------------------

class NormalizationTests(TestCase):

    def test_agb_code_zero_padded(self):
        self.assertEqual(normalize_agb_code("1234567"), "01234567")

    def test_agb_code_strips_non_numeric(self):
        self.assertEqual(normalize_agb_code("AGB-00000001"), "00000001")

    def test_agb_code_empty(self):
        self.assertEqual(normalize_agb_code(None), "")
        self.assertEqual(normalize_agb_code(""), "")

    def test_kvk_strips_non_numeric(self):
        self.assertEqual(normalize_kvk("12.34.56.78"), "12345678")

    def test_kvk_max_8_digits(self):
        self.assertEqual(normalize_kvk("123456789999"), "12345678")

    def test_postcode_normalised(self):
        self.assertEqual(normalize_postcode("3511 AA"), "3511AA")
        self.assertEqual(normalize_postcode("3511aa"), "3511AA")

    def test_provider_type_known(self):
        self.assertEqual(normalize_provider_type("ambulante begeleiding"), "AMBULANT")
        self.assertEqual(normalize_provider_type("Residentiële zorg"), "RESIDENTIEEL")
        self.assertEqual(normalize_provider_type("CRISIS"), "CRISISOPVANG")

    def test_provider_type_unknown_returns_overig(self):
        self.assertEqual(normalize_provider_type("iets anders"), "OVERIG")
        self.assertEqual(normalize_provider_type(None), "OVERIG")

    def test_region_code_known(self):
        self.assertEqual(normalize_region_code("utrecht"), "NL-UT")
        self.assertEqual(normalize_region_code("Amsterdam"), "NL-NH-AMS")

    def test_region_code_unknown_uppercased(self):
        self.assertEqual(normalize_region_code("leeuwarden"), "LEEUWARDEN")

    def test_region_list_comma_separated(self):
        result = normalize_region_list(["Utrecht", "Amsterdam"])
        self.assertIn("NL-UT", result)
        self.assertIn("NL-NH-AMS", result)

    def test_map_payload_aliases(self):
        payload = {
            "naam": "Test Zorg BV",
            "agb": "00000042",
            "kvknummer": "87654321",
            "type": "ambulant",
            "stad": "Utrecht",
            "regio": "Utrecht",
            "beschikbare_plekken": 3,
            "wachtlijst": 1,
            "gemiddelde_wachttijd": 5,
        }
        result = map_payload_to_canonical(payload)
        self.assertEqual(result["name"], "Test Zorg BV")
        self.assertEqual(result["agb_code"], "00000042")
        self.assertEqual(result["kvk_number"], "87654321")
        self.assertEqual(result["provider_type"], "AMBULANT")
        self.assertEqual(result["city"], "Utrecht")
        self.assertEqual(result["open_slots"], 3)

    def test_map_payload_boolean_coercion(self):
        payload = {"ambulant": "ja", "residentieel": 0, "crisis": True}
        result = map_payload_to_canonical(payload)
        self.assertTrue(result["biedt_ambulant"])
        self.assertFalse(result["biedt_residentieel"])
        self.assertTrue(result["biedt_crisis"])


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

class ValidationTests(TestCase):

    def test_valid_record_no_errors(self):
        data = map_payload_to_canonical({
            "naam": "Valid Provider",
            "agb": "12345678",
            "latitude": 52.0,
            "longitude": 5.1,
            "beschikbare_plekken": 5,
            "maximale_capaciteit": 10,
        })
        errors = validate_canonical_data(data)
        self.assertEqual(errors, [])

    def test_missing_name_is_error(self):
        errors = validate_canonical_data({"name": "", "agb_code": "12345678"})
        self.assertTrue(any("name" in e for e in errors))

    def test_bad_agb_code(self):
        data = map_payload_to_canonical({"naam": "X", "agb": "ABC"})
        # AGB normalised to "" since no digits → no AGB error, just missing
        self.assertEqual(data["agb_code"], "")

    def test_open_slots_exceeds_max_capacity(self):
        data = {
            "name": "Provider X",
            "agb_code": "12345678",
            "open_slots": 20,
            "max_capacity": 10,
        }
        errors = validate_canonical_data(data)
        self.assertTrue(any("open_slots" in e for e in errors))

    def test_latitude_out_of_range(self):
        data = {
            "name": "Provider X",
            "agb_code": "12345678",
            "latitude": 200.0,
            "longitude": 5.0,
            "open_slots": 0,
            "max_capacity": 0,
        }
        errors = validate_canonical_data(data)
        self.assertTrue(any("latitude" in e for e in errors))

    def test_confidence_decreases_with_errors(self):
        data = {"name": "X", "agb_code": "", "open_slots": 0, "max_capacity": 0}
        errors = validate_canonical_data(data)
        score = compute_confidence_score(data, errors)
        self.assertLess(score, 1.0)

    def test_confidence_full_for_complete_record(self):
        data = map_payload_to_canonical({
            "naam": "Complete Provider",
            "agb": "12345678",
            "kvk": "87654321",
            "regio": "Utrecht",
            "latitude": 52.0,
            "longitude": 5.0,
        })
        errors = validate_canonical_data(data)
        score = compute_confidence_score(data, errors)
        self.assertGreaterEqual(score, 0.8)


# ---------------------------------------------------------------------------
# Pipeline integration tests
# ---------------------------------------------------------------------------

class PipelineIngestTests(TestCase):

    def setUp(self):
        self.org = Organization.objects.create(name="Gemeente Utrecht", slug="gemeente-utrecht")
        self.pipeline = ProviderPipeline(
            source_system="test_source",
            triggered_by="test",
            organization=self.org,
        )

    def _make_record(self, **kwargs):
        base = {
            "source_id": "SRC-001",
            "agb_code": "00000001",
            "naam": "Test Aanbieder",
            "type": "ambulant",
            "stad": "Utrecht",
            "regio": "Utrecht",
            "latitude": 52.09,
            "longitude": 5.12,
            "beschikbare_plekken": 3,
            "maximale_capaciteit": 10,
        }
        base.update(kwargs)
        return base

    def test_ingest_creates_staging_records(self):
        batch = self.pipeline.open_batch()
        count = self.pipeline.ingest(batch, [self._make_record()])
        self.assertEqual(count, 1)
        self.assertEqual(ProviderStagingRecord.objects.filter(batch=batch).count(), 1)

    def test_ingest_skips_record_without_source_id(self):
        batch = self.pipeline.open_batch()
        count = self.pipeline.ingest(batch, [{"naam": "No ID"}])
        self.assertEqual(count, 0)

    def test_staging_record_is_immutable_raw(self):
        """Raw payload stored exactly as received, before any normalization."""
        batch = self.pipeline.open_batch()
        raw = self._make_record()
        self.pipeline.ingest(batch, [raw])
        staging = ProviderStagingRecord.objects.filter(batch=batch).first()
        self.assertEqual(staging.raw_payload["naam"], "Test Aanbieder")
        self.assertEqual(staging.source_agb_code, "00000001")

    def test_fingerprint_computed_deterministically(self):
        record = self._make_record()
        fp1 = ProviderStagingRecord.compute_fingerprint(record)
        fp2 = ProviderStagingRecord.compute_fingerprint(record)
        self.assertEqual(fp1, fp2)
        self.assertEqual(len(fp1), 64)

    def test_promote_creates_canonical_entities(self):
        batch = self.pipeline.open_batch()
        self.pipeline.ingest(batch, [self._make_record()])
        summary = self.pipeline.promote_batch(batch)

        self.assertEqual(summary["created"], 1)
        self.assertEqual(Zorgaanbieder.objects.count(), 1)
        self.assertEqual(AanbiederVestiging.objects.count(), 1)
        self.assertEqual(Zorgprofiel.objects.count(), 1)
        self.assertEqual(CapaciteitRecord.objects.count(), 1)

    def test_promote_creates_contract_relatie_when_org_set(self):
        batch = self.pipeline.open_batch()
        self.pipeline.ingest(batch, [self._make_record()])
        self.pipeline.promote_batch(batch)
        self.assertEqual(ContractRelatie.objects.count(), 1)

    def test_promote_no_contract_relatie_without_org(self):
        pipeline = ProviderPipeline(source_system="test_no_org", triggered_by="test")
        batch = pipeline.open_batch()
        pipeline.ingest(batch, [self._make_record()])
        pipeline.promote_batch(batch)
        self.assertEqual(ContractRelatie.objects.count(), 0)

    def test_promote_logs_sync_action(self):
        batch = self.pipeline.open_batch()
        self.pipeline.ingest(batch, [self._make_record()])
        self.pipeline.promote_batch(batch)
        self.assertTrue(ProviderSyncLog.objects.filter(
            action=ProviderSyncLog.SyncAction.CREATED
        ).exists())

    def test_batch_status_completed_after_promote(self):
        batch = self.pipeline.open_batch()
        self.pipeline.ingest(batch, [self._make_record()])
        self.pipeline.promote_batch(batch)
        batch.refresh_from_db()
        self.assertEqual(batch.status, ProviderImportBatch.BatchStatus.COMPLETED)

    def test_idempotency_same_fingerprint_skipped(self):
        """Re-importing identical record should be SKIPPED, not CREATED again."""
        batch1 = self.pipeline.open_batch()
        record = self._make_record()
        self.pipeline.ingest(batch1, [record])
        self.pipeline.promote_batch(batch1)

        # Second import with identical data
        batch2 = self.pipeline.open_batch()
        self.pipeline.ingest(batch2, [record])
        summary2 = self.pipeline.promote_batch(batch2)

        # Canonical count stays at 1
        self.assertEqual(Zorgaanbieder.objects.count(), 1)
        self.assertEqual(summary2["skipped"], 1)

    def test_update_non_protected_field(self):
        """Non-protected field (phone) should update without conflict."""
        batch1 = self.pipeline.open_batch()
        self.pipeline.ingest(batch1, [self._make_record(telefoon="030-111")])
        self.pipeline.promote_batch(batch1)

        batch2 = self.pipeline.open_batch()
        self.pipeline.ingest(batch2, [self._make_record(telefoon="030-999")])
        summary2 = self.pipeline.promote_batch(batch2)

        self.assertEqual(summary2["updated"], 1)
        self.assertEqual(Zorgaanbieder.objects.first().phone, "030-999")

    def test_conflict_on_protected_field(self):
        """Changing 'name' on an existing provider should create a conflict."""
        batch1 = self.pipeline.open_batch()
        self.pipeline.ingest(batch1, [self._make_record(naam="Oorspronkelijke Naam")])
        self.pipeline.promote_batch(batch1)

        batch2 = self.pipeline.open_batch()
        self.pipeline.ingest(batch2, [self._make_record(naam="Andere Naam")])
        summary2 = self.pipeline.promote_batch(batch2)

        self.assertEqual(summary2["conflicted"], 1)
        self.assertEqual(ProviderSyncConflict.objects.count(), 1)
        conflict = ProviderSyncConflict.objects.first()
        self.assertEqual(conflict.field_name, "name")
        self.assertEqual(conflict.resolution_status,
                         ProviderSyncConflict.ResolutionStatus.UNRESOLVED)
        # Canonical name must NOT have been overwritten
        self.assertEqual(Zorgaanbieder.objects.first().name, "Oorspronkelijke Naam")

    def test_quarantine_for_record_missing_name(self):
        """Record without name should be quarantined, not promoted."""
        batch = self.pipeline.open_batch()
        bad_record = {"source_id": "BAD-001", "agb_code": "99999999"}
        self.pipeline.ingest(batch, [bad_record])
        summary = self.pipeline.promote_batch(batch)
        self.assertEqual(Zorgaanbieder.objects.count(), 0)
        self.assertGreater(summary["quarantined"], 0)

    def test_capacity_appended_each_run(self):
        """CapaciteitRecord should be appended each import, preserving history."""
        batch1 = self.pipeline.open_batch()
        self.pipeline.ingest(batch1, [self._make_record(beschikbare_plekken=5)])
        self.pipeline.promote_batch(batch1)

        batch2 = self.pipeline.open_batch()
        self.pipeline.ingest(batch2, [self._make_record(beschikbare_plekken=3)])
        self.pipeline.promote_batch(batch2)

        self.assertEqual(CapaciteitRecord.objects.count(), 2)

    def test_fixture_adapter_produces_records(self):
        adapter = FixtureAdapter()
        records = list(adapter.records())
        self.assertGreater(len(records), 0)
        self.assertIn("source_id", records[0])

    def test_full_fixture_import(self):
        """Full pipeline run with all fixture records."""
        adapter = FixtureAdapter()
        batch = self.pipeline.open_batch()
        self.pipeline.ingest(batch, adapter.records())
        summary = self.pipeline.promote_batch(batch)

        total = sum(v for k, v in summary.items() if k != "quarantined")
        self.assertGreater(total, 0)
        self.assertEqual(Zorgaanbieder.objects.count(), len(list(FixtureAdapter().records())))

    def test_csv_adapter_reads_rows_from_file(self):
        with NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as tmp:
            tmp.write("source_id,agb_code,naam,type,stad,regio,beschikbare_plekken,maximale_capaciteit\n")
            tmp.write("CSV-001,00000011,CSV Zorg,ambulant,Utrecht,Utrecht,4,12\n")
            csv_path = Path(tmp.name)

        self.addCleanup(lambda: csv_path.unlink(missing_ok=True))

        adapter = CsvFileAdapter(path=csv_path)
        records = list(adapter.records())

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["source_id"], "CSV-001")
        self.assertEqual(records[0]["naam"], "CSV Zorg")

    def test_full_csv_import_pipeline(self):
        with NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as tmp:
            tmp.write(
                "source_id,agb_code,kvk,naam,type,stad,regio,latitude,longitude,beschikbare_plekken,maximale_capaciteit\n"
            )
            tmp.write(
                "CSV-100,00000100,11112222,CSV Aanbieder 100,ambulant,Utrecht,Utrecht,52.09,5.12,3,10\n"
            )
            tmp.write(
                "CSV-101,00000101,11113333,CSV Aanbieder 101,residentieel,Amsterdam,Amsterdam,52.37,4.89,2,8\n"
            )
            csv_path = Path(tmp.name)

        self.addCleanup(lambda: csv_path.unlink(missing_ok=True))

        adapter = CsvFileAdapter(path=csv_path)
        batch = self.pipeline.open_batch()
        self.pipeline.ingest(batch, adapter.records())
        summary = self.pipeline.promote_batch(batch)

        self.assertEqual(summary["created"], 2)
        self.assertEqual(Zorgaanbieder.objects.count(), 2)
        self.assertEqual(ContractRelatie.objects.count(), 2)


# ---------------------------------------------------------------------------
# Management command dry-run test
# ---------------------------------------------------------------------------

class ManagementCommandTests(TestCase):

    def setUp(self):
        Organization.objects.create(name="Gemeente Utrecht", slug="gemeente-utrecht")

    def test_dry_run_does_not_write_canonical(self):
        from django.core.management import call_command
        out = StringIO()
        call_command(
            "run_provider_import",
            "--source", "fixture",
            "--dry-run",
            stdout=out,
        )
        self.assertEqual(Zorgaanbieder.objects.count(), 0)
        output = out.getvalue()
        self.assertIn("DRY RUN", output)

    def test_full_run_creates_providers(self):
        from django.core.management import call_command
        out = StringIO()
        call_command(
            "run_provider_import",
            "--source", "fixture",
            stdout=out,
        )
        self.assertGreater(Zorgaanbieder.objects.count(), 0)
        output = out.getvalue()
        self.assertIn("Import complete", output)

    def test_csv_import_command_creates_providers(self):
        from django.core.management import call_command

        with NamedTemporaryFile(mode="w", suffix=".csv", delete=False, encoding="utf-8") as tmp:
            tmp.write(
                "source_id,agb_code,kvk,naam,type,stad,regio,latitude,longitude,beschikbare_plekken,maximale_capaciteit\n"
            )
            tmp.write(
                "CMD-CSV-001,00000901,90112233,Cmd CSV Zorg 1,ambulant,Utrecht,Utrecht,52.10,5.10,5,12\n"
            )
            tmp.write(
                "CMD-CSV-002,00000902,90112234,Cmd CSV Zorg 2,residentieel,Rotterdam,Rotterdam,51.92,4.48,1,6\n"
            )
            csv_path = Path(tmp.name)

        self.addCleanup(lambda: csv_path.unlink(missing_ok=True))

        out = StringIO()
        call_command(
            "run_provider_import",
            "--source", "csv_import",
            "--file", str(csv_path),
            stdout=out,
        )

        self.assertEqual(Zorgaanbieder.objects.count(), 2)
        self.assertIn("Import complete", out.getvalue())
