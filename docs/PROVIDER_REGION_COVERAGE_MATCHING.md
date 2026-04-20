# Provider Region Coverage in Matching

## Purpose

This document describes how provider region coverage is integrated into the canonical matching architecture.

## New Canonical Entity

The model `ProviderRegioDekking` is the source of truth for regional provider coverage used by matching.

Fields:

- `zorgaanbieder`
- `aanbieder_vestiging`
- `regio`
- `is_primair_dekkingsgebied`
- `zorgvormen`
- `doelgroepen`
- `contract_actief`
- `capaciteit_meerekenen`
- `reisafstand_score`
- `dekking_status`
- `toelichting`
- `bron_type`
- `created_at`
- `updated_at`

## Casus Region Resolution

`CaseIntakeProcess` now stores:

- `gemeente`
- `regio` (resolved)

Resolution rule:

- `casus.gemeente -> gemeente.regions`
- First active region is selected deterministically by `region_type, region_name`.
- Region remains stable unless `gemeente` changes.

Compatibility:

- Existing `preferred_region` remains supported.
- `zorgvorm_gewenst` is synchronized with `preferred_care_form` for backward compatibility.

## Matching Engine Integration

The canonical engine in `contracts/legacy_backend/provider_matching_service.py` now:

- Uses `Zorgprofiel` as primary candidate entity.
- Validates active provider and vestiging state.
- Enforces active regional coverage through `ProviderRegioDekking` for the case region.
- Enforces active contractability through `ContractRelatie`.
- Applies capacity viability checks that are direct or waitlistable.
- Stores exclusion reasons in `uitgesloten` and `uitsluitreden`.

## Deterministic Scoring (0-100)

Components:

- Inhoudelijke fit: 35
- Regio + contract fit: 20
- Capaciteit + wachttijd fit: 20
- Complexiteit + veiligheid fit: 15
- Performance fit: 10

Applied adjustments:

- Primary coverage bonus
- Exact municipality contract bonus
- Secondary-only penalty
- Stale capacity data penalty
- Wait-time-above-threshold penalty

## Explainability Output

Every candidate returns:

- `totaalscore`
- component scores
- `confidence_label`
- `fit_samenvatting`
- `trade_offs`
- `verificatie_advies`
- `uitgesloten`
- `uitsluitreden`
- `ranking`

## API Integration

Endpoint:

- `GET /care/api/cases/<case_id>/matching-candidates/`

Returns deterministic and explainable match results sourced from canonical internal tables.

## Signal Hooks

Matching dashboard now emits or updates operational signals for:

- no viable provider in region
- weak-only match outcomes
- urgent case over wait norm
- repeated regional shortage patterns

These signals feed operational monitoring and rematch prioritization.
