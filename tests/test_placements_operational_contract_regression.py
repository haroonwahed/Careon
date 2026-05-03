import re
from datetime import date, timedelta
from unittest.mock import patch

from django.conf import settings as django_settings
from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.urls import reverse

_MIDDLEWARE_WITHOUT_SPA_SHELL = [
    m for m in django_settings.MIDDLEWARE
    if m != 'contracts.middleware.SpaShellMigrationMiddleware'
]

from contracts.models import (
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
)


User = get_user_model()


class _FakeDecision:
    def __init__(self, payload):
        self._payload = payload

    def to_dict(self):
        return self._payload


@override_settings(MIDDLEWARE=_MIDDLEWARE_WITHOUT_SPA_SHELL)
class PlaatsingenOperationalContractRegressionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="placements-regression-user",
            email="placements-regression@example.com",
            password="testpass123",
        )
        cls.organization = Organization.objects.create(name="Plaatsingen Regression Org", slug="plaatsingen-reg-org")
        OrganizationMembership.objects.create(
            organization=cls.organization,
            user=cls.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

    def setUp(self):
        self.client = Client()
        self.client.login(username="placements-regression-user", password="testpass123")

    def _create_intake(self, title="Plaatsing Casus", *, urgency=CaseIntakeProcess.Urgency.MEDIUM):
        return CaseIntakeProcess.objects.create(
            organization=self.organization,
            title=title,
            status=CaseIntakeProcess.ProcessStatus.DECISION,
            urgency=urgency,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=14),
            case_coordinator=self.user,
        )

    def _create_provider(self, name):
        return CareProvider.objects.create(
            organization=self.organization,
            name=name,
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )

    def _create_placement(
        self,
        title,
        *,
        status=PlacementRequest.Status.IN_REVIEW,
        provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        provider_name="Aanbieder",
    ):
        intake = self._create_intake(title=title)
        provider = self._create_provider(provider_name)
        placement = PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=provider,
            selected_provider=provider,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
            start_date=date.today() + timedelta(days=7),
            status=status,
            provider_response_status=provider_response_status,
        )
        return intake, placement

    def _decision_payload(self, intake_id, **overrides):
        payload = {
            "case_id": intake_id,
            "recommended_action": {
                "label": "Neem contact op met aanbieder",
                "reason": "SLA risico door uitblijvende reactie",
                "url": reverse("careon:placement_list"),
            },
            "impact_summary": {
                "text": "Voorkomt verdere vertraging in plaatsing",
                "type": "protective",
            },
            "attention_band": "today",
            "priority_band": "soon",
            "priority_rank": 11,
            "bottleneck_state": "placement",
            "blocker_label": "Plaatsing stagneert door aanbiederreactie",
            "escalation_recommended": False,
            "provider_response_state": "pending",
        }
        payload.update(overrides)
        return payload

    def test_stalled_placement_includes_reason_from_shared_decision_logic(self):
        intake, _ = self._create_placement(
            "Stalled Placement Casus",
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )
        payload = self._decision_payload(
            intake.pk,
            blocker_label="Contract reason: aanbiederreactie buiten reactievenster",
        )

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)) as decision_mock:
            response = self.client.get(reverse("careon:placement_list"))

        self.assertEqual(response.status_code, 200)
        decision_mock.assert_called_once_with(intake.pk)
        self.assertContains(response, "Contract reason: aanbiederreactie buiten reactievenster")

    def test_every_stalled_or_risky_state_has_recommended_action_and_no_dead_end(self):
        intake_pending, _ = self._create_placement(
            "Pending Placement",
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_name="Pending Provider",
        )
        intake_waitlist, _ = self._create_placement(
            "Waitlist Placement",
            provider_response_status=PlacementRequest.ProviderResponseStatus.WAITLIST,
            provider_name="Waitlist Provider",
        )

        payload_pending = self._decision_payload(
            intake_pending.pk,
            recommended_action={
                "label": "Stuur herinnering",
                "reason": "Reactie nog uitstaand",
                "url": reverse("careon:placement_list"),
            },
        )
        payload_waitlist = self._decision_payload(
            intake_waitlist.pk,
            recommended_action={
                "label": "Start rematch",
                "reason": "Aanbieder meldt wachtlijst",
                "url": reverse("careon:matching_dashboard"),
            },
        )

        def fake_decision(intake_id):
            if intake_id == intake_pending.pk:
                return _FakeDecision(payload_pending)
            return _FakeDecision(payload_waitlist)

        with patch("contracts.views.build_operational_decision_for_intake", side_effect=fake_decision):
            response = self.client.get(reverse("careon:placement_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Stuur herinnering")
        self.assertContains(response, "Start rematch")
        self.assertNotContains(response, "Geen vervolgstap beschikbaar")

    def test_recommended_action_is_always_paired_with_impact_summary(self):
        intake, _ = self._create_placement("Action Impact Placement")
        payload = self._decision_payload(
            intake.pk,
            recommended_action={
                "label": "Escaleren naar plaatsingsregisseur",
                "reason": "Herhaalde vertraging",
                "url": reverse("careon:placement_list"),
            },
            impact_summary={
                "text": "Versnelt besluitvorming bij stagnerende plaatsing",
                "type": "accelerating",
            },
        )

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:placement_list"))

        self.assertEqual(response.status_code, 200)
        rows_by_title = {row["placement"].intake.title: row for row in response.context["placement_rows"]}
        row = rows_by_title["Action Impact Placement"]
        self.assertEqual(row["recommended_action"]["label"], "Escaleren naar plaatsingsregisseur")
        self.assertEqual(row["impact_summary"]["text"], "Versnelt besluitvorming bij stagnerende plaatsing")
        self.assertContains(response, "Escaleren naar plaatsingsregisseur")
        self.assertNotContains(response, "Versnelt besluitvorming bij stagnerende plaatsing")

    def test_placement_confirmation_is_blocked_until_provider_acceptance(self):
        intake, placement = self._create_placement(
            "Blocked Approval Placement",
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )

        response = self.client.post(
            reverse("careon:case_placement_action", kwargs={"pk": intake.pk}),
            {
                "status": PlacementRequest.Status.APPROVED,
                "note": "Deze bevestiging mag nog niet slagen.",
                "next": f"{reverse('careon:case_detail', kwargs={'pk': intake.pk})}?tab=plaatsing",
            },
            follow=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Plaatsing kan pas worden bevestigd na acceptatie door de aanbieder.")
        placement.refresh_from_db()
        self.assertEqual(placement.status, PlacementRequest.Status.IN_REVIEW)
        self.assertEqual(placement.provider_response_status, PlacementRequest.ProviderResponseStatus.PENDING)

    def test_provider_response_states_are_distinguishable_and_visible(self):
        intake_pending, _ = self._create_placement(
            "Pending Response",
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            provider_name="Pending Provider",
        )
        intake_rejected, _ = self._create_placement(
            "Rejected Response",
            status=PlacementRequest.Status.REJECTED,
            provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
            provider_name="Rejected Provider",
        )
        intake_waitlist, _ = self._create_placement(
            "Waitlist Response",
            provider_response_status=PlacementRequest.ProviderResponseStatus.WAITLIST,
            provider_name="Waitlist Provider",
        )
        intake_no_capacity, _ = self._create_placement(
            "No Capacity Response",
            provider_response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            provider_name="No Capacity Provider",
        )

        payloads = {
            intake_pending.pk: self._decision_payload(intake_pending.pk, blocker_label="Pending: reactie uitstaand"),
            intake_rejected.pk: self._decision_payload(intake_rejected.pk, blocker_label="Rejected: aanbieder afgewezen"),
            intake_waitlist.pk: self._decision_payload(intake_waitlist.pk, blocker_label="Waitlist: plaatsing vertraagd"),
            intake_no_capacity.pk: self._decision_payload(intake_no_capacity.pk, blocker_label="No capacity: geen plek beschikbaar"),
        }

        with patch("contracts.views.build_operational_decision_for_intake", side_effect=lambda intake_id: _FakeDecision(payloads[intake_id])):
            response = self.client.get(reverse("careon:placement_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Pending: reactie uitstaand")
        self.assertContains(response, "Rejected: aanbieder afgewezen")
        self.assertContains(response, "Waitlist: plaatsing vertraagd")
        self.assertContains(response, "No capacity: geen plek beschikbaar")

    def test_escalation_visibility_depends_on_escalation_flag_and_reason(self):
        intake_escalated, _ = self._create_placement("Escalated Placement")
        intake_not_escalated, _ = self._create_placement("Non Escalated Placement")

        payload_escalated = self._decision_payload(
            intake_escalated.pk,
            escalation_recommended=True,
            escalation_reason="Escalatie: meerdere herinneringen zonder reactie",
        )
        payload_not_escalated = self._decision_payload(
            intake_not_escalated.pk,
            escalation_recommended=False,
            escalation_reason="Escalatie: niet tonen",
        )

        def fake_decision(intake_id):
            if intake_id == intake_escalated.pk:
                return _FakeDecision(payload_escalated)
            return _FakeDecision(payload_not_escalated)

        with patch("contracts.views.build_operational_decision_for_intake", side_effect=fake_decision):
            response = self.client.get(reverse("careon:placement_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Escalatie:")
        self.assertContains(response, "aanbevolen")
        self.assertNotContains(response, "Escalatie: niet tonen")
        self.assertNotContains(response, "Escalatie: meerdere herinneringen zonder reactie")

    def test_density_limits_max_one_strip_max_two_signals_and_no_command_bar(self):
        intake, _ = self._create_placement("Density Placement")
        payload = self._decision_payload(
            intake.pk,
            operational_signals=[
                {"label": "Signaal 1", "tone": "warning"},
                {"label": "Signaal 2", "tone": "warning"},
                {"label": "Signaal 3", "tone": "critical"},
            ],
            operational_strip={"severity": "critical", "message": "Contract strip"},
        )

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:placement_list"))

        self.assertEqual(response.status_code, 200)
        html = response.content.decode("utf-8")

        self.assertLessEqual(html.count("placement-operational-strip__message"), 1)
        signal_groups = re.findall(r"<div class=\"placement-signals\">(.*?)</div>", html, flags=re.S)
        for group in signal_groups:
            self.assertLessEqual(group.count("placement-signal-chip"), 2)

        self.assertNotContains(response, "command-bar")
        self.assertNotContains(response, "decision-command-center")

    def test_safe_fallbacks_for_empty_and_partial_data(self):
        response_empty = self.client.get(reverse("careon:placement_list"))
        self.assertEqual(response_empty.status_code, 200)
        self.assertContains(response_empty, "Nog geen plaatsingen")

        intake = self._create_intake("Partial Placement")
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.DRAFT,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            selected_provider=None,
            proposed_provider=None,
            care_form="",
            start_date=None,
        )

        partial_payload = self._decision_payload(
            intake.pk,
            recommended_action={"label": "Vraag ontbrekende info", "reason": "Onvolledige data", "url": reverse("careon:placement_list")},
            impact_summary={"text": "Maakt vervolgstap mogelijk", "type": "positive"},
            blocker_label="Partial: informatie ontbreekt",
        )
        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(partial_payload)):
            response_partial = self.client.get(reverse("careon:placement_list"))

        self.assertEqual(response_partial.status_code, 200)
        self.assertContains(response_partial, "Partial Placement")
        self.assertContains(response_partial, "Vraag ontbrekende info")
        self.assertNotContains(response_partial, "Maakt vervolgstap mogelijk")
        self.assertContains(response_partial, "Partial: informatie ontbreekt")
