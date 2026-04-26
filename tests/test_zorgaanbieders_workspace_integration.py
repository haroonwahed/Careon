from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    ProviderProfile,
    RegionalConfiguration,
    TrustAccount,
)


User = get_user_model()


class ZorgaanbiedersWorkspaceIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="providers-workspace-user",
            email="providers-workspace@example.com",
            password="testpass123",
        )
        cls.organization = Organization.objects.create(name="Providers Workspace Org", slug="providers-workspace-org")
        OrganizationMembership.objects.create(
            organization=cls.organization,
            user=cls.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        cls.region = RegionalConfiguration.objects.create(
            organization=cls.organization,
            region_name="Amsterdam",
            region_type="GEMEENTELIJK",
        )

    def setUp(self):
        self.client = Client()
        self.client.login(username="providers-workspace-user", password="testpass123")

    def _create_provider(self, name, *, status=CareProvider.Status.ACTIVE, industry="Jeugdzorg"):
        return CareProvider.objects.create(
            organization=self.organization,
            name=name,
            status=status,
            client_type=CareProvider.ClientType.CORPORATION,
            industry=industry,
            email=f"{name.lower().replace(' ', '-')}@example.com",
            created_by=self.user,
        )

    def _create_profile(
        self,
        provider,
        *,
        current_capacity=0,
        max_capacity=0,
        average_wait_days=0,
        waiting_list_length=0,
        offers_outpatient=True,
        offers_residential=False,
        offers_crisis=False,
        attach_region=True,
    ):
        profile = ProviderProfile.objects.create(
            client=provider,
            current_capacity=current_capacity,
            max_capacity=max_capacity,
            average_wait_days=average_wait_days,
            waiting_list_length=waiting_list_length,
            offers_outpatient=offers_outpatient,
            offers_residential=offers_residential,
            offers_crisis=offers_crisis,
        )
        if attach_region:
            profile.served_regions.add(self.region)
        return profile

    def _create_wait_entry(self, provider, *, wait_days, open_slots, waiting_list_size):
        return TrustAccount.objects.create(
            provider=provider,
            region=self.region.region_name,
            wait_days=wait_days,
            open_slots=open_slots,
            waiting_list_size=waiting_list_size,
            created_by=self.user,
        )

    def test_low_medium_workspace_distinguishes_capacity_and_wait_without_command_ui(self):
        full_provider = self._create_provider("Volle Horizon")
        self._create_profile(
            full_provider,
            current_capacity=0,
            max_capacity=4,
            average_wait_days=28,
            waiting_list_length=12,
            offers_residential=True,
        )
        self._create_wait_entry(full_provider, wait_days=28, open_slots=0, waiting_list_size=12)

        available_provider = self._create_provider("Open Horizon")
        self._create_profile(
            available_provider,
            current_capacity=3,
            max_capacity=6,
            average_wait_days=5,
            waiting_list_length=1,
            offers_crisis=True,
        )
        self._create_wait_entry(available_provider, wait_days=5, open_slots=3, waiting_list_size=1)

        response = self.client.get(reverse("careon:client_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Capaciteit op")
        self.assertContains(response, "Wachtdruk hoog")
        self.assertContains(response, "Ruimte beschikbaar")
        self.assertContains(response, "Wachtdruk beheersbaar")
        self.assertNotContains(response, "rgk-command-bar")
        self.assertNotContains(response, "casus-operational-strip")
        self.assertNotContains(response, "assessment-operational-strip")
        self.assertNotContains(response, "placement-operational-strip")

        html = response.content.decode("utf-8")
        self.assertLessEqual(html.count("provider-workspace__summary-note"), 1)

    def test_partial_states_render_safely_when_profile_or_wait_data_is_missing(self):
        self._create_provider("Onvolledig Profiel")

        partial_provider = self._create_provider("Zonder Wachttijd")
        self._create_profile(
            partial_provider,
            current_capacity=1,
            max_capacity=4,
            average_wait_days=0,
            waiting_list_length=0,
            offers_outpatient=False,
            attach_region=False,
        )

        response = self.client.get(reverse("careon:client_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Profiel aanvullen")
        self.assertContains(response, "Geen wachttijddata")
        self.assertContains(response, "Zorgvormen nog niet ingesteld")

    def test_empty_state_is_safe_and_calm(self):
        response = self.client.get(reverse("careon:client_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Nog geen zorgaanbieders ingericht")
        self.assertContains(response, "Aanbieder toevoegen")
        self.assertNotContains(response, "rgk-command-bar")
        self.assertNotContains(response, "priority-rank")

    def test_filters_and_pagination_keep_query_state(self):
        for index in range(26):
            provider = self._create_provider(f"Filter Provider {index}")
            profile = self._create_profile(
                provider,
                current_capacity=2,
                max_capacity=5,
                average_wait_days=6,
                waiting_list_length=1,
                offers_crisis=True,
            )
            profile.target_age_12_18 = True
            profile.save(update_fields=["target_age_12_18"])
            profile.served_regions.set([self.region])

        response_page1 = self.client.get(
            reverse("careon:client_list"),
            {
                "q": "Filter Provider",
                "status": "ACTIVE",
                "region_type": self.region.region_type,
                "region": str(self.region.pk),
                "care_form": "CRISIS",
                "age_band": "12_18",
            },
        )
        response_page2 = self.client.get(
            reverse("careon:client_list"),
            {
                "q": "Filter Provider",
                "status": "ACTIVE",
                "region_type": self.region.region_type,
                "region": str(self.region.pk),
                "care_form": "CRISIS",
                "age_band": "12_18",
                "page": "2",
            },
        )

        self.assertEqual(response_page1.status_code, 200)
        self.assertEqual(response_page2.status_code, 200)
        self.assertEqual(
            response_page1.context["pagination_query"],
            f"q=Filter+Provider&status=ACTIVE&region_type={self.region.region_type}&region={self.region.pk}&care_form=CRISIS&age_band=12_18",
        )
        self.assertEqual(response_page1.context["search_query"], "Filter Provider")
        self.assertEqual(response_page1.context["selected_status"], "ACTIVE")
        self.assertEqual(response_page1.context["selected_region_type"], self.region.region_type)
        self.assertEqual(response_page1.context["selected_region"], str(self.region.pk))
        self.assertEqual(response_page1.context["selected_care_form"], "CRISIS")
        self.assertEqual(response_page1.context["selected_age_band"], "12_18")
        self.assertContains(
            response_page1,
            f'?q=Filter+Provider&amp;status=ACTIVE&amp;region_type={self.region.region_type}&amp;region={self.region.pk}&amp;care_form=CRISIS&amp;age_band=12_18&amp;page=2',
            html=False,
        )

    def test_client_detail_view_populates_edit_action_and_match_signals(self):
        provider = self._create_provider("Signal Provider")
        profile = self._create_profile(
            provider,
            current_capacity=2,
            max_capacity=6,
            average_wait_days=8,
            waiting_list_length=2,
            offers_outpatient=True,
            offers_crisis=False,
        )
        profile.target_age_12_18 = True
        profile.save(update_fields=["target_age_12_18"])

        response = self.client.get(reverse("careon:client_detail", kwargs={"pk": provider.pk}))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f'href="/care/clients/{provider.pk}/edit/"', html=False)
        self.assertContains(response, "Matchingsignalen")
        self.assertContains(response, "Zorgvormen")
