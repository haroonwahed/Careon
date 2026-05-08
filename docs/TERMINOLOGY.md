# CareOn Terminology

This document is the product glossary for visible CareOn language.

## Canonical workflow terms

These terms should be used consistently across the landing page, dashboard pages, and shared workflow helpers:

1. Casus
2. Samenvatting
3. Matching
4. Gemeente validatie
5. Aanbieder beoordeling
6. Plaatsing
7. Intake

## Canonical role terms

- Gemeente
- Zorgaanbieder
- Admin
- Systeem

## Canonical surface names

- Regiekamer
- Casussen
- Matching
- Acties
- Aanbieder beoordeling
- Plaatsingen
- Zorgaanbieders
- Gemeenten
- Regio's
- Documenten
- Audittrail
- Instellingen

## Source of truth

- Shared labels in code: `client/src/lib/terminology.ts`
- Terminology guard for legacy words: `scripts/terminology_guard.py`

## Usage rule

- Use these terms verbatim in UI copy and page titles when the same concept appears across multiple pages.
- Prefer the shared terminology module over duplicated hardcoded strings in workflow helpers.
