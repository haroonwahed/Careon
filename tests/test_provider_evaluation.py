"""Tests for the Aanbieder Beoordeling (Provider Evaluation) flow.

Coverage
--------
- acceptance path: creates ProviderEvaluation, updates PlacementRequest to ACCEPTED,
  unlocks placement, logs CaseDecisionLog, logs AuditLog.
- rejection path: stores reason code, sets PlacementRequest to REJECTED,
  blocks placement, feeds result into outcome tracking.
- needs_more_info path: requires requested_info, sets NEEDS_INFO, blocks placement.
- transition rules: duplicate accept allowed; missing reason_code raises ValueError;
  missing requested_info for needs_more_info raises ValueError.
- audit logging: CaseDecisionLog and AuditLog are created on each path.
- view: POST to case_provider_evaluation_action applies the decision via HTTP.
- NBA codes: get_evaluation_nba_code returns correct codes per decision state.
"""
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    AuditLog,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderEvaluation,
)
from contracts.provider_evaluation_service import (
    get_evaluation_nba_code,
    latest_evaluation_for_case_provider,
    placement_unlocked_for_case,
    record_provider_evaluation,
)


class ProviderEvaluationServiceTests(TestCase):
    """Unit tests for provider_evaluation_service functions."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='eval_owner',
            email='eval_owner@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(
            name='Eval Org', slug='eval-org'
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Eval Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.owner,
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Eval Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.owner,
            assessment_summary='Test intake',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )
        CaseAssessment.objects.create(
            intake=self.intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.owner,
        )
        self.placement = PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=self.intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )

    # ── Acceptance path ────────────────────────────────────────────────────

    def test_accept_creates_evaluation_record(self):
        evaluation = record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.assertEqual(evaluation.decision, ProviderEvaluation.Decision.ACCEPT)
        self.assertEqual(evaluation.case, self.intake)
        self.assertEqual(evaluation.provider, self.provider)

    def test_accept_updates_placement_to_accepted(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.placement.refresh_from_db()
        self.assertEqual(
            self.placement.provider_response_status,
            PlacementRequest.ProviderResponseStatus.ACCEPTED,
        )

    def test_accept_unlocks_placement(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.assertTrue(placement_unlocked_for_case(self.intake))

    def test_accept_logs_case_decision_event(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.assertTrue(
            CaseDecisionLog.objects.filter(
                case=self.intake,
                event_type=CaseDecisionLog.EventType.PROVIDER_ACCEPTED,
            ).exists()
        )

    def test_accept_logs_audit_event(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='ProviderEvaluation',
                action=AuditLog.Action.CREATE,
            ).exists()
        )

    # ── Rejection path ─────────────────────────────────────────────────────

    def test_reject_stores_reason_code(self):
        evaluation = record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
            decided_by_id=self.owner.id,
        )
        self.assertEqual(evaluation.reason_code, ProviderEvaluation.RejectionCode.NO_CAPACITY)

    def test_reject_updates_placement_to_rejected(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH,
            decided_by_id=self.owner.id,
        )
        self.placement.refresh_from_db()
        self.assertEqual(
            self.placement.provider_response_status,
            PlacementRequest.ProviderResponseStatus.REJECTED,
        )

    def test_reject_does_not_unlock_placement(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.REGION_NOT_SUPPORTED,
            decided_by_id=self.owner.id,
        )
        self.assertFalse(placement_unlocked_for_case(self.intake))

    def test_reject_logs_case_decision_event(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.RISK_TOO_HIGH,
            decided_by_id=self.owner.id,
        )
        self.assertTrue(
            CaseDecisionLog.objects.filter(
                case=self.intake,
                event_type=CaseDecisionLog.EventType.PROVIDER_REJECTED,
            ).exists()
        )

    def test_reject_feeds_reason_code_to_placement_outcome(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
            decided_by_id=self.owner.id,
        )
        self.placement.refresh_from_db()
        # Capacity reason → CAPACITY outcome code
        from contracts.models import OutcomeReasonCode
        self.assertEqual(
            self.placement.provider_response_reason_code,
            OutcomeReasonCode.CAPACITY,
        )

    # ── Needs-more-info path ───────────────────────────────────────────────

    def test_needs_more_info_creates_evaluation(self):
        evaluation = record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Zorgplan en medische achtergrond ontbreekt.',
            decided_by_id=self.owner.id,
        )
        self.assertEqual(
            evaluation.decision, ProviderEvaluation.Decision.NEEDS_MORE_INFO
        )
        self.assertIn('Zorgplan', evaluation.requested_info)

    def test_needs_more_info_sets_placement_to_needs_info(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Ontbrekend beoordelingsrapport.',
            decided_by_id=self.owner.id,
        )
        self.placement.refresh_from_db()
        self.assertEqual(
            self.placement.provider_response_status,
            PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
        )

    def test_needs_more_info_blocks_placement(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Contactgegevens voogd ontbreekt.',
            decided_by_id=self.owner.id,
        )
        self.assertFalse(placement_unlocked_for_case(self.intake))

    def test_needs_more_info_surfaces_into_placement_notes(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Gezondheidsstatus.',
            decided_by_id=self.owner.id,
        )
        self.placement.refresh_from_db()
        self.assertIn('Gezondheidsstatus', self.placement.provider_response_notes)

    def test_needs_more_info_logs_case_decision_event(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Diagnose ontbreekt.',
            decided_by_id=self.owner.id,
        )
        self.assertTrue(
            CaseDecisionLog.objects.filter(
                case=self.intake,
                event_type=CaseDecisionLog.EventType.PROVIDER_NEEDS_INFO,
            ).exists()
        )

    # ── Transition rules ───────────────────────────────────────────────────

    def test_reject_without_reason_code_raises_value_error(self):
        with self.assertRaises(ValueError):
            record_provider_evaluation(
                intake=self.intake,
                provider=self.provider,
                placement=self.placement,
                decision=ProviderEvaluation.Decision.REJECT,
                reason_code='',
                decided_by_id=self.owner.id,
            )

    def test_needs_more_info_without_requested_info_raises_value_error(self):
        with self.assertRaises(ValueError):
            record_provider_evaluation(
                intake=self.intake,
                provider=self.provider,
                placement=self.placement,
                decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
                requested_info='',
                decided_by_id=self.owner.id,
            )

    def test_unknown_decision_raises_value_error(self):
        with self.assertRaises(ValueError):
            record_provider_evaluation(
                intake=self.intake,
                provider=self.provider,
                placement=self.placement,
                decision='unknown_decision',
                decided_by_id=self.owner.id,
            )

    def test_duplicate_accept_allowed_creates_second_record(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.assertEqual(
            ProviderEvaluation.objects.filter(
                case=self.intake,
                provider=self.provider,
                decision=ProviderEvaluation.Decision.ACCEPT,
            ).count(),
            2,
        )

    def test_latest_evaluation_returns_most_recent(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
            decided_by_id=self.owner.id,
        )
        second = record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        latest = latest_evaluation_for_case_provider(self.intake, self.provider)
        self.assertEqual(latest.pk, second.pk)

    # ── NBA codes ──────────────────────────────────────────────────────────

    def test_nba_awaiting_when_no_evaluation_exists(self):
        self.assertIsNone(get_evaluation_nba_code(self.intake))

    def test_nba_ready_for_placement_after_accept(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.assertEqual(get_evaluation_nba_code(self.intake), 'ready_for_placement')

    def test_nba_provider_rejected_after_rejection(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.URGENCY_NOT_SUPPORTED,
            decided_by_id=self.owner.id,
        )
        self.assertEqual(get_evaluation_nba_code(self.intake), 'provider_rejected')

    def test_nba_provider_requested_more_info(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Meer informatie nodig.',
            decided_by_id=self.owner.id,
        )
        self.assertEqual(
            get_evaluation_nba_code(self.intake), 'provider_requested_more_info'
        )

    def test_nba_ready_for_placement_overrides_rejected(self):
        """After a reject followed by an accept, ready_for_placement wins."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.MISSING_INFORMATION,
            decided_by_id=self.owner.id,
        )
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by_id=self.owner.id,
        )
        self.assertEqual(get_evaluation_nba_code(self.intake), 'ready_for_placement')


class ProviderEvaluationViewTests(TestCase):
    """Integration tests for the provider evaluation HTTP endpoints."""

    def setUp(self):
        self.client = Client()
        self.owner = User.objects.create_user(
            username='eval_view_owner',
            email='eval_view_owner@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(
            name='Eval View Org', slug='eval-view-org'
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='View Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.owner,
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='View Eval Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.owner,
            assessment_summary='View test intake',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )
        CaseAssessment.objects.create(
            intake=self.intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.owner,
        )
        self.placement = PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=self.intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )
        self.client.login(username='eval_view_owner', password='testpass123')

    def _eval_action_url(self):
        return reverse('careon:case_provider_evaluation_action', kwargs={'pk': self.intake.pk})

    def _eval_view_url(self):
        return reverse('careon:case_provider_evaluation', kwargs={'pk': self.intake.pk})

    def test_evaluation_page_renders_for_authenticated_user(self):
        response = self.client.get(self._eval_view_url())
        self.assertEqual(response.status_code, 200)

    def test_accept_via_post_creates_evaluation(self):
        response = self.client.post(
            self._eval_action_url(),
            data={'decision': 'accept'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            ProviderEvaluation.objects.filter(
                case=self.intake,
                decision=ProviderEvaluation.Decision.ACCEPT,
            ).exists()
        )

    def test_reject_via_post_creates_evaluation_with_reason_code(self):
        response = self.client.post(
            self._eval_action_url(),
            data={
                'decision': 'reject',
                'reason_code': ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH,
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            ProviderEvaluation.objects.filter(
                case=self.intake,
                decision=ProviderEvaluation.Decision.REJECT,
                reason_code=ProviderEvaluation.RejectionCode.SPECIALIZATION_MISMATCH,
            ).exists()
        )

    def test_reject_without_reason_code_shows_error_message(self):
        response = self.client.post(
            self._eval_action_url(),
            data={'decision': 'reject', 'reason_code': ''},
        )
        # On validation error the view redirects with an error flash message
        self.assertEqual(response.status_code, 302)
        self.assertFalse(
            ProviderEvaluation.objects.filter(case=self.intake).exists()
        )

    def test_needs_more_info_via_post(self):
        response = self.client.post(
            self._eval_action_url(),
            data={
                'decision': 'needs_more_info',
                'requested_info': 'Diagnose-document ontbreekt.',
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(
            ProviderEvaluation.objects.filter(
                case=self.intake,
                decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            ).exists()
        )

    def test_needs_more_info_without_requested_info_shows_error(self):
        response = self.client.post(
            self._eval_action_url(),
            data={'decision': 'needs_more_info', 'requested_info': ''},
        )
        # On validation error the view redirects with an error flash message
        self.assertEqual(response.status_code, 302)
        self.assertFalse(
            ProviderEvaluation.objects.filter(case=self.intake).exists()
        )

    def test_unauthenticated_user_is_redirected(self):
        self.client.logout()
        response = self.client.get(self._eval_view_url())
        self.assertIn(response.status_code, [302, 403])

    def test_capacity_flag_is_persisted(self):
        self.client.post(
            self._eval_action_url(),
            data={'decision': 'accept', 'capacity_flag': '1'},
        )
        evaluation = ProviderEvaluation.objects.filter(case=self.intake).first()
        self.assertIsNotNone(evaluation)
        self.assertTrue(evaluation.capacity_flag)

    def test_risk_notes_are_persisted(self):
        self.client.post(
            self._eval_action_url(),
            data={'decision': 'accept', 'risk_notes': 'Bijzonder veiligheidrisico'},
        )
        evaluation = ProviderEvaluation.objects.filter(case=self.intake).first()
        self.assertIsNotNone(evaluation)
        self.assertIn('veiligheidrisico', evaluation.risk_notes)
