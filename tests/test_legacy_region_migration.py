from __future__ import annotations

import json
from datetime import date, timedelta
from io import StringIO

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from contracts.models import CaseIntakeProcess, MunicipalityConfiguration, Organization, RegionalConfiguration, RegionType


class LegacyRegionMigrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="legacy-admin", password="testpass123")
        self.organization = Organization.objects.create(name="Legacy Org", slug="legacy-org")
        self.municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name="Utrecht",
            municipality_code="GM-UTRECHT",
            status=MunicipalityConfiguration.Status.ACTIVE,
        )
        self.youth_region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.JEUGDREGIO,
            region_name="Utrecht Stad",
            region_code="JRG-UTR",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        self.youth_region.served_municipalities.add(self.municipality)

    def _make_case(self, region: RegionalConfiguration) -> CaseIntakeProcess:
        case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Legacy intake",
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            gemeente=self.municipality,
            preferred_region=region,
            preferred_region_type=region.region_type,
            regio=region,
        )
        CaseIntakeProcess.objects.filter(pk=case.pk).update(
            gemeente=None,
            herkomst_gemeente=None,
            verantwoordelijke_gemeente=None,
            verblijfsgemeente=None,
            zorgregio=None,
            plaatsingsregio=None,
            contractregio=None,
            escalatie_regio=None,
            regio_id=region.id,
            preferred_region_id=region.id,
            preferred_region_type=RegionType.GEMEENTELIJK,
        )
        return case

    def test_audit_reports_classifications_and_json(self):
        mirror = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.GEMEENTELIJK,
            region_name="Utrecht Regio",
            region_code="LEGACY-UTR",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        mirror.served_municipalities.add(self.municipality)
        ambiguous = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.GEMEENTELIJK,
            region_name="Amsterdam Regio",
            region_code="LEGACY-AMS",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        ambiguous.served_municipalities.add(self.municipality)
        ambiguous_without_links = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.GEMEENTELIJK,
            region_name="Rotterdam Regio",
            region_code="LEGACY-ROT",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        orphaned = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.GEMEENTELIJK,
            region_name="Amsterdam (gemeentelijk)",
            region_code="SYS-CAT-GEM-AMS",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        self._make_case(mirror)
        self._make_case(ambiguous)

        out = StringIO()
        call_command(
            "audit_legacy_gemeentelijk_regions",
            slug="legacy-org",
            json=True,
            stdout=out,
            verbosity=0,
        )

        payload = json.loads(out.getvalue())
        org_payload = next(item for item in payload["organizations"] if item["organization_slug"] == "legacy-org")
        mirror_row = next(row for row in org_payload["regions"] if row["legacy_region_id"] == mirror.id)
        self.assertEqual(mirror_row["municipality_id"], self.municipality.id)
        self.assertEqual(mirror_row["youth_region_id"], self.youth_region.id)
        ambiguous_row = next(row for row in org_payload["regions"] if row["legacy_region_id"] == ambiguous.id)
        self.assertEqual(ambiguous_row["classification"], "AMBIGUOUS")
        ambiguous_no_link_row = next(row for row in org_payload["regions"] if row["legacy_region_id"] == ambiguous_without_links.id)
        self.assertEqual(ambiguous_no_link_row["classification"], "AMBIGUOUS")
        self.assertIsNone(ambiguous_no_link_row["municipality_id"])
        orphan_row = next(row for row in org_payload["regions"] if row["legacy_region_id"] == orphaned.id)
        self.assertEqual(orphan_row["classification"], "ORPHANED")

    def test_backfill_fills_municipality_and_youth_region_without_overwriting_legacy_fields(self):
        mirror = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.GEMEENTELIJK,
            region_name="Utrecht Spiegel",
            region_code="LEGACY-UTR",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        mirror.served_municipalities.add(self.municipality)
        case = self._make_case(mirror)
        case.refresh_from_db()
        self.assertEqual(case.regio_id, mirror.id)
        self.assertEqual(case.preferred_region_id, mirror.id)

        out = StringIO()
        call_command(
            "backfill_legacy_gemeentelijk_regions",
            slug="legacy-org",
            apply=True,
            stdout=out,
            verbosity=0,
        )

        case.refresh_from_db()
        self.assertEqual(case.gemeente_id, self.municipality.id)
        self.assertEqual(case.herkomst_gemeente_id, self.municipality.id)
        self.assertEqual(case.verantwoordelijke_gemeente_id, self.municipality.id)
        self.assertEqual(case.verblijfsgemeente_id, self.municipality.id)
        self.assertEqual(case.zorgregio_id, self.youth_region.id)
        self.assertEqual(case.plaatsingsregio_id, self.youth_region.id)
        self.assertEqual(case.contractregio_id, self.youth_region.id)
        self.assertEqual(case.escalatie_regio_id, self.youth_region.id)
        self.assertEqual(case.regio_id, mirror.id)
        self.assertEqual(case.preferred_region_id, mirror.id)
        self.assertIn("Backfill summary", out.getvalue())
        self.assertIn("updated_cases=1", out.getvalue())

        second_run = StringIO()
        call_command(
            "backfill_legacy_gemeentelijk_regions",
            slug="legacy-org",
            apply=True,
            stdout=second_run,
            verbosity=0,
        )
        case.refresh_from_db()
        self.assertEqual(case.gemeente_id, self.municipality.id)
        self.assertEqual(case.regio_id, mirror.id)

    def test_backfill_partially_maps_when_youth_region_is_missing(self):
        municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name="Almere",
            municipality_code="GM-ALMERE",
            status=MunicipalityConfiguration.Status.ACTIVE,
        )
        mirror = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_type=RegionType.GEMEENTELIJK,
            region_name="Almere Spiegel",
            region_code="LEGACY-ALM",
            status=RegionalConfiguration.Status.ACTIVE,
        )
        mirror.served_municipalities.add(municipality)
        case = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Partial legacy intake",
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            regio=mirror,
            preferred_region=mirror,
            preferred_region_type=RegionType.GEMEENTELIJK,
        )
        CaseIntakeProcess.objects.filter(pk=case.pk).update(
            gemeente=None,
            herkomst_gemeente=None,
            verantwoordelijke_gemeente=None,
            verblijfsgemeente=None,
            zorgregio=None,
            plaatsingsregio=None,
            contractregio=None,
            escalatie_regio=None,
            regio_id=mirror.id,
            preferred_region_id=mirror.id,
            preferred_region_type=RegionType.GEMEENTELIJK,
        )

        out = StringIO()
        call_command(
            "backfill_legacy_gemeentelijk_regions",
            slug="legacy-org",
            apply=True,
            stdout=out,
            verbosity=0,
        )

        case.refresh_from_db()
        self.assertEqual(case.gemeente_id, municipality.id)
        self.assertEqual(case.herkomst_gemeente_id, municipality.id)
        self.assertEqual(case.verantwoordelijke_gemeente_id, municipality.id)
        self.assertEqual(case.verblijfsgemeente_id, municipality.id)
        self.assertIsNone(case.zorgregio_id)
        self.assertIsNone(case.plaatsingsregio_id)
        self.assertIsNone(case.contractregio_id)
        self.assertIsNone(case.escalatie_regio_id)
        self.assertEqual(case.regio_id, mirror.id)
        self.assertEqual(case.preferred_region_id, mirror.id)
        self.assertIn("partial=1", out.getvalue())
        self.assertIn("partial_backfills=1", out.getvalue())
