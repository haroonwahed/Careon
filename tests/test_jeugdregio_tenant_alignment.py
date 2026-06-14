from __future__ import annotations

import json
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from contracts.models import MunicipalityConfiguration, Organization, RegionalConfiguration, RegionType


class JeugdregioTenantAlignmentTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Tenant Org", slug="tenant-org", is_active=True)

    def _create_municipality_and_region(self, *, municipality_name: str, municipality_code: str):
        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name=municipality_name,
            municipality_code=municipality_code,
            status=MunicipalityConfiguration.Status.ACTIVE,
        )
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.JEUGDREGIO,
            region_name="Haaglanden",
            region_code="JRG-HAA",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        region.served_municipalities.add(municipality)
        return municipality, region

    def test_alignment_reports_partial_when_existing_code_is_synthetic(self):
        self._create_municipality_and_region(municipality_name="Den Haag", municipality_code="DEMO-DHG")

        out = StringIO()
        call_command(
            "check_jeugdregio_tenant_alignment",
            slug="tenant-org",
            json=True,
            stdout=out,
            verbosity=0,
        )

        payload = json.loads(out.getvalue())
        self.assertEqual(payload["summary"]["municipality_total"], 1)
        self.assertEqual(payload["summary"]["partially_mapped"], 1)
        self.assertEqual(payload["summary"]["ready"], 0)
        self.assertEqual(payload["summary"]["blocked"], 0)
        self.assertEqual(payload["summary"]["code_mismatches"], 1)
        org_payload = payload["organizations"][0]
        municipality_payload = org_payload["municipalities"][0]
        self.assertEqual(municipality_payload["status"], "PARTIALLY_MAPPED")
        self.assertEqual(municipality_payload["expected_region"]["region_name"], "Haaglanden")

    def test_alignment_reports_ready_when_code_matches_snapshot(self):
        self._create_municipality_and_region(municipality_name="Den Haag", municipality_code="GM-DENHAAG")

        out = StringIO()
        call_command(
            "check_jeugdregio_tenant_alignment",
            slug="tenant-org",
            json=True,
            stdout=out,
            verbosity=0,
        )

        payload = json.loads(out.getvalue())
        self.assertEqual(payload["summary"]["municipality_total"], 1)
        self.assertEqual(payload["summary"]["ready"], 1)
        self.assertEqual(payload["summary"]["partially_mapped"], 0)
        self.assertEqual(payload["summary"]["blocked"], 0)
