
"""
Services package for contract operations
"""
"""
Service factory for switching between mock and real services based on feature flags
"""
from config.feature_flags import is_test_mode
from .repository import DjangoRepositoryService, MockRepositoryService
from .templates import template_service
from .clauses import clause_service
from .obligations import obligation_service

def get_repository_service(user=None):
    """Get repository service - uses DjangoRepositoryService (real implementation).
    
    Note: The ideal pattern is to import get_repository_service directly from 
    contracts.services.repository and pass user + use_mock parameters.
    This wrapper is maintained for backwards compatibility.
    
    Args:
        user: Django user object (optional, for backwards compat)
    
    Returns:
        DjangoRepositoryService instance when real service is available
        MockRepositoryService in test mode (if user is None)
    """
    if user is None:
        # Fallback to mock for backwards compatibility when user not provided
        return MockRepositoryService()
    else:
        # Use real Django-backed service
        return DjangoRepositoryService(user)

def get_template_service():
    """Get template service"""
    return template_service

def get_clause_service():
    """Get clause service"""
    return clause_service

def get_obligation_service():
    """Get obligation service"""
    return obligation_service

# Export services for easy import
__all__ = [
    'get_repository_service',
    'get_template_service', 
    'get_clause_service',
    'get_obligation_service'
]
