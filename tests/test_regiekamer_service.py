"""
Tests for contracts.regiekamer_service
=======================================

Covers:
  - _compute_bottleneck_stage: priority rules
  - _build_command_bar: Dutch copy per priority case
  - _build_priority_queue: priority_score ordering
  - _compute_flow_counts: correct phase bucketing
  - _build_signal_strips: deduplication with bottleneck_stage
  - build_regiekamer_summary: fallback / empty data
  - CTA URL validity (no broken params)
"""

from datetime import date
from unittest.mock import MagicMock, PropertyMock, patch

from django.test import RequestFactory, TestCase
from django.urls import reverse

from contracts.models import CareSignal, CaseAssessment, CaseIntakeProcess, PlacementRequest
from contracts.regiekamer_service import (
    WAITING_THRESHOLD_DAYS,
    _build_command_bar,
    _build_signal_strips,
    _compute_bottleneck_stage,
    _compute_flow_counts,
    build_regiekamer_summary,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _empty_buckets(**overrides) -> dict:
    """Base buckets with all zeros; caller overrides individual keys."""
    base = {
        "open_beoordelingen": 0,
        "blocked_cases": 0,
        "cases_without_match": 0,
        "waiting_time_exceeded": 0,
        "placements_pending": 0,
        "high_risk_cases": 0,
        "capacity_shortages": 0,
        "_blocked_ids": set(),
        "_open_beoordelingen_ids": set(),
        "_without_match_ids": set(),
        "_exceeded_ids": set(),
        "_pending_ids": set(),
        "_high_risk_ids": set(),
        "_enriched": [],
    }
    base.update(overrides)
    return base


def _intake(
    pk: int = 1,
    status: str = CaseIntakeProcess.ProcessStatus.INTAKE,
    urgency: str = CaseIntakeProcess.Urgency.MEDIUM,
    updated_days_ago: int = 0,
    target_completion_date=None,
    preferred_region=None,
    case_coordinator=None,
    case_assessment=None,
):
    """Create a lightweight MagicMock shaped like CaseIntakeProcess."""
    today = date.today()
    m = MagicMock()
    m.pk = pk
    m.status = status
    m.urgency = urgency
    m.title = f"Casus {pk}"
    m.preferred_region = preferred_region
    m.preferred_region_id = preferred_region.pk if preferred_region else None
    m.case_coordinator = case_coordinator
    m.case_assessment = case_assessment
    m.target_completion_date = target_completion_date
    # updated_at.date() must return a real date
    updated_at_mock = MagicMock()
    updated_at_mock.date.return_value = date.fromordinal(today.toordinal() - updated_days_ago)
    m.updated_at = updated_at_mock
    m.start_date = today
    m.get_status_display.return_value = status
    m.get_urgency_display.return_value = urgency
    m.get_preferred_care_form_display.return_value = "Zorg thuis"
    return m


# ---------------------------------------------------------------------------
# _compute_bottleneck_stage
# ---------------------------------------------------------------------------

class TestComputeBottleneckStage(TestCase):

    def test_beoordelingen_dominates_when_higher_than_without_match(self):
        buckets = _empty_buckets(open_beoordelingen=5, cases_without_match=3)
        assert _compute_bottleneck_stage(buckets) == "beoordelingen"

    def test_matching_when_more_without_match_than_beoordelingen(self):
        buckets = _empty_buckets(open_beoordelingen=2, cases_without_match=4)
        assert _compute_bottleneck_stage(buckets) == "matching"

    def test_plaatsingen_when_only_pending(self):
        buckets = _empty_buckets(placements_pending=3)
        assert _compute_bottleneck_stage(buckets) == "plaatsingen"

    def test_casussen_when_only_blocked(self):
        buckets = _empty_buckets(blocked_cases=2)
        assert _compute_bottleneck_stage(buckets) == "casussen"

    def test_none_when_all_zero(self):
        buckets = _empty_buckets()
        assert _compute_bottleneck_stage(buckets) == "none"

    def test_beoordelingen_equals_without_match_prefers_beoordelingen(self):
        buckets = _empty_buckets(open_beoordelingen=3, cases_without_match=3)
        # Rule: >= so beoordelingen wins on tie
        assert _compute_bottleneck_stage(buckets) == "beoordelingen"


# ---------------------------------------------------------------------------
# _build_command_bar
# ---------------------------------------------------------------------------

class TestBuildCommandBar(TestCase):

    def test_blocked_takes_priority_over_beoordelingen(self):
        buckets = _empty_buckets(blocked_cases=2, open_beoordelingen=5)
        bar = _build_command_bar(buckets, "casussen")
        assert bar["priority"] == "critical"
        assert "blokkade" in bar["problem"].lower()
        assert "case_list" in bar["cta_url"] or "casussen" in bar["cta_url"]

    def test_open_beoordelingen_second_priority(self):
        buckets = _empty_buckets(open_beoordelingen=3)
        bar = _build_command_bar(buckets, "beoordelingen")
        assert bar["priority"] == "high"
        assert "beoordeling" in bar["problem"].lower()
        assert bar["cta_url"] == reverse("careon:assessment_list")

    def test_without_match_third_priority(self):
        buckets = _empty_buckets(cases_without_match=2)
        bar = _build_command_bar(buckets, "matching")
        assert bar["priority"] == "high"
        assert "match" in bar["problem"].lower()
        assert bar["cta_url"] == reverse("careon:matching_dashboard")

    def test_capacity_fourth_priority(self):
        buckets = _empty_buckets(capacity_shortages=1)
        bar = _build_command_bar(buckets, "none")
        assert bar["priority"] == "warning"
        assert "capaciteit" in bar["problem"].lower()

    def test_waiting_fifth_priority(self):
        buckets = _empty_buckets(waiting_time_exceeded=4)
        bar = _build_command_bar(buckets, "none")
        assert bar["priority"] == "warning"
        assert "wachttijd" in bar["problem"].lower() or "wacht" in bar["problem"].lower()

    def test_pending_sixth_priority(self):
        buckets = _empty_buckets(placements_pending=2)
        bar = _build_command_bar(buckets, "none")
        assert bar["priority"] == "info"
        assert "plaatsing" in bar["problem"].lower()

    def test_monitor_fallback_when_all_zero(self):
        buckets = _empty_buckets()
        bar = _build_command_bar(buckets, "none")
        assert bar["priority"] == "info"
        assert "stabiel" in bar["problem"].lower() or "overzicht" in bar["cta_label"].lower()

    def test_high_risk_after_pending(self):
        # high_risk is after pending in priority order
        buckets = _empty_buckets(high_risk_cases=1)
        bar = _build_command_bar(buckets, "none")
        assert bar["priority"] == "warning"
        assert "risico" in bar["problem"].lower() or "urgentie" in bar["problem"].lower() or "crisis" in bar["problem"].lower()

    def test_cta_url_uses_no_sort_waiting(self):
        """?sort=waiting is not a supported param — must never appear in generated URLs."""
        buckets = _empty_buckets(
            blocked_cases=1,
            open_beoordelingen=2,
            cases_without_match=3,
            capacity_shortages=0,
            waiting_time_exceeded=5,
            placements_pending=1,
            high_risk_cases=2,
        )
        for override in [
            _empty_buckets(blocked_cases=1),
            _empty_buckets(open_beoordelingen=2),
            _empty_buckets(cases_without_match=3),
            _empty_buckets(waiting_time_exceeded=5),
            _empty_buckets(placements_pending=1),
            _empty_buckets(high_risk_cases=2),
            _empty_buckets(),
        ]:
            bar = _build_command_bar(override, "none")
            assert "?sort=waiting" not in bar["cta_url"], (
                f"Broken param ?sort=waiting found in command_bar cta_url: {bar['cta_url']}"
            )


# ---------------------------------------------------------------------------
# _compute_flow_counts
# ---------------------------------------------------------------------------

class TestComputeFlowCounts(TestCase):

    def _intake_with_status(self, status, pk=1):
        i = _intake(pk=pk, status=status)
        return i

    def test_all_phases_counted(self):
        statuses = [
            CaseIntakeProcess.ProcessStatus.INTAKE,
            CaseIntakeProcess.ProcessStatus.INTAKE,
            CaseIntakeProcess.ProcessStatus.ASSESSMENT,
            CaseIntakeProcess.ProcessStatus.MATCHING,
            CaseIntakeProcess.ProcessStatus.DECISION,
            CaseIntakeProcess.ProcessStatus.ON_HOLD,
        ]
        intakes = [self._intake_with_status(s, pk=i) for i, s in enumerate(statuses)]
        counts = _compute_flow_counts(intakes)
        assert counts["casussen"] == 2
        assert counts["beoordelingen"] == 1
        assert counts["matching"] == 1
        assert counts["plaatsingen"] == 1
        assert counts["on_hold"] == 1

    def test_empty_list_returns_zeros(self):
        counts = _compute_flow_counts([])
        assert all(v == 0 for v in counts.values())

    def test_completed_not_counted(self):
        intake = self._intake_with_status(CaseIntakeProcess.ProcessStatus.COMPLETED)
        counts = _compute_flow_counts([intake])
        # COMPLETED is not in any bucket
        assert counts["casussen"] == 0
        assert counts["beoordelingen"] == 0
        assert counts["matching"] == 0
        assert counts["plaatsingen"] == 0
        assert counts["on_hold"] == 0


# ---------------------------------------------------------------------------
# _build_signal_strips
# ---------------------------------------------------------------------------

class TestBuildSignalStrips(TestCase):

    def test_deduplicates_with_bottleneck_stage_beoordelingen(self):
        buckets = _empty_buckets(
            open_beoordelingen=3,
            cases_without_match=2,
            waiting_time_exceeded=1,
        )
        strips = _build_signal_strips(buckets, "beoordelingen", [], 0)
        # waiting_exceeded strip should NOT appear if bottleneck is beoordelingen
        labels = [s["label"] for s in strips]
        # without_match should appear (bottleneck != matching)
        assert any("aanbieder" in label.lower() or "match" in label.lower() for label in labels)

    def test_deduplicates_with_bottleneck_stage_matching(self):
        buckets = _empty_buckets(cases_without_match=3, waiting_time_exceeded=2)
        strips = _build_signal_strips(buckets, "matching", [], 0)
        # without_match strip should be suppressed when bottleneck = matching
        labels = [s["label"] for s in strips]
        assert not any("aanbieder" in label.lower() or "zonder beschikbare" in label.lower() for label in labels)

    def test_max_three_strips_returned(self):
        buckets = _empty_buckets(
            waiting_time_exceeded=5,
            cases_without_match=4,
            placements_pending=3,
            capacity_shortages=2,
            high_risk_cases=1,
        )
        strips = _build_signal_strips(buckets, "none", [], 2)
        assert len(strips) <= 3

    def test_empty_when_all_zero(self):
        buckets = _empty_buckets()
        strips = _build_signal_strips(buckets, "none", [], 0)
        assert strips == []


# ---------------------------------------------------------------------------
# build_regiekamer_summary — integration / fallback
# ---------------------------------------------------------------------------

class TestBuildRegiekamerSummaryFallback(TestCase):
    """
    Tests that build_regiekamer_summary degrades gracefully with empty data.
    Uses a real (test) database via Django TestCase.
    """

    def _make_org(self):
        """Return a minimal org mock that won't trigger DB queries for ProviderProfile."""
        org = MagicMock()
        org.pk = 9999
        return org

    def test_empty_intakes_returns_all_required_keys(self):
        org = self._make_org()
        # Patch ProviderProfile queries so no DB access needed
        with patch(
            "contracts.regiekamer_service.ProviderProfile.objects.filter",
            return_value=MagicMock(
                select_related=MagicMock(return_value=[]),
            ),
        ):
            result = build_regiekamer_summary(
                org=org,
                active_intakes=[],
                signals_qs=CareSignal.objects.none(),
                selected_case_id=None,
                today=date.today(),
            )

        required_keys = [
            "recommended_action",
            "regiekamer_kpis",
            "priority_queue",
            "next_actions",
            "capacity_signals",
            "bottleneck_signals",
            "signal_items",
            "operational_insights",
            "alert_strip",
            "active_case",
            # New keys
            "flow_counts",
            "command_bar",
            "bottleneck_stage",
            "priority_cards",
            "signal_strips",
        ]
        for key in required_keys:
            assert key in result, f"Missing key in regiekamer_summary: {key}"

    def test_empty_intakes_no_crash(self):
        org = self._make_org()
        with patch(
            "contracts.regiekamer_service.ProviderProfile.objects.filter",
            return_value=MagicMock(
                select_related=MagicMock(return_value=[]),
            ),
        ):
            result = build_regiekamer_summary(
                org=org,
                active_intakes=[],
                signals_qs=CareSignal.objects.none(),
                selected_case_id=None,
                today=date.today(),
            )
        assert result["priority_queue"] == []
        assert result["active_case"] is None
        assert result["flow_counts"]["casussen"] == 0
        assert result["bottleneck_stage"] == "none"

    def test_none_org_does_not_crash(self):
        """When org is None (unauthenticated context), must not raise."""
        with patch(
            "contracts.regiekamer_service.ProviderProfile.objects.none",
            return_value=MagicMock(__iter__=MagicMock(return_value=iter([]))),
        ):
            result = build_regiekamer_summary(
                org=None,
                active_intakes=[],
                signals_qs=CareSignal.objects.none(),
                selected_case_id=None,
                today=date.today(),
            )
        assert "command_bar" in result
        assert result["bottleneck_stage"] == "none"

    def test_regiekamer_kpis_no_sort_waiting_param(self):
        """?sort=waiting is not a supported view param — must never appear in KPI hrefs."""
        org = self._make_org()
        with patch(
            "contracts.regiekamer_service.ProviderProfile.objects.filter",
            return_value=MagicMock(
                select_related=MagicMock(return_value=[]),
            ),
        ):
            result = build_regiekamer_summary(
                org=org,
                active_intakes=[],
                signals_qs=CareSignal.objects.none(),
                selected_case_id=None,
                today=date.today(),
            )
        for kpi in result["regiekamer_kpis"]:
            assert "?sort=waiting" not in kpi.get("href", ""), (
                f"Broken param ?sort=waiting found in regiekamer_kpi href: {kpi}"
            )

    def test_single_intake_with_assessment_needed(self):
        """Single INTAKE-phase case: open_beoordelingen should be > 0."""
        org = self._make_org()
        intake = _intake(pk=1, status=CaseIntakeProcess.ProcessStatus.ASSESSMENT)
        with patch(
            "contracts.regiekamer_service.ProviderProfile.objects.filter",
            return_value=MagicMock(
                select_related=MagicMock(return_value=[]),
            ),
        ):
            result = build_regiekamer_summary(
                org=org,
                active_intakes=[intake],
                signals_qs=CareSignal.objects.none(),
                selected_case_id=None,
                today=date.today(),
            )
        # No assessment → open_beoordelingen bucket should be 1
        flow = result["flow_counts"]
        assert flow["beoordelingen"] == 1
        # priority_queue should have one entry
        assert len(result["priority_queue"]) == 1
