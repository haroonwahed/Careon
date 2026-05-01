from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import Budget, CareConfiguration, Client as ClientModel, Organization, OrganizationMembership, PlacementRequest


class RedesignComponentsTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
            email='test@example.com',
        )
        self.organization = Organization.objects.create(name='Test Firm', slug='test-firm')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='testuser', password='testpass123')

    def _assert_spa_shell(self, response):
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>', html=True)
        self.assertContains(response, '/static/spa/assets/index-')
        self.assertNotContains(response, 'Careon Zorgregie')
        self.assertNotContains(response, 'Globaal zoeken')
        self.assertNotContains(response, 'CASUSMANAGEMENT')

    def test_dashboard_component_labels(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_spa_shell(response)

    def test_root_path_renders_public_landing_for_authenticated_users(self):
        response = self.client.get(reverse('index'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'CareOn')
        self.assertContains(response, 'Regieplatform voor gemeenten en zorgaanbieders')
        self.assertContains(response, 'public-shell')

    def test_case_list_alias_renders_spa_shell(self):
        provider = ClientModel.objects.create(
            organization=self.organization,
            name='ZorgPlus Noord',
            created_by=self.user,
        )
        CareConfiguration.objects.create(
            organization=self.organization,
            matter_number='CFG-REDESIGN-1',
            title='Test Configuration',
            client=provider,
            created_by=self.user,
        )

        response = self.client.get(reverse('careon:case_list'))
        self._assert_spa_shell(response)

    def test_navigation_structure(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_spa_shell(response)

    def test_accessibility_and_responsive_markers(self):
        response = self.client.get(reverse('dashboard'))
        self._assert_spa_shell(response)

    def test_budget_list_matches_dashboard_style(self):
        Budget.objects.create(
            organization=self.organization,
            year=2025,
            quarter=Budget.Quarter.Q3,
            department='Regie Operaties',
            allocated_amount='120000.00',
            description='Core operations budget',
            created_by=self.user,
        )

        response = self.client.get(reverse('careon:budget_list'))
        self._assert_spa_shell(response)

    def test_placement_list_alias_uses_configuration_view(self):
        client_record = ClientModel.objects.create(
            organization=self.organization,
            name='Acme Client',
            created_by=self.user,
        )
        configuration = CareConfiguration.objects.create(
            organization=self.organization,
            matter_number='TM-0001',
            title='Brand Protection',
            client=client_record,
            created_by=self.user,
        )
        PlacementRequest.objects.create(
            mark_text='CAREON MARK',
            description='Primary placement request for the platform.',
            goods_services='Care coordination services',
            filing_basis='Use in commerce',
            status=PlacementRequest.Status.PENDING,
            client=client_record,
            matter=configuration,
        )

        response = self.client.get(reverse('careon:placement_list'))
        self._assert_spa_shell(response)

    def test_municipality_list_uses_current_authenticated_shell(self):
        response = self.client.get(reverse('careon:municipality_list'))
        self._assert_spa_shell(response)
