from django.test import TestCase

from contracts.forms import RegionalConfigurationForm
from contracts.models import MunicipalityConfiguration, Organization, RegionType


class RegionalConfigurationIntegrityTests(TestCase):
    def test_municipal_mirror_region_form_is_rejected(self):
        organization = Organization.objects.create(name="Integrity Org", slug="integrity-org")
        municipality = MunicipalityConfiguration.objects.create(
            organization=organization,
            municipality_name="Utrecht",
            municipality_code="GM-UTRECHT",
            status=MunicipalityConfiguration.Status.ACTIVE,
        )

        form = RegionalConfigurationForm(
            data={
                "region_type": RegionType.GEMEENTELIJK,
                "region_name": "Utrecht",
                "region_code": "GM-UTRECHT",
                "status": "ACTIVE",
                "served_municipalities": [str(municipality.pk)],
            },
        )

        self.assertFalse(form.is_valid())
        self.assertIn("gemeentelijke spiegelregio", str(form.non_field_errors()).lower())
