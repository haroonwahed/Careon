"""
Workflow integrity — canonical flow is law (no skips, no illegal jumps, tenancy gates).

Casus → Samenvatting → Matching → Gemeente Validatie → Aanbieder Beoordeling → Plaatsing → Intake
"""

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CareCase,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    UserProfile,
)
from contracts.permissions import CaseAction, can_access_case_action
from contracts.tenancy import scope_queryset_for_organization
from contracts.workflow_state_machine import (
    WorkflowAction,
    WorkflowRole,
    WorkflowState,
    can_transition,
    evaluate_transition,
    resolve_actor_role,
)

from contracts.management.commands.seed_demo_data import CASE_TITLES

User = get_user_model()


class WorkflowTransitionLawTests(TestCase):
    def test_forward_edges_from_state_machine_are_allowed(self):
        edges = [
            (WorkflowState.DRAFT_CASE, WorkflowState.SUMMARY_READY),
            (WorkflowState.SUMMARY_READY, WorkflowState.MATCHING_READY),
            (WorkflowState.MATCHING_READY, WorkflowState.GEMEENTE_VALIDATED),
            (WorkflowState.GEMEENTE_VALIDATED, WorkflowState.PROVIDER_REVIEW_PENDING),
            (WorkflowState.PROVIDER_ACCEPTED, WorkflowState.PLACEMENT_CONFIRMED),
            (WorkflowState.PLACEMENT_CONFIRMED, WorkflowState.INTAKE_STARTED),
        ]
        for current, target in edges:
            with self.subTest(current=current, target=target):
                self.assertTrue(can_transition(current, target))

    def test_phase_skip_is_rejected(self):
        self.assertFalse(can_transition(WorkflowState.DRAFT_CASE, WorkflowState.MATCHING_READY))
        self.assertFalse(can_transition(WorkflowState.SUMMARY_READY, WorkflowState.GEMEENTE_VALIDATED))

    def test_backward_transition_rejected(self):
        self.assertFalse(can_transition(WorkflowState.MATCHING_READY, WorkflowState.SUMMARY_READY))
        self.assertFalse(can_transition(WorkflowState.PROVIDER_REVIEW_PENDING, WorkflowState.DRAFT_CASE))

    def test_provider_action_forbidden_for_gemeente_role(self):
        dec = evaluate_transition(
            current_state=WorkflowState.PROVIDER_REVIEW_PENDING,
            target_state=WorkflowState.PROVIDER_ACCEPTED,
            actor_role=WorkflowRole.GEMEENTE,
            action=WorkflowAction.PROVIDER_ACCEPT,
        )
        self.assertFalse(dec.allowed)

    def test_evaluate_transition_invalid_jump(self):
        dec = evaluate_transition(
            current_state=WorkflowState.DRAFT_CASE,
            target_state=WorkflowState.INTAKE_STARTED,
            actor_role=WorkflowRole.GEMEENTE,
            action=WorkflowAction.CONFIRM_PLACEMENT,
        )
        self.assertFalse(dec.allowed)


class SeededPilotIntegrityTests(TestCase):
    """Uses deterministic gemeente-demo seed — validates isolation + referential sanity."""

    def setUp(self):
        call_command("seed_demo_data", reset=True, locked_time=True, verbosity=0)

    def test_no_orphan_placements_after_seed(self):
        orphaned = PlacementRequest.objects.filter(due_diligence_process__isnull=True).count()
        self.assertEqual(orphaned, 0)

    def test_provider_without_placement_link_cannot_view_case(self):
        org = Organization.objects.get(slug="gemeente-demo")
        case = CareCase.objects.filter(organization=org).exclude(title=CASE_TITLES[0]).first()
        self.assertIsNotNone(case)
        provider = User.objects.create_user(username="wf_iso_provider", password="pw-wf-test")

        OrganizationMembership.objects.create(
            organization=org,
            user=provider,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        provider.profile.role = UserProfile.Role.CLIENT
        provider.profile.save(update_fields=['role'])
        other = User.objects.create_user(username="wf_iso_other", password="pw-wf-test")
        OrganizationMembership.objects.create(
            organization=org,
            user=other,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        other.profile.role = UserProfile.Role.ASSOCIATE
        other.profile.save(update_fields=['role'])
        self.assertFalse(can_access_case_action(provider, case, CaseAction.VIEW))
        self.assertTrue(can_access_case_action(other, case, CaseAction.VIEW))

    def test_tenant_scope_excludes_foreign_org_case(self):
        org_demo = Organization.objects.get(slug="gemeente-demo")
        org_other = Organization.objects.create(name="Other Org WF", slug="other-org-wf")
        foreign_owner = User.objects.create_user(username="wf_foreign_owner", password="pw-wf-test")
        OrganizationMembership.objects.create(
            organization=org_other,
            user=foreign_owner,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=foreign_owner, defaults={'role': UserProfile.Role.ASSOCIATE})
        foreign = CareCase.objects.create(
            organization=org_other,
            title="Foreign case",
            contract_type=CareCase.ContractType.NDA,
            status=CareCase.Status.ACTIVE,
            created_by=foreign_owner,
        )
        qs = scope_queryset_for_organization(CareCase.objects.all(), org_demo)
        self.assertFalse(qs.filter(pk=foreign.pk).exists())


class WorkflowResolveActorTests(TestCase):
    def test_resolve_actor_gemeente_membership(self):
        org = Organization.objects.create(name="WF Org", slug="wf-org")
        user = User.objects.create_user(username="wf_gemeente", password="pw-wf-test")

        OrganizationMembership.objects.create(
            organization=org,
            user=user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        self.assertEqual(user.profile.role, UserProfile.Role.ASSOCIATE)
        self.assertEqual(resolve_actor_role(user=user, organization=org), WorkflowRole.GEMEENTE)

    def test_resolve_actor_without_userprofile_does_not_raise(self):
        """Resolver must not 500 if UserProfile is missing (data repair / legacy DB)."""
        org = Organization.objects.create(name="WF Org No Profile", slug="wf-org-noprof")
        user = User.objects.create_user(username="wf_no_profile", password="pw-wf-test")
        OrganizationMembership.objects.create(
            organization=org,
            user=user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.filter(user=user).delete()
        self.assertFalse(UserProfile.objects.filter(user=user).exists())
        self.assertEqual(resolve_actor_role(user=user, organization=org), WorkflowRole.GEMEENTE)


class UnauthorizedApiReadsTests(TestCase):
    def test_cases_api_401_when_anonymous(self):
        client = Client()
        response = client.get(reverse("careon:cases_api"))
        self.assertIn(response.status_code, (401, 302))
