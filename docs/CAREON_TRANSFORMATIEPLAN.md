# Careon Transformatieplan (zorgregie-native)

Status datum: 2026-04-10
Doel: volledige transformatie van legacy contract/legal-semantiek naar een coherent zorgregieplatform.

## 1) Legacy Analyse + Oud -> Nieuw Mapping

### Prioriteit A: direct gebruikerszichtbaar

- contract/contracts -> casus/casussen
- client/clients -> zorgaanbieder/zorgaanbieders
- matter/matters -> configuratie/regie-instelling (alleen waar functioneel nodig)
- due diligence -> intake
- legal tasks -> taken
- workflow (contractcontext) -> matchingflow/processtappen
- risk log -> signalen
- repository (legal context) -> dossierarchief
- approval request -> indicatiebesluit
- signature request -> aanbiedersreactie/bevestiging

### Prioriteit B: semantisch fout voor zorgdomein

- trademark request -> plaatsingsaanvraag/indicatie
- conflict checks -> intake-/beoordelingscontrole
- filing / court / statute of limitations -> verwijderen of omzetten naar zorgcontext
- trust account / IOLTA -> wachttijd/capaciteit/budget sturing
- legal hold / ethical wall -> alleen historische migratiecontext, geen runtime-UI

### Prioriteit C: intern technisch (alias-first)

- app namespace contracts blijft tijdelijk technisch bestaan
- backend symbolen Contract/Matter/LegalTask/RiskLog migreren gefaseerd naar Case/Configuration/Task/Signal
- legacy routes blijven tijdelijk als compatibiliteitsalias, nooit als primaire UI route

## 2) Definitief Productmodel (flow-gedreven)

Leidende flow:

CASUS -> INTAKE -> BEOORDELING -> MATCHING -> INDICATIE -> PLAATSING -> OPVOLGING

Kernmodules:

1. Dashboard
2. Casussen
3. Taken
4. Matching
5. Zorgaanbieders
6. Gemeenten / Regio's
7. Capaciteit & budget
8. Wachttijden
9. Rapportages & regie
10. Documenten
11. Privacy & gegevensbeheer
12. Instellingen

## 3) Werkpakketten

### Pakket 1: UI Exorcism (lopend)

- Sidebar definitief naar WERK / NETWERK / STURING / ONDERSTEUNING
- Dashboard CTA's en labels 100% zorgflow
- Login/register/landing copy zonder legal/compliance-jargon

### Pakket 2: Casusdetail als hart

- Casusdetail secties: Intake, Aanbieder Beoordeling, Matching, Indicatie, Plaatsing, Taken, Signalen, Documenten, Privacy/Audit
- Actieknoppen in flowvolgorde
- Intake/beoordeling loskoppelen als concurrerend startpunt

### Pakket 3: Route & URL consolidatie

- Nieuwe primaire route-namen: task_*, matching_*, signal_*
- Legacy route-namen behouden als alias
- Alle interne template-links op primaire namen zetten

### Pakket 4: Model/semantiek migratie

- Care-native klassen introduceren naast aliasen
- Valideren op relaties, filters, nullable/defaults, delete-gedrag
- Legacy veldnamen verwijderen uit forms en validatieboodschappen

### Pakket 5: QA & productie-hardening

- E2E kernflow: nieuwe casus -> intake -> beoordeling -> matching -> indicatie -> plaatsing -> opvolging
- Geen 404/500 op kernroutes
- Geen zichtbare legacy termen in primaire flows
- Tests en regressiesuite updaten op nieuwe primaire termen

## 4) Huidige delta uitgevoerd op 2026-04-10

- Sidebarstructuur omgezet naar flow-gedreven productnavigatie.
- Nieuwe primaire route-aliassen toegevoegd voor taken, matching en signalen.
- Dashboardlinks en labels herschreven naar zorgregie-semantiek.
- Verborgen legacy KPI-blok met approvals/signatures uit dashboard verwijderd.
- Landing/login/register copy opgeschoond van resterende legal/IOLTA termen.

## 5) Resterende technische schuld (na deze batch)

- Interne modelnamen Contract/Matter/LegalTask/RiskLog bestaan nog breed in Python code.
- Diverse templates onder contracts/ bevatten nog mixed contextvariabelen met fallback op legacy keys.
- Admin, forms en model help_text bevatten nog semantische resttermen die niet zorg-native zijn.
- Modules rond trademark/approval/signature/conflict zijn nog als alias aanwezig en moeten functioneel worden hernoemd.

## 6) Operationele opvolgacties (release)

- CI regressiepreventie: terminology guard actief in workflows met `python scripts/terminology_guard.py`.
- Redirect sunset: verwijder de `/contracts/` -> `/care/` redirects na 60-90 dagen, zodra bookmarks/externe links zijn gemigreerd.
- Niet-lokale migraties: voer op staging en productie uit:

```bash
python manage.py migrate --noinput
python manage.py showmigrations contracts
```

- Voer de migraties eerst op staging uit, valideer kernflows, en plan daarna productie in een change window.
