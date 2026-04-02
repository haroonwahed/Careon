from django.urls import path
from . import views
from .api import views as api_views

app_name = 'contracts'

urlpatterns = [
    path('api/contracts/', api_views.contracts_api, name='contracts_api'),
    path('api/contracts/<str:contract_id>/', api_views.contract_detail_api, name='contract_detail_api'),
    path('api/contracts/bulk-update/', api_views.contracts_bulk_update_api, name='contracts_bulk_update_api'),

    # Clients
    path('clients/', views.ClientListView.as_view(), name='client_list'),
    path('clients/new/', views.ClientCreateView.as_view(), name='client_create'),
    path('clients/<int:pk>/', views.ClientDetailView.as_view(), name='client_detail'),
    path('clients/<int:pk>/edit/', views.ClientUpdateView.as_view(), name='client_update'),

    # Matters
    path('matters/', views.MatterListView.as_view(), name='matter_list'),
    path('matters/new/', views.MatterCreateView.as_view(), name='matter_create'),
    path('matters/<int:pk>/', views.MatterDetailView.as_view(), name='matter_detail'),
    path('matters/<int:pk>/edit/', views.MatterUpdateView.as_view(), name='matter_update'),

    # Documents
    path('documents/', views.DocumentListView.as_view(), name='document_list'),
    path('documents/new/', views.DocumentCreateView.as_view(), name='document_create'),
    path('documents/<int:pk>/', views.DocumentDetailView.as_view(), name='document_detail'),
    path('documents/<int:pk>/edit/', views.DocumentUpdateView.as_view(), name='document_update'),

    # Time Entries
    path('time/', views.TimeEntryListView.as_view(), name='time_entry_list'),
    path('time/new/', views.TimeEntryCreateView.as_view(), name='time_entry_create'),
    path('time/<int:pk>/edit/', views.TimeEntryUpdateView.as_view(), name='time_entry_update'),

    # Invoices
    path('invoices/', views.InvoiceListView.as_view(), name='invoice_list'),
    path('invoices/new/', views.InvoiceCreateView.as_view(), name='invoice_create'),
    path('invoices/<int:pk>/', views.InvoiceDetailView.as_view(), name='invoice_detail'),
    path('invoices/<int:pk>/edit/', views.InvoiceUpdateView.as_view(), name='invoice_update'),

    # Trust Accounts
    path('trust-accounts/', views.TrustAccountListView.as_view(), name='trust_account_list'),
    path('trust-accounts/new/', views.TrustAccountCreateView.as_view(), name='trust_account_create'),
    path('trust-accounts/<int:pk>/', views.TrustAccountDetailView.as_view(), name='trust_account_detail'),
    path('trust-accounts/<int:account_pk>/add-transaction/', views.AddTrustTransactionView.as_view(), name='add_trust_transaction'),

    # Deadlines
    path('deadlines/', views.DeadlineListView.as_view(), name='deadline_list'),
    path('deadlines/new/', views.DeadlineCreateView.as_view(), name='deadline_create'),
    path('deadlines/<int:pk>/edit/', views.DeadlineUpdateView.as_view(), name='deadline_update'),
    path('deadlines/<int:pk>/complete/', views.deadline_complete, name='deadline_complete'),

    # Conflict Checks
    path('conflicts/', views.ConflictCheckListView.as_view(), name='conflict_check_list'),
    path('conflicts/new/', views.ConflictCheckCreateView.as_view(), name='conflict_check_create'),
    path('conflicts/<int:pk>/edit/', views.ConflictCheckUpdateView.as_view(), name='conflict_check_update'),

    # Audit Log
    path('audit-log/', views.AuditLogListView.as_view(), name='audit_log_list'),

    # Notifications
    path('notifications/', views.notification_list, name='notification_list'),
    path('notifications/<int:pk>/read/', views.mark_notification_read, name='mark_notification_read'),
    path('notifications/mark-all-read/', views.mark_all_notifications_read, name='mark_all_notifications_read'),

    # Reports
    path('reports/', views.reports_dashboard, name='reports_dashboard'),

    # Due Diligence
    path('due-diligence/', views.DueDiligenceListView.as_view(), name='due_diligence_list'),
    path('due-diligence/new/', views.DueDiligenceCreateView.as_view(), name='due_diligence_create'),
    path('due-diligence/<int:pk>/', views.DueDiligenceDetailView.as_view(), name='due_diligence_detail'),
    path('due-diligence/<int:pk>/edit/', views.DueDiligenceUpdateView.as_view(), name='due_diligence_update'),
    path('due-diligence/<int:process_pk>/add-item/', views.AddDueDiligenceItemView.as_view(), name='add_dd_item'),
    path('due-diligence/<int:process_pk>/add-risk/', views.AddDueDiligenceRiskView.as_view(), name='add_dd_risk'),
    path('dd-item/<int:pk>/toggle/', views.toggle_dd_item, name='toggle_dd_item'),

    # Legal Tasks
    path('legal-tasks/', views.LegalTaskKanbanView.as_view(), name='legal_task_kanban'),
    path('legal-tasks/new/', views.LegalTaskCreateView.as_view(), name='legal_task_create'),
    path('legal-tasks/<int:pk>/edit/', views.LegalTaskUpdateView.as_view(), name='legal_task_update'),

    # Trademarks
    path('trademarks/', views.TrademarkRequestListView.as_view(), name='trademark_request_list'),
    path('trademarks/new/', views.TrademarkRequestCreateView.as_view(), name='trademark_request_create'),
    path('trademarks/<int:pk>/', views.TrademarkRequestDetailView.as_view(), name='trademark_request_detail'),
    path('trademarks/<int:pk>/edit/', views.TrademarkRequestUpdateView.as_view(), name='trademark_request_update'),

    # Risks
    path('risks/', views.RiskLogListView.as_view(), name='risk_log_list'),
    path('risks/new/', views.RiskLogCreateView.as_view(), name='risk_log_create'),
    path('risks/<int:pk>/edit/', views.RiskLogUpdateView.as_view(), name='risk_log_update'),

    # Compliance
    path('compliance/', views.ComplianceChecklistListView.as_view(), name='compliance_checklist_list'),
    path('compliance/new/', views.ComplianceChecklistCreateView.as_view(), name='compliance_checklist_create'),
    path('compliance/<int:pk>/', views.ComplianceChecklistDetailView.as_view(), name='compliance_checklist_detail'),
    path('compliance/<int:pk>/edit/', views.ComplianceChecklistUpdateView.as_view(), name='compliance_checklist_update'),
    path('compliance/<int:pk>/toggle-item/', views.ToggleChecklistItemView.as_view(), name='toggle_checklist_item'),
    path('compliance/<int:pk>/add-item/', views.AddChecklistItemView.as_view(), name='add_checklist_item'),

    # Budgets
    path('budgets/', views.BudgetListView.as_view(), name='budget_list'),
    path('budgets/new/', views.BudgetCreateView.as_view(), name='budget_create'),
    path('budgets/<int:pk>/', views.BudgetDetailView.as_view(), name='budget_detail'),
    path('budgets/<int:pk>/edit/', views.BudgetUpdateView.as_view(), name='budget_update'),
    path('budgets/<int:budget_pk>/add-expense/', views.AddExpenseView.as_view(), name='add_expense'),

    # Workflows
    path('workflows/', views.workflow_dashboard, name='workflow_dashboard'),
    path('workflows/create/', views.workflow_create, name='workflow_create'),
    path('workflows/templates/', views.workflow_template_list, name='workflow_template_list'),
    path('workflows/templates/create/', views.workflow_template_create, name='workflow_template_create'),
    path('workflows/templates/<int:pk>/', views.workflow_template_detail, name='workflow_template_detail'),
    path('workflows/<int:pk>/', views.workflow_detail, name='workflow_detail'),

    # Templates
    path('templates/', views.WorkflowTemplateListView.as_view(), name='templates_list'),

    # Repository
    path('repository/', views.RepositoryView.as_view(), name='repository'),

    # Contracts
    path('', views.ContractListView.as_view(), name='contract_list'),
    path('<int:pk>/', views.ContractDetailView.as_view(), name='contract_detail'),
    path('new/', views.ContractCreateView.as_view(), name='contract_create'),
    path('<int:pk>/edit/', views.ContractUpdateView.as_view(), name='contract_update'),
    path('<int:pk>/add_note/', views.AddNegotiationNoteView.as_view(), name='add_negotiation_note'),
]
