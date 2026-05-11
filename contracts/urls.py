from django.urls import path
from django.views.generic.base import RedirectView
from . import views
from .api import views as api_views
from .navigation import SPA_LANDING_URL

app_name = 'careon'

urlpatterns = [
    # API
    path('api/me/', api_views.current_user_api, name='current_user_api'),
    path(
        'api/session/active-organization/',
        api_views.session_active_organization_api,
        name='session_active_organization_api',
    ),
    path('api/cases/', api_views.contracts_api, name='cases_api'),
    path('api/cases/bulk-update/', api_views.cases_bulk_update_api, name='cases_bulk_update_api'),
    path('api/cases/intake-form/', api_views.intake_form_options_api, name='intake_form_options_api'),
    path('api/cases/intake-create/', api_views.intake_create_api, name='intake_create_api'),
    path('api/cases/<int:case_id>/matching-candidates/', api_views.matching_candidates_api, name='matching_candidates_api'),
    path('api/cases/<int:case_id>/assessment-decision/', api_views.assessment_decision_api, name='assessment_decision_api'),
    path('api/cases/<int:case_id>/matching/action/', api_views.matching_action_api, name='matching_action_api'),
    path('api/cases/<int:case_id>/provider-decision/', api_views.provider_decision_api, name='provider_decision_api'),
    path('api/cases/<int:case_id>/placement-action/', api_views.placement_action_api, name='placement_action_api'),
    path('api/cases/<int:case_id>/early-lifecycle/', api_views.case_early_lifecycle_api, name='case_early_lifecycle_api'),
    path('api/cases/<int:case_id>/budget-decision/', api_views.placement_budget_decision_api, name='placement_budget_decision_api'),
    path('api/cases/<int:case_id>/activate-monitoring/', api_views.activate_placement_monitoring_api, name='activate_placement_monitoring_api'),
    path('api/cases/<int:case_id>/evaluations/', api_views.case_evaluations_api, name='case_evaluations_api'),
    path('api/cases/<int:case_id>/evaluations/<int:evaluation_id>/', api_views.case_evaluation_detail_api, name='case_evaluation_detail_api'),
    path('api/cases/<int:case_id>/transition-request/', api_views.provider_transition_request_api, name='provider_transition_request_api'),
    path(
        'api/cases/<int:case_id>/transition-request/<int:transition_id>/financial/',
        api_views.transition_request_financial_api,
        name='transition_request_financial_api',
    ),
    path('api/cases/<int:case_id>/intake-action/', api_views.intake_action_api, name='intake_action_api'),
    path('api/cases/<int:case_id>/placement-detail/', api_views.case_placement_detail_api, name='case_placement_detail_api'),
    path('api/cases/<int:case_id>/decision-evaluation/', api_views.case_decision_evaluation_api, name='case_decision_evaluation_api'),
    path(
        'api/cases/<int:case_id>/arrangement-alignment/',
        api_views.case_arrangement_alignment_api,
        name='case_arrangement_alignment_api',
    ),
    path('api/cases/<int:case_id>/timeline/', api_views.case_timeline_api, name='case_timeline_api'),
    path('api/cases/<int:case_id>/', api_views.case_detail_api, name='case_detail_api'),
    path('api/cases/<str:case_ref>/', api_views.case_detail_string_fallback_api, name='case_detail_string_fallback_api'),
    path('api/assessments/', api_views.assessments_api, name='assessments_api'),
    path('api/placements/', api_views.placements_api, name='placements_api'),
    path('api/provider-evaluations/', api_views.provider_evaluations_list_api, name='provider_evaluations_list_api'),
    path('api/signals/', api_views.signals_api, name='signals_api'),
    path('api/tasks/', api_views.tasks_api, name='tasks_api'),
    path('api/documents/', api_views.documents_api, name='documents_api'),
    path('api/documents/<int:document_id>/', api_views.document_detail_api, name='document_detail_api'),
    path('api/audit-log/', api_views.audit_log_api, name='audit_log_api'),
    path('api/providers/', api_views.providers_api, name='providers_api'),
    path('api/municipalities/', api_views.municipalities_api, name='municipalities_api'),
    path('api/regions/', api_views.regions_api, name='regions_api'),
    path('api/regions/health/', api_views.regions_health_api, name='regions_health_api'),
    path('api/dashboard/', api_views.dashboard_summary_api, name='dashboard_summary_api'),
    path('api/regiekamer/decision-overview/', api_views.regiekamer_decision_overview_api, name='regiekamer_decision_overview_api'),

    # Care core
    path('clients/', views.ClientListView.as_view(), name='client_list'),
    path('clients/new/', views.ClientCreateView.as_view(), name='client_create'),
    path('clients/<int:pk>/', views.ClientDetailView.as_view(), name='client_detail'),
    path('clients/<int:pk>/edit/', views.ClientUpdateView.as_view(), name='client_update'),

    # Municipality & Regional Configurations
    path('gemeenten/', views.MunicipalityConfigurationListView.as_view(), name='municipality_list'),
    path('gemeenten/new/', views.MunicipalityConfigurationCreateView.as_view(), name='municipality_create'),
    path('gemeenten/<int:pk>/', views.MunicipalityConfigurationDetailView.as_view(), name='municipality_detail'),
    path('gemeenten/<int:pk>/edit/', views.MunicipalityConfigurationUpdateView.as_view(), name='municipality_update'),

    path("regio's/", views.RegionalConfigurationListView.as_view(), name='regional_list'),
    path("regio's/new/", views.RegionalConfigurationCreateView.as_view(), name='regional_create'),
    path("regio's/<int:pk>/", views.RegionalConfigurationDetailView.as_view(), name='regional_detail'),
    path("regio's/<int:pk>/edit/", views.RegionalConfigurationUpdateView.as_view(), name='regional_update'),

    path('configuraties/<int:pk>/', views.CareConfigurationDetailView.as_view(), name='configuration_detail'),
    path('configuraties/<int:pk>/edit/', views.CareConfigurationUpdateView.as_view(), name='configuration_update'),

    path('documents/', views.DocumentListView.as_view(), name='document_list'),
    path('documents/new/', views.DocumentCreateView.as_view(), name='document_create'),
    path('documents/<int:pk>/', views.DocumentDetailView.as_view(), name='document_detail'),
    path('documents/<int:pk>/edit/', views.DocumentUpdateView.as_view(), name='document_update'),

    path('deadlines/', views.DeadlineListView.as_view(), name='deadline_list'),
    path('deadlines/new/', views.DeadlineCreateView.as_view(), name='deadline_create'),
    path('deadlines/<int:pk>/edit/', views.DeadlineUpdateView.as_view(), name='deadline_update'),
    path('deadlines/<int:pk>/complete/', views.deadline_complete, name='deadline_complete'),

    path('budgets/', views.BudgetListView.as_view(), name='budget_list'),
    path('budgets/new/', views.BudgetCreateView.as_view(), name='budget_create'),
    path('budgets/<int:pk>/', views.BudgetDetailView.as_view(), name='budget_detail'),
    path('budgets/<int:pk>/edit/', views.BudgetUpdateView.as_view(), name='budget_update'),
    path('budgets/<int:budget_pk>/add-expense/', views.AddExpenseView.as_view(), name='add_expense'),

    path('taken/', views.DeadlineListView.as_view(), name='task_list'),
    path('taken/new/', views.DeadlineCreateView.as_view(), name='task_create'),
    path('taken/<int:pk>/edit/', views.DeadlineUpdateView.as_view(), name='task_update'),
    path('tasks/', views.CareTaskKanbanView.as_view(), name='care_task_kanban'),
    path('tasks/board/', views.task_board_redirect, name='task_kanban'),
    path('tasks/new/', views.CareTaskCreateView.as_view(), name='care_task_create'),
    path('tasks/<int:pk>/edit/', views.CareTaskUpdateView.as_view(), name='care_task_update'),

    path('audit-log/', views.AuditLogListView.as_view(), name='audit_log_list'),
    path('notifications/', views.notification_list, name='notification_list'),
    path('notifications/<int:pk>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('notifications/mark-all-read/', views.mark_all_notifications_read, name='mark_all_notifications_read'),

    path('organizations/switch/', views.switch_organization, name='switch_organization'),
    path('organizations/team/', views.organization_team, name='organization_team'),
    path('organizations/invitations/<uuid:token>/accept/', views.accept_organization_invite, name='accept_organization_invite'),
    path('organizations/invitations/<int:invite_id>/revoke/', views.revoke_organization_invite, name='revoke_organization_invite'),
    path('organizations/invitations/<int:invite_id>/resend/', views.resend_organization_invite, name='resend_organization_invite'),
    path('organizations/members/<int:membership_id>/role/', views.update_membership_role, name='update_membership_role'),
    path('organizations/members/<int:membership_id>/deactivate/', views.deactivate_organization_member, name='deactivate_organization_member'),
    path('organizations/members/<int:membership_id>/reactivate/', views.reactivate_organization_member, name='reactivate_organization_member'),
    path('organizations/activity/', views.organization_activity, name='organization_activity'),
    path('organizations/activity/export/', views.organization_activity_export, name='organization_activity_export'),

    path('reports/', views.reports_dashboard, name='reports_dashboard'),
    path('regiekamer/provider-responses/', views.provider_response_monitor, name='provider_response_monitor'),
    path('search/', views.global_search, name='global_search'),

    path('wachttijden/', views.WaitTimeListView.as_view(), name='waittime_list'),
    path('wachttijden/new/', views.WaitTimeCreateView.as_view(), name='waittime_create'),
    path('wachttijden/<int:pk>/', views.WaitTimeDetailView.as_view(), name='waittime_detail'),
    path('wachttijden/<int:pk>/edit/', views.WaitTimeUpdateView.as_view(), name='waittime_update'),

    # Legacy intake aliases retained as redirects for compatibility.
    path('intakes/', views.case_flow_list_redirect, {'step': 'intake'}, name='intake_list'),
    path('intakes/new/', views.case_flow_create_redirect, {'step': 'intake'}, name='intake_create'),
    path('intakes/<int:pk>/', views.case_flow_detail_redirect, name='intake_detail'),
    path('intakes/<int:pk>/edit/', views.case_flow_update_redirect, name='intake_update'),

    path('matching/', views.matching_dashboard, name='matching_dashboard'),
    path('workflows/', views.reports_dashboard, name='workflow_dashboard'),
    path('workflows/<int:pk>/', views.CareConfigurationDetailView.as_view(), name='workflow_detail'),
    path('workflows/step/<int:pk>/update/', views.CareConfigurationUpdateView.as_view(), name='update_workflow_step'),


    path('plaatsingen/', views.PlacementRequestListView.as_view(), name='placement_list'),
    path('plaatsingen/new/', RedirectView.as_view(pattern_name='careon:matching_dashboard', permanent=False), name='placement_create'),
    path('plaatsingen/<int:pk>/', views.PlacementRequestDetailView.as_view(), name='placement_detail'),
    path('plaatsingen/<int:pk>/edit/', views.PlacementRequestUpdateView.as_view(), name='placement_update'),
    path('intake-overdracht/', views.PlacementRequestListView.as_view(), name='intake_handoff_list'),

    path('signalen/', views.CareSignalListView.as_view(), name='signal_list'),
    path('signalen/new/', views.CareSignalCreateView.as_view(), name='signal_create'),
    path('signalen/<int:pk>/', views.CareSignalDetailView.as_view(), name='signal_detail'),
    path('signalen/<int:pk>/edit/', views.CareSignalUpdateView.as_view(), name='signal_update'),
    path('signalen/<int:pk>/status/', views.signal_update_status, name='signal_status_update'),
    path('risks/', views.CareSignalListView.as_view(), name='risk_log_list'),
    path('risks/<int:pk>/edit/', views.CareSignalUpdateView.as_view(), name='risk_log_update'),

    # SPA dossier route (React shell; client reads case id from path)
    path('cases/<int:pk>/', views.workflow_case_spa_shell, name='workflow_case_spa'),

    path('casussen/', views.CaseIntakeListView.as_view(), name='case_list'),
    path('casussen/new/', views.CaseIntakeCreateView.as_view(), name='case_create'),
    path('casussen/<int:pk>/', views.CaseIntakeDetailView.as_view(), name='case_detail'),
    path('casussen/<int:pk>/edit/', views.CaseIntakeUpdateView.as_view(), name='case_update'),
    path('casussen/<int:pk>/archive/', views.case_archive_action, name='case_archive_action'),
    path('casussen/<int:pk>/matching/action/', views.case_matching_action, name='case_matching_action'),
    path('casussen/<int:pk>/placement/action/', views.case_placement_action, name='case_placement_action'),
    path('casussen/<int:pk>/provider-response/action/', views.case_provider_response_action, name='case_provider_response_action'),
    path('casussen/<int:pk>/communicatie/action/', views.case_communication_action, name='case_communication_action'),
    path('casussen/<int:pk>/outcomes/action/', views.case_outcome_action, name='case_outcome_action'),
    path('casussen/<int:pk>/documenten/new/', views.CaseScopedDocumentCreateView.as_view(), name='case_document_create'),
    path('casussen/<int:pk>/taken/new/', views.CaseScopedDeadlineCreateView.as_view(), name='case_task_create'),
    path('casussen/<int:pk>/signalen/new/', views.CaseScopedCareSignalCreateView.as_view(), name='case_signal_create'),

    # Assessments (Beoordelingen)
    path('beoordelingen/', views.CaseAssessmentListView.as_view(), name='assessment_list'),
    path('beoordelingen/new/', views.CaseAssessmentCreateView.as_view(), name='assessment_create'),
    path('beoordelingen/<int:pk>/', views.CaseAssessmentDetailView.as_view(), name='assessment_detail'),
    path('beoordelingen/<int:pk>/edit/', views.CaseAssessmentUpdateView.as_view(), name='assessment_update'),

    path('', RedirectView.as_view(url=SPA_LANDING_URL, permanent=False), name='home'),
]
