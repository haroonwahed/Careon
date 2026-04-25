from datetime import date, timedelta

from django.contrib.auth.models import User
from django.http import Http404
from django.test import TestCase

from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    Deadline,
    Organization,
)
from contracts.tenancy import get_scoped_object_or_404, scope_queryset_for_organization


class TenantScopingHelperTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='tenant-helper-user',
            email='tenant-helper@example.com',
            password='testpass123',
        )
        self.organization_a = Organization.objects.create(name='Org A', slug='org-a')
        self.organization_b = Organization.objects.create(name='Org B', slug='org-b')

        self.case_a = CareCase.objects.create(
            organization=self.organization_a,
            title='Case A',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user,
        )
        self.case_b = CareCase.objects.create(
            organization=self.organization_b,
            title='Case B',
            contract_type='NDA',
            status='ACTIVE',
            created_by=self.user,
        )

        self.intake_a = CaseIntakeProcess.objects.create(
            organization=self.organization_a,
            contract=self.case_a,
            title='Intake A',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        self.intake_b = CaseIntakeProcess.objects.create(
            organization=self.organization_b,
            contract=self.case_b,
            title='Intake B',
            status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )

        self.deadline_a = Deadline.objects.create(
            due_diligence_process=self.intake_a,
            title='Deadline A',
            task_type=Deadline.TaskType.CONTACT_PROVIDER,
            description='Org A deadline',
            due_date=date.today() + timedelta(days=2),
            priority=Deadline.Priority.MEDIUM,
            created_by=self.user,
        )
        self.deadline_b = Deadline.objects.create(
            due_diligence_process=self.intake_b,
            title='Deadline B',
            task_type=Deadline.TaskType.CONTACT_PROVIDER,
            description='Org B deadline',
            due_date=date.today() + timedelta(days=2),
            priority=Deadline.Priority.MEDIUM,
            created_by=self.user,
        )

    def test_scope_queryset_returns_none_without_organization(self):
        scoped_cases = scope_queryset_for_organization(CareCase.objects.all(), None)
        self.assertEqual(scoped_cases.count(), 0)

    def test_scope_queryset_uses_manager_scoping_when_available(self):
        scoped_deadlines = scope_queryset_for_organization(Deadline.objects.all(), self.organization_a)
        self.assertEqual(list(scoped_deadlines.values_list('pk', flat=True)), [self.deadline_a.pk])

    def test_scoped_object_lookup_respects_organization_boundary(self):
        case = get_scoped_object_or_404(CareCase.objects.all(), self.organization_a, pk=self.case_a.pk)
        self.assertEqual(case.pk, self.case_a.pk)

        with self.assertRaises(Http404):
            get_scoped_object_or_404(CareCase.objects.all(), self.organization_a, pk=self.case_b.pk)
