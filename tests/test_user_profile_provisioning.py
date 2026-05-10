"""UserProfile auto-provisioning for every User (signals + helpers)."""

from django.contrib.auth import get_user_model
from django.test import TestCase

from contracts.models import UserProfile
from contracts.user_profile_provisioning import ensure_user_profile_exists

User = get_user_model()


class UserProfileProvisioningTests(TestCase):
    def test_new_user_gets_profile_via_signal(self):
        u = User.objects.create_user(username='provision_signal_u1', password='x')
        self.assertTrue(UserProfile.objects.filter(user=u).exists())
        self.assertEqual(u.profile.role, UserProfile.Role.ASSOCIATE)

    def test_superuser_gets_admin_profile_on_create(self):
        u = User.objects.create_superuser(username='provision_admin_u1', email='a@example.com', password='x')
        self.assertEqual(u.profile.role, UserProfile.Role.ADMIN)

    def test_ensure_user_profile_exists_idempotent(self):
        u = User.objects.create_user(username='provision_idem_u1', password='x')
        UserProfile.objects.filter(user=u).delete()
        p1, c1 = ensure_user_profile_exists(u)
        p2, c2 = ensure_user_profile_exists(u)
        self.assertTrue(c1)
        self.assertFalse(c2)
        self.assertEqual(p1.pk, p2.pk)
