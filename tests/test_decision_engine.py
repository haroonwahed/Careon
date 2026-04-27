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
    ProviderRegioDekking,
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
            latitude=52.0907,
            longitude=5.1214,
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

    def test_matching_explainability_structure_present(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.78,
            score_inhoudelijke_fit=0.82,
            score_capaciteit_wachttijd_fit=0.66,
            score_regio_contract_fit=0.74,
            score_complexiteit_veiligheid_fit=0.71,
            confidence_label=MatchResultaat.ConfidenceLabel.HOOG,
            fit_samenvatting="Aanbieder past goed op urgentie en zorgvorm.",
            trade_offs=[{"factor": "wachttijd", "toelichting": "Wachttijd is hoger dan alternatief"}],
            verificatie_advies="Controleer recente capaciteit met aanbieder.",
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)

        for key in [
            "factor_breakdown",
            "explanation_summary",
            "strengths",
            "weaknesses",
            "tradeoffs",
            "confidence_score",
            "confidence_reason",
            "warning_flags",
            "verification_guidance",
        ]:
            self.assertIn(key, result)

        expected_factors = {
            "zorgvorm_match",
            "urgency_match",
            "specialization_match",
            "region_match",
            "capacity_signal",
            "complexity_fit",
            "special_needs_fit",
        }
        self.assertEqual(set(result["factor_breakdown"].keys()), expected_factors)
        for payload in result["factor_breakdown"].values():
            self.assertIn("score", payload)
            self.assertIn("explanation", payload)
            self.assertGreaterEqual(payload["score"], 0.0)
            self.assertLessEqual(payload["score"], 1.0)
            self.assertTrue(payload["explanation"])
        self.assertTrue(result["verification_guidance"])

    def test_matching_explainability_confidence_score_is_bounded(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=1.6,
            confidence_label=MatchResultaat.ConfidenceLabel.HOOG,
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertGreaterEqual(result["confidence_score"], 0.0)
        self.assertLessEqual(result["confidence_score"], 1.0)

    def test_matching_explainability_high_fit_scores_higher_confidence_than_weak_fit(self):
        _, strong_case, _, _ = self._create_case(
            title="Sterke fit",
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        MatchResultaat.objects.create(
            casus=strong_case,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.91,
            score_inhoudelijke_fit=0.92,
            score_regio_contract_fit=0.88,
            score_capaciteit_wachttijd_fit=0.84,
            score_complexiteit_veiligheid_fit=0.9,
            confidence_label=MatchResultaat.ConfidenceLabel.HOOG,
            ranking=1,
        )

        _, weak_case, _, weak_placement = self._create_case(
            title="Zwakke fit",
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            provider_response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            placement_status=PlacementRequest.Status.IN_REVIEW,
            urgency=CaseIntakeProcess.Urgency.CRISIS,
        )
        weak_placement.provider_response_notes = "Capaciteit ontbreekt"
        weak_placement.save(update_fields=["provider_response_notes", "updated_at"])
        MatchResultaat.objects.create(
            casus=weak_case,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.44,
            score_inhoudelijke_fit=0.4,
            score_regio_contract_fit=0.38,
            score_capaciteit_wachttijd_fit=0.22,
            score_complexiteit_veiligheid_fit=0.36,
            confidence_label=MatchResultaat.ConfidenceLabel.LAAG,
            ranking=1,
        )

        strong_result = evaluate_case(strong_case, actor=self.gemeente_user)
        weak_result = evaluate_case(weak_case, actor=self.gemeente_user)

        self.assertGreater(strong_result["confidence_score"], weak_result["confidence_score"])
        self.assertIn("Confidence is hoog", strong_result["confidence_reason"])
        self.assertIn("Confidence is laag", weak_result["confidence_reason"])

    def test_matching_explainability_warning_flags_reflect_low_fit(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            urgency=CaseIntakeProcess.Urgency.HIGH,
        )
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.31,
            score_inhoudelijke_fit=0.28,
            score_regio_contract_fit=0.33,
            score_capaciteit_wachttijd_fit=0.21,
            score_complexiteit_veiligheid_fit=0.34,
            confidence_label=MatchResultaat.ConfidenceLabel.LAAG,
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertTrue(result["warning_flags"]["capacity_risk"])
        self.assertTrue(result["warning_flags"]["specialization_gap"])
        self.assertFalse(result["warning_flags"]["distance_issue"])
        self.assertTrue(result["warning_flags"]["urgency_mismatch"])

    def test_matching_explainability_dutch_explanations_remain_present(self):
        _, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.74,
            score_inhoudelijke_fit=0.76,
            score_regio_contract_fit=0.71,
            score_capaciteit_wachttijd_fit=0.68,
            score_complexiteit_veiligheid_fit=0.72,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            fit_samenvatting="Aanbieder past bij profiel en urgentie, met aandacht voor capaciteit.",
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertTrue(result["explanation_summary"])
        self.assertTrue(any("zorgvorm" in item.lower() or "fit" in item.lower() for item in result["strengths"] + result["weaknesses"]))
        self.assertTrue(all(isinstance(item, str) and item.strip() for item in result["verification_guidance"]))

    def test_distance_coverage_inside_service_radius(self):
        intake, _, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        intake.latitude = 52.095
        intake.longitude = 5.12
        MatchResultaat.objects.create(
            casus=intake.contract,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.72,
            score_inhoudelijke_fit=0.7,
            score_regio_contract_fit=0.62,
            score_capaciteit_wachttijd_fit=0.64,
            score_complexiteit_veiligheid_fit=0.66,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            verificatie_advies="Maximale service radius 8 km",
            ranking=1,
        )

        result = evaluate_case(intake, actor=self.gemeente_user)
        self.assertEqual(result["coverage_basis"], "geo_distance")
        self.assertEqual(result["coverage_status"], "inside_radius")
        self.assertIsNotNone(result["distance_km"])
        self.assertFalse(result["warning_flags"]["distance_issue"])

    def test_structured_service_radius_is_preferred_over_text_radius(self):
        intake, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        intake.latitude = 52.13
        intake.longitude = 5.18
        ProviderRegioDekking.objects.create(
            zorgaanbieder=self.provider,
            aanbieder_vestiging=self.provider_branch,
            regio=self.region,
            service_radius_km=12.0,
            dekking_status=ProviderRegioDekking.DekkingStatus.ACTIVE,
            contract_actief=True,
        )
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.71,
            score_inhoudelijke_fit=0.7,
            score_regio_contract_fit=0.62,
            score_capaciteit_wachttijd_fit=0.65,
            score_complexiteit_veiligheid_fit=0.68,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            verificatie_advies="service radius 2 km",
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertEqual(result["service_radius_km"], 12.0)

    def test_text_radius_fallback_still_works_without_structured_radius(self):
        intake, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        intake.latitude = 52.13
        intake.longitude = 5.18
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.69,
            score_inhoudelijke_fit=0.67,
            score_regio_contract_fit=0.61,
            score_capaciteit_wachttijd_fit=0.62,
            score_complexiteit_veiligheid_fit=0.65,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            verificatie_advies="Maximale service radius 9 km",
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertEqual(result["coverage_basis"], "geo_distance")
        self.assertEqual(result["service_radius_km"], 9.0)

    def test_distance_coverage_outside_service_radius_sets_distance_issue(self):
        intake, _, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        intake.latitude = 52.55
        intake.longitude = 5.65
        MatchResultaat.objects.create(
            casus=intake.contract,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.62,
            score_inhoudelijke_fit=0.66,
            score_regio_contract_fit=0.58,
            score_capaciteit_wachttijd_fit=0.6,
            score_complexiteit_veiligheid_fit=0.62,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            verificatie_advies="service radius 10 km",
            ranking=1,
        )

        result = evaluate_case(intake, actor=self.gemeente_user)
        self.assertEqual(result["coverage_basis"], "geo_distance")
        self.assertEqual(result["coverage_status"], "outside_radius")
        self.assertTrue(result["warning_flags"]["distance_issue"])

    def test_distance_coverage_same_region_fallback(self):
        intake, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        case_record.service_region = "UTR"
        case_record.save(update_fields=["service_region", "updated_at"])
        self.provider_branch.region = "UTR"
        self.provider_branch.save(update_fields=["region", "updated_at"])

        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.68,
            score_inhoudelijke_fit=0.66,
            score_regio_contract_fit=0.52,
            score_capaciteit_wachttijd_fit=0.57,
            score_complexiteit_veiligheid_fit=0.61,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertEqual(result["coverage_basis"], "region_fallback")
        self.assertEqual(result["coverage_status"], "region_fallback_match")
        self.assertFalse(result["warning_flags"]["distance_issue"])

    def test_distance_coverage_missing_geo_or_coverage_is_unknown(self):
        intake, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        intake.regio = None
        intake.preferred_region = None
        intake.save(update_fields=["regio", "preferred_region", "updated_at"])
        self.provider_branch.region = ""
        self.provider_branch.gemeente = ""
        self.provider_branch.latitude = None
        self.provider_branch.longitude = None
        self.provider_branch.save(update_fields=["region", "gemeente", "latitude", "longitude", "updated_at"])
        case_record.service_region = ""
        case_record.save(update_fields=["service_region", "updated_at"])

        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.63,
            score_inhoudelijke_fit=0.63,
            score_regio_contract_fit=0.5,
            score_capaciteit_wachttijd_fit=0.58,
            score_complexiteit_veiligheid_fit=0.6,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            ranking=1,
        )

        result = evaluate_case(case_record, actor=self.gemeente_user)
        self.assertEqual(result["coverage_basis"], "unknown")
        self.assertEqual(result["coverage_status"], "unknown")
        self.assertIsNone(result["service_radius_km"])
        self.assertFalse(result["warning_flags"]["distance_issue"])
        self.assertTrue(any("Geo/coverage-data ontbreekt" in item for item in result["verification_guidance"]))

    def test_distance_issue_requires_real_coverage_evidence(self):
        intake, case_record, _, _ = self._create_case(
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
        )
        other_region = RegionalConfiguration.objects.create(
            organization=self.organization,
            region_name="Rotterdam",
            region_code="RTM",
            region_type="GEMEENTELIJK",
        )
        ProviderRegioDekking.objects.create(
            zorgaanbieder=self.provider,
            aanbieder_vestiging=self.provider_branch,
            regio=other_region,
            dekking_status=ProviderRegioDekking.DekkingStatus.ACTIVE,
            contract_actief=True,
        )
        MatchResultaat.objects.create(
            casus=case_record,
            zorgprofiel=self.provider_profile,
            zorgaanbieder=self.provider,
            totaalscore=0.6,
            score_inhoudelijke_fit=0.62,
            score_regio_contract_fit=0.55,
            score_capaciteit_wachttijd_fit=0.58,
            score_complexiteit_veiligheid_fit=0.59,
            confidence_label=MatchResultaat.ConfidenceLabel.MIDDEL,
            ranking=1,
        )

        result = evaluate_case(intake, actor=self.gemeente_user)
        self.assertEqual(result["coverage_basis"], "provider_region_coverage")
        self.assertEqual(result["coverage_status"], "uncovered_region")
        self.assertTrue(result["warning_flags"]["distance_issue"])

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
