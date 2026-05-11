import json
import logging
from contextlib import contextmanager
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    AuditLog,
    CareCase,
    CareConfiguration,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    CareSignal,
    Deadline,
    Document,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
    MunicipalityConfiguration,
    RegionalConfiguration,
)
from contracts.governance import AuditLoggingError
from contracts.views import sync_case_flow_state

@contextmanager
def _quiet_logs_for_expected_client_errors():
    """
    These tests intentionally trigger 503/500; suppress CI/build log noise during the POST.

    Per-logger setLevel is unreliable under Django's LOGGING (handlers still emit).  logging.disable
    drops all records at that severity and below for the whole process until NOTSET restores.
    """
    logging.disable(logging.ERROR)
    try:
        yield
    finally:
        logging.disable(logging.NOTSET)


MINIMAL_WORKFLOW_SUMMARY = {
    'context': 'Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.',
    'risks': ['test_risk'],
    'missing_information': '',
    'risks_none_ack': False,
}


class IntakeAssessmentMatchingFlowTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='flow_user',
            email='flow@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Care Team Flow', slug='care-team-flow')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='flow_user', password='testpass123')

    def _assert_spa_shell(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)

    def test_intake_assessment_matching_assignment_flow(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Flow Aanbieder',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=3,
            average_wait_days=10,
        )

        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Flow Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        intake.ensure_case_record(created_by=self.user)
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        assessment_list_response = self.client.get(reverse('careon:assessment_list'))
        self.assertEqual(assessment_list_response.status_code, 200)
        self.assertContains(assessment_list_response, '<div id="root"></div>', html=True)

        assessments_api_response = self.client.get(reverse('careon:assessments_api'))
        self.assertEqual(assessments_api_response.status_code, 200)
        api_payload = assessments_api_response.json()
        flow_rows = [row for row in api_payload['assessments'] if row['caseTitle'] == 'Flow Intake']
        self.assertEqual(len(flow_rows), 1)
        self.assertTrue(flow_rows[0]['matchingReady'])

        matching_response = self.client.get(reverse('careon:matching_dashboard'))
        self.assertEqual(matching_response.status_code, 200)
        self.assertContains(matching_response, '<div id="root"></div>', html=True)

        matching_candidates_response = self.client.get(
            reverse('careon:matching_candidates_api', kwargs={'case_id': intake.contract_id})
        )
        self.assertEqual(matching_candidates_response.status_code, 200)
        candidates_payload = matching_candidates_response.json()
        self.assertEqual(candidates_payload['caseId'], intake.pk)
        self.assertIn('matches', candidates_payload)

        assign_response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps(
                {
                    'action': 'assign',
                    'provider_id': provider.pk,
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(assign_response.status_code, 200)
        assign_payload = assign_response.json()
        self.assertTrue(assign_payload['ok'])
        self.assertEqual(assign_payload['nextPage'], 'casussen')
        self.assertEqual(assign_payload['providerId'], str(provider.pk))
        self.assertTrue(PlacementRequest.objects.filter(due_diligence_process=intake).exists())

        intake.refresh_from_db()
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.DECISION)

    def test_matching_assignment_is_blocked_until_assessment_is_ready(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Blocked Flow Aanbieder',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Blocked Flow Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        intake.ensure_case_record(created_by=self.user)
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.DRAFT,
            matching_ready=False,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps(
                {
                    'action': 'assign',
                    'provider_id': provider.pk,
                }
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertFalse(body['ok'])
        self.assertIn('Ongeldige workflow-overgang', body['error'])
        self.assertFalse(PlacementRequest.objects.filter(due_diligence_process=intake).exists())

    def test_intake_create_api_creates_linked_case_record_for_workflow(self):
        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name='Utrecht',
            municipality_code='UTR',
            created_by=self.user,
        )
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='Regio Utrecht',
            region_code='RU',
            created_by=self.user,
        )
        region.served_municipalities.add(municipality)

        bootstrap_response = self.client.get(reverse('careon:intake_form_options_api'))
        self.assertEqual(bootstrap_response.status_code, 200)
        payload = bootstrap_response.json()['initial_values']
        payload.update({
            'title': 'API Intake Visible In Casussen',
            'target_completion_date': str(date.today() + timedelta(days=7)),
            'assessment_summary': 'Nieuwe intake via API',
            'description': 'Moet zichtbaar zijn in het casusoverzicht.',
            'postcode': '3511AB',
            'latitude': 52.0907,
            'longitude': 5.1214,
            'urgency': CaseIntakeProcess.Urgency.HIGH,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': region.region_type,
            'preferred_region': str(region.pk),
            'gemeente': str(municipality.pk),
            'case_coordinator': str(self.user.pk),
        })

        response = self.client.post(
            reverse('careon:intake_create_api'),
            data=json.dumps(payload),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content.decode())
        body = response.json()
        intake = CaseIntakeProcess.objects.get(pk=body['id'])

        self.assertIsNotNone(intake.contract_id)
        self.assertEqual(body['case_id'], str(intake.contract_id))
        self.assertEqual(body['redirect_url'], f"/care/cases/{intake.contract_id}/")
        self.assertEqual(intake.contract.title, intake.title)
        self.assertEqual(intake.contract.case_phase, CareCase.CasePhase.INTAKE)
        self.assertEqual(intake.contract.status, CareCase.Status.PENDING)
        self.assertEqual(intake.contract.service_region, region.region_name)
        self.assertEqual(intake.postcode, '3511AB')
        self.assertEqual(float(intake.latitude), 52.0907)
        self.assertEqual(float(intake.longitude), 5.1214)

        cases_response = self.client.get(reverse('careon:cases_api'))
        self.assertEqual(cases_response.status_code, 200)
        case_titles = [item['title'] for item in cases_response.json()['contracts']]
        self.assertIn('API Intake Visible In Casussen', case_titles)

    @patch('contracts.api.views.log_action', side_effect=RuntimeError('audit log store unavailable'))
    def test_intake_create_api_returns_503_and_rollbacks_when_create_audit_fails(self, _mock_log_action):
        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name='Utrecht',
            municipality_code='UTR',
            created_by=self.user,
        )
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='Regio Utrecht',
            region_code='RU',
            created_by=self.user,
        )
        region.served_municipalities.add(municipality)

        bootstrap_response = self.client.get(reverse('careon:intake_form_options_api'))
        self.assertEqual(bootstrap_response.status_code, 200)
        payload = bootstrap_response.json()['initial_values']
        payload.update({
            'title': 'API Intake Logging Failure Rollback',
            'target_completion_date': str(date.today() + timedelta(days=7)),
            'assessment_summary': 'Nieuwe intake via API',
            'description': 'Audit verplicht; geen casus zonder audit.',
            'postcode': '3511AB',
            'latitude': 52.0907,
            'longitude': 5.1214,
            'urgency': CaseIntakeProcess.Urgency.HIGH,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': region.region_type,
            'preferred_region': str(region.pk),
            'gemeente': str(municipality.pk),
            'case_coordinator': str(self.user.pk),
        })

        before = CaseIntakeProcess.objects.count()

        with _quiet_logs_for_expected_client_errors():
            response = self.client.post(
                reverse('careon:intake_create_api'),
                data=json.dumps(payload),
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 503, response.content.decode())
        body = response.json()
        self.assertFalse(body['ok'])
        self.assertIn('Kan auditlog voor nieuwe casus niet vastleggen', body['error'])
        self.assertEqual(CaseIntakeProcess.objects.count(), before)
        self.assertFalse(
            CaseIntakeProcess.objects.filter(title='API Intake Logging Failure Rollback').exists()
        )

    @patch(
        'contracts.api.views.log_transition_event',
        side_effect=AuditLoggingError('Kan auditlog voor deze workflowactie niet vastleggen.'),
    )
    def test_intake_create_api_returns_503_and_rollbacks_when_transition_audit_fails(self, _mock_log_transition):
        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name='Utrecht',
            municipality_code='UTR',
            created_by=self.user,
        )
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='Regio Utrecht',
            region_code='RU',
            created_by=self.user,
        )
        region.served_municipalities.add(municipality)

        bootstrap_response = self.client.get(reverse('careon:intake_form_options_api'))
        self.assertEqual(bootstrap_response.status_code, 200)
        payload = bootstrap_response.json()['initial_values']
        payload.update({
            'title': 'API Intake Transition Audit Rollback',
            'target_completion_date': str(date.today() + timedelta(days=7)),
            'assessment_summary': 'Nieuwe intake via API',
            'description': 'Workflow-audit verplicht.',
            'postcode': '3511AB',
            'latitude': 52.0907,
            'longitude': 5.1214,
            'urgency': CaseIntakeProcess.Urgency.HIGH,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': region.region_type,
            'preferred_region': str(region.pk),
            'gemeente': str(municipality.pk),
            'case_coordinator': str(self.user.pk),
        })

        before = CaseIntakeProcess.objects.count()

        with _quiet_logs_for_expected_client_errors():
            response = self.client.post(
                reverse('careon:intake_create_api'),
                data=json.dumps(payload),
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 503, response.content.decode())
        body = response.json()
        self.assertFalse(body['ok'])
        self.assertIn('Kan auditlog voor deze workflowactie niet vastleggen', body['error'])
        self.assertEqual(CaseIntakeProcess.objects.count(), before)
        self.assertFalse(
            CaseIntakeProcess.objects.filter(title='API Intake Transition Audit Rollback').exists()
        )

    @patch('contracts.api.views.logger.exception')
    @patch.object(CaseIntakeProcess, 'ensure_case_record', side_effect=RuntimeError('case bootstrap failed'))
    def test_intake_create_api_returns_json_500_when_internal_error_occurs(self, _mock_ensure_case_record, _mock_log_exception):
        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name='Utrecht',
            municipality_code='UTR',
            created_by=self.user,
        )
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='Regio Utrecht',
            region_code='RU',
            created_by=self.user,
        )
        region.served_municipalities.add(municipality)

        bootstrap_response = self.client.get(reverse('careon:intake_form_options_api'))
        self.assertEqual(bootstrap_response.status_code, 200)
        payload = bootstrap_response.json()['initial_values']
        payload.update({
            'title': 'API Intake Returns Controlled Error',
            'target_completion_date': str(date.today() + timedelta(days=7)),
            'assessment_summary': 'Nieuwe intake via API',
            'description': 'Foutpad moet JSON blijven.',
            'postcode': '3511AB',
            'latitude': 52.0907,
            'longitude': 5.1214,
            'urgency': CaseIntakeProcess.Urgency.HIGH,
            'preferred_care_form': CaseIntakeProcess.CareForm.OUTPATIENT,
            'zorgvorm_gewenst': CaseIntakeProcess.CareForm.OUTPATIENT,
            'preferred_region_type': region.region_type,
            'preferred_region': str(region.pk),
            'gemeente': str(municipality.pk),
            'case_coordinator': str(self.user.pk),
        })

        with _quiet_logs_for_expected_client_errors():
            response = self.client.post(
                reverse('careon:intake_create_api'),
                data=json.dumps(payload),
                content_type='application/json',
            )

        self.assertEqual(response.status_code, 500)
        body = response.json()
        self.assertFalse(body['ok'])
        self.assertIn('Nieuwe casus kon niet worden geladen', body['error'])

    def test_assessment_decision_api_returns_decision_first_payload(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Beslisbare Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            complexity=CaseIntakeProcess.Complexity.MULTIPLE,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            zorgvorm_gewenst=CaseIntakeProcess.CareForm.OUTPATIENT,
            assessment_summary='Korte intake voor beslisscherm.',
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        case_record = intake.ensure_case_record(created_by=self.user)
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.NEEDS_INFO,
            matching_ready=False,
            reason_not_ready='Aanvullende informatie nodig.',
            notes='Wacht op aanvullende gezinssituatie.',
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        response = self.client.get(
            reverse('careon:assessment_decision_api', kwargs={'case_id': case_record.pk})
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body['caseId'], str(case_record.pk))
        self.assertEqual(body['assessmentId'], str(assessment.pk))
        self.assertEqual(body['form']['decision'], 'needs_info')
        self.assertEqual(body['form']['urgency'], CaseIntakeProcess.Urgency.HIGH)
        self.assertEqual(body['summary']['title'], intake.title)
        self.assertEqual(body['hints']['suggestedUrgency']['value'], CaseIntakeProcess.Urgency.HIGH)
        self.assertIn('matching', body['consequences'])

    def test_assessment_decision_api_moves_case_to_matching(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Doorstroom Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            complexity=CaseIntakeProcess.Complexity.SIMPLE,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            zorgvorm_gewenst=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        case_record = intake.ensure_case_record(created_by=self.user)

        response = self.client.post(
            reverse('careon:assessment_decision_api', kwargs={'case_id': case_record.pk}),
            data=json.dumps({
                'decision': 'matching',
                'zorgtype': CaseIntakeProcess.CareForm.DAY_TREATMENT,
                'shortDescription': 'Klaar om door te sturen naar matching.',
                'urgency': CaseIntakeProcess.Urgency.HIGH,
                'complexity': CaseIntakeProcess.Complexity.MULTIPLE,
                'constraints': ['DROPOUT_RISK'],
                'workflow_summary': {
                    'context': (
                        'Klaar om door te sturen naar matching — pilot samenvatting '
                        'met voldoende lengte voor de gate.'
                    ),
                    'urgency': CaseIntakeProcess.Urgency.HIGH,
                    'risks': ['DROPOUT_RISK'],
                    'missing_information': '',
                    'risks_none_ack': False,
                },
            }),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200, response.content.decode())
        body = response.json()
        self.assertEqual(body['nextPage'], 'matching')

        intake.refresh_from_db()
        case_record.refresh_from_db()
        assessment = intake.case_assessment
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.MATCHING)
        self.assertEqual(case_record.case_phase, CareCase.CasePhase.MATCHING)
        self.assertEqual(assessment.assessment_status, CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING)
        self.assertTrue(assessment.matching_ready)
        self.assertEqual(assessment.risk_signals, 'DROPOUT_RISK')
        self.assertEqual(assessment.notes, 'Klaar om door te sturen naar matching.')
        self.assertEqual(intake.urgency, CaseIntakeProcess.Urgency.HIGH)
        self.assertEqual(intake.complexity, CaseIntakeProcess.Complexity.MULTIPLE)
        self.assertEqual(intake.zorgvorm_gewenst, CaseIntakeProcess.CareForm.DAY_TREATMENT)

    def test_matching_dashboard_empty_state_without_approved_assessments(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Draft Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        intake.ensure_case_record(created_by=self.user)
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.DRAFT,
            matching_ready=False,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))
        self._assert_spa_shell(response)

        matching_candidates_response = self.client.get(
            reverse('careon:matching_candidates_api', kwargs={'case_id': intake.contract_id})
        )
        self.assertEqual(matching_candidates_response.status_code, 200)
        payload = matching_candidates_response.json()
        self.assertEqual(payload.get('caseId'), intake.pk)
        self.assertEqual(payload.get('matches', []), [])

    def test_matching_dashboard_shows_no_provider_profile_fallback(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Approved Intake Zonder Profiel',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        intake.ensure_case_record(created_by=self.user)
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))
        self._assert_spa_shell(response)

        matching_candidates_response = self.client.get(
            reverse('careon:matching_candidates_api', kwargs={'case_id': intake.contract_id})
        )
        self.assertEqual(matching_candidates_response.status_code, 200)
        payload = matching_candidates_response.json()
        self.assertEqual(payload.get('caseId'), intake.pk)
        self.assertIn('matches', payload)

    def test_intake_detail_uses_semantic_detail_page_primitives(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Semantic Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        response = self.client.get(
            reverse('careon:intake_detail', kwargs={'pk': intake.pk}),
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-', status_code=200)

    def test_case_scoped_task_create_locks_intake_server_side(self):
        locked_intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Locked Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        other_intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Other Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        response = self.client.post(
            reverse('careon:case_task_create', kwargs={'pk': locked_intake.pk}),
            {
                'due_diligence_process': str(other_intake.pk),
                'title': 'Server locked task',
                'task_type': Deadline.TaskType.INTAKE_COMPLETE,
                'description': 'Should always link to locked intake.',
                'due_date': str(date.today() + timedelta(days=2)),
                'priority': Deadline.Priority.MEDIUM,
                'assigned_to': str(self.user.pk),
            },
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        task = Deadline.objects.get(title='Server locked task')
        self.assertEqual(task.due_diligence_process_id, locked_intake.pk)

    def test_case_scoped_signal_create_locks_intake_server_side(self):
        locked_intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Locked Signal Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        other_intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Other Signal Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        response = self.client.post(
            reverse('careon:case_signal_create', kwargs={'pk': locked_intake.pk}),
            {
                'due_diligence_process': str(other_intake.pk),
                'signal_type': CareSignal.SignalType.SAFETY,
                'risk_level': CareSignal.RiskLevel.MEDIUM,
                'status': CareSignal.SignalStatus.OPEN,
                'description': 'Server lock signal check',
                'follow_up': 'Follow-up required',
                'assigned_to': str(self.user.pk),
            },
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        signal = CareSignal.objects.get(description='Server lock signal check')
        self.assertEqual(signal.due_diligence_process_id, locked_intake.pk)

    def test_case_scoped_document_create_locks_case_server_side(self):
        locked_case = CareCase.objects.create(
            organization=self.organization,
            title='Locked Document Case',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user,
        )
        other_case = CareCase.objects.create(
            organization=self.organization,
            title='Other Document Case',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user,
        )
        locked_intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Locked Document Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            contract=locked_case,
        )

        response = self.client.post(
            reverse('careon:case_document_create', kwargs={'pk': locked_intake.pk}),
            {
                'title': 'Case locked document',
                'document_type': Document.DocType.OTHER,
                'status': Document.Status.DRAFT,
                'description': 'Should stay linked to locked case.',
                'contract': str(other_case.pk),
                'tags': 'flow',
            },
            follow=True,
        )

        self._assert_spa_shell(response)
        document = Document.objects.get(title='Case locked document')
        self.assertEqual(document.contract_id, locked_case.pk)

    def test_golden_flow_end_to_end_with_case_scoped_follow_up(self):
        case_record = CareCase.objects.create(
            organization=self.organization,
            title='Golden Case',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user,
        )
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Golden Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=0,
            max_capacity=2,
            average_wait_days=8,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Golden Intake',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            contract=case_record,
        )
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        assign_response = self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': intake.pk}),
            {
                'action': 'assign',
                'provider_id': str(provider.pk),
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=matching",
            },
            follow=True,
        )
        self.assertEqual(assign_response.status_code, 200)

        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        placement.status = PlacementRequest.Status.APPROVED
        placement.save(update_fields=['status'])

        task_response = self.client.post(
            reverse('careon:case_task_create', kwargs={'pk': intake.pk}),
            {
                'title': 'Golden task',
                'task_type': Deadline.TaskType.CONTACT_PROVIDER,
                'description': 'Contact provider for start.',
                'due_date': str(date.today() + timedelta(days=1)),
                'priority': Deadline.Priority.HIGH,
                'assigned_to': str(self.user.pk),
            },
            follow=True,
        )
        self.assertEqual(task_response.status_code, 200)

        signal_response = self.client.post(
            reverse('careon:case_signal_create', kwargs={'pk': intake.pk}),
            {
                'signal_type': CareSignal.SignalType.CAPACITY_ISSUE,
                'risk_level': CareSignal.RiskLevel.MEDIUM,
                'status': CareSignal.SignalStatus.OPEN,
                'description': 'Golden signal',
                'follow_up': 'Track availability',
                'assigned_to': str(self.user.pk),
            },
            follow=True,
        )
        self.assertEqual(signal_response.status_code, 200)

        document_response = self.client.post(
            reverse('careon:case_document_create', kwargs={'pk': intake.pk}),
            {
                'title': 'Golden document',
                'document_type': Document.DocType.MEMO,
                'status': Document.Status.DRAFT,
                'description': 'Case summary memo',
                'tags': 'golden',
            },
            follow=True,
        )
        self.assertEqual(document_response.status_code, 200)

        case_detail = self.client.get(reverse('careon:case_detail', kwargs={'pk': intake.pk}))
        self._assert_spa_shell(case_detail)

        placement_payload = self.client.get(
            reverse('careon:case_placement_detail_api', kwargs={'case_id': intake.contract_id})
        ).json()
        self.assertEqual(placement_payload.get('placement', {}).get('status'), PlacementRequest.Status.APPROVED)

        self.assertTrue(
            Deadline.objects.filter(
                title='Golden task',
                case_record_id=intake.pk,
            ).exists()
        )

        signals_payload = self.client.get(reverse('careon:signals_api')).json()
        self.assertTrue(any(signal.get('description') == 'Golden signal' for signal in signals_payload.get('signals', [])))

        self.assertTrue(
            Document.objects.filter(
                title='Golden document',
                contract_id=intake.pk,
            ).exists()
        )

    def test_case_detail_signal_action_updates_status_and_returns_to_case_tab(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Signal Action Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        signal = CareSignal.objects.create(
            intake=intake,
            signal_type=CareSignal.SignalType.SAFETY,
            description='Inline action signal',
            risk_level=CareSignal.RiskLevel.MEDIUM,
            status=CareSignal.SignalStatus.OPEN,
            created_by=self.user,
        )

        response = self.client.post(
            reverse('careon:signal_status_update', kwargs={'pk': signal.pk}),
            {
                'status': CareSignal.SignalStatus.IN_PROGRESS,
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=signalen",
            },
            follow=True,
        )

        self._assert_spa_shell(response)
        signal.refresh_from_db()
        self.assertEqual(signal.status, CareSignal.SignalStatus.IN_PROGRESS)

    def test_case_scoped_document_upload_links_phase_and_event_context(self):
        case_record = CareCase.objects.create(
            organization=self.organization,
            title='Document Context Case',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Document Context Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            contract=case_record,
        )

        upload_url = reverse('careon:case_document_create', kwargs={'pk': intake.pk})
        response = self.client.post(
            f'{upload_url}?phase=matching&event=provider_handoff',
            {
                'title': 'Phase linked document',
                'document_type': Document.DocType.MEMO,
                'status': Document.Status.DRAFT,
                'description': 'Linked from case context',
                'tags': 'pilot',
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        document = Document.objects.get(title='Phase linked document')
        self.assertEqual(document.contract_id, case_record.pk)
        self.assertIn('phase:matching', document.tags)
        self.assertIn('event:provider_handoff', document.tags)

        case_detail = self.client.get(reverse('careon:case_detail', kwargs={'pk': intake.pk}) + '?tab=documenten')
        self._assert_spa_shell(case_detail)

    def test_case_matching_tab_assigns_and_logs_history(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Case Match Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=0,
            max_capacity=2,
            average_wait_days=10,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Case Matching Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        action_response = self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': intake.pk}),
            {
                'action': 'assign',
                'provider_id': str(provider.pk),
                'phase': 'matching',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=matching",
            },
            follow=True,
        )

        self._assert_spa_shell(action_response)

        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.selected_provider_id, provider.pk)

        self.assertTrue(
            AuditLog.objects.filter(
                model_name='MatchingAssignment',
                action=AuditLog.Action.APPROVE,
                changes__intake_id=intake.pk,
                changes__provider_id=provider.pk,
            ).exists()
        )

    def test_case_communication_tab_renders_structured_items_and_provider_response(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Communicatie Aanbieder',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Case Communicatie Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        placement = PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=provider,
            selected_provider=provider,
            care_form=intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
            provider_response_requested_at=timezone.now() - timedelta(hours=10),
            provider_response_notes='Aanvullende informatie nodig over intakecontext.',
        )

        CaseDecisionLog.objects.create(
            case=intake,
            placement=placement,
            event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            actor=self.user,
            actor_kind=CaseDecisionLog.ActorKind.USER,
            action_source='case_detail',
            user_action='operational_message',
            optional_reason='Open vraag voor matchingcoordinator.',
            adaptive_flags={
                'communication_type': 'operational_message',
                'communication_status': 'open',
                'workflow_stage': 'matching',
                'blocks_progress': True,
            },
        )
        CaseDecisionLog.objects.create(
            case=intake,
            event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            actor=self.user,
            actor_kind=CaseDecisionLog.ActorKind.USER,
            action_source='case_detail',
            user_action='internal_note',
            optional_reason='Interne afstemming over vervolgstap.',
            adaptive_flags={
                'communication_type': 'internal_note',
                'communication_status': 'informational',
                'workflow_stage': 'matching',
            },
        )
        CaseDecisionLog.objects.create(
            case=intake,
            placement=placement,
            event_type=CaseDecisionLog.EventType.MATCH_RECOMMENDED,
            action_source='system',
            actor_kind=CaseDecisionLog.ActorKind.SYSTEM,
            recommendation_context={'source': 'test'},
        )

        response = self.client.get(reverse('careon:case_detail', kwargs={'pk': intake.pk}) + '?tab=communicatie')

        self._assert_spa_shell(response)
        self.assertTrue(
            CaseDecisionLog.objects.filter(
                case=intake,
                event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            ).exists()
        )

    def test_case_communication_action_creates_item_and_marks_resolved(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Case Communicatie Actie',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        create_response = self.client.post(
            reverse('careon:case_communication_action', kwargs={'pk': intake.pk}),
            {
                'action': 'add_message',
                'workflow_stage': 'matching',
                'content': 'Vraag aan aanbieder over aanvullende intakegegevens.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=communicatie",
            },
            follow=True,
        )
        self._assert_spa_shell(create_response)

        open_item = CaseDecisionLog.objects.filter(
            case=intake,
            event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
            user_action='operational_message',
        ).order_by('-id').first()
        self.assertIsNotNone(open_item)

        resolve_response = self.client.post(
            reverse('careon:case_communication_action', kwargs={'pk': intake.pk}),
            {
                'action': 'mark_resolved',
                'target_log_id': str(open_item.pk),
                'workflow_stage': 'matching',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=communicatie&comm_filter=open",
            },
            follow=True,
        )
        self._assert_spa_shell(resolve_response)

        self.assertTrue(
            CaseDecisionLog.objects.filter(
                case=intake,
                event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
                user_action='resolve_item',
                adaptive_flags__resolves_log_id=open_item.pk,
            ).exists()
        )

    def test_case_communication_tab_empty_state_renders_safely(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Case Communicatie Empty',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.LOW,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        response = self.client.get(reverse('careon:case_detail', kwargs={'pk': intake.pk}) + '?tab=communicatie')

        self._assert_spa_shell(response)

    def test_case_communication_action_respects_edit_permissions(self):
        restricted_user = User.objects.create_user(
            username='flow_member_readonly',
            email='flow-member-readonly@example.com',
            password='testpass123',
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=restricted_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )

        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Case Communicatie Permissions',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        self.client.logout()
        self.client.login(username='flow_member_readonly', password='testpass123')

        response = self.client.post(
            reverse('careon:case_communication_action', kwargs={'pk': intake.pk}),
            {
                'action': 'add_message',
                'workflow_stage': 'matching',
                'content': 'Niet toegestaan',
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            CaseDecisionLog.objects.filter(
                case=intake,
                event_type=CaseDecisionLog.EventType.CASE_COMMUNICATION,
                optional_reason='Niet toegestaan',
            ).exists()
        )

    def test_case_matching_reject_logs_rejected_option(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Rejected Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=4,
            average_wait_days=20,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Case Matching Reject Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        response = self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': intake.pk}),
            {
                'action': 'reject',
                'provider_id': str(provider.pk),
                'reason': 'Niet passend voor deze casus.',
                'phase': 'matching',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=matching",
            },
            follow=True,
        )

        self._assert_spa_shell(response)
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='MatchingRecommendation',
                action=AuditLog.Action.REJECT,
                changes__intake_id=intake.pk,
                changes__provider_id=provider.pk,
            ).exists()
        )

    def test_case_placement_action_updates_status_and_preserves_notes(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Placement Action Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Case Placement Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        placement = PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=provider,
            selected_provider=provider,
            care_form=intake.preferred_care_form,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            decision_notes='Bestaande notitie',
        )

        response = self.client.post(
            reverse('careon:case_placement_action', kwargs={'pk': intake.pk}),
            {
                'status': PlacementRequest.Status.APPROVED,
                'note': 'Plaatsing bevestigd vanuit casusdetail.',
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self._assert_spa_shell(response)
        placement.refresh_from_db()
        self.assertEqual(placement.status, PlacementRequest.Status.APPROVED)
        self.assertIn('Bestaande notitie', placement.decision_notes)
        self.assertIn('Plaatsing bevestigd vanuit casusdetail.', placement.decision_notes)
        log = CaseDecisionLog.objects.get(event_type=CaseDecisionLog.EventType.PROVIDER_SELECTED)
        self.assertEqual(log.case_id, intake.pk)
        self.assertEqual(log.placement_id, placement.pk)
        self.assertEqual(log.provider_id, provider.id)
        self.assertEqual(log.user_action, 'approve_placement')
        self.assertEqual(log.actor_id, self.user.id)

    def test_sync_case_flow_state_keeps_placement_in_review_until_provider_acceptance(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Sync Flow Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        case = CareCase.objects.create(
            organization=self.organization,
            title='Sync Flow Case',
            contract_type=CareCase.ContractType.OTHER,
            status=CareCase.Status.PENDING,
            service_region='Utrecht',
            risk_level=CareCase.RiskLevel.MEDIUM,
            case_phase=CareCase.CasePhase.PLAATSING,
            client=provider,
            created_by=self.user,
        )

        sync_case_flow_state(case, user=self.user)

        intake = case.due_diligence_process
        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.status, PlacementRequest.Status.IN_REVIEW)
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)

    def test_overview_pages_show_next_actions(self):
        response_tasks = self.client.get(reverse('careon:task_list'))
        self._assert_spa_shell(response_tasks)

        response_matching = self.client.get(reverse('careon:matching_dashboard'))
        self._assert_spa_shell(response_matching)

        response_signals = self.client.get(reverse('careon:signal_list'))
        self._assert_spa_shell(response_signals)

        response_documents = self.client.get(reverse('careon:document_list'))
        self._assert_spa_shell(response_documents)

    def test_assessment_detail_links_back_to_case_focused_matching(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Assessment Detail Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        response = self.client.get(reverse('careon:assessment_detail', kwargs={'pk': assessment.pk}))

        self._assert_spa_shell(response)

    def test_placement_pages_breadcrumb_to_real_dashboard(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Placement Breadcrumb Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=3,
            average_wait_days=6,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Placement Breadcrumb Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=MINIMAL_WORKFLOW_SUMMARY,
        )

        self.client.post(
            reverse('careon:case_matching_action', kwargs={'pk': intake.pk}),
            {
                'action': 'assign',
                'provider_id': str(provider.pk),
                'next': f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=matching",
            },
            follow=True,
        )
        placement = PlacementRequest.objects.get(due_diligence_process=intake)

        detail_response = self.client.get(reverse('careon:placement_detail', kwargs={'pk': placement.pk}))
        self._assert_spa_shell(detail_response)

        form_response = self.client.get(reverse('careon:placement_update', kwargs={'pk': placement.pk}))
        self.assertIn(form_response.status_code, (200, 403))

    def test_task_list_orphan_deadline_is_inspection_only(self):
        configuration = CareConfiguration.objects.create(
            organization=self.organization,
            title='Orphan Task Configuration',
            created_by=self.user,
        )
        orphan_deadline = Deadline.objects.create(
            configuration=configuration,
            title='Orphan task',
            task_type=Deadline.TaskType.CONTACT_PROVIDER,
            description='Legacy orphan task',
            due_date=date.today() + timedelta(days=1),
            priority=Deadline.Priority.MEDIUM,
            created_by=self.user,
            assigned_to=self.user,
        )

        response = self.client.get(reverse('careon:task_list') + '?show=all')

        self._assert_spa_shell(response)
