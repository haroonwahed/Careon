"""
Management command: seed_providers

Seeds the database with realistic Dutch provider data for development.

Creates:
  - 25 Zorgaanbieders with realistic Dutch names
  - 40 AanbiederVestigingen spread across NL municipalities
  - 60 Zorgprofielen with diverse care forms, age groups, and specializations
  - CapaciteitRecords per vestiging (realistic but fake data)
  - ContractRelaties per organisation

Data is coherent and relationally valid.

Usage:
    python manage.py seed_providers
    python manage.py seed_providers --organization-slug gemeente-utrecht
    python manage.py seed_providers --clear  # removes existing seed data first
"""

from __future__ import annotations

import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from contracts.models import (
    AanbiederVestiging,
    CapaciteitRecord,
    ContractRelatie,
    Organization,
    ProviderImportBatch,
    Zorgaanbieder,
    Zorgprofiel,
)

# ---------------------------------------------------------------------------
# Seed data definitions
# ---------------------------------------------------------------------------

GEMEENTEN = [
    ("Utrecht", "NL-UT", "Utrecht", "Utrecht"),
    ("Amersfoort", "NL-UT", "Utrecht", "Utrecht"),
    ("Zeist", "NL-UT", "Utrecht", "Utrecht"),
    ("Nieuwegein", "NL-UT", "Utrecht", "Utrecht"),
    ("Amsterdam", "NL-NH-AMS", "Noord-Holland", "Noord-Holland"),
    ("Haarlem", "NL-NH-HRM", "Noord-Holland", "Noord-Holland"),
    ("Rotterdam", "NL-ZH-RTD", "Zuid-Holland", "Zuid-Holland"),
    ("Den Haag", "NL-ZH-DHG", "Zuid-Holland", "Zuid-Holland"),
    ("Leiden", "NL-ZH", "Zuid-Holland", "Zuid-Holland"),
    ("Arnhem", "NL-GD-ARN", "Gelderland", "Gelderland"),
    ("Nijmegen", "NL-GD-NJM", "Gelderland", "Gelderland"),
    ("Zwolle", "NL-OV-ZWO", "Overijssel", "Overijssel"),
    ("Enschede", "NL-OV", "Overijssel", "Overijssel"),
    ("Eindhoven", "NL-NB-EHV", "Noord-Brabant", "Noord-Brabant"),
    ("Tilburg", "NL-NB", "Noord-Brabant", "Noord-Brabant"),
    ("Breda", "NL-NB", "Noord-Brabant", "Noord-Brabant"),
    ("Groningen", "NL-GR", "Groningen", "Groningen"),
    ("Leeuwarden", "NL-FR", "Friesland", "Friesland"),
]

PROVIDERS_DATA = [
    # (naam, handelsnaam, organisatie_type, omschrijving)
    ("Stichting De Nieuwe Brug", "De Nieuwe Brug", "AMBULANT", "Ambulante jeugdhulp voor kinderen 4-18 jaar met gedragsproblematiek"),
    ("Triversum Zorg BV", "Triversum", "RESIDENTIEEL", "Residentiële behandeling GGZ-jongeren met complexe problematiek"),
    ("Entrea Lindenhout", "Entrea", "DAGBEHANDELING", "Dag- en deeltijdbehandeling voor jeugd met neurologische problematiek"),
    ("Stichting Oosterpoort Zorg", "Oosterpoort", "AMBULANT", "Ambulante gezinsbegeleiding en opvoedondersteuning"),
    ("Pluryn", "Pluryn", "RESIDENTIEEL", "Landelijk werkende aanbieder residentiële jeugdhulp en LVB"),
    ("Lister BV", "Lister", "AMBULANT", "Ambulante GGZ- en jeugdhulpdiensten regio Utrecht"),
    ("Spirit Jeugd en Opvoedhulp", "Spirit", "CRISISOPVANG", "Crisisopvang en korte intensieve trajecten voor jongeren"),
    ("Horizon Jeugdzorg", "Horizon", "RESIDENTIEEL", "Gesloten jeugdzorg en intensieve behandeling"),
    ("Jade Zorg", "Jade", "THUISBEGELEIDING", "Thuisbegeleiding en gezinscoaching voor multiprobleem gezinnen"),
    ("Reclassering Nederland - Jeugd", "Reclassering NL", "AMBULANT", "Reclassering en gedragsinterventies jeugd"),
    ("GGZ Oost-Brabant", "GGZ Oost-Brabant", "AMBULANT", "GGZ ambulant en dagbehandeling jeugd en volwassenen"),
    ("De Opvoedpoli", "Opvoedpoli", "AMBULANT", "Ambulante opvoedondersteuning en behandeling jonge kinderen"),
    ("Stichting Kwadrant Jeugdzorg", "Kwadrant", "DAGBEHANDELING", "Dagbehandeling en school-gebaseerde interventies 6-14 jaar"),
    ("William Schrikker Stichting", "William Schrikker", "AMBULANT", "Gespecialiseerde jeugdbescherming en LVB-begeleiding"),
    ("Stichting Altra", "Altra", "RESIDENTIEEL", "Jeugd-GGZ residentieel en dag Amsterdam e.o."),
    ("Intermetzo", "Intermetzo", "RESIDENTIEEL", "Residentieel en semi-residentieel behandeling jeugd"),
    ("Stichting MEE Oost Gelderland", "MEE", "AMBULANT", "Begeleiding mensen met een beperking"),
    ("GGzBreburg", "GGzBreburg", "AMBULANT", "GGZ ambulant Noord-Brabant"),
    ("Stichting Palier", "Palier", "RESIDENTIEEL", "Forensische psychiatrie en intensieve behandeling"),
    ("Stichting Kompaan", "Kompaan", "AMBULANT", "Jeugdhulp en gezinsbehandeling Overijssel"),
    ("De Rading Jeugdzorg", "De Rading", "CRISISOPVANG", "Crisisopvang en kortdurende behandeling Utrecht"),
    ("Cardea Jeugdzorg", "Cardea", "AMBULANT", "Ambulante en residentiële jeugdhulp Leiden e.o."),
    ("Stichting Humanitas DMH", "Humanitas", "THUISBEGELEIDING", "Thuisbegeleiding en vrijwilligerswerk"),
    ("Fier Fryslân", "Fier", "CRISISOPVANG", "Crisisopvang vrouwen en meisjes met traumatische achtergrond"),
    ("Stichting Youz", "Youz", "DAGBEHANDELING", "Specialistische jeugd-GGZ dagbehandeling"),
]

SPECIALISATIES_POOL = [
    "hechtingsstoornis", "trauma", "autisme", "ADHD", "gedragsstoornis",
    "depressie", "angststoornis", "gezinscrisis", "verslavingsproblematiek",
    "LVB", "GGZ comorbiditeit", "eetstoornissen", "suïcidaliteit",
    "seksueel grensoverschrijdend gedrag", "forensische problematiek",
    "multiprobleem gezin", "psychose", "borderline", "ODD/CD",
    "niet-aangeboren hersenletsel",
]

PROBLEMATIEK_TYPES_POOL = [
    "gedragsstoornis", "emotieregulatie", "trauma en PTSS", "autisme spectrum",
    "ADHD", "hechtingsproblemen", "gezins- en opvoedproblematiek",
    "schoolverzuim", "LVB met gedragsproblematiek", "crisis en zelfbeschadiging",
    "eetstoornissen", "angst- en dwangstoornis", "depressie", "psychose",
    "verslavingsproblematiek",
]

ZORGVORMEN = ["ambulant", "residentieel", "dagbehandeling", "thuisbegeleiding", "crisisopvang"]
ZORGDOMEINEN = ["jeugd", "jeugd_ggz", "jeugd_lvb", "volwassenen", "forensisch", "lvb"]
SETTINGS = ["open", "besloten", "semi_besloten"]
INTENSITEITEN = ["licht", "middel", "intensief", "hoog_intensief"]


class Command(BaseCommand):
    help = "Seed the database with realistic Dutch provider data for development"

    def add_arguments(self, parser):
        parser.add_argument(
            "--allow-fake-seed",
            action="store_true",
            default=False,
            help="Bypass real-source policy and generate synthetic seed data (tests only).",
        )
        parser.add_argument(
            "--organization-slug",
            default=None,
            help="Slug of Organization to create contracts for",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            default=False,
            help="Remove existing seed data before seeding",
        )
        parser.add_argument(
            "--no-contracts",
            action="store_true",
            default=False,
            help="Skip contract creation",
        )

    def handle(self, *args, **options):
        if not options.get("allow_fake_seed"):
            raise CommandError(
                "seed_providers is blocked by the real-source data policy. "
                "Import real provider files via run_provider_import --source agb_csv/csv_import/jsonfile. "
                "Use --allow-fake-seed only in isolated automated tests."
            )

        rng = random.Random(42)  # deterministic seed for reproducibility

        if options["clear"]:
            self._clear_seed_data()

        org = None
        if options.get("organization_slug"):
            try:
                org = Organization.objects.get(slug=options["organization_slug"])
            except Organization.DoesNotExist:
                raise CommandError(
                    f"Organization with slug '{options['organization_slug']}' not found. "
                    "Create it first or omit --organization-slug."
                )
        else:
            # Use first available org or skip contracts
            org = Organization.objects.first()

        # Create a seed import batch for traceability
        batch = ProviderImportBatch.objects.create(
            source_system="seeded",
            source_version="v2",
            triggered_by="manage.py seed_providers",
            status=ProviderImportBatch.BatchStatus.COMPLETED,
            total_records=len(PROVIDERS_DATA),
        )

        created_providers = []
        created_vestigingen = []
        created_profielen = []

        self.stdout.write("Seeding Zorgaanbieders...")
        for i, (naam, handelsnaam, org_type, omschrijving) in enumerate(PROVIDERS_DATA):
            # Skip if already seeded
            if Zorgaanbieder.objects.filter(name=naam, bron_type="seeded").exists():
                provider = Zorgaanbieder.objects.get(name=naam, bron_type="seeded")
                created_providers.append(provider)
                continue

            agb_code = f"{i + 1:08d}"
            kvk = f"{10000000 + i:08d}"

            provider = Zorgaanbieder.objects.create(
                name=naam,
                handelsnaam=handelsnaam,
                agb_code=agb_code,
                kvk_number=kvk,
                provider_type=org_type,
                omschrijving_kort=omschrijving,
                trust_level=Zorgaanbieder.TrustLevel.VERIFIED,
                is_active=True,
                landelijk_dekkend=rng.random() < 0.15,
                bron_type=Zorgaanbieder.BronType.SEEDED,
                bron_id=f"seed-{agb_code}",
                bron_laatst_gesynchroniseerd_op=timezone.now(),
                normalisatie_status=Zorgaanbieder.NormalisatieStatus.NORMALIZED,
                review_status=Zorgaanbieder.ReviewStatus.APPROVED,
                last_import_batch=batch,
                website=f"https://www.{handelsnaam.lower().replace(' ', '')}.nl",
                email=f"info@{handelsnaam.lower().replace(' ', '')}.nl",
                phone=f"0{rng.randint(10, 99)}-{rng.randint(1000000, 9999999)}",
            )
            created_providers.append(provider)

        self.stdout.write(f"  Created {len(created_providers)} aanbieders")

        self.stdout.write("Seeding AanbiederVestigingen...")
        gemeenten_shuffled = GEMEENTEN.copy()
        rng.shuffle(gemeenten_shuffled)

        for idx, provider in enumerate(created_providers):
            # Each provider gets 1-3 vestigingen
            n_vestigingen = rng.choice([1, 1, 2, 2, 3]) if idx < 20 else 1
            provider_gemeenten = rng.sample(gemeenten_shuffled, min(n_vestigingen, len(gemeenten_shuffled)))

            for j, (gemeente, regio_code, provincie, regio_jeugd) in enumerate(provider_gemeenten):
                ves_code = f"VES-{idx + 1:03d}-{j + 1:02d}"
                if AanbiederVestiging.objects.filter(
                    zorgaanbieder=provider, vestiging_code=ves_code
                ).exists():
                    ves = AanbiederVestiging.objects.get(
                        zorgaanbieder=provider, vestiging_code=ves_code
                    )
                    created_vestigingen.append(ves)
                    continue

                lat = 51.5 + rng.uniform(-1.5, 2.5)
                lon = 4.5 + rng.uniform(-1.0, 3.0)

                ves = AanbiederVestiging.objects.create(
                    zorgaanbieder=provider,
                    vestiging_code=ves_code,
                    name=f"{provider.handelsnaam} — {gemeente}",
                    straat=f"{rng.choice(['Hoofdstraat', 'Kerkstraat', 'Molenweg', 'Dorpsplein', 'Zorgpark'])}",
                    huisnummer=str(rng.randint(1, 200)),
                    city=gemeente,
                    gemeente=gemeente,
                    provincie=provincie,
                    postcode=f"{rng.randint(1000, 9999)}{rng.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}{rng.choice('ABCDEFGHJKLMNPQRSTUVWXYZ')}",
                    region=regio_code,
                    regio_jeugd=regio_jeugd,
                    latitude=round(lat, 6),
                    longitude=round(lon, 6),
                    telefoon_vestiging=f"0{rng.randint(10, 99)}-{rng.randint(1000000, 9999999)}",
                    email_vestiging=f"vestiging.{gemeente.lower().replace(' ', '')}@{provider.handelsnaam.lower().replace(' ', '')}.nl",
                    is_primary=(j == 0),
                    is_active=True,
                    bron_type="seeded",
                    bron_id=f"seed-ves-{ves_code}",
                    bron_laatst_gesynchroniseerd_op=timezone.now(),
                )
                created_vestigingen.append(ves)

        self.stdout.write(f"  Created {len(created_vestigingen)} vestigingen")

        self.stdout.write("Seeding Zorgprofielen...")
        for ves in created_vestigingen:
            provider = ves.zorgaanbieder
            zorgvorm = {
                "AMBULANT": "ambulant",
                "RESIDENTIEEL": "residentieel",
                "DAGBEHANDELING": "dagbehandeling",
                "THUISBEGELEIDING": "thuisbegeleiding",
                "CRISISOPVANG": "crisisopvang",
                "OVERIG": "ambulant",
            }.get(provider.provider_type, "ambulant")

            domein = rng.choice(["jeugd", "jeugd_ggz", "jeugd_lvb"])
            specialisaties = rng.sample(SPECIALISATIES_POOL, rng.randint(2, 5))
            problematiek = rng.sample(PROBLEMATIEK_TYPES_POOL, rng.randint(2, 6))
            intensiteit = rng.choice(INTENSITEITEN)
            setting = rng.choice(SETTINGS) if zorgvorm in {"residentieel", "crisisopvang"} else "open"
            leeftijd_van = rng.choice([0, 4, 6, 8, 12])
            leeftijd_tot = rng.choice([12, 14, 18, 21, 23])

            if Zorgprofiel.objects.filter(aanbieder_vestiging=ves).exists():
                prof = Zorgprofiel.objects.get(aanbieder_vestiging=ves)
                created_profielen.append(prof)
                continue

            prof = Zorgprofiel.objects.create(
                aanbieder_vestiging=ves,
                zorgaanbieder=provider,
                zorgvorm=zorgvorm,
                zorgdomein=domein,
                doelgroep_leeftijd_van=leeftijd_van,
                doelgroep_leeftijd_tot=leeftijd_tot,
                geslacht_beperking="",
                problematiek_types=problematiek,
                contra_indicaties="Ernstige gedragsregulatieproblemen zonder behandelkader" if rng.random() < 0.2 else "",
                intensiteit=intensiteit,
                setting_type=setting,
                crisis_opvang_mogelijk=(zorgvorm == "crisisopvang" or rng.random() < 0.15),
                lvb_geschikt=(domein == "jeugd_lvb" or rng.random() < 0.25),
                autisme_geschikt=("autisme" in specialisaties or rng.random() < 0.30),
                trauma_geschikt=("trauma" in specialisaties or rng.random() < 0.35),
                ggz_comorbiditeit_mogelijk=(domein == "jeugd_ggz" or rng.random() < 0.40),
                verslavingsproblematiek_mogelijk=rng.random() < 0.20,
                veiligheidsrisico_hanteerbaar=(setting != "open"),
                specialisaties=", ".join(specialisaties),
                regio_codes=ves.region,
                omschrijving_match_context=(
                    f"Gespecialiseerd in {', '.join(specialisaties[:2])}. "
                    f"Intensiteit: {intensiteit}. Leeftijd {leeftijd_van}-{leeftijd_tot} jaar."
                ),
                # v1 compat flags
                biedt_ambulant=(zorgvorm == "ambulant"),
                biedt_residentieel=(zorgvorm == "residentieel"),
                biedt_dagbehandeling=(zorgvorm == "dagbehandeling"),
                biedt_crisis=(zorgvorm == "crisisopvang"),
                biedt_thuisbegeleiding=(zorgvorm == "thuisbegeleiding"),
                leeftijd_0_4=(leeftijd_van <= 4),
                leeftijd_4_12=(leeftijd_van <= 12 and leeftijd_tot >= 4),
                leeftijd_12_18=(leeftijd_tot >= 12),
                leeftijd_18_plus=(leeftijd_tot > 18),
                complexiteit_enkelvoudig=(intensiteit in {"licht", "middel"}),
                complexiteit_meervoudig=(intensiteit in {"middel", "intensief"}),
                complexiteit_zwaar=(intensiteit in {"intensief", "hoog_intensief"}),
                urgentie_laag=(intensiteit == "licht"),
                urgentie_middel=(intensiteit == "middel"),
                urgentie_hoog=(intensiteit in {"intensief", "hoog_intensief"}),
                urgentie_crisis=(zorgvorm == "crisisopvang"),
                actief=True,
            )
            created_profielen.append(prof)

            # Capacity record for this profile/vestiging
            totaal = rng.randint(10, 60)
            beschikbaar = rng.randint(0, min(totaal, 8))
            wachtlijst = rng.randint(0, 15)
            wachttijd = rng.randint(0, 120)

            CapaciteitRecord.objects.create(
                vestiging=ves,
                import_batch=batch,
                zorgprofiel=prof,
                open_slots=beschikbaar,
                waiting_list_size=wachtlijst,
                avg_wait_days=wachttijd,
                max_capacity=totaal,
                capaciteit_type=zorgvorm,
                totale_capaciteit=totaal,
                beschikbare_capaciteit=beschikbaar,
                wachtlijst_aantal=wachtlijst,
                gemiddelde_wachttijd_dagen=wachttijd,
                direct_pleegbaar=(beschikbaar > 0 and wachttijd < 7),
                betrouwbaarheid_score=round(rng.uniform(0.6, 1.0), 2),
                recorded_at=timezone.now(),
                toelichting_capaciteit=(
                    "Actuele capaciteitsopgave vanuit seed data." if beschikbaar > 0
                    else "Wachtlijst actief — geen directe plaatsing mogelijk."
                ),
                laatst_bijgewerkt_op=timezone.now(),
                laatst_bijgewerkt_door="seed_providers",
            )

        self.stdout.write(f"  Created {len(created_profielen)} zorgprofielen + capaciteit records")

        # Contracts
        if org and not options.get("no_contracts"):
            self.stdout.write(f"Seeding ContractRelaties for org '{org.name}'...")
            contract_count = 0
            for provider in created_providers:
                # 70% of providers have an active contract
                if rng.random() < 0.70:
                    contract_type = rng.choice(["JW_310", "JW_320", "JW_330", "WMO_H63", "WMO_H65"])
                    gemeente_name = rng.choice(GEMEENTEN)[0]
                    ContractRelatie.objects.get_or_create(
                        zorgaanbieder=provider,
                        organization=org,
                        contract_type=contract_type,
                        defaults={
                            "status": ContractRelatie.ContractStatus.ACTIEF,
                            "actief_contract": True,
                            "gemeente": gemeente_name,
                            "regio": provider.vestigingen.first().region if provider.vestigingen.exists() else "",
                            "zorgvormen_contract": [provider.provider_type],
                            "start_date": date(2024, 1, 1),
                            "end_date": date(2025, 12, 31),
                            "voorkeursaanbieder": rng.random() < 0.20,
                            "import_batch": batch,
                        },
                    )
                    contract_count += 1
            self.stdout.write(f"  Created {contract_count} contracts")

        # Summary
        self.stdout.write(self.style.SUCCESS(
            f"\n✓ Seed complete:\n"
            f"  Zorgaanbieders:   {Zorgaanbieder.objects.filter(bron_type='seeded').count()}\n"
            f"  Vestigingen:      {AanbiederVestiging.objects.filter(bron_type='seeded').count()}\n"
            f"  Zorgprofielen:    {Zorgprofiel.objects.filter(zorgaanbieder__bron_type='seeded').count()}\n"
            f"  CapaciteitRecords:{CapaciteitRecord.objects.filter(import_batch=batch).count()}\n"
            f"  ContractRelaties: {ContractRelatie.objects.filter(import_batch=batch).count()}\n"
        ))

    def _clear_seed_data(self):
        """Remove all records created by seed_providers."""
        self.stdout.write("Clearing existing seed data...")
        seeded = Zorgaanbieder.objects.filter(bron_type="seeded")
        count = seeded.count()
        seeded.delete()
        self.stdout.write(f"  Removed {count} seeded providers (cascade deletes related records)")
