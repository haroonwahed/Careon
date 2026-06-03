from __future__ import annotations

from django.test import TestCase
from django.urls import reverse

from contracts.models import RegionalConfiguration
from contracts.management.commands.seed_demo_data import DEMO_EMAIL, DEMO_PASSWORD


class RegionOverviewApiTests(TestCase):
    def setUp(self):
        from django.core.management import call_command

        call_command("seed_demo_data", reset=True, locked_time=True, verbosity=0)
        call_command("seed_jeugdregio_backbone", verbosity=0)

        logged_in = self.client.login(username=DEMO_EMAIL, password=DEMO_PASSWORD)
        self.assertTrue(logged_in)

    def test_regions_api_can_scope_to_youth_regions_only(self):
        response = self.client.get(
            reverse("careon:regions_api"),
            {"region_type": "JEUGDREGIO", "page_size": 500},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        regions = payload["regions"]

        self.assertGreater(len(regions), 0)
        self.assertTrue(all(region["regionType"] == "JEUGDREGIO" for region in regions))
        self.assertEqual(payload["total_count"], len(regions))
        self.assertEqual(
            payload["total_count"],
            RegionalConfiguration.objects.filter(
                organization__slug="gemeente-demo",
                status=RegionalConfiguration.Status.ACTIVE,
                region_type="JEUGDREGIO",
            ).count(),
        )
