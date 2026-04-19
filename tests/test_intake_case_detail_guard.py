import json

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from contracts.api.views import case_detail_api
from contracts.models import Organization, OrganizationMembership


User = get_user_model()


class CaseDetailApiGuardTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username="guard-owner",
            password="testpass123",
            email="guard-owner@example.com",
        )
        organization = Organization.objects.create(name="Guard Org", slug="guard-org")
        OrganizationMembership.objects.create(
            organization=organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

    def test_case_detail_rejects_non_numeric_identifier(self):
        request = self.factory.get("/care/api/cases/intake-form/")
        request.user = self.user

        response = case_detail_api(request, case_id="intake-form")

        self.assertEqual(response.status_code, 404)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload.get("error"), "Casus niet gevonden")

    def test_case_detail_string_route_returns_404(self):
        self.client.login(username="guard-owner", password="testpass123")

        response = self.client.get("/care/api/cases/intake-form/")

        # intake-form is handled by dedicated endpoint and must not be treated as case id.
        self.assertEqual(response.status_code, 200)

        response_non_numeric = self.client.get("/care/api/cases/not-a-number/")
        self.assertEqual(response_non_numeric.status_code, 404)
        payload = json.loads(response_non_numeric.content.decode("utf-8"))
        self.assertEqual(payload.get("error"), "Casus niet gevonden")
