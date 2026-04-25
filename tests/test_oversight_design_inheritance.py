"""
Tests for Gemeenten / Zorgregio oversight workspace design inheritance.
Validates MEDIUM intensity design patterns: aggregated signals, calm strategic framing,
no command bars, no case-level triage, safe empty/partial states.
"""
from django.test import TestCase, Client as TestClient
from django.urls import reverse
from django.contrib.auth import get_user_model

from contracts.models import (
    Organization,
    OrganizationMembership,
    MunicipalityConfiguration,
    RegionalConfiguration,
    Client,
    ProviderProfile,
)
from contracts.oversight_workspace import (
    build_municipality_list_summary,
    build_municipality_detail_summary,
    build_regional_list_summary,
    build_regional_detail_summary,
)

User = get_user_model()


class OversightDesignInheritanceTests(TestCase):
    """Validate MEDIUM-intensity design constraints for oversight pages."""

    def setUp(self):
        self.org = Organization.objects.create(name="Test Org", slug="test-org")
        self.user = User.objects.create_user(
            username="oversightuser", password="testpass", email="oversight@example.com"
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

        self.municipality_a = MunicipalityConfiguration.objects.create(
            organization=self.org,
            municipality_name="Gemeente Amsterdam",
            municipality_code="0363",
            status="ACTIVE",
            max_wait_days=42,
        )
        self.municipality_b = MunicipalityConfiguration.objects.create(
            organization=self.org,
            municipality_name="Gemeente Utrecht",
            municipality_code="0344",
            status="ACTIVE",
            max_wait_days=None,  # Missing norm
        )
        self.municipality_c = MunicipalityConfiguration.objects.create(
            organization=self.org,
            municipality_name="Gemeente Rotterdam",
            municipality_code="0599",
            status="ACTIVE",
            max_wait_days=None,  # Missing norm
        )
        self.region = RegionalConfiguration.objects.create(
            organization=self.org,
            region_name="Regio Noord-Holland",
            region_code="NH",
            status="ACTIVE",
        )
        self.region.served_municipalities.set(
            [self.municipality_a, self.municipality_b, self.municipality_c]
        )

        # Provider with capacity pressure
        self.provider = Client.objects.create(
            name="Aanbieder X",
            email="x@example.com",
            client_type="PROVIDER",
            status="ACTIVE",
            organization=self.org,
        )
        ProviderProfile.objects.create(
            client=self.provider,
            max_capacity=10,
            current_capacity=9,  # 90% — under pressure
            average_wait_days=20,
        )
        self.municipality_a.linked_providers.add(self.provider)
        self.region.linked_providers.add(self.provider)

        self.client = TestClient()
        self.client.login(username="oversightuser", password="testpass")

    # ------------------------------------------------------------------
    # Data provider — municipality list summary
    # ------------------------------------------------------------------

    def test_municipality_list_summary_detects_missing_norms(self):
        qs = MunicipalityConfiguration.objects.filter(organization=self.org).prefetch_related(
            "linked_providers"
        )
        summary = build_municipality_list_summary(qs)
        self.assertEqual(summary["missing_norm_count"], 2)

    def test_municipality_list_summary_shows_signal_when_many_norms_missing(self):
        # Create a third municipality without norm to cross the threshold (>=3)
        MunicipalityConfiguration.objects.create(
            organization=self.org,
            municipality_name="Gemeente Leiden",
            municipality_code="0546",
            status="ACTIVE",
            max_wait_days=None,
        )
        qs = MunicipalityConfiguration.objects.filter(organization=self.org).prefetch_related(
            "linked_providers"
        )
        summary = build_municipality_list_summary(qs)
        self.assertIsNotNone(summary["pressure_signal"])
        self.assertEqual(summary["pressure_signal"]["tone"], "warning")

    def test_municipality_list_summary_empty_state_is_safe(self):
        summary = build_municipality_list_summary(MunicipalityConfiguration.objects.none())
        self.assertEqual(summary["total"], 0)
        self.assertIsNone(summary["pressure_signal"])

    # ------------------------------------------------------------------
    # Data provider — municipality detail summary
    # ------------------------------------------------------------------

    def test_municipality_detail_summary_generates_pressure_fields(self):
        summary = build_municipality_detail_summary(self.municipality_a)
        self.assertIn("capacity_pressure", summary)
        self.assertIn("wait_pressure", summary)
        self.assertIn("context_strip", summary)
        self.assertIn("wait_norm_risk", summary)

    def test_municipality_detail_summary_detects_capacity_pressure(self):
        summary = build_municipality_detail_summary(self.municipality_a)
        # Provider at 90% capacity — should register as warning or critical
        self.assertIn(summary["capacity_pressure"]["tone"], ("warning", "critical"))

    def test_municipality_detail_summary_no_providers_is_safe(self):
        summary = build_municipality_detail_summary(self.municipality_b)
        # No providers linked — should not crash and should return neutral
        self.assertIn(summary["capacity_pressure"]["tone"], ("neutral",))

    def test_municipality_detail_norm_risk_flagged_when_missing(self):
        summary = build_municipality_detail_summary(self.municipality_b)
        self.assertTrue(summary["wait_norm_risk"])

    def test_municipality_detail_norm_risk_clear_when_set(self):
        summary = build_municipality_detail_summary(self.municipality_a)
        self.assertFalse(summary["wait_norm_risk"])

    # ------------------------------------------------------------------
    # Data provider — regional list summary
    # ------------------------------------------------------------------

    def test_regional_list_summary_detects_empty_regions(self):
        # Region with no municipalities
        RegionalConfiguration.objects.create(
            organization=self.org,
            region_name="Lege Regio",
            region_code="LR",
            status="ACTIVE",
        )
        qs = RegionalConfiguration.objects.filter(organization=self.org).prefetch_related(
            "linked_providers", "served_municipalities"
        )
        summary = build_regional_list_summary(qs)
        self.assertGreaterEqual(summary["empty_region_count"], 1)

    def test_regional_list_summary_shows_signal_when_many_empty(self):
        RegionalConfiguration.objects.create(
            organization=self.org, region_name="Lege A", region_code="LA", status="ACTIVE"
        )
        RegionalConfiguration.objects.create(
            organization=self.org, region_name="Lege B", region_code="LB", status="ACTIVE"
        )
        qs = RegionalConfiguration.objects.filter(organization=self.org).prefetch_related(
            "linked_providers", "served_municipalities"
        )
        summary = build_regional_list_summary(qs)
        self.assertIsNotNone(summary["pressure_signal"])
        self.assertEqual(summary["pressure_signal"]["tone"], "warning")

    def test_regional_list_summary_empty_state_is_safe(self):
        summary = build_regional_list_summary(RegionalConfiguration.objects.none())
        self.assertEqual(summary["total"], 0)
        self.assertIsNone(summary["pressure_signal"])

    # ------------------------------------------------------------------
    # Data provider — regional detail summary
    # ------------------------------------------------------------------

    def test_regional_detail_summary_generates_pressure_fields(self):
        summary = build_regional_detail_summary(self.region)
        self.assertIn("capacity_pressure", summary)
        self.assertIn("wait_pressure", summary)
        self.assertIn("context_strip", summary)
        self.assertIn("missing_norm_count", summary)
        self.assertIn("total_municipality_count", summary)

    def test_regional_detail_summary_counts_missing_norms(self):
        summary = build_regional_detail_summary(self.region)
        self.assertEqual(summary["missing_norm_count"], 2)
        self.assertEqual(summary["total_municipality_count"], 3)

    def test_regional_detail_summary_context_strip_shown_on_pressure(self):
        summary = build_regional_detail_summary(self.region)
        # Region has provider at 90% — should show a context strip
        self.assertIsNotNone(summary["context_strip"])

    # ------------------------------------------------------------------
    # Design constraints — no command-center drift
    # ------------------------------------------------------------------

    def test_municipality_list_summary_has_no_tactical_urgency_fields(self):
        qs = MunicipalityConfiguration.objects.filter(organization=self.org).prefetch_related(
            "linked_providers"
        )
        summary = build_municipality_list_summary(qs)
        # Must not contain command-center fields from Regiekamer or Casussen
        self.assertNotIn("recommended_action", summary)
        self.assertNotIn("triage_band", summary)
        self.assertNotIn("priority_rank", summary)
        self.assertNotIn("escalation_recommendation", summary)

    def test_regional_detail_summary_has_no_tactical_urgency_fields(self):
        summary = build_regional_detail_summary(self.region)
        self.assertNotIn("recommended_action", summary)
        self.assertNotIn("triage_band", summary)
        self.assertNotIn("priority_rank", summary)

    def test_context_strip_tone_is_limited_to_warning_critical_neutral(self):
        summary = build_municipality_detail_summary(self.municipality_a)
        strip = summary.get("context_strip")
        if strip is not None:
            self.assertIn(strip["tone"], ("warning", "critical", "neutral"))

    def test_pressure_signal_tone_is_warning_not_command(self):
        """Signal tone must never be 'action-required' or 'escalate' — MEDIUM intensity only."""
        qs = MunicipalityConfiguration.objects.filter(organization=self.org).prefetch_related(
            "linked_providers"
        )
        summary = build_municipality_list_summary(qs)
        if summary["pressure_signal"]:
            self.assertIn(summary["pressure_signal"]["tone"], ("warning", "critical"))
            # No command words in message
            msg = summary["pressure_signal"]["message"].lower()
            for forbidden in ["escaleer", "direct actie", "verplicht", "actiepunt"]:
                self.assertNotIn(forbidden, msg)

    # ------------------------------------------------------------------
    # View integration tests
    # ------------------------------------------------------------------

    def test_municipality_list_view_returns_200(self):
        url = reverse("careon:municipality_list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_municipality_list_view_has_list_summary_context(self):
        url = reverse("careon:municipality_list")
        response = self.client.get(url)
        self.assertIn("list_summary", response.context)

    def test_municipality_detail_view_returns_200(self):
        url = reverse("careon:municipality_detail", kwargs={"pk": self.municipality_a.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Regiekamer")

    def test_municipality_detail_view_has_oversight_summary_context(self):
        url = reverse("careon:municipality_detail", kwargs={"pk": self.municipality_a.pk})
        response = self.client.get(url)
        self.assertIn("oversight_summary", response.context)

    def test_regional_list_view_returns_200(self):
        url = reverse("careon:regional_list")
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_regional_list_view_has_regional_list_summary_context(self):
        url = reverse("careon:regional_list")
        response = self.client.get(url)
        self.assertIn("regional_list_summary", response.context)

    def test_regional_detail_view_returns_200(self):
        url = reverse("careon:regional_detail", kwargs={"pk": self.region.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Regiekamer")

    def test_regional_detail_view_has_oversight_summary_context(self):
        url = reverse("careon:regional_detail", kwargs={"pk": self.region.pk})
        response = self.client.get(url)
        self.assertIn("oversight_summary", response.context)

    # ------------------------------------------------------------------
    # Empty / partial state safety
    # ------------------------------------------------------------------

    def test_municipality_with_no_providers_does_not_crash(self):
        empty = MunicipalityConfiguration.objects.create(
            organization=self.org,
            municipality_name="Lege Gemeente",
            municipality_code="0000",
            status="ACTIVE",
        )
        summary = build_municipality_detail_summary(empty)
        self.assertIsNotNone(summary)

    def test_region_with_no_providers_and_no_municipalities_does_not_crash(self):
        empty = RegionalConfiguration.objects.create(
            organization=self.org,
            region_name="Lege Regio",
            region_code="00",
            status="ACTIVE",
        )
        summary = build_regional_detail_summary(empty)
        self.assertIsNotNone(summary)
        self.assertEqual(summary["total_municipality_count"], 0)
        self.assertEqual(summary["missing_norm_count"], 0)
