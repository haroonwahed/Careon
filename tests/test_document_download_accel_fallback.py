"""Document downloads must stream bytes on Render (no nginx X-Accel-Redirect)."""
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from contracts.models import (
    CareCase,
    CaseIntakeProcess,
    Client as CareProvider,
    Document,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
    UserProfile,
)


@override_settings(NGINX_MEDIA_ACCEL_REDIRECT=False)
class DocumentDownloadFileResponseTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('dl_user', 'dl@test.nl', 'pass')
        self.org = Organization.objects.create(name='DL Org', slug='dl-org')
        OrganizationMembership.objects.create(
            organization=self.org,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        UserProfile.objects.update_or_create(user=self.user, defaults={'role': UserProfile.Role.ASSOCIATE})

        provider = CareProvider.objects.create(
            organization=self.org,
            name='DL Provider',
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        ProviderProfile.objects.create(client=provider, offers_outpatient=True, current_capacity=1, max_capacity=3)

        intake = CaseIntakeProcess.objects.create(
            organization=self.org,
            title='DL Intake',
            status=CaseIntakeProcess.ProcessStatus.DECISION,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            workflow_state='PROVIDER_REVIEW_PENDING',
        )
        case = intake.ensure_case_record(created_by=self.user)
        PlacementRequest.objects.create(
            due_diligence_process=intake,
            proposed_provider=provider,
            selected_provider=provider,
            status=PlacementRequest.Status.IN_REVIEW,
            care_form=PlacementRequest.CareForm.OUTPATIENT,
        )
        self.doc = Document.objects.create(
            organization=self.org,
            title='Render DL Test',
            contract=case,
            uploaded_by=self.user,
        )
        self.doc.file.save('render-dl.txt', ContentFile(b'pilot-download-bytes'), save=True)

    def tearDown(self):
        if self.doc.file:
            try:
                self.doc.file.delete(save=False)
            except Exception:
                pass

    def test_download_returns_file_body_not_empty_accel_response(self):
        self.client.login(username='dl_user', password='pass')
        response = self.client.get(
            reverse('carelane:serve_case_document_api', kwargs={'document_id': self.doc.pk}),
        )
        self.assertEqual(response.status_code, 200)
        body = b''.join(response.streaming_content)
        self.assertIn(b'pilot-download-bytes', body)
        self.assertNotIn(b'X-Accel-Redirect', body)
