from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from contracts.decision_quality import create_decision_quality_review
from contracts.decision_quality_workflow import (
    DECISION_QUALITY_RUBRIC,
    PRIMARY_REASON_RUBRIC,
    build_weekly_decision_quality_review_packet,
    evaluate_review_consistency,
    get_cases_marked_for_review,
    get_override_heavy_cases,
    get_suboptimal_outcome_cases,
    get_top_decision_quality_reasons,
    get_unreviewed_priority_cases,
    get_weekly_decision_review_candidates,
    get_weekly_decision_quality_summary,
    get_weekly_review_completion_stats,
    mark_case_for_weekly_review,
)
from contracts.governance import build_decision_review_context, log_case_decision_event
from contracts.models import (
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    DecisionQualityReview,
    Organization,
    OrganizationMembership,
    PlacementRequest,
)


class DecisionQualityWorkflowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='dq_workflow_owner',
            email='dq_workflow@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='DQ Workflow Org', slug='dq-workflow-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

        self.provider_a = CareProvider.objects.create(
            organization=self.organization,
            name='Provider A',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.provider_b = CareProvider.objects.create(
            organization=self.organization,
            name='Provider B',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )

        self.case_a = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Workflow Case A',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        self.case_b = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Workflow Case B',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        self.placement_a = PlacementRequest.objects.create(
            due_diligence_process=self.case_a,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider_a,
            selected_provider=self.provider_a,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=timezone.now() - timedelta(hours=100),
        )
        self.placement_b = PlacementRequest.objects.create(
            due_diligence_process=self.case_b,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider_b,
            selected_provider=self.provider_b,
            provider_response_status=PlacementRequest.ProviderResponseStatus.WAITLIST,
            provider_response_requested_at=timezone.now() - timedelta(hours=30),
        )

        self.current_year, self.current_week, _ = timezone.now().isocalendar()

    def _create_rich_case_a_logs(self):
        log_case_decision_event(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'provider_id': self.provider_a.id, 'score': 0.93},
            provider_id=self.provider_a.id,
        )
        log_case_decision_event(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
            user_action='assign_provider',
            override_type='provider_selection',
            recommended_value={'provider_id': self.provider_a.id},
            actual_value={'provider_id': self.provider_b.id},
            provider_id=self.provider_b.id,
            actor_user_id=self.user.id,
        )
        log_case_decision_event(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            event_type=CaseDecisionLog.EventType.RESEND_TRIGGERED,
            user_action='resend_request',
            provider_id=self.provider_b.id,
        )
        log_case_decision_event(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            event_type=CaseDecisionLog.EventType.SLA_ESCALATION,
            sla_state='FORCED_ACTION',
            recommended_value={'sla_state': 'ESCALATED'},
            actual_value={'sla_state': 'FORCED_ACTION'},
            provider_id=self.provider_b.id,
        )
        log_case_decision_event(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            event_type=CaseDecisionLog.EventType.REMATCH_TRIGGERED,
            user_action='trigger_rematch',
            provider_id=self.provider_b.id,
        )

    def test_rubric_contains_required_categories_and_fields(self):
        expected_quality = {choice for choice, _ in DecisionQualityReview.DecisionQuality.choices}
        expected_reasons = {choice for choice, _ in DecisionQualityReview.PrimaryReason.choices}

        self.assertEqual(set(DECISION_QUALITY_RUBRIC.keys()), expected_quality)
        self.assertEqual(set(PRIMARY_REASON_RUBRIC.keys()), expected_reasons)

        for rubric in (DECISION_QUALITY_RUBRIC, PRIMARY_REASON_RUBRIC):
            for value in rubric.values():
                self.assertIn('label', value)
                self.assertIn('guidance', value)
                self.assertIn('reviewer_note', value)
                self.assertTrue(value['label'])

    def test_weekly_candidate_selection_prioritizes_override_escalation_and_rematch(self):
        self._create_rich_case_a_logs()

        log_case_decision_event(
            case_id=self.case_b.id,
            placement_id=self.placement_b.id,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'provider_id': self.provider_b.id, 'score': 0.84},
            provider_id=self.provider_b.id,
        )

        candidates = get_weekly_decision_review_candidates(self.current_year, self.current_week)
        self.assertGreaterEqual(len(candidates), 2)

        top = candidates[0]
        self.assertEqual(top['case_id'], self.case_a.id)
        self.assertIn('override_present', top['reasons'])
        self.assertIn('forced_action', top['reasons'])
        self.assertIn('rematch', top['reasons'])
        self.assertGreater(top['priority_score'], 0)

    def test_override_and_suboptimal_case_filters(self):
        self._create_rich_case_a_logs()

        overrides = get_override_heavy_cases(self.current_year, self.current_week)
        self.assertTrue(any(row['case_id'] == self.case_a.id for row in overrides))

        suboptimal = get_suboptimal_outcome_cases(self.current_year, self.current_week)
        self.assertTrue(any(row['case_id'] == self.case_a.id for row in suboptimal))

    def test_weekly_review_packet_contains_context_and_review_status(self):
        self._create_rich_case_a_logs()

        packet = build_weekly_decision_quality_review_packet(self.current_year, self.current_week)
        self.assertIn('cases', packet)
        self.assertGreaterEqual(packet['candidate_count'], 1)

        row = next(item for item in packet['cases'] if item['case_id'] == self.case_a.id)
        self.assertIn('case_summary', row)
        self.assertIn('recommendation_snapshot', row)
        self.assertIn('actual_decision_snapshot', row)
        self.assertIn('override', row)
        self.assertIn('replay_summary', row)
        self.assertFalse(row['review_status']['reviewed_this_week'])

        create_decision_quality_review(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            reviewed_by_user_id=self.user.id,
            decision_quality=DecisionQualityReview.DecisionQuality.USER_CORRECT,
            override_present=True,
            override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION,
            primary_reason=DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH,
            notes='Override improved feasibility due to availability constraints.',
        )

        packet_after_review = build_weekly_decision_quality_review_packet(self.current_year, self.current_week)
        row_after_review = next(item for item in packet_after_review['cases'] if item['case_id'] == self.case_a.id)
        self.assertTrue(row_after_review['review_status']['reviewed_this_week'])

    def test_weekly_summary_and_reason_helpers(self):
        self._create_rich_case_a_logs()

        create_decision_quality_review(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            reviewed_by_user_id=self.user.id,
            decision_quality=DecisionQualityReview.DecisionQuality.USER_CORRECT,
            override_present=True,
            override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION,
            primary_reason=DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH,
            notes='User override achieved better practical fit.',
        )
        create_decision_quality_review(
            case_id=self.case_b.id,
            placement_id=self.placement_b.id,
            reviewed_by_user_id=self.user.id,
            decision_quality=DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL,
            override_present=False,
            primary_reason=DecisionQualityReview.PrimaryReason.CAPACITY_ISSUE,
            notes='Both options had weak timing and capacity.',
        )

        summary = get_weekly_decision_quality_summary(self.current_year, self.current_week)
        self.assertEqual(summary['reviewed_case_count'], 2)
        self.assertEqual(summary['quality_distribution'][DecisionQualityReview.DecisionQuality.USER_CORRECT], 1)
        self.assertEqual(summary['quality_distribution'][DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL], 1)
        self.assertEqual(summary['override_count'], 1)
        self.assertEqual(summary['override_frequency_percent'], 50.0)

        reasons = get_top_decision_quality_reasons(self.current_year, self.current_week)
        self.assertEqual(reasons['user_correct'][0]['primary_reason'], DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH)
        self.assertEqual(reasons['both_suboptimal'][0]['primary_reason'], DecisionQualityReview.PrimaryReason.CAPACITY_ISSUE)

        completion = get_weekly_review_completion_stats(self.current_year, self.current_week)
        self.assertIn('candidate_case_count', completion)
        self.assertIn('completion_rate_percent', completion)

    def test_consistency_guardrails_are_non_blocking_but_informative(self):
        feedback = evaluate_review_consistency(
            decision_quality=DecisionQualityReview.DecisionQuality.BOTH_SUBOPTIMAL,
            override_present=False,
            override_type=DecisionQualityReview.OverrideType.ACTION_OVERRIDE,
            primary_reason=DecisionQualityReview.PrimaryReason.OTHER,
            notes='',
        )
        self.assertFalse(feedback['is_consistent'])
        self.assertGreaterEqual(len(feedback['warnings']), 1)
        self.assertTrue(feedback['completeness_flags']['requires_followup_notes'])

    def test_marked_for_review_workflow_helpers(self):
        self._create_rich_case_a_logs()

        mark_result = mark_case_for_weekly_review(
            self.case_a.id,
            self.current_year,
            self.current_week,
            reason='Forced action and override need weekly review.',
            marked_by_user_id=self.user.id,
        )
        self.assertIn('mark_id', mark_result)
        self.assertTrue(mark_result['created'])

        marks = get_cases_marked_for_review(self.current_year, self.current_week)
        self.assertEqual(len(marks), 1)
        self.assertEqual(marks[0]['case_id'], self.case_a.id)

        priority = get_unreviewed_priority_cases(self.current_year, self.current_week)
        marked_entry = next(row for row in priority if row['case_id'] == self.case_a.id)
        self.assertTrue(marked_entry['is_marked'])

    def test_partial_data_handling_does_not_crash(self):
        # Minimal sparse governance event
        log_case_decision_event(
            case_id=self.case_b.id,
            event_type=CaseDecisionLog.EventType.RESEND_TRIGGERED,
        )

        candidates = get_weekly_decision_review_candidates(self.current_year, self.current_week)
        self.assertTrue(any(row['case_id'] == self.case_b.id for row in candidates))

        packet = build_weekly_decision_quality_review_packet(self.current_year, self.current_week)
        row = next(item for item in packet['cases'] if item['case_id'] == self.case_b.id)
        self.assertIn('case_summary', row)
        self.assertIn('recommendation_snapshot', row)
        self.assertIn('review_status', row)

    def test_existing_decision_quality_and_governance_helpers_still_work(self):
        self._create_rich_case_a_logs()

        context = build_decision_review_context(self.case_a.id)
        self.assertEqual(context['case_summary']['case_id'], self.case_a.id)
        self.assertIn('actual_decision', context)

        review = create_decision_quality_review(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            reviewed_by_user_id=self.user.id,
            decision_quality=DecisionQualityReview.DecisionQuality.SYSTEM_CORRECT,
            override_present=False,
            primary_reason=DecisionQualityReview.PrimaryReason.OTHER,
            notes='Recommendation was valid for context at the time.',
        )
        self.assertIsNotNone(review)
        self.assertEqual(review.case_id, self.case_a.id)
