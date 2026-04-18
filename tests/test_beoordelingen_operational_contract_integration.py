import re
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CaseAssessment,
    CaseIntakeProcess,
    Organization,
    OrganizationMembership,
    RegionalConfiguration,
)


User = get_user_model()


class _FakeDecision:
    def __init__(self, payload):
        self._payload = payload

    def to_dict(self):
        return self._payload


class BeoordelingenOperationalContractIntegrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="beoordelingen-test-user",
            email="beoordelingen-test@example.com",
            password="testpass123",
        )
        cls.organization = Organization.objects.create(name="Beoordelingen Org", slug="beoordelingen-org")
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
        self.client.login(username="beoordelingen-test-user", password="testpass123")

    def _create_assessment(
        self,
        title,
        *,
        intake_status=CaseIntakeProcess.ProcessStatus.INTAKE,
        assessment_status=CaseAssessment.AssessmentStatus.DRAFT,
    ):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title=title,
            status=intake_status,
            urgency=CaseIntakeProcess.Urgency.LOW,
            case_coordinator=self.user,
            preferred_region=self.region,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=21),
        )
        return CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=assessment_status,
            assessed_by=self.user,
            matching_ready=False,
        )

    def _decision_payload(self, *, intake_id, rank=50):
        return {
            "case_id": intake_id,
            "recommended_action": {
                "label": "Rond beoordeling af",
                "reason": "Nodig voor doorstroom naar matching",
                "url": reverse("careon:assessment_list"),
            },
            "impact_summary": {
                "text": "Ontgrendelt matching voor deze casus",
                "type": "accelerating",
            },
            "attention_band": "monitor",
            "priority_band": "monitor",
            "priority_rank": rank,
            "bottleneck_state": "none",
            "blocker_label": "Geen ontbrekende beoordelingsstap",
            "escalation_recommended": False,
        }

    def _row_html_by_title(self, html, title):
        for row_match in re.finditer(r"<tr>.*?</tr>", html, flags=re.S):
            row_html = row_match.group(0)
            if title in row_html:
                return row_html
        return ""

    def test_renders_shared_contract_fields_and_uses_contract_over_local_defaults(self):
        assessment = self._create_assessment(
            "Assessment Contract Driven",
            intake_status=CaseIntakeProcess.ProcessStatus.COMPLETED,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        payload = {
            "case_id": assessment.intake.pk,
            "recommended_action": {
                "label": "Vraag ontbrekende info op",
                "reason": "Contract detecteert ontbrekend intake-onderdeel",
                "url": reverse("careon:assessment_update", kwargs={"pk": assessment.pk}),
            },
            "impact_summary": {
                "text": "Ontgrendelt beoordeling en matching",
                "type": "accelerating",
            },
            "attention_band": "today",
            "priority_band": "soon",
            "priority_rank": 4,
            "bottleneck_state": "assessment",
            "blocker_label": "Intake nog niet volledig geverifieerd",
            "escalation_recommended": True,
        }

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:assessment_list"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Vraag ontbrekende info op")
        self.assertContains(response, "Contract detecteert ontbrekend intake-onderdeel")
        self.assertContains(response, "Ontgrendelt beoordeling en matching")
        self.assertContains(response, "Vandaag oppakken")
        self.assertContains(response, "Intake nog niet volledig geverifieerd")
        self.assertContains(response, "Blokkeert matching voor deze casus")
        self.assertContains(response, "Escalatie aanbevolen")
        self.assertContains(response, "Prioriteit #4")
        self.assertContains(response, "Goedgekeurd voor matching")

    def test_medium_density_rules_keep_single_strip_and_no_command_center_patterns(self):
        first = self._create_assessment("Assessment Density A")
        second = self._create_assessment("Assessment Density B")

        payload_a = self._decision_payload(intake_id=first.intake.pk, rank=1)
        payload_b = self._decision_payload(intake_id=second.intake.pk, rank=2)
        payload_a.update({
            "attention_band": "now",
            "bottleneck_state": "assessment",
            "blocker_label": "Kerninformatie ontbreekt",
            "escalation_recommended": True,
        })
        payload_b.update({
            "attention_band": "today",
            "bottleneck_state": "assessment",
            "blocker_label": "Aanvullende intakecheck ontbreekt",
            "escalation_recommended": False,
        })

        def fake_decision(intake_id):
            if intake_id == first.intake.pk:
                return _FakeDecision(payload_a)
            return _FakeDecision(payload_b)

        with patch("contracts.views.build_operational_decision_for_intake", side_effect=fake_decision):
            response = self.client.get(reverse("careon:assessment_list"))

        html = response.content.decode("utf-8")
        self.assertLessEqual(html.count("assessment-operational-strip__message"), 1)

        row_first = self._row_html_by_title(html, "Assessment Density A")
        row_second = self._row_html_by_title(html, "Assessment Density B")
        self.assertLessEqual(row_first.count("Vertraagt beoordeling"), 1)
        self.assertLessEqual(row_second.count("Vertraagt beoordeling"), 1)

        self.assertNotContains(response, "command-grid")
        self.assertNotContains(response, "decision-alert-strip")
        self.assertNotContains(response, "decision-focus-panel")

    def test_action_and_impact_pairing_survives_partial_contract_payload(self):
        assessment = self._create_assessment("Assessment Partial Payload")
        payload = {
            "case_id": assessment.intake.pk,
            "attention_band": "monitor",
            "priority_band": "monitor",
            "priority_rank": 32,
            "bottleneck_state": "none",
            "blocker_label": "Geen ontbrekende beoordelingsstap",
            "escalation_recommended": False,
        }

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:assessment_list"))

        self.assertEqual(response.status_code, 200)
        html = response.content.decode("utf-8")
        action_count = html.count("casus-recommended-action__action")
        impact_count = html.count("assessment-impact-summary")
        self.assertGreater(action_count, 0)
        self.assertEqual(action_count, impact_count)
        self.assertContains(response, "Rond beoordeling af")
        self.assertContains(response, "Ontgrendelt vervolgstap")

    def test_filter_and_pagination_keep_query_state(self):
        for idx in range(26):
            self._create_assessment(f"Assessment Filter {idx}")

        with patch(
            "contracts.views.build_operational_decision_for_intake",
            side_effect=lambda intake_id: _FakeDecision(self._decision_payload(intake_id=intake_id)),
        ):
            response_page1 = self.client.get(
                reverse("careon:assessment_list") + "?status=DRAFT&q=Assessment+Filter"
            )
            response_page2 = self.client.get(
                reverse("careon:assessment_list") + "?status=DRAFT&q=Assessment+Filter&page=2"
            )

        self.assertEqual(response_page1.status_code, 200)
        self.assertContains(
            response_page1,
            "status=DRAFT&amp;q=Assessment+Filter&amp;page=2",
        )

        self.assertEqual(response_page2.status_code, 200)
        self.assertContains(response_page2, 'name="q" value="Assessment Filter"')
        self.assertContains(response_page2, '<option value="DRAFT" selected>')

    def test_empty_state_stays_safe(self):
        response = self.client.get(reverse("careon:assessment_list"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Geen beoordelingen gevonden")
