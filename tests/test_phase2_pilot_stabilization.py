import json
from datetime import date, timedelta

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse

_MIDDLEWARE_WITHOUT_SPA_SHELL = [
    m for m in django_settings.MIDDLEWARE
    if m != 'contracts.middleware.SpaShellMigrationMiddleware'
]

from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareProvider,
    OutcomeReasonCode,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
    UserProfile,
)


@override_settings(MIDDLEWARE=_MIDDLEWARE_WITHOUT_SPA_SHELL)
class Phase2PilotStabilizationTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.owner = User.objects.create_user(
            username='phase2_owner',
            email='phase2-owner@example.com',
            password='testpass123',
        )
        self.admin = User.objects.create_user(
            username='phase2_admin',
            email='phase2-admin@example.com',
            password='testpass123',
        )
        self.member = User.objects.create_user(
            username='phase2_member',
            email='phase2-member@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Phase 2 Org', slug='phase-2-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.owner,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.admin,
            role=OrganizationMembership.Role.ADMIN,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.member,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        self.provider_actor = User.objects.create_user(
            username='phase2_provider_actor',
            email='phase2-provider-actor@example.com',
            password='testpass123',
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.provider_actor,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.create(user=self.provider_actor, role=UserProfile.Role.CLIENT)

    def _grant_provider_actor_case_edit(self, intake):
        case = intake.case_record
        case.created_by = self.provider_actor
        case.save(update_fields=['created_by', 'updated_at'])

    def _login(self, user):
        self.client.logout()
        self.client.login(username=user.username, password='testpass123')

    def _create_intake_via_api(self, *, title, status=CaseIntakeProcess.ProcessStatus.INTAKE):
        self._login(self.owner)
        bootstrap = self.client.get(reverse('careon:intake_form_options_api'))
        self.assertEqual(bootstrap.status_code, 200)
        payload = bootstrap.json()['initial_values']
        payload.update({
            'title': title,
            'target_completion_date': str(date.today() + timedelta(days=7)),
            'assessment_summary': f'{title} samenvatting',
            'description': f'{title} beschrijving',
            'urgency': CaseIntakeProcess.Urgency.MEDIUM,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'case_coordinator': str(self.owner.pk),
        })
        response = self.client.post(
            reverse('careon:intake_create_api'),
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content.decode())
        intake = CaseIntakeProcess.objects.get(pk=response.json()['id'])
        intake.status = status
        intake.save(update_fields=['status', 'updated_at'])
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.owner,
            workflow_summary={
                'context': 'Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.',
                'urgency': 'MEDIUM',
                'risks': ['test_risk'],
                'missing_information': '',
                'risks_none_ack': False,
            },
        )
        return intake

    def _create_provider(self, name='Phase 2 Provider'):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name=name,
            status=CareProvider.Status.ACTIVE,
            created_by=self.owner,
        )
        provider.responsible_coordinator = self.provider_actor
        provider.save(update_fields=['responsible_coordinator', 'updated_at'])
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=3,
            average_wait_days=7,
        )
        return provider

    def test_acceptance_path_reaches_placement_and_handoff_routes(self):
        intake = self._create_intake_via_api(title='Pilot Accept Casus')
        provider = self._create_provider()

        self._login(self.owner)
        dashboard_response = self.client.get(reverse('dashboard'))
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertContains(dashboard_response, '<div id="root"></div>', html=True)

        case_list_response = self.client.get(reverse('careon:case_list'))
        self.assertEqual(case_list_response.status_code, 200)
        self.assertContains(case_list_response, 'Pilot Accept Casus')

        summary_response = self.client.get(reverse('careon:assessment_decision_api', kwargs={'case_id': intake.contract_id or intake.pk}))
        self.assertEqual(summary_response.status_code, 200)
        summary_payload = summary_response.json()
        self.assertTrue(summary_payload['summary']['matchingReady'])

        matching_response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': provider.pk}),
            content_type='application/json',
        )
        self.assertEqual(matching_response.status_code, 200, matching_response.content.decode())
        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.status, PlacementRequest.Status.IN_REVIEW)

        placement_blocked_response = self.client.post(
            reverse('careon:case_placement_action', kwargs={'pk': intake.pk}),
            {
                'status': PlacementRequest.Status.APPROVED,
                'note': 'Voorbarige bevestiging',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(placement_blocked_response.status_code, 200)
        self.assertContains(
            placement_blocked_response,
            'Plaatsing kan pas worden bevestigd na acceptatie door de aanbieder.',
        )

        self._grant_provider_actor_case_edit(intake)
        self._login(self.provider_actor)
        accept_response = self.client.post(
            reverse('careon:case_outcome_action', kwargs={'pk': intake.pk}),
            {
                'outcome_type': 'provider_response',
                'status': PlacementRequest.ProviderResponseStatus.ACCEPTED,
                'reason_code': OutcomeReasonCode.NONE,
                'notes': 'Aanbieder accepteert de casus.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(accept_response.status_code, 200)
        placement.refresh_from_db()
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.ACCEPTED)

        self._login(self.owner)
        approved_response = self.client.post(
            reverse('careon:case_placement_action', kwargs={'pk': intake.pk}),
            {
                'status': PlacementRequest.Status.APPROVED,
                'note': 'Plaatsing bevestigd na acceptatie.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(approved_response.status_code, 200)
        self.assertContains(approved_response, 'Plaatsing bijgewerkt vanuit de casuswerkruimte.')

        intake_handoff_response = self.client.get(reverse('careon:intake_handoff_list'))
        self.assertEqual(intake_handoff_response.status_code, 200)

        detail_response = self.client.get(f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing")
        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, 'Overdracht')

    def test_rejection_path_requires_reason_and_can_reroute_back_to_matching(self):
        intake = self._create_intake_via_api(title='Pilot Reject Casus')
        provider = self._create_provider('Reject Provider')

        self._login(self.owner)
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': provider.pk}),
            content_type='application/json',
        )

        self._grant_provider_actor_case_edit(intake)
        self._login(self.provider_actor)
        missing_reason_response = self.client.post(
            reverse('careon:case_outcome_action', kwargs={'pk': intake.pk}),
            {
                'outcome_type': 'provider_response',
                'status': PlacementRequest.ProviderResponseStatus.REJECTED,
                'reason_code': OutcomeReasonCode.NONE,
                'notes': 'Afwijzing zonder reden.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(missing_reason_response.status_code, 200)
        self.assertContains(missing_reason_response, 'Afwijzing vereist een reden.')

        reject_response = self.client.post(
            reverse('careon:case_outcome_action', kwargs={'pk': intake.pk}),
            {
                'outcome_type': 'provider_response',
                'status': PlacementRequest.ProviderResponseStatus.REJECTED,
                'reason_code': OutcomeReasonCode.PROVIDER_DECLINED,
                'notes': 'Aanbieder wijst inhoudelijk af.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self.assertEqual(reject_response.status_code, 200)
        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.REJECTED)
        self.assertEqual(placement.provider_response_reason_code, OutcomeReasonCode.PROVIDER_DECLINED)

        self._login(self.owner)
        rematch_response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': intake.pk}),
            {
                'action': 'trigger_rematch',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=matching",
            },
            follow=True,
        )
        self.assertEqual(rematch_response.status_code, 200)
        self.assertContains(rematch_response, 'Her-match geactiveerd. Casus staat weer in matchingfase.')

    def test_archived_cases_are_hidden_and_read_only_for_workflow_actions(self):
        intake = self._create_intake_via_api(
            title='Pilot Archive Casus',
        )
        provider = self._create_provider('Archive Provider')

        self._login(self.admin)
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': provider.pk}),
            content_type='application/json',
        )
        self._grant_provider_actor_case_edit(intake)
        self._login(self.provider_actor)
        self.client.post(
            reverse('careon:case_outcome_action', kwargs={'pk': intake.pk}),
            {
                'outcome_type': 'provider_response',
                'status': PlacementRequest.ProviderResponseStatus.ACCEPTED,
                'reason_code': OutcomeReasonCode.NONE,
                'notes': 'Akkoord voor archieftest.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self._login(self.admin)
        self.client.post(
            reverse('careon:case_placement_action', kwargs={'pk': intake.pk}),
            {
                'status': PlacementRequest.Status.APPROVED,
                'note': 'Plaatsing bevestigd voor archieftest.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )
        self._login(self.provider_actor)
        self.client.post(
            reverse('careon:intake_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({}),
            content_type='application/json',
        )
        self._login(self.admin)
        archive_response = self.client.post(
            reverse('careon:case_archive_action', kwargs={'pk': intake.pk}),
            {'next': reverse('careon:case_detail', kwargs={'pk': intake.pk})},
            follow=True,
        )
        self.assertEqual(archive_response.status_code, 200)
        self.assertContains(archive_response, 'Casus blijft bewaard.')

        intake.refresh_from_db()
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.ARCHIVED)
        self.assertEqual(intake.contract.lifecycle_stage, 'ARCHIVED')

        active_list_response = self.client.get(reverse('careon:case_list'))
        self.assertEqual(active_list_response.status_code, 200)
        self.assertNotContains(active_list_response, 'Pilot Archive Casus')

        archived_list_response = self.client.get(f"{reverse('careon:case_list')}?show_archived=1")
        self.assertEqual(archived_list_response.status_code, 200)
        self.assertContains(archived_list_response, 'Pilot Archive Casus')

        matching_response = self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': intake.pk}),
            {'action': 'reject', 'provider_id': '1'},
            follow=False,
        )
        self.assertEqual(matching_response.status_code, 403)

    def test_member_cannot_archive_cases(self):
        intake = self._create_intake_via_api(
            title='Member Archive Block',
            status=CaseIntakeProcess.ProcessStatus.COMPLETED,
        )

        self._login(self.member)
        response = self.client.post(
            reverse('careon:case_archive_action', kwargs={'pk': intake.pk}),
            {'next': reverse('careon:case_detail', kwargs={'pk': intake.pk})},
            follow=False,
        )
        self.assertEqual(response.status_code, 403)
