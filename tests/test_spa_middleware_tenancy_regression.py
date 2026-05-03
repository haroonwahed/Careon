"""Guards: SPA shell vs legacy Django 404, and API cross-tenant behavior."""

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from contracts.models import CareCase, Client as CareProvider, Organization, OrganizationMembership
from tests.test_utils import middleware_without_spa_shell

User = get_user_model()


class SpaMiddlewarePkRoutingTests(TestCase):
    """Numeric /care/ routes outside pilot dossier prefixes must hit Django views."""

    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name="MW Org", slug="mw-org")
        self.user = User.objects.create_user(username="mw_user", password="pass12345!")
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.org,
            name="MW Provider",
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.client.login(username="mw_user", password="pass12345!")

    def test_other_org_provider_detail_returns_404_not_spa_shell(self):
        other_org = Organization.objects.create(name="Other Org", slug="other-org")
        other_user = User.objects.create_user(username="other_u", password="pass12345!")
        OrganizationMembership.objects.create(
            organization=other_org,
            user=other_user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        foreign = CareProvider.objects.create(
            organization=other_org,
            name="Foreign",
            status=CareProvider.Status.ACTIVE,
            created_by=other_user,
        )
        url = reverse("careon:client_detail", kwargs={"pk": foreign.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)
        self.assertNotEqual(response.get("X-Careon-Ui-Surface"), "spa")


@override_settings(MIDDLEWARE=middleware_without_spa_shell())
class SpaPilotDossierShellTests(TestCase):
    """Without SPA middleware, casussen list renders Django HTML (legacy HTML tests only)."""

    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name="Shell Org", slug="shell-org")
        self.user = User.objects.create_user(username="shell_u", password="pass12345!")
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username="shell_u", password="pass12345!")

    def test_case_list_renders_django_when_middleware_disabled(self):
        response = self.client.get(reverse("careon:case_list"))
        self.assertEqual(response.status_code, 200)
        body = response.content.decode("utf-8")
        # base.html may include a hidden #root for hybrid shells; assert real list chrome.
        self.assertIn("Werkvoorraad", body)
        self.assertNotIn("SaaS Careon", body)


class CaseDetailApiTenancyTests(TestCase):
    """API remains authoritative for pilot dossier access control."""

    def setUp(self):
        self.client = Client()
        self.org_a = Organization.objects.create(name="TA Org A", slug="ta-org-a")
        self.org_b = Organization.objects.create(name="TA Org B", slug="ta-org-b")
        self.user_a = User.objects.create_user(username="ta_a", password="pass12345!")
        self.user_b = User.objects.create_user(username="ta_b", password="pass12345!")
        OrganizationMembership.objects.create(
            organization=self.org_a,
            user=self.user_a,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.org_b,
            user=self.user_b,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.case_a = CareCase.objects.create(
            organization=self.org_a,
            title="TA Case",
            contract_type="NDA",
            status="ACTIVE",
            created_by=self.user_a,
        )

    def test_case_detail_api_returns_404_cross_org(self):
        self.client.login(username="ta_b", password="pass12345!")
        url = reverse("careon:case_detail_api", kwargs={"case_id": self.case_a.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json().get("error"), "Casus niet gevonden")
