
from config.feature_flags import get_feature_flag

def feature_flags(request):
    """Add feature flags to template context"""
    return {
        'FEATURE_REDESIGN': get_feature_flag('FEATURE_REDESIGN', False),
    }
