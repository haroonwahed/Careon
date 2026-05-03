from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q
from django.http import Http404

from .models import Client, OrganizationMembership, PlacementRequest
from .workflow_state_machine import WorkflowRole, resolve_actor_role

User = get_user_model()


class CaseAction:
    VIEW = 'view'
    COMMENT = 'comment'
    AI = 'ai'
    EDIT = 'edit'


def get_active_org_membership(user, organization):
    if not user or not getattr(user, 'is_authenticated', False) or organization is None:
        return None
    return (
        OrganizationMembership.objects
        .filter(
            user=user,
            organization=organization,
            is_active=True,
            organization__is_active=True,
        )
        .first()
    )


def can_manage_organization(user, organization):
    membership = get_active_org_membership(user, organization)
    if membership is None:
        return False
    return membership.role in [OrganizationMembership.Role.OWNER, OrganizationMembership.Role.ADMIN]


def is_organization_owner(user, organization):
    membership = get_active_org_membership(user, organization)
    return bool(membership and membership.role == OrganizationMembership.Role.OWNER)


def provider_client_ids_for_user(user, organization):
    """Provider-staff users are linked to aanbieder Client rows via responsible_coordinator."""
    if not user or not getattr(user, 'is_authenticated', False) or organization is None:
        return frozenset()
    return frozenset(
        Client.objects.filter(
            organization=organization,
            responsible_coordinator=user,
        ).values_list('pk', flat=True)
    )


def case_is_visible_to_provider_user(user, case):
    """
    True when a PlacementRequest ties this case (via intake) to a provider Client
    that lists this user as responsible coordinator.
    """
    org = case.organization
    if org is None:
        return False
    ids = provider_client_ids_for_user(user, org)
    if not ids:
        return False
    return PlacementRequest.objects.filter(
        due_diligence_process__contract=case,
    ).filter(
        Q(proposed_provider_id__in=ids) | Q(selected_provider_id__in=ids)
    ).exists()


def ensure_provider_case_visible_or_404(user, case):
    """
    For zorgaanbieder users: require a placement link to one of their provider Client records.
    Gemeente/admin are unchanged. Raises Http404 to match cross-tenant id discovery rules.
    """
    if case is None:
        raise Http404
    org = case.organization
    if org is None:
        raise Http404
    if resolve_actor_role(user=user, organization=org) != WorkflowRole.ZORGAANBIEDER:
        return
    if not case_is_visible_to_provider_user(user, case):
        raise Http404


def filter_care_cases_for_provider_actor(queryset, user, organization):
    """Narrow CareCase queryset for zorgaanbieder workflow users; no-op for gemeente/admin."""
    if organization is None:
        return queryset.none()
    if resolve_actor_role(user=user, organization=organization) != WorkflowRole.ZORGAANBIEDER:
        return queryset
    ids = provider_client_ids_for_user(user, organization)
    if not ids:
        return queryset.none()
    placement_qs = PlacementRequest.objects.filter(
        due_diligence_process__contract_id=OuterRef('pk'),
    ).filter(
        Q(proposed_provider_id__in=ids) | Q(selected_provider_id__in=ids)
    )
    return queryset.filter(Exists(placement_qs))


def can_access_case_action(user, case, action=CaseAction.VIEW):
    if case is None:
        return False

    membership = get_active_org_membership(user, case.organization)
    if membership is None:
        return False

    actor_role = resolve_actor_role(user=user, organization=case.organization)
    if actor_role == WorkflowRole.ZORGAANBIEDER:
        if not case_is_visible_to_provider_user(user, case):
            return False

    if action in [CaseAction.VIEW, CaseAction.COMMENT, CaseAction.AI]:
        return True

    if action == CaseAction.EDIT:
        if membership.role in [OrganizationMembership.Role.OWNER, OrganizationMembership.Role.ADMIN]:
            return True
        return bool(case.created_by_id and case.created_by_id == user.id)

    return False


ContractAction = CaseAction
can_access_contract_action = can_access_case_action
