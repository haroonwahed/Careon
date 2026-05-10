from django.apps import AppConfig


class ContractsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'contracts'

    def ready(self):
        # Register signals (User → UserProfile provisioning).
        import contracts.user_profile_provisioning  # noqa: F401
