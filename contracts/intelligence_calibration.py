"""
contracts/intelligence_calibration.py
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Calibration diagnostics and tuning recommendations for the V3 decision intelligence.

Turns observability data into actionable advisory signals: detects where confidence
scoring, matching factors, and rejection patterns are misaligned with real outcomes.

All functions are pure, read-only, and advisory.  No DB writes, no side effects.
They accept the same plain-list or QuerySet inputs as intelligence_observability.py.

Public API
----------
high_confidence_low_acceptance_mismatches(rows)  -> list[dict]
low_confidence_high_success_mismatches(rows)      -> list[dict]
care_category_calibration_drift(rows)             -> list[dict]
provider_calibration_drift(rows)                  -> list[dict]
rejection_taxonomy_clusters(rows)                 -> list[dict]
calibration_recommendations(diagnostics)          -> list[dict]
calibration_diagnostics(rows)                     -> dict
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Thresholds – intentionally conservative to avoid noise on sparse data
# ---------------------------------------------------------------------------

# Minimum samples in a cell before we report a drift signal (avoid 1-sample artefacts)
_MIN_SAMPLE_SIZE = 3

# A "high-confidence" placement is one where predicted_confidence >= this
_HIGH_CONF_THRESHOLD = 0.70

# A "low-confidence" placement is one where predicted_confidence < this
_LOW_CONF_THRESHOLD = 0.50

# A high-confidence cell is a mismatch when acceptance rate drops below this
_HIGH_CONF_LOW_ACCEPT_CEILING = 0.50  # < 50 % acceptance despite high confidence

# A low-confidence cell is a mismatch when success rate exceeds this
_LOW_CONF_HIGH_SUCCESS_FLOOR = 0.60  # ≥ 60 % success despite low confidence

# Category / provider drift: expected acceptance rate gap between high and low buckets
# If the gap is smaller than this, confidence is not differentiating
_DRIFT_GAP_THRESHOLD = 0.20

# Rejection cluster: a reason_code is a cluster signal when it represents this
# fraction of all rejections for the slice
_CLUSTER_PCT_THRESHOLD = 0.40  # ≥ 40 % of rejections share one reason code

# ---------------------------------------------------------------------------
# Helpers shared with intelligence_observability
# ---------------------------------------------------------------------------

_ACCEPTANCE_STATUS = "ACCEPTED"
_PLACEMENT_SUCCESS_STATUSES = frozenset({"GOOD_FIT"})
_REJECTED_STATUSES = frozenset({"REJECTED", "NO_CAPACITY"})


def _safe_rate(numerator: int, denominator: int) -> Optional[float]:
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


def _is_high_conf(conf: Optional[float]) -> bool:
    return conf is not None and conf >= _HIGH_CONF_THRESHOLD


def _is_low_conf(conf: Optional[float]) -> bool:
    return conf is not None and conf < _LOW_CONF_THRESHOLD


# ---------------------------------------------------------------------------
# 1. High-confidence / low-acceptance mismatches
# ---------------------------------------------------------------------------


def high_confidence_low_acceptance_mismatches(
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Detect slices where high predicted confidence did not lead to acceptance.

    Groups high-confidence placements (predicted_confidence ≥ 0.70) by care
    category.  Returns slices where acceptance rate < 50 % and sample ≥ 3.

    Each result dict:
    - care_category (str)
    - total_high_conf (int)
    - accepted (int)
    - acceptance_rate (float|None)
    - severity (str): 'high' | 'medium'  based on how far below 50 % the rate is
    """
    by_category: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {"total": 0, "accepted": 0}
    )

    for row in rows:
        conf = row.get("predicted_confidence")
        if not _is_high_conf(conf):
            continue
        category = str(
            row.get("due_diligence_process__care_category_main__name") or "Onbekend"
        )
        status = str(row.get("provider_response_status") or "").upper()
        by_category[category]["total"] += 1
        if status == _ACCEPTANCE_STATUS:
            by_category[category]["accepted"] += 1

    result = []
    for category, counts in by_category.items():
        total = counts["total"]
        accepted = counts["accepted"]
        if total < _MIN_SAMPLE_SIZE:
            continue
        rate = _safe_rate(accepted, total)
        if rate is None or rate >= _HIGH_CONF_LOW_ACCEPT_CEILING:
            continue
        severity = "high" if rate < 0.25 else "medium"
        result.append(
            {
                "care_category": category,
                "total_high_conf": total,
                "accepted": accepted,
                "acceptance_rate": rate,
                "severity": severity,
            }
        )
    return sorted(result, key=lambda x: x["acceptance_rate"] or 1.0)


# ---------------------------------------------------------------------------
# 2. Low-confidence / high-success mismatches
# ---------------------------------------------------------------------------


def low_confidence_high_success_mismatches(
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Detect slices where low confidence still resulted in good placement outcomes.

    Groups low-confidence placements (predicted_confidence < 0.50) by care
    category.  Returns slices where GOOD_FIT rate ≥ 60 % and sample ≥ 3.

    Each result dict:
    - care_category (str)
    - total_low_conf (int)
    - successful (int)
    - success_rate (float|None)
    - severity (str): 'high' | 'medium'
    """
    by_category: Dict[str, Dict[str, int]] = defaultdict(
        lambda: {"total": 0, "successful": 0}
    )

    for row in rows:
        conf = row.get("predicted_confidence")
        if not _is_low_conf(conf):
            continue
        category = str(
            row.get("due_diligence_process__care_category_main__name") or "Onbekend"
        )
        quality = str(row.get("placement_quality_status") or "").upper()
        by_category[category]["total"] += 1
        if quality in _PLACEMENT_SUCCESS_STATUSES:
            by_category[category]["successful"] += 1

    result = []
    for category, counts in by_category.items():
        total = counts["total"]
        successful = counts["successful"]
        if total < _MIN_SAMPLE_SIZE:
            continue
        rate = _safe_rate(successful, total)
        if rate is None or rate < _LOW_CONF_HIGH_SUCCESS_FLOOR:
            continue
        severity = "high" if rate >= 0.80 else "medium"
        result.append(
            {
                "care_category": category,
                "total_low_conf": total,
                "successful": successful,
                "success_rate": rate,
                "severity": severity,
            }
        )
    return sorted(result, key=lambda x: -(x["success_rate"] or 0.0))


# ---------------------------------------------------------------------------
# 3. Care-category-specific calibration drift
# ---------------------------------------------------------------------------


def care_category_calibration_drift(
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """For each care category, compare high-confidence acceptance vs low-confidence.

    Drift is detected when the gap between the two acceptance rates is smaller
    than _DRIFT_GAP_THRESHOLD (0.20), meaning confidence does not meaningfully
    distinguish good from bad matches in that category.

    Returns categories where drift is detected (sample ≥ _MIN_SAMPLE_SIZE in
    both buckets), sorted by gap ascending (worst drift first).

    Each result dict:
    - care_category (str)
    - high_conf_total (int)
    - high_conf_acceptance_rate (float|None)
    - low_conf_total (int)
    - low_conf_acceptance_rate (float|None)
    - gap (float|None): high_rate − low_rate
    - drift_detected (bool)
    - recommendation (str): human-readable advisory
    """
    by_category: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "high": {"total": 0, "accepted": 0},
            "low": {"total": 0, "accepted": 0},
        }
    )

    for row in rows:
        conf = row.get("predicted_confidence")
        if conf is None:
            continue
        category = str(
            row.get("due_diligence_process__care_category_main__name") or "Onbekend"
        )
        status = str(row.get("provider_response_status") or "").upper()
        accepted = 1 if status == _ACCEPTANCE_STATUS else 0
        if _is_high_conf(conf):
            by_category[category]["high"]["total"] += 1
            by_category[category]["high"]["accepted"] += accepted
        elif _is_low_conf(conf):
            by_category[category]["low"]["total"] += 1
            by_category[category]["low"]["accepted"] += accepted

    result = []
    for category, buckets in by_category.items():
        high = buckets["high"]
        low = buckets["low"]
        if high["total"] < _MIN_SAMPLE_SIZE or low["total"] < _MIN_SAMPLE_SIZE:
            continue
        high_rate = _safe_rate(high["accepted"], high["total"])
        low_rate = _safe_rate(low["accepted"], low["total"])
        if high_rate is None or low_rate is None:
            continue
        gap = round(high_rate - low_rate, 4)
        drift = gap < _DRIFT_GAP_THRESHOLD
        recommendation = ""
        if drift:
            recommendation = (
                f"Confidence scoort niet onderscheidend voor '{category}': "
                f"hoge confidence leidt slechts tot {gap*100:.0f}% hogere acceptatiekans. "
                "Overweeg specialisatie-weging of zorgvraag-complexiteit zwaarder mee te nemen."
            )
        result.append(
            {
                "care_category": category,
                "high_conf_total": high["total"],
                "high_conf_acceptance_rate": high_rate,
                "low_conf_total": low["total"],
                "low_conf_acceptance_rate": low_rate,
                "gap": gap,
                "drift_detected": drift,
                "recommendation": recommendation,
            }
        )
    return sorted(result, key=lambda x: (x["gap"] if x["gap"] is not None else 1.0))


# ---------------------------------------------------------------------------
# 4. Provider-specific calibration drift
# ---------------------------------------------------------------------------


def provider_calibration_drift(
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Detect providers where the confidence score does not predict their acceptance.

    For each provider, compare actual acceptance rate against the mean predicted
    confidence of placements sent to them.  Flags providers where mean confidence
    ≥ 0.65 but actual acceptance rate < 0.40, or mean confidence < 0.45 but
    actual acceptance rate ≥ 0.70.

    Requires ≥ _MIN_SAMPLE_SIZE placements with confidence scores for a provider.

    Each result dict:
    - provider_id (int|None)
    - provider_name (str)
    - total (int)
    - mean_confidence (float)
    - acceptance_rate (float)
    - drift_type (str): 'over_confident' | 'under_confident'
    - recommendation (str)
    """
    by_provider: Dict[Any, Dict[str, Any]] = defaultdict(
        lambda: {
            "provider_name": "Onbekend",
            "conf_sum": 0.0,
            "total": 0,
            "accepted": 0,
        }
    )

    for row in rows:
        conf = row.get("predicted_confidence")
        if conf is None:
            continue
        provider_id = row.get("selected_provider_id")
        provider_name = str(row.get("selected_provider__name") or "Onbekend")
        status = str(row.get("provider_response_status") or "").upper()
        by_provider[provider_id]["provider_name"] = provider_name
        by_provider[provider_id]["conf_sum"] += conf
        by_provider[provider_id]["total"] += 1
        if status == _ACCEPTANCE_STATUS:
            by_provider[provider_id]["accepted"] += 1

    result = []
    for provider_id, data in by_provider.items():
        total = data["total"]
        if total < _MIN_SAMPLE_SIZE:
            continue
        mean_conf = round(data["conf_sum"] / total, 4)
        accept_rate = _safe_rate(data["accepted"], total) or 0.0
        drift_type = None
        recommendation = ""
        if mean_conf >= 0.65 and accept_rate < 0.40:
            drift_type = "over_confident"
            recommendation = (
                f"Aanbieder '{data['provider_name']}' ontvangt hoge confidence-scores "
                f"(gem. {mean_conf:.2f}) maar accepteert slechts {accept_rate*100:.0f}% van aanvragen. "
                "Overweeg de provider-betrouwbaarheidsbonus voor deze aanbieder te verlagen."
            )
        elif mean_conf < 0.45 and accept_rate >= 0.70:
            drift_type = "under_confident"
            recommendation = (
                f"Aanbieder '{data['provider_name']}' ontvangt lage confidence-scores "
                f"(gem. {mean_conf:.2f}) maar accepteert {accept_rate*100:.0f}% van aanvragen. "
                "Overweeg het gewicht van matching-factoren voor deze aanbieder te herzien."
            )
        if drift_type is None:
            continue
        result.append(
            {
                "provider_id": provider_id,
                "provider_name": data["provider_name"],
                "total": total,
                "mean_confidence": mean_conf,
                "acceptance_rate": accept_rate,
                "drift_type": drift_type,
                "recommendation": recommendation,
            }
        )
    return sorted(result, key=lambda x: x["drift_type"])


# ---------------------------------------------------------------------------
# 5. Rejection taxonomy clusters
# ---------------------------------------------------------------------------


def rejection_taxonomy_clusters(
    rows: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Detect care categories dominated by a single rejection reason code.

    A 'cluster' exists when one reason_code accounts for ≥ 40 % of all
    rejections in a category and there are ≥ _MIN_SAMPLE_SIZE rejections.

    These clusters often indicate a structural weighting problem (e.g. capacity
    codes dominating a category suggest the matching engine is not filtering
    out full providers early enough).

    Each result dict:
    - care_category (str)
    - dominant_reason_code (str)
    - dominant_count (int)
    - total_rejections (int)
    - dominant_pct (float)
    - recommendation (str)
    """
    # Aggregate: (category, reason_code) → count; category → total rejections
    cat_reason: Dict[tuple, int] = defaultdict(int)
    cat_total: Dict[str, int] = defaultdict(int)

    for row in rows:
        status = str(row.get("provider_response_status") or "").upper()
        if status not in _REJECTED_STATUSES:
            continue
        category = str(
            row.get("due_diligence_process__care_category_main__name") or "Onbekend"
        )
        reason = (
            str(row.get("provider_response_reason_code") or "NONE").strip().upper()
            or "NONE"
        )
        cat_reason[(category, reason)] += 1
        cat_total[category] += 1

    result = []
    for category, total in cat_total.items():
        if total < _MIN_SAMPLE_SIZE:
            continue
        # Find dominant reason code for this category
        dominant_reason = None
        dominant_count = 0
        for (cat, reason), count in cat_reason.items():
            if cat == category and count > dominant_count:
                dominant_count = count
                dominant_reason = reason
        if dominant_reason is None:
            continue
        pct = _safe_rate(dominant_count, total) or 0.0
        if pct < _CLUSTER_PCT_THRESHOLD:
            continue
        recommendation = _cluster_recommendation(category, dominant_reason, pct)
        result.append(
            {
                "care_category": category,
                "dominant_reason_code": dominant_reason,
                "dominant_count": dominant_count,
                "total_rejections": total,
                "dominant_pct": round(pct, 4),
                "recommendation": recommendation,
            }
        )
    return sorted(result, key=lambda x: -x["dominant_pct"])


def _cluster_recommendation(category: str, reason_code: str, pct: float) -> str:
    """Generate a human-readable tuning recommendation for a detected cluster."""
    pct_str = f"{pct * 100:.0f}%"
    base = f"In '{category}' is '{reason_code}' verantwoordelijk voor {pct_str} van de afwijzingen. "
    advice_map: Dict[str, str] = {
        "CAPACITY": (
            "Overweeg capaciteitsfiltering eerder in het matching-proces toe te passen "
            "zodat volle aanbieders buiten de kandidatenset vallen."
        ),
        "NO_CAPACITY": (
            "Overweeg capaciteitsfiltering eerder in het matching-proces toe te passen "
            "zodat volle aanbieders buiten de kandidatenset vallen."
        ),
        "REGION_MISMATCH": (
            "Overweeg het regiogewicht in de confidence-score te verhogen voor deze categorie."
        ),
        "SPECIALIZATION_MISMATCH": (
            "Overweeg het specialisatiegewicht te verhogen voor deze zorgcategorie."
        ),
        "COMPLEXITY_TOO_HIGH": (
            "Overweeg complexiteitsdrempel strenger te handhaven bij kandidaatsselectie."
        ),
        "AGE_MISMATCH": (
            "Overweeg leeftijdscategorie als hard filter toe te passen."
        ),
    }
    advice = advice_map.get(
        reason_code,
        f"Analyseer de '{reason_code}'-redencode nader om structurele matching-aanpassingen te identificeren.",
    )
    return base + advice


# ---------------------------------------------------------------------------
# 6. Recommendation synthesis
# ---------------------------------------------------------------------------

_SEVERITY_ORDER = {"high": 0, "medium": 1}


def calibration_recommendations(
    diagnostics: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Synthesise all diagnostic findings into a prioritised recommendation list.

    *diagnostics* is the dict returned by ``calibration_diagnostics()``.
    This function is pure — it takes the already-computed diagnostics and
    derives actionable advisory items from them.

    Each recommendation dict:
    - source (str): which diagnostic produced this
    - severity (str): 'high' | 'medium' | 'low'
    - subject (str): care category or provider name
    - recommendation (str): Dutch advisory text
    """
    recs: List[Dict[str, Any]] = []

    # From high-confidence / low-acceptance mismatches
    for entry in diagnostics.get("high_confidence_low_acceptance", []):
        recs.append(
            {
                "source": "hoog_vertrouwen_lage_acceptatie",
                "severity": entry.get("severity", "medium"),
                "subject": entry.get("care_category", "—"),
                "recommendation": (
                    f"Vertrouwensscore overschat kans op acceptatie voor '{entry.get('care_category')}' "
                    f"(acceptatiegraad {(entry.get('acceptance_rate') or 0)*100:.0f}% bij hoge confidence). "
                    "Verlaag de confidence-boost voor aanbieder-betrouwbaarheidsscore in dit segment."
                ),
            }
        )

    # From low-confidence / high-success mismatches
    for entry in diagnostics.get("low_confidence_high_success", []):
        recs.append(
            {
                "source": "laag_vertrouwen_hoog_succes",
                "severity": entry.get("severity", "medium"),
                "subject": entry.get("care_category", "—"),
                "recommendation": (
                    f"Confidence onderschat kwaliteit voor '{entry.get('care_category')}' "
                    f"({(entry.get('success_rate') or 0)*100:.0f}% plaatsingssucces ondanks lage score). "
                    "Verhoog het gewicht van specialisatie-matching voor dit segment."
                ),
            }
        )

    # From care category drift
    for entry in diagnostics.get("care_category_drift", []):
        if entry.get("drift_detected") and entry.get("recommendation"):
            recs.append(
                {
                    "source": "categorie_drift",
                    "severity": "medium",
                    "subject": entry.get("care_category", "—"),
                    "recommendation": entry["recommendation"],
                }
            )

    # From provider drift
    for entry in diagnostics.get("provider_drift", []):
        if entry.get("recommendation"):
            severity = "high" if entry.get("drift_type") == "over_confident" else "medium"
            recs.append(
                {
                    "source": "aanbieder_drift",
                    "severity": severity,
                    "subject": entry.get("provider_name", "—"),
                    "recommendation": entry["recommendation"],
                }
            )

    # From taxonomy clusters
    for entry in diagnostics.get("taxonomy_clusters", []):
        if entry.get("recommendation"):
            recs.append(
                {
                    "source": "afwijzing_cluster",
                    "severity": "high" if entry.get("dominant_pct", 0) >= 0.60 else "medium",
                    "subject": entry.get("care_category", "—"),
                    "recommendation": entry["recommendation"],
                }
            )

    # Deduplicate and sort: high → medium → low; then alphabetically by subject
    seen: set = set()
    unique_recs = []
    for rec in recs:
        key = (rec["source"], rec["subject"], rec["recommendation"])
        if key not in seen:
            seen.add(key)
            unique_recs.append(rec)

    return sorted(
        unique_recs,
        key=lambda r: (_SEVERITY_ORDER.get(r.get("severity", "low"), 2), r.get("subject", "")),
    )


# ---------------------------------------------------------------------------
# 7. Top-level calibration diagnostics call
# ---------------------------------------------------------------------------


def calibration_diagnostics(
    rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Run all calibration diagnostics and return findings + recommendations.

    Safe when data is sparse: each sub-function requires ≥ 3 samples before
    raising a signal, and returns an empty list when there is insufficient data.

    Returns:
    - high_confidence_low_acceptance (list)
    - low_confidence_high_success (list)
    - care_category_drift (list)
    - provider_drift (list)
    - taxonomy_clusters (list)
    - recommendations (list): synthesised priority list
    - has_signals (bool): True when any diagnostic found at least one signal
    """
    rows_list = list(rows)  # materialise once

    diagnostics: Dict[str, Any] = {
        "high_confidence_low_acceptance": high_confidence_low_acceptance_mismatches(rows_list),
        "low_confidence_high_success": low_confidence_high_success_mismatches(rows_list),
        "care_category_drift": care_category_calibration_drift(rows_list),
        "provider_drift": provider_calibration_drift(rows_list),
        "taxonomy_clusters": rejection_taxonomy_clusters(rows_list),
    }
    diagnostics["recommendations"] = calibration_recommendations(diagnostics)
    diagnostics["has_signals"] = any(
        bool(v)
        for k, v in diagnostics.items()
        if k not in ("recommendations", "has_signals")
    )
    return diagnostics
