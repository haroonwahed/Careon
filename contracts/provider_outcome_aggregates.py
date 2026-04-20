"""Provider Outcome Aggregates – outcome-informed feedback loop.

Purpose
-------
Aggregates ``ProviderEvaluation`` outcomes into structured signals that
improve matching quality, risk signaling, and Regiekamer operational insight.

Design rules
------------
- Pure read-only query layer.  No side effects, no writes.
- All logic is deterministic and rule-based.
- No generative explanations; only signals derived from recorded outcomes.
- Two public aggregate builders:
  1. ``build_provider_evaluation_aggregates`` — overall per-provider signals.
  2. ``build_provider_context_aggregates`` — context-aware (care-category,
     urgency, region) signals for a specific match scenario.
- ``derive_evaluation_signals`` maps aggregates to actionable signal codes.
- ``apply_evaluation_outcome_to_candidate`` enriches a matching candidate row
  with outcome-derived warnings, guidance, and confidence adjustments without
  directly overwriting the base match_score.

Public API
----------
build_provider_evaluation_aggregates(provider_id)               -> Dict
build_provider_context_aggregates(provider_id, ...)             -> Dict
derive_evaluation_signals(aggregates)                           -> Dict
apply_evaluation_outcome_to_candidate(row, agg, ctx_agg=None)   -> Dict   (mutates row in place, returns it)
build_regiekamer_provider_health(organization)                  -> Dict
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Threshold constants
# ---------------------------------------------------------------------------

# Minimum evaluations before rates are considered reliable.
_MIN_EVALUATIONS_SUFFICIENT = 3

# Acceptance rate below which a confidence penalty is applied.
_LOW_ACCEPTANCE_THRESHOLD = 0.40
_VERY_LOW_ACCEPTANCE_THRESHOLD = 0.20

# Rejection rate above which a warning flag is emitted.
_HIGH_REJECTION_THRESHOLD = 0.60

# needs_more_info rate above which verification guidance is surfaced.
_HIGH_NEEDS_INFO_THRESHOLD = 0.30

# Capacity flag rate above which a capacity reliability concern is raised.
_HIGH_CAPACITY_FLAG_THRESHOLD = 0.40

# Regiekamer: minimum evaluations for a provider to appear in health summary.
_REGIEKAMER_MIN_EVALUATIONS = 3

# Confidence penalty weights (applied as a float reduction to confidence label).
# These are qualitative; actual score adjustment is handled by the caller.
_PENALTY_LOW_ACCEPTANCE = 0.10       # -10 pp on effective confidence
_PENALTY_VERY_LOW_ACCEPTANCE = 0.20  # -20 pp


# ---------------------------------------------------------------------------
# Empty defaults
# ---------------------------------------------------------------------------

def _empty_aggregates() -> Dict[str, Any]:
    return {
        "total_evaluations": 0,
        "acceptance_count": 0,
        "rejection_count": 0,
        "needs_more_info_count": 0,
        "acceptance_rate": None,
        "rejection_rate": None,
        "needs_more_info_rate": None,
        "top_rejection_reasons": [],
        "capacity_flag_count": 0,
        "capacity_reliability_signal": None,
        "evidence_level": "none",
    }


# ---------------------------------------------------------------------------
# Public builders
# ---------------------------------------------------------------------------


def build_provider_evaluation_aggregates(provider_id: Any) -> Dict[str, Any]:
    """Return overall ProviderEvaluation outcome aggregates for *provider_id*.

    Aggregated fields
    -----------------
    total_evaluations : int
    acceptance_count : int
    rejection_count : int
    needs_more_info_count : int
    acceptance_rate : float | None  (0.0–1.0)
    rejection_rate : float | None   (0.0–1.0)
    needs_more_info_rate : float | None (0.0–1.0)
    top_rejection_reasons : list[dict]  [{reason_code, count, label}]
    capacity_flag_count : int
    capacity_reliability_signal : str | None  (stable | limited | often_full)
    evidence_level : str  (none | limited | sufficient)
    """
    if provider_id is None:
        return _empty_aggregates()

    from contracts.models import ProviderEvaluation

    rows = list(
        ProviderEvaluation.objects.filter(provider_id=provider_id).values(
            "decision",
            "reason_code",
            "capacity_flag",
        )
    )

    return _compute_aggregates(rows)


def build_provider_context_aggregates(
    provider_id: Any,
    *,
    care_category_id: Any = None,
    urgency: Any = None,
    region_id: Any = None,
) -> Dict[str, Any]:
    """Return ProviderEvaluation aggregates scoped to a care context.

    At least one context filter should be supplied; when all are None the
    result equals ``build_provider_evaluation_aggregates``.

    Parameters
    ----------
    provider_id : int | str | None
    care_category_id : int | None  — ``case__care_category_main_id``
    urgency : str | None           — ``case__urgency``
    region_id : int | None         — ``case__regio_id`` or ``case__preferred_region_id``
    """
    if provider_id is None:
        return _empty_aggregates()

    from contracts.models import ProviderEvaluation

    filters: Dict[str, Any] = {"provider_id": provider_id}
    if care_category_id is not None:
        filters["case__care_category_main_id"] = care_category_id
    if urgency is not None:
        filters["case__urgency"] = urgency
    if region_id is not None:
        from django.db.models import Q
        rows = list(
            ProviderEvaluation.objects.filter(
                **filters,
            ).filter(
                Q(case__regio_id=region_id) | Q(case__preferred_region_id=region_id)
            ).values("decision", "reason_code", "capacity_flag")
        )
        return _compute_aggregates(rows)

    rows = list(
        ProviderEvaluation.objects.filter(**filters).values(
            "decision", "reason_code", "capacity_flag"
        )
    )
    return _compute_aggregates(rows)


# ---------------------------------------------------------------------------
# Signal derivation
# ---------------------------------------------------------------------------


def derive_evaluation_signals(aggregates: Dict[str, Any]) -> Dict[str, Any]:
    """Map raw outcome aggregates to actionable signal codes.

    Returns
    -------
    dict with keys:
    ``confidence_penalty`` : float (0.0 = no penalty, >0 = reduce confidence)
    ``warning_flags``      : list[str]  — shown as warning chips in the UI
    ``verification_guidance`` : list[str] — shown as verification advice
    ``capacity_concern``   : bool
    ``has_sufficient_data``: bool
    ``summary_label``      : str | None  — short Dutch label for UI display
    """
    total = int(aggregates.get("total_evaluations") or 0)
    acceptance_rate = aggregates.get("acceptance_rate")
    rejection_rate = aggregates.get("rejection_rate")
    needs_more_info_rate = aggregates.get("needs_more_info_rate")
    capacity_reliability = aggregates.get("capacity_reliability_signal")
    top_reasons = aggregates.get("top_rejection_reasons") or []
    evidence_level = aggregates.get("evidence_level", "none")

    has_sufficient_data = evidence_level == "sufficient"
    confidence_penalty = 0.0
    warning_flags: List[str] = []
    verification_guidance: List[str] = []
    capacity_concern = False
    summary_label: Optional[str] = None

    if not has_sufficient_data:
        # Sparse history — no actionable signals yet.
        return {
            "confidence_penalty": 0.0,
            "warning_flags": [],
            "verification_guidance": ["Beperkte beoordelingshistorie beschikbaar voor deze aanbieder."] if total > 0 else [],
            "capacity_concern": False,
            "has_sufficient_data": False,
            "summary_label": None,
        }

    # ── Acceptance signals ─────────────────────────────────────────────────
    if acceptance_rate is not None:
        if acceptance_rate < _VERY_LOW_ACCEPTANCE_THRESHOLD:
            confidence_penalty = _PENALTY_VERY_LOW_ACCEPTANCE
            warning_flags.append("evaluation_very_low_acceptance")
            summary_label = f"Lage acceptatiegraad ({round(acceptance_rate * 100)}%)"
        elif acceptance_rate < _LOW_ACCEPTANCE_THRESHOLD:
            confidence_penalty = _PENALTY_LOW_ACCEPTANCE
            warning_flags.append("evaluation_low_acceptance")
            summary_label = f"Acceptatiegraad {round(acceptance_rate * 100)}% – let op"

    # ── Rejection pattern signals ──────────────────────────────────────────
    if rejection_rate is not None and rejection_rate > _HIGH_REJECTION_THRESHOLD:
        warning_flags.append("evaluation_high_rejection_rate")
        if not summary_label:
            summary_label = f"Hoog afwijzingspercentage ({round(rejection_rate * 100)}%)"

    if top_reasons:
        top_code = top_reasons[0].get("reason_code", "")
        if top_code == "no_capacity":
            warning_flags.append("evaluation_repeated_no_capacity")
            capacity_concern = True
        elif top_code == "specialization_mismatch":
            verification_guidance.append(
                "Controleer specialisatiefit: aanbieder wijst regelmatig af wegens specialisatiemismatch."
            )
        elif top_code == "urgency_not_supported":
            verification_guidance.append(
                "Verifieer of de aanbieder de benodigde urgentieniveau ondersteunt."
            )
        elif top_code == "region_not_supported":
            verification_guidance.append(
                "Bevestig regiofit: aanbieder wijst regelmatig af wegens regio."
            )
        elif top_code == "risk_too_high":
            warning_flags.append("evaluation_repeated_risk_rejection")
            verification_guidance.append(
                "Aanbieder wijst regelmatig af wegens risico — overweeg alternatieve aanbieder."
            )

    # ── Needs-more-info signals ────────────────────────────────────────────
    if needs_more_info_rate is not None and needs_more_info_rate > _HIGH_NEEDS_INFO_THRESHOLD:
        warning_flags.append("evaluation_frequent_info_requests")
        verification_guidance.append(
            "Aanbieder vraagt regelmatig extra informatie — zorg voor volledig dossier vóór voordracht."
        )

    # ── Capacity reliability ───────────────────────────────────────────────
    if capacity_reliability in {"limited", "often_full"}:
        capacity_concern = True
        warning_flags.append("evaluation_capacity_unreliable")
        if not any("capaciteit" in g.lower() for g in verification_guidance):
            verification_guidance.append(
                "Aanbieder heeft beperkte capaciteitsbetrouwbaarheid op basis van eerdere beoordelingen."
            )

    return {
        "confidence_penalty": round(confidence_penalty, 4),
        "warning_flags": warning_flags,
        "verification_guidance": verification_guidance,
        "capacity_concern": capacity_concern,
        "has_sufficient_data": has_sufficient_data,
        "summary_label": summary_label,
    }


# ---------------------------------------------------------------------------
# Matching candidate enrichment
# ---------------------------------------------------------------------------


def apply_evaluation_outcome_to_candidate(
    candidate_row: Dict[str, Any],
    aggregates: Dict[str, Any],
    context_aggregates: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Enrich a matching candidate row with evaluation-outcome signals.

    Mutates *candidate_row* in place and returns it.

    The match_score is reduced by the confidence penalty when the provider
    has sufficient history and a low acceptance rate.  The penalty is capped
    so that a good static fit score is only modestly reduced.

    Adds or extends these keys on *candidate_row*:
    ``evaluation_warnings``        : list[str]
    ``evaluation_guidance``        : list[str]
    ``evaluation_summary_label``   : str | None
    ``evaluation_capacity_concern``: bool
    ``evaluation_aggregates``      : dict  (raw aggregates for drill-down)
    ``evaluation_signals``         : dict  (derived signal dict)
    """
    overall_signals = derive_evaluation_signals(aggregates)

    # Context-aware signals (may confirm or deepen overall signals).
    ctx_signals: Dict[str, Any] = {}
    if context_aggregates is not None and context_aggregates.get("total_evaluations", 0) > 0:
        ctx_signals = derive_evaluation_signals(context_aggregates)

    # Merge warning flags (context signals add specificity).
    merged_warnings = list(overall_signals.get("warning_flags") or [])
    for flag in (ctx_signals.get("warning_flags") or []):
        contextual_flag = f"{flag}_in_context"
        if contextual_flag not in merged_warnings:
            merged_warnings.append(contextual_flag)

    # Merge verification guidance (prefer context-specific).
    merged_guidance = list(ctx_signals.get("verification_guidance") or []) + [
        g for g in (overall_signals.get("verification_guidance") or [])
        if g not in (ctx_signals.get("verification_guidance") or [])
    ]

    # Apply confidence penalty to match_score.
    penalty = max(
        overall_signals.get("confidence_penalty") or 0.0,
        ctx_signals.get("confidence_penalty") or 0.0,
    )
    if penalty > 0:
        current_score = float(candidate_row.get("match_score") or 0)
        penalized_score = max(0.0, current_score - penalty * 100)
        candidate_row["match_score"] = round(penalized_score, 1)

        # Downgrade confidence label when penalty is significant.
        if penalty >= _PENALTY_VERY_LOW_ACCEPTANCE:
            candidate_row["confidence_label"] = "low"
        elif penalty >= _PENALTY_LOW_ACCEPTANCE:
            current_confidence = candidate_row.get("confidence_label") or ""
            if current_confidence == "high":
                candidate_row["confidence_label"] = "medium"

    # Extend existing trade_offs with evaluation-derived warnings.
    existing_trade_offs = list(candidate_row.get("trade_offs") or [])
    if overall_signals.get("summary_label") and overall_signals["summary_label"] not in existing_trade_offs:
        existing_trade_offs.append(overall_signals["summary_label"])
    elif ctx_signals.get("summary_label") and ctx_signals["summary_label"] not in existing_trade_offs:
        existing_trade_offs.append(ctx_signals["summary_label"])
    candidate_row["trade_offs"] = existing_trade_offs

    # Extend verificatie_advies (string field in matching candidates).
    existing_advice = str(candidate_row.get("verificatie_advies") or "").strip()
    if merged_guidance:
        extra = "; ".join(merged_guidance)
        candidate_row["verificatie_advies"] = f"{existing_advice}; {extra}".strip("; ") if existing_advice else extra

    capacity_concern = overall_signals.get("capacity_concern") or ctx_signals.get("capacity_concern")

    candidate_row["evaluation_warnings"] = merged_warnings
    candidate_row["evaluation_guidance"] = merged_guidance
    candidate_row["evaluation_summary_label"] = overall_signals.get("summary_label")
    candidate_row["evaluation_capacity_concern"] = bool(capacity_concern)
    candidate_row["evaluation_aggregates"] = aggregates
    candidate_row["evaluation_signals"] = overall_signals

    return candidate_row


# ---------------------------------------------------------------------------
# Regiekamer provider health summary
# ---------------------------------------------------------------------------


def build_regiekamer_provider_health(organization: Any) -> Dict[str, Any]:
    """Return provider health signals for the Regiekamer dashboard.

    Scoped to the given *organization*.

    Returns
    -------
    dict with keys:
    ``high_rejection_providers``   : list[dict]  — providers with high rejection rates
    ``unstable_capacity_providers``: list[dict]  — providers with frequent capacity issues
    ``bouncing_cases``             : list[dict]  — cases repeatedly cycling through evaluation
    ``provider_health_summary``    : dict  — {at_risk, unstable_capacity, bouncing} counts
    """
    if not organization or not getattr(organization, "pk", None):
        return _empty_provider_health()

    try:
        return _compute_provider_health(organization)
    except Exception:
        logger.exception("build_regiekamer_provider_health failed for org %s", organization.pk)
        return _empty_provider_health()


def _empty_provider_health() -> Dict[str, Any]:
    return {
        "high_rejection_providers": [],
        "unstable_capacity_providers": [],
        "bouncing_cases": [],
        "provider_health_summary": {"at_risk": 0, "unstable_capacity": 0, "bouncing": 0},
    }


def _compute_provider_health(organization: Any) -> Dict[str, Any]:
    from django.db.models import Count, Q
    from contracts.models import ProviderEvaluation

    # Provider-level evaluation counts scoped to organization.
    provider_agg = list(
        ProviderEvaluation.objects.filter(case__organization=organization)
        .values("provider_id", "provider__name", "decision", "reason_code", "capacity_flag")
    )

    # Group by provider.
    from collections import defaultdict
    by_provider: Dict[Any, List[Dict]] = defaultdict(list)
    for row in provider_agg:
        by_provider[row["provider_id"]].append(row)

    high_rejection_providers = []
    unstable_capacity_providers = []

    for provider_id, rows in by_provider.items():
        total = len(rows)
        if total < _REGIEKAMER_MIN_EVALUATIONS:
            continue

        accepted = sum(1 for r in rows if r["decision"] == "accept")
        rejected = sum(1 for r in rows if r["decision"] == "reject")
        cap_flagged = sum(1 for r in rows if r.get("capacity_flag"))

        acceptance_rate = round(accepted / total, 4) if total > 0 else None
        rejection_rate = round(rejected / total, 4) if total > 0 else None
        cap_rate = round(cap_flagged / total, 4) if total > 0 else None

        provider_name = rows[0].get("provider__name") or f"Provider {provider_id}"

        if rejection_rate is not None and rejection_rate > _HIGH_REJECTION_THRESHOLD:
            reason_counts = Counter(
                r.get("reason_code") for r in rows if r["decision"] == "reject" and r.get("reason_code")
            )
            top_reason = reason_counts.most_common(1)[0][0] if reason_counts else None
            high_rejection_providers.append({
                "provider_id": provider_id,
                "provider_name": provider_name,
                "total_evaluations": total,
                "rejection_rate": rejection_rate,
                "acceptance_rate": acceptance_rate,
                "top_rejection_reason": top_reason,
            })

        if cap_rate is not None and cap_rate > _HIGH_CAPACITY_FLAG_THRESHOLD:
            unstable_capacity_providers.append({
                "provider_id": provider_id,
                "provider_name": provider_name,
                "total_evaluations": total,
                "capacity_flag_rate": cap_rate,
            })

    # Cases bouncing: multiple evaluations, no acceptance.
    from contracts.models import CaseIntakeProcess
    bouncing_case_rows = list(
        ProviderEvaluation.objects.filter(case__organization=organization)
        .values("case_id", "case__title")
        .annotate(eval_count=Count("id"), accept_count=Count("id", filter=Q(decision="accept")))
        .filter(eval_count__gte=2, accept_count=0)
        .order_by("-eval_count")[:20]
    )
    bouncing_cases = [
        {
            "case_id": row["case_id"],
            "case_title": row["case__title"] or f"Casus {row['case_id']}",
            "evaluation_count": row["eval_count"],
        }
        for row in bouncing_case_rows
    ]

    return {
        "high_rejection_providers": high_rejection_providers,
        "unstable_capacity_providers": unstable_capacity_providers,
        "bouncing_cases": bouncing_cases,
        "provider_health_summary": {
            "at_risk": len(high_rejection_providers),
            "unstable_capacity": len(unstable_capacity_providers),
            "bouncing": len(bouncing_cases),
        },
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _compute_aggregates(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate a flat list of ProviderEvaluation value dicts."""
    from contracts.models import ProviderEvaluation

    total = len(rows)
    if total == 0:
        return _empty_aggregates()

    acceptance_count = sum(1 for r in rows if r.get("decision") == ProviderEvaluation.Decision.ACCEPT)
    rejection_count = sum(1 for r in rows if r.get("decision") == ProviderEvaluation.Decision.REJECT)
    needs_more_info_count = sum(
        1 for r in rows if r.get("decision") == ProviderEvaluation.Decision.NEEDS_MORE_INFO
    )
    capacity_flag_count = sum(1 for r in rows if r.get("capacity_flag"))

    acceptance_rate = round(acceptance_count / total, 4)
    rejection_rate = round(rejection_count / total, 4)
    needs_more_info_rate = round(needs_more_info_count / total, 4)

    reason_counts = Counter(
        r.get("reason_code")
        for r in rows
        if r.get("decision") == ProviderEvaluation.Decision.REJECT and r.get("reason_code")
    )
    top_rejection_reasons = [
        {"reason_code": code, "count": count, "label": _rejection_code_label(code)}
        for code, count in reason_counts.most_common(5)
    ]

    capacity_reliability_signal = _capacity_reliability_signal(capacity_flag_count, total)
    evidence_level = "sufficient" if total >= _MIN_EVALUATIONS_SUFFICIENT else "limited"

    return {
        "total_evaluations": total,
        "acceptance_count": acceptance_count,
        "rejection_count": rejection_count,
        "needs_more_info_count": needs_more_info_count,
        "acceptance_rate": acceptance_rate,
        "rejection_rate": rejection_rate,
        "needs_more_info_rate": needs_more_info_rate,
        "top_rejection_reasons": top_rejection_reasons,
        "capacity_flag_count": capacity_flag_count,
        "capacity_reliability_signal": capacity_reliability_signal,
        "evidence_level": evidence_level,
    }


def _capacity_reliability_signal(capacity_flag_count: int, total: int) -> Optional[str]:
    if total == 0:
        return None
    rate = capacity_flag_count / total
    if rate >= _HIGH_CAPACITY_FLAG_THRESHOLD:
        return "often_full"
    if rate >= 0.20:
        return "limited"
    return "stable"


_REJECTION_CODE_LABELS: Dict[str, str] = {
    "no_capacity": "Geen capaciteit",
    "specialization_mismatch": "Specialisatie past niet",
    "urgency_not_supported": "Urgentie niet ondersteund",
    "region_not_supported": "Regio niet ondersteund",
    "missing_information": "Informatie ontbreekt",
    "risk_too_high": "Risico te hoog",
    "other": "Anders",
}


def _rejection_code_label(code: str) -> str:
    return _REJECTION_CODE_LABELS.get(str(code or "").lower(), code)
