from django.shortcuts import render, redirect, get_object_or_404
from django.views import View
from django.views.generic import ListView, DetailView, CreateView, UpdateView
from django.urls import reverse_lazy
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.contrib import messages

from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import login
from .forms import (
    ChecklistItemForm, WorkflowForm, WorkflowTemplateForm,
    BudgetForm, TrademarkRequestForm, LegalTaskForm, RiskLogForm, ComplianceChecklistForm,
    DueDiligenceProcessForm, DueDiligenceTaskForm, DueDiligenceRiskForm, BudgetExpenseForm
)
from .models import (
    Contract, NegotiationThread, TrademarkRequest, LegalTask, RiskLog, ComplianceChecklist, ChecklistItem,
    Workflow, WorkflowTemplate, WorkflowTemplateStep, WorkflowStep,
    DueDiligenceProcess, DueDiligenceTask, DueDiligenceRisk, Budget, BudgetExpense
)
from django.http import JsonResponse, HttpResponse
from config.feature_flags import get_feature_flag, is_feature_redesign_enabled
from django.conf import settings
from datetime import datetime, timedelta
from django.db.models import Count, Q
from django.core.exceptions import ObjectDoesNotExist
from django.db import models
import json
import logging

logger = logging.getLogger(__name__)

# --- Index View ---
def index(request):
    return redirect('dashboard')

# --- Contract Views ---
class ContractListView(LoginRequiredMixin, ListView):
    model = Contract
    template_name = 'contracts/contract_list.html'
    context_object_name = 'contracts'
    paginate_by = 25

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['FEATURE_REDESIGN'] = is_feature_redesign_enabled()

        if context['FEATURE_REDESIGN']:
            # Prepare contracts data for JavaScript
            contracts_data = []
            for contract in self.get_queryset():
                contracts_data.append({
                    'id': contract.id,
                    'title': contract.title,
                    'status': contract.status,
                    'status_display': contract.get_status_display() if hasattr(contract, 'get_status_display') else contract.status.title(),
                    'start_date': contract.start_date.strftime('%b %d, %Y') if hasattr(contract, 'start_date') and contract.start_date else None,
                    'value': float(contract.value) if hasattr(contract, 'value') and contract.value else None,
                    'counterparty': getattr(contract, 'counterparty', None),
                    'region': getattr(contract, 'region', 'North America'),
                    'owner': contract.created_by.get_full_name() if contract.created_by else 'System',
                    'updated_at': contract.updated_at.strftime('%b %d, %Y') if hasattr(contract, 'updated_at') and contract.updated_at else 'N/A',
                })

            context['contracts_json'] = json.dumps(contracts_data)

        return context

class ContractDetailView(LoginRequiredMixin, DetailView):
    model = Contract
    template_name = 'contracts/contract_detail.html'
    context_object_name = 'contract'

class ContractCreateView(LoginRequiredMixin, CreateView):
    model = Contract
    fields = ['title', 'content', 'status', 'counterparty', 'value', 'start_date', 'end_date']
    template_name = 'contracts/contract_form.html'
    success_url = reverse_lazy('contracts:contract_list')

    def form_valid(self, form):
        form.instance.created_by = self.request.user
        return super().form_valid(form)

class ContractUpdateView(LoginRequiredMixin, UpdateView):
    model = Contract
    fields = ['title', 'content', 'status', 'counterparty', 'value', 'start_date', 'end_date']
    template_name = 'contracts/contract_form.html'
    success_url = reverse_lazy('contracts:contract_list')

# --- Workflow Views ---
class WorkflowTemplateListView(LoginRequiredMixin, ListView):
    model = WorkflowTemplate
    template_name = 'contracts/workflow_template_list.html'
    context_object_name = 'workflow_templates'

class WorkflowTemplateDetailView(LoginRequiredMixin, DetailView):
    model = WorkflowTemplate
    template_name = 'contracts/workflow_template_detail.html'
    context_object_name = 'workflow_template'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['steps'] = WorkflowTemplateStep.objects.filter(template=self.object).order_by('order')
        return context

class WorkflowTemplateCreateView(LoginRequiredMixin, CreateView):
    model = WorkflowTemplate
    form_class = WorkflowTemplateForm
    template_name = 'contracts/workflow_template_form.html'
    success_url = reverse_lazy('contracts:workflow_template_list')

class WorkflowTemplateUpdateView(LoginRequiredMixin, UpdateView):
    model = WorkflowTemplate
    form_class = WorkflowTemplateForm
    template_name = 'contracts/workflow_template_form.html'
    success_url = reverse_lazy('contracts:workflow_template_list')

class WorkflowListView(LoginRequiredMixin, ListView):
    model = Workflow
    template_name = 'contracts/workflow_list.html'
    context_object_name = 'workflows'

    def get_queryset(self):
        queryset = Workflow.objects.all()
        contract_pk = self.request.GET.get('contract_pk')
        if contract_pk:
            queryset = queryset.filter(contract=contract_pk)
        return queryset.order_by('-created_at')

class WorkflowDetailView(LoginRequiredMixin, DetailView):
    model = Workflow
    template_name = 'contracts/workflow_detail.html'
    context_object_name = 'workflow'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['steps'] = WorkflowStep.objects.filter(workflow=self.object).order_by('order')
        context['step_form'] = WorkflowForm()
        return context

class WorkflowCreateView(LoginRequiredMixin, CreateView):
    model = Workflow
    form_class = WorkflowForm
    template_name = 'contracts/workflow_form.html'

    def get_success_url(self):
        return reverse_lazy('contracts:workflow_detail', kwargs={'pk': self.object.pk})

    def form_valid(self, form):
        form.instance.created_by = self.request.user
        return super().form_valid(form)

class WorkflowUpdateView(LoginRequiredMixin, UpdateView):
    model = Workflow
    form_class = WorkflowForm
    template_name = 'contracts/workflow_form.html'

    def get_success_url(self):
        return reverse_lazy('contracts:workflow_detail', kwargs={'pk': self.object.pk})

# --- Legal Task Views ---
class LegalTaskKanbanView(LoginRequiredMixin, ListView):
    model = LegalTask
    template_name = 'contracts/legal_task_board.html'
    context_object_name = 'legal_tasks'

class LegalTaskCreateView(LoginRequiredMixin, CreateView):
    model = LegalTask
    form_class = LegalTaskForm
    template_name = 'contracts/legal_task_form.html'
    success_url = reverse_lazy('contracts:legal_task_kanban')

class LegalTaskUpdateView(LoginRequiredMixin, UpdateView):
    model = LegalTask
    form_class = LegalTaskForm
    template_name = 'contracts/legal_task_form.html'
    success_url = reverse_lazy('contracts:legal_task_kanban')

# --- Trademark Views ---
class TrademarkRequestListView(LoginRequiredMixin, ListView):
    model = TrademarkRequest
    template_name = 'contracts/trademark_request_list.html'
    context_object_name = 'trademark_requests'

class TrademarkRequestDetailView(LoginRequiredMixin, DetailView):
    model = TrademarkRequest
    template_name = 'contracts/trademark_request_detail.html'
    context_object_name = 'trademark_request'

class TrademarkRequestCreateView(LoginRequiredMixin, CreateView):
    model = TrademarkRequest
    form_class = TrademarkRequestForm
    template_name = 'contracts/trademark_request_form.html'
    success_url = reverse_lazy('contracts:trademark_request_list')

class TrademarkRequestUpdateView(LoginRequiredMixin, UpdateView):
    model = TrademarkRequest
    form_class = TrademarkRequestForm
    template_name = 'contracts/trademark_request_form.html'
    success_url = reverse_lazy('contracts:trademark_request_list')

# --- Risk Management Views ---
class RiskLogListView(LoginRequiredMixin, ListView):
    model = RiskLog
    template_name = 'contracts/risk_log_list.html'
    context_object_name = 'risk_logs'

class RiskLogCreateView(LoginRequiredMixin, CreateView):
    model = RiskLog
    form_class = RiskLogForm
    template_name = 'contracts/risk_log_form.html'
    success_url = reverse_lazy('contracts:risk_log_list')

class RiskLogUpdateView(LoginRequiredMixin, UpdateView):
    model = RiskLog
    form_class = RiskLogForm
    template_name = 'contracts/risk_log_form.html'
    success_url = reverse_lazy('contracts:risk_log_list')

# --- Compliance Views ---
class ComplianceChecklistListView(LoginRequiredMixin, ListView):
    model = ComplianceChecklist
    template_name = 'contracts/compliance_checklist_list.html'
    context_object_name = 'compliance_checklists'

class ComplianceChecklistDetailView(LoginRequiredMixin, DetailView):
    model = ComplianceChecklist
    template_name = 'contracts/compliance_checklist_detail.html'
    context_object_name = 'compliance_checklist'

class ComplianceChecklistCreateView(LoginRequiredMixin, CreateView):
    model = ComplianceChecklist
    form_class = ComplianceChecklistForm
    template_name = 'contracts/compliance_checklist_form.html'
    success_url = reverse_lazy('contracts:compliance_checklist_list')

class ComplianceChecklistUpdateView(LoginRequiredMixin, UpdateView):
    model = ComplianceChecklist
    form_class = ComplianceChecklistForm
    template_name = 'contracts/compliance_checklist_form.html'
    success_url = reverse_lazy('contracts:compliance_checklist_list')

# --- Due Diligence Views ---
class DueDiligenceListView(LoginRequiredMixin, ListView):
    model = DueDiligenceProcess
    template_name = 'contracts/due_diligence_list.html'
    context_object_name = 'processes'

class DueDiligenceCreateView(LoginRequiredMixin, CreateView):
    model = DueDiligenceProcess
    form_class = DueDiligenceProcessForm
    template_name = 'contracts/due_diligence_form.html'
    success_url = reverse_lazy('contracts:due_diligence_list')

class DueDiligenceDetailView(LoginRequiredMixin, DetailView):
    model = DueDiligenceProcess
    template_name = 'contracts/due_diligence_detail.html'
    context_object_name = 'process'

class DueDiligenceUpdateView(LoginRequiredMixin, UpdateView):
    model = DueDiligenceProcess
    form_class = DueDiligenceProcessForm
    template_name = 'contracts/due_diligence_form.html'
    success_url = reverse_lazy('contracts:due_diligence_list')

# --- Budget Views ---
class BudgetListView(LoginRequiredMixin, ListView):
    model = Budget
    template_name = 'contracts/budget_list.html'
    context_object_name = 'budgets'

class BudgetCreateView(LoginRequiredMixin, CreateView):
    model = Budget
    form_class = BudgetForm
    template_name = 'contracts/budget_form.html'
    success_url = reverse_lazy('contracts:budget_list')

class BudgetDetailView(LoginRequiredMixin, DetailView):
    model = Budget
    template_name = 'contracts/budget_detail.html'
    context_object_name = 'budget'

class BudgetUpdateView(LoginRequiredMixin, UpdateView):
    model = Budget
    form_class = BudgetForm
    template_name = 'contracts/budget_form.html'
    success_url = reverse_lazy('contracts:budget_list')

# --- Helper Views ---
class RepositoryView(LoginRequiredMixin, ListView):
    model = Contract
    template_name = 'contracts/repository.html'
    context_object_name = 'contracts'

class ProfileView(View):
    def get(self, request):
        return render(request, 'profile.html')

class SignUpView(CreateView):
    form_class = UserCreationForm
    success_url = reverse_lazy('login')
    template_name = 'registration/register.html'

    def form_valid(self, form):
        response = super().form_valid(form)
        login(self.request, self.object)
        return response

# --- Negotiation Views ---
class AddNegotiationNoteView(CreateView):
    model = NegotiationThread
    fields = ['title', 'content']
    template_name = 'contracts/negotiation_note_form.html'

    def form_valid(self, form):
        form.instance.contract_id = self.kwargs['pk']
        form.instance.created_by = self.request.user
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('contracts:contract_detail', kwargs={'pk': self.kwargs['pk']})

# --- Action Views ---
class ToggleChecklistItemView(LoginRequiredMixin, View):
    def post(self, request, pk):
        item = get_object_or_404(ChecklistItem, pk=pk)
        item.is_completed = not item.is_completed
        item.save()
        return redirect('contracts:compliance_checklist_detail', pk=item.checklist.pk)

class AddChecklistItemView(LoginRequiredMixin, CreateView):
    model = ChecklistItem
    form_class = ChecklistItemForm
    template_name = 'contracts/checklist_item_form.html'

    def form_valid(self, form):
        form.instance.checklist_id = self.kwargs['checklist_pk']
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('contracts:compliance_checklist_detail', kwargs={'pk': self.kwargs['checklist_pk']})

class AddDueDiligenceItemView(LoginRequiredMixin, CreateView):
    model = DueDiligenceTask
    form_class = DueDiligenceTaskForm
    template_name = 'contracts/dd_task_form.html'

    def form_valid(self, form):
        form.instance.process_id = self.kwargs['process_pk']
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('contracts:due_diligence_detail', kwargs={'pk': self.kwargs['process_pk']})

class AddDueDiligenceRiskView(LoginRequiredMixin, CreateView):
    model = DueDiligenceRisk
    form_class = DueDiligenceRiskForm
    template_name = 'contracts/dd_risk_form.html'

    def form_valid(self, form):
        form.instance.process_id = self.kwargs['process_pk']
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('contracts:due_diligence_detail', kwargs={'pk': self.kwargs['process_pk']})

class AddExpenseView(LoginRequiredMixin, CreateView):
    model = BudgetExpense
    form_class = BudgetExpenseForm
    template_name = 'contracts/expense_form.html'

    def form_valid(self, form):
        form.instance.budget_id = self.kwargs['budget_pk']
        form.instance.created_by = self.request.user
        return super().form_valid(form)

    def get_success_url(self):
        return reverse_lazy('contracts:budget_detail', kwargs={'pk': self.kwargs['budget_pk']})

class WorkflowStepUpdateView(LoginRequiredMixin, UpdateView):
    model = WorkflowStep
    fields = ['status', 'assigned_to', 'due_date']
    template_name = 'contracts/workflow_step_form.html'

    def get_success_url(self):
        return reverse_lazy('contracts:workflow_detail', kwargs={'pk': self.object.workflow.pk})

class WorkflowStepCompleteView(LoginRequiredMixin, View):
    def post(self, request, pk):
        step = get_object_or_404(WorkflowStep, pk=pk)
        step.status = 'COMPLETED'
        step.save()
        return redirect('contracts:workflow_detail', pk=step.workflow.pk)

class AddWorkflowStepView(LoginRequiredMixin, View):
    def post(self, request, pk):
        workflow = get_object_or_404(Workflow, pk=pk)
        form = WorkflowForm(request.POST)
        if form.is_valid():
            step = form.save(commit=False)
            step.workflow = workflow
            step.save()
        return redirect('contracts:workflow_detail', pk=workflow.pk)

class AddWorkflowTemplateStepView(LoginRequiredMixin, View):
    def post(self, request, pk):
        template = get_object_or_404(WorkflowTemplate, pk=pk)
        # Template step creation logic would go here
        return redirect('contracts:workflow_template_detail', pk=template.pk)

# --- Function-based Views ---
def health_check(request):
    """Health check endpoint for deployment verification"""
    return HttpResponse("OK", content_type="text/plain")

@login_required
def toggle_redesign(request):
    """Toggle the FEATURE_REDESIGN flag for development"""
    if request.method == 'POST':
        import os
        # Toggle the environment variable
        current_value = os.environ.get('FEATURE_REDESIGN', 'false').lower()
        new_value = 'false' if current_value == 'true' else 'true'
        os.environ['FEATURE_REDESIGN'] = new_value
        # Clear the cache for feature flags if you have one
        from config.feature_flags import cache
        cache.clear()
        return redirect(request.META.get('HTTP_REFERER', 'dashboard'))
    return redirect('dashboard')

def workflow_dashboard(request):
    """Display workflow dashboard"""
    workflows = Workflow.objects.all()
    context = {'workflows': workflows}
    return render(request, 'contracts/workflow_dashboard.html', context)

def toggle_dd_item(request, pk):
    task = get_object_or_404(DueDiligenceTask, pk=pk)
    if task.status == 'COMPLETED':
        task.status = 'PENDING'
    else:
        task.status = 'COMPLETED'
    task.save()
    return redirect('contracts:due_diligence_detail', pk=task.process.pk)

def profile(request):
    return render(request, 'profile.html')

def workflow_create(request):
    if request.method == 'POST':
        form = WorkflowForm(request.POST)
        if form.is_valid():
            workflow = form.save(commit=False)
            workflow.created_by = request.user
            workflow.save()
            return redirect('contracts:workflow_detail', pk=workflow.pk)
    else:
        form = WorkflowForm()
    return render(request, 'contracts/workflow_form.html', {'form': form})

def workflow_detail(request, pk):
    workflow = get_object_or_404(Workflow, pk=pk)
    steps = WorkflowStep.objects.filter(workflow=workflow).order_by('order')
    return render(request, 'contracts/workflow_detail.html', {'workflow': workflow, 'steps': steps})

def workflow_template_create(request):
    if request.method == 'POST':
        form = WorkflowTemplateForm(request.POST)
        if form.is_valid():
            template = form.save()
            return redirect('contracts:workflow_template_detail', pk=template.pk)
    else:
        form = WorkflowTemplateForm()
    return render(request, 'contracts/workflow_template_form.html', {'form': form})

def workflow_template_detail(request, pk):
    template = get_object_or_404(WorkflowTemplate, pk=pk)
    steps = WorkflowTemplateStep.objects.filter(template=template).order_by('order')
    return render(request, 'contracts/workflow_template_detail.html', {'workflow_template': template, 'steps': steps})

def workflow_template_list(request):
    templates = WorkflowTemplate.objects.all()
    return render(request, 'contracts/workflow_template_list.html', {'workflow_templates': templates})

# --- Dashboard View ---
def dashboard(request):
    # Basic counts - using safe database queries
    try:
        total_contracts = Contract.objects.count()
    except Exception as e:
        print(f"Error fetching total contracts: {e}")
        total_contracts = 0

    try:
        active_contracts = Contract.objects.filter(status='ACTIVE').count()
    except Exception as e:
        print(f"Error fetching active contracts: {e}")
        active_contracts = 0

    try:
        pending_tasks = LegalTask.objects.filter(status='PENDING').count()
    except Exception as e:
        print(f"Error fetching pending tasks: {e}")
        pending_tasks = 0

    try:
        active_workflows = Workflow.objects.filter(status='ACTIVE').count()
    except Exception as e:
        print(f"Error fetching active workflows: {e}")
        active_workflows = 0

    try:
        trademark_requests = TrademarkRequest.objects.count()
    except Exception as e:
        print(f"Error fetching trademark requests: {e}")
        trademark_requests = 0

    try:
        pending_trademarks = TrademarkRequest.objects.filter(status='PENDING').count()
    except Exception as e:
        print(f"Error fetching pending trademarks: {e}")
        pending_trademarks = 0

    try:
        risk_count = RiskLog.objects.filter(risk_level__in=['HIGH', 'CRITICAL']).count()
    except Exception as e:
        print(f"Error fetching risk count: {e}")
        risk_count = 0

    # Recent activity - only fetch fields that exist
    try:
        recent_contracts = Contract.objects.order_by('-created_at')[:5]
    except Exception as e:
        print(f"Error fetching recent contracts: {e}")
        recent_contracts = []

    try:
        upcoming_tasks = LegalTask.objects.filter(
            status='PENDING',
            due_date__gte=timezone.now().date()
        ).order_by('due_date')[:5]
    except Exception as e:
        print(f"Error fetching upcoming tasks: {e}")
        upcoming_tasks = []

    try:
        upcoming_checklists = ChecklistItem.objects.filter(
            is_completed=False
        ).select_related('checklist')[:5]
    except Exception as e:
        print(f"Error fetching upcoming checklists: {e}")
        upcoming_checklists = []

    # Contracts expiring in next 30 days using end_date field
    try:
        thirty_days_from_now = timezone.now().date() + timedelta(days=30)
        expiring_soon_count = Contract.objects.filter(
            end_date__lte=thirty_days_from_now,
            end_date__gte=timezone.now().date(),
            status='ACTIVE'
        ).count()
    except Exception as e:
        print(f"Error fetching expiring contracts: {e}")
        expiring_soon_count = 0

    context = {
        'total_contracts': total_contracts,
        'active_contracts': active_contracts,
        'pending_tasks': pending_tasks,
        'active_workflows': active_workflows,
        'trademark_requests': trademark_requests,
        'pending_trademarks': pending_trademarks,
        'risk_count': risk_count,
        'recent_contracts': recent_contracts,
        'upcoming_tasks': upcoming_tasks,
        'upcoming_checklists': upcoming_checklists,
        'expiring_soon_count': expiring_soon_count,
        'FEATURE_REDESIGN': is_feature_redesign_enabled(),
    }
    return render(request, 'dashboard.html', context)