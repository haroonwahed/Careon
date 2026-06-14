from __future__ import annotations

import json
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from contracts.jeugdregio_reference import build_jeugdregio_manifest, validate_jeugdregio_manifest


class JeugdregioReferenceTests(TestCase):
    def test_manifest_has_locked_snapshot_and_expected_counts(self):
        manifest = build_jeugdregio_manifest()
        report = validate_jeugdregio_manifest(manifest)

        self.assertEqual(manifest["snapshot"]["peildatum"], "2026-06-14")
        self.assertIn("external_source", manifest["snapshot"]["source"])
        self.assertIn("imported_source_copy", manifest["snapshot"]["source"])
        self.assertIn("normalized_careon_snapshot", manifest["snapshot"]["source"])
        self.assertEqual(report["summary"]["region_count"], 41)
        self.assertEqual(report["summary"]["municipality_link_count"], 342)
        self.assertEqual(report["summary"]["regions_without_municipalities"], 7)
        self.assertEqual(report["summary"]["municipalities_without_active_region"], 0)
        self.assertEqual(report["summary"]["duplicate_primary_region_count"], 0)

        empty_regions = [region for region in manifest["regions"] if region["coverage"]["status"] == "ACTIVE_EMPTY"]
        self.assertEqual(len(empty_regions), 7)
        den_haag_links = [link for link in manifest["municipality_links"] if link["municipality_name"] == "Den Haag"]
        self.assertTrue(den_haag_links)
        self.assertEqual(den_haag_links[0]["source_name"], "'s-Gravenhage")

    def test_validation_command_outputs_json(self):
        out = StringIO()
        call_command("check_jeugdregio_reference_data", json=True, stdout=out, verbosity=0)

        payload = json.loads(out.getvalue())
        self.assertEqual(payload["snapshot"]["peildatum"], "2026-06-14")
        self.assertEqual(payload["summary"]["region_count"], 41)
        self.assertEqual(payload["summary"]["municipality_link_count"], 342)
        self.assertEqual(payload["summary"]["regions_without_municipalities"], 7)
