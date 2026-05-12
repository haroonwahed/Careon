import json
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    RegionalConfiguration,
    UserProfile,
)
from contracts.decision_engine import evaluate_case
from contracts.workflow_state_machine import (
    WAITLIST_PROPOSAL_NOTES_MARKER,
    WorkflowState,
    derive_workflow_state,
)


User = get_user_model()


class WorkflowFoundationLockTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.organization = Organization.objects.create(name='Workflow Lock Org', slug='workflow-lock-org')

        self.gemeente_user = User.objects.create_user(
            username='gemeente_user',
            email='gemeente@example.com',
            password='testpass123',
        )
        self.provider_user = User.objects.create_user(
            username='provider_user',
            email='provider@example.com',
            password='testpass123',
        )
        self.admin_user = User.objects.create_user(
            username='admin_user',
            email='admin@example.com',
            password='testpass123',
        )

        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.gemeente_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.provider_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.admin_user,
            role=OrganizationMembership.Role.ADMIN,
            is_active=True,
        )

        UserProfile.objects.update_or_create(user=self.gemeente_user, defaults={'role': UserProfile.Role.ASSOCIATE})
        UserProfile.objects.update_or_create(user=self.provider_user, defaults={'role': UserProfile.Role.CLIENT})
        UserProfile.objects.update_or_create(user=self.admin_user, defaults={'role': UserProfile.Role.ADMIN})

        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Provider One',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
        )
        self.provider.responsible_coordinator = self.provider_user
        self.provider.save(update_fields=['responsible_coordinator', 'updated_at'])

    def _create_matching_ready_case(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Workflow Lock Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=10),
            case_coordinator=self.gemeente_user,
        )
        case_record = intake.ensure_case_record(created_by=self.gemeente_user)
        case_record.case_phase = CareCase.CasePhase.MATCHING
        case_record.save(update_fields=['case_phase', 'updated_at'])

        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.gemeente_user,
            workflow_summary={
                'context': 'Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.',
                'urgency': 'MEDIUM',
                'risks': ['test_risk'],
                'missing_information': '',
                'risks_none_ack': False,
            },
        )
        return intake

    def test_provider_can_create_case_via_intake_create_api(self):
        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name='Utrecht',
            municipality_code='UTR',
            created_by=self.provider_user,
        )
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='Regio Utrecht',
            region_code='RU',
            created_by=self.provider_user,
        )
        region.served_municipalities.add(municipality)

        self.client.login(username='provider_user', password='testpass123')
        bootstrap_response = self.client.get(reverse('careon:intake_form_options_api'))
        self.assertEqual(bootstrap_response.status_code, 200)
        payload = bootstrap_response.json()['initial_values']
        payload.update({
            'title': 'Provider-initiated aanmelding',
            'target_completion_date': str(date.today() + timedelta(days=14)),
            'assessment_summary': 'Aanmelding door zorgaanbieder-organisatie.',
            'description': 'Test: gemeente en aanbieder mogen beide casus starten.',
            'postcode': '3511AB',
            'latitude': 52.0907,
            'longitude': 5.1214,
            'urgency': CaseIntakeProcess.Urgency.MEDIUM,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': region.region_type,
            'preferred_region': str(region.pk),
            'gemeente': str(municipality.pk),
            'case_coordinator': str(self.provider_user.pk),
        })

        response = self.client.post(
            reverse('careon:intake_create_api'),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content.decode())
        body = response.json()
        self.assertTrue(body.get('ok'))
        intake = CaseIntakeProcess.objects.get(pk=body['id'])
        self.assertEqual(intake.organization_id, self.organization.pk)
        self.assertEqual(
            intake.aanmelder_actor_profile,
            CaseIntakeProcess.AanmelderActorProfile.ZORGAANBIEDER_ORG,
        )

    def test_provider_decision_requires_provider_role(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_provider_decision_blocked_before_gemeente_validation_gate(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='provider_user', password='testpass123')

        response = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED","provider_comment":"We willen starten"}',
            content_type='application/json',
        )

        # No placement link to this provider: API must not reveal the case (404), not 200.
        self.assertEqual(response.status_code, 404)
        self.assertIn('niet gevonden', (response.json().get('error') or '').lower())

    def test_bulk_update_rejects_workflow_fields(self):
        intake = self._create_matching_ready_case()

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:cases_bulk_update_api'),
            data=f'{{"case_ids":[{intake.case_record.pk}],"updates":{{"case_phase":"provider_beoordeling"}}}}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        payload = response.json()
        self.assertEqual(payload.get('success'), False)
        self.assertIn('case_phase', payload.get('blocked_fields', []))

    def test_intake_start_blocked_before_placement_confirmation(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='provider_user', password='testpass123')
        response = self.client.post(
            reverse('careon:intake_action_api', kwargs={'case_id': intake.contract_id}),
            data='{}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Ongeldige workflow-overgang', response.json().get('error', ''))

    def test_canonical_progression_logs_state_transitions(self):
        intake = self._create_matching_ready_case()

        self.client.login(username='gemeente_user', password='testpass123')
        assign_response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(assign_response.status_code, 200)

        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        provider_response = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED","provider_comment":"Capaciteit beschikbaar"}',
            content_type='application/json',
        )
        self.assertEqual(provider_response.status_code, 200)

        self.client.logout()
        self.client.login(username='gemeente_user', password='testpass123')
        placement_response = self.client.post(
            reverse('careon:placement_action_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"APPROVED","note":"Plaatsing bevestigd"}',
            content_type='application/json',
        )
        self.assertEqual(placement_response.status_code, 200)

        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        intake_response = self.client.post(
            reverse('careon:intake_action_api', kwargs={'case_id': intake.contract_id}),
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(intake_response.status_code, 200)

        intake.refresh_from_db()
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.COMPLETED)
        self.assertEqual(intake.case_record.case_phase, CareCase.CasePhase.ACTIEF)
        self.assertEqual(intake.workflow_state, WorkflowState.ACTIVE_PLACEMENT)

        transition_events = CaseDecisionLog.objects.filter(
            case_id=intake.pk,
            event_type=CaseDecisionLog.EventType.STATE_TRANSITION,
        )
        actions = list(transition_events.values_list('user_action', flat=True))

        self.assertIn('validate_matching', actions)
        self.assertIn('send_to_provider', actions)
        self.assertIn('provider_accept', actions)
        self.assertIn('confirm_placement', actions)
        self.assertIn('start_intake', actions)
        self.assertIn('activate_placement_monitoring', actions)
        self.assertGreaterEqual(transition_events.count(), 6)
        self.assertTrue(all(actor_id is not None for actor_id in transition_events.values_list('actor_id', flat=True)))

    def test_matching_action_does_not_auto_finalize_placement_or_intake(self):
        intake = self._create_matching_ready_case()

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

        intake.refresh_from_db()
        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.status, PlacementRequest.Status.IN_REVIEW)
        self.assertNotEqual(placement.status, PlacementRequest.Status.APPROVED)
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertNotEqual(intake.status, CaseIntakeProcess.ProcessStatus.COMPLETED)
        self.assertNotEqual(intake.case_record.case_phase, CareCase.CasePhase.ACTIEF)

    def test_org_admin_cannot_record_provider_decision_via_api(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='admin_user', password='testpass123')
        response = self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_org_admin_cannot_start_intake_via_api_after_placement_confirmed(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        self.client.post(
            reverse('careon:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:placement_action_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"APPROVED","note":"OK"}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='admin_user', password='testpass123')
        response = self.client.post(
            reverse('careon:intake_action_api', kwargs={'case_id': intake.contract_id}),
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_provider_cannot_assign_via_matching_action_api(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_prepare_waitlist_proposal_persists_draft_and_gemeente_validated(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps(
                {
                    'action': 'prepare_waitlist_proposal',
                    'provider_id': self.provider.pk,
                    'match_score': 88,
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertTrue(payload.get('ok'))
        self.assertEqual(payload.get('matchingOutcome'), 'WAITLIST_PROPOSAL')
        self.assertEqual(payload.get('nextPage'), 'case_detail')

        intake.refresh_from_db()
        self.assertEqual(intake.workflow_state, WorkflowState.GEMEENTE_VALIDATED)
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.DECISION)

        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.status, PlacementRequest.Status.DRAFT)
        self.assertIn(WAITLIST_PROPOSAL_NOTES_MARKER, placement.decision_notes)

        log_row = CaseDecisionLog.objects.filter(case_id=intake.pk, user_action='waitlist_proposal_prepared').first()
        self.assertIsNotNone(log_row)
        self.assertEqual(log_row.recommendation_context.get('actor_role'), 'gemeente')

        case_record = intake.case_record
        self.assertIsNotNone(case_record)
        decision = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertEqual(decision['decision_context'].get('matching_outcome'), 'WAITLIST_PROPOSAL')
        self.assertEqual(decision.get('next_best_action', {}).get('action'), 'SEND_TO_PROVIDER')
        self.assertFalse(decision.get('decision_context', {}).get('placement_confirmed', True))

    def test_provider_cannot_prepare_waitlist_proposal_via_matching_action_api(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps(
                {
                    'action': 'prepare_waitlist_proposal',
                    'provider_id': self.provider.pk,
                    'match_score': 80,
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(PlacementRequest.objects.filter(due_diligence_process=intake).exists())

    def test_case_matching_action_prepare_waitlist_proposal_form_post(self):
        """Legacy HTML POST parity with matching_action_api prepare_waitlist_proposal."""
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': intake.pk}),
            {
                'action': 'prepare_waitlist_proposal',
                'provider_id': str(self.provider.pk),
                'match_score': '91',
            },
            follow=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('careon:case_detail', kwargs={'pk': intake.pk}), response.url)

        intake.refresh_from_db()
        self.assertEqual(intake.workflow_state, WorkflowState.GEMEENTE_VALIDATED)
        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.status, PlacementRequest.Status.DRAFT)
        self.assertIn(WAITLIST_PROPOSAL_NOTES_MARKER, placement.decision_notes)

    def test_matching_action_api_prepare_waitlist_requires_login(self):
        intake = self._create_matching_ready_case()
        self.client.logout()
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps(
                {'action': 'prepare_waitlist_proposal', 'provider_id': self.provider.pk},
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 302)

    def test_other_organization_user_cannot_prepare_waitlist_via_matching_action_api(self):
        intake = self._create_matching_ready_case()
        other_org = Organization.objects.create(name='Foreign Municipality Org', slug='foreign-muni-wf')
        outsider = User.objects.create_user(username='foreign_gemeente_wf', password='testpass123')
        OrganizationMembership.objects.create(
            organization=other_org,
            user=outsider,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=outsider, defaults={'role': UserProfile.Role.ASSOCIATE})
        self.client.login(username='foreign_gemeente_wf', password='testpass123')
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps(
                {'action': 'prepare_waitlist_proposal', 'provider_id': self.provider.pk},
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 404)

    def test_foreign_user_gets_404_on_case_matching_action_prepare_waitlist(self):
        intake = self._create_matching_ready_case()
        other_org = Organization.objects.create(name='Foreign Html Org', slug='foreign-html-wf')
        outsider = User.objects.create_user(username='foreign_html_wf', password='testpass123')
        OrganizationMembership.objects.create(
            organization=other_org,
            user=outsider,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=outsider, defaults={'role': UserProfile.Role.ASSOCIATE})
        self.client.login(username='foreign_html_wf', password='testpass123')
        response = self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': intake.pk}),
            {
                'action': 'prepare_waitlist_proposal',
                'provider_id': str(self.provider.pk),
            },
        )
        self.assertEqual(response.status_code, 404)

    def test_derive_workflow_state_without_case_assessment_does_not_crash(self):
        """Empty persisted workflow_state + no CaseAssessment must not raise (SPA list / Regiekamer)."""
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Intake zonder beoordeling',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=10),
            case_coordinator=self.gemeente_user,
        )
        intake.ensure_case_record(created_by=self.gemeente_user)
        self.assertFalse(CaseAssessment.objects.filter(due_diligence_process=intake).exists())
        state = derive_workflow_state(intake=intake)
        self.assertEqual(state, WorkflowState.DRAFT_CASE)
