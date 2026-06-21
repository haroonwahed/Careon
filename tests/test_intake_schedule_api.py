"""Regression: intake appointment planning must resolve actor role with keyword args."""
import json
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    CaseIntakeProcess,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    UserProfile,
)

User = get_user_model()


class IntakeScheduleApiTests(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Schedule Org', slug='schedule-org')
        self.user = User.objects.create_user(username='schedule_gemeente', password='passS1234!')
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=self.user, defaults={'role': UserProfile.Role.ASSOCIATE})

        self.intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='Schedule Case',
            status=CaseIntakeProcess.ProcessStatus.DECISION,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=14),
            case_coordinator=self.user,
            workflow_state=CaseIntakeProcess.WorkflowState.PLACEMENT_CONFIRMED,
        )
        self.case = self.intake.ensure_case_record(created_by=self.user)
        self.case.case_phase = 'plaatsing'
        self.case.save(update_fields=['case_phase', 'updated_at'])
        PlacementRequest.objects.create(
            due_diligence_process=self.intake,
            status=PlacementRequest.Status.APPROVED,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
            provider_response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
        )

    def test_schedule_patch_succeeds_for_gemeente(self):
        self.client.login(username='schedule_gemeente', password='passS1234!')
        when = timezone.now().replace(microsecond=0).isoformat()
        url = reverse('carelane:intake_schedule_api', kwargs={'case_id': self.case.pk})
        response = self.client.patch(
            url,
            data=json.dumps({'appointment_at': when, 'location': 'Utrecht'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200, response.content.decode())
        self.assertTrue(response.json().get('ok'))
        self.intake.refresh_from_db()
        self.assertEqual(self.intake.intake_appointment_location, 'Utrecht')
