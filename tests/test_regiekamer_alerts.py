"""Tests for the Regiekamer alert engine and view.

Coverage:
- Alert generation from case evaluation output
- Deduplication: only one unresolved alert per (case, alert_type)
- Stale alert resolution when condition no longer holds
- Regiekamer list view: grouped by severity, summary cards
- Resolve alert endpoint
- build_regiekamer_summary aggregation
"""
from datetime import timedelta

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.alert_engine import (
    build_regiekamer_summary,
    generate_alerts_for_case,
)
from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    MunicipalityConfiguration,
    OperationalAlert,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    RegionalConfiguration,
    RegionType,
)


class AlertEngineTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Alert Test Org', slug='alert-test-org')
        self.user = User.objects.create_user(
            username='alert_tester',
            password='testpass123',
        )
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

    def _make_intake(self, urgency=CaseIntakeProcess.Urgency.MEDIUM, status=CaseIntakeProcess.ProcessStatus.INTAKE):
        return CaseIntakeProcess.objects.create(
            organization=self.org,
            title='Test Casus',
            status=status,
            urgency=urgency,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=timezone.now().date(),
            target_completion_date=timezone.now().date() + timedelta(days=30),
        )

    def test_generate_alerts_returns_list(self):
        intake = self._make_intake()
        alerts = generate_alerts_for_case(intake)
        self.assertIsInstance(alerts, list)

    def test_urgent_unmatched_alert_created_for_high_urgency_without_matching(self):
        intake = self._make_intake(urgency=CaseIntakeProcess.Urgency.HIGH)
        alerts = generate_alerts_for_case(intake)
        types = [a.alert_type for a in alerts]
        self.assertIn(OperationalAlert.AlertType.URGENT_UNMATCHED_CASE, types)

    def test_urgent_unmatched_alert_severity_is_high(self):
        intake = self._make_intake(urgency=CaseIntakeProcess.Urgency.HIGH)
        generate_alerts_for_case(intake)
        alert = OperationalAlert.objects.get(
            case=intake,
            alert_type=OperationalAlert.AlertType.URGENT_UNMATCHED_CASE,
        )
        self.assertEqual(alert.severity, OperationalAlert.Severity.HIGH)

    def test_no_urgent_unmatched_alert_for_low_urgency(self):
        intake = self._make_intake(urgency=CaseIntakeProcess.Urgency.LOW)
        alerts = generate_alerts_for_case(intake)
        types = [a.alert_type for a in alerts]
        self.assertNotIn(OperationalAlert.AlertType.URGENT_UNMATCHED_CASE, types)

    def test_deduplication_does_not_create_duplicate_unresolved_alerts(self):
        intake = self._make_intake(urgency=CaseIntakeProcess.Urgency.HIGH)
        generate_alerts_for_case(intake)
        generate_alerts_for_case(intake)
        count = OperationalAlert.objects.filter(
            case=intake,
            alert_type=OperationalAlert.AlertType.URGENT_UNMATCHED_CASE,
            resolved_at__isnull=True,
        ).count()
        self.assertEqual(count, 1)

    def test_stale_alert_resolved_when_condition_no_longer_holds(self):
        # Create a high-urgency case → generates urgent_unmatched alert
        intake = self._make_intake(urgency=CaseIntakeProcess.Urgency.HIGH)
        generate_alerts_for_case(intake)

        # Downgrade urgency to low → alert should be resolved
        intake.urgency = CaseIntakeProcess.Urgency.LOW
        intake.save()
        generate_alerts_for_case(intake)

        alert = OperationalAlert.objects.get(
            case=intake,
            alert_type=OperationalAlert.AlertType.URGENT_UNMATCHED_CASE,
        )
        self.assertIsNotNone(alert.resolved_at)
        self.assertTrue(alert.is_resolved)

    def test_missing_critical_data_alert_when_care_category_missing(self):
        intake = self._make_intake()
        # intake has no care_category_main → missing_critical_data alert expected
        generate_alerts_for_case(intake)
        has_missing_data = OperationalAlert.objects.filter(
            case=intake,
            alert_type=OperationalAlert.AlertType.MISSING_CRITICAL_DATA,
            resolved_at__isnull=True,
        ).exists()
        self.assertTrue(has_missing_data)

    def test_placement_stalled_alert_created(self):
        intake = self._make_intake(status=CaseIntakeProcess.ProcessStatus.MATCHING)
        stalled_date = timezone.now() - timedelta(days=10)
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
        )
        # Manually set updated_at to simulate stall
        PlacementRequest.objects.filter(due_diligence_process=intake).update(updated_at=stalled_date)

        generate_alerts_for_case(intake)
        has_stalled = OperationalAlert.objects.filter(
            case=intake,
            alert_type=OperationalAlert.AlertType.PLACEMENT_STALLED,
            resolved_at__isnull=True,
        ).exists()
        self.assertTrue(has_stalled)

    def test_is_resolved_property(self):
        intake = self._make_intake()
        alert = OperationalAlert.objects.create(
            case=intake,
            alert_type=OperationalAlert.AlertType.MISSING_CRITICAL_DATA,
            severity=OperationalAlert.Severity.HIGH,
            title='Test',
            description='Test',
            recommended_action='Fix it',
        )
        self.assertFalse(alert.is_resolved)
        alert.resolved_at = timezone.now()
        alert.save()
        alert.refresh_from_db()
        self.assertTrue(alert.is_resolved)


class BuildRegiekamerSummaryTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Summary Org', slug='summary-org')
        self.user = User.objects.create_user(username='sum_user', password='pass')
        OrganizationMembership.objects.create(
            organization=self.org, user=self.user,
            role=OrganizationMembership.Role.MEMBER, is_active=True,
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='Summary Casus',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=timezone.now().date(),
            target_completion_date=timezone.now().date() + timedelta(days=30),
        )

    def _make_alert(self, alert_type, severity=OperationalAlert.Severity.HIGH):
        return OperationalAlert.objects.create(
            case=self.intake,
            alert_type=alert_type,
            severity=severity,
            title='Test',
            description='Test',
            recommended_action='Fix',
        )

    def test_summary_counts_urgent_unmatched(self):
        self._make_alert(OperationalAlert.AlertType.URGENT_UNMATCHED_CASE)
        summary = build_regiekamer_summary(self.org)
        self.assertEqual(summary['urgent_unmatched'], 1)

    def test_summary_counts_stalled_placements(self):
        self._make_alert(OperationalAlert.AlertType.PLACEMENT_STALLED)
        summary = build_regiekamer_summary(self.org)
        self.assertEqual(summary['stalled_placements'], 1)

    def test_summary_excludes_resolved_alerts(self):
        alert = self._make_alert(OperationalAlert.AlertType.URGENT_UNMATCHED_CASE)
        alert.resolved_at = timezone.now()
        alert.save()
        summary = build_regiekamer_summary(self.org)
        self.assertEqual(summary['urgent_unmatched'], 0)

    def test_summary_total_includes_all_unresolved(self):
        self._make_alert(OperationalAlert.AlertType.URGENT_UNMATCHED_CASE)
        self._make_alert(OperationalAlert.AlertType.PLACEMENT_STALLED)
        summary = build_regiekamer_summary(self.org)
        self.assertEqual(summary['total'], 2)


class RegiekamerAlertViewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.org = Organization.objects.create(name='View Org', slug='view-org')
        self.user = User.objects.create_user(username='view_user', password='pass')
        OrganizationMembership.objects.create(
            organization=self.org, user=self.user,
            role=OrganizationMembership.Role.OWNER, is_active=True,
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='View Casus',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=timezone.now().date(),
            target_completion_date=timezone.now().date() + timedelta(days=30),
        )
        self.alert = OperationalAlert.objects.create(
            case=self.intake,
            alert_type=OperationalAlert.AlertType.URGENT_UNMATCHED_CASE,
            severity=OperationalAlert.Severity.HIGH,
            title='Urgente casus wacht op matching',
            description='Matching niet uitgevoerd.',
            recommended_action='Start matching.',
        )
        self.client.login(username='view_user', password='pass')

    def test_regiekamer_view_returns_200(self):
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertEqual(response.status_code, 200)

    def test_regiekamer_view_contains_alert_title(self):
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertContains(response, 'Urgente casus wacht op matching')

    def test_regiekamer_view_summary_counts_present(self):
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertIn('summary', response.context)
        self.assertGreaterEqual(response.context['summary']['total'], 1)

    def test_regiekamer_view_requires_login(self):
        self.client.logout()
        response = self.client.get(reverse('careon:regiekamer_alerts'))
        self.assertNotEqual(response.status_code, 200)

    def test_resolve_alert_marks_resolved(self):
        response = self.client.post(
            reverse('careon:resolve_alert', kwargs={'pk': self.alert.pk}),
        )
        self.assertIn(response.status_code, [200, 302])
        self.alert.refresh_from_db()
        self.assertTrue(self.alert.is_resolved)

    def test_resolve_alert_requires_post(self):
        response = self.client.get(
            reverse('careon:resolve_alert', kwargs={'pk': self.alert.pk}),
        )
        self.assertEqual(response.status_code, 405)

    def test_resolve_alert_requires_login(self):
        self.client.logout()
        response = self.client.post(
            reverse('careon:resolve_alert', kwargs={'pk': self.alert.pk}),
        )
        self.assertNotEqual(response.status_code, 200)
        self.alert.refresh_from_db()
        self.assertFalse(self.alert.is_resolved)

    def test_show_resolved_filter(self):
        self.alert.resolved_at = timezone.now()
        self.alert.save()
        response = self.client.get(
            reverse('careon:regiekamer_alerts') + '?show_resolved=1'
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Urgente casus wacht op matching')
