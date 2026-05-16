from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, override_settings

from contracts.geocoding import (
    GeocodeResult,
    _format_vestiging_query,
    geocode_with_google,
    geocode_with_pdok,
    google_maps_directions_url,
)


class GeocodingHelpersTests(SimpleTestCase):
    def test_format_vestiging_query(self):
        vestiging = MagicMock(
            straat='Keizersgracht',
            huisnummer='1',
            address='',
            postcode='1015',
            city='Amsterdam',
            gemeente='',
        )
        self.assertEqual(_format_vestiging_query(vestiging), 'Keizersgracht 1, 1015, Amsterdam')

    def test_google_maps_directions_url(self):
        url = google_maps_directions_url(latitude=52.1, longitude=5.1, label='Test')
        self.assertIn('google.com/maps/dir', url)
        self.assertIn('52.1', url)


class GeocodeProviderTests(SimpleTestCase):
    @patch('contracts.geocoding.requests.get')
    def test_geocode_with_pdok_parses_point(self, mock_get):
        mock_get.return_value.json.return_value = {
            'response': {
                'docs': [
                    {
                        'centroide_ll': 'POINT(4.9041 52.3676)',
                        'weergavenaam': 'Amsterdam',
                    }
                ]
            }
        }
        mock_get.return_value.raise_for_status = MagicMock()

        result = geocode_with_pdok('Keizersgracht 1, Amsterdam')
        self.assertIsNotNone(result)
        self.assertEqual(result.provider, 'geocode_pdok')
        self.assertEqual(result.latitude, 52.3676)
        self.assertEqual(result.longitude, 4.9041)

    @override_settings(GOOGLE_GEOCODING_API_KEY='test-key')
    @patch('contracts.geocoding.requests.get')
    def test_geocode_with_google_success(self, mock_get):
        mock_get.return_value.json.return_value = {
            'status': 'OK',
            'results': [
                {
                    'formatted_address': 'Amsterdam',
                    'geometry': {'location': {'lat': 52.37, 'lng': 4.9}},
                }
            ],
        }
        mock_get.return_value.raise_for_status = MagicMock()

        result = geocode_with_google('Amsterdam', api_key='test-key')
        self.assertIsNotNone(result)
        self.assertEqual(result.provider, 'geocode_google')
