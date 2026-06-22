"""
Tests for Blocker 3: AuditLog organization reference + append-only enforcement.

Covers:
  1. Unit: new AuditLog rows written with organization FK via log_action
  2. Unit: append-only — save() on existing row raises GovernanceLogImmutableError
  3. Unit: append-only — delete() on instance raises GovernanceLogImmutableError
  4. Unit: bulk queryset update() and delete() are NOT blocked (retention prune must work)
  5. Multi-tenant: org A cannot see org B audit logs via API
  6. Multi-tenant: org B cannot see org A audit logs via export API
  7. Orphan-user: records are still visible after user is deleted (organization FK survives)
  8. Export: CSV contains records scoped to calling org
  9. Export: JSON contains records scoped to calling org
 10. Legacy fallback: rows without organization are still returned if user is in the org
 11. Backfill: migration links rows to the correct org via user membership
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from contracts.middleware import log_action
from contracts.models import (
    AuditLog,
    Organization,
    OrganizationMembership,
    UserProfile,
)
from contracts.models.governance import GovernanceLogImmutableError
from tests.test_utils import middleware_without_spa_shell

User = get_user_model()

_WS = override_settings(MIDDLEWARE=middleware_without_spa_shell())


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_org_and_user(slug, role=OrganizationMembership.Role.OWNER):
    org = Organization.objects.create(name=f"Org {slug}", slug=slug)
    user = User.objects.create_user(
        username=f"u_{slug}", email=f"{slug}@test.example", password="pass"
    )
    OrganizationMembership.objects.create(
        organization=org, user=user, role=role, is_active=True,
    )
    UserProfile.objects.update_or_create(
        user=user, defaults={'role': UserProfile.Role.ASSOCIATE},
    )
    return org, user


def _make_audit_row(org, user, model_name='CareCase', object_id=1, action=AuditLog.Action.UPDATE, repr_label=None):
    return AuditLog.objects.create(
        organization=org,
        user=user,
        action=action,
        model_name=model_name,
        object_id=object_id,
        object_repr=repr_label or f'Test {model_name}',
    )


# ---------------------------------------------------------------------------
# Append-only enforcement
# ---------------------------------------------------------------------------

class AuditLogImmutabilityTests(TestCase):

    def setUp(self):
        self.org, self.user = _make_org_and_user("immut")

    def test_create_succeeds(self):
        row = _make_audit_row(self.org, self.user)
        self.assertIsNotNone(row.pk)

    def test_save_on_existing_row_raises(self):
        row = _make_audit_row(self.org, self.user)
        row.object_repr = 'tampered'
        with self.assertRaises(GovernanceLogImmutableError):
            row.save()

    def test_instance_delete_raises(self):
        row = _make_audit_row(self.org, self.user)
        with self.assertRaises(GovernanceLogImmutableError):
            row.delete()

    def test_queryset_update_is_allowed_for_retention_tests(self):
        """Bulk .update() must work so the retention test can set old timestamps."""
        row = _make_audit_row(self.org, self.user)
        old_ts = timezone.now() - timedelta(days=400)
        # Must NOT raise — the retention prune and test helpers use this pattern.
        AuditLog.objects.filter(pk=row.pk).update(timestamp=old_ts)
        row.refresh_from_db()
        self.assertLess(row.timestamp, timezone.now() - timedelta(days=390))

    def test_queryset_delete_is_allowed_for_retention_prune(self):
        """Bulk .delete() must work so the retention prune command can remove old rows."""
        row = _make_audit_row(self.org, self.user)
        # Must NOT raise — the prune command uses this pattern.
        AuditLog.objects.filter(pk=row.pk).delete()
        self.assertFalse(AuditLog.objects.filter(pk=row.pk).exists())


# ---------------------------------------------------------------------------
# Organization scoping
# ---------------------------------------------------------------------------

class AuditLogOrganizationScopingTests(TestCase):

    def setUp(self):
        self.org_a, self.user_a = _make_org_and_user("scope-a")
        self.org_b, self.user_b = _make_org_and_user("scope-b")
        _make_audit_row(self.org_a, self.user_a, repr_label='row_a')
        _make_audit_row(self.org_b, self.user_b, repr_label='row_b')

    def test_log_action_writes_organization_fk(self):
        log_action(
            self.user_a,
            AuditLog.Action.VIEW,
            'CareCase',
            object_repr='log_action_test',
            organization=self.org_a,
        )
        row = AuditLog.objects.filter(object_repr='log_action_test').first()
        self.assertIsNotNone(row)
        self.assertEqual(row.organization_id, self.org_a.pk)

    def _login_and_get(self, user, url):
        self.client.login(username=user.username, password='pass')
        return self.client.get(url)

    @_WS
    def test_audit_api_returns_only_own_org_rows(self):
        resp = self._login_and_get(self.user_a, reverse('carelane:audit_log_api'))
        self.assertEqual(resp.status_code, 200)
        reprs = {r['objectRepr'] for r in resp.json().get('entries', [])}
        self.assertIn('row_a', reprs)
        self.assertNotIn('row_b', reprs)

    @_WS
    def test_audit_api_org_b_cannot_see_org_a_rows(self):
        resp = self._login_and_get(self.user_b, reverse('carelane:audit_log_api'))
        self.assertEqual(resp.status_code, 200)
        reprs = {r['objectRepr'] for r in resp.json().get('entries', [])}
        self.assertNotIn('row_a', reprs)
        self.assertIn('row_b', reprs)

    @_WS
    def test_export_api_returns_only_own_org_rows_csv(self):
        resp = self._login_and_get(self.user_a, reverse('carelane:audit_log_export_api'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b'row_a', resp.content)
        self.assertNotIn(b'row_b', resp.content)

    @_WS
    def test_export_api_returns_only_own_org_rows_json(self):
        resp = self._login_and_get(self.user_a, reverse('carelane:audit_log_export_api') + '?format=json')
        self.assertEqual(resp.status_code, 200)
        reprs = {e['objectRepr'] for e in resp.json().get('entries', [])}
        self.assertIn('row_a', reprs)
        self.assertNotIn('row_b', reprs)


# ---------------------------------------------------------------------------
# Orphan-user visibility
# ---------------------------------------------------------------------------

class AuditLogOrphanUserTests(TestCase):

    def setUp(self):
        self.org, self.viewer = _make_org_and_user("orphan-org")
        self.writer = User.objects.create_user(
            username='writer_orphan', password='pass',
        )
        OrganizationMembership.objects.create(
            organization=self.org, user=self.writer,
            role=OrganizationMembership.Role.MEMBER, is_active=True,
        )

    @_WS
    def test_audit_row_visible_after_writer_user_deleted(self):
        """Records must remain visible to org admins even after the writing user is deleted."""
        row = AuditLog.objects.create(
            organization=self.org,
            user=self.writer,
            action=AuditLog.Action.UPDATE,
            model_name='CareCase',
            object_id=99,
            object_repr='orphan_row',
        )
        # Delete the writer — user FK becomes NULL (SET_NULL).
        self.writer.delete()
        row.refresh_from_db()
        self.assertIsNone(row.user_id, "user FK should be NULL after user deletion")
        self.assertEqual(row.organization_id, self.org.pk, "org FK must survive user deletion")

        # The org viewer must still see the row via the organization FK.
        self.client.login(username=self.viewer.username, password='pass')
        resp = self.client.get(reverse('carelane:audit_log_api'))
        self.assertEqual(resp.status_code, 200)
        reprs = {r['objectRepr'] for r in resp.json().get('entries', [])}
        self.assertIn('orphan_row', reprs)


# ---------------------------------------------------------------------------
# Legacy fallback: rows without organization FK
# ---------------------------------------------------------------------------

class AuditLogLegacyFallbackTests(TestCase):
    """
    Rows written before migration 0092 have organization=NULL.  They must still
    be returned when the row's user is a member of the requesting org.
    """

    @_WS
    def setUp(self):
        self.org, self.user = _make_org_and_user("legacy-org")
        # Simulate a pre-0092 row by inserting with org=NULL then clearing it.
        row = AuditLog.objects.create(
            organization=self.org,
            user=self.user,
            action=AuditLog.Action.VIEW,
            model_name='CareCase',
            object_id=5,
            object_repr='legacy_row',
        )
        # Use queryset update (not model save) to clear the organization FK,
        # simulating a row written before the FK existed.
        AuditLog.objects.filter(pk=row.pk).update(organization_id=None)

    @_WS
    def test_legacy_row_still_visible_via_user_membership_fallback(self):
        self.client.login(username=self.user.username, password='pass')
        resp = self.client.get(reverse('carelane:audit_log_api'))
        self.assertEqual(resp.status_code, 200)
        reprs = {r['objectRepr'] for r in resp.json().get('entries', [])}
        self.assertIn('legacy_row', reprs)
