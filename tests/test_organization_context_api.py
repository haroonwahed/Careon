"""Slice 2: organization session API + /care/api/me/ + Regiekamer tenant resolution."""

import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import Organization, OrganizationMembership

User = get_user_model()


class OrganizationContextApiTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org_demo = Organization.objects.create(name='Gemeente Demo', slug='gemeente-demo')
        self.org_other = Organization.objects.create(name='Other Org', slug='other-org')

        self.demo_member = User.objects.create_user(username='ctx_demo_member', password='passCtx123!')
        OrganizationMembership.objects.create(
            organization=self.org_demo,
            user=self.demo_member,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )

        self.other_member = User.objects.create_user(username='ctx_other_member', password='passCtx123!')
        OrganizationMembership.objects.create(
            organization=self.org_other,
            user=self.other_member,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )

    def test_me_returns_resolved_organization_payload(self):
        self.client.login(username='ctx_demo_member', password='passCtx123!')
        response = self.client.get(reverse('careon:current_user_api'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIsNotNone(payload.get('organization'))
        self.assertEqual(payload['organization']['slug'], 'gemeente-demo')

    def test_session_active_organization_sets_session_json_slug(self):
        self.client.login(username='ctx_demo_member', password='passCtx123!')
        response = self.client.post(
            reverse('careon:session_active_organization_api'),
            data=json.dumps({'organization_slug': 'gemeente-demo'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body.get('ok'))
        self.assertEqual(body['organization']['slug'], 'gemeente-demo')

    def test_session_active_organization_denied_without_membership(self):
        self.client.login(username='ctx_other_member', password='passCtx123!')
        response = self.client.post(
            reverse('careon:session_active_organization_api'),
            data=json.dumps({'organization_slug': 'gemeente-demo'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())

    def test_regiekamer_returns_200_when_membership_exists_without_prior_session_post(self):
        self.client.login(username='ctx_demo_member', password='passCtx123!')
        response = self.client.get(reverse('careon:regiekamer_decision_overview_api'))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn('items', payload)
        self.assertIn('totals', payload)
