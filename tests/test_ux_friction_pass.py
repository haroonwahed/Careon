"""Tests for the UX friction and consistency pass.

Coverage:
- demo_scenario_tag extracted correctly from seeded case descriptions / titles
- outcome_timeline_events built from ProviderEvaluation + CaseDecisionLog
- _alert_card CTAs are present for provider_info_requested and provider_info_stale
- SLA state labels in intake_detail template use Dutch text (no raw English codes)
- Duplicate "Voer aanbevolen actie uit om matching te verbeteren." copy removed from
  matching_dashboard.html template source
- placement_detail.html brand name is Careon, not Zorgregie
- Demo scenario badge rendered in case detail context

Note: Most /care/* GET views are served as SPA shell by SpaShellMigrationMiddleware.
Views that ARE server-rendered include /care/regiekamer/* endpoints.
For SPA-intercepted views we test context via RequestFactory or template source.
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase, RequestFactory, Client as TestClient
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    CareCase,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client,
    MunicipalityConfiguration,
    OperationalAlert,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderEvaluation,
    RegionalConfiguration,
    RegionType,
)
from contracts.views import _extract_demo_scenario_tag, _build_outcome_timeline


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_org(slug='ux-test-org'):
    return Organization.objects.create(name=f'UX Test Org {slug}', slug=slug)


def _make_user(org, username='ux-tester', role=OrganizationMembership.Role.OWNER):
    user = User.objects.create_user(username=username, password='testpass123')
    OrganizationMembership.objects.create(
        organization=org, user=user, role=role, is_active=True,
    )
    return user


def _make_intake(org, user, *, title='Test Casus', description='', urgency=CaseIntakeProcess.Urgency.MEDIUM):
    case = CareCase.objects.create(
        organization=org,
        title=title,
        status=CareCase.Status.ACTIVE,
        created_by=user,
    )
    return CaseIntakeProcess.objects.create(
        organization=org,
        contract=case,
        title=title,
        description=description,
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=urgency,
        start_date=timezone.now().date(),
        target_completion_date=timezone.now().date() + timedelta(days=30),
        case_coordinator=user,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
    )


def _make_provider(org, name='Test Zorgaanbieder'):
    return Client.objects.create(
        organization=org,
        name=name,
        status='ACTIVE',
    )


# ---------------------------------------------------------------------------
# _extract_demo_scenario_tag
# ---------------------------------------------------------------------------

class ExtractDemoScenarioTagTests(TestCase):
    def setUp(self):
        self.org = _make_org('tag-test-org')
        self.user = _make_user(self.org, 'tag-tester')

    def test_returns_tag_from_description(self):
        intake = _make_intake(
            self.org, self.user,
            description='Demo scenario [happy-path] – gegenereerd door seed_demo_data commando. Leeftijd cliënt: 12 jaar.',
        )
        self.assertEqual(_extract_demo_scenario_tag(intake), 'happy-path')

    def test_returns_tag_from_capacity_issue_description(self):
        intake = _make_intake(
            self.org, self.user,
            description='Demo scenario [capacity-issue] – gegenereerd door seed_demo_data commando.',
        )
        self.assertEqual(_extract_demo_scenario_tag(intake), 'capacity-issue')

    def test_returns_tag_from_title_when_no_description_match(self):
        intake = _make_intake(
            self.org, self.user,
            title='M. Bakker – Dagbehandeling [stalled-placement]',
            description='Gewone omschrijving zonder tag.',
        )
        self.assertEqual(_extract_demo_scenario_tag(intake), 'stalled-placement')

    def test_returns_empty_string_for_non_demo_case(self):
        intake = _make_intake(
            self.org, self.user,
            title='Gewone casus zonder tag',
            description='Reguliere omschrijving.',
        )
        self.assertEqual(_extract_demo_scenario_tag(intake), '')

    def test_returns_empty_string_for_blank_description_and_title(self):
        intake = _make_intake(self.org, self.user, title='Casus zonder tag', description='')
        self.assertEqual(_extract_demo_scenario_tag(intake), '')

    def test_returns_tag_case_insensitive(self):
        intake = _make_intake(
            self.org, self.user,
            description='DEMO SCENARIO [BOUNCED-CASE] – gegenereerd.',
        )
        self.assertEqual(_extract_demo_scenario_tag(intake), 'BOUNCED-CASE')


# ---------------------------------------------------------------------------
# _build_outcome_timeline
# ---------------------------------------------------------------------------

class BuildOutcomeTimelineTests(TestCase):
    def setUp(self):
        self.org = _make_org('timeline-test-org')
        self.user = _make_user(self.org, 'timeline-tester')
        self.intake = _make_intake(self.org, self.user)
        self.provider = _make_provider(self.org)

    def test_returns_list_for_intake_with_no_events(self):
        events = _build_outcome_timeline(self.intake)
        self.assertIsInstance(events, list)

    def test_includes_provider_evaluation_event(self):
        ProviderEvaluation.objects.create(
            case=self.intake,
            provider=self.provider,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by=self.user,
        )
        events = _build_outcome_timeline(self.intake)
        titles = [e['title'] for e in events]
        self.assertTrue(any(self.provider.name in t for t in titles))

    def test_includes_reject_evaluation_with_reason(self):
        ProviderEvaluation.objects.create(
            case=self.intake,
            provider=self.provider,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
            decided_by=self.user,
        )
        events = _build_outcome_timeline(self.intake)
        status_labels = [e['status_label'] for e in events]
        self.assertIn('Afgewezen', status_labels)

    def test_includes_needs_more_info_evaluation(self):
        ProviderEvaluation.objects.create(
            case=self.intake,
            provider=self.provider,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info='Graag medicatiegeschiedenis aanleveren.',
            decided_by=self.user,
        )
        events = _build_outcome_timeline(self.intake)
        status_labels = [e['status_label'] for e in events]
        self.assertIn('Meer informatie gevraagd', status_labels)

    def test_includes_case_decision_log_event(self):
        CaseDecisionLog.objects.create(
            case=self.intake,
            case_id_snapshot=self.intake.pk,
            event_type=CaseDecisionLog.EventType.REMATCH_TRIGGERED,
            actor=self.user,
            actor_kind=CaseDecisionLog.ActorKind.USER,
        )
        events = _build_outcome_timeline(self.intake)
        self.assertTrue(len(events) >= 1)
        titles = [e['title'] for e in events]
        self.assertTrue(any('Her-match' in t for t in titles))

    def test_events_are_chronological(self):
        ProviderEvaluation.objects.create(
            case=self.intake,
            provider=self.provider,
            decision=ProviderEvaluation.Decision.ACCEPT,
            decided_by=self.user,
        )
        CaseDecisionLog.objects.create(
            case=self.intake,
            case_id_snapshot=self.intake.pk,
            event_type=CaseDecisionLog.EventType.PROVIDER_ACCEPTED,
            actor=self.user,
            actor_kind=CaseDecisionLog.ActorKind.USER,
        )
        events = _build_outcome_timeline(self.intake)
        timestamps = [e['timestamp'] for e in events]
        self.assertEqual(timestamps, sorted(timestamps))

    def test_empty_for_intake_with_no_related_records(self):
        fresh_org = _make_org('empty-timeline-org')
        fresh_user = _make_user(fresh_org, 'empty-timeline-user')
        fresh_intake = _make_intake(fresh_org, fresh_user)
        events = _build_outcome_timeline(fresh_intake)
        self.assertEqual(events, [])


# ---------------------------------------------------------------------------
# Alert card CTAs – provider_info_requested and provider_info_stale
# (These views ARE server-rendered; they are under /care/regiekamer/ which is
# excluded from the SpaShellMigrationMiddleware.)
# ---------------------------------------------------------------------------

class AlertCardCTATests(TestCase):
    """Verify that the alert card partial renders CTA links for info request alert types."""

    def setUp(self):
        self.org = _make_org('alert-cta-test-org')
        self.user = _make_user(self.org, 'alert-cta-tester')
        self.intake = _make_intake(self.org, self.user)
        self.client = TestClient()
        self.client.login(username='alert-cta-tester', password='testpass123')

    def _make_alert(self, alert_type, severity=OperationalAlert.Severity.MEDIUM):
        return OperationalAlert.objects.create(
            case=self.intake,
            alert_type=alert_type,
            severity=severity,
            title='Test alert',
            description='Test omschrijving',
            recommended_action='Actie vereist',
        )

    def test_regiekamer_shows_info_request_cta_for_provider_info_requested(self):
        self._make_alert(OperationalAlert.AlertType.PROVIDER_INFO_REQUESTED)
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Beantwoord verzoek')
        self.assertContains(response, 'info-aanvraag')

    def test_regiekamer_shows_info_request_cta_for_provider_info_stale(self):
        self._make_alert(OperationalAlert.AlertType.PROVIDER_INFO_STALE, severity=OperationalAlert.Severity.HIGH)
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Open verlopen verzoek')
        self.assertContains(response, 'info-aanvraag')

    def test_placement_stalled_cta_links_to_placement_tab(self):
        self._make_alert(OperationalAlert.AlertType.PLACEMENT_STALLED)
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Bevestig plaatsing')
        self.assertContains(response, 'tab=plaatsing')

    def test_weak_match_cta_links_to_matching_dashboard(self):
        self._make_alert(OperationalAlert.AlertType.WEAK_MATCH_NEEDS_REVIEW)
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Review match')


# ---------------------------------------------------------------------------
# Case detail – SLA labels and demo scenario tag (via RequestFactory)
# The case detail URL is under /care/ and served as SPA shell by middleware.
# We test the view's context directly using RequestFactory to bypass the middleware.
# ---------------------------------------------------------------------------

class CaseDetailContextTests(TestCase):
    """Test CaseIntakeDetailView context keys via RequestFactory (bypasses SPA middleware)."""

    def setUp(self):
        self.factory = RequestFactory()
        self.org = _make_org('case-detail-ux-org')
        self.user = _make_user(self.org, 'case-detail-ux-tester')

    def _get_context(self, intake):
        from contracts.views import CaseIntakeDetailView
        request = self.factory.get(reverse('careon:case_detail', kwargs={'pk': intake.pk}))
        request.user = self.user
        request._cached_organization = self.org
        view = CaseIntakeDetailView()
        view.request = request
        view.kwargs = {'pk': intake.pk}
        view.object = intake
        return view.get_context_data()

    def test_demo_scenario_tag_in_context_for_seeded_case(self):
        intake = _make_intake(
            self.org, self.user,
            description='Demo scenario [capacity-issue] – gegenereerd door seed_demo_data commando.',
        )
        ctx = self._get_context(intake)
        self.assertEqual(ctx['demo_scenario_tag'], 'capacity-issue')

    def test_demo_scenario_tag_empty_for_regular_case(self):
        intake = _make_intake(
            self.org, self.user,
            title='Gewone casus',
            description='Reguliere omschrijving.',
        )
        ctx = self._get_context(intake)
        self.assertEqual(ctx['demo_scenario_tag'], '')

    def test_outcome_timeline_events_in_context(self):
        intake = _make_intake(self.org, self.user)
        ctx = self._get_context(intake)
        self.assertIn('outcome_timeline_events', ctx)
        self.assertIsInstance(ctx['outcome_timeline_events'], list)

    def test_outcome_timeline_events_populated_from_evaluation(self):
        intake = _make_intake(self.org, self.user)
        provider = _make_provider(self.org)
        ProviderEvaluation.objects.create(
            case=intake,
            provider=provider,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
            decided_by=self.user,
        )
        ctx = self._get_context(intake)
        self.assertGreater(len(ctx['outcome_timeline_events']), 0)


# ---------------------------------------------------------------------------
# intake_detail template – no raw English SLA codes, no dev copy
# Test the template source directly as an authoritative check.
# ---------------------------------------------------------------------------

class IntakeDetailTemplateSourceTests(TestCase):
    """Verify template source does not contain raw English SLA codes or dev copy."""

    def _template_content(self):
        import os
        path = os.path.join(
            os.path.dirname(__file__),
            '..', 'theme', 'templates', 'contracts', 'intake_detail.html',
        )
        with open(os.path.abspath(path), encoding='utf-8') as f:
            return f.read()

    def test_no_raw_sla_code_on_track(self):
        content = self._template_content()
        self.assertNotIn('ON_TRACK -', content)

    def test_no_raw_sla_code_at_risk_dash(self):
        content = self._template_content()
        self.assertNotIn('AT_RISK -', content)

    def test_no_raw_sla_code_stable_dash(self):
        content = self._template_content()
        self.assertNotIn('STABLE -', content)

    def test_no_in_3_seconden_duidelijk(self):
        content = self._template_content()
        self.assertNotIn('3 seconden duidelijk', content)

    def test_demo_scenario_badge_class_present(self):
        content = self._template_content()
        self.assertIn('badge-purple', content)
        self.assertIn('demo_scenario_tag', content)

    def test_dutch_sla_labels_present(self):
        content = self._template_content()
        # At least these Dutch translations must be present
        self.assertIn('Actie verplicht', content)
        self.assertIn('Tijdsdruk', content)
        self.assertIn('Binnen SLA', content)


# ---------------------------------------------------------------------------
# matching_dashboard template – no duplicate copy
# ---------------------------------------------------------------------------

class MatchingDashboardTemplateSourceTests(TestCase):
    """Verify the duplicate fallback text is gone from matching_dashboard.html."""

    def _template_content(self):
        import os
        path = os.path.join(
            os.path.dirname(__file__),
            '..', 'theme', 'templates', 'contracts', 'matching_dashboard.html',
        )
        with open(os.path.abspath(path), encoding='utf-8') as f:
            return f.read()

    def test_duplicate_fallback_copy_not_in_template_source(self):
        content = self._template_content()
        self.assertNotIn('Voer aanbevolen actie uit om matching te verbeteren.', content)


# ---------------------------------------------------------------------------
# placement_detail template – brand name and overdue banner
# ---------------------------------------------------------------------------

class PlacementDetailTemplateSourceTests(TestCase):
    """Verify placement_detail.html has correct brand name, overdue banner, and no duplicate CTAs."""

    def _template_content(self):
        import os
        path = os.path.join(
            os.path.dirname(__file__),
            '..', 'theme', 'templates', 'contracts', 'placement_detail.html',
        )
        with open(os.path.abspath(path), encoding='utf-8') as f:
            return f.read()

    def test_title_says_careon_not_zorgregie(self):
        content = self._template_content()
        self.assertIn('Plaatsing - Careon', content)
        self.assertNotIn('Zorgregie', content)

    def test_overdue_banner_present_in_template(self):
        content = self._template_content()
        self.assertIn('Plaatsing is achterstallig', content)

    def test_no_duplicate_open_case_cta(self):
        content = self._template_content()
        # Old duplicate label must be gone
        self.assertNotIn('Open casus voor beslisactie', content)

    def test_overdue_only_for_approved_status(self):
        content = self._template_content()
        # Must be guarded by status == 'APPROVED' check
        self.assertIn("status == 'APPROVED'", content)


# ---------------------------------------------------------------------------
# Case list – demo scenario tag badge (template source check)
# ---------------------------------------------------------------------------

class CaseListDemoTagTemplateTests(TestCase):
    """Verify intake_list.html template includes the demo scenario badge."""

    def _template_content(self):
        import os
        path = os.path.join(
            os.path.dirname(__file__),
            '..', 'theme', 'templates', 'contracts', 'intake_list.html',
        )
        with open(os.path.abspath(path), encoding='utf-8') as f:
            return f.read()

    def test_demo_tag_badge_in_template(self):
        content = self._template_content()
        self.assertIn('demo_scenario_tag', content)
        self.assertIn('badge-purple', content)
        self.assertIn('Demo:', content)
