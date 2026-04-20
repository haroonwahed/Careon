"""
contracts/intelligence_tuning_meta.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Meta-governance analytics for the V3 intelligence tuning workflow.

Measures the effectiveness of tuning proposals, implementation decisions, and
reviewer behaviour so the governance process itself can improve over time.

All functions are **pure and read-only**.  They accept plain Python lists of
proposal objects (real ORM instances or mock-compatible stubs) and return
plain Python data structures.  No DB writes, no side effects.

Public API
----------
top_impact_proposals(proposals, n=5)            -> list[dict]
factor_type_impact_summary(proposals)           -> list[dict]
care_category_proposal_stats(proposals)         -> list[dict]
reviewer_stats(proposals)                       -> list[dict]
approval_rejection_ratios(proposals)            -> dict
negative_impact_proposals(proposals)            -> list
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _conf_delta(proposal) -> Optional[float]:
    """Return the observed confidence delta from post_impact, or None."""
    pi = getattr(proposal, 'post_impact', None)
    if not pi:
        return None
    return pi.get('delta_confidence_observed')


def _accept_delta(proposal) -> Optional[float]:
    """Return the observed acceptance-rate delta from post_impact, or None."""
    pi = getattr(proposal, 'post_impact', None)
    if not pi:
        return None
    return pi.get('delta_acceptance_observed')


def _category_name(proposal) -> str:
    cat = getattr(proposal, 'affected_care_category', None)
    if cat is None:
        return '(geen categorie)'
    return (getattr(cat, 'name', None) or '(geen categorie)').strip() or '(geen categorie)'


def _reviewer_name(proposal) -> Optional[str]:
    rev = getattr(proposal, 'reviewed_by', None)
    if rev is None:
        return None
    # Support both User objects and plain stubs with get_full_name / username
    if callable(getattr(rev, 'get_full_name', None)):
        name = rev.get_full_name().strip()
        if name:
            return name
    return str(getattr(rev, 'username', rev))


def _safe_mean(values: list) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 4)


# ---------------------------------------------------------------------------
# 1. Top impact proposals
# ---------------------------------------------------------------------------


def top_impact_proposals(proposals: List[Any], n: int = 5) -> List[Dict[str, Any]]:
    """Return the top-N implemented proposals with the largest *positive* confidence delta.

    Only proposals with status IMPLEMENTED and a non-None positive
    delta_confidence_observed in post_impact are included.

    Returns a list of dicts:
    {
        proposal       : the original proposal object
        delta_conf     : float – observed Δconfidence
        delta_accept   : float | None – observed Δacceptance rate
        factor_type    : str
        category_name  : str
    }
    sorted by delta_conf descending (largest improvement first).
    """
    results = []
    for p in proposals:
        if getattr(p, 'status', '') != 'IMPLEMENTED':
            continue
        dc = _conf_delta(p)
        if dc is None or dc <= 0:
            continue
        results.append({
            'proposal': p,
            'delta_conf': dc,
            'delta_accept': _accept_delta(p),
            'factor_type': getattr(p, 'factor_type', ''),
            'category_name': _category_name(p),
        })
    results.sort(key=lambda x: -x['delta_conf'])
    return results[:n]


# ---------------------------------------------------------------------------
# 2. Factor type impact summary
# ---------------------------------------------------------------------------


def factor_type_impact_summary(proposals: List[Any]) -> List[Dict[str, Any]]:
    """Aggregate observed confidence deltas by factor_type for implemented proposals.

    Returns a list of dicts per factor_type that has at least one post_impact
    observation, sorted by avg_delta_conf descending:
    {
        factor_type          : str
        count_with_impact    : int   – proposals with non-None delta
        avg_delta_conf       : float | None
        avg_delta_accept     : float | None
        max_delta_conf       : float | None
        min_delta_conf       : float | None
    }
    """
    buckets: Dict[str, Dict[str, list]] = defaultdict(lambda: {'confs': [], 'accepts': []})

    for p in proposals:
        if getattr(p, 'status', '') != 'IMPLEMENTED':
            continue
        ft = getattr(p, 'factor_type', '') or '(onbekend)'
        dc = _conf_delta(p)
        da = _accept_delta(p)
        if dc is not None:
            buckets[ft]['confs'].append(dc)
        if da is not None:
            buckets[ft]['accepts'].append(da)

    result = []
    for ft, data in buckets.items():
        confs = data['confs']
        accepts = data['accepts']
        if not confs:
            continue
        result.append({
            'factor_type': ft,
            'count_with_impact': len(confs),
            'avg_delta_conf': _safe_mean(confs),
            'avg_delta_accept': _safe_mean(accepts) if accepts else None,
            'max_delta_conf': round(max(confs), 4),
            'min_delta_conf': round(min(confs), 4),
        })

    result.sort(key=lambda x: -(x['avg_delta_conf'] or 0))
    return result


# ---------------------------------------------------------------------------
# 3. Care category proposal statistics
# ---------------------------------------------------------------------------


def care_category_proposal_stats(
    proposals: List[Any],
    stale_days: int = 30,
) -> List[Dict[str, Any]]:
    """Count proposals, stale proposals, and distinct group keys per care category.

    Stale = status SUGGESTED or REVIEWED and updated_at older than *stale_days*
    (uses the same logic as detect_stale_proposals but without re-importing to
    keep this module dependency-free).

    Returns a list of dicts sorted by total_proposals descending:
    {
        category_name    : str
        total_proposals  : int
        stale_count      : int
        distinct_groups  : int   – count of distinct non-empty group_key values
        approved_count   : int
        rejected_count   : int
        implemented_count: int
    }
    """
    from datetime import datetime, timedelta, timezone

    active_statuses = {'SUGGESTED', 'REVIEWED'}
    threshold = timedelta(days=stale_days)
    now = datetime.now(tz=timezone.utc)

    buckets: Dict[str, Dict] = defaultdict(lambda: {
        'total': 0,
        'stale': 0,
        'groups': set(),
        'approved': 0,
        'rejected': 0,
        'implemented': 0,
    })

    for p in proposals:
        cat = _category_name(p)
        b = buckets[cat]
        b['total'] += 1

        status = getattr(p, 'status', '')
        if status == 'APPROVED':
            b['approved'] += 1
        elif status == 'REJECTED':
            b['rejected'] += 1
        elif status == 'IMPLEMENTED':
            b['implemented'] += 1

        gk = getattr(p, 'group_key', '') or ''
        if gk:
            b['groups'].add(gk)

        if status in active_statuses:
            updated_at = getattr(p, 'updated_at', None) or getattr(p, 'created_at', None)
            if updated_at is None:
                b['stale'] += 1
            else:
                if updated_at.tzinfo is None:
                    updated_at = updated_at.replace(tzinfo=timezone.utc)
                if (now - updated_at) > threshold:
                    b['stale'] += 1

    result = [
        {
            'category_name': cat,
            'total_proposals': data['total'],
            'stale_count': data['stale'],
            'distinct_groups': len(data['groups']),
            'approved_count': data['approved'],
            'rejected_count': data['rejected'],
            'implemented_count': data['implemented'],
        }
        for cat, data in buckets.items()
    ]
    result.sort(key=lambda x: -x['total_proposals'])
    return result


# ---------------------------------------------------------------------------
# 4. Reviewer statistics
# ---------------------------------------------------------------------------


def reviewer_stats(proposals: List[Any]) -> List[Dict[str, Any]]:
    """Aggregate review behaviour per reviewer (staff member).

    Only proposals with a non-None reviewed_by are included.

    Returns a list of dicts sorted by total_reviewed descending:
    {
        reviewer_name         : str
        total_reviewed        : int
        approved_count        : int
        rejected_count        : int
        implemented_count     : int
        proposals_with_impact : int   – approved/implemented proposals with post_impact
        avg_delta_conf        : float | None  – mean Δconf for proposals they reviewed
        avg_delta_accept      : float | None
    }
    """
    buckets: Dict[str, Dict] = defaultdict(lambda: {
        'total': 0,
        'approved': 0,
        'rejected': 0,
        'implemented': 0,
        'with_impact': 0,
        'confs': [],
        'accepts': [],
    })

    for p in proposals:
        name = _reviewer_name(p)
        if name is None:
            continue
        b = buckets[name]
        b['total'] += 1
        status = getattr(p, 'status', '')
        if status == 'APPROVED':
            b['approved'] += 1
        elif status == 'REJECTED':
            b['rejected'] += 1
        elif status == 'IMPLEMENTED':
            b['implemented'] += 1

        dc = _conf_delta(p)
        da = _accept_delta(p)
        if dc is not None or da is not None:
            b['with_impact'] += 1
        if dc is not None:
            b['confs'].append(dc)
        if da is not None:
            b['accepts'].append(da)

    result = [
        {
            'reviewer_name': name,
            'total_reviewed': data['total'],
            'approved_count': data['approved'],
            'rejected_count': data['rejected'],
            'implemented_count': data['implemented'],
            'proposals_with_impact': data['with_impact'],
            'avg_delta_conf': _safe_mean(data['confs']),
            'avg_delta_accept': _safe_mean(data['accepts']) if data['accepts'] else None,
        }
        for name, data in buckets.items()
    ]
    result.sort(key=lambda x: -x['total_reviewed'])
    return result


# ---------------------------------------------------------------------------
# 5. Approval / rejection ratios
# ---------------------------------------------------------------------------


def approval_rejection_ratios(proposals: List[Any]) -> Dict[str, Any]:
    """Compute approval and rejection counts/ratios by source and by factor_type.

    Only terminal-status proposals (APPROVED, REJECTED, IMPLEMENTED) are
    counted as "decided"; SUGGESTED/REVIEWED proposals are still pending.

    Returns:
    {
        by_source: {
            '<source>': {
                'approved': int,
                'rejected': int,
                'total_decided': int,
                'approval_rate': float | None,   # approved / total_decided
            }
        },
        by_factor_type: { same structure }
    }
    """
    decided_statuses = {'APPROVED', 'REJECTED', 'IMPLEMENTED'}

    by_source: Dict[str, Dict[str, int]] = defaultdict(lambda: {'approved': 0, 'rejected': 0})
    by_ft: Dict[str, Dict[str, int]] = defaultdict(lambda: {'approved': 0, 'rejected': 0})

    for p in proposals:
        status = getattr(p, 'status', '')
        if status not in decided_statuses:
            continue
        src = getattr(p, 'source', '') or '(onbekend)'
        ft = getattr(p, 'factor_type', '') or '(onbekend)'

        is_approved = status in {'APPROVED', 'IMPLEMENTED'}
        is_rejected = status == 'REJECTED'

        if is_approved:
            by_source[src]['approved'] += 1
            by_ft[ft]['approved'] += 1
        elif is_rejected:
            by_source[src]['rejected'] += 1
            by_ft[ft]['rejected'] += 1

    def _enrich(bucket: dict) -> dict:
        result = {}
        for key, counts in bucket.items():
            approved = counts['approved']
            rejected = counts['rejected']
            total = approved + rejected
            result[key] = {
                'approved': approved,
                'rejected': rejected,
                'total_decided': total,
                'approval_rate': round(approved / total, 4) if total else None,
            }
        return result

    return {
        'by_source': _enrich(by_source),
        'by_factor_type': _enrich(by_ft),
    }


# ---------------------------------------------------------------------------
# 6. Negative impact detection
# ---------------------------------------------------------------------------


def negative_impact_proposals(proposals: List[Any]) -> List[Any]:
    """Return approved/implemented proposals that showed neutral or negative post-impact.

    A proposal is 'concerning' when:
    - status is APPROVED or IMPLEMENTED, AND
    - post_impact exists, AND
    - delta_confidence_observed is not None, AND
    - delta_confidence_observed <= 0

    Returns a list of proposals sorted by delta_conf ascending (most negative first).
    """
    result = []
    for p in proposals:
        status = getattr(p, 'status', '')
        if status not in {'APPROVED', 'IMPLEMENTED'}:
            continue
        dc = _conf_delta(p)
        if dc is None:
            continue
        if dc <= 0:
            result.append(p)
    result.sort(key=lambda p: (_conf_delta(p) or 0))
    return result
