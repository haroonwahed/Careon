"""Deterministic region-aware matching service for canonical provider data."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any

from django.db.models import Q
from django.utils import timezone

from contracts.models import (
    AanbiederVestiging,
    CapaciteitRecord,
    ContractRelatie,
    MatchResultaat,
    Organization,
    PrestatieProfiel,
    ProviderRegioDekking,
    Zorgprofiel,
)


CONFIDENCE_HOOG_THRESHOLD = 75.0
CONFIDENCE_MIDDEL_THRESHOLD = 55.0


@dataclass
class MatchContext:
    zorgvorm: str = ""
    leeftijd: int | None = None
    regio: str = ""
    gemeente: str = ""
    complexiteit: str = ""
    urgentie: str = ""
    problematiek: list[str] = field(default_factory=list)
    specialisaties_gevraagd: list[str] = field(default_factory=list)
    crisisopvang_vereist: bool = False
    setting_voorkeur: str = ""
    contra_indicaties: list[str] = field(default_factory=list)
    max_toelaatbare_wachttijd_dagen: int | None = None
    organization: Organization | None = None


class HardExclusion(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


def _split_tokens(raw: str) -> list[str]:
    return [part.strip().lower() for part in str(raw or "").split(",") if part.strip()]


def _profile_owner(profiel: Zorgprofiel):
    if profiel.aanbieder_vestiging:
        return profiel.aanbieder_vestiging.zorgaanbieder, profiel.aanbieder_vestiging
    return profiel.zorgaanbieder, None


def _resolve_case_fk(casus: Any):
    if casus is None:
        return None
    model_name = getattr(getattr(casus, "_meta", None), "model_name", "")
    if model_name == "carecase":
        return casus
    linked_case = getattr(casus, "contract", None)
    if getattr(getattr(linked_case, "_meta", None), "model_name", "") == "carecase":
        return linked_case
    return None


def _latest_capacity(profiel: Zorgprofiel, vestiging: AanbiederVestiging | None):
    filters = Q(zorgprofiel=profiel)
    if vestiging is not None:
        filters |= Q(vestiging=vestiging)
    return CapaciteitRecord.objects.filter(filters).order_by("-recorded_at").first()


def _find_contract(ctx: MatchContext, zorgaanbieder):
    if not ctx.organization or zorgaanbieder is None:
        return None
    qs = ContractRelatie.objects.filter(zorgaanbieder=zorgaanbieder, organization=ctx.organization)
    if ctx.regio:
        exact = qs.filter(regio__iexact=ctx.regio, actief_contract=True).order_by("-updated_at").first()
        if exact:
            return exact
    return qs.filter(actief_contract=True).order_by("-updated_at").first()


def _find_coverage(ctx: MatchContext, zorgaanbieder, vestiging: AanbiederVestiging | None):
    if not ctx.regio or zorgaanbieder is None:
        return None
    qs = ProviderRegioDekking.objects.filter(
        zorgaanbieder=zorgaanbieder,
        dekking_status=ProviderRegioDekking.DekkingStatus.ACTIVE,
        contract_actief=True,
    )
    if vestiging is not None:
        qs = qs.filter(Q(aanbieder_vestiging=vestiging) | Q(aanbieder_vestiging__isnull=True))
    return qs.filter(Q(regio__region_code__iexact=ctx.regio) | Q(regio__region_name__iexact=ctx.regio)).order_by(
        "-is_primair_dekkingsgebied", "-updated_at"
    ).first()


def _capacity_waitlistable(capaciteit: CapaciteitRecord | None, max_wait_days: int) -> bool:
    if capaciteit is None:
        return False
    beschikbare = max(capaciteit.beschikbare_capaciteit or capaciteit.open_slots or 0, 0)
    if beschikbare > 0:
        return True
    wachttijd = capaciteit.gemiddelde_wachttijd_dagen or capaciteit.avg_wait_days or 0
    return wachttijd <= max_wait_days


def _check_hard_exclusions(profiel, ctx, vestiging, capaciteit, contract, coverage):
    zorgaanbieder, _ = _profile_owner(profiel)

    if not profiel.actief:
        raise HardExclusion("Zorgprofiel is niet actief")
    if zorgaanbieder is None or not zorgaanbieder.is_active:
        raise HardExclusion("Zorgaanbieder is niet actief")
    if vestiging is not None and not vestiging.is_active:
        raise HardExclusion("Vestiging is niet actief")

    if ctx.organization and (contract is None or not contract.actief_contract):
        raise HardExclusion("Geen actief contract in regio")
    if ctx.regio and coverage is None:
        raise HardExclusion("Geen actieve regiodekking")

    if ctx.leeftijd is not None:
        if profiel.doelgroep_leeftijd_van is not None and ctx.leeftijd < profiel.doelgroep_leeftijd_van:
            raise HardExclusion("Leeftijd onder doelgroepminimum")
        if profiel.doelgroep_leeftijd_tot is not None and ctx.leeftijd > profiel.doelgroep_leeftijd_tot:
            raise HardExclusion("Leeftijd boven doelgroepmaximum")

    requested_zorgvorm = (ctx.zorgvorm or "").strip().lower()
    offered_flags = {
        "ambulant": profiel.biedt_ambulant,
        "residentieel": profiel.biedt_residentieel,
        "dagbehandeling": profiel.biedt_dagbehandeling,
        "crisis": profiel.biedt_crisis,
        "crisisopvang": profiel.biedt_crisis,
        "thuisbegeleiding": profiel.biedt_thuisbegeleiding,
    }
    profile_zorgvorm = (profiel.zorgvorm or "").strip().lower()
    if requested_zorgvorm and profile_zorgvorm and profile_zorgvorm != requested_zorgvorm and not offered_flags.get(requested_zorgvorm, False):
        raise HardExclusion("Incompatibele zorgvorm")

    if ctx.crisisopvang_vereist and not (profiel.crisis_opvang_mogelijk or profiel.biedt_crisis):
        raise HardExclusion("Crisis nodig maar niet mogelijk")

    provider_contra = set(_split_tokens(profiel.contra_indicaties))
    if provider_contra:
        for item in [p.strip().lower() for p in ctx.problematiek if str(p).strip()]:
            if item in provider_contra:
                raise HardExclusion(f"Contra-indicatie conflict: {item}")

    case_contra = set(_split_tokens(",".join(ctx.contra_indicaties)))
    profile_problematiek = {p.strip().lower() for p in (profiel.problematiek_types or []) if str(p).strip()}
    for item in case_contra:
        if item in profile_problematiek:
            raise HardExclusion(f"Contra-indicatie conflict: {item}")

    if (ctx.complexiteit or "").strip().lower() == "zwaar" and not (
        profiel.complexiteit_zwaar and profiel.veiligheidsrisico_hanteerbaar
    ):
        raise HardExclusion("Onveilige complexiteitsmismatch")

    max_wait = int(ctx.max_toelaatbare_wachttijd_dagen or 42)
    if not _capacity_waitlistable(capaciteit, max_wait):
        raise HardExclusion("Geen werkbare capaciteit")


def _score_inhoudelijke_fit(profiel, ctx):
    score = 0.0
    reasons = []

    requested_zorgvorm = (ctx.zorgvorm or "").strip().lower()
    offered_flags = {
        "ambulant": profiel.biedt_ambulant,
        "residentieel": profiel.biedt_residentieel,
        "dagbehandeling": profiel.biedt_dagbehandeling,
        "crisis": profiel.biedt_crisis,
        "crisisopvang": profiel.biedt_crisis,
        "thuisbegeleiding": profiel.biedt_thuisbegeleiding,
    }
    if requested_zorgvorm and ((profiel.zorgvorm or "").strip().lower() == requested_zorgvorm or offered_flags.get(requested_zorgvorm, False)):
        score += 10
        reasons.append("Zorgvorm fit")

    requested_problematiek = {p.strip().lower() for p in ctx.problematiek if str(p).strip()}
    profile_problematiek = {p.strip().lower() for p in (profiel.problematiek_types or []) if str(p).strip()}
    overlap = requested_problematiek & profile_problematiek
    if overlap:
        score += min(10, (len(overlap) / max(len(requested_problematiek), 1)) * 10)
        reasons.append("Problematiek-overlap")

    requested_specs = [s.strip().lower() for s in ctx.specialisaties_gevraagd if str(s).strip()]
    if requested_specs and profiel.specialisaties:
        matched = [s for s in requested_specs if s in profiel.specialisaties.lower()]
        if matched:
            score += min(6, (len(matched) / len(requested_specs)) * 6)
            reasons.append("Specialisatie-overlap")

    if (ctx.urgentie or "").strip().lower() in {"hoog", "crisis"} and (profiel.intensiteit or "").strip().lower() in {"intensief", "hoog_intensief"}:
        score += 5
    elif (ctx.urgentie or "").strip().lower() in {"laag", "middel"}:
        score += 3

    if ctx.setting_voorkeur and (profiel.setting_type or "").strip().lower() == ctx.setting_voorkeur.strip().lower():
        score += 4
        reasons.append("Setting fit")
    elif not ctx.setting_voorkeur:
        score += 2

    return min(score, 35.0), reasons


def _score_regio_contract_fit(ctx, contract, coverage):
    score = 0.0
    reasons = []
    bonus_penalty = 0.0

    if coverage is not None:
        score += 9
        reasons.append("Exacte regiodekking")
        if coverage.is_primair_dekkingsgebied:
            score += 3
            bonus_penalty += 2
        else:
            bonus_penalty -= 2
        if coverage.contract_actief:
            score += 4

    if contract is not None and contract.actief_contract:
        score += 4
        reasons.append("Actieve contracteerbaarheid")
        if ctx.gemeente and contract.gemeente and contract.gemeente.strip().lower() == ctx.gemeente.strip().lower():
            score += 1
            bonus_penalty += 1

    return min(score, 20.0), reasons, bonus_penalty


def _score_capaciteit_wachttijd_fit(capaciteit, ctx, coverage):
    if capaciteit is None:
        return 2.0, ["Geen capaciteitsdata"], -3.0

    score = 0.0
    reasons = []
    bonus_penalty = 0.0

    beschikbare = max(capaciteit.beschikbare_capaciteit or capaciteit.open_slots or 0, 0)
    wachtlijst = capaciteit.wachtlijst_aantal or capaciteit.waiting_list_size or 0
    wachttijd = capaciteit.gemiddelde_wachttijd_dagen or capaciteit.avg_wait_days or 0

    if capaciteit.direct_pleegbaar or beschikbare > 0:
        score += 8
    elif wachtlijst >= 0:
        score += 3

    max_wait = int(ctx.max_toelaatbare_wachttijd_dagen or 42)
    if wachttijd <= max_wait:
        score += 7
    else:
        score += 2
        bonus_penalty -= 4

    reliability = capaciteit.betrouwbaarheid_score
    if reliability is not None:
        score += 3 if reliability >= 0.8 else 2 if reliability >= 0.5 else 1

    freshness = capaciteit.laatst_bijgewerkt_op or capaciteit.recorded_at
    if freshness and freshness >= timezone.now() - timedelta(days=7):
        score += 2
    else:
        bonus_penalty -= 3

    if wachttijd <= 14:
        score += 2
    elif wachttijd <= 28:
        score += 1

    if coverage is not None and not coverage.capaciteit_meerekenen:
        bonus_penalty -= 2

    reasons.append("Capaciteit/wachttijd beoordeeld")
    return min(score, 20.0), reasons, bonus_penalty


def _score_complexiteit_veiligheid_fit(profiel, ctx):
    score = 0.0
    reasons = []

    complexiteit = (ctx.complexiteit or "").strip().lower()
    if complexiteit == "enkelvoudig" and profiel.complexiteit_enkelvoudig:
        score += 6
    elif complexiteit == "meervoudig" and profiel.complexiteit_meervoudig:
        score += 6
    elif complexiteit == "zwaar" and profiel.complexiteit_zwaar:
        score += 6
    elif not complexiteit:
        score += 3

    if profiel.ggz_comorbiditeit_mogelijk:
        score += 3
    if profiel.veiligheidsrisico_hanteerbaar:
        score += 3
    if profiel.setting_type:
        score += 3

    reasons.append("Complexiteit/veiligheid beoordeeld")
    return min(score, 15.0), reasons


def _score_performance_fit(prestaties):
    if prestaties is None or prestaties.aantal_matches == 0:
        return 4.0, ["Beperkte performance-historie"]

    score = 0.0
    reasons = []

    success = float(prestaties.succesratio_match_naar_plaatsing or 0.0)
    score += min(4.0, success * 4.0)

    react = float(prestaties.gemiddelde_reactietijd_uren or 0)
    score += 2.5 if 0 < react <= 24 else 1.5 if react <= 72 else 0

    acceptance = float(prestaties.acceptatiegraad_of_aanname_ratio or 0.0)
    score += min(2.0, acceptance * 2.0)

    drop_out = float(prestaties.plaatsing_voortijdig_beeindigd_ratio or 0.0)
    if drop_out <= 0.15:
        score += 1.5

    reasons.append("Performance beoordeeld")
    return min(score, 10.0), reasons


def _confidence_label(total_score, capaciteit, prestaties):
    penalty = 0.0
    if capaciteit is None:
        penalty += 10.0
    if prestaties is None or prestaties.aantal_matches == 0:
        penalty += 5.0

    effective = total_score - penalty
    if effective >= CONFIDENCE_HOOG_THRESHOLD:
        return MatchResultaat.ConfidenceLabel.HOOG
    if effective >= CONFIDENCE_MIDDEL_THRESHOLD:
        return MatchResultaat.ConfidenceLabel.MIDDEL
    if effective >= 35.0:
        return MatchResultaat.ConfidenceLabel.LAAG
    return MatchResultaat.ConfidenceLabel.ONZEKER


class MatchEngine:
    @staticmethod
    def run(ctx: MatchContext, casus: Any = None, max_results: int = 20, persist: bool = False) -> list[MatchResultaat]:
        candidates = MatchEngine._load_candidates(ctx, limit=max_results)
        resultaten = [MatchEngine._evaluate_candidate(profiel, ctx, casus) for profiel in candidates]
        resultaten.sort(key=lambda r: (r.uitgesloten, -r.totaalscore, (r.zorgaanbieder.name or "").lower()))

        rank = 1
        for row in resultaten:
            if row.uitgesloten:
                continue
            row.ranking = rank
            rank += 1

        if persist:
            for row in resultaten:
                row.save()

        return resultaten

    @staticmethod
    def _load_candidates(ctx: MatchContext, limit: int):
        qs = Zorgprofiel.objects.select_related("aanbieder_vestiging__zorgaanbieder", "zorgaanbieder").filter(actief=True)
        if ctx.zorgvorm:
            qs = qs.filter(Q(zorgvorm="") | Q(zorgvorm__iexact=ctx.zorgvorm))
        if ctx.leeftijd is not None:
            qs = qs.filter(Q(doelgroep_leeftijd_van__isnull=True) | Q(doelgroep_leeftijd_van__lte=ctx.leeftijd)).filter(
                Q(doelgroep_leeftijd_tot__isnull=True) | Q(doelgroep_leeftijd_tot__gte=ctx.leeftijd)
            )
        if ctx.regio:
            qs = qs.filter(Q(regio_codes__icontains=ctx.regio) | Q(regio_codes=""))
        return list(qs[:limit])

    @staticmethod
    def _evaluate_candidate(profiel, ctx, casus):
        zorgaanbieder, vestiging = _profile_owner(profiel)
        capaciteit = _latest_capacity(profiel, vestiging)
        contract = _find_contract(ctx, zorgaanbieder)
        coverage = _find_coverage(ctx, zorgaanbieder, vestiging)

        try:
            prestaties = PrestatieProfiel.objects.get(zorgprofiel=profiel)
        except PrestatieProfiel.DoesNotExist:
            prestaties = None

        try:
            _check_hard_exclusions(profiel, ctx, vestiging, capaciteit, contract, coverage)
        except HardExclusion as exc:
            return MatchResultaat(
                casus=_resolve_case_fk(casus),
                zorgprofiel=profiel,
                zorgaanbieder=zorgaanbieder,
                totaalscore=0.0,
                uitgesloten=True,
                uitsluitreden=exc.reason,
                fit_samenvatting="Kandidaat uitgesloten op harde criteria",
                trade_offs=[{"factor": "hard_exclusion", "toelichting": exc.reason}],
            )

        inhoud, r_inhoud = _score_inhoudelijke_fit(profiel, ctx)
        regio_contract, r_regio, regio_bonus = _score_regio_contract_fit(ctx, contract, coverage)
        capaciteit_fit, r_cap, cap_adjustment = _score_capaciteit_wachttijd_fit(capaciteit, ctx, coverage)
        complex_veilig, r_complex = _score_complexiteit_veiligheid_fit(profiel, ctx)
        performance, r_perf = _score_performance_fit(prestaties)

        base_total = inhoud + regio_contract + capaciteit_fit + complex_veilig + performance
        total = max(0.0, min(100.0, base_total + regio_bonus + cap_adjustment))

        trade_offs = []
        if cap_adjustment < 0:
            trade_offs.append({"factor": "capaciteit_wachttijd", "toelichting": "Penalties toegepast op capaciteit/wachttijd"})
        if regio_bonus < 0:
            trade_offs.append({"factor": "regio_dekking", "toelichting": "Secundaire dekking of beperkte regionale fit"})

        reasons = r_inhoud + r_regio + r_cap + r_complex + r_perf
        fit_samenvatting = "; ".join(reasons[:6]) if reasons else "Beperkte onderbouwing"

        verify_parts = []
        if capaciteit is None or cap_adjustment < 0:
            verify_parts.append("Verifieer actuele capaciteit")
        if contract is None:
            verify_parts.append("Bevestig contracteerbaarheid")
        if coverage is None:
            verify_parts.append("Controleer regionale dekking")

        return MatchResultaat(
            casus=_resolve_case_fk(casus),
            zorgprofiel=profiel,
            zorgaanbieder=zorgaanbieder,
            totaalscore=round(total, 2),
            score_inhoudelijke_fit=round(inhoud, 2),
            score_capaciteit=round(capaciteit_fit, 2),
            score_contract_regio=round(regio_contract, 2),
            score_complexiteit=round(complex_veilig, 2),
            score_performance=round(performance, 2),
            score_regio_contract_fit=round(regio_contract, 2),
            score_capaciteit_wachttijd_fit=round(capaciteit_fit, 2),
            score_complexiteit_veiligheid_fit=round(complex_veilig, 2),
            score_performance_fit=round(performance, 2),
            confidence_label=_confidence_label(total, capaciteit, prestaties),
            fit_samenvatting=fit_samenvatting,
            trade_offs=trade_offs,
            verificatie_advies="; ".join(verify_parts),
            uitgesloten=False,
            uitsluitreden="",
        )
