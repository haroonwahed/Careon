from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone

from contracts.models import (
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
)
from contracts.provider_metrics import (
    build_provider_behavior_metrics,
    derive_behavior_signals,
    label_behavior_signals,
)


class ProviderMetricsIntegrationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="provider_metrics_integration",
            email="provider-metrics@example.com",
            password="testpass123",
        )
        self.organization = Organization.objects.create(
            name="Provider Metrics Integration Org",
            slug="provider-metrics-integration-org",
        )
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name="Integration Provider",
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )

    def _create_intake(self, *, title: str, intake_outcome_status: str):
        intake = CaseIntakeProcess.objects.create(
            organization=self.organization,
            title=title,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=CaseIntakeProcess.Urgency.MEDIUM,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            preferred_region_type="GEMEENTELIJK",
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
        )
        intake.intake_outcome_status = intake_outcome_status
        intake.save(update_fields=["intake_outcome_status"])
        return intake

    def _create_placement(self, *, intake, response_status: str, requested_hours_ago: int, recorded_hours_after_request: int):
        requested_at = timezone.now() - timedelta(hours=requested_hours_ago)
        recorded_at = requested_at + timedelta(hours=recorded_hours_after_request)
        return PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=self.provider,
            selected_provider=self.provider,
            care_form=intake.preferred_care_form,
            provider_response_status=response_status,
            provider_response_requested_at=requested_at,
            provider_response_recorded_at=recorded_at,
        )

    def test_reliable_provider_pipeline_surfaces_positive_behavior_labels(self):
        intake = self._create_intake(
            title="Reliable Provider Case",
            intake_outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.COMPLETED,
        )
        self._create_placement(
            intake=intake,
            response_status=PlacementRequest.ProviderResponseStatus.ACCEPTED,
            requested_hours_ago=20,
            recorded_hours_after_request=6,
        )

        metrics = build_provider_behavior_metrics(self.provider.pk)
        signals = derive_behavior_signals(metrics)
        labels = label_behavior_signals(signals)

        self.assertEqual(signals["response_speed"], "fast")
        self.assertEqual(signals["acceptance_pattern"], "high")
        self.assertEqual(signals["capacity_pattern"], "stable")
        self.assertEqual(signals["intake_pattern"], "high_success")
        self.assertEqual(
            labels,
            ["Reageert snel", "Accepteert vaak", "Capaciteit stabiel", "Hoge intakescore"],
        )

    def test_friction_provider_pipeline_surfaces_risk_labels(self):
        intake = self._create_intake(
            title="Friction Provider Case",
            intake_outcome_status=CaseIntakeProcess.IntakeOutcomeStatus.CANCELLED,
        )
        self._create_placement(
            intake=intake,
            response_status=PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            requested_hours_ago=140,
            recorded_hours_after_request=96,
        )

        metrics = build_provider_behavior_metrics(self.provider.pk)
        signals = derive_behavior_signals(metrics)
        labels = label_behavior_signals(signals)

        self.assertEqual(signals["response_speed"], "slow")
        self.assertEqual(signals["acceptance_pattern"], "low")
        self.assertEqual(signals["capacity_pattern"], "often_full")
        self.assertIsNone(signals["intake_pattern"])
        self.assertEqual(labels, ["Reageert traag", "Accepteert zelden", "Vaak vol"])
