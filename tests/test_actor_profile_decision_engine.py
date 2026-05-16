"""Decision engine respects actor-profile denials (P2)."""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase

from contracts.decision_engine import _evaluate_action_policy
from contracts.models import CaseIntakeProcess, Organization, OrganizationMembership, UserProfile
from contracts.workflow_state_machine import WorkflowRole, WorkflowState

User = get_user_model()


class ActorProfileDecisionEngineIntegrationTest(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Policy Org', slug='policy-org')
        self.user = User.objects.create_user(username='policy_gemeente', password='passP1234!')
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(
            user=self.user,
            defaults={'role': UserProfile.Role.ASSOCIATE},
        )
        self.intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='Wijkteam case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=10),
            case_coordinator=self.user,
            workflow_state=WorkflowState.BUDGET_REVIEW_PENDING,
            aanmelder_actor_profile=CaseIntakeProcess.AanmelderActorProfile.WIJKTEAM,
        )

    def test_wijkteam_cannot_budget_approve_in_decision_engine(self):
        allowed, reason = _evaluate_action_policy(
            action_code='BUDGET_APPROVE',
            current_state=WorkflowState.BUDGET_REVIEW_PENDING,
            actor_role=WorkflowRole.GEMEENTE,
            intake=self.intake,
            case_record=None,
            assessment=None,
            placement=None,
            required_data_complete=True,
            has_summary=True,
            matching_ready=True,
            latest_match_confidence=0.8,
            provider_response_pending_sla_breached=False,
        )
        self.assertFalse(allowed)
        self.assertIn('aanmelder-profiel', reason.lower())
