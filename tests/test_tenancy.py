from django.contrib.auth import get_user_model
from django.test import TestCase

from contracts.models import Organization, OrganizationMembership
from contracts.tenancy import ensure_user_organization, get_user_organization


User = get_user_model()


class TenancyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='tenancy_user',
            email='tenancy_user@example.com',
            password='testpass123',
        )

    def test_ensure_user_organization_reuses_existing_canonical_org(self):
        organization = Organization.objects.create(
            name=f"{self.user.username}'s Regie",
            slug='tenancy-user-regie',
        )

        resolved = ensure_user_organization(self.user)

        self.assertEqual(resolved, organization)
        self.assertTrue(
            OrganizationMembership.objects.filter(
                organization=organization,
                user=self.user,
                role=OrganizationMembership.Role.OWNER,
                is_active=True,
            ).exists()
        )

    def test_get_user_organization_returns_existing_membership(self):
        organization = Organization.objects.create(
            name="Existing Org",
            slug='existing-org',
        )
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.user,
            role=OrganizationMembership.Role.ADMIN,
            is_active=True,
        )

        resolved = get_user_organization(self.user)

        self.assertEqual(resolved, organization)
