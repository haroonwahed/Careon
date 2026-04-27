from __future__ import annotations

import math
import re
from typing import Any, Iterable

from django.db.models import Q
from django.utils import timezone

from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    MatchResultaat,
    PlacementRequest,
    ProviderRegioDekking,
)
from contracts.workflow_state_machine import (
    WorkflowRole,
    WorkflowState,
    derive_workflow_state,
    resolve_actor_role,
)


DECISION_ENGINE_THRESHOLDS = {
    "low_match_confidence": 0.65,
    "provider_response_sla_hours": 72,
    "urgent_idle_hours": 48,
    "intake_start_sla_days": 5,
    "repeated_rejection_count": 2,
}

_EXPLAINABILITY_FACTOR_WEIGHTS = {
    # Weighted by operational impact in matching decisions.
    "zorgvorm_match": {"specialization_match": 0.65, "capacity_signal": 0.35},
    "urgency_match": {"complexity_fit": 0.7, "capacity_signal": 0.3},
    "special_needs_fit": {"specialization_match": 0.55, "complexity_fit": 0.45},
}

_CONFIDENCE_FACTORS = {
    "specialization_match": 0.24,
    "urgency_match": 0.18,
    "capacity_signal": 0.2,
    "region_match": 0.14,
    "complexity_fit": 0.14,
    "zorgvorm_match": 0.1,
}


_STATE_PHASE_MAP = {
    WorkflowState.DRAFT_CASE: "casus",
    WorkflowState.SUMMARY_READY: "samenvatting",
    WorkflowState.MATCHING_READY: "matching",
    WorkflowState.GEMEENTE_VALIDATED: "gemeente_validatie",
    WorkflowState.PROVIDER_REVIEW_PENDING: "aanbieder_beoordeling",
    WorkflowState.PROVIDER_ACCEPTED: "aanbieder_beoordeling",
    WorkflowState.PROVIDER_REJECTED: "aanbieder_beoordeling",
    WorkflowState.PLACEMENT_CONFIRMED: "plaatsing",
    WorkflowState.INTAKE_STARTED: "intake",
    WorkflowState.ARCHIVED: "archived",
}

_STATE_PRIORITY = {
    WorkflowState.DRAFT_CASE: ("high", "casusgegevens aanvullen"),
    WorkflowState.SUMMARY_READY: ("high", "samenvatting genereren of controleren"),
    WorkflowState.MATCHING_READY: ("high", "gemeente validatie van matchadvies"),
    WorkflowState.GEMEENTE_VALIDATED: ("high", "stuur gevalideerde matching naar aanbieder"),
    WorkflowState.PROVIDER_REVIEW_PENDING: ("high", "volg aanbieder beoordeling op"),
    WorkflowState.PROVIDER_ACCEPTED: ("high", "bevestig plaatsing"),
    WorkflowState.PROVIDER_REJECTED: ("high", "hermatch de casus"),
    WorkflowState.PLACEMENT_CONFIRMED: ("medium", "start intake"),
    WorkflowState.INTAKE_STARTED: ("low", "monitor casus"),
    WorkflowState.ARCHIVED: ("low", "archief"),
}

_SEVERITY_ORDER = {
    "critical": 4,
    "high": 3,
    "warning": 3,
    "medium": 2,
    "info": 1,
    "low": 0,
}

_ACTION_OWNER_ROLE = {
    "COMPLETE_CASE_DATA": WorkflowRole.GEMEENTE,
    "GENERATE_SUMMARY": WorkflowRole.GEMEENTE,
    "START_MATCHING": WorkflowRole.GEMEENTE,
    "VALIDATE_MATCHING": WorkflowRole.GEMEENTE,
    "SEND_TO_PROVIDER": WorkflowRole.GEMEENTE,
    "CONFIRM_PLACEMENT": WorkflowRole.GEMEENTE,
    "REMATCH_CASE": WorkflowRole.GEMEENTE,
    "ARCHIVE_CASE": WorkflowRole.GEMEENTE,
    "PROVIDER_ACCEPT": WorkflowRole.ZORGAANBIEDER,
    "PROVIDER_REJECT": WorkflowRole.ZORGAANBIEDER,
    "PROVIDER_REQUEST_INFO": WorkflowRole.ZORGAANBIEDER,
    "START_INTAKE": WorkflowRole.ZORGAANBIEDER,
    "FOLLOW_UP_PROVIDER": "regie",
    "WAIT_PROVIDER_RESPONSE": "regie",
    "MONITOR_CASE": "regie",
}

_REJECTION_CODES = {"PROVIDER_REJECTED_CASE", "REPEATED_PROVIDER_REJECTIONS"}
_INTAKE_DELAY_CODES = {"INTAKE_DELAYED", "INTAKE_NOT_STARTED"}


def _highest_severity(items: Iterable[dict[str, Any]]) -> dict[str, Any] | None:
    best_item: dict[str, Any] | None = None
    best_score = -1
    for item in items:
        severity = str(item.get("severity") or "").lower()
        score = _SEVERITY_ORDER.get(severity, 0)
        if score > best_score:
            best_item = item
            best_score = score
    return best_item


def _has_item_code(items: Iterable[dict[str, Any]], codes: set[str]) -> bool:
    return any(str(item.get("code") or "") in codes for item in items)


def _has_any_alert_severity(alerts: Iterable[dict[str, Any]], severities: set[str]) -> bool:
    return any(str(item.get("severity") or "").lower() in severities for item in alerts)


def _derive_issue_tags(
    *,
    blockers: list[dict[str, Any]],
    risks: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    next_best_action: dict[str, Any] | None,
) -> list[str]:
    tags: list[str] = []

    def add(tag: str) -> None:
        if tag not in tags:
            tags.append(tag)

    if blockers:
        add("blockers")
    if risks:
        add("risks")
    if alerts:
        add("alerts")
    if _has_item_code(alerts, {"PROVIDER_REVIEW_PENDING_SLA"}):
        add("SLA")
    if _has_item_code(alerts, _REJECTION_CODES) or _has_item_code(risks, {"REPEATED_PROVIDER_REJECTIONS"}):
        add("rejection")
    if _has_item_code(alerts, _INTAKE_DELAY_CODES) or _has_item_code(risks, {"INTAKE_DELAYED"}):
        add("intake")
    if next_best_action and str(next_best_action.get("action") or "") == "FOLLOW_UP_PROVIDER":
        add("SLA")
    if next_best_action and str(next_best_action.get("action") or "") == "START_INTAKE":
        add("intake")

    return tags


def _responsible_role_for_item(next_best_action: dict[str, Any] | None) -> str:
    if not next_best_action:
        return "regie"
    return str(_ACTION_OWNER_ROLE.get(str(next_best_action.get("action") or ""), "regie"))


def _priority_score(
    *,
    blockers: list[dict[str, Any]],
    risks: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    next_best_action: dict[str, Any] | None,
    urgency: str,
    hours_in_current_state: float | None,
) -> int:
    score = 0

    if any(str(item.get("severity") or "").lower() == "critical" for item in blockers):
        score += 300

    if _has_any_alert_severity(alerts, {"high", "critical"}):
        score += 70

    if risks:
        score += 30

    if urgency in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS}:
        score += 40

    if _has_item_code(alerts, {"PROVIDER_REVIEW_PENDING_SLA"}) or (
        next_best_action and str(next_best_action.get("action") or "") == "FOLLOW_UP_PROVIDER"
    ):
        score += 50

    if _has_item_code(alerts, _REJECTION_CODES) or _has_item_code(risks, {"REPEATED_PROVIDER_REJECTIONS"}):
        score += 45

    if _has_item_code(alerts, _INTAKE_DELAY_CODES) or _has_item_code(risks, {"INTAKE_DELAYED"}):
        score += 50

    if hours_in_current_state is not None and hours_in_current_state >= 48:
        score += 20

    return score


def _build_regiekamer_overview_item(*, case: CareCase, evaluation: dict[str, Any]) -> dict[str, Any]:
    blockers = list(evaluation.get("blockers") or [])
    risks = list(evaluation.get("risks") or [])
    alerts = list(evaluation.get("alerts") or [])
    decision_context = dict(evaluation.get("decision_context") or {})
    next_best_action = evaluation.get("next_best_action")

    top_blocker = _highest_severity(blockers)
    top_risk = _highest_severity(risks)
    top_alert = _highest_severity(alerts)

    urgency = _clean(decision_context.get("urgency") or "")
    hours_in_current_state = decision_context.get("hours_in_current_state")
    try:
        hours_in_current_state = float(hours_in_current_state) if hours_in_current_state is not None else None
    except (TypeError, ValueError):
        hours_in_current_state = None

    item = {
        "case_id": case.pk,
        "case_reference": f"#{case.pk}",
        "title": case.title,
        "current_state": evaluation.get("current_state") or "",
        "phase": evaluation.get("phase") or "",
        "urgency": urgency,
        "assigned_provider": decision_context.get("selected_provider_name") or "",
        "next_best_action": next_best_action or None,
        "top_blocker": top_blocker,
        "top_risk": top_risk,
        "top_alert": top_alert,
        "blocker_count": len(blockers),
        "risk_count": len(risks),
        "alert_count": len(alerts),
        "priority_score": _priority_score(
            blockers=blockers,
            risks=risks,
            alerts=alerts,
            next_best_action=next_best_action,
            urgency=urgency,
            hours_in_current_state=hours_in_current_state,
        ),
        "age_hours": decision_context.get("case_age_hours"),
        "hours_in_current_state": hours_in_current_state,
        "issue_tags": _derive_issue_tags(
            blockers=blockers,
            risks=risks,
            alerts=alerts,
            next_best_action=next_best_action,
        ),
        "responsible_role": _responsible_role_for_item(next_best_action),
    }

    try:
        item["age_hours"] = float(item["age_hours"]) if item["age_hours"] is not None else None
    except (TypeError, ValueError):
        item["age_hours"] = None

    return item


def build_regiekamer_decision_overview(
    cases: Iterable[CareCase],
    *,
    actor: Any | None = None,
    actor_role: str | None = None,
    organization: Any | None = None,
) -> dict[str, Any]:
    if actor_role is None and actor is not None:
        actor_role = resolve_actor_role(user=actor, organization=organization)
    actor_role = actor_role or WorkflowRole.GEMEENTE

    provider_client_ids: set[int] = set()
    provider_client_names: set[str] = set()
    if actor_role == WorkflowRole.ZORGAANBIEDER and organization is not None:
        from contracts.models import Client

        provider_clients = Client.objects.filter(
            organization=organization,
            client_type='CORPORATION',
        ).values("id", "name")
        provider_client_ids = {int(row["id"]) for row in provider_clients}
        provider_client_names = {str(row["name"]).strip().casefold() for row in provider_clients if row.get("name")}

    totals = {
        "active_cases": 0,
        "critical_blockers": 0,
        "high_priority_alerts": 0,
        "provider_sla_breaches": 0,
        "repeated_rejections": 0,
        "intake_delays": 0,
    }
    items: list[dict[str, Any]] = []

    for case in cases:
        evaluation = evaluate_case(case, actor=actor, actor_role=actor_role)
        if provider_client_ids:
            selected_provider_id = evaluation.get("decision_context", {}).get("selected_provider_id")
            selected_provider_name = evaluation.get("decision_context", {}).get("selected_provider_name")
            try:
                selected_provider_id_int = int(selected_provider_id) if selected_provider_id is not None else None
            except (TypeError, ValueError):
                selected_provider_id_int = None
            provider_name_matches = (
                bool(selected_provider_name)
                and str(selected_provider_name).strip().casefold() in provider_client_names
            )
            if selected_provider_id_int not in provider_client_ids and not provider_name_matches:
                continue

        item = _build_regiekamer_overview_item(case=case, evaluation=evaluation)
        items.append(item)

        totals["active_cases"] += 1
        totals["critical_blockers"] += int(any(str(blocker.get("severity") or "").lower() == "critical" for blocker in (evaluation.get("blockers") or [])))
        totals["high_priority_alerts"] += int(_has_any_alert_severity(evaluation.get("alerts") or [], {"high", "critical"}))
        totals["provider_sla_breaches"] += int(_has_item_code(evaluation.get("alerts") or [], {"PROVIDER_REVIEW_PENDING_SLA"}))
        totals["repeated_rejections"] += int(
            _has_item_code(evaluation.get("risks") or [], {"REPEATED_PROVIDER_REJECTIONS"})
            or _has_item_code(evaluation.get("alerts") or [], _REJECTION_CODES)
        )
        totals["intake_delays"] += int(
            _has_item_code(evaluation.get("alerts") or [], _INTAKE_DELAY_CODES)
            or _has_item_code(evaluation.get("risks") or [], {"INTAKE_DELAYED"})
        )

    items.sort(
        key=lambda item: (
            item.get("priority_score", 0),
            item.get("hours_in_current_state") or 0,
            item.get("case_id") or 0,
        ),
        reverse=True,
    )

    return {
        "generated_at": timezone.now().isoformat(),
        "totals": totals,
        "items": items,
    }


def _clean(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _coerce_hours(value: Any) -> float | None:
    if not value:
        return None
    try:
        delta = timezone.now() - value
    except Exception:
        return None
    return round(max(delta.total_seconds() / 3600.0, 0.0), 2)


def _case_parts(case: Any) -> tuple[CaseIntakeProcess | None, CareCase | None]:
    if isinstance(case, CaseIntakeProcess):
        return case, getattr(case, "contract", None)
    if isinstance(case, CareCase):
        try:
            intake = case.due_diligence_process
        except CaseIntakeProcess.DoesNotExist:
            intake = None
        return intake, case

    intake = getattr(case, "due_diligence_process", None)
    case_record = getattr(case, "contract", None)
    if isinstance(intake, CaseIntakeProcess):
        return intake, case_record if isinstance(case_record, CareCase) else getattr(intake, "contract", None)
    return None, None


def _primary_case_object(case: Any, intake: CaseIntakeProcess | None, case_record: CareCase | None) -> Any:
    if isinstance(case, (CaseIntakeProcess, CareCase)):
        return case
    return intake or case_record or case


def _summary_text(*, intake: CaseIntakeProcess | None, case_record: CareCase | None, assessment: CaseAssessment | None) -> str:
    parts = []
    if intake is not None:
        parts.extend(
            [
                _clean(getattr(intake, "assessment_summary", "")),
                _clean(getattr(intake, "description", "")),
            ]
        )
    if case_record is not None:
        parts.append(_clean(getattr(case_record, "content", "")))
    if assessment is not None:
        parts.extend(
            [
                _clean(getattr(assessment, "notes", "")),
                _clean(getattr(assessment, "reason_not_ready", "")),
            ]
        )

    for value in parts:
        if value:
            return value
    return ""


def _required_data_complete(intake: CaseIntakeProcess | None, case_record: CareCase | None) -> bool:
    if intake is None:
        return False

    required_checks = [
        bool(_clean(intake.title)),
        bool(intake.organization_id),
        bool(intake.start_date),
        bool(intake.target_completion_date),
        bool(_clean(intake.urgency)),
        bool(_clean(intake.preferred_care_form or intake.zorgvorm_gewenst)),
    ]
    if case_record is not None:
        required_checks.append(bool(_clean(case_record.title)))
    return all(required_checks)


def _serialize_blocker(code: str, severity: str, message: str, blocking_actions: Iterable[str]) -> dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "message": message,
        "blocking_actions": list(blocking_actions),
    }


def _serialize_risk(code: str, severity: str, message: str, evidence: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "message": message,
        "evidence": evidence or {},
    }


def _serialize_alert(
    code: str,
    severity: str,
    title: str,
    message: str,
    recommended_action: str,
    evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "severity": severity,
        "title": title,
        "message": message,
        "recommended_action": recommended_action,
        "evidence": evidence or {},
    }


def _confidence_to_score(match_result: MatchResultaat | None) -> float | None:
    if match_result is None:
        return None

    if match_result.totaalscore is not None:
        try:
            score = float(match_result.totaalscore)
        except (TypeError, ValueError):
            score = None
        else:
            if 0.0 <= score <= 1.0:
                return round(score, 4)

    mapping = {
        MatchResultaat.ConfidenceLabel.HOOG: 0.9,
        MatchResultaat.ConfidenceLabel.MIDDEL: 0.75,
        MatchResultaat.ConfidenceLabel.LAAG: 0.5,
        MatchResultaat.ConfidenceLabel.ONZEKER: None,
    }
    return mapping.get(match_result.confidence_label)


def _normalize_unit_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if score < 0.0:
        return 0.0
    if score > 1.0:
        return 1.0
    return round(score, 4)


def _coerce_coordinate(value: Any, *, minimum: float, maximum: float) -> float | None:
    try:
        numeric_value = float(value)
    except (TypeError, ValueError):
        return None
    if numeric_value < minimum or numeric_value > maximum:
        return None
    return round(numeric_value, 6)


def _extract_coordinates(source: Any) -> tuple[float | None, float | None]:
    if source is None:
        return None, None

    for latitude_attr, longitude_attr in (("latitude", "longitude"), ("lat", "lng"), ("lat", "lon")):
        if not hasattr(source, latitude_attr) or not hasattr(source, longitude_attr):
            continue
        latitude = _coerce_coordinate(getattr(source, latitude_attr, None), minimum=-90.0, maximum=90.0)
        longitude = _coerce_coordinate(getattr(source, longitude_attr, None), minimum=-180.0, maximum=180.0)
        if latitude is not None and longitude is not None:
            return latitude, longitude
    return None, None


def _haversine_distance_km(*, from_lat: float, from_lon: float, to_lat: float, to_lon: float) -> float:
    earth_radius_km = 6371.0
    d_lat = math.radians(to_lat - from_lat)
    d_lon = math.radians(to_lon - from_lon)
    lat1 = math.radians(from_lat)
    lat2 = math.radians(to_lat)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * (math.sin(d_lon / 2) ** 2)
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(earth_radius_km * c, 2)


def _parse_service_radius_km(value: Any) -> float | None:
    text = str(value or "").strip().lower()
    if not text:
        return None
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*km", text)
    if not match:
        return None
    raw_value = match.group(1).replace(",", ".")
    try:
        radius = float(raw_value)
    except ValueError:
        return None
    return round(radius, 2) if radius > 0 else None


def _build_region_fallback_data(*, intake: CaseIntakeProcess | None, case_record: CareCase | None) -> dict[str, Any]:
    region_values: list[str] = []
    region_ids: list[int] = []
    case_sources: list[Any] = [intake]
    if intake is not None:
        case_sources.extend([getattr(intake, "regio", None), getattr(intake, "preferred_region", None), getattr(intake, "gemeente", None)])
    case_sources.append(case_record)

    for source in case_sources:
        if source is None:
            continue
        for value in (
            getattr(source, "region_code", None),
            getattr(source, "region_name", None),
            getattr(source, "regio_jeugd", None),
            getattr(source, "region", None),
            getattr(source, "service_region", None),
            getattr(source, "municipality_name", None),
            getattr(source, "gemeente", None),
        ):
            normalized = str(value or "").strip().casefold()
            if normalized and normalized not in region_values:
                region_values.append(normalized)
        source_id = getattr(source, "id", None)
        if isinstance(source_id, int) and source_id not in region_ids:
            region_ids.append(source_id)
    return {"region_values": region_values, "region_ids": region_ids}


def _evaluate_distance_coverage(
    *,
    intake: CaseIntakeProcess | None,
    case_record: CareCase | None,
    match_result: MatchResultaat | None,
    baseline_region_score: float,
) -> dict[str, Any]:
    if match_result is None:
        return {
            "region_score": baseline_region_score,
            "coverage_basis": "unknown",
            "coverage_status": "unknown",
            "distance_km": None,
            "service_radius_km": None,
            "region_fallback_used": False,
            "distance_evidence": False,
        }

    provider = getattr(match_result, "zorgaanbieder", None)
    profiel = getattr(match_result, "zorgprofiel", None)
    vestiging = getattr(profiel, "aanbieder_vestiging", None) if profiel is not None else None
    provider_lat, provider_lon = _extract_coordinates(vestiging)

    case_sources = [
        intake,
        getattr(intake, "regio", None) if intake is not None else None,
        getattr(intake, "preferred_region", None) if intake is not None else None,
        getattr(intake, "gemeente", None) if intake is not None else None,
        case_record,
    ]
    case_lat = None
    case_lon = None
    for source in case_sources:
        case_lat, case_lon = _extract_coordinates(source)
        if case_lat is not None and case_lon is not None:
            break

    radius_candidates = [
        getattr(profiel, "service_area", None) if profiel is not None else None,
        getattr(vestiging, "name", None),
        getattr(match_result, "verificatie_advies", None),
    ]
    service_radius_km = None
    for candidate in radius_candidates:
        service_radius_km = _parse_service_radius_km(candidate)
        if service_radius_km is not None:
            break

    if provider is not None:
        coverage_qs = ProviderRegioDekking.objects.filter(
            zorgaanbieder=provider,
            dekking_status=ProviderRegioDekking.DekkingStatus.ACTIVE,
            contract_actief=True,
        )
        if vestiging is not None:
            coverage_qs = coverage_qs.filter(Q(aanbieder_vestiging=vestiging) | Q(aanbieder_vestiging__isnull=True))
        region_data = _build_region_fallback_data(intake=intake, case_record=case_record)
        coverage_rows = list(coverage_qs.select_related("regio"))
        if coverage_rows:
            case_region_ids = set(region_data["region_ids"])
            provider_region_ids = {row.regio_id for row in coverage_rows}
            has_region_overlap = bool(case_region_ids and provider_region_ids.intersection(case_region_ids))
            if has_region_overlap:
                return {
                    "region_score": max(baseline_region_score, 0.78),
                    "coverage_basis": "provider_region_coverage",
                    "coverage_status": "covered_region",
                    "distance_km": None,
                    "service_radius_km": None,
                    "region_fallback_used": False,
                    "distance_evidence": True,
                }
            return {
                "region_score": min(baseline_region_score, 0.4),
                "coverage_basis": "provider_region_coverage",
                "coverage_status": "uncovered_region",
                "distance_km": None,
                "service_radius_km": None,
                "region_fallback_used": False,
                "distance_evidence": True,
            }

    if (
        provider_lat is not None
        and provider_lon is not None
        and case_lat is not None
        and case_lon is not None
        and service_radius_km is not None
    ):
        distance_km = _haversine_distance_km(
            from_lat=provider_lat,
            from_lon=provider_lon,
            to_lat=case_lat,
            to_lon=case_lon,
        )
        inside_radius = distance_km <= service_radius_km
        return {
            "region_score": max(baseline_region_score, 0.84) if inside_radius else min(baseline_region_score, 0.35),
            "coverage_basis": "geo_distance",
            "coverage_status": "inside_radius" if inside_radius else "outside_radius",
            "distance_km": distance_km,
            "service_radius_km": service_radius_km,
            "region_fallback_used": False,
            "distance_evidence": True,
        }

    region_data = _build_region_fallback_data(intake=intake, case_record=case_record)
    provider_region_values = [
        str(value or "").strip().casefold()
        for value in (
            getattr(vestiging, "region", None),
            getattr(vestiging, "regio_jeugd", None),
            getattr(vestiging, "gemeente", None),
            getattr(case_record, "preferred_provider", None),
        )
        if str(value or "").strip()
    ]
    if set(provider_region_values).intersection(region_data["region_values"]):
        return {
            "region_score": max(baseline_region_score, 0.62),
            "coverage_basis": "region_fallback",
            "coverage_status": "region_fallback_match",
            "distance_km": None,
            "service_radius_km": None,
            "region_fallback_used": True,
            "distance_evidence": False,
        }

    return {
        "region_score": baseline_region_score,
        "coverage_basis": "unknown",
        "coverage_status": "unknown",
        "distance_km": None,
        "service_radius_km": service_radius_km,
        "region_fallback_used": False,
        "distance_evidence": False,
    }


def _weighted_average(values: dict[str, float], weights: dict[str, float]) -> float:
    total_weight = 0.0
    weighted_total = 0.0
    for key, weight in weights.items():
        score = _normalize_unit_score(values.get(key))
        if weight <= 0:
            continue
        weighted_total += score * weight
        total_weight += weight
    if total_weight <= 0:
        return 0.0
    return _normalize_unit_score(weighted_total / total_weight)


def _factor_explanation(*, factor_key: str, score: float, urgency: str | None = None) -> str:
    if factor_key == "zorgvorm_match":
        if score >= 0.75:
            return "Zorgvorm sluit goed aan op de casus."
        if score >= 0.5:
            return "Zorgvorm is deels passend; controleer randvoorwaarden."
        return "Zorgvorm match is zwak en vraagt handmatige controle."
    if factor_key == "urgency_match":
        if score >= 0.75:
            return "Urgentie past bij het beschikbare aanbod."
        if score >= 0.5:
            return "Urgentie lijkt werkbaar, maar verdient extra check."
        if urgency in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS}:
            return "Urgentie is hoog terwijl de match hier zwak op scoort."
        return "Urgentie-aansluiting is beperkt."
    if factor_key == "specialization_match":
        if score >= 0.75:
            return "Inhoudelijke/specialistische fit is sterk."
        if score >= 0.5:
            return "Specialistische fit is redelijk, maar niet overtuigend."
        return "Specialistische fit is laag; inhoudelijke mismatch mogelijk."
    if factor_key == "region_match":
        if score >= 0.75:
            return "Regionale dekking is passend."
        if score >= 0.5:
            return "Regio-fit is acceptabel, maar niet optimaal."
        return "Regio-fit is zwak; afstand of dekking kan knellen."
    if factor_key == "capacity_signal":
        if score >= 0.75:
            return "Capaciteit en wachttijd lijken beheersbaar."
        if score >= 0.5:
            return "Capaciteit is krap; monitor doorlooptijd."
        return "Capaciteit/wachttijd vormen een reeel risico."
    if factor_key == "complexity_fit":
        if score >= 0.75:
            return "Complexiteit en veiligheid lijken goed afgedekt."
        if score >= 0.5:
            return "Complexiteit past deels; verifieer uitvoerbaarheid."
        return "Complexiteit-fit is laag; risico op onvoldoende passend aanbod."
    if factor_key == "special_needs_fit":
        if score >= 0.75:
            return "Bijzondere ondersteuningsbehoeften lijken passend."
        if score >= 0.5:
            return "Bijzondere behoeften zijn deels afgedekt."
        return "Bijzondere behoeften lijken onvoldoende afgedekt."
    return "Factor vereist handmatige beoordeling."


def _extract_tradeoffs(raw_tradeoffs: Any) -> list[str]:
    if not isinstance(raw_tradeoffs, list):
        return []
    values: list[str] = []
    for item in raw_tradeoffs:
        if isinstance(item, dict):
            value = str(item.get("toelichting") or item.get("factor") or "").strip()
        else:
            value = str(item or "").strip()
        if value:
            values.append(value)
    return values[:5]


def _build_matching_explainability(
    *,
    intake: CaseIntakeProcess | None,
    case_record: CareCase | None,
    match_result: MatchResultaat | None,
    latest_match_confidence: float | None,
    urgency: str,
    risks: list[dict[str, Any]],
) -> dict[str, Any]:
    default_factor_breakdown = {
        "zorgvorm_match": {"score": 0.0, "explanation": "Nog geen matchingresultaat beschikbaar."},
        "urgency_match": {"score": 0.0, "explanation": "Nog geen matchingresultaat beschikbaar."},
        "specialization_match": {"score": 0.0, "explanation": "Nog geen matchingresultaat beschikbaar."},
        "region_match": {"score": 0.0, "explanation": "Nog geen matchingresultaat beschikbaar."},
        "capacity_signal": {"score": 0.0, "explanation": "Nog geen matchingresultaat beschikbaar."},
        "complexity_fit": {"score": 0.0, "explanation": "Nog geen matchingresultaat beschikbaar."},
        "special_needs_fit": {"score": 0.0, "explanation": "Nog geen matchingresultaat beschikbaar."},
    }
    if match_result is None:
        return {
            "factor_breakdown": default_factor_breakdown,
            "explanation_summary": "Nog geen onderbouwd matchadvies beschikbaar.",
            "strengths": [],
            "weaknesses": ["Geen matchresultaat beschikbaar voor beoordeling."],
            "tradeoffs": [],
            "confidence_score": 0.0,
            "confidence_reason": "Er is nog geen matchresultaat of confidence-label beschikbaar.",
            "warning_flags": {
                "capacity_risk": True,
                "specialization_gap": True,
                "distance_issue": False,
                "urgency_mismatch": True,
            },
            "coverage_basis": "unknown",
            "coverage_status": "unknown",
            "distance_km": None,
            "service_radius_km": None,
            "verification_guidance": [
                "Start matching of vernieuw het matchadvies.",
                "Controleer of verplichte casusgegevens en samenvatting compleet zijn.",
            ],
        }

    raw_signals = {
        "specialization_signal": _normalize_unit_score(match_result.score_inhoudelijke_fit),
        "region_signal": _normalize_unit_score(
            match_result.score_regio_contract_fit or match_result.score_contract_regio
        ),
        "capacity_signal": _normalize_unit_score(
            match_result.score_capaciteit_wachttijd_fit or match_result.score_capaciteit
        ),
        "complexity_signal": _normalize_unit_score(
            match_result.score_complexiteit_veiligheid_fit or match_result.score_complexiteit
        ),
    }

    factor_scores = {
        "specialization_match": raw_signals["specialization_signal"],
        "region_match": raw_signals["region_signal"],
        "capacity_signal": raw_signals["capacity_signal"],
        "complexity_fit": raw_signals["complexity_signal"],
    }
    coverage = _evaluate_distance_coverage(
        intake=intake,
        case_record=case_record,
        match_result=match_result,
        baseline_region_score=factor_scores["region_match"],
    )
    factor_scores["region_match"] = coverage["region_score"]
    factor_scores["zorgvorm_match"] = _weighted_average(
        factor_scores,
        _EXPLAINABILITY_FACTOR_WEIGHTS["zorgvorm_match"],
    )
    factor_scores["urgency_match"] = _weighted_average(
        factor_scores,
        _EXPLAINABILITY_FACTOR_WEIGHTS["urgency_match"],
    )
    factor_scores["special_needs_fit"] = _weighted_average(
        factor_scores,
        _EXPLAINABILITY_FACTOR_WEIGHTS["special_needs_fit"],
    )

    factor_breakdown = {
        key: {
            "score": score,
            "explanation": _factor_explanation(factor_key=key, score=score, urgency=urgency),
        }
        for key, score in factor_scores.items()
    }

    strengths = [
        _factor_explanation(factor_key=key, score=score, urgency=urgency)
        for key, score in sorted(factor_scores.items(), key=lambda item: item[1], reverse=True)
        if score >= 0.7
    ][:3]
    weaknesses = [
        _factor_explanation(factor_key=key, score=score, urgency=urgency)
        for key, score in sorted(factor_scores.items(), key=lambda item: item[1])
        if score < 0.55
    ][:3]
    tradeoffs = _extract_tradeoffs(match_result.trade_offs)

    risk_codes = {str((risk or {}).get("code") or "") for risk in risks}
    risk_penalty = 0.0
    if "CAPACITY_RISK" in risk_codes:
        risk_penalty += 0.08
    if "LOW_MATCH_CONFIDENCE" in risk_codes:
        risk_penalty += 0.07
    if "REPEATED_PROVIDER_REJECTIONS" in risk_codes:
        risk_penalty += 0.06

    warning_flags = {
        "capacity_risk": "CAPACITY_RISK" in risk_codes or factor_scores["capacity_signal"] < 0.52,
        "specialization_gap": factor_scores["specialization_match"] < 0.58,
        "distance_issue": coverage["distance_evidence"] and coverage["coverage_status"] in {"outside_radius", "uncovered_region"},
        "urgency_mismatch": factor_scores["urgency_match"] < 0.55 or (
            urgency in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS}
            and factor_scores["urgency_match"] < 0.68
        ),
    }

    warning_penalty = 0.03 * sum(1 for enabled in warning_flags.values() if enabled)
    weighted_confidence = _weighted_average(factor_scores, _CONFIDENCE_FACTORS)
    base_confidence = latest_match_confidence if latest_match_confidence is not None else weighted_confidence
    confidence_score = _normalize_unit_score(base_confidence - risk_penalty - warning_penalty)
    confidence_label = str(match_result.confidence_label or "").lower()
    top_factor = max(factor_scores.items(), key=lambda item: item[1])[0]
    weak_factor_count = sum(1 for score in factor_scores.values() if score < 0.55)
    if confidence_score >= 0.8:
        confidence_reason = (
            f"Confidence is hoog; {top_factor.replace('_', ' ')} en andere kernfactoren zijn consistent."
        )
    elif confidence_score >= 0.6:
        confidence_reason = (
            f"Confidence is middelmatig; {weak_factor_count} factor(en) vragen verificatie voor besluitvorming."
        )
    elif confidence_score > 0.0:
        confidence_reason = (
            f"Confidence is laag; {weak_factor_count} factor(en) zijn zwak of onzeker en vereisen extra controle."
        )
    else:
        confidence_reason = "Confidence ontbreekt of is onzeker; behandel dit advies als zwak."
    if confidence_label == MatchResultaat.ConfidenceLabel.ONZEKER.lower():
        confidence_reason = "Confidence-label is onzeker; data is mogelijk onvolledig."
    verification_guidance = [
        "Controleer of zorgvorm en urgentie praktisch uitvoerbaar zijn voor deze aanbieder.",
        "Verifieer capaciteit en verwachte wachttijd met actuele aanbiederinformatie.",
    ]
    if coverage["coverage_basis"] == "geo_distance":
        verification_guidance.append("Controleer of reisafstand en reistijd passen binnen het gezinsplan.")
    elif coverage["coverage_basis"] == "region_fallback":
        verification_guidance.append("Locatie is via regio-fallback bepaald; verifieer exacte reisafstand met aanbieder.")
    elif coverage["coverage_basis"] == "unknown":
        verification_guidance.append("Geo/coverage-data ontbreekt; verifieer expliciet postcode, dekking en reisafstand.")
    else:
        verification_guidance.append("Bevestig regionale dekking en eventuele reisafstand-impact voor client en gezin.")
    if coverage["coverage_status"] == "outside_radius":
        verification_guidance.append("Aanbieder ligt buiten service-radius; beoordeel of uitzonderingsroute nodig is.")
    if coverage["coverage_status"] == "uncovered_region":
        verification_guidance.append("Aanbieder heeft geen actieve dekking in deze regio; stem contractuele dekking af.")
    if coverage["region_fallback_used"]:
        verification_guidance.append("Regio-match is fallback; controleer adresgegevens voordat je valideert.")
    verification_guidance.extend([
        "Leg de gekozen onderbouwing vast bij gemeentevalidatie.",
    ])
    if warning_flags["specialization_gap"] or warning_flags["urgency_mismatch"]:
        verification_guidance.append("Toets of specialistische behoeften expliciet afgedekt zijn in het aanbiederprofiel.")
    if tradeoffs:
        verification_guidance.append("Weeg trade-offs expliciet af en leg de keuze vast bij gemeentevalidatie.")
    if match_result.verificatie_advies:
        verification_guidance.append(str(match_result.verificatie_advies).strip())

    explanation_summary = (
        str(match_result.fit_samenvatting).strip()
        or "Matchadvies samengesteld op basis van inhoudelijke fit, regio en capaciteit."
    )

    return {
        "factor_breakdown": factor_breakdown,
        "explanation_summary": explanation_summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "tradeoffs": tradeoffs,
        "confidence_score": confidence_score,
        "confidence_reason": confidence_reason,
        "warning_flags": warning_flags,
        "coverage_basis": coverage["coverage_basis"],
        "coverage_status": coverage["coverage_status"],
        "distance_km": coverage["distance_km"],
        "service_radius_km": coverage["service_radius_km"],
        "verification_guidance": verification_guidance[:6],
    }


def _latest_case_log(intake: CaseIntakeProcess | None) -> list[CaseDecisionLog]:
    if intake is None:
        return []
    return list(
        CaseDecisionLog.objects.filter(Q(case=intake) | Q(case_id_snapshot=intake.pk))
        .order_by("-timestamp", "-id")[:5]
    )


def _active_placement(intake: CaseIntakeProcess | None) -> PlacementRequest | None:
    if intake is None:
        return None
    return (
        PlacementRequest.objects.filter(due_diligence_process=intake)
        .select_related("selected_provider", "proposed_provider")
        .order_by("-updated_at", "-created_at")
        .first()
    )


def _latest_match_result(case_record: CareCase | None) -> MatchResultaat | None:
    if case_record is None:
        return None
    return (
        MatchResultaat.objects.filter(casus=case_record)
        .select_related("zorgaanbieder", "zorgprofiel")
        .order_by("-created_at")
        .first()
    )


def _capacity_signals(*, placement: PlacementRequest | None, match_result: MatchResultaat | None) -> list[dict[str, Any]]:
    signals: list[dict[str, Any]] = []

    provider = None
    if placement is not None:
        provider = placement.selected_provider or placement.proposed_provider
    elif match_result is not None:
        provider = getattr(match_result, "zorgaanbieder", None)

    if provider is not None:
        profile = getattr(provider, "provider_profile", None)
        if profile is not None:
            if profile.current_capacity <= 0:
                signals.append(
                    _serialize_risk(
                        "CAPACITY_RISK",
                        "medium",
                        "Capaciteit is niet beschikbaar of volledig gevuld.",
                        {
                            "current_capacity": profile.current_capacity,
                            "max_capacity": profile.max_capacity,
                            "average_wait_days": profile.average_wait_days,
                        },
                    )
                )
            elif profile.current_capacity <= 2:
                signals.append(
                    _serialize_risk(
                        "CAPACITY_RISK",
                        "medium",
                        "Capaciteit is beperkt; controleer de beschikbare plekken.",
                        {
                            "current_capacity": profile.current_capacity,
                            "max_capacity": profile.max_capacity,
                            "average_wait_days": profile.average_wait_days,
                        },
                    )
                )

    if placement is not None and placement.provider_response_status in {
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    }:
        signals.append(
            _serialize_risk(
                "CAPACITY_RISK",
                "medium",
                "Aanbiederreactie duidt op beperkte capaciteit.",
                {
                    "provider_response_status": placement.provider_response_status,
                    "provider_response_reason_code": placement.provider_response_reason_code,
                },
            )
        )

    if match_result is not None and getattr(match_result, "uitgesloten", False):
        signals.append(
            _serialize_risk(
                "CAPACITY_RISK",
                "medium",
                "Een matchkandidaat is uitgesloten op capaciteit of fit.",
                {
                    "match_result_id": match_result.pk,
                    "uitsluitreden": match_result.uitsluitreden,
                },
            )
        )

    return signals


def _build_allowed_action(
    *,
    action: str,
    label: str,
    reason: str,
    allowed: bool,
) -> dict[str, Any]:
    return {
        "action": action,
        "label": label,
        "reason": reason if not allowed else "",
        "allowed": allowed,
    }


def _evaluate_action_policy(
    *,
    action_code: str,
    current_state: str,
    actor_role: str,
    intake: CaseIntakeProcess | None,
    case_record: CareCase | None,
    assessment: CaseAssessment | None,
    placement: PlacementRequest | None,
    required_data_complete: bool,
    has_summary: bool,
    matching_ready: bool,
    latest_match_confidence: float | None,
    provider_response_pending_sla_breached: bool,
) -> tuple[bool, str]:
    is_mutation_blocked = current_state == WorkflowState.ARCHIVED
    if action_code == "MONITOR_CASE":
        return True, ""

    if is_mutation_blocked:
        return False, "Casus is gearchiveerd."

    if action_code == "COMPLETE_CASE_DATA":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan casusgegevens aanvullen."
        if required_data_complete:
            return False, "De casusgegevens zijn al compleet."
        return True, ""

    if action_code == "GENERATE_SUMMARY":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan de samenvatting genereren."
        if not required_data_complete:
            return False, "Vul eerst de vereiste casusgegevens aan."
        if has_summary:
            return False, "Samenvatting is al beschikbaar."
        return True, ""

    if action_code == "START_MATCHING":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan matching starten."
        if not has_summary:
            return False, "Samenvatting ontbreekt."
        if current_state not in {WorkflowState.DRAFT_CASE, WorkflowState.SUMMARY_READY}:
            return False, "Matching kan alleen starten vanuit de samenvattingsfase."
        return True, ""

    if action_code == "SEND_TO_PROVIDER":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan een casus naar de aanbieder sturen."
        if current_state != WorkflowState.GEMEENTE_VALIDATED:
            return False, "Gemeentevalidatie is vereist voordat de casus naar de aanbieder gaat."
        return True, ""

    if action_code == "VALIDATE_MATCHING":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan matching valideren."
        if current_state != WorkflowState.MATCHING_READY:
            return False, "Valideren kan alleen vanuit de matchingfase."
        return True, ""

    if action_code == "WAIT_PROVIDER_RESPONSE":
        if current_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            return False, "Er loopt nu geen actieve aanbiederbeoordeling."
        return True, ""

    if action_code == "FOLLOW_UP_PROVIDER":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan de aanbieder opvolgen."
        if current_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            return False, "Aanbiederopvolging is alleen relevant tijdens lopende beoordeling."
        if not provider_response_pending_sla_breached:
            return False, "De aanbiederbeoordeling is nog niet SLA-overschreden."
        return True, ""

    if action_code == "REMATCH_CASE":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan een casus her-matchen."
        if current_state != WorkflowState.PROVIDER_REJECTED:
            return False, "Her-matching is alleen nodig na afwijzing door de aanbieder."
        return True, ""

    if action_code == "CONFIRM_PLACEMENT":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan plaatsing bevestigen."
        if current_state != WorkflowState.PROVIDER_ACCEPTED:
            return False, "Plaatsing kan pas na acceptatie worden bevestigd."
        if placement is None:
            return False, "Plaatsing ontbreekt."
        allowed, reason = placement.can_transition_to_status(PlacementRequest.Status.APPROVED)
        return allowed, reason

    if action_code == "START_INTAKE":
        if actor_role != WorkflowRole.ZORGAANBIEDER:
            return False, "Alleen de zorgaanbieder kan intake starten."
        if current_state != WorkflowState.PLACEMENT_CONFIRMED:
            return False, "Intake kan pas starten na bevestigde plaatsing."
        if placement is None or placement.status != PlacementRequest.Status.APPROVED:
            return False, "Plaatsing is nog niet bevestigd."
        return True, ""

    if action_code == "ARCHIVE_CASE":
        if actor_role not in {WorkflowRole.GEMEENTE, WorkflowRole.ADMIN}:
            return False, "Alleen gemeente of admin kan een casus archiveren."
        if intake is None or intake.status != CaseIntakeProcess.ProcessStatus.COMPLETED:
            return False, "Alleen afgeronde casussen kunnen worden gearchiveerd."
        return True, ""

    if action_code == "PROVIDER_ACCEPT":
        if actor_role != WorkflowRole.ZORGAANBIEDER:
            return False, "Alleen de aanbieder kan accepteren."
        if current_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            return False, "Accepteren kan pas tijdens actieve aanbiederbeoordeling."
        return True, ""

    if action_code == "PROVIDER_REJECT":
        if actor_role != WorkflowRole.ZORGAANBIEDER:
            return False, "Alleen de aanbieder kan afwijzen."
        if current_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            return False, "Afwijzen kan pas tijdens actieve aanbiederbeoordeling."
        return True, ""

    if action_code == "PROVIDER_REQUEST_INFO":
        if actor_role != WorkflowRole.ZORGAANBIEDER:
            return False, "Alleen de aanbieder kan aanvullende informatie opvragen."
        if current_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            return False, "Aanvullende informatie opvragen kan pas tijdens aanbiederbeoordeling."
        return True, ""

    return False, "Actie niet beschikbaar voor deze casus."


def _build_blockers_and_alerts(
    *,
    current_state: str,
    intake: CaseIntakeProcess | None,
    case_record: CareCase | None,
    assessment: CaseAssessment | None,
    placement: PlacementRequest | None,
    required_data_complete: bool,
    has_summary: bool,
    has_matching_result: bool,
    latest_match_confidence: float | None,
    provider_rejection_count: int,
    latest_rejection_reason: str,
    placement_confirmed: bool,
    intake_started: bool,
    hours_in_current_state: float | None,
    urgency: str,
    capacity_signals: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    blockers: list[dict[str, Any]] = []
    risks: list[dict[str, Any]] = []
    alerts: list[dict[str, Any]] = []
    alert_codes: set[str] = set()
    provider_pending_sla_breached = False

    def add_alert(payload: dict[str, Any]) -> None:
        code = payload.get("code")
        if code in alert_codes:
            return
        alert_codes.add(code)
        alerts.append(payload)

    if current_state == WorkflowState.ARCHIVED:
        blockers.append(
            _serialize_blocker(
                "CASE_ARCHIVED",
                "critical",
                "Casus is gearchiveerd en kan niet meer worden gewijzigd.",
                [
                    "COMPLETE_CASE_DATA",
                    "GENERATE_SUMMARY",
                    "START_MATCHING",
                    "SEND_TO_PROVIDER",
                    "PROVIDER_ACCEPT",
                    "PROVIDER_REJECT",
                    "PROVIDER_REQUEST_INFO",
                    "CONFIRM_PLACEMENT",
                    "START_INTAKE",
                    "REMATCH_CASE",
                    "ARCHIVE_CASE",
                ],
            )
        )
        add_alert(
            _serialize_alert(
                "ARCHIVED_CASE",
                "info",
                "Casus gearchiveerd",
                "Deze casus is alleen-lezen en staat niet meer in de actieve werkvoorraad.",
                "MONITOR_CASE",
                {"state": current_state},
            )
        )
        return blockers, risks, alerts, {"provider_pending_sla_breached": False}

    if not required_data_complete:
        blockers.append(
            _serialize_blocker(
                "MISSING_REQUIRED_CASE_DATA",
                "critical",
                "Verplichte casusgegevens ontbreken. Vul de casus eerst aan.",
                ["GENERATE_SUMMARY", "START_MATCHING", "SEND_TO_PROVIDER"],
            )
        )
        add_alert(
            _serialize_alert(
                "INCOMPLETE_CASE",
                "critical",
                "Casus is nog niet compleet",
                "Aanvullen van de casusgegevens is nodig voordat de workflow verder kan.",
                "COMPLETE_CASE_DATA",
                {"required_data_complete": False},
            )
        )
        return blockers, risks, alerts, {"provider_pending_sla_breached": False}

    if not has_summary and current_state in {WorkflowState.DRAFT_CASE, WorkflowState.SUMMARY_READY}:
        blockers.append(
            _serialize_blocker(
                "MISSING_SUMMARY",
                "critical",
                "Samenvatting ontbreekt. Matching kan nog niet starten.",
                ["START_MATCHING", "SEND_TO_PROVIDER"],
            )
        )
        add_alert(
            _serialize_alert(
                "MISSING_SUMMARY",
                "high",
                "Samenvatting ontbreekt",
                "Maak eerst de samenvatting compleet voordat matching kan worden doorgezet.",
                "GENERATE_SUMMARY",
                {"has_summary": False},
            )
        )
        return blockers, risks, alerts, {"provider_pending_sla_breached": False}

    if current_state in {WorkflowState.SUMMARY_READY, WorkflowState.DRAFT_CASE} and has_summary:
        blockers.append(
            _serialize_blocker(
                "MATCHING_NOT_READY",
                "high",
                "Matching is nog niet gestart of nog niet gereed.",
                ["VALIDATE_MATCHING", "SEND_TO_PROVIDER", "PROVIDER_ACCEPT", "PROVIDER_REJECT"],
            )
        )
        add_alert(
            _serialize_alert(
                "NO_MATCH_AVAILABLE",
                "high",
                "Nog geen matchingresultaat",
                "Werk het matchadvies uit voordat gemeentevalidatie en aanbiederbeoordeling mogelijk zijn.",
                "START_MATCHING",
                {"has_matching_result": False},
            )
        )

    if current_state == WorkflowState.MATCHING_READY and has_matching_result:
        add_alert(
            _serialize_alert(
                "GEMEENTE_VALIDATION_REQUIRED",
                "high",
                "Gemeente validatie vereist",
                "Controleer en valideer het matchadvies voordat de casus naar de aanbieder gaat.",
                "VALIDATE_MATCHING",
                {"state": current_state},
            )
        )

    if current_state == WorkflowState.PROVIDER_REVIEW_PENDING:
        if hours_in_current_state is not None and hours_in_current_state >= DECISION_ENGINE_THRESHOLDS["provider_response_sla_hours"]:
            provider_pending_sla_breached = True
            add_alert(
                _serialize_alert(
                    "PROVIDER_REVIEW_PENDING_SLA",
                    "high",
                    "Aanbieder beoordeling wacht te lang",
                    "De providerreactie is SLA-overschreden; volg de aanbieder op.",
                    "FOLLOW_UP_PROVIDER",
                    {"hours_in_current_state": hours_in_current_state},
                )
            )

    if provider_rejection_count >= DECISION_ENGINE_THRESHOLDS["repeated_rejection_count"]:
        risks.append(
            _serialize_risk(
                "REPEATED_PROVIDER_REJECTIONS",
                "high",
                "Deze casus is meerdere keren afgewezen door aanbieders.",
                {
                    "provider_rejection_count": provider_rejection_count,
                    "latest_rejection_reason": latest_rejection_reason,
                },
            )
        )
        add_alert(
            _serialize_alert(
                "PROVIDER_REJECTED_CASE",
                "high",
                "Casus is door een aanbieder afgewezen",
                "Her-match de casus of kijk kritisch naar de matchonderbouwing.",
                "REMATCH_CASE",
                {
                    "provider_rejection_count": provider_rejection_count,
                    "latest_rejection_reason": latest_rejection_reason,
                },
            )
        )

    if latest_match_confidence is not None and latest_match_confidence < DECISION_ENGINE_THRESHOLDS["low_match_confidence"]:
        risks.append(
            _serialize_risk(
                "LOW_MATCH_CONFIDENCE",
                "medium",
                "Match confidence is laag. Controleer match onderbouwing.",
                {"latest_match_confidence": latest_match_confidence},
            )
        )
        add_alert(
            _serialize_alert(
                "WEAK_MATCH_NEEDS_VERIFICATION",
                "warning",
                "Zwakke match vraagt verificatie",
                "De huidige match vraagt extra controle voordat deze wordt doorgezet.",
                "START_MATCHING",
                {"latest_match_confidence": latest_match_confidence},
            )
        )

    if capacity_signals:
        risks.extend(capacity_signals)

    if urgency in {CaseIntakeProcess.Urgency.HIGH, CaseIntakeProcess.Urgency.CRISIS} and hours_in_current_state is not None:
        if hours_in_current_state >= DECISION_ENGINE_THRESHOLDS["urgent_idle_hours"]:
            risks.append(
                _serialize_risk(
                    "HIGH_URGENCY_IDLE",
                    "high",
                    "Hoge urgentie staat te lang stil in dezelfde stap.",
                    {"hours_in_current_state": hours_in_current_state, "urgency": urgency},
                )
            )

    if placement_confirmed and not intake_started:
        days_since_placement = hours_in_current_state / 24.0 if hours_in_current_state is not None else None
        if days_since_placement is not None and days_since_placement >= DECISION_ENGINE_THRESHOLDS["intake_start_sla_days"]:
            risks.append(
                _serialize_risk(
                    "INTAKE_DELAYED",
                    "medium",
                    "Plaatsing is bevestigd maar intake is nog niet gestart.",
                    {"days_since_placement": round(days_since_placement, 2)},
                )
            )
            add_alert(
                _serialize_alert(
                    "INTAKE_NOT_STARTED",
                    "warning",
                    "Intake is nog niet gestart",
                    "De plaatsing is bevestigd, maar de intake-overdracht loopt achter.",
                    "START_INTAKE",
                    {"days_since_placement": round(days_since_placement, 2)},
                )
            )

    if placement is not None and placement.provider_response_status in {
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    }:
        add_alert(
            _serialize_alert(
                "PROVIDER_REJECTED_CASE",
                "high",
                "Casus is afgewezen of doorgeschoven",
                "De provider heeft de casus niet geaccepteerd; kies een nieuwe match of remedieer de blokkade.",
                "REMATCH_CASE",
                {
                    "provider_response_status": placement.provider_response_status,
                    "provider_response_reason_code": placement.provider_response_reason_code,
                },
            )
        )
        blockers.append(
            _serialize_blocker(
                "PROVIDER_NOT_ACCEPTED",
                "high",
                "Plaatsing kan nog niet worden bevestigd omdat de aanbieder niet heeft geaccepteerd.",
                ["CONFIRM_PLACEMENT", "START_INTAKE"],
            )
        )

    if current_state in {WorkflowState.PROVIDER_ACCEPTED, WorkflowState.PLACEMENT_CONFIRMED} and not placement_confirmed:
        blockers.append(
            _serialize_blocker(
                "PLACEMENT_NOT_CONFIRMED",
                "high",
                "Intake kan nog niet starten omdat plaatsing niet is bevestigd.",
                ["START_INTAKE"],
            )
        )
        add_alert(
            _serialize_alert(
                "PLACEMENT_BLOCKED",
                "high",
                "Plaatsing wacht nog op bevestiging",
                "Bevestig plaatsing pas nadat de aanbieder heeft geaccepteerd.",
                "CONFIRM_PLACEMENT",
                {"placement_confirmed": False},
            )
        )

    if current_state in {WorkflowState.PROVIDER_REVIEW_PENDING, WorkflowState.PROVIDER_ACCEPTED, WorkflowState.PROVIDER_REJECTED} and not has_matching_result:
        add_alert(
            _serialize_alert(
                "NO_MATCH_AVAILABLE",
                "high",
                "Nog geen betrouwbare match",
                "Er is nog geen voldoende onderbouwd matchingresultaat beschikbaar.",
                "START_MATCHING",
                {"has_matching_result": False},
            )
        )

    return blockers, risks, alerts, {"provider_pending_sla_breached": provider_pending_sla_breached}


def _next_best_action(
    *,
    current_state: str,
    required_data_complete: bool,
    has_summary: bool,
    provider_pending_sla_breached: bool,
    provider_rejection_count: int,
    placement_confirmed: bool,
    intake_started: bool,
    is_archived: bool,
) -> dict[str, Any] | None:
    if is_archived:
        return None

    priority, reason = _STATE_PRIORITY.get(current_state, ("low", "Monitor de casus"))
    action = "MONITOR_CASE"

    if not required_data_complete:
        action = "COMPLETE_CASE_DATA"
        priority = "medium"
        reason = "Verplichte casusgegevens ontbreken."
    elif not has_summary and current_state in {WorkflowState.DRAFT_CASE, WorkflowState.SUMMARY_READY}:
        action = "GENERATE_SUMMARY"
        priority = "medium"
        reason = "Samenvatting ontbreekt."
    elif current_state == WorkflowState.SUMMARY_READY:
        action = "START_MATCHING"
        priority = "high"
        reason = "Samenvatting is compleet; start matching."
    elif current_state == WorkflowState.MATCHING_READY:
        action = "VALIDATE_MATCHING"
        priority = "high"
        reason = "Gemeentevalidatie is verplicht vóór versturen naar aanbieder."
    elif current_state == WorkflowState.GEMEENTE_VALIDATED:
        action = "SEND_TO_PROVIDER"
        priority = "high"
        reason = "Validatie is afgerond; stuur de casus naar aanbiederbeoordeling."
    elif current_state == WorkflowState.PROVIDER_REVIEW_PENDING:
        if provider_pending_sla_breached:
            action = "FOLLOW_UP_PROVIDER"
            priority = "critical"
            reason = "De aanbiederbeoordeling is SLA-overschreden."
        else:
            action = "WAIT_PROVIDER_RESPONSE"
            priority = "medium"
            reason = "Wacht op aanbiederreactie."
    elif current_state == WorkflowState.PROVIDER_REJECTED:
        action = "REMATCH_CASE"
        priority = "high"
        reason = "Aanbieder heeft afgewezen; maak een nieuwe match."
    elif current_state == WorkflowState.PROVIDER_ACCEPTED:
        action = "CONFIRM_PLACEMENT"
        priority = "high"
        reason = "Aanbieder heeft geaccepteerd; bevestig de plaatsing."
    elif current_state == WorkflowState.PLACEMENT_CONFIRMED:
        action = "START_INTAKE"
        priority = "high"
        reason = "Plaatsing is bevestigd; start de intake-overdracht."
    elif current_state == WorkflowState.INTAKE_STARTED:
        if intake_started:
            action = "MONITOR_CASE"
            priority = "low"
            reason = "Intake loopt; monitor de voortgang."
        else:
            action = "ARCHIVE_CASE"
            priority = "low"
            reason = "Afronden en archiveren is mogelijk zodra de casus compleet is."

    return {
        "action": action,
        "label": {
            "COMPLETE_CASE_DATA": "Casusgegevens aanvullen",
            "GENERATE_SUMMARY": "Samenvatting genereren",
            "START_MATCHING": "Start matching",
            "VALIDATE_MATCHING": "Valideer matching",
            "SEND_TO_PROVIDER": "Stuur naar aanbieder",
            "WAIT_PROVIDER_RESPONSE": "Wacht op aanbiederreactie",
            "FOLLOW_UP_PROVIDER": "Volg aanbieder op",
            "REMATCH_CASE": "Her-match casus",
            "CONFIRM_PLACEMENT": "Bevestig plaatsing",
            "START_INTAKE": "Start intake",
            "MONITOR_CASE": "Monitor casus",
            "ARCHIVE_CASE": "Archiveer casus",
        }.get(action, action),
        "priority": {
            "critical": "critical",
            "high": "high",
            "medium": "medium",
            "low": "low",
        }.get(priority, "low"),
        "reason": reason,
    }


def evaluate_case(case: Any, actor: Any | None = None, actor_role: str | None = None) -> dict[str, Any]:
    intake, case_record = _case_parts(case)
    primary_case = _primary_case_object(case, intake, case_record)
    now = timezone.now()

    if actor_role is None and actor is not None and case_record is not None:
        actor_role = resolve_actor_role(user=actor, organization=case_record.organization)
    actor_role = actor_role or WorkflowRole.GEMEENTE

    assessment = None
    if intake is not None:
        try:
            assessment = intake.case_assessment
        except CaseAssessment.DoesNotExist:
            assessment = None

    placement = _active_placement(intake)
    match_result = _latest_match_result(case_record)
    current_state = (
        derive_workflow_state(intake=intake, assessment=assessment, placement=placement)
        if intake is not None
        else (
            WorkflowState.ARCHIVED
            if case_record is not None and case_record.lifecycle_stage == "ARCHIVED"
            else {
                CareCase.CasePhase.INTAKE: WorkflowState.DRAFT_CASE,
                CareCase.CasePhase.MATCHING: WorkflowState.MATCHING_READY,
                CareCase.CasePhase.PROVIDER_BEOORDELING: WorkflowState.PROVIDER_REVIEW_PENDING,
                CareCase.CasePhase.PLAATSING: WorkflowState.PLACEMENT_CONFIRMED,
                CareCase.CasePhase.ACTIEF: WorkflowState.INTAKE_STARTED,
                CareCase.CasePhase.AFGEROND: WorkflowState.INTAKE_STARTED,
            }.get(getattr(case_record, "case_phase", None), WorkflowState.DRAFT_CASE)
        )
    )
    is_archived = current_state == WorkflowState.ARCHIVED
    phase = _STATE_PHASE_MAP.get(current_state, "casus")

    required_data_complete = _required_data_complete(intake, case_record)
    summary_text = _summary_text(intake=intake, case_record=case_record, assessment=assessment)
    has_summary = bool(summary_text)
    has_matching_result = bool(match_result)
    latest_match_confidence = _confidence_to_score(match_result)
    provider_review_status = _clean(placement.provider_response_status) if placement else ""
    provider_rejection_count = 0
    latest_rejection_reason = ""
    placement_confirmed = bool(placement and placement.status == PlacementRequest.Status.APPROVED)
    intake_started = bool(intake and intake.status == CaseIntakeProcess.ProcessStatus.COMPLETED)

    if intake is not None:
        rejection_qs = PlacementRequest.objects.filter(
            due_diligence_process=intake,
            provider_response_status__in={
                PlacementRequest.ProviderResponseStatus.REJECTED,
                PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
                PlacementRequest.ProviderResponseStatus.WAITLIST,
            },
        ).order_by("-updated_at", "-created_at")
        provider_rejection_count = rejection_qs.count()
        latest_rejection = rejection_qs.first()
        if latest_rejection is not None:
            if latest_rejection.provider_response_reason_code and latest_rejection.provider_response_reason_code != "NONE":
                latest_rejection_reason = latest_rejection.get_provider_response_reason_code_display()
            else:
                latest_rejection_reason = _clean(latest_rejection.provider_response_notes)

    case_logs = _latest_case_log(intake)
    current_state_reference = (
        placement.provider_response_recorded_at
        if placement and placement.provider_response_recorded_at
        else placement.updated_at
        if placement
        else assessment.updated_at
        if assessment and assessment.updated_at
        else intake.updated_at
        if intake and intake.updated_at
        else getattr(primary_case, "updated_at", None)
    )
    hours_in_current_state = _coerce_hours(current_state_reference)
    case_age_hours = _coerce_hours(getattr(primary_case, "created_at", None))
    urgency = _clean(getattr(intake, "urgency", None)) if intake is not None else _clean(getattr(case_record, "risk_level", None))

    capacity_signals = _capacity_signals(placement=placement, match_result=match_result)
    blockers, risks, alerts, timing_context = _build_blockers_and_alerts(
        current_state=current_state,
        intake=intake,
        case_record=case_record,
        assessment=assessment,
        placement=placement,
        required_data_complete=required_data_complete,
        has_summary=has_summary,
        has_matching_result=has_matching_result,
        latest_match_confidence=latest_match_confidence,
        provider_rejection_count=provider_rejection_count,
        latest_rejection_reason=latest_rejection_reason,
        placement_confirmed=placement_confirmed,
        intake_started=intake_started,
        hours_in_current_state=hours_in_current_state,
        urgency=urgency,
        capacity_signals=capacity_signals,
    )
    provider_pending_sla_breached = bool(timing_context.get("provider_pending_sla_breached"))
    explainability = _build_matching_explainability(
        intake=intake,
        case_record=case_record,
        match_result=match_result,
        latest_match_confidence=latest_match_confidence,
        urgency=urgency,
        risks=risks,
    )

    next_best_action = _next_best_action(
        current_state=current_state,
        required_data_complete=required_data_complete,
        has_summary=has_summary,
        provider_pending_sla_breached=provider_pending_sla_breached,
        provider_rejection_count=provider_rejection_count,
        placement_confirmed=placement_confirmed,
        intake_started=intake_started,
        is_archived=is_archived,
    )

    action_rows = [
        ("COMPLETE_CASE_DATA", "Casusgegevens aanvullen"),
        ("GENERATE_SUMMARY", "Samenvatting genereren"),
        ("START_MATCHING", "Start matching"),
        ("VALIDATE_MATCHING", "Valideer matching"),
        ("SEND_TO_PROVIDER", "Stuur naar aanbieder"),
        ("WAIT_PROVIDER_RESPONSE", "Wacht op aanbiederreactie"),
        ("FOLLOW_UP_PROVIDER", "Volg aanbieder op"),
        ("REMATCH_CASE", "Her-match casus"),
        ("CONFIRM_PLACEMENT", "Bevestig plaatsing"),
        ("START_INTAKE", "Start intake"),
        ("MONITOR_CASE", "Monitor casus"),
        ("ARCHIVE_CASE", "Archiveer casus"),
        ("PROVIDER_ACCEPT", "Aanbieder accepteert"),
        ("PROVIDER_REJECT", "Aanbieder wijst af"),
        ("PROVIDER_REQUEST_INFO", "Aanvullende info opvragen"),
    ]
    allowed_actions: list[dict[str, Any]] = []
    blocked_actions: list[dict[str, Any]] = []
    for action_code, label in action_rows:
        allowed, reason = _evaluate_action_policy(
            action_code=action_code,
            current_state=current_state,
            actor_role=actor_role,
            intake=intake,
            case_record=case_record,
            assessment=assessment,
            placement=placement,
            required_data_complete=required_data_complete,
            has_summary=has_summary,
            matching_ready=current_state in {WorkflowState.MATCHING_READY, WorkflowState.PROVIDER_REVIEW_PENDING, WorkflowState.PROVIDER_ACCEPTED, WorkflowState.PROVIDER_REJECTED, WorkflowState.PLACEMENT_CONFIRMED, WorkflowState.INTAKE_STARTED},
            latest_match_confidence=latest_match_confidence,
            provider_response_pending_sla_breached=provider_pending_sla_breached,
        )
        payload = _build_allowed_action(action=action_code, label=label, reason=reason, allowed=allowed)
        if allowed:
            allowed_actions.append(payload)
        else:
            blocked_actions.append(payload)

    timeline_signals = {
        "latest_event_type": case_logs[0].event_type if case_logs else "",
        "latest_event_at": case_logs[0].timestamp.isoformat() if case_logs else "",
        "recent_events": [
            {
                "event_type": log.event_type,
                "user_action": log.user_action,
                "timestamp": log.timestamp.isoformat() if log.timestamp else "",
                "action_source": log.action_source,
            }
            for log in case_logs
        ],
    }

    decision_context = {
        "required_data_complete": required_data_complete,
        "has_summary": has_summary,
        "has_matching_result": has_matching_result,
        "latest_match_confidence": latest_match_confidence,
        "provider_review_status": provider_review_status,
        "provider_rejection_count": provider_rejection_count,
        "latest_rejection_reason": latest_rejection_reason,
        "placement_confirmed": placement_confirmed,
        "intake_started": intake_started,
        "case_age_hours": case_age_hours,
        "hours_in_current_state": hours_in_current_state,
        "urgency": urgency,
        "capacity_signals": capacity_signals,
        "matching_explainability": explainability,
        "selected_provider_id": (
            str(placement.selected_provider_id)
            if placement and placement.selected_provider_id
            else str(match_result.zorgaanbieder_id)
            if match_result and getattr(match_result, "zorgaanbieder_id", None)
            else None
        ),
        "selected_provider_name": (
            placement.selected_provider.name
            if placement and placement.selected_provider
            else match_result.zorgaanbieder.name
            if match_result and getattr(match_result, "zorgaanbieder", None)
            else None
        ),
    }

    return {
        "case_id": getattr(primary_case, "pk", None),
        "current_state": current_state,
        "phase": phase,
        "next_best_action": next_best_action,
        "blockers": blockers,
        "risks": risks,
        "alerts": alerts,
        "factor_breakdown": explainability["factor_breakdown"],
        "explanation_summary": explainability["explanation_summary"],
        "strengths": explainability["strengths"],
        "weaknesses": explainability["weaknesses"],
        "tradeoffs": explainability["tradeoffs"],
        "confidence_score": explainability["confidence_score"],
        "confidence_reason": explainability["confidence_reason"],
        "warning_flags": explainability["warning_flags"],
        "coverage_basis": explainability["coverage_basis"],
        "coverage_status": explainability["coverage_status"],
        "distance_km": explainability["distance_km"],
        "service_radius_km": explainability["service_radius_km"],
        "verification_guidance": explainability["verification_guidance"],
        "allowed_actions": allowed_actions,
        "blocked_actions": blocked_actions,
        "decision_context": decision_context,
        "timeline_signals": timeline_signals,
    }
