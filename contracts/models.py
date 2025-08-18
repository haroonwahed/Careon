from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Contract(models.Model):
    class ContractStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        INTERNAL_REVIEW = 'INTERNAL_REVIEW', 'Internal Review'
        EXTERNAL_REVIEW = 'EXTERNAL_REVIEW', 'External Review'
        NEGOTIATION = 'NEGOTIATION', 'Negotiation'
        SIGNATURE = 'SIGNATURE', 'Signature'
        EXECUTION = 'EXECUTION', 'Execution'
        RENEWAL_TERMINATION = 'RENEWAL_TERMINATION', 'Renewal/Termination'

    class ContractType(models.TextChoices):
        NDA = 'NDA', 'Non-Disclosure Agreement'
        MSA = 'MSA', 'Master Service Agreement'
        SOW = 'SOW', 'Statement of Work'
        SLA = 'SLA', 'Service Level Agreement'
        EMPLOYMENT = 'EMPLOYMENT', 'Employment Agreement'
        OTHER = 'OTHER', 'Other'

    class Jurisdiction(models.TextChoices):
        US = 'US', 'United States'
        UK = 'UK', 'United Kingdom'
        EU = 'EU', 'European Union'
        APAC = 'APAC', 'Asia-Pacific'
        OTHER = 'OTHER', 'Other'

    title = models.CharField(max_length=200)
    counterparty = models.CharField(max_length=200)
    contract_type = models.CharField(max_length=20, choices=ContractType.choices, default=ContractType.OTHER)
    jurisdiction = models.CharField(max_length=20, choices=Jurisdiction.choices, default=Jurisdiction.OTHER)
    value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=ContractStatus.choices, default=ContractStatus.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    milestone_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_contracts')
    tags = models.ManyToManyField(Tag, blank=True)

    def __str__(self):
        return self.title


class Note(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='notes')
    text = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='contract_notes')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Note by {self.created_by} on {self.contract.title} at {self.timestamp.strftime("%Y-%m-%d %H:%M")}'


class WorkflowStep(models.Model):
    class StepType(models.TextChoices):
        INTERNAL_REVIEW = 'INTERNAL_REVIEW', 'Internal Review'
        EXTERNAL_REVIEW = 'EXTERNAL_REVIEW', 'External Review'
        NEGOTIATION = 'NEGOTIATION', 'Negotiation'
        SIGNATURE = 'SIGNATURE', 'Signature'
        EXECUTION = 'EXECUTION', 'Execution'

    class StepStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        SKIPPED = 'SKIPPED', 'Skipped'

    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='workflow_steps')
    workflow = models.ForeignKey('Workflow', on_delete=models.CASCADE, related_name='workflow_steps', null=True, blank=True)
    step_type = models.CharField(max_length=20, choices=StepType.choices)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='workflow_tasks')
    status = models.CharField(max_length=20, choices=StepStatus.choices, default=StepStatus.PENDING)
    notes = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.get_step_type_display()} for {self.contract.title}'


class ContractVersion(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    content_snapshot = models.TextField()
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_versions')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('contract', 'version_number')
        ordering = ['-version_number']

    def __str__(self):
        return f'{self.contract.title} - Version {self.version_number}'


class NegotiationThread(models.Model):
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='negotiation_threads')
    round_number = models.PositiveIntegerField()
    internal_note = models.TextField(blank=True)
    external_note = models.TextField(blank=True)
    attachment = models.FileField(upload_to='negotiation_attachments/', blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='negotiation_posts')

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f'Negotiation Round {self.round_number} for {self.contract.title}'


class TrademarkRequest(models.Model):
    class TrademarkStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        FILED = 'FILED', 'Filed'
        IN_REVIEW = 'IN_REVIEW', 'In Review'
        REGISTERED = 'REGISTERED', 'Registered'
        REJECTED = 'REJECTED', 'Rejected'
        ABANDONED = 'ABANDONED', 'Abandoned'

    region = models.CharField(max_length=100)
    class_number = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=TrademarkStatus.choices, default=TrademarkStatus.PENDING)
    request_date = models.DateField(auto_now_add=True)
    documents = models.FileField(upload_to='trademark_documents/', blank=True, null=True)
    renewal_deadline = models.DateField(null=True, blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='trademark_requests')

    def __str__(self):
        return f'Trademark Request for {self.region} - Class {self.class_number}'


class LegalTask(models.Model):
    class TaskStatus(models.TextChoices):
        TODO = 'TODO', 'To Do'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        DONE = 'DONE', 'Done'

    class TaskPriority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    title = models.CharField(max_length=200)
    task_type = models.CharField(max_length=100, blank=True)
    priority = models.CharField(max_length=10, choices=TaskPriority.choices, default=TaskPriority.MEDIUM)
    subject = models.TextField(blank=True)
    is_recurring = models.BooleanField(default=False)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='legal_tasks')
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.TODO)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class RiskLog(models.Model):
    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    class MitigationStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        MITIGATED = 'MITIGATED', 'Mitigated'

    title = models.CharField(max_length=200)
    description = models.TextField()
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices, default=RiskLevel.MEDIUM)
    linked_contract = models.ForeignKey(Contract, on_delete=models.SET_NULL, null=True, blank=True, related_name='risk_logs')
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='owned_risks')
    mitigation_steps = models.TextField()
    mitigation_status = models.CharField(max_length=20, choices=MitigationStatus.choices, default=MitigationStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class ComplianceChecklist(models.Model):
    class ComplianceStatus(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', 'Not Started'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETE = 'COMPLETE', 'Complete'

    name = models.CharField(max_length=200)
    regulation = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=ComplianceStatus.choices, default=ComplianceStatus.NOT_STARTED)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_checklists')
    due_date = models.DateField(null=True, blank=True)
    attachments = models.FileField(upload_to='compliance_attachments/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class WorkflowTemplate(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    contract_type = models.CharField(max_length=20, choices=Contract.ContractType.choices, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_templates')

    def __str__(self):
        return self.name


class WorkflowTemplateStep(models.Model):
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.CASCADE, related_name='template_steps')
    step_type = models.CharField(max_length=20, choices=WorkflowStep.StepType.choices)
    order = models.PositiveIntegerField()
    default_assignee_role = models.CharField(max_length=50, blank=True)
    estimated_days = models.PositiveIntegerField(default=3)
    is_required = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']
        unique_together = ('template', 'order')

    def __str__(self):
        return f'{self.template.name} - Step {self.order}: {self.get_step_type_display()}'


class Workflow(models.Model):
    class WorkflowStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        ON_HOLD = 'ON_HOLD', 'On Hold'

    name = models.CharField(max_length=200)
    contract = models.OneToOneField(Contract, on_delete=models.CASCADE, related_name='workflow')
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=WorkflowStatus.choices, default=WorkflowStatus.ACTIVE)
    current_step = models.ForeignKey(WorkflowStep, on_delete=models.SET_NULL, null=True, blank=True, related_name='current_workflows')
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    projected_completion = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_workflows')

    def __str__(self):
        return f'{self.name} - {self.contract.title}'

    @property
    def progress_percentage(self):
        total_steps = self.workflow_steps.count()
        if total_steps == 0:
            return 0
        completed_steps = self.workflow_steps.filter(status=WorkflowStep.StepStatus.COMPLETED).count()
        return int((completed_steps / total_steps) * 100)

    @property
    def current_stage(self):
        if self.current_step:
            return self.current_step.get_step_type_display()
        return "Not Started"


class ChecklistItem(models.Model):
    checklist = models.ForeignKey(ComplianceChecklist, on_delete=models.CASCADE, related_name='items')
    text = models.CharField(max_length=500)
    is_checked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.checklist.name} - {self.title}'


class DueDiligenceProcess(models.Model):
    class ProcessStatus(models.TextChoices):
        PLANNING = 'PLANNING', 'Planning'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        REVIEW = 'REVIEW', 'Review'
        COMPLETED = 'COMPLETED', 'Completed'
        ON_HOLD = 'ON_HOLD', 'On Hold'

    class TransactionType(models.TextChoices):
        MERGER = 'MERGER', 'Merger'
        ACQUISITION = 'ACQUISITION', 'Acquisition'
        JOINT_VENTURE = 'JOINT_VENTURE', 'Joint Venture'
        ASSET_PURCHASE = 'ASSET_PURCHASE', 'Asset Purchase'

    title = models.CharField(max_length=200)
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    target_company = models.CharField(max_length=200)
    deal_value = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=ProcessStatus.choices, default=ProcessStatus.PLANNING)
    lead_attorney = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='dd_processes')
    start_date = models.DateField()
    target_completion_date = models.DateField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} - {self.target_company}'

    @property
    def overall_risk_level(self):
        risks = self.dd_risks.all()
        if not risks:
            return 'LOW'
        high_count = risks.filter(risk_level='HIGH').count()
        medium_count = risks.filter(risk_level='MEDIUM').count()
        if high_count > 0:
            return 'HIGH'
        elif medium_count > 0:
            return 'MEDIUM'
        return 'LOW'

    @property
    def progress_percentage(self):
        total_tasks = self.dd_tasks.count()
        if total_tasks == 0:
            return 0
        completed_tasks = self.dd_tasks.filter(status='COMPLETED').count()
        return int((completed_tasks / total_tasks) * 100)


class DueDiligenceTask(models.Model):
    class TaskStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        BLOCKED = 'BLOCKED', 'Blocked'

    class TaskCategory(models.TextChoices):
        LEGAL = 'LEGAL', 'Legal'
        FINANCIAL = 'FINANCIAL', 'Financial'
        OPERATIONAL = 'OPERATIONAL', 'Operational'
        TECHNICAL = 'TECHNICAL', 'Technical'
        REGULATORY = 'REGULATORY', 'Regulatory'
        COMMERCIAL = 'COMMERCIAL', 'Commercial'

    process = models.ForeignKey(DueDiligenceProcess, on_delete=models.CASCADE, related_name='dd_tasks')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=TaskCategory.choices)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    due_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'due_date']

    def __str__(self):
        return f'{self.process.title} - {self.title}'


class DueDiligenceRisk(models.Model):
    class RiskLevel(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'

    class RiskCategory(models.TextChoices):
        LEGAL = 'LEGAL', 'Legal & Regulatory'
        FINANCIAL = 'FINANCIAL', 'Financial'
        OPERATIONAL = 'OPERATIONAL', 'Operational'
        REPUTATIONAL = 'REPUTATIONAL', 'Reputational'
        STRATEGIC = 'STRATEGIC', 'Strategic'

    process = models.ForeignKey(DueDiligenceProcess, on_delete=models.CASCADE, related_name='dd_risks')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=RiskCategory.choices)
    description = models.TextField()
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices)
    likelihood = models.CharField(max_length=10, choices=RiskLevel.choices)
    impact = models.CharField(max_length=10, choices=RiskLevel.choices)
    mitigation_strategy = models.TextField(blank=True)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    identified_date = models.DateField(auto_now_add=True)
    target_resolution_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='OPEN')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.process.title} - {self.title} ({self.risk_level})'


class Budget(models.Model):
    class Quarter(models.TextChoices):
        Q1 = 'Q1', 'Q1'
        Q2 = 'Q2', 'Q2'
        Q3 = 'Q3', 'Q3'
        Q4 = 'Q4', 'Q4'

    year = models.IntegerField()
    quarter = models.CharField(max_length=2, choices=Quarter.choices)
    department = models.CharField(max_length=100, default='Legal')
    total_budget = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['year', 'quarter', 'department']
        ordering = ['-year', '-quarter']

    def __str__(self):
        return f'{self.department} Budget - {self.year} {self.quarter}'

    @property
    def total_expenses(self):
        return sum(expense.amount for expense in self.expenses.all())

    @property
    def remaining_budget(self):
        return self.total_budget - self.total_expenses

    @property
    def budget_utilization_percentage(self):
        if self.total_budget == 0:
            return 0
        return int((self.total_expenses / self.total_budget) * 100)

    @property
    def is_over_budget(self):
        return self.total_expenses > self.total_budget


class BudgetExpense(models.Model):
    class ExpenseCategory(models.TextChoices):
        EXTERNAL_COUNSEL = 'EXTERNAL_COUNSEL', 'External Counsel'
        FILING_FEES = 'FILING_FEES', 'Filing Fees'
        TRAVEL = 'TRAVEL', 'Travel & Entertainment'
        SOFTWARE = 'SOFTWARE', 'Software & Tools'
        RESEARCH = 'RESEARCH', 'Research & Data'
        TRAINING = 'TRAINING', 'Training & Development'
        OTHER = 'OTHER', 'Other'

    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='expenses')
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=ExpenseCategory.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)
    date_incurred = models.DateField()
    vendor = models.CharField(max_length=200, blank=True)
    invoice_number = models.CharField(max_length=100, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_expenses')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_incurred']

    def __str__(self):
        return f'{self.title} - ${self.amount}'