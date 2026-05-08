# Pilot — bekende beperkingen (eerlijk overzicht)

Dit document helpt testers en begeleiders om **geen verkeerde verwachting** te krijgen. Wat hier staat is **bewust** buiten deze pilot geplaatst, onvolledig, of nog niet inhoudelijk doorgelicht.

---

## Wat deze pilot **niet** is

- **Geen volledig zaaksysteem:** archief, officiële rapportage en vaste archiveringsstromen lopen via het **zaaksysteem van de organisatie**, niet via dit werkoverzicht. Na afronding van een casus in de app kan tekst staan die dat toelicht.
- **Geen juridisch of contractueel advies:** de app ondersteunt werkstroom en overzicht, geen juridische besluitvorming.
- **Geen koppeling met externe systemen** in deze pilot, tenzij je organisatie dat expliciet heeft ingericht en gecommuniceerd.

---

## Documenten en uploads

- Het scherm **Documenten** is aanwezig (zoeken, filteren, overzicht).
- Een **volledige** doorlichting van upload-, versie- en rechtenworkflow voor alle rollen is **niet** onderdeel van deze pilot-rondes.  
  → Meld los als documentflow belangrijk is voor jullie vervolg.

---

## Demo- en trainingsmodus (alleen relevant als dit aan staat)

- In sommige omgevingen kan de app **rolwisseling in de kopbalk** tonen (bijvoorbeeld om demo’s te geven).
- Dat kan **verwarring** geven: de tester denkt een andere rol te hebben dan het account werkelijk mag.
- **Advies voor pilot:** gebruik vaste accounts per tester; zet contextwisseling uit of leg vast welke modus geldt.  
  Technische details: zie **[E2E_RUNBOOK.md](E2E_RUNBOOK.md)** (sectie over `allowRoleSwitch` / pilot-UI).

---

## Kaarten en profielen

- In delen van de app kunnen **kaartplekken** of opzet voor kaarten aanwezig zijn zonder volledige productie-integratie (bijv. opmerking “Map Placeholder” in code voor `ProviderMiniMap` en `ProviderProfilePage`).
- **Bekijk profiel** bij aanbieders selecteert de aanbieder en toont details in het paneel; een apart volledig profielscherm kan per omgeving verschillen.

---

## Overige bekende punten (repo-inzicht)

- **Beriechten / MessageComposer:** een knop kan nog een generieke “binnenkort”-melding tonen (niet onderdeel van de care-werkstromen-test).
- **Careon vs CareOn** in koppen: cosmetische merknaamverschillen tussen schermen/templates kunnen voorkomen; geen invloed op rechten of data.
- **Technische waarschuwingen** in serverlogs (bijv. volgorde van lijsten bij paginering) zijn voor ontwikkelaars; geen instructie voor testers om daar naar te kijken.

---

## Wat wél binnen scope van kwaliteit valt

- **Canonieke keten** en duidelijke **fase / status / eigenaar / volgende stap** op kernschermen.
- **Gemeente** ziet monitoring op aanbieder-beoordeling; **zorgaanbieder** ziet alleen relevante casussen (niet zwakker gemaakt in deze pilot-documentatie).
- **Golden-path test** (automatisch, technisch): zie **[RELEASE_READINESS_SUMMARY.md](RELEASE_READINESS_SUMMARY.md)**.

---

## Iets mist in dit document?

Laat het aan het productteam weten; dit bestand wordt aangevuld als er nieuwe beperkingen **bewust** worden vrijgegeven voor piloten.
