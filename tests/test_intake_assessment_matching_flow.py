from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareProvider,
    CareSignal,
    Deadline,
    Document,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
)


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
        assessment = CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        assessment_list_response = self.client.get(reverse('careon:assessment_list'))
        self.assertEqual(assessment_list_response.status_code, 200)
        self.assertContains(assessment_list_response, 'Flow Intake')

        matching_response = self.client.get(reverse('careon:matching_dashboard'))
        self.assertEqual(matching_response.status_code, 200)
        self.assertContains(matching_response, 'Flow Intake')
        self.assertContains(matching_response, 'Flow Aanbieder')

        assign_response = self.client.post(
            reverse('careon:matching_dashboard'),
            {
                'action': 'assign',
                'assessment_id': str(assessment.pk),
                'provider_id': str(provider.pk),
            },
            follow=True,
        )
        self.assertEqual(assign_response.status_code, 200)

        placement = PlacementRequest.objects.get(due_diligence_process=intake)
        self.assertEqual(placement.selected_provider_id, provider.id)
        self.assertEqual(placement.proposed_provider_id, provider.id)

        intake.refresh_from_db()
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.MATCHING)
        self.assertContains(assign_response, 'Toegewezen: Flow Aanbieder')

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
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.DRAFT,
            matching_ready=False,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Geen beoordelingen met status "Goedgekeurd voor matching".')
        self.assertNotContains(response, 'Draft Intake')

    def test_matching_dashboard_shows_no_provider_profile_fallback(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Approved Intake Zonder Profiel',
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Approved Intake Zonder Profiel')
        self.assertContains(response, 'Geen zorgaanbieders met profielgegevens beschikbaar voor deze beoordeling.')

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

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Locked Document Intake')
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
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        assign_response = self.client.post(
            reverse('careon:matching_dashboard'),
            {
                'action': 'assign',
                'assessment_id': str(assessment.pk),
                'provider_id': str(provider.pk),
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
        self.assertContains(case_detail, 'Plaatsing bevestigd')
        self.assertContains(case_detail, 'Golden task')
        self.assertContains(case_detail, 'Capaciteit probleem')
        self.assertContains(case_detail, 'Golden document')

    def test_overview_pages_show_next_actions(self):
        response_tasks = self.client.get(reverse('careon:task_list'))
        self.assertEqual(response_tasks.status_code, 200)
        self.assertContains(response_tasks, 'Nieuwe taak')

        response_matching = self.client.get(reverse('careon:matching_dashboard'))
        self.assertEqual(response_matching.status_code, 200)
        self.assertContains(response_matching, 'Open beoordelingen')

        response_signals = self.client.get(reverse('careon:signal_list'))
        self.assertEqual(response_signals.status_code, 200)
        self.assertContains(response_signals, 'Nieuw signaal')

        response_documents = self.client.get(reverse('careon:document_list'))
        self.assertEqual(response_documents.status_code, 200)
        self.assertContains(response_documents, 'Document toevoegen')

    def test_assessment_detail_links_back_to_case_focused_matching(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Assessment Detail Intake',
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        assessment = CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('careon:assessment_detail', kwargs={'pk': assessment.pk}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f"{reverse('careon:matching_dashboard')}?intake={intake.pk}")

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
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        assessment = CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        self.client.post(
            reverse('careon:matching_dashboard'),
            {
                'action': 'assign',
                'assessment_id': str(assessment.pk),
                'provider_id': str(provider.pk),
            },
            follow=True,
        )
        placement = PlacementRequest.objects.get(due_diligence_process=intake)

        detail_response = self.client.get(reverse('careon:placement_detail', kwargs={'pk': placement.pk}))
        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, reverse('dashboard'))

        form_response = self.client.get(reverse('careon:placement_update', kwargs={'pk': placement.pk}))
        self.assertEqual(form_response.status_code, 200)
        self.assertContains(form_response, reverse('dashboard'))
