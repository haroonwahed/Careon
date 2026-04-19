from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from contracts.models import MunicipalityConfiguration, Organization, RegionType, RegionalConfiguration


BASE_DIR = Path(__file__).resolve().parent.parent / 'seed_data'
DEFAULT_REGIOS_CSV = BASE_DIR / 'regios_jeugdregio.csv'
DEFAULT_GEMEENTEN_CSV = BASE_DIR / 'gemeenten_jeugdregio_full.csv'
DEFAULT_GEMEENTEN_MVP_CSV = BASE_DIR / 'gemeenten_jeugdregio_mvp.csv'

PDOK_MUNICIPALITIES_URL = (
    'https://service.pdok.nl/kadaster/bestuurlijkegebieden/wfs/v1_0'
    '?service=WFS&version=2.0.0&request=GetFeature'
    '&typeName=Gemeentegebied&outputFormat=application/json&srsName=EPSG:4326'
)

# Deterministic national default map for full coverage.
PROVINCE_DEFAULT_JEUGDREGIO = {
    'Noord-Holland': 'Noord-Holland Noord',
    'Zuid-Holland': 'Rotterdam Rijnmond',
    'Utrecht': 'Utrecht West',
    'Noord-Brabant': 'Hart van Brabant',
    'Gelderland': 'Gelderland Midden',
    'Overijssel': 'IJsselland',
    'Flevoland': 'Flevoland',
    'Drenthe': 'Drenthe',
    'Friesland': 'Friesland',
    'Groningen': 'Groningen',
    'Limburg': 'Midden-Limburg',
    'Zeeland': 'Zeeland',
}

# Municipality-specific curated overrides for better primary jeugdregio fit.
MUNICIPALITY_JEUGDREGIO_OVERRIDES = {
    'Utrecht': 'Utrecht Stad',
    'Nieuwegein': 'Lekstroom',
    'Houten': 'Lekstroom',
    'IJsselstein': 'Lekstroom',
    'Lopik': 'Lekstroom',
    'Vijfheerenlanden': 'Lekstroom',
    'Amersfoort': 'Eemland',
    'Baarn': 'Eemland',
    'Bunschoten': 'Eemland',
    'Eemnes': 'Eemland',
    'Leusden': 'Eemland',
    'Soest': 'Eemland',
    'Woudenberg': 'Eemland',
    'Amsterdam': 'Amsterdam-Amstelland',
    'Amstelveen': 'Amsterdam-Amstelland',
    'Aalsmeer': 'Amsterdam-Amstelland',
    'Diemen': 'Amsterdam-Amstelland',
    'Ouder-Amstel': 'Amsterdam-Amstelland',
    'Uithoorn': 'Amsterdam-Amstelland',
    'Zaanstad': 'Zaanstreek-Waterland',
    'Wormerland': 'Zaanstreek-Waterland',
    'Waterland': 'Zaanstreek-Waterland',
    'Edam-Volendam': 'Zaanstreek-Waterland',
    'Landsmeer': 'Zaanstreek-Waterland',
    'Purmerend': 'Zaanstreek-Waterland',
    'Haarlemmermeer': 'Haarlemmermeer',
    'Beverwijk': 'IJmond',
    'Heemskerk': 'IJmond',
    'Velsen': 'IJmond',
    'Rotterdam': 'Rotterdam Rijnmond',
    'Capelle aan den IJssel': 'Rotterdam Rijnmond',
    'Krimpen aan den IJssel': 'Rotterdam Rijnmond',
    'Lansingerland': 'Rotterdam Rijnmond',
    'Maassluis': 'Rotterdam Rijnmond',
    'Ridderkerk': 'Rotterdam Rijnmond',
    'Schiedam': 'Rotterdam Rijnmond',
    'Vlaardingen': 'Rotterdam Rijnmond',
    'Den Haag': 'Haaglanden',
    'Delft': 'Haaglanden',
    'Leidschendam-Voorburg': 'Haaglanden',
    'Midden-Delfland': 'Haaglanden',
    'Pijnacker-Nootdorp': 'Haaglanden',
    'Rijswijk': 'Haaglanden',
    'Wassenaar': 'Haaglanden',
    'Westland': 'Haaglanden',
    'Zoetermeer': 'Haaglanden',
    'Leiden': 'Holland Rijnland',
    'Alphen aan den Rijn': 'Holland Rijnland',
    'Leiderdorp': 'Holland Rijnland',
    'Lisse': 'Holland Rijnland',
    'Noordwijk': 'Holland Rijnland',
    'Oegstgeest': 'Holland Rijnland',
    'Teylingen': 'Holland Rijnland',
    'Voorschoten': 'Holland Rijnland',
    'Zoeterwoude': 'Holland Rijnland',
    'Gouda': 'Midden-Holland',
    'Bodegraven-Reeuwijk': 'Midden-Holland',
    'Krimpenerwaard': 'Midden-Holland',
    'Waddinxveen': 'Midden-Holland',
    'Zuidplas': 'Midden-Holland',
    'Dordrecht': 'Zuid-Holland Zuid',
    'Gorinchem': 'Zuid-Holland Zuid',
    'Hardinxveld-Giessendam': 'Zuid-Holland Zuid',
    'Hendrik-Ido-Ambacht': 'Zuid-Holland Zuid',
    'Molenlanden': 'Zuid-Holland Zuid',
    'Papendrecht': 'Zuid-Holland Zuid',
    'Sliedrecht': 'Zuid-Holland Zuid',
    'Zwijndrecht': 'Zuid-Holland Zuid',
    'Tilburg': 'Hart van Brabant',
    'Eindhoven': 'Zuidoost Brabant',
    'Breda': 'West-Brabant West',
    'Arnhem': 'Gelderland Midden',
    'Nijmegen': 'Gelderland Zuid',
    'Apeldoorn': 'FoodValley',
    'Ede': 'FoodValley',
    'Barneveld': 'FoodValley',
    'Groningen': 'Groningen',
    'Maastricht': 'Zuid-Limburg',
    'Sittard-Geleen': 'Zuid-Limburg',
    'Heerlen': 'Zuid-Limburg',
    'Venlo': 'Noord-Limburg',
    'Roermond': 'Midden-Limburg',
}


@dataclass
class RegioRow:
    naam: str
    type_regio: str
    provincie: str
    actief: bool


@dataclass
class GemeenteRow:
    naam: str
    provincie: str
    regio: str


@dataclass
class MunicipalityRef:
    naam: str
    provincie: str


def _parse_bool(raw: str) -> bool:
    return str(raw).strip().lower() in {'1', 'true', 'yes', 'ja'}


def _load_regios(path: Path) -> list[RegioRow]:
    if not path.exists():
        raise CommandError(f'Regio CSV niet gevonden: {path}')

    rows: list[RegioRow] = []
    with path.open('r', encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=2):
            naam = (row.get('naam') or '').strip()
            type_regio = (row.get('type_regio') or '').strip().lower()
            provincie = (row.get('provincie') or '').strip()
            actief = _parse_bool(row.get('actief', 'true'))

            if not naam:
                raise CommandError(f'Lege regio naam op regel {index} in {path}')
            if type_regio and type_regio != 'jeugdregio':
                raise CommandError(f"Onverwacht type_regio '{type_regio}' op regel {index}; verwacht jeugdregio")

            rows.append(RegioRow(naam=naam, type_regio='jeugdregio', provincie=provincie, actief=actief))

    return rows


def _load_gemeenten(path: Path) -> list[GemeenteRow]:
    if not path.exists():
        raise CommandError(f'Gemeente CSV niet gevonden: {path}')

    rows: list[GemeenteRow] = []
    with path.open('r', encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        for index, row in enumerate(reader, start=2):
            naam = (row.get('naam') or '').strip()
            provincie = (row.get('provincie') or '').strip()
            regio = (row.get('regio') or '').strip()

            if not naam or not regio:
                raise CommandError(f'Gemeente mapping incompleet op regel {index} in {path}')

            rows.append(GemeenteRow(naam=naam, provincie=provincie, regio=regio))

    return rows


def _fetch_text(url: str) -> str:
    try:
        with urlopen(url, timeout=45) as response:  # nosec B310 - trusted overheid endpoint
            return response.read().decode('utf-8', errors='replace')
    except (HTTPError, URLError) as exc:
        raise CommandError(f'Kon bron niet ophalen ({url}): {exc}') from exc


def _load_pdok_municipalities(url: str) -> list[MunicipalityRef]:
    payload = _fetch_text(url)
    data = json.loads(payload)
    rows: list[MunicipalityRef] = []
    for feature in data.get('features', []):
        props = feature.get('properties', {})
        naam = (props.get('naam') or '').strip()
        provincie = (props.get('ligtInProvincieNaam') or '').strip()
        if not naam or not provincie:
            continue
        rows.append(MunicipalityRef(naam=naam, provincie=provincie))
    rows.sort(key=lambda item: item.naam)
    return rows


def _resolve_jeugdregio(naam: str, provincie: str) -> str:
    override = MUNICIPALITY_JEUGDREGIO_OVERRIDES.get(naam)
    if override:
        return override

    fallback = PROVINCE_DEFAULT_JEUGDREGIO.get(provincie)
    if fallback:
        return fallback

    return 'Utrecht West'


def _build_full_mapping_from_pdok(url: str) -> list[GemeenteRow]:
    refs = _load_pdok_municipalities(url)
    rows = [
        GemeenteRow(
            naam=ref.naam,
            provincie=ref.provincie,
            regio=_resolve_jeugdregio(ref.naam, ref.provincie),
        )
        for ref in refs
    ]
    return rows


def _write_gemeenten_csv(path: Path, rows: list[GemeenteRow]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['naam', 'provincie', 'regio'])
        writer.writeheader()
        for row in rows:
            writer.writerow({'naam': row.naam, 'provincie': row.provincie, 'regio': row.regio})


def _region_code(index: int, name: str) -> str:
    suffix = slugify(name).replace('-', '').upper()[:14]
    return f'JRG-{index:03d}-{suffix}'


def _municipality_code(name: str) -> str:
    suffix = slugify(name).replace('-', '').upper()
    return f'GM-{suffix[:18]}'


class Command(BaseCommand):
    help = 'Seed jeugdregio backbone (regios + gemeente -> primaire jeugdregio mapping) vanuit CSV.'

    def add_arguments(self, parser):
        parser.add_argument('--organization-id', type=int, help='Optioneel: seed alleen voor een specifieke organisatie-id.')
        parser.add_argument('--regios-csv', type=str, default=str(DEFAULT_REGIOS_CSV), help='Pad naar regio CSV.')
        parser.add_argument('--gemeenten-csv', type=str, default=str(DEFAULT_GEMEENTEN_CSV), help='Pad naar gemeente mapping CSV.')
        parser.add_argument('--generate-full-gemeenten-csv', action='store_true', help='Genereer landelijke gemeenten mapping CSV vanuit PDOK.')
        parser.add_argument('--generate-only', action='store_true', help='Stop na CSV generatie (geen database mutaties).')
        parser.add_argument('--full-gemeenten-csv', type=str, default=str(DEFAULT_GEMEENTEN_CSV), help='Doelpad voor gegenereerde landelijke gemeente mapping CSV.')
        parser.add_argument('--pdok-url', type=str, default=PDOK_MUNICIPALITIES_URL, help='PDOK bron URL voor gemeenten.')

    @transaction.atomic
    def handle(self, *args, **options):
        organization_id = options.get('organization_id')
        regios_csv = Path(options.get('regios_csv')).expanduser().resolve()
        gemeenten_csv = Path(options.get('gemeenten_csv')).expanduser().resolve()

        if options.get('generate_full_gemeenten_csv'):
            target_csv = Path(options.get('full_gemeenten_csv')).expanduser().resolve()
            generated_rows = _build_full_mapping_from_pdok(options.get('pdok_url'))
            _write_gemeenten_csv(target_csv, generated_rows)
            self.stdout.write(self.style.SUCCESS(f'Landelijke gemeente mapping CSV gegenereerd: {target_csv} ({len(generated_rows)} rijen)'))
            if not gemeenten_csv.exists() or gemeenten_csv == DEFAULT_GEMEENTEN_MVP_CSV.resolve():
                gemeenten_csv = target_csv

        if options.get('generate_only'):
            self.stdout.write('Generate-only modus: seed overgeslagen (geen database mutaties).')
            return

        if not gemeenten_csv.exists() and DEFAULT_GEMEENTEN_MVP_CSV.exists():
            gemeenten_csv = DEFAULT_GEMEENTEN_MVP_CSV.resolve()

        regio_rows = _load_regios(regios_csv)
        gemeente_rows = _load_gemeenten(gemeenten_csv)

        organizations_qs = Organization.objects.all().order_by('id')
        if organization_id:
            organizations_qs = organizations_qs.filter(id=organization_id)

        organizations = list(organizations_qs)
        if not organizations:
            raise CommandError('Geen organisaties gevonden om jeugdregio backbone te seeden.')

        for organization in organizations:
            self._seed_for_org(organization, regio_rows, gemeente_rows)

        self.stdout.write(self.style.SUCCESS('Jeugdregio backbone seed afgerond.'))
        self.stdout.write(f'- Regios bron: {regios_csv}')
        self.stdout.write(f'- Gemeenten bron: {gemeenten_csv}')

    def _seed_for_org(self, organization: Organization, regios: list[RegioRow], gemeenten: list[GemeenteRow]) -> None:
        created_regions = 0
        updated_regions = 0
        created_municipalities = 0
        updated_municipalities = 0
        linked_municipalities = 0

        regions_by_name: dict[str, RegionalConfiguration] = {}

        for index, row in enumerate(regios, start=1):
            status_value = RegionalConfiguration.Status.ACTIVE if row.actief else RegionalConfiguration.Status.INACTIVE
            region, created = RegionalConfiguration.objects.get_or_create(
                organization=organization,
                region_name=row.naam,
                defaults={
                    'region_code': _region_code(index=index, name=row.naam),
                    'region_type': RegionType.JEUGDREGIO,
                    'province': row.provincie,
                    'status': status_value,
                },
            )

            needs_update = False
            if region.region_type != RegionType.JEUGDREGIO:
                region.region_type = RegionType.JEUGDREGIO
                needs_update = True
            if region.province != row.provincie:
                region.province = row.provincie
                needs_update = True
            if region.status != status_value:
                region.status = status_value
                needs_update = True
            if not region.region_code:
                region.region_code = _region_code(index=index, name=row.naam)
                needs_update = True

            if created:
                created_regions += 1
            elif needs_update:
                region.save(update_fields=['region_type', 'province', 'status', 'region_code', 'updated_at'])
                updated_regions += 1

            regions_by_name[row.naam.lower()] = region

        jeugdregio_scope = RegionalConfiguration.objects.filter(
            organization=organization,
            region_type=RegionType.JEUGDREGIO,
        )

        for row in gemeenten:
            key = row.regio.lower()
            if key not in regions_by_name:
                raise CommandError(
                    f"Gemeente '{row.naam}' verwijst naar onbekende regio '{row.regio}'. Voeg regio eerst toe aan regios CSV."
                )

            target_region = regions_by_name[key]
            municipality, created = MunicipalityConfiguration.objects.get_or_create(
                organization=organization,
                municipality_name=row.naam,
                defaults={
                    'municipality_code': _municipality_code(row.naam),
                    'province': row.provincie,
                    'status': MunicipalityConfiguration.Status.ACTIVE,
                },
            )

            municipality_needs_update = False
            if municipality.province != row.provincie:
                municipality.province = row.provincie
                municipality_needs_update = True
            if municipality.status != MunicipalityConfiguration.Status.ACTIVE:
                municipality.status = MunicipalityConfiguration.Status.ACTIVE
                municipality_needs_update = True
            if not municipality.municipality_code:
                municipality.municipality_code = _municipality_code(row.naam)
                municipality_needs_update = True

            if created:
                created_municipalities += 1
            elif municipality_needs_update:
                municipality.save(update_fields=['province', 'status', 'municipality_code', 'updated_at'])
                updated_municipalities += 1

            # Enforce one primary jeugdregio per gemeente by removing existing jeugdregio links first.
            for region in jeugdregio_scope.filter(served_municipalities=municipality).exclude(id=target_region.id):
                region.served_municipalities.remove(municipality)

            if not target_region.served_municipalities.filter(id=municipality.id).exists():
                target_region.served_municipalities.add(municipality)
                linked_municipalities += 1

        self.stdout.write(
            f"[{organization.id}] {organization.slug}: regio nieuw={created_regions}, regio bijgewerkt={updated_regions}, "
            f"gemeente nieuw={created_municipalities}, gemeente bijgewerkt={updated_municipalities}, links toegevoegd={linked_municipalities}"
        )
