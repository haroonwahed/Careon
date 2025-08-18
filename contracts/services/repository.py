
"""
Repository service implementation for contracts
"""
import time
from typing import List, Dict, Any
from django.contrib.auth.models import User
from django.db.models import Q
from contracts.models import Contract
from contracts.domain.contracts import (
    RepositoryService, ContractData, ContractStatus, ListParams, ListResult
)

class DjangoRepositoryService:
    """Django ORM implementation of RepositoryService"""
    
    def __init__(self, user: User):
        self.user = user
    
    def _contract_to_data(self, contract: Contract) -> ContractData:
        """Convert Django model to domain object"""
        return ContractData(
            id=str(contract.id),
            title=contract.title,
            counterparty=contract.counterparty,
            status=ContractStatus(contract.status),
            hint=f"Created {contract.created_at.strftime('%b %d, %Y')}",
            updated_at=contract.updated_at.isoformat(),
            contract_type=contract.contract_type,
            value=float(contract.value) if contract.value else None
        )
    
    def list(self, params: ListParams) -> ListResult:
        """List contracts with filtering and pagination"""
        queryset = Contract.objects.filter(created_by=self.user)
        
        # Apply filters
        if params.q:
            queryset = queryset.filter(
                Q(title__icontains=params.q) | 
                Q(counterparty__icontains=params.q)
            )
        
        if params.status:
            status_values = [s.value for s in params.status]
            queryset = queryset.filter(status__in=status_values)
        
        if params.contract_type:
            queryset = queryset.filter(contract_type__in=params.contract_type)
        
        # Apply sorting
        sort_field = '-updated_at'  # default
        if params.sort:
            sort_map = {
                'title': 'title',
                'status': 'status',
                'updated_desc': '-updated_at',
                'updated_asc': 'updated_at'
            }
            sort_field = sort_map.get(params.sort, sort_field)
        
        queryset = queryset.order_by(sort_field)
        
        # Pagination
        total = queryset.count()
        start = (params.page - 1) * params.page_size
        end = start + params.page_size
        contracts = list(queryset[start:end])
        
        return ListResult(
            rows=[self._contract_to_data(c) for c in contracts],
            total=total,
            page=params.page,
            page_size=params.page_size
        )
    
    def get(self, contract_id: str) -> ContractData:
        """Get a single contract by ID"""
        contract = Contract.objects.get(id=contract_id, created_by=self.user)
        return self._contract_to_data(contract)
    
    def update(self, contract_id: str, patch: Dict[str, Any]) -> ContractData:
        """Update a contract"""
        contract = Contract.objects.get(id=contract_id, created_by=self.user)
        
        for field, value in patch.items():
            if hasattr(contract, field):
                setattr(contract, field, value)
        
        contract.save()
        return self._contract_to_data(contract)
    
    def bulk_update(self, ids: List[str], patch: Dict[str, Any]) -> None:
        """Bulk update multiple contracts"""
        Contract.objects.filter(
            id__in=ids, 
            created_by=self.user
        ).update(**patch)
    
    def create(self, payload: Dict[str, Any]) -> ContractData:
        """Create a new contract"""
        contract = Contract.objects.create(
            created_by=self.user,
            **payload
        )
        return self._contract_to_data(contract)

class MockRepositoryService:
    """Mock implementation for testing"""
    
    def __init__(self, user=None):
        self.user = user
        # Simulate latency
        self._latency = 0.1
    
    def _simulate_latency(self):
        time.sleep(self._latency)
    
    def list(self, params: ListParams) -> ListResult:
        self._simulate_latency()
        # Mock data
        mock_contracts = [
            ContractData(
                id="1",
                title="Sample Contract 1",
                counterparty="Acme Corp",
                status=ContractStatus.ACTIVE,
                hint="Created Dec 15, 2023"
            ),
            ContractData(
                id="2", 
                title="Sample Contract 2",
                counterparty="Beta Inc",
                status=ContractStatus.DRAFT,
                hint="Created Dec 10, 2023"
            )
        ]
        
        return ListResult(
            rows=mock_contracts,
            total=len(mock_contracts),
            page=params.page,
            page_size=params.page_size
        )
    
    def get(self, contract_id: str) -> ContractData:
        self._simulate_latency()
        return ContractData(
            id=contract_id,
            title=f"Contract {contract_id}",
            status=ContractStatus.ACTIVE
        )
    
    def update(self, contract_id: str, patch: Dict[str, Any]) -> ContractData:
        self._simulate_latency()
        return ContractData(
            id=contract_id,
            title=f"Updated Contract {contract_id}",
            status=ContractStatus.ACTIVE
        )
    
    def bulk_update(self, ids: List[str], patch: Dict[str, Any]) -> None:
        self._simulate_latency()
        pass
    
    def create(self, payload: Dict[str, Any]) -> ContractData:
        self._simulate_latency()
        return ContractData(
            id="new-id",
            title=payload.get("title", "New Contract"),
            status=ContractStatus.DRAFT
        )

def get_repository_service(user=None, use_mock=False) -> RepositoryService:
    """Factory function to get repository service"""
    if use_mock:
        return MockRepositoryService(user)
    else:
        return DjangoRepositoryService(user)
