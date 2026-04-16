from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from contracts.models import (
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    ProviderProfile,
)
from contracts.provider_metrics import calculate_provider_behavior_modifier
from contracts.views import _build_matching_suggestions_for_intake


class AdaptiveMatchingBehaviorRegressionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="adaptive_match_user",
            email="adaptive_match@example.com",
            password="testpass123",
        )
        self.organization = Organization.objects.create(
            name="Adaptive Matching Org",
            slug="adaptive-matching-org",
        )

    def _make_intake(self, **kwargs):
        defaults = dict(
            organization=self.organization,
            title="Adaptive Matching Intake",
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date="2026-04-10",
            target_completion_date="2026-04-20",
            case_coordinator=self.user,
        )
        defaults.update(kwargs)
        return CaseIntakeProcess.objects.create(**defaults)

    def _make_profile(self, **kwargs):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name=kwargs.pop("name", "Adaptive Provider"),
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        defaults = dict(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=2,
            max_capacity=5,
            average_wait_days=10,
        )
        defaults.update(kwargs)
        return ProviderProfile.objects.create(**defaults)

    def _profiles_queryset(self, *profiles):
        return (
            ProviderProfile.objects
            .filter(pk__in=[profile.pk for profile in profiles])
            .order_by("pk")
            .select_related("client")
            .prefetch_related("target_care_categories")
        )

    @patch("contracts.views.calculate_provider_behavior_modifier")
    def test_nearly_equal_base_fit_can_be_reordered_by_behavior(self, modifier_mock):
        intake = self._make_intake()
        provider_a = self._make_profile(name="Near Equal A")
        provider_b = self._make_profile(name="Near Equal B")

        modifier_mock.side_effect = [-0.15, 0.15]
        results = _build_matching_suggestions_for_intake(
            intake,
            self._profiles_queryset(provider_a, provider_b),
            limit=5,
        )

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["provider_name"], "Near Equal B")
        self.assertLessEqual(results[0]["match_score"] - results[1]["match_score"], 3.0)

    @patch("contracts.views.calculate_provider_behavior_modifier")
    def test_large_base_fit_gap_is_not_aggressively_flipped(self, modifier_mock):
        intake = self._make_intake()
        provider_a = self._make_profile(
            name="Clearly Better Fit",
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=6,
            average_wait_days=7,
        )
        provider_b = self._make_profile(
            name="Operationally Stronger But Worse Fit",
            offers_outpatient=False,
            handles_medium_urgency=False,
            current_capacity=6,
            max_capacity=6,
            average_wait_days=45,
        )

        modifier_mock.side_effect = [-0.15, 0.15]
        results = _build_matching_suggestions_for_intake(
            intake,
            self._profiles_queryset(provider_a, provider_b),
            limit=5,
        )

        self.assertEqual(results[0]["provider_name"], "Clearly Better Fit")

    def test_sparse_history_modifier_remains_near_neutral(self):
        modifier = calculate_provider_behavior_modifier(
            {
                "avg_response_time_hours": 8,
                "acceptance_rate": 0.9,
                "no_capacity_rate": 0.0,
                "waitlist_rate": 0.0,
                "intake_success_rate": 0.9,
                "total_cases": 1,
            }
        )
        self.assertLess(abs(modifier), 0.03)

    def test_high_no_capacity_waitlist_reduces_strength_modestly(self):
        modifier = calculate_provider_behavior_modifier(
            {
                "avg_response_time_hours": 60,
                "acceptance_rate": 0.35,
                "no_capacity_rate": 0.60,
                "waitlist_rate": 0.35,
                "intake_success_rate": 0.45,
                "total_cases": 40,
            }
        )
        self.assertLess(modifier, 0.0)
        self.assertGreaterEqual(modifier, -0.15)

    def test_strong_response_and_intake_patterns_improve_strength_modestly(self):
        modifier = calculate_provider_behavior_modifier(
            {
                "avg_response_time_hours": 10,
                "acceptance_rate": 0.85,
                "no_capacity_rate": 0.05,
                "waitlist_rate": 0.03,
                "intake_success_rate": 0.82,
                "total_cases": 40,
            }
        )
        self.assertGreater(modifier, 0.0)
        self.assertLessEqual(modifier, 0.15)

    @patch("contracts.views.calculate_provider_behavior_modifier")
    def test_behavior_never_excludes_provider_by_itself(self, modifier_mock):
        intake = self._make_intake()
        provider_a = self._make_profile(name="Excluded By Behavior A")
        provider_b = self._make_profile(name="Excluded By Behavior B")

        modifier_mock.side_effect = [-0.15, 0.15]
        results = _build_matching_suggestions_for_intake(
            intake,
            self._profiles_queryset(provider_a, provider_b),
            limit=5,
        )

        names = {row["provider_name"] for row in results}
        self.assertIn("Excluded By Behavior A", names)
        self.assertIn("Excluded By Behavior B", names)

    @patch("contracts.views.calculate_provider_behavior_modifier")
    def test_matching_explainability_reflects_behavioral_influence_when_present(self, modifier_mock):
        intake = self._make_intake()
        provider_a = self._make_profile(name="Explainability A")
        provider_b = self._make_profile(name="Explainability B")

        modifier_mock.side_effect = [-0.15, 0.15]
        results = _build_matching_suggestions_for_intake(
            intake,
            self._profiles_queryset(provider_a, provider_b),
            limit=5,
        )

        self.assertTrue(
            any(
                any(
                    "Behavioral reliability slightly strengthened this recommendation" in note
                    for note in row["explanation"].get("behavior_influence", [])
                )
                for row in results
            )
        )

    def test_legacy_partial_data_does_not_break_modifier(self):
        modifier = calculate_provider_behavior_modifier(
            {
                "acceptance_rate": None,
                "no_capacity_rate": 0.2,
                # waitlist_rate intentionally missing
                "intake_success_rate": None,
                # avg_response_time_hours intentionally missing
                "total_cases": 3,
            }
        )
        self.assertIsInstance(modifier, float)
        self.assertGreaterEqual(modifier, -0.15)
        self.assertLessEqual(modifier, 0.15)

    @patch("contracts.views.calculate_provider_behavior_modifier")
    def test_mixed_scenario_close_gap_reliable_provider_can_edge_ahead(self, modifier_mock):
        intake = self._make_intake()
        # Near-equal base fit; behavior can decide close calls.
        provider_a = self._make_profile(
            name="Near Equal Fit Poor Ops",
            current_capacity=2,
            max_capacity=5,
            average_wait_days=10,
        )
        provider_b = self._make_profile(
            name="Near Equal Fit Reliable Ops",
            current_capacity=2,
            max_capacity=5,
            average_wait_days=10,
        )

        modifier_mock.side_effect = [-0.15, 0.15]
        results = _build_matching_suggestions_for_intake(
            intake,
            self._profiles_queryset(provider_a, provider_b),
            limit=5,
        )

        self.assertEqual(results[0]["provider_name"], "Near Equal Fit Reliable Ops")

    @patch("contracts.views.calculate_provider_behavior_modifier")
    def test_control_scenario_clearly_better_fit_stays_ahead(self, modifier_mock):
        intake = self._make_intake()
        provider_a = self._make_profile(
            name="Control Clearly Better Fit",
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=6,
            average_wait_days=7,
        )
        provider_b = self._make_profile(
            name="Control Operationally Better But Weaker Fit",
            offers_outpatient=False,
            handles_medium_urgency=False,
            current_capacity=2,
            max_capacity=5,
            average_wait_days=20,
        )

        modifier_mock.side_effect = [-0.15, 0.15]
        results = _build_matching_suggestions_for_intake(
            intake,
            self._profiles_queryset(provider_a, provider_b),
            limit=5,
        )

        self.assertEqual(results[0]["provider_name"], "Control Clearly Better Fit")

    @patch("contracts.views.calculate_provider_behavior_modifier")
    def test_modifier_range_and_ranking_are_stable_across_repeated_runs(self, modifier_mock):
        intake = self._make_intake()
        provider_a = self._make_profile(name="Stable A")
        provider_b = self._make_profile(name="Stable B")
        profiles = self._profiles_queryset(provider_a, provider_b)

        modifier_mock.side_effect = [0.12, -0.12, 0.12, -0.12]
        first = _build_matching_suggestions_for_intake(intake, profiles, limit=5)
        second = _build_matching_suggestions_for_intake(intake, profiles, limit=5)

        self.assertEqual(
            [row["provider_name"] for row in first],
            [row["provider_name"] for row in second],
        )
        for row in first + second:
            # match_score itself is 0..100, but should remain valid and deterministic.
            self.assertGreaterEqual(row["match_score"], 0)
            self.assertLessEqual(row["match_score"], 100)
