from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from contracts.models import Organization


class CheckIntakeRegionCoverageCommandTests(TestCase):
    def test_slug_reports_organization_section(self):
        Organization.objects.create(name="Coverage Cmd Org", slug="coverage-cmd-org")

        out = StringIO()
        err = StringIO()
        call_command("check_intake_region_coverage", slug="coverage-cmd-org", stdout=out, stderr=err)

        body = out.getvalue()
        self.assertIn("coverage-cmd-org", body)
        self.assertIn("GEMEENTELIJK", body)
