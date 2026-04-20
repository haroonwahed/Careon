"""
contracts/intelligence_tuning_playbook.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Operational playbook for the V3 intelligence governance workflow.

Turns raw governance fields (risk_level, priority_score, sample_count,
post_impact, group_key, factor_type, status, updated_at) into actionable
advisory guidance for staff and org owners.

Everything is **read-only and advisory**.  Nothing in this module writes to
the database or modifies any proposal.

Public API
----------
review_cadence_for_proposal(proposal)   -> dict   advisory cadence
escalation_required(proposal)           -> dict   {required: bool, reasons: list[str]}
should_review_proposal(proposal)        -> dict   {review: bool, reason: str}
success_criteria_met(proposal)          -> dict   {met: bool, detail: str}
archive_recommendation(proposal)        -> dict   {archive: bool, reason: str | None}
role_responsibilities()                 -> dict   static role → duties map
playbook_summary(proposals)             -> dict   aggregated today-action view
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Thresholds — all configurable here in one place
# ---------------------------------------------------------------------------

# Minimum sample count for a proposal to be considered data-rich enough to act on
SAMPLE_COUNT_MINIMUM = 5

# Minimum priority_score for a proposal to warrant immediate review
PRIORITY_REVIEW_THRESHOLD = 0.60

# Maximum days a SUGGESTED or REVIEWED proposal may sit idle before stale flag
STALE_DAYS_LOW_RISK = 30
STALE_DAYS_HIGH_RISK = 7

# Days an IMPLEMENTED proposal must wait before being evaluated for success
IMPLEMENTATION_EVALUATION_DAYS = 14

# Minimum positive Δconfidence to consider a proposal successful
SUCCESS_DELTA_THRESHOLD = 0.02

# Number of negative/neutral post-impact observations after which a proposal
# type should be recommended for archive/retirement
NEGATIVE_IMPACT_ARCHIVE_COUNT = 2

# Risk levels as strings (mirroring model choices)
RISK_HIGH = 'HIGH'
RISK_LOW = 'LOW'


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _days_since(dt: Optional[datetime]) -> Optional[int]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return ((_now() - dt)).days


def _conf_delta(proposal) -> Optional[float]:
    pi = getattr(proposal, 'post_impact', None)
    if not pi:
        return None
    return pi.get('delta_confidence_observed')


def _sample_count(proposal) -> int:
    return int(getattr(proposal, 'sample_count', 0) or 0)


def _risk(proposal) -> str:
    return (getattr(proposal, 'risk_level', '') or '').upper()


def _status(proposal) -> str:
    return (getattr(proposal, 'status', '') or '').upper()


def _priority(proposal) -> float:
    return float(getattr(proposal, 'priority_score', 0.0) or 0.0)


def _factor_type(proposal) -> str:
    return (getattr(proposal, 'factor_type', '') or '').strip()


def _updated_at(proposal) -> Optional[datetime]:
    dt = getattr(proposal, 'updated_at', None) or getattr(proposal, 'created_at', None)
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _group_key(proposal) -> str:
    return (getattr(proposal, 'group_key', '') or '').strip()


# ---------------------------------------------------------------------------
# 1. Review cadence
# ---------------------------------------------------------------------------


def review_cadence_for_proposal(proposal) -> Dict[str, Any]:
    """Return an advisory review cadence for *proposal* based on its risk
    level and factor_type.

    Returns:
    {
        cadence_label   : str   human-readable frequency (e.g. "Binnen 2 werkdagen")
        cadence_days    : int   maximum days before review is overdue
        rationale       : str   one-sentence explanation
        risk_level      : str
        factor_type     : str
    }
    """
    risk = _risk(proposal)
    ft = _factor_type(proposal)

    if risk == RISK_HIGH:
        days = STALE_DAYS_HIGH_RISK
        label = 'Binnen 2 werkdagen'
        rationale = (
            'Voorstel heeft risico-niveau HOOG. Moet snel worden beoordeeld '
            'om impact op actieve casusbehandeling te beperken.'
        )
    elif ft in ('SPECIALIZATION_WEIGHT', 'REGION_WEIGHT'):
        days = 14
        label = 'Binnen 2 weken'
        rationale = (
            f'Factortype {ft} heeft directe invloed op matchingsuitkomsten. '
            'Wekelijkse beoordeling is aanbevolen.'
        )
    else:
        days = STALE_DAYS_LOW_RISK
        label = 'Binnen 30 dagen'
        rationale = 'Laag-risico voorstel — maandelijkse beoordelingscyclus is voldoende.'

    return {
        'cadence_label': label,
        'cadence_days': days,
        'rationale': rationale,
        'risk_level': risk or RISK_LOW,
        'factor_type': ft or '(onbekend)',
    }


# ---------------------------------------------------------------------------
# 2. Escalation
# ---------------------------------------------------------------------------


def escalation_required(proposal) -> Dict[str, Any]:
    """Determine whether this proposal should be escalated to a senior reviewer
    or org owner.

    Escalation triggers:
    - risk_level == HIGH
    - sample_count < SAMPLE_COUNT_MINIMUM (insufficient evidence, high uncertainty)
    - priority_score > 0.85 (extreme priority)
    - already overdue based on cadence

    Returns:
    {
        required   : bool
        reasons    : list[str]
        guidance   : str
    }
    """
    reasons: List[str] = []
    risk = _risk(proposal)
    sc = _sample_count(proposal)
    prio = _priority(proposal)
    status = _status(proposal)

    if risk == RISK_HIGH:
        reasons.append('Risico-niveau HOOG — vereist goedkeuring van orgverantwoordelijke.')

    if 0 < sc < SAMPLE_COUNT_MINIMUM and status not in ('REJECTED', 'IMPLEMENTED'):
        reasons.append(
            f'Steekproefomvang ({sc}) is kleiner dan drempel ({SAMPLE_COUNT_MINIMUM}). '
            'Bewijs is beperkt — extra toezicht aanbevolen.'
        )

    if prio > 0.85:
        reasons.append(
            f'Prioriteitsscore ({prio:.2f}) is extreem hoog. '
            'Snelle escalatie naar beslisser aanbevolen.'
        )

    cadence = review_cadence_for_proposal(proposal)
    updated = _updated_at(proposal)
    days_idle = _days_since(updated)
    if days_idle is not None and status in ('SUGGESTED', 'REVIEWED'):
        if days_idle > cadence['cadence_days']:
            reasons.append(
                f'Voorstel is {days_idle} dag(en) ongewijzigd — '
                f'overschrijdt de aanbevolen termijn van {cadence["cadence_days"]} dagen.'
            )

    return {
        'required': len(reasons) > 0,
        'reasons': reasons,
        'guidance': (
            'Stuur dit voorstel ter beoordeling naar de orgverantwoordelijke '
            'of een senior regisseur.'
        ) if reasons else 'Geen escalatie vereist — reguliere beoordelingscyclus volstaat.',
    }


# ---------------------------------------------------------------------------
# 3. Should review
# ---------------------------------------------------------------------------


def should_review_proposal(proposal) -> Dict[str, Any]:
    """Advisory: is this proposal worth reviewing now, or can it be skipped?

    Returns:
    {
        review  : bool
        reason  : str
    }
    """
    status = _status(proposal)
    prio = _priority(proposal)
    sc = _sample_count(proposal)
    risk = _risk(proposal)

    # Already decided — no review needed
    if status in ('REJECTED', 'IMPLEMENTED'):
        return {
            'review': False,
            'reason': f'Voorstel heeft eindstatus {status} — geen verdere actie vereist.',
        }

    # High risk always warrants review
    if risk == RISK_HIGH:
        return {
            'review': True,
            'reason': 'Risico-niveau HOOG — directe beoordeling aanbevolen ongeacht prioriteit.',
        }

    # Insufficient data — mark as review-needed but with caveat
    if sc < SAMPLE_COUNT_MINIMUM:
        return {
            'review': True,
            'reason': (
                f'Steekproefomvang ({sc}) is laag maar voorstel heeft status {status}. '
                'Beoordeel of meer data afgewacht moet worden.'
            ),
        }

    # High priority warrants immediate review
    if prio >= PRIORITY_REVIEW_THRESHOLD:
        return {
            'review': True,
            'reason': f'Prioriteitsscore {prio:.2f} ≥ drempel {PRIORITY_REVIEW_THRESHOLD} — beoordeling gewenst.',
        }

    return {
        'review': False,
        'reason': (
            f'Prioriteitsscore {prio:.2f} < drempel {PRIORITY_REVIEW_THRESHOLD} en risico is laag. '
            'Kan wachten tot de volgende reguliere beoordelingsronde.'
        ),
    }


# ---------------------------------------------------------------------------
# 4. Success criteria
# ---------------------------------------------------------------------------


def success_criteria_met(proposal) -> Dict[str, Any]:
    """Evaluate whether an implemented proposal meets its post-implementation
    success criteria.

    Criteria:
    1. Status must be IMPLEMENTED
    2. post_impact must be present
    3. delta_confidence_observed > SUCCESS_DELTA_THRESHOLD
    4. sample_count in post_impact (if present) >= SAMPLE_COUNT_MINIMUM

    Returns:
    {
        met             : bool
        detail          : str
        delta_conf      : float | None
        sample_count    : int | None
        waiting_period  : bool   True if implemented_at < IMPLEMENTATION_EVALUATION_DAYS ago
    }
    """
    status = _status(proposal)
    if status != 'IMPLEMENTED':
        return {
            'met': False,
            'detail': f'Voorstel heeft status {status} — succescriteria gelden alleen voor IMPLEMENTED.',
            'delta_conf': None,
            'sample_count': None,
            'waiting_period': False,
        }

    # Check if still within evaluation waiting period
    implemented_at = getattr(proposal, 'implemented_at', None)
    waiting = False
    if implemented_at is not None:
        days = _days_since(implemented_at)
        if days is not None and days < IMPLEMENTATION_EVALUATION_DAYS:
            waiting = True

    pi = getattr(proposal, 'post_impact', None)
    if not pi:
        return {
            'met': False,
            'detail': (
                'Geen post-impact data beschikbaar. '
                + ('Wacht minimaal {} dagen na implementatie.'.format(IMPLEMENTATION_EVALUATION_DAYS)
                   if waiting else 'Post-impact meting ontbreekt.')
            ),
            'delta_conf': None,
            'sample_count': None,
            'waiting_period': waiting,
        }

    dc = pi.get('delta_confidence_observed')
    pi_sc = pi.get('sample_count')

    if dc is None:
        return {
            'met': False,
            'detail': 'delta_confidence_observed is niet gemeten — evaluatie niet mogelijk.',
            'delta_conf': None,
            'sample_count': pi_sc,
            'waiting_period': waiting,
        }

    if pi_sc is not None and pi_sc < SAMPLE_COUNT_MINIMUM:
        return {
            'met': False,
            'detail': (
                f'Post-impact steekproef ({pi_sc}) te klein voor betrouwbare uitspraak '
                f'(minimum: {SAMPLE_COUNT_MINIMUM}).'
            ),
            'delta_conf': dc,
            'sample_count': pi_sc,
            'waiting_period': waiting,
        }

    if dc > SUCCESS_DELTA_THRESHOLD:
        return {
            'met': True,
            'detail': (
                f'Δconfidence {dc:+.4f} overschrijdt succesdrempel +{SUCCESS_DELTA_THRESHOLD}. '
                'Voorstel heeft aantoonbaar positief effect.'
            ),
            'delta_conf': dc,
            'sample_count': pi_sc,
            'waiting_period': waiting,
        }

    return {
        'met': False,
        'detail': (
            f'Δconfidence {dc:+.4f} is onder of gelijk aan de succesdrempel +{SUCCESS_DELTA_THRESHOLD}. '
            'Voorstel voldoet niet aan het minimale effectiviteitscriterium.'
        ),
        'delta_conf': dc,
        'sample_count': pi_sc,
        'waiting_period': waiting,
    }


# ---------------------------------------------------------------------------
# 5. Archive recommendation
# ---------------------------------------------------------------------------


def archive_recommendation(proposal) -> Dict[str, Any]:
    """Determine whether this proposal should be archived/retired.

    Archive triggers (any one sufficient):
    a. Status is REJECTED — already retired
    b. Stale: SUGGESTED/REVIEWED and idle longer than cadence allows × 2
    c. Duplicate group: non-empty group_key already present on another proposal
       (caller must check across proposals; here we flag the group_key as a signal)
    d. IMPLEMENTED with negative or neutral post-impact delta (Δconf ≤ 0)

    Returns:
    {
        archive         : bool
        reason          : str | None
        trigger         : str | None   'rejected'|'stale'|'group_duplicate'|'ineffective'
    }
    """
    status = _status(proposal)

    # Already rejected
    if status == 'REJECTED':
        return {
            'archive': True,
            'reason': 'Voorstel is afgewezen — kan worden gearchiveerd.',
            'trigger': 'rejected',
        }

    # Stale: double the cadence window
    cadence = review_cadence_for_proposal(proposal)
    days_idle = _days_since(_updated_at(proposal))
    if status in ('SUGGESTED', 'REVIEWED') and days_idle is not None:
        archive_after = cadence['cadence_days'] * 2
        if days_idle > archive_after:
            return {
                'archive': True,
                'reason': (
                    f'Voorstel is {days_idle} dag(en) inactief (drempel: {archive_after} dagen). '
                    'Archiveer of herbeoordeel dit voorstel.'
                ),
                'trigger': 'stale',
            }

    # Implemented but ineffective
    if status == 'IMPLEMENTED':
        dc = _conf_delta(proposal)
        if dc is not None and dc <= 0:
            return {
                'archive': True,
                'reason': (
                    f'Geïmplementeerd voorstel toont geen positief effect (Δconf = {dc:+.4f}). '
                    'Overweeg terugdraaiing of archivering.'
                ),
                'trigger': 'ineffective',
            }

    # Group duplicate signal (advisory only — caller resolves across proposals)
    gk = _group_key(proposal)
    if gk:
        return {
            'archive': False,
            'reason': (
                f'Voorstel heeft groepsleutel "{gk}". '
                'Controleer of er actieve duplicaten bestaan met dezelfde sleutel.'
            ),
            'trigger': 'group_duplicate',
        }

    return {'archive': False, 'reason': None, 'trigger': None}


# ---------------------------------------------------------------------------
# 6. Role responsibilities (static)
# ---------------------------------------------------------------------------


def role_responsibilities() -> Dict[str, Any]:
    """Return static advisory role descriptions for the governance workflow.

    Returns:
    {
        'reviewer'  : { label, duties: list[str], cadence, escalate_to }
        'approver'  : { label, duties, escalate_to }
        'observer'  : { label, duties }
    }
    """
    return {
        'reviewer': {
            'label': 'Beoordelaar (Reviewer)',
            'duties': [
                'Beoordeelt SUGGESTED voorstellen op relevantie en datakwaliteit.',
                f'Zet hoogrisico-voorstellen door binnen {STALE_DAYS_HIGH_RISK} dagen.',
                f'Zet laag-risico voorstellen door binnen {STALE_DAYS_LOW_RISK} dagen.',
                'Markeert voorstellen met te weinig data (<{} samples) als onvoldoende onderbouwd.'.format(SAMPLE_COUNT_MINIMUM),
                'Signaleert dubbele groepssleutels en vraagt deduplicatie aan.',
            ],
            'cadence': 'Wekelijks de SUGGESTED-wachtrij doorlopen.',
            'escalate_to': 'Goedkeurder (Approver) bij HIGH-risico of tegenstrijdige signalen.',
        },
        'approver': {
            'label': 'Goedkeurder (Approver)',
            'duties': [
                'Goedkeuren of afwijzen van REVIEWED voorstellen.',
                'Bewaakt dat uitsluitend voorstellen met voldoende bewijs (≥{} samples) worden goedgekeurd.'.format(SAMPLE_COUNT_MINIMUM),
                'Bevestigt implementatie na ≥{} dagen post-impact-meting.'.format(IMPLEMENTATION_EVALUATION_DAYS),
                'Verantwoordelijk voor escalaties vanuit de Beoordelaar.',
                'Controleert maandelijks de meta-governance-analyse op negatieve patronen.',
            ],
            'escalate_to': 'Organisatieverantwoordelijke bij aanpassingen die meer dan één factortype betreffen.',
        },
        'observer': {
            'label': 'Toeschouwer (Observer)',
            'duties': [
                'Leest-alleen toegang tot tuningvoorstellen en governance-rapporten.',
                'Mag geen status wijzigen of acties uitvoeren.',
                'Kan bevindingen delen met Beoordelaar of Goedkeurder via reguliere kanalen.',
            ],
        },
    }


# ---------------------------------------------------------------------------
# 7. Playbook summary
# ---------------------------------------------------------------------------


def playbook_summary(proposals: List[Any]) -> Dict[str, Any]:
    """Aggregate across all proposals to produce a 'today's actions' advisory.

    Returns:
    {
        needs_escalation    : list[proposal]  — proposals requiring escalation
        overdue_review      : list[proposal]  — stale proposals past cadence window
        needs_success_eval  : list[proposal]  — IMPLEMENTED, past wait, no post_impact
        archive_candidates  : list[proposal]  — proposals with archive recommendation
        ready_for_review    : list[proposal]  — SUGGESTED/REVIEWED, high priority
        total               : int
        summary_lines       : list[str]       — human-readable advisory bullets
    }
    """
    needs_escalation = []
    overdue_review = []
    needs_success_eval = []
    archive_candidates = []
    ready_for_review = []

    for p in proposals:
        esc = escalation_required(p)
        if esc['required']:
            needs_escalation.append(p)

        status = _status(p)
        cadence = review_cadence_for_proposal(p)
        days_idle = _days_since(_updated_at(p))
        if status in ('SUGGESTED', 'REVIEWED') and days_idle is not None:
            if days_idle > cadence['cadence_days']:
                overdue_review.append(p)

        if status == 'IMPLEMENTED':
            pi = getattr(p, 'post_impact', None)
            implemented_at = getattr(p, 'implemented_at', None)
            days_impl = _days_since(implemented_at)
            if pi is None and days_impl is not None and days_impl >= IMPLEMENTATION_EVALUATION_DAYS:
                needs_success_eval.append(p)

        arc = archive_recommendation(p)
        if arc['archive']:
            archive_candidates.append(p)

        rev = should_review_proposal(p)
        if rev['review'] and status not in ('REJECTED', 'IMPLEMENTED'):
            ready_for_review.append(p)

    lines = []
    if needs_escalation:
        lines.append(f'{len(needs_escalation)} voorstel(len) vereisen escalatie naar een goedkeurder.')
    if overdue_review:
        lines.append(f'{len(overdue_review)} voorstel(len) zijn vervallen — beoordeel of archiveer ze vandaag.')
    if needs_success_eval:
        lines.append(
            f'{len(needs_success_eval)} geïmplementeerde voorstel(len) wachten op post-impactmeting '
            f'(≥{IMPLEMENTATION_EVALUATION_DAYS} dagen na implementatie).'
        )
    if archive_candidates:
        lines.append(f'{len(archive_candidates)} voorstel(len) zijn kandidaat voor archivering.')
    if ready_for_review:
        lines.append(f'{len(ready_for_review)} voorstel(len) staan klaar voor beoordeling.')
    if not lines:
        lines.append('Geen directe acties vereist — goede governance-status.')

    return {
        'needs_escalation': needs_escalation,
        'overdue_review': overdue_review,
        'needs_success_eval': needs_success_eval,
        'archive_candidates': archive_candidates,
        'ready_for_review': ready_for_review,
        'total': len(proposals),
        'summary_lines': lines,
    }
