"""
URL-contract test — pins the current route + view-export surface.

Purpose:
- Every named route in the carelane namespace must resolve and reverse.
- Every cross-module symbol that api/ or domain/ imports from views must remain importable.
- Every attribute referenced via `carelane_views.<attr>` in config/urls.py must exist on the
  contracts.views module.

This test is designed to make the future contracts/views/ → views/legacy.py transition safe:
any breakage in re-exports will be caught here before it reaches production.
"""
import importlib

import pytest
from django.test import RequestFactory
from django.urls import NoReverseMatch, resolve, reverse


# ---------------------------------------------------------------------------
# 1. Named routes — every carelane: route must reverse + resolve round-trip
# ---------------------------------------------------------------------------

# Routes that require integer pk/id arguments
_PK_ROUTES = {
    'carelane:matching_candidates_api': {'case_id': 1},
    'carelane:assessment_decision_api': {'case_id': 1},
    'carelane:matching_action_api': {'case_id': 1},
    'carelane:provider_decision_api': {'case_id': 1},
    'carelane:placement_action_api': {'case_id': 1},
    'carelane:case_early_lifecycle_api': {'case_id': 1},
    'carelane:case_summary_api': {'case_id': 1},
    'carelane:placement_budget_decision_api': {'case_id': 1},
    'carelane:activate_placement_monitoring_api': {'case_id': 1},
    'carelane:case_evaluations_api': {'case_id': 1},
    'carelane:case_evaluation_detail_api': {'case_id': 1, 'evaluation_id': 1},
    'carelane:provider_transition_request_api': {'case_id': 1},
    'carelane:transition_request_financial_api': {'case_id': 1, 'transition_id': 1},
    'carelane:intake_action_api': {'case_id': 1},
    'carelane:intake_schedule_api': {'case_id': 1},
    'carelane:classification_confirm': {'intake_id': 1},
    'carelane:case_placement_detail_api': {'case_id': 1},
    'carelane:case_decision_evaluation_api': {'case_id': 1},
    'carelane:case_arrangement_alignment_api': {'case_id': 1},
    'carelane:case_timeline_api': {'case_id': 1},
    'carelane:case_detail_api': {'case_id': 1},
    'carelane:document_detail_api': {'document_id': 1},
    'carelane:serve_case_document_api': {'document_id': 1},
    'carelane:serve_case_document_scoped_api': {'case_id': 1, 'document_id': 1},
    'carelane:serve_urgency_document_api': {'case_id': 1},
    'carelane:member_role_api': {'membership_id': 1},
    'carelane:member_deactivate_api': {'membership_id': 1},
    'carelane:client_detail': {'pk': 1},
    'carelane:client_update': {'pk': 1},
    'carelane:municipality_detail': {'pk': 1},
    'carelane:municipality_update': {'pk': 1},
    'carelane:regional_detail': {'pk': 1},
    'carelane:regional_update': {'pk': 1},
    'carelane:configuration_detail': {'pk': 1},
    'carelane:configuration_update': {'pk': 1},
    'carelane:document_detail': {'pk': 1},
    'carelane:document_update': {'pk': 1},
    'carelane:deadline_update': {'pk': 1},
    'carelane:deadline_complete': {'pk': 1},
    'carelane:budget_detail': {'pk': 1},
    'carelane:budget_update': {'pk': 1},
    'carelane:add_expense': {'budget_pk': 1},
    'carelane:task_update': {'pk': 1},
    'carelane:care_task_update': {'pk': 1},
    'carelane:intake_detail': {'pk': 1},
    'carelane:intake_update': {'pk': 1},
    'carelane:workflow_detail': {'pk': 1},
    'carelane:update_workflow_step': {'pk': 1},
    'carelane:placement_detail': {'pk': 1},
    'carelane:placement_update': {'pk': 1},
    'carelane:signal_detail': {'pk': 1},
    'carelane:signal_update': {'pk': 1},
    'carelane:signal_status_update': {'pk': 1},
    'carelane:risk_log_update': {'pk': 1},
    'carelane:workflow_case_spa': {'pk': 1},
    'carelane:case_detail': {'pk': 1},
    'carelane:case_update': {'pk': 1},
    'carelane:case_archive_action': {'pk': 1},
    'carelane:case_matching_action': {'pk': 1},
    'carelane:case_placement_action': {'pk': 1},
    'carelane:case_provider_response_action': {'pk': 1},
    'carelane:case_communication_action': {'pk': 1},
    'carelane:case_outcome_action': {'pk': 1},
    'carelane:case_document_create': {'pk': 1},
    'carelane:case_task_create': {'pk': 1},
    'carelane:case_signal_create': {'pk': 1},
    'carelane:assessment_detail': {'pk': 1},
    'carelane:assessment_update': {'pk': 1},
    'carelane:waittime_detail': {'pk': 1},
    'carelane:waittime_update': {'pk': 1},
    'carelane:revoke_organization_invite': {'invite_id': 1},
    'carelane:resend_organization_invite': {'invite_id': 1},
    'carelane:case_dispute_export_api': {'case_id': 1},
    'carelane:mark_notification_read': {'pk': 1},
    'carelane:update_membership_role': {'membership_id': 1},
    'carelane:deactivate_organization_member': {'membership_id': 1},
    'carelane:reactivate_organization_member': {'membership_id': 1},
}

# Routes that require a string arg
_STR_ROUTES = {
    'carelane:case_detail_string_fallback_api': {'case_ref': 'ABC-001'},
    'carelane:invitation_action_api': {'invitation_id': 1},
    'carelane:accept_organization_invite': {'token': '00000000-0000-0000-0000-000000000001'},
}

# All no-arg named routes in the carelane namespace
_SIMPLE_ROUTES = [
    'carelane:auth_login_api',
    'carelane:auth_logout_api',
    'carelane:current_user_api',
    'carelane:session_active_organization_api',
    'carelane:cases_api',
    'carelane:cases_bulk_update_api',
    'carelane:intake_form_options_api',
    'carelane:intake_create_api',
    'carelane:assessments_api',
    'carelane:placements_api',
    'carelane:provider_evaluations_list_api',
    'carelane:signals_api',
    'carelane:tasks_api',
    'carelane:documents_api',
    'carelane:members_api',
    'carelane:audit_log_api',
    'carelane:audit_log_export_api',
    'carelane:providers_api',
    'carelane:geocode_vestigingen_api',
    'carelane:municipalities_api',
    'carelane:regions_api',
    'carelane:regions_health_api',
    'carelane:dashboard_summary_api',
    'carelane:coordination_decision_overview_api',
    'carelane:regiekamer_decision_overview_api',
    'carelane:client_list',
    'carelane:client_create',
    'carelane:municipality_list',
    'carelane:municipality_create',
    'carelane:regional_list',
    'carelane:regional_create',
    'carelane:document_list',
    'carelane:document_create',
    'carelane:deadline_list',
    'carelane:deadline_create',
    'carelane:budget_list',
    'carelane:budget_create',
    'carelane:task_list',
    'carelane:task_create',
    'carelane:care_task_kanban',
    'carelane:task_kanban',
    'carelane:care_task_create',
    'carelane:audit_log_list',
    'carelane:notification_list',
    'carelane:mark_all_notifications_read',
    'carelane:switch_organization',
    'carelane:organization_team',
    'carelane:organization_activity',
    'carelane:organization_activity_export',
    'carelane:reports_dashboard',
    'carelane:coordination_provider_response_monitor',
    'carelane:provider_response_monitor',
    'carelane:global_search',
    'carelane:waittime_list',
    'carelane:waittime_create',
    'carelane:intake_list',
    'carelane:intake_create',
    'carelane:matching_dashboard',
    'carelane:workflow_dashboard',
    'carelane:placement_list',
    'carelane:placement_create',
    'carelane:intake_handoff_list',
    'carelane:signal_list',
    'carelane:signal_create',
    'carelane:risk_log_list',
    'carelane:case_list',
    'carelane:case_create',
    'carelane:assessment_list',
    'carelane:assessment_create',
    'carelane:home',
]


@pytest.mark.django_db
@pytest.mark.parametrize('route_name', _SIMPLE_ROUTES)
def test_simple_route_resolves(route_name):
    url = reverse(route_name)
    match = resolve(url)
    assert match is not None


@pytest.mark.django_db
@pytest.mark.parametrize('route_name,kwargs', _PK_ROUTES.items())
def test_pk_route_resolves(route_name, kwargs):
    url = reverse(route_name, kwargs=kwargs)
    match = resolve(url)
    assert match is not None


@pytest.mark.django_db
@pytest.mark.parametrize('route_name,kwargs', _STR_ROUTES.items())
def test_str_route_resolves(route_name, kwargs):
    url = reverse(route_name, kwargs=kwargs)
    match = resolve(url)
    assert match is not None


# ---------------------------------------------------------------------------
# 2. Cross-module symbols — api/ imports from views must stay importable
# ---------------------------------------------------------------------------

_CROSS_MODULE_SYMBOLS = [
    ('contracts.views.matching', '_assign_provider_to_intake'),
    ('contracts.views.matching', '_prepare_waitlist_proposal_for_intake'),
]


@pytest.mark.parametrize('module_path,symbol', _CROSS_MODULE_SYMBOLS)
def test_cross_module_symbol_importable(module_path, symbol):
    mod = importlib.import_module(module_path)
    assert hasattr(mod, symbol), f"{module_path}.{symbol} must remain importable"


# ---------------------------------------------------------------------------
# 3. carelane_views attributes used in config/urls.py must exist
# ---------------------------------------------------------------------------

_CARELANE_VIEWS_ATTRS = [
    'index',
    'favicon',
    'health_check',
    'build_info',
    'ops_system_state',
    'dashboard',
    'profile',
    'settings_hub',
    'design_mode_settings',
    'SignUpView',
]


def test_carelane_views_attrs():
    import contracts.views as carelane_views
    missing = [attr for attr in _CARELANE_VIEWS_ATTRS if not hasattr(carelane_views, attr)]
    assert not missing, f"contracts.views is missing attributes: {missing}"
