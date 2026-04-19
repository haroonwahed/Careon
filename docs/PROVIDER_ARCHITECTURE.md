<!-- markdownlint-disable MD013 MD036 MD040 MD060 -->

# Provider Data Architecture — Zorg OS / ZorgBuddy

_Last updated: v2 (migration 0043)_

---

## 1. Design Principles

| Principle | Rule |
|---|---|
| No flat tables | Provider data is split across purpose-specific models. Never one giant table. |
| Profile-level matching | Matching operates on `Zorgprofiel`, not `Zorgaanbieder`. One provider can have many profiles. |
| Staging isolation | External data enters via staging only. It never writes directly to canonical tables. |
| Protected fields | Certain canonical fields cannot be auto-overwritten by sync. They require manual review. |
| Append-only capacity | `CapaciteitRecord` rows are never updated. Each sync creates a new record. |
| Canonical read model | UI and matching engine read only from canonical tables. Never from staging or raw records. |
| Explainable matching | Every `MatchResultaat` includes per-dimension scores and trade-off notes. |

---

## 2. Domain Model (Canonical Layer)

```
Zorgaanbieder (1) ──────────────────────────────── (N) AanbiederVestiging
     │                                                        │
     │ (N) Zorgprofiel ◄──────────────────────── (N) Zorgprofiel
     │                                                        │
     │                                            (N) CapaciteitRecord
     │
     │ (N) ContractRelatie ──► Organization
     │ (N) ContactpersoonAanbieder
     │
     ▼
Zorgprofiel (1) ──── (1) PrestatieProfiel
Zorgprofiel (N) ──── (N) MatchResultaat ──► CareCase
```

### 2.1 Zorgaanbieder

Top-level legal entity. One per AGB code or KVK number.

Key fields:

- `name`, `handelsnaam` — legal name and trading name
- `agb_code`, `kvk_number` — identifiers (protected, never auto-overwritten)
- `provider_type` — AMBULANT / RESIDENTIEEL / DAGBEHANDELING / THUISBEGELEIDING / CRISISOPVANG
- `bron_type` — manual / seeded / csv_import / api
- `normalisatie_status` — PENDING / NORMALIZED / PARTIAL / FAILED
- `review_status` — PENDING / APPROVED / FLAGGED / REJECTED
- `landelijk_dekkend` — operates nationally (no region restriction)
- `is_handmatig_verrijkt`, `is_handmatig_overschreven` — sync protection flags

### 2.2 AanbiederVestiging

Physical location or branch of a `Zorgaanbieder`. A provider may have 1–N vestigingen.

Key fields:

- `vestiging_code`, `agb_code_vestiging` — branch identifiers
- `straat`, `huisnummer`, `postcode`, `gemeente`, `provincie` — address
- `region`, `regio_jeugd` — Jeugdwet region code
- `is_primary` — whether this is the main contact location
- `bron_type`, `bron_id` — sync provenance

### 2.3 Zorgprofiel

A care offering of a specific vestiging or aanbieder. Matching operates here.

A `Zorgprofiel` belongs to either:

- An `AanbiederVestiging` (preferred for new records), **or**
- Directly to a `Zorgaanbieder` (backward compatible with v1)

Key fields:

- `zorgvorm` — ambulant / residentieel / dagbehandeling / thuisbegeleiding / crisisopvang
- `zorgdomein` — jeugd / jeugd_ggz / jeugd_lvb / volwassenen / forensisch
- `doelgroep_leeftijd_van`, `doelgroep_leeftijd_tot` — age range in years
- `problematiek_types` — JSONField list of diagnoses/problems the profile handles
- `specialisaties` — comma-separated specialist areas
- `intensiteit` — licht / middel / intensief / hoog_intensief
- `setting_type` — open / besloten / semi_besloten
- `crisis_opvang_mogelijk` — accepts crisis placements
- `lvb_geschikt`, `autisme_geschikt`, `trauma_geschikt` — clinical suitability flags
- `ggz_comorbiditeit_mogelijk`, `verslavingsproblematiek_mogelijk` — comorbidity support
- `actief` — whether this profile is currently matchable

V1 boolean flags (backward-compatible):

- `biedt_ambulant`, `biedt_residentieel`, etc.
- `leeftijd_0_4`, `leeftijd_4_12`, `leeftijd_12_18`, `leeftijd_18_plus`
- `complexiteit_*`, `urgentie_*`

### 2.4 CapaciteitRecord

Append-only time-series capacity snapshot per vestiging/profiel.

Key fields:

- `open_slots`, `beschikbare_capaciteit`, `totale_capaciteit`
- `wachtlijst_aantal`, `gemiddelde_wachttijd_dagen`
- `direct_pleegbaar` — available within 7 days
- `betrouwbaarheid_score` — 0.0–1.0 data quality signal
- `recorded_at`, `import_batch` — full provenance chain

**Rule:** Never UPDATE a `CapaciteitRecord`. Always INSERT a new row.

### 2.5 ContractRelatie

A contract between a `Zorgaanbieder` and an `Organization` (municipality/region).

Key fields:

- `contract_type` — e.g. JW_310, WMO_H63
- `actief_contract` — bool (derived from status + dates)
- `gemeente`, `regio` — geographic scope
- `zorgvormen_contract` — JSONField list of contracted care forms
- `voorkeursaanbieder` — preferred provider flag

### 2.6 PrestatieProfiel

Aggregated performance metrics per `Zorgprofiel`.

Key fields:

- `succesratio_match_naar_plaatsing` — % of matches that resulted in placement
- `gemiddelde_reactietijd_uren` — avg hours from match to response
- `gemiddelde_doorlooptijd_dagen` — avg days from intake to closure
- `intake_no_show_ratio`, `plaatsing_voortijdig_beeindigd_ratio` — risk signals

Not every profile has a `PrestatieProfiel`. When absent, the matching engine uses neutral scores.

### 2.7 ContactpersoonAanbieder

Named contacts at a provider for match, intake, and contract communication.

---

## 3. Staging / Import Layer

External data sources never write directly to canonical tables. All imports flow through:

```
External Source
     │
     ▼
ProviderImportBatch  (one per import run)
     │
     ├── ProviderStagingRecord  (raw_payload stored, immutable after insert)
     │         │
     │         ▼
     │   Validation + Normalization (provider_pipeline_mapping.py)
     │         │
     │         ├── PASS → promote to canonical (Zorgaanbieder, AanbiederVestiging, etc.)
     │         └── FAIL → BronMappingIssue created for human review
     │
     └── BronSyncLog  (per-record status: normalized / partial / failed)
```

### Staging Models

| Model | Purpose |
|---|---|
| `ProviderImportBatch` | One record per import run. Tracks source, counts, status. |
| `ProviderStagingRecord` | One record per external entity. `raw_payload` is immutable. |
| `BronSyncLog` | Per-field normalization log attached to a staging record. |
| `BronMappingIssue` | Human-reviewable issues: unknown values, ambiguous mappings, missing required fields. |

---

## 4. Data Source Strategy

| `bron_type` | Description |
|---|---|
| `manual` | Entered via Django admin or internal form. Never auto-overwritten. |
| `seeded` | Created by `manage.py seed_providers`. Safe to clear with `--clear`. |
| `csv_import` | Uploaded CSV processed through the pipeline. |
| `api` | External API sync (future: Vektis, AGB register). |

---

## 5. Protected Fields

The following fields are **never** automatically overwritten when a sync runs:

| Model | Protected Fields |
|---|---|
| `Zorgaanbieder` | `name`, `agb_code`, `kvk_number`, `provider_type` |
| `Zorgaanbieder` | Contract status, all `ContractRelatie` fields |
| `CapaciteitRecord` | All rows — append-only, never mutated |
| `Zorgprofiel` | `omschrijving_match_context`, `contra_indicaties` when `is_handmatig_verrijkt=True` |
| `Zorgaanbieder` | All fields when `is_handmatig_overschreven=True` |

To change a protected field, a human must:

1. Set `is_handmatig_overschreven=False` (or use the admin override)
2. Make the change explicitly via the admin or a management command
3. Re-set the protection flag

---

## 6. Normalization Pipeline

The `contracts/provider_pipeline_mapping.py` module owns all mapping logic.

### Field Resolution

`_FIELD_ALIASES` maps each canonical field name to an ordered list of source field name alternatives. The first non-null match wins.

### Normalization Steps (in order)

1. AGB code → zero-padded 8-digit string
2. KVK number → 8-digit stripped numeric string
3. Provider type → uppercase enum (`_PROVIDER_TYPE_MAP`)
4. Postcode → `1234AB` format (spaces stripped, uppercased)
5. Region list → canonical `NL-XX` codes via `_REGION_CODE_MAP`
6. All booleans → `coerce_bool()` (accepts true/1/ja/yes)
7. Integer fields → explicit `int()` cast with null fallback
8. Float fields → `round(float(), 2)` with null fallback
9. `problematiek_types` → list (from list or comma-separated string)
10. String fields → stripped, empty string on null

### Validation Rules

- `name` is required
- `agb_code` must match `/[0-9]{8}/` if present
- `latitude` ∈ [-90, 90], `longitude` ∈ [-180, 180]
- `open_slots` ≤ `max_capacity`
- `doelgroep_leeftijd_van` ≤ `doelgroep_leeftijd_tot`
- `beschikbare_capaciteit` ≤ `totale_capaciteit`
- `betrouwbaarheid_score` ∈ [0.0, 1.0]

---

## 7. Matching Read Model

The matching engine (`contracts/provider_matching_service.py`) is a pure deterministic function over canonical tables.

### Inputs

A `MatchContext` dataclass with:

- `zorgvorm`, `leeftijd`, `regio`, `gemeente`
- `complexiteit`, `urgentie`, `problematiek`
- Clinical flags: `lvb`, `autisme`, `trauma`, `ggz_comorbiditeit`, etc.

### Scoring Dimensions

| Dimension | Weight | Signal |
|---|---|---|
| Inhoudelijke fit | 0.35 | Zorgvorm, leeftijd, problematiek overlap, clinical flags |
| Capaciteit | 0.25 | Beschikbare plekken, wachttijd, direct_pleegbaar |
| Contract/regio | 0.20 | Active contract for organization, municipality match, region match |
| Complexiteit | 0.10 | Setting, intensiteit fit to case severity |
| Performance | 0.10 | PrestatieProfiel: plaatsingsratio, reactietijd, no-show ratio |

Score weights sum = 1.0 (asserted at module load).

### Hard Exclusions

Before scoring, a profile is excluded if:

- Not active (`actief=False`)
- No capacity at all (totale_capaciteit=0, no open slots)
- Age out of range (strict exclusion)
- Clinical mismatch (e.g., needs LVB care but `lvb_geschikt=False`)
- Crisis case but `crisis_opvang_mogelijk=False`
- No contract for requesting organization (in organization-scoped queries)

### Confidence Labels

| Score | Label |
|---|---|
| ≥ 0.80 | HOOG |
| ≥ 0.60 | MIDDEL |
| ≥ 0.40 | LAAG |
| < 0.40 | ONZEKER |

### Output: `MatchResultaat`

Each result stores:

- `totaalscore` and per-dimension scores
- `confidence_label`
- `fit_samenvatting` — human-readable summary
- `trade_offs` — JSONField array of trade-off notes (e.g., "Wachttijd 45 dagen")
- `verificatie_advies` — recommended follow-up
- `ranking` — position in result set

### Usage Example

```python
from contracts.provider_matching_service import MatchEngine, MatchContext

ctx = MatchContext(
    zorgvorm="ambulant",
    leeftijd=12,
    regio="NL-UT",
    gemeente="Utrecht",
    complexiteit="meervoudig",
    urgentie="hoog",
    problematiek=["trauma en PTSS", "hechtingsproblemen"],
    lvb=False,
    autisme=True,
)

results = MatchEngine().run(ctx, casus=case_obj, max_results=5, persist=True)
for r in results:
    print(r.ranking, r.zorgprofiel, r.totaalscore, r.confidence_label)
```

---

## 8. Filter Service

`contracts/legacy_backend/provider_filter_service.py` provides two entry points for UI/API:

```python
from contracts.legacy_backend.provider_filter_service import filter_zorgprofielen, filter_zorgaanbieders

# Profile search
qs = filter_zorgprofielen(filters={
    "zorgvorm": "ambulant",
    "leeftijd_van": 10,
    "regio": "NL-UT",
    "autisme_geschikt": True,
    "contract_actief": True,
}, organization_id=org.id)

# Provider search
qs = filter_zorgaanbieders(filters={
    "naam": "Pluryn",
    "gemeente": "Utrecht",
})
```

Both functions return Django querysets. Pagination, serialization, and permissions are caller responsibility.

---

## 9. Seed Data

The `seed_providers` management command creates a consistent development dataset:

```bash
# Seed with defaults (no contracts)
python manage.py seed_providers

# Seed with contracts for a specific org
python manage.py seed_providers --organization-slug gemeente-utrecht

# Clear and re-seed
python manage.py seed_providers --clear
```

Seed data properties:

- 25 `Zorgaanbieder` records with realistic Dutch names
- 40+ `AanbiederVestiging` records across Utrecht, Amsterdam, Rotterdam, Eindhoven etc.
- 60+ `Zorgprofiel` records: mix of care forms, age ranges, and clinical specializations
- One `CapaciteitRecord` per vestiging (realistic but randomized)
- `bron_type=seeded`, `normalisatie_status=NORMALIZED`, `review_status=APPROVED`
- All created idempotently: re-running without `--clear` is safe

---

## 10. Future API Integration

To add a new external data source (e.g., Vektis AGB register, ZorgkaartNederland):

1. Create an adapter in `contracts/provider_adapters.py` that fetches and returns a list of raw payload dicts
2. Call `ProviderImportBatch.objects.create(source_system="api", ...)` to open a batch
3. For each record: create a `ProviderStagingRecord` with `raw_payload` (immutable)
4. Call `map_payload_to_canonical()` → `validate_canonical_data()` → promote to canonical
5. Log result in `BronSyncLog`; if mapping fails, create `BronMappingIssue`
6. Close the batch with updated counts and status

The staging → canonical promotion logic lives in `contracts/provider_pipeline.py` and must never be bypassed.
