def feature_flags(request):
    """Add feature flags to template context"""
    from config.feature_flags import is_feature_redesign_enabled
    return {
        'FEATURE_REDESIGN': is_feature_redesign_enabled()
    }