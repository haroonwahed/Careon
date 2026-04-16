"""Regression tests for behavior-aware SLA calculation and next_best_action logic.

Covers:
- get_provider_sla_adjustment: correct adjustment values per behavioral profile
- calculate_provider_response_sla: extended thresholds with and without metrics
- determine_next_best_action: behavior-influenced branching (rematch sooner,
  resend skipped, reliable-provider patience)
- evaluate_case_intelligence: adaptive SLA exposed via adjusted_sla_state,
  adaptive_deadline, sla_explanation; escalation_required reflects adaptive SLA
- Guardrails: no extreme SLA shifts, floor enforcement, deterministic output
- Neutral path: no metrics → default SLA unchanged
"""

import unittest
from datetime import datetime, timedelta, timezone

from contracts.case_intelligence import (
    calculate_provider_response_sla,
    determine_next_best_action,
    evaluate_case_intelligence,
    get_provider_sla_adjustment,
)


# ---------------------------------------------------------------------------
# Shared fixture helpers
# ---------------------------------------------------------------------------

def _pending_placement(hours_ago: float, now: datetime):
    """Return a minimal placement dict with PENDING status."""
    return {
        "provider_response_status": "PENDING",
        "provider_response_requested_at": now - timedelta(hours=hours_ago),
    }


def _fast_reliable_metrics() -> dict:
    """Provider: fast responder, high acceptance, strong intake, good capacity."""
    return {
        "total_cases": 25,
        "avg_response_time_hours": 18.0,
        "acceptance_rate": 0.80,
        "no_capacity_rate": 0.05,
        "waitlist_rate": 0.05,
        "intake_success_rate": 0.85,
    }


def _slow_metrics() -> dict:
    """Provider: very slow responder, mediocre acceptance."""
    return {
        "total_cases": 20,
        "avg_response_time_hours": 110.0,
        "acceptance_rate": 0.45,
        "no_capacity_rate": 0.10,
        "waitlist_rate": 0.10,
        "intake_success_rate": 0.50,
    }


def _high_no_capacity_metrics() -> dict:
    """Provider: frequent no-capacity responses."""
    return {
        "total_cases": 18,
        "avg_response_time_hours": 48.0,
        "acceptance_rate": 0.30,
        "no_capacity_rate": 0.55,
        "waitlist_rate": 0.15,
        "intake_success_rate": 0.40,
    }


def _sparse_metrics() -> dict:
    """Provider: only 2 cases — sparse history guardrail triggers."""
    return {
        "total_cases": 2,
        "avg_response_time_hours": 20.0,
        "acceptance_rate": 1.0,
        "no_capacity_rate": 0.0,
        "waitlist_rate": 0.0,
        "intake_success_rate": 1.0,
    }


def _base_case_data(now: datetime) -> dict:
    """Minimal valid case_data for determine_next_best_action tests."""
    return {
        "phase": "MATCHING",
        "care_category": "Jeugd",
        "urgency": "MEDIUM",
        "assessment_complete": True,
        "matching_run_exists": True,
        "top_match_confidence": "high",
        "top_match_has_capacity_issue": False,
        "top_match_wait_days": 7,
        "selected_provider_id": 42,
        "placement_status": "IN_REVIEW",
        "placement_updated_at": now.date(),
        "rejected_provider_count": 0,
        "open_signal_count": 0,
        "open_task_count": 1,
        "case_updated_at": now.date(),
        "candidate_suggestions": [
            {"provider_id": 42, "confidence": "high", "has_capacity_issue": False, "wait_days": 7}
        ],
        "now": now,
        "provider_response_status": "PENDING",
        "provider_response_requested_at": now - timedelta(hours=53),
    }


# ---------------------------------------------------------------------------
# get_provider_sla_adjustment tests
# ---------------------------------------------------------------------------

class GetProviderSlaAdjustmentTests(unittest.TestCase):

    def test_no_metrics_returns_neutral(self):
        adj = get_provider_sla_adjustment(None)
        self.assertEqual(adj["response_time_modifier_hours"], 0)
        self.assertEqual(adj["escalation_modifier_hours"], 0)

    def test_empty_dict_returns_neutral(self):
        adj = get_provider_sla_adjustment({})
        self.assertEqual(adj["response_time_modifier_hours"], 0)
        self.assertEqual(adj["escalation_modifier_hours"], 0)

    def test_sparse_history_returns_neutral(self):
        adj = get_provider_sla_adjustment(_sparse_metrics())
        self.assertEqual(adj["response_time_modifier_hours"], 0)
        self.assertEqual(adj["escalation_modifier_hours"], 0)

    def test_fast_reliable_provider_extends_patience(self):
        adj = get_provider_sla_adjustment(_fast_reliable_metrics())
        # Fast → +12; high acceptance + high intake → +6; capped at 12.
        self.assertEqual(adj["response_time_modifier_hours"], 12)
        self.assertGreaterEqual(adj["escalation_modifier_hours"], 0)

    def test_slow_provider_shortens_patience(self):
        adj = get_provider_sla_adjustment(_slow_metrics())
        self.assertEqual(adj["response_time_modifier_hours"], -12)
        # No capacity friction on this profile so escalation unchanged
        self.assertEqual(adj["escalation_modifier_hours"], 0)

    def test_high_no_capacity_shortens_escalation(self):
        adj = get_provider_sla_adjustment(_high_no_capacity_metrics())
        self.assertLessEqual(adj["escalation_modifier_hours"], -6)

    def test_adjustments_bounded_to_twelve_hours(self):
        adj = get_provider_sla_adjustment(_fast_reliable_metrics())
        self.assertGreaterEqual(adj["response_time_modifier_hours"], -12)
        self.assertLessEqual(adj["response_time_modifier_hours"], 12)
        self.assertGreaterEqual(adj["escalation_modifier_hours"], -12)
        self.assertLessEqual(adj["escalation_modifier_hours"], 12)

    def test_deterministic_across_repeated_calls(self):
        metrics = _fast_reliable_metrics()
        adj1 = get_provider_sla_adjustment(metrics)
        adj2 = get_provider_sla_adjustment(metrics)
        self.assertEqual(adj1, adj2)


# ---------------------------------------------------------------------------
# calculate_provider_response_sla  — adaptive threshold tests
# ---------------------------------------------------------------------------

class AdaptiveSlaThresholdTests(unittest.TestCase):

    def setUp(self):
        self.now = datetime(2026, 4, 15, 12, 0, 0)

    def test_no_metrics_identical_to_original_behavior(self):
        """With provider_metrics=None every threshold must stay at the originals."""
        placement = _pending_placement(30, self.now)

        with_none = calculate_provider_response_sla(placement, now=self.now, provider_metrics=None)
        without_arg = calculate_provider_response_sla(placement, now=self.now)

        # Same sla_state and hours_waiting
        self.assertEqual(with_none["sla_state"], without_arg["sla_state"])
        self.assertEqual(with_none["hours_waiting"], without_arg["hours_waiting"])
        # sla_adjustment present but zero
        self.assertEqual(with_none["sla_adjustment"]["response_time_modifier_hours"], 0)
        self.assertEqual(with_none["sla_adjustment"]["escalation_modifier_hours"], 0)

    def test_fast_provider_stays_on_track_longer(self):
        """A fast provider at 55h should still be ON_TRACK (normal: AT_RISK)."""
        placement = _pending_placement(55, self.now)

        normal = calculate_provider_response_sla(placement, now=self.now)
        adaptive = calculate_provider_response_sla(
            placement, now=self.now, provider_metrics=_fast_reliable_metrics()
        )

        self.assertEqual(normal["sla_state"], "AT_RISK")
        self.assertEqual(adaptive["sla_state"], "ON_TRACK")

    def test_slow_provider_reaches_at_risk_sooner(self):
        """A slow provider at 40h should be AT_RISK (normal: ON_TRACK)."""
        placement = _pending_placement(40, self.now)

        normal = calculate_provider_response_sla(placement, now=self.now)
        adaptive = calculate_provider_response_sla(
            placement, now=self.now, provider_metrics=_slow_metrics()
        )

        self.assertEqual(normal["sla_state"], "ON_TRACK")
        self.assertEqual(adaptive["sla_state"], "AT_RISK")

    def test_high_no_capacity_provider_escalates_earlier(self):
        """A no-capacity provider at 90h should be ESCALATED (normal: OVERDUE).

        _high_no_capacity_metrics → esc_mod=-12 → t_overdue = max(96-12,48) = 84.
        At 90h: normal uses t_overdue=96 → OVERDUE; adaptive uses t_overdue=84 → ESCALATED.
        """
        placement = _pending_placement(90, self.now)

        normal = calculate_provider_response_sla(placement, now=self.now)
        adaptive = calculate_provider_response_sla(
            placement, now=self.now, provider_metrics=_high_no_capacity_metrics()
        )

        self.assertEqual(normal["sla_state"], "OVERDUE")
        self.assertEqual(adaptive["sla_state"], "ESCALATED")

    def test_sla_floor_prevents_extreme_compression(self):
        """Even with -12h adjustments no threshold falls below the minimum floor."""
        placement = _pending_placement(25, self.now)
        adaptive = calculate_provider_response_sla(
            placement, now=self.now, provider_metrics=_slow_metrics()
        )
        # ON_TRACK floor is 24h, so 25h of waiting should be AT_RISK at most
        self.assertIn(adaptive["sla_state"], {"ON_TRACK", "AT_RISK"})

    def test_sparse_history_applies_no_adjustment(self):
        """Sparse history (<=2 cases) must yield the same state as no metrics."""
        placement = _pending_placement(50, self.now)

        no_metrics = calculate_provider_response_sla(placement, now=self.now)
        sparse = calculate_provider_response_sla(
            placement, now=self.now, provider_metrics=_sparse_metrics()
        )

        self.assertEqual(no_metrics["sla_state"], sparse["sla_state"])

    def test_sla_adjustment_key_always_present(self):
        placement = _pending_placement(30, self.now)
        result = calculate_provider_response_sla(placement, now=self.now)
        self.assertIn("sla_adjustment", result)
        self.assertIn("response_time_modifier_hours", result["sla_adjustment"])
        self.assertIn("escalation_modifier_hours", result["sla_adjustment"])

    def test_deterministic_output_with_same_inputs(self):
        placement = _pending_placement(55, self.now)
        metrics = _fast_reliable_metrics()
        first = calculate_provider_response_sla(placement, now=self.now, provider_metrics=metrics)
        second = calculate_provider_response_sla(placement, now=self.now, provider_metrics=metrics)
        self.assertEqual(first, second)

    def test_slow_provider_waitlist_escalates_sooner(self):
        """WAITLIST status for a slow provider escalates before the default 72h."""
        placement = {
            "provider_response_status": "WAITLIST",
            "provider_response_requested_at": self.now - timedelta(hours=65),
        }
        normal = calculate_provider_response_sla(placement, now=self.now)
        adaptive = calculate_provider_response_sla(
            placement, now=self.now, provider_metrics=_high_no_capacity_metrics()
        )
        self.assertEqual(normal["sla_state"], "AT_RISK")
        self.assertEqual(adaptive["sla_state"], "ESCALATED")


# ---------------------------------------------------------------------------
# determine_next_best_action — behavior-aware branching tests
# ---------------------------------------------------------------------------

class BehaviorAwareNextActionTests(unittest.TestCase):

    def setUp(self):
        self.now = datetime(2026, 4, 15, 12, 0, 0)

    # -- Neutral path (no metrics) ------------------------------------------

    def test_no_metrics_no_behavior_reason(self):
        case_data = _base_case_data(self.now)
        action = determine_next_best_action(case_data)
        self.assertIn("behavior_reason", action)
        self.assertIsNone(action["behavior_reason"])

    def test_no_metrics_at_risk_standard_follow_up(self):
        case_data = _base_case_data(self.now)
        # 53h → AT_RISK under default thresholds
        action = determine_next_best_action(case_data)
        self.assertEqual(action["code"], "follow_up_provider_response")
        self.assertIsNone(action["behavior_reason"])

    # -- High no-capacity → rematch sooner at AT_RISK -----------------------

    def test_high_no_capacity_at_risk_triggers_rematch(self):
        case_data = _base_case_data(self.now)
        # 53h → AT_RISK
        action = determine_next_best_action(
            case_data, provider_metrics=_high_no_capacity_metrics()
        )
        self.assertEqual(action["code"], "run_matching")
        self.assertIn("capacity", action["behavior_reason"].lower())

    def test_high_no_capacity_overdue_triggers_rematch(self):
        case_data = _base_case_data(self.now)
        # Advance to OVERDUE (80h)
        case_data["provider_response_requested_at"] = self.now - timedelta(hours=80)
        action = determine_next_best_action(
            case_data, provider_metrics=_high_no_capacity_metrics()
        )
        self.assertEqual(action["code"], "run_matching")
        self.assertIn("capacity", action["behavior_reason"].lower())

    # -- Slow responder → skip resend at OVERDUE ----------------------------

    def test_slow_responder_overdue_skips_resend(self):
        case_data = _base_case_data(self.now)
        case_data["provider_response_requested_at"] = self.now - timedelta(hours=80)
        action = determine_next_best_action(case_data, provider_metrics=_slow_metrics())
        self.assertEqual(action["code"], "run_matching")
        self.assertIn("slow", action["behavior_reason"].lower())

    def test_slow_responder_escalated_triggers_rematch(self):
        case_data = _base_case_data(self.now)
        case_data["provider_response_requested_at"] = self.now - timedelta(hours=108)
        action = determine_next_best_action(case_data, provider_metrics=_slow_metrics())
        self.assertEqual(action["code"], "run_matching")
        self.assertIn("slow", action["behavior_reason"].lower())

    # -- Reliable provider → resend allowed before forced escalation --------

    def test_reliable_provider_at_risk_allows_resend(self):
        case_data = _base_case_data(self.now)
        # 53h → AT_RISK (fast provider is still ON_TRACK at 55h, but at 65h it's AT_RISK)
        case_data["provider_response_requested_at"] = self.now - timedelta(hours=65)
        action = determine_next_best_action(
            case_data, provider_metrics=_fast_reliable_metrics()
        )
        self.assertEqual(action["code"], "follow_up_provider_response")
        self.assertIn("reliable", action["behavior_reason"].lower())

    def test_reliable_provider_overdue_allows_resend(self):
        case_data = _base_case_data(self.now)
        case_data["provider_response_requested_at"] = self.now - timedelta(hours=80)
        action = determine_next_best_action(
            case_data, provider_metrics=_fast_reliable_metrics()
        )
        self.assertEqual(action["code"], "follow_up_provider_response")
        self.assertIn("reliable", action["behavior_reason"].lower())

    # -- behavior_reason explainability text --------------------------------

    def test_rematch_reason_mentions_capacity(self):
        case_data = _base_case_data(self.now)
        action = determine_next_best_action(
            case_data, provider_metrics=_high_no_capacity_metrics()
        )
        self.assertIn("capacity", action["behavior_reason"].lower())

    def test_reliable_reason_mentions_reliable(self):
        case_data = _base_case_data(self.now)
        case_data["provider_response_requested_at"] = self.now - timedelta(hours=65)
        action = determine_next_best_action(
            case_data, provider_metrics=_fast_reliable_metrics()
        )
        self.assertIn("reliable", action["behavior_reason"].lower())

    # -- Sparse history → no behavioral change ------------------------------

    def test_sparse_metrics_no_behavioral_change(self):
        """Sparse history must not alter actions compared to no-metrics path."""
        case_data = _base_case_data(self.now)
        without = determine_next_best_action(case_data)
        with_sparse = determine_next_best_action(case_data, provider_metrics=_sparse_metrics())
        self.assertEqual(without["code"], with_sparse["code"])

    # -- Forced action always runs matching regardless ----------------------

    def test_forced_action_always_runs_matching(self):
        case_data = _base_case_data(self.now)
        case_data["provider_response_requested_at"] = self.now - timedelta(hours=125)
        for metrics in [None, _fast_reliable_metrics(), _slow_metrics(), _high_no_capacity_metrics()]:
            action = determine_next_best_action(case_data, provider_metrics=metrics)
            self.assertEqual(
                action["code"],
                "run_matching",
                f"Expected run_matching at FORCED_ACTION for metrics={metrics}",
            )

    # -- Determinism --------------------------------------------------------

    def test_same_inputs_same_output_across_runs(self):
        case_data = _base_case_data(self.now)
        metrics = _high_no_capacity_metrics()
        first = determine_next_best_action(case_data, provider_metrics=metrics)
        second = determine_next_best_action(case_data, provider_metrics=metrics)
        self.assertEqual(first["code"], second["code"])
        self.assertEqual(first["behavior_reason"], second["behavior_reason"])

    # -- Non-breaking: pre-existing code paths unaffected ------------------

    def test_missing_information_path_unaffected_by_metrics(self):
        case_data = _base_case_data(self.now)
        case_data["care_category"] = None
        action = determine_next_best_action(
            case_data, provider_metrics=_high_no_capacity_metrics()
        )
        self.assertEqual(action["code"], "fill_missing_information")
        self.assertIsNone(action["behavior_reason"])

    def test_run_matching_for_no_match_path_unaffected(self):
        case_data = _base_case_data(self.now)
        case_data["matching_run_exists"] = False
        case_data["provider_response_status"] = None
        action = determine_next_best_action(
            case_data, provider_metrics=_high_no_capacity_metrics()
        )
        self.assertEqual(action["code"], "run_matching")
        self.assertIsNone(action["behavior_reason"])

    def test_behavior_reason_key_always_present_in_all_paths(self):
        """Every code branch must return behavior_reason (even if None)."""
        now = self.now
        cases = [
            # monitor path
            {**_base_case_data(now), "placement_status": "APPROVED", "provider_response_status": None},
            # fill_missing_information
            {**_base_case_data(now), "care_category": None},
            # run_matching
            {**_base_case_data(now), "matching_run_exists": False, "provider_response_status": None},
        ]
        for case_data in cases:
            action = determine_next_best_action(case_data)
            self.assertIn("behavior_reason", action, f"Missing behavior_reason for {case_data}")


# ---------------------------------------------------------------------------
# evaluate_case_intelligence — adaptive SLA integration tests
# ---------------------------------------------------------------------------

class EvaluateCaseIntelligenceAdaptiveSlaTests(unittest.TestCase):
    """Verify that evaluate_case_intelligence exposes adaptive SLA fields and
    that escalation_required / forced_action_required reflect adaptive thresholds
    when provider_metrics are supplied."""

    def setUp(self):
        self.now = datetime(2026, 4, 15, 12, 0, 0)
        self.now_utc = datetime(2026, 4, 15, 12, 0, 0, tzinfo=timezone.utc)

    def _case_at(self, hours_ago: float, status: str = "PENDING") -> dict:
        base = _base_case_data(self.now)
        base["provider_response_status"] = status
        base["provider_response_requested_at"] = self.now - timedelta(hours=hours_ago)
        # Use provider_id=None so build_provider_behavior_metrics returns
        # empty metrics without touching the DB during pure-unit tests.
        base["candidate_suggestions"] = [
            {"provider_id": None, "confidence": "high", "has_capacity_issue": False, "wait_days": 7}
        ]
        return base

    # -- New output keys are always present ---------------------------------

    def test_new_keys_present_without_metrics(self):
        result = evaluate_case_intelligence(self._case_at(30))
        self.assertIn("adjusted_sla_state", result)
        self.assertIn("adaptive_deadline", result)
        self.assertIn("sla_explanation", result)

    def test_new_keys_present_with_metrics(self):
        result = evaluate_case_intelligence(
            self._case_at(55), provider_metrics=_fast_reliable_metrics()
        )
        self.assertIn("adjusted_sla_state", result)
        self.assertIn("adaptive_deadline", result)
        self.assertIn("sla_explanation", result)

    # -- adjusted_sla_state mirrors sla_state --------------------------------

    def test_adjusted_sla_state_equals_sla_state(self):
        for metrics in [None, _fast_reliable_metrics(), _slow_metrics(), _high_no_capacity_metrics()]:
            result = evaluate_case_intelligence(self._case_at(55), provider_metrics=metrics)
            self.assertEqual(
                result["adjusted_sla_state"],
                result["sla_state"],
                f"adjusted_sla_state mismatch for metrics={metrics}",
            )

    # -- adaptive_deadline is a datetime when threshold exists ---------------

    def test_adaptive_deadline_is_datetime_for_active_state(self):
        result = evaluate_case_intelligence(self._case_at(30))
        self.assertIsNotNone(result["adaptive_deadline"])
        self.assertIsInstance(result["adaptive_deadline"], datetime)

    def test_adaptive_deadline_is_in_future_for_on_track(self):
        result = evaluate_case_intelligence(self._case_at(20))
        # 20h into PENDING → ON_TRACK; deadline = reference + 48h = now_utc + 28h
        self.assertGreater(result["adaptive_deadline"], self.now_utc)

    def test_adaptive_deadline_shifts_with_fast_provider(self):
        """A fast provider's extended ON_TRACK window should push deadline later."""
        base = evaluate_case_intelligence(self._case_at(20))
        adaptive = evaluate_case_intelligence(
            self._case_at(20), provider_metrics=_fast_reliable_metrics()
        )
        # fast provider: t_on_track = 60 vs base 48 → deadline 12h later
        self.assertGreater(adaptive["adaptive_deadline"], base["adaptive_deadline"])

    def test_adaptive_deadline_shifts_with_slow_provider(self):
        """A slow provider's shorter ON_TRACK window should pull deadline earlier."""
        base = evaluate_case_intelligence(self._case_at(20))
        adaptive = evaluate_case_intelligence(
            self._case_at(20), provider_metrics=_slow_metrics()
        )
        # slow provider: t_on_track = 36 vs base 48 → deadline 12h earlier
        self.assertLess(adaptive["adaptive_deadline"], base["adaptive_deadline"])

    def test_adaptive_deadline_none_for_forced_action(self):
        """FORCED_ACTION has next_threshold_hours=0, so adaptive_deadline must be None."""
        result = evaluate_case_intelligence(self._case_at(125))
        self.assertEqual(result["sla_state"], "FORCED_ACTION")
        self.assertIsNone(result["adaptive_deadline"])

    # -- sla_explanation text -------------------------------------------------

    def test_sla_explanation_is_none_without_metrics(self):
        result = evaluate_case_intelligence(self._case_at(30))
        self.assertIsNone(result["sla_explanation"])

    def test_sla_explanation_is_none_for_sparse_history(self):
        result = evaluate_case_intelligence(
            self._case_at(30), provider_metrics=_sparse_metrics()
        )
        self.assertIsNone(result["sla_explanation"])

    def test_sla_explanation_present_for_fast_reliable_provider(self):
        result = evaluate_case_intelligence(
            self._case_at(30), provider_metrics=_fast_reliable_metrics()
        )
        self.assertIsNotNone(result["sla_explanation"])
        self.assertIn("SLA adjusted due to provider response pattern", result["sla_explanation"])

    def test_sla_explanation_mentions_earlier_escalation_for_slow_provider(self):
        result = evaluate_case_intelligence(
            self._case_at(30), provider_metrics=_slow_metrics()
        )
        self.assertIsNotNone(result["sla_explanation"])
        self.assertIn("SLA adjusted due to provider response pattern", result["sla_explanation"])
        self.assertIn("Earlier escalation recommended", result["sla_explanation"])

    def test_sla_explanation_mentions_earlier_escalation_for_no_capacity_provider(self):
        result = evaluate_case_intelligence(
            self._case_at(30), provider_metrics=_high_no_capacity_metrics()
        )
        self.assertIsNotNone(result["sla_explanation"])
        self.assertIn("Earlier escalation recommended", result["sla_explanation"])

    # -- escalation_required reflects adaptive SLA ---------------------------

    def test_no_metrics_overdue_not_escalation_required(self):
        """Base threshold: 90h is OVERDUE, so escalation_required is False."""
        result = evaluate_case_intelligence(self._case_at(90))
        self.assertEqual(result["sla_state"], "OVERDUE")
        self.assertFalse(result["escalation_required"])

    def test_no_capacity_metrics_makes_90h_escalation_required(self):
        """With high no_capacity metrics: 90h crosses into ESCALATED (t_escalated=108 but t_overdue=84).

        At 90h: base → OVERDUE (escalation_required=False)
               adaptive → ESCALATED (escalation_required=True)
        """
        result = evaluate_case_intelligence(
            self._case_at(90), provider_metrics=_high_no_capacity_metrics()
        )
        self.assertEqual(result["sla_state"], "ESCALATED")
        self.assertTrue(result["escalation_required"])

    def test_reliable_provider_delays_escalation_required(self):
        """Reliable provider at 98h: base=ESCALATED, adaptive=OVERDUE.

        _fast_reliable_metrics: rt_mod=12, esc_mod=+6.
        Base thresholds: t_overdue=96, t_escalated=120.
        Adaptive thresholds: t_overdue=max(96+6,48)=102, t_escalated=max(120+6,60)=126.
        At 98h: base: 96<98<=120 → ESCALATED; adaptive: 84<98<=102 → OVERDUE.
        """
        base_result = evaluate_case_intelligence(self._case_at(98))
        adaptive_result = evaluate_case_intelligence(
            self._case_at(98), provider_metrics=_fast_reliable_metrics()
        )
        self.assertEqual(base_result["sla_state"], "ESCALATED")
        self.assertTrue(base_result["escalation_required"])
        # Reliable provider shifts OVERDUE threshold to 102h, so 98h → OVERDUE
        self.assertEqual(adaptive_result["sla_state"], "OVERDUE")
        self.assertFalse(adaptive_result["escalation_required"])

    # -- Determinism and non-regression -------------------------------------

    def test_same_inputs_yield_same_output(self):
        metrics = _high_no_capacity_metrics()
        case_data = self._case_at(90)
        first = evaluate_case_intelligence(case_data, provider_metrics=metrics)
        second = evaluate_case_intelligence(case_data, provider_metrics=metrics)
        self.assertEqual(first["sla_state"], second["sla_state"])
        self.assertEqual(first["sla_explanation"], second["sla_explanation"])
        self.assertEqual(first["adaptive_deadline"], second["adaptive_deadline"])

    def test_no_metrics_output_unchanged_vs_legacy_call(self):
        """evaluate_case_intelligence() without provider_metrics must be identical
        to the existing behavior (test non-regression of the neutral path)."""
        case_data = self._case_at(80)
        result_new = evaluate_case_intelligence(case_data)
        # Legacy expected values from existing SLA tests
        self.assertEqual(result_new["sla_state"], "OVERDUE")
        self.assertFalse(result_new["escalation_required"])
        self.assertFalse(result_new["forced_action_required"])
        self.assertIsNone(result_new["sla_explanation"])

