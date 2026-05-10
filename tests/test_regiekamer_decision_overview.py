from datetime import timedelta
import json

from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.models import (
    AuditLog,
    CareCase,
    CaseAssessment,
    CaseDecisionLog,
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    ProviderProfile,
    UserProfile,
)


User = get_user_model()


class RegiekamerDecisionOverviewTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.organization = Organization.objects.create(name="Regiekamer Org", slug="regiekamer-org")

        self.member = User.objects.create_user(username="member", password="pass123")
        self.provider_user = User.objects.create_user(username="provider", password="pass123")
        self.admin = User.objects.create_user(username="admin", password="pass123")

        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.member,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.provider_user,
            role=OrganizationMembership.Role.MEMBER,
            is_active=True,
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.admin,
            role=OrganizationMembership.Role.ADMIN,
            is_active=True,
        )

        UserProfile.objects.update_or_create(user=self.provider_user, defaults={'role': UserProfile.Role.CLIENT})

        self.provider_a = CareProvider.objects.create(
            organization=self.organization,
            name="Provider A",
            client_type=CareProvider.ClientType.CORPORATION,
            status=CareProvider.Status.ACTIVE,
            created_by=self.admin,
        )
        self.provider_a.responsible_coordinator = self.provider_user
        self.provider_a.save(update_fields=['responsible_coordinator', 'updated_at'])
        ProviderProfile.objects.create(
            client=self.provider_a,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=2,
            max_capacity=4,
            average_wait_days=9,
        )

        self.provider_b = CareProvider.objects.create(
            organization=self.organization,
            name="Provider B",
            client_type=CareProvider.ClientType.CORPORATION,
            status=CareProvider.Status.ACTIVE,
            created_by=self.admin,
        )
        ProviderProfile.objects.create(
            client=self.provider_b,
            offers_outpatient=True,
            handles_medium_urgency=True,
            current_capacity=2,
            max_capacity=4,
            average_wait_days=9,
        )

        self.critical_case = self._create_case(
            "Critical blocker case",
            intake_status=CaseIntakeProcess.ProcessStatus.INTAKE,
            urgency=CaseIntakeProcess.Urgency.HIGH,
            intake_hours_old=48,
        )
        self.sla_case = self._create_case("SLA breach case", provider=self.provider_a, placement_status=PlacementRequest.Status.IN_REVIEW)
        self.rejection_case = self._create_case("Repeated rejection case", provider=self.provider_a, rejected=True)
        self.intake_delay_case = self._create_case("Intake delay case", provider=self.provider_a, approved=True, intake_delay=True)
        self.archived_case = self._create_case("Archived case", archived=True)

    def _create_case(
        self,
        title: str,
        *,
        provider: CareProvider | None = None,
        placement_status: str | None = None,
        rejected: bool = False,
        approved: bool = False,
        intake_delay: bool = False,
        archived: bool = False,
        intake_status: str = CaseIntakeProcess.ProcessStatus.MATCHING,
        urgency: str = CaseIntakeProcess.Urgency.MEDIUM,
        intake_hours_old: int | None = None,
    ) -> CareCase:
        case_record = CareCase.objects.create(
            organization=self.organization,
            title=title,
            contract_type=CareCase.ContractType.NDA,
            status=CareCase.Status.ACTIVE,
            lifecycle_stage="ARCHIVED" if archived else "EXECUTED",
            created_by=self.admin,
        )
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            contract=case_record,
            title=title,
            status=CaseIntakeProcess.ProcessStatus.ARCHIVED if archived else intake_status,
            start_date=timezone.localdate() - timedelta(days=10),
            target_completion_date=timezone.localdate() + timedelta(days=7),
            urgency=urgency if not intake_delay else CaseIntakeProcess.Urgency.HIGH,
            complexity=CaseIntakeProcess.Complexity.SIMPLE,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
        )

        if not archived and not rejected and not approved and not intake_delay and provider is None:
            if intake_hours_old is not None:
                CaseIntakeProcess.objects.filter(pk=intake.pk).update(updated_at=timezone.now() - timedelta(hours=intake_hours_old))
            return case_record

        if not archived:
            CaseAssessment.objects.create(
                due_diligence_process=intake,
                assessment_status=CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
                matching_ready=True,
                assessed_by=self.admin,
                workflow_summary={
                    'context': 'Test pilot samenvatting (context) — minimaal verplicht voor matching en validatie.',
                    'risks': ['test_risk'],
                    'missing_information': '',
                    'risks_none_ack': False,
                },
            )

        if provider is not None:
            placement = PlacementRequest.objects.create(
                due_diligence_process=intake,
                status=PlacementRequest.Status.APPROVED if approved or intake_delay else (placement_status or PlacementRequest.Status.IN_REVIEW),
                proposed_provider=provider,
                selected_provider=provider,
                provider_response_status=(
                    PlacementRequest.ProviderResponseStatus.REJECTED
                    if rejected
                    else PlacementRequest.ProviderResponseStatus.ACCEPTED
                    if approved or intake_delay
                    else PlacementRequest.ProviderResponseStatus.PENDING
                ),
                provider_response_reason_code=(
                    "PROVIDER_DECLINED" if rejected else "NONE"
                ),
                care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            )

            if rejected:
                PlacementRequest.objects.create(
                    due_diligence_process=intake,
                    status=PlacementRequest.Status.IN_REVIEW,
                    proposed_provider=provider,
                    selected_provider=provider,
                    provider_response_status=PlacementRequest.ProviderResponseStatus.REJECTED,
                    provider_response_reason_code="PROVIDER_DECLINED",
                    care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
                )

            if intake_delay:
                PlacementRequest.objects.filter(pk=placement.pk).update(updated_at=timezone.now() - timedelta(days=6))
                return case_record

            if rejected:
                PlacementRequest.objects.filter(pk=placement.pk).update(updated_at=timezone.now() - timedelta(days=4))
                return case_record

            if approved:
                PlacementRequest.objects.filter(pk=placement.pk).update(updated_at=timezone.now() - timedelta(days=1))

        if placement_status == PlacementRequest.Status.IN_REVIEW and provider is not None:
            PlacementRequest.objects.filter(due_diligence_process=intake).update(updated_at=timezone.now() - timedelta(hours=80))

        if intake_hours_old is not None:
            CaseIntakeProcess.objects.filter(pk=intake.pk).update(updated_at=timezone.now() - timedelta(hours=intake_hours_old))

        return case_record

    def _login(self, user):
        self.client.logout()
        self.client.login(username=user.username, password="pass123")

    def _fetch_payload(self):
        response = self.client.get(reverse("careon:regiekamer_decision_overview_api"))
        self.assertEqual(response.status_code, 200)
        return json.loads(response.content)

    def test_endpoint_excludes_archived_cases(self):
        self._login(self.admin)
        payload = self._fetch_payload()

        titles = {item["title"] for item in payload["items"]}
        self.assertNotIn("Archived case", titles)
        self.assertEqual(payload["totals"]["active_cases"], 4)

    def test_endpoint_returns_decision_summary_per_active_case(self):
        self._login(self.admin)
        payload = self._fetch_payload()

        self.assertGreaterEqual(len(payload["items"]), 4)
        first_item = payload["items"][0]
        self.assertIn("next_best_action", first_item)
        self.assertIn("top_blocker", first_item)
        self.assertIn("top_risk", first_item)
        self.assertIn("top_alert", first_item)
        self.assertIn("priority_score", first_item)

    def test_priority_score_sorts_critical_cases_first(self):
        self._login(self.admin)
        payload = self._fetch_payload()

        self.assertEqual(payload["items"][0]["title"], "Critical blocker case")
        self.assertGreaterEqual(payload["items"][0]["priority_score"], payload["items"][1]["priority_score"])

    def test_totals_include_provider_sla_breach(self):
        self._login(self.admin)
        payload = self._fetch_payload()

        self.assertEqual(payload["totals"]["provider_sla_breaches"], 1)

    def test_totals_include_repeated_rejection(self):
        self._login(self.admin)
        payload = self._fetch_payload()

        self.assertEqual(payload["totals"]["repeated_rejections"], 1)

    def test_endpoint_is_read_only_and_creates_no_logs(self):
        self._login(self.admin)
        audit_before = AuditLog.objects.count()
        decision_before = CaseDecisionLog.objects.count()

        payload = self._fetch_payload()

        self.assertGreaterEqual(payload["totals"]["active_cases"], 4)
        self.assertEqual(AuditLog.objects.count(), audit_before)
        self.assertEqual(CaseDecisionLog.objects.count(), decision_before)

    def test_visibility_rules_are_respected_for_gemeente_provider_and_admin(self):
        self._login(self.member)
        member_payload = self._fetch_payload()
        member_titles = [item["title"] for item in member_payload["items"]]
        self.assertEqual(
            member_titles,
            [
                "Critical blocker case",
                "SLA breach case",
                "Repeated rejection case",
                "Intake delay case",
            ],
        )
        self.assertNotIn("Archived case", member_titles)
        self.assertEqual(member_payload["totals"]["active_cases"], 4)

        self._login(self.provider_user)
        provider_payload = self._fetch_payload()
        provider_titles = {item["title"] for item in provider_payload["items"]}
        self.assertEqual(provider_payload["totals"]["active_cases"], 3)
        self.assertIn("SLA breach case", provider_titles)
        self.assertIn("Repeated rejection case", provider_titles)
        self.assertIn("Intake delay case", provider_titles)
        self.assertNotIn("Critical blocker case", provider_titles)
        self.assertNotIn("Archived case", provider_titles)

        self._login(self.admin)
        admin_payload = self._fetch_payload()
        admin_titles = [item["title"] for item in admin_payload["items"]]
        self.assertEqual(
            admin_titles,
            [
                "Critical blocker case",
                "SLA breach case",
                "Repeated rejection case",
                "Intake delay case",
            ],
        )
        self.assertNotIn("Archived case", admin_titles)
        self.assertEqual(admin_payload["totals"]["active_cases"], 4)
