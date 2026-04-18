"""
Tests for contracts.regiekamer_forecasting
==========================================

Covers:
  - _score_single_case: urgency/SLA/assessment/signal contributions
  - _detect_assessment_delay_risk: phase/inactivity/urgency rules
  - _detect_match_failure_risk: no_provider / bad_response triggers
  - _detect_sla_breach_risk: overdue / near-breach / no-target
  - _detect_placement_stall_risk: deadline near/past / broken quality
  - _detect_capacity_pressure_risk: region clustering / shortage
  - _detect_escalation_risk: crisis / escalation signals
  - _build_sla_risk_cases: ordering by sla_score, max_items cap
  - _compute_projected_bottleneck: severity-weighted stage selection
  - build_predictive_summary: empty data fallback, required keys
"""

from datetime import date, timedelta
from unittest.mock import MagicMock

from django.test import TestCase

from contracts.models import CareSignal, CaseAssessment, CaseIntakeProcess, PlacementRequest
from contracts.regiekamer_forecasting import (
    BAND_CRITICAL,
    BAND_HIGH,
    BAND_MEDIUM,
    SCORE_CRISIS_URGENCY,
    SCORE_HIGH_URGENCY,
    SCORE_NO_ASSESSMENT,
    SCORE_OVERDUE_TARGET,
    _build_action_impact_summary,
    _build_predictive_strips,
    _build_sla_risk_cases,
    _compute_projected_bottleneck,
    _detect_assessment_delay_risk,
    _detect_capacity_pressure_risk,
    _detect_escalation_risk,
    _detect_match_failure_risk,
    _detect_placement_stall_risk,
    _detect_sla_breach_risk,
    _scored_next_action,
    _score_single_case,
    build_predictive_summary,
)


TODAY = date(2025, 6, 1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _intake(
    pk: int = 1,
    status: str = CaseIntakeProcess.ProcessStatus.INTAKE,
    urgency: str = CaseIntakeProcess.Urgency.MEDIUM,
    updated_days_ago: int = 0,
    target_days_from_now: int | None = None,
    case_assessment=None,
    preferred_region_id: int | None = None,
):
    m = MagicMock()
    m.pk = pk
    m.status = status
    m.urgency = urgency
    m.title = f"Casus {pk}"
    m.preferred_region_id = preferred_region_id

    ua = MagicMock()
    ua.date.return_value = TODAY - timedelta(days=updated_days_ago)
    m.updated_at = ua

    if target_days_from_now is not None:
        m.target_completion_date = TODAY + timedelta(days=target_days_from_now)
    else:
        m.target_completion_date = None

    m.case_assessment = case_assessment
    m.get_status_display.return_value = status
    return m


def _placement(**kwargs):
    m = MagicMock()
    m.selected_provider_id = kwargs.get("selected_provider_id", None)
    m.provider_response_status = kwargs.get(
        "provider_response_status", PlacementRequest.ProviderResponseStatus.PENDING
    )
    m.placement_quality_status = kwargs.get(
        "placement_quality_status", PlacementRequest.PlacementQualityStatus.PENDING
    )
    dl = kwargs.get("provider_response_deadline_at", None)
    m.provider_response_deadline_at = dl
    lr = kwargs.get("provider_response_last_reminder_at", None)
    m.provider_response_last_reminder_at = lr
    return m


def _assessment(status: str = CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING):
    m = MagicMock()
    m.pk = 99
    m.assessment_status = status
    ua = MagicMock()
    ua.date.return_value = TODAY
    m.updated_at = ua
    return m


def _signal(signal_type: str, status: str = CareSignal.SignalStatus.OPEN):
    m = MagicMock()
    m.signal_type = signal_type
    m.status = status
    return m


# ---------------------------------------------------------------------------
# _score_single_case
# ---------------------------------------------------------------------------

class TestScoreSingleCase(TestCase):

    def _call(self, intake, assessment=None, placement=None, signals=None):
        return _score_single_case(intake, assessment, placement, signals or [], TODAY)

    def test_crisis_urgency_pushes_score_above_band_critical(self):
        # CRISIS(40) + no_assessment(15) + overdue_target(25) = 80 >= BAND_CRITICAL(75)
        intake = _intake(
            urgency=CaseIntakeProcess.Urgency.CRISIS,
            target_days_from_now=-2,  # overdue → adds SCORE_OVERDUE_TARGET
        )
        result = self._call(intake)
        self.assertGreaterEqual(result["risk_score"], BAND_CRITICAL)
        self.assertEqual(result["risk_band"], "critical")

    def test_crisis_urgency_alone_gives_high_band(self):
        # CRISIS(40) + no_assessment(15) = 55 → HIGH band
        intake = _intake(urgency=CaseIntakeProcess.Urgency.CRISIS)
        result = self._call(intake)
        self.assertGreaterEqual(result["risk_score"], BAND_HIGH)
        self.assertIn(result["risk_band"], ("critical", "high"))

    def test_high_urgency_with_overdue_target_exceeds_band_high(self):
        intake = _intake(
            urgency=CaseIntakeProcess.Urgency.HIGH,
            target_days_from_now=-5,  # overdue
        )
        result = self._call(intake)
        expected_minimum = SCORE_HIGH_URGENCY + SCORE_OVERDUE_TARGET
        self.assertGreaterEqual(result["risk_score"], expected_minimum)
        self.assertIn(result["risk_band"], ("critical", "high"))

    def test_no_assessment_adds_score(self):
        intake = _intake(
            urgency=CaseIntakeProcess.Urgency.LOW,
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
        )
        result_with = self._call(intake, assessment=None)
        result_without = self._call(intake, assessment=_assessment())
        self.assertGreater(result_with["risk_score"], result_without["risk_score"])

    def test_needs_info_assessment_adds_partial_score(self):
        intake = _intake(status=CaseIntakeProcess.ProcessStatus.ASSESSMENT)
        assess = _assessment(status=CaseAssessment.AssessmentStatus.NEEDS_INFO)
        result = self._call(intake, assessment=assess)
        self.assertIn("aanvulling", " ".join(result["top_reasons"]))

    def test_empty_signals_do_not_crash(self):
        intake = _intake()
        result = self._call(intake, signals=[])
        self.assertIsInstance(result["risk_score"], int)
        self.assertIn(result["risk_band"], ("critical", "high", "medium", "low"))

    def test_escalation_signal_adds_score(self):
        intake = _intake(urgency=CaseIntakeProcess.Urgency.MEDIUM)
        no_signal_result = self._call(intake)
        esc = _signal(CareSignal.SignalType.ESCALATION)
        with_signal_result = self._call(intake, signals=[esc])
        self.assertGreater(with_signal_result["risk_score"], no_signal_result["risk_score"])

    def test_score_is_clamped_to_100(self):
        # Pile on: CRISIS + overdue + no_assessment + escalation + dropout + stale
        intake = _intake(
            urgency=CaseIntakeProcess.Urgency.CRISIS,
            target_days_from_now=-10,
            updated_days_ago=20,
        )
        signals = [
            _signal(CareSignal.SignalType.ESCALATION),
            _signal(CareSignal.SignalType.DROPOUT_RISK),
        ]
        result = self._call(intake, signals=signals)
        self.assertLessEqual(result["risk_score"], 100)

    def test_top_reasons_limited_to_four(self):
        intake = _intake(
            urgency=CaseIntakeProcess.Urgency.CRISIS,
            target_days_from_now=-5,
            updated_days_ago=20,
        )
        signals = [
            _signal(CareSignal.SignalType.ESCALATION),
            _signal(CareSignal.SignalType.DROPOUT_RISK),
        ]
        result = self._call(intake, signals=signals)
        self.assertLessEqual(len(result["top_reasons"]), 4)

    def test_result_has_required_keys(self):
        intake = _intake()
        result = self._call(intake)
        for key in (
            "risk_score",
            "risk_band",
            "top_reasons",
            "next_best_action",
            "next_best_action_href",
            "projected_impact",
        ):
            self.assertIn(key, result)


# ---------------------------------------------------------------------------
# _detect_assessment_delay_risk
# ---------------------------------------------------------------------------

class TestDetectAssessmentDelayRisk(TestCase):

    def test_assessment_phase_stale_no_urgency_is_flagged(self):
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            updated_days_ago=4,  # >= DELAY_RISK_INACTIVITY_DAYS (3)
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNotNone(result)
        self.assertIn(intake.pk, result["affected_case_ids"])

    def test_assessment_phase_fresh_no_urgency_is_not_flagged(self):
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            updated_days_ago=1,
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNone(result)

    def test_intake_phase_is_not_flagged(self):
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            updated_days_ago=10,
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNone(result)

    def test_crisis_urgency_triggers_regardless_of_inactivity(self):
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.CRISIS,
            updated_days_ago=0,  # fresh
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNotNone(result)
        self.assertEqual(result["severity"], "critical")

    def test_high_urgency_triggers_regardless_of_inactivity(self):
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            updated_days_ago=0,
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNotNone(result)

    def test_near_target_triggers(self):
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            updated_days_ago=0,
            target_days_from_now=2,  # within SLA_NEAR_BREACH_DAYS=3
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNotNone(result)

    def test_empty_list_returns_none(self):
        self.assertIsNone(_detect_assessment_delay_risk([], TODAY))

    def test_approved_assessment_is_not_flagged(self):
        ass = _assessment(status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING)
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            updated_days_ago=10,
            case_assessment=ass,
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNone(result)

    def test_signal_structure(self):
        intake = _intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            updated_days_ago=5,
        )
        result = _detect_assessment_delay_risk([intake], TODAY)
        self.assertIsNotNone(result)
        for key in ("key", "severity", "label", "affected_case_count", "affected_case_ids",
                    "recommended_action", "target_url"):
            self.assertIn(key, result)
        self.assertEqual(result["key"], "assessment_delay_risk")


# ---------------------------------------------------------------------------
# _detect_sla_breach_risk
# ---------------------------------------------------------------------------

class TestDetectSlaBreachRisk(TestCase):

    def test_overdue_target_gives_critical_severity(self):
        intake = _intake(target_days_from_now=-3)
        result = _detect_sla_breach_risk([intake], TODAY)
        self.assertIsNotNone(result)
        self.assertEqual(result["severity"], "critical")

    def test_near_breach_gives_high_severity(self):
        intake = _intake(target_days_from_now=1)
        result = _detect_sla_breach_risk([intake], TODAY)
        self.assertIsNotNone(result)
        self.assertEqual(result["severity"], "high")

    def test_within_breach_window_gives_warning(self):
        intake = _intake(target_days_from_now=3)
        result = _detect_sla_breach_risk([intake], TODAY)
        self.assertIsNotNone(result)

    def test_outside_breach_window_not_flagged(self):
        intake = _intake(target_days_from_now=10)
        result = _detect_sla_breach_risk([intake], TODAY)
        self.assertIsNone(result)

    def test_no_target_not_included(self):
        intake = _intake(target_days_from_now=None)
        result = _detect_sla_breach_risk([intake], TODAY)
        self.assertIsNone(result)

    def test_multiple_cases_aggregated(self):
        intakes = [
            _intake(pk=1, target_days_from_now=-2),
            _intake(pk=2, target_days_from_now=2),
        ]
        result = _detect_sla_breach_risk(intakes, TODAY)
        self.assertIsNotNone(result)
        self.assertEqual(result["affected_case_count"], 2)
        self.assertIn(1, result["affected_case_ids"])
        self.assertIn(2, result["affected_case_ids"])


# ---------------------------------------------------------------------------
# _detect_match_failure_risk
# ---------------------------------------------------------------------------

class TestDetectMatchFailureRisk(TestCase):

    def test_no_placement_in_matching_phase_is_flagged(self):
        intake = _intake(status=CaseIntakeProcess.ProcessStatus.MATCHING)
        result = _detect_match_failure_risk([intake], {}, {}, TODAY)
        self.assertIsNotNone(result)

    def test_rejected_response_is_flagged(self):
        intake = _intake(status=CaseIntakeProcess.ProcessStatus.MATCHING, pk=5)
        p = _placement(
            selected_provider_id=10,
            provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
        )
        result = _detect_match_failure_risk([intake], {5: p}, {}, TODAY)
        self.assertIsNotNone(result)

    def test_no_capacity_response_is_flagged(self):
        intake = _intake(status=CaseIntakeProcess.ProcessStatus.MATCHING, pk=6)
        p = _placement(
            provider_response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        )
        result = _detect_match_failure_risk([intake], {6: p}, {}, TODAY)
        self.assertIsNotNone(result)

    def test_intake_phase_not_flagged(self):
        intake = _intake(status=CaseIntakeProcess.ProcessStatus.INTAKE)
        result = _detect_match_failure_risk([intake], {}, {}, TODAY)
        self.assertIsNone(result)

    def test_accepted_placement_not_flagged(self):
        intake = _intake(status=CaseIntakeProcess.ProcessStatus.MATCHING, pk=7)
        p = _placement(
            selected_provider_id=20,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
        )
        result = _detect_match_failure_risk([intake], {7: p}, {}, TODAY)
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# _detect_placement_stall_risk
# ---------------------------------------------------------------------------

class TestDetectPlacementStallRisk(TestCase):

    def test_deadline_past_with_pending_response_is_flagged(self):
        intake = _intake(pk=1)
        deadline = MagicMock()
        deadline.date.return_value = TODAY - timedelta(days=1)
        p = _placement(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_deadline_at=deadline,
        )
        result = _detect_placement_stall_risk([intake], {1: p}, TODAY)
        self.assertIsNotNone(result)
        self.assertIn(result["severity"], ("critical", "high"))

    def test_broken_down_quality_is_flagged_critical(self):
        intake = _intake(pk=2)
        p = _placement(
            placement_quality_status=PlacementRequest.PlacementQualityStatus.BROKEN_DOWN,
        )
        result = _detect_placement_stall_risk([intake], {2: p}, TODAY)
        self.assertIsNotNone(result)
        self.assertEqual(result["severity"], "critical")

    def test_no_placement_not_flagged(self):
        intake = _intake(pk=3)
        result = _detect_placement_stall_risk([intake], {}, TODAY)
        self.assertIsNone(result)

    def test_accepted_placement_not_stalled(self):
        intake = _intake(pk=4)
        p = _placement(
            selected_provider_id=10,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            placement_quality_status=PlacementRequest.PlacementQualityStatus.GOOD_FIT,
        )
        result = _detect_placement_stall_risk([intake], {4: p}, TODAY)
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# _detect_capacity_pressure_risk
# ---------------------------------------------------------------------------

class TestDetectCapacityPressureRisk(TestCase):

    def test_capacity_shortage_triggers(self):
        result = _detect_capacity_pressure_risk([], capacity_shortage=3, today=TODAY)
        self.assertIsNotNone(result)

    def test_no_shortage_and_no_clustering_returns_none(self):
        intakes = [
            _intake(
                pk=i,
                status=CaseIntakeProcess.ProcessStatus.MATCHING,
                preferred_region_id=1,
            )
            for i in range(2)  # only 2, below threshold of 3
        ]
        result = _detect_capacity_pressure_risk(intakes, capacity_shortage=0, today=TODAY)
        self.assertIsNone(result)

    def test_region_clustering_triggers(self):
        intakes = [
            _intake(
                pk=i,
                status=CaseIntakeProcess.ProcessStatus.MATCHING,
                preferred_region_id=42,
            )
            for i in range(4)  # 4 >= CAPACITY_PRESSURE_REGION_THRESHOLD=3
        ]
        result = _detect_capacity_pressure_risk(intakes, capacity_shortage=0, today=TODAY)
        self.assertIsNotNone(result)


# ---------------------------------------------------------------------------
# _detect_escalation_risk
# ---------------------------------------------------------------------------

class TestDetectEscalationRisk(TestCase):

    def test_crisis_in_matching_phase_is_flagged(self):
        intake = _intake(
            pk=1,
            urgency=CaseIntakeProcess.Urgency.CRISIS,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
        )
        result = _detect_escalation_risk([intake], {}, TODAY)
        self.assertIsNotNone(result)
        self.assertEqual(result["severity"], "critical")

    def test_open_escalation_signal_is_flagged(self):
        intake = _intake(pk=2)
        sig = _signal(CareSignal.SignalType.ESCALATION)
        result = _detect_escalation_risk([intake], {2: [sig]}, TODAY)
        self.assertIsNotNone(result)

    def test_low_urgency_no_signals_not_flagged(self):
        intake = _intake(
            pk=3,
            urgency=CaseIntakeProcess.Urgency.LOW,
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
        )
        result = _detect_escalation_risk([intake], {}, TODAY)
        self.assertIsNone(result)

    def test_empty_list_returns_none(self):
        self.assertIsNone(_detect_escalation_risk([], {}, TODAY))


# ---------------------------------------------------------------------------
# _build_sla_risk_cases
# ---------------------------------------------------------------------------

class TestBuildSlaRiskCases(TestCase):

    def test_ordered_by_sla_score_descending(self):
        intakes = [
            _intake(pk=1, target_days_from_now=-1),   # overdue → high score
            _intake(pk=2, target_days_from_now=3),     # near breach → lower score
        ]
        result = _build_sla_risk_cases(intakes, {}, TODAY)
        self.assertGreater(len(result), 0)
        scores = [c["sla_score"] for c in result]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_max_items_respected(self):
        intakes = [_intake(pk=i, target_days_from_now=-i - 1) for i in range(10)]
        result = _build_sla_risk_cases(intakes, {}, TODAY, max_items=3)
        self.assertLessEqual(len(result), 3)

    def test_case_with_no_target_and_low_inactivity_excluded(self):
        intake = _intake(pk=1, target_days_from_now=None, updated_days_ago=5)
        result = _build_sla_risk_cases([intake], {}, TODAY)
        # 5 < 15 (STALE_DAYS * 3), so should be excluded
        self.assertEqual(len(result), 0)

    def test_case_with_overdue_target_included(self):
        intake = _intake(pk=1, target_days_from_now=-2)
        result = _build_sla_risk_cases([intake], {}, TODAY)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], 1)

    def test_result_contains_required_keys(self):
        intake = _intake(pk=1, target_days_from_now=-1)
        result = _build_sla_risk_cases([intake], {}, TODAY)
        self.assertEqual(len(result), 1)
        for key in (
            "id", "title", "phase", "urgency_code", "days_waiting",
            "days_to_target", "reason", "sla_score",
            "recommended_action", "projected_impact", "action_href", "case_href",
        ):
            self.assertIn(key, result[0], f"Missing key: {key}")


# ---------------------------------------------------------------------------
# _compute_projected_bottleneck
# ---------------------------------------------------------------------------

class TestComputeProjectedBottleneck(TestCase):

    def test_assessment_signal_returns_beoordelingen(self):
        signals = [
            {
                "key": "assessment_delay_risk",
                "severity": "high",
                "affected_case_count": 3,
            }
        ]
        self.assertEqual(_compute_projected_bottleneck(signals), "beoordelingen")

    def test_match_failure_returns_matching(self):
        signals = [
            {
                "key": "match_failure_risk",
                "severity": "critical",
                "affected_case_count": 2,
            }
        ]
        self.assertEqual(_compute_projected_bottleneck(signals), "matching")

    def test_capacity_pressure_alone_returns_matching(self):
        signals = [
            {
                "key": "capacity_pressure_risk",
                "severity": "warning",
                "affected_case_count": 4,
            }
        ]
        self.assertEqual(_compute_projected_bottleneck(signals), "matching")

    def test_stall_only_returns_plaatsingen(self):
        signals = [
            {
                "key": "placement_stall_risk",
                "severity": "high",
                "affected_case_count": 2,
            }
        ]
        self.assertEqual(_compute_projected_bottleneck(signals), "plaatsingen")

    def test_escalation_only_returns_casussen(self):
        signals = [
            {
                "key": "escalation_risk",
                "severity": "critical",
                "affected_case_count": 1,
            }
        ]
        self.assertEqual(_compute_projected_bottleneck(signals), "casussen")

    def test_empty_signals_returns_none(self):
        self.assertEqual(_compute_projected_bottleneck([]), "none")

    def test_critical_wins_over_higher_count_warning(self):
        # Critical assessment_delay (2 cases) vs warning placement_stall (10 cases)
        signals = [
            {
                "key": "assessment_delay_risk",
                "severity": "critical",
                "affected_case_count": 2,
            },
            {
                "key": "placement_stall_risk",
                "severity": "warning",
                "affected_case_count": 10,
            },
        ]
        # critical should win
        result = _compute_projected_bottleneck(signals)
        self.assertEqual(result, "beoordelingen")


# ---------------------------------------------------------------------------
# build_predictive_summary (public API)
# ---------------------------------------------------------------------------

class TestBuildPredictiveSummary(TestCase):

    def _call(self, intakes=None, placements=None, signals=None, shortage=0):
        return build_predictive_summary(
            org=None,
            active_intakes=intakes or [],
            placement_by_intake=placements or {},
            signals_by_intake=signals or {},
            today=TODAY,
            capacity_shortage=shortage,
        )

    def test_empty_data_returns_required_keys(self):
        result = self._call()
        for key in (
            "forecast_signals",
            "sla_risk_cases",
            "projected_bottleneck_stage",
            "action_impact_summary",
            "per_case_forecast",
            "predictive_strips",
        ):
            self.assertIn(key, result, f"Missing key: {key}")

    def test_empty_data_returns_no_crash(self):
        result = self._call()
        self.assertEqual(result["forecast_signals"], [])
        self.assertEqual(result["sla_risk_cases"], [])
        self.assertEqual(result["projected_bottleneck_stage"], "none")
        self.assertEqual(result["per_case_forecast"], {})

    def test_org_none_does_not_crash(self):
        # Explicitly pass org=None
        result = build_predictive_summary(
            org=None,
            active_intakes=[],
            placement_by_intake={},
            signals_by_intake={},
            today=TODAY,
        )
        self.assertIsInstance(result, dict)

    def test_per_case_forecast_keyed_by_intake_pk(self):
        intakes = [
            _intake(pk=10, urgency=CaseIntakeProcess.Urgency.CRISIS),
            _intake(pk=20, urgency=CaseIntakeProcess.Urgency.LOW),
        ]
        result = self._call(intakes=intakes)
        self.assertIn(10, result["per_case_forecast"])
        self.assertIn(20, result["per_case_forecast"])

    def test_crisis_intake_has_high_risk_score(self):
        intake = _intake(pk=1, urgency=CaseIntakeProcess.Urgency.CRISIS)
        result = self._call(intakes=[intake])
        fc = result["per_case_forecast"][1]
        self.assertGreaterEqual(fc["risk_score"], SCORE_CRISIS_URGENCY)

    def test_forecast_signals_sorted_by_severity(self):
        # Multiple intakes that trigger different signal types
        intakes = [
            _intake(
                pk=1,
                status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
                urgency=CaseIntakeProcess.Urgency.HIGH,
                updated_days_ago=5,
                target_days_from_now=-2,
            ),
            _intake(
                pk=2,
                status=CaseIntakeProcess.ProcessStatus.MATCHING,
                urgency=CaseIntakeProcess.Urgency.MEDIUM,
            ),
        ]
        result = self._call(intakes=intakes)
        sigs = result["forecast_signals"]
        sev_rank = {"critical": 0, "high": 1, "warning": 2, "info": 3}
        ranks = [sev_rank.get(s["severity"], 9) for s in sigs]
        self.assertEqual(ranks, sorted(ranks))

    def test_action_impact_summary_is_string(self):
        result = self._call()
        self.assertIsInstance(result["action_impact_summary"], str)
        self.assertGreater(len(result["action_impact_summary"]), 0)

    def test_predictive_strips_max_two(self):
        intakes = [
            _intake(
                pk=i,
                status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
                urgency=CaseIntakeProcess.Urgency.CRISIS,
                updated_days_ago=10,
                target_days_from_now=-5,
            )
            for i in range(5)
        ]
        result = self._call(intakes=intakes)
        self.assertLessEqual(len(result["predictive_strips"]), 2)

    def test_predictive_strips_have_required_keys(self):
        intakes = [
            _intake(
                pk=1,
                status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
                urgency=CaseIntakeProcess.Urgency.HIGH,
                updated_days_ago=6,
            )
        ]
        result = self._call(intakes=intakes)
        for strip in result["predictive_strips"]:
            for key in ("label", "tone", "href", "is_forecast"):
                self.assertIn(key, strip, f"Strip missing key: {key}")
            self.assertTrue(strip["is_forecast"])


# ---------------------------------------------------------------------------
# Helper branch coverage: actions, strips, and impact summaries
# ---------------------------------------------------------------------------

class TestForecastingHelperBranches(TestCase):

    def test_scored_next_action_on_hold_high_risk_escalates(self):
        intake = _intake(
            pk=1,
            status=CaseIntakeProcess.ProcessStatus.ON_HOLD,
            urgency=CaseIntakeProcess.Urgency.HIGH,
        )
        action = _scored_next_action(intake, assessment=None, placement=None, risk_score=BAND_HIGH)
        self.assertEqual(action["label"], "Escaleer naar regiocoördinator")
        self.assertIn("/care/casussen/1/signalen/new/", action["href"])

    def test_scored_next_action_on_hold_low_risk_unblocks(self):
        intake = _intake(
            pk=2,
            status=CaseIntakeProcess.ProcessStatus.ON_HOLD,
            urgency=CaseIntakeProcess.Urgency.LOW,
        )
        action = _scored_next_action(intake, assessment=None, placement=None, risk_score=10)
        self.assertEqual(action["label"], "Verwijder blokkade")
        self.assertIn("/care/casussen/2/", action["href"])

    def test_scored_next_action_matching_no_capacity_reconsiders(self):
        intake = _intake(pk=3, status=CaseIntakeProcess.ProcessStatus.MATCHING)
        placement = _placement(
            provider_response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY
        )
        action = _scored_next_action(intake, assessment=None, placement=placement, risk_score=40)
        self.assertEqual(action["label"], "Heroverweeg zoekcriteria of verbreed regio")

    def test_scored_next_action_matching_rejected_restarts(self):
        intake = _intake(pk=4, status=CaseIntakeProcess.ProcessStatus.MATCHING)
        placement = _placement(
            provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED
        )
        action = _scored_next_action(intake, assessment=None, placement=placement, risk_score=40)
        self.assertEqual(action["label"], "Start nieuwe matching")

    def test_scored_next_action_matching_pending_reminds(self):
        intake = _intake(pk=5, status=CaseIntakeProcess.ProcessStatus.MATCHING)
        placement = _placement(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING
        )
        action = _scored_next_action(intake, assessment=None, placement=placement, risk_score=40)
        self.assertEqual(action["label"], "Herinner aanbieder aan openstaande reactie")
        self.assertIn("/care/plaatsingen/", action["href"])

    def test_scored_next_action_matching_at_risk_quality(self):
        intake = _intake(pk=6, status=CaseIntakeProcess.ProcessStatus.MATCHING)
        placement = _placement(
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            placement_quality_status=PlacementRequest.PlacementQualityStatus.AT_RISK,
        )
        action = _scored_next_action(intake, assessment=None, placement=placement, risk_score=40)
        self.assertEqual(action["label"], "Controleer plaatsingskwaliteit")

    def test_predictive_strips_adds_critical_strip_without_sla(self):
        forecast_signals = [
            {
                "key": "match_failure_risk",
                "severity": "critical",
                "label": "Kritieke matchuitval",
                "target_url": "/care/matching/",
                "affected_case_count": 2,
            }
        ]
        strips = _build_predictive_strips(
            forecast_signals=forecast_signals,
            projected_bottleneck_stage="none",
            sla_risk_cases=[],
        )
        self.assertEqual(len(strips), 1)
        self.assertEqual(strips[0]["tone"], "critical")
        self.assertEqual(strips[0]["href"], "/care/matching/")

    def test_action_impact_summary_unknown_signal_uses_generic_fallback(self):
        summary = _build_action_impact_summary(
            [
                {
                    "key": "unmapped_signal",
                    "severity": "critical",
                    "affected_case_count": 3,
                }
            ]
        )
        self.assertIn("Verbetert doorstroom voor 3 casussen", summary)
