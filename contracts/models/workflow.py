from django.db import models
from django.contrib.auth import get_user_model

from contracts.models.care_case import CareCase

User = get_user_model()


class WorkflowTemplate(models.Model):
    class Category(models.TextChoices):
        CONTRACT_REVIEW = 'CONTRACT_REVIEW', 'Zorgovereenkomst review'
        DUE_DILIGENCE = 'DUE_DILIGENCE', 'Intake & Beoordeling'
        TRADEMARK = 'TRADEMARK', 'Plaatsingscoordinatie'
        COMPLIANCE = 'COMPLIANCE', 'Compliance'
        GENERAL = 'GENERAL', 'Algemeen'

    name = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.GENERAL)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class WorkflowTemplateStep(models.Model):
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.CASCADE, related_name='steps')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    estimated_duration = models.DurationField(null=True, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.template.name} - {self.name}"


class Workflow(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    template = models.ForeignKey(WorkflowTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    contract = models.ForeignKey(CareCase, on_delete=models.CASCADE, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    @property
    def case_record(self):
        return self.contract

    @case_record.setter
    def case_record(self, value):
        self.contract = value


class WorkflowStep(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        SKIPPED = 'SKIPPED', 'Skipped'

    workflow = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='steps')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.workflow.title} - {self.name}"
