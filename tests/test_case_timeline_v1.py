"""
Case timeline v1 — append-only operational history (gemeente validatie → aanbieder beoordeling).
"""

import json
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from contracts.models import (
    CareCase,
    CaseAssessment,
    CaseIntakeProcess,
    CaseTimelineEvent,
    Client as CareProvider,
    GovernanceLogImmutableError,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    UserProfile,
)
from contracts.workflow_state_machine import WorkflowState

User = get_user_model()


class CaseTimelineV1Tests(TestCase):
    def setUp(self):
        self.client = Client()
        self.organization = Organization.objects.create(name='Timeline Org', slug='timeline-org')

        self.gemeente_user = User.objects.create_user(
            username='gemeente_user',
            email='gemeente@example.com',
            password='testpass123',
        )
        self.provider_user = User.objects.create_user(
            username='provider_user',
            email='provider@example.com',
            password='testpass123',
        )
        self.outsider = User.objects.create_user(
            username='outsider',
            email='out@example.com',
            password='testpass123',
        )

        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.gemeente_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.provider_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        UserProfile.objects.create(user=self.gemeente_user, role=UserProfile.Role.ASSOCIATE)
        UserProfile.objects.create(user=self.provider_user, role=UserProfile.Role.CLIENT)

        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name='Provider One',
            status=CareProvider.Status.ACTIVE,
            created_by=self.gemeente_user,
        )
        self.provider.responsible_coordinator = self.provider_user
        self.provider.save(update_fields=['responsible_coordinator', 'updated_at'])

    def _create_matching_ready_case(self):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title='Timeline Case',
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=10),
            case_coordinator=self.gemeente_user,
        )
        case_record = intake.ensure_case_record(created_by=self.gemeente_user)
        case_record.case_phase = CareCase.CasePhase.MATCHING
        case_record.save(update_fields=['case_phase', 'updated_at'])

        CaseAssessment.objects.create(
            due_diligence_process=intake,
            assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
            matching_ready=True,
            assessed_by=self.gemeente_user,
            workflow_summary={
                'context': 'Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.',
                'urgency': 'MEDIUM',
                'risks': ['test_risk'],
                'missing_information': '',
                'risks_none_ack': False,
            },
        )
        return intake

    def test_timeline_rows_on_assign_matching_action_api(self):
        intake = self._create_matching_ready_case()
        self.assertIsNotNone(intake.case_record)

        self.client.login(username='gemeente_user', password='testpass123')
        response = self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': self.provider.pk}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

        intake.refresh_from_db()
        self.assertEqual(intake.workflow_state, WorkflowState.PROVIDER_REVIEW_PENDING)

        events = CaseTimelineEvent.objects.filter(care_case=intake.case_record).order_by('occurred_at', 'id')
        self.assertGreaterEqual(events.count(), 2)
        types = list(events.values_list('event_type', flat=True))
        self.assertIn(CaseTimelineEvent.EventType.PLACEMENT_REQUEST_CREATED, types)
        self.assertIn(CaseTimelineEvent.EventType.PROVIDER_REVIEW_OPENED, types)
        self.assertIn(CaseTimelineEvent.EventType.GEMEENTE_VALIDATION_APPROVED, types)

    def test_timeline_includes_request_id_when_header_set(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': self.provider.pk}),
            content_type='application/json',
            HTTP_X_REQUEST_ID='tid-req-abc123',
        )
        row = CaseTimelineEvent.objects.filter(care_case=intake.case_record).first()
        self.assertIsNotNone(row)
        self.assertEqual(row.request_id, 'tid-req-abc123')

    def test_provider_can_read_timeline_when_case_visible(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': self.provider.pk}),
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='provider_user', password='testpass123')
        r = self.client.get(
            reverse('careon:case_timeline_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(r.status_code, 200)
        payload = r.json()
        self.assertTrue(payload.get('events'))

    def test_unauthorized_user_cannot_read_timeline(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': self.provider.pk}),
            content_type='application/json',
        )
        self.client.logout()
        self.client.login(username='outsider', password='testpass123')
        r = self.client.get(
            reverse('careon:case_timeline_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(r.status_code, 404)

    def test_anonymous_cannot_read_timeline(self):
        intake = self._create_matching_ready_case()
        r = self.client.get(
            reverse('careon:case_timeline_api', kwargs={'case_id': intake.contract_id}),
        )
        self.assertEqual(r.status_code, 302)

    def test_timeline_get_is_idempotent_for_row_count(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': self.provider.pk}),
            content_type='application/json',
        )
        n = CaseTimelineEvent.objects.filter(care_case=intake.case_record).count()
        self.client.get(reverse('careon:case_timeline_api', kwargs={'case_id': intake.contract_id}))
        self.client.get(reverse('careon:case_timeline_api', kwargs={'case_id': intake.contract_id}))
        self.assertEqual(CaseTimelineEvent.objects.filter(care_case=intake.case_record).count(), n)

    def test_metadata_has_only_safe_operational_keys(self):
        intake = self._create_matching_ready_case()
        self.client.login(username='gemeente_user', password='testpass123')
        self.client.post(
            reverse('careon:matching_action_api', kwargs={'case_id': intake.contract_id}),
            data=json.dumps({'action': 'assign', 'provider_id': self.provider.pk}),
            content_type='application/json',
        )
        for row in CaseTimelineEvent.objects.filter(care_case=intake.case_record):
            meta = row.metadata or {}
            allowed = {'placement_id', 'placement_status', 'provider_id', 'step'}
            for k in meta.keys():
                self.assertIn(k, allowed, msg=f'unexpected metadata key {k!r}')

    def test_timeline_rows_are_append_only(self):
        from django.utils import timezone

        intake = self._create_matching_ready_case()
        row = CaseTimelineEvent.objects.create(
            organization=self.organization,
            care_case=intake.case_record,
            event_type=CaseTimelineEvent.EventType.WORKFLOW_BLOCKED,
            occurred_at=timezone.now(),
            actor=self.gemeente_user,
            actor_role='gemeente',
            source='test',
            summary='test append-only guard',
            metadata={},
        )
        row.summary = 'mutated'
        with self.assertRaises(GovernanceLogImmutableError):
            row.save()