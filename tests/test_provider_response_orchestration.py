from datetime import date, timedelta

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse

_MIDDLEWARE_WITHOUT_SPA_SHELL = [
    m for m in django_settings.MIDDLEWARE
    if m != 'contracts.middleware.SpaShellMigrationMiddleware'
]
from django.utils import timezone

from contracts.models import (
    AuditLog,
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareProvider,
    OutcomeReasonCode,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    UserProfile,
)
from contracts.workflow_state_machine import WorkflowState


@override_settings(MIDDLEWARE=_MIDDLEWARE_WITHOUT_SPA_SHELL)
class ProviderResponseOrchestrationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.owner = User.objects.create_user(
            username='provider_owner',
            email='owner@example.com',
            password='testpass123',
        )
        self.member = User.objects.create_user(
            username='provider_member',
            email='member@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Provider Response Org', slug='provider-response-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.member,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )

        self.provider_actor = User.objects.create_user(
            username='provider_actor',
            email='actor@example.com',
            password='testpass123',
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.provider_actor,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.create(user=self.provider_actor, role=UserProfile.Role.CLIENT)

        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Response Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.owner,
        )
        self.provider.responsible_coordinator = self.provider_actor
        self.provider.save(update_fields=['responsible_coordinator', 'updated_at'])
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Provider Orchestration Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.owner,
            assessment_summary='Casus voor providerrespons orchestration.',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )
        CaseAssessment.objects.create(
            due_diligence_process=self.intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.owner,
            workflow_summary={
                'context': 'Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.',
                'risks': ['test_risk'],
                'missing_information': '',
                'risks_none_ack': False,
            },
        )
        self.placement = PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=self.intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            decision_notes='Bestaande besluitnotitie',
        )

    def _login_owner(self):
        self.client.login(username='provider_owner', password='testpass123')

    def _login_provider_actor(self):
        self.client.login(username='provider_actor', password='testpass123')

    def _assert_no_provider_response_mutation(self, before, after):
        self.assertEqual(before.provider_response_status, after.provider_response_status)
        self.assertEqual(before.provider_response_requested_at, after.provider_response_requested_at)
        self.assertEqual(before.provider_response_last_reminder_at, after.provider_response_last_reminder_at)
        self.assertEqual(before.provider_response_deadline_at, after.provider_response_deadline_at)
        self.assertEqual(before.provider_response_notes, after.provider_response_notes)

    def _post_action(self, action, follow=True):
        return self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': action,
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=follow,
        )

    def test_resend_allowed_when_provider_response_pending(self):
        self._login_owner()
        before_status = self.placement.status
        before_intake_status = self.intake.status

        response = self._post_action('resend_request', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Verzoek opnieuw verstuurd naar aanbieder')
        self.placement.refresh_from_db()
        self.intake.refresh_from_db()

        self.assertEqual(self.placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertIsNotNone(self.placement.provider_response_requested_at)
        self.assertIsNotNone(self.placement.provider_response_last_reminder_at)
        self.assertIsNotNone(self.placement.provider_response_deadline_at)
        self.assertEqual(self.placement.status, before_status)
        self.assertEqual(self.intake.status, before_intake_status)
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__provider_response_action='resend_request',
                changes__provider_response_due_days=3,
            ).exists()
        )

    def test_resend_accepts_safe_monitor_next_redirect(self):
        self._login_owner()
        response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'resend_request',
                'next': f"{reverse('careon:provider_response_monitor')}?q=Provider+Orchestration+Intake&sort=urgency",
            },
            follow=False,
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response['Location'],
            f"{reverse('careon:provider_response_monitor')}?q=Provider+Orchestration+Intake&sort=urgency",
        )

    def test_resend_blocked_when_provider_response_accepted(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            provider_response_requested_at=timezone.now() - timedelta(days=2),
        )
        before = PlacementRequest.objects.get(pk=self.placement.pk)

        response = self._post_action('resend_request', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Herinnering is alleen toegestaan voor open providerreacties.')
        after = PlacementRequest.objects.get(pk=self.placement.pk)
        self._assert_no_provider_response_mutation(before, after)
        self.assertFalse(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__provider_response_action='resend_request',
                timestamp__gte=timezone.now() - timedelta(minutes=1),
            ).exists()
        )

    def test_provide_info_allowed_when_provider_response_needs_info(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            provider_response_notes='Bestaande notitie',
        )

        response = self._post_action('provide_info', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Aanvullende informatie geregistreerd en providerreactie opnieuw opengezet.')
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertIsNotNone(self.placement.provider_response_requested_at)
        self.assertIsNotNone(self.placement.provider_response_deadline_at)
        self.assertIn('Bestaande notitie', self.placement.provider_response_notes)
        self.assertIn('Aanvullende informatie aangeleverd', self.placement.provider_response_notes)
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__provider_response_action='provide_missing_info',
            ).exists()
        )

    def test_provide_info_blocked_when_response_is_not_needs_info(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )
        before = PlacementRequest.objects.get(pk=self.placement.pk)

        response = self._post_action('provide_info', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Aanvullende informatie kan alleen worden geregistreerd')
        after = PlacementRequest.objects.get(pk=self.placement.pk)
        self._assert_no_provider_response_mutation(before, after)

    def test_rematch_allowed_when_provider_response_rejected(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
            status=PlacementRequest.Status.IN_REVIEW,
        )
        initial_notes = PlacementRequest.objects.get(pk=self.placement.pk).decision_notes

        response = self._post_action('rematch', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Her-match geactiveerd. Casus staat weer in matchingfase.')
        self.placement.refresh_from_db()
        self.intake.refresh_from_db()

        self.assertEqual(self.placement.status, PlacementRequest.Status.REJECTED)
        self.assertEqual(self.intake.status, CaseIntakeProcess.ProcessStatus.MATCHING)
        self.assertIn(initial_notes, self.placement.decision_notes)
        self.assertIn('Her-match gestart vanuit providerreactie-orchestratie.', self.placement.decision_notes)
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__provider_response_action='trigger_rematch',
                changes__intake_status=CaseIntakeProcess.ProcessStatus.MATCHING,
            ).exists()
        )

    def test_rematch_allowed_when_provider_response_no_capacity(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self._post_action('trigger_rematch', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Her-match geactiveerd. Casus staat weer in matchingfase.')
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.status, PlacementRequest.Status.REJECTED)

    def test_rematch_allowed_when_provider_response_waitlist(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.WAITLIST,
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self._post_action('rematch', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Her-match geactiveerd. Casus staat weer in matchingfase.')
        self.placement.refresh_from_db()
        self.intake.refresh_from_db()
        self.assertEqual(self.placement.status, PlacementRequest.Status.REJECTED)
        self.assertEqual(self.intake.status, CaseIntakeProcess.ProcessStatus.MATCHING)

    def test_rematch_blocked_when_response_accepted(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            status=PlacementRequest.Status.IN_REVIEW,
        )
        before_status = PlacementRequest.objects.get(pk=self.placement.pk).status

        response = self._post_action('rematch', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Her-match alleen na afwijzing, geen capaciteit, wachtlijst of SLA FORCED_ACTION.')
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.status, before_status)

    def test_invalid_action_rejected_safely(self):
        self._login_owner()
        before = PlacementRequest.objects.get(pk=self.placement.pk)
        before_intake_status = self.intake.status

        response = self._post_action('totally_unknown_action', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Onbekende providerreactie-actie.')
        after = PlacementRequest.objects.get(pk=self.placement.pk)
        self._assert_no_provider_response_mutation(before, after)
        self.intake.refresh_from_db()
        self.assertEqual(self.intake.status, before_intake_status)

    def test_action_rejected_safely_when_no_placement_exists(self):
        self._login_owner()
        self.placement.delete()

        response = self._post_action('resend_request', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Nog geen plaatsing beschikbaar. Start eerst via matching.')
        self.assertFalse(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                timestamp__gte=timezone.now() - timedelta(minutes=1),
            ).exists()
        )

    def test_provider_response_reject_requires_reason_and_persists_when_valid(self):
        self.intake.case_coordinator = self.provider_actor
        self.intake.save(update_fields=['case_coordinator', 'updated_at'])
        self._login_provider_actor()
        before = PlacementRequest.objects.get(pk=self.placement.pk)

        missing_reason_response = self.client.post(
            reverse('careon:case_outcome_action', kwargs={'pk': self.intake.pk}),
            {
                'outcome_type': 'provider_response',
                'status': PlacementRequest.ProviderResponseStatus.REJECTED,
                'reason_code': OutcomeReasonCode.NONE,
                'notes': 'Aanbieder heeft afgewezen zonder reden.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(missing_reason_response.status_code, 200)
        self.assertContains(missing_reason_response, 'Afwijzing vereist een reden.')
        after_missing_reason = PlacementRequest.objects.get(pk=self.placement.pk)
        self._assert_no_provider_response_mutation(before, after_missing_reason)

        valid_response = self.client.post(
            reverse('careon:case_outcome_action', kwargs={'pk': self.intake.pk}),
            {
                'outcome_type': 'provider_response',
                'status': PlacementRequest.ProviderResponseStatus.REJECTED,
                'reason_code': OutcomeReasonCode.PROVIDER_DECLINED,
                'notes': 'Aanbieder geeft inhoudelijke afwijzing terug.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(valid_response.status_code, 200)
        self.assertContains(valid_response, 'Providerreactie-uitkomst opgeslagen.')
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.provider_response_status, PlacementRequest.ProviderResponseStatus.REJECTED)
        self.assertEqual(self.placement.provider_response_reason_code, OutcomeReasonCode.PROVIDER_DECLINED)
        self.assertEqual(self.placement.provider_response_notes, 'Aanbieder geeft inhoudelijke afwijzing terug.')
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__outcome_type='provider_response',
                changes__status=PlacementRequest.ProviderResponseStatus.REJECTED,
                changes__reason_code=OutcomeReasonCode.PROVIDER_DECLINED,
            ).exists()
        )

    def test_anonymous_or_unauthorized_users_cannot_trigger_actions(self):
        anonymous_response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {'action': 'resend_request'},
        )
        self.assertEqual(anonymous_response.status_code, 302)

        self.client.login(username='provider_member', password='testpass123')
        unauthorized_response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {'action': 'resend_request'},
        )
        self.assertEqual(unauthorized_response.status_code, 403)

    def test_legacy_provider_response_alias_renders_in_case_detail_placement_tab(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status='DECLINED',
        )

        response = self.client.get(
            f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Reacties')
        self.assertContains(response, 'Afgewezen')

    def test_case_detail_provider_response_block_renders_sla_badge_waiting_and_countdown(self):
        self._login_owner()
        requested_at = timezone.now() - timedelta(hours=50)
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=requested_at,
            provider_response_deadline_at=requested_at + timedelta(days=3),
        )

        response = self.client.get(
            f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'SLA AT_RISK')
        self.assertContains(response, 'Wacht: 50 uur')
        self.assertContains(response, 'Regievoerder')
        self.assertContains(response, 'Stuur herinnering')

    def test_forced_action_case_detail_shows_critical_banner_and_rematch_primary(self):
        self._login_owner()
        requested_at = timezone.now() - timedelta(hours=130)
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=requested_at,
            provider_response_deadline_at=requested_at + timedelta(days=2),
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self.client.get(
            f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'FORCED_ACTION')
        self.assertContains(response, 'Acties tijdelijk geblokkeerd')
        actions = response.context['provider_response_actions']
        self.assertGreaterEqual(len(actions), 2)
        self.assertEqual(actions[0]['action'], 'trigger_rematch')
        self.assertEqual(actions[0]['visual_tone'], 'primary')
        self.assertEqual(actions[1]['action'], 'provide_missing_info')
        self.assertTrue(any(action['action'] == 'continue_waiting' for action in actions))

    def test_rematch_allowed_when_forced_action_even_if_status_pending(self):
        self._login_owner()
        requested_at = timezone.now() - timedelta(hours=130)
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=requested_at,
            provider_response_deadline_at=requested_at + timedelta(days=2),
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self._post_action('rematch', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Her-match geactiveerd. Casus staat weer in matchingfase.')
        self.placement.refresh_from_db()
        self.intake.refresh_from_db()
        self.assertEqual(self.placement.status, PlacementRequest.Status.REJECTED)
        self.assertEqual(self.intake.status, CaseIntakeProcess.ProcessStatus.MATCHING)

    def test_continue_waiting_requires_explicit_confirmation_and_is_audited(self):
        self._login_owner()
        requested_at = timezone.now() - timedelta(hours=130)
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=requested_at,
            provider_response_deadline_at=requested_at + timedelta(days=2),
            status=PlacementRequest.Status.IN_REVIEW,
        )

        no_confirm_response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'continue_waiting',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(no_confirm_response.status_code, 200)
        self.assertContains(no_confirm_response, 'Bevestig wachten ondanks SLA FORCED_ACTION.')
        self.assertFalse(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__provider_response_action='continue_waiting_forced_action',
            ).exists()
        )

        confirmed_response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'continue_waiting',
                'confirm_forced_wait': '1',
                'forced_wait_reason': 'Aanbieder bevestigde telefonisch terugkoppeling vandaag.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(confirmed_response.status_code, 200)
        self.assertContains(confirmed_response, 'Wachten ondanks SLA FORCED_ACTION is gelogd.')
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__provider_response_action='continue_waiting_forced_action',
                changes__sla_state='FORCED_ACTION',
            ).exists()
        )

    def test_continue_waiting_not_available_without_forced_action(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=timezone.now() - timedelta(hours=10),
            provider_response_deadline_at=timezone.now() + timedelta(days=2),
        )

        response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'continue_waiting',
                'confirm_forced_wait': '1',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Alleen beschikbaar bij open reacties met SLA FORCED_ACTION.')

    def test_endpoint_actions_work_when_legacy_alias_is_stored(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status='DECLINED',
            status=PlacementRequest.Status.IN_REVIEW,
        )

        response = self._post_action('rematch', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Her-match geactiveerd. Casus staat weer in matchingfase.')
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.status, PlacementRequest.Status.REJECTED)
        self.assertEqual(self.placement.provider_response_status, PlacementRequest.ProviderResponseStatus.REJECTED)

    def test_legacy_no_response_alias_normalizes_and_resend_works(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status='NO_RESPONSE',
            provider_response_requested_at=timezone.now() - timedelta(days=4),
        )

        response = self._post_action('resend', follow=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Verzoek opnieuw verstuurd naar aanbieder')
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertIsNotNone(self.placement.provider_response_requested_at)
        self.assertIsNotNone(self.placement.provider_response_last_reminder_at)

    def test_double_resend_does_not_corrupt_state(self):
        self._login_owner()
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=None,
            provider_response_last_reminder_at=None,
            provider_response_deadline_at=None,
        )

        first_response = self._post_action('resend', follow=True)
        second_response = self._post_action('resend', follow=True)

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.placement.refresh_from_db()
        self.assertEqual(self.placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertIsNotNone(self.placement.provider_response_requested_at)
        self.assertIsNotNone(self.placement.provider_response_last_reminder_at)
        self.assertIsNotNone(self.placement.provider_response_deadline_at)
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                changes__provider_response_action='resend_request',
            ).count() >= 2
        )

    def test_orchestration_end_to_end_delayed_to_rematch_to_acceptance(self):
        self._login_owner()
        delayed_requested_at = timezone.now() - timedelta(days=8)
        PlacementRequest.objects.filter(pk=self.placement.pk).update(
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_response_requested_at=delayed_requested_at,
            provider_response_deadline_at=delayed_requested_at + timedelta(days=2),
            status=PlacementRequest.Status.IN_REVIEW,
        )

        delayed_response = self.client.get(
            f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            follow=True,
        )
        self.assertEqual(delayed_response.status_code, 200)
        self.assertTrue(delayed_response.context['intelligence_flags']['provider_not_responding'])
        self.assertTrue(
            any(action['action'] == 'trigger_rematch' for action in delayed_response.context['provider_response_actions'])
        )

        rematch_response = self._post_action('rematch', follow=True)
        self.assertEqual(rematch_response.status_code, 200)
        self.intake.refresh_from_db()
        self.assertEqual(self.intake.status, CaseIntakeProcess.ProcessStatus.MATCHING)
        self.assertEqual(self.intake.workflow_state, WorkflowState.MATCHING_READY)

        next_placement = PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=self.intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
        )

        provide_info_response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': self.intake.pk}),
            {
                'action': 'provide_info',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': self.intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(provide_info_response.status_code, 200)
        next_placement.refresh_from_db()
        self.assertEqual(next_placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
