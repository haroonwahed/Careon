import os
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    ProviderProfile,
    RegionalConfiguration,
)
from contracts.views import _build_matching_suggestions_for_intake


class MatchingRecommendationsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='match_user',
            email='match@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Care Team Matching', slug='care-team-matching')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username='match_user', password='testpass123')
        os.environ['FEATURE_REDESIGN'] = 'true'

    def tearDown(self):
        if 'FEATURE_REDESIGN' in os.environ:
            del os.environ['FEATURE_REDESIGN']

    def test_matching_panel_shows_score_wait_capacity_reason(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Aanbieder Noord',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=4,
            average_wait_days=12,
        )

        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Intake Matching Test',
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date='2026-04-10',
            target_completion_date='2026-04-20',
            case_coordinator=self.user,
        )
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Matchscore')
        self.assertContains(response, 'Wachttijd')
        self.assertContains(response, 'Capaciteit')
        self.assertContains(response, 'Matching')
        self.assertContains(response, 'Aanbevolen actie')
        self.assertContains(response, 'Bevestig plaatsing')
        self.assertContains(response, 'Plaats direct')
        self.assertContains(response, 'Gedragsinvloed')
        self.assertContains(response, 'Limited provider history, behavioral influence kept neutral')

    def test_matching_panel_shows_region_match_badge(self):
        region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name='ROAZ Noord',
            region_code='ROAZ001',
            region_type='ROAZ',
            status=RegionalConfiguration.Status.ACTIVE,
        )

        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Aanbieder Regio',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        profile = ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=0,
            max_capacity=3,
            average_wait_days=10,
        )
        profile.served_regions.add(region)

        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Intake Region Match',
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            preferred_region_type='ROAZ',
            preferred_region=region,
            start_date='2026-04-10',
            target_completion_date='2026-04-20',
            case_coordinator=self.user,
        )
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Regio: match')

    def test_matching_panel_exposes_map_contract_and_empty_geo_state(self):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name='Aanbieder Zonder Coordinaten',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=1,
            max_capacity=4,
            average_wait_days=12,
        )

        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Intake Map Contract',
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date='2026-04-10',
            target_completion_date='2026-04-20',
            case_coordinator=self.user,
        )
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )

        response = self.client.get(reverse('careon:matching_dashboard'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Geografische context')
        self.assertContains(response, 'Kaart kan nog niet renderen')
        matching_map = response.context['rows'][0]['matching_map']
        self.assertIn('case_location', matching_map)
        self.assertIn('provider_markers', matching_map)
        self.assertIn('selected_provider_id', matching_map)
        self.assertFalse(matching_map['summary']['can_render_map'])
        self.assertFalse(matching_map['summary']['has_case_coordinates'])
        self.assertEqual(len(matching_map['provider_markers']), 1)
        self.assertEqual(matching_map['provider_markers'][0]['provider_name'], 'Aanbieder Zonder Coordinaten')


class MatchingExplainabilityUnitTests(TestCase):
    """Unit tests for the structured explanation data returned by the matching helper."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='explain_user',
            email='explain@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Explain Org', slug='explain-org')

    def _make_intake(self, **kwargs):
        defaults = dict(
            organization=self.organization,
            title='Test Intake',
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date='2026-04-10',
            target_completion_date='2026-04-20',
            case_coordinator=self.user,
        )
        defaults.update(kwargs)
        return CaseIntakeProcess.objects.create(**defaults)

    def _make_profile(self, **kwargs):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name=kwargs.pop('name', 'Test Aanbieder'),
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        defaults = dict(
            client=provider,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=2,
            max_capacity=5,
            average_wait_days=10,
        )
        defaults.update(kwargs)
        return ProviderProfile.objects.create(**defaults)

    def test_suggestion_contains_explanation_key(self):
        intake = self._make_intake()
        profile = self._make_profile()
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)

        self.assertGreater(len(results), 0)
        self.assertIn('explanation', results[0])

    def test_explanation_has_required_keys(self):
        intake = self._make_intake()
        profile = self._make_profile()
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)
        explanation = results[0]['explanation']

        for key in ('fit_summary', 'factors', 'confidence', 'confidence_reason', 'trade_offs', 'verify_manually'):
            self.assertIn(key, explanation, f"Missing key: {key}")

    def test_factors_include_all_dimensions(self):
        intake = self._make_intake()
        profile = self._make_profile()
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)
        factors = results[0]['explanation']['factors']

        for dim in ('specialization', 'urgency', 'care_form', 'region', 'capacity', 'performance'):
            self.assertIn(dim, factors, f"Missing factor: {dim}")
            self.assertIn('status', factors[dim])
            self.assertIn('detail', factors[dim])

    def test_confidence_high_for_strong_match(self):
        """A provider matching urgency, care form, and with good capacity should yield high/medium confidence."""
        intake = self._make_intake()
        profile = self._make_profile(
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=5,
            max_capacity=10,
            average_wait_days=7,
        )
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)
        confidence = results[0]['explanation']['confidence']

        self.assertIn(confidence, ('high', 'medium'))

    def test_no_capacity_provider_has_trade_off(self):
        intake = self._make_intake()
        profile = self._make_profile(current_capacity=5, max_capacity=5)
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)
        trade_offs = results[0]['explanation']['trade_offs']

        self.assertTrue(any('vol' in t.lower() or 'capaciteit' in t.lower() for t in trade_offs))

    def test_long_wait_time_produces_trade_off(self):
        intake = self._make_intake()
        profile = self._make_profile(average_wait_days=60)
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)
        trade_offs = results[0]['explanation']['trade_offs']

        self.assertTrue(any('wachttijd' in t.lower() for t in trade_offs))

    def test_verify_manually_is_non_empty(self):
        intake = self._make_intake()
        profile = self._make_profile()
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)
        verify = results[0]['explanation']['verify_manually']

        self.assertIsInstance(verify, list)
        self.assertGreater(len(verify), 0)

    def test_existing_fields_backward_compatible(self):
        """Existing fields must still be present so the dashboard view and template remain unaffected."""
        intake = self._make_intake()
        profile = self._make_profile()
        profiles = ProviderProfile.objects.filter(pk=profile.pk).select_related('client').prefetch_related('target_care_categories')

        results = _build_matching_suggestions_for_intake(intake, profiles)
        result = results[0]

        for field in ('provider_id', 'provider_name', 'match_score', 'fit_score', 'reasons', 'tradeoff', 'free_slots', 'avg_wait_days'):
            self.assertIn(field, result, f"Backward-compat field missing: {field}")

    @patch('contracts.views.calculate_provider_behavior_modifier')
    def test_behavior_modifier_adjusts_close_candidates_as_tie_break(self, modifier_mock):
        intake = self._make_intake()
        profile_a = self._make_profile(name='Aanbieder A')
        profile_b = self._make_profile(name='Aanbieder B')
        profiles = (
            ProviderProfile.objects
            .filter(pk__in=[profile_a.pk, profile_b.pk])
            .order_by('pk')
            .select_related('client')
            .prefetch_related('target_care_categories')
        )

        # Same base-fit inputs; modifier should create only a small score delta.
        modifier_mock.side_effect = [0.15, -0.15]
        results = _build_matching_suggestions_for_intake(intake, profiles, limit=5)

        self.assertEqual(len(results), 2)
        self.assertGreater(results[0]['match_score'], results[1]['match_score'])
        self.assertLessEqual(results[0]['match_score'] - results[1]['match_score'], 3.0)

    @patch('contracts.views.calculate_provider_behavior_modifier')
    def test_behavior_modifier_does_not_overpower_large_fit_gap(self, modifier_mock):
        intake = self._make_intake()
        strong_profile = self._make_profile(
            name='Sterke Fit',
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=2,
            max_capacity=6,
            average_wait_days=8,
        )
        weak_profile = self._make_profile(
            name='Zwakke Fit',
            offers_outpatient=False,
            handles_medium_urgency=False,
            current_capacity=6,
            max_capacity=6,
            average_wait_days=45,
        )
        profiles = (
            ProviderProfile.objects
            .filter(pk__in=[strong_profile.pk, weak_profile.pk])
            .order_by('pk')
            .select_related('client')
            .prefetch_related('target_care_categories')
        )

        # Even with opposite modifiers, large primary-fit gap should remain dominant.
        modifier_mock.side_effect = [-0.15, 0.15]
        results = _build_matching_suggestions_for_intake(intake, profiles, limit=5)

        self.assertEqual(results[0]['provider_name'], 'Sterke Fit')

    @patch('contracts.views.calculate_provider_behavior_modifier')
    def test_fit_score_remains_base_fit_while_match_score_is_adjusted(self, modifier_mock):
        intake = self._make_intake()
        profile_a = self._make_profile(name='Fit A')
        profile_b = self._make_profile(name='Fit B')
        profiles = (
            ProviderProfile.objects
            .filter(pk__in=[profile_a.pk, profile_b.pk])
            .order_by('pk')
            .select_related('client')
            .prefetch_related('target_care_categories')
        )

        modifier_mock.side_effect = [0.15, -0.15]
        results = _build_matching_suggestions_for_intake(intake, profiles, limit=5)

        self.assertEqual(len(results), 2)
        for row in results:
            self.assertIsInstance(row['fit_score'], (int, float))
            self.assertIsInstance(row['match_score'], (int, float))
        self.assertTrue(any(row['match_score'] != row['fit_score'] for row in results))

    @patch('contracts.views.calculate_provider_behavior_modifier')
    def test_behavior_consideration_explainability_field_present(self, modifier_mock):
        intake = self._make_intake()
        profile = self._make_profile(name='Explainability Provider')
        profiles = (
            ProviderProfile.objects
            .filter(pk=profile.pk)
            .select_related('client')
            .prefetch_related('target_care_categories')
        )

        modifier_mock.return_value = 0.10
        results = _build_matching_suggestions_for_intake(intake, profiles, limit=5)

        self.assertEqual(len(results), 1)
        self.assertIn('behavior_consideration', results[0]['explanation'])
        self.assertTrue(results[0]['explanation']['behavior_consideration'])

    @patch('contracts.views.calculate_provider_behavior_modifier')
    def test_behavior_influence_explainability_list_present(self, modifier_mock):
        intake = self._make_intake()
        profile = self._make_profile(name='Behavior Explain Provider')
        profiles = (
            ProviderProfile.objects
            .filter(pk=profile.pk)
            .select_related('client')
            .prefetch_related('target_care_categories')
        )

        modifier_mock.return_value = 0.0
        results = _build_matching_suggestions_for_intake(intake, profiles, limit=5)

        self.assertEqual(len(results), 1)
        self.assertIn('behavior_influence', results[0]['explanation'])
        self.assertIsInstance(results[0]['explanation']['behavior_influence'], list)
        self.assertGreater(len(results[0]['explanation']['behavior_influence']), 0)

    @patch('contracts.views.calculate_provider_behavior_modifier')
    def test_close_call_behavior_note_added_when_ranking_influence_applies(self, modifier_mock):
        intake = self._make_intake()
        profile_a = self._make_profile(name='Close Call A')
        profile_b = self._make_profile(name='Close Call B')
        profiles = (
            ProviderProfile.objects
            .filter(pk__in=[profile_a.pk, profile_b.pk])
            .order_by('pk')
            .select_related('client')
            .prefetch_related('target_care_categories')
        )

        modifier_mock.side_effect = [0.15, -0.15]
        results = _build_matching_suggestions_for_intake(intake, profiles, limit=5)

        self.assertTrue(
            any(
                any('Behavioral reliability slightly strengthened this recommendation' in note for note in row['explanation']['behavior_influence'])
                for row in results
            )
        )
