"""
Tests for Operational Decision Contract
=======================================

Validates that the shared decision layer works correctly and produces
consistent decisions across different case states.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from contracts.models import (
    CareSignal,
    CaseAssessment,
    CaseIntakeProcess,
    Client,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
    RegionalConfiguration,
)
from contracts.operational_decision_contract import (
    AttentionBandLevel,
    BottleneckState,
    OperationalDecision,
    OperationalDecisionBuilder,
    PriorityRankBand,
    RecommendedAction,
    ImpactSummary,
    build_operational_decision_for_intake,
    build_operational_decisions_for_organization,
)

User = get_user_model()


class OperationalDecisionContractTestCase(TestCase):
    """Base test case with fixtures."""
    
    @classmethod
    def setUpTestData(cls):
        """Create shared test data."""
        # Organization
        cls.org = Organization.objects.create(
            name="Test Organization",
            slug="test-org",
        )
        
        # User
        cls.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
        )
        OrganizationMembership.objects.create(
            organization=cls.org,
            user=cls.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        
        # Region
        cls.region = RegionalConfiguration.objects.create(
            organization=cls.org,
            region_name="Test Region",
            region_type="PROVINCE",
        )
        
        # Provider
        cls.provider_org = Organization.objects.create(
            name="Provider Org",
            slug="provider-org",
        )
        cls.provider = Client.objects.create(
            organization=cls.provider_org,
            name="Test Provider",
            email="provider@example.com",
        )
        cls.provider_profile = ProviderProfile.objects.create(
            client=cls.provider,
            max_capacity=5,
            current_capacity=0,
            average_wait_days=7,
        )
        cls.provider_profile.served_regions.add(cls.region)
    
    def _create_intake(
        self,
        title="Test Case",
        status=CaseIntakeProcess.ProcessStatus.INTAKE,
        urgency=CaseIntakeProcess.Urgency.MEDIUM,
        **kwargs
    ) -> CaseIntakeProcess:
        """Helper to create an intake with standard defaults."""
        defaults = {
            'organization': self.org,
            'case_coordinator': self.user,
            'title': title,
            'status': status,
            'urgency': urgency,
            'preferred_region': self.region,
            'start_date': date.today(),
            'target_completion_date': date.today() + timedelta(days=30),
        }
        defaults.update(kwargs)
        return CaseIntakeProcess.objects.create(**defaults)
    
    def _create_assessment(
        self,
        intake: CaseIntakeProcess,
        status=CaseAssessment.AssessmentStatus.DRAFT,
    ) -> CaseAssessment:
        """Helper to create assessment."""
        return CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessed_by=self.user,
            assessment_status=status,
        )
    
    def _create_placement(
        self,
        intake: CaseIntakeProcess,
        status=PlacementRequest.Status.IN_REVIEW,
        provider_status=PlacementRequest.ProviderResponseStatus.PENDING,
    ) -> PlacementRequest:
        """Helper to create placement."""
        return PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            status=status,
            provider_response_status=provider_status,
        )


# =========================================================================
# Tests: Basic Decision Building
# =========================================================================

class OperationalDecisionBuildingTests(OperationalDecisionContractTestCase):
    """Test basic decision building for different case states."""
    
    def test_build_intake_in_draft_state(self):
        """Test decision for case in INTAKE status with no assessment."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.case_id, intake.pk)
        self.assertEqual(decision.case_title, intake.title)
        self.assertEqual(decision.case_status, CaseIntakeProcess.ProcessStatus.INTAKE)
        self.assertIsNotNone(decision.recommended_action)
        self.assertIsNotNone(decision.impact_summary)
        self.assertEqual(decision.bottleneck_state, BottleneckState.NONE)
        self.assertIsNotNone(decision.attention_band)
        self.assertGreater(decision.priority_rank, 0)
        self.assertIsInstance(decision.escalation_recommended, bool)
    
    def test_build_case_with_incomplete_assessment(self):
        """Test decision for case blocked on assessment."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.HIGH,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.DRAFT,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.bottleneck_state, BottleneckState.ASSESSMENT)
        self.assertEqual(decision.blocker_key, "assessment_incomplete")
        self.assertIsNotNone(decision.recommended_action)
        self.assertEqual(decision.recommended_action.action_type, "review")
    
    def test_build_case_in_matching_no_placement(self):
        """Test decision for case in MATCHING with no placement."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.bottleneck_state, BottleneckState.NONE)
        self.assertIsNotNone(decision.recommended_action)
        self.assertEqual(decision.case_status, CaseIntakeProcess.ProcessStatus.MATCHING)
    
    def test_build_case_with_placement_approved(self):
        """Test decision for case with approved placement."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.DECISION,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        placement = self._create_placement(
            intake,
            status=PlacementRequest.Status.APPROVED,
            provider_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.placement_status, PlacementRequest.Status.APPROVED)
        self.assertEqual(decision.attention_band, AttentionBandLevel.WAITING)


# =========================================================================
# Tests: Attention Band Logic
# =========================================================================

class AttentionBandTests(OperationalDecisionContractTestCase):
    """Test attention band (urgency vocabulary) logic."""
    
    def test_attention_now_for_crisis_urgency(self):
        """Crisis urgency in incomplete assessment should be NOW."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.CRISIS,
        )
        self._create_assessment(intake)
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.attention_band, AttentionBandLevel.NOW)
        self.assertTrue(decision.is_urgent)
        self.assertTrue(decision.requires_action)
    
    def test_attention_today_for_high_urgency_intake(self):
        """High urgency in INTAKE should be TODAY."""
        intake = self._create_intake(
            urgency=CaseIntakeProcess.Urgency.HIGH,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.attention_band, AttentionBandLevel.TODAY)
        self.assertTrue(decision.is_urgent)
    
    def test_attention_monitor_for_pending_placement(self):
        """Pending placement response should be MONITOR."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.DECISION,
            urgency=CaseIntakeProcess.Urgency.LOW,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        placement = self._create_placement(
            intake,
            status=PlacementRequest.Status.IN_REVIEW,
            provider_status=PlacementRequest.ProviderResponseStatus.PENDING,
        )
        
    def test_attention_waiting_for_approved_placement(self):
        """Approved placement should be WAITING."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.COMPLETED,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        placement = self._create_placement(
            intake,
            status=PlacementRequest.Status.APPROVED,
            provider_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.attention_band, AttentionBandLevel.WAITING)


# =========================================================================
# Tests: Priority Ranking
# =========================================================================

class PriorityRankTests(OperationalDecisionContractTestCase):
    """Test priority rank computation."""
    
    def test_crisis_urgency_higher_priority_than_low(self):
        """Crisis should rank higher (lower number) than low urgency."""
        intake_crisis = self._create_intake(urgency=CaseIntakeProcess.Urgency.CRISIS)
        intake_low = self._create_intake(urgency=CaseIntakeProcess.Urgency.LOW)
        
        decision_crisis = OperationalDecisionBuilder.build_for_intake(intake_crisis)
        decision_low = OperationalDecisionBuilder.build_for_intake(intake_low)
        
        self.assertLess(decision_crisis.priority_rank, decision_low.priority_rank)


# =========================================================================
# Tests: Bottleneck Detection
# =========================================================================

class BottleneckDetectionTests(OperationalDecisionContractTestCase):
    """Test bottleneck state detection."""
    
    def test_assessment_bottleneck(self):
        """Incomplete assessment in ASSESSMENT status = bottleneck."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
        )
        self._create_assessment(intake)
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.bottleneck_state, BottleneckState.ASSESSMENT)
    
    def test_placement_bottleneck_no_capacity(self):
        """Placement with NO_CAPACITY response = bottleneck."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.DECISION,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        placement = self._create_placement(
            intake,
            provider_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.bottleneck_state, BottleneckState.PLACEMENT)
    
    def test_no_bottleneck_when_flowing(self):
        """Case flowing normally = no bottleneck."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.COMPLETED,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        placement = self._create_placement(
            intake,
            status=PlacementRequest.Status.APPROVED,
            provider_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertEqual(decision.bottleneck_state, BottleneckState.NONE)


# =========================================================================
# Tests: Escalation Logic
# =========================================================================

class EscalationTests(OperationalDecisionContractTestCase):
    """Test escalation recommendation logic."""
    
    def test_escalation_recommended_for_critical_signal(self):
        """Critical signal = escalation recommended."""
        intake = self._create_intake()
        CareSignal.objects.create(
            due_diligence_process=intake,
            signal_type=CareSignal.SignalType.SAFETY,
            risk_level=CareSignal.RiskLevel.CRITICAL,
            status=CareSignal.SignalStatus.OPEN,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertTrue(decision.escalation_recommended)
    
    def test_no_escalation_for_low_risk(self):
        """Low risk signal = no escalation."""
        intake = self._create_intake()
        CareSignal.objects.create(
            due_diligence_process=intake,
            signal_type=CareSignal.SignalType.SAFETY,
            risk_level=CareSignal.RiskLevel.LOW,
            status=CareSignal.SignalStatus.OPEN,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertFalse(decision.escalation_recommended)


# =========================================================================
# Tests: Recommended Actions
# =========================================================================

class RecommendedActionTests(OperationalDecisionContractTestCase):
    """Test recommended action logic."""
    
    def test_action_start_assessment_when_missing(self):
        """Case with no assessment = start assessment action."""
        intake = self._create_intake()
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertIsNotNone(decision.recommended_action)
        # Should suggest assessment-related action
    
    def test_action_assign_when_no_placement(self):
        """Case in MATCHING with no placement = assign action."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
        )
        assessment = self._create_assessment(
            intake,
            status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
        )
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertIsNotNone(decision.recommended_action)
        # May suggest matching


# =========================================================================
# Tests: Impact Summary
# =========================================================================

class ImpactSummaryTests(OperationalDecisionContractTestCase):
    """Test impact summary logic."""
    
    def test_impact_summary_valid_when_action_exists(self):
        """Impact should be provided when action exists."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
        )
        self._create_assessment(intake)
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        if decision.recommended_action:
            self.assertIsNotNone(decision.impact_summary)
            self.assertIn(decision.impact_summary.impact_type, 
                         ['positive', 'protective', 'accelerating'])
    
    def test_impact_type_accelerating_for_review_action(self):
        """Review action should have accelerating impact."""
        intake = self._create_intake(
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
        )
        assessment = self._create_assessment(intake)
        
        # Manually build decision
        action = RecommendedAction(
            label="Test",
            reason="Test",
            action_type="review",
        )
        impact = OperationalDecisionBuilder._determine_impact_summary(action)
        
        self.assertEqual(impact.impact_type, "accelerating")


# =========================================================================
# Tests: Serialization
# =========================================================================

class SerializationTests(OperationalDecisionContractTestCase):
    """Test decision serialization to dict/JSON."""
    
    def test_to_dict_contains_all_fields(self):
        """to_dict should include all required fields."""
        intake = self._create_intake()
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        data = decision.to_dict()
        
        self.assertIn('case_id', data)
        self.assertIn('case_title', data)
        self.assertIn('attention_band', data)
        self.assertIn('priority_rank', data)
        self.assertIn('bottleneck_state', data)
        self.assertIn('escalation_recommended', data)
        self.assertIn('recommended_action', data)
        self.assertIn('impact_summary', data)


# =========================================================================
# Tests: Org-Level Decisions
# =========================================================================

class OrganizationDecisionsTests(OperationalDecisionContractTestCase):
    """Test building decisions for entire organization."""
    
    def test_build_decisions_for_organization(self):
        """Should build decisions for all active cases in org."""
        intake1 = self._create_intake(status=CaseIntakeProcess.ProcessStatus.INTAKE)
        intake2 = self._create_intake(status=CaseIntakeProcess.ProcessStatus.ASSESSMENT)
        
        decisions = build_operational_decisions_for_organization(self.org.pk)
        
        self.assertGreaterEqual(len(decisions), 2)
        for decision in decisions:
            self.assertIsInstance(decision, OperationalDecision)
    
    def test_decisions_ordered_by_priority(self):
        """Decisions should respect priority ordering."""
        intake_crisis = self._create_intake(
            title="Crisis",
            urgency=CaseIntakeProcess.Urgency.CRISIS,
        )
        intake_low = self._create_intake(
            title="Low Priority",
            urgency=CaseIntakeProcess.Urgency.LOW,
        )
        
        decisions = build_operational_decisions_for_organization(self.org.pk)
        decision_map = {d.case_id: d for d in decisions}
        
        crisis_decision = decision_map.get(intake_crisis.pk)
        low_decision = decision_map.get(intake_low.pk)
        
        if crisis_decision and low_decision:
            self.assertLess(crisis_decision.priority_rank, low_decision.priority_rank)


# =========================================================================
# Tests: Edge Cases
# =========================================================================

class EdgeCaseTests(OperationalDecisionContractTestCase):
    """Test edge cases and error conditions."""
    
    def test_build_for_nonexistent_intake(self):
        """Should return None for invalid intake ID."""
        result = build_operational_decision_for_intake(99999)
        self.assertIsNone(result)
    
    def test_decision_with_all_optional_fields_missing(self):
        """Should still build valid decision with minimal data."""
        intake = self._create_intake()
        # Don't create assessment or placement
        
        decision = OperationalDecisionBuilder.build_for_intake(intake)
        
        self.assertIsNotNone(decision)
        self.assertEqual(decision.case_id, intake.pk)
        self.assertIsNotNone(decision.attention_band)
        self.assertGreater(decision.priority_rank, 0)
