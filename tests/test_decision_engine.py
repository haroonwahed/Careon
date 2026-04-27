from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.decision_engine import DECISION_ENGINE_THRESHOLDS, evaluate_case
from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client,
    MatchResultaat,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    RegionalConfiguration,
    Zorgaanbieder,
    Zorgprofiel,
    AanbiederVestiging,
    MunicipalityConfiguration,
)


User = get_user_model()


class DecisionEngineTests(TestCase):
    def setUp(self):
        self.organization = Organization.objects.create(name="Decision Engine Org", slug="decision-engine-org")
        self.gemeente_user = User.objects.create_user(username="gemeente", password="testpass123")
        self.provider_user = User.objects.create_user(username="provider", password="testpass123")
        self.admin_user = User.objects.create_user(username="admin", password="testpass123")

        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.gemeente_user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.provider_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.admin_user,
            role=OrganizationMembership.Role.ADMIN,
            is_active=True,
        )

        self.region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name="Utrecht",
            region_code="UTR",
            region_type="GEMEENTELIJK",
        )
        self.municipality = MunicipalityConfiguration.objects.create(
            organization=self.organization,
            municipality_name="Gemeente Utrecht",
            municipality_code="UTR-001",
        )

        self.provider_org = Organization.objects.create(name="Provider Org", slug="provider-org")
        self.provider_client = Client.objects.create(
            organization=self.provider_org,
            name="Zorgaanbieder Utrecht",
            status=Client.Status.ACTIVE,
            created_by=self.gemeente_user,
        )
        self.provider = Zorgaanbieder.objects.create(name="Zorgaanbieder Utrecht", is_active=True)
        self.provider_branch = AanbiederVestiging.objects.create(
            zorgaanbieder=self.provider,
            vestiging_code="UTR-001",
            city="Utrecht",
            gemeente="Utrecht",
            provincie="Utrecht",
            region="UTR",
            is_active=True,
        )
        self.provider_profile = Zorgprofiel.objects.create(
            aanbieder_vestiging=self.provider_branch,
            zorgaanbieder=self.provider,
            zorgvorm="ambulant",
            zorgdomein="jeugd",
            biedt_ambulant=True,
            leeftijd_12_18=True,
            urgentie_middel=True,
            urgentie_hoog=True,
        )

    def _create_case(
        self,
        *,
        status=CaseIntakeProcess.ProcessStatus.INTAKE,
        assessment_status=None,
        matching_ready=False,
        assessment_notes="",
        provider_response_status=None,
        placement_status=None,
        title="Besliscasus",
        urgency=CaseIntakeProcess.Urgency.MEDIUM,
    ):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title=title,
            status=status,
            urgency=urgency,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            zorgvorm_gewenst=CaseIntakeProcess.CareForm.OUTPATIENT,
            preferred_region=self.region,
            gemeente=self.municipality,
            start_date=timezone.now().date(),
            target_completion_date=timezone.now().date() + timedelta(days=10),
            case_coordinator=self.gemeente_user,
        )
        case_record = intake.ensure_case_record(created_by=self.gemeente_user)

        assessment = None
        if assessment_status is not None:
            assessment = CaseAssessment.objects.create(
                due_diligence_process=intake,
                assessment_status=assessment_status,
                matching_ready=matching_ready,
                assessed_by=self.gemeente_user,
                notes=assessment_notes,
            )

        placement = None
        if provider_response_status is not None or placement_status is not None:
            placement = PlacementRequest.objects.create(
                due_diligence_process=intake,
                proposed_provider=self.provider_client,
                selected_provider=self.provider_client,
                status=placement_status or PlacementRequest.Status.IN_REVIEW,
                provider_response_status=provider_response_status or PlacementRequest.ProviderResponseStatus.PENDING,
                care_form=PlacementRequest.CareForm.OUTPATIENT,
            )

        return intake, case_record, assessment, placement

    def test_draft_case_without_summary_returns_missing_summary(self):
        intake, case_record, _, _ = self._create_case()

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "DRAFT_CASE")
        self.assertIn(result["next_best_action"]["action"], {"COMPLETE_CASE_DATA", "GENERATE_SUMMARY"})
        self.assertTrue(
            any(blocker["code"] in {"MISSING_SUMMARY", "MISSING_REQUIRED_CASE_DATA"} for blocker in result["blockers"])
        )

    def test_summary_ready_case_returns_start_matching(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.UNDER_REVIEW,
            assessment_notes="Samenvatting gereed voor matching.",
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "SUMMARY_READY")
        self.assertEqual(result["next_best_action"]["action"], "START_MATCHING")

    def test_matching_ready_case_returns_validate_matching_gate(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "MATCHING_READY")
        self.assertEqual(result["next_best_action"]["action"], "VALIDATE_MATCHING")

    def test_provider_review_pending_returns_wait_provider_response(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            placement_status=PlacementRequest.Status.IN_REVIEW,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "PROVIDER_REVIEW_PENDING")
        self.assertEqual(result["next_best_action"]["action"], "WAIT_PROVIDER_RESPONSE")

    def test_provider_review_pending_beyond_sla_returns_follow_up_provider(self):
        _, case_record, _, placement = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            provider_response_status=PlacementRequest.ProviderResponseStatus.PENDING,
            placement_status=PlacementRequest.Status.IN_REVIEW,
        )
        placement.provider_response_recorded_at = timezone.now() - timedelta(hours=DECISION_ENGINE_THRESHOLDS["provider_response_sla_hours"] + 4)
        placement.save(update_fields=["provider_response_recorded_at", "updated_at"])

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "PROVIDER_REVIEW_PENDING")
        self.assertEqual(result["next_best_action"]["action"], "FOLLOW_UP_PROVIDER")
        self.assertTrue(any(alert["code"] == "PROVIDER_REVIEW_PENDING_SLA" for alert in result["alerts"]))

    def test_provider_rejected_returns_rematch_case(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
            placement_status=PlacementRequest.Status.REJECTED,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "PROVIDER_REJECTED")
        self.assertEqual(result["next_best_action"]["action"], "REMATCH_CASE")
        self.assertTrue(any(blocker["code"] == "PROVIDER_NOT_ACCEPTED" for blocker in result["blockers"]))

    def test_provider_accepted_returns_confirm_placement(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            placement_status=PlacementRequest.Status.IN_REVIEW,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "PROVIDER_ACCEPTED")
        self.assertEqual(result["next_best_action"]["action"], "CONFIRM_PLACEMENT")

    def test_placement_confirmed_returns_start_intake(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            placement_status=PlacementRequest.Status.APPROVED,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "PLACEMENT_CONFIRMED")
        self.assertEqual(result["next_best_action"]["action"], "START_INTAKE")

    def test_archived_case_returns_no_next_best_action_and_blocks_mutations(self):
        intake, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        intake.status = CaseIntakeProcess.ProcessStatus.ARCHIVED
        intake.save(update_fields=["status", "updated_at"])
        case_record.lifecycle_stage = "ARCHIVED"
        case_record.save(update_fields=["lifecycle_stage", "updated_at"])

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertEqual(result["current_state"], "ARCHIVED")
        self.assertIsNone(result["next_best_action"])
        self.assertTrue(any(blocker["code"] == "CASE_ARCHIVED" for blocker in result["blockers"]))
        self.assertTrue(any(action["action"] == "SEND_TO_PROVIDER" for action in result["blocked_actions"]))

    def test_low_confidence_match_creates_low_match_confidence_risk(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.42,
            confidence_label=MatchResultaat.ConfidenceLabel.LAAG,
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertTrue(any(risk["code"] == "LOW_MATCH_CONFIDENCE" for risk in result["risks"]))
        self.assertTrue(any(alert["code"] == "WEAK_MATCH_NEEDS_VERIFICATION" for alert in result["alerts"]))

    def test_repeated_rejection_creates_repeated_provider_rejections_risk(self):
        intake, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
            placement_status=PlacementRequest.Status.REJECTED,
        )
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=self.provider_client,
            selected_provider=self.provider_client,
            status=PlacementRequest.Status.REJECTED,
            provider_response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            provider_response_reason_code="CAPACITY",
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        self.assertTrue(any(risk["code"] == "REPEATED_PROVIDER_REJECTIONS" for risk in result["risks"]))
        self.assertGreaterEqual(result["decision_context"]["provider_rejection_count"], 2)

    def test_decision_api_is_read_only_and_does_not_create_audit_events(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        self.client.login(username="gemeente", password="testpass123")
        before_count = CaseDecisionLog.objects.count()

        response = self.client.get(
            reverse("careon:case_decision_evaluation_api", kwargs={"case_id": case_record.pk}),
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(CaseDecisionLog.objects.count(), before_count)
        self.assertEqual(response.json()["case_id"], case_record.pk)
