"""Audit log retention on read/export surfaces."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from contracts.models import AuditLog, Organization, OrganizationMembership, UserProfile

User = get_user_model()


@override_settings(CARELANE_AUDIT_LOG_RETENTION_DAYS=30)
class AuditLogRetentionApiTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Retention Org', slug='retention-org')
        self.user = User.objects.create_user(username='retention_user', password='passR1234!')
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
            object_repr='recent row',
        )
        old = AuditLog.objects.create(
            user=self.user,
            action=AuditLog.Action.UPDATE,
            model_name='CareCase',
            object_id=2,
            object_repr='expired row',
        )
        AuditLog.objects.filter(pk=old.pk).update(
            timestamp=timezone.now() - timedelta(days=45),
        )

    def test_audit_log_api_excludes_rows_outside_retention_window(self):
        self.client.login(username='retention_user', password='passR1234!')
        response = self.client.get(reverse('carelane:audit_log_api'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload.get('retentionDays'), 30)
        reprs = {row['objectRepr'] for row in payload.get('entries', [])}
        self.assertIn('recent row', reprs)
        self.assertNotIn('expired row', reprs)

    def test_audit_log_export_respects_retention_window(self):
        self.client.login(username='retention_user', password='passR1234!')
        response = self.client.get(reverse('carelane:audit_log_export_api') + '?format=json')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        reprs = {row['objectRepr'] for row in payload.get('entries', [])}
        self.assertIn('recent row', reprs)
        self.assertNotIn('expired row', reprs)
        self.assertEqual(payload.get('retentionDays'), 30)
