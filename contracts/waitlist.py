"""
contracts/waitlist.py

Waitlist prioritization logic for CareOn.

Default rule: first-come, first-served based on casus.start_date
              (aanmeldingsdatum in het systeem).

Exception: when urgency_validated=True AND urgency_granted_date is set,
           the case jumps to the top of the queue, ordered by
           urgency_granted_date ascending (earliest grant first).

Priority order:
  1. Validated urgent cases  → sorted by urgency_granted_date ASC
  2. Non-urgent cases        → sorted by start_date ASC (FCFS)

This module is the single source of truth for waitlist ordering.
Both Django queryset ordering and in-memory sorting must use the
helpers defined here for consistency.
"""
from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.db.models import QuerySet


# ── Sort key for in-memory sorting ──────────────────────────────────────────

_SENTINEL = date(9999, 12, 31)


def waitlist_sort_key(intake) -> tuple:
    """
    Returns a comparable tuple for sorting an iterable of CaseIntakeProcess
    instances by waitlist priority.

    Usage:
        sorted_intakes = sorted(intakes, key=waitlist_sort_key)
    """
    if intake.urgency_validated and intake.urgency_granted_date:
        return (0, intake.urgency_granted_date, _SENTINEL)
    return (1, _SENTINEL, intake.start_date or _SENTINEL)


# ── QuerySet ordering ────────────────────────────────────────────────────────

def apply_waitlist_order(qs: "QuerySet") -> "QuerySet":
    """
    Applies policy-aligned waitlist ordering to a CaseIntakeProcess queryset.

    Because Django ORM cannot express a conditional multi-field sort in a
    single .order_by() call with simple field names, we annotate a numeric
    priority bucket (0 = validated urgent, 1 = normal) and then sort:

        bucket ASC → urgency_granted_date ASC (NULLs last) → start_date ASC

    This mirrors waitlist_sort_key() for in-memory sorting.
    """
    from django.db.models import Case, IntegerField, Value, When

    urgency_bucket = Case(
        When(urgency_validated=True, urgency_granted_date__isnull=False, then=Value(0)),
        default=Value(1),
        output_field=IntegerField(),
    )

    return (
        qs
        .annotate(waitlist_bucket=urgency_bucket)
        .order_by(
            'waitlist_bucket',          # 0 = urgent first
            'urgency_granted_date',     # earliest grant date first (NULLs sort last via bucket)
            'start_date',               # FCFS for non-urgent (oldest first)
        )
    )


# ── Validation helper ────────────────────────────────────────────────────────

def validate_urgency_transition(intake, actor) -> tuple[bool, str]:
    """
    Validates whether urgency can be marked as validated for the given intake
    by the given actor (User instance).

    Rules enforced here:
    - urgency_document must be present
    - actor must be a gemeente user (profile.role == 'gemeente')
    - urgency must not already be validated

    Returns (True, '') on success or (False, error_message) on failure.
    """
    if intake.urgency_validated:
        return False, 'Urgentie is al gevalideerd voor deze casus.'

    if not intake.urgency_document:
        return False, 'Urgentie vereist een geldige urgentieverklaring.'

    # Role guard: only gemeente users may validate urgency
    try:
        profile = actor.profile
        actor_role = getattr(profile, 'role', None)
    except Exception:
        actor_role = None

    if actor_role != 'gemeente':
        return False, 'Alleen gemeente-gebruikers mogen urgentie valideren.'

    return True, ''
