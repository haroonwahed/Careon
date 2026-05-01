# Zorg OS Final User Test Run Sheet

## Doel
Laatste handmatige validatie van de demo-omgeving voor Zorg OS. Deze run sheet controleert de finale demo-flow, de gemeente-only demo-account, de SPA-shell, veilige foutafhandeling en de canonical workflow.

## Testaccount
- E-mail: `test@gemeente-demo.nl`
- Wachtwoord: `DemoTest123!`
- Rol: `Gemeente medewerker`
- Verwacht: alleen gemeente-level acties, geen provider- of adminrechten

## Voorwaarden
- App draait lokaal op `http://127.0.0.1:8010`
- Demo-data is geladen
- Licht thema is actief
- Browser-cache is indien nodig ververst

## Test Run

| Stap | Route / Actie | Verwacht resultaat | Resultaat |
|---|---|---|---|
| 1 | Open `/dashboard/` | SPA-shell laadt zonder asset 404s; layout blijft consistent; geen legacy Careon/Zorgregie UI zichtbaar | ☐ Pass / ☐ Fail |
| 2 | Log in als `test@gemeente-demo.nl` | Alleen gemeente-acties zichtbaar; geen provider- of adminmogelijkheden | ☐ Pass / ☐ Fail |
| 3 | Open `/care/casussen/new/` | Nieuwe casus is licht en begeleid; primaire CTA is `Opslaan en naar samenvatting`; geen directe sprong naar latere workflowstappen | ☐ Pass / ☐ Fail |
| 4 | Vul Demo Casus A aan | Casus kan richting samenvatting worden gebracht zonder workflowregels te omzeilen | ☐ Pass / ☐ Fail |
| 5 | Open `/care/matching/` | Matching is actie-first; urgente casussen en next-best-action staan bovenaan; matching blijft adviserend | ☐ Pass / ☐ Fail |
| 6 | Open Demo Casus B in matching | Toont passende aanbieders en duidelijke vervolgstap; geen intake zonder plaatsing | ☐ Pass / ☐ Fail |
| 7 | Open `/care/search/?q=test` | Veilige zoekstatus; geen raw JSON of debug output; duidelijke lege/zoekstaat in Nederlands | ☐ Pass / ☐ Fail |
| 8 | Open `/care/does-not-exist/` | Branded Nederlandse 404; geen stack trace, DEBUG-info of route-lijst | ☐ Pass / ☐ Fail |
| 9 | Controleer workflow-CTA's | Geen CTA laat intake vóór plaatsing toe; plaatsing vóór aanbiederacceptatie blijft geblokkeerd; gemeente ziet geen provider-level beoordeling | ☐ Pass / ☐ Fail |
| 10 | Maak screenshots | Finale screenshots zijn opgeslagen in `design-audit/screenshots/final-demo/` | ☐ Pass / ☐ Fail |

## Demo-casus controle

| Casus | Verwachte status | Beoogde demo-les | Resultaat |
|---|---|---|---|
| Demo Casus A | Concept / Nieuwe casus | Tester vult minimale gegevens aan en gaat naar samenvatting | ☐ Pass / ☐ Fail |
| Demo Casus B | Klaar voor matching | Tester kiest of beoordeelt beste aanbieder | ☐ Pass / ☐ Fail |
| Demo Casus C | Wacht op aanbieder | Tester ziet dat gemeente niet namens aanbieder mag beslissen | ☐ Pass / ☐ Fail |
| Demo Casus D | Afgewezen door aanbieder | Tester begrijpt nieuwe matchrichting na afwijzing | ☐ Pass / ☐ Fail |
| Demo Casus E | Geblokkeerd | Tester ziet welke info ontbreekt om verder te gaan | ☐ Pass / ☐ Fail |

## Bewijs
- Screenshots:
  - `design-audit/screenshots/final-demo/01-dashboard.png`
  - `design-audit/screenshots/final-demo/02-new-case.png`
  - `design-audit/screenshots/final-demo/03-matching.png`
  - `design-audit/screenshots/final-demo/04-search.png`
  - `design-audit/screenshots/final-demo/05-404.png`
- Evidence note:
  - `design-audit/FINAL_DEMO_EVIDENCE.md`
- Gate checklist:
  - `design-audit/FINAL_DEMO_GATE.md`

## Afsluitende beoordeling
- Demo-safe verdict: ☐ Yes / ☐ No / ☐ Partially
- Blockers:
  - ☐ Geen
  - ☐ Asset 404
  - ☐ Legacy UI zichtbaar
  - ☐ Workflowregel overschreden
  - ☐ Debug/JSON exposure

