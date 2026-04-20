"""
contracts/intelligence_pilot_rollout.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Pilot rollout and adoption package for the Zorg OS V3 decision operating system.

Builds on the existing intelligence / governance / playbook architecture and
turns it into a practical, structured rollout guide for staff, org owners,
municipalities, and providers.

Everything is **read-only and advisory**.  Nothing in this module writes to
the database or modifies any proposal or case.

Public API
----------
pilot_scope()                       -> dict   roles, orgs, categories, municipalities
daily_operating_routines()          -> dict   per-role structured daily/weekly schedule
first_30_days_rhythm()              -> list   ordered day/week milestones with owners
kpi_baseline(proposals)             -> dict   computed live KPI snapshot from proposals
success_measures()                  -> list   static target thresholds + measurement method
escalation_scenarios()              -> list   concrete decision scenarios with outcomes
reviewer_onboarding_checklist()     -> list   step-by-step onboarding for new reviewers
stakeholder_communication_summaries() -> dict provider + municipality talking points
feedback_capture_guidance()         -> dict   structured in-app feedback recommendations
rollout_readiness(proposals)        -> dict   readiness score + action items
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Re-use thresholds from the playbook module to keep them consistent
# ---------------------------------------------------------------------------
from .intelligence_tuning_playbook import (
    IMPLEMENTATION_EVALUATION_DAYS,
    PRIORITY_REVIEW_THRESHOLD,
    SAMPLE_COUNT_MINIMUM,
    STALE_DAYS_HIGH_RISK,
    STALE_DAYS_LOW_RISK,
    SUCCESS_DELTA_THRESHOLD,
    escalation_required,
    playbook_summary,
    success_criteria_met,
)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _status(proposal) -> str:
    return (getattr(proposal, 'status', '') or '').upper()


def _risk(proposal) -> str:
    return (getattr(proposal, 'risk_level', '') or '').upper()


def _priority(proposal) -> float:
    return float(getattr(proposal, 'priority_score', 0.0) or 0.0)


def _sample_count(proposal) -> int:
    return int(getattr(proposal, 'sample_count', 0) or 0)


def _conf_delta(proposal) -> Optional[float]:
    pi = getattr(proposal, 'post_impact', None)
    if not pi:
        return None
    return pi.get('delta_confidence_observed')


# ---------------------------------------------------------------------------
# 1. Pilot scope
# ---------------------------------------------------------------------------


def pilot_scope() -> Dict[str, Any]:
    """Static description of the recommended pilot scope for V3 rollout.

    Returns a structured dict with:
    - participating_roles       : list of roles involved in the pilot
    - pilot_org_criteria        : criteria for selecting pilot organisations
    - target_care_categories    : care categories to focus on first
    - municipality_scope        : municipality participation scope
    - exclusion_criteria        : what to keep out of the pilot
    - estimated_pilot_duration_days : recommended pilot window in calendar days
    """
    return {
        'participating_roles': [
            {
                'role': 'Regisseur (Reviewer)',
                'count_range': '1–3 per pilotorganisatie',
                'commitment': 'Ca. 30 min per week voor beoordeling van tuningvoorstellen',
            },
            {
                'role': 'Orgverantwoordelijke (Approver)',
                'count_range': '1 per pilotorganisatie',
                'commitment': 'Ca. 1 uur per maand voor goedkeuring en meta-analyse review',
            },
            {
                'role': 'Inkoper / Contractbeheerder (Observer)',
                'count_range': '1–2 per pilotorganisatie',
                'commitment': 'Lees-alleen toegang; levert feedback via reguliere kanalen',
            },
            {
                'role': 'Implementatiebegeleider (Careon)',
                'count_range': '1 centraal',
                'commitment': 'Wekelijkse check-in met pilotorganisaties; monitort escalatiesignalen',
            },
        ],
        'pilot_org_criteria': [
            'Minimaal 20 actieve casussen in de afgelopen 90 dagen',
            'Minimaal 1 volledig geconfigureerde zorgcategorie in het systeem',
            'Aangewezen orgverantwoordelijke met beslissingsbevoegdheid',
            'Bereidheid om wekelijks een beoordelingsronde uit te voeren gedurende 30 dagen',
        ],
        'target_care_categories': [
            'Begeleiding individueel (meest voorkomend — goede baseline)',
            'Dagbesteding (voldoende volume voor kalibratiemeting)',
        ],
        'municipality_scope': (
            'Maximaal 2 gemeenten per pilotorganisatie in de eerste 30 dagen. '
            'Uitbreiding naar regio na eerste evaluatiemoment (dag 30).'
        ),
        'exclusion_criteria': [
            'Aanbieders met minder dan 5 afgeronde plaatsingen in het systeem',
            'Zorgcategorieën zonder historische acceptatiedata',
            'Casussen in actieve rechtszaak of bezwaarprocedure',
        ],
        'estimated_pilot_duration_days': 30,
    }


# ---------------------------------------------------------------------------
# 2. Daily operating routines
# ---------------------------------------------------------------------------


def daily_operating_routines() -> Dict[str, Any]:
    """Per-role structured daily and weekly operating schedule for the pilot.

    Returns a dict keyed by role with 'daily' and 'weekly' task lists.
    """
    return {
        'reviewer': {
            'label': 'Regisseur (Reviewer)',
            'daily': [
                'Controleer de SUGGESTED-wachtrij op nieuwe voorstellen (verwacht: 0–3 per dag).',
                f'Bevestig dat geen voorstel de {STALE_DAYS_HIGH_RISK}-dagentermijn (HOOG risico) nadert.',
                'Signaleer escalatiewaarschuwingen via het Werkafspraken-scherm.',
            ],
            'weekly': [
                'Doorloop alle SUGGESTED en REVIEWED voorstellen en zet ze door of wijs ze af.',
                'Controleer de "Acties voor vandaag"-samenvatting op archiefkandidaten.',
                f'Bespreek eventuele voorstellen met prioriteitsscore ≥ {PRIORITY_REVIEW_THRESHOLD} met de orgverantwoordelijke.',
                'Noteer feedback over voorstelkwaliteit voor de tweewekelijkse check-in.',
            ],
        },
        'approver': {
            'label': 'Orgverantwoordelijke (Approver)',
            'daily': [
                'Controleer escalatiesignalen (automatisch geflagd in het Werkafspraken-overzicht).',
            ],
            'weekly': [
                'Goedkeuren of afwijzen van alle REVIEWED voorstellen.',
                f'Beoordeel geïmplementeerde voorstellen die ouder zijn dan {IMPLEMENTATION_EVALUATION_DAYS} dagen op post-impact.',
                'Doorloop de meta-governance-analyse op negatieve of stagnerende patronen.',
                'Bevestig dat de beoordelingscyclus binnen de afgesproken termijnen verloopt.',
            ],
        },
        'observer': {
            'label': 'Toeschouwer (Observer)',
            'daily': [],
            'weekly': [
                'Bekijk de Regiekamer voor actieve alertes en kalibratiestatus.',
                'Lees het intelligence-observability-rapport voor inzicht in matchingskwaliteit.',
                'Deel eventuele vragen of bevindingen schriftelijk met de Regisseur.',
            ],
        },
        'implementation_guide': {
            'label': 'Implementatiebegeleider (Careon)',
            'daily': [],
            'weekly': [
                'Controleer of pilotorganisaties geen overschreden termijnen hebben.',
                'Analyseer de kpi_baseline() op week-over-week trends.',
                'Faciliteer de tweewekelijkse check-in sessie (30 min).',
                'Registreer feedbackpunten en zet verbeteracties door.',
            ],
        },
    }


# ---------------------------------------------------------------------------
# 3. First 30 days rhythm
# ---------------------------------------------------------------------------


def first_30_days_rhythm() -> List[Dict[str, Any]]:
    """Ordered milestone list for the first 30 days of the pilot.

    Returns a list of milestone dicts with:
    - day_range   : str  (e.g. "Dag 1–3")
    - milestone   : str
    - owner       : str
    - actions     : list[str]
    - success_signal : str   what 'done' looks like
    """
    return [
        {
            'day_range': 'Dag 1–3',
            'milestone': 'Kickoff & configuratiecheck',
            'owner': 'Implementatiebegeleider + Orgverantwoordelijke',
            'actions': [
                'Bevestig toegang voor alle pilotgebruikers (Regisseur, Orgverantwoordelijke, Observer).',
                'Valideer dat de pilotorganisatie en zorgcategorieën correct zijn geconfigureerd.',
                'Loop samen door het Werkafspraken-scherm en de beleidsdrempelwaarden.',
                'Stel een gedeelde communicatiekalender in (wekelijkse check-in moment).',
            ],
            'success_signal': 'Alle gebruikers kunnen inloggen en de Regiekamer bekijken zonder fouten.',
        },
        {
            'day_range': 'Dag 4–7',
            'milestone': 'Eerste beoordelingsronde',
            'owner': 'Regisseur',
            'actions': [
                'Voer de eerste handmatige review van SUGGESTED voorstellen uit.',
                'Zet minimaal één voorstel door naar REVIEWED of wijs er één af.',
                'Noteer hoe lang de beoordeling duurde en wat onduidelijk was.',
                'Bespreek eerste bevindingen met Implementatiebegeleider.',
            ],
            'success_signal': f'Wachtrij bevat geen verlopen HOOG-risico voorstellen (>{STALE_DAYS_HIGH_RISK} dagen).',
        },
        {
            'day_range': 'Dag 8–14',
            'milestone': 'Eerste goedkeurings- of afwijzingsbeslissing',
            'owner': 'Orgverantwoordelijke',
            'actions': [
                'Beoordeel de REVIEWED-wachtrij en keur minimaal één voorstel goed of wijs het af.',
                'Controleer of de escalatieregels correct worden gesignaleerd.',
                'Leg de beslissingsredenering vast (handmatig in opmerkingen of via bestaand veld).',
            ],
            'success_signal': 'Eerste APPROVED of REJECTED status is zichtbaar in het systeem.',
        },
        {
            'day_range': 'Dag 15–21',
            'milestone': 'Eerste implementatie + baseline KPI-meting',
            'owner': 'Orgverantwoordelijke + Implementatiebegeleider',
            'actions': [
                'Zet het eerste APPROVED voorstel door naar IMPLEMENTED.',
                'Voer een kpi_baseline()-meting uit en sla de waarden op als referentie.',
                'Bespreek of de prioriteitsscores en risico-inschattingen kloppen met de praktijkervaring.',
            ],
            'success_signal': f'kpi_baseline() geeft een meting met ≥ {SAMPLE_COUNT_MINIMUM} voorstellen als input.',
        },
        {
            'day_range': 'Dag 22–28',
            'milestone': 'Mid-pilot evaluatie',
            'owner': 'Implementatiebegeleider + alle rollen',
            'actions': [
                'Houd de tweewekelijkse check-in met alle pilotgebruikers.',
                'Vergelijk de actuele kpi_baseline() met dag-15-referentie.',
                'Bespreek alle archiefkandidaten en duplicaatsignalen.',
                'Verzamel gestructureerde feedback (zie feedback_capture_guidance()).',
            ],
            'success_signal': 'Feedbackformulier is ingevuld door minimaal Regisseur en Orgverantwoordelijke.',
        },
        {
            'day_range': 'Dag 29–30',
            'milestone': 'Pilot-afsluiting & go/no-go beslissing',
            'owner': 'Orgverantwoordelijke + Implementatiebegeleider',
            'actions': [
                'Voer de eindmeting van kpi_baseline() uit.',
                'Vergelijk met de succescriteria in success_measures().',
                'Beslis op basis van rollout_readiness()-score over uitrol naar meer categorieën of gemeenten.',
                'Stel een actieplan op voor eventuele drempelaanpassingen.',
            ],
            'success_signal': 'rollout_readiness()-score is ≥ 0.70 of er is een gedocumenteerd verbeterplan.',
        },
    ]


# ---------------------------------------------------------------------------
# 4. KPI baseline
# ---------------------------------------------------------------------------


def kpi_baseline(proposals: List[Any]) -> Dict[str, Any]:
    """Compute a live KPI snapshot from the current proposal set.

    Derived entirely from existing proposal fields — no DB writes.

    Returns:
    {
        total_proposals         : int
        pending_review          : int   SUGGESTED + REVIEWED
        approval_rate           : float | None   approved / (approved + rejected)
        implementation_rate     : float | None   implemented / approved
        high_risk_share         : float | None   HIGH / total
        success_rate            : float | None   successful implementations / total implemented
        avg_priority_score      : float | None
        sparse_data_share       : float | None   proposals below SAMPLE_COUNT_MINIMUM / total
        overdue_share           : float | None   overdue / (SUGGESTED + REVIEWED)
        escalation_rate         : float | None   escalated / total non-terminal
        data_quality_flag       : str   'OK' | 'LOW' | 'INSUFFICIENT'
        notes                   : list[str]
    }
    """
    total = len(proposals)
    if total == 0:
        return {
            'total_proposals': 0,
            'pending_review': 0,
            'approval_rate': None,
            'implementation_rate': None,
            'high_risk_share': None,
            'success_rate': None,
            'avg_priority_score': None,
            'sparse_data_share': None,
            'overdue_share': None,
            'escalation_rate': None,
            'data_quality_flag': 'INSUFFICIENT',
            'notes': ['Geen voorstellen beschikbaar — KPI-meting niet mogelijk.'],
        }

    pending = [p for p in proposals if _status(p) in ('SUGGESTED', 'REVIEWED')]
    approved = [p for p in proposals if _status(p) == 'APPROVED']
    rejected = [p for p in proposals if _status(p) == 'REJECTED']
    implemented = [p for p in proposals if _status(p) == 'IMPLEMENTED']
    high_risk = [p for p in proposals if _risk(p) == 'HIGH']
    sparse = [p for p in proposals if _sample_count(p) < SAMPLE_COUNT_MINIMUM]

    decided = len(approved) + len(rejected)
    approval_rate = len(approved) / decided if decided > 0 else None

    impl_rate = len(implemented) / len(approved) if approved else None

    successful = [p for p in implemented if success_criteria_met(p).get('met', False)]
    success_rate = len(successful) / len(implemented) if implemented else None

    high_risk_share = len(high_risk) / total

    priorities = [_priority(p) for p in proposals if _priority(p) > 0]
    avg_priority = sum(priorities) / len(priorities) if priorities else None

    sparse_share = len(sparse) / total

    # Overdue share (requires playbook_summary for actual cadence check)
    summary = playbook_summary(proposals)
    overdue_count = len(summary['overdue_review'])
    overdue_share = overdue_count / len(pending) if pending else None

    # Escalation rate across non-terminal proposals
    non_terminal = [p for p in proposals if _status(p) not in ('REJECTED',)]
    escalated = len(summary['needs_escalation'])
    escalation_rate = escalated / len(non_terminal) if non_terminal else None

    notes = []
    if total < 5:
        notes.append(f'Steekproef klein ({total}). KPI-waarden zijn indicatief.')
    if sparse_share and sparse_share > 0.5:
        notes.append('Meer dan de helft van de voorstellen heeft onvoldoende steekproefdata.')
    if overdue_share and overdue_share > 0.3:
        notes.append('Meer dan 30% van de actieve voorstellen zijn verlopen — beoordelingscyclus versnellen.')
    if approval_rate is not None and approval_rate < 0.5:
        notes.append('Goedkeuringspercentage onder 50% — controleer of kalibratie-input van voldoende kwaliteit is.')

    flag = 'OK'
    if total < SAMPLE_COUNT_MINIMUM:
        flag = 'INSUFFICIENT'
    elif sparse_share and sparse_share > 0.5:
        flag = 'LOW'

    return {
        'total_proposals': total,
        'pending_review': len(pending),
        'approval_rate': round(approval_rate, 4) if approval_rate is not None else None,
        'implementation_rate': round(impl_rate, 4) if impl_rate is not None else None,
        'high_risk_share': round(high_risk_share, 4),
        'success_rate': round(success_rate, 4) if success_rate is not None else None,
        'avg_priority_score': round(avg_priority, 4) if avg_priority is not None else None,
        'sparse_data_share': round(sparse_share, 4),
        'overdue_share': round(overdue_share, 4) if overdue_share is not None else None,
        'escalation_rate': round(escalation_rate, 4) if escalation_rate is not None else None,
        'data_quality_flag': flag,
        'notes': notes,
    }


# ---------------------------------------------------------------------------
# 5. Success measures (static)
# ---------------------------------------------------------------------------


def success_measures() -> List[Dict[str, Any]]:
    """Static list of KPI targets and measurement methods for the pilot.

    Returns a list of measure dicts:
    {
        kpi             : str   the measure name (matches kpi_baseline key)
        target          : str   human-readable target
        target_value    : float | None   machine-comparable threshold
        measurement     : str   how it is measured
        frequency       : str   how often
    }
    """
    return [
        {
            'kpi': 'approval_rate',
            'label': 'Goedkeuringspercentage',
            'target': '≥ 60%',
            'target_value': 0.60,
            'measurement': 'Goedgekeurde / (Goedgekeurde + Afgewezen) voorstellen',
            'frequency': 'Wekelijks',
        },
        {
            'kpi': 'implementation_rate',
            'label': 'Implementatiegraad',
            'target': '≥ 70% van goedgekeurde voorstellen',
            'target_value': 0.70,
            'measurement': 'Geïmplementeerde / Goedgekeurde voorstellen',
            'frequency': 'Tweewekelijks',
        },
        {
            'kpi': 'success_rate',
            'label': 'Effectiviteitspercentage',
            'target': f'≥ 50% van implementaties met Δconf > +{SUCCESS_DELTA_THRESHOLD}',
            'target_value': 0.50,
            'measurement': 'success_criteria_met() — positive Δconf + voldoende steekproef',
            'frequency': 'Maandelijks (na evaluatievenster)',
        },
        {
            'kpi': 'overdue_share',
            'label': 'Aandeel verlopen beoordelingen',
            'target': '< 20% van actieve voorstellen',
            'target_value': 0.20,
            'measurement': 'Verlopen cadans per voorstel (playbook_summary())',
            'frequency': 'Wekelijks',
        },
        {
            'kpi': 'high_risk_share',
            'label': 'Aandeel hoogrisico-voorstellen',
            'target': '< 25% van totale voorstellen',
            'target_value': 0.25,
            'measurement': 'risk_level == HIGH / totaal',
            'frequency': 'Wekelijks',
        },
        {
            'kpi': 'sparse_data_share',
            'label': 'Aandeel onderbouwde voorstellen (onvoldoende data)',
            'target': f'< 30% van voorstellen met sample_count < {SAMPLE_COUNT_MINIMUM}',
            'target_value': 0.30,
            'measurement': f'sample_count < {SAMPLE_COUNT_MINIMUM} / totaal',
            'frequency': 'Maandelijks',
        },
        {
            'kpi': 'escalation_rate',
            'label': 'Escalatiefrequentie',
            'target': '< 15% van actieve voorstellen',
            'target_value': 0.15,
            'measurement': 'escalation_required() / niet-terminale voorstellen',
            'frequency': 'Wekelijks',
        },
    ]


# ---------------------------------------------------------------------------
# 6. Escalation scenarios (concrete examples)
# ---------------------------------------------------------------------------


def escalation_scenarios() -> List[Dict[str, Any]]:
    """Concrete decision scenarios to guide reviewers during the pilot.

    Each scenario includes:
    - id        : str
    - title     : str
    - context   : str   what the regisseur sees
    - signals   : list[str]   observable flags
    - recommended_action : str
    - outcome   : str   what success looks like
    - role      : str   who acts
    """
    return [
        {
            'id': 'esc_01',
            'title': 'Hoog-risico voorstel met lage steekproef',
            'context': (
                'Een kalibratiediagnose genereert een voorstel met risk_level=HIGH en '
                f'sample_count < {SAMPLE_COUNT_MINIMUM}. Het voorstel is {STALE_DAYS_HIGH_RISK - 1} '
                'dagen oud en nadert de escalatietermijn.'
            ),
            'signals': [
                'escalation_required() → required=True, reden: HOOG risico + lage steekproef',
                f'review_cadence_for_proposal() → cadence_days={STALE_DAYS_HIGH_RISK}',
            ],
            'recommended_action': (
                'Regisseur meldt aan Orgverantwoordelijke. Orgverantwoordelijke besluit: '
                '(a) wacht op meer data en laat het voorstel als SUGGESTED staan, of '
                '(b) wijst het voorstel af met notitie "onvoldoende bewijs".'
            ),
            'outcome': 'Voorstel krijgt status REJECTED of wachtstatus met expliciete deadline voor heroverweging.',
            'role': 'Regisseur → Orgverantwoordelijke',
        },
        {
            'id': 'esc_02',
            'title': 'Verlopen voorstel zonder actie',
            'context': (
                f'Een SUGGESTED voorstel met risk_level=LOW is {STALE_DAYS_LOW_RISK + 10} '
                'dagen oud en is nooit beoordeeld.'
            ),
            'signals': [
                'archive_recommendation() → trigger="stale"',
                f'playbook_summary() → overdue_review bevat dit voorstel',
            ],
            'recommended_action': (
                'Regisseur beoordeelt het voorstel alsnog: '
                '(a) zet het door naar REVIEWED als het nog relevant is, of '
                '(b) wijs het af als de situatie is veranderd.'
            ),
            'outcome': 'Voorstel is niet langer in de overdue_review-lijst.',
            'role': 'Regisseur',
        },
        {
            'id': 'esc_03',
            'title': 'Geïmplementeerd voorstel met negatief effect',
            'context': (
                'Een IMPLEMENTED voorstel heeft na het evaluatievenster '
                f'(≥ {IMPLEMENTATION_EVALUATION_DAYS} dagen) een '
                'delta_confidence_observed van -0.03.'
            ),
            'signals': [
                'success_criteria_met() → met=False, Δconf negatief',
                'archive_recommendation() → trigger="ineffective"',
            ],
            'recommended_action': (
                'Orgverantwoordelijke bespreekt met Implementatiebegeleider of het effect '
                'statistisch significant is. Zo ja: overweeg terugdraaiing (nieuwe tegenaanpassing) '
                'of archivering van dit factortype voor de betreffende zorgcategorie.'
            ),
            'outcome': 'Beslissing gedocumenteerd; factortype staat op observatielijst voor volgende calibratieronde.',
            'role': 'Orgverantwoordelijke + Implementatiebegeleider',
        },
        {
            'id': 'esc_04',
            'title': 'Extreme prioriteitsscore, actie vereist',
            'context': (
                'Een nieuw voorstel heeft priority_score=0.92 (boven de 0.85-drempel) '
                'en risk_level=LOW. Het is vandaag gegenereerd.'
            ),
            'signals': [
                'escalation_required() → required=True, reden: extreme prioriteit',
                'should_review_proposal() → review=True',
            ],
            'recommended_action': (
                'Regisseur brengt dit voorstel dezelfde dag onder de aandacht van de Orgverantwoordelijke. '
                'Samen beoordelen zij of de kalibratie-afwijking urgent ingegrepen vereist.'
            ),
            'outcome': 'Voorstel beoordeeld binnen 24 uur na aanmelding.',
            'role': 'Regisseur → Orgverantwoordelijke (dezelfde dag)',
        },
        {
            'id': 'esc_05',
            'title': 'Duplicaat-groepssleutel gedetecteerd',
            'context': (
                'Twee SUGGESTED voorstellen hebben dezelfde group_key. '
                'archive_recommendation() markeert één ervan als group_duplicate.'
            ),
            'signals': [
                'archive_recommendation() → trigger="group_duplicate" op beide voorstellen',
            ],
            'recommended_action': (
                'Regisseur vergelijkt de twee voorstellen op prioriteit en steekproefomvang. '
                'Behoudt het voorstel met de hoogste priority_score en de meeste samples. '
                'Wijst het andere af met reden "dubbeling".'
            ),
            'outcome': 'Slechts één actief voorstel per group_key in de wachtrij.',
            'role': 'Regisseur',
        },
    ]


# ---------------------------------------------------------------------------
# 7. Reviewer onboarding checklist
# ---------------------------------------------------------------------------


def reviewer_onboarding_checklist() -> List[Dict[str, Any]]:
    """Step-by-step onboarding checklist for a new reviewer joining the pilot.

    Returns a list of steps:
    {
        step    : int
        title   : str
        actions : list[str]
        done_when : str
    }
    """
    return [
        {
            'step': 1,
            'title': 'Toegang & eerste inloggen',
            'actions': [
                'Vraag toegang aan via de Orgverantwoordelijke.',
                'Log in en navigeer naar de Regiekamer (menu: Regiekamer).',
                'Controleer dat je de juiste organisatie ziet in het overzicht.',
            ],
            'done_when': 'Je ziet de Regiekamer-dashboardkaarten zonder foutmelding.',
        },
        {
            'step': 2,
            'title': 'Kennismaking met tuningvoorstellen',
            'actions': [
                'Ga naar Regiekamer → Tuningvoorstellen.',
                'Open één voorstel en lees de velden: factor_type, risk_level, priority_score, sample_count.',
                'Bekijk het intelligence-observability-rapport voor achtergrondcontext.',
            ],
            'done_when': 'Je begrijpt wat een tuningvoorstel is en hoe het gegenereerd wordt.',
        },
        {
            'step': 3,
            'title': 'Werkafspraken doorlopen',
            'actions': [
                'Ga naar Regiekamer → Werkafspraken.',
                f'Lees de rolverantwoordelijkheden voor "Regisseur".',
                f'Noteer de beoordelingstermijn voor jouw meest voorkomende risico-niveau ({STALE_DAYS_LOW_RISK} dagen voor LOW, {STALE_DAYS_HIGH_RISK} voor HIGH).',
                'Lees de escalatiescenario\'s in het Pilot Rollout Dashboard.',
            ],
            'done_when': 'Je kunt de drie meest voorkomende escalatietriggers benoemen.',
        },
        {
            'step': 4,
            'title': 'Eerste beoordeling uitvoeren',
            'actions': [
                'Ga naar de SUGGESTED-wachtrij.',
                'Kies het voorstel met de hoogste priority_score.',
                'Controleer: is sample_count voldoende (≥ {})? Is het risico helder?'.format(SAMPLE_COUNT_MINIMUM),
                'Zet het door naar REVIEWED (of wijs het af met een notitie).',
            ],
            'done_when': 'Eerste voorstel heeft status REVIEWED of REJECTED en is uit de SUGGESTED-rij verdwenen.',
        },
        {
            'step': 5,
            'title': 'Escalatiepad kennen',
            'actions': [
                'Bekijk de escalatie-scenario\'s in het Pilot Rollout Dashboard.',
                'Bespreek met je Orgverantwoordelijke hoe je escalaties communiceert (e-mail, chat, of vergadering).',
                'Leg het escalatiepad schriftelijk vast (één zin volstaat).',
            ],
            'done_when': 'Je weet wie je belt/mailt bij een HIGH-risico voorstel met lage steekproef.',
        },
        {
            'step': 6,
            'title': 'Feedbackcyclus begrijpen',
            'actions': [
                'Lees de feedback_capture_guidance() samenvatting in het Pilot Dashboard.',
                'Begrijp hoe jouw beoordelingsbeslissingen de meta-governance-analyse beïnvloeden.',
                'Schrijf na je eerste week een korte terugkoppeling naar de Implementatiebegeleider.',
            ],
            'done_when': 'Je hebt feedback ingeleverd na de eerste volledige beoordelingsweek.',
        },
    ]


# ---------------------------------------------------------------------------
# 8. Stakeholder communication summaries
# ---------------------------------------------------------------------------


def stakeholder_communication_summaries() -> Dict[str, Any]:
    """Talking-point summaries for provider and municipality communication.

    Returns dict with keys 'provider' and 'municipality', each containing:
    - audience      : str
    - summary       : str   one-paragraph explanation of what is changing
    - key_messages  : list[str]
    - what_they_see : list[str]   visible changes in the system
    - what_they_dont_see : list[str]  things deliberately kept out of scope
    - contact       : str   who to reach for questions
    """
    return {
        'provider': {
            'audience': 'Aanbieders (zorgaanbieders die gekoppeld zijn aan de organisatie)',
            'summary': (
                'Careon introduceert een verbeterd kalibratiemechanisme dat de '
                'matchingskwaliteit voor cliënten geleidelijk verbetert. Als aanbieder '
                'merkt u dit doordat uw acceptatiepatronen en capaciteitsgegevens vaker '
                'worden meegewogen in de plaatsingsadviezen. Er verandert niets aan uw '
                'werkwijze of uw contractuele verplichtingen.'
            ),
            'key_messages': [
                'Matchingsadviezen worden stap voor stap verbeterd op basis van historische uitkomsten.',
                'U hoeft geen actie te ondernemen — de aanpassingen zijn intern bij de organisatie.',
                'Als u signalen heeft dat adviezen niet kloppen met de praktijk, kunt u dit doorgeven via uw vaste contactpersoon.',
                'Privacy en gegevensbeveiliging zijn ongewijzigd.',
            ],
            'what_they_see': [
                'Mogelijk iets andere prioritering van plaatsingsverzoeken.',
                'Hogere of lagere matchingsdrempel afhankelijk van recente acceptatiedata.',
            ],
            'what_they_dont_see': [
                'Interne tuningvoorstellen of governance-beslissingen.',
                'Kalibratiescores of prioriteitswaarden.',
            ],
            'contact': 'Regisseur of Orgverantwoordelijke van de pilotorganisatie.',
        },
        'municipality': {
            'audience': 'Gemeenten die casussen aanleveren of inkopen via de organisatie',
            'summary': (
                'Careon voert een pilot uit waarbij het kalibratie- en matchingssysteem '
                'systematisch wordt verbeterd. Het doel is kortere wachttijden en '
                'betere plaatsingsadviezen voor WMO- en Jeugdwet-casussen. '
                'Gemeenten hoeven gedurende de pilot niets anders te doen dan gewoonlijk.'
            ),
            'key_messages': [
                'De pilot loopt 30 dagen en is beperkt tot geselecteerde zorgcategorieën.',
                'Er worden geen nieuwe gegevensverwerkingen geïntroduceerd.',
                'Gemeenten ontvangen na de pilot een beknopt evaluatierapport.',
                'Beslissingen over plaatsing blijven bij de organisatie; het systeem adviseert alleen.',
            ],
            'what_they_see': [
                'Geen zichtbare wijzigingen in het cliëntportaal of reguliere rapportages.',
            ],
            'what_they_dont_see': [
                'Interne kalibratieparameters of tuningbeslissingen.',
                'Persoonlijke gegevens van andere gemeenten of cliënten.',
            ],
            'contact': 'Implementatiebegeleider van Careon of de accountmanager van de organisatie.',
        },
    }


# ---------------------------------------------------------------------------
# 9. Feedback capture guidance
# ---------------------------------------------------------------------------


def feedback_capture_guidance() -> Dict[str, Any]:
    """Structured guidance for capturing feedback during the pilot.

    Returns:
    {
        channels        : list[dict]   feedback channel descriptions
        questions       : list[str]   structured questions to ask weekly
        escalation_flag : str   when feedback should trigger escalation
        storage_advice  : str   where and how to store feedback
    }
    """
    return {
        'channels': [
            {
                'name': 'Wekelijkse check-in (30 min)',
                'format': 'Gestructureerd gesprek, geleid door Implementatiebegeleider',
                'participants': 'Regisseur + Orgverantwoordelijke',
                'cadence': 'Elke week gedurende de pilot (dag 7, 14, 21, 28)',
            },
            {
                'name': 'Inline voorstel-annotatie',
                'format': 'Vrij tekstveld bij REVIEWED/REJECTED statusovergang',
                'participants': 'Regisseur of Orgverantwoordelijke',
                'cadence': 'Bij iedere statuswijziging',
            },
            {
                'name': 'Eindevaluatieformulier (dag 30)',
                'format': 'Kort digitaal formulier (5–10 vragen, maximaal 10 minuten)',
                'participants': 'Alle pilotgebruikers',
                'cadence': 'Éénmalig op dag 29–30',
            },
        ],
        'questions': [
            'Hoeveel tuningvoorstellen heb je deze week beoordeeld? Was het volume beheersbaar?',
            'Welk voorstel kostte het meeste tijd om te beoordelen — en waarom?',
            'Waren de escalatiesignalen correct? Zo niet, welk voorstel had je anders ingeschat?',
            'Is er een situatie geweest waarbij de drempelwaarden niet klopten met de praktijk?',
            'Hoe beoordeel je de kwaliteit van de post-impact-data na implementatie (1–5)?',
            'Welk onderdeel van het systeem heeft de meeste uitleg nodig voor nieuwe gebruikers?',
        ],
        'escalation_flag': (
            'Feedback wordt als escalatie behandeld wanneer een reviewer aangeeft dat '
            'een voorstel met risk_level=HIGH onterecht niet als zodanig werd gesignaleerd, '
            'of wanneer een geïmplementeerd voorstel aantoonbaar negatieve gevolgen heeft '
            'voor een cliënt of aanbieder.'
        ),
        'storage_advice': (
            'Sla feedbacknotities op in het gedeelde notitiedocument van het pilotteam. '
            'Voeg structurele patronen toe als werkpunt in het actielogboek. '
            'Deel geanonimiseerde bevindingen met de Careon-productontwikkelaar '
            'voor de kwartaalreview.'
        ),
    }


# ---------------------------------------------------------------------------
# 10. Rollout readiness
# ---------------------------------------------------------------------------

# Readiness score weights (must sum to 1.0)
_READINESS_WEIGHTS = {
    'approval_rate': 0.20,
    'implementation_rate': 0.15,
    'success_rate': 0.20,
    'overdue_share': 0.20,       # inverted: lower overdue → better
    'escalation_rate': 0.10,     # inverted: lower escalation → better
    'sparse_data_share': 0.15,   # inverted: lower sparse → better
}

# Readiness tier thresholds
READINESS_READY = 0.70
READINESS_CAUTION = 0.50


def rollout_readiness(proposals: List[Any]) -> Dict[str, Any]:
    """Compute an aggregated readiness score for expanding the pilot.

    Score is 0.0–1.0 where 1.0 = fully ready.

    Returns:
    {
        score           : float   0.0–1.0
        tier            : str     'READY' | 'CAUTION' | 'NOT_READY'
        tier_label      : str     Dutch label
        kpi             : dict    the full kpi_baseline() output
        component_scores: dict    per-KPI contribution to score
        action_items    : list[str]  items that reduce readiness
        recommendation  : str     human-readable advisory
    }
    """
    kpi = kpi_baseline(proposals)
    targets = {m['kpi']: m['target_value'] for m in success_measures() if m['target_value'] is not None}

    component_scores: Dict[str, float] = {}
    action_items: List[str] = []

    # approval_rate: higher is better
    ar = kpi.get('approval_rate')
    t_ar = targets.get('approval_rate', 0.60)
    if ar is None:
        component_scores['approval_rate'] = 0.0
        action_items.append('Nog geen goedkeurings-/afwijzingsbeslissingen beschikbaar — voer eerste review uit.')
    else:
        component_scores['approval_rate'] = min(ar / t_ar, 1.0)
        if ar < t_ar:
            action_items.append(f'Goedkeuringspercentage ({ar:.0%}) onder target ({t_ar:.0%}).')

    # implementation_rate: higher is better
    ir = kpi.get('implementation_rate')
    t_ir = targets.get('implementation_rate', 0.70)
    if ir is None:
        component_scores['implementation_rate'] = 0.0
        action_items.append('Nog geen geïmplementeerde voorstellen — zet eerste goedgekeurd voorstel door.')
    else:
        component_scores['implementation_rate'] = min(ir / t_ir, 1.0)
        if ir < t_ir:
            action_items.append(f'Implementatiegraad ({ir:.0%}) onder target ({t_ir:.0%}).')

    # success_rate: higher is better
    sr = kpi.get('success_rate')
    t_sr = targets.get('success_rate', 0.50)
    if sr is None:
        component_scores['success_rate'] = 0.0
        action_items.append(
            f'Geen succesmetingen beschikbaar — wacht ≥ {IMPLEMENTATION_EVALUATION_DAYS} dagen na implementatie.'
        )
    else:
        component_scores['success_rate'] = min(sr / t_sr, 1.0)
        if sr < t_sr:
            action_items.append(f'Effectiviteitspercentage ({sr:.0%}) onder target ({t_sr:.0%}).')

    # overdue_share: lower is better (invert)
    os_ = kpi.get('overdue_share')
    t_os = targets.get('overdue_share', 0.20)
    if os_ is None:
        component_scores['overdue_share'] = 1.0  # no pending → no overdue (neutral/perfect)
    else:
        # 0 overdue = 1.0; at target = 0.5; above target approaches 0
        component_scores['overdue_share'] = max(0.0, 1.0 - (os_ / (t_os * 2)))
        if os_ > t_os:
            action_items.append(f'Vervallen beoordelingen ({os_:.0%}) boven target ({t_os:.0%}) — beoordelen versnellen.')

    # escalation_rate: lower is better (invert)
    er = kpi.get('escalation_rate')
    t_er = targets.get('escalation_rate', 0.15)
    if er is None:
        component_scores['escalation_rate'] = 1.0
    else:
        component_scores['escalation_rate'] = max(0.0, 1.0 - (er / (t_er * 2)))
        if er > t_er:
            action_items.append(f'Escalatiefrequentie ({er:.0%}) boven target ({t_er:.0%}).')

    # sparse_data_share: lower is better (invert)
    sds = kpi.get('sparse_data_share')
    t_sds = targets.get('sparse_data_share', 0.30)
    if sds is None:
        component_scores['sparse_data_share'] = 1.0
    else:
        component_scores['sparse_data_share'] = max(0.0, 1.0 - (sds / (t_sds * 2)))
        if sds > t_sds:
            action_items.append(f'Te veel voorstellen met schaarse data ({sds:.0%}) — meer casusvolume nodig.')

    # Weighted score
    score = sum(component_scores[k] * _READINESS_WEIGHTS[k] for k in _READINESS_WEIGHTS)
    score = round(min(max(score, 0.0), 1.0), 4)

    if score >= READINESS_READY:
        tier = 'READY'
        tier_label = 'Klaar voor uitrol'
        recommendation = (
            'De pilotorganisatie voldoet aan de meeste succescriteria. '
            'Uitbreiding naar extra zorgcategorieën of gemeenten is aanbevolen.'
        )
    elif score >= READINESS_CAUTION:
        tier = 'CAUTION'
        tier_label = 'Voorzichtig uitbreiden'
        recommendation = (
            'De pilotorganisatie bevindt zich in de "aanloopfase". '
            'Los de openstaande actiepunten op voordat je uitbreidt.'
        )
    else:
        tier = 'NOT_READY'
        tier_label = 'Nog niet klaar'
        recommendation = (
            'De pilotorganisatie voldoet nog niet aan de minimale succescriteria. '
            'Verbeter de beoordelingscyclus en datakwaliteit voordat je uitbreidt.'
        )

    return {
        'score': score,
        'tier': tier,
        'tier_label': tier_label,
        'kpi': kpi,
        'component_scores': component_scores,
        'action_items': action_items,
        'recommendation': recommendation,
    }
