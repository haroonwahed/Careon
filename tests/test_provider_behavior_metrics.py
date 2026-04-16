"""Tests for contracts.provider_metrics behavior metrics and modifier.

Covers:
- Metrics aggregation defaults and edge cases
- Response rate and response-time calculations
- Intake success calculation and legacy alias handling
- Provider isolation in aggregation
- Soft behavior modifier bounds and neutrality with sparse history
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from contracts.models import (
	CaseIntakeProcess,
	Client as CareProvider,
	Organization,
	OrganizationMembership,
	PlacementRequest,
)
from contracts.provider_metrics import (
	build_provider_behavior_metrics,
	calculate_provider_behavior_modifier,
	describe_behavior_influence,
)


class ProviderBehaviorMetricsBaseTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="metrics_user",
			email="metrics@example.com",
			password="testpass123",
		)
		self.organization = Organization.objects.create(
			name="Metrics Org",
			slug="metrics-org",
		)
		OrganizationMembership.objects.create(
			organization=self.organization,
			user=self.user,
			role=OrganizationMembership.Role.OWNER,
			is_active=True,
		)
		self.provider = CareProvider.objects.create(
			organization=self.organization,
			name="Metrics Provider",
			status=CareProvider.Status.ACTIVE,
			created_by=self.user,
		)
		self.other_provider = CareProvider.objects.create(
			organization=self.organization,
			name="Other Provider",
			status=CareProvider.Status.ACTIVE,
			created_by=self.user,
		)

	def _create_intake(self, *, title="Test Case", intake_outcome_status=None):
		intake = CaseIntakeProcess.objects.create(
			organization=self.organization,
			title=title,
			status=CaseIntakeProcess.ProcessStatus.MATCHING,
			urgency=CaseIntakeProcess.Urgency.MEDIUM,
			preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
			preferred_region_type="GEMEENTELIJK",
			start_date=date.today(),
			target_completion_date=date.today() + timedelta(days=7),
			case_coordinator=self.user,
		)
		if intake_outcome_status is not None:
			intake.intake_outcome_status = intake_outcome_status
			intake.save()
		return intake

	def _create_placement(
		self,
		intake,
		*,
		provider=None,
		response_status=PlacementRequest.ProviderResponseStatus.PENDING,
		requested_hours_ago=None,
		recorded_hours_after_request=None,
	):
		provider = provider or self.provider
		requested_at = None
		recorded_at = None
		if requested_hours_ago is not None:
			requested_at = timezone.now() - timedelta(hours=requested_hours_ago)
			if recorded_hours_after_request is not None:
				recorded_at = requested_at + timedelta(hours=recorded_hours_after_request)

		return PlacementRequest.objects.create(
			due_diligence_process=intake,
			status=PlacementRequest.Status.IN_REVIEW,
			proposed_provider=provider,
			selected_provider=provider,
			care_form=intake.preferred_care_form,
			provider_response_status=response_status,
			provider_response_requested_at=requested_at,
			provider_response_recorded_at=recorded_at,
		)


class TestProviderBehaviorMetricsEdgeCases(ProviderBehaviorMetricsBaseTests):
	def test_none_provider_id_returns_empty_defaults(self):
		metrics = build_provider_behavior_metrics(None)
		self.assertEqual(metrics["total_cases"], 0)
		self.assertIsNone(metrics["avg_response_time_hours"])
		self.assertIsNone(metrics["acceptance_rate"])
		self.assertIsNone(metrics["no_capacity_rate"])
		self.assertIsNone(metrics["waitlist_rate"])
		self.assertIsNone(metrics["intake_success_rate"])

	def test_unknown_provider_id_returns_empty_defaults(self):
		metrics = build_provider_behavior_metrics(999999)
		self.assertEqual(metrics["total_cases"], 0)
		self.assertIsNone(metrics["acceptance_rate"])

	def test_provider_with_only_pending_cases_returns_none_rates(self):
		intake = self._create_intake()
		self._create_placement(intake, response_status=PlacementRequest.ProviderResponseStatus.PENDING)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertEqual(metrics["total_cases"], 1)
		self.assertIsNone(metrics["acceptance_rate"])
		self.assertIsNone(metrics["no_capacity_rate"])
		self.assertIsNone(metrics["waitlist_rate"])
		self.assertIsNone(metrics["intake_success_rate"])
		self.assertIsNone(metrics["avg_response_time_hours"])

	def test_return_dict_has_all_required_keys(self):
		metrics = build_provider_behavior_metrics(None)
		expected_keys = {
			"avg_response_time_hours",
			"acceptance_rate",
			"no_capacity_rate",
			"waitlist_rate",
			"intake_success_rate",
			"total_cases",
		}
		self.assertEqual(set(metrics.keys()), expected_keys)


class TestProviderBehaviorMetricsResponseRates(ProviderBehaviorMetricsBaseTests):
	def test_acceptance_rate_calculated_correctly(self):
		for _ in range(2):
			self._create_placement(
				self._create_intake(),
				response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
			)
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
		)
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertEqual(metrics["total_cases"], 4)
		self.assertAlmostEqual(metrics["acceptance_rate"], 0.5, places=4)
		self.assertAlmostEqual(metrics["no_capacity_rate"], 0.25, places=4)

	def test_no_capacity_rate_only_no_capacity_cases(self):
		for _ in range(3):
			self._create_placement(
				self._create_intake(),
				response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
			)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["no_capacity_rate"], 1.0, places=4)
		self.assertAlmostEqual(metrics["acceptance_rate"], 0.0, places=4)

	def test_waitlist_rate(self):
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.WAITLIST,
		)
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["waitlist_rate"], 0.5, places=4)

	def test_pending_excluded_from_total_responses_denominator(self):
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
		)
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.PENDING,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertEqual(metrics["total_cases"], 2)
		self.assertAlmostEqual(metrics["acceptance_rate"], 1.0, places=4)

	def test_needs_info_counts_in_total_responses(self):
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
		)
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["acceptance_rate"], 0.5, places=4)


class TestProviderBehaviorMetricsResponseTime(ProviderBehaviorMetricsBaseTests):
	def test_avg_response_time_computed_from_timestamps(self):
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
			requested_hours_ago=20,
			recorded_hours_after_request=4,
		)
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
			requested_hours_ago=20,
			recorded_hours_after_request=8,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["avg_response_time_hours"], 6.0, places=1)

	def test_missing_recorded_at_excluded_from_avg(self):
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
			requested_hours_ago=10,
			recorded_hours_after_request=10,
		)
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
			requested_hours_ago=5,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["avg_response_time_hours"], 10.0, places=1)

	def test_no_timestamps_yields_none_for_avg(self):
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertIsNone(metrics["avg_response_time_hours"])

	def test_pending_status_excluded_from_avg_response_time(self):
		self._create_placement(
			self._create_intake(),
			response_status=PlacementRequest.ProviderResponseStatus.PENDING,
			requested_hours_ago=5,
			recorded_hours_after_request=5,
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertIsNone(metrics["avg_response_time_hours"])


class TestProviderBehaviorMetricsIntakeSuccess(ProviderBehaviorMetricsBaseTests):
	def test_intake_success_rate_completed_vs_accepted(self):
		intake_ok = self._create_intake(intake_outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.COMPLETED)
		intake_nok = self._create_intake(intake_outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.CANCELLED)
		self._create_placement(intake_ok, response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED)
		self._create_placement(intake_nok, response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["intake_success_rate"], 0.5, places=4)

	def test_intake_success_rate_none_when_no_accepted(self):
		intake = self._create_intake()
		self._create_placement(intake, response_status=PlacementRequest.ProviderResponseStatus.REJECTED)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertIsNone(metrics["intake_success_rate"])

	def test_intake_success_rate_full_when_all_completed(self):
		for _ in range(3):
			intake = self._create_intake(
				intake_outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.COMPLETED
			)
			self._create_placement(
				intake, response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED
			)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["intake_success_rate"], 1.0, places=4)

	def test_intake_outcome_pending_does_not_count_as_success(self):
		intake = self._create_intake(
			intake_outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.PENDING
		)
		self._create_placement(
			intake, response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["intake_success_rate"], 0.0, places=4)

	def test_no_show_intake_does_not_count_as_success(self):
		intake = self._create_intake(
			intake_outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.NO_SHOW
		)
		self._create_placement(
			intake, response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertAlmostEqual(metrics["intake_success_rate"], 0.0, places=4)


class TestProviderBehaviorMetricsLegacyAliases(ProviderBehaviorMetricsBaseTests):
	def test_declined_alias_treated_as_rejected(self):
		intake = self._create_intake()
		placement = self._create_placement(
			intake, response_status=PlacementRequest.ProviderResponseStatus.REJECTED
		)
		PlacementRequest.objects.filter(pk=placement.pk).update(
			provider_response_status="DECLINED"
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertEqual(metrics["total_cases"], 1)
		self.assertAlmostEqual(metrics["acceptance_rate"], 0.0, places=4)

	def test_no_response_alias_treated_as_pending(self):
		intake = self._create_intake()
		placement = self._create_placement(intake)
		PlacementRequest.objects.filter(pk=placement.pk).update(
			provider_response_status="NO_RESPONSE"
		)
		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertEqual(metrics["total_cases"], 1)
		self.assertIsNone(metrics["acceptance_rate"])


class TestProviderBehaviorMetricsIsolation(ProviderBehaviorMetricsBaseTests):
	def test_metrics_scoped_to_provider_not_bleed_across(self):
		intake1 = self._create_intake()
		self._create_placement(
			intake1,
			provider=self.provider,
			response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
		)
		intake2 = self._create_intake(title="Other Case")
		self._create_placement(
			intake2,
			provider=self.other_provider,
			response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
		)

		metrics_a = build_provider_behavior_metrics(self.provider.pk)
		metrics_b = build_provider_behavior_metrics(self.other_provider.pk)

		self.assertEqual(metrics_a["total_cases"], 1)
		self.assertAlmostEqual(metrics_a["acceptance_rate"], 1.0, places=4)

		self.assertEqual(metrics_b["total_cases"], 1)
		self.assertAlmostEqual(metrics_b["no_capacity_rate"], 1.0, places=4)

	def test_total_cases_reflects_all_statuses_including_pending(self):
		for status in [
			PlacementRequest.ProviderResponseStatus.PENDING,
			PlacementRequest.ProviderResponseStatus.ACCEPTED,
			PlacementRequest.ProviderResponseStatus.REJECTED,
		]:
			self._create_placement(self._create_intake(), response_status=status)

		metrics = build_provider_behavior_metrics(self.provider.pk)
		self.assertEqual(metrics["total_cases"], 3)
		self.assertAlmostEqual(metrics["acceptance_rate"], 0.5, places=4)


class TestProviderBehaviorModifier(TestCase):
	def _metrics(
		self,
		*,
		avg_response_time_hours=None,
		acceptance_rate=None,
		no_capacity_rate=None,
		waitlist_rate=None,
		intake_success_rate=None,
		total_cases=0,
	):
		return {
			"avg_response_time_hours": avg_response_time_hours,
			"acceptance_rate": acceptance_rate,
			"no_capacity_rate": no_capacity_rate,
			"waitlist_rate": waitlist_rate,
			"intake_success_rate": intake_success_rate,
			"total_cases": total_cases,
		}

	def test_modifier_is_bounded(self):
		positive = calculate_provider_behavior_modifier(
			self._metrics(
				avg_response_time_hours=4,
				acceptance_rate=1.0,
				no_capacity_rate=0.0,
				waitlist_rate=0.0,
				intake_success_rate=1.0,
				total_cases=100,
			)
		)
		negative = calculate_provider_behavior_modifier(
			self._metrics(
				avg_response_time_hours=200,
				acceptance_rate=0.0,
				no_capacity_rate=1.0,
				waitlist_rate=1.0,
				intake_success_rate=0.0,
				total_cases=100,
			)
		)
		self.assertLessEqual(positive, 0.15)
		self.assertGreaterEqual(positive, -0.15)
		self.assertLessEqual(negative, 0.15)
		self.assertGreaterEqual(negative, -0.15)

	def test_sparse_history_keeps_modifier_near_neutral(self):
		modifier = calculate_provider_behavior_modifier(
			self._metrics(
				avg_response_time_hours=8,
				acceptance_rate=0.9,
				no_capacity_rate=0.0,
				waitlist_rate=0.0,
				intake_success_rate=0.9,
				total_cases=1,
			)
		)
		self.assertLess(abs(modifier), 0.03)

	def test_reliable_operational_behavior_produces_small_positive_modifier(self):
		modifier = calculate_provider_behavior_modifier(
			self._metrics(
				avg_response_time_hours=12,
				acceptance_rate=0.82,
				no_capacity_rate=0.05,
				waitlist_rate=0.05,
				intake_success_rate=0.78,
				total_cases=40,
			)
		)
		self.assertGreater(modifier, 0.0)

	def test_frequent_capacity_friction_produces_negative_modifier(self):
		modifier = calculate_provider_behavior_modifier(
			self._metrics(
				avg_response_time_hours=60,
				acceptance_rate=0.35,
				no_capacity_rate=0.55,
				waitlist_rate=0.30,
				intake_success_rate=0.45,
				total_cases=35,
			)
		)
		self.assertLess(modifier, 0.0)

	def test_no_history_returns_neutral_modifier(self):
		modifier = calculate_provider_behavior_modifier(
			self._metrics(total_cases=0)
		)
		self.assertEqual(modifier, 0.0)


class TestDescribeBehaviorInfluence(TestCase):
	def _metrics(self, **overrides):
		base = {
			"avg_response_time_hours": None,
			"acceptance_rate": None,
			"no_capacity_rate": None,
			"waitlist_rate": None,
			"intake_success_rate": None,
			"total_cases": 0,
		}
		base.update(overrides)
		return base

	def test_limited_history_note_is_included(self):
		notes = describe_behavior_influence(self._metrics(total_cases=1))
		self.assertIn("Limited provider history, behavioral influence kept neutral", notes)

	def test_reliability_and_capacity_notes_are_human_readable(self):
		notes = describe_behavior_influence(
			self._metrics(
				avg_response_time_hours=10,
				acceptance_rate=0.75,
				no_capacity_rate=0.45,
				waitlist_rate=0.2,
				intake_success_rate=0.8,
				total_cases=20,
			)
		)
		self.assertTrue(any("Operationally reliable response pattern" in n for n in notes))
		self.assertTrue(any("Frequent no-capacity responses reduced recommendation strength" in n for n in notes))
		self.assertTrue(any("Strong intake follow-through supports recommendation" in n for n in notes))

	def test_close_call_note_only_when_applied(self):
		base_notes = describe_behavior_influence(self._metrics(total_cases=20), close_call_applied=False)
		applied_notes = describe_behavior_influence(self._metrics(total_cases=20), close_call_applied=True)
		self.assertFalse(any("slightly strengthened" in n for n in base_notes))
		self.assertTrue(any("Behavioral reliability slightly strengthened this recommendation" in n for n in applied_notes))
