"""Self-service onboarding gates — invite-only tenant provisioning."""
from __future__ import annotations

import uuid
from typing import Optional

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

from contracts.models import OrganizationInvitation, OrganizationMembership

User = get_user_model()


def invite_only_onboarding_enabled() -> bool:
    return bool(getattr(settings, 'CARELANE_INVITE_ONLY_ONBOARDING', False))


def _normalize_email(email: str) -> str:
    return (email or '').strip().lower()


def find_pending_invitation(*, email: str, token: Optional[str] = None) -> Optional[OrganizationInvitation]:
    qs = OrganizationInvitation.objects.filter(
        email__iexact=_normalize_email(email),
        status=OrganizationInvitation.Status.PENDING,
    ).select_related('organization')
    if token:
        try:
            token_uuid = uuid.UUID(str(token))
        except (TypeError, ValueError):
            return None
        qs = qs.filter(token=token_uuid)
    invitation = qs.order_by('-created_at').first()
    if invitation is None:
        return None
    if invitation.expires_at and invitation.expires_at < timezone.now():
        invitation.status = OrganizationInvitation.Status.EXPIRED
        invitation.save(update_fields=['status'])
        return None
    return invitation


def accept_invitation_for_user(invitation: OrganizationInvitation, user: User) -> OrganizationMembership:
    membership, _ = OrganizationMembership.objects.get_or_create(
        organization=invitation.organization,
        user=user,
        defaults={
            'role': invitation.role,
            'is_active': True,
        },
    )
    updates = []
    if membership.role != invitation.role:
        membership.role = invitation.role
        updates.append('role')
    if not membership.is_active:
        membership.is_active = True
        updates.append('is_active')
    if updates:
        membership.save(update_fields=updates)
    invitation.status = OrganizationInvitation.Status.ACCEPTED
    invitation.invited_user = user
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=['status', 'invited_user', 'accepted_at'])
    return membership


def user_has_active_membership(user: Optional[User]) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    return OrganizationMembership.objects.filter(
        user=user,
        is_active=True,
        organization__is_active=True,
    ).exists()
