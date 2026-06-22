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
from contracts.workflow_state_machine import (
    WorkflowState,
    _WORKFLOW_STATE_TO_CASE_PHASE,
    sync_case_phase_from_workflow_state,
)


User = get_user_model()

_MIN_WS = {
    "context": "Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.",
    "risks": ["test_risk"],
    "missing_information": "",
    "risks_none_ack": False,
}


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
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=_MIN_WS,
        )
        return intake.ensure_case_record(created_by=self.user).pk

    def test_cases_list_includes_workflow_state(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.MATCHING_READY)

        response = self.client.get(reverse("carelane:cases_api"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        case_row = next(item for item in payload["contracts"] if item["id"] == str(case_id))
        self.assertIn("workflow_state", case_row)
        self.assertEqual(case_row["workflow_state"], WorkflowState.MATCHING_READY)

    def test_case_detail_includes_workflow_state(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.GEMEENTE_VALIDATED)

        response = self.client.get(reverse("carelane:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("workflow_state", payload)
        self.assertEqual(payload["workflow_state"], WorkflowState.GEMEENTE_VALIDATED)

    def test_same_case_workflow_state_is_consistent_between_list_and_detail(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.PROVIDER_REVIEW_PENDING)

        list_response = self.client.get(reverse("carelane:cases_api"))
        detail_response = self.client.get(reverse("carelane:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)

        list_payload = list_response.json()
        list_case = next(item for item in list_payload["contracts"] if item["id"] == str(case_id))
        detail_payload = detail_response.json()

        self.assertEqual(list_case["workflow_state"], WorkflowState.PROVIDER_REVIEW_PENDING)
        self.assertEqual(detail_payload["workflow_state"], WorkflowState.PROVIDER_REVIEW_PENDING)
        self.assertEqual(list_case["workflow_state"], detail_payload["workflow_state"])

    def test_case_geo_is_hidden_before_controlled_link_and_exposed_after_placement(self):
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

        list_response = self.client.get(reverse("carelane:cases_api"))
        detail_response = self.client.get(reverse("carelane:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)

        list_payload = list_response.json()
        list_case = next(item for item in list_payload["contracts"] if item["id"] == str(case_id))
        detail_payload = detail_response.json()

        self.assertIn("has_case_geo", list_case)
        self.assertTrue(list_case["has_case_geo"])
        self.assertNotIn("case_geo", list_case)
        self.assertNotIn("case_geo", detail_payload)

        intake.workflow_state = WorkflowState.PLACEMENT_CONFIRMED
        intake.save(update_fields=["workflow_state"])

        placement_response = self.client.get(reverse("carelane:case_detail_api", kwargs={"case_id": case_id}))
        self.assertEqual(placement_response.status_code, 200)
        placement_payload = placement_response.json()
        self.assertIn("case_geo", placement_payload)
        self.assertEqual(placement_payload["case_geo"]["postcode"], "3511AB")
        self.assertEqual(float(placement_payload["case_geo"]["latitude"]), 52.0907)
        self.assertEqual(float(placement_payload["case_geo"]["longitude"]), 5.1214)

    def test_cases_list_and_detail_include_placement_snapshot_fields(self):
        case_id = self._create_case_with_state(workflow_state=WorkflowState.MATCHING_READY)

        list_response = self.client.get(reverse("carelane:cases_api"))
        detail_response = self.client.get(reverse("carelane:case_detail_api", kwargs={"case_id": case_id}))

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
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.user,
            workflow_summary=_MIN_WS,
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

        list_response = self.client.get(reverse("carelane:cases_api"))
        detail_response = self.client.get(reverse("carelane:case_detail_api", kwargs={"case_id": case_id}))

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(detail_response.status_code, 200)

        list_case = next(item for item in list_response.json()["contracts"] if item["id"] == str(case_id))
        detail_payload = detail_response.json()

        self.assertEqual(list_case["placement_request_status"], PlacementRequest.Status.APPROVED)
        self.assertEqual(list_case["placement_provider_response_status"], PlacementRequest.ProviderResponseStatus.ACCEPTED)
        self.assertEqual(detail_payload["placement_request_status"], PlacementRequest.Status.APPROVED)
        self.assertEqual(detail_payload["placement_provider_response_status"], PlacementRequest.ProviderResponseStatus.ACCEPTED)


class WorkflowStateCasePhaseSyncTests(TestCase):
    """P3-5: workflow_state is the source of truth; case_phase must always be derivable from it."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="sync_test_user", password="testpass123", email="sync@example.com"
        )
        self.organization = Organization.objects.create(name="Sync Test Org", slug="sync-test-org")
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

    def _make_intake(self, workflow_state: str) -> CaseIntakeProcess:
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title="Sync test",
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            workflow_state=workflow_state,
        )
        intake.ensure_case_record(created_by=self.user)
        return intake

    def test_mapping_covers_all_workflow_states(self):
        # Every WorkflowState constant must have an entry in the mapping.
        defined_states = {
            v for k, v in vars(WorkflowState).items()
            if not k.startswith('_') and isinstance(v, str)
        }
        missing = defined_states - set(_WORKFLOW_STATE_TO_CASE_PHASE.keys())
        self.assertEqual(
            missing, set(),
            msg=f"WorkflowState values not in _WORKFLOW_STATE_TO_CASE_PHASE: {missing}",
        )

    def test_mapping_targets_are_valid_case_phases(self):
        valid_phases = {c for c, _ in CareCase.CasePhase.choices}
        for ws, phase in _WORKFLOW_STATE_TO_CASE_PHASE.items():
            self.assertIn(phase, valid_phases, msg=f"{ws} maps to unknown phase '{phase}'")

    def test_sync_updates_case_phase_from_workflow_state(self):
        intake = self._make_intake(WorkflowState.DRAFT_CASE)
        case = intake.case_record

        # Simulate a workflow state advance.
        intake.workflow_state = WorkflowState.MATCHING_READY
        intake.save(update_fields=["workflow_state"])
        sync_case_phase_from_workflow_state(intake, case=case)

        case.refresh_from_db()
        self.assertEqual(case.case_phase, CareCase.CasePhase.MATCHING)

    def test_sync_is_idempotent_when_phase_unchanged(self):
        intake = self._make_intake(WorkflowState.MATCHING_READY)
        case = intake.case_record
        case.case_phase = CareCase.CasePhase.MATCHING
        case.save(update_fields=["case_phase"])

        # Call twice — should not raise, should not duplicate writes.
        sync_case_phase_from_workflow_state(intake, case=case)
        sync_case_phase_from_workflow_state(intake, case=case)

        case.refresh_from_db()
        self.assertEqual(case.case_phase, CareCase.CasePhase.MATCHING)

    def test_each_workflow_state_produces_expected_case_phase(self):
        expected = {
            WorkflowState.WIJKTEAM_INTAKE: CareCase.CasePhase.INTAKE,
            WorkflowState.ZORGVRAAG_BEOORDELING: CareCase.CasePhase.INTAKE,
            WorkflowState.DRAFT_CASE: CareCase.CasePhase.INTAKE,
            WorkflowState.SUMMARY_READY: CareCase.CasePhase.INTAKE,
            WorkflowState.MATCHING_READY: CareCase.CasePhase.MATCHING,
            WorkflowState.GEMEENTE_VALIDATED: CareCase.CasePhase.MATCHING,
            WorkflowState.PROVIDER_REVIEW_PENDING: CareCase.CasePhase.PROVIDER_BEOORDELING,
            WorkflowState.PROVIDER_ACCEPTED: CareCase.CasePhase.PROVIDER_BEOORDELING,
            WorkflowState.BUDGET_REVIEW_PENDING: CareCase.CasePhase.PROVIDER_BEOORDELING,
            WorkflowState.PROVIDER_REJECTED: CareCase.CasePhase.PROVIDER_BEOORDELING,
            WorkflowState.PLACEMENT_CONFIRMED: CareCase.CasePhase.PLAATSING,
            WorkflowState.INTAKE_STARTED: CareCase.CasePhase.ACTIEF,
            WorkflowState.ACTIVE_PLACEMENT: CareCase.CasePhase.ACTIEF,
            WorkflowState.ARCHIVED: CareCase.CasePhase.AFGEROND,
        }
        for ws, expected_phase in expected.items():
            with self.subTest(workflow_state=ws):
                intake = self._make_intake(ws)
                case = intake.case_record
                case.case_phase = CareCase.CasePhase.INTAKE  # reset to known state
                case.save(update_fields=["case_phase"])

                sync_case_phase_from_workflow_state(intake, case=case)

                case.refresh_from_db()
                self.assertEqual(
                    case.case_phase, expected_phase,
                    msg=f"{ws} should map to {expected_phase}, got {case.case_phase}",
                )
