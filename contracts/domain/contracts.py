
"""
Domain classes for the case workspace.
These classes define case data structures independent of Django models.
"""
from dataclasses import dataclass, asdict
from typing import List, Optional
from enum import Enum

class CareCaseStatus(Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    TERMINATED = "TERMINATED"

@dataclass
class ListParams:
    """Parameters for case listing."""
    q: str = ""
    status: List[str] = None
    contract_type: List[str] = None
    sort: str = "updated_desc"
    page: int = 1
    page_size: int = 25

    def __post_init__(self):
        if self.status is None:
            self.status = []
        if self.contract_type is None:
            self.contract_type = []

@dataclass
class CareCaseData:
    """Case data transfer object."""
    id: str
    title: str
    status: str
    preferred_provider: str = ""
    value: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    owner: str = ""
    updated_at: Optional[str] = None
    created_at: Optional[str] = None
    content: str = ""

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return asdict(self)

@dataclass
class ListResult:
    """Result of case listing operation."""
    careon: List[CareCaseData]
    total_count: int
    page: int
    page_size: int
    total_pages: int

    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'contracts': [c.to_dict() for c in self.contracts],
            'total_count': self.total_count,
            'page': self.page,
            'page_size': self.page_size,
            'total_pages': self.total_pages
        }


ContractStatus = CareCaseStatus
ContractData = CareCaseData
