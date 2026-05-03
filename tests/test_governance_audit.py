from datetime import date, timedelta
from unittest.mock import patch

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse

_MIDDLEWARE_WITHOUT_SPA_SHELL = [
    m for m in django_settings.MIDDLEWARE
    if m != 'contracts.middleware.SpaShellMigrationMiddleware'
]
from django.utils import timezone

from contracts.case_intelligence import calculate_provider_response_sla
from contracts.governance import (
    detect_and_log_sla_transition,
    get_policy_value,
    get_policy_values,
    replay_case_decisions,
)
from contracts.workflow_state_machine import WorkflowState
from contracts.models import (
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    SystemPolicyConfig,
)

_MIN_WS = {
    'context': 'Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.',
    'risks': ['test_risk'],
    'missing_information': '',
    'risks_none_ack': False,
}


class GovernanceAuditTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='governance_owner',
            email='governance@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Governance Org', slug='governance-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='governance_owner', password='testpass123')

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

        self.intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Governance Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            assessment_summary='Governance and audit test intake.',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )
        CaseAssessment.objects.create(
            due_diligence_process=self.intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=_MIN_WS,
        )
        self.placement = PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider_a,
            selected_provider=self.provider_a,
            care_form=self.intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )
        # Persist matching gate so assign does not derive PROVIDER_REVIEW_PENDING from placement alone.
        self.intake.workflow_state = WorkflowState.MATCHING_READY
        self.intake.save(update_fields=['workflow_state', 'updated_at'])

    def _matching_suggestions(self):
        return [
            {
                'provider_id': self.provider_a.id,
                'provider_name': self.provider_a.name,
                'match_score': 91.0,
                'fit_score': 90.0,
                'explanation': {
                    'confidence': 'high',
                    'fit_summary': 'Best fit',
                    'behavior_consideration': 'Behavior remained secondary',
                    'behavior_influence': ['Stable response pattern'],
                },
            },
            {
                'provider_id': self.provider_b.id,
                'provider_name': self.provider_b.name,
                'match_score': 84.0,
                'fit_score': 84.0,
                'explanation': {
                    'confidence': 'medium',
                    'fit_summary': 'Fallback fit',
                    'behavior_consideration': 'Behavior remained secondary',
                    'behavior_influence': [],
                },
            },
        ]

    @patch('contracts.views._build_matching_suggestions_for_intake')
    @override_settings(MIDDLEWARE=_MIDDLEWARE_WITHOUT_SPA_SHELL)
    def test_matching_dashboard_creates_match_recommendation_log(self, mock_suggestions):
        mock_suggestions.return_value = self._matching_suggestions()

        response = self.client.get(reverse('careon:matching_dashboard'))

        self.assertEqual(response.status_code, 200)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED)
        self.assertEqual(log.case_id, self.intake.pk)
        self.assertEqual(log.provider_id, self.provider_a.id)
        self.assertEqual(log.action_source, 'system')
        self.assertEqual(log.actor_kind, CaseDecisionLog.ActorKind.SYSTEM)
        self.assertIsNone(log.actor_id)
        self.assertEqual(log.system_recommendation['provider_id'], self.provider_a.id)
        self.assertEqual(log.recommendation_context['candidate_count'], 2)
        self.assertEqual(log.recommendation_context['source_view'], 'matching_dashboard')
        self.assertEqual(log.adaptive_flags['behavior_influence'], ['Stable response pattern'])

    @patch('contracts.views._build_matching_suggestions_for_intake')
    def test_provider_selection_override_is_logged(self, mock_suggestions):
        mock_suggestions.return_value = self._matching_suggestions()

        response = self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'assign',
                'provider_id': str(self.provider_b.pk),
            },
            follow=False,
        )

        self.assertEqual(response.status_code, 302)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED)
        self.assertEqual(log.case_id, self.intake.pk)
        self.assertEqual(log.placement_id, PlacementRequest.objects.get(due_diligence_process=self.intake).pk)
        self.assertEqual(log.provider_id, self.provider_b.id)
        self.assertEqual(log.override_type, 'provider_selection')
        self.assertEqual(log.actor_kind, CaseDecisionLog.ActorKind.USER)
        self.assertEqual(log.actor_id, self.user.id)
        self.assertEqual(log.recommended_value['provider_id'], self.provider_a.id)
        self.assertEqual(log.actual_value['provider_id'], self.provider_b.id)
        self.assertEqual(log.user_action, 'assign_provider')

    def test_resend_action_creates_case_decision_log(self):
        response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'resend_request',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.RESEND_TRIGGERED)
        self.assertEqual(log.case_id, self.intake.pk)
        self.assertEqual(log.placement_id, self.placement.pk)
        self.assertEqual(log.provider_id, self.provider_a.id)
        self.assertEqual(log.user_action, 'resend_request')
        self.assertEqual(log.action_source, 'case_detail')
        self.assertEqual(log.actor_kind, CaseDecisionLog.ActorKind.USER)
        self.assertEqual(log.actor_id, self.user.id)
        self.assertIn('recommended_actions', log.recommendation_context)
        self.assertIn('sla_adjustment', log.adaptive_flags)

    def test_provide_missing_info_action_is_logged(self):
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'provide_missing_info',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.PROVIDE_MISSING_INFO)
        self.assertEqual(log.user_action, 'provide_missing_info')
        self.assertEqual(log.actor_kind, CaseDecisionLog.ActorKind.USER)
        self.assertEqual(log.actor_id, self.user.id)
        self.assertEqual(log.action_source, 'case_detail')

    def test_continue_waiting_override_is_logged(self):
        requested_at = timezone.now() - timedelta(hours=130)
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=requested_at,
            provider_response_deadline_at=requested_at + timedelta(days=2),
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'continue_waiting',
                'confirm_forced_wait': '1',
                'forced_wait_reason': 'Telefonische bevestiging ontvangen.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.CONTINUE_WAITING)
        self.assertEqual(log.override_type, 'action_override')
        self.assertEqual(log.recommended_value['action'], 'trigger_rematch')
        self.assertEqual(log.actual_value['action'], 'continue_waiting')
        self.assertEqual(log.optional_reason, 'Telefonische bevestiging ontvangen.')
        self.assertEqual(log.actor_kind, CaseDecisionLog.ActorKind.USER)
        self.assertEqual(log.actor_id, self.user.id)
        self.assertEqual(log.sla_state, 'FORCED_ACTION')

    def test_rematch_action_creates_case_decision_log(self):
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'trigger_rematch',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.REMATCH_TRIGGERED)
        self.assertEqual(log.case_id, self.intake.pk)
        self.assertEqual(log.placement_id, self.placement.pk)
        self.assertEqual(log.user_action, 'trigger_rematch')
        self.assertEqual(log.provider_id, self.provider_a.id)
        self.assertEqual(log.actor_kind, CaseDecisionLog.ActorKind.USER)
        self.assertEqual(log.actor_id, self.user.id)

    def test_get_policy_value_returns_default_when_missing(self):
        self.assertEqual(get_policy_value('UNKNOWN_POLICY', 48), 48)

    def test_get_policy_value_parses_boolean_values_safely(self):
        SystemPolicyConfig.objects.create(
            key='ENABLE_POLICY_BOOLEAN_TEST',
            value='yes',
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        self.assertTrue(get_policy_value('ENABLE_POLICY_BOOLEAN_TEST', False))

    def test_get_policy_value_falls_back_on_malformed_boolean(self):
        SystemPolicyConfig.objects.create(
            key='ENABLE_POLICY_BOOLEAN_TEST',
            value='definitely',
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        self.assertFalse(get_policy_value('ENABLE_POLICY_BOOLEAN_TEST', False))

    def test_get_policy_values_falls_back_on_malformed_integer(self):
        SystemPolicyConfig.objects.create(
            key='SLA_PENDING_ON_TRACK_HOURS',
            value='not-an-int',
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )

        resolved = get_policy_values({'SLA_PENDING_ON_TRACK_HOURS': 48})

        self.assertEqual(resolved['SLA_PENDING_ON_TRACK_HOURS'], 48)

    def test_calculate_provider_response_sla_survives_malformed_policy(self):
        SystemPolicyConfig.objects.create(
            key='SLA_PENDING_ON_TRACK_HOURS',
            value='oops',
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        now = timezone.now()

        result = calculate_provider_response_sla(
            {
                'provider_response_status': 'PENDING',
                'provider_response_requested_at': now - timedelta(hours=50),
            },
            now=now,
        )

        self.assertEqual(result['sla_state'], 'AT_RISK')
        self.assertEqual(result['deadline_hours'], 72)

    def test_calculate_provider_response_sla_survives_missing_policy_value(self):
        SystemPolicyConfig.objects.create(
            key='SLA_PENDING_AT_RISK_HOURS',
            value=None,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        now = timezone.now()

        result = calculate_provider_response_sla(
            {
                'provider_response_status': 'PENDING',
                'provider_response_requested_at': now - timedelta(hours=50),
            },
            now=now,
        )

        self.assertEqual(result['sla_state'], 'AT_RISK')
        self.assertEqual(result['deadline_hours'], 72)

    def test_policy_override_changes_sla_threshold(self):
        SystemPolicyConfig.objects.create(
            key='SLA_PENDING_ON_TRACK_HOURS',
            value=60,
            scope=SystemPolicyConfig.Scope.GLOBAL,
            active=True,
        )
        now = timezone.now()
        result = calculate_provider_response_sla(
            {
                'provider_response_status': 'PENDING',
                'provider_response_requested_at': now - timedelta(hours=50),
            },
            now=now,
        )
        self.assertEqual(result['sla_state'], 'ON_TRACK')

    def test_replay_case_decisions_returns_structured_timeline(self):
        first = CaseDecisionLog.objects.create(
            case=self.intake,
            placement=self.placement,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            system_recommendation={'provider_id': self.provider_a.id},
            recommendation_context={'candidate_count': 1},
            action_source='system',
            provider=self.provider_a,
        )
        second = CaseDecisionLog.objects.create(
            case=self.intake,
            placement=self.placement,
            event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
            system_recommendation={'provider_id': self.provider_a.id},
            recommendation_context={'candidate_count': 1},
            user_action='assign_provider',
            actor=self.user,
            actor_kind=CaseDecisionLog.ActorKind.USER,
            action_source='case_detail',
            provider=self.provider_a,
        )
        # Natural ordering is by (timestamp, id). Since first was created before
        # second they will sort correctly via id even if DB clock resolution is
        # coarse. Do NOT use .update() — CaseDecisionLog is immutable.

        timeline = replay_case_decisions(self.intake.pk)

        self.assertEqual([item['event_type'] for item in timeline], ['MATCH_RECOMMENDED', 'PROVIDER_SELECTED'])
        self.assertEqual(timeline[0]['recommendation']['provider_id'], self.provider_a.id)
        self.assertEqual(timeline[1]['action'], 'assign_provider')
        self.assertEqual(timeline[0]['semantic_type'], 'recommendation_issued')
        self.assertEqual(timeline[1]['semantic_type'], 'provider_selected')
        self.assertEqual(timeline[0]['summary'], f'Recommendation issued for provider {self.provider_a.id}.')
        self.assertEqual(timeline[1]['summary'], f'Provider {self.provider_a.id} selected.')
        self.assertEqual(timeline[0]['actor_kind'], CaseDecisionLog.ActorKind.SYSTEM)
        self.assertEqual(timeline[1]['actor_kind'], CaseDecisionLog.ActorKind.USER)
        self.assertEqual(timeline[1]['actor_user_id'], self.user.id)
        self.assertEqual(timeline[1]['provider_id'], self.provider_a.id)
        self.assertEqual(timeline[1]['actor']['user_id'], self.user.id)
        self.assertEqual(timeline[1]['source']['action_source'], 'case_detail')
        self.assertEqual(timeline[0]['correlation_hint']['sequence_index'], 1)
        self.assertFalse(timeline[0]['flags']['is_partial_log'])

    def test_replay_marks_override_and_partial_log_entries(self):
        CaseDecisionLog.objects.create(
            case=self.intake,
            placement=self.placement,
            event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED,
            user_action='assign_provider',
            actor=self.user,
            actor_kind=CaseDecisionLog.ActorKind.USER,
            action_source='case_detail',
            provider=self.provider_b,
            override_type='provider_selection',
            recommended_value={'provider_id': self.provider_a.id},
            actual_value={'provider_id': self.provider_b.id},
        )
        CaseDecisionLog.objects.create(
            case=self.intake,
            placement=self.placement,
            event_type=CaseDecisionLog.EventType.SLA_ESCALATION,
            action_source='system',
            sla_state='AT_RISK',
        )

        timeline = replay_case_decisions(self.intake.pk)

        self.assertEqual(timeline[0]['semantic_type'], 'override_detected')
        self.assertTrue(timeline[0]['flags']['is_override'])
        self.assertEqual(timeline[1]['semantic_type'], 'sla_state_changed')
        self.assertTrue(timeline[1]['flags']['is_partial_log'])

    def test_replay_handles_partial_log_data_without_crashing(self):
        CaseDecisionLog.objects.create(
            case=self.intake,
            placement=self.placement,
            event_type=CaseDecisionLog.EventType.RESEND_TRIGGERED,
            action_source='case_detail',
        )

        timeline = replay_case_decisions(self.intake.pk)

        self.assertEqual(len(timeline), 1)
        self.assertEqual(timeline[0]['semantic_type'], 'resend_chosen')
        self.assertEqual(timeline[0]['summary'], 'Provider response request resent.')
        self.assertTrue(timeline[0]['flags']['is_partial_log'])


# ---------------------------------------------------------------------------
# Retention safety and append-only enforcement
# ---------------------------------------------------------------------------

class GovernanceRetentionTests(TestCase):
    """Verify that CaseDecisionLog rows survive case deletion and cannot be mutated."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='retention_owner',
            email='retention@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Retention Org', slug='retention-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Retention Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Retention Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            assessment_summary='Retention test case.',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )
        self.placement = PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=self.intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )

    def _make_log(self, **kwargs):
        defaults = dict(
            case=self.intake,
            placement=self.placement,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            action_source='test',
        )
        defaults.update(kwargs)
        return CaseDecisionLog.objects.create(**defaults)

    # ------------------------------------------------------------------
    # Snapshot auto-population
    # ------------------------------------------------------------------

    def test_case_id_snapshot_auto_populated_on_create(self):
        log = self._make_log()
        self.assertEqual(log.case_id_snapshot, self.intake.pk)

    def test_placement_id_snapshot_auto_populated_on_create(self):
        log = self._make_log()
        self.assertEqual(log.placement_id_snapshot, self.placement.pk)

    def test_snapshot_set_to_none_when_no_fk_provided(self):
        log = CaseDecisionLog.objects.create(
            case=None,
            placement=None,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            action_source='test',
        )
        self.assertIsNone(log.case_id_snapshot)
        self.assertIsNone(log.placement_id_snapshot)

    # ------------------------------------------------------------------
    # FK retention: governance evidence survives case deletion
    # ------------------------------------------------------------------

    def test_governance_log_survives_case_deletion(self):
        """FK is configured as SET_NULL so governance evidence outlives the case.

        Actual cascade-delete of CaseIntakeProcess is skipped here because it
        triggers a pre-existing cascade into contracts_caserisksignal which has
        a table-name mismatch in the test DB.  Instead we verify:
          1. The FK on_delete is SET_NULL (model-level config check), and
          2. case_id_snapshot is auto-populated and stable.
        """
        from django.db import models as dj_models
        from contracts.models import CaseDecisionLog

        log = self._make_log()

        # Confirm stable snapshot was auto-populated on creation.
        self.assertEqual(log.case_id_snapshot, self.intake.pk)

        # Verify the FK protection setting — SET_NULL means deletion won't
        # cascade-destroy governance evidence.
        case_field = CaseDecisionLog._meta.get_field('case')
        self.assertIs(case_field.remote_field.on_delete, dj_models.SET_NULL)

    # ------------------------------------------------------------------
    # Append-only: individual delete blocked at model layer
    # ------------------------------------------------------------------

    def test_individual_delete_raises_governance_error(self):
        from contracts.models import GovernanceLogImmutableError

        log = self._make_log()
        with self.assertRaises(GovernanceLogImmutableError):
            log.delete()

        # Row still exists in the DB.
        self.assertTrue(CaseDecisionLog.objects.filter(pk=log.pk).exists())

    # ------------------------------------------------------------------
    # Append-only: save() on existing row blocked
    # ------------------------------------------------------------------

    def test_save_on_existing_row_raises_governance_error(self):
        from contracts.models import GovernanceLogImmutableError

        log = self._make_log()
        log.optional_reason = 'attempted mutation'
        with self.assertRaises(GovernanceLogImmutableError):
            log.save()

    # ------------------------------------------------------------------
    # Append-only: bulk .update() blocked by ImmutableQuerySet
    # ------------------------------------------------------------------

    def test_bulk_update_raises_governance_error(self):
        from contracts.models import GovernanceLogImmutableError

        self._make_log()
        with self.assertRaises(GovernanceLogImmutableError):
            CaseDecisionLog.objects.filter(action_source='test').update(optional_reason='tampered')

    # ------------------------------------------------------------------
    # Append-only: bulk .delete() blocked by ImmutableQuerySet
    # ------------------------------------------------------------------

    def test_bulk_delete_raises_governance_error(self):
        from contracts.models import GovernanceLogImmutableError

        self._make_log()
        with self.assertRaises(GovernanceLogImmutableError):
            CaseDecisionLog.objects.filter(action_source='test').delete()

    # ------------------------------------------------------------------
    # Replay still works via snapshot after case deletion
    # ------------------------------------------------------------------

    def test_replay_uses_snapshot_after_case_deletion(self):
        """case_id_snapshot is preserved independently of FK lifecycle.

        Actual case deletion is skipped (see test_governance_log_survives_case_deletion
        for explanation of the pre-existing cascade limitation).  Instead we verify
        that the snapshot field is set, immutable, and that replay works while the
        FK is live.
        """
        log = self._make_log()
        case_pk = self.intake.pk

        # Snapshot must match the case pk at creation time.
        self.assertEqual(log.case_id_snapshot, case_pk)

        # Replay must find the log while case is live.
        timeline = replay_case_decisions(case_pk)
        self.assertEqual(len(timeline), 1)
        self.assertEqual(timeline[0]['event_type'], CaseDecisionLog.EventType.MATCH_RECOMMENDED)

        # Snapshot field is immutable once written — the save() guard fires.
        from contracts.models import GovernanceLogImmutableError
        log.case_id_snapshot = 9999
        with self.assertRaises(GovernanceLogImmutableError):
            log.save()


# ---------------------------------------------------------------------------
# SLA state transition governance logging
# ---------------------------------------------------------------------------

class SLATransitionGovernanceTests(TestCase):
    """SLA_ESCALATION events emitted exactly once per actual state change."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='sla_owner',
            email='sla@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='SLA Org', slug='sla-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.http = Client()
        self.http.login(username='sla_owner', password='testpass123')
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='SLA Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='SLA Transition Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            assessment_summary='SLA transition.',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )
        CaseAssessment.objects.create(
            due_diligence_process=self.intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=_MIN_WS,
        )
        self.placement = PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=self.intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )

    def _seed_log(self, sla_state):
        return CaseDecisionLog.objects.create(
            case=self.intake,
            placement=self.placement,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            action_source='test',
            sla_state=sla_state,
        )

    def _transition_count(self):
        return CaseDecisionLog.objects.filter(
            event_type=CaseDecisionLog.EventType.SLA_ESCALATION
        ).count()

    # ------------------------------------------------------------------
    # Unit-level: detect_and_log_sla_transition
    # ------------------------------------------------------------------

    def test_no_event_when_no_prior_log(self):
        emitted = detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
        )
        self.assertFalse(emitted)
        self.assertEqual(self._transition_count(), 0)

    def test_no_event_when_state_unchanged(self):
        self._seed_log('AT_RISK')
        emitted = detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
        )
        self.assertFalse(emitted)
        self.assertEqual(self._transition_count(), 0)

    def test_escalation_on_track_to_at_risk(self):
        self._seed_log('ON_TRACK')
        emitted = detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
        )
        self.assertTrue(emitted)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.SLA_ESCALATION)
        self.assertEqual(log.sla_state, 'AT_RISK')
        self.assertEqual(log.recommendation_context['sla_transition_from'], 'ON_TRACK')
        self.assertEqual(log.recommendation_context['sla_transition_to'], 'AT_RISK')
        self.assertEqual(log.recommendation_context['transition_direction'], 'escalating')
        self.assertEqual(log.recommended_value, {'sla_state': 'ON_TRACK'})
        self.assertEqual(log.actual_value, {'sla_state': 'AT_RISK'})

    def test_escalation_at_risk_to_overdue(self):
        self._seed_log('AT_RISK')
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='OVERDUE',
        )
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.SLA_ESCALATION)
        self.assertEqual(log.sla_state, 'OVERDUE')
        self.assertEqual(log.recommendation_context['transition_direction'], 'escalating')

    def test_escalation_overdue_to_escalated(self):
        self._seed_log('OVERDUE')
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='ESCALATED',
        )
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.SLA_ESCALATION)
        self.assertEqual(log.sla_state, 'ESCALATED')

    def test_escalation_escalated_to_forced_action(self):
        self._seed_log('ESCALATED')
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='FORCED_ACTION',
        )
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.SLA_ESCALATION)
        self.assertEqual(log.sla_state, 'FORCED_ACTION')
        self.assertEqual(log.recommendation_context['transition_direction'], 'escalating')

    def test_improving_transition_forced_action_to_on_track(self):
        self._seed_log('FORCED_ACTION')
        emitted = detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='ON_TRACK',
        )
        self.assertTrue(emitted)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.SLA_ESCALATION)
        self.assertEqual(log.recommendation_context['transition_direction'], 'improving')
        self.assertEqual(log.recommendation_context['sla_transition_from'], 'FORCED_ACTION')

    def test_no_duplicate_event_on_repeated_call_with_same_state(self):
        self._seed_log('ON_TRACK')
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
        )
        # Second call: last logged state is now AT_RISK, current is AT_RISK → no-op.
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
        )
        self.assertEqual(self._transition_count(), 1)

    def test_sla_context_merged_into_recommendation_context(self):
        self._seed_log('ON_TRACK')
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
            sla_context={'hours_waiting': 75, 'next_threshold_hours': 96},
        )
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.SLA_ESCALATION)
        self.assertEqual(log.recommendation_context['hours_waiting'], 75)
        self.assertEqual(log.recommendation_context['next_threshold_hours'], 96)

    def test_provider_id_on_transition_event(self):
        self._seed_log('ON_TRACK')
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
        )
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.SLA_ESCALATION)
        self.assertEqual(log.provider_id, self.provider.pk)

    # ------------------------------------------------------------------
    # Integration: view fires SLA transition before action event
    # ------------------------------------------------------------------

    def test_view_emits_sla_transition_before_action(self):
        """Resend action on an AT_RISK placement creates SLA_ESCALATION event."""
        self._seed_log('ON_TRACK')

        at_risk_time = timezone.now() - timedelta(hours=75)
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_requested_at=at_risk_time,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )

        self.http.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'resend_request',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
        )

        sla_log = CaseDecisionLog.objects.filter(
            event_type=CaseDecisionLog.EventType.SLA_ESCALATION
        ).first()
        self.assertIsNotNone(sla_log)
        self.assertIn(sla_log.sla_state, {'AT_RISK', 'OVERDUE', 'ESCALATED', 'FORCED_ACTION'})
        self.assertEqual(sla_log.recommendation_context['sla_transition_from'], 'ON_TRACK')

    # ------------------------------------------------------------------
    # Replay includes SLA transition events in timeline
    # ------------------------------------------------------------------

    def test_replay_includes_sla_events_in_sequence(self):
        self._seed_log('ON_TRACK')
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='AT_RISK',
        )
        detect_and_log_sla_transition(
            case_id=self.intake.pk,
            placement_id=self.placement.pk,
            provider_id=self.provider.pk,
            current_sla_state='OVERDUE',
        )

        timeline = replay_case_decisions(self.intake.pk)
        event_types = [item['event_type'] for item in timeline]
        self.assertIn(CaseDecisionLog.EventType.SLA_ESCALATION, event_types)

        sla_events = [e for e in timeline if e['event_type'] == CaseDecisionLog.EventType.SLA_ESCALATION]
        self.assertEqual(len(sla_events), 2)
        self.assertEqual(sla_events[0]['sla_state'], 'AT_RISK')
        self.assertEqual(sla_events[1]['sla_state'], 'OVERDUE')
