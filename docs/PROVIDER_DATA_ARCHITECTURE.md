<!-- markdownlint-disable MD013 -->

# Provider Data Architecture (Zorg OS / ZorgBuddy)

## 1. Canonical Domain Model

Internal system-of-record entities:

- `Zorgaanbieder`: organization-level provider identity and baseline registry metadata.
- `AanbiederVestiging`: physical branch/location details per provider.
- `Zorgprofiel`: primary matching entity (care form, domain, doelgroep, contraindications, suitability flags).
- `CapaciteitRecord`: point-in-time capacity snapshots (append-only history).
- `ContractRelatie`: contractability and regional contracting context.
- `PrestatieProfiel`: internal performance signals per `Zorgprofiel`.
- `ContactpersoonAanbieder`: operational contacts for matching, contracting, intake.
- `MatchResultaat`: explainable matching output per casus-candidate.

These canonical models are the only allowed read source for UI and matching services.

## 2. Staging / Import Layer

External source ingestion is isolated in staging entities:

- `BronImportBatch`: import lifecycle and counters per run.
- `BronRecordRaw`: immutable raw records (`payload_json`, `record_hash`, status).
- `BronSyncLog`: sync action logging between external IDs and internal entity IDs.
- `BronMappingIssue`: unresolved/ambiguous field mapping issues.

Compatibility layer remains available via existing `ProviderImportBatch` / `ProviderStagingRecord` / `ProviderSyncLog` / `ProviderSyncConflict` entities.

## 3. Import & Normalization Flow

1. Adapter fetches source records (`manual`, `seeded`, `csv_import`, `api`).
2. Pipeline opens `ProviderImportBatch` + linked `BronImportBatch`.
3. Each source record is stored raw in both staging representations:
   - canonical pipeline staging (`ProviderStagingRecord`)
   - explicit source staging (`BronRecordRaw`)
4. `provider_pipeline_mapping.py` performs deterministic alias mapping + normalization.
5. Validation assigns statuses (`VALID`, `INVALID`, `QUARANTINED`) and confidence.
6. Entity resolution and safe merge write to canonical models only.
7. Sync actions are logged (`ProviderSyncLog` and `BronSyncLog`).
8. Batch completion updates both batch tracking tables.

## 4. Source Sync Strategy

Supported source types:

- `manual`
- `seeded`
- `csv_import`
- `api`

Canonical entities persist source traceability fields:

- `bron_type`
- `bron_id`
- `bron_laatst_gesynchroniseerd_op`

No UI component or matching path reads staging/raw entities.

## 5. Protected Internal Fields

External synchronization must never override internal operational decisions by default.
Protected categories:

- contract state and contracting notes
- internal capacity operations
- matching suitability enrichment
- performance metrics
- manual operational notes and manual overrides

Operationally:

- pipeline updates baseline registry identity fields safely
- conflicts are logged, not force-overwritten
- `is_handmatig_verrijkt` / `is_handmatig_overschreven` flags remain available to enforce manual precedence

## 6. Matching Read Model

`contracts/provider_matching_service.py` reads only canonical internal data:

- hard exclusions before scoring
- deterministic weighted components
- explainability output (summary, trade-offs, verification advice)
- optional persistence to `MatchResultaat`

Score categories:

- `inhoudelijke_fit`
- `capaciteit_beschikbaarheid`
- `contract_regio_fit`
- `complexiteitsfit`
- `historische_performance`

## 7. Provider Filtering Support

Provider filtering now lives in the active provider workspace and matching surfaces. The supported filter vocabulary remains canonical and care-domain driven:

- naam
- regio
- gemeente
- zorgvorm
- leeftijdsrange
- problematiek
- specialisatie
- contract actief
- directe beschikbaarheid
- wachttijd
- crisis mogelijk

## 8. Seed Dataset

`seed_providers` command generates coherent relational development data:

- 25 `Zorgaanbieders`
- 40+ `AanbiederVestigingen`
- 60+ `Zorgprofielen`
- realistic capacity and contract distributions
- deterministic random seed for reproducibility

## 9. Future AGB/Vektis Integration (Pluggable)

Pluggable path without domain refactor:

1. Implement adapter that outputs raw dict records.
2. Feed records into existing import pipeline (`run_provider_import`).
3. Extend alias maps in `provider_pipeline_mapping.py` for source-specific fields.
4. Keep canonical schema unchanged; evolve mapping and validation only.

This preserves stable downstream contracts for UI, matching, and dashboards.
