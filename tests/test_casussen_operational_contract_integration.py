import re
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import CaseIntakeProcess, Organization, OrganizationMembership, RegionalConfiguration


User = get_user_model()
_UNSET = object()


class _FakeDecision:
    def __init__(self, payload):
        self._payload = payload

    def to_dict(self):
        return self._payload


class CasussenOperationalContractIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="casussen-test-user",
            email="casussen-test@example.com",
            password="testpass123",
        )
        cls.organization = Organization.objects.create(name="Casussen Org", slug="casussen-org")
        OrganizationMembership.objects.create(
            organization=cls.organization,
            user=cls.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        cls.region = RegionalConfiguration.objects.create(
            organization=cls.organization,
            region_name="Noord",
            region_type="GEMEENTELIJK",
        )

    def setUp(self):
        self.client = Client()
        self.client.login(username="casussen-test-user", password="testpass123")

    def _create_intake(
        self,
        title,
        *,
        status=CaseIntakeProcess.ProcessStatus.INTAKE,
        urgency=CaseIntakeProcess.Urgency.LOW,
        case_coordinator=_UNSET,
        preferred_region=_UNSET,
    ):
        coordinator_value = self.user if case_coordinator is _UNSET else case_coordinator
        region_value = self.region if preferred_region is _UNSET else preferred_region
        return CaseIntakeProcess.objects.create(
            organization=self.organization,
            title=title,
            status=status,
            urgency=urgency,
            case_coordinator=coordinator_value,
            preferred_region=region_value,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=21),
        )

    def _default_payload(self, *, intake_id, rank=50):
        return {
            "case_id": intake_id,
            "recommended_action": {
                "label": "Monitor voortgang",
                "reason": "Case beweegt door flow",
                "url": reverse("careon:case_detail", kwargs={"pk": intake_id}),
            },
            "impact_summary": {
                "text": "Houdt zaak op koers",
                "type": "positive",
            },
            "attention_band": "monitor",
            "priority_band": "monitor",
            "priority_rank": rank,
            "bottleneck_state": "none",
            "escalation_recommended": False,
        }

    def _get_row_html(self, html, title):
        for row_match in re.finditer(r"<tr>.*?</tr>", html, flags=re.S):
            row_html = row_match.group(0)
            if title in row_html:
                return row_html
        return ""

    def test_renders_contract_fields_and_follows_shared_contract_over_local_state(self):
        intake = self._create_intake(
            "Contract Driven Casus",
            status=CaseIntakeProcess.ProcessStatus.COMPLETED,
            urgency=CaseIntakeProcess.Urgency.LOW,
        )
        payload = {
            "case_id": intake.pk,
            "recommended_action": {
                "label": "Heropen beoordeling vandaag",
                "reason": "Nodig om matching-blokkade op te heffen",
                "url": reverse("careon:case_detail", kwargs={"pk": intake.pk}),
            },
            "impact_summary": {
                "text": "Ontgrendelt vervolgstap direct",
                "type": "accelerating",
            },
            "attention_band": "now",
            "priority_band": "first",
            "priority_rank": 2,
            "bottleneck_state": "matching",
            "escalation_recommended": True,
        }

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:case_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Heropen beoordeling vandaag")
        self.assertContains(response, "Nodig om matching-blokkade op te heffen")
        self.assertContains(response, "Ontgrendelt vervolgstap direct")
        self.assertContains(response, "Directe actie")
        self.assertContains(response, "#1")
        self.assertContains(response, "#2")
        self.assertContains(response, "Blokkeert matching")
        self.assertContains(response, "Escalatie aanbevolen")
        self.assertContains(response, "Laag")

    def test_density_rules_limit_strip_and_signals_and_no_command_center_elements(self):
        intake = self._create_intake("Density Casus", urgency=CaseIntakeProcess.Urgency.HIGH)
        payload = {
            "case_id": intake.pk,
            "recommended_action": {
                "label": "Escaleer casus",
                "reason": "Combinatie van blokkade en urgentie",
                "url": reverse("careon:case_detail", kwargs={"pk": intake.pk}),
            },
            "impact_summary": {
                "text": "Beschermt doorstroom",
                "type": "protective",
            },
            "attention_band": "now",
            "priority_band": "first",
            "priority_rank": 1,
            "bottleneck_state": "matching",
            "escalation_recommended": True,
        }

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:case_list"))

        html = response.content.decode("utf-8")
        self.assertLessEqual(html.count("casus-operational-strip__message"), 1)

        signal_lists = re.findall(r"<ul class=\"casus-row-signal-list\">(.*?)</ul>", html, flags=re.S)
        self.assertGreaterEqual(len(signal_lists), 1)
        for signal_list in signal_lists:
            self.assertLessEqual(signal_list.count("<li>"), 2)

        self.assertNotContains(response, "command-grid")
        self.assertNotContains(response, "decision-alert-strip")
        self.assertNotContains(response, "decision-focus-panel")

    def test_escalation_and_bottleneck_render_only_when_relevant(self):
        intake_a = self._create_intake("No Escalation Casus")
        intake_b = self._create_intake("Escalation Casus")

        payload_a = self._default_payload(intake_id=intake_a.pk, rank=42)
        payload_b = self._default_payload(intake_id=intake_b.pk, rank=3)
        payload_b.update(
            {
                "attention_band": "today",
                "priority_band": "soon",
                "bottleneck_state": "assessment",
                "escalation_recommended": True,
            }
        )

        def fake_decision(intake_id):
            if intake_id == intake_a.pk:
                return _FakeDecision(payload_a)
            return _FakeDecision(payload_b)

        with patch("contracts.views.build_operational_decision_for_intake", side_effect=fake_decision):
            response = self.client.get(reverse("careon:case_list"))

        self.assertEqual(response.status_code, 200)
        html = response.content.decode("utf-8")
        row_a = self._get_row_html(html, "No Escalation Casus")
        row_b = self._get_row_html(html, "Escalation Casus")

        self.assertIn("Escalatie aanbevolen", row_b)
        self.assertNotIn("casus-row-escalation", row_a)
        self.assertIn("Vertraagt beoordeling", row_b)
        self.assertNotIn("Vertraagt beoordeling", row_a)
        self.assertNotIn("Blokkeert matching", row_a)
        self.assertNotIn("Blokkeert plaatsing", row_a)

    def test_action_and_impact_stay_paired_with_partial_decision_data(self):
        intake = self._create_intake("Partial Decision Casus")
        payload = {
            "case_id": intake.pk,
            "recommended_action": {
                "label": "Plan opvolging",
                "reason": "Minimale payload zonder impact",
                "url": reverse("careon:case_detail", kwargs={"pk": intake.pk}),
            },
            "attention_band": "monitor",
            "priority_band": "monitor",
            "priority_rank": 27,
            "bottleneck_state": "none",
            "escalation_recommended": False,
        }

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:case_list"))

        self.assertEqual(response.status_code, 200)
        html = response.content.decode("utf-8")
        action_count = html.count("casus-recommended-action__action")
        impact_count = html.count("casus-impact-summary")
        self.assertGreater(action_count, 0)
        self.assertEqual(action_count, impact_count)
        self.assertContains(response, "Plan opvolging")
        self.assertContains(response, "Houdt zaak op koers")

    def test_zero_data_state_renders_safely(self):
        response = self.client.get(reverse("careon:case_list"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Nog geen casussen")
        self.assertContains(response, "Maak je eerste casus aan")

    def test_missing_optional_fields_do_not_crash_page(self):
        self._create_intake(
            "Optional Fields Casus",
            case_coordinator=None,
            preferred_region=None,
        )
        with patch(
            "contracts.views.build_operational_decision_for_intake",
            side_effect=lambda intake_id: _FakeDecision(self._default_payload(intake_id=intake_id)),
        ):
            response = self.client.get(reverse("careon:case_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Optional Fields Casus")

    def test_pagination_preserves_filters_and_filter_state_across_navigation(self):
        for idx in range(26):
            self._create_intake(
                f"FilterCase {idx}",
                status=CaseIntakeProcess.ProcessStatus.INTAKE,
                urgency=CaseIntakeProcess.Urgency.LOW,
            )

        with patch(
            "contracts.views.build_operational_decision_for_intake",
            side_effect=lambda intake_id: _FakeDecision(self._default_payload(intake_id=intake_id)),
        ):
            response_page1 = self.client.get(
                reverse("careon:case_list") + "?status=INTAKE&urgency=LOW&q=FilterCase"
            )
            response_page2 = self.client.get(
                reverse("careon:case_list") + "?status=INTAKE&urgency=LOW&q=FilterCase&page=2"
            )

        self.assertEqual(response_page1.status_code, 200)
        self.assertContains(
            response_page1,
            "status=INTAKE&amp;urgency=LOW&amp;q=FilterCase&amp;page=2",
        )

        self.assertEqual(response_page2.status_code, 200)
        self.assertContains(response_page2, 'name="q" value="FilterCase"')
        self.assertContains(response_page2, '<option value="INTAKE" selected>')
        self.assertContains(response_page2, '<option value="LOW" selected>')