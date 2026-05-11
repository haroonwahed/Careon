# Officiële arrangement- / productcodebronnen (NL)

CareOn gebruikt deze bronnen **alleen** voor read-only arrangement hints (`GET .../arrangement-alignment/`). Geen automatische financiële of contractuele waarheid.

## Volgorde in de API (deterministisch)

1. **Jeugdwet — JZ21** (Standaardproductcodelijst)  
2. **NZa — Zorgproducten-tabel** (DBC, 9-cijferige `Zorgproductcode`)  
3. **iWlz — geselecteerde codelijsten** (GitHub-mirror iStandaarden; o.a. zorgkantoor 55xx, ZZP 3 cijfers, korte lijsten alleen bij exacte invoer)  
4. **Heuristische catalogus** (`contracts/arrangement_alignment_catalog.py`)  
5. **Generieke fallback** (menselijk oordeel vereist)

## Jeugdwet — Standaardproductcodelijst (JZ21)

- **Portaal:** [Productcodelijst Jeugdwet | iStandaarden](https://www.istandaarden.nl/ijw/over-ijw/productcodelijst-jeugdwet)  
- **Xlsx (feb 2025):** [standaardproductcodelijst-jeugdwet-.xlsx](https://www.istandaarden.nl/binaries/content/assets/istandaarden/ijw/productcodelijst-jw/standaardproductcodelijst-jeugdwet-.xlsx)  
- **Repo-export:** `contracts/data/jeugdwet_jz21_productcodes.json` (`scripts/build_jeugdwet_jz21_productcodes_json.py`)  
- **Let op:** gemeenten mogen **eigen** productcodes gebruiken binnen de verplichte productcategorieën; codes zijn niet landelijk uniek buiten de standaardlijst (zie toelichting op iStandaarden).

## NZa — Zorgproducten (medisch-specialistische zorg / DBC)

- **Portaal / context:** [Dbc-pakket 2025 integraal | PUC Overheid](https://puc.overheid.nl/nza/doc/PUC_781989_22/2/)  
- **Brondownload (zip met CSV):** Zorgproducten Tabel v20241001 — `PUC_774469_22` (zie script voor vaste URL).  
- **Repo-export:** `contracts/data/nza_zorgproducten_actueel.json` (`scripts/build_nza_zorgproducten_json.py`) — actuele rijen zonder einddatum vóór filterdatum; dedupe op `Zorgproductcode`.  
- **Raadpleging:** [zorgproducten.nza.nl](https://zorgproducten.nza.nl/) voor actuele geldigheid en tariefcontext.

## iWlz / Wlz — codelijsten (berichtenstandaard)

- **Bron:** [iStandaarden/iWlz-codelijsten-APiWlz](https://github.com/iStandaarden/iWlz-codelijsten-APiWlz) (JSON onder `codelijsten/`).  
- **Repo-export:** `contracts/data/iwlz_official_codelijsten.json` (`scripts/build_iwlz_official_codelijsten_json.py`).  
- **Let op:** in die repository staat een waarschuwing dat het een **ontwikkelcontext** kan zijn; de codewaarden zijn wel de gepubliceerde iWlz-codelijsten. Gebruik in CareOn uitsluitend als **hint**; normatieve ketenkeuzes blijven bij iStandaarden / CAK / zorgkantoor.  
- **Aanvulling:** overige iWlz-tabellen en API’s: [Tabellen en codelijsten | iStandaarden](https://www.istandaarden.nl/iwlz/over-iwlz/tabellen-en-codelijsten).

## Alles herbouwen

```bash
python3 scripts/build_official_arrangement_sources.py
```

Of alleen één bron:

```bash
python3 scripts/build_official_arrangement_sources.py --only nza
```

Controleer daarna diff op `contracts/data/*.json` en draai de volledige testsuite (`uv run pytest`).
