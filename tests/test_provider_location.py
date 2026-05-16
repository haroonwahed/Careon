from django.test import TestCase

from contracts.models import (
    AanbiederVestiging,
    Client,
    ContractRelatie,
    Organization,
    ProviderProfile,
    Zorgaanbieder,
)
from contracts.provider_location import (
    COORDINATE_SOURCE_CITY_ESTIMATE,
    COORDINATE_SOURCE_GEOCODE,
    provider_location_payload,
)


class ProviderLocationPayloadTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name='Test Org', slug='test-org')
        self.client_org = Client.objects.create(
            organization=self.organization,
            name='Zorg A',
            client_type=Client.ClientType.CORPORATION,
            city='Utrecht',
        )
        self.profile = ProviderProfile.objects.create(
            client=self.client_org,
            current_capacity=2,
            max_capacity=5,
        )
        self.zorgaanbieder = Zorgaanbieder.objects.create(name='Zorg A')
        ContractRelatie.objects.create(
            zorgaanbieder=self.zorgaanbieder,
            organization=self.organization,
            status=ContractRelatie.ContractStatus.ACTIEF,
        )

    def test_uses_vestiging_geocode_coordinates(self):
        AanbiederVestiging.objects.create(
            zorgaanbieder=self.zorgaanbieder,
            city='Utrecht',
            latitude=52.09,
            longitude=5.12,
            coordinate_source='geocode_pdok',
            is_primary=True,
            is_active=True,
        )
        payload = provider_location_payload(self.profile)
        self.assertTrue(payload['has_coordinates'])
        self.assertEqual(payload['coordinate_source'], COORDINATE_SOURCE_GEOCODE)
        self.assertEqual(payload['latitude'], 52.09)

    def test_city_estimate_when_no_coordinates(self):
        payload = provider_location_payload(self.profile)
        self.assertFalse(payload['has_coordinates'])
        self.assertEqual(payload['coordinate_source'], COORDINATE_SOURCE_CITY_ESTIMATE)
