from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseIntakeProcess,
    Client as CareClient,
    Organization,
    OrganizationMembership,
    PlacementRequest,
)
from contracts.workflow_state_machine import WorkflowState


User = get_user_model()


class CaseApiWorkflowStateTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="workflow_state_api_user",
            email="workflow-state-api@example.com",
            password="testpass123",
        )
        self.organization = Organization.objects.create(name="Workflow API Org", slug="workflow-api-org")
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.client.login(username="workflow_state_api_user", password="testpass123")

    def _create_case_with_state(self, *, workflow_state: str) -> int:
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Workflow State API Case",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            workflow_state=workflow_state,
        )
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )
        return intake.ensure_case_record(created_by=self.user).pk

    def test_cases_list_includes_workflow_state(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.MATCHING_READY)

        response = self.client.get(reverse("careon:cases_api"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        case_row = next(item for item in payload["contracts"] if item["id"] == str(case_id))
        self.assertIn("workflow_state", case_row)
        self.assertEqual(case_row["workflow_state"], WorkflowState.MATCHING_READY)

    def test_case_detail_includes_workflow_state(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.GEMEENTE_VALIDATED)

        response = self.client.get(reverse("careon:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("workflow_state", payload)
        self.assertEqual(payload["workflow_state"], WorkflowState.GEMEENTE_VALIDATED)

    def test_same_case_workflow_state_is_consistent_between_list_and_detail(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.PROVIDER_REVIEW_PENDING)

        list_response = self.client.get(reverse("careon:cases_api"))
        detail_response = self.client.get(reverse("careon:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)

        list_payload = list_response.json()
        list_case = next(item for item in list_payload["contracts"] if item["id"] == str(case_id))
        detail_payload = detail_response.json()

        self.assertEqual(list_case["workflow_state"], WorkflowState.PROVIDER_REVIEW_PENDING)
        self.assertEqual(detail_payload["workflow_state"], WorkflowState.PROVIDER_REVIEW_PENDING)
        self.assertEqual(list_case["workflow_state"], detail_payload["workflow_state"])

    def test_case_geo_is_exposed_in_detail_but_not_raw_in_list(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Case with geo",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            workflow_state=WorkflowState.MATCHING_READY,
            postcode="3511AB",
            latitude=52.0907,
            longitude=5.1214,
        )
        case_id = intake.ensure_case_record(created_by=self.user).pk

        list_response = self.client.get(reverse("careon:cases_api"))
        detail_response = self.client.get(reverse("careon:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)

        list_payload = list_response.json()
        list_case = next(item for item in list_payload["contracts"] if item["id"] == str(case_id))
        detail_payload = detail_response.json()

        self.assertIn("has_case_geo", list_case)
        self.assertTrue(list_case["has_case_geo"])
        self.assertNotIn("case_geo", list_case)

        self.assertIn("case_geo", detail_payload)
        self.assertEqual(detail_payload["case_geo"]["postcode"], "3511AB")
        self.assertEqual(float(detail_payload["case_geo"]["latitude"]), 52.0907)
        self.assertEqual(float(detail_payload["case_geo"]["longitude"]), 5.1214)

    def test_cases_list_and_detail_include_placement_snapshot_fields(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.MATCHING_READY)

        list_response = self.client.get(reverse("careon:cases_api"))
        detail_response = self.client.get(reverse("careon:case_detail_api", kwargs={"case_id": case_id}))

        list_case = next(item for item in list_response.json()["contracts"] if item["id"] == str(case_id))
        detail_payload = detail_response.json()

        self.assertIn("placement_request_status", list_case)
        self.assertIn("placement_provider_response_status", list_case)
        self.assertIsNone(list_case["placement_request_status"])
        self.assertIsNone(list_case["placement_provider_response_status"])

        self.assertIn("placement_request_status", detail_payload)
        self.assertIn("placement_provider_response_status", detail_payload)
        self.assertIsNone(detail_payload["placement_request_status"])
        self.assertIsNone(detail_payload["placement_provider_response_status"])

    def test_placement_snapshot_matches_latest_placement_request(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Placement API snapshot",
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            workflow_state=WorkflowState.PLACEMENT_CONFIRMED,
        )
        CaseAssessment.objects.create(
            intake=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
        )
        case_id = intake.ensure_case_record(created_by=self.user).pk
        CareCase.objects.filter(pk=case_id).update(case_phase=CareCase.CasePhase.PLAATSING)

        provider = CareClient.objects.create(organization=self.organization, name="Snapshot Provider")
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.APPROVED,
            proposed_provider=provider,
            selected_provider=provider,
            care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
        )

        list_response = self.client.get(reverse("careon:cases_api"))
        detail_response = self.client.get(reverse("careon:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)

        list_case = next(item for item in list_response.json()["contracts"] if item["id"] == str(case_id))
        detail_payload = detail_response.json()

        self.assertEqual(list_case["placement_request_status"], PlacementRequest.Status.APPROVED)
        self.assertEqual(list_case["placement_provider_response_status"], PlacementRequest.ProviderResponseStatus.ACCEPTED)
        self.assertEqual(detail_payload["placement_request_status"], PlacementRequest.Status.APPROVED)
        self.assertEqual(detail_payload["placement_provider_response_status"], PlacementRequest.ProviderResponseStatus.ACCEPTED)
