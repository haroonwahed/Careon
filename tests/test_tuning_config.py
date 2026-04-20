"""Deterministic tests for the Threshold Tuning Config layer.

Tests verify:
1. Default threshold values are returned when no SystemPolicyConfig rows exist.
2. The full registry contains all expected keys.
3. Changing a threshold via SystemPolicyConfig produces the expected signal change.
4. Core NBA sequencing is not broken by threshold changes.
5. Extended observability builders (noisy rules, FP signals, etc.) return correct structure.
6. Tuning summary view returns 200 for staff and 403 for non-staff.
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from contracts.models import (
    CaseIntakeProcess,
    Client as CareProvider,
    OperationalAlert,
    Organization,
    OrganizationMembership,
    ProviderEvaluation,
    SystemPolicyConfig,
)
from contracts.tuning_config import (
    THRESHOLD_REGISTRY,
    build_threshold_summary,
    get_threshold,
    get_thresholds,
)
from contracts.case_intelligence import (
    detect_risk_signals,
    evaluate_case_intelligence,
)
from contracts.provider_outcome_aggregates import (
    build_provider_evaluation_aggregates,
    build_regiekamer_provider_health,
    derive_evaluation_signals,
)
from contracts.observability import (
    build_noisy_rules_report,
    build_false_positive_signals_report,
    build_low_confidence_accepted_report,
    build_top_overridden_rules_report,
    build_tuning_observability_report,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TODAY = date(2026, 4, 20)


def _base_case_data(**overrides):
    base = {
        "phase": "MATCHING",
        "care_category": "GGZ",
        "urgency": "MEDIUM",
        "assessment_complete": True,
        "matching_run_exists": True,
        "top_match_confidence": "high",
        "top_match_has_capacity_issue": False,
        "top_match_wait_days": 10,
        "selected_provider_id": 1,
        "placement_status": None,
        "placement_updated_at": None,
        "rejected_provider_count": 0,
        "open_signal_count": 0,
        "open_task_count": 0,
        "case_updated_at": TODAY,
        "candidate_suggestions": [
            {"provider_id": 1, "confidence": "high", "has_capacity_issue": False, "wait_days": 10},
        ],
        "now": TODAY,
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


def _make_org_user(suffix=""):
    user = User.objects.create_user(username=f"tuning_user{suffix}", password="testpass")
    org = Organization.objects.create(name=f"Tuning Org{suffix}", slug=f"tuning-org{suffix}")
    OrganizationMembership.objects.create(
        organization=org, user=user,
        role=OrganizationMembership.Role.OWNER, is_active=True,
    )
    return user, org


def _make_provider(org, user, name="Test Provider"):
    return CareProvider.objects.create(
        organization=org, name=name,
        status=CareProvider.Status.ACTIVE, created_by=user,
    )


def _make_intake(org, user, urgency=CaseIntakeProcess.Urgency.MEDIUM):
    return CaseIntakeProcess.objects.create(
        organization=org,
        title="Tuning Test Casus",
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=urgency,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=14),
        case_coordinator=user,
        assessment_summary="Test samenvatting",
        client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
    )


# ---------------------------------------------------------------------------
# Tests: registry structure
# ---------------------------------------------------------------------------

class TuningRegistryStructureTests(TestCase):
    """Validates the registry contains all expected keys and metadata."""

    EXPECTED_KEYS = {
        "LONG_WAIT_DAYS_THRESHOLD",
        "PLACEMENT_STALL_DAYS",
        "PROVIDER_RESPONSE_DELAYED_DAYS",
        "PROVIDER_NOT_RESPONDING_DAYS",
        "PROVIDER_NOT_RESPONDING_OVERDUE_DAYS",
        "HIGH_URGENCY_RESPONSE_DELAY_DAYS",
        "STALE_CASE_DAYS",
        "MIN_EVALUATIONS_SUFFICIENT",
        "LOW_ACCEPTANCE_THRESHOLD",
        "VERY_LOW_ACCEPTANCE_THRESHOLD",
        "HIGH_REJECTION_THRESHOLD",
        "HIGH_NEEDS_INFO_THRESHOLD",
        "HIGH_CAPACITY_FLAG_THRESHOLD",
        "CAPACITY_LIMITED_BAND",
        "REGIEKAMER_MIN_EVALUATIONS",
        "PENALTY_LOW_ACCEPTANCE",
        "PENALTY_VERY_LOW_ACCEPTANCE",
        "BOUNCING_CASE_MIN_EVALUATIONS",
    }

    def test_all_expected_keys_present(self):
        for key in self.EXPECTED_KEYS:
            self.assertIn(key, THRESHOLD_REGISTRY, f"Missing key: {key}")

    def test_each_entry_has_required_metadata(self):
        for key, meta in THRESHOLD_REGISTRY.items():
            for field in ("default", "type", "label", "description", "affected_modules", "affected_reports"):
                self.assertIn(field, meta, f"{key} missing metadata field: {field}")

    def test_all_types_are_int_or_float(self):
        for key, meta in THRESHOLD_REGISTRY.items():
            self.assertIn(meta["type"], {"int", "float"}, f"{key} has invalid type: {meta['type']}")

    def test_default_values_match_type(self):
        for key, meta in THRESHOLD_REGISTRY.items():
            default = meta["default"]
            if meta["type"] == "int":
                self.assertIsInstance(default, int, f"{key} default is not int")
            elif meta["type"] == "float":
                self.assertIsInstance(default, float, f"{key} default is not float")


# ---------------------------------------------------------------------------
# Tests: get_threshold / get_thresholds defaults (no DB override)
# ---------------------------------------------------------------------------

class TuningGetThresholdDefaultTests(TestCase):
    """Verifies default values are returned when no SystemPolicyConfig override exists."""

    def test_get_threshold_returns_default_for_long_wait(self):
        val = get_threshold("LONG_WAIT_DAYS_THRESHOLD")
        self.assertEqual(val, 28)

    def test_get_threshold_returns_default_for_stall_days(self):
        self.assertEqual(get_threshold("PLACEMENT_STALL_DAYS"), 7)

    def test_get_threshold_returns_default_for_penalty(self):
        self.assertAlmostEqual(get_threshold("PENALTY_LOW_ACCEPTANCE"), 0.10)

    def test_get_threshold_unknown_key_returns_none(self):
        result = get_threshold("UNKNOWN_KEY_THAT_DOES_NOT_EXIST")
        self.assertIsNone(result)

    def test_get_thresholds_batch_returns_all_defaults(self):
        keys = ["LONG_WAIT_DAYS_THRESHOLD", "PLACEMENT_STALL_DAYS", "STALE_CASE_DAYS"]
        result = get_thresholds(*keys)
        self.assertEqual(result["LONG_WAIT_DAYS_THRESHOLD"], 28)
        self.assertEqual(result["PLACEMENT_STALL_DAYS"], 7)
        self.assertEqual(result["STALE_CASE_DAYS"], 10)

    def test_get_thresholds_empty_returns_empty_dict(self):
        self.assertEqual(get_thresholds(), {})


# ---------------------------------------------------------------------------
# Tests: build_threshold_summary
# ---------------------------------------------------------------------------

class TuningBuildThresholdSummaryTests(TestCase):
    """Validates the full summary builder output."""

    def test_returns_list_of_dicts(self):
        rows = build_threshold_summary()
        self.assertIsInstance(rows, list)
        self.assertGreater(len(rows), 0)

    def test_each_row_has_required_fields(self):
        rows = build_threshold_summary()
        required = {"key", "label", "description", "type", "default_value", "resolved_value", "is_overridden"}
        for row in rows:
            self.assertTrue(required.issubset(row.keys()), f"Row missing fields: {row.get('key')}")

    def test_no_rows_marked_overridden_by_default(self):
        rows = build_threshold_summary()
        overridden = [r for r in rows if r["is_overridden"]]
        self.assertEqual(overridden, [])

    def test_overridden_row_detected_when_policy_set(self):
        SystemPolicyConfig.objects.create(
            key="LONG_WAIT_DAYS_THRESHOLD",
            value=21,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        rows = build_threshold_summary()
        overridden = {r["key"]: r for r in rows if r["is_overridden"]}
        self.assertIn("LONG_WAIT_DAYS_THRESHOLD", overridden)
        self.assertEqual(overridden["LONG_WAIT_DAYS_THRESHOLD"]["resolved_value"], 21)
        self.assertEqual(overridden["LONG_WAIT_DAYS_THRESHOLD"]["default_value"], 28)


# ---------------------------------------------------------------------------
# Tests: threshold change → signal change (case_intelligence)
# ---------------------------------------------------------------------------

class TuningSignalThresholdChangeTests(TestCase):
    """Verifies that changing a threshold produces expected signal changes."""

    def tearDown(self):
        SystemPolicyConfig.objects.all().delete()

    def test_long_wait_threshold_24_triggers_signal_at_25_days(self):
        """Lower the long-wait threshold: 25-day wait should now trigger long_wait_risk."""
        SystemPolicyConfig.objects.create(
            key="LONG_WAIT_DAYS_THRESHOLD",
            value=24,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        case_data = _base_case_data(top_match_wait_days=25)
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertIn("long_wait_risk", signal_codes)

    def test_default_long_wait_threshold_28_no_signal_at_25_days(self):
        """Default threshold 28: 25-day wait should NOT trigger long_wait_risk."""
        case_data = _base_case_data(top_match_wait_days=25)
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertNotIn("long_wait_risk", signal_codes)

    def test_stall_days_threshold_5_triggers_stall_signal_at_6_days(self):
        """Lower stall threshold to 5 days: 6-day stall should trigger placement_stalled."""
        SystemPolicyConfig.objects.create(
            key="PLACEMENT_STALL_DAYS",
            value=5,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        case_data = _base_case_data(
            placement_status="IN_REVIEW",
            placement_updated_at=TODAY - timedelta(days=6),
        )
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertIn("placement_stalled", signal_codes)

    def test_default_stall_threshold_7_no_signal_at_6_days(self):
        """Default threshold 7: 6-day stall should NOT trigger placement_stalled."""
        case_data = _base_case_data(
            placement_status="IN_REVIEW",
            placement_updated_at=TODAY - timedelta(days=6),
        )
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertNotIn("placement_stalled", signal_codes)

    def test_stale_case_threshold_5_triggers_signal_at_6_days(self):
        """Lower stale-case threshold to 5: 6-day stale case should trigger stale_case."""
        SystemPolicyConfig.objects.create(
            key="STALE_CASE_DAYS",
            value=5,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        case_data = _base_case_data(case_updated_at=TODAY - timedelta(days=6))
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertIn("stale_case", signal_codes)

    def test_default_stale_case_threshold_10_no_signal_at_6_days(self):
        """Default threshold 10: 6-day stale case should NOT trigger stale_case."""
        case_data = _base_case_data(case_updated_at=TODAY - timedelta(days=6))
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertNotIn("stale_case", signal_codes)

    def test_response_delayed_threshold_2_triggers_signal_at_2_days(self):
        """Lower response-delayed threshold to 2: 2 days should trigger the signal."""
        SystemPolicyConfig.objects.create(
            key="PROVIDER_RESPONSE_DELAYED_DAYS",
            value=2,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        case_data = _base_case_data(
            provider_response_status="PENDING",
            provider_response_requested_at=TODAY - timedelta(days=2),
        )
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertIn("provider_response_delayed", signal_codes)

    def test_default_response_delayed_threshold_3_no_signal_at_2_days(self):
        """Default threshold 3: 2 days should NOT trigger provider_response_delayed."""
        case_data = _base_case_data(
            provider_response_status="PENDING",
            provider_response_requested_at=TODAY - timedelta(days=2),
        )
        signals = detect_risk_signals(case_data)
        signal_codes = {s["code"] for s in signals}
        self.assertNotIn("provider_response_delayed", signal_codes)


# ---------------------------------------------------------------------------
# Tests: threshold change → penalty change (provider_outcome_aggregates)
# ---------------------------------------------------------------------------

class TuningPenaltyThresholdChangeTests(TestCase):
    """Verifies that outcome-aggregate penalty thresholds respond to config changes."""

    def tearDown(self):
        SystemPolicyConfig.objects.all().delete()

    def _make_agg(self, acceptance_rate, rejection_rate, total=10):
        return {
            "total_evaluations": total,
            "acceptance_count": round(acceptance_rate * total),
            "rejection_count": round(rejection_rate * total),
            "needs_more_info_count": 0,
            "acceptance_rate": acceptance_rate,
            "rejection_rate": rejection_rate,
            "needs_more_info_rate": 0.0,
            "top_rejection_reasons": [],
            "capacity_flag_count": 0,
            "capacity_reliability_signal": "stable",
            "evidence_level": "sufficient",
        }

    def test_default_very_low_acceptance_threshold_applies_heavy_penalty(self):
        """acceptance_rate=0.15 < 0.20 → heavy penalty (0.20)."""
        agg = self._make_agg(0.15, 0.85)
        signals = derive_evaluation_signals(agg)
        self.assertAlmostEqual(signals["confidence_penalty"], 0.20)
        self.assertIn("evaluation_very_low_acceptance", signals["warning_flags"])

    def test_raising_very_low_acceptance_threshold_removes_heavy_penalty(self):
        """Raise VERY_LOW_ACCEPTANCE_THRESHOLD to 0.10; acceptance_rate=0.15 now only light penalty."""
        SystemPolicyConfig.objects.create(
            key="VERY_LOW_ACCEPTANCE_THRESHOLD",
            value="0.10",
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        agg = self._make_agg(0.15, 0.85)
        signals = derive_evaluation_signals(agg)
        # 0.15 > 0.10 so only light penalty now (LOW_ACCEPTANCE_THRESHOLD = 0.40)
        self.assertAlmostEqual(signals["confidence_penalty"], 0.10, places=2)
        self.assertNotIn("evaluation_very_low_acceptance", signals["warning_flags"])

    def test_lowering_high_rejection_threshold_adds_warning_flag(self):
        """Lower HIGH_REJECTION_THRESHOLD to 0.40; rejection_rate=0.50 now triggers warning."""
        SystemPolicyConfig.objects.create(
            key="HIGH_REJECTION_THRESHOLD",
            value="0.40",
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        agg = self._make_agg(0.50, 0.50)
        signals = derive_evaluation_signals(agg)
        self.assertIn("evaluation_high_rejection_rate", signals["warning_flags"])

    def test_default_high_rejection_threshold_no_flag_at_50_pct(self):
        """Default threshold 0.60: rejection_rate=0.50 should NOT trigger warning."""
        agg = self._make_agg(0.50, 0.50)
        signals = derive_evaluation_signals(agg)
        self.assertNotIn("evaluation_high_rejection_rate", signals["warning_flags"])


# ---------------------------------------------------------------------------
# Tests: core NBA sequencing not broken by threshold changes
# ---------------------------------------------------------------------------

class TuningNBASequencingTests(TestCase):
    """Core NBA ordering must remain valid even when thresholds are changed."""

    def tearDown(self):
        SystemPolicyConfig.objects.all().delete()

    def test_missing_info_always_wins_over_long_wait_regardless_of_threshold(self):
        """fill_missing_information must override long_wait_risk even with a low wait threshold."""
        SystemPolicyConfig.objects.create(
            key="LONG_WAIT_DAYS_THRESHOLD",
            value=1,  # very aggressive: any wait triggers signal
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        case_data = _base_case_data(
            care_category=None,    # missing → fill_missing_information
            top_match_wait_days=5,
        )
        result = evaluate_case_intelligence(case_data)
        self.assertEqual(result["next_best_action"]["code"], "fill_missing_information")

    def test_provider_reject_routes_to_run_matching_regardless_of_stall_threshold(self):
        """run_matching after rejection must not be affected by stall threshold changes."""
        SystemPolicyConfig.objects.create(
            key="PLACEMENT_STALL_DAYS",
            value=1,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        case_data = _base_case_data(provider_evaluation_nba_code="provider_rejected")
        result = evaluate_case_intelligence(case_data)
        self.assertEqual(result["next_best_action"]["code"], "run_matching")

    def test_monitor_returned_for_clean_case_even_after_raising_wait_threshold(self):
        """A clean case should still yield monitor when no thresholds are breached."""
        SystemPolicyConfig.objects.create(
            key="LONG_WAIT_DAYS_THRESHOLD",
            value=100,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        case_data = _base_case_data(top_match_wait_days=50)
        result = evaluate_case_intelligence(case_data)
        self.assertEqual(result["next_best_action"]["code"], "monitor")


# ---------------------------------------------------------------------------
# Tests: extended observability builders
# ---------------------------------------------------------------------------

class TuningExtendedObservabilityTests(TestCase):
    """Tests that verify structure and basic correctness of the 4 new builders."""

    def setUp(self):
        self.user, self.org = _make_org_user("_obs")
        self.provider = _make_provider(self.org, self.user)

    def _make_intake_local(self):
        return _make_intake(self.org, self.user)

    def test_noisy_rules_empty_for_new_org(self):
        report = build_noisy_rules_report(self.org)
        self.assertFalse(report["data_available"])
        self.assertEqual(report["alert_type_counts"], [])

    def test_noisy_rules_counts_alerts_correctly(self):
        intake = self._make_intake_local()
        OperationalAlert.objects.create(
            case=intake,
            alert_type=OperationalAlert.AlertType.WEAK_MATCH_NEEDS_REVIEW,
            severity=OperationalAlert.Severity.MEDIUM,
            title="Test alert",
            description="desc",
            recommended_action="action",
        )
        report = build_noisy_rules_report(self.org)
        self.assertTrue(report["data_available"])
        self.assertEqual(report["alert_type_counts"][0]["total_fired"], 1)

    def test_noisy_rules_resolved_alert_counted_as_noise(self):
        from django.utils import timezone
        intake = self._make_intake_local()
        OperationalAlert.objects.create(
            case=intake,
            alert_type=OperationalAlert.AlertType.PLACEMENT_STALLED,
            severity=OperationalAlert.Severity.HIGH,
            title="Stalled",
            description="desc",
            recommended_action="act",
            resolved_at=timezone.now(),
        )
        report = build_noisy_rules_report(self.org)
        row = next((r for r in report["alert_type_counts"] if r["alert_type"] == "placement_stalled"), None)
        self.assertIsNotNone(row)
        self.assertEqual(row["resolved_without_block"], 1)

    def test_false_positive_report_empty_when_no_accepts(self):
        report = build_false_positive_signals_report(self.org)
        self.assertFalse(report["data_available"])

    def test_false_positive_report_counts_alert_with_accept(self):
        intake = self._make_intake_local()
        OperationalAlert.objects.create(
            case=intake,
            alert_type=OperationalAlert.AlertType.WEAK_MATCH_NEEDS_REVIEW,
            severity=OperationalAlert.Severity.MEDIUM,
            title="Weak",
            description="desc",
            recommended_action="act",
        )
        ProviderEvaluation.objects.create(
            case=intake,
            provider=self.provider,
            decision=ProviderEvaluation.Decision.ACCEPT,
        )
        report = build_false_positive_signals_report(self.org)
        self.assertTrue(report["data_available"])
        row = next((r for r in report["by_alert_type"] if r["alert_type"] == "weak_match_needs_review"), None)
        self.assertIsNotNone(row)
        self.assertEqual(row["fp_count"], 1)

    def test_low_confidence_accepted_empty_when_no_weak_match_alerts(self):
        report = build_low_confidence_accepted_report(self.org)
        self.assertFalse(report["data_available"])

    def test_low_confidence_accepted_detects_fp(self):
        intake = self._make_intake_local()
        OperationalAlert.objects.create(
            case=intake,
            alert_type="weak_match_needs_review",
            severity=OperationalAlert.Severity.MEDIUM,
            title="Weak match",
            description="desc",
            recommended_action="act",
        )
        ProviderEvaluation.objects.create(
            case=intake,
            provider=self.provider,
            decision=ProviderEvaluation.Decision.ACCEPT,
        )
        report = build_low_confidence_accepted_report(self.org)
        self.assertTrue(report["data_available"])
        self.assertEqual(report["count"], 1)
        self.assertEqual(report["total_weak_match"], 1)
        self.assertAlmostEqual(report["false_positive_rate"], 1.0)

    def test_top_overridden_rules_empty_for_no_overrides(self):
        report = build_top_overridden_rules_report(self.org)
        self.assertFalse(report["data_available"])

    def test_tuning_observability_report_structure(self):
        report = build_tuning_observability_report(self.org)
        self.assertIn("noisy_rules", report)
        self.assertIn("false_positive_signals", report)
        self.assertIn("low_confidence_accepted", report)
        self.assertIn("top_overridden_rules", report)


# ---------------------------------------------------------------------------
# Tests: tuning_summary view
# ---------------------------------------------------------------------------

class TuningSummaryViewTests(TestCase):
    """Tests that the tuning admin view is accessible and secured."""

    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="staff_tuning", password="test", is_staff=True
        )
        self.regular_user = User.objects.create_user(
            username="regular_tuning", password="test", is_staff=False
        )
        org = Organization.objects.create(name="View Test Org", slug="view-test-org")
        OrganizationMembership.objects.create(
            organization=org, user=self.staff_user,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=org, user=self.regular_user,
            role=OrganizationMembership.Role.MEMBER, is_active=True,
        )

    def test_tuning_view_403_for_non_staff(self):
        self.client.login(username="regular_tuning", password="test")
        response = self.client.get(reverse("careon:tuning_summary"))
        self.assertEqual(response.status_code, 403)

    def test_tuning_view_200_for_staff(self):
        self.client.login(username="staff_tuning", password="test")
        response = self.client.get(reverse("careon:tuning_summary"))
        self.assertEqual(response.status_code, 200)

    def test_tuning_view_json_export_200_for_staff(self):
        self.client.login(username="staff_tuning", password="test")
        response = self.client.get(reverse("careon:tuning_summary") + "?format=json")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("thresholds", data)
        self.assertIn("tuning_report", data)

    def test_tuning_view_unauthenticated_redirects(self):
        response = self.client.get(reverse("careon:tuning_summary"))
        # Unauthenticated → redirect to login
        self.assertIn(response.status_code, [302, 403])
