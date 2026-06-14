# Region Model Phase 2 Inventory

## Doel

Deze notitie beschrijft de niet-destructieve inventarisatie en veilige backfill-voorbereiding voor legacy `RegionType.GEMEENTELIJK`-records.

## Classificatieregels

- `MIRROR`: exact één gekoppelde gemeente; veilig te mappen naar gemeente + primaire jeugdhulpregio.
- `OPERATIONAL`: meerdere gemeenten; alleen mappen als er een gedeelde jeugdhulpregio aantoonbaar is.
- `AMBIGUOUS`: expliciete uitzonderingsnamen (`Amsterdam Regio`, `Rotterdam Regio`, `Utrecht Regio`); altijd handmatige review.
- `ORPHANED`: geen gekoppelde gemeenten; geen veilige automatische backfill.

## Huidige lokale inventarisatiesnapshot

### Tenant: `gemeente-demo`

- Referentie-/seedlaag legacy regio’s: `343`
- Classificaties:
  - `MIRROR`: `337`
  - `OPERATIONAL`: `0`
  - `AMBIGUOUS`: `3`
  - `ORPHANED`: `3`
- Migratiestatussen:
  - `READY`: `337`
  - `PARTIALLY_MAPPED`: `3`
  - `BLOCKED`: `3`
- Referenties:
  - `CaseIntakeProcess.regio`: `12`
  - `CaseIntakeProcess.preferred_region`: `3`
  - `CaseIntakeProcess.zorgregio`: `12`
  - `CaseIntakeProcess.plaatsingsregio`: `12`
  - `CaseIntakeProcess.contractregio`: `12`
  - `CaseIntakeProcess.escalatie_regio`: `12`
  - `ProviderRegioDekking.regio`: `3`
  - `ProviderProfile.served_regions`: `0`
  - `ProviderProfile.secondary_served_regions`: `0`
- Blockers: `9`

## Provenance

De CareOn-referentiesnapshot bestaat uit vier duidelijk gescheiden lagen:

1. **Externe bron**: de oorspronkelijke gezaghebbende bron van de gemeentelijke basisgegevens.
2. **Geïmporteerde bronkopie**: de checked-in CSV-bestanden `regios_jeugdregio.csv`, `gemeenten_jeugdregio_full.csv` en eventuele MVP-fallbacks.
3. **Genormaliseerde CareOn-referentiesnapshot**: het machineleesbare manifest `contracts/management/seed_data/jeugdregio_reference_manifest.json` met canonieke gemeentenaam-normalisatie, checksum en peildatum.
4. **Tenant-specifieke records**: `Organization`-gebonden configuraties zoals `gemeente-demo`, die apart gevalideerd worden en niet als bron van waarheid voor de landelijke snapshot gelden.

Voor de snapshot geldt als basis:

- publicerende organisatie: Kadaster / PDOK
- dataset: `Bestuurlijke Gebieden - Gemeentegebied`
- consultatiedatum / peildatum snapshot: `2026-06-14`
- originele bronreferentie: PDOK WFS endpoint zoals vastgelegd in het manifest
- genormaliseerde CareOn-checksum: vastgelegd in het manifest

## Verklaring 345 versus 7

- De eerdere inventarisatie van ongeveer `345` `GEMEENTELIJK`-records hoort bij de brede referentie-/seedlaag in de lokale repositorycontext: de checked-in landelijke gemeente-mapping bevat `342` gemeenten plus enkele expliciete uitzonderings-/spiegelrecords die nog als legacy `GEMEENTELIJK` kunnen voorkomen.
- De eerdere inventarisatie van `7` records kwam uit een beperkte tenant-only inventarisatie van de gefixeerde demo-tenant `gemeente-demo` vóór de referentieherseed.
- De huidige inventarisatie van `343` records komt uit de referentie-/seedlaag die de demo-tenant tijdens reseed meeneemt.
- Er is dus geen inhoudelijke tegenstrijdigheid: het zijn verschillende scopes.
  - `345`-achtig: brede database- of referentiesnapshot, nationaal georiënteerd, meerdere tenants of seedlaag inbegrepen.
  - `7`: pilot/demo tenant only, vóór referentiesync.
- De representatieve scope is:
  - pilot: `gemeente-demo`
  - staging/rehearsal: expliciet de gereplayde pilot-tenant of een aparte staging tenant
  - productie: de productie-database, maar alleen na expliciete referentie- en migratievalidatie

## JEUGDREGIO referentiesnapshot

- Bronbestanden:
  - `contracts/management/seed_data/regios_jeugdregio.csv`
  - `contracts/management/seed_data/gemeenten_jeugdregio_full.csv`
- Snapshot peildatum: `2026-06-14`
- Canonieke jeugdregio’s: `41`
- Gemeente-jeugdhulpregiokoppelingen in de reference snapshot: `342`
- Referentievalidatie:
  - `0` gemeenten met meerdere primaire actieve jeugdhulpregio’s
  - `0` gemeenten zonder actieve jeugdhulpregio
  - `7` jeugdhulpregio’s zonder deelnemende gemeenten in deze snapshot

De volledige machineleesbare manifestsnapshot staat in:

- [`contracts/management/seed_data/jeugdregio_reference_manifest.json`](../../contracts/management/seed_data/jeugdregio_reference_manifest.json)

Gebruik de check:

```bash
DJANGO_SETTINGS_MODULE=config.settings_test python manage.py check_jeugdregio_reference_data --json
```

Tenantvalidatie:

```bash
DJANGO_SETTINGS_MODULE=config.settings_test python manage.py check_jeugdregio_tenant_alignment --slug gemeente-demo --json
```

### Ambiguous records

- `178` `Amsterdam Regio` -> gemeente `Amsterdam`
- `176` `Rotterdam Regio` -> gemeente `Rotterdam`
- `175` `Utrecht Regio` -> gemeente `Utrecht`

### Orphaned records

- `179` `Amsterdam (gemeentelijk)`
- `181` `Rotterdam (gemeentelijk)`
- `180` `Utrecht (gemeentelijk)`

### Mirror record

- `177` `Den Haag Regio` -> gemeente `Den Haag`

### Tenant-uitzonderingen tijdens de huidige dry-run

- `4` `'s-Gravenhage` blijft een legacy aliasrecord met code `0518` en wordt als `PARTIALLY_MAPPED` behandeld omdat de actieve JEUGDREGIO wel aansluit, maar de tenant-code afwijkt van de snapshotsleutel.
- `2` `Amsterdam`, `3` `Rotterdam` en `1` `Utrecht` blijven legacy demo-records zonder actieve JEUGDREGIO en blijven daarom `BLOCKED`.

## Backfill command

Gebruik:

```bash
DJANGO_SETTINGS_MODULE=config.settings_test \
  python manage.py backfill_legacy_gemeentelijk_regions --slug gemeente-demo
```

Schrijfpas:

```bash
DJANGO_SETTINGS_MODULE=config.settings_test \
  python manage.py backfill_legacy_gemeentelijk_regions --slug gemeente-demo --apply
```

Gedrag:

- transactioneel
- idempotent
- laat legacy waarden intact
- blokkeert conflicten
- schrijft geen auditlogs opnieuw
- ondersteunt JSON-output via `--json` of `--output`

## Rollback

Omdat de backfill alleen afgeleide gemeente-/jeugdhulpregiovelden vult en legacy velden ongemoeid laat:

1. Zet de command opnieuw in dry-run modus.
2. Controleer de JSON-output op conflicterende mappingregels.
3. Gebruik een database-rollback of restore als een apply-run onbedoelde afgeleide velden heeft gezet.
4. Legacy `GEMEENTELIJK`-records en auditdata blijven behouden.

## Veilige volgende stap

Alleen `MIRROR`-records met een expliciete, niet-ambigue gemeente-koppeling en een beschikbare primaire jeugdhulpregio zijn veilig voor verdere backfill.
