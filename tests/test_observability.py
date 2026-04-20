"""Tests for the Zorg OS V3 Decision Intelligence Observability Module.

Coverage
--------
- build_confidence_calibration_report:
  - Empty when no org or no cases.
  - Correctly buckets cases with/without WEAK_MATCH alert.
  - Computes acceptance, placement success, and intake completion rates.

- build_rejection_taxonomy_report:
  - Empty when no rejections.
  - Groups by provider, care category, and overall distribution.
  - Correctly computes counts and shares.

- build_repeated_rejection_report:
  - Identifies bouncing cases (>= 2 rejections).
  - Identifies providers with repeated same reason (>= 3).
  - Returns empty safely when no data.

- build_weak_match_false_positive_report:
  - False positive rate = accepted / total_weak_match_cases.
  - True positive rate = rejected / total_weak_match_cases.
  - Returns data_available=False when no WEAK_MATCH alerts.

- build_override_tracking_report:
  - Counts overrides from DecisionQualityReview.
  - Groups by override_type and primary_reason.
  - Computes override_rate correctly.

- build_full_observability_report:
  - Returns all five sub-reports.
  - Remains safe when any sub-report encounters missing data.

- Observability view (admin/staff only):
  - Returns 403 for non-staff users.
  - Returns 200 with HTML for staff.
  - Returns 200 with JSON for ?format=json.
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    CareCategoryMain,
    CaseIntakeProcess,
    Client as CareProvider,
    DecisionQualityReview,
    OperationalAlert,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderEvaluation,
)
from contracts.observability import (
    build_confidence_calibration_report,
    build_full_observability_report,
    build_override_tracking_report,
    build_rejection_taxonomy_report,
    build_repeated_rejection_report,
    build_weak_match_false_positive_report,
)


# ---------------------------------------------------------------------------
# Fixtures helpers
# ---------------------------------------------------------------------------

def _make_org_user(username, org_name):
    user = User.objects.create_user(username=username, password='testpass123')
    org = Organization.objects.create(name=org_name, slug=org_name.lower().replace(' ', '-'))
    OrganizationMembership.objects.create(
        organization=org, user=user,
        role=OrganizationMembership.Role.OWNER, is_active=True,
    )
    return user, org


def _make_provider(org, owner, name='Aanbieder Alpha'):
    return CareProvider.objects.create(
        organization=org, name=name,
        status=CareProvider.Status.ACTIVE, created_by=owner,
    )


def _make_intake(org, owner, urgency=None, care_category=None, outcome_status=None):
    intake = CaseIntakeProcess.objects.create(
        organization=org,
        title='Test Casus',
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=urgency or CaseIntakeProcess.Urgency.MEDIUM,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=14),
        case_coordinator=owner,
        assessment_summary='Samenvatting',
        client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        care_category_main=care_category,
    )
    if outcome_status:
        intake.intake_outcome_status = outcome_status
        intake.save(update_fields=['intake_outcome_status'])
    return intake


def _make_placement(intake, provider, status=None, response_status=None):
    placement = PlacementRequest.objects.create(
        due_diligence_process=intake,
        selected_provider=provider,
        status=status or PlacementRequest.Status.DRAFT,
        provider_response_status=response_status or PlacementRequest.ProviderResponseStatus.PENDING,
    )
    return placement


def _make_evaluation(intake, provider, decision, reason_code=''):
    return ProviderEvaluation.objects.create(
        case=intake,
        provider=provider,
        decision=decision,
        reason_code=reason_code,
    )


def _make_weak_match_alert(intake):
    return OperationalAlert.objects.create(
        case=intake,
        alert_type=OperationalAlert.AlertType.WEAK_MATCH_NEEDS_REVIEW,
        severity=OperationalAlert.Severity.MEDIUM,
        title='Test weak match alert',
        description='Test',
        recommended_action='Test',
    )


# ---------------------------------------------------------------------------
# Confidence calibration
# ---------------------------------------------------------------------------

class ConfidenceCalibrationReportTests(TestCase):

    def setUp(self):
        self.user, self.org = _make_org_user('calibration_user', 'Calibration Org')
        self.provider = _make_provider(self.org, self.user)

    def test_returns_empty_dict_for_none_org(self):
        result = build_confidence_calibration_report(None)
        self.assertFalse(result['data_available'])
        self.assertEqual(result['buckets'], [])

    def test_returns_empty_when_no_cases(self):
        _, empty_org = _make_org_user('empty_user', 'Empty Org')
        result = build_confidence_calibration_report(empty_org)
        self.assertFalse(result['data_available'])

    def test_buckets_cases_with_and_without_weak_match_alert(self):
        # Case 1: has WEAK_MATCH alert, provider accepted.
        intake_weak = _make_intake(self.org, self.user)
        _make_weak_match_alert(intake_weak)
        _make_evaluation(intake_weak, self.provider, ProviderEvaluation.Decision.ACCEPT)

        # Case 2: no WEAK_MATCH alert, provider accepted.
        intake_strong = _make_intake(self.org, self.user)
        _make_evaluation(intake_strong, self.provider, ProviderEvaluation.Decision.ACCEPT)

        # Case 3: has WEAK_MATCH alert, provider rejected.
        intake_weak_reject = _make_intake(self.org, self.user)
        _make_weak_match_alert(intake_weak_reject)
        _make_evaluation(
            intake_weak_reject, self.provider, ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
        )

        result = build_confidence_calibration_report(self.org)

        self.assertTrue(result['data_available'])
        self.assertEqual(result['total_cases_analysed'], 3)
        self.assertEqual(result['total_weak_match_cases'], 2)
        self.assertEqual(len(result['buckets']), 2)

        # Locate weak bucket.
        weak_bucket = next(b for b in result['buckets'] if b['confidence_proxy'] == 'low')
        self.assertEqual(weak_bucket['total_cases'], 2)
        self.assertEqual(weak_bucket['provider_acceptance_count'], 1)
        self.assertAlmostEqual(weak_bucket['provider_acceptance_rate'], 0.5, places=3)

        # Locate strong bucket.
        strong_bucket = next(b for b in result['buckets'] if b['confidence_proxy'] == 'high_medium')
        self.assertEqual(strong_bucket['total_cases'], 1)
        self.assertEqual(strong_bucket['provider_acceptance_count'], 1)
        self.assertAlmostEqual(strong_bucket['provider_acceptance_rate'], 1.0, places=3)

    def test_placement_success_tracked(self):
        intake = _make_intake(self.org, self.user)
        _make_placement(intake, self.provider, status=PlacementRequest.Status.APPROVED)

        result = build_confidence_calibration_report(self.org)
        self.assertTrue(result['data_available'])

        strong_bucket = next(b for b in result['buckets'] if b['confidence_proxy'] == 'high_medium')
        self.assertEqual(strong_bucket['placement_success_count'], 1)

    def test_intake_completion_tracked(self):
        intake = _make_intake(
            self.org, self.user,
            outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.COMPLETED,
        )

        result = build_confidence_calibration_report(self.org)
        self.assertTrue(result['data_available'])

        strong_bucket = next(b for b in result['buckets'] if b['confidence_proxy'] == 'high_medium')
        self.assertEqual(strong_bucket['intake_completion_count'], 1)


# ---------------------------------------------------------------------------
# Rejection taxonomy
# ---------------------------------------------------------------------------

class RejectionTaxonomyReportTests(TestCase):

    def setUp(self):
        self.user, self.org = _make_org_user('taxonomy_user', 'Taxonomy Org')
        self.provider_a = _make_provider(self.org, self.user, 'Aanbieder A')
        self.provider_b = _make_provider(self.org, self.user, 'Aanbieder B')

    def test_returns_empty_for_none_org(self):
        result = build_rejection_taxonomy_report(None)
        self.assertFalse(result['data_available'])
        self.assertEqual(result['total_rejections'], 0)

    def test_returns_empty_when_no_rejections(self):
        intake = _make_intake(self.org, self.user)
        _make_evaluation(intake, self.provider_a, ProviderEvaluation.Decision.ACCEPT)

        result = build_rejection_taxonomy_report(self.org)
        self.assertFalse(result['data_available'])
        self.assertEqual(result['total_rejections'], 0)

    def test_counts_rejections_by_reason_code(self):
        intake = _make_intake(self.org, self.user)
        _make_evaluation(intake, self.provider_a, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY)
        _make_evaluation(intake, self.provider_b, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY)
        _make_evaluation(intake, self.provider_b, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH)

        result = build_rejection_taxonomy_report(self.org)
        self.assertTrue(result['data_available'])
        self.assertEqual(result['total_rejections'], 3)

        # Overall: no_capacity should appear first (count 2).
        top = result['overall_distribution'][0]
        self.assertEqual(top['reason_code'], ProviderEvaluation.RejectionCode.NO_CAPACITY)
        self.assertEqual(top['count'], 2)

    def test_by_provider_groups_correctly(self):
        intake = _make_intake(self.org, self.user)
        _make_evaluation(intake, self.provider_a, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY)
        _make_evaluation(intake, self.provider_b, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.URGENCY_NOT_SUPPORTED)

        result = build_rejection_taxonomy_report(self.org)
        provider_ids = {p['provider_id'] for p in result['by_provider']}
        self.assertIn(self.provider_a.pk, provider_ids)
        self.assertIn(self.provider_b.pk, provider_ids)

    def test_by_care_category_groups_correctly(self):
        cat = CareCategoryMain.objects.create(name='Jeugdzorg')
        intake = _make_intake(self.org, self.user, care_category=cat)
        _make_evaluation(intake, self.provider_a, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.RISK_TOO_HIGH)

        result = build_rejection_taxonomy_report(self.org)
        self.assertTrue(result['data_available'])
        cat_names = [c['care_category_name'] for c in result['by_care_category']]
        self.assertIn('Jeugdzorg', cat_names)


# ---------------------------------------------------------------------------
# Repeated rejection
# ---------------------------------------------------------------------------

class RepeatedRejectionReportTests(TestCase):

    def setUp(self):
        self.user, self.org = _make_org_user('repeat_user', 'Repeat Org')
        self.provider = _make_provider(self.org, self.user)

    def test_returns_empty_for_none_org(self):
        result = build_repeated_rejection_report(None)
        self.assertFalse(result['data_available'])

    def test_no_bouncing_cases_when_only_one_rejection_per_case(self):
        intake = _make_intake(self.org, self.user)
        _make_evaluation(intake, self.provider, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY)

        result = build_repeated_rejection_report(self.org)
        self.assertEqual(result['total_bouncing_cases'], 0)
        self.assertFalse(result['data_available'])

    def test_detects_bouncing_case(self):
        provider_b = _make_provider(self.org, self.user, 'Aanbieder B')
        intake = _make_intake(self.org, self.user)
        _make_evaluation(intake, self.provider, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY)
        _make_evaluation(intake, provider_b, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH)

        result = build_repeated_rejection_report(self.org)
        self.assertEqual(result['total_bouncing_cases'], 1)
        self.assertTrue(result['data_available'])
        case = result['cases_with_repeated_rejections'][0]
        self.assertEqual(case['total_rejections'], 2)

    def test_detects_provider_with_repeated_same_reason(self):
        # Three different intakes, same provider, same reason.
        for _ in range(3):
            intake = _make_intake(self.org, self.user)
            _make_evaluation(intake, self.provider, ProviderEvaluation.Decision.REJECT,
                             reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY)

        result = build_repeated_rejection_report(self.org)
        self.assertGreaterEqual(result['total_providers_with_pattern'], 1)
        patterns = result['providers_with_repeated_same_reason']
        self.assertTrue(any(p['provider_id'] == self.provider.pk for p in patterns))


# ---------------------------------------------------------------------------
# Weak-match false positive rate
# ---------------------------------------------------------------------------

class WeakMatchFalsePositiveReportTests(TestCase):

    def setUp(self):
        self.user, self.org = _make_org_user('fp_user', 'FP Org')
        self.provider = _make_provider(self.org, self.user)

    def test_returns_empty_when_no_alerts(self):
        _make_intake(self.org, self.user)
        result = build_weak_match_false_positive_report(self.org)
        self.assertFalse(result['data_available'])
        self.assertIsNone(result['false_positive_rate'])

    def test_false_positive_rate_computed(self):
        # Case with weak match alert that gets accepted (false positive).
        intake_fp = _make_intake(self.org, self.user)
        _make_weak_match_alert(intake_fp)
        _make_evaluation(intake_fp, self.provider, ProviderEvaluation.Decision.ACCEPT)

        # Case with weak match alert that gets rejected (true positive).
        intake_tp = _make_intake(self.org, self.user)
        _make_weak_match_alert(intake_tp)
        _make_evaluation(intake_tp, self.provider, ProviderEvaluation.Decision.REJECT,
                         reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY)

        result = build_weak_match_false_positive_report(self.org)
        self.assertTrue(result['data_available'])
        self.assertEqual(result['total_weak_match_alerts'], 2)
        self.assertEqual(result['accepted_after_weak_match'], 1)
        self.assertAlmostEqual(result['false_positive_rate'], 0.5, places=3)
        self.assertAlmostEqual(result['true_positive_rate'], 0.5, places=3)

    def test_baseline_acceptance_computed(self):
        # Case without weak match alert that gets accepted (baseline).
        intake_no_alert = _make_intake(self.org, self.user)
        _make_evaluation(intake_no_alert, self.provider, ProviderEvaluation.Decision.ACCEPT)

        # Case with weak match alert.
        intake_weak = _make_intake(self.org, self.user)
        _make_weak_match_alert(intake_weak)

        result = build_weak_match_false_positive_report(self.org)
        self.assertTrue(result['data_available'])
        # Baseline should reflect the no-alert case acceptance.
        self.assertAlmostEqual(result['baseline_acceptance_rate'], 1.0, places=3)

    def test_returns_empty_for_none_org(self):
        result = build_weak_match_false_positive_report(None)
        self.assertFalse(result['data_available'])


# ---------------------------------------------------------------------------
# Override tracking
# ---------------------------------------------------------------------------

class OverrideTrackingReportTests(TestCase):

    def setUp(self):
        self.user, self.org = _make_org_user('override_user', 'Override Org')
        self.intake = _make_intake(self.org, self.user)

    def _make_review(self, override_present, override_type='', primary_reason=None,
                     decision_quality=None):
        return DecisionQualityReview.objects.create(
            case=self.intake,
            reviewed_by=self.user,
            decision_quality=decision_quality or DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE,
            override_present=override_present,
            override_type=override_type,
            primary_reason=primary_reason or DecisionQualityReview.PrimaryReason.OTHER,
            review_timestamp=timezone.now(),
        )

    def test_returns_empty_for_none_org(self):
        result = build_override_tracking_report(None)
        self.assertFalse(result['data_available'])
        self.assertEqual(result['total_overrides'], 0)

    def test_returns_empty_when_no_reviews(self):
        _, empty_org = _make_org_user('empty2', 'Empty Override Org')
        result = build_override_tracking_report(empty_org)
        self.assertFalse(result['data_available'])

    def test_counts_overrides(self):
        self._make_review(override_present=True,
                          override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION,
                          primary_reason=DecisionQualityReview.PrimaryReason.CAPACITY_ISSUE)
        self._make_review(override_present=True,
                          override_type=DecisionQualityReview.OverrideType.ACTION_OVERRIDE,
                          primary_reason=DecisionQualityReview.PrimaryReason.MISSING_DATA)
        self._make_review(override_present=False,
                          primary_reason=DecisionQualityReview.PrimaryReason.OTHER)

        result = build_override_tracking_report(self.org)
        self.assertTrue(result['data_available'])
        self.assertEqual(result['total_reviews'], 3)
        self.assertEqual(result['total_overrides'], 2)
        self.assertAlmostEqual(result['override_rate'], round(2 / 3, 4), places=4)

    def test_by_override_type_grouped(self):
        self._make_review(override_present=True,
                          override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION)
        self._make_review(override_present=True,
                          override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION)
        self._make_review(override_present=True,
                          override_type=DecisionQualityReview.OverrideType.ACTION_OVERRIDE)

        result = build_override_tracking_report(self.org)
        by_type = {item['override_type']: item['count'] for item in result['by_override_type']}
        self.assertEqual(by_type.get(DecisionQualityReview.OverrideType.PROVIDER_SELECTION), 2)
        self.assertEqual(by_type.get(DecisionQualityReview.OverrideType.ACTION_OVERRIDE), 1)

    def test_by_primary_reason_grouped(self):
        self._make_review(override_present=True,
                          primary_reason=DecisionQualityReview.PrimaryReason.CAPACITY_ISSUE)
        self._make_review(override_present=True,
                          primary_reason=DecisionQualityReview.PrimaryReason.CAPACITY_ISSUE)
        self._make_review(override_present=True,
                          primary_reason=DecisionQualityReview.PrimaryReason.MISSING_DATA)

        result = build_override_tracking_report(self.org)
        by_reason = {item['primary_reason']: item['count'] for item in result['by_primary_reason']}
        self.assertEqual(by_reason.get(DecisionQualityReview.PrimaryReason.CAPACITY_ISSUE), 2)
        self.assertEqual(by_reason.get(DecisionQualityReview.PrimaryReason.MISSING_DATA), 1)


# ---------------------------------------------------------------------------
# Full combined report
# ---------------------------------------------------------------------------

class FullObservabilityReportTests(TestCase):

    def setUp(self):
        self.user, self.org = _make_org_user('full_report_user', 'Full Report Org')

    def test_contains_all_five_sub_reports(self):
        result = build_full_observability_report(self.org)
        for key in (
            'confidence_calibration',
            'rejection_taxonomy',
            'repeated_rejections',
            'weak_match_false_positive',
            'override_tracking',
        ):
            self.assertIn(key, result, f"Missing sub-report key: {key}")

    def test_safe_for_none_org(self):
        result = build_full_observability_report(None)
        self.assertFalse(result['confidence_calibration']['data_available'])
        self.assertFalse(result['rejection_taxonomy']['data_available'])
        self.assertFalse(result['repeated_rejections']['data_available'])
        self.assertFalse(result['weak_match_false_positive']['data_available'])
        self.assertFalse(result['override_tracking']['data_available'])

    def test_safe_for_org_with_no_data(self):
        _, empty_org = _make_org_user('empty_full', 'Empty Full Org')
        result = build_full_observability_report(empty_org)
        # Should not raise; all sub-reports return safe defaults.
        self.assertIn('confidence_calibration', result)
        self.assertFalse(result['confidence_calibration']['data_available'])


# ---------------------------------------------------------------------------
# Observability view tests
# ---------------------------------------------------------------------------

class ObservabilityViewTests(TestCase):

    def setUp(self):
        import os
        os.environ['FEATURE_REDESIGN'] = 'true'

        self.user, self.org = _make_org_user('view_user', 'View Org')
        self.staff_user = User.objects.create_user(
            username='staff_user', password='staffpass',
            is_staff=True,
        )
        # Give staff user an org membership.
        OrganizationMembership.objects.create(
            organization=self.org, user=self.staff_user,
            role=OrganizationMembership.Role.ADMIN, is_active=True,
        )
        self.client = Client()
        self.url = reverse('careon:observability_report')

    def test_non_staff_gets_403(self):
        self.client.login(username='view_user', password='testpass123')
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_staff_gets_200_html(self):
        self.client.login(username='staff_user', password='staffpass')
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Observability')

    def test_staff_gets_200_json_export(self):
        self.client.login(username='staff_user', password='staffpass')
        response = self.client.get(self.url + '?format=json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('Content-Type', ''), 'application/json')
        data = response.json()
        self.assertIn('confidence_calibration', data)
        self.assertIn('rejection_taxonomy', data)
        self.assertIn('repeated_rejections', data)
        self.assertIn('weak_match_false_positive', data)
        self.assertIn('override_tracking', data)

    def test_unauthenticated_redirects(self):
        response = self.client.get(self.url)
        self.assertIn(response.status_code, (302, 403))
