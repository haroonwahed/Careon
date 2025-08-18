
"""
Domain types and interfaces for contract management
"""
from typing import Protocol, List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

class ContractStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE" 
    INACTIVE = "INACTIVE"
    UNVERIFIED = "UNVERIFIED"

@dataclass
class ContractData:
    id: str
    title: str
    counterparty: Optional[str] = None
    status: ContractStatus = ContractStatus.DRAFT
    hint: Optional[str] = None
    updated_at: str = ""
    contract_type: Optional[str] = None
    value: Optional[float] = None

@dataclass
class ListParams:
    q: Optional[str] = None
    status: Optional[List[ContractStatus]] = None
    contract_type: Optional[List[str]] = None
    people: Optional[List[str]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    sort: Optional[str] = None
    page: int = 1
    page_size: int = 25

@dataclass
class ListResult:
    rows: List[ContractData]
    total: int
    page: int
    page_size: int

class RepositoryService(Protocol):
    """Interface for contract repository operations"""
    
    def list(self, params: ListParams) -> ListResult:
        """List contracts with filtering and pagination"""
        ...
    
    def get(self, contract_id: str) -> ContractData:
        """Get a single contract by ID"""
        ...
    
    def update(self, contract_id: str, patch: Dict[str, Any]) -> ContractData:
        """Update a contract"""
        ...
    
    def bulk_update(self, ids: List[str], patch: Dict[str, Any]) -> None:
        """Bulk update multiple contracts"""
        ...
    
    def create(self, payload: Dict[str, Any]) -> ContractData:
        """Create a new contract"""
        ...
