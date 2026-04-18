import os
import re
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
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


User = get_user_model()


class _FakeDecision:
    def __init__(self, payload):
        self._payload = payload

    def to_dict(self):
        return self._payload


class MatchingOperationalContractRegressionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="matching-regression-user",
            email="matching-regression@example.com",
            password="testpass123",
        )
        cls.organization = Organization.objects.create(name="Matching Regression Org", slug="matching-reg-org")
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
        self.client.login(username="matching-regression-user", password="testpass123")
        os.environ["FEATURE_REDESIGN"] = "true"

    def tearDown(self):
        os.environ.pop("FEATURE_REDESIGN", None)

    def _create_approved_assessment(self, title="Matching Casus"):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title=title,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            preferred_region=self.region,
            case_coordinator=self.user,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=14),
        )
        assessment = CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )
        return intake, assessment

    def _create_provider_profile(self, name, *, current_capacity=0, max_capacity=3, average_wait_days=14):
        provider = CareProvider.objects.create(
            organization=self.organization,
            name=name,
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        return ProviderProfile.objects.create(
            client=provider,
            offers_outpatient=True,
            handles_high_urgency=True,
            current_capacity=current_capacity,
            max_capacity=max_capacity,
            average_wait_days=average_wait_days,
        )

    def _default_contract_payload(self, intake_id):
        return {
            "case_id": intake_id,
            "recommended_action": {
                "label": "Start rematch met handmatige prioriteit",
                "reason": "Contract reason: geen passende aanbieder binnen SLA",
                "url": reverse("careon:matching_dashboard") + f"?intake={intake_id}",
            },
            "impact_summary": {
                "text": "Ontgrendelt vervolgstap naar plaatsing",
                "type": "accelerating",
            },
            "attention_band": "today",
            "priority_band": "soon",
            "priority_rank": 7,
            "bottleneck_state": "matching",
            "blocker_label": "Geen match op capaciteit en urgentie",
            "escalation_recommended": True,
        }

    def test_failure_explanation_for_no_match_uses_shared_decision_reason(self):
        intake, _ = self._create_approved_assessment("No Match Contract Casus")

        payload = self._default_contract_payload(intake.pk)
        payload["recommended_action"]["reason"] = "Contract reason: capaciteit, wachttijd en fit vallen buiten bandbreedte"
        payload["blocker_label"] = "No match: contractgedreven verklaring"

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)) as decision_mock:
            response = self.client.get(reverse("careon:matching_dashboard") + f"?intake={intake.pk}")

        self.assertEqual(response.status_code, 200)
        decision_mock.assert_called_once_with(intake.pk)
        self.assertContains(response, "No match: contractgedreven verklaring")
        self.assertContains(response, "Contract reason: capaciteit, wachttijd en fit vallen buiten bandbreedte")

    def test_failure_state_has_recommended_action_and_no_dead_end(self):
        intake, _ = self._create_approved_assessment("No Dead End Casus")

        payload = self._default_contract_payload(intake.pk)
        payload["recommended_action"]["label"] = "Escaleren naar matching regisseur"
        payload["recommended_action"]["url"] = reverse("careon:assessment_detail", kwargs={"pk": intake.case_assessment.pk})

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:matching_dashboard") + f"?intake={intake.pk}")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Escaleren naar matching regisseur")
        self.assertNotContains(response, "Geen vervolgstap beschikbaar")

    def test_recommended_action_always_paired_with_impact_summary(self):
        intake, _ = self._create_approved_assessment("Action Impact Pair Casus")

        payload = self._default_contract_payload(intake.pk)
        payload["recommended_action"]["label"] = "Vraag aanvullende regio-opties op"
        payload["impact_summary"]["text"] = "Vergroot kans op match binnen 24 uur"

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:matching_dashboard") + f"?intake={intake.pk}")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Vraag aanvullende regio-opties op")
        self.assertContains(response, "Vergroot kans op match binnen 24 uur")

    def test_capacity_failures_are_visible_and_distinguishable(self):
        intake, _ = self._create_approved_assessment("Capacity Signals Casus")
        self._create_provider_profile("Geen Capaciteit BV", current_capacity=3, max_capacity=3, average_wait_days=7)
        self._create_provider_profile("Wachtlijst Zorg", current_capacity=2, max_capacity=3, average_wait_days=45)
        self._create_provider_profile("Afwijzing Historie", current_capacity=1, max_capacity=3, average_wait_days=10)

        payload = self._default_contract_payload(intake.pk)
        payload["capacity_failure_states"] = ["no_capacity", "waitlist", "rejection"]

        with patch("contracts.views.build_operational_decision_for_intake", return_value=_FakeDecision(payload)):
            response = self.client.get(reverse("careon:matching_dashboard") + f"?intake={intake.pk}")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Geen capaciteit")
        self.assertContains(response, "Wachtlijst")
        self.assertContains(response, "Afwijzing")

    def test_density_rules_limit_strip_and_signals_per_row_and_no_command_bar(self):
        intake, _ = self._create_approved_assessment("Density Matching Casus")
        self._create_provider_profile("Aanbieder A", current_capacity=0, max_capacity=3, average_wait_days=35)
        self._create_provider_profile("Aanbieder B", current_capacity=1, max_capacity=3, average_wait_days=20)
        self._create_provider_profile("Aanbieder C", current_capacity=2, max_capacity=3, average_wait_days=10)

        with patch(
            "contracts.views.build_operational_decision_for_intake",
            return_value=_FakeDecision(self._default_contract_payload(intake.pk)),
        ):
            response = self.client.get(reverse("careon:matching_dashboard") + f"?intake={intake.pk}")

        self.assertEqual(response.status_code, 200)
        html = response.content.decode("utf-8")

        self.assertLessEqual(html.count("mrd-alert-bar__text"), 1)

        chip_groups = re.findall(r"<div class=\"mrd-match-card__chips\">(.*?)</div>", html, flags=re.S)
        self.assertGreaterEqual(len(chip_groups), 1)
        for chip_group in chip_groups:
            self.assertLessEqual(chip_group.count("mrd-chip"), 2)

        self.assertNotContains(response, "command-bar")
        self.assertNotContains(response, "decision-command-center")

    def test_safe_fallbacks_for_empty_results_and_partial_data(self):
        response_empty = self.client.get(reverse("careon:matching_dashboard"))
        self.assertEqual(response_empty.status_code, 200)
        self.assertContains(response_empty, "Geen casussen gereed voor matching")

        intake, assessment = self._create_approved_assessment("Partial Data Casus")

        partial_suggestions = [
            {
                "provider_id": None,
                "provider_name": "Onvolledig Profiel",
                "match_score": 61,
                "fit_score": 61,
                "reason": "Contract reason: partial payload",
                "free_slots": 0,
                "avg_wait_days": None,
                "explanation": {},
            }
        ]

        with patch("contracts.views._build_matching_suggestions_for_intake", return_value=partial_suggestions):
            response_partial = self.client.get(reverse("careon:matching_dashboard") + f"?intake={intake.pk}")

        self.assertEqual(response_partial.status_code, 200)
        self.assertContains(response_partial, "Partial Data Casus")
        self.assertContains(response_partial, "Onvolledig Profiel")
        self.assertContains(response_partial, reverse("careon:assessment_detail", kwargs={"pk": assessment.pk}))
