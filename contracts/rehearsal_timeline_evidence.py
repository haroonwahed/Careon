"""
Pilot rehearsal: prove Gemeente validatie → Aanbieder beoordeling emits Case Timeline v1 rows.

Uses seeded gemeente-demo + Demo Casus B (MATCHING_READY). Quiet by default — structured dict only.
"""

from __future__ import annotations

import json
import os
from typing import Any

from django.test import Client
from django.urls import reverse

from contracts.models import CaseIntakeProcess, CaseTimelineEvent, Client as ProviderClient, Organization
from contracts.pilot_universe import PILOT_CASE_TITLES

_ALLOWED_METADATA_KEYS = frozenset({'placement_id', 'placement_status', 'provider_id', 'step'})


def _demo_password() -> str:
    return (
        os.environ.get('E2E_DEMO_PASSWORD')
        or os.environ.get('E2E_PASSWORD')
        or 'pilot_demo_pass_123'
    )


def _gemeente_username() -> str:
    return os.environ.get('E2E_GEMEENTE_USERNAME', 'demo_gemeente')


def _provider_username_for_kompas() -> str:
    return os.environ.get('E2E_PROVIDER_TWO_USERNAME', 'demo_provider_kompas')


def _provider_username_for_horizon() -> str:
    return os.environ.get('E2E_PROVIDER_ONE_USERNAME', 'demo_provider_brug')


def collect_timeline_boundary_evidence(
    *,
    correlation_id: str = 'rehearsal-timeline-correlation',
) -> dict[str, Any]:
    """
    Perform assign on Demo Casus B (Kompas), then GET timeline; verify provider isolation.

    Raises AssertionError if invariants fail (for rehearsal strict exit).
    """
    org = Organization.objects.get(slug='gemeente-demo')
    intake = CaseIntakeProcess.objects.select_related('contract').get(
        organization=org,
        title=PILOT_CASE_TITLES[1],
    )
    case = intake.case_record
    assert case is not None

    kompas_client = ProviderClient.objects.get(organization=org, name='Kompas Zorg')
    case_pk = case.pk

    client = Client()
    pw = _demo_password()
    assert client.login(username=_gemeente_username(), password=pw)

    assign_url = reverse('careon:matching_action_api', kwargs={'case_id': case_pk})
    timeline_url = reverse('careon:case_timeline_api', kwargs={'case_id': case_pk})

    post_resp = client.post(
        assign_url,
        data=json.dumps({'action': 'assign', 'provider_id': kompas_client.pk}),
        content_type='application/json',
        HTTP_X_REQUEST_ID=correlation_id,
    )
    assert post_resp.status_code == 200, post_resp.content.decode()

    tl_resp = client.get(timeline_url, HTTP_X_REQUEST_ID=correlation_id)
    assert tl_resp.status_code == 200, tl_resp.content.decode()
    payload = tl_resp.json()
    events = payload.get('events') or []
    types_ordered = [e.get('event_type') for e in events]

    expected_head = [
        CaseTimelineEvent.EventType.GEMEENTE_VALIDATION_APPROVED,
        CaseTimelineEvent.EventType.PLACEMENT_REQUEST_CREATED,
        CaseTimelineEvent.EventType.PROVIDER_REVIEW_OPENED,
    ]
    assert types_ordered[: len(expected_head)] == expected_head, types_ordered

    for ev in events:
        rid = ev.get('request_id')
        assert rid == correlation_id, f'request_id mismatch: {rid!r} vs {correlation_id!r}'
        meta = ev.get('metadata') or {}
        for k in meta.keys():
            assert k in _ALLOWED_METADATA_KEYS, f'unsafe metadata key: {k!r}'

    rows = CaseTimelineEvent.objects.filter(care_case_id=case_pk).order_by('occurred_at', 'id')
    first = rows.first()
    build_sha = (first.build_sha or '') if first else ''
    release_id = (first.release_id or '') if first else ''

    client.logout()
    assert client.login(username=_provider_username_for_kompas(), password=pw)
    provider_visible = client.get(timeline_url)
    assert provider_visible.status_code == 200

    client.logout()
    assert client.login(username=_provider_username_for_horizon(), password=pw)
    unrelated = client.get(timeline_url)
    assert unrelated.status_code == 404

    return {
        'ok': True,
        'case_id': case_pk,
        'correlation_id_sent': correlation_id,
        'event_count': len(events),
        'event_types_ordered': types_ordered,
        'request_ids_present': all(
            (e.get('request_id') == correlation_id) for e in events
        ),
        'build_sha': build_sha,
        'release_id': release_id,
        'metadata_keys_ok': True,
        'gemeente_timeline_status': 200,
        'linked_provider_timeline_status': 200,
        'unrelated_provider_timeline_status': 404,
        'authorization_checks_passed': True,
    }
