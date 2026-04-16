"""Tests for Decision Quality Layer (pilot evaluation).

Coverage includes:
- Model creation and field validation
- Context builder correctness and edge cases
- Review creation with various input combinations
- Query helpers for aggregation
- No regression in existing flows
"""

from datetime import date, datetime, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from contracts.decision_quality import (
    create_decision_quality_review,
    get_reviews_for_case,
    get_reviews_for_week,
    get_reviews_needing_attention,
)
from contracts.governance import (
    build_decision_review_context,
    get_decision_quality_distribution,
    get_override_reason_patterns,
    get_decision_quality_by_case_type,
    get_decision_quality_by_provider,
    log_case_decision_event,
)
from contracts.models import (
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    DecisionQualityReview,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    SystemPolicyConfig,
)


class DecisionQualityModelTests(TestCase):
    """Test DecisionQualityReview model creation and field validation."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='reviewer',
            email='reviewer@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Test Org', slug='test-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Test Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Test Case',
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

    def test_create_review_minimal(self):
        """Create a review with minimal required fields."""
        review = DecisionQualityReview.objects.create(
            case=self.case,
            reviewed_by=self.user,
            review_timestamp=timezone.now(),
        )
        self.assertEqual(review.case_id, self.case.id)
        self.assertEqual(review.reviewed_by_id, self.user.id)
        self.assertEqual(review.decision_quality, DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE)
        self.assertFalse(review.override_present)

    def test_create_review_full(self):
        """Create a review with all fields populated."""
        placement = PlacementRequest.objects.create(
            due_diligence_process=self.case,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            status=PlacementRequest.Status.APPROVED,
        )
        review_time = timezone.now() - timedelta(hours=2)
        review = DecisionQualityReview.objects.create(
            case=self.case,
            placement=placement,
            reviewed_by=self.user,
            system_recommendation={'provider_id': 1, 'score': 0.95},
            actual_decision={'action': 'provider_selected', 'provider_id': 1},
            outcome='Placement successful, provider accepted',
            decision_quality=DecisionQualityReview.DecisionQuality.SYSTEM_CORRECT,
            override_present=False,
            override_type='',
            primary_reason=DecisionQualityReview.PrimaryReason.OTHER,
            notes='Good match, clear explanation',
            review_timestamp=review_time,
        )
        self.assertEqual(review.placement_id, placement.id)
        self.assertEqual(review.decision_quality, DecisionQualityReview.DecisionQuality.SYSTEM_CORRECT)
        self.assertFalse(review.override_present)
        self.assertEqual(review.review_timestamp, review_time)

    def test_review_with_override(self):
        """Create a review capturing an override."""
        review = DecisionQualityReview.objects.create(
            case=self.case,
            reviewed_by=self.user,
            decision_quality=DecisionQualityReview.DecisionQuality.USER_CORRECT,
            override_present=True,
            override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION,
            primary_reason=DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH,
            notes='User selected provider with better regional fit',
            review_timestamp=timezone.now(),
        )
        self.assertTrue(review.override_present)
        self.assertEqual(review.override_type, DecisionQualityReview.OverrideType.PROVIDER_SELECTION)
        self.assertEqual(review.decision_quality, DecisionQualityReview.DecisionQuality.USER_CORRECT)

    def test_review_ordering(self):
        """Reviews are ordered by most recent review_timestamp first."""
        t1 = timezone.now() - timedelta(hours=2)
        t2 = timezone.now() - timedelta(hours=1)
        t3 = timezone.now()

        r1 = DecisionQualityReview.objects.create(
            case=self.case, reviewed_by=self.user, review_timestamp=t1
        )
        r2 = DecisionQualityReview.objects.create(
            case=self.case, reviewed_by=self.user, review_timestamp=t2
        )
        r3 = DecisionQualityReview.objects.create(
            case=self.case, reviewed_by=self.user, review_timestamp=t3
        )

        reviews = list(DecisionQualityReview.objects.all())
        self.assertEqual(reviews[0].id, r3.id)  # Most recent first
        self.assertEqual(reviews[1].id, r2.id)
        self.assertEqual(reviews[2].id, r1.id)


class DecisionContextBuilderTests(TestCase):
    """Test build_decision_review_context helper."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='system',
            email='system@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Test Org', slug='test-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Test Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Test Case',
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

    def test_context_for_nonexistent_case(self):
        """Context builder handles non-existent cases gracefully."""
        context = build_decision_review_context(case_id=9999)
        self.assertFalse(context['case_summary']['found'])
        self.assertEqual(context['case_summary']['case_id'], 9999)

    def test_context_for_empty_case(self):
        """Context builder handles cases with no decision logs."""
        context = build_decision_review_context(case_id=self.case.id)
        self.assertTrue(context['case_summary']['found'])
        self.assertEqual(context['actual_decision']['timeline'], [])
        self.assertFalse(context['override']['present'])

    def test_context_with_recommendation_and_decision(self):
        """Context builder reconstructs timeline with recommendation and decision."""
        # Log a recommendation
        log_case_decision_event(
            case_id=self.case.id,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'provider_id': 1, 'score': 0.95},
            provider_id=1,
        )

        # Log a provider selection
        log_case_decision_event(
            case_id=self.case.id,
            event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
            provider_id=1,
            user_action='provider_selected',
        )

        context = build_decision_review_context(case_id=self.case.id)
        self.assertTrue(context['case_summary']['found'])
        self.assertIsNotNone(context['recommendation']['recommendation'])
        self.assertGreaterEqual(len(context['actual_decision']['timeline']), 1)

    def test_context_with_override(self):
        """Context builder detects and captures overrides."""
        # Create a second provider for the override
        provider_2 = CareProvider.objects.create(
            organization=self.organization,
            name='Test Provider 2',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        
        # Log initial recommendation
        log_case_decision_event(
            case_id=self.case.id,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'provider_id': self.provider.id},
            provider_id=self.provider.id,
        )

        # Log override (provider selection with override_type)
        log_case_decision_event(
            case_id=self.case.id,
            event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
            provider_id=provider_2.id,
            override_type='provider_selection',
        )

        context = build_decision_review_context(case_id=self.case.id)
        self.assertTrue(context['override']['present'])


class DecisionQualityServiceTests(TestCase):
    """Test create_decision_quality_review service function."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='reviewer',
            email='reviewer@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Test Org', slug='test-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Test Case',
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Test Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.placement = PlacementRequest.objects.create(
            due_diligence_process=self.case,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            status=PlacementRequest.Status.APPROVED,
        )

    def test_create_review_basic(self):
        """Create a review with minimal parameters."""
        review = create_decision_quality_review(case_id=self.case.id, reviewed_by_user_id=self.user.id)
        self.assertIsNotNone(review)
        self.assertEqual(review.case_id, self.case.id)
        self.assertEqual(review.reviewed_by_id, self.user.id)

    def test_create_review_nonexistent_case(self):
        """Creating a review for non-existent case returns None."""
        review = create_decision_quality_review(case_id=9999)
        self.assertIsNone(review)

    def test_create_review_with_placement(self):
        """Create a review with placement context."""
        review = create_decision_quality_review(
            case_id=self.case.id,
            placement_id=self.placement.id,
            reviewed_by_user_id=self.user.id,
        )
        self.assertIsNotNone(review)
        self.assertEqual(review.placement_id, self.placement.id)

    def test_create_review_invalid_decision_quality(self):
        """Invalid decision_quality is coerced to default."""
        review = create_decision_quality_review(
            case_id=self.case.id,
            decision_quality='INVALID_QUALITY',
            reviewed_by_user_id=self.user.id,
        )
        self.assertIsNotNone(review)
        self.assertEqual(review.decision_quality, DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE)

    def test_create_review_invalid_primary_reason(self):
        """Invalid primary_reason is coerced to OTHER."""
        review = create_decision_quality_review(
            case_id=self.case.id,
            primary_reason='INVALID_REASON',
            reviewed_by_user_id=self.user.id,
        )
        self.assertIsNotNone(review)
        self.assertEqual(review.primary_reason, DecisionQualityReview.PrimaryReason.OTHER)

    def test_create_review_with_override(self):
        """Create a review capturing an override decision."""
        review = create_decision_quality_review(
            case_id=self.case.id,
            reviewed_by_user_id=self.user.id,
            decision_quality=DecisionQualityReview.DecisionQuality.USER_CORRECT,
            override_present=True,
            override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION,
            primary_reason=DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH,
        )
        self.assertIsNotNone(review)
        self.assertTrue(review.override_present)
        self.assertEqual(review.override_type, DecisionQualityReview.OverrideType.PROVIDER_SELECTION)

    def test_create_review_custom_timestamp(self):
        """Create a review with custom review_timestamp."""
        custom_time = timezone.now() - timedelta(days=3)
        review = create_decision_quality_review(
            case_id=self.case.id,
            reviewed_by_user_id=self.user.id,
            review_timestamp=custom_time,
        )
        self.assertIsNotNone(review)
        self.assertEqual(review.review_timestamp.date(), custom_time.date())


class DecisionQueryHelperTests(TestCase):
    """Test query helpers for aggregation and analysis."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='reviewer',
            email='reviewer@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Test Org', slug='test-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Test Case',
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Test Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )

    def test_get_decision_quality_distribution(self):
        """Distribution query aggregates reviews by quality classification."""
        # Create reviews with different quality ratings
        DecisionQualityReview.objects.create(
            case=self.case,
            decision_quality=DecisionQualityReview.DecisionQuality.SYSTEM_CORRECT,
            review_timestamp=timezone.now(),
        )
        DecisionQualityReview.objects.create(
            case=self.case,
            decision_quality=DecisionQualityReview.DecisionQuality.SYSTEM_CORRECT,
            review_timestamp=timezone.now(),
        )
        DecisionQualityReview.objects.create(
            case=self.case,
            decision_quality=DecisionQualityReview.DecisionQuality.USER_CORRECT,
            review_timestamp=timezone.now(),
        )

        dist = get_decision_quality_distribution()
        self.assertEqual(dist['System recommendation was correct'], 2)
        self.assertEqual(dist['User override was correct'], 1)

    def test_get_override_reason_patterns(self):
        """Override patterns query shows reason co-occurrence."""
        # With override
        DecisionQualityReview.objects.create(
            case=self.case,
            override_present=True,
            primary_reason=DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH,
            review_timestamp=timezone.now(),
        )
        # Without override
        DecisionQualityReview.objects.create(
            case=self.case,
            override_present=False,
            primary_reason=DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH,
            review_timestamp=timezone.now(),
        )

        patterns = get_override_reason_patterns()
        self.assertEqual(patterns['has_override']['Provider fit mismatch'], 1)
        self.assertEqual(patterns['no_override']['Provider fit mismatch'], 1)

    def test_get_reviews_for_case(self):
        """Get reviews for a specific case."""
        other_case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Other Case',
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        DecisionQualityReview.objects.create(
            case=self.case, review_timestamp=timezone.now()
        )
        DecisionQualityReview.objects.create(
            case=self.case, review_timestamp=timezone.now()
        )
        DecisionQualityReview.objects.create(
            case=other_case, review_timestamp=timezone.now()
        )

        reviews = get_reviews_for_case(self.case.id)
        self.assertEqual(len(reviews), 2)
        self.assertTrue(all(r.case_id == self.case.id for r in reviews))

    def test_get_reviews_for_week(self):
        """Get reviews for an ISO week."""
        now = timezone.now()
        iso_year, iso_week, _ = now.isocalendar()

        # Create review in this week
        DecisionQualityReview.objects.create(
            case=self.case, review_timestamp=now
        )

        # Create review in next week
        next_week = now + timedelta(days=7)
        DecisionQualityReview.objects.create(
            case=self.case, review_timestamp=next_week
        )

        reviews = get_reviews_for_week(iso_year, iso_week)
        self.assertEqual(len(reviews), 1)

    def test_get_reviews_needing_attention(self):
        """Get suboptimal or override-flagged reviews."""
        # Suboptimal
        DecisionQualityReview.objects.create(
            case=self.case,
            decision_quality=DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL,
            review_timestamp=timezone.now(),
        )
        # Override
        DecisionQualityReview.objects.create(
            case=self.case,
            override_present=True,
            review_timestamp=timezone.now(),
        )
        # Acceptable (should not appear)
        DecisionQualityReview.objects.create(
            case=self.case,
            decision_quality=DecisionQualityReview.DecisionQuality.BOTH_ACCEPTABLE,
            override_present=False,
            review_timestamp=timezone.now(),
        )

        attention = get_reviews_needing_attention()
        self.assertEqual(len(attention), 2)


class DecisionQualityNoRegressionTests(TestCase):
    """Verify no regression in existing case/placement workflows."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='system',
            email='system@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Test Org', slug='test-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Test Case',
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

    def test_case_operations_unaffected_by_reviews(self):
        """Creating a review does not affect case operations."""
        initial_count = CaseIntakeProcess.objects.count()

        DecisionQualityReview.objects.create(
            case=self.case, review_timestamp=timezone.now()
        )

        # Case count unchanged
        self.assertEqual(CaseIntakeProcess.objects.count(), initial_count)

        # Case data unchanged
        case_check = CaseIntakeProcess.objects.get(pk=self.case.id)
        self.assertEqual(case_check.id, self.case.id)

    def test_decision_log_operations_unaffected_by_reviews(self):
        """Decision log append not affected by review creation."""
        log_case_decision_event(
            case_id=self.case.id,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'test': 'data'},
        )

        initial_log_count = CaseDecisionLog.objects.filter(case_id=self.case.id).count()

        DecisionQualityReview.objects.create(
            case=self.case, review_timestamp=timezone.now()
        )

        # Log count unchanged
        final_log_count = CaseDecisionLog.objects.filter(case_id=self.case.id).count()
        self.assertEqual(initial_log_count, final_log_count)
