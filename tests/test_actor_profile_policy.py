"""Actor profile policy (P2 foundation) intersects with WorkflowRole actions."""
from django.test import TestCase

from contracts.actor_profile_policy import (
    actor_profile_allows_action,
    filter_actions_for_actor_profile,
)
from contracts.models import CaseIntakeProcess
from contracts.workflow_state_machine import WorkflowAction, WorkflowRole


class ActorProfilePolicyTest(TestCase):
    def test_wijkteam_gemeente_denies_budget_actions(self):
        role_actions = {
            WorkflowAction.BUDGET_APPROVE,
            WorkflowAction.COMPLETE_SUMMARY,
        }
        filtered = filter_actions_for_actor_profile(
            workflow_role=WorkflowRole.GEMEENTE,
            actor_profile=CaseIntakeProcess.AanmelderActorProfile.WIJKTEAM,
            permitted_actions=role_actions,
        )
        self.assertIn(WorkflowAction.COMPLETE_SUMMARY, filtered)
        self.assertNotIn(WorkflowAction.BUDGET_APPROVE, filtered)

    def test_provider_org_profile_denies_gemeente_only_actions(self):
        role_actions = {
            WorkflowAction.VALIDATE_MATCHING,
            WorkflowAction.PROVIDER_ACCEPT,
        }
        self.assertFalse(
            actor_profile_allows_action(
                workflow_role=WorkflowRole.ZORGAANBIEDER,
                actor_profile=CaseIntakeProcess.AanmelderActorProfile.ZORGAANBIEDER_ORG,
                action=WorkflowAction.VALIDATE_MATCHING,
                permitted_actions=role_actions,
            )
        )
        self.assertTrue(
            actor_profile_allows_action(
                workflow_role=WorkflowRole.ZORGAANBIEDER,
                actor_profile=CaseIntakeProcess.AanmelderActorProfile.ZORGAANBIEDER_ORG,
                action=WorkflowAction.PROVIDER_ACCEPT,
                permitted_actions=role_actions,
            )
        )
