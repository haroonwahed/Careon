"""Formal escalation semantics registry (operational, not notifications)."""

from django.test import SimpleTestCase

from contracts.escalation_registry import (
    REGISTRY,
    all_escalation_codes,
    definitions_as_public_dicts,
    get_escalation_definition,
)


class EscalationRegistryTests(SimpleTestCase):
    def test_required_codes_exist(self):
        for code in (
            "BLOCKER_STALE_72H",
            "PROVIDER_NO_RESPONSE",
            "MATCHING_CAPACITY_EXHAUSTED",
            "INTAKE_DELAY_RISK",
            "WORKFLOW_STATE_INCONSISTENT",
        ):
            self.assertIn(code, REGISTRY)

    def test_provider_no_response_bridges_engine_hint(self):
        d = get_escalation_definition("PROVIDER_NO_RESPONSE")
        self.assertIsNotNone(d)
        assert d is not None
        self.assertIn("PROVIDER_REVIEW_PENDING_SLA", d.related_engine_codes)

    def test_public_dicts_roundtrip(self):
        rows = definitions_as_public_dicts()
        self.assertEqual(len(rows), len(all_escalation_codes()))
        self.assertTrue(all("operational_meaning_nl" in r for r in rows))
