"""
Atomic capacity management for placement confirmation.

Rules:
  - commit_capacity: decrement beschikbare_capaciteit by 1 under a row lock.
    Rejects (returns False) if capacity == 0.  No-ops if already committed or
    if no CapaciteitRecord exists (logged at WARNING).
  - release_capacity: reverse a committed decrement.  No-op when not committed.

Both functions must be called inside an existing transaction.atomic() block.
The SELECT FOR UPDATE lock on the CapaciteitRecord row prevents concurrent
confirmations from reading stale capacity and consuming the same final slot.
"""

import logging

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import F

logger = logging.getLogger(__name__)

# Sentinel returned by commit_capacity when no capacity is available.
NO_CAPACITY_CODE = 'NO_CAPACITY'


def _resolve_zorgaanbieder(placement):
    """Return the Zorgaanbieder linked to the placement's provider, or None."""
    for attr in ('selected_provider', 'proposed_provider'):
        client = getattr(placement, attr, None)
        if client is None:
            continue
        try:
            return client.zorgaanbieder
        except ObjectDoesNotExist:
            continue
    return None


def _lock_latest_capacity_record(za):
    """
    Return the most-recent CapaciteitRecord for *za* under a SELECT FOR UPDATE lock,
    or None when no records exist.
    Must be called inside an active transaction.atomic() block.
    """
    from contracts.models import CapaciteitRecord

    return (
        CapaciteitRecord.objects
        .select_for_update()
        .filter(vestiging__zorgaanbieder=za)
        .order_by('-recorded_at')
        .first()
    )


def commit_capacity(placement):
    """
    Atomically commit one capacity slot for *placement*.

    Returns:
        (True,  None)             — committed (or no-op: already committed / no record)
        (False, NO_CAPACITY_CODE) — provider has no available capacity; caller should
                                    reject the confirmation with HTTP 409

    Must be called inside transaction.atomic().
    """
    if placement.capacity_committed:
        # Guard against repeated calls — idempotent.
        return True, None

    za = _resolve_zorgaanbieder(placement)
    if za is None:
        logger.warning(
            'commit_capacity: placement %s has no linked Zorgaanbieder — skipping capacity check',
            placement.pk,
        )
        return True, None  # no-op; PROVIDER_UNLINKED gate should have fired earlier

    from contracts.models import CapaciteitRecord

    record = _lock_latest_capacity_record(za)
    if record is None:
        logger.warning(
            'commit_capacity: no CapaciteitRecord for Zorgaanbieder "%s" (pk=%s) — skipping',
            za.name, za.pk,
        )
        return True, None  # no capacity data; treat as unconstrained (log only)

    # Both fields represent available capacity (beschikbare_capaciteit is current;
    # open_slots is legacy).  Check the maximum so either alone satisfies the guard,
    # then decrement BOTH atomically — prevents a second concurrent transaction from
    # slipping through via the fallback field after the first decrements only one.
    effective = max(record.beschikbare_capaciteit, record.open_slots)
    if effective <= 0:
        return False, NO_CAPACITY_CODE

    # Decrement both fields, clamped at 0.  Clamp via SQL Greatest so the check
    # and write are atomic under the row lock already held by select_for_update.
    from django.db.models import Value
    from django.db.models.functions import Greatest
    CapaciteitRecord.objects.filter(pk=record.pk).update(
        beschikbare_capaciteit=Greatest(F('beschikbare_capaciteit') - 1, Value(0)),
        open_slots=Greatest(F('open_slots') - 1, Value(0)),
    )

    placement.capacity_committed = True
    placement.save(update_fields=['capacity_committed', 'updated_at'])

    return True, None


def release_capacity(placement):
    """
    Return the previously committed capacity slot to the provider.

    Safe to call unconditionally — silently skips if capacity was never committed.
    Must be called inside transaction.atomic().
    """
    if not placement.capacity_committed:
        return

    za = _resolve_zorgaanbieder(placement)
    if za is None:
        logger.warning(
            'release_capacity: placement %s has no linked Zorgaanbieder — cannot restore',
            placement.pk,
        )
        placement.capacity_committed = False
        placement.save(update_fields=['capacity_committed', 'updated_at'])
        return

    from contracts.models import CapaciteitRecord

    record = _lock_latest_capacity_record(za)
    if record is None:
        logger.warning(
            'release_capacity: no CapaciteitRecord for Zorgaanbieder "%s" (pk=%s) — cannot restore',
            za.name, za.pk,
        )
    else:
        # Increment both fields symmetrically (mirrors the dual-decrement in commit).
        CapaciteitRecord.objects.filter(pk=record.pk).update(
            beschikbare_capaciteit=F('beschikbare_capaciteit') + 1,
            open_slots=F('open_slots') + 1,
        )

    placement.capacity_committed = False
    placement.save(update_fields=['capacity_committed', 'updated_at'])
