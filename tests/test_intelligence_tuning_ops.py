"""
Unit tests for contracts/intelligence_tuning_ops.py

Pure Python — no database, no Django ORM.

Tests cover:
- risk_level_for_proposal()  — LOW/HIGH classification
- score_proposal_priority()  — 0–1 score, weighted formula
- group_key_for_proposal()   — deterministic key generation
- deduplicate_proposals()    — keeps highest-priority per group
- detect_stale_proposals()   — stale detection by updated_at age
- compute_post_impact()      — pre/post outcome comparison
- enrich_proposals()         — batch enrichment
- transition_proposal() sets implemented_at (integration with tuning.py)
"""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# Minimal mock TuningProposal
# ---------------------------------------------------------------------------

class _StatusChoices:
    SUGGESTED = 'SUGGESTED'
    REVIEWED = 'REVIEWED'
    APPROVED = 'APPROVED'
    REJECTED = 'REJECTED'
    IMPLEMENTED = 'IMPLEMENTED'
    choices = [
        ('SUGGESTED', 'Voorgesteld'),
        ('REVIEWED', 'Beoordeeld'),
        ('APPROVED', 'Goedgekeurd'),
        ('REJECTED', 'Afgewezen'),
        ('IMPLEMENTED', 'Geïmplementeerd'),
    ]


class MockProposal:
    """Lightweight TuningProposal stub."""

    Status = _StatusChoices

    _ALLOWED_TRANSITIONS = {
        _StatusChoices.SUGGESTED: {_StatusChoices.REVIEWED, _StatusChoices.REJECTED},
        _StatusChoices.REVIEWED: {_StatusChoices.APPROVED, _StatusChoices.REJECTED},
        _StatusChoices.APPROVED: {_StatusChoices.IMPLEMENTED, _StatusChoices.REJECTED},
        _StatusChoices.REJECTED: set(),
        _StatusChoices.IMPLEMENTED: set(),
    }

    def __init__(self, **kwargs):
        self.pk = kwargs.get('pk', 1)
        self.organization = kwargs.get('organization')
        self.status = kwargs.get('status', 'SUGGESTED')
        self.source = kwargs.get('source', 'manual')
        self.factor_type = kwargs.get('factor_type', 'OTHER')
        self.affected_care_category = kwargs.get('affected_care_category')
        self.affected_provider = kwargs.get('affected_provider')
        self.detected_issue = kwargs.get('detected_issue', '')
        self.recommendation = kwargs.get('recommendation', '')
        self.proposed_delta = kwargs.get('proposed_delta')
        self.rationale = kwargs.get('rationale', '')
        self.severity = kwargs.get('severity')
        self.sample_count = kwargs.get('sample_count')
        self.priority_score = kwargs.get('priority_score')
        self.risk_level = kwargs.get('risk_level')
        self.group_key = kwargs.get('group_key', '')
        self.post_impact = kwargs.get('post_impact')
        self.implemented_at = kwargs.get('implemented_at')
        self.simulation_before = kwargs.get('simulation_before')
        self.simulation_after = kwargs.get('simulation_after')
        self.created_by = kwargs.get('created_by')
        self.reviewed_by = kwargs.get('reviewed_by')
        self.reviewed_at = kwargs.get('reviewed_at')
        self.review_note = kwargs.get('review_note', '')
        # Use created_at as fallback for updated_at
        _now = datetime.now(tz=timezone.utc)
        self.created_at = kwargs.get('created_at', _now)
        self.updated_at = kwargs.get('updated_at', _now)
        self._saved = False

    def can_transition_to(self, new_status):
        return new_status in self._ALLOWED_TRANSITIONS.get(self.status, set())

    def save(self):
        self._saved = True

    def get_status_display(self):
        for val, label in _StatusChoices.choices:
            if val == self.status:
                return label
        return self.status


def _cat(name='Jeugd'):
    c = MagicMock()
    c.name = name
    return c


def _prov(pk=10, name='Aanbieder X'):
    p = MagicMock()
    p.pk = pk
    p.name = name
    return p


def _row(conf=0.70, status='ACCEPTED', category='Jeugd', provider_id=1):
    return {
        'predicted_confidence': conf,
        'provider_response_status': status,
        'due_diligence_process__care_category_main__name': category,
        'selected_provider_id': provider_id,
    }


# ---------------------------------------------------------------------------
# risk_level_for_proposal
# ---------------------------------------------------------------------------

class RiskLevelTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_ops import risk_level_for_proposal
        self.risk_level = risk_level_for_proposal

    def test_small_delta_no_provider_is_low_risk(self):
        p = MockProposal(proposed_delta=0.10)
        self.assertEqual(self.risk_level(p), 'LOW')

    def test_large_positive_delta_is_high_risk(self):
        p = MockProposal(proposed_delta=0.20)
        self.assertEqual(self.risk_level(p), 'HIGH')

    def test_large_negative_delta_is_high_risk(self):
        p = MockProposal(proposed_delta=-0.20)
        self.assertEqual(self.risk_level(p), 'HIGH')

    def test_exactly_at_threshold_is_low(self):
        p = MockProposal(proposed_delta=0.15)
        # |0.15| is NOT > 0.15, so LOW
        self.assertEqual(self.risk_level(p), 'LOW')

    def test_just_above_threshold_is_high(self):
        p = MockProposal(proposed_delta=0.16)
        self.assertEqual(self.risk_level(p), 'HIGH')

    def test_provider_scoped_is_always_high(self):
        p = MockProposal(proposed_delta=0.05, affected_provider=_prov())
        self.assertEqual(self.risk_level(p), 'HIGH')

    def test_none_delta_is_low_without_provider(self):
        p = MockProposal(proposed_delta=None)
        self.assertEqual(self.risk_level(p), 'LOW')

    def test_zero_delta_no_provider_is_low(self):
        p = MockProposal(proposed_delta=0.0)
        self.assertEqual(self.risk_level(p), 'LOW')

    def test_provider_and_small_delta_is_still_high(self):
        p = MockProposal(proposed_delta=0.01, affected_provider=_prov())
        self.assertEqual(self.risk_level(p), 'HIGH')


# ---------------------------------------------------------------------------
# score_proposal_priority
# ---------------------------------------------------------------------------

class ScoreProposalPriorityTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_ops import score_proposal_priority
        self.score = score_proposal_priority

    def test_returns_float_between_0_and_1(self):
        p = MockProposal(severity='HIGH', sample_count=50, proposed_delta=0.30)
        s = self.score(p)
        self.assertGreaterEqual(s, 0.0)
        self.assertLessEqual(s, 1.0)

    def test_high_severity_scores_higher_than_low(self):
        p_high = MockProposal(severity='HIGH', sample_count=10, proposed_delta=0.10)
        p_low = MockProposal(severity='LOW', sample_count=10, proposed_delta=0.10)
        self.assertGreater(self.score(p_high), self.score(p_low))

    def test_large_sample_count_scores_higher(self):
        p_big = MockProposal(severity='MEDIUM', sample_count=50, proposed_delta=0.10)
        p_small = MockProposal(severity='MEDIUM', sample_count=5, proposed_delta=0.10)
        self.assertGreater(self.score(p_big), self.score(p_small))

    def test_large_delta_scores_higher(self):
        p_large = MockProposal(severity='MEDIUM', sample_count=10, proposed_delta=0.30)
        p_small = MockProposal(severity='MEDIUM', sample_count=10, proposed_delta=0.05)
        self.assertGreater(self.score(p_large), self.score(p_small))

    def test_none_severity_does_not_crash(self):
        p = MockProposal(severity=None, sample_count=None, proposed_delta=None)
        s = self.score(p)
        self.assertGreaterEqual(s, 0.0)

    def test_zero_everything_returns_low_score(self):
        p = MockProposal(severity=None, sample_count=0, proposed_delta=0.0)
        s = self.score(p)
        # severity=None→0.2, volume=0, delta=0 → 0.2*0.5 = 0.10
        self.assertAlmostEqual(s, 0.10, places=4)

    def test_capped_at_1_for_extreme_values(self):
        p = MockProposal(severity='HIGH', sample_count=1000, proposed_delta=99.0)
        s = self.score(p)
        self.assertLessEqual(s, 1.0)

    def test_score_is_deterministic(self):
        p = MockProposal(severity='HIGH', sample_count=20, proposed_delta=0.20)
        self.assertEqual(self.score(p), self.score(p))

    def test_volume_capped_at_reference(self):
        p_ref = MockProposal(severity='LOW', sample_count=50, proposed_delta=0.0)
        p_excess = MockProposal(severity='LOW', sample_count=500, proposed_delta=0.0)
        # Both should score the same because volume is capped at 50
        self.assertAlmostEqual(self.score(p_ref), self.score(p_excess), places=4)


# ---------------------------------------------------------------------------
# group_key_for_proposal
# ---------------------------------------------------------------------------

class GroupKeyTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_ops import group_key_for_proposal
        self.key = group_key_for_proposal

    def test_key_includes_source_and_factor(self):
        p = MockProposal(source='high_conf_low_accept', factor_type='SPECIALIZATION_WEIGHT')
        k = self.key(p)
        self.assertIn('high_conf_low_accept', k)
        self.assertIn('SPECIALIZATION_WEIGHT', k)

    def test_global_scope_when_no_scope(self):
        p = MockProposal(source='s', factor_type='f')
        self.assertIn('global', self.key(p))

    def test_category_scope_in_key(self):
        p = MockProposal(source='s', factor_type='f', affected_care_category=_cat('Jeugd'))
        self.assertIn('cat:jeugd', self.key(p))

    def test_provider_scope_in_key(self):
        p = MockProposal(source='s', factor_type='f', affected_provider=_prov(pk=42))
        self.assertIn('prov:42', self.key(p))

    def test_both_category_and_provider_in_key(self):
        p = MockProposal(
            source='s', factor_type='f',
            affected_care_category=_cat('WMO'),
            affected_provider=_prov(pk=7),
        )
        k = self.key(p)
        self.assertIn('cat:wmo', k)
        self.assertIn('prov:7', k)

    def test_key_is_deterministic(self):
        p1 = MockProposal(source='drift', factor_type='REGION_WEIGHT',
                          affected_care_category=_cat('Jeugd'))
        p2 = MockProposal(source='drift', factor_type='REGION_WEIGHT',
                          affected_care_category=_cat('Jeugd'))
        self.assertEqual(self.key(p1), self.key(p2))

    def test_different_sources_produce_different_keys(self):
        p1 = MockProposal(source='source_a', factor_type='OTHER')
        p2 = MockProposal(source='source_b', factor_type='OTHER')
        self.assertNotEqual(self.key(p1), self.key(p2))

    def test_different_factors_produce_different_keys(self):
        p1 = MockProposal(source='s', factor_type='REGION_WEIGHT')
        p2 = MockProposal(source='s', factor_type='SPECIALIZATION_WEIGHT')
        self.assertNotEqual(self.key(p1), self.key(p2))


# ---------------------------------------------------------------------------
# deduplicate_proposals
# ---------------------------------------------------------------------------

class DeduplicateProposalsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_ops import deduplicate_proposals
        self.dedup = deduplicate_proposals

    def test_empty_input_returns_empty(self):
        self.assertEqual(self.dedup([]), [])

    def test_single_proposal_returned_unchanged(self):
        p = MockProposal(group_key='a|b|global', priority_score=0.5)
        result = self.dedup([p])
        self.assertEqual(len(result), 1)
        self.assertIs(result[0], p)

    def test_different_group_keys_all_kept(self):
        p1 = MockProposal(pk=1, group_key='a|b|global', priority_score=0.5)
        p2 = MockProposal(pk=2, group_key='c|d|global', priority_score=0.5)
        result = self.dedup([p1, p2])
        self.assertEqual(len(result), 2)

    def test_duplicate_key_keeps_higher_priority(self):
        p_low = MockProposal(pk=1, group_key='a|b|global', priority_score=0.3)
        p_high = MockProposal(pk=2, group_key='a|b|global', priority_score=0.8)
        result = self.dedup([p_low, p_high])
        self.assertEqual(len(result), 1)
        self.assertIs(result[0], p_high)

    def test_result_sorted_by_priority_desc(self):
        p1 = MockProposal(pk=1, group_key='k1', priority_score=0.2)
        p2 = MockProposal(pk=2, group_key='k2', priority_score=0.9)
        p3 = MockProposal(pk=3, group_key='k3', priority_score=0.5)
        result = self.dedup([p1, p2, p3])
        scores = [getattr(r, 'priority_score', 0) for r in result]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_proposals_without_group_key_computed_on_fly(self):
        p = MockProposal(pk=1, group_key='', source='s', factor_type='OTHER')
        result = self.dedup([p])
        self.assertEqual(len(result), 1)

    def test_proposals_without_priority_score_scored_on_fly(self):
        p = MockProposal(pk=1, group_key='k1', priority_score=None,
                         severity='HIGH', sample_count=10, proposed_delta=0.10)
        result = self.dedup([p])
        self.assertEqual(len(result), 1)


# ---------------------------------------------------------------------------
# detect_stale_proposals
# ---------------------------------------------------------------------------

class DetectStaleProposalsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_ops import detect_stale_proposals
        self.detect = detect_stale_proposals

    def _ago(self, days):
        return datetime.now(tz=timezone.utc) - timedelta(days=days)

    def test_empty_input_returns_empty(self):
        self.assertEqual(self.detect([]), [])

    def test_recent_suggested_not_stale(self):
        p = MockProposal(status='SUGGESTED', updated_at=self._ago(5))
        self.assertEqual(self.detect([p]), [])

    def test_old_suggested_is_stale(self):
        p = MockProposal(status='SUGGESTED', updated_at=self._ago(31))
        result = self.detect([p])
        self.assertEqual(len(result), 1)
        self.assertIs(result[0], p)

    def test_old_reviewed_is_stale(self):
        p = MockProposal(status='REVIEWED', updated_at=self._ago(35))
        result = self.detect([p])
        self.assertEqual(len(result), 1)

    def test_approved_is_never_stale(self):
        p = MockProposal(status='APPROVED', updated_at=self._ago(60))
        self.assertEqual(self.detect([p]), [])

    def test_rejected_is_never_stale(self):
        p = MockProposal(status='REJECTED', updated_at=self._ago(60))
        self.assertEqual(self.detect([p]), [])

    def test_implemented_is_never_stale(self):
        p = MockProposal(status='IMPLEMENTED', updated_at=self._ago(60))
        self.assertEqual(self.detect([p]), [])

    def test_custom_threshold(self):
        p = MockProposal(status='SUGGESTED', updated_at=self._ago(8))
        # stale at 7 days
        result = self.detect([p], days=7)
        self.assertEqual(len(result), 1)
        # not stale at 10 days
        result2 = self.detect([p], days=10)
        self.assertEqual(result2, [])

    def test_sorted_oldest_first(self):
        p_old = MockProposal(pk=1, status='SUGGESTED', updated_at=self._ago(60))
        p_mid = MockProposal(pk=2, status='SUGGESTED', updated_at=self._ago(45))
        p_new = MockProposal(pk=3, status='SUGGESTED', updated_at=self._ago(35))
        result = self.detect([p_mid, p_new, p_old])
        self.assertEqual([r.pk for r in result], [1, 2, 3])

    def test_proposal_without_updated_at_uses_created_at(self):
        p = MockProposal(status='SUGGESTED')
        p.updated_at = None
        p.created_at = self._ago(40)
        result = self.detect([p])
        self.assertEqual(len(result), 1)

    def test_proposal_without_any_timestamp_considered_stale(self):
        p = MockProposal(status='SUGGESTED')
        p.updated_at = None
        p.created_at = None
        result = self.detect([p])
        self.assertEqual(len(result), 1)

    def test_naive_datetime_handled_gracefully(self):
        naive_dt = datetime.utcnow() - timedelta(days=40)
        p = MockProposal(status='SUGGESTED', updated_at=naive_dt)
        # Should not raise
        result = self.detect([p])
        self.assertEqual(len(result), 1)


# ---------------------------------------------------------------------------
# compute_post_impact
# ---------------------------------------------------------------------------

class ComputePostImpactTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_ops import compute_post_impact
        self.compute = compute_post_impact

    def _proposal(self, category=None, provider=None):
        p = MockProposal()
        p.affected_care_category = _cat(category) if category else None
        p.affected_provider = provider
        return p

    def test_empty_rows_returns_none_stats(self):
        p = self._proposal()
        result = self.compute(p, [], [])
        self.assertIsNone(result['before_mean_confidence'])
        self.assertIsNone(result['after_mean_confidence'])
        self.assertEqual(result['before_count'], 0)
        self.assertEqual(result['after_count'], 0)

    def test_computes_mean_confidence_correctly(self):
        p = self._proposal()
        before = [_row(conf=0.60), _row(conf=0.80)]
        after = [_row(conf=0.70), _row(conf=0.90)]
        result = self.compute(p, before, after)
        self.assertAlmostEqual(result['before_mean_confidence'], 0.70, places=2)
        self.assertAlmostEqual(result['after_mean_confidence'], 0.80, places=2)

    def test_computes_acceptance_rate(self):
        p = self._proposal()
        before = [_row(status='ACCEPTED'), _row(status='DECLINED')]
        after = [_row(status='ACCEPTED'), _row(status='ACCEPTED')]
        result = self.compute(p, before, after)
        self.assertAlmostEqual(result['before_acceptance_rate'], 0.50, places=2)
        self.assertAlmostEqual(result['after_acceptance_rate'], 1.00, places=2)

    def test_delta_confidence_computed(self):
        p = self._proposal()
        before = [_row(conf=0.60)]
        after = [_row(conf=0.70)]
        result = self.compute(p, before, after)
        self.assertAlmostEqual(result['delta_confidence_observed'], 0.10, places=4)

    def test_delta_acceptance_computed(self):
        p = self._proposal()
        before = [_row(status='ACCEPTED'), _row(status='DECLINED')]  # 0.50
        after = [_row(status='ACCEPTED')]  # 1.00
        result = self.compute(p, before, after)
        self.assertAlmostEqual(result['delta_acceptance_observed'], 0.50, places=4)

    def test_scope_filters_by_category(self):
        p = self._proposal(category='Jeugd')
        before = [_row(conf=0.60, category='Jeugd'), _row(conf=0.90, category='WMO')]
        after = [_row(conf=0.70, category='Jeugd')]
        result = self.compute(p, before, after)
        # Only Jeugd rows counted
        self.assertEqual(result['before_count'], 1)
        self.assertAlmostEqual(result['before_mean_confidence'], 0.60, places=2)

    def test_in_scope_true_when_matching_rows_found(self):
        p = self._proposal(category='Jeugd')
        rows = [_row(category='Jeugd')]
        result = self.compute(p, rows, rows)
        self.assertTrue(result['in_scope'])

    def test_in_scope_false_when_no_matching_rows(self):
        p = self._proposal(category='Jeugd')
        rows = [_row(category='WMO')]  # no Jeugd rows
        result = self.compute(p, rows, rows)
        self.assertFalse(result['in_scope'])

    def test_delta_none_when_one_side_empty(self):
        p = self._proposal()
        before = [_row(conf=0.70)]
        result = self.compute(p, before, [])
        self.assertIsNone(result['delta_confidence_observed'])

    def test_scope_description_includes_category(self):
        p = self._proposal(category='Jeugd')
        result = self.compute(p, [], [])
        self.assertIn('jeugd', result['scope_description'].lower())

    def test_scope_description_full_dataset_without_scope(self):
        p = self._proposal()
        result = self.compute(p, [], [])
        self.assertIn('Volledige dataset', result['scope_description'])

    def test_rows_with_none_confidence_excluded_from_mean(self):
        p = self._proposal()
        before = [
            {'predicted_confidence': None, 'provider_response_status': 'ACCEPTED',
             'due_diligence_process__care_category_main__name': '', 'selected_provider_id': 1},
            _row(conf=0.80),
        ]
        result = self.compute(p, before, [])
        self.assertAlmostEqual(result['before_mean_confidence'], 0.80, places=2)


# ---------------------------------------------------------------------------
# enrich_proposals
# ---------------------------------------------------------------------------

class EnrichProposalsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_ops import enrich_proposals
        self.enrich = enrich_proposals

    def test_sets_priority_score_when_none(self):
        p = MockProposal(priority_score=None, severity='HIGH')
        self.enrich([p])
        self.assertIsNotNone(p.priority_score)

    def test_does_not_overwrite_existing_priority_score(self):
        p = MockProposal(priority_score=0.99)
        self.enrich([p])
        self.assertAlmostEqual(p.priority_score, 0.99, places=4)

    def test_sets_risk_level_when_none(self):
        p = MockProposal(risk_level=None, proposed_delta=0.05)
        self.enrich([p])
        self.assertIn(p.risk_level, ('LOW', 'HIGH'))

    def test_sets_group_key_when_empty(self):
        p = MockProposal(group_key='', source='s', factor_type='OTHER')
        self.enrich([p])
        self.assertNotEqual(p.group_key, '')

    def test_does_not_overwrite_existing_group_key(self):
        p = MockProposal(group_key='existing|key|global')
        self.enrich([p])
        self.assertEqual(p.group_key, 'existing|key|global')

    def test_returns_same_list(self):
        proposals = [MockProposal(), MockProposal()]
        result = self.enrich(proposals)
        self.assertIs(result, proposals)

    def test_empty_list_returns_empty(self):
        self.assertEqual(self.enrich([]), [])


# ---------------------------------------------------------------------------
# transition_proposal sets implemented_at
# ---------------------------------------------------------------------------

class ImplementedAtTransitionTest(unittest.TestCase):
    def test_implemented_at_set_on_implemented_transition(self):
        from contracts.intelligence_tuning import transition_proposal
        p = MockProposal(status='APPROVED')
        actor = MagicMock()
        transition_proposal(p, 'IMPLEMENTED', actor)
        self.assertIsNotNone(p.implemented_at)
        self.assertIsInstance(p.implemented_at, datetime)

    def test_implemented_at_not_set_for_other_transitions(self):
        from contracts.intelligence_tuning import transition_proposal
        p = MockProposal(status='SUGGESTED')
        actor = MagicMock()
        p.implemented_at = None
        transition_proposal(p, 'REVIEWED', actor)
        self.assertIsNone(p.implemented_at)


if __name__ == '__main__':
    unittest.main()
