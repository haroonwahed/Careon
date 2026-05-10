"""
Ensure every interactive User has a UserProfile row.

Reverse OneToOne access (`user.profile`) raises without a row; provisioning avoids 500s on
`/care/api/me/` and related endpoints for SSO/local users created outside seeded flows.
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from contracts.models import UserProfile

User = get_user_model()


def ensure_user_profile_exists(user: User) -> tuple[UserProfile, bool]:
    """
    Create UserProfile if missing.

    Default role: ASSOCIATE. Superusers get ADMIN on first create only (existing profiles unchanged).
    """
    role = UserProfile.Role.ADMIN if getattr(user, 'is_superuser', False) else UserProfile.Role.ASSOCIATE
    return UserProfile.objects.get_or_create(user=user, defaults={'role': role})


@receiver(post_save, sender=User, dispatch_uid='contracts.ensure_user_profile_after_save')
def _ensure_user_profile_after_save(sender, instance, raw, **kwargs):
    """Attach profile after every User save (fixtures use raw=True — skip)."""
    if raw:
        return
    ensure_user_profile_exists(instance)
