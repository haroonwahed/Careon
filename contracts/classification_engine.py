"""
Classification Engine — CareOn
Berekent een adviserend voorstel voor complexiteit en zorgintensiteit op basis van feitelijke casusgegevens.
Het voorstel is altijd adviserend; een bevoegde professional bevestigt of wijzigt het.
Regels zijn transparant en per criterium zichtbaar in de onderbouwing.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from contracts.models import CaseIntakeProcess

# ── Configureerbare drempels ──────────────────────────────────────────────────

MULTI_PROBLEM_THRESHOLD = 2        # >= x problematiektypes → meervoudig
HIGH_COMPLEX_PROBLEM_THRESHOLD = 4 # >= x problematiektypes → hoogcomplex

HIGH_INTENSITY_CARE_FORMS = frozenset({
    "RESIDENTIAL",
    "CRISIS",
    "VOLUNTARY_OUT_OF_HOME",
    "CONTINUATION_PATHWAY",
})

LIGHT_INTENSITY_CARE_FORMS = frozenset({
    "LOW_THRESHOLD_CONSULT",
})


@dataclass
class ClassificationCriterion:
    label: str
    value: str
    signal: str       # 'neutraal' | 'verhogend'
    toelichting: str


@dataclass
class ClassificationProposal:
    proposed_complexity: str       # ENKELVOUDIG | MEERVOUDIG | HOOGCOMPLEX
    proposed_care_intensity: str   # LICHT | REGULIER | INTENSIEF
    criteria: list = field(default_factory=list)
    explanation: str = ''


def compute_classification(intake) -> ClassificationProposal:  # noqa: C901
    """
    Berekent een adviserend voorstel op basis van feitelijke casusgegevens.
    Elk criterium wordt afzonderlijk gerapporteerd.
    """
    criteria = []
    complexity_score = 0   # 0=enkelvoudig, 1=meervoudig, 2=hoogcomplex
    intensity_score = 0    # 0=licht, 1=regulier, 2=intensief

    # 1. Problematiektypes / leefgebieden
    problematiek = intake.problematiek_types or []
    n = len(problematiek) if isinstance(problematiek, list) else 0
    if n >= HIGH_COMPLEX_PROBLEM_THRESHOLD:
        complexity_score = max(complexity_score, 2)
        criteria.append(ClassificationCriterion(
            label='Problematiektypes',
            value=str(n),
            signal='verhogend',
            toelichting=f'{n} problematiektypes duiden op hoogcomplexe meervoudige problematiek.',
        ))
    elif n >= MULTI_PROBLEM_THRESHOLD:
        complexity_score = max(complexity_score, 1)
        criteria.append(ClassificationCriterion(
            label='Problematiektypes',
            value=str(n),
            signal='verhogend',
            toelichting=f'{n} problematiektypes duiden op meervoudige problematiek.',
        ))
    else:
        criteria.append(ClassificationCriterion(
            label='Problematiektypes',
            value=str(n) if n else 'niet gespecificeerd',
            signal='neutraal',
            toelichting='Enkelvoudige of beperkte problematiek aangetroffen.',
        ))

    # 2. Andere betrokken hulp / organisaties
    if getattr(intake, 'has_other_support', False):
        complexity_score = max(complexity_score, 1)
        other = (getattr(intake, 'other_support_description', '') or '').strip()
        criteria.append(ClassificationCriterion(
            label='Andere betrokken hulp',
            value='Ja',
            signal='verhogend',
            toelichting='Betrokkenheid van andere organisaties verhoogt coördinatiebehoefte.'
            + (f' ({other[:60]})' if other else ''),
        ))
    else:
        criteria.append(ClassificationCriterion(
            label='Andere betrokken hulp',
            value='Nee',
            signal='neutraal',
            toelichting='Geen andere hulpverlening betrokken.',
        ))

    # 3. Veiligheidssignalen
    if getattr(intake, 'safety_pressure', False):
        complexity_score = max(complexity_score, 1)
        intensity_score = max(intensity_score, 2)
        criteria.append(ClassificationCriterion(
            label='Veiligheidsdruk',
            value='Ja',
            signal='verhogend',
            toelichting='Veiligheidsdruk aanwezig: verhoogt complexiteit én intensiteitseis.',
        ))

    # 4. Escalatiebehoefte
    if getattr(intake, 'escalation_needed', False):
        complexity_score = max(complexity_score, 2)
        intensity_score = max(intensity_score, 2)
        criteria.append(ClassificationCriterion(
            label='Escalatie benodigd',
            value='Ja',
            signal='verhogend',
            toelichting='Escalatiebehoefte wijst op hoogcomplexe situatie met intensieve begeleiding.',
        ))

    # 5. Urgentie
    urgency = (getattr(intake, 'urgency', '') or '').upper()
    if urgency == 'CRISIS':
        complexity_score = max(complexity_score, 1)
        intensity_score = max(intensity_score, 2)
        criteria.append(ClassificationCriterion(
            label='Urgentie',
            value='Crisis',
            signal='verhogend',
            toelichting='Crisis-urgentie vereist intensieve inzet.',
        ))
    elif urgency == 'HIGH':
        intensity_score = max(intensity_score, 1)
        criteria.append(ClassificationCriterion(
            label='Urgentie',
            value='Hoog',
            signal='verhogend',
            toelichting='Hoge urgentie vraagt reguliere of intensieve zorgcapaciteit.',
        ))
    else:
        urgency_label = {'MEDIUM': 'Normaal', 'LOW': 'Laag'}.get(urgency, urgency or 'niet gespecificeerd')
        criteria.append(ClassificationCriterion(
            label='Urgentie',
            value=urgency_label,
            signal='neutraal',
            toelichting='Urgentie geeft geen verhoogd intensiteitssignaal.',
        ))

    # 6. Gewenste zorgvorm
    zorgvorm = (getattr(intake, 'zorgvorm_gewenst', '') or '').upper()
    if zorgvorm in HIGH_INTENSITY_CARE_FORMS:
        intensity_score = max(intensity_score, 2)
        label_value = intake.get_zorgvorm_gewenst_display() if hasattr(intake, 'get_zorgvorm_gewenst_display') else zorgvorm
        criteria.append(ClassificationCriterion(
            label='Gewenste zorgvorm',
            value=label_value,
            signal='verhogend',
            toelichting='Deze zorgvorm vereist intensieve zorgcapaciteit.',
        ))
    elif zorgvorm in LIGHT_INTENSITY_CARE_FORMS:
        label_value = intake.get_zorgvorm_gewenst_display() if hasattr(intake, 'get_zorgvorm_gewenst_display') else zorgvorm
        criteria.append(ClassificationCriterion(
            label='Gewenste zorgvorm',
            value=label_value,
            signal='neutraal',
            toelichting='Laagdrempelige zorgvorm; lichte intensiteit kan volstaan.',
        ))
    elif zorgvorm:
        intensity_score = max(intensity_score, 1)
        label_value = intake.get_zorgvorm_gewenst_display() if hasattr(intake, 'get_zorgvorm_gewenst_display') else zorgvorm
        criteria.append(ClassificationCriterion(
            label='Gewenste zorgvorm',
            value=label_value,
            signal='neutraal',
            toelichting='Reguliere zorgvorm.',
        ))

    # 7. Contra-indicaties / specialistische expertise
    contra = (getattr(intake, 'contra_indicaties', '') or '').strip()
    if contra:
        complexity_score = max(complexity_score, 1)
        criteria.append(ClassificationCriterion(
            label='Contra-indicaties',
            value='Aanwezig',
            signal='verhogend',
            toelichting='Contra-indicaties of specialistische eisen verhogen de complexiteit.',
        ))

    # 8. Tijdsgevoeligheid
    if getattr(intake, 'time_sensitive_arrangement', False):
        intensity_score = max(intensity_score, 1)
        criteria.append(ClassificationCriterion(
            label='Tijdsgevoelig arrangement',
            value='Ja',
            signal='verhogend',
            toelichting='Tijdsgevoeligheid verhoogt de organisatie-intensiteit.',
        ))

    # 9. Gezinssituatie
    family = (getattr(intake, 'family_situation', '') or '')
    complex_family = {'DIVORCED_PARENTS': 'Gescheiden ouders', 'FOSTER_CARE': 'Pleegzorg', 'INSTITUTION': 'Instelling'}
    if family in complex_family:
        complexity_score = max(complexity_score, 1)
        criteria.append(ClassificationCriterion(
            label='Gezinssituatie',
            value=complex_family[family],
            signal='verhogend',
            toelichting='Complexe gezinssituatie vergroot de coördinatiebehoefte.',
        ))

    # ── Omzetten scores naar waarden ────────────────────────────────────────
    complexity_map = {0: 'ENKELVOUDIG', 1: 'MEERVOUDIG', 2: 'HOOGCOMPLEX'}
    intensity_map = {0: 'LICHT', 1: 'REGULIER', 2: 'INTENSIEF'}
    complexity_label_map = {0: 'Enkelvoudig', 1: 'Meervoudig', 2: 'Hoogcomplex'}
    intensity_label_map = {0: 'Licht', 1: 'Regulier', 2: 'Intensief'}

    proposed_complexity = complexity_map[complexity_score]
    proposed_care_intensity = intensity_map[intensity_score]

    # Proza-samenvatting
    verhogend = [c for c in criteria if c.signal == 'verhogend']
    if verhogend:
        labels = ', '.join(c.label.lower() for c in verhogend[:3])
        extra = ' en meer' if len(verhogend) > 3 else ''
        explanation = (
            f'Op basis van {labels}{extra} stelt het systeem '
            f'complexiteit <strong>{complexity_label_map[complexity_score]}</strong> '
            f'en zorgintensiteit <strong>{intensity_label_map[intensity_score]}</strong> voor.'
        )
    else:
        explanation = (
            'Op basis van de beschikbare gegevens wordt een enkelvoudige casus '
            'met lichte of reguliere zorgintensiteit voorgesteld.'
        )

    return ClassificationProposal(
        proposed_complexity=proposed_complexity,
        proposed_care_intensity=proposed_care_intensity,
        criteria=criteria,
        explanation=explanation,
    )
