"""
Regiekamer Decision Service
===========================

Computes the full Regiekamer dashboard summary from pre-scoped querysets.

Design contract
---------------
- Views gather scoped querysets and pass them in; no request object or
  HTTP concerns enter this module.
- All URL construction uses django.urls.reverse — no hard-coded paths.
- Organisation scoping is enforced by the caller (dashboard view) before
  calling build_regiekamer_summary.
- Fallback-safe: every computation degrades gracefully to zero/neutral
  when data is missing or empty.

SPA override note
-----------------
The dashboard() view in views.py serves the React SPA from
  theme/static/spa/index.html
when that file exists, bypassing the server-rendered template entirely.
The service is fully implemented and ready; template rendering is active
only when the SPA file is absent (e.g. during local development without a
build, or after intentional removal). The SPA should be wired to a
dedicated API endpoint in a future phase to consume this decision data.

Template contract (preserved + extended)
-----------------------------------------
Existing keys (unchanged):
    recommended_action, regiekamer_kpis, priority_queue, next_actions,
    capacity_signals, bottleneck_signals, signal_items, operational_insights,
    alert_strip, active_case

New keys added (additive, no breaking change):
    flow_counts       – per-phase case counts for the flow bar
    command_bar       – structured command bar data (problem/consequence/action)
    bottleneck_stage  – dominant bottleneck stage code (or 'none')
    priority_cards    – enriched KPI cards with contextual CTAs
    signal_strips     – 2-3 secondary signal strip items
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from django.db.models import Q, QuerySet
from django.urls import reverse

from .models import (
    CareSignal,
    CaseAssessment,
    CaseIntakeProcess,
    PlacementRequest,
    ProviderProfile,
    TrustAccount,
)

from .regiekamer_forecasting import build_predictive_summary

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

WAITING_THRESHOLD_DAYS = 7
REGION_OVERLOAD_THRESHOLD = 5

_URGENCY_WEIGHT: dict[str, int] = {
    CaseIntakeProcess.Urgency.CRISIS: 400,
    CaseIntakeProcess.Urgency.HIGH: 300,
    CaseIntakeProcess.Urgency.MEDIUM: 200,
    CaseIntakeProcess.Urgency.LOW: 100,
}

_PHASE_RANK: dict[str, int] = {
    CaseIntakeProcess.ProcessStatus.INTAKE: 1,
    CaseIntakeProcess.ProcessStatus.ASSESSMENT: 2,
    CaseIntakeProcess.ProcessStatus.MATCHING: 3,
    CaseIntakeProcess.ProcessStatus.DECISION: 4,
    CaseIntakeProcess.ProcessStatus.ON_HOLD: 5,
    CaseIntakeProcess.ProcessStatus.COMPLETED: 6,
}

# Active flow statuses (excludes COMPLETED)
_ACTIVE_STATUSES = [
    CaseIntakeProcess.ProcessStatus.INTAKE,
    CaseIntakeProcess.ProcessStatus.ASSESSMENT,
    CaseIntakeProcess.ProcessStatus.MATCHING,
    CaseIntakeProcess.ProcessStatus.DECISION,
    CaseIntakeProcess.ProcessStatus.ON_HOLD,
]

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _phase_rank(status: str) -> int:
    return _PHASE_RANK.get(status, 99)


def _next_best_action(intake: Any, assessment: Any, placement: Any) -> dict[str, str]:
    """Return a single next-action dict for a given intake state."""
    S = CaseIntakeProcess.ProcessStatus
    if intake.status == S.INTAKE:
        return {
            "label": "Start beoordeling",
            "href": reverse("careon:assessment_create") + f"?intake={intake.pk}",
            "type": "review",
        }
    if intake.status == S.ASSESSMENT:
        if assessment:
            return {
                "label": "Rond beoordeling af",
                "href": reverse("careon:assessment_update", args=[assessment.pk]),
                "type": "review",
            }
        return {
            "label": "Start beoordeling",
            "href": reverse("careon:assessment_create") + f"?intake={intake.pk}",
            "type": "review",
        }
    if intake.status in (S.MATCHING, S.DECISION):
        return {
            "label": "Koppel aanbieder",
            "href": reverse("careon:matching_dashboard") + f"?intake={intake.pk}",
            "type": "assign",
        }
    if intake.status == S.ON_HOLD:
        return {
            "label": "Escaleer blokkade",
            "href": reverse("careon:case_signal_create", args=[intake.pk]),
            "type": "escalate",
        }
    return {
        "label": "Monitor voortgang",
        "href": reverse("careon:case_detail", args=[intake.pk]),
        "type": "monitor",
    }


def _safe_avg(values: list[int | float]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


# ---------------------------------------------------------------------------
# Core issue-bucket computation
# ---------------------------------------------------------------------------


def _compute_issue_buckets(
    *,
    active_intakes: list[Any],
    placement_by_intake: dict[int, Any],
    signals_by_intake: dict[int, list[Any]],
    today: date,
) -> dict[str, Any]:
    """
    Derive all issue buckets from real model data.

    Returns a dict of named counts plus a per-intake enriched record list
    used by the priority queue builder.
    """
    S = CaseIntakeProcess.ProcessStatus
    AS = CaseAssessment.AssessmentStatus
    PR = PlacementRequest
    CS = CareSignal

    blocked_intake_ids: set[int] = set()
    open_beoordelingen_ids: set[int] = set()
    cases_without_match_ids: set[int] = set()
    waiting_time_exceeded_ids: set[int] = set()
    placements_pending_ids: set[int] = set()
    high_risk_ids: set[int] = set()

    enriched: list[dict[str, Any]] = []

    for intake in active_intakes:
        assessment = getattr(intake, "case_assessment", None)
        placement = placement_by_intake.get(intake.pk)
        open_signals = signals_by_intake.get(intake.pk, [])

        # --- individual flags ---
        waiting_days = max((today - intake.updated_at.date()).days, 0)

        # open_beoordelingen: assessment incomplete / not matching-ready
        _assessment_incomplete = (
            assessment is None
            or assessment.assessment_status in (AS.DRAFT, AS.UNDER_REVIEW, AS.NEEDS_INFO)
        )
        _assessment_needs_info = (
            assessment is not None
            and assessment.assessment_status == AS.NEEDS_INFO
        )
        _assessment_blocked = (
            _assessment_incomplete
            and intake.status in (S.ASSESSMENT, S.MATCHING, S.DECISION)
        )
        if _assessment_incomplete and intake.status not in (S.COMPLETED,):
            open_beoordelingen_ids.add(intake.pk)

        # blocked_cases: cannot proceed to next step
        _placement_needs_info = (
            placement is not None
            and placement.status == PR.Status.NEEDS_INFO
        )
        _placement_stalled_response = placement is not None and (
            placement.provider_response_status
            in (PR.ProviderResponseStatus.NO_CAPACITY, PR.ProviderResponseStatus.WAITLIST)
        )
        _on_hold = intake.status == S.ON_HOLD
        _open_escalation = any(
            s.signal_type in (CS.SignalType.ESCALATION,)
            and s.status in (CS.SignalStatus.OPEN, CS.SignalStatus.IN_PROGRESS)
            for s in open_signals
        )
        if any([
            _assessment_needs_info,
            _placement_needs_info,
            _placement_stalled_response,
            _on_hold,
            _open_escalation,
        ]):
            blocked_intake_ids.add(intake.pk)

        # cases_without_match: in matching/decision but no viable provider path
        _no_selected_provider = placement is None or not getattr(
            placement, "selected_provider_id", None
        )
        _no_match_signal = any(
            s.signal_type == CS.SignalType.NO_MATCH
            and s.status in (CS.SignalStatus.OPEN, CS.SignalStatus.IN_PROGRESS)
            for s in open_signals
        )
        _assessment_approved = (
            assessment is not None
            and assessment.assessment_status == AS.APPROVED_FOR_MATCHING
        )
        _matching_ready = assessment is not None and getattr(
            assessment, "matching_ready", False
        )
        if intake.status in (S.MATCHING, S.DECISION):
            if _no_selected_provider or _no_match_signal:
                cases_without_match_ids.add(intake.pk)

        # waiting_time_exceeded
        _target_passed = (
            intake.target_completion_date is not None
            and intake.target_completion_date < today
        )
        if waiting_days >= WAITING_THRESHOLD_DAYS or _target_passed:
            waiting_time_exceeded_ids.add(intake.pk)

        # placements_pending
        if placement is not None and (
            placement.status in (PR.Status.DRAFT, PR.Status.IN_REVIEW)
            or placement.provider_response_status == PR.ProviderResponseStatus.PENDING
        ):
            placements_pending_ids.add(intake.pk)

        # high_risk: CRISIS/HIGH urgency or serious open signals
        _urgent = intake.urgency in (
            CaseIntakeProcess.Urgency.HIGH,
            CaseIntakeProcess.Urgency.CRISIS,
        )
        _serious_signal = any(
            s.signal_type in (CS.SignalType.ESCALATION, CS.SignalType.DROPOUT_RISK)
            and s.status in (CS.SignalStatus.OPEN, CS.SignalStatus.IN_PROGRESS)
            for s in open_signals
        )
        if _urgent or _serious_signal:
            high_risk_ids.add(intake.pk)

        # high-priority signal (for blocker label)
        high_signal = next(
            (
                s
                for s in open_signals
                if s.risk_level in (CareSignal.RiskLevel.CRITICAL, CareSignal.RiskLevel.HIGH)
            ),
            None,
        )

        # build blocker label (one dominant reason per case)
        blockers: list[dict[str, Any]] = []
        if intake.pk in blocked_intake_ids and _on_hold:
            blockers.append({"key": "on_hold", "label": "Op hold", "score": 130})
        if intake.pk in blocked_intake_ids and _open_escalation:
            blockers.append({"key": "escalation", "label": "Escalatie open", "score": 125})
        if intake.pk in cases_without_match_ids:
            blockers.append({"key": "no_match", "label": "Geen match", "score": 120})
        if intake.pk in blocked_intake_ids and _assessment_needs_info:
            blockers.append({"key": "needs_info", "label": "Aanvulling vereist", "score": 115})
        if intake.pk in blocked_intake_ids and (_placement_needs_info or _placement_stalled_response):
            blockers.append({"key": "placement_blocked", "label": "Plaatsing geblokkeerd", "score": 110})
        if open_beoordelingen_ids and intake.pk in open_beoordelingen_ids and _assessment_incomplete:
            blockers.append({"key": "missing_assessment", "label": "Beoordeling ontbreekt", "score": 100})
        if intake.pk in waiting_time_exceeded_ids:
            blockers.append({"key": "waiting_long", "label": "Wacht te lang", "score": 90})
        if high_signal:
            blockers.append(
                {"key": "risk_signal", "label": high_signal.get_signal_type_display(), "score": 95}
            )

        blocker = max(blockers, key=lambda b: b["score"]) if blockers else None

        enriched.append(
            {
                "intake": intake,
                "assessment": assessment,
                "placement": placement,
                "open_signals": open_signals,
                "waiting_days": waiting_days,
                "blocker": blocker,
                "is_urgent": _urgent,
                "has_match_issue": intake.pk in cases_without_match_ids,
                "is_waiting_long": intake.pk in waiting_time_exceeded_ids,
                "weak_matching": placement is not None
                and placement.placement_quality_status
                in (
                    PR.PlacementQualityStatus.AT_RISK,
                    PR.PlacementQualityStatus.BROKEN_DOWN,
                ),
            }
        )

    return {
        "open_beoordelingen": len(open_beoordelingen_ids),
        "blocked_cases": len(blocked_intake_ids),
        "cases_without_match": len(cases_without_match_ids),
        "waiting_time_exceeded": len(waiting_time_exceeded_ids),
        "placements_pending": len(placements_pending_ids),
        "high_risk_cases": len(high_risk_ids),
        # individual ID sets for cross-lookup
        "_blocked_ids": blocked_intake_ids,
        "_open_beoordelingen_ids": open_beoordelingen_ids,
        "_without_match_ids": cases_without_match_ids,
        "_exceeded_ids": waiting_time_exceeded_ids,
        "_pending_ids": placements_pending_ids,
        "_high_risk_ids": high_risk_ids,
        # enriched per-intake records
        "_enriched": enriched,
    }


# ---------------------------------------------------------------------------
# Flow counts
# ---------------------------------------------------------------------------


def _compute_flow_counts(active_intakes: list[Any]) -> dict[str, int]:
    S = CaseIntakeProcess.ProcessStatus
    counts: dict[str, int] = {
        "casussen": 0,
        "beoordelingen": 0,
        "matching": 0,
        "plaatsingen": 0,
        "on_hold": 0,
    }
    for intake in active_intakes:
        if intake.status == S.INTAKE:
            counts["casussen"] += 1
        elif intake.status == S.ASSESSMENT:
            counts["beoordelingen"] += 1
        elif intake.status == S.MATCHING:
            counts["matching"] += 1
        elif intake.status == S.DECISION:
            counts["plaatsingen"] += 1
        elif intake.status == S.ON_HOLD:
            counts["on_hold"] += 1
    return counts


# ---------------------------------------------------------------------------
# Bottleneck stage
# ---------------------------------------------------------------------------


def _compute_bottleneck_stage(buckets: dict[str, Any]) -> str:
    """
    Determine the dominant bottleneck stage.
    Priority: blocked > beoordelingen > matching > plaatsingen > casussen > none
    """
    if buckets["open_beoordelingen"] > 0 and buckets["open_beoordelingen"] >= buckets["cases_without_match"]:
        return "beoordelingen"
    if buckets["cases_without_match"] > 0:
        return "matching"
    if buckets["placements_pending"] > 0:
        return "plaatsingen"
    if buckets["blocked_cases"] > 0:
        # blocked but not fitting a specific stage → casussen
        return "casussen"
    return "none"


# ---------------------------------------------------------------------------
# Priority queue
# ---------------------------------------------------------------------------


def _build_priority_queue(enriched: list[dict[str, Any]]) -> list[dict[str, Any]]:
    queue = []
    for record in enriched:
        intake = record["intake"]
        assessment = record["assessment"]
        placement = record["placement"]
        blocker = record["blocker"]
        open_signals = record["open_signals"]
        waiting_days = record["waiting_days"]

        priority_score = _URGENCY_WEIGHT.get(intake.urgency, 0) + min(waiting_days, 30) * 5
        if blocker:
            priority_score += blocker["score"]
        if intake.status in (
            CaseIntakeProcess.ProcessStatus.MATCHING,
            CaseIntakeProcess.ProcessStatus.DECISION,
        ):
            priority_score += 35

        next_action = _next_best_action(intake, assessment, placement)

        queue.append(
            {
                "id": intake.pk,
                "title": intake.title,
                "phase": intake.get_status_display(),
                "phase_code": intake.status,
                "phase_rank": _phase_rank(intake.status),
                "urgency": intake.get_urgency_display(),
                "urgency_code": intake.urgency,
                "care_form": intake.get_preferred_care_form_display()
                if hasattr(intake, "get_preferred_care_form_display")
                else "",
                "region": intake.preferred_region.region_name
                if intake.preferred_region
                else "Onbekend",
                "waiting_days": waiting_days,
                "waiting_label": f"{waiting_days}d",
                "blocker": blocker["label"] if blocker else "Geen directe blokkade",
                "blocker_key": blocker["key"] if blocker else None,
                "signal_count": len(open_signals),
                "next_action": next_action,
                "case_href": reverse("careon:case_detail", args=[intake.pk]),
                "quick_assign_href": reverse("careon:matching_dashboard")
                + f"?intake={intake.pk}",
                "quick_escalate_href": reverse(
                    "careon:case_signal_create", args=[intake.pk]
                ),
                "quick_review_href": (
                    reverse("careon:assessment_update", args=[assessment.pk])
                    if assessment
                    else reverse("careon:assessment_create") + f"?intake={intake.pk}"
                ),
                "assessment_status": assessment.get_assessment_status_display()
                if assessment
                else "Niet gestart",
                "placement_status": placement.get_status_display()
                if placement
                else "Niet gestart",
                "placement_status_code": placement.status if placement else "",
                "has_match_issue": record["has_match_issue"]
                or record.get("weak_matching", False),
                "is_waiting_long": record["is_waiting_long"],
                "is_urgent": record["is_urgent"],
                "priority_score": priority_score,
            }
        )

    queue.sort(
        key=lambda row: (
            -row["priority_score"],
            row["phase_rank"],
            -row["waiting_days"],
        )
    )
    return queue


# ---------------------------------------------------------------------------
# Command bar
# ---------------------------------------------------------------------------


def _build_command_bar(buckets: dict[str, Any], bottleneck_stage: str) -> dict[str, Any]:
    """
    Derive command bar summary using the priority order:
    1. blocked_cases
    2. open_beoordelingen
    3. cases_without_match
    4. capacity_shortages (passed in via buckets)
    5. waiting_time_exceeded
    6. placements_pending
    7. monitor state (fallback)

    Returns Dutch problem → consequence → action copy.
    """
    blocked = buckets["blocked_cases"]
    open_beoordelingen = buckets["open_beoordelingen"]
    without_match = buckets["cases_without_match"]
    waiting_exceeded = buckets["waiting_time_exceeded"]
    pending = buckets["placements_pending"]
    high_risk = buckets["high_risk_cases"]
    capacity = buckets.get("capacity_shortages", 0)

    if blocked > 0:
        return {
            "problem": f"{blocked} blokkade{'s' if blocked > 1 else ''} stoppen doorstroom",
            "consequence": f"Daardoor wachten casussen op vervolgstap",
            "action": "Verwijder de blokkades",
            "reason": f"{blocked} casus{'sen' if blocked > 1 else ''} staat op hold of mist informatie",
            "cta_label": "Bekijk geblokkeerde casussen →",
            "cta_url": reverse("careon:case_list") + "?attention=urgent",
            "priority": "critical",
        }

    if open_beoordelingen > 0:
        return {
            "problem": f"{open_beoordelingen} beoordeling{'en' if open_beoordelingen > 1 else ''} wacht{'en' if open_beoordelingen > 1 else ''} op afronding",
            "consequence": "Daardoor is matching niet mogelijk",
            "action": "Rond open beoordelingen af",
            "reason": f"Hiermee ontgrendel je matching voor {open_beoordelingen} casus{'sen' if open_beoordelingen > 1 else ''}",
            "cta_label": "Rond beoordeling af →",
            "cta_url": reverse("careon:assessment_list"),
            "priority": "high",
        }

    if without_match > 0:
        return {
            "problem": f"{without_match} casus{'sen' if without_match > 1 else ''} {'hebben' if without_match > 1 else 'heeft'} nog geen match",
            "consequence": "Wachttijd loopt op en plaatsing vertraagt",
            "action": "Controleer beschikbare aanbieders",
            "reason": f"Minimaal {without_match} casus{'sen' if without_match > 1 else ''} {'hebben' if without_match > 1 else 'heeft'} geen passende aanbieder",
            "cta_label": "Zoek aanbieder →",
            "cta_url": reverse("careon:matching_dashboard"),
            "priority": "high",
        }

    if capacity > 0:
        return {
            "problem": f"{capacity} aanbieder{'s' if capacity > 1 else ''} heeft geen vrije capaciteit",
            "consequence": "Matching kan niet worden afgerond zonder alternatieve aanbieder",
            "action": "Controleer aanbiedercapaciteit",
            "reason": "Capaciteitssignalen ontvangen uit de regio",
            "cta_label": "Bekijk capaciteit →",
            "cta_url": reverse("careon:case_list") + "?attention=capacity_none",
            "priority": "warning",
        }

    if waiting_exceeded > 0:
        return {
            "problem": f"{waiting_exceeded} casus{'sen' if waiting_exceeded > 1 else ''} overschrijdt de wachttijdnorm",
            "consequence": "Vertraging vergroot risico op escalatie",
            "action": "Bekijk wachttijdoverschrijdingen",
            "reason": f"Wachttijdnorm van {WAITING_THRESHOLD_DAYS} dagen overschreden",
            "cta_label": "Bekijk vertraging →",
            "cta_url": reverse("careon:case_list") + "?attention=waiting_long",
            "priority": "warning",
        }

    if pending > 0:
        return {
            "problem": f"{pending} plaatsing{'en' if pending > 1 else ''} wacht{'en' if pending > 1 else ''} op bevestiging",
            "consequence": "Aanbieder heeft nog niet gereageerd",
            "action": "Controleer openstaande plaatsingen",
            "reason": f"{pending} plaatsing{'en' if pending > 1 else ''} staat op DRAFT of IN_REVIEW",
            "cta_label": "Controleer status →",
            "cta_url": reverse("careon:placement_list"),
            "priority": "info",
        }

    if high_risk > 0:
        return {
            "problem": f"{high_risk} casus{'sen' if high_risk > 1 else ''} met hoog risico of crisis",
            "consequence": "Escalatie naar gemeente kan vereist zijn",
            "action": "Review urgente casussen",
            "reason": "HOOG of CRISIS urgentie gedetecteerd",
            "cta_label": "Bekijk urgente casussen →",
            "cta_url": reverse("careon:case_list") + "?attention=urgent",
            "priority": "warning",
        }

    # Stable monitoring state
    return {
        "problem": "Doorstroom stabiel",
        "consequence": "Geen directe blokkades op dit moment",
        "action": "Monitor actieve plaatsingen",
        "reason": "Alle casussen zijn in normale voortgang",
        "cta_label": "Bekijk overzicht →",
        "cta_url": reverse("careon:case_list"),
        "priority": "info",
    }


# ---------------------------------------------------------------------------
# Capacity signals
# ---------------------------------------------------------------------------


def _build_capacity_signals(
    org: Any, active_intakes: list[Any]
) -> tuple[list[dict[str, Any]], int]:
    """
    Build capacity signal list from ProviderProfile and region overload.
    Returns (signals_list, shortage_count).
    """
    provider_profiles = (
        ProviderProfile.objects.filter(client__organization=org).select_related("client")
        if org
        else ProviderProfile.objects.none()
    )

    capacity_signals: list[dict[str, Any]] = []
    shortage_count = 0

    for profile in provider_profiles:
        free_slots = max((profile.max_capacity or 0) - (profile.current_capacity or 0), 0)
        if free_slots <= 0:
            shortage_count += 1
            capacity_signals.append(
                {
                    "label": f"{profile.client.name} heeft geen capaciteit",
                    "detail": f"Bezetting {profile.current_capacity}/{profile.max_capacity}",
                    "href": reverse("careon:case_list") + "?attention=capacity_none",
                }
            )
            if len(capacity_signals) >= 3:
                break

    # Region overload signals (up to 3 total)
    region_counts: dict[int, int] = {}
    for intake in active_intakes:
        if intake.preferred_region_id:
            region_counts[intake.preferred_region_id] = (
                region_counts.get(intake.preferred_region_id, 0) + 1
            )

    for region_id, count in sorted(
        region_counts.items(), key=lambda item: item[1], reverse=True
    )[:3]:
        if count < REGION_OVERLOAD_THRESHOLD:
            continue
        if len(capacity_signals) >= 5:
            break
        region_obj = next(
            (i.preferred_region for i in active_intakes if i.preferred_region_id == region_id),
            None,
        )
        if not region_obj:
            continue
        capacity_signals.append(
            {
                "label": f"Regio overbelast: {region_obj.region_name}",
                "detail": f"{count} actieve casussen in deze regio",
                "href": reverse("careon:case_list") + f"?region={region_id}",
            }
        )

    return capacity_signals, shortage_count


# ---------------------------------------------------------------------------
# Priority cards
# ---------------------------------------------------------------------------


def _build_priority_cards(
    buckets: dict[str, Any],
    priority_queue: list[dict[str, Any]],
    capacity_shortage: int,
) -> list[dict[str, Any]]:
    """
    Build enriched KPI cards with contextual CTAs and severity levels.
    """
    without_match = buckets["cases_without_match"]
    open_beoordelingen = buckets["open_beoordelingen"]
    waiting_exceeded = buckets["waiting_time_exceeded"]
    pending = buckets["placements_pending"]
    high_risk = buckets["high_risk_cases"]

    avg_wait = _safe_avg([row["waiting_days"] for row in priority_queue])

    def _severity(count: int, critical_threshold: int = 1, warning_threshold: int = 0) -> str:
        if count > critical_threshold:
            return "critical"
        if count > warning_threshold:
            return "warning"
        return "healthy"

    return [
        {
            "key": "casussen_zonder_match",
            "title": "Casussen zonder match",
            "count": without_match,
            "subtitle": f"{without_match} wachten op aanbieder",
            "severity": _severity(without_match, critical_threshold=2),
            "cta_label": "Zoek aanbieder →",
            "cta_url": reverse("careon:matching_dashboard"),
        },
        {
            "key": "open_beoordelingen",
            "title": "Open beoordelingen",
            "count": open_beoordelingen,
            "subtitle": f"{open_beoordelingen} nog niet afgerond",
            "severity": _severity(open_beoordelingen, critical_threshold=3),
            "cta_label": "Rond beoordeling af →",
            "cta_url": reverse("careon:assessment_list"),
        },
        {
            "key": "wachttijd_overschreden",
            "title": "Wachttijd overschreden",
            "count": waiting_exceeded,
            "subtitle": f"Norm: {WAITING_THRESHOLD_DAYS} dagen",
            "severity": _severity(waiting_exceeded, critical_threshold=2),
            "cta_label": "Bekijk vertraging →",
            "cta_url": reverse("careon:case_list") + "?attention=waiting_long",
        },
        {
            "key": "plaatsingen_bezig",
            "title": "Plaatsingen in behandeling",
            "count": pending,
            "subtitle": f"{pending} wachten op bevestiging",
            "severity": _severity(pending, critical_threshold=3, warning_threshold=1),
            "cta_label": "Controleer status →",
            "cta_url": reverse("careon:placement_list"),
        },
        {
            "key": "gem_wachttijd",
            "title": "Gemiddelde wachttijd",
            "count": avg_wait,
            "subtitle": f"Norm: {WAITING_THRESHOLD_DAYS} dagen",
            "severity": "critical"
            if avg_wait > WAITING_THRESHOLD_DAYS * 2
            else "warning"
            if avg_wait > WAITING_THRESHOLD_DAYS
            else "healthy",
            "cta_label": "Bekijk wachttijden →",
            "cta_url": reverse("careon:waittime_list"),
        },
        {
            "key": "capaciteitstekorten",
            "title": "Capaciteitstekorten",
            "count": capacity_shortage,
            "subtitle": "Signalen uit aanbieders en regio's",
            "severity": _severity(capacity_shortage, critical_threshold=2),
            "cta_label": "Bekijk capaciteit →",
            "cta_url": reverse("careon:case_list") + "?attention=capacity_none",
        },
    ]


# ---------------------------------------------------------------------------
# Signal strips
# ---------------------------------------------------------------------------


def _build_signal_strips(
    buckets: dict[str, Any],
    bottleneck_stage: str,
    priority_queue: list[dict[str, Any]],
    capacity_shortage: int,
) -> list[dict[str, Any]]:
    """
    Build 2-3 secondary signal strip items for issues not dominating the
    command bar. Ordered by importance.
    """
    strips: list[dict[str, Any]] = []

    without_match = buckets["cases_without_match"]
    waiting_exceeded = buckets["waiting_time_exceeded"]
    pending = buckets["placements_pending"]
    high_risk = buckets["high_risk_cases"]
    open_beoordelingen = buckets["open_beoordelingen"]

    # Only include each strip if it adds signal not already in the command bar
    if waiting_exceeded > 0 and bottleneck_stage not in ("beoordelingen", "matching"):
        strips.append(
            {
                "label": f"{waiting_exceeded} casus{'sen' if waiting_exceeded > 1 else ''} wacht{'en' if waiting_exceeded > 1 else ''} langer dan {WAITING_THRESHOLD_DAYS} dagen",
                "tone": "warning",
                "href": reverse("careon:case_list") + "?attention=waiting_long",
            }
        )

    if without_match > 0 and bottleneck_stage != "matching":
        strips.append(
            {
                "label": f"{without_match} casus{'sen' if without_match > 1 else ''} zonder beschikbare aanbieder",
                "tone": "critical",
                "href": reverse("careon:matching_dashboard"),
            }
        )

    if pending > 0 and bottleneck_stage != "plaatsingen":
        strips.append(
            {
                "label": f"{pending} plaatsing{'en' if pending > 1 else ''} wacht{'en' if pending > 1 else ''} op bevestiging",
                "tone": "info",
                "href": reverse("careon:placement_list"),
            }
        )

    if capacity_shortage > 0:
        strips.append(
            {
                "label": f"Capaciteit onder norm: {capacity_shortage} aanbieder{'s' if capacity_shortage > 1 else ''} vol",
                "tone": "warning",
                "href": reverse("careon:case_list") + "?attention=capacity_none",
            }
        )

    if high_risk > 0:
        strips.append(
            {
                "label": f"{high_risk} casus{'sen' if high_risk > 1 else ''} met hoge urgentie of escalatierisico",
                "tone": "critical",
                "href": reverse("careon:case_list") + "?attention=urgent",
            }
        )

    # Return at most 3, most important first
    return strips[:3]


# ---------------------------------------------------------------------------
# Legacy recommended_action (preserves template contract)
# ---------------------------------------------------------------------------


def _build_recommended_action(
    buckets: dict[str, Any],
    priority_queue: list[dict[str, Any]],
    bottleneck_stage: str,
) -> dict[str, Any] | None:
    """
    Build the recommended_action dict consumed by the existing dashboard.html.
    Follows the same priority order as the command bar.
    """
    blocked = buckets["blocked_cases"]
    open_beoordelingen = buckets["open_beoordelingen"]
    without_match = buckets["cases_without_match"]
    waiting_exceeded = buckets["waiting_time_exceeded"]
    pending = buckets["placements_pending"]
    high_risk = buckets["high_risk_cases"]

    if blocked > 0:
        return {
            "title": "Aanbevolen actie",
            "action": f"Verwijder {blocked} blokkade{'s' if blocked > 1 else ''} in de doorstroom",
            "reasons": ["Blokkeert vervolgstap", "Verhoogt wachttijd"],
            "cta": "Bekijk geblokkeerde casussen",
            "href": reverse("careon:case_list") + "?attention=urgent",
            "priority": "critical",
        }
    if open_beoordelingen > 0:
        return {
            "title": "Aanbevolen actie",
            "action": f"Werk eerst open beoordelingen af ({open_beoordelingen} casussen)",
            "reasons": ["Blokkeert matching", "Verhoogt wachttijd"],
            "cta": "Ga naar beoordelingen",
            "href": reverse("careon:assessment_list"),
            "priority": "high",
        }
    if without_match > 0:
        return {
            "title": "Aanbevolen actie",
            "action": f"Controleer matchings ({without_match} casussen zonder match)",
            "reasons": ["Geen passende aanbieder", "Vereist handmatige review"],
            "cta": "Ga naar matching",
            "href": reverse("careon:matching_dashboard"),
            "priority": "high",
        }
    if waiting_exceeded > 0:
        return {
            "title": "Aanbevolen actie",
            "action": f"Bekijk wachttijdoverschrijdingen ({waiting_exceeded} casussen)",
            "reasons": [
                f"Wachttijdnorm van {WAITING_THRESHOLD_DAYS} dagen overschreden",
                "Verhoogt escalatierisico",
            ],
            "cta": "Ga naar casussen",
            "href": reverse("careon:case_list") + "?attention=waiting_long",
            "priority": "warning",
        }
    if pending > 0:
        return {
            "title": "Aanbevolen actie",
            "action": f"Bevestig {pending} openstaande plaatsing{'en' if pending > 1 else ''}",
            "reasons": ["Aanbieder wacht op bevestiging", "Vertraagt actieve zorg"],
            "cta": "Ga naar plaatsingen",
            "href": reverse("careon:placement_list"),
            "priority": "info",
        }
    if high_risk > 0:
        return {
            "title": "Aanbevolen actie",
            "action": f"Review {high_risk} urgente casussen",
            "reasons": ["Crisissignalen gedetecteerd", "Gemeente-melding kan vereist zijn"],
            "cta": "Ga naar signalen",
            "href": reverse("careon:signal_list"),
            "priority": "critical",
        }
    return None


# ---------------------------------------------------------------------------
# Legacy KPIs (preserves template contract, improved values)
# ---------------------------------------------------------------------------


def _build_regiekamer_kpis(
    buckets: dict[str, Any],
    priority_queue: list[dict[str, Any]],
    capacity_shortage: int,
) -> list[dict[str, Any]]:
    without_match = buckets["cases_without_match"]
    open_beoordelingen = buckets["open_beoordelingen"]
    pending = buckets["placements_pending"]
    waiting_exceeded = buckets["waiting_time_exceeded"]
    high_risk = buckets["high_risk_cases"]
    blocked = buckets["blocked_cases"]

    avg_wait = _safe_avg([row["waiting_days"] for row in priority_queue])

    return [
        {
            "label": "Casussen zonder match",
            "value": without_match,
            "delta": f"{without_match} wachten op aanbieder",
            "tone": "critical" if without_match > 0 else "healthy",
            "href": reverse("careon:matching_dashboard"),
        },
        {
            "label": "Open beoordelingen",
            "value": open_beoordelingen,
            "delta": f"{open_beoordelingen} blokkeren matching",
            "tone": "warning" if open_beoordelingen > 0 else "healthy",
            "href": reverse("careon:assessment_list"),
        },
        {
            "label": "Plaatsingen in behandeling",
            "value": pending,
            "delta": f"{pending} wachten op besluit",
            "tone": "brand",
            "href": reverse("careon:placement_list"),
        },
        {
            "label": "Gemiddelde wachttijd",
            "value": f"{avg_wait} dagen",
            "delta": f"Norm: {WAITING_THRESHOLD_DAYS} dagen",
            "tone": "warning" if avg_wait > WAITING_THRESHOLD_DAYS else "healthy",
            # NOTE: '?sort=waiting' is not supported by CaseIntakeListView;
            # linking to waittime_list instead.
            "href": reverse("careon:waittime_list"),
        },
        {
            "label": "Casussen met hoog risico",
            "value": high_risk,
            "delta": f"{blocked} blokkades actief",
            "tone": "critical" if high_risk > 0 else "healthy",
            "href": reverse("careon:signal_list"),
        },
        {
            "label": "Capaciteitstekorten",
            "value": capacity_shortage,
            "delta": "Signalen uit aanbieders en regio's",
            "tone": "warning" if capacity_shortage > 0 else "healthy",
            "href": reverse("careon:case_list") + "?attention=capacity_none",
        },
    ]


# ---------------------------------------------------------------------------
# Next actions (preserves template contract)
# ---------------------------------------------------------------------------


def _build_next_actions(
    buckets: dict[str, Any],
    priority_queue: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    open_beoordelingen = buckets["open_beoordelingen"]
    without_match = buckets["cases_without_match"]
    pending = buckets["placements_pending"]

    # Escalation count: CRISIS urgency or risk_signal blocker
    escalation_count = sum(
        1
        for row in priority_queue
        if row["urgency_code"] == CaseIntakeProcess.Urgency.CRISIS
        or row["blocker_key"] in ("escalation", "risk_signal")
    )

    return [
        {
            "label": "casussen wachten op beoordeling",
            "count": open_beoordelingen,
            "href": reverse("careon:assessment_list"),
            "cta": "Open beoordelingen",
        },
        {
            "label": "matchings handmatig controleren",
            "count": without_match,
            "href": reverse("careon:matching_dashboard"),
            "cta": "Open matching",
        },
        {
            "label": "plaatsingen vereisen bevestiging",
            "count": pending,
            "href": reverse("careon:placement_list"),
            "cta": "Open plaatsingen",
        },
        {
            "label": "escalaties naar gemeente",
            "count": escalation_count,
            "href": reverse("careon:signal_list"),
            "cta": "Open signalen",
        },
    ]


# ---------------------------------------------------------------------------
# Bottleneck signals (preserves template contract)
# ---------------------------------------------------------------------------


def _build_bottleneck_signals(
    priority_queue: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    bottleneck_bucket: dict[str, dict[str, Any]] = {}
    for row in priority_queue:
        key = row["blocker_key"]
        if not key:
            continue
        bucket = bottleneck_bucket.setdefault(key, {"count": 0, "days": []})
        bucket["count"] += 1
        bucket["days"].append(row["waiting_days"])

    meta: dict[str, tuple[str, str]] = {
        "no_match": (
            "Geen match",
            reverse("careon:case_list") + "?attention=no_match",
        ),
        "waiting_long": (
            "Wachttijd overschreden",
            reverse("careon:case_list") + "?attention=waiting_long",
        ),
        "missing_assessment": (
            "Beoordeling ontbreekt",
            reverse("careon:case_list") + "?attention=missing_assessment",
        ),
        "risk_signal": (
            "Kritische signalen",
            reverse("careon:case_list") + "?attention=urgent",
        ),
        "on_hold": (
            "Op hold",
            reverse("careon:case_list") + "?attention=urgent",
        ),
        "escalation": (
            "Escalatie open",
            reverse("careon:signal_list"),
        ),
        "needs_info": (
            "Aanvulling vereist",
            reverse("careon:case_list") + "?attention=missing_assessment",
        ),
        "placement_blocked": (
            "Plaatsing geblokkeerd",
            reverse("careon:placement_list"),
        ),
    }

    signals = []
    for key, data in sorted(
        bottleneck_bucket.items(), key=lambda item: item[1]["count"], reverse=True
    )[:3]:
        label, href = meta.get(key, (key, reverse("careon:case_list")))
        avg_delay = _safe_avg(data["days"])
        signals.append(
            {
                "label": label,
                "count": data["count"],
                "avg_delay": avg_delay,
                "href": href,
            }
        )
    return signals


# ---------------------------------------------------------------------------
# Alert strip (preserves template contract)
# ---------------------------------------------------------------------------


def _build_alert_strip(
    buckets: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        {
            "icon": "!",
            "label": "Casussen zonder match",
            "count": buckets["cases_without_match"],
            "tone": "critical",
            "href": reverse("careon:case_list") + "?attention=no_match",
        },
        {
            "icon": "W",
            "label": "Wachttijd overschreden",
            "count": buckets["waiting_time_exceeded"],
            "tone": "warning",
            "href": reverse("careon:case_list") + "?attention=waiting_long",
        },
        {
            "icon": "B",
            "label": "Beoordeling ontbreekt",
            "count": buckets["open_beoordelingen"],
            "tone": "warning",
            "href": reverse("careon:case_list") + "?attention=missing_assessment",
        },
        {
            "icon": "U",
            "label": "Urgente casussen",
            "count": buckets["high_risk_cases"],
            "tone": "critical",
            "href": reverse("careon:case_list") + "?attention=urgent",
        },
    ]


# ---------------------------------------------------------------------------
# Signal items (preserves template contract)
# ---------------------------------------------------------------------------


def _build_signal_items(signals_qs: QuerySet) -> list[dict[str, Any]]:
    items = []
    for signal in signals_qs.select_related("due_diligence_process").order_by(
        "-updated_at"
    )[:5]:
        items.append(
            {
                "label": signal.get_signal_type_display(),
                "detail": (signal.description or "")[:120],
                "risk": signal.risk_level,
                "status": signal.get_status_display(),
                "href": reverse("careon:signal_detail", args=[signal.pk]),
            }
        )
    return items


# ---------------------------------------------------------------------------
# Operational insights (preserves template contract)
# ---------------------------------------------------------------------------


def _build_operational_insights(
    priority_queue: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    wait_bands = {"0-3 dagen": 0, "4-7 dagen": 0, "8+ dagen": 0}
    phase_distribution_map: dict[str, int] = {}

    for row in priority_queue:
        days = row["waiting_days"]
        if days <= 3:
            wait_bands["0-3 dagen"] += 1
        elif days <= 7:
            wait_bands["4-7 dagen"] += 1
        else:
            wait_bands["8+ dagen"] += 1

        phase_distribution_map[row["phase"]] = (
            phase_distribution_map.get(row["phase"], 0) + 1
        )

    phase_distribution = [
        {"label": label, "count": count}
        for label, count in sorted(
            phase_distribution_map.items(), key=lambda item: item[1], reverse=True
        )
    ]

    return [
        {
            "title": "Wachttijdverdeling",
            "items": [
                {"label": label, "count": count} for label, count in wait_bands.items()
            ],
        },
        {
            "title": "Casussen per fase",
            "items": phase_distribution[:5],
        },
    ]


# ---------------------------------------------------------------------------
# Active case (preserves template contract)
# ---------------------------------------------------------------------------


def _build_active_case(
    priority_queue: list[dict[str, Any]],
    active_intakes: list[Any],
    placement_by_intake: dict[int, Any],
    signals_by_intake: dict[int, list[Any]],
    selected_case_id: int | None,
) -> dict[str, Any] | None:
    if not priority_queue:
        return None

    selected_row = next(
        (item for item in priority_queue if item["id"] == selected_case_id),
        priority_queue[0],
    )
    intake = next(
        (obj for obj in active_intakes if obj.pk == selected_row["id"]), None
    )
    if not intake:
        return None

    assessment = getattr(intake, "case_assessment", None)
    placement = placement_by_intake.get(intake.pk)
    signals = signals_by_intake.get(intake.pk, [])

    S = CaseIntakeProcess.ProcessStatus
    AS = CaseAssessment.AssessmentStatus
    timeline = [
        {"label": "Intake gestart", "value": intake.start_date},
        {"label": "Laatste update", "value": intake.updated_at.date()},
    ]
    if assessment:
        timeline.append({"label": "Beoordeling", "value": assessment.updated_at.date()})
    if placement:
        timeline.append({"label": "Plaatsing", "value": placement.updated_at.date()})
    if signals:
        timeline.append({"label": "Laatste signaal", "value": signals[0].updated_at.date()})

    if intake.status in (S.MATCHING, S.DECISION):
        if placement and placement.selected_provider:
            match_status = f"Toegewezen aan {placement.selected_provider.name}"
        elif assessment and assessment.assessment_status == AS.APPROVED_FOR_MATCHING:
            match_status = "Klaar voor toewijzing"
        else:
            match_status = "Wacht op beoordeling"
    else:
        match_status = "Nog niet in matchingfase"

    return {
        "id": selected_row["id"],
        "title": selected_row["title"],
        "phase": selected_row["phase"],
        "urgency": selected_row["urgency"],
        "waiting_label": selected_row["waiting_label"],
        "blocker": selected_row["blocker"],
        "next_action": selected_row["next_action"],
        "assessment_status": selected_row["assessment_status"],
        "placement_status": selected_row["placement_status"],
        "match_status": match_status,
        "region": intake.preferred_region.region_name
        if intake.preferred_region
        else "Niet gespecificeerd",
        "coordinator": intake.case_coordinator.get_full_name()
        if intake.case_coordinator
        else "Niet toegewezen",
        "timeline": timeline,
        "case_href": selected_row["case_href"],
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def build_regiekamer_summary(
    *,
    org: Any,
    active_intakes: list[Any],
    signals_qs: QuerySet,
    selected_case_id: int | None = None,
    today: date | None = None,
) -> dict[str, Any]:
    """
    Compute the full Regiekamer dashboard summary.

    Parameters
    ----------
    org:
        The Organisation instance for the current user (may be None).
    active_intakes:
        Pre-scoped, pre-filtered list of CaseIntakeProcess objects
        (should exclude COMPLETED). Each object must have `case_assessment`
        available via select_related.
    signals_qs:
        Pre-scoped queryset of CareSignal (OPEN + IN_PROGRESS only).
    selected_case_id:
        Optional PK of the case to highlight in the active-case panel.
    today:
        Override today's date (used in tests for determinism).

    Returns
    -------
    dict
        Template-ready context dict. All legacy keys preserved.
        New keys: flow_counts, command_bar, bottleneck_stage,
                  priority_cards, signal_strips.
    """
    today = today or date.today()

    # --- load placements for these intakes ---
    intake_ids = [i.pk for i in active_intakes]
    placements = (
        PlacementRequest.objects.filter(
            due_diligence_process_id__in=intake_ids
        ).select_related("selected_provider", "due_diligence_process")
        if intake_ids
        else PlacementRequest.objects.none()
    )
    placement_by_intake: dict[int, Any] = {}
    for placement in placements.order_by("due_diligence_process_id", "-updated_at"):
        iid = placement.due_diligence_process_id
        if iid and iid not in placement_by_intake:
            placement_by_intake[iid] = placement

    # --- group signals by intake ---
    signals_by_intake: dict[int, list[Any]] = {}
    for signal in signals_qs.select_related("due_diligence_process").order_by(
        "-updated_at"
    ):
        iid = signal.due_diligence_process_id
        if not iid:
            continue
        signals_by_intake.setdefault(iid, []).append(signal)

    # --- compute issue buckets ---
    buckets = _compute_issue_buckets(
        active_intakes=active_intakes,
        placement_by_intake=placement_by_intake,
        signals_by_intake=signals_by_intake,
        today=today,
    )
    enriched: list[dict[str, Any]] = buckets.pop("_enriched")

    # --- capacity signals ---
    capacity_signals, capacity_shortage = _build_capacity_signals(org, active_intakes)
    buckets["capacity_shortages"] = capacity_shortage

    # --- priority queue ---
    priority_queue = _build_priority_queue(enriched)

    # --- flow counts ---
    flow_counts = _compute_flow_counts(active_intakes)

    # --- bottleneck stage (current) ---
    bottleneck_stage = _compute_bottleneck_stage(buckets)

    # --- predictive intelligence layer ---
    predictive = build_predictive_summary(
        org=org,
        active_intakes=active_intakes,
        placement_by_intake=placement_by_intake,
        signals_by_intake=signals_by_intake,
        today=today,
        capacity_shortage=capacity_shortage,
    )

    # Enrich each priority_queue row with per-case risk forecast
    per_case_forecast = predictive["per_case_forecast"]
    for row in priority_queue:
        forecast = per_case_forecast.get(row["id"], {})
        row["risk_score"] = forecast.get("risk_score", 0)
        row["risk_band"] = forecast.get("risk_band", "low")
        row["top_reasons"] = forecast.get("top_reasons", [])
        row["forecast_action"] = {
            "label": forecast.get("next_best_action", row["next_action"]["label"]),
            "href": forecast.get("next_best_action_href", row["next_action"]["href"]),
            "impact": forecast.get("projected_impact", ""),
        }

    # --- command bar (augmented with action impact summary) ---
    command_bar = _build_command_bar(buckets, bottleneck_stage)
    command_bar["impact_summary"] = predictive["action_impact_summary"]

    # --- priority cards ---
    priority_cards = _build_priority_cards(buckets, priority_queue, capacity_shortage)

    # --- signal strips ---
    signal_strips = _build_signal_strips(buckets, bottleneck_stage, priority_queue, capacity_shortage)

    # --- legacy outputs ---
    recommended_action = _build_recommended_action(buckets, priority_queue, bottleneck_stage)
    regiekamer_kpis = _build_regiekamer_kpis(buckets, priority_queue, capacity_shortage)
    next_actions = _build_next_actions(buckets, priority_queue)
    bottleneck_signals = _build_bottleneck_signals(priority_queue)
    alert_strip = _build_alert_strip(buckets)
    signal_items = _build_signal_items(signals_qs)
    operational_insights = _build_operational_insights(priority_queue)
    active_case = _build_active_case(
        priority_queue, active_intakes, placement_by_intake, signals_by_intake, selected_case_id
    )

    avg_wait_days = _safe_avg([row["waiting_days"] for row in priority_queue])

    return {
        # --- legacy keys (preserved) ---
        "alert_strip": alert_strip,
        "priority_queue": priority_queue,
        "active_case": active_case,
        "selected_case_id": active_case["id"] if active_case else None,
        "bottleneck_signals": bottleneck_signals,
        "capacity_signals": capacity_signals,
        "total_active_cases": len(priority_queue),
        "no_match_count": buckets["cases_without_match"],
        "waiting_long_count": buckets["waiting_time_exceeded"],
        "missing_assessment_count": buckets["open_beoordelingen"],
        "urgent_count": buckets["high_risk_cases"],
        "avg_wait_days": avg_wait_days,
        "recommended_action": recommended_action,
        "regiekamer_kpis": regiekamer_kpis,
        "next_actions": next_actions,
        "signal_items": signal_items,
        "operational_insights": operational_insights,
        # --- Phase 2 keys ---
        "flow_counts": flow_counts,
        "command_bar": command_bar,
        "bottleneck_stage": bottleneck_stage,
        "priority_cards": priority_cards,
        "signal_strips": signal_strips,
        # --- Phase 3: predictive intelligence ---
        "forecast_signals": predictive["forecast_signals"],
        "sla_risk_cases": predictive["sla_risk_cases"],
        "projected_bottleneck_stage": predictive["projected_bottleneck_stage"],
        "action_impact_summary": predictive["action_impact_summary"],
        "predictive_strips": predictive["predictive_strips"],
    }
