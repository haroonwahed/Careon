"""
Tests for Blocker 4: provider notification on send_to_provider.

Covers:
  1. send_to_provider creates an in-app Notification for the provider's org members
  2. Notification is tenant-scoped (org A's send_to_provider does not notify org B)
  3. Missing contact email is logged, no exception raised
  4. Email failure is logged, placement still completes (email never aborts placement)
  5. Duplicate guard: second send_to_provider for same intake does not create duplicate
  6. notification API returns correct unread count
  7. notification API count updates after new notifications are created
"""
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from datetime import date, timedelta

from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    Client,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    UserProfile,
)
from contracts.models.governance import Notification
from contracts.workflow_state_machine import WorkflowState
from contracts.notifications import notify_provider_review_requested
from tests.test_utils import middleware_without_spa_shell

User = get_user_model()

_WS = override_settings(MIDDLEWARE=middleware_without_spa_shell())


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_org_and_user(slug, role=OrganizationMembership.Role.OWNER):
    org = Organization.objects.create(name=f'Org {slug}', slug=slug)
    user = User.objects.create_user(
        username=f'u_{slug}', email=f'{slug}@test.example', password='pass',
    )
    OrganizationMembership.objects.create(organization=org, user=user, role=role, is_active=True)
    UserProfile.objects.update_or_create(user=user, defaults={'role': UserProfile.Role.ASSOCIATE})
    return org, user


def _make_provider_client(provider_org, name='TestProvider', email='provider@example.com'):
    return Client.objects.create(
        organization=provider_org,
        name=name,
        client_type=Client.ClientType.CORPORATION,
        primary_contact_email=email,
    )


def _make_intake_and_placement(gemeente_org, provider_client):
    # Minimal required fields for CaseIntakeProcess
    coordinator = User.objects.filter(
        organization_memberships__organization=gemeente_org, is_active=True,
    ).first()
    intake = CaseIntakeProcess.objects.create(
        organization=gemeente_org,
        title='Test casus notificatie',
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=CaseIntakeProcess.Urgency.MEDIUM,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=14),
        case_coordinator=coordinator,
        workflow_state=WorkflowState.GEMEENTE_VALIDATED,
    )
    placement = PlacementRequest.objects.create(
        due_diligence_process=intake,
        proposed_provider=provider_client,
        status=PlacementRequest.Status.IN_REVIEW,
    )
    return intake, placement


# ---------------------------------------------------------------------------
# Unit: notify_provider_review_requested
# ---------------------------------------------------------------------------

class ProviderNotificationUnitTests(TestCase):

    def setUp(self):
        self.gemeente_org, self.gemeente_user = _make_org_and_user('pn-gemeente')
        self.provider_org, self.provider_user = _make_org_and_user('pn-provider')
        self.provider_client = _make_provider_client(self.provider_org)
        self.intake, self.placement = _make_intake_and_placement(self.gemeente_org, self.provider_client)

    @patch('contracts.notifications.send_mail')
    def test_creates_in_app_notification_for_provider_member(self, mock_mail):
        created = notify_provider_review_requested(
            intake=self.intake,
            placement=self.placement,
            organization=self.gemeente_org,
        )
        self.assertEqual(created, 1)
        notif = Notification.objects.filter(recipient=self.provider_user).first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.notification_type, Notification.NotificationType.APPROVAL)
        self.assertIn(str(self.intake.pk), notif.message)

    @patch('contracts.notifications.send_mail')
    def test_sends_email_to_primary_contact(self, mock_mail):
        notify_provider_review_requested(
            intake=self.intake,
            placement=self.placement,
            organization=self.gemeente_org,
        )
        mock_mail.assert_called_once()
        _subject, _msg, _from, recipients = (
            mock_mail.call_args[0] if mock_mail.call_args[0]
            else (
                mock_mail.call_args.kwargs.get('subject'),
                mock_mail.call_args.kwargs.get('message'),
                mock_mail.call_args.kwargs.get('from_email'),
                mock_mail.call_args.kwargs.get('recipient_list'),
            )
        )
        if isinstance(recipients, list):
            self.assertIn('provider@example.com', recipients)
        else:
            self.assertIn('provider@example.com', mock_mail.call_args.kwargs.get('recipient_list', []))

    def test_missing_email_logs_warning_and_does_not_raise(self):
        self.provider_client.primary_contact_email = ''
        self.provider_client.email = ''
        self.provider_client.save(update_fields=['primary_contact_email', 'email'])
        with self.assertLogs('contracts.notifications', level='WARNING') as cm:
            # Must not raise
            notify_provider_review_requested(
                intake=self.intake,
                placement=self.placement,
                organization=self.gemeente_org,
            )
        self.assertTrue(any('no contact email' in msg.lower() for msg in cm.output))

    @patch('contracts.notifications.send_mail', side_effect=Exception('SMTP timeout'))
    def test_email_failure_is_logged_and_does_not_raise(self, mock_mail):
        with self.assertLogs('contracts.notifications', level='ERROR') as cm:
            result = notify_provider_review_requested(
                intake=self.intake,
                placement=self.placement,
                organization=self.gemeente_org,
            )
        # Placement still reported as handled; email failure silently logged
        self.assertIsNotNone(result)
        self.assertTrue(any('failed to send email' in msg.lower() for msg in cm.output))

    @patch('contracts.notifications.send_mail')
    def test_idempotency_no_duplicate_notification(self, mock_mail):
        notify_provider_review_requested(
            intake=self.intake, placement=self.placement, organization=self.gemeente_org,
        )
        # Second call — should not create a second notification for the same intake
        created2 = notify_provider_review_requested(
            intake=self.intake, placement=self.placement, organization=self.gemeente_org,
        )
        self.assertEqual(created2, 0)
        self.assertEqual(
            Notification.objects.filter(recipient=self.provider_user).count(), 1
        )

    @patch('contracts.notifications.send_mail')
    def test_no_notification_when_provider_has_no_org(self, mock_mail):
        self.provider_client.organization = None
        self.provider_client.save(update_fields=['organization'])
        with self.assertLogs('contracts.notifications', level='INFO') as cm:
            created = notify_provider_review_requested(
                intake=self.intake, placement=self.placement, organization=self.gemeente_org,
            )
        self.assertEqual(created, 0)
        self.assertTrue(any('no active members' in msg.lower() for msg in cm.output))

    @patch('contracts.notifications.send_mail')
    def test_no_notification_when_placement_has_no_provider(self, mock_mail):
        self.placement.proposed_provider = None
        self.placement.save(update_fields=['proposed_provider'])
        with self.assertLogs('contracts.notifications', level='WARNING') as cm:
            created = notify_provider_review_requested(
                intake=self.intake, placement=self.placement, organization=self.gemeente_org,
            )
        self.assertEqual(created, 0)
        self.assertTrue(any('no provider client' in msg.lower() for msg in cm.output))


# ---------------------------------------------------------------------------
# Multi-tenant scoping
# ---------------------------------------------------------------------------

class ProviderNotificationTenantScopingTests(TestCase):

    @patch('contracts.notifications.send_mail')
    def test_org_a_send_does_not_notify_org_b_members(self, mock_mail):
        org_a, user_a = _make_org_and_user('pn-tenant-a')
        org_b, user_b = _make_org_and_user('pn-tenant-b')
        provider_org, provider_user = _make_org_and_user('pn-tenant-prov')
        provider_client = _make_provider_client(provider_org)
        intake, placement = _make_intake_and_placement(org_a, provider_client)

        notify_provider_review_requested(intake=intake, placement=placement, organization=org_a)

        # provider_user gets notified; user_a and user_b do not
        self.assertTrue(Notification.objects.filter(recipient=provider_user).exists())
        self.assertFalse(Notification.objects.filter(recipient=user_a).exists())
        self.assertFalse(Notification.objects.filter(recipient=user_b).exists())


# ---------------------------------------------------------------------------
# Notification count API
# ---------------------------------------------------------------------------

class NotificationCountApiTests(TestCase):

    def setUp(self):
        self.org, self.user = _make_org_and_user('nc-org')
        self.client.login(username=self.user.username, password='pass')

    @_WS
    def test_returns_zero_when_no_notifications(self):
        resp = self.client.get(reverse('carelane:notifications_api'))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['unreadCount'], 0)
        self.assertEqual(data['notifications'], [])

    @_WS
    def test_returns_correct_unread_count(self):
        Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.NotificationType.APPROVAL,
            title='Test',
            message='msg',
            is_read=False,
        )
        Notification.objects.create(
            recipient=self.user,
            notification_type=Notification.NotificationType.APPROVAL,
            title='Test2',
            message='msg2',
            is_read=True,
        )
        resp = self.client.get(reverse('carelane:notifications_api'))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['unreadCount'], 1)
        self.assertEqual(len(data['notifications']), 2)

    @_WS
    @patch('contracts.notifications.send_mail')
    def test_count_updates_after_provider_notification_created(self, mock_mail):
        provider_org, _ = _make_org_and_user('nc-prov-org')
        OrganizationMembership.objects.create(
            organization=provider_org, user=self.user,
            role=OrganizationMembership.Role.MEMBER, is_active=True,
        )
        provider_client = _make_provider_client(provider_org, email='prov@example.com')

        gemeente_org, _ = _make_org_and_user('nc-gemeente-org')
        intake, placement = _make_intake_and_placement(gemeente_org, provider_client)

        notify_provider_review_requested(
            intake=intake, placement=placement, organization=gemeente_org,
        )

        resp = self.client.get(reverse('carelane:notifications_api'))
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(resp.json()['unreadCount'], 1)

    @_WS
    def test_other_user_notifications_not_visible(self):
        other_org, other_user = _make_org_and_user('nc-other-org')
        Notification.objects.create(
            recipient=other_user,
            notification_type=Notification.NotificationType.APPROVAL,
            title='Other',
            message='msg',
            is_read=False,
        )
        resp = self.client.get(reverse('carelane:notifications_api'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['unreadCount'], 0)
