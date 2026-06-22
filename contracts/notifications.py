"""
Provider notification utility — Blocker 4.

send_to_provider triggers:
  1. An in-app Notification row for every active member of the provider's org.
  2. An email to the provider's contact address (best-effort; logged on failure).

Design constraints:
  - No retry queue; pilot-grade best-effort.
  - No real-time push.
  - Do not redesign notification architecture.
"""
from __future__ import annotations

import logging

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.urls import reverse

from contracts.models import OrganizationMembership
from contracts.models.governance import Notification

logger = logging.getLogger(__name__)


def _resolve_provider_email(client) -> str:
    """Return the best available contact address for a provider Client.

    Priority: primary_contact_email > email > org.notification_email > org.contact_email.
    Returns an empty string when nothing is configured.
    """
    if getattr(client, 'primary_contact_email', ''):
        return client.primary_contact_email.strip()
    if getattr(client, 'email', ''):
        return client.email.strip()
    org = getattr(client, 'organization', None)
    if org:
        if getattr(org, 'notification_email', ''):
            return org.notification_email.strip()
        if getattr(org, 'contact_email', ''):
            return org.contact_email.strip()
    return ''


def _provider_user_recipients(client):
    """Return active User objects belonging to the provider's Organization.

    Returns an empty list when the Client has no linked Organization.
    """
    org = getattr(client, 'organization', None)
    if org is None:
        return []
    return list(
        OrganizationMembership.objects
        .filter(organization=org, is_active=True)
        .select_related('user')
        .values_list('user', flat=True)
    )


def _case_link(intake) -> str:
    """Return the SPA deep-link for the provider review inbox."""
    try:
        return reverse('carelane:cases_api').rstrip('/') + f'/../#{intake.pk}'
    except Exception:
        return '/care/'


def notify_provider_review_requested(intake, placement, organization) -> int:
    """Create in-app Notification rows and send a contact email for a provider review request.

    Returns the number of in-app notifications created.
    Called synchronously inside the `send_to_provider` / `assign` action handler.
    Email failures are logged but never bubble up — they must not abort the placement.
    """
    provider_client = getattr(placement, 'proposed_provider', None) or getattr(placement, 'selected_provider', None)
    if provider_client is None:
        logger.warning(
            'notify_provider_review_requested: placement %s has no provider client — skipping notification',
            placement.pk,
        )
        return 0

    case = getattr(intake, 'case_record', None) or getattr(intake, 'care_case', None)
    case_title = getattr(case, 'title', None) or getattr(intake, 'case_ref', str(intake.pk))

    link = '/care/'

    # ── 1. In-app notifications ──────────────────────────────────────────────
    recipient_user_ids = _provider_user_recipients(provider_client)
    created = 0
    for user_id in recipient_user_ids:
        already = Notification.objects.filter(
            recipient_id=user_id,
            notification_type=Notification.NotificationType.APPROVAL,
            link=link,
        ).filter(
            message__contains=str(intake.pk),
        ).exists()
        if already:
            continue
        Notification.objects.create(
            recipient_id=user_id,
            notification_type=Notification.NotificationType.APPROVAL,
            title=f'Plaatsingsverzoek: {case_title}',
            message=(
                f'Er is een nieuw plaatsingsverzoek voor u klaar om te beoordelen '
                f'(referentie #{intake.pk}). Log in om te reageren.'
            ),
            link=link,
        )
        created += 1

    if not recipient_user_ids:
        logger.info(
            'notify_provider_review_requested: provider client %s (org_id=%s) has no active members — '
            'no in-app notifications created for intake %s',
            provider_client.pk,
            getattr(getattr(provider_client, 'organization', None), 'pk', None),
            intake.pk,
        )

    # ── 2. Contact email ──────────────────────────────────────────────────────
    contact_email = _resolve_provider_email(provider_client)
    if not contact_email:
        logger.warning(
            'notify_provider_review_requested: no contact email for provider client %s '
            '(name=%r) — email not sent for intake %s',
            provider_client.pk,
            provider_client.name,
            intake.pk,
        )
    else:
        try:
            subject = f'[Carelane] Nieuw plaatsingsverzoek — {case_title}'
            body = (
                f'Geachte aanbieder,\n\n'
                f'Er is een plaatsingsverzoek aan u toegewezen (referentie #{intake.pk}).\n\n'
                f'Log in op het Carelane-portaal om het verzoek te bekijken en te reageren.\n\n'
                f'Met vriendelijke groet,\nHet Carelane-systeem'
            )
            send_mail(
                subject=subject,
                message=body,
                from_email=None,  # uses DEFAULT_FROM_EMAIL
                recipient_list=[contact_email],
                fail_silently=False,
            )
            logger.info(
                'notify_provider_review_requested: email sent to %s for intake %s',
                contact_email,
                intake.pk,
            )
        except Exception as exc:
            logger.error(
                'notify_provider_review_requested: failed to send email to %s for intake %s — %s',
                contact_email,
                intake.pk,
                exc,
                exc_info=True,
            )

    return created
