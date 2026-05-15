"""Release evidence bundle + Case Timeline v1 GO/NO-GO gate."""

import json
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import CommandError, call_command
from django.test import TestCase

from contracts.release_evidence_bundle import (
    EXPECTED_TIMELINE_EVENT_ORDER,
    build_release_evidence_bundle,
    load_timeline_evidence_from_reports,
    validate_timeline_release_gate,
)


def _valid_evidence(**overrides):
    base = {
        'ok': True,
        'case_id': 1,
        'event_types_ordered': list(EXPECTED_TIMELINE_EVENT_ORDER),
        'request_ids_present': True,
        'gemeente_timeline_status': 200,
        'linked_provider_timeline_status': 200,
        'unrelated_provider_timeline_status': 404,
        'metadata_keys_ok': True,
        'authorization_checks_passed': True,
    }
    base.update(overrides)
    return base


class ReleaseEvidenceBundleTests(TestCase):
    def test_gate_passes_when_valid_timeline_evidence(self):
        go, reasons = validate_timeline_release_gate(_valid_evidence())
        self.assertTrue(go)
        self.assertEqual(reasons, [])

    def test_gate_fails_when_evidence_missing(self):
        go, reasons = validate_timeline_release_gate(None)
        self.assertFalse(go)
        self.assertIn('timeline_evidence_missing', reasons)

    def test_gate_fails_when_provider_visibility_evidence_fails(self):
        go, reasons = validate_timeline_release_gate(
            _valid_evidence(
                linked_provider_timeline_status=403,
                unrelated_provider_timeline_status=200,
            ),
        )
        self.assertFalse(go)
        self.assertIn('linked_provider_timeline_access_failed', reasons)
        self.assertIn('unrelated_provider_denial_failed', reasons)

    def test_gate_fails_when_event_order_wrong(self):
        wrong = list(reversed(EXPECTED_TIMELINE_EVENT_ORDER))
        go, reasons = validate_timeline_release_gate(_valid_evidence(event_types_ordered=list(wrong)))
        self.assertFalse(go)
        self.assertTrue(any(r.startswith('event_order_invalid') for r in reasons))

    def test_load_prefers_standalone_json(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            (tmp / 'reports').mkdir(parents=True)
            ev = _valid_evidence()
            (tmp / 'reports' / 'rehearsal_timeline_evidence.json').write_text(
                json.dumps(ev),
                encoding='utf-8',
            )
            loaded, flags = load_timeline_evidence_from_reports(tmp)
            self.assertEqual(loaded['case_id'], 1)
            self.assertTrue(flags['rehearsal_timeline_evidence_json'])

    def test_load_from_custom_reports_dir(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            custom = tmp / 'reports' / 'pilot-ci'
            custom.mkdir(parents=True)
            ev = _valid_evidence()
            (custom / 'rehearsal_timeline_evidence.json').write_text(
                json.dumps(ev),
                encoding='utf-8',
            )
            loaded, flags = load_timeline_evidence_from_reports(tmp, reports_dir=custom)
            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual(loaded['case_id'], 1)
            self.assertTrue(flags['rehearsal_timeline_evidence_json'])

    def test_load_nested_from_rehearsal_report(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            (tmp / 'reports').mkdir(parents=True)
            report = {'checks': [], 'timeline_boundary_evidence': _valid_evidence()}
            (tmp / 'reports' / 'rehearsal_report.json').write_text(
                json.dumps(report),
                encoding='utf-8',
            )
            loaded, flags = load_timeline_evidence_from_reports(tmp)
            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual(loaded['case_id'], 1)
            self.assertTrue(flags['rehearsal_report_timeline_boundary_evidence'])

    def test_build_bundle_end_to_end(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            (tmp / 'reports').mkdir(parents=True)
            (tmp / 'reports' / 'rehearsal_timeline_evidence.json').write_text(
                json.dumps(_valid_evidence()),
                encoding='utf-8',
            )
            bundle = build_release_evidence_bundle(tmp)
            self.assertTrue(bundle['timeline_gate']['go'])

    def test_release_evidence_bundle_command_report_only_no_raise(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            (tmp / 'reports').mkdir(parents=True)
            bad = _valid_evidence(event_types_ordered=[])
            (tmp / 'reports' / 'rehearsal_timeline_evidence.json').write_text(
                json.dumps(bad),
                encoding='utf-8',
            )
            out = tmp / 'reports' / 'out.json'
            call_command(
                'release_evidence_bundle',
                base_dir=str(tmp),
                write_json=str(out),
                report_only=True,
                stdout=StringIO(),
                stderr=StringIO(),
            )
            self.assertTrue(out.is_file())

    def test_release_evidence_bundle_command_raises_no_go_without_report_only(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            (tmp / 'reports').mkdir(parents=True)
            bad = _valid_evidence(event_types_ordered=[])
            (tmp / 'reports' / 'rehearsal_timeline_evidence.json').write_text(
                json.dumps(bad),
                encoding='utf-8',
            )
            with self.assertRaises(CommandError):
                call_command(
                    'release_evidence_bundle',
                    base_dir=str(tmp),
                    stdout=StringIO(),
                    stderr=StringIO(),
                )


class RehearsalVerifyJsonStdoutTests(TestCase):
    """rehearsal_verify --json must emit a single JSON object on stdout (merge / json.tool safe)."""

    def setUp(self):
        call_command('seed_demo_data', reset=True, locked_time=True, verbosity=0)
        call_command('seed_pilot_e2e', verbosity=0)

    def test_rehearsal_verify_json_stdout_is_single_parseable_object(self):
        buf = StringIO()
        call_command('rehearsal_verify', json=True, stdout=buf, stderr=StringIO())
        raw = buf.getvalue().strip()
        data = json.loads(raw)
        self.assertIn('ok', data)
        self.assertIn('checks', data)


class MergedRehearsalReportBundleTests(TestCase):
    def test_release_evidence_bundle_reads_nested_timeline_in_rehearsal_report_only(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            (tmp / 'reports').mkdir(parents=True)
            (tmp / 'reports' / 'rehearsal_report.json').write_text(
                json.dumps(
                    {
                        'ok': True,
                        'checks': [],
                        'timeline_boundary_evidence': _valid_evidence(),
                    },
                ),
                encoding='utf-8',
            )
            out = tmp / 'reports' / 'bundle_out.json'
            call_command(
                'release_evidence_bundle',
                base_dir=str(tmp),
                write_json=str(out),
                stdout=StringIO(),
                stderr=StringIO(),
            )
            self.assertTrue(out.is_file())
            payload = json.loads(out.read_text(encoding='utf-8'))
            self.assertTrue(payload['timeline_gate']['go'])
            self.assertTrue(payload['sources']['rehearsal_report_timeline_boundary_evidence'])

    def test_release_evidence_bundle_command_with_custom_reports_dir(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            sub = tmp / 'reports' / 'pilot-123'
            sub.mkdir(parents=True)
            (sub / 'rehearsal_timeline_evidence.json').write_text(
                json.dumps(_valid_evidence()),
                encoding='utf-8',
            )
            out = sub / 'release_evidence_bundle.json'
            call_command(
                'release_evidence_bundle',
                base_dir=str(tmp),
                reports_dir=str(sub),
                write_json=str(out),
                stdout=StringIO(),
                stderr=StringIO(),
            )
            self.assertTrue(out.is_file())
            payload = json.loads(out.read_text(encoding='utf-8'))
            self.assertTrue(payload['timeline_gate']['go'])
