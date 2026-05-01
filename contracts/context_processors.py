
from django.conf import settings

from config.feature_flags import (
    is_test_mode_enabled
)
from .models import OrganizationMembership

def feature_flags(request):
    """Add feature flags to template context"""
    return {
        'TEST_MODE': is_test_mode_enabled(),
        'SSO_ENABLED': getattr(settings, 'SSO_ENABLED', False),
        'CURRENT_ORGANIZATION': getattr(request, 'organization', None),
        'USER_ORGANIZATION_MEMBERSHIPS': (
            OrganizationMembership.objects.filter(user=request.user, is_active=True).select_related('organization')
            if getattr(request, 'user', None) and request.user.is_authenticated
            else OrganizationMembership.objects.none()
        ),
    }
