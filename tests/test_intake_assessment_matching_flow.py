from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    AuditLog,
    CareCase,
    CareConfiguration,
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
        self.assertContains(assign_response, 'Matching in deze casus')
        self.assertContains(assign_response, 'Open matchingbesluit')
        self.assertFalse(PlacementRequest.objects.filter(due_diligence_process=intake).exists())

        intake.refresh_from_db()
        self.assertEqual(intake.status, CaseIntakeProcess.ProcessStatus.INTAKE)

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
        self.assertContains(response, 'Er zijn momenteel geen beoordelingen met status "Goedgekeurd voor matching".')
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
        self.assertContains(response, 'Geen zorgaanbieders beschikbaar voor deze beoordeling.')

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
        self.assertContains(response, 'ds-detail-shell')
        self.assertContains(response, 'ds-summary-strip')
        self.assertContains(response, 'ds-tabs-nav')
        self.assertContains(response, 'ds-sidebar-card--primary')

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
        self.assertContains(case_detail, 'Plaatsing bevestigd')
        self.assertContains(case_detail, 'Golden task')
        self.assertContains(case_detail, 'Capaciteit probleem')
        self.assertContains(case_detail, 'Golden document')

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

        self.assertEqual(response.status_code, 200)
        signal.refresh_from_db()
        self.assertEqual(signal.status, CareSignal.SignalStatus.IN_PROGRESS)
        self.assertContains(response, 'Open signalen')

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
        self.assertContains(case_detail, 'Fase: Matching')
        self.assertContains(case_detail, 'Event: provider_handoff')

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
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
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

        self.assertEqual(action_response.status_code, 200)
        self.assertContains(action_response, 'Matchgeschiedenis')
        self.assertContains(action_response, provider.name)

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
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
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

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Afgewezen opties')
        self.assertContains(response, provider.name)
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

        self.assertEqual(response.status_code, 200)
        placement.refresh_from_db()
        self.assertEqual(placement.status, PlacementRequest.Status.APPROVED)
        self.assertIn('Bestaande notitie', placement.decision_notes)
        self.assertIn('Plaatsing bevestigd vanuit casusdetail.', placement.decision_notes)
        self.assertContains(response, provider.name)

    def test_overview_pages_show_next_actions(self):
        response_tasks = self.client.get(reverse('careon:task_list'))
        self.assertEqual(response_tasks.status_code, 200)
        self.assertContains(response_tasks, 'Open casussen')

        response_matching = self.client.get(reverse('careon:matching_dashboard'))
        self.assertEqual(response_matching.status_code, 200)
        self.assertContains(response_matching, 'Open beoordelingen')

        response_signals = self.client.get(reverse('careon:signal_list'))
        self.assertEqual(response_signals.status_code, 200)
        self.assertContains(response_signals, 'Open casussen')

        response_documents = self.client.get(reverse('careon:document_list'))
        self.assertEqual(response_documents.status_code, 200)
        self.assertContains(response_documents, 'Open casussen')

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
        self.assertEqual(detail_response.status_code, 200)
        self.assertContains(detail_response, reverse('dashboard'))
        self.assertNotContains(detail_response, reverse('careon:placement_update', kwargs={'pk': placement.pk}))

        form_response = self.client.get(reverse('careon:placement_update', kwargs={'pk': placement.pk}))
        self.assertEqual(form_response.status_code, 403)

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

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Inspectie')
        self.assertNotContains(response, reverse('careon:task_update', kwargs={'pk': orphan_deadline.pk}))

