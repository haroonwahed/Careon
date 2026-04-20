from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from contracts.governance import get_policy_values
from contracts.provider_metrics import build_provider_behavior_metrics, derive_behavior_signals


# ---------------------------------------------------------------------------
# Rejection reason taxonomy
# Maps OutcomeReasonCode values (from models.OutcomeReasonCode) to structured
# guidance used in build_v3_evidence() provider_feedback output.
# ---------------------------------------------------------------------------

REJECTION_TAXONOMY: Dict[str, Dict[str, str]] = {
    'CAPACITY': {
        'label': 'Capaciteit',
        'description': 'Aanbieder heeft onvoldoende capaciteit voor plaatsing.',
        'guidance': 'Selecteer een aanbieder met aantoonbaar beschikbare capaciteit.',
        'matching_signal': 'Prioriteer kandidaten met vrije capaciteit in komende 14 dagen.',
    },
    'WAITLIST': {
        'label': 'Wachtlijst',
        'description': 'Aanbieder heeft cliënt op wachtlijst geplaatst.',
        'guidance': 'Overweeg aanbieder zonder wachtlijst of verhoog urgentie.',
        'matching_signal': 'Filter op aanbieders met wachttijd ≤ 14 dagen.',
    },
    'CLIENT_DECLINED': {
        'label': 'Cliënt heeft afgezien',
        'description': 'Cliënt heeft zelf de plaatsing bij deze aanbieder afgewezen.',
        'guidance': 'Bespreek voorkeuren en bezwaren opnieuw met cliënt.',
        'matching_signal': 'Verifieer cliëntvoorkeur vóór volgende aanbiedersselectie.',
    },
    'PROVIDER_DECLINED': {
        'label': 'Aanbieder heeft afgewezen',
        'description': 'Aanbieder heeft de casus expliciet afgewezen.',
        'guidance': 'Herstart matching met een andere aanbieder.',
        'matching_signal': 'Markeer aanbieder als niet-beschikbaar voor deze casus.',
    },
    'NO_SHOW': {
        'label': 'Niet verschenen',
        'description': 'Cliënt of aanbieder is niet verschenen bij intake.',
        'guidance': 'Controleer cliëntbetrokkenheid en plan herhaalde intake.',
        'matching_signal': 'Noteer no-show risico in cliëntprofiel.',
    },
    'NO_RESPONSE': {
        'label': 'Geen reactie',
        'description': 'Aanbieder heeft niet gereageerd op plaatsingsverzoek.',
        'guidance': 'Escaleer: aanbieder reageert niet binnen SLA-termijn.',
        'matching_signal': 'Deprioriteer aanbieder bij toekomstige matches totdat reactie is ontvangen.',
    },
    'CARE_MISMATCH': {
        'label': 'Zorgvraag past niet',
        'description': 'Zorgvraag van cliënt sluit niet aan op het aanbod van de aanbieder.',
        'guidance': 'Verfijn het zorgprofiel en selecteer een aanbieder met passende specialisatie.',
        'matching_signal': 'Verhoog gewicht van specialisatiematch bij hermatching.',
    },
    'REGION_MISMATCH': {
        'label': 'Regio past niet',
        'description': 'Aanbieder valt buiten de voorkeursregio van cliënt.',
        'guidance': 'Selecteer een aanbieder in de voorkeursregio.',
        'matching_signal': 'Beperk kandidatenlijst tot aanbieders binnen gewenste regio.',
    },
    'SAFETY_RISK': {
        'label': 'Veiligheidsrisico',
        'description': 'Er is een veiligheidsrisico gesignaleerd bij de voorgestelde plaatsing.',
        'guidance': 'Escaleer direct naar casemanager: veiligheidsrisico vereist menselijke beslissing.',
        'matching_signal': 'Blokkeer automatische rematch – handmatige goedkeuring vereist.',
    },
    'ADMINISTRATIVE_BLOCK': {
        'label': 'Administratieve blokkade',
        'description': 'Administratieve of contractuele blokkade verhindert plaatsing.',
        'guidance': 'Verhelp administratieve blokkade vóór opnieuw starten van matching.',
        'matching_signal': 'Controleer contract- en toelatingsstatus bij aanbieder.',
    },
    'OTHER': {
        'label': 'Anders',
        'description': 'Reden voor afwijzing valt buiten de standaard categorieën.',
        'guidance': 'Registreer specifieke reden en overleg met casemanager.',
        'matching_signal': 'Documenteer reden voor toekomstige beslissingsondersteuning.',
    },
    'NONE': {
        'label': 'Geen specifieke reden',
        'description': 'Geen reden opgegeven voor de uitkomst.',
        'guidance': 'Vraag de aanbieder om een specifieke reden te vermelden.',
        'matching_signal': '',
    },
}


CASE_DATA_REQUIRED_FIELDS = (
    "phase",
    "care_category",
    "urgency",
    "assessment_complete",
    "matching_run_exists",
    "top_match_confidence",
    "top_match_has_capacity_issue",
    "top_match_wait_days",
    "selected_provider_id",
    "placement_status",
    "placement_updated_at",
    "rejected_provider_count",
    "open_signal_count",
    "open_task_count",
    "case_updated_at",
    "candidate_suggestions",
)


CASE_DATA_SHAPE: Dict[str, str] = {
    "phase": "str: current case phase/status code",
    "care_category": "str|None: normalized care category code/name",
    "urgency": "str|None: normalized urgency code",
    "assessment_complete": "bool: whether assessment is complete and matching-ready",
    "matching_run_exists": "bool: whether matching has been executed",
    "top_match_confidence": "str|None: high|medium|low|None",
    "top_match_has_capacity_issue": "bool: top match has no/limited capacity",
    "top_match_wait_days": "int|None: wait days for top match",
    "selected_provider_id": "int|str|None: selected provider identifier",
    "placement_status": "str|None: placement status code",
    "placement_updated_at": "date|datetime|None: last placement update",
    "rejected_provider_count": "int: amount of rejected providers",
    "open_signal_count": "int: number of open risk signals",
    "open_task_count": "int: number of open tasks",
    "case_updated_at": "date|datetime|None: last case update",
    "candidate_suggestions": (
        "list[dict]: providers with at least provider_id, confidence, has_capacity_issue, wait_days "
        "and optional has_region_mismatch"
    ),
    "has_preferred_region": "bool|None: whether a preferred region is set",
    "has_assessment_summary": "bool|None: whether assessment summary text is present",
    "has_client_age_category": "bool|None: whether age category is present",
    "assessment_status": "str|None: normalized assessment status code",
    "assessment_matching_ready": "bool|None: explicit matching-ready indicator",
    "matching_updated_at": "date|datetime|None: timestamp of latest matching selection",
    "provider_response_status": "str|None: provider response status code",
    "provider_response_recorded_at": "date|datetime|None: provider response recorded timestamp",
    "provider_response_requested_at": "date|datetime|None: latest provider response request timestamp",
    "provider_response_deadline_at": "date|datetime|None: response deadline timestamp",
    "provider_response_last_reminder_at": "date|datetime|None: last reminder timestamp",
    "now": "date|datetime|None: optional override for deterministic time-based rules",
}


def _validate_case_data(case_data: Dict[str, Any]) -> None:
    missing = [key for key in CASE_DATA_REQUIRED_FIELDS if key not in case_data]
    if missing:
        raise ValueError(f"case_data is missing required keys: {', '.join(sorted(missing))}")


def _coerce_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _to_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _to_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)
    return None


def _normalize_provider_response_status(status: Any) -> str:
    normalized = str(status or "").strip().upper()
    if normalized == "DECLINED":
        return "REJECTED"
    if normalized == "NO_RESPONSE":
        return "PENDING"
    if normalized in {
        "PENDING",
        "ACCEPTED",
        "REJECTED",
        "NEEDS_INFO",
        "WAITLIST",
        "NO_CAPACITY",
    }:
        return normalized
    return "PENDING"


def _placement_field(placement: Any, field_name: str) -> Any:
    if isinstance(placement, dict):
        return placement.get(field_name)
    return getattr(placement, field_name, None)


def _provider_response_reference_timestamp(placement: Any) -> datetime | None:
    candidate_values = [
        _placement_field(placement, "provider_response_last_reminder_at"),
        _placement_field(placement, "last_sent_at"),
        _placement_field(placement, "provider_response_requested_at"),
        _placement_field(placement, "requested_at"),
        _placement_field(placement, "updated_at"),
    ]
    for value in candidate_values:
        resolved = _to_datetime(value)
        if resolved is not None:
            return resolved
    return None


def _normalize_now(now: Any) -> datetime:
    resolved = _to_datetime(now)
    if resolved is not None:
        if resolved.tzinfo is None:
            return resolved.replace(tzinfo=timezone.utc)
        return resolved
    return datetime.now(timezone.utc)


def _elapsed_waiting_hours(reference_at: datetime | None, now: datetime) -> int:
    if reference_at is None:
        return 0
    if reference_at.tzinfo is None:
        reference_at = reference_at.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    elapsed_seconds = (now - reference_at).total_seconds()
    if elapsed_seconds <= 0:
        return 0
    return int(elapsed_seconds // 3600)


def get_provider_sla_adjustment(provider_metrics: Dict[str, Any] | None) -> Dict[str, int]:
    """Return behavior-aware SLA threshold adjustments for a single provider.

    Adjustments are deterministic and side-effect free.  Both values are
    bounded to [-12, +12] hours and apply additively to SLA thresholds:

    response_time_modifier_hours
        Positive extends the initial patience window (ON_TRACK / AT_RISK
        thresholds).  Negative shortens it.
        - fast responder  → +12 (allow slightly longer patience)
        - slow responder  → -12 (shorten patience window)
        - high acceptance + high intake success → additional +6
    escalation_modifier_hours
        Positive extends the escalation window (OVERDUE / ESCALATED /
        FORCED_ACTION thresholds).  Negative brings escalation forward.
        - often-full provider → -12 (escalate sooner)
        - limited capacity   → -6  (escalate moderately sooner)
        - high acceptance + high intake success → additional +6

    Sparse history guard: returns (0, 0) when fewer than 3 cases are recorded,
    ensuring no adjustment is applied without sufficient behavioral evidence.

    Floors enforced by calculate_provider_response_sla — this function only
    returns the raw delta.
    """
    metrics = provider_metrics or {}
    total_cases = int(metrics.get("total_cases") or 0)
    if total_cases <= 2:
        return {"response_time_modifier_hours": 0, "escalation_modifier_hours": 0}

    signals = derive_behavior_signals(metrics)
    rt_mod = 0
    esc_mod = 0

    response_speed = signals.get("response_speed")
    if response_speed == "fast":
        rt_mod += 12
    elif response_speed == "slow":
        rt_mod -= 12

    capacity_pattern = signals.get("capacity_pattern")
    if capacity_pattern == "often_full":
        esc_mod -= 12
    elif capacity_pattern == "limited":
        esc_mod -= 6

    acceptance_pattern = signals.get("acceptance_pattern")
    intake_pattern = signals.get("intake_pattern")
    if acceptance_pattern == "high" and intake_pattern == "high_success":
        rt_mod += 6
        esc_mod += 6

    # Clamp each to [-12, +12]
    rt_mod = max(-12, min(12, rt_mod))
    esc_mod = max(-12, min(12, esc_mod))

    return {"response_time_modifier_hours": rt_mod, "escalation_modifier_hours": esc_mod}


def calculate_provider_response_sla(
    placement: Any,
    now: Any = None,
    provider_metrics: Dict[str, Any] | None = None,
) -> Dict[str, int | str]:
    """Calculate the SLA state for a provider response.

    When *provider_metrics* is supplied, thresholds are adjusted using
    :func:`get_provider_sla_adjustment` so that behaviorally reliable providers
    receive slightly more patience and providers with recurring capacity or
    response issues reach escalation sooner.

    The returned dict always contains an ``sla_adjustment`` key with the raw
    ``{"response_time_modifier_hours": int, "escalation_modifier_hours": int}``
    adjustments applied (both 0 when no metrics are given).

    All existing keys (``sla_state``, ``hours_waiting``, ``deadline_hours``,
    ``next_threshold_hours``) behave identically to the unadjusted version when
    *provider_metrics* is ``None`` or has sparse history — guaranteeing no
    behavioral change in the no-metrics path.
    """
    status = _normalize_provider_response_status(_placement_field(placement, "provider_response_status"))
    current_now = _normalize_now(now)
    reference_at = _provider_response_reference_timestamp(placement)
    hours_waiting = _elapsed_waiting_hours(reference_at, current_now)

    policy_defaults = {
        'SLA_PENDING_ON_TRACK_HOURS': 48,
        'SLA_PENDING_AT_RISK_HOURS': 72,
        'SLA_PENDING_OVERDUE_HOURS': 96,
        'SLA_PENDING_ESCALATED_HOURS': 120,
        'SLA_NEEDS_INFO_ON_TRACK_HOURS': 24,
        'SLA_NEEDS_INFO_AT_RISK_HOURS': 48,
        'SLA_NEEDS_INFO_OVERDUE_HOURS': 72,
        'SLA_WAITLIST_ESCALATED_HOURS': 72,
    }
    policy = get_policy_values(policy_defaults)
    pending_on_track_hours = policy['SLA_PENDING_ON_TRACK_HOURS']
    pending_at_risk_hours = policy['SLA_PENDING_AT_RISK_HOURS']
    pending_overdue_hours = policy['SLA_PENDING_OVERDUE_HOURS']
    pending_escalated_hours = policy['SLA_PENDING_ESCALATED_HOURS']
    needs_info_on_track_hours = policy['SLA_NEEDS_INFO_ON_TRACK_HOURS']
    needs_info_at_risk_hours = policy['SLA_NEEDS_INFO_AT_RISK_HOURS']
    needs_info_overdue_hours = policy['SLA_NEEDS_INFO_OVERDUE_HOURS']
    waitlist_escalated_hours = policy['SLA_WAITLIST_ESCALATED_HOURS']

    adj = get_provider_sla_adjustment(provider_metrics)
    rt_mod = adj["response_time_modifier_hours"]
    esc_mod = adj["escalation_modifier_hours"]

    if status == "PENDING":
        # Minimum floors: 24h, 36h, 48h, 60h to prevent extreme compression.
        t_on_track = max(pending_on_track_hours + rt_mod, 24)
        t_at_risk = max(pending_at_risk_hours + rt_mod, 36)
        t_overdue = max(pending_overdue_hours + esc_mod, 48)
        t_escalated = max(pending_escalated_hours + esc_mod, 60)
        if hours_waiting < t_on_track:
            return {
                "sla_state": "ON_TRACK",
                "hours_waiting": hours_waiting,
                "deadline_hours": pending_at_risk_hours,
                "next_threshold_hours": t_on_track,
                "sla_adjustment": adj,
            }
        if hours_waiting <= t_at_risk:
            return {
                "sla_state": "AT_RISK",
                "hours_waiting": hours_waiting,
                "deadline_hours": pending_at_risk_hours,
                "next_threshold_hours": t_at_risk,
                "sla_adjustment": adj,
            }
        if hours_waiting <= t_overdue:
            return {
                "sla_state": "OVERDUE",
                "hours_waiting": hours_waiting,
                "deadline_hours": pending_at_risk_hours,
                "next_threshold_hours": t_overdue,
                "sla_adjustment": adj,
            }
        if hours_waiting <= t_escalated:
            return {
                "sla_state": "ESCALATED",
                "hours_waiting": hours_waiting,
                "deadline_hours": pending_at_risk_hours,
                "next_threshold_hours": t_escalated,
                "sla_adjustment": adj,
            }
        return {
            "sla_state": "FORCED_ACTION",
            "hours_waiting": hours_waiting,
            "deadline_hours": pending_at_risk_hours,
            "next_threshold_hours": 0,
            "sla_adjustment": adj,
        }

    if status == "NEEDS_INFO":
        # Apply rt_mod to NEEDS_INFO thresholds; esc_mod shifts escalation.
        t_on_track = max(needs_info_on_track_hours + rt_mod, 12)
        t_at_risk = max(needs_info_at_risk_hours + rt_mod, 24)
        t_overdue = max(needs_info_overdue_hours + esc_mod, 36)
        if hours_waiting < t_on_track:
            return {
                "sla_state": "ON_TRACK",
                "hours_waiting": hours_waiting,
                "deadline_hours": needs_info_at_risk_hours,
                "next_threshold_hours": t_on_track,
                "sla_adjustment": adj,
            }
        if hours_waiting <= t_at_risk:
            return {
                "sla_state": "AT_RISK",
                "hours_waiting": hours_waiting,
                "deadline_hours": needs_info_at_risk_hours,
                "next_threshold_hours": t_at_risk,
                "sla_adjustment": adj,
            }
        if hours_waiting <= t_overdue:
            return {
                "sla_state": "OVERDUE",
                "hours_waiting": hours_waiting,
                "deadline_hours": needs_info_at_risk_hours,
                "next_threshold_hours": t_overdue,
                "sla_adjustment": adj,
            }
        return {
            "sla_state": "ESCALATED",
            "hours_waiting": hours_waiting,
            "deadline_hours": needs_info_at_risk_hours,
            "next_threshold_hours": 0,
            "sla_adjustment": adj,
        }

    if status == "WAITLIST":
        t_escalated = max(waitlist_escalated_hours + esc_mod, 48)
        if hours_waiting > t_escalated:
            return {
                "sla_state": "ESCALATED",
                "hours_waiting": hours_waiting,
                "deadline_hours": waitlist_escalated_hours,
                "next_threshold_hours": 0,
                "sla_adjustment": adj,
            }
        return {
            "sla_state": "AT_RISK",
            "hours_waiting": hours_waiting,
            "deadline_hours": waitlist_escalated_hours,
            "next_threshold_hours": t_escalated,
            "sla_adjustment": adj,
        }

    return {
        "sla_state": "ON_TRACK",
        "hours_waiting": hours_waiting,
        "deadline_hours": 0,
        "next_threshold_hours": 0,
        "sla_adjustment": adj,
    }


def derive_provider_response_ownership(
    *,
    provider_response_status: Any,
    sla_state: Any,
    hours_waiting: int = 0,
    next_threshold_hours: int = 0,
    now: Any = None,
    case_phase: Any = None,
) -> Dict[str, Any]:
    normalized_status = _normalize_provider_response_status(provider_response_status)
    normalized_sla_state = str(sla_state or "ON_TRACK").strip().upper()
    phase_label = str(case_phase or "").strip().upper()
    current_now = _normalize_now(now)
    hours_waiting = _coerce_int(hours_waiting)
    next_threshold_hours = _coerce_int(next_threshold_hours)
    hours_until_escalation = max(next_threshold_hours - hours_waiting, 0) if next_threshold_hours > 0 else 0

    ownership = {
        "next_owner": "system",
        "next_owner_label": "Systeemmonitor",
        "next_action": "monitor",
        "next_action_label": "Monitor voortgang",
        "action_deadline": None,
        "action_deadline_label": "Escalatie niet direct vereist.",
        "escalation_level": normalized_sla_state,
        "escalation_level_label": normalized_sla_state,
        "ownership_reason": "SLA is op schema; systeemmonitoring volstaat.",
    }

    if normalized_sla_state == "AT_RISK":
        ownership.update(
            {
                "next_owner": "regievoerder",
                "next_owner_label": "Regievoerder",
                "next_action": "resend",
                "next_action_label": "Stuur herinnering",
                "action_deadline": current_now + timedelta(hours=hours_until_escalation) if hours_until_escalation else current_now,
                "action_deadline_label": (
                    f"Binnen {hours_until_escalation} uur opvolgen om escalatie te voorkomen."
                    if hours_until_escalation
                    else "Direct opvolgen om escalatie te voorkomen."
                ),
                "ownership_reason": "SLA staat op risico; actieve opvolging door regievoerder is nodig.",
            }
        )
    elif normalized_sla_state == "OVERDUE":
        ownership.update(
            {
                "next_owner": "regievoerder",
                "next_owner_label": "Regievoerder",
                "next_action": "resend_or_rematch",
                "next_action_label": "Beslis: herinnering of her-match",
                "action_deadline": current_now,
                "action_deadline_label": "Over deadline: nu beslissen.",
                "ownership_reason": "SLA-breuk; regievoerder moet direct kiezen tussen opvolgen of her-match.",
            }
        )
    elif normalized_sla_state == "ESCALATED":
        ownership.update(
            {
                "next_owner": "regievoerder",
                "next_owner_label": "Regievoerder",
                "next_action": "immediate_decision",
                "next_action_label": "Neem direct een besluit",
                "action_deadline": current_now,
                "action_deadline_label": "Geescaleerd: onmiddellijke besluitvorming vereist.",
                "ownership_reason": "Escalatieniveau bereikt; passief wachten is niet toelaatbaar.",
            }
        )
    elif normalized_sla_state == "FORCED_ACTION":
        ownership.update(
            {
                "next_owner": "regievoerder",
                "next_owner_label": "Regievoerder",
                "next_action": "rematch_or_override_decision",
                "next_action_label": "Her-match of expliciete override",
                "action_deadline": current_now,
                "action_deadline_label": "FORCED_ACTION: direct rematch of expliciete override vastleggen.",
                "ownership_reason": "SLA-forcering bereikt; regievoerder moet direct kiezen en verantwoorden.",
            }
        )

    if normalized_status in {"REJECTED", "NO_CAPACITY"}:
        ownership.update(
            {
                "next_owner": "regievoerder",
                "next_owner_label": "Regievoerder",
                "next_action": "rematch",
                "next_action_label": "Start her-match",
                "action_deadline": current_now,
                "action_deadline_label": "Aanbieder blokkeert voortgang: direct her-match starten.",
                "ownership_reason": "Aanbiederreactie blokkeert plaatsing; regievoerder moet alternatief kiezen.",
            }
        )

    if phase_label == "COMPLETED":
        ownership.update(
            {
                "next_owner": "system",
                "next_owner_label": "Systeemmonitor",
                "next_action": "monitor",
                "next_action_label": "Monitoring",
                "action_deadline": None,
                "action_deadline_label": "Casus is afgerond; alleen monitoring.",
                "ownership_reason": "Casusstatus afgerond; operationele escalatie is niet actief.",
            }
        )

    return ownership


def _resolve_today(case_data: Dict[str, Any]) -> date:
    raw_now = case_data.get("now")
    now_date = _to_date(raw_now)
    if now_date:
        return now_date
    return date.today()


def _days_since(value: Any, *, today: date) -> int:
    target_date = _to_date(value)
    if not target_date:
        return 0
    return max((today - target_date).days, 0)


def _normalize_confidence(confidence: Any) -> str:
    if confidence is None:
        return ""
    return str(confidence).strip().lower()


def _normalize_candidate_suggestions(case_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    suggestions = case_data.get("candidate_suggestions") or []
    normalized: List[Dict[str, Any]] = []
    for row in suggestions:
        if not isinstance(row, dict):
            continue
        normalized.append(
            {
                "provider_id": row.get("provider_id"),
                "confidence": _normalize_confidence(row.get("confidence")),
                "has_capacity_issue": bool(row.get("has_capacity_issue")),
                "wait_days": _coerce_int(row.get("wait_days")),
                "has_region_mismatch": bool(row.get("has_region_mismatch")),
            }
        )
    return normalized


def _candidate_trade_offs(candidate: Dict[str, Any]) -> List[str]:
    trade_offs: List[str] = []
    if candidate["has_capacity_issue"]:
        trade_offs.append("Beperkte capaciteit")
    if candidate["wait_days"] >= 28:
        trade_offs.append(f"Lange wachttijd ({candidate['wait_days']} dagen)")
    if candidate.get("has_region_mismatch"):
        trade_offs.append("Regio minder passend")

    confidence = candidate["confidence"]
    if confidence == "medium":
        trade_offs.append("Confidence is gemiddeld")
    elif confidence in {"", "low"}:
        trade_offs.append("Confidence is laag")

    return trade_offs


def detect_missing_information(case_data: Dict[str, Any]) -> List[Dict[str, str]]:
    _validate_case_data(case_data)

    alerts: List[Dict[str, str]] = []
    if not case_data.get("phase"):
        alerts.append(
            {
                "code": "missing_phase",
                "label": "Fase ontbreekt",
                "message": "De casusfase ontbreekt.",
                "action": "Vul de huidige fase van de casus in.",
            }
        )

    if not case_data.get("care_category"):
        alerts.append(
            {
                "code": "missing_care_category",
                "label": "Hoofdcategorie ontbreekt",
                "message": "Hoofdcategorie zorgvraag ontbreekt.",
                "action": "Vul de hoofdcategorie in.",
            }
        )

    if not case_data.get("urgency"):
        alerts.append(
            {
                "code": "missing_urgency",
                "label": "Urgentie ontbreekt",
                "message": "Urgentie van de casus ontbreekt.",
                "action": "Selecteer de juiste urgentie.",
            }
        )

    if case_data.get("has_preferred_region") is False:
        alerts.append(
            {
                "code": "missing_region",
                "label": "Voorkeursregio ontbreekt",
                "message": "Voorkeursregio ontbreekt.",
                "action": "Kies een voorkeursregio in de intake.",
            }
        )

    if case_data.get("has_assessment_summary") is False:
        alerts.append(
            {
                "code": "missing_assessment_summary",
                "label": "Intake samenvatting ontbreekt",
                "message": "Intake samenvatting ontbreekt.",
                "action": "Vul de intake samenvatting aan met hulpvraag en aandachtspunten.",
            }
        )

    if case_data.get("has_client_age_category") is False:
        alerts.append(
            {
                "code": "missing_age_category",
                "label": "Leeftijdscategorie ontbreekt",
                "message": "Leeftijdscategorie ontbreekt.",
                "action": "Selecteer de leeftijdscategorie van de client.",
            }
        )

    assessment_status = str(case_data.get("assessment_status") or "").strip().upper()
    if assessment_status == "NEEDS_INFO":
        alerts.append(
            {
                "code": "assessment_needs_info",
                "label": "Beoordeling vraagt aanvullende informatie",
                "message": "Beoordeling staat op aanvullende informatie nodig.",
                "action": "Werk ontbrekende beoordelingsinformatie bij.",
            }
        )

    if case_data.get("assessment_matching_ready") is False:
        alerts.append(
            {
                "code": "assessment_not_ready",
                "label": "Beoordeling nog niet matching-klaar",
                "message": "Beoordeling is nog niet als klaar voor matching gemarkeerd.",
                "action": "Markeer beoordeling als matching-klaar zodra compleet.",
            }
        )

    placement_status = str(case_data.get("placement_status") or "").strip().upper()
    if placement_status in {"IN_REVIEW", "NEEDS_INFO", "APPROVED", "REJECTED"} and not case_data.get("selected_provider_id"):
        alerts.append(
            {
                "code": "missing_selected_provider",
                "label": "Geselecteerde aanbieder ontbreekt",
                "message": "Plaatsingsstatus bestaat, maar er is geen aanbieder gekoppeld.",
                "action": "Koppel eerst een aanbieder aan de casus.",
            }
        )

    if case_data.get("matching_run_exists") and not case_data.get("top_match_confidence"):
        alerts.append(
            {
                "code": "missing_top_match_confidence",
                "label": "Topmatch confidence ontbreekt",
                "message": "Matching is uitgevoerd zonder confidence op de topmatch.",
                "action": "Controleer matching-output en vul confidence aan.",
            }
        )

    return alerts


def detect_risk_signals(case_data: Dict[str, Any]) -> List[Dict[str, str]]:
    _validate_case_data(case_data)

    today = _resolve_today(case_data)
    signals: List[Dict[str, str]] = []

    open_signal_count = _coerce_int(case_data.get("open_signal_count"))
    if open_signal_count > 0:
        signals.append(
            {
                "code": "open_signals",
                "label": "Open signalen",
                "message": f"Er zijn {open_signal_count} open signalen.",
                "action": "Beoordeel en verwerk open signalen.",
            }
        )

    rejected_provider_count = _coerce_int(case_data.get("rejected_provider_count"))
    if rejected_provider_count >= 2:
        signals.append(
            {
                "code": "repeated_rejections",
                "label": "Herhaalde afwijzingen",
                "message": f"{rejected_provider_count} aanbieders zijn afgewezen.",
                "action": "Herzie selectiecriteria of verbreed aanbod.",
            }
        )

    confidence = _normalize_confidence(case_data.get("top_match_confidence"))
    if case_data.get("matching_run_exists") and confidence in {"", "low"}:
        signals.append(
            {
                "code": "weak_matching_quality",
                "label": "Zwakke matchingkwaliteit",
                "message": "Topmatch heeft lage of ontbrekende confidence.",
                "action": "Controleer matchfactoren en herzie kandidaten.",
            }
        )

    if bool(case_data.get("top_match_has_capacity_issue")):
        signals.append(
            {
                "code": "capacity_risk",
                "label": "Capaciteitsrisico",
                "message": "Topmatch heeft capaciteitsbeperking.",
                "action": "Valideer beschikbaarheid bij de aanbieder.",
            }
        )

    top_wait_days = _coerce_int(case_data.get("top_match_wait_days"))
    if top_wait_days >= 28:
        signals.append(
            {
                "code": "long_wait_risk",
                "label": "Lange wachttijd",
                "message": f"Topmatch heeft een wachttijd van {top_wait_days} dagen.",
                "action": "Controleer alternatieven met kortere wachttijd.",
            }
        )

    placement_status = str(case_data.get("placement_status") or "").strip().upper()
    placement_stalled_days = _days_since(case_data.get("placement_updated_at"), today=today)
    if placement_status in {"IN_REVIEW", "NEEDS_INFO"} and placement_stalled_days >= 7:
        signals.append(
            {
                "code": "placement_stalled",
                "label": "Plaatsing stagneert",
                "message": f"Plaatsing staat al {placement_stalled_days} dagen zonder voortgang.",
                "action": "Neem contact op met aanbieder en werk status bij.",
            }
        )

    provider_response_status = str(case_data.get("provider_response_status") or "").strip().upper()
    response_requested_at = case_data.get("provider_response_requested_at") or case_data.get("placement_updated_at")
    response_age_days = _days_since(response_requested_at, today=today)
    response_deadline_at = _to_date(case_data.get("provider_response_deadline_at"))
    response_deadline_overdue = bool(response_deadline_at and today > response_deadline_at)
    urgency = str(case_data.get("urgency") or "").strip().upper()

    if provider_response_status in {"PENDING", "NEEDS_INFO"}:
        if response_age_days >= 3 or response_deadline_overdue:
            signals.append(
                {
                    "code": "provider_response_delayed",
                    "label": "Providerreactie vertraagd",
                    "message": f"Aanbiedersreactie wacht al {response_age_days} dagen op opvolging.",
                    "action": "Stuur herinnering of werk ontbrekende informatie direct bij.",
                }
            )
        if response_age_days >= 7 or (response_deadline_overdue and response_age_days >= 5):
            signals.append(
                {
                    "code": "provider_not_responding",
                    "label": "Aanbieder reageert niet",
                    "message": "Aanbieder reageert niet binnen de afgesproken termijn.",
                    "action": "Escaleer en start zo nodig rematch met alternatieve aanbieders.",
                }
            )
        if urgency in {"HIGH", "CRISIS"} and response_age_days >= 2:
            signals.append(
                {
                    "code": "high_urgency_response_delay",
                    "label": "Urgente casus wacht op reactie",
                    "message": f"Urgente casus wacht {response_age_days} dagen op providerreactie.",
                    "action": "Escaleer direct en bereid parallel een rematch voor.",
                }
            )

    if provider_response_status in {"REJECTED", "NO_CAPACITY"}:
        signals.append(
            {
                "code": "rematch_recommended",
                "label": "Her-match aanbevolen",
                "message": "Providerreactie blokkeert intake-voortgang.",
                "action": "Herstart matching met alternatieve aanbieders.",
            }
        )
    if provider_response_status == "NO_CAPACITY":
        signals.append(
            {
                "code": "provider_no_capacity",
                "label": "Geen capaciteit bij aanbieder",
                "message": "Geselecteerde aanbieder geeft aan geen capaciteit te hebben.",
                "action": "Markeer als hoog risico en voer direct rematch uit.",
            }
        )

    stale_case_days = _days_since(case_data.get("case_updated_at"), today=today)
    if stale_case_days >= 10:
        signals.append(
            {
                "code": "stale_case",
                "label": "Casus verouderd",
                "message": f"Casus is {stale_case_days} dagen niet bijgewerkt.",
                "action": "Werk casusinformatie en planning bij.",
            }
        )

    case_updated_at = _to_date(case_data.get("case_updated_at"))
    matching_updated = _to_date(case_data.get("matching_updated_at"))
    if case_updated_at and matching_updated and case_updated_at > matching_updated:
        signals.append(
            {
                "code": "matching_outdated",
                "label": "Matching mogelijk verouderd",
                "message": "Casusgegevens zijn gewijzigd na de laatste matchingselectie.",
                "action": "Herstart matching met actuele casusgegevens.",
            }
        )

    open_task_count = _coerce_int(case_data.get("open_task_count"))
    if open_task_count >= 5:
        signals.append(
            {
                "code": "task_backlog",
                "label": "Takenstuwmeer",
                "message": f"Er staan {open_task_count} open taken.",
                "action": "Prioriteer open taken en plan opvolging.",
            }
        )

    return signals


def _is_weak_or_low_confidence(case_data: Dict[str, Any]) -> bool:
    confidence = _normalize_confidence(case_data.get("top_match_confidence"))
    suggestions = _normalize_candidate_suggestions(case_data)
    return not suggestions or confidence in {"", "low"}


def _needs_capacity_wait_validation(case_data: Dict[str, Any]) -> bool:
    if bool(case_data.get("top_match_has_capacity_issue")):
        return True
    return _coerce_int(case_data.get("top_match_wait_days")) >= 28


def _is_placement_stalled(case_data: Dict[str, Any]) -> bool:
    placement_status = str(case_data.get("placement_status") or "").strip().upper()
    if placement_status not in {"IN_REVIEW", "NEEDS_INFO"}:
        return False
    today = _resolve_today(case_data)
    return _days_since(case_data.get("placement_updated_at"), today=today) >= 7


def _build_sla_explanation(adj: Dict[str, int], signals: Dict[str, Any]) -> str | None:
    """Return a human-readable explanation of any SLA threshold adjustment.

    Returns ``None`` when no adjustment was applied (sparse history or no metrics).
    When an adjustment is present at least one of the standard phrase keys is
    included so callers can surface this context without any string parsing.
    """
    rt_mod = adj.get("response_time_modifier_hours", 0)
    esc_mod = adj.get("escalation_modifier_hours", 0)
    if rt_mod == 0 and esc_mod == 0:
        return None

    parts = ["SLA adjusted due to provider response pattern"]
    if rt_mod < 0 or esc_mod < 0:
        parts.append("Earlier escalation recommended due to reliability risk")
    return "; ".join(parts)


def _build_provider_response_sla_context(
    case_data: Dict[str, Any],
    *,
    provider_metrics: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Build the full SLA context dict for a case.

    When *provider_metrics* is supplied the SLA thresholds are adjusted via
    :func:`calculate_provider_response_sla`.  The returned dict then also
    contains:

    adjusted_sla_state
        Same as ``sla_state`` — the adaptive value that reflects any
        behavioral adjustment.  Exposed under a distinct key so downstream
        consumers can make the adaptation visible.

    adaptive_deadline
        The ``datetime`` at which the *next* SLA threshold will be crossed,
        computed from ``next_threshold_hours`` and current wait time.
        ``None`` for terminal states (FORCED_ACTION) and non-active statuses.

    sla_explanation
        A human-readable string describing any applied adjustment
        (e.g. "SLA adjusted due to provider response pattern; Earlier
        escalation recommended due to reliability risk"), or ``None`` when
        no adjustment was made.
    """
    sla = calculate_provider_response_sla(
        {
            "provider_response_status": case_data.get("provider_response_status"),
            "provider_response_last_reminder_at": case_data.get("provider_response_last_reminder_at"),
            "provider_response_requested_at": case_data.get("provider_response_requested_at"),
            "updated_at": case_data.get("placement_updated_at") or case_data.get("case_updated_at"),
        },
        now=case_data.get("now"),
        provider_metrics=provider_metrics,
    )
    sla_state = str(sla.get("sla_state") or "ON_TRACK")
    hours_waiting = int(sla.get("hours_waiting") or 0)
    next_threshold_hours = int(sla.get("next_threshold_hours") or 0)

    # Compute adaptive_deadline from the adjusted next-threshold time.
    current_now = _normalize_now(case_data.get("now"))
    adaptive_deadline: datetime | None = None
    if next_threshold_hours > 0:
        reference_at = current_now - timedelta(hours=hours_waiting)
        adaptive_deadline = reference_at + timedelta(hours=next_threshold_hours)

    # Derive human-readable explanation for any threshold adjustment.
    adj = sla.get("sla_adjustment", {"response_time_modifier_hours": 0, "escalation_modifier_hours": 0})
    behavior_signals = derive_behavior_signals(provider_metrics) if provider_metrics else {}
    sla_explanation = _build_sla_explanation(adj, behavior_signals)

    ownership = derive_provider_response_ownership(
        provider_response_status=case_data.get("provider_response_status"),
        sla_state=sla_state,
        hours_waiting=hours_waiting,
        next_threshold_hours=next_threshold_hours,
        now=case_data.get("now"),
        case_phase=case_data.get("phase"),
    )
    return {
        "sla_state": sla_state,
        "adjusted_sla_state": sla_state,
        "sla_hours_waiting": hours_waiting,
        "sla_breach": sla_state in {"OVERDUE", "ESCALATED", "FORCED_ACTION"},
        "escalation_required": sla_state in {"ESCALATED", "FORCED_ACTION"},
        "forced_action_required": sla_state == "FORCED_ACTION",
        "adaptive_deadline": adaptive_deadline,
        "sla_explanation": sla_explanation,
        "next_owner": ownership["next_owner"],
        "next_owner_label": ownership["next_owner_label"],
        "next_action": ownership["next_action"],
        "next_action_label": ownership["next_action_label"],
        "action_deadline": ownership["action_deadline"],
        "action_deadline_label": ownership["action_deadline_label"],
        "escalation_level": ownership["escalation_level"],
        "escalation_level_label": ownership["escalation_level_label"],
        "ownership_reason": ownership["ownership_reason"],
        "sla_meta": sla,
    }


def _is_reliable_provider(signals: Dict[str, Any]) -> bool:
    """Return True when behavioral signals indicate an operationally reliable provider."""
    return (
        signals.get("response_speed") == "fast"
        and signals.get("acceptance_pattern") in {"high"}
    )


def _has_capacity_friction(signals: Dict[str, Any]) -> bool:
    """Return True when the provider shows persistent capacity issues."""
    return signals.get("capacity_pattern") in {"often_full", "limited"}


def _is_slow_responder(signals: Dict[str, Any]) -> bool:
    return signals.get("response_speed") == "slow"


def determine_next_best_action(
    case_data: Dict[str, Any],
    *,
    missing_information: List[Dict[str, str]] | None = None,
    risk_signals: List[Dict[str, str]] | None = None,
    sla_context: Dict[str, Any] | None = None,
    provider_metrics: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Determine the recommended next action for a case.

    When *provider_metrics* is provided the recommendation is behaviour-aware:
    - High no_capacity / often-full providers trigger rematch sooner.
    - Slow responders skip repeated resend and go directly to rematch.
    - Reliable providers (fast + high-acceptance) are given one extra resend
      cycle before escalation is forced.

    Actions returned always include a ``behavior_reason`` key.  When no
    behavioral context is applied the value is ``None``.
    """
    _validate_case_data(case_data)

    if missing_information is None:
        missing_information = detect_missing_information(case_data)
    if risk_signals is None:
        risk_signals = detect_risk_signals(case_data)
    if sla_context is None:
        sla_context = _build_provider_response_sla_context(case_data)

    if missing_information:
        return {
            "code": "fill_missing_information",
            "priority": 1,
            "reason": missing_information[0]["message"],
            "behavior_reason": None,
        }

    if not bool(case_data.get("matching_run_exists")):
        return {
            "code": "run_matching",
            "priority": 3,
            "reason": "Er is nog geen matching-run beschikbaar.",
            "behavior_reason": None,
        }

    raw_provider_response_status = str(case_data.get("provider_response_status") or "").strip()
    provider_response_status = (
        _normalize_provider_response_status(raw_provider_response_status)
        if raw_provider_response_status
        else ""
    )
    sla_state = str(sla_context.get("sla_state") or "ON_TRACK")

    # Resolve behavioral signals once (empty dict = no influence).
    behavior_signals: Dict[str, Any] = (
        derive_behavior_signals(provider_metrics) if provider_metrics else {}
    )

    if provider_response_status in {"PENDING", "NEEDS_INFO", "WAITLIST"}:
        if sla_state == "FORCED_ACTION":
            return {
                "code": "run_matching",
                "priority": 4,
                "reason": "SLA forcering bereikt: start expliciet rematch met alternatieve aanbieders.",
                "behavior_reason": None,
            }
        if sla_state == "ESCALATED":
            # Unreliable providers skip the standard "decide" step and go
            # straight to rematch instead of immediate_decision.
            if behavior_signals and (
                _has_capacity_friction(behavior_signals) or _is_slow_responder(behavior_signals)
            ):
                return {
                    "code": "run_matching",
                    "priority": 4,
                    "reason": "Providerreactie is geëscaleerd; neem direct een beslissing (resend of rematch).",
                    "behavior_reason": (
                        "Rematch recommended due to repeated capacity issues"
                        if _has_capacity_friction(behavior_signals)
                        else "Resend skipped: provider historically slow to respond"
                    ),
                }
            return {
                "code": "follow_up_provider_response",
                "priority": 4,
                "reason": "Providerreactie is geëscaleerd; neem direct een beslissing (resend of rematch).",
                "behavior_reason": (
                    "Resend allowed due to historically reliable provider"
                    if behavior_signals and _is_reliable_provider(behavior_signals)
                    else None
                ),
            }
        if sla_state == "OVERDUE":
            # Often-full or slow providers should not receive another resend
            # at OVERDUE — go directly to rematch.
            if behavior_signals and _has_capacity_friction(behavior_signals):
                return {
                    "code": "run_matching",
                    "priority": 4,
                    "reason": "Providerreactie is overdue; stuur direct een herinnering of bereid rematch voor.",
                    "behavior_reason": "Rematch recommended due to repeated capacity issues",
                }
            if behavior_signals and _is_slow_responder(behavior_signals):
                return {
                    "code": "run_matching",
                    "priority": 4,
                    "reason": "Providerreactie is overdue; stuur direct een herinnering of bereid rematch voor.",
                    "behavior_reason": "Resend skipped: provider historically slow to respond",
                }
            return {
                "code": "follow_up_provider_response",
                "priority": 4,
                "reason": "Providerreactie is overdue; stuur direct een herinnering of bereid rematch voor.",
                "behavior_reason": (
                    "Resend allowed due to historically reliable provider"
                    if behavior_signals and _is_reliable_provider(behavior_signals)
                    else None
                ),
            }
        if sla_state == "AT_RISK":
            # Providers with persistent capacity issues should be rematched
            # immediately rather than sending a reminder that will likely fail.
            if behavior_signals and _has_capacity_friction(behavior_signals):
                return {
                    "code": "run_matching",
                    "priority": 4,
                    "reason": "Providerreactie staat op risico; stuur nu een herinnering om SLA-breuk te voorkomen.",
                    "behavior_reason": "Rematch recommended due to repeated capacity issues",
                }
            return {
                "code": "follow_up_provider_response",
                "priority": 4,
                "reason": "Providerreactie staat op risico; stuur nu een herinnering om SLA-breuk te voorkomen.",
                "behavior_reason": (
                    "Resend allowed due to historically reliable provider"
                    if behavior_signals and _is_reliable_provider(behavior_signals)
                    else None
                ),
            }

    if provider_response_status in {"REJECTED", "NO_CAPACITY"}:
        return {
            "code": "run_matching",
            "priority": 4,
            "reason": "Providerreactie vraagt om directe herstart van matching.",
            "behavior_reason": None,
        }

    if _is_weak_or_low_confidence(case_data):
        return {
            "code": "review_matching_quality",
            "priority": 4,
            "reason": "Topmatch heeft lage confidence of er zijn geen bruikbare kandidaten.",
            "behavior_reason": None,
        }

    if _needs_capacity_wait_validation(case_data):
        return {
            "code": "validate_capacity_wait",
            "priority": 5,
            "reason": "Capaciteit of wachttijd van de topmatch moet worden gevalideerd.",
            "behavior_reason": None,
        }

    if _is_placement_stalled(case_data):
        return {
            "code": "resolve_placement_stall",
            "priority": 6,
            "reason": "Plaatsing stagneert en heeft opvolging nodig.",
            "behavior_reason": None,
        }

    return {
        "code": "monitor",
        "priority": 7,
        "reason": "Geen directe actie nodig; monitor voortgang.",
        "behavior_reason": None,
    }


def generate_candidate_hints(case_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    _validate_case_data(case_data)

    suggestions = _normalize_candidate_suggestions(case_data)
    if not suggestions:
        return []

    hints: List[Dict[str, Any]] = []
    top_candidate = suggestions[0]
    top_confidence = top_candidate["confidence"]
    top_trade_offs = _candidate_trade_offs(top_candidate)

    for index, candidate in enumerate(suggestions):
        confidence = candidate["confidence"]
        trade_offs = _candidate_trade_offs(candidate)
        hint_code = "backup_option"
        hint = "Alternatieve optie met aanvullende verificatie."
        comparison_to_top = ""

        if index == 0:
            if confidence in {"high", "medium"} and not trade_offs:
                hint_code = "top_recommended"
                hint = "Beste optie op basis van huidige gegevens."
            elif confidence in {"high", "medium"} and trade_offs:
                hint_code = "top_tradeoff"
                hint = "Beste inhoudelijke match, met duidelijke afwegingen in capaciteit/wachttijd/regio."
            else:
                hint_code = "top_low_confidence"
                hint = "Geen sterke match gevonden; extra verificatie nodig."
        else:
            if candidate["has_capacity_issue"] is False and top_candidate["has_capacity_issue"] is True:
                hint_code = "capacity_alternative"
                hint = "Overweeg deze optie als alternatief vanwege betere capaciteit."
            elif candidate["wait_days"] < top_candidate["wait_days"] and top_candidate["wait_days"] >= 28:
                hint_code = "wait_time_alternative"
                hint = "Overweeg deze optie als alternatief met kortere wachttijd."
            elif len(trade_offs) < len(top_trade_offs):
                hint_code = "lower_risk_alternative"
                hint = "Overweeg deze optie als compromis met minder operationele risico's."
            elif confidence == "high" and top_confidence != "high":
                hint_code = "high_confidence_alternative"
                hint = "Sterk alternatief met hogere confidence dan de eerste optie."

        try:
            _metrics = build_provider_behavior_metrics(candidate["provider_id"])
            behavior_signals = derive_behavior_signals(_metrics)
        except Exception:
            _metrics = {}
            behavior_signals = {}

        # Build specific comparison text explaining why this candidate differs from #1
        if index > 0:
            comparison_parts: List[str] = []
            if candidate["has_capacity_issue"] is False and top_candidate["has_capacity_issue"] is True:
                comparison_parts.append("betere capaciteit")
            if candidate["wait_days"] < top_candidate["wait_days"]:
                diff = top_candidate["wait_days"] - candidate["wait_days"]
                comparison_parts.append(f"kortere wachttijd ({diff} dagen minder)")
            if (not candidate.get("has_region_mismatch")) and top_candidate.get("has_region_mismatch"):
                comparison_parts.append("betere regio-overeenkomst")
            if confidence == "high" and top_confidence != "high":
                comparison_parts.append("hogere confidence")
            if comparison_parts:
                comparison_to_top = (
                    f"Voordeel t.o.v. optie 1: {', '.join(comparison_parts)}. "
                    f"Topoptie heeft {len(top_trade_offs)} trade-off(s), deze optie {len(trade_offs)}."
                )
            elif top_trade_offs:
                comparison_to_top = (
                    f"Topoptie heeft {len(top_trade_offs)} trade-off(s), deze optie {len(trade_offs)}."
                )

        hints.append(
            {
                "provider_id": candidate["provider_id"],
                "confidence": confidence,
                "has_capacity_issue": candidate["has_capacity_issue"],
                "wait_days": candidate["wait_days"],
                "has_region_mismatch": candidate["has_region_mismatch"],
                "hint_code": hint_code,
                "hint": hint,
                "trade_offs": trade_offs,
                "comparison_to_top": comparison_to_top,
                "behavior_signals": behavior_signals,
            }
        )

    return hints


def build_v3_evidence(
    case_data: Dict[str, Any],
    intelligence: Dict[str, Any],
) -> Dict[str, Any]:
    """Derive the V3 decision evidence block from a fully evaluated intelligence dict.

    Returns a dict with these keys (all optional-safe):
    - fit_summary (str): one-line summary of the match quality
    - confidence (float): 0.0–1.0 numeric confidence score
    - factor_breakdown (list[str]): key match drivers
    - trade_offs (list[str]): compromises in the current recommendation
    - verification_guidance (list[str]): what the operator should verify
    - provider_feedback (dict): structured provider response context
    """
    _CONFIDENCE_MAP = {'high': 0.85, 'medium': 0.6, 'low': 0.3}

    candidate_hints: List[Dict[str, Any]] = intelligence.get('candidate_hints') or []
    risk_signals: List[Dict[str, str]] = intelligence.get('risk_signals') or []
    next_best_action: Dict[str, Any] = intelligence.get('next_best_action') or {}
    missing_info: List[Dict[str, str]] = intelligence.get('missing_information') or []

    # ── Fit summary ──────────────────────────────────────────────────────────
    top_hint = candidate_hints[0] if candidate_hints else None
    if top_hint:
        top_confidence = top_hint.get('confidence', '')
        trade_off_count = len(top_hint.get('trade_offs') or [])
        if top_confidence == 'high' and trade_off_count == 0:
            fit_summary = 'Sterke match: hoge confidence, geen significante afwegingen.'
        elif top_confidence in ('high', 'medium') and trade_off_count > 0:
            fit_summary = (
                f'Goede match met {trade_off_count} aandachtspunt(en) in capaciteit/wachttijd.'
            )
        elif top_confidence == 'low' or not top_confidence:
            fit_summary = 'Zwakke match: lage confidence – verificatie sterk aanbevolen.'
        else:
            fit_summary = 'Match beschikbaar; nader beoordelen voor afwijkingen.'
    elif missing_info:
        fit_summary = 'Matching niet mogelijk: ontbrekende casus- of beoordelingsgegevens.'
    else:
        fit_summary = 'Geen kandidaten beschikbaar voor matching.'

    # ── Confidence score ─────────────────────────────────────────────────────
    # Base score from match quality label — only meaningful when candidates exist
    raw_confidence = _normalize_confidence(case_data.get('top_match_confidence'))
    if not candidate_hints or not case_data.get('matching_run_exists'):
        # No candidates or no matching run → confidence is 0
        confidence = 0.0
    else:
        base_confidence = _CONFIDENCE_MAP.get(raw_confidence, 0.0)
        # Penalise for each active risk signal (max −0.30)
        penalty = min(len(risk_signals) * 0.05, 0.30)
        # Additional penalty for repeated rejections
        rejected_count_for_conf = _coerce_int(case_data.get('rejected_provider_count'))
        if rejected_count_for_conf >= 2:
            penalty = min(penalty + 0.10, 0.40)
        # Calibrate using provider outcome signals when available
        behavior_adj = 0.0
        if top_hint:
            behavior = top_hint.get('behavior_signals') or {}
            # Outcome-based bonus: fast responder + high acceptance + good intake success
            if (
                behavior.get('response_speed') == 'fast'
                and behavior.get('acceptance_pattern') == 'high'
            ):
                behavior_adj += 0.08
                if behavior.get('intake_pattern') in ('high_success', 'good'):
                    behavior_adj += 0.05
            # Outcome-based penalty: frequent no-capacity / slow responder
            if behavior.get('capacity_pattern') in ('often_full', 'limited'):
                behavior_adj -= 0.07
            if behavior.get('response_speed') == 'slow':
                behavior_adj -= 0.05
        confidence = round(max(0.0, min(1.0, base_confidence - penalty + behavior_adj)), 2)

    # ── Factor breakdown ─────────────────────────────────────────────────────
    factor_breakdown: List[str] = []
    if top_hint:
        if raw_confidence == 'high':
            factor_breakdown.append('Specialisatie: sterke overeenkomst')
        elif raw_confidence == 'medium':
            factor_breakdown.append('Specialisatie: redelijke overeenkomst')
        else:
            factor_breakdown.append('Specialisatie: onvoldoende of onbekend')
        if top_hint.get('has_region_mismatch'):
            factor_breakdown.append('Regio: afwijking van voorkeur')
        else:
            factor_breakdown.append('Regio: passend')
        wait = top_hint.get('wait_days', 0)
        if wait == 0:
            factor_breakdown.append('Wachttijd: geen wachttijd')
        elif wait < 14:
            factor_breakdown.append(f'Wachttijd: {wait} dagen (acceptabel)')
        else:
            factor_breakdown.append(f'Wachttijd: {wait} dagen (lang)')
        if top_hint.get('has_capacity_issue'):
            factor_breakdown.append('Capaciteit: beperkt')
        else:
            factor_breakdown.append('Capaciteit: beschikbaar')

    # ── Trade-offs ───────────────────────────────────────────────────────────
    trade_offs: List[str] = list(top_hint.get('trade_offs') or []) if top_hint else []
    if len(candidate_hints) > 1:
        comparison = candidate_hints[1].get('comparison_to_top') or ''
        if comparison:
            trade_offs.append(comparison)

    # ── Verification guidance ────────────────────────────────────────────────
    verification_guidance: List[str] = []
    nba_code = next_best_action.get('code', '')
    if nba_code == 'fill_missing_information':
        verification_guidance.append('Vul ontbrekende casusinformatie aan voordat u verdergaat.')
    if nba_code in ('review_matching_quality', 'validate_capacity_wait'):
        verification_guidance.append('Verifieer de matchkwaliteit met de aanbieder.')
    if top_hint and top_hint.get('has_capacity_issue'):
        verification_guidance.append('Bevestig capaciteit rechtstreeks bij de aanbieder.')
    if top_hint and (top_hint.get('wait_days') or 0) >= 28:
        verification_guidance.append(
            f'Bespreek wachttijd van {top_hint["wait_days"]} dagen met de cliënt.'
        )
    # Add guidance from rejection taxonomy if a reason code is present
    reason_code = str(case_data.get('rejection_reason_code') or '').strip().upper()
    if reason_code and reason_code != 'NONE':
        taxonomy_entry = REJECTION_TAXONOMY.get(reason_code)
        if taxonomy_entry and taxonomy_entry.get('guidance'):
            guidance_text = taxonomy_entry['guidance']
            if guidance_text not in verification_guidance:
                verification_guidance.append(guidance_text)
        if taxonomy_entry and taxonomy_entry.get('matching_signal'):
            signal_text = taxonomy_entry['matching_signal']
            if signal_text and signal_text not in verification_guidance:
                verification_guidance.append(signal_text)
    for signal in risk_signals:
        action = signal.get('action')
        if action and action not in verification_guidance:
            verification_guidance.append(action)

    # ── Provider feedback ────────────────────────────────────────────────────
    provider_response_status = str(case_data.get('provider_response_status') or '').strip().upper()
    rejected_count = _coerce_int(case_data.get('rejected_provider_count'))
    provider_name = str(case_data.get('selected_provider_name') or '')
    provider_feedback: Dict[str, Any] = {}
    if provider_response_status in ('REJECTED', 'NO_CAPACITY', 'PENDING', 'ACCEPTED', 'WAITLIST'):
        decision_map = {
            'ACCEPTED': 'accept',
            'REJECTED': 'reject',
            'NO_CAPACITY': 'no_capacity',
            'WAITLIST': 'waitlist',
            'PENDING': 'pending',
        }
        # Build risk_notes from rejection count and taxonomy
        risk_note_parts: List[str] = []
        if rejected_count >= 2:
            risk_note_parts.append('Herhaalde afwijzing — heroverweeg selectiecriteria.')
        # Taxonomy-based matching signal for future matching
        if reason_code and reason_code != 'NONE':
            taxonomy_entry = REJECTION_TAXONOMY.get(reason_code)
            if taxonomy_entry and taxonomy_entry.get('matching_signal'):
                risk_note_parts.append(taxonomy_entry['matching_signal'])

        # Human-readable label for the reason code
        taxonomy_label = ''
        if reason_code and reason_code != 'NONE':
            taxonomy_entry = REJECTION_TAXONOMY.get(reason_code)
            taxonomy_label = taxonomy_entry['label'] if taxonomy_entry else reason_code

        provider_feedback = {
            'provider_name': provider_name or 'Onbekend',
            'decision': decision_map.get(provider_response_status, provider_response_status.lower()),
            'reason_code': reason_code,
            'reason_label': taxonomy_label,
            'risk_notes': ' '.join(risk_note_parts),
            'attempt_count': rejected_count,
            'sla_state': intelligence.get('sla_state', ''),
        }

    return {
        'fit_summary': fit_summary,
        'confidence': confidence,
        'factor_breakdown': factor_breakdown,
        'trade_offs': trade_offs,
        'verification_guidance': verification_guidance,
        'provider_feedback': provider_feedback if provider_feedback else None,
    }


def evaluate_case_intelligence(
    case_data: Dict[str, Any],
    *,
    provider_metrics: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Evaluate all intelligence signals for a case.

    When *provider_metrics* is supplied the SLA thresholds and next-action
    recommendations are behavior-aware.  The output includes three additional
    explainability fields:

    adjusted_sla_state
        The SLA state after any behavioral threshold adjustment.  Equal to
        ``sla_state`` — exposed separately for UI and audit consumers.

    adaptive_deadline
        The datetime of the next SLA boundary, computed from adjusted
        thresholds.  ``None`` for terminal or inactive states.

    sla_explanation
        Human-readable reason for any SLA adjustment, e.g.
        "SLA adjusted due to provider response pattern; Earlier escalation
        recommended due to reliability risk".  ``None`` when no adjustment
        was applied.
    """
    _validate_case_data(case_data)

    sla_context = _build_provider_response_sla_context(case_data, provider_metrics=provider_metrics)
    missing_information = detect_missing_information(case_data)
    risk_signals = detect_risk_signals(case_data)
    next_best_action = determine_next_best_action(
        case_data,
        missing_information=missing_information,
        risk_signals=risk_signals,
        sla_context=sla_context,
        provider_metrics=provider_metrics,
    )
    candidate_hints = generate_candidate_hints(case_data)

    stop_action_codes = {
        "fill_missing_information",
        "complete_assessment",
        "run_matching",
        "follow_up_provider_response",
        "review_matching_quality",
        "validate_capacity_wait",
        "resolve_placement_stall",
    }
    high_risk_signal_codes = {
        "open_signals",
        "repeated_rejections",
        "weak_matching_quality",
        "capacity_risk",
        "long_wait_risk",
        "placement_stalled",
        "provider_not_responding",
        "high_urgency_response_delay",
        "provider_no_capacity",
    }

    signal_codes = {signal.get("code") for signal in risk_signals}
    should_stop = bool(missing_information) or next_best_action["code"] in stop_action_codes
    if signal_codes.intersection(high_risk_signal_codes):
        should_stop = True

    stop_reasons: List[str] = []
    if missing_information:
        stop_reasons.append("Ontbrekende gegevens moeten eerst worden aangevuld.")
    if next_best_action["code"] in stop_action_codes:
        stop_reasons.append(next_best_action["reason"])
    for signal in risk_signals:
        if signal.get("code") in high_risk_signal_codes:
            stop_reasons.append(signal.get("message") or "")

    safe_to_proceed = not should_stop

    result = {
        "missing_information": missing_information,
        "risk_signals": risk_signals,
        "next_best_action": next_best_action,
        "candidate_hints": candidate_hints,
        "sla_state": sla_context["sla_state"],
        "sla_hours_waiting": sla_context["sla_hours_waiting"],
        "sla_breach": sla_context["sla_breach"],
        "escalation_required": sla_context["escalation_required"],
        "forced_action_required": sla_context["forced_action_required"],
        "next_owner": sla_context["next_owner"],
        "next_owner_label": sla_context["next_owner_label"],
        "next_action": sla_context["next_action"],
        "next_action_label": sla_context["next_action_label"],
        "action_deadline": sla_context["action_deadline"],
        "action_deadline_label": sla_context["action_deadline_label"],
        "escalation_level": sla_context["escalation_level"],
        "escalation_level_label": sla_context["escalation_level_label"],
        "ownership_reason": sla_context["ownership_reason"],
        "adjusted_sla_state": sla_context["adjusted_sla_state"],
        "adaptive_deadline": sla_context["adaptive_deadline"],
        "sla_explanation": sla_context["sla_explanation"],
        "safe_to_proceed": safe_to_proceed,
        "stop_reasons": [reason for reason in stop_reasons if reason],
    }
    # Attach V3 structured decision evidence
    result["v3_evidence"] = build_v3_evidence(case_data, result)
    return result
