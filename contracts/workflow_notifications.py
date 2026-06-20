"""
Operational email notifications triggered by WorkflowBus signals.

Each function receives the kwargs from a signal receiver and returns the
number of emails dispatched (0 if none were sent, e.g. no recipients
configured, email disabled, etc.).

All sends are fire-and-forget: errors are logged but never re-raised so a
delivery failure never rolls back a committed workflow transition.
"""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _org_recipients(intake) -> list[str]:
    """Return the notification addresses for the gemeente/organisation."""
    if intake is None:
        return []
    try:
        org = intake.organization
        if org is None:
            return []
        recipients: list[str] = []
        if org.notification_email:
            recipients.append(org.notification_email)
        elif org.contact_email:
            recipients.append(org.contact_email)
        return recipients
    except Exception:
        logger.exception("workflow_notifications._org_recipients failed")
        return []


def _provider_recipients(placement) -> list[str]:
    """Return the contact addresses for the provider on a placement request."""
    if placement is None:
        return []
    try:
        provider = getattr(placement, 'selected_provider', None) or getattr(placement, 'proposed_provider', None)
        if provider is None:
            return []
        recipients: list[str] = []
        if provider.primary_contact_email:
            recipients.append(provider.primary_contact_email)
        elif provider.email:
            recipients.append(provider.email)
        return recipients
    except Exception:
        logger.exception("workflow_notifications._provider_recipients failed")
        return []


def _send(*, subject: str, body: str, recipients: list[str]) -> int:
    """Send a single email to all recipients; log and return 0 on failure."""
    if not recipients:
        return 0
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@carelane.nl')
    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=from_email,
            recipient_list=recipients,
            fail_silently=False,
        )
        logger.info("workflow_notifications sent %r to %s", subject, recipients)
        return len(recipients)
    except Exception:
        logger.exception("workflow_notifications send failed subject=%r recipients=%s", subject, recipients)
        return 0


def _intake_from_case(case) -> Any | None:
    try:
        return case.due_diligence_process
    except Exception:
        return None


def _intake_from_placement(placement) -> Any | None:
    try:
        return placement.due_diligence_process
    except Exception:
        return None


def _base_url() -> str:
    return getattr(settings, 'SPA_ORIGIN', 'https://www.carelane.nl')


# ── Notification functions ────────────────────────────────────────────────────

def notify_provider_review_requested(*, case, old_phase, new_phase, **kwargs) -> int:
    """Notify provider when the case phase moves to PROVIDER_BEOORDELING."""
    from contracts.models import CareCase, PlacementRequest
    if new_phase != CareCase.CasePhase.PROVIDER_BEOORDELING:
        return 0

    intake = _intake_from_case(case)
    if intake is None:
        return 0

    try:
        placement = (
            PlacementRequest.objects
            .filter(due_diligence_process=intake)
            .exclude(provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED)
            .order_by('-updated_at')
            .first()
        )
    except Exception:
        logger.exception("notify_provider_review_requested: placement lookup failed")
        return 0

    recipients = _provider_recipients(placement)
    if not recipients:
        return 0

    subject = f"[Carelane] Beoordeling gevraagd voor casus '{intake.title}'"
    body = (
        f"U heeft een beoordelingsverzoek ontvangen voor casus '{intake.title}'.\n\n"
        f"Meld u aan via Carelane om de details te bekijken en een reactie te geven:\n"
        f"{_base_url()}\n\n"
        "Met vriendelijke groet,\nCarelane"
    )
    return _send(subject=subject, body=body, recipients=recipients)


def notify_org_provider_response(*, placement, old_response_status, new_response_status, **kwargs) -> int:
    """Notify the gemeente organisation when the provider responds to a placement."""
    from contracts.models import PlacementRequest

    informative_statuses = {
        PlacementRequest.ProviderResponseStatus.ACCEPTED,
        PlacementRequest.ProviderResponseStatus.REJECTED,
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        PlacementRequest.ProviderResponseStatus.NEEDS_INFO,
        PlacementRequest.ProviderResponseStatus.WAITLIST,
    }
    if new_response_status not in informative_statuses:
        return 0

    intake = _intake_from_placement(placement)
    recipients = _org_recipients(intake)
    if not recipients:
        return 0

    status_labels = {
        PlacementRequest.ProviderResponseStatus.ACCEPTED: "geaccepteerd",
        PlacementRequest.ProviderResponseStatus.REJECTED: "afgewezen",
        PlacementRequest.ProviderResponseStatus.NO_CAPACITY: "afgewezen (geen capaciteit)",
        PlacementRequest.ProviderResponseStatus.NEEDS_INFO: "aanvullende informatie gevraagd",
        PlacementRequest.ProviderResponseStatus.WAITLIST: "op de wachtlijst geplaatst",
    }
    label = status_labels.get(new_response_status, new_response_status)
    case_label = getattr(intake, 'title', 'onbekend') if intake else 'onbekend'
    provider_name = ""
    try:
        provider = getattr(placement, 'selected_provider', None) or getattr(placement, 'proposed_provider', None)
        if provider:
            provider_name = f" door {provider.name}"
    except Exception:
        pass

    subject = f"[Carelane] Reactie aanbieder op casus '{case_label}'"
    body = (
        f"De plaatsingsaanvraag voor casus '{case_label}' is {label}{provider_name}.\n\n"
        f"Meld u aan via Carelane voor de volgende stap:\n"
        f"{_base_url()}\n\n"
        "Met vriendelijke groet,\nCarelane"
    )
    return _send(subject=subject, body=body, recipients=recipients)


def notify_placement_confirmed(*, case, old_phase, new_phase, **kwargs) -> int:
    """Notify both gemeente and provider when a placement is confirmed (PLAATSING)."""
    from contracts.models import CareCase, PlacementRequest
    if new_phase != CareCase.CasePhase.PLAATSING:
        return 0

    intake = _intake_from_case(case)
    if intake is None:
        return 0

    try:
        placement = (
            PlacementRequest.objects
            .filter(due_diligence_process=intake)
            .order_by('-updated_at')
            .first()
        )
    except Exception:
        placement = None

    case_label = getattr(intake, 'title', 'onbekend')
    base = _base_url()
    sent = 0

    # Notify gemeente
    org_recipients = _org_recipients(intake)
    if org_recipients:
        sent += _send(
            subject=f"[Carelane] Plaatsing bevestigd voor casus '{case_label}'",
            body=(
                f"De plaatsing voor casus '{case_label}' is bevestigd.\n\n"
                f"Bekijk de details in Carelane:\n{base}\n\n"
                "Met vriendelijke groet,\nCarelane"
            ),
            recipients=org_recipients,
        )

    # Notify provider
    provider_recipients = _provider_recipients(placement)
    if provider_recipients:
        sent += _send(
            subject=f"[Carelane] Plaatsingsbevestiging voor casus '{case_label}'",
            body=(
                f"De plaatsing voor casus '{case_label}' is bevestigd.\n\n"
                f"Meld u aan via Carelane voor verdere instructies:\n{base}\n\n"
                "Met vriendelijke groet,\nCarelane"
            ),
            recipients=provider_recipients,
        )

    return sent


def notify_care_signal_status_changed(*, care_signal, old_status, new_status, **kwargs) -> int:
    """Notify the organisation when a care signal moves to IN_PROGRESS or RESOLVED."""
    from contracts.models import CareSignal

    actionable_statuses = {
        CareSignal.SignalStatus.IN_PROGRESS,
        CareSignal.SignalStatus.RESOLVED,
    }
    if new_status not in actionable_statuses:
        return 0

    try:
        intake = care_signal.due_diligence_process
    except Exception:
        return 0

    recipients = _org_recipients(intake)
    if not recipients:
        return 0

    status_labels = {
        CareSignal.SignalStatus.IN_PROGRESS: "in opvolging genomen",
        CareSignal.SignalStatus.RESOLVED: "afgerond",
    }
    label = status_labels.get(new_status, new_status)
    signal_title = getattr(care_signal, 'title', '') or getattr(care_signal, 'get_signal_type_display', lambda: 'Signaal')()
    case_label = getattr(intake, 'title', 'onbekend') if intake else 'onbekend'

    subject = f"[Carelane] Signaal {label}: '{signal_title}'"
    body = (
        f"Het signaal '{signal_title}' voor casus '{case_label}' is {label}.\n\n"
        f"Bekijk het signaal via Carelane:\n{_base_url()}\n\n"
        "Met vriendelijke groet,\nCarelane"
    )
    return _send(subject=subject, body=body, recipients=recipients)


def notify_assessment_approved_for_matching(*, assessment, old_status, new_status, **kwargs) -> int:
    """Notify the organisation coordinator when an assessment is approved for matching."""
    from contracts.models import CaseAssessment
    if new_status != CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING:
        return 0

    try:
        intake = assessment.due_diligence_process
    except Exception:
        return 0

    recipients = _org_recipients(intake)
    if not recipients:
        return 0

    case_label = getattr(intake, 'title', 'onbekend')
    subject = f"[Carelane] Beoordeling gereed voor matching: '{case_label}'"
    body = (
        f"De beoordeling voor casus '{case_label}' is goedgekeurd en klaar voor matching.\n\n"
        f"Start de matching via Carelane:\n{_base_url()}\n\n"
        "Met vriendelijke groet,\nCarelane"
    )
    return _send(subject=subject, body=body, recipients=recipients)
