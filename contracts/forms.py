from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth import get_user_model
from .models import (
    NegotiationThread, ChecklistItem, Workflow, WorkflowTemplate,
    DueDiligence, DueDiligenceItem, DueDiligenceRisk, Budget, Expense
)

User = get_user_model()


class RegistrationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ('username', 'email')


class NegotiationThreadForm(forms.ModelForm):
    class Meta:
        model = NegotiationThread
        fields = ['round_number', 'internal_note', 'external_note', 'attachment']
        widgets = {
            'round_number': forms.NumberInput(attrs={'class': 'mt-1 block w-full rounded-md border-gray-300 shadow-sm'}),
            'internal_note': forms.Textarea(attrs={'class': 'mt-1 block w-full rounded-md border-gray-300 shadow-sm', 'rows': 3}),
            'external_note': forms.Textarea(attrs={'class': 'mt-1 block w-full rounded-md border-gray-300 shadow-sm', 'rows': 3}),
            'attachment': forms.ClearableFileInput(attrs={'class': 'mt-1 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none'}),
        }

class ChecklistItemForm(forms.ModelForm):
    class Meta:
        model = ChecklistItem
        fields = ['text']
        widgets = {
            'text': forms.TextInput(attrs={'placeholder': 'New item description...'}),
        }


class WorkflowForm(forms.ModelForm):
    class Meta:
        model = Workflow
        fields = ['name', 'contract', 'template']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'input-field w-full', 'placeholder': 'Enter workflow name...'}),
            'contract': forms.Select(attrs={'class': 'input-field w-full'}),
            'template': forms.Select(attrs={'class': 'input-field w-full'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Ensure all contracts are available
        from .models import Contract
        self.fields['contract'].queryset = Contract.objects.all()
        self.fields['template'].queryset = WorkflowTemplate.objects.filter(is_active=True)
        self.fields['template'].required = False


class WorkflowTemplateForm(forms.ModelForm):
    class Meta:
        model = WorkflowTemplate
        fields = ['name', 'description', 'contract_type']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['contract_type'].required = False


class DueDiligenceForm(forms.ModelForm):
    class Meta:
        model = DueDiligence
        fields = ['title', 'target_company', 'transaction_type', 'status', 'deal_value', 'lead_attorney', 'assigned_team', 'expected_closing', 'notes']
        widgets = {
            'expected_closing': forms.DateInput(attrs={'type': 'date'}),
            'notes': forms.Textarea(attrs={'rows': 3}),
            'assigned_team': forms.CheckboxSelectMultiple(),
        }


class DueDiligenceItemForm(forms.ModelForm):
    class Meta:
        model = DueDiligenceItem
        fields = ['category', 'title', 'description', 'assigned_to', 'due_date']
        widgets = {
            'due_date': forms.DateInput(attrs={'type': 'date'}),
            'description': forms.Textarea(attrs={'rows': 2}),
        }


class DueDiligenceRiskForm(forms.ModelForm):
    class Meta:
        model = DueDiligenceRisk
        fields = ['title', 'description', 'risk_level', 'category', 'impact_assessment', 'mitigation_plan', 'owner']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
            'impact_assessment': forms.Textarea(attrs={'rows': 2}),
            'mitigation_plan': forms.Textarea(attrs={'rows': 2}),
        }


class BudgetForm(forms.ModelForm):
    class Meta:
        model = Budget
        fields = ['name', 'year', 'quarter', 'department', 'total_budget', 'status', 'owner']
        widgets = {
            'year': forms.NumberInput(attrs={'min': 2020, 'max': 2030}),
        }


class ExpenseForm(forms.ModelForm):
    class Meta:
        model = Expense
        fields = ['description', 'category', 'amount', 'expense_date', 'vendor', 'receipt_uploaded', 'notes']
        widgets = {
            'expense_date': forms.DateInput(attrs={'type': 'date'}),
            'notes': forms.Textarea(attrs={'rows': 2}),
        }