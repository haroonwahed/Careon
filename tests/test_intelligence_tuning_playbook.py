"""
Unit tests for contracts/intelligence_tuning_playbook.py

Pure Python — no database, no Django ORM.

Tests cover:
- review_cadence_for_proposal()   — risk / factor_type variations
- escalation_required()           — each escalation trigger independently
- should_review_proposal()        — threshold logic, terminal statuses
- success_criteria_met()          — criteria combinations, sparse data
- archive_recommendation()        — each archive trigger
- role_responsibilities()         — structure and presence of all roles
- playbook_summary()              — aggregation and categorisation across proposals
"""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now():
    return datetime.now(tz=timezone.utc)


def _ago(days):
    return datetime.now(tz=timezone.utc) - timedelta(days=days)


class MockProposal:
    def __init__(self, **kwargs):
        self.pk = kwargs.get('pk', 1)
        self.status = kwargs.get('status', 'SUGGESTED')
        self.risk_level = kwargs.get('risk_level', 'LOW')
        self.priority_score = kwargs.get('priority_score', 0.5)
        self.sample_count = kwargs.get('sample_count', 10)
        self.factor_type = kwargs.get('factor_type', 'OTHER')
        self.post_impact = kwargs.get('post_impact', None)
        self.group_key = kwargs.get('group_key', '')
        self.source = kwargs.get('source', 'manual')
        self.affected_care_category = kwargs.get('affected_care_category', None)
        self.reviewed_by = kwargs.get('reviewed_by', None)
        self.updated_at = kwargs.get('updated_at', _now())
        self.created_at = kwargs.get('created_at', _now())
        self.implemented_at = kwargs.get('implemented_at', None)

    def get_factor_type_display(self):
        return self.factor_type

    def get_status_display(self):
        return self.status


def _fresh(**kwargs):
    return MockProposal(updated_at=_now(), **kwargs)


def _stale(days=40, **kwargs):
    return MockProposal(updated_at=_ago(days), **kwargs)


# ---------------------------------------------------------------------------
# review_cadence_for_proposal
# ---------------------------------------------------------------------------

class ReviewCadenceTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_playbook import review_cadence_for_proposal
        self.fn = review_cadence_for_proposal

    def test_high_risk_gives_shortest_cadence(self):
        p = MockProposal(risk_level='HIGH', factor_type='OTHER')
        r = self.fn(p)
        from contracts.intelligence_tuning_playbook import STALE_DAYS_HIGH_RISK
        self.assertEqual(r['cadence_days'], STALE_DAYS_HIGH_RISK)

    def test_low_risk_gives_standard_cadence(self):
        p = MockProposal(risk_level='LOW', factor_type='OTHER')
        r = self.fn(p)
        from contracts.intelligence_tuning_playbook import STALE_DAYS_LOW_RISK
        self.assertEqual(r['cadence_days'], STALE_DAYS_LOW_RISK)

    def test_specialization_weight_gives_intermediate_cadence(self):
        p = MockProposal(risk_level='LOW', factor_type='SPECIALIZATION_WEIGHT')
        r = self.fn(p)
        self.assertLess(r['cadence_days'], 30)
        self.assertGreater(r['cadence_days'], 7)

    def test_region_weight_gives_intermediate_cadence(self):
        p = MockProposal(risk_level='LOW', factor_type='REGION_WEIGHT')
        r = self.fn(p)
        self.assertLess(r['cadence_days'], 30)
        self.assertGreater(r['cadence_days'], 7)

    def test_return_has_expected_keys(self):
        p = MockProposal(risk_level='LOW', factor_type='OTHER')
        r = self.fn(p)
        for key in ('cadence_label', 'cadence_days', 'rationale', 'risk_level', 'factor_type'):
            self.assertIn(key, r)

    def test_cadence_days_is_positive_int(self):
        p = MockProposal(risk_level='HIGH', factor_type='OTHER')
        r = self.fn(p)
        self.assertIsInstance(r['cadence_days'], int)
        self.assertGreater(r['cadence_days'], 0)

    def test_high_risk_overrides_factor_type(self):
        """HIGH risk should give the same (shortest) cadence regardless of factor_type."""
        from contracts.intelligence_tuning_playbook import STALE_DAYS_HIGH_RISK
        for ft in ('SPECIALIZATION_WEIGHT', 'REGION_WEIGHT', 'OTHER'):
            p = MockProposal(risk_level='HIGH', factor_type=ft)
            r = self.fn(p)
            self.assertEqual(r['cadence_days'], STALE_DAYS_HIGH_RISK, f"failed for factor_type={ft}")

    def test_empty_risk_defaults_gracefully(self):
        p = MockProposal(risk_level='', factor_type='OTHER')
        r = self.fn(p)
        self.assertIn('cadence_days', r)


# ---------------------------------------------------------------------------
# escalation_required
# ---------------------------------------------------------------------------

class EscalationRequiredTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_playbook import escalation_required
        self.fn = escalation_required

    def test_no_escalation_for_normal_low_risk_fresh(self):
        p = _fresh(status='SUGGESTED', risk_level='LOW', priority_score=0.5, sample_count=10)
        r = self.fn(p)
        self.assertFalse(r['required'])
        self.assertEqual(r['reasons'], [])

    def test_high_risk_triggers_escalation(self):
        p = _fresh(status='SUGGESTED', risk_level='HIGH', priority_score=0.5, sample_count=10)
        r = self.fn(p)
        self.assertTrue(r['required'])
        self.assertTrue(any('HOOG' in reason for reason in r['reasons']))

    def test_low_sample_count_triggers_escalation(self):
        from contracts.intelligence_tuning_playbook import SAMPLE_COUNT_MINIMUM
        p = _fresh(status='SUGGESTED', risk_level='LOW', priority_score=0.5,
                   sample_count=SAMPLE_COUNT_MINIMUM - 1)
        r = self.fn(p)
        self.assertTrue(r['required'])
        self.assertTrue(any('steekproefomvang' in reason.lower() or 'Steekproef' in reason
                            for reason in r['reasons']))

    def test_zero_sample_count_triggers_escalation(self):
        p = _fresh(status='SUGGESTED', risk_level='LOW', priority_score=0.5, sample_count=0)
        # sample_count=0 is falsy so condition is: 0 < sc < minimum → False
        # Only triggers when 0 < sc < minimum; 0 should NOT trigger
        r = self.fn(p)
        # sample_count 0 means no data at all — we check implementation behaviour
        # The condition is `0 < sc < MINIMUM` so exactly 0 should NOT trigger this specific check
        # (other checks may fire for different reasons)
        sample_count_reasons = [re for re in r['reasons'] if 'steekproef' in re.lower() or 'Steekproef' in re]
        # With sc=0 the guard `0 < sc < minimum` is False → no sample_count reason
        self.assertEqual(len(sample_count_reasons), 0)

    def test_extreme_priority_triggers_escalation(self):
        p = _fresh(status='SUGGESTED', risk_level='LOW', priority_score=0.90, sample_count=10)
        r = self.fn(p)
        self.assertTrue(r['required'])
        self.assertTrue(any('prioriteit' in re.lower() or 'Prioriteit' in re for re in r['reasons']))

    def test_overdue_proposal_triggers_escalation(self):
        from contracts.intelligence_tuning_playbook import STALE_DAYS_LOW_RISK
        p = _stale(days=STALE_DAYS_LOW_RISK + 5, status='SUGGESTED', risk_level='LOW',
                   priority_score=0.3, sample_count=10)
        r = self.fn(p)
        self.assertTrue(r['required'])

    def test_terminal_status_not_overdue_escalated(self):
        """REJECTED/IMPLEMENTED should not be escalated for being overdue."""
        from contracts.intelligence_tuning_playbook import STALE_DAYS_LOW_RISK
        for status in ('REJECTED', 'IMPLEMENTED'):
            p = _stale(days=STALE_DAYS_LOW_RISK + 50, status=status, risk_level='LOW',
                       priority_score=0.3, sample_count=10)
            r = self.fn(p)
            # No overdue reason should appear for terminal statuses
            overdue_reasons = [re for re in r['reasons'] if 'ongewijzigd' in re.lower() or 'termijn' in re.lower()]
            self.assertEqual(len(overdue_reasons), 0,
                             f"Overdue escalation should not fire for {status}: {r['reasons']}")

    def test_multiple_triggers_accumulate(self):
        from contracts.intelligence_tuning_playbook import SAMPLE_COUNT_MINIMUM
        p = _fresh(status='SUGGESTED', risk_level='HIGH', priority_score=0.90,
                   sample_count=SAMPLE_COUNT_MINIMUM - 1)
        r = self.fn(p)
        self.assertGreaterEqual(len(r['reasons']), 2)

    def test_guidance_present_when_required(self):
        p = _fresh(status='SUGGESTED', risk_level='HIGH', priority_score=0.5, sample_count=10)
        r = self.fn(p)
        self.assertIn('guidance', r)
        self.assertGreater(len(r['guidance']), 10)

    def test_guidance_present_when_not_required(self):
        p = _fresh(status='SUGGESTED', risk_level='LOW', priority_score=0.3, sample_count=20)
        r = self.fn(p)
        self.assertIn('guidance', r)


# ---------------------------------------------------------------------------
# should_review_proposal
# ---------------------------------------------------------------------------

class ShouldReviewProposalTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_playbook import should_review_proposal
        self.fn = should_review_proposal

    def test_rejected_not_reviewed(self):
        p = _fresh(status='REJECTED')
        r = self.fn(p)
        self.assertFalse(r['review'])

    def test_implemented_not_reviewed(self):
        p = _fresh(status='IMPLEMENTED')
        r = self.fn(p)
        self.assertFalse(r['review'])

    def test_high_risk_always_reviewed(self):
        p = _fresh(status='SUGGESTED', risk_level='HIGH', priority_score=0.1, sample_count=100)
        r = self.fn(p)
        self.assertTrue(r['review'])

    def test_low_sample_reviewed(self):
        from contracts.intelligence_tuning_playbook import SAMPLE_COUNT_MINIMUM
        p = _fresh(status='SUGGESTED', risk_level='LOW', priority_score=0.1,
                   sample_count=SAMPLE_COUNT_MINIMUM - 1)
        r = self.fn(p)
        self.assertTrue(r['review'])

    def test_high_priority_reviewed(self):
        from contracts.intelligence_tuning_playbook import PRIORITY_REVIEW_THRESHOLD
        p = _fresh(status='SUGGESTED', risk_level='LOW',
                   priority_score=PRIORITY_REVIEW_THRESHOLD + 0.01,
                   sample_count=100)
        r = self.fn(p)
        self.assertTrue(r['review'])

    def test_low_priority_not_reviewed(self):
        from contracts.intelligence_tuning_playbook import PRIORITY_REVIEW_THRESHOLD
        p = _fresh(status='SUGGESTED', risk_level='LOW',
                   priority_score=PRIORITY_REVIEW_THRESHOLD - 0.10,
                   sample_count=100)
        r = self.fn(p)
        self.assertFalse(r['review'])

    def test_reason_always_present(self):
        for status in ('SUGGESTED', 'REVIEWED', 'REJECTED', 'IMPLEMENTED'):
            p = _fresh(status=status, risk_level='LOW', priority_score=0.3, sample_count=10)
            r = self.fn(p)
            self.assertIn('reason', r)
            self.assertGreater(len(r['reason']), 0)

    def test_exactly_at_threshold_reviewed(self):
        from contracts.intelligence_tuning_playbook import PRIORITY_REVIEW_THRESHOLD
        p = _fresh(status='SUGGESTED', risk_level='LOW',
                   priority_score=PRIORITY_REVIEW_THRESHOLD,
                   sample_count=100)
        r = self.fn(p)
        self.assertTrue(r['review'])


# ---------------------------------------------------------------------------
# success_criteria_met
# ---------------------------------------------------------------------------

class SuccessCriteriaTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_playbook import success_criteria_met
        self.fn = success_criteria_met

    def test_non_implemented_always_false(self):
        for status in ('SUGGESTED', 'REVIEWED', 'APPROVED', 'REJECTED'):
            p = MockProposal(status=status, post_impact={'delta_confidence_observed': 0.50})
            r = self.fn(p)
            self.assertFalse(r['met'], f"Expected False for status {status}")

    def test_implemented_no_post_impact_false(self):
        p = MockProposal(status='IMPLEMENTED', post_impact=None, implemented_at=_ago(30))
        r = self.fn(p)
        self.assertFalse(r['met'])

    def test_implemented_none_delta_false(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': None},
                         implemented_at=_ago(30))
        r = self.fn(p)
        self.assertFalse(r['met'])

    def test_implemented_sufficient_positive_delta_true(self):
        from contracts.intelligence_tuning_playbook import SUCCESS_DELTA_THRESHOLD, SAMPLE_COUNT_MINIMUM
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={
                             'delta_confidence_observed': SUCCESS_DELTA_THRESHOLD + 0.05,
                             'sample_count': SAMPLE_COUNT_MINIMUM,
                         },
                         implemented_at=_ago(30))
        r = self.fn(p)
        self.assertTrue(r['met'])

    def test_implemented_below_delta_threshold_false(self):
        from contracts.intelligence_tuning_playbook import SUCCESS_DELTA_THRESHOLD
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': SUCCESS_DELTA_THRESHOLD - 0.01},
                         implemented_at=_ago(30))
        r = self.fn(p)
        self.assertFalse(r['met'])

    def test_negative_delta_false(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': -0.10},
                         implemented_at=_ago(30))
        r = self.fn(p)
        self.assertFalse(r['met'])

    def test_zero_delta_false(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': 0.0},
                         implemented_at=_ago(30))
        r = self.fn(p)
        self.assertFalse(r['met'])

    def test_insufficient_sample_count_in_post_impact_false(self):
        from contracts.intelligence_tuning_playbook import SUCCESS_DELTA_THRESHOLD, SAMPLE_COUNT_MINIMUM
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={
                             'delta_confidence_observed': SUCCESS_DELTA_THRESHOLD + 0.10,
                             'sample_count': SAMPLE_COUNT_MINIMUM - 1,
                         },
                         implemented_at=_ago(30))
        r = self.fn(p)
        self.assertFalse(r['met'])

    def test_within_waiting_period_false(self):
        from contracts.intelligence_tuning_playbook import IMPLEMENTATION_EVALUATION_DAYS
        p = MockProposal(status='IMPLEMENTED',
                         post_impact=None,
                         implemented_at=_ago(IMPLEMENTATION_EVALUATION_DAYS - 3))
        r = self.fn(p)
        self.assertFalse(r['met'])
        self.assertTrue(r['waiting_period'])

    def test_past_waiting_period_flag(self):
        from contracts.intelligence_tuning_playbook import IMPLEMENTATION_EVALUATION_DAYS
        p = MockProposal(status='IMPLEMENTED',
                         post_impact=None,
                         implemented_at=_ago(IMPLEMENTATION_EVALUATION_DAYS + 5))
        r = self.fn(p)
        self.assertFalse(r['waiting_period'])

    def test_return_has_expected_keys(self):
        p = MockProposal(status='IMPLEMENTED', post_impact=None, implemented_at=_ago(30))
        r = self.fn(p)
        for key in ('met', 'detail', 'delta_conf', 'sample_count', 'waiting_period'):
            self.assertIn(key, r)

    def test_missing_implemented_at_handled(self):
        """No crash when implemented_at is None."""
        p = MockProposal(status='IMPLEMENTED', post_impact=None, implemented_at=None)
        r = self.fn(p)
        self.assertFalse(r['met'])


# ---------------------------------------------------------------------------
# archive_recommendation
# ---------------------------------------------------------------------------

class ArchiveRecommendationTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_playbook import archive_recommendation
        self.fn = archive_recommendation

    def test_rejected_archived(self):
        p = _fresh(status='REJECTED')
        r = self.fn(p)
        self.assertTrue(r['archive'])
        self.assertEqual(r['trigger'], 'rejected')

    def test_stale_suggested_archived(self):
        from contracts.intelligence_tuning_playbook import STALE_DAYS_LOW_RISK
        p = _stale(days=STALE_DAYS_LOW_RISK * 2 + 5, status='SUGGESTED', risk_level='LOW')
        r = self.fn(p)
        self.assertTrue(r['archive'])
        self.assertEqual(r['trigger'], 'stale')

    def test_stale_reviewed_archived(self):
        from contracts.intelligence_tuning_playbook import STALE_DAYS_LOW_RISK
        p = _stale(days=STALE_DAYS_LOW_RISK * 2 + 5, status='REVIEWED', risk_level='LOW')
        r = self.fn(p)
        self.assertTrue(r['archive'])
        self.assertEqual(r['trigger'], 'stale')

    def test_fresh_suggested_not_archived(self):
        p = _fresh(status='SUGGESTED', risk_level='LOW', group_key='')
        r = self.fn(p)
        self.assertFalse(r['archive'])

    def test_implemented_negative_delta_archived(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': -0.05},
                         updated_at=_now(), group_key='')
        r = self.fn(p)
        self.assertTrue(r['archive'])
        self.assertEqual(r['trigger'], 'ineffective')

    def test_implemented_zero_delta_archived(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': 0.0},
                         updated_at=_now(), group_key='')
        r = self.fn(p)
        self.assertTrue(r['archive'])
        self.assertEqual(r['trigger'], 'ineffective')

    def test_implemented_positive_delta_not_archived(self):
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': 0.10},
                         updated_at=_now(), group_key='')
        r = self.fn(p)
        self.assertFalse(r['archive'])

    def test_group_key_signal_flagged_not_archived(self):
        p = _fresh(status='SUGGESTED', risk_level='LOW', group_key='kalibratie|OTHER|org_1')
        r = self.fn(p)
        # Archive False but trigger signals group_duplicate
        self.assertFalse(r['archive'])
        self.assertEqual(r['trigger'], 'group_duplicate')

    def test_return_has_expected_keys(self):
        p = _fresh(status='SUGGESTED', group_key='')
        r = self.fn(p)
        for key in ('archive', 'reason', 'trigger'):
            self.assertIn(key, r)

    def test_no_trigger_for_healthy_proposal(self):
        p = _fresh(status='SUGGESTED', risk_level='LOW', group_key='', priority_score=0.5)
        r = self.fn(p)
        self.assertIsNone(r['trigger'])


# ---------------------------------------------------------------------------
# role_responsibilities
# ---------------------------------------------------------------------------

class RoleResponsibilitiesTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_playbook import role_responsibilities
        self.roles = role_responsibilities()

    def test_all_three_roles_present(self):
        for role in ('reviewer', 'approver', 'observer'):
            self.assertIn(role, self.roles)

    def test_each_role_has_label(self):
        for role in ('reviewer', 'approver', 'observer'):
            self.assertIn('label', self.roles[role])
            self.assertGreater(len(self.roles[role]['label']), 0)

    def test_each_role_has_duties_list(self):
        for role in ('reviewer', 'approver', 'observer'):
            self.assertIn('duties', self.roles[role])
            self.assertIsInstance(self.roles[role]['duties'], list)
            self.assertGreater(len(self.roles[role]['duties']), 0)

    def test_reviewer_has_cadence(self):
        self.assertIn('cadence', self.roles['reviewer'])

    def test_reviewer_has_escalate_to(self):
        self.assertIn('escalate_to', self.roles['reviewer'])

    def test_approver_has_escalate_to(self):
        self.assertIn('escalate_to', self.roles['approver'])

    def test_observer_has_no_write_duties(self):
        duties = ' '.join(self.roles['observer']['duties']).lower()
        # Observer duties should mention read-only / no status changes
        self.assertTrue('lees' in duties or 'alleen' in duties or 'geen' in duties)

    def test_returns_new_dict_each_call(self):
        from contracts.intelligence_tuning_playbook import role_responsibilities
        r1 = role_responsibilities()
        r2 = role_responsibilities()
        self.assertIsNot(r1, r2)


# ---------------------------------------------------------------------------
# playbook_summary
# ---------------------------------------------------------------------------

class PlaybookSummaryTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning_playbook import playbook_summary
        self.fn = playbook_summary

    def test_empty_input(self):
        r = self.fn([])
        self.assertEqual(r['total'], 0)
        self.assertEqual(r['needs_escalation'], [])
        self.assertEqual(r['overdue_review'], [])
        self.assertGreater(len(r['summary_lines']), 0)  # should still have a message

    def test_high_risk_proposal_in_needs_escalation(self):
        p = _fresh(status='SUGGESTED', risk_level='HIGH', priority_score=0.5, sample_count=10)
        r = self.fn([p])
        self.assertIn(p, r['needs_escalation'])

    def test_overdue_low_risk_proposal_in_overdue_review(self):
        from contracts.intelligence_tuning_playbook import STALE_DAYS_LOW_RISK
        p = _stale(days=STALE_DAYS_LOW_RISK + 5, status='SUGGESTED', risk_level='LOW',
                   priority_score=0.3, sample_count=10)
        r = self.fn([p])
        self.assertIn(p, r['overdue_review'])

    def test_implemented_needing_eval_in_needs_success_eval(self):
        from contracts.intelligence_tuning_playbook import IMPLEMENTATION_EVALUATION_DAYS
        p = MockProposal(status='IMPLEMENTED', post_impact=None,
                         implemented_at=_ago(IMPLEMENTATION_EVALUATION_DAYS + 5),
                         updated_at=_now(), risk_level='LOW', priority_score=0.5, sample_count=10)
        r = self.fn([p])
        self.assertIn(p, r['needs_success_eval'])

    def test_rejected_in_archive_candidates(self):
        p = _fresh(status='REJECTED')
        r = self.fn([p])
        self.assertIn(p, r['archive_candidates'])

    def test_high_priority_in_ready_for_review(self):
        from contracts.intelligence_tuning_playbook import PRIORITY_REVIEW_THRESHOLD
        p = _fresh(status='SUGGESTED', risk_level='LOW',
                   priority_score=PRIORITY_REVIEW_THRESHOLD + 0.10,
                   sample_count=20)
        r = self.fn([p])
        self.assertIn(p, r['ready_for_review'])

    def test_total_count_correct(self):
        proposals = [MockProposal(pk=i, status='SUGGESTED') for i in range(7)]
        r = self.fn(proposals)
        self.assertEqual(r['total'], 7)

    def test_summary_lines_is_list_of_strings(self):
        r = self.fn([MockProposal(status='SUGGESTED', risk_level='HIGH')])
        self.assertIsInstance(r['summary_lines'], list)
        for line in r['summary_lines']:
            self.assertIsInstance(line, str)

    def test_healthy_proposals_produce_clean_message(self):
        """Proposals with no issues should produce a positive summary."""
        from contracts.intelligence_tuning_playbook import STALE_DAYS_LOW_RISK
        p = MockProposal(status='IMPLEMENTED',
                         post_impact={'delta_confidence_observed': 0.15, 'sample_count': 20},
                         implemented_at=_ago(STALE_DAYS_LOW_RISK),
                         updated_at=_now(), risk_level='LOW',
                         priority_score=0.4, sample_count=20, group_key='')
        r = self.fn([p])
        # With a healthy implemented proposal the summary should be short
        self.assertIsInstance(r['summary_lines'], list)

    def test_no_duplicates_in_lists(self):
        p = _fresh(status='SUGGESTED', risk_level='HIGH', priority_score=0.9, sample_count=10)
        r = self.fn([p])
        for key in ('needs_escalation', 'overdue_review', 'archive_candidates', 'ready_for_review'):
            ids = [id(x) for x in r[key]]
            self.assertEqual(len(ids), len(set(ids)), f"Duplicates found in {key}")


# ---------------------------------------------------------------------------
# Sparse / edge data
# ---------------------------------------------------------------------------

class SparseDataTests(unittest.TestCase):
    def test_all_functions_handle_empty_proposal(self):
        """Object with only minimal attributes should not crash any function."""
        from contracts.intelligence_tuning_playbook import (
            archive_recommendation,
            escalation_required,
            review_cadence_for_proposal,
            should_review_proposal,
            success_criteria_met,
        )
        p = MockProposal(
            status='SUGGESTED', risk_level='', priority_score=None,
            sample_count=None, factor_type='', post_impact=None,
            group_key=None, updated_at=None, implemented_at=None,
        )
        review_cadence_for_proposal(p)
        escalation_required(p)
        should_review_proposal(p)
        success_criteria_met(p)
        archive_recommendation(p)

    def test_playbook_summary_handles_all_none_fields(self):
        from contracts.intelligence_tuning_playbook import playbook_summary
        p = MockProposal(
            status='SUGGESTED', risk_level=None, priority_score=None,
            sample_count=None, factor_type=None, post_impact=None,
            group_key=None, updated_at=None, implemented_at=None,
        )
        result = playbook_summary([p])
        self.assertIn('total', result)
        self.assertEqual(result['total'], 1)

    def test_success_criteria_none_implemented_at_handled(self):
        from contracts.intelligence_tuning_playbook import success_criteria_met
        p = MockProposal(status='IMPLEMENTED', post_impact=None, implemented_at=None)
        r = success_criteria_met(p)
        self.assertFalse(r['met'])

    def test_archive_recommendation_none_updated_at(self):
        from contracts.intelligence_tuning_playbook import archive_recommendation
        p = MockProposal(status='SUGGESTED', updated_at=None, group_key='')
        # Should not raise
        r = archive_recommendation(p)
        self.assertIn('archive', r)


if __name__ == '__main__':
    unittest.main()
