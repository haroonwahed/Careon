from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase

from contracts.models import CareSignal, CaseAssessment, CaseIntakeProcess, PlacementRequest
from contracts.regiekamer_service import (
    _build_active_case,
    _build_capacity_signals,
    _build_priority_queue,
    build_regiekamer_summary,
)


def _dated_value(days_ago: int = 0):
    value = MagicMock()
    value.date.return_value = date.today() - timedelta(days=days_ago)
    return value


def _region(pk: int = 1, name: str = "Regio West"):
    region = MagicMock()
    region.pk = pk
    region.region_name = name
    return region


def _assessment(
    pk: int = 21,
    *,
    status: str = CaseAssessment.AssessmentStatus.APPROVED_FOR_MATCHING,
    label: str = "Goedgekeurd voor matching",
    matching_ready: bool = True,
):
    assessment = MagicMock()
    assessment.pk = pk
    assessment.assessment_status = status
    assessment.matching_ready = matching_ready
    assessment.updated_at = _dated_value(1)
    assessment.get_assessment_status_display.return_value = label
    return assessment


def _placement(
    *,
    due_diligence_process_id: int,
    selected_provider_name: str | None = None,
    selected_provider_id: int | None = None,
    status: str = PlacementRequest.Status.IN_REVIEW,
    provider_response_status: str = PlacementRequest.ProviderResponseStatus.PENDING,
):
    placement = MagicMock()
    placement.due_diligence_process_id = due_diligence_process_id
    placement.status = status
    placement.provider_response_status = provider_response_status
    placement.placement_quality_status = None
    placement.updated_at = _dated_value(0)
    placement.get_status_display.return_value = "In review"
    placement.selected_provider_id = selected_provider_id
    if selected_provider_name is None:
        placement.selected_provider = None
    else:
        placement.selected_provider = MagicMock(name=selected_provider_name)
        placement.selected_provider.name = selected_provider_name
    return placement


def _signal():
    signal = MagicMock()
    signal.updated_at = _dated_value(0)
    return signal


def _coordinator(full_name: str = "Regisseur"):
    coordinator = MagicMock()
    coordinator.get_full_name.return_value = full_name
    return coordinator


def _intake(
    *,
    pk: int,
    status: str,
    urgency: str = CaseIntakeProcess.Urgency.MEDIUM,
    updated_days_ago: int = 0,
    preferred_region=None,
    case_coordinator=None,
    case_assessment=None,
    target_completion_date=None,
):
    intake = MagicMock()
    intake.pk = pk
    intake.status = status
    intake.urgency = urgency
    intake.title = f"Casus {pk}"
    intake.preferred_region = preferred_region
    intake.preferred_region_id = preferred_region.pk if preferred_region else None
    intake.case_coordinator = case_coordinator
    intake.case_assessment = case_assessment
    intake.target_completion_date = target_completion_date
    intake.updated_at = _dated_value(updated_days_ago)
    intake.start_date = date.today() - timedelta(days=updated_days_ago + 1)
    intake.get_status_display.return_value = status
    intake.get_urgency_display.return_value = urgency
    intake.get_preferred_care_form_display.return_value = "Ambulant"
    return intake


class RegiekamerCapacityAndQueueTests(TestCase):
    def test_capacity_signals_include_provider_shortage_and_region_overload(self):
        org = MagicMock(pk=42)
        profile = MagicMock()
        profile.client.name = "Provider Vol"
        profile.current_capacity = 5
        profile.max_capacity = 5

        provider_profiles = MagicMock()
        provider_profiles.select_related.return_value = [profile]

        region = _region(pk=9, name="ROAZ West")
        active_intakes = [
            _intake(pk=index, status=CaseIntakeProcess.ProcessStatus.MATCHING, preferred_region=region)
            for index in range(1, 6)
        ]

        with patch("contracts.regiekamer_service.ProviderProfile.objects.filter", return_value=provider_profiles):
            signals, shortage_count = _build_capacity_signals(org, active_intakes)

        self.assertEqual(shortage_count, 1)
        self.assertTrue(any("Provider Vol heeft geen capaciteit" in item["label"] for item in signals))
        self.assertTrue(any("Regio overbelast: ROAZ West" in item["label"] for item in signals))

    def test_priority_queue_orders_matching_blocker_ahead_of_lower_priority_case(self):
        matching_intake = _intake(
            pk=1,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            updated_days_ago=9,
            case_assessment=_assessment(pk=31),
        )
        assessment_intake = _intake(
            pk=2,
            status=CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            urgency=CaseIntakeProcess.Urgency.LOW,
            updated_days_ago=1,
            case_assessment=_assessment(pk=32),
        )

        queue = _build_priority_queue(
            [
                {
                    "intake": assessment_intake,
                    "assessment": assessment_intake.case_assessment,
                    "placement": None,
                    "open_signals": [],
                    "waiting_days": 1,
                    "blocker": None,
                    "is_urgent": False,
                    "has_match_issue": False,
                    "is_waiting_long": False,
                    "weak_matching": False,
                },
                {
                    "intake": matching_intake,
                    "assessment": matching_intake.case_assessment,
                    "placement": None,
                    "open_signals": [],
                    "waiting_days": 9,
                    "blocker": {"key": "no_match", "label": "Geen match", "score": 120},
                    "is_urgent": False,
                    "has_match_issue": True,
                    "is_waiting_long": True,
                    "weak_matching": False,
                },
            ]
        )

        self.assertEqual(queue[0]["id"], 1)
        self.assertEqual(queue[0]["next_action"]["type"], "assign")
        self.assertGreater(queue[0]["priority_score"], queue[1]["priority_score"])


class RegiekamerActiveCaseTests(TestCase):
    def test_build_active_case_prefers_selected_case_and_assigned_match_status(self):
        region = _region(name="Regio Zuid")
        intake_one = _intake(pk=1, status=CaseIntakeProcess.ProcessStatus.ASSESSMENT)
        intake_two = _intake(
            pk=2,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            preferred_region=region,
            case_coordinator=_coordinator(),
            case_assessment=_assessment(pk=41),
        )
        placement_two = _placement(
            due_diligence_process_id=2,
            selected_provider_name="Provider Zuid",
            selected_provider_id=77,
        )
        priority_queue = [
            {
                "id": 1,
                "title": "Casus 1",
                "phase": "Assessment",
                "urgency": "medium",
                "waiting_label": "1d",
                "blocker": "Beoordeling ontbreekt",
                "next_action": {"label": "Start beoordeling", "href": "/assessment/1/", "type": "review"},
                "assessment_status": "Niet gestart",
                "placement_status": "Niet gestart",
                "case_href": "/cases/1/",
            },
            {
                "id": 2,
                "title": "Casus 2",
                "phase": "Matching",
                "urgency": "medium",
                "waiting_label": "3d",
                "blocker": "Geen match",
                "next_action": {"label": "Koppel aanbieder", "href": "/matching/?intake=2", "type": "assign"},
                "assessment_status": "Goedgekeurd voor matching",
                "placement_status": "In review",
                "case_href": "/cases/2/",
            },
        ]

        active_case = _build_active_case(
            priority_queue,
            [intake_one, intake_two],
            {2: placement_two},
            {2: [_signal()]},
            selected_case_id=2,
        )

        self.assertEqual(active_case["id"], 2)
        self.assertEqual(active_case["match_status"], "Toegewezen aan Provider Zuid")
        self.assertEqual(active_case["region"], "Regio Zuid")
        self.assertEqual(active_case["coordinator"], "Regisseur")
        self.assertTrue(any(item["label"] == "Laatste signaal" for item in active_case["timeline"]))

    def test_build_active_case_marks_ready_for_assignment_without_placement(self):
        assessment = _assessment(pk=51)
        intake = _intake(
            pk=5,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            case_assessment=assessment,
        )
        priority_queue = [
            {
                "id": 5,
                "title": "Casus 5",
                "phase": "Matching",
                "urgency": "medium",
                "waiting_label": "2d",
                "blocker": "Geen match",
                "next_action": {"label": "Koppel aanbieder", "href": "/matching/?intake=5", "type": "assign"},
                "assessment_status": "Goedgekeurd voor matching",
                "placement_status": "Niet gestart",
                "case_href": "/cases/5/",
            }
        ]

        active_case = _build_active_case(priority_queue, [intake], {}, {}, selected_case_id=5)

        self.assertEqual(active_case["match_status"], "Klaar voor toewijzing")


class RegiekamerSummaryForecastTests(TestCase):
    def test_build_regiekamer_summary_propagates_predictive_forecast(self):
        org = MagicMock(pk=8)
        intake = _intake(
            pk=7,
            status=CaseIntakeProcess.ProcessStatus.MATCHING,
            updated_days_ago=10,
            preferred_region=_region(pk=4, name="Regio Noord"),
            case_coordinator=_coordinator("Coördinator Noord"),
            case_assessment=_assessment(pk=61),
            target_completion_date=date.today() - timedelta(days=1),
        )
        placement = _placement(
            due_diligence_process_id=7,
            selected_provider_name="Provider Noord",
            selected_provider_id=17,
        )

        placement_qs = MagicMock()
        placement_qs.select_related.return_value = placement_qs
        placement_qs.order_by.return_value = [placement]

        provider_profiles = MagicMock()
        provider_profiles.select_related.return_value = []

        predictive_summary = {
            "per_case_forecast": {
                7: {
                    "risk_score": 88,
                    "risk_band": "high",
                    "top_reasons": ["Wachttijdnorm overschreden"],
                    "next_best_action": "Escaleren",
                    "next_best_action_href": "/signals/new/7/",
                    "projected_impact": "Escalatie voorkomt SLA-breuk",
                }
            },
            "action_impact_summary": {"summary": "Escalatie voorkomt SLA-breuk"},
            "forecast_signals": [{"label": "SLA-risico"}],
            "sla_risk_cases": [7],
            "projected_bottleneck_stage": "matching",
            "predictive_strips": [{"label": "Binnen 24 uur ingrijpen"}],
        }

        with patch("contracts.regiekamer_service.PlacementRequest.objects.filter", return_value=placement_qs), patch(
            "contracts.regiekamer_service.ProviderProfile.objects.filter", return_value=provider_profiles
        ), patch("contracts.regiekamer_service.build_predictive_summary", return_value=predictive_summary):
            result = build_regiekamer_summary(
                org=org,
                active_intakes=[intake],
                signals_qs=CareSignal.objects.none(),
                selected_case_id=7,
                today=date.today(),
            )

        self.assertEqual(result["selected_case_id"], 7)
        self.assertEqual(result["priority_queue"][0]["risk_band"], "high")
        self.assertEqual(result["priority_queue"][0]["forecast_action"]["label"], "Escaleren")
        self.assertEqual(
            result["priority_queue"][0]["forecast_action"]["impact"],
            "Escalatie voorkomt SLA-breuk",
        )
        self.assertEqual(result["command_bar"]["impact_summary"]["summary"], "Escalatie voorkomt SLA-breuk")
        self.assertEqual(result["active_case"]["id"], 7)
        self.assertEqual(result["active_case"]["coordinator"], "Coördinator Noord")
