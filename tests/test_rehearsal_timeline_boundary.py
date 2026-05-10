"""Rehearsal-aligned checks: timeline boundary after pilot seed (gemeente-demo / Demo Casus B)."""

from django.core.management import call_command
from django.test import TestCase

from contracts.rehearsal_timeline_evidence import collect_timeline_boundary_evidence


class RehearsalTimelineBoundaryTests(TestCase):
    """Requires same seed order as reset_pilot_environment / prepare_pilot_e2e."""

    def setUp(self):
        call_command('seed_demo_data', reset=True, locked_time=True, verbosity=0)
        call_command('seed_pilot_e2e', verbosity=0)

    def test_timeline_boundary_evidence_matches_rehearsal_expectations(self):
        ev = collect_timeline_boundary_evidence(correlation_id='test-rehearsal-cid-99')
        self.assertTrue(ev.get('ok'))
        self.assertGreaterEqual(ev.get('event_count', 0), 3)
        self.assertTrue(ev.get('authorization_checks_passed'))
        self.assertEqual(ev.get('unrelated_provider_timeline_status'), 404)
        self.assertEqual(ev.get('linked_provider_timeline_status'), 200)
