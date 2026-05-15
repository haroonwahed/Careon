"""
Release / readiness evidence bundle: merges rehearsal timeline artifacts and validates pilot GO/NO-GO.

Does not run rehearsals — consumes JSON produced by `rehearsal_timeline_evidence` / full pilot rehearsal.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from contracts.models import CaseTimelineEvent

EXPECTED_TIMELINE_EVENT_ORDER: tuple[str, ...] = (
    CaseTimelineEvent.EventType.GEMEENTE_VALIDATION_APPROVED,
    CaseTimelineEvent.EventType.PLACEMENT_REQUEST_CREATED,
    CaseTimelineEvent.EventType.PROVIDER_REVIEW_OPENED,
)


def _read_json(path: Path) -> Any:
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def load_timeline_evidence_from_reports(
    base_dir: Path,
    *,
    reports_dir: Path | None = None,
) -> tuple[dict[str, Any] | None, dict[str, bool]]:
    """
    Prefer standalone reports/rehearsal_timeline_evidence.json;
    fall back to timeline_boundary_evidence inside reports/rehearsal_report.json.
    Returns (canonical_evidence_or_none, flags_which_sources_existed).

    When ``reports_dir`` is set (e.g. CI ``REPORT_DIR``), JSON is read from that directory
    instead of ``<base_dir>/reports`` — filenames stay ``rehearsal_timeline_evidence.json``
    and ``rehearsal_report.json``.
    """
    flags = {
        'rehearsal_timeline_evidence_json': False,
        'rehearsal_report_timeline_boundary_evidence': False,
    }
    reports_root = reports_dir if reports_dir is not None else base_dir / 'reports'
    standalone = reports_root / 'rehearsal_timeline_evidence.json'
    merged_report = reports_root / 'rehearsal_report.json'

    ev: dict[str, Any] | None = None

    raw_standalone = _read_json(standalone)
    if isinstance(raw_standalone, dict) and raw_standalone.get('ok') is True:
        flags['rehearsal_timeline_evidence_json'] = True
        ev = raw_standalone

    raw_report = _read_json(merged_report)
    if isinstance(raw_report, dict):
        nested = raw_report.get('timeline_boundary_evidence')
        if isinstance(nested, dict) and nested.get('ok') is True:
            flags['rehearsal_report_timeline_boundary_evidence'] = True
            if ev is None:
                ev = nested

    return ev, flags


def validate_timeline_release_gate(evidence: dict[str, Any] | None) -> tuple[bool, list[str]]:
    """
    Pilot GO requires passing Gemeente validatie → Aanbieder beoordeling timeline boundary evidence.

    Returns (go: bool, blocking_reasons).
    """
    reasons: list[str] = []

    if evidence is None:
        return False, ['timeline_evidence_missing']

    if not evidence.get('ok'):
        reasons.append('timeline_evidence_ok_false')

    order = evidence.get('event_types_ordered')
    if order != list(EXPECTED_TIMELINE_EVENT_ORDER):
        reasons.append(
            f'event_order_invalid expected={list(EXPECTED_TIMELINE_EVENT_ORDER)!r} got={order!r}',
        )

    if not evidence.get('request_ids_present'):
        reasons.append('request_ids_present_false')

    if evidence.get('gemeente_timeline_status') != 200:
        reasons.append('gemeente_timeline_access_failed')

    if evidence.get('linked_provider_timeline_status') != 200:
        reasons.append('linked_provider_timeline_access_failed')

    if evidence.get('unrelated_provider_timeline_status') != 404:
        reasons.append('unrelated_provider_denial_failed')

    if not evidence.get('metadata_keys_ok'):
        reasons.append('metadata_safety_failed')

    if not evidence.get('authorization_checks_passed'):
        reasons.append('authorization_checks_failed')

    return (len(reasons) == 0, reasons)


def build_release_evidence_bundle(base_dir: Path, *, reports_dir: Path | None = None) -> dict[str, Any]:
    """Merge timeline sources + gate result for reports/release_evidence_bundle.json."""
    evidence, source_flags = load_timeline_evidence_from_reports(base_dir, reports_dir=reports_dir)
    go, gate_reasons = validate_timeline_release_gate(evidence)

    return {
        'sources': source_flags,
        'timeline_evidence': evidence,
        'timeline_gate': {
            'go': go,
            'no_go_reasons': gate_reasons,
            'expected_event_order': list(EXPECTED_TIMELINE_EVENT_ORDER),
        },
    }
