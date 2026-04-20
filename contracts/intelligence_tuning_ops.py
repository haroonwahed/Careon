"""
contracts/intelligence_tuning_ops.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Operational governance and impact tracking for the V3 tuning workflow.

Extends the advisory tuning workflow with priority scoring, proposal grouping /
deduplication, stale detection, risk classification, and post-implementation
impact measurement.

All functions are pure and advisory.  No DB writes, no side effects.
They accept plain objects (or mock-compatible instances) and return plain
Python data structures.

Public API
----------
score_proposal_priority(proposal)                          -> float (0–1)
risk_level_for_proposal(proposal)                          -> 'LOW' | 'HIGH'
group_key_for_proposal(proposal)                           -> str
deduplicate_proposals(proposals)                           -> list
detect_stale_proposals(proposals, days=30)                 -> list
compute_post_impact(proposal, before_rows, after_rows)     -> dict
enrich_proposals(proposals)                                -> list
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# |delta| above this threshold → HIGH risk
_HIGH_RISK_DELTA_THRESHOLD = 0.15

# Proposals untouched longer than this (days) → stale
_DEFAULT_STALE_DAYS = 30

# Weight factors for priority scoring
_PRIORITY_SEVERITY_WEIGHT = 0.50  # severity contribution to score
_PRIORITY_VOLUME_WEIGHT = 0.30   # sample-volume contribution to score
_PRIORITY_DELTA_WEIGHT = 0.20    # delta magnitude contribution to score

# Volume reference for normalisation (clamp sample_count at this before normalising)
_VOLUME_REFERENCE = 50

# ---------------------------------------------------------------------------
# 1. Risk classification
# ---------------------------------------------------------------------------


def risk_level_for_proposal(proposal) -> str:
    """Classify a proposal as 'HIGH' or 'LOW' risk (advisory).

    A proposal is HIGH risk when:
    - |proposed_delta| > 0.15 (large weight change), OR
    - the proposal is scoped to a specific provider (affected_provider set)

    Returns 'HIGH' or 'LOW' (TuningProposal.RiskLevel values).
    """
    delta = proposal.proposed_delta or 0.0
    if abs(delta) > _HIGH_RISK_DELTA_THRESHOLD:
        return 'HIGH'
    if getattr(proposal, 'affected_provider', None) is not None:
        return 'HIGH'
    return 'LOW'


# ---------------------------------------------------------------------------
# 2. Priority scoring
# ---------------------------------------------------------------------------


def score_proposal_priority(proposal) -> float:
    """Compute an advisory priority score in [0, 1] for a TuningProposal.

    Score = weighted sum of three normalised components:
    - severity  (0.50 weight): HIGH severity → 1.0, MEDIUM → 0.5, LOW/other → 0.2
    - volume    (0.30 weight): sample_count / _VOLUME_REFERENCE, capped at 1.0
    - delta     (0.20 weight): |proposed_delta| / 0.30, capped at 1.0

    Parameters
    ----------
    proposal : TuningProposal or mock
        Needs attributes: severity (str | None), sample_count (int | None),
        proposed_delta (float | None).

    Returns a float in [0.0, 1.0], rounded to 4 decimal places.
    """
    # ── Severity component ───────────────────────────────────────────────
    severity_raw = (getattr(proposal, 'severity', None) or '').upper()
    severity_map = {'HIGH': 1.0, 'MEDIUM': 0.5, 'LOW': 0.2}
    severity_score = severity_map.get(severity_raw, 0.2)

    # ── Volume component ────────────────────────────────────────────────
    sample_count = getattr(proposal, 'sample_count', None) or 0
    volume_score = min(1.0, sample_count / _VOLUME_REFERENCE) if sample_count > 0 else 0.0

    # ── Delta magnitude component ────────────────────────────────────────
    delta = abs(getattr(proposal, 'proposed_delta', None) or 0.0)
    delta_score = min(1.0, delta / 0.30)

    raw = (
        severity_score * _PRIORITY_SEVERITY_WEIGHT
        + volume_score * _PRIORITY_VOLUME_WEIGHT
        + delta_score * _PRIORITY_DELTA_WEIGHT
    )
    return round(min(1.0, max(0.0, raw)), 4)


# ---------------------------------------------------------------------------
# 3. Group key / deduplication
# ---------------------------------------------------------------------------


def group_key_for_proposal(proposal) -> str:
    """Return a deterministic group key for deduplication and grouping.

    Key format:  "<source>|<factor_type>|<scope>"

    where <scope> is:
    - "cat:<category_name>"   when only a care category is set
    - "prov:<provider_pk>"    when only a provider is set
    - "cat:<name>+prov:<pk>"  when both are set
    - "global"                when neither is set

    This key is stable across re-runs for structurally identical proposals.
    """
    source = getattr(proposal, 'source', '') or ''
    factor_type = getattr(proposal, 'factor_type', '') or ''

    cat = getattr(proposal, 'affected_care_category', None)
    prov = getattr(proposal, 'affected_provider', None)

    scope_parts = []
    if cat is not None:
        cat_name = getattr(cat, 'name', str(cat)) or '?'
        scope_parts.append(f'cat:{cat_name.lower()}')
    if prov is not None:
        prov_pk = getattr(prov, 'pk', str(prov))
        scope_parts.append(f'prov:{prov_pk}')
    scope = '+'.join(scope_parts) if scope_parts else 'global'

    return f'{source}|{factor_type}|{scope}'


def deduplicate_proposals(proposals: Iterable) -> List[Any]:
    """Keep only the highest-priority proposal per group key.

    When two proposals share the same group_key (or would share the same
    computed key), the one with the higher priority_score is kept.
    Proposals without a priority_score are scored on the fly.

    Parameters
    ----------
    proposals : iterable of TuningProposal or mock objects
        Must support group_key attribute (or it is computed).

    Returns a list of unique proposals, one per group, sorted by
    priority_score descending.
    """
    best: Dict[str, Any] = {}
    for p in proposals:
        key = getattr(p, 'group_key', None) or group_key_for_proposal(p)
        score = (getattr(p, 'priority_score', None)
                 if getattr(p, 'priority_score', None) is not None
                 else score_proposal_priority(p))
        existing = best.get(key)
        if existing is None:
            best[key] = (p, score)
        else:
            _, existing_score = existing
            if score > existing_score:
                best[key] = (p, score)

    return [p for p, _ in sorted(best.values(), key=lambda x: -(x[1]))]


# ---------------------------------------------------------------------------
# 4. Stale detection
# ---------------------------------------------------------------------------


def detect_stale_proposals(
    proposals: Iterable,
    days: int = _DEFAULT_STALE_DAYS,
) -> List[Any]:
    """Return proposals that have been stuck in an active status too long.

    A proposal is 'stale' when its status is SUGGESTED or REVIEWED and
    it has not been updated for more than *days* days.

    Parameters
    ----------
    proposals : iterable of TuningProposal or mock objects
        Must have: status (str), updated_at (datetime | None).
    days : int
        Inactivity threshold. Default 30.

    Returns proposals that are stale, sorted by updated_at ascending
    (oldest first).
    """
    active_statuses = {'SUGGESTED', 'REVIEWED'}
    threshold = timedelta(days=days)
    now = datetime.now(tz=timezone.utc)

    stale = []
    for p in proposals:
        status = getattr(p, 'status', '') or ''
        if status not in active_statuses:
            continue
        updated_at = getattr(p, 'updated_at', None)
        if updated_at is None:
            # If we have no updated_at, fall back to created_at
            updated_at = getattr(p, 'created_at', None)
        if updated_at is None:
            stale.append(p)
            continue
        # Make tz-aware if naive
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        if (now - updated_at) > threshold:
            stale.append(p)

    return sorted(stale, key=lambda p: (getattr(p, 'updated_at', None) or datetime.min.replace(tzinfo=timezone.utc)))


# ---------------------------------------------------------------------------
# 5. Post-implementation impact measurement
# ---------------------------------------------------------------------------

_ACCEPTANCE_STATUS = 'ACCEPTED'
_SUCCESS_STATUSES = frozenset({'GOOD_FIT'})


def compute_post_impact(
    proposal,
    before_rows: List[Dict[str, Any]],
    after_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Measure observed outcome change before and after implementation.

    Compares rows from *before* implementation with rows from *after*
    to observe real changes in confidence and acceptance rate for the
    proposal's scope.

    Parameters
    ----------
    proposal : TuningProposal
        Used for scope filtering (category / provider).
    before_rows : list[dict]
        PlacementRequest .values() rows from before implementation.
    after_rows : list[dict]
        PlacementRequest .values() rows from after implementation.

    Returns a dict with:
    - before_mean_confidence (float | None)
    - after_mean_confidence (float | None)
    - before_acceptance_rate (float | None)
    - after_acceptance_rate (float | None)
    - delta_confidence_observed (float | None)
    - delta_acceptance_observed (float | None)
    - before_count (int)
    - after_count (int)
    - in_scope (bool): True when scope filtering found matching rows
    - scope_description (str)
    """
    cat = getattr(proposal, 'affected_care_category', None)
    prov = getattr(proposal, 'affected_provider', None)
    cat_name = (getattr(cat, 'name', None) or '').lower() if cat else None
    prov_id = getattr(prov, 'pk', None) if prov else None

    def _in_scope(row: Dict[str, Any]) -> bool:
        if cat_name:
            row_cat = (
                row.get('due_diligence_process__care_category_main__name') or ''
            ).lower()
            if row_cat != cat_name:
                return False
        if prov_id is not None:
            if row.get('selected_provider_id') != prov_id:
                return False
        return True

    def _stats(rows):
        in_scope_rows = [r for r in rows if _in_scope(r)]
        confs = [r['predicted_confidence'] for r in in_scope_rows
                 if r.get('predicted_confidence') is not None]
        accepted = sum(1 for r in in_scope_rows
                       if r.get('provider_response_status') == _ACCEPTANCE_STATUS)
        mean_conf = round(sum(confs) / len(confs), 4) if confs else None
        accept_rate = round(accepted / len(in_scope_rows), 4) if in_scope_rows else None
        return mean_conf, accept_rate, len(in_scope_rows)

    before_conf, before_accept, before_n = _stats(before_rows)
    after_conf, after_accept, after_n = _stats(after_rows)

    def _delta(a, b):
        if a is None or b is None:
            return None
        return round(b - a, 4)

    scope_parts = []
    if cat_name:
        scope_parts.append(f"categorie '{cat_name}'")
    if prov_id:
        scope_parts.append(f'aanbieder {prov_id}')
    scope_description = 'Scope: ' + ' + '.join(scope_parts) if scope_parts else 'Volledige dataset'

    return {
        'before_mean_confidence': before_conf,
        'after_mean_confidence': after_conf,
        'before_acceptance_rate': before_accept,
        'after_acceptance_rate': after_accept,
        'delta_confidence_observed': _delta(before_conf, after_conf),
        'delta_acceptance_observed': _delta(before_accept, after_accept),
        'before_count': before_n,
        'after_count': after_n,
        'in_scope': (before_n + after_n) > 0,
        'scope_description': scope_description,
    }


# ---------------------------------------------------------------------------
# 6. Enrichment helper (batch scoring + risk for display)
# ---------------------------------------------------------------------------


def enrich_proposals(proposals: List[Any]) -> List[Any]:
    """Compute and annotate priority_score, risk_level, and group_key in-memory.

    Mutates each proposal object (sets .priority_score, .risk_level,
    .group_key if they are None / empty).  Returns the same list.

    This is used for display purposes when proposals haven't been persisted
    with pre-computed values.
    """
    for p in proposals:
        if getattr(p, 'group_key', '') == '':
            p.group_key = group_key_for_proposal(p)
        if getattr(p, 'priority_score', None) is None:
            p.priority_score = score_proposal_priority(p)
        if not getattr(p, 'risk_level', None):
            p.risk_level = risk_level_for_proposal(p)
    return proposals
