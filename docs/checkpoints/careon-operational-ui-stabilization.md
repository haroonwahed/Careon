# CareOn Operational UI Stabilization Checkpoint

Date: 2026-06-11

## Stabilized Canonical Workflow

Aanmelding → Matching → Aanbiederreactie → Plaatsing → Intake

## Finalized Operational Pages

- Regiekamer
- Aanmeldingen
- Acties
- Matching
- Aanbiederreactie / Reacties
- Plaatsingen
- Intake

## What Was Corrected

- Removed old visible primary phases: `Samenvatting`, `Gemeente Validatie`, `Beoordeling`, and `Aanbieder Beoordeling`.
- Established `Aanbiederreactie` as the provider-response phase.
- Kept `Reacties` as the short sidebar/nav label where useful.
- Kept `/beoordelingen` as the compatibility route.
- Aligned sidebar badges, attention cards, filters, and visible row counts.
- Replaced visible `Gemeentevalidatie` copy on Regiekamer.
- Replaced `Onbekend` activity fallback with `Geen recente activiteit`.
- Replaced `Onbekend` region fallback with `Regio ontbreekt`.
- Tightened Matching advisory chips to compact operational labels:
  - `Afstemming`
  - `Capaciteit`
  - `Onderbouwing`
  - `Voorlopig`
  - `Passend`
- Confirmed Intake is an active routed post-placement workspace.
- Renamed `AanbiederBeoordelingPage` to `AanbiederreactiePage`.
- Wrapped the Plaatsingen work surface in `CareWorkspaceSection` to satisfy the operational design laws.

## Current Validation Status

- `npm run check:careon-design`: passed
- `npm run build`: passed
- `operationalDesignLawsGuard`: passed
- Targeted tests for Regiekamer, Aanmeldingen, Acties, Matching, Aanbiederreactie, Plaatsingen, and Intake: passed
- Screenshot QA pass completed for the finalized operational pages

## Known Intentional Compatibility / Legacy Items

- `/beoordelingen` remains as a compatibility route for `Reacties` / `Aanbiederreactie`.
- `Reacties` remains acceptable as a short nav label.
- `ProviderEvaluation` and other backend contract names may remain where they are tied to API/data contracts.
- Legacy aliases may remain in adapters/helpers if they are not exposed as primary visible UI language.
- `Regio ontbreekt` may appear when the payload lacks a safe region value.

## Guardrails Going Forward

- Do not reintroduce `Samenvatting`, `Gemeente Validatie`, `Beoordeling`, or `Aanbieder Beoordeling` as visible primary phases.
- Every operational page must have one dominant next-best-action per work surface.
- Sidebar/page counts must derive from the same visible-row source or explicitly explain the difference.
- Empty states must only appear when no visible rows exist.
- No new hardcoded colors, one-off badge systems, duplicate button systems, or decorative helper cards.
- Use `CarePageScaffold`, `PageHeroHeader`, `CareAlertCard`, `CareWorkspaceSection`, `CareWorkRow`, and `CareStatusBadge` patterns.

## Recommended Next Work

- Full screenshot review for detail pages.
- Data quality improvement for missing region fields.
- Backend/API alignment for provider response naming if needed.
- Route cleanup only if the compatibility strategy is approved.
- Demo script and pilot scenario preparation.
