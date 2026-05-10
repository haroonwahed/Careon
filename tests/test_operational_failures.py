"""Structured operational 5xx payloads for /care/api (calm, action-led)."""

from django.test import RequestFactory, SimpleTestCase

from contracts.operational_failures import build_operational_failure_payload


class OperationalFailurePayloadTests(SimpleTestCase):
    def test_regiekamer_aggregation_shape(self):
        req = RequestFactory().get("/care/api/regiekamer/decision-overview/")
        req.correlation_id = "req-abc"
        p = build_operational_failure_payload(req, context="regiekamer_decision_overview_api_failed")
        self.assertEqual(p["code"], "REGIEKAMER_AGGREGATION_FAILURE")
        self.assertIn("Regiekamer", p["message"])
        self.assertIn("organisatiecontext", p["next_best_action"])
        self.assertEqual(p["request_id"], "req-abc")
        self.assertEqual(p["error"], p["message"])

    def test_unknown_context_uses_default(self):
        req = RequestFactory().get("/care/api/x/")
        p = build_operational_failure_payload(req, context="unknown_api_context")
        self.assertEqual(p["code"], "OPERATIONAL_FAILURE")
        self.assertIn("request_id", p["next_best_action"])
