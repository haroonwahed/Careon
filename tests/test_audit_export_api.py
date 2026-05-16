"""Audit log export and case dispute export APIs."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    AuditLog,
    CaseIntakeProcess,
    CaseTimelineEvent,
    Organization,
    OrganizationMembership,
    UserProfile,
)
from tests.test_utils import middleware_without_spa_shell

User = get_user_model()

_WS = override_settings(MIDDLEWARE=middleware_without_spa_shell())


@_WS
class AuditLogExportApiTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Export Org', slug='export-org')
        self.user = User.objects.create_user(username='export_gemeente', password='passE1234!')
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(
            user=self.user,
            defaults={'role': UserProfile.Role.ASSOCIATE},
        )
        AuditLog.objects.create(
            user=self.user,
            action=AuditLog.Action.UPDATE,
            model_name='CareCase',
            object_id=1,
            object_repr='probe',
        )

    def test_gemeente_csv_export(self):
        self.client.login(username='export_gemeente', password='passE1234!')
        response = self.client.get(reverse('careon:audit_log_export_api'))
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response['Content-Type'])
        self.assertIn(b'timestamp', response.content)
        self.assertIn(b'probe', response.content)

    def test_gemeente_json_export(self):
        self.client.login(username='export_gemeente', password='passE1234!')
        response = self.client.get(reverse('careon:audit_log_export_api') + '?format=json')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertGreaterEqual(payload.get('rowCount', 0), 1)


@_WS
class CaseDisputeExportApiTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Dispute Org', slug='dispute-org')
        self.user = User.objects.create_user(username='dispute_user', password='passD1234!')
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(
            user=self.user,
            defaults={'role': UserProfile.Role.ASSOCIATE},
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='Dispute Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=14),
            case_coordinator=self.user,
            workflow_state=CaseIntakeProcess.WorkflowState.MATCHING_READY,
        )
        self.case = self.intake.ensure_case_record(created_by=self.user)
        CaseTimelineEvent.objects.create(
            organization=self.org,
            care_case=self.case,
            event_type=CaseTimelineEvent.EventType.WORKFLOW_BLOCKED,
            occurred_at=timezone.now(),
            actor=self.user,
            actor_role='gemeente',
            source='test_audit_export',
            summary='Test event',
            metadata={},
        )

    def test_dispute_export_json(self):
        self.client.login(username='dispute_user', password='passD1234!')
        url = reverse('careon:case_dispute_export_api', kwargs={'case_id': self.case.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.content.decode())
        payload = response.json()
        self.assertEqual(payload['caseId'], str(self.case.pk))
        self.assertGreaterEqual(len(payload.get('timelineEvents', [])), 1)

    def test_dispute_export_other_org_404(self):
        other_org = Organization.objects.create(name='Other', slug='other-dispute')
        other_user = User.objects.create_user(username='other_dispute', password='passO1234!')
        OrganizationMembership.objects.create(
            organization=other_org,
            user=other_user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='other_dispute', password='passO1234!')
        url = reverse('careon:case_dispute_export_api', kwargs={'case_id': self.case.pk})
        self.assertEqual(self.client.get(url).status_code, 404)
