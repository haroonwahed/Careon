"""
Unit tests for contracts/intelligence_pilot_dashboard.py

Pure Python — no database, no Django ORM.

Tests cover:
- build_pilot_dashboard()  — full output structure
- _pct()                   — boundary conditions
- _delta()                 — signed delta, None propagation
- _trend_direction()       — all branches including inverse_good
- _format_* helpers        — None and numeric cases
- _status_from_kpis()      — all three tiers
- _build_issues()          — issue detection and cap
- _build_recommendation()  — priority ordering
- _extract_*()             — field extraction tolerant of missing attrs
- Sparse / empty data      — zero cases, zero placements, None fields
- Baseline deltas          — correct sign and formatting
"""
import unittest
from typing import Any


# ---------------------------------------------------------------------------
# Minimal mock objects
# ---------------------------------------------------------------------------

class MockCase:
    def __init__(self, status="INTAKE"):
        self.status = status


class MockPlacement:
    def __init__(
        self,
        provider_response_status="ACCEPTED",
        placement_quality_status="GOOD_FIT",
        predicted_confidence=0.80,
    ):
        self.provider_response_status = provider_response_status
        self.placement_quality_status = placement_quality_status
        self.predicted_confidence = predicted_confidence


class MockAlert:
    def __init__(self, alert_type="provider_rejected_case"):
        self.alert_type = alert_type


# ---------------------------------------------------------------------------
# Import helpers
# ---------------------------------------------------------------------------

def _import():
    from contracts.intelligence_pilot_dashboard import (
        _pct,
        _delta,
        _trend_direction,
        _format_pct,
        _format_pp,
        _format_count,
        _format_count_delta,
        _status_from_kpis,
        _build_issues,
        _build_recommendation,
        _extract_alert_type,
        _extract_confidence,
        _extract_accepted,
        _extract_good_fit,
        _extract_intake_started,
        _bucket_case_stage,
        build_pilot_dashboard,
        HIGH_CONFIDENCE_THRESHOLD,
        LOW_CONFIDENCE_THRESHOLD,
    )
    return locals()


# ---------------------------------------------------------------------------
# _pct
# ---------------------------------------------------------------------------

class PctTests(unittest.TestCase):
    def _fn(self, part, whole):
        from contracts.intelligence_pilot_dashboard import _pct
        return _pct(part, whole)

    def test_basic(self):
        self.assertEqual(self._fn(1, 4), 25.0)

    def test_zero_whole_returns_none(self):
        self.assertIsNone(self._fn(0, 0))

    def test_zero_part(self):
        self.assertEqual(self._fn(0, 10), 0.0)

    def test_full_percentage(self):
        self.assertEqual(self._fn(10, 10), 100.0)

    def test_rounding(self):
        result = self._fn(1, 3)
        self.assertEqual(result, 33.3)


# ---------------------------------------------------------------------------
# _delta
# ---------------------------------------------------------------------------

class DeltaTests(unittest.TestCase):
    def _fn(self, current, baseline):
        from contracts.intelligence_pilot_dashboard import _delta
        return _delta(current, baseline)

    def test_positive_delta(self):
        self.assertEqual(self._fn(70.0, 60.0), 10.0)

    def test_negative_delta(self):
        self.assertEqual(self._fn(50.0, 60.0), -10.0)

    def test_zero_delta(self):
        self.assertEqual(self._fn(60.0, 60.0), 0.0)

    def test_none_current_returns_none(self):
        self.assertIsNone(self._fn(None, 60.0))

    def test_none_baseline_returns_none(self):
        self.assertIsNone(self._fn(70.0, None))

    def test_both_none_returns_none(self):
        self.assertIsNone(self._fn(None, None))

    def test_rounding(self):
        result = self._fn(60.12345, 60.0)
        self.assertEqual(result, 0.1)


# ---------------------------------------------------------------------------
# _trend_direction
# ---------------------------------------------------------------------------

class TrendDirectionTests(unittest.TestCase):
    def _fn(self, delta, inverse_good=False):
        from contracts.intelligence_pilot_dashboard import _trend_direction
        return _trend_direction(delta, inverse_good=inverse_good)

    def test_none_is_neutral(self):
        self.assertEqual(self._fn(None), 'neutral')

    def test_zero_is_neutral(self):
        self.assertEqual(self._fn(0.0), 'neutral')

    def test_positive_is_up(self):
        self.assertEqual(self._fn(5.0), 'up')

    def test_negative_is_down(self):
        self.assertEqual(self._fn(-5.0), 'down')

    def test_inverse_positive_is_down(self):
        self.assertEqual(self._fn(5.0, inverse_good=True), 'down')

    def test_inverse_negative_is_up(self):
        self.assertEqual(self._fn(-5.0, inverse_good=True), 'up')

    def test_inverse_zero_is_neutral(self):
        self.assertEqual(self._fn(0.0, inverse_good=True), 'neutral')

    def test_inverse_none_is_neutral(self):
        self.assertEqual(self._fn(None, inverse_good=True), 'neutral')


# ---------------------------------------------------------------------------
# _format_* helpers
# ---------------------------------------------------------------------------

class FormatHelpersTests(unittest.TestCase):
    def test_format_pct_none(self):
        from contracts.intelligence_pilot_dashboard import _format_pct
        self.assertEqual(_format_pct(None), 'n.v.t.')

    def test_format_pct_value(self):
        from contracts.intelligence_pilot_dashboard import _format_pct
        self.assertEqual(_format_pct(67.5), '67.5%')

    def test_format_pp_none(self):
        from contracts.intelligence_pilot_dashboard import _format_pp
        self.assertEqual(_format_pp(None), 'n.v.t.')

    def test_format_pp_positive(self):
        from contracts.intelligence_pilot_dashboard import _format_pp
        self.assertEqual(_format_pp(5.0), '+5.0pp')

    def test_format_pp_negative(self):
        from contracts.intelligence_pilot_dashboard import _format_pp
        self.assertEqual(_format_pp(-3.0), '-3.0pp')

    def test_format_count_none(self):
        from contracts.intelligence_pilot_dashboard import _format_count
        self.assertEqual(_format_count(None), 'n.v.t.')

    def test_format_count_int(self):
        from contracts.intelligence_pilot_dashboard import _format_count
        self.assertEqual(_format_count(4), '4')

    def test_format_count_delta_positive(self):
        from contracts.intelligence_pilot_dashboard import _format_count_delta
        self.assertEqual(_format_count_delta(2.0), '+2')

    def test_format_count_delta_negative(self):
        from contracts.intelligence_pilot_dashboard import _format_count_delta
        self.assertEqual(_format_count_delta(-3.0), '-3')

    def test_format_count_delta_none(self):
        from contracts.intelligence_pilot_dashboard import _format_count_delta
        self.assertEqual(_format_count_delta(None), 'n.v.t.')


# ---------------------------------------------------------------------------
# _status_from_kpis
# ---------------------------------------------------------------------------

class StatusFromKpisTests(unittest.TestCase):
    def _fn(self, acceptance_rate, stuck_cases, weak_match_share, intake_started_share):
        from contracts.intelligence_pilot_dashboard import _status_from_kpis
        return _status_from_kpis(acceptance_rate, stuck_cases, weak_match_share, intake_started_share)

    def test_on_track_when_all_good(self):
        r = self._fn(70.0, 0, 10.0, 75.0)
        self.assertEqual(r['key'], 'on_track')
        self.assertEqual(r['tone'], 'success')

    def test_at_risk_when_all_bad(self):
        r = self._fn(20.0, 10, 50.0, 20.0)
        self.assertEqual(r['key'], 'at_risk')
        self.assertEqual(r['tone'], 'danger')

    def test_watch_in_between(self):
        # acceptance=50 (1pt), stuck=3 (1pt), weak=30 (1pt), intake=50 (1pt) → score=4
        r = self._fn(50.0, 3, 30.0, 50.0)
        self.assertEqual(r['key'], 'watch')
        self.assertEqual(r['tone'], 'warning')

    def test_none_kpis_still_returns_dict(self):
        r = self._fn(None, 0, None, None)
        self.assertIn(r['key'], ('on_track', 'watch', 'at_risk'))

    def test_stuck_zero_gives_max_stuck_score(self):
        # With zero stuck cases the stuck component scores 2
        r = self._fn(None, 0, None, None)
        # score=2 → at_risk tier (below SCORE_WATCH=4)
        self.assertEqual(r['key'], 'at_risk')


# ---------------------------------------------------------------------------
# _build_issues
# ---------------------------------------------------------------------------

class BuildIssuesTests(unittest.TestCase):
    def _fn(self, counter):
        from collections import Counter
        from contracts.intelligence_pilot_dashboard import _build_issues
        return _build_issues(Counter(counter))

    def test_empty_counter_returns_empty(self):
        self.assertEqual(self._fn({}), [])

    def test_provider_rejected_case_detected(self):
        issues = self._fn({'provider_rejected_case': 2})
        self.assertEqual(len(issues), 1)
        self.assertIn('afwijzingen', issues[0]['title'])
        self.assertEqual(issues[0]['tone'], 'danger')

    def test_no_capacity_detected(self):
        issues = self._fn({'no_capacity_available': 1})
        self.assertEqual(len(issues), 1)
        self.assertIn('capaciteit', issues[0]['title'])

    def test_summary_both_alert_types_aggregated(self):
        issues = self._fn({'summary_missing_or_stale': 1, 'missing_summary': 2})
        total_title = next(i['title'] for i in issues if 'samenvatting' in i['title'].lower())
        self.assertIn('3', total_title)

    def test_max_issues_capped_at_3(self):
        issues = self._fn({
            'provider_rejected_case': 5,
            'no_capacity_available': 5,
            'weak_match_needs_verification': 5,
            'placement_stalled': 5,
            'missing_summary': 5,
        })
        self.assertLessEqual(len(issues), 3)

    def test_placement_stalled_detected(self):
        issues = self._fn({'placement_stalled': 3})
        self.assertEqual(issues[0]['tone'], 'danger')
        self.assertIn('plaatsingen', issues[0]['title'])


# ---------------------------------------------------------------------------
# _build_recommendation
# ---------------------------------------------------------------------------

class BuildRecommendationTests(unittest.TestCase):
    def _fn(self, counter):
        from collections import Counter
        from contracts.intelligence_pilot_dashboard import _build_recommendation
        return _build_recommendation(Counter(counter))

    def test_default_recommendation(self):
        r = self._fn({})
        self.assertIn('Monitor', r)

    def test_no_capacity_priority(self):
        r = self._fn({'no_capacity_available': 3})
        self.assertIn('aanbiederpool', r)

    def test_provider_rejected_priority(self):
        r = self._fn({'provider_rejected_case': 3})
        self.assertIn('afwijzingsredenen', r)

    def test_summary_priority(self):
        r = self._fn({'summary_missing_or_stale': 2})
        self.assertIn('samenvattingen', r)

    def test_weak_match_priority(self):
        r = self._fn({'weak_match_needs_verification': 2})
        self.assertIn('verificatie', r)

    def test_no_capacity_beats_provider_rejected(self):
        r = self._fn({'no_capacity_available': 2, 'provider_rejected_case': 2})
        self.assertIn('aanbiederpool', r)


# ---------------------------------------------------------------------------
# Field extractors
# ---------------------------------------------------------------------------

class ExtractorTests(unittest.TestCase):
    def test_extract_alert_type(self):
        from contracts.intelligence_pilot_dashboard import _extract_alert_type
        a = MockAlert('provider_rejected_case')
        self.assertEqual(_extract_alert_type(a), 'provider_rejected_case')

    def test_extract_alert_type_missing_attr(self):
        from contracts.intelligence_pilot_dashboard import _extract_alert_type
        self.assertEqual(_extract_alert_type(object()), '')

    def test_extract_confidence_float(self):
        from contracts.intelligence_pilot_dashboard import _extract_confidence
        p = MockPlacement(predicted_confidence=0.75)
        self.assertAlmostEqual(_extract_confidence(p), 0.75)

    def test_extract_confidence_none(self):
        from contracts.intelligence_pilot_dashboard import _extract_confidence
        p = MockPlacement(predicted_confidence=None)
        self.assertIsNone(_extract_confidence(p))

    def test_extract_confidence_missing_attr(self):
        from contracts.intelligence_pilot_dashboard import _extract_confidence
        self.assertIsNone(_extract_confidence(object()))

    def test_extract_accepted_true(self):
        from contracts.intelligence_pilot_dashboard import _extract_accepted
        p = MockPlacement(provider_response_status='ACCEPTED')
        self.assertTrue(_extract_accepted(p))

    def test_extract_accepted_rejected(self):
        from contracts.intelligence_pilot_dashboard import _extract_accepted
        p = MockPlacement(provider_response_status='REJECTED')
        self.assertFalse(_extract_accepted(p))

    def test_extract_accepted_no_capacity(self):
        from contracts.intelligence_pilot_dashboard import _extract_accepted
        p = MockPlacement(provider_response_status='NO_CAPACITY')
        self.assertFalse(_extract_accepted(p))

    def test_extract_accepted_pending_returns_none(self):
        from contracts.intelligence_pilot_dashboard import _extract_accepted
        p = MockPlacement(provider_response_status='PENDING')
        self.assertIsNone(_extract_accepted(p))

    def test_extract_good_fit_good(self):
        from contracts.intelligence_pilot_dashboard import _extract_good_fit
        p = MockPlacement(placement_quality_status='GOOD_FIT')
        self.assertTrue(_extract_good_fit(p))

    def test_extract_good_fit_at_risk(self):
        from contracts.intelligence_pilot_dashboard import _extract_good_fit
        p = MockPlacement(placement_quality_status='AT_RISK')
        self.assertFalse(_extract_good_fit(p))

    def test_extract_good_fit_pending_returns_none(self):
        from contracts.intelligence_pilot_dashboard import _extract_good_fit
        p = MockPlacement(placement_quality_status='PENDING')
        self.assertIsNone(_extract_good_fit(p))

    def test_extract_intake_started_intake_false(self):
        from contracts.intelligence_pilot_dashboard import _extract_intake_started
        self.assertFalse(_extract_intake_started(MockCase('INTAKE')))

    def test_extract_intake_started_matching_true(self):
        from contracts.intelligence_pilot_dashboard import _extract_intake_started
        self.assertTrue(_extract_intake_started(MockCase('MATCHING')))

    def test_extract_intake_started_completed_true(self):
        from contracts.intelligence_pilot_dashboard import _extract_intake_started
        self.assertTrue(_extract_intake_started(MockCase('COMPLETED')))

    def test_extract_intake_started_none_status(self):
        from contracts.intelligence_pilot_dashboard import _extract_intake_started
        self.assertIsNone(_extract_intake_started(MockCase(None)))

    def test_bucket_intake(self):
        from contracts.intelligence_pilot_dashboard import _bucket_case_stage
        self.assertEqual(_bucket_case_stage(MockCase('INTAKE')), 'intake')

    def test_bucket_matching(self):
        from contracts.intelligence_pilot_dashboard import _bucket_case_stage
        self.assertEqual(_bucket_case_stage(MockCase('MATCHING')), 'matching')

    def test_bucket_decision(self):
        from contracts.intelligence_pilot_dashboard import _bucket_case_stage
        self.assertEqual(_bucket_case_stage(MockCase('DECISION')), 'aanbieder_beoordeling')

    def test_bucket_completed(self):
        from contracts.intelligence_pilot_dashboard import _bucket_case_stage
        self.assertEqual(_bucket_case_stage(MockCase('COMPLETED')), 'plaatsing')

    def test_bucket_on_hold(self):
        from contracts.intelligence_pilot_dashboard import _bucket_case_stage
        self.assertEqual(_bucket_case_stage(MockCase('ON_HOLD')), 'on_hold')

    def test_bucket_unknown(self):
        from contracts.intelligence_pilot_dashboard import _bucket_case_stage
        self.assertEqual(_bucket_case_stage(MockCase('UNKNOWN')), 'casus')


# ---------------------------------------------------------------------------
# build_pilot_dashboard — structure
# ---------------------------------------------------------------------------

class BuildPilotDashboardStructureTests(unittest.TestCase):
    def _build(self, **kwargs):
        from contracts.intelligence_pilot_dashboard import build_pilot_dashboard
        defaults = dict(cases=[], alerts=[], placements=[], baseline=None)
        defaults.update(kwargs)
        return build_pilot_dashboard(**defaults)

    def test_empty_inputs_returns_valid_dict(self):
        r = self._build()
        for key in ('status', 'hero_metrics', 'kpi_cards', 'flow', 'issues',
                    'intelligence', 'recommendation', 'totals'):
            self.assertIn(key, r)

    def test_hero_metrics_is_list_of_4(self):
        r = self._build()
        self.assertIsInstance(r['hero_metrics'], list)
        self.assertEqual(len(r['hero_metrics']), 4)

    def test_kpi_cards_is_list_of_5(self):
        r = self._build()
        self.assertEqual(len(r['kpi_cards']), 5)

    def test_flow_counts_has_5_stages(self):
        r = self._build()
        self.assertEqual(len(r['flow']['counts']), 5)

    def test_intelligence_has_required_keys(self):
        r = self._build()
        for k in ('confidence_alignment', 'high_conf_accepted',
                  'low_conf_rejected', 'avg_confidence'):
            self.assertIn(k, r['intelligence'])

    def test_totals_correct_for_empty(self):
        r = self._build()
        self.assertEqual(r['totals']['cases'], 0)
        self.assertEqual(r['totals']['placements'], 0)
        self.assertEqual(r['totals']['open_alerts'], 0)

    def test_each_hero_metric_has_required_keys(self):
        r = self._build()
        for m in r['hero_metrics']:
            for k in ('label', 'value', 'delta', 'direction'):
                self.assertIn(k, m)

    def test_status_has_required_keys(self):
        r = self._build()
        for k in ('key', 'label', 'tone'):
            self.assertIn(k, r['status'])


# ---------------------------------------------------------------------------
# build_pilot_dashboard — KPI computation
# ---------------------------------------------------------------------------

class BuildPilotDashboardKpiTests(unittest.TestCase):
    def _build(self, **kwargs):
        from contracts.intelligence_pilot_dashboard import build_pilot_dashboard
        defaults = dict(cases=[], alerts=[], placements=[], baseline=None)
        defaults.update(kwargs)
        return build_pilot_dashboard(**defaults)

    def test_acceptance_rate_computed(self):
        placements = [
            MockPlacement(provider_response_status='ACCEPTED'),
            MockPlacement(provider_response_status='ACCEPTED'),
            MockPlacement(provider_response_status='REJECTED'),
        ]
        r = self._build(placements=placements)
        accepted_card = next(c for c in r['kpi_cards'] if 'acceptatie' in c['label'].lower())
        # 2/3 ≈ 66.7%
        self.assertEqual(accepted_card['value'], '66.7%')

    def test_placement_success_rate_computed(self):
        placements = [
            MockPlacement(placement_quality_status='GOOD_FIT'),
            MockPlacement(placement_quality_status='AT_RISK'),
        ]
        r = self._build(placements=placements)
        quality_card = next(c for c in r['kpi_cards'] if 'kwaliteit' in c['label'].lower())
        self.assertEqual(quality_card['value'], '50.0%')

    def test_stuck_cases_from_on_hold(self):
        cases = [MockCase('ON_HOLD'), MockCase('ON_HOLD'), MockCase('INTAKE')]
        r = self._build(cases=cases)
        stuck_card = next(c for c in r['kpi_cards'] if 'vastgelopen' in c['label'].lower())
        self.assertEqual(stuck_card['value'], '2')

    def test_intake_started_share(self):
        cases = [
            MockCase('MATCHING'),
            MockCase('COMPLETED'),
            MockCase('INTAKE'),
            MockCase('INTAKE'),
        ]
        r = self._build(cases=cases)
        intake_card = next(c for c in r['kpi_cards'] if 'intake' in c['label'].lower())
        # 2/4 = 50%
        self.assertEqual(intake_card['value'], '50.0%')

    def test_weak_match_share_from_confidence(self):
        from contracts.intelligence_pilot_dashboard import LOW_CONFIDENCE_THRESHOLD
        placements = [
            MockPlacement(predicted_confidence=LOW_CONFIDENCE_THRESHOLD - 0.01),
            MockPlacement(predicted_confidence=0.9),
            MockPlacement(predicted_confidence=0.85),
        ]
        r = self._build(placements=placements)
        weak_card = next(c for c in r['kpi_cards'] if 'zwakke' in c['label'].lower())
        self.assertEqual(weak_card['value'], '33.3%')

    def test_nvt_for_empty_placements(self):
        r = self._build(placements=[])
        for card in r['kpi_cards']:
            if 'acceptatie' in card['label'].lower() or 'kwaliteit' in card['label'].lower():
                self.assertEqual(card['value'], 'n.v.t.')


# ---------------------------------------------------------------------------
# build_pilot_dashboard — baseline deltas
# ---------------------------------------------------------------------------

class BuildPilotDashboardDeltaTests(unittest.TestCase):
    def _build(self, **kwargs):
        from contracts.intelligence_pilot_dashboard import build_pilot_dashboard
        defaults = dict(cases=[], alerts=[], placements=[], baseline=None)
        defaults.update(kwargs)
        return build_pilot_dashboard(**defaults)

    def test_positive_acceptance_delta_direction_up(self):
        placements = [MockPlacement(provider_response_status='ACCEPTED') for _ in range(7)]
        placements += [MockPlacement(provider_response_status='REJECTED') for _ in range(3)]
        # acceptance = 70%; baseline = 55% → delta = +15pp → direction up
        r = self._build(
            placements=placements,
            baseline={'acceptance_rate': 55.0},
        )
        hero = next(m for m in r['hero_metrics'] if 'acceptatie' in m['label'].lower())
        self.assertEqual(hero['direction'], 'up')
        self.assertIn('+', hero['delta'])

    def test_negative_acceptance_delta_direction_down(self):
        placements = [MockPlacement(provider_response_status='ACCEPTED') for _ in range(3)]
        placements += [MockPlacement(provider_response_status='REJECTED') for _ in range(7)]
        # acceptance = 30%; baseline = 55% → delta = -25pp → direction down
        r = self._build(
            placements=placements,
            baseline={'acceptance_rate': 55.0},
        )
        hero = next(m for m in r['hero_metrics'] if 'acceptatie' in m['label'].lower())
        self.assertEqual(hero['direction'], 'down')

    def test_weak_match_decrease_is_up(self):
        # weak match went down (fewer weak matches) → direction should be 'up' (inverse_good)
        from contracts.intelligence_pilot_dashboard import LOW_CONFIDENCE_THRESHOLD
        placements = [
            MockPlacement(predicted_confidence=0.9),
            MockPlacement(predicted_confidence=0.9),
        ]
        r = self._build(
            placements=placements,
            baseline={'weak_match_share': 50.0},
        )
        hero = next(m for m in r['hero_metrics'] if 'zwakke' in m['label'].lower())
        self.assertEqual(hero['direction'], 'up')

    def test_no_baseline_gives_nvt_delta(self):
        placements = [MockPlacement(provider_response_status='ACCEPTED')]
        r = self._build(placements=placements, baseline={})
        hero = next(m for m in r['hero_metrics'] if 'acceptatie' in m['label'].lower())
        self.assertEqual(hero['delta'], 'n.v.t.')


# ---------------------------------------------------------------------------
# build_pilot_dashboard — flow counting
# ---------------------------------------------------------------------------

class BuildPilotDashboardFlowTests(unittest.TestCase):
    def _build(self, **kwargs):
        from contracts.intelligence_pilot_dashboard import build_pilot_dashboard
        defaults = dict(cases=[], alerts=[], placements=[], baseline=None)
        defaults.update(kwargs)
        return build_pilot_dashboard(**defaults)

    def test_flow_counts_all_stages(self):
        cases = [
            MockCase('INTAKE'),
            MockCase('MATCHING'),
            MockCase('MATCHING'),
            MockCase('DECISION'),
            MockCase('COMPLETED'),
        ]
        r = self._build(cases=cases)
        counts = {s['key']: s['count'] for s in r['flow']['counts']}
        self.assertEqual(counts['intake'], 1)
        self.assertEqual(counts['matching'], 2)
        self.assertEqual(counts['aanbieder_beoordeling'], 1)
        self.assertEqual(counts['plaatsing'], 1)

    def test_bottleneck_is_stage_with_most_cases(self):
        cases = [MockCase('MATCHING') for _ in range(5)] + [MockCase('INTAKE')]
        r = self._build(cases=cases)
        self.assertEqual(r['flow']['bottleneck'], 'matching')

    def test_bottleneck_none_when_no_cases(self):
        r = self._build(cases=[])
        self.assertIsNone(r['flow']['bottleneck'])

    def test_bottleneck_label_present_when_bottleneck(self):
        cases = [MockCase('INTAKE') for _ in range(3)]
        r = self._build(cases=cases)
        self.assertEqual(r['flow']['bottleneck_label'], 'Intake')


# ---------------------------------------------------------------------------
# build_pilot_dashboard — intelligence panel
# ---------------------------------------------------------------------------

class BuildPilotDashboardIntelligenceTests(unittest.TestCase):
    def _build(self, **kwargs):
        from contracts.intelligence_pilot_dashboard import build_pilot_dashboard
        from contracts.intelligence_pilot_dashboard import HIGH_CONFIDENCE_THRESHOLD, LOW_CONFIDENCE_THRESHOLD
        defaults = dict(cases=[], alerts=[], placements=[], baseline=None)
        defaults.update(kwargs)
        return build_pilot_dashboard(**defaults)

    def test_high_conf_accepted_computed(self):
        from contracts.intelligence_pilot_dashboard import HIGH_CONFIDENCE_THRESHOLD
        placements = [
            MockPlacement(predicted_confidence=HIGH_CONFIDENCE_THRESHOLD + 0.05, provider_response_status='ACCEPTED'),
            MockPlacement(predicted_confidence=HIGH_CONFIDENCE_THRESHOLD + 0.05, provider_response_status='ACCEPTED'),
            MockPlacement(predicted_confidence=HIGH_CONFIDENCE_THRESHOLD + 0.05, provider_response_status='REJECTED'),
        ]
        r = self._build(placements=placements)
        # 2 high-conf accepted out of 3 high-conf → 66.7%
        self.assertEqual(r['intelligence']['high_conf_accepted'], '66.7%')

    def test_low_conf_rejected_computed(self):
        from contracts.intelligence_pilot_dashboard import LOW_CONFIDENCE_THRESHOLD
        placements = [
            MockPlacement(predicted_confidence=LOW_CONFIDENCE_THRESHOLD - 0.1, provider_response_status='REJECTED'),
            MockPlacement(predicted_confidence=LOW_CONFIDENCE_THRESHOLD - 0.1, provider_response_status='ACCEPTED'),
        ]
        r = self._build(placements=placements)
        self.assertEqual(r['intelligence']['low_conf_rejected'], '50.0%')

    def test_nvt_when_no_confidence_data(self):
        placements = [MockPlacement(predicted_confidence=None)]
        r = self._build(placements=placements)
        self.assertEqual(r['intelligence']['avg_confidence'], 'n.v.t.')

    def test_avg_confidence_computed(self):
        placements = [
            MockPlacement(predicted_confidence=0.60),
            MockPlacement(predicted_confidence=0.80),
        ]
        r = self._build(placements=placements)
        self.assertEqual(r['intelligence']['avg_confidence'], '70.0%')


# ---------------------------------------------------------------------------
# Sparse / edge data
# ---------------------------------------------------------------------------

class SparseDataTests(unittest.TestCase):
    def _build(self, **kwargs):
        from contracts.intelligence_pilot_dashboard import build_pilot_dashboard
        defaults = dict(cases=[], alerts=[], placements=[], baseline=None)
        defaults.update(kwargs)
        return build_pilot_dashboard(**defaults)

    def test_none_fields_on_placement(self):
        class NullPlacement:
            provider_response_status = None
            placement_quality_status = None
            predicted_confidence = None

        r = self._build(placements=[NullPlacement()])
        self.assertEqual(r['totals']['placements'], 1)
        self.assertEqual(r['intelligence']['avg_confidence'], 'n.v.t.')

    def test_none_fields_on_case(self):
        class NullCase:
            status = None

        r = self._build(cases=[NullCase()])
        self.assertEqual(r['totals']['cases'], 1)

    def test_none_alert_type(self):
        class NullAlert:
            alert_type = None

        r = self._build(alerts=[NullAlert()])
        # Should not raise; empty string is counted
        self.assertEqual(r['totals']['open_alerts'], 1)

    def test_all_pending_placements_acceptance_nvt(self):
        placements = [MockPlacement(provider_response_status='PENDING') for _ in range(5)]
        r = self._build(placements=placements)
        hero = next(m for m in r['hero_metrics'] if 'acceptatie' in m['label'].lower())
        self.assertEqual(hero['value'], 'n.v.t.')

    def test_single_case_single_placement(self):
        r = self._build(
            cases=[MockCase('MATCHING')],
            placements=[MockPlacement()],
            alerts=[MockAlert()],
        )
        self.assertEqual(r['totals']['cases'], 1)
        self.assertEqual(r['totals']['placements'], 1)
        self.assertEqual(r['totals']['open_alerts'], 1)


if __name__ == '__main__':
    unittest.main()
