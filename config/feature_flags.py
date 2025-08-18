
"""
Feature flags for enabling/disabling functionality
"""
import os
from django.conf import settings

class FeatureFlags:
    """Feature flag management"""
    
    @staticmethod
    def is_enabled(flag_name: str) -> bool:
        """Check if a feature flag is enabled"""
        return getattr(settings, flag_name, False) or os.getenv(flag_name, '').lower() == 'true'
    
    @staticmethod
    def ironclad_mode() -> bool:
        """Check if Ironclad mode is enabled"""
        return FeatureFlags.is_enabled('IRONCLAD_MODE')

# Convenience function
def ironclad_mode():
    return FeatureFlags.ironclad_mode()
