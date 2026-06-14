# Region Model Proposal V1

## Doelmodel

- `MunicipalityConfiguration` is het primaire object voor officiële gemeenten.
- `RegionalConfiguration` met `region_type = JEUGDREGIO` representeert de echte jeugdhulpregio.
- `RegionType.GEMEENTELIJK` blijft bestaan voor backwards compatibility, maar alleen voor een werkelijk apart operationeel gemeentelijk gebied of expliciet samenwerkingsgebied.
- De 342 1:1 spiegelrecords zijn technische duplicaten en blijven voorlopig bestaan tot verwijdering veilig kan worden gemigreerd.
- `GGD`, `ROAZ` en `ZORGKANTOOR` blijven geldige regiotypes, maar worden niet gebruikt als standaard intake-keuze.

## Veld- en relatiekeuzes

- Gemeente:
  - bron: `MunicipalityConfiguration`
  - zichtbaar in intake/casus als primaire keuze
- Jeugdhulpregio:
  - bron: `RegionalConfiguration(region_type=JEUGDREGIO)`
  - gekoppeld aan gemeenten via `served_municipalities`
  - zichtbaar als apart veld naast gemeente
- Samenwerkingsgebied / overige regiotypes:
  - alleen zichtbaar wanneer functioneel relevant
  - niet opgenomen in de standaard gemeentelijke intake-selectie

## Huidige afhankelijkheden

- Backend:
  - `contracts/models.py`
  - `contracts/forms.py`
  - `contracts/api/views.py`
  - `contracts/management/commands/seed_demo_data.py`
  - `contracts/management/commands/seed_jeugdregio_backbone.py`
  - `contracts/management/commands/sync_nl_reference_geo.py`
  - `contracts/management/commands/reset_pilot_environment.py`
  - `contracts/management/commands/check_intake_region_coverage.py`
- Frontend:
  - `client/src/components/care/NieuweCasusPage.tsx`
  - `client/src/components/care/NieuweCasusPage.test.tsx`
  - `client/tests/e2e/helpers/goldenPathPilotApi.ts`
  - `client/tests/e2e/pilot-demo.spec.ts`
- Tests / coverage:
  - intake form payloads
  - demo seed fixtures
  - pilot rehearsal / E2E helpers

## Veilig migratieplan

1. Documenteer de bestaande regio- en gemeentemodellen.
2. Voeg expliciete JEUGDREGIO-ondersteuning toe aan form/API/UI.
3. Stop nieuwe 1:1 spiegelregio’s in seed-, sync- en resetpaths.
4. Seed echte jeugdregio’s betrouwbaar en koppel gemeenten daaraan.
5. Laat legacy `GEMEENTELIJK`-spiegelrecords bestaan totdat alle verwijzingen zijn gemapt.
6. Migreer functionele verwijzingen eerst naar gemeente + jeugdhulpregio.
7. Verwijder duplicaten pas na bewijs uit tests en referentiedata.

## Risico’s

- Bestaande cases kunnen nog naar spiegelregio’s verwijzen.
- Demo- en pilotdata kunnen afhankelijk zijn van legacy `GEMEENTELIJK`-records.
- UI- en API-contracten kunnen tijdelijk beide velden moeten ondersteunen.
- Rehearsal / seed commands kunnen lege dropdowns geven als JEUGDREGIO-data ontbreekt.

## Rollbackstrategie

- Laat huidige datamodellen en technische sleutelvelden intact.
- Houd legacy veldnamen en payload-keys tijdelijk beschikbaar.
- Gebruik feature- en seed-level rollback door de nieuwe selectievelden te verbergen en oude seedinglogica tijdelijk te behouden indien nodig.
- Verwijder pas duplicaten nadat referenties en tests veilig zijn omgezet.
