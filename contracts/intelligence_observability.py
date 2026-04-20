"""
contracts/intelligence_observability.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Observability and tuning instrumentation for the V3 decision intelligence.

Measures whether confidence scoring, rejection taxonomy, and decision guidance
are predictive and useful in real operation.

All functions are pure read-only aggregations over existing DB data.  They
accept optional pre-loaded QuerySets / lists for testing without a live DB.
When real DB queries are required they are deferred inside each function to
prevent circular imports at module initialisation time.

Public API
----------
confidence_vs_acceptance(placement_qs=None) -> ConfidenceBucket list
confidence_vs_placement(placement_qs=None) -> ConfidenceBucket list
confidence_vs_intake(placement_qs=None) -> ConfidenceBucket list
rejection_reason_distribution(placement_qs=None, care_category=None) -> list[dict]
repeated_rejection_patterns(placement_qs=None, min_rejections=2) -> list[dict]
weak_match_false_positive_rate(placement_qs=None) -> dict
observability_summary(org=None) -> dict
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_ACCEPTANCE_STATUS = "ACCEPTED"
_PLACEMENT_SUCCESS_STATUSES = frozenset({"GOOD_FIT"})
_INTAKE_SUCCESS_STATUS = "COMPLETED"
_REJECTED_STATUSES = frozenset({"REJECTED", "NO_CAPACITY"})

# Confidence buckets: label, min_inclusive, max_exclusive
_BUCKETS: List[Dict[str, Any]] = [
    {"label": "Hoog (≥0.80)", "min": 0.80, "max": 1.01},
    {"label": "Middel (0.50–0.79)", "min": 0.50, "max": 0.80},
    {"label": "Laag (<0.50)", "min": 0.0, "max": 0.50},
    {"label": "Onbekend", "min": None, "max": None},
]


def _bucket_label(conf: Optional[float]) -> str:
    if conf is None:
        return "Onbekend"
    for bucket in _BUCKETS:
        if bucket["min"] is None:
            continue
        if bucket["min"] <= conf < bucket["max"]:
            return bucket["label"]
    return "Onbekend"


def _safe_rate(numerator: int, denominator: int) -> Optional[float]:
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


def _load_placement_qs(placement_qs, org=None):
    """Load PlacementRequest queryset with the fields needed for all metrics.

    When *placement_qs* is a plain list (e.g. in unit tests), it is returned
    as-is because it already contains row dicts.  When it is a Django QuerySet
    (or None), .values() is called to fetch the required columns.
    """
    if isinstance(placement_qs, (list, tuple)):
        # Pre-loaded rows from tests — use directly
        return placement_qs

    from contracts.models import PlacementRequest  # deferred

    if placement_qs is None:
        qs = PlacementRequest.objects.all()
        if org is not None:
            qs = qs.filter(due_diligence_process__organization=org)
    else:
        qs = placement_qs

    return qs.values(
        "id",
        "predicted_confidence",
        "provider_response_status",
        "provider_response_reason_code",
        "placement_quality_status",
        "selected_provider_id",
        "selected_provider__name",
        "due_diligence_process__intake_outcome_status",
        "due_diligence_process__care_category_main__name",
        "due_diligence_process__urgency",
    )


# ---------------------------------------------------------------------------
# 1. Confidence vs actual provider acceptance
# ---------------------------------------------------------------------------


def confidence_vs_acceptance(
    placement_qs=None,
    org=None,
) -> List[Dict[str, Any]]:
    """Bucket placements by predicted_confidence and measure acceptance rate.

    Returns a list of bucket dicts, each with:
    - label (str)
    - total (int): placements in this bucket
    - accepted (int)
    - acceptance_rate (float|None): 0.0–1.0
    """
    rows = list(_load_placement_qs(placement_qs, org))

    buckets: Dict[str, Dict[str, int]] = {b["label"]: {"total": 0, "accepted": 0} for b in _BUCKETS}

    for row in rows:
        conf = row.get("predicted_confidence")
        status = str(row.get("provider_response_status") or "").upper()
        label = _bucket_label(conf)
        buckets[label]["total"] += 1
        if status == _ACCEPTANCE_STATUS:
            buckets[label]["accepted"] += 1

    result = []
    for bucket in _BUCKETS:
        label = bucket["label"]
        counts = buckets[label]
        result.append(
            {
                "label": label,
                "total": counts["total"],
                "accepted": counts["accepted"],
                "acceptance_rate": _safe_rate(counts["accepted"], counts["total"]),
            }
        )
    return result


# ---------------------------------------------------------------------------
# 2. Confidence vs placement success
# ---------------------------------------------------------------------------


def confidence_vs_placement(
    placement_qs=None,
    org=None,
) -> List[Dict[str, Any]]:
    """Bucket placements by predicted_confidence and measure placement success rate.

    Placement success = placement_quality_status == 'GOOD_FIT'.

    Returns a list of bucket dicts, each with:
    - label (str)
    - total (int)
    - successful (int)
    - success_rate (float|None)
    """
    rows = list(_load_placement_qs(placement_qs, org))

    buckets: Dict[str, Dict[str, int]] = {b["label"]: {"total": 0, "successful": 0} for b in _BUCKETS}

    for row in rows:
        conf = row.get("predicted_confidence")
        quality = str(row.get("placement_quality_status") or "").upper()
        label = _bucket_label(conf)
        buckets[label]["total"] += 1
        if quality in _PLACEMENT_SUCCESS_STATUSES:
            buckets[label]["successful"] += 1

    result = []
    for bucket in _BUCKETS:
        label = bucket["label"]
        counts = buckets[label]
        result.append(
            {
                "label": label,
                "total": counts["total"],
                "successful": counts["successful"],
                "success_rate": _safe_rate(counts["successful"], counts["total"]),
            }
        )
    return result


# ---------------------------------------------------------------------------
# 3. Confidence vs intake started on time
# ---------------------------------------------------------------------------


def confidence_vs_intake(
    placement_qs=None,
    org=None,
) -> List[Dict[str, Any]]:
    """Bucket placements by predicted_confidence and measure intake success rate.

    Intake success = due_diligence_process.intake_outcome_status == 'COMPLETED'.

    Returns a list of bucket dicts, each with:
    - label (str)
    - total (int)
    - intake_started (int): count with COMPLETED intake
    - intake_rate (float|None)
    """
    rows = list(_load_placement_qs(placement_qs, org))

    buckets: Dict[str, Dict[str, int]] = {b["label"]: {"total": 0, "intake_started": 0} for b in _BUCKETS}

    for row in rows:
        conf = row.get("predicted_confidence")
        intake_status = str(
            row.get("due_diligence_process__intake_outcome_status") or ""
        ).upper()
        label = _bucket_label(conf)
        buckets[label]["total"] += 1
        if intake_status == _INTAKE_SUCCESS_STATUS:
            buckets[label]["intake_started"] += 1

    result = []
    for bucket in _BUCKETS:
        label = bucket["label"]
        counts = buckets[label]
        result.append(
            {
                "label": label,
                "total": counts["total"],
                "intake_started": counts["intake_started"],
                "intake_rate": _safe_rate(counts["intake_started"], counts["total"]),
            }
        )
    return result


# ---------------------------------------------------------------------------
# 4. Rejection reason distribution
# ---------------------------------------------------------------------------


def rejection_reason_distribution(
    placement_qs=None,
    org=None,
    care_category: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Count rejection reasons grouped by reason_code.

    Optionally filter by care_category (main category name, case-insensitive).

    Returns a list of dicts sorted by count desc:
    - reason_code (str)
    - care_category (str)
    - provider_name (str)
    - count (int)
    - pct_of_rejections (float|None): fraction of total rejections this entry represents
    """
    rows = list(_load_placement_qs(placement_qs, org))

    # Filter to only rejected statuses
    rejected_rows = [
        r
        for r in rows
        if str(r.get("provider_response_status") or "").upper() in _REJECTED_STATUSES
    ]

    # Optional care_category filter
    if care_category:
        category_lower = care_category.lower()
        rejected_rows = [
            r
            for r in rejected_rows
            if (r.get("due_diligence_process__care_category_main__name") or "").lower()
            == category_lower
        ]

    # Aggregate
    counts: Dict[tuple, Dict[str, Any]] = {}
    for row in rejected_rows:
        reason_code = str(row.get("provider_response_reason_code") or "NONE").strip().upper() or "NONE"
        category = str(row.get("due_diligence_process__care_category_main__name") or "Onbekend")
        provider_name = str(row.get("selected_provider__name") or "Onbekend")
        key = (reason_code, category, provider_name)
        if key not in counts:
            counts[key] = {
                "reason_code": reason_code,
                "care_category": category,
                "provider_name": provider_name,
                "count": 0,
            }
        counts[key]["count"] += 1

    total_rejections = len(rejected_rows)
    result = sorted(counts.values(), key=lambda x: x["count"], reverse=True)
    for entry in result:
        entry["pct_of_rejections"] = _safe_rate(entry["count"], total_rejections)
    return result


# ---------------------------------------------------------------------------
# 5. Repeated rejection patterns
# ---------------------------------------------------------------------------


def repeated_rejection_patterns(
    placement_qs=None,
    org=None,
    min_rejections: int = 2,
) -> List[Dict[str, Any]]:
    """Identify cases and providers with ≥ min_rejections rejections.

    Returns a list of dicts sorted by rejection_count desc:
    - case_id (int|None): due_diligence_process id
    - provider_id (int|None)
    - provider_name (str)
    - rejection_count (int)
    - reason_codes (list[str]): unique reason codes seen for this case+provider pair
    """
    rows = list(_load_placement_qs(placement_qs, org))

    # Collect all rejected rows
    rejected_rows = [
        r
        for r in rows
        if str(r.get("provider_response_status") or "").upper() in _REJECTED_STATUSES
    ]

    # Group by (case_id, provider_id)
    groups: Dict[tuple, Dict[str, Any]] = {}
    for row in rejected_rows:
        # Derive case id from the FK path stored in .values()
        case_id = row.get("due_diligence_process_id") or row.get("due_diligence_process__id")
        provider_id = row.get("selected_provider_id")
        provider_name = str(row.get("selected_provider__name") or "Onbekend")
        reason_code = str(row.get("provider_response_reason_code") or "NONE").strip().upper() or "NONE"
        key = (case_id, provider_id)
        if key not in groups:
            groups[key] = {
                "case_id": case_id,
                "provider_id": provider_id,
                "provider_name": provider_name,
                "rejection_count": 0,
                "reason_codes": set(),
            }
        groups[key]["rejection_count"] += 1
        groups[key]["reason_codes"].add(reason_code)

    result = [
        {
            **v,
            "reason_codes": sorted(v["reason_codes"]),
        }
        for v in groups.values()
        if v["rejection_count"] >= min_rejections
    ]
    return sorted(result, key=lambda x: x["rejection_count"], reverse=True)


# ---------------------------------------------------------------------------
# 6. Weak-match false positive rate
# ---------------------------------------------------------------------------


def weak_match_false_positive_rate(
    placement_qs=None,
    org=None,
) -> Dict[str, Any]:
    """Estimate weak-match false positive rate.

    A 'weak-match alert' is considered raised when predicted_confidence < 0.50
    (the threshold used by build_v3_evidence to produce a 'Zwakke match' summary).

    A 'false positive' is a weak-match flagged placement that ultimately resulted
    in provider ACCEPTED and placement GOOD_FIT (i.e. the alert was over-cautious).

    Returns:
    - total_with_confidence (int)
    - weak_match_flagged (int): predicted_confidence < 0.50 and not None
    - false_positives (int): flagged but ACCEPTED + GOOD_FIT
    - false_positive_rate (float|None)
    - true_positives (int): flagged and NOT accepted/good-fit
    - true_positive_rate (float|None)
    """
    rows = list(_load_placement_qs(placement_qs, org))

    total_with_confidence = 0
    weak_match_flagged = 0
    false_positives = 0
    true_positives = 0

    for row in rows:
        conf = row.get("predicted_confidence")
        if conf is None:
            continue
        total_with_confidence += 1
        if conf < 0.50:
            weak_match_flagged += 1
            status = str(row.get("provider_response_status") or "").upper()
            quality = str(row.get("placement_quality_status") or "").upper()
            if status == _ACCEPTANCE_STATUS and quality in _PLACEMENT_SUCCESS_STATUSES:
                false_positives += 1
            else:
                true_positives += 1

    return {
        "total_with_confidence": total_with_confidence,
        "weak_match_flagged": weak_match_flagged,
        "false_positives": false_positives,
        "false_positive_rate": _safe_rate(false_positives, weak_match_flagged),
        "true_positives": true_positives,
        "true_positive_rate": _safe_rate(true_positives, weak_match_flagged),
    }


# ---------------------------------------------------------------------------
# 7. Summary overview
# ---------------------------------------------------------------------------


def observability_summary(
    org=None,
    placement_qs=None,
) -> Dict[str, Any]:
    """Single-call overview combining all observability metrics.

    Safe when data is incomplete: each sub-function handles empty/None data.
    Returns a dict with keys:
    - confidence_vs_acceptance (list)
    - confidence_vs_placement (list)
    - confidence_vs_intake (list)
    - rejection_reason_distribution (list)
    - repeated_rejection_patterns (list)
    - weak_match_false_positive_rate (dict)
    - total_placements_with_confidence (int)
    - total_placements (int)
    """
    # Load once, pass as pre-loaded data to avoid N+1 queries.
    # When placement_qs is None (live mode) each sub-function does its own query
    # scoped to org.  For test usage, pass a pre-loaded iterable — the sub-functions
    # will accept it directly.
    rows = placement_qs

    return {
        "confidence_vs_acceptance": confidence_vs_acceptance(rows, org=org),
        "confidence_vs_placement": confidence_vs_placement(rows, org=org),
        "confidence_vs_intake": confidence_vs_intake(rows, org=org),
        "rejection_reason_distribution": rejection_reason_distribution(rows, org=org),
        "repeated_rejection_patterns": repeated_rejection_patterns(rows, org=org),
        "weak_match_false_positive_rate": weak_match_false_positive_rate(rows, org=org),
    }
