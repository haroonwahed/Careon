from __future__ import annotations

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


_STATE_PHASE_MAP = {
    WorkflowState.DRAFT_CASE: "casus",
    WorkflowState.SUMMARY_READY: "samenvatting",
    WorkflowState.MATCHING_READY: "matching",
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
    WorkflowState.MATCHING_READY: ("high", "start matching"),
    WorkflowState.PROVIDER_REVIEW_PENDING: ("high", "volg aanbieder beoordeling op"),
    WorkflowState.PROVIDER_ACCEPTED: ("high", "bevestig plaatsing"),
    WorkflowState.PROVIDER_REJECTED: ("high", "hermatch de casus"),
    WorkflowState.PLACEMENT_CONFIRMED: ("medium", "start intake"),
    WorkflowState.INTAKE_STARTED: ("low", "monitor casus"),
    WorkflowState.ARCHIVED: ("low", "archief"),
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
        if current_state != WorkflowState.MATCHING_READY:
            return False, "Matching is nog niet gereed voor aanbiederbeoordeling."
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
        if actor_role not in {WorkflowRole.ZORGAANBIEDER, WorkflowRole.ADMIN}:
            return False, "Deze rol kan intake niet starten."
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
        if actor_role not in {WorkflowRole.ZORGAANBIEDER, WorkflowRole.ADMIN}:
            return False, "Alleen de aanbieder kan accepteren."
        if current_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            return False, "Accepteren kan pas tijdens actieve aanbiederbeoordeling."
        return True, ""

    if action_code == "PROVIDER_REJECT":
        if actor_role not in {WorkflowRole.ZORGAANBIEDER, WorkflowRole.ADMIN}:
            return False, "Alleen de aanbieder kan afwijzen."
        if current_state != WorkflowState.PROVIDER_REVIEW_PENDING:
            return False, "Afwijzen kan pas tijdens actieve aanbiederbeoordeling."
        return True, ""

    if action_code == "PROVIDER_REQUEST_INFO":
        if actor_role not in {WorkflowRole.ZORGAANBIEDER, WorkflowRole.ADMIN}:
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
                ["SEND_TO_PROVIDER", "PROVIDER_ACCEPT", "PROVIDER_REJECT"],
            )
        )
        add_alert(
            _serialize_alert(
                "NO_MATCH_AVAILABLE",
                "high",
                "Nog geen matchingresultaat",
                "Start matching of kies een geschikte aanbieder voordat de provider kan beoordelen.",
                "START_MATCHING",
                {"has_matching_result": False},
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
        action = "SEND_TO_PROVIDER"
        priority = "high"
        reason = "Selecteer en stuur een aanbieder aan voor beoordeling."
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
        "allowed_actions": allowed_actions,
        "blocked_actions": blocked_actions,
        "decision_context": decision_context,
        "timeline_signals": timeline_signals,
    }
