"""
Provider Filter Service.

Provides filtering over the canonical provider tables for UI and API queries.

Rules:
  - Always filters over internal canonical tables only (Zorgaanbieder, Zorgprofiel, etc.)
  - Never exposes staging/raw tables
  - Returns querysets — callers control pagination and serialization

Supported filters:
  naam                — substring on Zorgaanbieder.name / handelsnaam
  regio               — regio_codes contains this value
  gemeente            — AanbiederVestiging.gemeente icontains
  zorgvorm            — Zorgprofiel.zorgvorm iexact (or v1 boolean flag)
  leeftijd_van        — profile.doelgroep_leeftijd_van <= X
  leeftijd_tot        — profile.doelgroep_leeftijd_tot >= X
  problematiek        — profile.problematiek_types contains any of these
  specialisatie       — profile.specialisaties icontains
  contract_actief     — ContractRelatie exists with actief_contract=True
  directe_beschikbaar — CapaciteitRecord.direct_pleegbaar=True or beschikbare_capaciteit>0
  max_wachttijd_dagen — CapaciteitRecord.gemiddelde_wachttijd_dagen <= X
  crisis_mogelijk     — Zorgprofiel.crisis_opvang_mogelijk=True
  lvb_geschikt        — Zorgprofiel.lvb_geschikt=True
  autisme_geschikt    — Zorgprofiel.autisme_geschikt=True
  organization_id     — providers with contract for this organization

Usage:
    from contracts.legacy_backend.provider_filter_service import (
        filter_zorgprofielen,
        filter_zorgaanbieders,
    )

    qs = filter_zorgprofielen(filters={
        "zorgvorm": "ambulant",
        "leeftijd_van": 10,
        "regio": "NL-UT",
        "crisis_mogelijk": True,
    })
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet

from contracts.models import (
    AanbiederVestiging,
    CapaciteitRecord,
    ContractRelatie,
    Zorgaanbieder,
    Zorgprofiel,
)


def filter_zorgprofielen(
    filters: dict[str, Any],
    organization_id: int | None = None,
    base_qs: QuerySet | None = None,
) -> QuerySet:
    """
    Return a filtered queryset of Zorgprofiel records.

    Callers may pass a base_qs to scope to a tenant/org context.
    All filters are optional and applied only when present.
    """
    qs = base_qs if base_qs is not None else (
        Zorgprofiel.objects
        .select_related('aanbieder_vestiging__zorgaanbieder', 'zorgaanbieder')
        .filter(actief=True)
    )

    # --- Care form ---
    zorgvorm = filters.get("zorgvorm", "")
    if zorgvorm:
        v1_flag_map = {
            "ambulant": "biedt_ambulant",
            "residentieel": "biedt_residentieel",
            "dagbehandeling": "biedt_dagbehandeling",
            "crisisopvang": "biedt_crisis",
            "thuisbegeleiding": "biedt_thuisbegeleiding",
        }
        v1_field = v1_flag_map.get(zorgvorm.lower())
        if v1_field:
            qs = qs.filter(Q(zorgvorm__iexact=zorgvorm) | Q(**{v1_field: True}))
        else:
            qs = qs.filter(zorgvorm__iexact=zorgvorm)

    # --- Age range ---
    leeftijd_van = filters.get("leeftijd_van")
    if leeftijd_van is not None:
        qs = qs.filter(
            Q(doelgroep_leeftijd_van__isnull=True)
            | Q(doelgroep_leeftijd_van__lte=leeftijd_van)
        )

    leeftijd_tot = filters.get("leeftijd_tot")
    if leeftijd_tot is not None:
        qs = qs.filter(
            Q(doelgroep_leeftijd_tot__isnull=True)
            | Q(doelgroep_leeftijd_tot__gte=leeftijd_tot)
        )

    # --- Region ---
    regio = filters.get("regio", "")
    if regio:
        qs = qs.filter(Q(regio_codes__icontains=regio) | Q(regio_codes=""))

    # --- Gemeente (via vestiging) ---
    gemeente = filters.get("gemeente", "")
    if gemeente:
        vestiging_ids = (
            AanbiederVestiging.objects
            .filter(gemeente__icontains=gemeente, is_active=True)
            .values_list("id", flat=True)
        )
        qs = qs.filter(aanbieder_vestiging_id__in=vestiging_ids)

    # --- Problematiek ---
    problematiek = filters.get("problematiek")
    if problematiek:
        # Filter: profile handles at least one of the requested problematiek types
        # Using icontains on the JSON field text representation (works for SQLite dev)
        # For production PostgreSQL: use JSONField contains lookup
        prob_q = Q()
        for prob in problematiek:
            prob_q |= Q(problematiek_types__icontains=prob)
        qs = qs.filter(prob_q)

    # --- Specialisatie ---
    specialisatie = filters.get("specialisatie", "")
    if specialisatie:
        qs = qs.filter(specialisaties__icontains=specialisatie)

    # --- Clinical flags ---
    if filters.get("crisis_mogelijk"):
        qs = qs.filter(Q(crisis_opvang_mogelijk=True) | Q(biedt_crisis=True))

    if filters.get("lvb_geschikt"):
        qs = qs.filter(lvb_geschikt=True)

    if filters.get("autisme_geschikt"):
        qs = qs.filter(autisme_geschikt=True)

    if filters.get("trauma_geschikt"):
        qs = qs.filter(trauma_geschikt=True)

    # --- Contract filter ---
    if filters.get("contract_actief") or organization_id:
        cr_filter = ContractRelatie.objects.filter(actief_contract=True)
        if organization_id:
            cr_filter = cr_filter.filter(organization_id=organization_id)
        contracted_ids = cr_filter.values_list("zorgaanbieder_id", flat=True)
        qs = qs.filter(
            Q(zorgaanbieder_id__in=contracted_ids)
            | Q(aanbieder_vestiging__zorgaanbieder_id__in=contracted_ids)
        )

    # --- Capacity ---
    if filters.get("directe_beschikbaarheid"):
        beschikbare_vestiging_ids = (
            CapaciteitRecord.objects
            .filter(Q(direct_pleegbaar=True) | Q(beschikbare_capaciteit__gt=0) | Q(open_slots__gt=0))
            .values_list("vestiging_id", flat=True)
        )
        qs = qs.filter(aanbieder_vestiging_id__in=beschikbare_vestiging_ids)

    max_wachttijd = filters.get("max_wachttijd_dagen")
    if max_wachttijd is not None:
        acceptabele_vestiging_ids = (
            CapaciteitRecord.objects
            .filter(
                Q(gemiddelde_wachttijd_dagen__lte=max_wachttijd)
                | Q(avg_wait_days__lte=max_wachttijd)
            )
            .values_list("vestiging_id", flat=True)
        )
        qs = qs.filter(aanbieder_vestiging_id__in=acceptabele_vestiging_ids)

    return qs.distinct()


def filter_zorgaanbieders(
    filters: dict[str, Any],
    organization_id: int | None = None,
    base_qs: QuerySet | None = None,
) -> QuerySet:
    """
    Return a filtered queryset of Zorgaanbieder records.

    Useful for the provider listing page and selection dropdowns.
    """
    qs = base_qs if base_qs is not None else (
        Zorgaanbieder.objects
        .prefetch_related("vestigingen", "zorgprofielen")
        .filter(is_active=True)
    )

    # --- Name search ---
    naam = filters.get("naam", "").strip()
    if naam:
        qs = qs.filter(Q(name__icontains=naam) | Q(handelsnaam__icontains=naam))

    # --- Contract filter ---
    if filters.get("contract_actief") or organization_id:
        cr_filter = ContractRelatie.objects.filter(actief_contract=True)
        if organization_id:
            cr_filter = cr_filter.filter(organization_id=organization_id)
        contracted_ids = cr_filter.values_list("zorgaanbieder_id", flat=True)
        qs = qs.filter(id__in=contracted_ids)

    # --- Regio (via zorgprofiel) ---
    regio = filters.get("regio", "")
    if regio:
        profiel_ids = Zorgprofiel.objects.filter(
            Q(regio_codes__icontains=regio) | Q(regio_codes="")
        ).values_list("zorgaanbieder_id", flat=True)
        # Also check via vestiging FK
        profiel_via_vestiging_ids = (
            Zorgprofiel.objects
            .filter(Q(regio_codes__icontains=regio) | Q(regio_codes=""))
            .exclude(aanbieder_vestiging__isnull=True)
            .values_list("aanbieder_vestiging__zorgaanbieder_id", flat=True)
        )
        qs = qs.filter(
            Q(id__in=profiel_ids) | Q(id__in=profiel_via_vestiging_ids)
        )

    # --- Gemeente (via vestiging) ---
    gemeente = filters.get("gemeente", "")
    if gemeente:
        ves_ids = (
            AanbiederVestiging.objects
            .filter(gemeente__icontains=gemeente, is_active=True)
            .values_list("zorgaanbieder_id", flat=True)
        )
        qs = qs.filter(id__in=ves_ids)

    # --- Zorgvorm (via zorgprofiel) ---
    zorgvorm = filters.get("zorgvorm", "")
    if zorgvorm:
        v1_flag_map = {
            "ambulant": "biedt_ambulant",
            "residentieel": "biedt_residentieel",
            "dagbehandeling": "biedt_dagbehandeling",
            "crisisopvang": "biedt_crisis",
            "thuisbegeleiding": "biedt_thuisbegeleiding",
        }
        v1_field = v1_flag_map.get(zorgvorm.lower())
        if v1_field:
            profiel_q = Q(zorgvorm__iexact=zorgvorm) | Q(**{v1_field: True})
        else:
            profiel_q = Q(zorgvorm__iexact=zorgvorm)

        profiel_za_ids = (
            Zorgprofiel.objects.filter(profiel_q, actief=True)
            .values_list("zorgaanbieder_id", flat=True)
        )
        profiel_ves_ids = (
            Zorgprofiel.objects.filter(profiel_q, actief=True)
            .exclude(aanbieder_vestiging__isnull=True)
            .values_list("aanbieder_vestiging__zorgaanbieder_id", flat=True)
        )
        qs = qs.filter(Q(id__in=profiel_za_ids) | Q(id__in=profiel_ves_ids))

    # --- Clinical flags (via zorgprofiel) ---
    clinical_flags = {
        "crisis_mogelijk": Q(crisis_opvang_mogelijk=True) | Q(biedt_crisis=True),
        "lvb_geschikt": Q(lvb_geschikt=True),
        "autisme_geschikt": Q(autisme_geschikt=True),
        "trauma_geschikt": Q(trauma_geschikt=True),
    }
    for flag, profile_q in clinical_flags.items():
        if filters.get(flag):
            za_ids = (
                Zorgprofiel.objects.filter(profile_q, actief=True)
                .values_list("zorgaanbieder_id", flat=True)
            )
            qs = qs.filter(id__in=za_ids)

    return qs.distinct()


def get_beschikbare_capacity_for_profiel(profiel: Zorgprofiel) -> CapaciteitRecord | None:
    """Return the most recent capacity record for a given Zorgprofiel."""
    qs = CapaciteitRecord.objects.filter(
        Q(zorgprofiel=profiel)
    )
    if profiel.aanbieder_vestiging:
        qs = qs | CapaciteitRecord.objects.filter(vestiging=profiel.aanbieder_vestiging)
    return qs.order_by("-recorded_at").first()
