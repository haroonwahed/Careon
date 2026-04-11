from datetime import timedelta
import json

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    CareCase,
    CareConfiguration,
    Deadline,
    Document,
    CareTask,
    Notification,
    Organization,
    OrganizationMembership,
    CareSignal,
    Workflow,
    WorkflowStep,
)


class MentionsAiAndReminderTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username='owner',
            email='owner@example.com',
            password='testpass123',
        )
        self.member = User.objects.create_user(
            username='member',
            email='member@example.com',
            password='testpass123',
        )
        self.admin = User.objects.create_user(
            username='adminuser',
            email='admin@example.com',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            username='outsider',
            email='outsider@example.com',
            password='testpass123',
        )

        self.organization = Organization.objects.create(name='Acme Regie', slug='acme-regie-main')
        self.other_organization = Organization.objects.create(name='Other Regie', slug='other-regie')

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
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.admin,
            role=OrganizationMembership.Role.ADMIN,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.other_organization,
            user=self.outsider,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

        self.contract = CareCase.objects.create(
            organization=self.organization,
            title='Master Services Agreement',
            contract_type=CareCase.ContractType.MSA,
            status=CareCase.Status.ACTIVE,
            risk_level=CareCase.RiskLevel.HIGH,
            content='Primary terms and obligations.',
            created_by=self.owner,
            end_date=timezone.localdate() + timedelta(days=7),
            renewal_date=timezone.localdate() + timedelta(days=14),
            auto_renew=True,
        )
        self.configuration = CareConfiguration.objects.create(
            organization=self.organization,
            title='Gemeenteconfiguratie A',
            created_by=self.owner,
            status=CareConfiguration.Status.ACTIVE,
        )
        self.deadline = Deadline.objects.create(
            title='Case review checkpoint',
            due_date=timezone.localdate() + timedelta(days=5),
            case_record=self.contract,
            created_by=self.owner,
        )
        self.workflow = Workflow.objects.create(
            title='Case approval workflow',
            description='Workflow linked to case',
            case_record=self.contract,
            created_by=self.owner,
        )
        self.workflow_step = WorkflowStep.objects.create(
            workflow=self.workflow,
            name='Case signoff',
            description='Complete case review and signoff.',
            status=WorkflowStep.Status.PENDING,
            order=1,
        )
        self.risk_log = CareSignal.objects.create(
            title='Data transfer compliance risk',
            description='Potential non-compliance if SCCs are missing.',
            risk_level=CareSignal.RiskLevel.HIGH,
            case_record=self.contract,
            created_by=self.owner,
        )
        self.legal_task = CareTask.objects.create(
            title='Finalize execution package',
            description='Collect signatures and archive final PDFs.',
            priority=CareTask.Priority.HIGH,
            due_date=timezone.localdate() + timedelta(days=10),
            case_record=self.contract,
            assigned_to=self.owner,
        )

    def test_configuration_update_allows_tenant_member(self):
        self.client.login(username='member', password='testpass123')

        response = self.client.get(
            reverse('careon:configuration_update', kwargs={'pk': self.configuration.id}),
        )

        self.assertEqual(response.status_code, 200)

    def test_configuration_update_allows_tenant_admin(self):
        self.client.login(username='adminuser', password='testpass123')

        response = self.client.get(
            reverse('careon:configuration_update', kwargs={'pk': self.configuration.id}),
        )

        self.assertEqual(response.status_code, 200)

    def test_document_create_requires_case_edit_permission(self):
        self.client.login(username='member', password='testpass123')

        response = self.client.post(
            reverse('careon:document_create'),
            {
                'title': 'Unapproved upload',
                'document_type': 'CONTRACT',
                'status': 'DRAFT',
                'contract': self.contract.id,
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(Document.objects.filter(title='Unapproved upload').exists())

    def test_document_create_allows_admin_for_case(self):
        self.client.login(username='adminuser', password='testpass123')

        response = self.client.post(
            reverse('careon:document_create'),
            {
                'title': 'Approved upload',
                'document_type': 'CONTRACT',
                'status': 'DRAFT',
                'contract': self.contract.id,
            },
        )

        self.assertEqual(response.status_code, 302)
        self.assertTrue(Document.objects.filter(title='Approved upload').exists())

    def test_deadline_update_requires_case_edit_permission(self):
        self.client.login(username='member', password='testpass123')

        response = self.client.get(
            reverse('careon:deadline_update', kwargs={'pk': self.deadline.id}),
        )

        self.assertEqual(response.status_code, 403)

    def test_deadline_complete_requires_case_edit_permission(self):
        self.client.login(username='member', password='testpass123')

        response = self.client.post(
            reverse('careon:deadline_complete', kwargs={'pk': self.deadline.id}),
        )

        self.assertEqual(response.status_code, 403)
        self.deadline.refresh_from_db()
        self.assertFalse(self.deadline.is_completed)

    def test_deadline_complete_allows_admin_for_case(self):
        self.client.login(username='adminuser', password='testpass123')

        response = self.client.post(
            reverse('careon:deadline_complete', kwargs={'pk': self.deadline.id}),
        )

        self.assertEqual(response.status_code, 302)
        self.deadline.refresh_from_db()
        self.assertTrue(self.deadline.is_completed)

    def test_task_create_requires_case_edit_permission(self):
        self.client.login(username='member', password='testpass123')

        response = self.client.post(
            reverse('careon:care_task_create'),
            {
                'title': 'Unauthorized task',
                'description': 'Should fail for member.',
                'priority': CareTask.Priority.MEDIUM,
                'due_date': (timezone.localdate() + timedelta(days=12)).isoformat(),
                'case_record': self.contract.id,
            },
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(CareTask.objects.filter(title='Unauthorized task').exists())

    def test_task_update_requires_case_edit_permission(self):
        self.client.login(username='member', password='testpass123')

        response = self.client.get(
            reverse('careon:task_update', kwargs={'pk': self.legal_task.id}),
        )

        self.assertEqual(response.status_code, 403)

    def test_task_update_allows_admin(self):
        self.client.login(username='adminuser', password='testpass123')

        response = self.client.get(
            reverse('careon:task_update', kwargs={'pk': self.legal_task.id}),
        )

        self.assertEqual(response.status_code, 200)

    def test_configuration_update_allows_admin(self):
        self.client.login(username='adminuser', password='testpass123')

        response = self.client.get(
            reverse('careon:configuration_update', kwargs={'pk': self.configuration.id}),
        )

        self.assertEqual(response.status_code, 200)

    def test_case_reminder_command_creates_and_deduplicates_notifications(self):
        call_command('send_case_reminders')

        owner_notifications = Notification.objects.filter(recipient=self.owner, title__icontains='herinnering')
        admin_notifications = Notification.objects.filter(recipient=self.admin, title__icontains='herinnering')
        self.assertGreater(owner_notifications.count(), 0)
        self.assertGreater(admin_notifications.count(), 0)

        first_count = Notification.objects.count()
        call_command('send_case_reminders')
        second_count = Notification.objects.count()
        self.assertEqual(first_count, second_count)
