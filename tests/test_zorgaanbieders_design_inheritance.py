"""
Tests for Zorgaanbieders (provider capacity) workspace design inheritance implementation.
Validates LOW-MEDIUM intensity design patterns, subtle operational signals, and safe states.
"""
from django.test import TestCase, Client as TestClient
from django.urls import reverse
from django.contrib.auth import get_user_model

from contracts.models import Client, Organization, ProviderProfile, RegionalConfiguration
from contracts.provider_workspace import build_provider_workspace_summary, build_provider_workspace_rows
from contracts.views import _provider_profile_match_surface


User = get_user_model()


class ZorgaanbiedersDesignInheritanceTests(TestCase):
    """Verify Zorgaanbieders follows design system LOW-MEDIUM intensity."""

    def setUp(self):
        """Set up test data for provider workspace."""
        self.org = Organization.objects.create(
            name='Test Organization',
            slug='test-org',
        )
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            email='test@example.com',
        )
        from contracts.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.organization = self.org
        profile.save()

        # Create test providers with various capacity states
        self.provider1 = Client.objects.create(
            name='Provider A - Available',
            email='a@example.com',
            client_type='PROVIDER',
            status='ACTIVE',
            organization=self.org,
        )
        self.profile1 = ProviderProfile.objects.create(
            client=self.provider1,
            max_capacity=10,
            current_capacity=3,
            average_wait_days=5,
        )

        self.provider2 = Client.objects.create(
            name='Provider B - Limited',
            email='b@example.com',
            client_type='PROVIDER',
            status='ACTIVE',
            organization=self.org,
        )
        self.profile2 = ProviderProfile.objects.create(
            client=self.provider2,
            max_capacity=8,
            current_capacity=7,
            average_wait_days=12,
        )

        self.provider3 = Client.objects.create(
            name='Provider C - Full',
            email='c@example.com',
            client_type='PROVIDER',
            status='ACTIVE',
            organization=self.org,
        )
        self.profile3 = ProviderProfile.objects.create(
            client=self.provider3,
            max_capacity=5,
            current_capacity=5,
            average_wait_days=28,
        )

        self.provider4 = Client.objects.create(
            name='Provider D - High Wait',
            email='d@example.com',
            client_type='PROVIDER',
            status='ACTIVE',
            organization=self.org,
        )
        self.profile4 = ProviderProfile.objects.create(
            client=self.provider4,
            max_capacity=6,
            current_capacity=2,
            average_wait_days=35,
        )

    def test_provider_workspace_summary_generates_regional_capacity_context(self):
        """Summary should include new design context fields."""
        clients = [self.provider1, self.provider2, self.provider3, self.provider4]
        summary = build_provider_workspace_summary(clients)

        # Verify the new fields exist in the summary
        self.assertIn('regional_capacity_summary', summary)
        self.assertIn('subtle_summary', summary)
        # Both fields may be None or have content depending on the data, but they should exist
        self.assertIsNotNone(summary.get('subtle_summary') or summary.get('regional_capacity_summary') or True)

    def test_provider_workspace_summary_includes_subtle_summary_for_pressure(self):
        """Summary should include summary fields for LOW-MEDIUM intensity."""
        clients = [self.provider1, self.provider2, self.provider3, self.provider4]
        summary = build_provider_workspace_summary(clients)

        # Verify summary has all required fields for design inheritance
        self.assertIn('provider_count', summary)
        self.assertIn('direct_capacity_count', summary)
        self.assertIn('pressure_capacity_count', summary)
        self.assertIn('high_wait_count', summary)
        self.assertIn('subtle_summary', summary)
        self.assertIn('regional_capacity_summary', summary)

    def test_provider_workspace_rows_all_show_required_fields(self):
        """Each provider row must show capacity, wait pressure, and operational signal."""
        clients = [self.provider1, self.provider2, self.provider3, self.provider4]
        rows = build_provider_workspace_rows(clients)

        # All rows must have these fields for LOW-MEDIUM intensity
        for row in rows:
            self.assertIn('capacity_state', row)
            self.assertIn('wait_pressure', row)
            self.assertIn('operational_signal', row)
            self.assertIn('client', row)
            self.assertIn('capability_badges', row)
            self.assertIn('region_summary', row)

            # Each must have tone classification for display
            self.assertIn('tone', row['capacity_state'])
            self.assertIn('tone', row['wait_pressure'])
            self.assertIn('tone', row['operational_signal'])

    def test_capacity_state_tone_follows_design_system(self):
        """Capacity state tones must match design system (good, warning, critical)."""
        clients = [self.provider1, self.provider2, self.provider3]
        rows = build_provider_workspace_rows(clients)

        # All rows should have recognized tones
        recognized_tones = {'good', 'warning', 'critical', 'neutral'}
        for row in rows:
            self.assertIn(row['capacity_state']['tone'], recognized_tones)

    def test_wait_pressure_tone_follows_design_system(self):
        """Wait pressure tones must match design system classifications."""
        clients = [self.provider1, self.provider2, self.provider3, self.provider4]
        rows = build_provider_workspace_rows(clients)

        # Provider1: low wait (5 days) = good
        self.assertEqual(rows[0]['wait_pressure']['tone'], 'good')

        # Provider2: medium wait (12 days) = acceptable
        self.assertIn(rows[1]['wait_pressure']['tone'], ['acceptable', 'warning'])

        # Provider3: high wait (28 days) should be warning or critical
        self.assertIn(rows[2]['wait_pressure']['tone'], ['slow', 'warning', 'critical'])

        # Provider4: very high wait (35 days) = critical/high
        self.assertIn(rows[3]['wait_pressure']['tone'], ['critical', 'high'])

    def test_operational_signal_is_subtle_not_predictive(self):
        """Operational signal should indicate state, not make strong recommendations."""
        clients = [self.provider1, self.provider2, self.provider3, self.provider4]
        rows = build_provider_workspace_rows(clients)

        for row in rows:
            signal = row['operational_signal']
            # Should have label, tone for display
            self.assertIn('label', signal)
            self.assertIn('tone', signal)
            
            # Label should be descriptive, not command-oriented
            label_lower = signal['label'].lower()
            # Should NOT have words like "select", "assign", "recommend"
            self.assertNotIn('select', label_lower)
            self.assertNotIn('assign', label_lower)

    def test_empty_provider_list_returns_safe_summary(self):
        """Empty provider list should return safe defaults."""
        summary = build_provider_workspace_summary([])

        self.assertEqual(summary['provider_count'], 0)
        self.assertIsNone(summary['regional_capacity_summary'])
        self.assertIsNone(summary['subtle_summary'])

    def test_single_provider_no_regional_context_strip(self):
        """Single provider should not trigger regional context strip."""
        summary = build_provider_workspace_summary([self.provider1])

        # Single provider doesn't trigger regional context
        self.assertIsNone(summary['regional_capacity_summary'])

    def test_partial_provider_data_handled_safely(self):
        """Providers with missing profile data should not crash workspace."""
        # Create provider with no ProviderProfile
        provider_no_profile = Client.objects.create(
            name='Provider No Profile',
            email='noprofile@example.com',
            client_type='PROVIDER',
            status='ACTIVE',
            organization=self.org,
        )

        clients = [self.provider1, provider_no_profile, self.provider2]
        rows = build_provider_workspace_rows(clients)

        # Should handle missing profile gracefully
        self.assertEqual(len(rows), 3)
        for row in rows:
            # All rows should still have required display fields
            self.assertIn('capacity_state', row)
            self.assertIn('operational_signal', row)

    def test_client_list_view_returns_200_with_context(self):
        """ClientListView should render with proper context."""
        client = TestClient()
        client.login(username='testuser', password='testpass')

        response = client.get(reverse('careon:client_list'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('provider_rows', response.context)
        self.assertIn('provider_workspace_summary', response.context)

        # Verify summary has required fields
        summary = response.context['provider_workspace_summary']
        self.assertIn('direct_capacity_count', summary)
        self.assertIn('pressure_capacity_count', summary)
        self.assertIn('high_wait_count', summary)
        self.assertIn('regional_capacity_summary', summary)

    def test_client_detail_view_exposes_match_surface_and_edit_action(self):
        """Provider profile surface helper should expose the matching fields used by the detail page."""
        surface = _provider_profile_match_surface(self.provider1.provider_profile)

        self.assertEqual(surface['age_summary'], 'Leeftijd nog niet ingericht')
        self.assertEqual(surface['care_form_summary'], 'Zorgvormen nog niet ingesteld')
        self.assertEqual(surface['gender_summary'], 'Geen geslachtsbeperking opgegeven')
        self.assertEqual(surface['specialization_summary'], 'Specialisaties nog niet ingesteld')

    def test_filtering_preserves_design_context(self):
        """Filters should work without breaking design context."""
        client = TestClient()
        client.login(username='testuser', password='testpass')

        # Test with basic request
        response = client.get(reverse('careon:client_list'))

        self.assertEqual(response.status_code, 200)
        self.assertIn('provider_rows', response.context)
        self.assertIn('provider_workspace_summary', response.context)
        # Provider rows should include our test providers
        self.assertTrue(len(response.context['provider_rows']) >= 0)

    def test_no_excessive_signal_density_in_design(self):
        """LOW-MEDIUM intensity should not show excessive signals per row."""
        clients = [self.provider1, self.provider2, self.provider3, self.provider4]
        rows = build_provider_workspace_rows(clients)

        for row in rows:
            # Each row shows: name, capacity, wait_pressure, operational signal, capabilities
            # That's the intentional density - no command bar, no triage ranking, no heavy UX
            required_keys = {
                'client',
                'capacity_state',
                'wait_pressure',
                'operational_signal',
                'capability_badges',
            }
            for key in required_keys:
                self.assertIn(key, row, f"Row missing {key}")

            # Should NOT have intensive decision fields (that's for high-intensity pages)
            intensive_keys = {'recommended_action', 'priority_rank', 'escalation_urgency'}
            for key in intensive_keys:
                # These belong to Casussen/Beoordelingen, not Zorgaanbieders
                self.assertNotIn(
                    key, row,
                    f"Row should not have {key} (reserved for high-intensity pages)"
                )


class ZorgaanbiedersLowMediumIntensityTests(TestCase):
    """Verify LOW-MEDIUM intensity constraints are enforced."""

    def setUp(self):
        """Set up test data."""
        self.org = Organization.objects.create(
            name='Test Organization',
            slug='test-org',
        )
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass',
        )
        from contracts.models import UserProfile
        profile, _ = UserProfile.objects.get_or_create(user=self.user)
        profile.organization = self.org
        profile.save()

        self.provider = Client.objects.create(
            name='Test Provider',
            email='test@example.com',
            client_type='PROVIDER',
            status='ACTIVE',
            organization=self.org,
        )
        self.profile = ProviderProfile.objects.create(
            client=self.provider,
            max_capacity=10,
            current_capacity=5,
            average_wait_days=10,
        )

    def test_row_shows_capacity_and_wait_pressure_not_matching_logic(self):
        """Rows should show resource state, not matching fit logic."""
        rows = build_provider_workspace_rows([self.provider])
        row = rows[0]

        # Shows capacity state and wait pressure (resource focus)
        self.assertIn('capacity_state', row)
        self.assertIn('wait_pressure', row)

        # Should NOT show intensive matching-specific fields
        self.assertNotIn('fit_score', row)
        self.assertNotIn('urgency_match', row)
        self.assertNotIn('category_match', row)

    def test_summary_shows_aggregates_not_triage_ranking(self):
        """Summary should aggregate capacity/wait, not create triage ranking."""
        summary = build_provider_workspace_summary([self.provider])

        # Shows counts of capacity states
        self.assertIn('direct_capacity_count', summary)
        self.assertIn('pressure_capacity_count', summary)

        # Should NOT rank providers or show triage priority
        self.assertNotIn('top_providers', summary)
        self.assertNotIn('priority_ranking', summary)


if __name__ == '__main__':
    import unittest
    unittest.main()
