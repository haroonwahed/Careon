"""Invite-only onboarding — no anonymous tenant minting."""
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from contracts.models import Organization, OrganizationInvitation, OrganizationMembership
from contracts.tenancy import ensure_user_organization

User = get_user_model()


@override_settings(CARELANE_INVITE_ONLY_ONBOARDING=True)
class InviteOnlyOnboardingTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Invite Org', slug='invite-org')
        self.invitation = OrganizationInvitation.objects.create(
            organization=self.org,
            email='newmember@example.com',
            role=OrganizationMembership.Role.MEMBER,
        )

    def test_signup_without_invite_token_redirects_to_login(self):
        response = self.client.get(reverse('register'))
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login/', response['Location'])

    def test_ensure_user_organization_does_not_auto_create_tenant(self):
        user = User.objects.create_user(username='solo', email='solo@example.com', password='passS1234!')
        organization = ensure_user_organization(user)
        self.assertIsNone(organization)
        self.assertFalse(Organization.objects.filter(slug__startswith='solo').exists())

    def test_signup_with_valid_invite_joins_organization(self):
        url = reverse('register') + f'?invite={self.invitation.token}&email=newmember@example.com'
        response = self.client.post(
            url,
            data={
                'username': 'newmember',
                'email': 'newmember@example.com',
                'password1': 'ComplexPass123!',
                'password2': 'ComplexPass123!',
            },
        )
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username='newmember')
        membership = OrganizationMembership.objects.get(user=user, organization=self.org)
        self.assertEqual(membership.role, OrganizationMembership.Role.MEMBER)
        self.invitation.refresh_from_db()
        self.assertEqual(self.invitation.status, OrganizationInvitation.Status.ACCEPTED)
