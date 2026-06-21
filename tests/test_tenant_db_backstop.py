"""DB-level tenant backstop — manager default-scope during request context."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from contracts.models import (
    CareCase,
    Organization,
    OrganizationMembership,
)
from contracts.tenant_context import clear, tenant_scope

User = get_user_model()


class TenantDbBackstopTests(TestCase):
    def setUp(self):
        self.org_a = Organization.objects.create(name='Backstop Alpha', slug='backstop-alpha')
        self.org_b = Organization.objects.create(name='Backstop Beta', slug='backstop-beta')
        self.user_a = User.objects.create_user(username='backstop_a', password='passA1234!')
        OrganizationMembership.objects.create(
            organization=self.org_a,
            user=self.user_a,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.case_a = CareCase.objects.create(
            organization=self.org_a,
            title='Scoped Alpha Case',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user_a,
        )
        self.case_b = CareCase.objects.create(
            organization=self.org_b,
            title='Scoped Beta Case',
            contract_type='NDA',
            status='ACTIVE',
        )

    def test_unscoped_reads_see_all_tenants(self):
        titles = set(CareCase.objects.unscoped().values_list('title', flat=True))
        self.assertIn('Scoped Alpha Case', titles)
        self.assertIn('Scoped Beta Case', titles)

    def test_tenant_context_hides_other_org_rows(self):
        with tenant_scope(self.org_a.pk):
            visible = list(CareCase.objects.values_list('title', flat=True))
        self.assertEqual(visible, ['Scoped Alpha Case'])

    def test_cross_tenant_get_raises_without_view_helper(self):
        with tenant_scope(self.org_a.pk):
            with self.assertRaises(CareCase.DoesNotExist):
                CareCase.objects.get(pk=self.case_b.pk)

    def test_clear_context_restores_unscoped_visibility(self):
        with tenant_scope(self.org_a.pk):
            self.assertEqual(CareCase.objects.count(), 1)
        clear()
        self.assertEqual(CareCase.objects.unscoped().count(), 2)

    def test_middleware_sets_context_on_authenticated_request(self):
        self.client.login(username='backstop_a', password='passA1234!')
        response = self.client.get(reverse('carelane:current_user_api'))
        self.assertEqual(response.status_code, 200)
        # Context must be cleared after the request completes.
        self.assertEqual(CareCase.objects.unscoped().count(), 2)
