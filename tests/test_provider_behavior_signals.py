"""Tests for provider behavior signal derivation and hint integration.

Covers:
- derive_behavior_signals threshold boundaries for all four signals
- None values (no history) propagate correctly
- behavior_signals attached to each candidate hint
- ranking/ordering of hints unchanged (score neutrality)
- generate_candidate_hints still produces all pre-existing fields alongside behavior_signals
- evaluate_case_intelligence candidate_hints include behavior_signals
"""

from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase

from contracts.case_intelligence import generate_candidate_hints, evaluate_case_intelligence
from contracts.provider_metrics import derive_behavior_signals


# ---------------------------------------------------------------------------
# Base case helper (mirrors test_case_intelligence_rules.py pattern)
# ---------------------------------------------------------------------------

def _base_case_data(**overrides):
    base = {
        "phase": "MATCHING",
        "care_category": "Jeugd",
        "urgency": "MEDIUM",
        "assessment_complete": True,
        "matching_run_exists": True,
        "top_match_confidence": "high",
        "top_match_has_capacity_issue": False,
        "top_match_wait_days": 7,
        "selected_provider_id": None,
        "placement_status": None,
        "placement_updated_at": None,
        "rejected_provider_count": 0,
        "open_signal_count": 0,
        "open_task_count": 0,
        "case_updated_at": date.today(),
        "candidate_suggestions": [],
        "has_preferred_region": True,
        "has_assessment_summary": True,
        "has_client_age_category": True,
        "assessment_status": "COMPLETE",
        "assessment_matching_ready": True,
        "matching_updated_at": date.today(),
        "provider_response_status": None,
        "provider_response_recorded_at": None,
        "provider_response_requested_at": None,
        "provider_response_deadline_at": None,
        "provider_response_last_reminder_at": None,
        "now": None,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# derive_behavior_signals — unit tests
# ---------------------------------------------------------------------------

class TestDeriveBehaviorSignalsResponseSpeed(TestCase):
    def _metrics(self, avg_response_time_hours=None):
        return {
            "avg_response_time_hours": avg_response_time_hours,
            "acceptance_rate": None,
            "no_capacity_rate": None,
            "waitlist_rate": None,
            "intake_success_rate": None,
            "total_cases": 0,
        }

    def test_fast_below_24h(self):
        signals = derive_behavior_signals(self._metrics(avg_response_time_hours=12.0))
        self.assertEqual(signals["response_speed"], "fast")

    def test_fast_boundary_just_below_24h(self):
        signals = derive_behavior_signals(self._metrics(avg_response_time_hours=23.99))
        self.assertEqual(signals["response_speed"], "fast")

    def test_average_at_24h(self):
        signals = derive_behavior_signals(self._metrics(avg_response_time_hours=24.0))
        self.assertEqual(signals["response_speed"], "average")

    def test_average_between_24_and_72h(self):
        signals = derive_behavior_signals(self._metrics(avg_response_time_hours=48.0))
        self.assertEqual(signals["response_speed"], "average")

    def test_slow_at_72h(self):
        signals = derive_behavior_signals(self._metrics(avg_response_time_hours=72.0))
        self.assertEqual(signals["response_speed"], "slow")

    def test_slow_above_72h(self):
        signals = derive_behavior_signals(self._metrics(avg_response_time_hours=96.0))
        self.assertEqual(signals["response_speed"], "slow")

    def test_none_returns_none(self):
        signals = derive_behavior_signals(self._metrics(avg_response_time_hours=None))
        self.assertIsNone(signals["response_speed"])


class TestDeriveBehaviorSignalsAcceptancePattern(TestCase):
    def _metrics(self, acceptance_rate=None):
        return {
            "avg_response_time_hours": None,
            "acceptance_rate": acceptance_rate,
            "no_capacity_rate": None,
            "waitlist_rate": None,
            "intake_success_rate": None,
            "total_cases": 0,
        }

    def test_high_at_and_above_70_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.70))["acceptance_pattern"], "high")
        self.assertEqual(derive_behavior_signals(self._metrics(1.0))["acceptance_pattern"], "high")

    def test_mixed_between_30_and_70_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.30))["acceptance_pattern"], "mixed")
        self.assertEqual(derive_behavior_signals(self._metrics(0.50))["acceptance_pattern"], "mixed")
        self.assertEqual(derive_behavior_signals(self._metrics(0.699))["acceptance_pattern"], "mixed")

    def test_low_below_30_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.0))["acceptance_pattern"], "low")
        self.assertEqual(derive_behavior_signals(self._metrics(0.29))["acceptance_pattern"], "low")

    def test_none_returns_none(self):
        self.assertIsNone(derive_behavior_signals(self._metrics(None))["acceptance_pattern"])


class TestDeriveBehaviorSignalsCapacityPattern(TestCase):
    def _metrics(self, no_capacity_rate=None):
        return {
            "avg_response_time_hours": None,
            "acceptance_rate": None,
            "no_capacity_rate": no_capacity_rate,
            "waitlist_rate": None,
            "intake_success_rate": None,
            "total_cases": 0,
        }

    def test_often_full_at_and_above_40_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.40))["capacity_pattern"], "often_full")
        self.assertEqual(derive_behavior_signals(self._metrics(1.0))["capacity_pattern"], "often_full")

    def test_limited_between_15_and_40_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.15))["capacity_pattern"], "limited")
        self.assertEqual(derive_behavior_signals(self._metrics(0.25))["capacity_pattern"], "limited")
        self.assertEqual(derive_behavior_signals(self._metrics(0.399))["capacity_pattern"], "limited")

    def test_stable_below_15_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.0))["capacity_pattern"], "stable")
        self.assertEqual(derive_behavior_signals(self._metrics(0.14))["capacity_pattern"], "stable")

    def test_none_returns_none(self):
        self.assertIsNone(derive_behavior_signals(self._metrics(None))["capacity_pattern"])


class TestDeriveBehaviorSignalsIntakePattern(TestCase):
    def _metrics(self, intake_success_rate=None):
        return {
            "avg_response_time_hours": None,
            "acceptance_rate": None,
            "no_capacity_rate": None,
            "waitlist_rate": None,
            "intake_success_rate": intake_success_rate,
            "total_cases": 0,
        }

    def test_high_success_at_and_above_70_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.70))["intake_pattern"], "high_success")
        self.assertEqual(derive_behavior_signals(self._metrics(1.0))["intake_pattern"], "high_success")

    def test_variable_below_70_percent(self):
        self.assertEqual(derive_behavior_signals(self._metrics(0.0))["intake_pattern"], "variable")
        self.assertEqual(derive_behavior_signals(self._metrics(0.69))["intake_pattern"], "variable")

    def test_none_returns_none(self):
        self.assertIsNone(derive_behavior_signals(self._metrics(None))["intake_pattern"])


class TestDeriveBehaviorSignalsAllKeys(TestCase):
    def test_empty_metrics_returns_all_four_keys_as_none(self):
        metrics = {
            "avg_response_time_hours": None,
            "acceptance_rate": None,
            "no_capacity_rate": None,
            "waitlist_rate": None,
            "intake_success_rate": None,
            "total_cases": 0,
        }
        signals = derive_behavior_signals(metrics)
        self.assertIn("response_speed", signals)
        self.assertIn("acceptance_pattern", signals)
        self.assertIn("capacity_pattern", signals)
        self.assertIn("intake_pattern", signals)
        for value in signals.values():
            self.assertIsNone(value)

    def test_full_metrics_returns_all_four_keys_with_values(self):
        metrics = {
            "avg_response_time_hours": 10.0,
            "acceptance_rate": 0.80,
            "no_capacity_rate": 0.05,
            "waitlist_rate": 0.10,
            "intake_success_rate": 0.90,
            "total_cases": 10,
        }
        signals = derive_behavior_signals(metrics)
        self.assertEqual(signals["response_speed"], "fast")
        self.assertEqual(signals["acceptance_pattern"], "high")
        self.assertEqual(signals["capacity_pattern"], "stable")
        self.assertEqual(signals["intake_pattern"], "high_success")


# ---------------------------------------------------------------------------
# generate_candidate_hints — behavior_signals integration
# ---------------------------------------------------------------------------

# We patch build_provider_behavior_metrics to avoid DB hits in unit tests.
# The DB-backed integration is covered by test_provider_behavior_metrics.py.

_FAST_GOOD_METRICS = {
    "avg_response_time_hours": 10.0,
    "acceptance_rate": 0.80,
    "no_capacity_rate": 0.05,
    "waitlist_rate": 0.10,
    "intake_success_rate": 0.90,
    "total_cases": 8,
}
_SLOW_POOR_METRICS = {
    "avg_response_time_hours": 100.0,
    "acceptance_rate": 0.20,
    "no_capacity_rate": 0.50,
    "waitlist_rate": 0.10,
    "intake_success_rate": 0.30,
    "total_cases": 5,
}
_NO_HISTORY_METRICS = {
    "avg_response_time_hours": None,
    "acceptance_rate": None,
    "no_capacity_rate": None,
    "waitlist_rate": None,
    "intake_success_rate": None,
    "total_cases": 0,
}


class TestCandidateHintsBehaviorSignals(TestCase):
    def _case_with_suggestions(self, suggestions):
        return _base_case_data(candidate_suggestions=suggestions)

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_behavior_signals_present_in_each_hint(self, mock_metrics):
        mock_metrics.return_value = _FAST_GOOD_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": 10, "confidence": "high", "has_capacity_issue": False, "wait_days": 5},
        ])
        hints = generate_candidate_hints(case_data)
        self.assertEqual(len(hints), 1)
        self.assertIn("behavior_signals", hints[0])

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_behavior_signals_fast_good_provider(self, mock_metrics):
        mock_metrics.return_value = _FAST_GOOD_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": 10, "confidence": "high", "has_capacity_issue": False, "wait_days": 5},
        ])
        hints = generate_candidate_hints(case_data)
        signals = hints[0]["behavior_signals"]
        self.assertEqual(signals["response_speed"], "fast")
        self.assertEqual(signals["acceptance_pattern"], "high")
        self.assertEqual(signals["capacity_pattern"], "stable")
        self.assertEqual(signals["intake_pattern"], "high_success")

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_behavior_signals_slow_poor_provider(self, mock_metrics):
        mock_metrics.return_value = _SLOW_POOR_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": 20, "confidence": "medium", "has_capacity_issue": True, "wait_days": 30},
        ])
        hints = generate_candidate_hints(case_data)
        signals = hints[0]["behavior_signals"]
        self.assertEqual(signals["response_speed"], "slow")
        self.assertEqual(signals["acceptance_pattern"], "low")
        self.assertEqual(signals["capacity_pattern"], "often_full")
        self.assertEqual(signals["intake_pattern"], "variable")

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_behavior_signals_none_when_no_history(self, mock_metrics):
        mock_metrics.return_value = _NO_HISTORY_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": 30, "confidence": "high", "has_capacity_issue": False, "wait_days": 3},
        ])
        hints = generate_candidate_hints(case_data)
        signals = hints[0]["behavior_signals"]
        self.assertIsNone(signals["response_speed"])
        self.assertIsNone(signals["acceptance_pattern"])
        self.assertIsNone(signals["capacity_pattern"])
        self.assertIsNone(signals["intake_pattern"])

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_pre_existing_hint_fields_unchanged(self, mock_metrics):
        mock_metrics.return_value = _FAST_GOOD_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": 101, "confidence": "high", "has_capacity_issue": False, "wait_days": 5},
            {"provider_id": 102, "confidence": "medium", "has_capacity_issue": True, "wait_days": 35},
        ])
        hints = generate_candidate_hints(case_data)
        # Ordering unchanged
        self.assertEqual(hints[0]["provider_id"], 101)
        self.assertEqual(hints[1]["provider_id"], 102)
        # hint_code unchanged
        self.assertEqual(hints[0]["hint_code"], "top_recommended")
        # Pre-existing fields present
        for hint in hints:
            self.assertIn("confidence", hint)
            self.assertIn("has_capacity_issue", hint)
            self.assertIn("wait_days", hint)
            self.assertIn("has_region_mismatch", hint)
            self.assertIn("hint_code", hint)
            self.assertIn("hint", hint)
            self.assertIn("trade_offs", hint)
            self.assertIn("comparison_to_top", hint)

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_provider_metrics_called_per_candidate(self, mock_metrics):
        mock_metrics.return_value = _NO_HISTORY_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": 10, "confidence": "high", "has_capacity_issue": False, "wait_days": 5},
            {"provider_id": 20, "confidence": "medium", "has_capacity_issue": False, "wait_days": 10},
            {"provider_id": 30, "confidence": "low", "has_capacity_issue": True, "wait_days": 40},
        ])
        generate_candidate_hints(case_data)
        self.assertEqual(mock_metrics.call_count, 3)
        called_ids = [call.args[0] for call in mock_metrics.call_args_list]
        self.assertEqual(called_ids, [10, 20, 30])

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_metrics_called_with_correct_provider_id(self, mock_metrics):
        mock_metrics.return_value = _FAST_GOOD_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": 999, "confidence": "high", "has_capacity_issue": False, "wait_days": 5},
        ])
        generate_candidate_hints(case_data)
        mock_metrics.assert_called_once_with(999)

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_none_provider_id_handled_safely(self, mock_metrics):
        mock_metrics.return_value = _NO_HISTORY_METRICS
        case_data = self._case_with_suggestions([
            {"provider_id": None, "confidence": "high", "has_capacity_issue": False, "wait_days": 5},
        ])
        hints = generate_candidate_hints(case_data)
        self.assertEqual(len(hints), 1)
        self.assertIn("behavior_signals", hints[0])
        mock_metrics.assert_called_once_with(None)

    def test_empty_suggestions_returns_empty_hints(self):
        case_data = self._case_with_suggestions([])
        hints = generate_candidate_hints(case_data)
        self.assertEqual(hints, [])


# ---------------------------------------------------------------------------
# evaluate_case_intelligence — candidate_hints include behavior_signals
# ---------------------------------------------------------------------------

class TestEvaluateCaseIntelligenceBehaviorSignals(TestCase):
    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_candidate_hints_in_evaluation_include_behavior_signals(self, mock_metrics):
        mock_metrics.return_value = _FAST_GOOD_METRICS
        case_data = _base_case_data(
            candidate_suggestions=[
                {"provider_id": 50, "confidence": "high", "has_capacity_issue": False, "wait_days": 5},
            ]
        )
        result = evaluate_case_intelligence(case_data)
        self.assertIn("candidate_hints", result)
        self.assertEqual(len(result["candidate_hints"]), 1)
        self.assertIn("behavior_signals", result["candidate_hints"][0])

    @patch("contracts.case_intelligence.build_provider_behavior_metrics")
    def test_evaluation_output_keys_unchanged(self, mock_metrics):
        mock_metrics.return_value = _NO_HISTORY_METRICS
        case_data = _base_case_data()
        result = evaluate_case_intelligence(case_data)
        expected_top_level_keys = {
            "missing_information",
            "risk_signals",
            "next_best_action",
            "candidate_hints",
            "sla_state",
            "sla_hours_waiting",
            "sla_breach",
            "escalation_required",
            "forced_action_required",
            "next_owner",
            "next_owner_label",
            "next_action",
            "next_action_label",
            "action_deadline",
            "action_deadline_label",
            "escalation_level",
            "escalation_level_label",
            "ownership_reason",
            "safe_to_proceed",
            "stop_reasons",
            "adjusted_sla_state",
            "adaptive_deadline",
            "sla_explanation",
        }
        self.assertEqual(set(result.keys()), expected_top_level_keys)


# ---------------------------------------------------------------------------
# label_behavior_signals — Dutch label mapping
# ---------------------------------------------------------------------------

from contracts.provider_metrics import label_behavior_signals


class LabelBehaviorSignalsReturnsLabelsTest(TestCase):
    """Noteworthy signal values produce matching Dutch labels."""

    def test_fast_response_returns_label(self):
        signals = {"response_speed": "fast", "acceptance_pattern": None, "capacity_pattern": None, "intake_pattern": None}
        self.assertIn("Reageert snel", label_behavior_signals(signals))

    def test_slow_response_returns_label(self):
        signals = {"response_speed": "slow", "acceptance_pattern": None, "capacity_pattern": None, "intake_pattern": None}
        self.assertIn("Reageert traag", label_behavior_signals(signals))

    def test_high_acceptance_returns_label(self):
        signals = {"response_speed": None, "acceptance_pattern": "high", "capacity_pattern": None, "intake_pattern": None}
        self.assertIn("Accepteert vaak", label_behavior_signals(signals))

    def test_low_acceptance_returns_label(self):
        signals = {"response_speed": None, "acceptance_pattern": "low", "capacity_pattern": None, "intake_pattern": None}
        self.assertIn("Accepteert zelden", label_behavior_signals(signals))

    def test_stable_capacity_returns_label(self):
        signals = {"response_speed": None, "acceptance_pattern": None, "capacity_pattern": "stable", "intake_pattern": None}
        self.assertIn("Capaciteit stabiel", label_behavior_signals(signals))

    def test_limited_capacity_returns_label(self):
        signals = {"response_speed": None, "acceptance_pattern": None, "capacity_pattern": "limited", "intake_pattern": None}
        self.assertIn("Beperkte capaciteit", label_behavior_signals(signals))

    def test_often_full_capacity_returns_label(self):
        signals = {"response_speed": None, "acceptance_pattern": None, "capacity_pattern": "often_full", "intake_pattern": None}
        self.assertIn("Vaak vol", label_behavior_signals(signals))

    def test_high_intake_success_returns_label(self):
        signals = {"response_speed": None, "acceptance_pattern": None, "capacity_pattern": None, "intake_pattern": "high_success"}
        self.assertIn("Hoge intakescore", label_behavior_signals(signals))

    def test_variable_intake_returns_label(self):
        signals = {"response_speed": None, "acceptance_pattern": None, "capacity_pattern": None, "intake_pattern": "variable"}
        self.assertIn("Variabele intakeresultaten", label_behavior_signals(signals))


class LabelBehaviorSignalsNeutralValuesOmittedTest(TestCase):
    """Neutral/middle signal values (average, mixed) are NOT included in labels."""

    def test_average_response_speed_omitted(self):
        signals = {"response_speed": "average", "acceptance_pattern": None, "capacity_pattern": None, "intake_pattern": None}
        self.assertEqual(label_behavior_signals(signals), [])

    def test_mixed_acceptance_omitted(self):
        signals = {"response_speed": None, "acceptance_pattern": "mixed", "capacity_pattern": None, "intake_pattern": None}
        self.assertEqual(label_behavior_signals(signals), [])

    def test_none_values_produce_empty_list(self):
        signals = {"response_speed": None, "acceptance_pattern": None, "capacity_pattern": None, "intake_pattern": None}
        self.assertEqual(label_behavior_signals(signals), [])

    def test_empty_signals_dict_returns_empty_list(self):
        self.assertEqual(label_behavior_signals({}), [])


class LabelBehaviorSignalsMultipleSignalsTest(TestCase):
    """Multiple noteworthy signals all appear in the returned label list."""

    def test_all_noteworthy_signals_returns_all_labels(self):
        signals = {
            "response_speed": "fast",
            "acceptance_pattern": "high",
            "capacity_pattern": "stable",
            "intake_pattern": "high_success",
        }
        labels = label_behavior_signals(signals)
        self.assertIn("Reageert snel", labels)
        self.assertIn("Accepteert vaak", labels)
        self.assertIn("Capaciteit stabiel", labels)
        self.assertIn("Hoge intakescore", labels)
        self.assertEqual(len(labels), 4)

    def test_mixed_noteworthy_and_neutral_returns_only_noteworthy(self):
        signals = {
            "response_speed": "average",       # neutral — omitted
            "acceptance_pattern": "low",        # noteworthy
            "capacity_pattern": "often_full",   # noteworthy
            "intake_pattern": None,             # no data — omitted
        }
        labels = label_behavior_signals(signals)
        self.assertIn("Accepteert zelden", labels)
        self.assertIn("Vaak vol", labels)
        self.assertEqual(len(labels), 2)

    def test_return_type_is_list(self):
        signals = {"response_speed": "fast", "acceptance_pattern": None, "capacity_pattern": None, "intake_pattern": None}
        self.assertIsInstance(label_behavior_signals(signals), list)
