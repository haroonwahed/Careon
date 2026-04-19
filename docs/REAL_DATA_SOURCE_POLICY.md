# Real Data Source Policy (Zorgregie)

This project now enforces a real-source-first provider data policy.

## Allowed data source categories

1. Provider master source
- Primary source: AGB/Vektis-style registry exports.
- Used for: provider organization identity, vestiging identity, AGB/KVK and base metadata.

2. Municipality and region source
- Real Dutch municipality and region data only.
- Gemeente -> jeugdregio mapping stays sourced from the existing canonical backbone in this repository.

3. Contract source
- Real municipal/regional contract files only.
- When contract source is missing, contract fields remain unknown.

4. Operational source
- Capacity, waiting time, intake speed and operational notes are internal operational records.
- Missing operational values are represented as unknown by absence of a snapshot.

## Forbidden

- Fake provider names/locations.
- Invented capacity, waiting time, contracts, or performance metrics.
- Silent assumptions that unknown means active/available.

## Command-level enforcement

- run_provider_import
  - fixture source is blocked by default.
  - use --allow-fixture only for isolated automated tests.

- seed_providers
  - blocked by default because it generates synthetic data.
  - use --allow-fake-seed only for isolated automated tests.

- import_municipal_contracts
  - imports real contract files.
  - unknown contract status maps to CONCEPT + actief_contract=False.

- update_provider_capacity
  - appends manual internal operational snapshots with actor and timestamp.
  - never fabricates values.

## Matching behavior with incomplete data

- Missing contract/coverage/capacity does not silently become a positive match signal.
- Candidate remains visible with verification labels such as:
  - Contractstatus onbekend
  - Contract verifiëren
  - Capaciteit onbekend
  - Nog geen wachttijd aangeleverd
- Confidence is reduced when those signals are unknown.

## Provenance separation

- Raw source payloads remain in staging/import tables.
- Canonical entities remain separate.
- Internal operational updates are append-only snapshots.
