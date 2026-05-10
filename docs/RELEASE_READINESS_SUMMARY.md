# Release- en pilotgereedheid — kort overzicht

**Peildatum (repo):** 4 mei 2026  
**Doel:** interne handover — wat is klaar voor **pilot-testen met eindgebruikers**, wat is geautomatiseerd gecontroleerd, en wat blijft risico.

---

## Wat is klaar (functioneel / UX)

- **Care UI-basis:** gedeelde patronen voor laden, fout, leeg en primaire acties (**CareDesignPrimitives**).
- **Shell na inloggen:** de app volgt het account uit **`/care/api/me/`** (rol synchroniseert met sessie na login; geen zwakkere autorisatie).
- **Pilot-omgeving reproduceerbaar:** script `prepare_pilot_e2e.sh`, preflight `scripts/e2e_rehearsal_preflight.py`, georkestreerde golden-path run — zie **[E2E_RUNBOOK.md](E2E_RUNBOOK.md)**.
- **Kleine UX-polish:** o.a. geen dode knoppen meer op afgerond-overzicht in demo-casuscentrum; zorgaanbieder-“profiel”-knop zonder Engelse “coming soon”; duidelijkere Nederlandse tekst voor geblokkeerde plaatsing zonder aanbiederacceptatie.
- **Tester-documentatie:** [PILOT_TEST_SCRIPT.md](PILOT_TEST_SCRIPT.md), [PILOT_OBSERVER_CHECKLIST.md](PILOT_OBSERVER_CHECKLIST.md), [PILOT_KNOWN_LIMITATIONS.md](PILOT_KNOWN_LIMITATIONS.md).

---

## Wat is geautomatiseerd getest (laatste bekende groene run)

### Pilot GO — Case Timeline v1 boundary (release evidence)

**Pilot kan niet als GO worden gemarkeerd** zolang de keten **gemeente validatie → aanbieder beoordeling** niet door de rehearsal-timeline-check gaat.

Zie **[PILOT_PROOF_PACKAGE.md](PILOT_PROOF_PACKAGE.md)** voor artefacten, interpretatie GO/NO-GO en troubleshooting tijdens infrastructure maturity.

- Verzamel JSON-artefacten onder `reports/` (standalone `rehearsal_timeline_evidence.json` en/of `timeline_boundary_evidence` in `rehearsal_report.json`).
- Bundel + GO/NO-GO-gate: `python manage.py release_evidence_bundle` (schrijft `reports/release_evidence_bundle.json`; bij NO-GO exit code ≠ 0, tenzij `--report-only`).
- Productierelease-script **`./scripts/production_readiness_gates.sh`** bevat **Gate 8** hierop; overslaan alleen met `SKIP_TIMELINE_RELEASE_GATE=1` (expliciet — niet voor standaard pilot-sign-off).

### Unit / component (Vitest — care)

```bash
cd client && npx vitest run src/components/care/
```

**Laatste bekende uitkomst:** 16 testbestanden, **77** tests geslaagd (lokale run ~2,6–2,9 s).

### Golden path (Playwright — rehearsal stack)

```bash
# Vanaf repository root; vrije poort als 8010 al in gebruik is:
E2E_PORT=8011 E2E_BASE_URL=http://127.0.0.1:8011 ./scripts/run_golden_path_e2e.sh --skip-build --start-server
```

**Laatste bekende uitkomst:** Python-preflight **HTTP OK** voor gemeente + `demo_provider_kompas`; Playwright-spec **`zorg-os-golden-path.spec.ts`** — **1 passed** (~7–8 s alleen Playwright-stap).

> **Let op:** exacte seconden en poort kunnen verschillen per machine. `--skip-build` veronderstelt een actuele build in `theme/static/spa/`.

---

## Wat is **niet** volledig afgedekt door deze runs

- Volledige **document-upload**-keten voor alle rollen (zie [PILOT_KNOWN_LIMITATIONS.md](PILOT_KNOWN_LIMITATIONS.md)).
- Alle **schermen** en **randgevallen** buiten de golden path (andere menu’s, rapportages, instellingen, …).
- **Productie**-configuratie (andere database, SSO, static files onder `DEBUG=False`) — apart valideren vóór livegang.

---

## Resterende risico’s (kort)

| Risico | Mitigatie |
|--------|-----------|
| Verkeerde server/DB tijdens pilot-rehearsal | Eén duidelijke URL + `DJANGO_SETTINGS_MODULE=config.settings_rehearsal`; preflight draaien (zie runbook). |
| Tester ziet verkeerde rol door **contextwissel** in demo-modus | Vaste accounts; beperkingen documenteren ([PILOT_KNOWN_LIMITATIONS.md](PILOT_KNOWN_LIMITATIONS.md)). |
| Verwachting “volledig zaaksysteem” | Afstemmen met [PILOT_KNOWN_LIMITATIONS.md](PILOT_KNOWN_LIMITATIONS.md) en testscript. |

---

## Geen regressie in deze documentatieronde

- Er zijn **geen** productcode-wijzigingen in deze commit alleen-voor-documenten; autorisatie, tenant-isolatie, zichtbaarheid zorgaanbieder en workflowregels zijn in eerdere stappen **niet verzwakt** (zie eerdere release-readiness- en E2E-werkzaamheden).

---

## Volgende stap voor pilot

1. Begeleider: omgeving klaarzetten volgens **[E2E_RUNBOOK.md](E2E_RUNBOOK.md)**.  
2. Tester: **[PILOT_TEST_SCRIPT.md](PILOT_TEST_SCRIPT.md)**.  
3. Observant: **[PILOT_OBSERVER_CHECKLIST.md](PILOT_OBSERVER_CHECKLIST.md)**.
