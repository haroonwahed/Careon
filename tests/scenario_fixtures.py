"""End-to-End Scenario Validation for Zorg OS.

10 realistic Dutch care allocation scenarios that validate the full workflow:
  Casus → Samenvatting → Matching → Aanbieder Beoordeling → Plaatsing → Intake

Each scenario is defined as a structured fixture dict with:
  - name / description
  - case_data: the case_intelligence input fields
  - expected_nba: expected next_best_action code
  - expected_missing_info_codes: expected missing-info alert codes
  - expected_risk_signal_codes: expected risk signal codes
  - placement_unlocked: whether placement should be unlocked (after evaluation)
  - expected_evaluation_nba: NBA code returned by provider evaluation
  - expected_regiekamer_alert: whether a Regiekamer health alert should exist
  - provider_decision: ACCEPT / REJECT / NEEDS_MORE_INFO (for evaluation step)
  - provider_rejection_reason: reason code when REJECT
  - description: human-readable scenario description
"""

from datetime import date, timedelta

# ---------------------------------------------------------------------------
# Shared date anchors
# ---------------------------------------------------------------------------

TODAY = date(2026, 4, 20)
YESTERDAY = TODAY - timedelta(days=1)
WEEK_AGO = TODAY - timedelta(days=7)
TEN_DAYS_AGO = TODAY - timedelta(days=10)
THREE_WEEKS_AGO = TODAY - timedelta(days=21)
EIGHT_DAYS_AGO = TODAY - timedelta(days=8)


# ---------------------------------------------------------------------------
# Base case_data builder (required fields with safe defaults)
# ---------------------------------------------------------------------------

def _base_case_data(**overrides):
    """Return a minimal valid case_data dict with all required fields.

    Callers override individual fields to express the scenario.
    """
    base = {
        "phase": "MATCHING",
        "care_category": "GGZ",
        "urgency": "MEDIUM",
        "assessment_complete": True,
        "matching_run_exists": True,
        "top_match_confidence": "high",
        "top_match_has_capacity_issue": False,
        "top_match_wait_days": 7,
        "selected_provider_id": 1,
        "placement_status": None,
        "placement_updated_at": None,
        "rejected_provider_count": 0,
        "open_signal_count": 0,
        "open_task_count": 0,
        "case_updated_at": TODAY,
        "candidate_suggestions": [
            {"provider_id": 1, "confidence": "high", "has_capacity_issue": False, "wait_days": 7},
        ],
        "now": TODAY,
        # Optional extended fields
        "has_preferred_region": True,
        "has_assessment_summary": True,
        "has_client_age_category": True,
        "assessment_status": "APPROVED",
        "assessment_matching_ready": True,
        "matching_updated_at": TODAY,
        "provider_response_status": None,
        "provider_response_recorded_at": None,
        "provider_response_requested_at": None,
        "provider_response_deadline_at": None,
        "provider_response_last_reminder_at": None,
        "provider_evaluation_nba_code": None,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Scenario 1 – Straightforward high-urgency case with clean match
# ---------------------------------------------------------------------------

SCENARIO_1 = {
    "name": "S01_high_urgency_clean_match",
    "description": (
        "Kind 10 jaar, urgentie HOOG, GGZ residentieel Noord-Holland. "
        "Assessment compleet, sterke topmatch zonder trade-offs. "
        "Verwacht: monitoring NBA, geen blokkades."
    ),
    "case_data": _base_case_data(
        urgency="HIGH",
        care_category="GGZ",
        top_match_confidence="high",
        top_match_has_capacity_issue=False,
        top_match_wait_days=5,
        rejected_provider_count=0,
        open_signal_count=0,
        provider_evaluation_nba_code=None,
    ),
    "expected_nba": "monitor",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": [],
    "placement_unlocked_after_accept": True,
    "expected_evaluation_nba_after_accept": "ready_for_placement",
    "expected_regiekamer_alert": False,
    "provider_decision": "accept",
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Scenario 2 – CRISIS urgency, long wait time triggers risk signal
# ---------------------------------------------------------------------------

SCENARIO_2 = {
    "name": "S02_crisis_urgency_long_wait",
    "description": (
        "Jongere 16 jaar, CRISIS urgentie, crisisopvang. "
        "Topmatch heeft wachttijd van 35 dagen → lange wachttijd signal. "
        "Verwacht: validate_capacity_wait NBA, long_wait_risk signaal."
    ),
    "case_data": _base_case_data(
        urgency="CRISIS",
        care_category="Crisisopvang",
        top_match_confidence="medium",
        top_match_has_capacity_issue=False,
        top_match_wait_days=35,
        candidate_suggestions=[
            {"provider_id": 2, "confidence": "medium", "has_capacity_issue": False, "wait_days": 35},
        ],
    ),
    "expected_nba": "validate_capacity_wait",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": ["long_wait_risk"],
    "placement_unlocked_after_accept": True,
    "expected_evaluation_nba_after_accept": "ready_for_placement",
    "expected_regiekamer_alert": False,
    "provider_decision": "accept",
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Scenario 3 – Missing information blocks the flow
# ---------------------------------------------------------------------------

SCENARIO_3 = {
    "name": "S03_missing_care_category_and_urgency",
    "description": (
        "Nieuwe aanmelding zonder zorgcategorie en urgentie ingevuld. "
        "Verwacht: fill_missing_information NBA, twee missing-info alerts."
    ),
    "case_data": _base_case_data(
        care_category=None,
        urgency=None,
        assessment_complete=False,
        matching_run_exists=False,
        top_match_confidence=None,
        selected_provider_id=None,
        candidate_suggestions=[],
    ),
    "expected_nba": "fill_missing_information",
    "expected_missing_info_codes": ["missing_care_category", "missing_urgency"],
    "expected_risk_signal_codes": [],
    "placement_unlocked_after_accept": False,
    "expected_evaluation_nba_after_accept": None,
    "expected_regiekamer_alert": False,
    "provider_decision": None,
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Scenario 4 – Provider rejects due to no capacity
# ---------------------------------------------------------------------------

SCENARIO_4 = {
    "name": "S04_provider_rejects_no_capacity",
    "description": (
        "Aanbieder wijst de casus af wegens geen capaciteit. "
        "Verwacht: run_matching NBA na afwijzing, plaatsing geblokkeerd."
    ),
    "case_data": _base_case_data(
        urgency="MEDIUM",
        care_category="WMO",
        provider_evaluation_nba_code="provider_rejected",
        placement_status=None,
    ),
    "expected_nba": "run_matching",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": [],
    "placement_unlocked_after_accept": False,
    "expected_evaluation_nba_after_reject": "provider_rejected",
    "expected_regiekamer_alert": False,
    "provider_decision": "reject",
    "provider_rejection_reason": "no_capacity",
}


# ---------------------------------------------------------------------------
# Scenario 5 – Provider requests more information
# ---------------------------------------------------------------------------

SCENARIO_5 = {
    "name": "S05_provider_needs_more_info",
    "description": (
        "Aanbieder vraagt aanvullende informatie alvorens te beslissen. "
        "Verwacht: provide_evaluation_info NBA; plaatsing nog niet ontgrendeld "
        "(geen accept), maar casus is niet geblokkeerd (actief dialoog)."
    ),
    "case_data": _base_case_data(
        urgency="HIGH",
        care_category="Jeugdzorg",
        provider_evaluation_nba_code="provider_requested_more_info",
    ),
    "expected_nba": "provide_evaluation_info",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": [],
    "placement_unlocked_after_accept": False,
    "expected_evaluation_nba_after_needs_more_info": "provider_requested_more_info",
    "expected_regiekamer_alert": False,
    "provider_decision": "needs_more_info",
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Scenario 6 – Low match confidence (weak match)
# ---------------------------------------------------------------------------

SCENARIO_6 = {
    "name": "S06_low_match_confidence",
    "description": (
        "Matching uitgevoerd, maar topmatch heeft lage confidence. "
        "Verwacht: review_matching_quality NBA, zwakke matchingkwaliteit signaal."
    ),
    "case_data": _base_case_data(
        urgency="LOW",
        care_category="Wonen met begeleiding",
        top_match_confidence="low",
        top_match_has_capacity_issue=False,
        top_match_wait_days=10,
        candidate_suggestions=[
            {"provider_id": 3, "confidence": "low", "has_capacity_issue": False, "wait_days": 10},
        ],
    ),
    "expected_nba": "review_matching_quality",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": ["weak_matching_quality"],
    "placement_unlocked_after_accept": True,
    "expected_evaluation_nba_after_accept": "ready_for_placement",
    "expected_regiekamer_alert": False,
    "provider_decision": "accept",
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Scenario 7 – Stalled placement (> 7 days without progress)
# ---------------------------------------------------------------------------

SCENARIO_7 = {
    "name": "S07_stalled_placement",
    "description": (
        "Plaatsing staat 8 dagen op IN_REVIEW zonder voortgang. "
        "Verwacht: resolve_placement_stall NBA, placement_stalled signaal."
    ),
    "case_data": _base_case_data(
        urgency="MEDIUM",
        care_category="GGZ",
        placement_status="IN_REVIEW",
        placement_updated_at=EIGHT_DAYS_AGO,
        selected_provider_id=5,
    ),
    "expected_nba": "resolve_placement_stall",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": ["placement_stalled"],
    "placement_unlocked_after_accept": True,
    "expected_evaluation_nba_after_accept": "ready_for_placement",
    "expected_regiekamer_alert": False,
    "provider_decision": "accept",
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Scenario 8 – Multiple provider rejections (Regiekamer + rematch needed)
# ---------------------------------------------------------------------------

SCENARIO_8 = {
    "name": "S08_repeated_provider_rejections",
    "description": (
        "Casus heeft al 2 aanbieders die hebben afgewezen (herhaalde afwijzingen). "
        "Verwacht: run_matching NBA, repeated_rejections signaal."
    ),
    "case_data": _base_case_data(
        urgency="HIGH",
        care_category="Jeugdzorg",
        rejected_provider_count=2,
        provider_evaluation_nba_code="provider_rejected",
    ),
    "expected_nba": "run_matching",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": ["repeated_rejections"],
    "placement_unlocked_after_accept": True,
    "expected_evaluation_nba_after_accept": "ready_for_placement",
    "expected_regiekamer_alert": True,
    "provider_decision": "reject",
    "provider_rejection_reason": "specialization_mismatch",
}


# ---------------------------------------------------------------------------
# Scenario 9 – Outcome-informed confidence penalty (very low acceptance history)
# ---------------------------------------------------------------------------

SCENARIO_9 = {
    "name": "S09_outcome_informed_low_acceptance",
    "description": (
        "Aanbieder heeft een acceptatiegraad van 10% (1/10 in eerdere beoordelingen). "
        "Verwacht: confidence penalty op match_score, evaluation_very_low_acceptance warning."
    ),
    "case_data": _base_case_data(
        urgency="MEDIUM",
        care_category="Begeleid Wonen",
        top_match_confidence="high",
        candidate_suggestions=[
            {"provider_id": 99, "confidence": "high", "has_capacity_issue": False, "wait_days": 14},
        ],
    ),
    # For this scenario the evaluation aggregates are injected directly (no DB required).
    "evaluation_aggregates": {
        "total_evaluations": 10,
        "acceptance_count": 1,
        "rejection_count": 9,
        "needs_more_info_count": 0,
        "acceptance_rate": 0.10,
        "rejection_rate": 0.90,
        "needs_more_info_rate": 0.0,
        "top_rejection_reasons": [{"reason_code": "no_capacity", "count": 9, "label": "Geen capaciteit"}],
        "capacity_flag_count": 6,
        "capacity_reliability_signal": "often_full",
        "evidence_level": "sufficient",
    },
    "expected_nba": "monitor",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": [],
    "expected_evaluation_warning": "evaluation_very_low_acceptance",
    "expected_confidence_penalty_min": 0.15,
    "placement_unlocked_after_accept": True,
    "expected_evaluation_nba_after_accept": "ready_for_placement",
    "expected_regiekamer_alert": False,
    "provider_decision": "accept",
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Scenario 10 – Successful end-to-end: intake flows all the way through
# ---------------------------------------------------------------------------

SCENARIO_10 = {
    "name": "S10_full_happy_path",
    "description": (
        "Ideale casus: urgentie HOOG, assessment compleet, sterke match, "
        "aanbieder accepteert. Verwacht: confirm_placement na acceptatie, "
        "intake outcome kan op COMPLETED worden gezet."
    ),
    "case_data": _base_case_data(
        urgency="HIGH",
        care_category="GGZ",
        top_match_confidence="high",
        top_match_has_capacity_issue=False,
        top_match_wait_days=7,
        rejected_provider_count=0,
        open_signal_count=0,
        provider_evaluation_nba_code="ready_for_placement",
    ),
    "expected_nba": "confirm_placement",
    "expected_missing_info_codes": [],
    "expected_risk_signal_codes": [],
    "placement_unlocked_after_accept": True,
    "expected_evaluation_nba_after_accept": "ready_for_placement",
    "expected_regiekamer_alert": False,
    "provider_decision": "accept",
    "provider_rejection_reason": "",
}


# ---------------------------------------------------------------------------
# Registry: all scenarios in order
# ---------------------------------------------------------------------------

ALL_SCENARIOS = [
    SCENARIO_1,
    SCENARIO_2,
    SCENARIO_3,
    SCENARIO_4,
    SCENARIO_5,
    SCENARIO_6,
    SCENARIO_7,
    SCENARIO_8,
    SCENARIO_9,
    SCENARIO_10,
]
