
"""
Tests for Ironclad-mode features
"""
import json
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse
from contracts.models import Contract
from contracts.services.repository import get_repository_service
from contracts.domain.contracts import ListParams, ContractStatus

class IroncladFeaturesTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.login(username='testuser', password='testpass123')
        
        # Create test contracts
        self.contract1 = Contract.objects.create(
            title='Test Contract 1',
            counterparty='Acme Corp',
            status='DRAFT',
            created_by=self.user
        )
        self.contract2 = Contract.objects.create(
            title='Test Contract 2', 
            counterparty='Beta Inc',
            status='ACTIVE',
            created_by=self.user
        )
    
    def test_contracts_api_endpoint(self):
        """Test the contracts API endpoint returns proper data"""
        response = self.client.get('/contracts/api/contracts/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']['rows']), 2)
        self.assertEqual(data['data']['total'], 2)
    
    def test_contracts_api_with_filters(self):
        """Test filtering functionality"""
        response = self.client.get('/contracts/api/contracts/?status=DRAFT')
        data = json.loads(response.content)
        
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']['rows']), 1)
        self.assertEqual(data['data']['rows'][0]['title'], 'Test Contract 1')
    
    def test_contracts_api_search(self):
        """Test search functionality"""
        response = self.client.get('/contracts/api/contracts/?q=Acme')
        data = json.loads(response.content)
        
        self.assertTrue(data['success'])
        self.assertEqual(len(data['data']['rows']), 1)
        self.assertEqual(data['data']['rows'][0]['counterparty'], 'Acme Corp')
    
    def test_bulk_update_endpoint(self):
        """Test bulk update functionality"""
        response = self.client.post(
            '/contracts/api/contracts/bulk-update/',
            data=json.dumps({
                'ids': [str(self.contract1.id), str(self.contract2.id)],
                'patch': {'status': 'ACTIVE'}
            }),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        
        # Verify contracts were updated
        self.contract1.refresh_from_db()
        self.contract2.refresh_from_db()
        self.assertEqual(self.contract1.status, 'ACTIVE')
        self.assertEqual(self.contract2.status, 'ACTIVE')
    
    def test_contract_detail_api(self):
        """Test contract detail API"""
        response = self.client.get(f'/contracts/api/contracts/{self.contract1.id}/')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.content)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['title'], 'Test Contract 1')
    
    def test_repository_service(self):
        """Test the repository service implementation"""
        service = get_repository_service(self.user)
        
        # Test list
        params = ListParams(page=1, page_size=10)
        result = service.list(params)
        
        self.assertEqual(result.total, 2)
        self.assertEqual(len(result.rows), 2)
        
        # Test filtering
        params = ListParams(status=[ContractStatus.DRAFT])
        result = service.list(params)
        
        self.assertEqual(result.total, 1)
        self.assertEqual(result.rows[0].title, 'Test Contract 1')
    
    def test_repository_page_with_ironclad_mode(self):
        """Test repository page renders correctly with Ironclad mode"""
        with self.settings(IRONCLAD_MODE=True):
            response = self.client.get('/contracts/repository/')
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'filter-chips')
            self.assertContains(response, 'bulk-action-bar')
            self.assertContains(response, 'details-drawer')
    
    def test_repository_page_without_ironclad_mode(self):
        """Test repository page renders correctly without Ironclad mode"""
        with self.settings(IRONCLAD_MODE=False):
            response = self.client.get('/contracts/repository/')
            self.assertEqual(response.status_code, 200)
            self.assertNotContains(response, 'filter-chips')
            self.assertNotContains(response, 'bulk-action-bar')

class RepositoryServiceTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        self.contract = Contract.objects.create(
            title='Test Contract',
            counterparty='Test Corp',
            status='DRAFT',
            created_by=self.user
        )
    
    def test_django_repository_service(self):
        """Test Django repository service implementation"""
        service = get_repository_service(self.user, use_mock=False)
        
        # Test get
        contract_data = service.get(str(self.contract.id))
        self.assertEqual(contract_data.title, 'Test Contract')
        self.assertEqual(contract_data.status, ContractStatus.DRAFT)
        
        # Test update
        updated = service.update(str(self.contract.id), {'status': 'ACTIVE'})
        self.assertEqual(updated.status, ContractStatus.ACTIVE)
        
        # Verify in database
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'ACTIVE')
    
    def test_mock_repository_service(self):
        """Test mock repository service implementation"""
        service = get_repository_service(self.user, use_mock=True)
        
        # Test list
        params = ListParams()
        result = service.list(params)
        
        self.assertGreater(len(result.rows), 0)
        self.assertEqual(result.page, 1)
        
        # Test create
        contract_data = service.create({'title': 'New Contract'})
        self.assertEqual(contract_data.title, 'New Contract')
        self.assertEqual(contract_data.status, ContractStatus.DRAFT)
