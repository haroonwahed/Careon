from django.test import Client, TestCase


class OperationalObservabilityMiddlewareTests(TestCase):
    def test_correlation_id_header_on_health(self):
        client = Client()
        response = client.get("/_health/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers.get("X-Request-ID"))

    def test_inbound_request_id_echoed_when_safe(self):
        client = Client()
        rid = "pilot-trace-abc-123"
        response = client.get("/_health/", HTTP_X_REQUEST_ID=rid)
        self.assertEqual(response.headers.get("X-Request-ID"), rid)
