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
    CareCase,
    CareSignal,
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareProvider,
    Deadline,
    Document,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
)


@override_settings(MIDDLEWARE=_MIDDLEWARE_WITHOUT_SPA_SHELL)
class RolePermissionAlignmentTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.organization = Organization.objects.create(name='Role Audit Org', slug='role-audit-org')

        self.owner = User.objects.create_user(username='owner_user', password='pass123')
        self.admin = User.objects.create_user(username='admin_user', password='pass123')
        self.member = User.objects.create_user(username='member_user', password='pass123')

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

        self.case_record = CareCase.objects.create(
            organization=self.organization,
            title='Role Case',
            contract_type='NDA',
            status=CareCase.Status.ACTIVE,
            created_by=self.owner,
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            contract=self.case_record,
            title='Role Intake',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            case_coordinator=self.owner,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            complexity=CaseIntakeProcess.Complexity.SIMPLE,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        )

        self.unassessed_case_record = CareCase.objects.create(
            organization=self.organization,
            title='Role Case Unassessed',
            contract_type='NDA',
            status=CareCase.Status.ACTIVE,
            created_by=self.owner,
        )
        self.unassessed_intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            contract=self.unassessed_case_record,
            title='Role Intake Unassessed',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            case_coordinator=self.owner,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=14),
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            complexity=CaseIntakeProcess.Complexity.SIMPLE,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        )

        self.assessment = CaseAssessment.objects.create(
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

        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Role Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.owner,
        )
        ProviderProfile.objects.create(
            client=self.provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=0,
            max_capacity=3,
            average_wait_days=9,
        )

        self.placement = PlacementRequest.objects.create(
            intake=self.intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=self.intake.preferred_care_form,
        )

        self.signal = CareSignal.objects.create(
            intake=self.intake,
            case_record=self.case_record,
            signal_type=CareSignal.SignalType.SAFETY,
            description='Role signal',
            risk_level=CareSignal.RiskLevel.MEDIUM,
            status=CareSignal.SignalStatus.OPEN,
            created_by=self.owner,
        )

        self.document = Document.objects.create(
            organization=self.organization,
            title='Role document',
            contract=self.case_record,
            document_type=Document.DocType.MEMO,
            status=Document.Status.DRAFT,
            uploaded_by=self.owner,
        )

        self.deadline = Deadline.objects.create(
            due_diligence_process=self.intake,
            case_record=self.case_record,
            title='Role task',
            task_type=Deadline.TaskType.CONTACT_PROVIDER,
            priority=Deadline.Priority.HIGH,
            due_date=date.today() + timedelta(days=2),
            created_by=self.owner,
            assigned_to=self.owner,
        )

    def _login(self, user):
        self.client.logout()
        self.client.login(username=user.username, password='pass123')

    def test_member_sees_read_only_actions_on_case_flow_pages(self):
        self._login(self.member)

        case_response = self.client.get(reverse('careon:case_detail', kwargs={'pk': self.intake.pk}))
        self.assertEqual(case_response.status_code, 200)
        self.assertNotContains(case_response, f'/care/casussen/{self.intake.pk}/taken/new/')
        self.assertNotContains(case_response, f'/care/casussen/{self.intake.pk}/signalen/new/')
        self.assertNotContains(case_response, reverse('careon:case_update', kwargs={'pk': self.intake.pk}))

        matching_response = self.client.get(reverse('careon:matching_dashboard'))
        self.assertEqual(matching_response.status_code, 200)
        self.assertNotContains(matching_response, reverse('careon:case_matching_action', kwargs={'pk': self.intake.pk}))

        placement_list_response = self.client.get(reverse('careon:placement_list'))
        self.assertEqual(placement_list_response.status_code, 200)
        self.assertContains(placement_list_response, reverse('careon:case_detail', kwargs={'pk': self.intake.pk}))

        signal_list_response = self.client.get(reverse('careon:signal_list'))
        self.assertEqual(signal_list_response.status_code, 200)
        self.assertNotContains(signal_list_response, reverse('careon:signal_create'))

        document_list_response = self.client.get(reverse('careon:document_list'))
        self.assertEqual(document_list_response.status_code, 200)
        self.assertNotContains(document_list_response, reverse('careon:document_create'))

        deadline_list_response = self.client.get(reverse('careon:task_list') + '?show=all')
        self.assertEqual(deadline_list_response.status_code, 200)
        self.assertNotContains(deadline_list_response, reverse('careon:task_create'))

        assessment_detail_response = self.client.get(reverse('careon:assessment_detail', kwargs={'pk': self.assessment.pk}))
        self.assertEqual(assessment_detail_response.status_code, 200)
        self.assertNotContains(assessment_detail_response, reverse('careon:assessment_update', kwargs={'pk': self.assessment.pk}))

    def test_owner_and_admin_keep_edit_actions_visible(self):
        for user in (self.owner, self.admin):
            self._login(user)

            case_response = self.client.get(reverse('careon:case_detail', kwargs={'pk': self.intake.pk}))
            self.assertEqual(case_response.status_code, 200)
            self.assertContains(case_response, f'/care/casussen/{self.intake.pk}/taken/new/')
            self.assertContains(case_response, f'/care/casussen/{self.intake.pk}/signalen/new/')

            matching_response = self.client.get(reverse('careon:matching_dashboard'))
            self.assertEqual(matching_response.status_code, 200)

            matching_action_response = self.client.post(
                reverse('careon:case_matching_action', kwargs={'pk': self.intake.pk}),
                {'action': 'reject', 'provider_id': str(self.provider.pk)},
                follow=False,
            )
            self.assertNotEqual(matching_action_response.status_code, 403)

            placement_action_response = self.client.post(
                reverse('careon:case_placement_action', kwargs={'pk': self.intake.pk}),
                {'status': PlacementRequest.Status.APPROVED},
                follow=False,
            )
            self.assertNotEqual(placement_action_response.status_code, 403)

            assessment_detail_response = self.client.get(reverse('careon:assessment_detail', kwargs={'pk': self.assessment.pk}))
            self.assertEqual(assessment_detail_response.status_code, 200)
            self.assertContains(assessment_detail_response, reverse('careon:assessment_update', kwargs={'pk': self.assessment.pk}))

    def test_member_direct_edit_routes_remain_forbidden(self):
        self._login(self.member)

        self.assertEqual(
            self.client.get(reverse('careon:placement_update', kwargs={'pk': self.placement.pk})).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse('careon:signal_update', kwargs={'pk': self.signal.pk})).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse('careon:task_update', kwargs={'pk': self.deadline.pk})).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse('careon:document_update', kwargs={'pk': self.document.pk})).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                reverse('careon:signal_status_update', kwargs={'pk': self.signal.pk}),
                {'status': CareSignal.SignalStatus.IN_PROGRESS},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                reverse('careon:case_matching_action', kwargs={'pk': self.intake.pk}),
                {'action': 'reject', 'provider_id': str(self.provider.pk)},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                reverse('careon:case_placement_action', kwargs={'pk': self.intake.pk}),
                {'status': PlacementRequest.Status.APPROVED},
            ).status_code,
            403,
        )

    def test_member_case_and_assessment_edit_routes_forbidden(self):
        self._login(self.member)

        self.assertEqual(
            self.client.get(reverse('careon:case_update', kwargs={'pk': self.intake.pk})).status_code,
            403,
        )
        self.assertEqual(
            self.client.get(reverse('careon:assessment_update', kwargs={'pk': self.assessment.pk})).status_code,
            403,
        )

    def test_member_case_scoped_create_routes_forbidden(self):
        self._login(self.member)

        task_response = self.client.post(
            reverse('careon:case_task_create', kwargs={'pk': self.intake.pk}),
            {
                'due_diligence_process': str(self.intake.pk),
                'title': 'Member task should fail',
                'task_type': Deadline.TaskType.CONTACT_PROVIDER,
                'description': 'nope',
                'due_date': (date.today() + timedelta(days=1)).isoformat(),
                'priority': Deadline.Priority.MEDIUM,
            },
        )
        self.assertEqual(task_response.status_code, 403)

        assessment_response = self.client.post(
            reverse('careon:assessment_create'),
            {
                'due_diligence_process': str(self.unassessed_intake.pk),
                'assessment_status': CaseAssessment.AssessmentStatus.DRAFT,
                'matching_ready': '',
                'reason_not_ready': 'nope',
                'notes': 'nope',
            },
        )
        self.assertEqual(assessment_response.status_code, 403)
