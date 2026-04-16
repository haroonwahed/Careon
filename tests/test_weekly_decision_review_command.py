import json
from datetime import date, timedelta
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.contrib.auth.models import User
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from django.utils import timezone

from contracts.decision_quality import create_decision_quality_review
from contracts.decision_quality_workflow import (
    get_top_decision_quality_reasons,
    get_weekly_decision_quality_summary,
    get_weekly_review_completion_stats,
)
from contracts.governance import log_case_decision_event
from contracts.models import (
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    DecisionQualityReview,
    Organization,
    OrganizationMembership,
    PlacementRequest,
)


class WeeklyDecisionReviewCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='weekly_review_owner',
            email='weekly_review_owner@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Weekly Review Org', slug='weekly-review-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

        self.provider_a = CareProvider.objects.create(
            organization=self.organization,
            name='Weekly Provider A',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.provider_b = CareProvider.objects.create(
            organization=self.organization,
            name='Weekly Provider B',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )

        self.case_a = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Weekly Case Reviewed',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        self.case_b = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Weekly Case Unreviewed',
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
            provider_response_requested_at=timezone.now() - timedelta(hours=90),
        )
        self.placement_b = PlacementRequest.objects.create(
            due_diligence_process=self.case_b,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider_b,
            selected_provider=self.provider_b,
            provider_response_status=PlacementRequest.ProviderResponseStatus.WAITLIST,
            provider_response_requested_at=timezone.now() - timedelta(hours=40),
        )

        self.year, self.week, _ = timezone.now().isocalendar()

        self._seed_logs_for_candidates()
        self._seed_review_for_case_a()

    def _seed_logs_for_candidates(self):
        log_case_decision_event(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'provider_id': self.provider_a.id, 'score': 0.91},
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
            case_id=self.case_b.id,
            placement_id=self.placement_b.id,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'provider_id': self.provider_b.id, 'score': 0.84},
            provider_id=self.provider_b.id,
        )
        log_case_decision_event(
            case_id=self.case_b.id,
            placement_id=self.placement_b.id,
            event_type=CaseDecisionLog.EventType.RESEND_TRIGGERED,
            user_action='resend_request',
            provider_id=self.provider_b.id,
        )

    def _seed_review_for_case_a(self):
        create_decision_quality_review(
            case_id=self.case_a.id,
            placement_id=self.placement_a.id,
            reviewed_by_user_id=self.user.id,
            decision_quality=DecisionQualityReview.DecisionQuality.USER_CORRECT,
            override_present=True,
            override_type=DecisionQualityReview.OverrideType.PROVIDER_SELECTION,
            primary_reason=DecisionQualityReview.PrimaryReason.PROVIDER_MISMATCH,
            notes='Manual override improved practical fit.',
        )

    def test_default_command_execution_prints_terminal_summary(self):
        out = StringIO()

        call_command('weekly_decision_review', stdout=out)

        output = out.getvalue()
        self.assertIn(f'Weekly Decision Review - Week {self.week}, {self.year}', output)
        self.assertIn('Candidate cases: 2', output)
        self.assertIn('Reviewed candidate cases: 1', output)
        self.assertIn('Unreviewed candidate cases: 1', output)
        self.assertIn(f'Case {self.case_b.id}', output)
        self.assertNotIn(f'Case {self.case_a.id}', output)

    def test_explicit_year_week_handling(self):
        out = StringIO()

        call_command('weekly_decision_review', year=self.year, week=self.week, stdout=out)

        output = out.getvalue()
        self.assertIn(f'Weekly Decision Review - Week {self.week}, {self.year}', output)

    def test_no_data_case_prints_clean_message(self):
        out = StringIO()

        call_command('weekly_decision_review', year=2020, week=1, stdout=out)

        output = out.getvalue()
        self.assertIn('Candidate cases: 0', output)
        self.assertIn('No candidate cases found for this week', output)

    def test_json_output_mode_returns_structured_payload(self):
        out = StringIO()

        call_command(
            'weekly_decision_review',
            year=self.year,
            week=self.week,
            include_reviewed=True,
            as_json=True,
            stdout=out,
        )

        payload = json.loads(out.getvalue())
        self.assertEqual(payload['year'], self.year)
        self.assertEqual(payload['week'], self.week)
        self.assertIn('summary', payload)
        self.assertIn('selected_cases', payload)
        self.assertIn('top_reasons', payload)
        self.assertIn('completion_stats', payload)
        self.assertEqual(payload['completion_stats']['reviewed_candidate_case_count'], 1)
        self.assertEqual(payload['completion_stats']['candidate_not_yet_reviewed_count'], 1)

    def test_file_output_mode_writes_json_payload(self):
        out = StringIO()

        with TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / 'pilot' / 'week' / 'decision_review.json'
            call_command(
                'weekly_decision_review',
                year=self.year,
                week=self.week,
                include_reviewed=True,
                output=str(output_path),
                stdout=out,
            )

            self.assertTrue(output_path.exists())
            payload = json.loads(output_path.read_text(encoding='utf-8'))
            self.assertEqual(payload['summary']['reviewed_case_count'], 1)

        self.assertIn('Wrote JSON export to', out.getvalue())

    def test_invalid_argument_handling(self):
        with self.assertRaises(CommandError):
            call_command('weekly_decision_review', year=self.year, week=0)

        with self.assertRaises(CommandError):
            call_command('weekly_decision_review', year=self.year, week=54)

        with self.assertRaises(CommandError):
            call_command('weekly_decision_review', year=0, week=1)

        with self.assertRaises(CommandError):
            call_command('weekly_decision_review', year=self.year, week=self.week, limit=0)

    def test_reviewed_unreviewed_counts_are_correct(self):
        out = StringIO()

        call_command(
            'weekly_decision_review',
            year=self.year,
            week=self.week,
            include_reviewed=True,
            as_json=True,
            stdout=out,
        )

        payload = json.loads(out.getvalue())
        completion = payload['completion_stats']

        self.assertEqual(completion['candidate_case_count'], 2)
        self.assertEqual(completion['reviewed_candidate_case_count'], 1)
        self.assertEqual(completion['candidate_not_yet_reviewed_count'], 1)

    def test_command_reuses_existing_weekly_helpers_without_regression(self):
        out = StringIO()

        call_command(
            'weekly_decision_review',
            year=self.year,
            week=self.week,
            include_reviewed=True,
            as_json=True,
            stdout=out,
        )
        payload = json.loads(out.getvalue())

        expected_summary = get_weekly_decision_quality_summary(self.year, self.week)
        expected_reasons = get_top_decision_quality_reasons(self.year, self.week)
        expected_completion = get_weekly_review_completion_stats(self.year, self.week)

        self.assertEqual(payload['summary']['quality_distribution'], expected_summary['quality_distribution'])
        self.assertEqual(payload['summary']['override_frequency_percent'], expected_summary['override_frequency_percent'])
        self.assertEqual(payload['top_reasons'], expected_reasons)
        self.assertEqual(payload['completion_stats'], expected_completion)
