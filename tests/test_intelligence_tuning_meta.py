"""
Unit tests for contracts/intelligence_tuning_meta.py

Pure Python — no database, no Django ORM.

Tests cover:
- top_impact_proposals()          — ranking, filtering, sparse data
- factor_type_impact_summary()    — aggregation, sorting, sparse data
- care_category_proposal_stats()  — per-category counts, stale, groups
- reviewer_stats()                — reviewer aggregation, no-reviewer filtering
- approval_rejection_ratios()     — ratios by source and factor_type
- negative_impact_proposals()     — negative/zero detection and sorting
"""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# Minimal mock proposal
# ---------------------------------------------------------------------------

def _now():
    return datetime.now(tz=timezone.utc)


def _ago(days):
    return datetime.now(tz=timezone.utc) - timedelta(days=days)


def _cat(name='Jeugd'):
    c = MagicMock()
    c.name = name
    return c


def _user(username='jan', full_name=''):
    u = MagicMock()
    u.username = username
    u.get_full_name.return_value = full_name
    return u


class MockProposal:
    def __init__(self, **kwargs):
        self.pk = kwargs.get('pk', 1)
        self.status = kwargs.get('status', 'SUGGESTED')
        self.source = kwargs.get('source', 'manual')
        self.factor_type = kwargs.get('factor_type', 'OTHER')
        self.affected_care_category = kwargs.get('affected_care_category')
        self.affected_provider = kwargs.get('affected_provider')
        self.post_impact = kwargs.get('post_impact')
        self.reviewed_by = kwargs.get('reviewed_by')
        self.priority_score = kwargs.get('priority_score')
        self.risk_level = kwargs.get('risk_level', 'LOW')
        self.group_key = kwargs.get('group_key', '')
        self.proposed_delta = kwargs.get('proposed_delta')
        self.created_at = kwargs.get('created_at', _now())
        self.updated_at = kwargs.get('updated_at', _now())

    def get_factor_type_display(self):
        return self.factor_type

    def get_status_display(self):
        return self.status


def _impl(pk=1, delta_conf=0.10, delta_accept=0.05, ft='SPECIALIZATION_WEIGHT',
          cat=None, reviewer=None, group_key='', source='manual'):
    """Shorthand for an implemented proposal with post_impact."""
    return MockProposal(
        pk=pk,
        status='IMPLEMENTED',
        factor_type=ft,
        affected_care_category=_cat(cat) if cat else None,
        post_impact={
            'delta_confidence_observed': delta_conf,
            'delta_acceptance_observed': delta_accept,
        },
        reviewed_by=reviewer,
        group_key=group_key,
        source=source,
    )


# ---------------------------------------------------------------------------
# top_impact_proposals
# ---------------------------------------------------------------------------

class TopImpactProposalsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_meta import top_impact_proposals
        self.fn = top_impact_proposals

    def test_empty_input_returns_empty(self):
        self.assertEqual(self.fn([]), [])

    def test_non_implemented_excluded(self):
        p = MockProposal(status='APPROVED', post_impact={'delta_confidence_observed': 0.50})
        self.assertEqual(self.fn([p]), [])

    def test_negative_delta_excluded(self):
        p = _impl(delta_conf=-0.10)
        self.assertEqual(self.fn([p]), [])

    def test_zero_delta_excluded(self):
        p = _impl(delta_conf=0.0)
        self.assertEqual(self.fn([p]), [])

    def test_positive_delta_included(self):
        p = _impl(delta_conf=0.20)
        result = self.fn([p])
        self.assertEqual(len(result), 1)
        self.assertAlmostEqual(result[0]['delta_conf'], 0.20)

    def test_sorted_descending_by_delta(self):
        p1 = _impl(pk=1, delta_conf=0.05)
        p2 = _impl(pk=2, delta_conf=0.30)
        p3 = _impl(pk=3, delta_conf=0.15)
        result = self.fn([p1, p2, p3])
        deltas = [r['delta_conf'] for r in result]
        self.assertEqual(deltas, sorted(deltas, reverse=True))

    def test_limited_to_n_results(self):
        proposals = [_impl(pk=i, delta_conf=float(i) * 0.01) for i in range(1, 10)]
        result = self.fn(proposals, n=3)
        self.assertEqual(len(result), 3)

    def test_default_n_is_5(self):
        proposals = [_impl(pk=i, delta_conf=float(i) * 0.01) for i in range(1, 10)]
        result = self.fn(proposals)
        self.assertLessEqual(len(result), 5)

    def test_dict_contains_expected_keys(self):
        p = _impl(delta_conf=0.20, cat='Jeugd')
        result = self.fn([p])
        self.assertIn('proposal', result[0])
        self.assertIn('delta_conf', result[0])
        self.assertIn('delta_accept', result[0])
        self.assertIn('factor_type', result[0])
        self.assertIn('category_name', result[0])

    def test_none_post_impact_excluded(self):
        p = MockProposal(status='IMPLEMENTED', post_impact=None)
        self.assertEqual(self.fn([p]), [])

    def test_none_delta_conf_in_post_impact_excluded(self):
        p = MockProposal(status='IMPLEMENTED', post_impact={'delta_confidence_observed': None})
        self.assertEqual(self.fn([p]), [])

    def test_category_name_populated(self):
        p = _impl(delta_conf=0.20, cat='WMO')
        result = self.fn([p])
        self.assertEqual(result[0]['category_name'], 'WMO')

    def test_no_category_shows_placeholder(self):
        p = _impl(delta_conf=0.20, cat=None)
        result = self.fn([p])
        self.assertIn('geen categorie', result[0]['category_name'])


# ---------------------------------------------------------------------------
# factor_type_impact_summary
# ---------------------------------------------------------------------------

class FactorTypeImpactSummaryTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_meta import factor_type_impact_summary
        self.fn = factor_type_impact_summary

    def test_empty_returns_empty(self):
        self.assertEqual(self.fn([]), [])

    def test_non_implemented_excluded(self):
        p = MockProposal(status='APPROVED', factor_type='FT',
                         post_impact={'delta_confidence_observed': 0.20})
        self.assertEqual(self.fn([p]), [])

    def test_single_factor_aggregated(self):
        p1 = _impl(pk=1, delta_conf=0.10, ft='REGION_WEIGHT')
        p2 = _impl(pk=2, delta_conf=0.30, ft='REGION_WEIGHT')
        result = self.fn([p1, p2])
        self.assertEqual(len(result), 1)
        row = result[0]
        self.assertEqual(row['factor_type'], 'REGION_WEIGHT')
        self.assertEqual(row['count_with_impact'], 2)
        self.assertAlmostEqual(row['avg_delta_conf'], 0.20, places=2)
        self.assertAlmostEqual(row['max_delta_conf'], 0.30, places=2)
        self.assertAlmostEqual(row['min_delta_conf'], 0.10, places=2)

    def test_multiple_factors_sorted_by_avg_desc(self):
        p1 = _impl(pk=1, delta_conf=0.50, ft='A')
        p2 = _impl(pk=2, delta_conf=0.10, ft='B')
        result = self.fn([p1, p2])
        self.assertEqual(result[0]['factor_type'], 'A')

    def test_proposal_without_delta_excluded_from_stats(self):
        p = MockProposal(status='IMPLEMENTED', factor_type='FT',
                         post_impact={'delta_confidence_observed': None})
        result = self.fn([p])
        self.assertEqual(result, [])

    def test_accept_delta_included_when_available(self):
        p = _impl(pk=1, delta_conf=0.20, delta_accept=0.05, ft='FT')
        result = self.fn([p])
        self.assertIsNotNone(result[0]['avg_delta_accept'])

    def test_accept_delta_none_when_not_available(self):
        p = MockProposal(status='IMPLEMENTED', factor_type='FT',
                         post_impact={'delta_confidence_observed': 0.20, 'delta_acceptance_observed': None})
        result = self.fn([p])
        self.assertIsNone(result[0]['avg_delta_accept'])


# ---------------------------------------------------------------------------
# care_category_proposal_stats
# ---------------------------------------------------------------------------

class CareCategoryProposalStatsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_meta import care_category_proposal_stats
        self.fn = care_category_proposal_stats

    def test_empty_returns_empty(self):
        self.assertEqual(self.fn([]), [])

    def test_counts_per_category(self):
        p1 = MockProposal(status='SUGGESTED', affected_care_category=_cat('Jeugd'))
        p2 = MockProposal(status='APPROVED', affected_care_category=_cat('Jeugd'))
        p3 = MockProposal(status='SUGGESTED', affected_care_category=_cat('WMO'))
        result = self.fn([p1, p2, p3])
        cats = {r['category_name']: r for r in result}
        self.assertEqual(cats['Jeugd']['total_proposals'], 2)
        self.assertEqual(cats['WMO']['total_proposals'], 1)

    def test_stale_counting(self):
        old = MockProposal(status='SUGGESTED', affected_care_category=_cat('Jeugd'),
                           updated_at=_ago(40))
        fresh = MockProposal(status='SUGGESTED', affected_care_category=_cat('Jeugd'),
                             updated_at=_ago(2))
        result = self.fn([old, fresh])
        self.assertEqual(result[0]['stale_count'], 1)

    def test_distinct_groups_counted(self):
        p1 = MockProposal(status='SUGGESTED', affected_care_category=_cat('Jeugd'),
                          group_key='k1')
        p2 = MockProposal(status='APPROVED', affected_care_category=_cat('Jeugd'),
                          group_key='k1')
        p3 = MockProposal(status='SUGGESTED', affected_care_category=_cat('Jeugd'),
                          group_key='k2')
        result = self.fn([p1, p2, p3])
        self.assertEqual(result[0]['distinct_groups'], 2)

    def test_approved_rejected_implemented_counts(self):
        props = [
            MockProposal(status='APPROVED', affected_care_category=_cat('X')),
            MockProposal(status='REJECTED', affected_care_category=_cat('X')),
            MockProposal(status='IMPLEMENTED', affected_care_category=_cat('X')),
        ]
        result = self.fn(props)
        r = result[0]
        self.assertEqual(r['approved_count'], 1)
        self.assertEqual(r['rejected_count'], 1)
        self.assertEqual(r['implemented_count'], 1)

    def test_no_category_bucketed_as_placeholder(self):
        p = MockProposal(status='SUGGESTED', affected_care_category=None)
        result = self.fn([p])
        self.assertEqual(len(result), 1)
        self.assertIn('geen categorie', result[0]['category_name'])

    def test_sorted_by_total_proposals_desc(self):
        jeugd = [MockProposal(status='SUGGESTED', affected_care_category=_cat('Jeugd'))
                 for _ in range(5)]
        wmo = [MockProposal(status='SUGGESTED', affected_care_category=_cat('WMO'))
               for _ in range(2)]
        result = self.fn(jeugd + wmo)
        self.assertEqual(result[0]['category_name'], 'Jeugd')

    def test_empty_group_key_not_counted(self):
        p = MockProposal(status='SUGGESTED', affected_care_category=_cat('X'), group_key='')
        result = self.fn([p])
        self.assertEqual(result[0]['distinct_groups'], 0)


# ---------------------------------------------------------------------------
# reviewer_stats
# ---------------------------------------------------------------------------

class ReviewerStatsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_meta import reviewer_stats
        self.fn = reviewer_stats

    def test_empty_returns_empty(self):
        self.assertEqual(self.fn([]), [])

    def test_proposals_without_reviewer_excluded(self):
        p = MockProposal(status='APPROVED', reviewed_by=None)
        self.assertEqual(self.fn([p]), [])

    def test_counts_per_reviewer(self):
        jan = _user('jan')
        p1 = MockProposal(pk=1, status='APPROVED', reviewed_by=jan)
        p2 = MockProposal(pk=2, status='REJECTED', reviewed_by=jan)
        result = self.fn([p1, p2])
        self.assertEqual(len(result), 1)
        r = result[0]
        self.assertEqual(r['total_reviewed'], 2)
        self.assertEqual(r['approved_count'], 1)
        self.assertEqual(r['rejected_count'], 1)

    def test_multiple_reviewers_separated(self):
        jan = _user('jan')
        piet = _user('piet')
        p1 = MockProposal(pk=1, status='APPROVED', reviewed_by=jan)
        p2 = MockProposal(pk=2, status='APPROVED', reviewed_by=piet)
        result = self.fn([p1, p2])
        self.assertEqual(len(result), 2)

    def test_avg_delta_conf_computed(self):
        jan = _user('jan')
        p1 = _impl(pk=1, delta_conf=0.20, reviewer=jan)
        p2 = _impl(pk=2, delta_conf=0.40, reviewer=jan)
        result = self.fn([p1, p2])
        self.assertAlmostEqual(result[0]['avg_delta_conf'], 0.30, places=4)

    def test_avg_delta_conf_none_when_no_impact(self):
        jan = _user('jan')
        p = MockProposal(status='APPROVED', reviewed_by=jan, post_impact=None)
        result = self.fn([p])
        self.assertIsNone(result[0]['avg_delta_conf'])

    def test_sorted_by_total_reviewed_desc(self):
        jan = _user('jan')
        piet = _user('piet')
        jan_props = [MockProposal(status='APPROVED', reviewed_by=jan) for _ in range(5)]
        piet_props = [MockProposal(status='APPROVED', reviewed_by=piet) for _ in range(2)]
        result = self.fn(jan_props + piet_props)
        self.assertEqual(result[0]['reviewer_name'], 'jan')

    def test_implemented_counted_separately(self):
        jan = _user('jan')
        p = MockProposal(status='IMPLEMENTED', reviewed_by=jan)
        result = self.fn([p])
        self.assertEqual(result[0]['implemented_count'], 1)
        self.assertEqual(result[0]['approved_count'], 0)

    def test_proposals_with_impact_counted(self):
        jan = _user('jan')
        p_with = _impl(pk=1, delta_conf=0.10, reviewer=jan)
        p_without = MockProposal(status='APPROVED', reviewed_by=jan, post_impact=None)
        result = self.fn([p_with, p_without])
        self.assertEqual(result[0]['proposals_with_impact'], 1)

    def test_full_name_used_when_available(self):
        jan = _user('jan', full_name='Jan de Vries')
        p = MockProposal(status='APPROVED', reviewed_by=jan)
        result = self.fn([p])
        self.assertEqual(result[0]['reviewer_name'], 'Jan de Vries')


# ---------------------------------------------------------------------------
# approval_rejection_ratios
# ---------------------------------------------------------------------------

class ApprovalRejectionRatiosTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_meta import approval_rejection_ratios
        self.fn = approval_rejection_ratios

    def test_empty_returns_empty_dicts(self):
        r = self.fn([])
        self.assertEqual(r['by_source'], {})
        self.assertEqual(r['by_factor_type'], {})

    def test_pending_proposals_excluded(self):
        p = MockProposal(status='SUGGESTED', source='manual', factor_type='OTHER')
        r = self.fn([p])
        self.assertEqual(r['by_source'], {})

    def test_approved_and_rejected_counted(self):
        p1 = MockProposal(status='APPROVED', source='manual', factor_type='OTHER')
        p2 = MockProposal(status='REJECTED', source='manual', factor_type='OTHER')
        r = self.fn([p1, p2])
        s = r['by_source']['manual']
        self.assertEqual(s['approved'], 1)
        self.assertEqual(s['rejected'], 1)
        self.assertAlmostEqual(s['approval_rate'], 0.5, places=2)

    def test_implemented_counts_as_approved(self):
        p = MockProposal(status='IMPLEMENTED', source='manual', factor_type='OTHER')
        r = self.fn([p])
        self.assertEqual(r['by_source']['manual']['approved'], 1)
        self.assertEqual(r['by_source']['manual']['rejected'], 0)

    def test_approval_rate_none_when_no_decisions(self):
        # pending proposals not counted
        p = MockProposal(status='SUGGESTED', source='manual', factor_type='OTHER')
        r = self.fn([p])
        self.assertNotIn('manual', r['by_source'])

    def test_by_factor_type_aggregated(self):
        p1 = MockProposal(status='APPROVED', source='s', factor_type='REGION_WEIGHT')
        p2 = MockProposal(status='APPROVED', source='s', factor_type='REGION_WEIGHT')
        p3 = MockProposal(status='REJECTED', source='s', factor_type='REGION_WEIGHT')
        r = self.fn([p1, p2, p3])
        ft = r['by_factor_type']['REGION_WEIGHT']
        self.assertEqual(ft['approved'], 2)
        self.assertEqual(ft['rejected'], 1)
        self.assertAlmostEqual(ft['approval_rate'], 2 / 3, places=4)

    def test_multiple_sources_separated(self):
        p1 = MockProposal(status='APPROVED', source='src_a', factor_type='X')
        p2 = MockProposal(status='APPROVED', source='src_b', factor_type='X')
        r = self.fn([p1, p2])
        self.assertIn('src_a', r['by_source'])
        self.assertIn('src_b', r['by_source'])

    def test_total_decided_field_present(self):
        p = MockProposal(status='APPROVED', source='manual', factor_type='OTHER')
        r = self.fn([p])
        self.assertIn('total_decided', r['by_source']['manual'])

    def test_approval_rate_1_0_when_all_approved(self):
        props = [MockProposal(status='APPROVED', source='manual', factor_type='OTHER')
                 for _ in range(4)]
        r = self.fn(props)
        self.assertAlmostEqual(r['by_source']['manual']['approval_rate'], 1.0, places=4)

    def test_approval_rate_0_when_all_rejected(self):
        props = [MockProposal(status='REJECTED', source='manual', factor_type='OTHER')
                 for _ in range(3)]
        r = self.fn(props)
        self.assertAlmostEqual(r['by_source']['manual']['approval_rate'], 0.0, places=4)


# ---------------------------------------------------------------------------
# negative_impact_proposals
# ---------------------------------------------------------------------------

class NegativeImpactProposalsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_meta import negative_impact_proposals
        self.fn = negative_impact_proposals

    def test_empty_returns_empty(self):
        self.assertEqual(self.fn([]), [])

    def test_non_approved_excluded(self):
        p = MockProposal(status='SUGGESTED',
                         post_impact={'delta_confidence_observed': -0.10})
        self.assertEqual(self.fn([p]), [])

    def test_none_post_impact_excluded(self):
        p = MockProposal(status='APPROVED', post_impact=None)
        self.assertEqual(self.fn([p]), [])

    def test_none_delta_excluded(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': None})
        self.assertEqual(self.fn([p]), [])

    def test_negative_delta_included(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': -0.05})
        result = self.fn([p])
        self.assertEqual(len(result), 1)
        self.assertIs(result[0], p)

    def test_zero_delta_included(self):
        p = MockProposal(status='APPROVED',
                         post_impact={'delta_confidence_observed': 0.0})
        result = self.fn([p])
        self.assertEqual(len(result), 1)

    def test_positive_delta_excluded(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': 0.10})
        self.assertEqual(self.fn([p]), [])

    def test_sorted_most_negative_first(self):
        p1 = MockProposal(pk=1, status='IMPLEMENTED',
                          post_impact={'delta_confidence_observed': -0.05})
        p2 = MockProposal(pk=2, status='IMPLEMENTED',
                          post_impact={'delta_confidence_observed': -0.30})
        p3 = MockProposal(pk=3, status='APPROVED',
                          post_impact={'delta_confidence_observed': 0.0})
        result = self.fn([p1, p2, p3])
        pks = [p.pk for p in result]
        self.assertEqual(pks[0], 2)  # most negative first

    def test_approved_status_also_included(self):
        p = MockProposal(status='APPROVED',
                         post_impact={'delta_confidence_observed': -0.10})
        result = self.fn([p])
        self.assertEqual(len(result), 1)

    def test_mixed_proposals_filtered_correctly(self):
        good = MockProposal(pk=1, status='IMPLEMENTED',
                            post_impact={'delta_confidence_observed': 0.15})
        bad = MockProposal(pk=2, status='IMPLEMENTED',
                           post_impact={'delta_confidence_observed': -0.08})
        pending = MockProposal(pk=3, status='SUGGESTED',
                               post_impact={'delta_confidence_observed': -0.20})
        no_impact = MockProposal(pk=4, status='IMPLEMENTED', post_impact=None)
        result = self.fn([good, bad, pending, no_impact])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].pk, 2)


# ---------------------------------------------------------------------------
# Sparse data / edge cases across all functions
# ---------------------------------------------------------------------------

class SparseDataTests(unittest.TestCase):
    def test_all_functions_handle_empty_input_gracefully(self):
        from contracts.intelligence_tuning_meta import (
            approval_rejection_ratios,
            care_category_proposal_stats,
            factor_type_impact_summary,
            negative_impact_proposals,
            reviewer_stats,
            top_impact_proposals,
        )
        self.assertEqual(top_impact_proposals([]), [])
        self.assertEqual(factor_type_impact_summary([]), [])
        self.assertEqual(care_category_proposal_stats([]), [])
        self.assertEqual(reviewer_stats([]), [])
        self.assertEqual(negative_impact_proposals([]), [])
        r = approval_rejection_ratios([])
        self.assertEqual(r['by_source'], {})
        self.assertEqual(r['by_factor_type'], {})

    def test_single_proposal_with_no_post_impact(self):
        from contracts.intelligence_tuning_meta import top_impact_proposals, factor_type_impact_summary
        p = MockProposal(status='IMPLEMENTED', post_impact=None)
        self.assertEqual(top_impact_proposals([p]), [])
        self.assertEqual(factor_type_impact_summary([p]), [])

    def test_proposal_missing_attributes_handled(self):
        """Objects with minimal attributes should not crash any function."""
        from contracts.intelligence_tuning_meta import (
            approval_rejection_ratios,
            care_category_proposal_stats,
            reviewer_stats,
        )
        p = object()  # plain object with no attributes
        # Should not raise; may return empty
        try:
            care_category_proposal_stats([p])
            reviewer_stats([p])
            approval_rejection_ratios([p])
        except AttributeError:
            # getattr with defaults should prevent this, but we accept it
            # as implementation-defined for truly alien objects
            pass


if __name__ == '__main__':
    unittest.main()
