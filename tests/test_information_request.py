"""Deterministic tests for the CaseInformationRequest resolution loop.

Tests verify:
1. needs_more_info evaluation creates an information request automatically.
2. Repeated needs_more_info evaluations update the existing open request.
3. Resolving a request marks it resolved; NBA is no longer blocked.
4. Resubmission marks the request resubmitted and resets PlacementRequest status to PENDING.
5. Stale info requests are flagged in alert_engine (PROVIDER_INFO_STALE alert).
6. Fresh info requests produce PROVIDER_INFO_REQUESTED alert (not stale).
7. Repeated requests for the same case are tracked in observability.
8. Closed requests cannot be resolved/resubmitted again.
9. mark_in_progress works correctly; request stays open.
10. Regiekamer summary counts open info requests.
11. View returns 200 for authenticated operator; info request action dispatches correctly.
"""

from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    CaseInformationRequest,
    CaseIntakeProcess,
    Client as CareProvider,
    OperationalAlert,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderEvaluation,
)
from contracts.provider_evaluation_service import record_provider_evaluation
from contracts.information_request_service import (
    create_or_update_info_request,
    get_all_requests_for_case,
    get_open_requests_for_case,
    mark_info_request_in_progress,
    resolve_info_request,
    resubmit_info_request,
    stale_requests_for_org,
)
from contracts.alert_engine import generate_alerts_for_case, build_regiekamer_summary
from contracts.observability import build_info_request_metrics_report


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_org_user(suffix=""):
    user = User.objects.create_user(username=f"ir_user{suffix}", password="testpass")
    org = Organization.objects.create(name=f"IR Org{suffix}", slug=f"ir-org{suffix}")
    OrganizationMembership.objects.create(
        organization=org, user=user,
        role=OrganizationMembership.Role.OWNER, is_active=True,
    )
    return user, org


def _make_provider(org, user, name="Test Provider"):
    return CareProvider.objects.create(
        organization=org, name=name,
        status=CareProvider.Status.ACTIVE, created_by=user,
    )


def _make_intake(org, user, urgency=CaseIntakeProcess.Urgency.MEDIUM):
    return CaseIntakeProcess.objects.create(
        organization=org,
        title="IR Test Casus",
        status=CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency=urgency,
        preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        start_date=date.today(),
        target_completion_date=date.today() + timedelta(days=14),
        case_coordinator=user,
        assessment_summary="Test samenvatting",
        client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
    )


def _make_placement(intake, provider):
    return PlacementRequest.objects.create(
        due_diligence_process=intake,
        selected_provider=provider,
        status=PlacementRequest.Status.DRAFT,
    )


# ---------------------------------------------------------------------------
# Tests: CaseInformationRequest creation
# ---------------------------------------------------------------------------

class InfoRequestCreationTests(TestCase):
    """Verifies that needs_more_info evaluation creates a CaseInformationRequest."""

    def setUp(self):
        self.user, self.org = _make_org_user("_create")
        self.provider = _make_provider(self.org, self.user)
        self.intake = _make_intake(self.org, self.user)
        self.placement = _make_placement(self.intake, self.provider)

    def test_needs_more_info_creates_info_request(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Stuur het meest recente diagnoserapport.",
        )
        requests = get_open_requests_for_case(self.intake)
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0].status, CaseInformationRequest.Status.OPEN)
        self.assertEqual(requests[0].requested_info_text, "Stuur het meest recente diagnoserapport.")
        self.assertEqual(requests[0].provider, self.provider)

    def test_accept_does_not_create_info_request(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.ACCEPT,
        )
        requests = get_open_requests_for_case(self.intake)
        self.assertEqual(len(requests), 0)

    def test_reject_does_not_create_info_request(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.REJECT,
            reason_code=ProviderEvaluation.RejectionCode.NO_CAPACITY,
        )
        requests = get_open_requests_for_case(self.intake)
        self.assertEqual(len(requests), 0)

    def test_repeated_needs_more_info_updates_existing_request(self):
        """Two consecutive needs_more_info evaluations should produce only one open request."""
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Eerste verzoek.",
        )
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Tweede verzoek – aanvullend.",
        )
        all_requests = get_all_requests_for_case(self.intake)
        open_requests = get_open_requests_for_case(self.intake)
        # Exactly one open request (updated)
        self.assertEqual(len(open_requests), 1)
        self.assertEqual(open_requests[0].requested_info_text, "Tweede verzoek – aanvullend.")
        # Still only one record total (upsert, not append)
        self.assertEqual(len(all_requests), 1)

    def test_info_request_linked_to_evaluation(self):
        evaluation = record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Koppelingstest.",
        )
        req = get_open_requests_for_case(self.intake)[0]
        self.assertEqual(req.evaluation_id, evaluation.pk)


# ---------------------------------------------------------------------------
# Tests: resolve and resubmit
# ---------------------------------------------------------------------------

class InfoRequestResolutionTests(TestCase):
    """Verifies resolve and resubmit lifecycle transitions."""

    def setUp(self):
        self.user, self.org = _make_org_user("_resolve")
        self.provider = _make_provider(self.org, self.user)
        self.intake = _make_intake(self.org, self.user)
        self.placement = _make_placement(self.intake, self.provider)
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Lever diagnoserapport aan.",
        )
        self.req = get_open_requests_for_case(self.intake)[0]

    def test_resolve_closes_request(self):
        resolve_info_request(
            request_obj=self.req,
            operator_response="Diagnoserapport aangeleverd via SFTP.",
            resolved_by_id=self.user.id,
        )
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, CaseInformationRequest.Status.RESOLVED)
        self.assertIsNotNone(self.req.resolved_at)
        self.assertEqual(self.req.resolved_by_id, self.user.id)
        self.assertEqual(self.req.operator_response, "Diagnoserapport aangeleverd via SFTP.")

    def test_resolve_removes_from_open_list(self):
        resolve_info_request(
            request_obj=self.req,
            operator_response="Informatie geleverd.",
            resolved_by_id=self.user.id,
        )
        self.assertEqual(len(get_open_requests_for_case(self.intake)), 0)

    def test_resubmit_marks_request_resubmitted(self):
        resubmit_info_request(
            request_obj=self.req,
            operator_response="Volledig dossier aangeleverd.",
            resolved_by_id=self.user.id,
        )
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, CaseInformationRequest.Status.RESUBMITTED)
        self.assertIsNotNone(self.req.resolved_at)

    def test_resubmit_resets_placement_status_to_pending(self):
        """Resubmission must reset provider_response_status so evaluation loop restarts."""
        resubmit_info_request(
            request_obj=self.req,
            operator_response="Dossier aangeleverd voor herbeoordeling.",
            resolved_by_id=self.user.id,
        )
        self.placement.refresh_from_db()
        self.assertEqual(
            self.placement.provider_response_status,
            PlacementRequest.ProviderResponseStatus.PENDING,
        )

    def test_double_resolve_raises_value_error(self):
        resolve_info_request(
            request_obj=self.req,
            operator_response="Eerste oplossing.",
            resolved_by_id=self.user.id,
        )
        self.req.refresh_from_db()
        with self.assertRaises(ValueError):
            resolve_info_request(
                request_obj=self.req,
                operator_response="Tweede poging.",
                resolved_by_id=self.user.id,
            )

    def test_resubmit_after_resolve_raises_value_error(self):
        resolve_info_request(
            request_obj=self.req,
            operator_response="Informatie geleverd.",
            resolved_by_id=self.user.id,
        )
        self.req.refresh_from_db()
        with self.assertRaises(ValueError):
            resubmit_info_request(
                request_obj=self.req,
                operator_response="Te laat.",
                resolved_by_id=self.user.id,
            )

    def test_mark_in_progress_keeps_request_open(self):
        mark_info_request_in_progress(
            request_obj=self.req,
            operator_response="Bezig met ophalen van documenten.",
            updated_by_id=self.user.id,
        )
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, CaseInformationRequest.Status.IN_PROGRESS)
        self.assertTrue(self.req.is_open)
        self.assertIsNone(self.req.resolved_at)


# ---------------------------------------------------------------------------
# Tests: stale request flagging via alert_engine
# ---------------------------------------------------------------------------

class InfoRequestAlertTests(TestCase):
    """Verifies Regiekamer alert generation for info requests."""

    def setUp(self):
        self.user, self.org = _make_org_user("_alert")
        self.provider = _make_provider(self.org, self.user)
        self.intake = _make_intake(self.org, self.user)
        self.placement = _make_placement(self.intake, self.provider)

    def test_fresh_info_request_generates_provider_info_requested_alert(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Lever extra info aan.",
        )
        alerts = generate_alerts_for_case(self.intake)
        alert_types = {a.alert_type for a in alerts}
        self.assertIn(OperationalAlert.AlertType.PROVIDER_INFO_REQUESTED, alert_types)
        self.assertNotIn(OperationalAlert.AlertType.PROVIDER_INFO_STALE, alert_types)

    def test_stale_info_request_generates_provider_info_stale_alert(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Ontbrekend dossier.",
        )
        # Back-date the request to make it stale
        req = get_open_requests_for_case(self.intake)[0]
        CaseInformationRequest.objects.filter(pk=req.pk).update(
            created_at=timezone.now() - timedelta(days=4)
        )
        alerts = generate_alerts_for_case(self.intake)
        alert_types = {a.alert_type for a in alerts}
        self.assertIn(OperationalAlert.AlertType.PROVIDER_INFO_STALE, alert_types)
        self.assertNotIn(OperationalAlert.AlertType.PROVIDER_INFO_REQUESTED, alert_types)

    def test_resolved_info_request_clears_alert(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Te resolven.",
        )
        generate_alerts_for_case(self.intake)
        req = get_open_requests_for_case(self.intake)[0]
        resolve_info_request(
            request_obj=req,
            operator_response="Opgelost.",
            resolved_by_id=self.user.id,
        )
        alerts = generate_alerts_for_case(self.intake)
        alert_types = {a.alert_type for a in alerts}
        self.assertNotIn(OperationalAlert.AlertType.PROVIDER_INFO_REQUESTED, alert_types)
        self.assertNotIn(OperationalAlert.AlertType.PROVIDER_INFO_STALE, alert_types)

    def test_regiekamer_summary_counts_open_info_requests(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Summary teller test.",
        )
        summary = build_regiekamer_summary(self.org)
        self.assertEqual(summary['open_info_requests'], 1)
        self.assertEqual(summary['stale_info_requests'], 0)

    def test_regiekamer_summary_counts_stale_info_requests(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Stale teller test.",
        )
        req = get_open_requests_for_case(self.intake)[0]
        CaseInformationRequest.objects.filter(pk=req.pk).update(
            created_at=timezone.now() - timedelta(days=5)
        )
        summary = build_regiekamer_summary(self.org)
        self.assertEqual(summary['stale_info_requests'], 1)


# ---------------------------------------------------------------------------
# Tests: stale_requests_for_org helper
# ---------------------------------------------------------------------------

class StaleRequestsQueryTests(TestCase):
    """Tests for the stale_requests_for_org service function."""

    def setUp(self):
        self.user, self.org = _make_org_user("_stale")
        self.provider = _make_provider(self.org, self.user)
        self.intake = _make_intake(self.org, self.user)

    def test_no_stale_requests_for_fresh_org(self):
        results = list(stale_requests_for_org(self.org))
        self.assertEqual(results, [])

    def test_stale_request_returned_after_threshold(self):
        req = CaseInformationRequest.objects.create(
            case=self.intake,
            provider=self.provider,
            requested_info_text="Test",
            status=CaseInformationRequest.Status.OPEN,
        )
        CaseInformationRequest.objects.filter(pk=req.pk).update(
            created_at=timezone.now() - timedelta(days=4)
        )
        results = list(stale_requests_for_org(self.org, threshold_days=3))
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].pk, req.pk)

    def test_fresh_request_not_returned_as_stale(self):
        CaseInformationRequest.objects.create(
            case=self.intake,
            provider=self.provider,
            requested_info_text="Vers verzoek",
            status=CaseInformationRequest.Status.OPEN,
        )
        results = list(stale_requests_for_org(self.org, threshold_days=3))
        self.assertEqual(results, [])

    def test_resolved_request_not_returned_as_stale(self):
        req = CaseInformationRequest.objects.create(
            case=self.intake,
            provider=self.provider,
            requested_info_text="Opgelost",
            status=CaseInformationRequest.Status.RESOLVED,
        )
        CaseInformationRequest.objects.filter(pk=req.pk).update(
            created_at=timezone.now() - timedelta(days=10)
        )
        results = list(stale_requests_for_org(self.org, threshold_days=3))
        self.assertEqual(results, [])


# ---------------------------------------------------------------------------
# Tests: observability metrics
# ---------------------------------------------------------------------------

class InfoRequestObservabilityTests(TestCase):
    """Tests for build_info_request_metrics_report."""

    def setUp(self):
        self.user, self.org = _make_org_user("_obs_ir")
        self.provider = _make_provider(self.org, self.user)
        self.intake = _make_intake(self.org, self.user)

    def test_empty_report_for_new_org(self):
        report = build_info_request_metrics_report(self.org)
        self.assertFalse(report['data_available'])
        self.assertEqual(report['total_open'], 0)

    def test_open_request_counted(self):
        CaseInformationRequest.objects.create(
            case=self.intake,
            provider=self.provider,
            requested_info_text="Test observability.",
            status=CaseInformationRequest.Status.OPEN,
        )
        report = build_info_request_metrics_report(self.org)
        self.assertTrue(report['data_available'])
        self.assertEqual(report['total_open'], 1)
        self.assertEqual(report['total_resolved'], 0)

    def test_repeated_requests_tracked(self):
        """Two open requests for the same case appear in repeated_request_cases."""
        CaseInformationRequest.objects.create(
            case=self.intake,
            provider=self.provider,
            requested_info_text="Verzoek 1",
            status=CaseInformationRequest.Status.RESOLVED,
            resolved_at=timezone.now(),
        )
        CaseInformationRequest.objects.create(
            case=self.intake,
            provider=self.provider,
            requested_info_text="Verzoek 2",
            status=CaseInformationRequest.Status.OPEN,
        )
        report = build_info_request_metrics_report(self.org)
        self.assertTrue(report['data_available'])
        repeated = report['repeated_request_cases']
        self.assertEqual(len(repeated), 1)
        self.assertEqual(repeated[0]['case_id'], self.intake.pk)
        self.assertEqual(repeated[0]['request_count'], 2)

    def test_average_resolution_hours_computed(self):
        now = timezone.now()
        req = CaseInformationRequest.objects.create(
            case=self.intake,
            provider=self.provider,
            requested_info_text="Snelle oplossing.",
            status=CaseInformationRequest.Status.RESOLVED,
            resolved_at=now,
        )
        # Back-date created_at to simulate 4-hour resolution
        CaseInformationRequest.objects.filter(pk=req.pk).update(
            created_at=now - timedelta(hours=4)
        )
        report = build_info_request_metrics_report(self.org)
        self.assertIsNotNone(report['average_resolution_hours'])
        self.assertAlmostEqual(report['average_resolution_hours'], 4.0, delta=0.2)

    def test_providers_with_most_requests_listed(self):
        provider2 = _make_provider(self.org, self.user, name="Provider B")
        intake2 = _make_intake(self.org, self.user)
        CaseInformationRequest.objects.create(
            case=self.intake, provider=self.provider,
            requested_info_text="A1", status=CaseInformationRequest.Status.OPEN,
        )
        CaseInformationRequest.objects.create(
            case=intake2, provider=self.provider,
            requested_info_text="A2", status=CaseInformationRequest.Status.OPEN,
        )
        CaseInformationRequest.objects.create(
            case=intake2, provider=provider2,
            requested_info_text="B1", status=CaseInformationRequest.Status.OPEN,
        )
        report = build_info_request_metrics_report(self.org)
        providers = report['providers_with_most_requests']
        self.assertGreaterEqual(len(providers), 1)
        top = providers[0]
        self.assertEqual(top['provider_id'], self.provider.pk)
        self.assertEqual(top['total_requests'], 2)


# ---------------------------------------------------------------------------
# Tests: view access
# ---------------------------------------------------------------------------

class InfoRequestViewTests(TestCase):
    """Tests that the info request views are accessible and secured."""

    def setUp(self):
        self.user, self.org = _make_org_user("_view_ir")
        self.provider = _make_provider(self.org, self.user)
        self.intake = _make_intake(self.org, self.user)
        self.placement = _make_placement(self.intake, self.provider)

    def test_info_request_view_redirects_unauthenticated(self):
        response = self.client.get(
            reverse("careon:case_info_request", kwargs={"pk": self.intake.pk})
        )
        self.assertIn(response.status_code, [302, 403])

    def test_info_request_view_200_when_no_open_request(self):
        # GET to /care/casussen/<pk>/info-aanvraag/ is intercepted by SpaShellMigrationMiddleware
        # (same as all /care/casussen/* GET routes). The SPA handles rendering.
        # Verify the route is reachable and authenticated (not 403/404).
        self.client.login(username="ir_user_view_ir", password="testpass")
        response = self.client.get(
            reverse("careon:case_info_request", kwargs={"pk": self.intake.pk})
        )
        self.assertEqual(response.status_code, 200)

    def test_info_request_view_200_with_open_request(self):
        # GET route is SPA-intercepted; assert 200 (not 404/403) with an active request.
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Lever het diagnoserapport aan.",
        )
        self.client.login(username="ir_user_view_ir", password="testpass")
        response = self.client.get(
            reverse("careon:case_info_request", kwargs={"pk": self.intake.pk})
        )
        self.assertEqual(response.status_code, 200)

    def test_resubmit_action_post_succeeds(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="POST test.",
        )
        req = get_open_requests_for_case(self.intake)[0]
        self.client.login(username="ir_user_view_ir", password="testpass")
        response = self.client.post(
            reverse("careon:case_info_request_action", kwargs={"pk": self.intake.pk}),
            {
                "request_id": req.pk,
                "operator_response": "Volledig dossier aangeleverd.",
                "action": "resubmit",
            },
        )
        # Should redirect back to case detail on success
        self.assertIn(response.status_code, [302, 200])
        req.refresh_from_db()
        self.assertEqual(req.status, CaseInformationRequest.Status.RESUBMITTED)

    def test_action_missing_operator_response_shows_error(self):
        record_provider_evaluation(
            intake=self.intake,
            provider=self.provider,
            placement=self.placement,
            decision=ProviderEvaluation.Decision.NEEDS_MORE_INFO,
            requested_info="Fouttest.",
        )
        req = get_open_requests_for_case(self.intake)[0]
        self.client.login(username="ir_user_view_ir", password="testpass")
        response = self.client.post(
            reverse("careon:case_info_request_action", kwargs={"pk": self.intake.pk}),
            {
                "request_id": req.pk,
                "operator_response": "",
                "action": "resolve",
            },
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        req.refresh_from_db()
        # Request should still be open — not resolved
        self.assertTrue(req.is_open)
