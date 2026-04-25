from datetime import date, datetime, timedelta
import unittest

from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from contracts.case_intelligence import (
    calculate_provider_response_sla,
    determine_next_best_action,
    derive_provider_response_ownership,
    evaluate_case_intelligence,
)
from contracts.models import (
    CaseIntakeProcess,
    Client as CareProvider,
    Organization,
    OrganizationMembership,
    PlacementRequest,
    RegionType,
)
from contracts.views import build_provider_response_monitor, build_provider_response_overview


class ProviderResponseSlaCalculationTests(unittest.TestCase):
    def test_pending_thresholds(self):
        now = datetime(2026, 4, 15, 12, 0, 0)

        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "PENDING",
                    "provider_response_requested_at": now - timedelta(hours=20),
                },
                now=now,
            )["sla_state"],
            "ON_TRACK",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "PENDING",
                    "provider_response_requested_at": now - timedelta(hours=50),
                },
                now=now,
            )["sla_state"],
            "AT_RISK",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "PENDING",
                    "provider_response_requested_at": now - timedelta(hours=80),
                },
                now=now,
            )["sla_state"],
            "OVERDUE",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "PENDING",
                    "provider_response_requested_at": now - timedelta(hours=100),
                },
                now=now,
            )["sla_state"],
            "ESCALATED",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "PENDING",
                    "provider_response_requested_at": now - timedelta(hours=130),
                },
                now=now,
            )["sla_state"],
            "FORCED_ACTION",
        )

    def test_needs_info_thresholds(self):
        now = datetime(2026, 4, 15, 12, 0, 0)

        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "NEEDS_INFO",
                    "provider_response_requested_at": now - timedelta(hours=10),
                },
                now=now,
            )["sla_state"],
            "ON_TRACK",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "NEEDS_INFO",
                    "provider_response_requested_at": now - timedelta(hours=30),
                },
                now=now,
            )["sla_state"],
            "AT_RISK",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "NEEDS_INFO",
                    "provider_response_requested_at": now - timedelta(hours=50),
                },
                now=now,
            )["sla_state"],
            "OVERDUE",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "NEEDS_INFO",
                    "provider_response_requested_at": now - timedelta(hours=80),
                },
                now=now,
            )["sla_state"],
            "ESCALATED",
        )

    def test_waitlist_behavior(self):
        now = datetime(2026, 4, 15, 12, 0, 0)

        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "WAITLIST",
                    "provider_response_requested_at": now - timedelta(hours=30),
                },
                now=now,
            )["sla_state"],
            "AT_RISK",
        )
        self.assertEqual(
            calculate_provider_response_sla(
                {
                    "provider_response_status": "WAITLIST",
                    "provider_response_requested_at": now - timedelta(hours=90),
                },
                now=now,
            )["sla_state"],
            "ESCALATED",
        )

    def test_edge_cases_missing_timestamps_and_legacy_status_values(self):
        now = datetime(2026, 4, 15, 12, 0, 0)

        missing_timestamps = calculate_provider_response_sla(
            {
                "provider_response_status": "PENDING",
                "provider_response_requested_at": None,
                "provider_response_last_reminder_at": None,
                "updated_at": None,
            },
            now=now,
        )
        legacy_declined = calculate_provider_response_sla(
            {
                "provider_response_status": "DECLINED",
                "provider_response_requested_at": now - timedelta(hours=30),
            },
            now=now,
        )
        legacy_no_response = calculate_provider_response_sla(
            {
                "provider_response_status": "NO_RESPONSE",
                "provider_response_requested_at": now - timedelta(hours=50),
            },
            now=now,
        )

        self.assertEqual(missing_timestamps["hours_waiting"], 0)
        self.assertEqual(missing_timestamps["sla_state"], "ON_TRACK")
        self.assertEqual(legacy_declined["sla_state"], "ON_TRACK")
        self.assertEqual(legacy_no_response["sla_state"], "AT_RISK")

    def test_recently_resent_case_uses_last_reminder_timestamp(self):
        now = datetime(2026, 4, 15, 12, 0, 0)
        sla = calculate_provider_response_sla(
            {
                "provider_response_status": "PENDING",
                "provider_response_requested_at": now - timedelta(hours=80),
                "provider_response_last_reminder_at": now - timedelta(hours=1),
                "updated_at": now - timedelta(hours=1),
            },
            now=now,
        )

        self.assertEqual(sla["sla_state"], "ON_TRACK")
        self.assertEqual(sla["hours_waiting"], 1)


class SlaIntelligenceIntegrationTests(unittest.TestCase):
    def _base_case_data(self, now):
        return {
            "phase": "MATCHING",
            "care_category": "Jeugd",
            "urgency": "MEDIUM",
            "assessment_complete": True,
            "matching_run_exists": True,
            "top_match_confidence": "high",
            "top_match_has_capacity_issue": False,
            "top_match_wait_days": 7,
            "selected_provider_id": 42,
            "placement_status": "IN_REVIEW",
            "placement_updated_at": now,
            "rejected_provider_count": 0,
            "open_signal_count": 0,
            "open_task_count": 1,
            "case_updated_at": now,
            "candidate_suggestions": [
                {
                    "provider_id": 42,
                    "confidence": "high",
                    "has_capacity_issue": False,
                    "wait_days": 7,
                }
            ],
            "provider_response_status": "PENDING",
            "provider_response_requested_at": now,
            "provider_response_last_reminder_at": None,
            "provider_response_deadline_at": None,
            "now": now,
        }

    def test_sla_flags_appear_in_intelligence_output(self):
        now = datetime(2026, 4, 15, 12, 0, 0)
        case_data = self._base_case_data(now)
        case_data["provider_response_requested_at"] = now - timedelta(hours=80)

        result = evaluate_case_intelligence(case_data)

        self.assertEqual(result["sla_state"], "OVERDUE")
        self.assertEqual(result["sla_hours_waiting"], 80)
        self.assertTrue(result["sla_breach"])
        self.assertFalse(result["escalation_required"])
        self.assertFalse(result["forced_action_required"])

    def test_sla_influences_next_best_action_non_blocking_recommendation(self):
        now = datetime(2026, 4, 15, 12, 0, 0)

        at_risk_case = self._base_case_data(now)
        at_risk_case["provider_response_requested_at"] = now - timedelta(hours=50)
        at_risk_action = determine_next_best_action(at_risk_case)

        forced_case = self._base_case_data(now)
        forced_case["provider_response_requested_at"] = now - timedelta(hours=130)
        forced_action = determine_next_best_action(forced_case)

        self.assertEqual(at_risk_action["code"], "follow_up_provider_response")
        self.assertIn("herinnering", at_risk_action["reason"].lower())
        self.assertEqual(forced_action["code"], "run_matching")
        self.assertIn("rematch", forced_action["reason"].lower())

    def test_ownership_values_follow_sla_levels(self):
        now = datetime(2026, 4, 15, 12, 0, 0)

        on_track = derive_provider_response_ownership(
            provider_response_status="PENDING",
            sla_state="ON_TRACK",
            hours_waiting=8,
            next_threshold_hours=48,
            now=now,
            case_phase="MATCHING",
        )
        at_risk = derive_provider_response_ownership(
            provider_response_status="PENDING",
            sla_state="AT_RISK",
            hours_waiting=50,
            next_threshold_hours=72,
            now=now,
            case_phase="MATCHING",
        )
        overdue = derive_provider_response_ownership(
            provider_response_status="PENDING",
            sla_state="OVERDUE",
            hours_waiting=84,
            next_threshold_hours=96,
            now=now,
            case_phase="MATCHING",
        )
        escalated = derive_provider_response_ownership(
            provider_response_status="PENDING",
            sla_state="ESCALATED",
            hours_waiting=105,
            next_threshold_hours=120,
            now=now,
            case_phase="MATCHING",
        )
        forced = derive_provider_response_ownership(
            provider_response_status="PENDING",
            sla_state="FORCED_ACTION",
            hours_waiting=130,
            next_threshold_hours=0,
            now=now,
            case_phase="MATCHING",
        )

        self.assertEqual(on_track["next_owner"], "system")
        self.assertEqual(on_track["next_action"], "monitor")
        self.assertEqual(at_risk["next_owner"], "regievoerder")
        self.assertEqual(at_risk["next_action"], "resend")
        self.assertEqual(overdue["next_action"], "resend_or_rematch")
        self.assertEqual(escalated["next_action"], "immediate_decision")
        self.assertEqual(forced["next_action"], "rematch_or_override_decision")

    def test_ownership_uses_deadline_and_legacy_status_normalization(self):
        now = datetime(2026, 4, 15, 12, 0, 0)
        case_data = self._base_case_data(now)
        case_data["provider_response_status"] = "NO_RESPONSE"
        case_data["provider_response_requested_at"] = now - timedelta(hours=50)

        result = evaluate_case_intelligence(case_data)

        self.assertEqual(result["sla_state"], "AT_RISK")
        self.assertEqual(result["next_owner"], "regievoerder")
        self.assertEqual(result["next_action"], "resend")
        self.assertIsNotNone(result["action_deadline"])
        self.assertIn("Binnen", result["action_deadline_label"])

        rejected_owner = derive_provider_response_ownership(
            provider_response_status="DECLINED",
            sla_state="ON_TRACK",
            hours_waiting=6,
            next_threshold_hours=0,
            now=now,
            case_phase="MATCHING",
        )
        self.assertEqual(rejected_owner["next_owner"], "regievoerder")
        self.assertEqual(rejected_owner["next_action"], "rematch")


class SlaMonitorExposureTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            username="sla_monitor_owner",
            email="sla_monitor_owner@example.com",
            password="testpass123",
        )
        self.organization = Organization.objects.create(name="SLA Monitor Org", slug="sla-monitor-org")
        OrganizationMembership.objects.create(
            organization=self.organization,
            user=self.user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )
        self.provider = CareProvider.objects.create(
            organization=self.organization,
            name="SLA Provider",
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        self.client.login(username="sla_monitor_owner", password="testpass123")

    def _create_case(self, title, *, urgency=CaseIntakeProcess.Urgency.MEDIUM):
        return CaseIntakeProcess.objects.create(
            organization=self.organization,
            title=title,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            urgency=urgency,
            preferred_care_form=CaseIntakeProcess.CareForm.OUTPATIENT,
            preferred_region_type=RegionType.GEMEENTELIJK,
            start_date=date.today(),
            target_completion_date=date.today() + timedelta(days=7),
            case_coordinator=self.user,
            assessment_summary="SLA monitor scenario.",
            client_age_category=CaseIntakeProcess.AgeCategory.ADULT,
        )

    def _create_placement(self, intake, status, *, hours_ago, provider=None):
        requested_at = timezone.now() - timedelta(hours=hours_ago)
        selected_provider = provider or self.provider
        return PlacementRequest.objects.create(
            due_diligence_process=intake,
            status=PlacementRequest.Status.IN_REVIEW,
            proposed_provider=selected_provider,
            selected_provider=selected_provider,
            care_form=intake.preferred_care_form,
            provider_response_status=status,
            provider_response_requested_at=requested_at,
            provider_response_deadline_at=requested_at + timedelta(days=2),
        )

    def test_sla_affects_monitor_sorting_priority(self):
        forced_case = self._create_case("Casus SLA Forced")
        rematch_case = self._create_case("Casus Rematch Status")

        self._create_placement(
            forced_case,
            PlacementRequest.ProviderResponseStatus.PENDING,
            hours_ago=130,
        )
        self._create_placement(
            rematch_case,
            PlacementRequest.ProviderResponseStatus.REJECTED,
            hours_ago=4,
        )

        monitor = build_provider_response_monitor(self.organization)
        self.assertGreaterEqual(len(monitor["queue_rows"]), 2)
        self.assertEqual(monitor["queue_rows"][0]["case_title"], "Casus SLA Forced")
        self.assertEqual(monitor["queue_rows"][0]["sla_state"], "FORCED_ACTION")

    def test_sla_badges_render_in_monitor_ui(self):
        forced_case = self._create_case("Casus SLA Badge")
        self._create_placement(
            forced_case,
            PlacementRequest.ProviderResponseStatus.PENDING,
            hours_ago=130,
        )

        response = self.client.get(reverse("careon:provider_response_monitor"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "SLA FORCED_ACTION")

    def test_provider_response_overview_renders_compact_table(self):
        delayed_case = self._create_case("Casus Overzicht Vertraging")
        no_capacity_case = self._create_case("Casus Overzicht Capaciteit")
        delayed_case_two = self._create_case("Casus Overzicht Vertraging 2")

        self._create_placement(
            delayed_case,
            PlacementRequest.ProviderResponseStatus.PENDING,
            hours_ago=90,
        )
        self._create_placement(
            no_capacity_case,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            hours_ago=70,
        )
        self._create_placement(
            delayed_case_two,
            PlacementRequest.ProviderResponseStatus.PENDING,
            hours_ago=100,
        )

        response = self.client.get(reverse("careon:provider_response_monitor"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Providerreactie monitor")
        self.assertContains(response, "Open reacties")
        self.assertContains(response, "Recent geen capaciteit")
        self.assertContains(response, "SLA Provider")
        self.assertContains(response, "frequent delays")

    def test_provider_response_overview_uses_current_filters(self):
        alternate_provider = CareProvider.objects.create(
            organization=self.organization,
            name="Filter Provider",
            status=CareProvider.Status.ACTIVE,
            created_by=self.user,
        )
        filtered_case = self._create_case("Casus Filter No Capacity")
        hidden_case = self._create_case("Casus Filter Pending")

        self._create_placement(
            filtered_case,
            PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
            hours_ago=80,
            provider=self.provider,
        )
        self._create_placement(
            hidden_case,
            PlacementRequest.ProviderResponseStatus.PENDING,
            hours_ago=10,
            provider=alternate_provider,
        )

        response = self.client.get(
            reverse("careon:provider_response_monitor"),
            {"provider_response_status": PlacementRequest.ProviderResponseStatus.NO_CAPACITY},
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "SLA Provider")
        self.assertContains(response, "Recent geen capaciteit")
        self.assertNotContains(response, "Filter Provider")


class ProviderResponseOverviewAggregationTests(unittest.TestCase):
    def test_aggregation_counts_and_patterns_are_correct(self):
        queue_rows = [
            {
                "provider_id": 1,
                "provider_name": "Provider Alpha",
                "status": PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
                "age_days": 8,
                "flags": {"is_overdue": True},
            },
            {
                "provider_id": 1,
                "provider_name": "Provider Alpha",
                "status": PlacementRequest.ProviderResponseStatus.NO_CAPACITY,
                "age_days": 6,
                "flags": {"is_overdue": True},
            },
            {
                "provider_id": 1,
                "provider_name": "Provider Alpha",
                "status": PlacementRequest.ProviderResponseStatus.REJECTED,
                "age_days": 4,
                "flags": {"is_overdue": False},
            },
            {
                "provider_id": 2,
                "provider_name": "Provider Beta",
                "status": PlacementRequest.ProviderResponseStatus.PENDING,
                "age_days": 2,
                "flags": {"is_overdue": False},
            },
        ]

        overview = build_provider_response_overview(queue_rows, limit=8)

        self.assertEqual(overview["total_provider_count"], 2)
        self.assertFalse(overview["is_truncated"])
        alpha = overview["rows"][0]
        self.assertEqual(alpha["provider_name"], "Provider Alpha")
        self.assertEqual(alpha["open_response_count"], 3)
        self.assertEqual(alpha["overdue_response_count"], 2)
        self.assertEqual(alpha["avg_response_age_days"], 6.0)
        self.assertEqual(alpha["recent_no_capacity_count"], 2)
        self.assertEqual(alpha["recent_rejection_count"], 1)
        self.assertIn("frequent delays", alpha["patterns"])
        self.assertIn("often no capacity", alpha["patterns"])

    def test_limit_truncates_rows_without_changing_logic(self):
        queue_rows = [
            {
                "provider_id": index,
                "provider_name": f"Provider {index}",
                "status": PlacementRequest.ProviderResponseStatus.PENDING,
                "age_days": 1,
                "flags": {"is_overdue": False},
            }
            for index in range(1, 6)
        ]

        overview = build_provider_response_overview(queue_rows, limit=3)

        self.assertEqual(overview["total_provider_count"], 5)
        self.assertTrue(overview["is_truncated"])
        self.assertEqual(len(overview["rows"]), 3)
