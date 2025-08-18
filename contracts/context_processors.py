
"""
Context processors for adding global template variables
"""
from config.feature_flags import ironclad_mode

def feature_flags(request):
    """Add feature flags to template context"""
    return {
        'ironclad_mode': ironclad_mode(),
    }
