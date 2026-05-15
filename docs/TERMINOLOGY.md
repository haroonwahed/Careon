# CareOn Terminology

This document is the product glossary for visible CareOn language (**aligned to Operational Constitution v2** — see `docs/Careon_Operational_Constitution_v2.md`).

## Canonical workflow terms (product)

Use consistently across SPA, templates, and operator-facing docs:

1. **Aanmelding** — start of a throughflow request (anonymous / operational).  
2. **Anonimisatie** — privacy stage (deterministic today; expanded services only with governance).  
3. **Zorgvraag** — structured need / summary readiness (replaces loose “casus dossier” wording where possible).  
4. **Matching** — advisory zorgcapaciteit routing.  
5. **Aanbieder reacties** — provider responses (accept / reject / info).  
6. **Voorkeursmatch** — preferred routing / selection step before final gemeente checks where applicable.  
7. **Gemeentelijke validatie** — financing & arrangement compatibility gate.  
8. **Plaatsing** — confirmed placement step.  
9. **Uitstroom** — trajectory exits the platform; external systems of record take over.

## Canonical role terms

- **Aanmelder** (primary operational protagonist in UX; may map to `WorkflowRole.GEMEENTE` accounts until finer profiles exist)  
- **Gemeente** (financing / arrangement validation — not provider decision proxy)  
- **Zorgaanbieder**  
- **Admin**  
- **Platform** (orchestration + advisory AI — never final decision owner)

## Canonical surface names

- **Coördinatie** (route `/regiekamer`; operational workspace)  
- **Aanvragen** (worklist; routes under `/casussen` etc.)  
- **Matching**  
- **Acties**  
- **Reacties** (provider-facing queue; path `/beoordelingen`)  
- **Plaatsingen**  
- **Zorgaanbieders**  
- **Gemeenten**  
- **Regio's**  
- **Documenten**  
- **Audittrail**

## Implementation note

API identifiers such as `phase: "gemeente_validatie"` may remain stable while UI shows **gemeentelijke validatie**. Document mapping: `docs/FOUNDATION_LOCK.md`.
