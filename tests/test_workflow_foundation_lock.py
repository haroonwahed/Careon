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
    Document,
    MunicipalityConfiguration,
    Organization,
    OrganizationMembership,
    OutcomeReasonCode,
    PlacementRequest,
    RegionalConfiguration,
    RegionType,
    UserProfile,
    Zorgaanbieder,
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

        # Link self.provider to a Zorgaanbieder so matching_action_api (assign/send)
        # passes the PROVIDER_UNLINKED gate added for Blocker 1.
        self.zorgaanbieder = Zorgaanbieder.objects.create(
            name='Provider One', is_active=True, client=self.provider
        )

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
            region_type=RegionType.JEUGDREGIO,
            created_by=self.provider_user,
        )
        region.served_municipalities.add(municipality)

        self.client.login(username='provider_user', password='testpass123')
        bootstrap_response = self.client.get(reverse('carelane:intake_form_options_api'))
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
            'jeugdhulpregio': str(region.pk),
            'gemeente': str(municipality.pk),
            'case_coordinator': str(self.provider_user.pk),
        })

        response = self.client.post(
            reverse('carelane:intake_create_api'),
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
            reverse('carelane:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)

    def test_provider_decision_blocked_before_gemeente_validation_gate(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='provider_user', password='testpass123')

        response = self.client.post(
            reverse('carelane:provider_decision_api', kwargs={'case_id': intake.contract_id}),
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
            reverse('carelane:cases_bulk_update_api'),
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
            reverse('carelane:intake_action_api', kwargs={'case_id': intake.contract_id}),
            data='{}',
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Ongeldige workflow-overgang', response.json().get('error', ''))

    def test_canonical_progression_logs_state_transitions(self):
        intake = self._create_matching_ready_case()

        self.client.login(username='gemeente_user', password='testpass123')
        assign_response = self.client.post(
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(assign_response.status_code, 200)

        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        provider_response = self.client.post(
            reverse('carelane:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED","provider_comment":"Capaciteit beschikbaar"}',
            content_type='application/json',
        )
        self.assertEqual(provider_response.status_code, 200)

        self.client.logout()
        self.client.login(username='gemeente_user', password='testpass123')
        placement_response = self.client.post(
            reverse('carelane:placement_action_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"APPROVED","note":"Plaatsing bevestigd"}',
            content_type='application/json',
        )
        self.assertEqual(placement_response.status_code, 200)

        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        intake_response = self.client.post(
            reverse('carelane:intake_action_api', kwargs={'case_id': intake.contract_id}),
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

    def test_provider_reject_accepts_spa_rejection_slug(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        assign_response = self.client.post(
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(assign_response.status_code, 200)

        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.post(
            reverse('carelane:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data=(
                '{"status":"REJECTED","rejection_reason_code":"geen_capaciteit",'
                '"provider_comment":"Afwijzing test met voldoende tekens."}'
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content)

        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.provider_response_reason_code, OutcomeReasonCode.CAPACITY)
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.REJECTED)

    def test_matching_action_does_not_auto_finalize_placement_or_intake(self):
        intake = self._create_matching_ready_case()

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
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
            reverse('carelane:provider_decision_api', kwargs={'case_id': intake.contract_id}),
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
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        self.client.post(
            reverse('carelane:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('carelane:placement_action_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"APPROVED","note":"OK"}',
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='admin_user', password='testpass123')
        response = self.client.post(
            reverse('carelane:intake_action_api', kwargs={'case_id': intake.contract_id}),
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_provider_cannot_assign_via_matching_action_api(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.post(
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=f'{{"action":"assign","provider_id":{self.provider.pk}}}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)

    def test_prepare_waitlist_proposal_persists_draft_and_gemeente_validated(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
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
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
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
            reverse('carelane:case_matching_action', kwargs={'pk': intake.pk}),
            {
                'action': 'prepare_waitlist_proposal',
                'provider_id': str(self.provider.pk),
                'match_score': '91',
            },
            follow=False,
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('carelane:case_detail', kwargs={'pk': intake.pk}), response.url)

        intake.refresh_from_db()
        self.assertEqual(intake.workflow_state, WorkflowState.GEMEENTE_VALIDATED)
        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.status, PlacementRequest.Status.DRAFT)
        self.assertIn(WAITLIST_PROPOSAL_NOTES_MARKER, placement.decision_notes)

    def test_matching_action_api_prepare_waitlist_requires_login(self):
        intake = self._create_matching_ready_case()
        self.client.logout()
        response = self.client.post(
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
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
            reverse('carelane:matching_action_api', kwargs={'case_id': intake.contract_id}),
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
            reverse('carelane:case_matching_action', kwargs={'pk': intake.pk}),
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

    def test_provider_placement_detail_api_returns_404_when_placement_targets_other_provider(self):
        intake = self._create_matching_ready_case()
        other_provider = CareProvider.objects.create(
            organization=self.organization,
            name='Other Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
        )
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=other_provider,
            selected_provider=other_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.get(
            reverse('carelane:case_placement_detail_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn('niet gevonden', (response.json().get('error') or '').lower())

    def test_provider_placement_detail_api_returns_200_when_linked_to_responsible_coordinator_client(self):
        intake = self._create_matching_ready_case()
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.get(
            reverse('carelane:case_placement_detail_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(response.status_code, 200, response.content.decode())
        body = response.json()
        self.assertEqual(body.get('caseId'), str(intake.pk))
        self.assertEqual(body['placement'].get('proposedProviderId'), str(self.provider.pk))
        self.assertIn('providerResponseNotes', body['placement'])

    def test_provider_decision_evaluation_api_returns_404_without_placement_link(self):
        intake = self._create_matching_ready_case()
        other_provider = CareProvider.objects.create(
            organization=self.organization,
            name='Peer Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
        )
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=other_provider,
            selected_provider=other_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.get(
            reverse('carelane:case_decision_evaluation_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn('niet gevonden', (response.json().get('error') or '').lower())

    def test_provider_arrangement_alignment_api_returns_404_without_placement_link(self):
        intake = self._create_matching_ready_case()
        other_provider = CareProvider.objects.create(
            organization=self.organization,
            name='Peer Provider Arrangement',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
        )
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=other_provider,
            selected_provider=other_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )
        self.client.login(username='provider_user', password='testpass123')
        response = self.client.get(
            reverse('carelane:case_arrangement_alignment_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(response.status_code, 404)
        self.assertIn('niet gevonden', (response.json().get('error') or '').lower())

    def test_gemeente_decision_evaluation_api_returns_200_for_same_case(self):
        intake = self._create_matching_ready_case()
        other_provider = CareProvider.objects.create(
            organization=self.organization,
            name='Peer Provider B',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
        )
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=other_provider,
            selected_provider=other_provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )
        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.get(
            reverse('carelane:case_decision_evaluation_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(response.status_code, 200, response.content.decode())
        self.assertEqual(response.json().get('case_id'), intake.case_record.pk)

    def test_provider_decision_api_blocks_non_selected_provider(self):
        """A provider linked as proposed (not selected) must receive 403."""
        intake = self._create_matching_ready_case()
        intake.workflow_state = 'PROVIDER_REVIEW_PENDING'
        intake.save(update_fields=['workflow_state', 'updated_at'])

        other_user = User.objects.create_user(
            username='other_provider_user',
            email='other@example.com',
            password='testpass123',
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=other_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=other_user, defaults={'role': UserProfile.Role.CLIENT})

        other_provider = CareProvider.objects.create(
            organization=self.organization,
            name='Other Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
            responsible_coordinator=other_user,
        )
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=other_provider,
            selected_provider=self.provider,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        self.client.login(username='other_provider_user', password='testpass123')
        response = self.client.post(
            reverse('carelane:provider_decision_api', kwargs={'case_id': intake.contract_id}),
            data='{"status":"ACCEPTED"}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        data = response.json()
        self.assertFalse(data.get('ok'))

    def test_cases_bulk_update_api_rejects_non_allowlisted_fields(self):
        """Bulk update must reject fields outside the explicit allowlist."""
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')

        response = self.client.post(
            reverse('carelane:cases_bulk_update_api'),
            data=json.dumps({
                'case_ids': [intake.contract_id],
                'updates': {'workflow_state': 'HACKED', 'status': 'APPROVED'},
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertFalse(data.get('success'))
        self.assertIn('workflow_state', data.get('blocked_fields', []))
        self.assertIn('status', data.get('blocked_fields', []))

    def test_cases_bulk_update_api_accepts_allowlisted_fields(self):
        """Bulk update must succeed for fields on the explicit allowlist."""
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')

        response = self.client.post(
            reverse('carelane:cases_bulk_update_api'),
            data=json.dumps({
                'case_ids': [intake.contract_id],
                'updates': {'risk_level': 'HIGH'},
            }),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json().get('success'))

    # ------------------------------------------------------------------
    # P0-1: case-scoped document download
    # ------------------------------------------------------------------

    def test_case_scoped_document_download_returns_404_for_wrong_case(self):
        """Document looked up under the wrong case_id must 404 — prevents cross-case fishing."""
        intake = self._create_matching_ready_case()
        case = intake.contract

        other_case = CareCase.objects.create(
            organization=self.organization,
            title='Other Case',
            created_by=self.gemeente_user,
        )

        doc = Document.objects.create(
            organization=self.organization,
            contract=case,
            title='Test doc',
        )

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.get(
            reverse('carelane:serve_case_document_scoped_api', kwargs={'case_id': other_case.pk, 'document_id': doc.pk}),
        )
        self.assertEqual(response.status_code, 404)

    def test_case_scoped_document_download_returns_404_for_cross_tenant(self):
        """Cross-tenant user must receive 404 on case-scoped document download."""
        intake = self._create_matching_ready_case()
        doc = Document.objects.create(
            organization=self.organization,
            contract=intake.contract,
            title='Test doc',
        )

        other_org = Organization.objects.create(name='Foreign Org', slug='foreign-org-p0')
        outsider = User.objects.create_user(username='outsider_p0', password='testpass123')
        OrganizationMembership.objects.create(
            organization=other_org,
            user=outsider,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=outsider, defaults={'role': UserProfile.Role.ASSOCIATE})

        self.client.login(username='outsider_p0', password='testpass123')
        response = self.client.get(
            reverse('carelane:serve_case_document_scoped_api', kwargs={'case_id': intake.contract_id, 'document_id': doc.pk}),
        )
        self.assertEqual(response.status_code, 404)

    def test_case_scoped_document_download_returns_404_for_unlinked_provider(self):
        """Provider not linked to the case via PlacementRequest must receive 404."""
        intake = self._create_matching_ready_case()
        doc = Document.objects.create(
            organization=self.organization,
            contract=intake.contract,
            title='Test doc',
        )

        unlinked_user = User.objects.create_user(username='unlinked_provider_p0', password='testpass123')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=unlinked_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=unlinked_user, defaults={'role': UserProfile.Role.CLIENT})
        CareProvider.objects.create(
            organization=self.organization,
            name='Unlinked Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
            responsible_coordinator=unlinked_user,
        )

        self.client.login(username='unlinked_provider_p0', password='testpass123')
        response = self.client.get(
            reverse('carelane:serve_case_document_scoped_api', kwargs={'case_id': intake.contract_id, 'document_id': doc.pk}),
        )
        self.assertEqual(response.status_code, 404)

    def test_case_scoped_document_download_requires_authentication(self):
        """Unauthenticated request to case-scoped download must redirect to login."""
        intake = self._create_matching_ready_case()
        doc = Document.objects.create(
            organization=self.organization,
            contract=intake.contract,
            title='Auth guard doc',
        )
        response = self.client.get(
            reverse('carelane:serve_case_document_scoped_api', kwargs={'case_id': intake.contract_id, 'document_id': doc.pk}),
        )
        self.assertIn(response.status_code, [302, 401])

    # ------------------------------------------------------------------
    # P2-8: SPA-only enforcement — legacy HTML action views redirect
    # ------------------------------------------------------------------

    def test_spa_only_blocks_legacy_case_communication_action(self):
        """When CARELANE_PILOT_SPA_ONLY=True, case_communication_action must redirect to /care/casussen."""
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        with self.settings(CARELANE_PILOT_SPA_ONLY=True):
            response = self.client.post(
                reverse('carelane:case_communication_action', kwargs={'pk': intake.pk}),
                data={'action': 'add_message', 'content': 'test'},
            )
        self.assertRedirects(response, '/care/casussen', fetch_redirect_response=False)

    def test_spa_only_blocks_legacy_case_placement_action(self):
        """When CARELANE_PILOT_SPA_ONLY=True, case_placement_action must redirect to /care/casussen."""
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        with self.settings(CARELANE_PILOT_SPA_ONLY=True):
            response = self.client.post(
                reverse('carelane:case_placement_action', kwargs={'pk': intake.pk}),
                data={'action': 'confirm'},
            )
        self.assertRedirects(response, '/care/casussen', fetch_redirect_response=False)

    def test_spa_only_blocks_legacy_case_archive_action(self):
        """When CARELANE_PILOT_SPA_ONLY=True, case_archive_action must redirect to /care/casussen."""
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        with self.settings(CARELANE_PILOT_SPA_ONLY=True):
            response = self.client.post(
                reverse('carelane:case_archive_action', kwargs={'pk': intake.pk}),
                data={'reason': 'test'},
            )
        self.assertRedirects(response, '/care/casussen', fetch_redirect_response=False)

    # ------------------------------------------------------------------
    # P2-9: Upload size limit
    # ------------------------------------------------------------------

    def test_intake_create_api_rejects_oversized_file(self):
        """File exceeding CARELANE_MAX_DOCUMENT_UPLOAD_MB must return 413."""
        from io import BytesIO
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.login(username='gemeente_user', password='testpass123')
        # Create a 1-byte file and pretend the size is over the limit
        tiny_content = b'x'
        oversize_file = SimpleUploadedFile('big.pdf', tiny_content, content_type='application/pdf')
        # Patch the size attribute so validation sees it as too large
        oversize_file.size = 1  # 1 byte, but max will be set to 0 MB (0 bytes) via override

        with self.settings(CARELANE_MAX_DOCUMENT_UPLOAD_MB=0):
            response = self.client.post(
                reverse('carelane:intake_create_api'),
                data={'title': 'Test', 'document': oversize_file},
                format='multipart',
            )
        self.assertEqual(response.status_code, 413)
        body = response.json()
        self.assertIn('te groot', body.get('error', ''))

    def test_intake_create_api_accepts_file_within_limit(self):
        """Small file within CARELANE_MAX_DOCUMENT_UPLOAD_MB must not trigger size rejection."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from contracts.models import MunicipalityConfiguration, RegionalConfiguration, RegionType

        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name='Teststad',
            municipality_code='TST',
            created_by=self.gemeente_user,
        )
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='Regio Test',
            region_code='RT',
            region_type=RegionType.JEUGDREGIO,
            created_by=self.gemeente_user,
        )
        region.served_municipalities.add(municipality)

        self.client.login(username='gemeente_user', password='testpass123')
        small_file = SimpleUploadedFile('small.pdf', b'hello', content_type='application/pdf')
        bootstrap = self.client.get(reverse('carelane:intake_form_options_api'))
        payload = bootstrap.json().get('initial_values', {})
        payload.update({
            'title': 'Upload test',
            'urgency': CaseIntakeProcess.Urgency.MEDIUM,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'start_date': str(date.today()),
            'target_completion_date': str(date.today() + timedelta(days=30)),
            'service_region': str(region.pk),
            'document': small_file,
        })
        with self.settings(CARELANE_MAX_DOCUMENT_UPLOAD_MB=20):
            response = self.client.post(
                reverse('carelane:intake_create_api'),
                data=payload,
            )
        # Size check passed — may succeed or fail for other form reasons, but not 413
        self.assertNotEqual(response.status_code, 413)

    # ------------------------------------------------------------------
    # P3-2: JSON document upload API
    # ------------------------------------------------------------------

    def test_documents_api_post_creates_document(self):
        """POST /api/documents/ with a file should create a Document and return 201."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.login(username='gemeente_user', password='testpass123')
        f = SimpleUploadedFile('test.pdf', b'%PDF hello', content_type='application/pdf')
        response = self.client.post(
            reverse('carelane:documents_api'),
            data={'title': 'Pilotdocument', 'file': f},
        )
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertIn('document', body)
        self.assertEqual(body['document']['name'], 'Pilotdocument')
        self.assertTrue(Document.objects.filter(organization=self.organization, title='Pilotdocument').exists())

    def test_documents_api_post_rejects_oversized_file(self):
        """POST /api/documents/ with a file over the limit must return 413."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.login(username='gemeente_user', password='testpass123')
        f = SimpleUploadedFile('big.pdf', b'x', content_type='application/pdf')
        with self.settings(CARELANE_MAX_DOCUMENT_UPLOAD_MB=0):
            response = self.client.post(
                reverse('carelane:documents_api'),
                data={'title': 'Groot bestand', 'file': f},
            )
        self.assertEqual(response.status_code, 413)

    def test_documents_api_post_provider_forbidden(self):
        """Zorgaanbieder must not be able to upload documents via the standalone endpoint."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        self.client.login(username='provider_user', password='testpass123')
        f = SimpleUploadedFile('doc.pdf', b'hello', content_type='application/pdf')
        response = self.client.post(
            reverse('carelane:documents_api'),
            data={'title': 'Provider upload', 'file': f},
        )
        self.assertEqual(response.status_code, 403)

    def test_documents_api_post_requires_login(self):
        """Unauthenticated POST to /api/documents/ must be rejected."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        f = SimpleUploadedFile('doc.pdf', b'hello', content_type='application/pdf')
        response = self.client.post(
            reverse('carelane:documents_api'),
            data={'title': 'Anon upload', 'file': f},
        )
        self.assertIn(response.status_code, [302, 401])

    # ------------------------------------------------------------------
    # P3-4: Seed-reset org isolation
    # ------------------------------------------------------------------

    def test_seed_demo_data_clear_does_not_affect_other_org_providers(self):
        """_clear_existing_demo_data must not delete Zorgaanbieder records from another org."""
        from contracts.management.commands.seed_demo_data import Command as SeedCommand
        from contracts.models import Zorgaanbieder

        other_org = Organization.objects.create(name='Other Org', slug='other-org')

        # Create a Zorgaanbieder with a pilot name but NOT seeded (production import)
        pilot_name = "Groei & Co"  # a name that appears in PILOT_PROVIDER_CLIENT_NAMES
        za = Zorgaanbieder.objects.create(
            name=pilot_name,
            bron_type=Zorgaanbieder.BronType.MANUAL,  # NOT seeded
        )

        cmd = SeedCommand()
        # Run clear against demo org — should not delete the non-seeded provider
        cmd._clear_existing_demo_data(organization=self.organization)

        self.assertTrue(
            Zorgaanbieder.objects.filter(pk=za.pk).exists(),
            "Non-seeded Zorgaanbieder with pilot name must not be deleted by reset.",
        )
        za.delete()
        other_org.delete()
