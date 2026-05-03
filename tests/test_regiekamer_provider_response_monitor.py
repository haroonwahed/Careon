from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from tests.test_utils import middleware_without_spa_shell
from django.utils import timezone

from contracts.models import (
    AuditLog,
    CareCase,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    RegionalConfiguration,
    RegionType,
)
from contracts.views import build_provider_response_monitor


@override_settings(MIDDLEWARE=middleware_without_spa_shell())
class RegiekamerProviderResponseMonitorTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username='monitor_owner',
            email='monitor_owner@example.com',
            password='testpass123',
        )
        self.organization = Organization.objects.create(name='Monitor Org', slug='monitor-org')
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Monitor Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.client.login(username='monitor_owner', password='testpass123')

    def _create_case(
        self,
        title,
        *,
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=CaseIntakeProcess.Urgency.MEDIUM,
        region=None,
        contract=None,
    ):
        return CaseIntakeProcess.objects.create(
            organization=self.organization,
            contract=contract,
            title=title,
            status=status,
            urgency=urgency,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            preferred_region=region,
            preferred_region_type=region.region_type if region else RegionType.GEMEENTELIJK,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            assessment_summary='Samenvatting aanwezig.',
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )

    def _create_region(self, name='Monitor Regio', code='MON-001'):
        return RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name=name,
            region_code=code,
            region_type=RegionType.GGD,
            status=RegionalConfiguration.Status.ACTIVE,
        )

    def _create_case_record(self, title='Casusdossier Monitor', client=None):
        return CareCase.objects.create(
            organization=self.organization,
            title=title,
            client=client,
            created_by=self.user,
        )

    def _create_placement(self, intake, provider_response_status, *, requested_days_ago=1, deadline_days_after_request=3, provider=None):
        requested_at = timezone.now() - timedelta(days=requested_days_ago)
        deadline_at = requested_at + timedelta(days=deadline_days_after_request)
        selected_provider = provider or self.provider
        return PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=selected_provider,
            selected_provider=selected_provider,
            care_form=intake.preferred_care_form,
            provider_response_status=provider_response_status,
            provider_response_requested_at=requested_at,
            provider_response_deadline_at=deadline_at,
        )

    def _queue_titles(self, response):
        return [row['case_title'] for row in response.context['monitor_queue_rows']]

    def _login_member(self):
        member = User.objects.create_user(
            username='monitor_member',
            email='monitor_member@example.com',
            password='testpass123',
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=member,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        self.client.login(username='monitor_member', password='testpass123')
        return member

    def test_monitor_page_renders_with_counters_and_queue(self):
        intake = self._create_case('Casus Monitor Pagina')
        self._create_placement(intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)

        response = self.client.get(reverse('careon:provider_response_monitor'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Providerreactie monitor')
        self.assertContains(response, 'Aanbieders')
        self.assertContains(response, 'Wachtrij')
        self.assertContains(response, 'open reacties')
        self.assertContains(response, 'Open plaatsing')
        self.assertContains(response, f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing")

    def test_monitor_summary_counts_mixed_scenarios(self):
        waiting_intake = self._create_case('Casus Wachtend')
        overdue_intake = self._create_case('Casus Overdue')
        waitlist_intake = self._create_case('Casus Wachtlijst')
        rejected_intake = self._create_case('Casus Afgewezen')

        self._create_placement(waiting_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=1)
        self._create_placement(overdue_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=5, deadline_days_after_request=1)
        self._create_placement(waitlist_intake, PlacementRequest.ProviderResponseStatus.WAITLIST, requested_days_ago=4)
        self._create_placement(rejected_intake, PlacementRequest.ProviderResponseStatus.REJECTED, requested_days_ago=2)

        monitor = build_provider_response_monitor(self.organization)
        summary = monitor['summary']

        self.assertEqual(summary['waiting_count'], 2)
        self.assertEqual(summary['overdue_count'], 2)
        self.assertEqual(summary['rematch_recommended_count'], 2)
        self.assertEqual(summary['waitlist_no_capacity_count'], 1)
        self.assertEqual(summary['sla_breach_count'], 2)
        self.assertEqual(summary['escalation_required_count'], 2)
        self.assertEqual(summary['forced_action_count'], 0)
        self.assertEqual(summary['avg_age_days'], 3.0)
        self.assertEqual(summary['total_cases'], 4)

    def test_monitor_renders_immediate_action_section_for_escalated_rows(self):
        escalated_intake = self._create_case('Casus Escalatie Blok')
        on_track_intake = self._create_case('Casus Normaal')
        self._create_placement(
            escalated_intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=6,
            deadline_days_after_request=10,
        )
        self._create_placement(
            on_track_intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=1,
            deadline_days_after_request=4,
        )

        response = self.client.get(reverse('careon:provider_response_monitor'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Actie nu')
        self.assertContains(response, 'Casus Escalatie Blok')
        self.assertContains(response, 'SLA FORCED_ACTION')
        self.assertContains(response, 'Eigenaar:')
        self.assertContains(response, 'Regievoerder')
        self.assertContains(response, 'Actie:')
        self.assertContains(response, 'Wachtrij')
        self.assertContains(response, 'SLA FORCED_ACTION')
        self.assertContains(response, 'SLA ON_TRACK')

    def test_monitor_row_recommendation_for_forced_action_is_critical(self):
        forced_intake = self._create_case('Casus Forced Urgentie')
        self._create_placement(
            forced_intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=6,
            deadline_days_after_request=9,
        )

        monitor = build_provider_response_monitor(self.organization)
        forced_rows = [row for row in monitor['queue_rows'] if row['case_title'] == 'Casus Forced Urgentie']

        self.assertEqual(len(forced_rows), 1)
        forced_row = forced_rows[0]
        self.assertEqual(forced_row['sla_state'], 'FORCED_ACTION')
        self.assertEqual(forced_row['next_owner'], 'regievoerder')
        self.assertEqual(forced_row['recommended_action_label'], 'Her-match of expliciete override')
        self.assertEqual(forced_row['recommended_action_tone'], 'critical')

    def test_priority_mode_includes_only_urgent_sla_or_blocked_cases(self):
        forced_intake = self._create_case('Casus Priority Forced')
        overdue_intake = self._create_case('Casus Priority Overdue')
        blocked_intake = self._create_case('Casus Priority Blocked')
        on_track_intake = self._create_case('Casus Priority On Track')
        at_risk_intake = self._create_case('Casus Priority At Risk')

        self._create_placement(forced_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=6, deadline_days_after_request=9)
        self._create_placement(overdue_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=4, deadline_days_after_request=1)
        self._create_placement(blocked_intake, PlacementRequest.ProviderResponseStatus.REJECTED, requested_days_ago=1, deadline_days_after_request=2)
        self._create_placement(on_track_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=1, deadline_days_after_request=4)
        self._create_placement(at_risk_intake, PlacementRequest.ProviderResponseStatus.WAITLIST, requested_days_ago=2, deadline_days_after_request=5)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'priority_mode': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casus Priority Forced')
        self.assertContains(response, 'Casus Priority Overdue')
        self.assertContains(response, 'Casus Priority Blocked')
        self.assertNotContains(response, 'Casus Priority On Track')
        self.assertNotContains(response, 'Casus Priority At Risk')

    def test_priority_mode_excludes_on_track_and_at_risk_sla_states(self):
        on_track_intake = self._create_case('Casus Niet Urgent On Track')
        at_risk_intake = self._create_case('Casus Niet Urgent At Risk')

        self._create_placement(on_track_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=1, deadline_days_after_request=4)
        self._create_placement(at_risk_intake, PlacementRequest.ProviderResponseStatus.WAITLIST, requested_days_ago=2, deadline_days_after_request=5)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'priority_mode': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'Casus Niet Urgent On Track')
        self.assertNotContains(response, 'Casus Niet Urgent At Risk')

    def test_priority_mode_keeps_deep_links_and_sort_state(self):
        high_intake = self._create_case('Casus Priority Hoog', urgency=CaseIntakeProcess.Urgency.HIGH)
        crisis_intake = self._create_case('Casus Priority Crisis', urgency=CaseIntakeProcess.Urgency.CRISIS)

        self._create_placement(high_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=5, deadline_days_after_request=1)
        self._create_placement(crisis_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=5, deadline_days_after_request=1)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'priority_mode': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'value="1" selected')
        self.assertContains(response, 'value="urgency" selected')
        self.assertContains(response, f"{reverse('careon:case_detail', kwargs={'pk': high_intake.pk})}?tab=plaatsing")
        self.assertEqual(self._queue_titles(response)[:2], ['Casus Priority Crisis', 'Casus Priority Hoog'])

    def test_priority_mode_resend_quick_action_visibility_rules_still_apply(self):
        eligible_intake = self._create_case('Casus Priority Eligible Resend')
        blocked_intake = self._create_case('Casus Priority No Resend')

        self._create_placement(eligible_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=5, deadline_days_after_request=1)
        self._create_placement(blocked_intake, PlacementRequest.ProviderResponseStatus.REJECTED, requested_days_ago=1, deadline_days_after_request=2)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'priority_mode': '1'})

        self.assertEqual(response.status_code, 200)
        rows_by_title = {row['case_title']: row for row in response.context['monitor_queue_rows']}
        self.assertIsNotNone(rows_by_title['Casus Priority Eligible Resend']['resend_action'])
        self.assertIsNone(rows_by_title['Casus Priority No Resend']['resend_action'])

    def test_priority_mode_forced_and_escalated_render_with_emphasis(self):
        forced_intake = self._create_case('Casus Priority Emphasis Forced')
        escalated_intake = self._create_case('Casus Priority Emphasis Escalated')

        self._create_placement(forced_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=6, deadline_days_after_request=9)
        self._create_placement(escalated_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=4, deadline_days_after_request=3)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'priority_mode': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'prioriteit actief')
        self.assertContains(response, 'SLA FORCED_ACTION')
        self.assertContains(response, 'SLA OVERDUE')
        self.assertContains(response, 'Actie nu')

    def test_monitor_excludes_accepted_and_completed_case_items(self):
        accepted_intake = self._create_case('Casus Geaccepteerd')
        completed_intake = self._create_case('Casus Completed', status=CaseIntakeProcess.ProcessStatus.COMPLETED)
        monitored_intake = self._create_case('Casus In Monitor')

        self._create_placement(accepted_intake, PlacementRequest.ProviderResponseStatus.ACCEPTED, requested_days_ago=2)
        self._create_placement(completed_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)
        self._create_placement(monitored_intake, PlacementRequest.ProviderResponseStatus.NO_CAPACITY, requested_days_ago=3)

        monitor = build_provider_response_monitor(self.organization)
        titles = [row['case_title'] for row in monitor['queue_rows']]

        self.assertIn('Casus In Monitor', titles)
        self.assertNotIn('Casus Geaccepteerd', titles)
        self.assertNotIn('Casus Completed', titles)

    def test_monitor_uses_latest_placement_per_case(self):
        intake = self._create_case('Casus Laatste Plaatsing')

        self._create_placement(
            intake,
            PlacementRequest.ProviderResponseStatus.REJECTED,
            requested_days_ago=8,
            deadline_days_after_request=2,
        )
        latest = self._create_placement(
            intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=2,
            deadline_days_after_request=4,
        )

        monitor = build_provider_response_monitor(self.organization)

        self.assertEqual(len(monitor['queue_rows']), 1)
        row = monitor['queue_rows'][0]
        self.assertEqual(row['case_title'], 'Casus Laatste Plaatsing')
        self.assertEqual(row['status'], PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertEqual(row['provider_name'], latest.selected_provider.name)

    def test_monitor_normalizes_legacy_no_response_alias(self):
        intake = self._create_case('Casus Legacy Alias')
        self._create_placement(intake, 'NO_RESPONSE', requested_days_ago=4, deadline_days_after_request=2)

        monitor = build_provider_response_monitor(self.organization)

        self.assertEqual(len(monitor['queue_rows']), 1)
        row = monitor['queue_rows'][0]
        self.assertEqual(row['status'], PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertTrue(row['flags']['is_waiting'])

    def test_monitor_rows_deep_link_to_case_placement_tab(self):
        intake = self._create_case('Casus Deep Link')
        self._create_placement(intake, PlacementRequest.ProviderResponseStatus.NEEDS_INFO, requested_days_ago=3)

        response = self.client.get(reverse('careon:provider_response_monitor'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing")

    def test_monitor_filters_queue_by_urgency(self):
        crisis_intake = self._create_case('Casus Crisis', urgency=CaseIntakeProcess.Urgency.CRISIS)
        medium_intake = self._create_case('Casus Medium', urgency=CaseIntakeProcess.Urgency.MEDIUM)
        self._create_placement(crisis_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)
        self._create_placement(medium_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'urgency': 'CRISIS'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casus Crisis')
        self.assertNotContains(response, 'Casus Medium')

    def test_monitor_filters_queue_by_provider_response_status(self):
        pending_intake = self._create_case('Casus Pending')
        waitlist_intake = self._create_case('Casus Waitlist')
        self._create_placement(pending_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)
        self._create_placement(waitlist_intake, PlacementRequest.ProviderResponseStatus.WAITLIST, requested_days_ago=2)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'provider_response_status': 'WAITLIST'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casus Waitlist')
        self.assertNotContains(response, 'Casus Pending')

    def test_monitor_filters_queue_by_region(self):
        north_region = self._create_region(name='GGD Noord', code='GGD-NOORD')
        west_region = self._create_region(name='GGD West', code='GGD-WEST')
        north_intake = self._create_case('Casus Noord', region=north_region)
        west_intake = self._create_case('Casus West', region=west_region)
        self._create_placement(north_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)
        self._create_placement(west_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'region': str(north_region.pk)})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casus Noord')
        self.assertNotContains(response, 'Casus West')

    def test_monitor_filters_queue_overdue_only(self):
        overdue_intake = self._create_case('Casus Overdue Only')
        fresh_intake = self._create_case('Casus Fresh')
        self._create_placement(overdue_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=5, deadline_days_after_request=1)
        self._create_placement(fresh_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=1, deadline_days_after_request=4)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'overdue_only': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casus Overdue Only')
        self.assertNotContains(response, 'Casus Fresh')

    def test_monitor_filters_queue_rematch_recommended_only(self):
        rematch_intake = self._create_case('Casus Hermatch')
        waiting_intake = self._create_case('Casus Wachtend Filter')
        self._create_placement(rematch_intake, PlacementRequest.ProviderResponseStatus.REJECTED, requested_days_ago=2)
        self._create_placement(waiting_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'rematch_recommended_only': '1'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casus Hermatch')
        self.assertNotContains(response, 'Casus Wachtend Filter')

    def test_monitor_free_text_search_matches_case_id_client_and_provider(self):
        client = CareProvider.objects.create(
            organization=self.organization,
            name='Client Zoeknaam',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        case_record = self._create_case_record(title='Clientlabel Zoekdossier', client=client)
        searchable_intake = self._create_case('Casus Zoekbaar', contract=case_record)
        other_intake = self._create_case('Casus Onzichtbaar')
        other_provider = CareProvider.objects.create(
            organization=self.organization,
            name='Andere Aanbieder',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self._create_placement(searchable_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)
        self._create_placement(other_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2, provider=other_provider)

        provider_response = self.client.get(reverse('careon:provider_response_monitor'), {'q': 'Monitor Provider'})
        client_response = self.client.get(reverse('careon:provider_response_monitor'), {'q': 'Client Zoeknaam'})
        case_id_response = self.client.get(reverse('careon:provider_response_monitor'), {'q': str(searchable_intake.pk)})

        for response in (provider_response, client_response, case_id_response):
            self.assertEqual(response.status_code, 200)
            self.assertContains(response, 'Casus Zoekbaar')
            self.assertNotContains(response, 'Casus Onzichtbaar')

    def test_monitor_reset_behavior_and_rendered_filter_state(self):
        region = self._create_region(name='GGD Reset', code='GGD-RESET')
        intake = self._create_case('Casus Reset', urgency=CaseIntakeProcess.Urgency.HIGH, region=region)
        self._create_placement(intake, PlacementRequest.ProviderResponseStatus.WAITLIST, requested_days_ago=4)

        response = self.client.get(
            reverse('careon:provider_response_monitor'),
            {
                'q': 'Casus Reset',
                'urgency': 'HIGH',
                'provider_response_status': 'WAITLIST',
                'region': str(region.pk),
                'overdue_only': '1',
                'rematch_recommended_only': '1',
                'sort': 'urgency',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'value="Casus Reset"')
        self.assertContains(response, 'value="HIGH" selected')
        self.assertContains(response, 'value="WAITLIST" selected')
        self.assertContains(response, f'value="{region.pk}" selected')
        self.assertContains(response, 'value="urgency" selected')
        self.assertContains(response, 'href="/care/regiekamer/provider-responses/"')

    def test_monitor_status_filter_accepts_legacy_alias_query_values(self):
        alias_intake = self._create_case('Casus Alias Filter')
        waitlist_intake = self._create_case('Casus Andere Status')
        self._create_placement(alias_intake, 'NO_RESPONSE', requested_days_ago=4, deadline_days_after_request=2)
        self._create_placement(waitlist_intake, PlacementRequest.ProviderResponseStatus.WAITLIST, requested_days_ago=2)

        response = self.client.get(reverse('careon:provider_response_monitor'), {'provider_response_status': 'NO_RESPONSE'})

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Casus Alias Filter')
        self.assertNotContains(response, 'Casus Andere Status')

    def test_filtered_monitor_queue_links_still_point_to_placement_tab(self):
        intake = self._create_case('Casus Filtered Deep Link', urgency=CaseIntakeProcess.Urgency.HIGH)
        self._create_placement(intake, PlacementRequest.ProviderResponseStatus.REJECTED, requested_days_ago=2)

        response = self.client.get(
            reverse('careon:provider_response_monitor'),
            {'urgency': 'HIGH', 'rematch_recommended_only': '1'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing")

    def test_monitor_shows_resend_quick_action_only_for_eligible_rows(self):
        resend_intake = self._create_case('Casus Herinnering Toegestaan')
        blocked_intake = self._create_case('Casus Herinnering Geblokkeerd')
        self._create_placement(
            resend_intake,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
            requested_days_ago=4,
        )
        self._create_placement(
            blocked_intake,
            PlacementRequest.ProviderResponseStatus.REJECTED,
            requested_days_ago=2,
        )

        response = self.client.get(reverse('careon:provider_response_monitor'))

        self.assertEqual(response.status_code, 200)
        rows_by_title = {row['case_title']: row for row in response.context['monitor_queue_rows']}
        self.assertIsNotNone(rows_by_title['Casus Herinnering Toegestaan']['resend_action'])
        self.assertIsNone(rows_by_title['Casus Herinnering Geblokkeerd']['resend_action'])
        self.assertContains(response, 'Herstuur', count=1)

    def test_monitor_hides_resend_quick_action_without_edit_permission(self):
        self.client.logout()
        self._login_member()
        intake = self._create_case('Casus Geen Rechten')
        self._create_placement(
            intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=3,
        )

        response = self.client.get(reverse('careon:provider_response_monitor'))

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.context['monitor_queue_rows'][0]['resend_action'])
        self.assertNotContains(response, 'Herstuur')

    def test_monitor_resend_quick_action_returns_to_filtered_monitor_and_updates_row(self):
        intake = self._create_case('Casus Monitor Resend', urgency=CaseIntakeProcess.Urgency.HIGH)
        placement = self._create_placement(
            intake,
            PlacementRequest.ProviderResponseStatus.WAITLIST,
            requested_days_ago=5,
            deadline_days_after_request=1,
        )
        expected_next = (
            f"{reverse('careon:provider_response_monitor')}?q=Casus+Monitor+Resend"
            '&urgency=HIGH&sort=urgency'
        )

        response = self.client.post(
            reverse('careon:case_provider_response_action', kwargs={'pk': intake.pk}),
            {
                'action': 'resend_request',
                'next': expected_next,
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.redirect_chain)
        self.assertTrue(response.redirect_chain[-1][0].endswith(expected_next))
        self.assertContains(response, 'Verzoek opnieuw verstuurd naar aanbieder')

        placement.refresh_from_db()
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertIsNotNone(placement.provider_response_requested_at)
        self.assertTrue(
            AuditLog.objects.filter(
                model_name='PlacementRequest',
                action=AuditLog.Action.UPDATE,
                object_id=placement.id,
                changes__provider_response_action='resend_request',
            ).exists()
        )

        self.assertEqual(self._queue_titles(response), ['Casus Monitor Resend'])
        refreshed_row = response.context['monitor_queue_rows'][0]
        self.assertEqual(refreshed_row['status'], PlacementRequest.ProviderResponseStatus.PENDING)
        self.assertEqual(refreshed_row['age_days'], 0)
        self.assertIsNotNone(refreshed_row['resend_action'])
        self.assertContains(response, 'Monitor voortgang')
        self.assertContains(response, 'SLA ON_TRACK')

    def test_monitor_default_triage_sort_prioritizes_overdue_then_rematch_then_urgency_then_age(self):
        overdue_intake = self._create_case('Casus Overdue Laag', urgency=CaseIntakeProcess.Urgency.LOW)
        rematch_intake = self._create_case('Casus Hermatch Hoog', urgency=CaseIntakeProcess.Urgency.HIGH)
        crisis_older_intake = self._create_case('Casus Crisis Oud', urgency=CaseIntakeProcess.Urgency.CRISIS)
        crisis_newer_intake = self._create_case('Casus Crisis Nieuw', urgency=CaseIntakeProcess.Urgency.CRISIS)

        self._create_placement(
            overdue_intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=5,
            deadline_days_after_request=1,
        )
        self._create_placement(rematch_intake, PlacementRequest.ProviderResponseStatus.REJECTED, requested_days_ago=2)
        self._create_placement(
            crisis_older_intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=6,
            deadline_days_after_request=10,
        )
        self._create_placement(
            crisis_newer_intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=3,
            deadline_days_after_request=10,
        )

        response = self.client.get(reverse('careon:provider_response_monitor'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._queue_titles(response),
            [
                'Casus Crisis Oud',
                'Casus Overdue Laag',
                'Casus Crisis Nieuw',
                'Casus Hermatch Hoog',
            ],
        )

    def test_monitor_oldest_waiting_sort_uses_wait_time_as_primary_order(self):
        crisis_newer_intake = self._create_case('Casus Crisis Nieuw', urgency=CaseIntakeProcess.Urgency.CRISIS)
        medium_oldest_intake = self._create_case('Casus Medium Oudst', urgency=CaseIntakeProcess.Urgency.MEDIUM)
        overdue_mid_intake = self._create_case('Casus Overdue Midden', urgency=CaseIntakeProcess.Urgency.LOW)

        self._create_placement(crisis_newer_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=3)
        self._create_placement(medium_oldest_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=8)
        self._create_placement(
            overdue_mid_intake,
            PlacementRequest.ProviderResponseStatus.PENDING,
            requested_days_ago=5,
            deadline_days_after_request=1,
        )

        response = self.client.get(reverse('careon:provider_response_monitor'), {'sort': 'oldest_waiting'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._queue_titles(response),
            [
                'Casus Medium Oudst',
                'Casus Overdue Midden',
                'Casus Crisis Nieuw',
            ],
        )

    def test_monitor_urgency_sort_uses_urgency_as_primary_order_after_filters(self):
        crisis_intake = self._create_case('Casus Crisis Filter', urgency=CaseIntakeProcess.Urgency.CRISIS)
        high_intake = self._create_case('Casus Hoog Filter', urgency=CaseIntakeProcess.Urgency.HIGH)
        medium_intake = self._create_case('Casus Medium Filter', urgency=CaseIntakeProcess.Urgency.MEDIUM)

        self._create_placement(crisis_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=2)
        self._create_placement(high_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=6)
        self._create_placement(medium_intake, PlacementRequest.ProviderResponseStatus.PENDING, requested_days_ago=4)

        response = self.client.get(
            reverse('careon:provider_response_monitor'),
            {
                'provider_response_status': 'PENDING',
                'sort': 'urgency',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self._queue_titles(response),
            [
                'Casus Crisis Filter',
                'Casus Hoog Filter',
                'Casus Medium Filter',
            ],
        )
