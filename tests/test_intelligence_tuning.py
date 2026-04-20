"""
Unit tests for contracts/intelligence_tuning.py

Pure Python — no database, no Django ORM (except model instantiation with
mock fields for status transition tests).

Tests cover:
- proposals_from_calibration_diagnostics() — generation from each diagnostic type
- simulate_proposal_impact() — before/after confidence simulation
- transition_proposal() — valid and invalid status transitions
- TuningProposal.can_transition_to() — transition guard logic
- Sparse-data safety (empty diagnostics, empty rows)
"""
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Minimal stub for TuningProposal (no DB required)
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
    values = [v for v, _ in choices]


class _FactorChoices:
    SPECIALIZATION_WEIGHT = 'SPECIALIZATION_WEIGHT'
    PROVIDER_RELIABILITY_BOOST = 'PROVIDER_RELIABILITY_BOOST'
    CAPACITY_REJECTION_PENALTY = 'CAPACITY_REJECTION_PENALTY'
    CATEGORY_CONFIDENCE_THRESHOLD = 'CATEGORY_CONFIDENCE_THRESHOLD'
    REGION_WEIGHT = 'REGION_WEIGHT'
    COMPLEXITY_THRESHOLD = 'COMPLEXITY_THRESHOLD'
    OTHER = 'OTHER'


class _SourceChoices:
    HIGH_CONF_LOW_ACCEPT = 'high_conf_low_accept'
    LOW_CONF_HIGH_SUCCESS = 'low_conf_high_success'
    CATEGORY_DRIFT = 'category_drift'
    PROVIDER_DRIFT = 'provider_drift'
    TAXONOMY_CLUSTER = 'taxonomy_cluster'
    MANUAL = 'manual'


class MockTuningProposal:
    """In-memory TuningProposal stub that mimics the Django model interface."""

    Status = _StatusChoices
    FactorType = _FactorChoices
    Source = _SourceChoices

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
        self.status = kwargs.get('status', _StatusChoices.SUGGESTED)
        self.source = kwargs.get('source', _SourceChoices.MANUAL)
        self.factor_type = kwargs.get('factor_type', _FactorChoices.OTHER)
        self.affected_care_category = kwargs.get('affected_care_category')
        self.affected_provider = kwargs.get('affected_provider')
        self.detected_issue = kwargs.get('detected_issue', '')
        self.recommendation = kwargs.get('recommendation', '')
        self.proposed_delta = kwargs.get('proposed_delta')
        self.rationale = kwargs.get('rationale', '')
        self.simulation_before = kwargs.get('simulation_before')
        self.simulation_after = kwargs.get('simulation_after')
        self.created_by = kwargs.get('created_by')
        self.reviewed_by = kwargs.get('reviewed_by')
        self.reviewed_at = kwargs.get('reviewed_at')
        self.review_note = kwargs.get('review_note', '')
        self._saved = False

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in self._ALLOWED_TRANSITIONS.get(self.status, set())

    def save(self):
        self._saved = True

    def get_status_display(self):
        for val, label in _StatusChoices.choices:
            if val == self.status:
                return label
        return self.status


# ---------------------------------------------------------------------------
# Module-level import helpers
# ---------------------------------------------------------------------------

def _import_tuning():
    """Import intelligence_tuning with TuningProposal stubbed out."""
    import importlib
    import sys
    # Patch contracts.models.TuningProposal to our stub during import
    mock_models = MagicMock()
    mock_models.TuningProposal = MockTuningProposal
    mock_models.CareCategoryMain = MagicMock()
    mock_models.Client = MagicMock()
    sys.modules.setdefault('contracts', MagicMock())
    with patch.dict(sys.modules, {'contracts.models': mock_models}):
        if 'contracts.intelligence_tuning' in sys.modules:
            del sys.modules['contracts.intelligence_tuning']
        import contracts.intelligence_tuning as tuning
        return tuning


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------

def _empty_diagnostics():
    return {
        'high_confidence_low_acceptance': [],
        'low_confidence_high_success': [],
        'care_category_drift': [],
        'provider_drift': [],
        'taxonomy_clusters': [],
    }


def _row(conf=0.75, status='ACCEPTED', quality='GOOD_FIT', category='Jeugd', provider_id=1):
    return {
        'predicted_confidence': conf,
        'provider_response_status': status,
        'placement_quality_status': quality,
        'due_diligence_process__care_category_main__name': category,
        'selected_provider_id': provider_id,
    }


# ---------------------------------------------------------------------------
# TuningProposal.can_transition_to (model-level guard)
# ---------------------------------------------------------------------------

class CanTransitionToTests(unittest.TestCase):
    def _proposal(self, status):
        return MockTuningProposal(status=status)

    def test_suggested_can_move_to_reviewed(self):
        p = self._proposal('SUGGESTED')
        self.assertTrue(p.can_transition_to('REVIEWED'))

    def test_suggested_can_be_rejected(self):
        p = self._proposal('SUGGESTED')
        self.assertTrue(p.can_transition_to('REJECTED'))

    def test_suggested_cannot_skip_to_approved(self):
        p = self._proposal('SUGGESTED')
        self.assertFalse(p.can_transition_to('APPROVED'))

    def test_suggested_cannot_skip_to_implemented(self):
        p = self._proposal('SUGGESTED')
        self.assertFalse(p.can_transition_to('IMPLEMENTED'))

    def test_reviewed_can_move_to_approved(self):
        p = self._proposal('REVIEWED')
        self.assertTrue(p.can_transition_to('APPROVED'))

    def test_reviewed_can_be_rejected(self):
        p = self._proposal('REVIEWED')
        self.assertTrue(p.can_transition_to('REJECTED'))

    def test_reviewed_cannot_go_back_to_suggested(self):
        p = self._proposal('REVIEWED')
        self.assertFalse(p.can_transition_to('SUGGESTED'))

    def test_approved_can_move_to_implemented(self):
        p = self._proposal('APPROVED')
        self.assertTrue(p.can_transition_to('IMPLEMENTED'))

    def test_approved_can_be_rejected(self):
        p = self._proposal('APPROVED')
        self.assertTrue(p.can_transition_to('REJECTED'))

    def test_rejected_has_no_valid_transitions(self):
        p = self._proposal('REJECTED')
        for status in ('SUGGESTED', 'REVIEWED', 'APPROVED', 'IMPLEMENTED'):
            self.assertFalse(p.can_transition_to(status))

    def test_implemented_has_no_valid_transitions(self):
        p = self._proposal('IMPLEMENTED')
        for status in ('SUGGESTED', 'REVIEWED', 'APPROVED', 'REJECTED'):
            self.assertFalse(p.can_transition_to(status))

    def test_unknown_target_status_returns_false(self):
        p = self._proposal('SUGGESTED')
        self.assertFalse(p.can_transition_to('NONSENSE'))


# ---------------------------------------------------------------------------
# transition_proposal
# ---------------------------------------------------------------------------

class TransitionProposalTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning import transition_proposal
        self.transition_proposal = transition_proposal

    def _proposal(self, status='SUGGESTED'):
        return MockTuningProposal(status=status)

    def _user(self, name='Reviewer'):
        u = MagicMock()
        u.get_full_name.return_value = name
        return u

    def test_valid_transition_updates_status(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        self.transition_proposal(p, 'REVIEWED', actor)
        self.assertEqual(p.status, 'REVIEWED')

    def test_valid_transition_sets_reviewer(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        self.transition_proposal(p, 'REVIEWED', actor)
        self.assertEqual(p.reviewed_by, actor)

    def test_valid_transition_sets_reviewed_at(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        before = datetime.now(tz=timezone.utc)
        self.transition_proposal(p, 'REVIEWED', actor)
        self.assertIsNotNone(p.reviewed_at)
        self.assertGreaterEqual(p.reviewed_at, before)

    def test_valid_transition_sets_review_note(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        self.transition_proposal(p, 'REVIEWED', actor, note='Goed voorstel.')
        self.assertEqual(p.review_note, 'Goed voorstel.')

    def test_valid_transition_saves_proposal(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        self.transition_proposal(p, 'REVIEWED', actor)
        self.assertTrue(p._saved)

    def test_valid_transition_returns_proposal(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        result = self.transition_proposal(p, 'REVIEWED', actor)
        self.assertIs(result, p)

    def test_invalid_transition_raises_value_error(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        with self.assertRaises(ValueError):
            self.transition_proposal(p, 'IMPLEMENTED', actor)

    def test_terminal_state_raises_value_error(self):
        p = self._proposal('REJECTED')
        actor = self._user()
        with self.assertRaises(ValueError):
            self.transition_proposal(p, 'REVIEWED', actor)

    def test_review_note_empty_by_default(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        self.transition_proposal(p, 'REVIEWED', actor)
        # When note='' (default), review_note should remain as set at model init
        self.assertEqual(p.review_note, '')

    def test_full_approval_chain(self):
        p = self._proposal('SUGGESTED')
        actor = self._user()
        self.transition_proposal(p, 'REVIEWED', actor)
        self.transition_proposal(p, 'APPROVED', actor)
        self.transition_proposal(p, 'IMPLEMENTED', actor)
        self.assertEqual(p.status, 'IMPLEMENTED')


# ---------------------------------------------------------------------------
# proposals_from_calibration_diagnostics
# ---------------------------------------------------------------------------

class ProposalsFromDiagnosticsTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning import proposals_from_calibration_diagnostics
        self.generate = proposals_from_calibration_diagnostics
        self.org = MagicMock()

    def _patch_lookups(self):
        """Patch DB lookups and TuningProposal to avoid ORM requirements."""
        mock_models = MagicMock()
        mock_models.TuningProposal = MockTuningProposal
        return patch.multiple(
            'contracts.intelligence_tuning',
            _lookup_care_category=lambda org, name: None,
            _lookup_provider=lambda pid: None,
            **{'contracts': mock_models} if False else {},
        )

    def _patch_all(self):
        """Context manager that patches both lookups and TuningProposal."""
        from contextlib import contextmanager
        from unittest.mock import patch as _patch
        import contracts.models as _models

        @contextmanager
        def _ctx():
            orig = getattr(_models, 'TuningProposal', None)
            _models.TuningProposal = MockTuningProposal
            try:
                with _patch('contracts.intelligence_tuning._lookup_care_category', return_value=None), \
                     _patch('contracts.intelligence_tuning._lookup_provider', return_value=None):
                    yield
            finally:
                if orig is not None:
                    _models.TuningProposal = orig
                else:  # pragma: no cover
                    del _models.TuningProposal

        return _ctx()

    def test_empty_diagnostics_returns_empty(self):
        with self._patch_all():
            result = self.generate(_empty_diagnostics(), org=self.org)
        self.assertEqual(result, [])

    def test_high_conf_low_accept_creates_proposal(self):
        diag = _empty_diagnostics()
        diag['high_confidence_low_acceptance'] = [
            {'care_category': 'Jeugd', 'acceptance_rate': 0.20, 'total_high_conf': 5, 'severity': 'high'}
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(len(result), 1)
        p = result[0]
        self.assertEqual(p.source, 'high_conf_low_accept')
        self.assertEqual(p.factor_type, 'PROVIDER_RELIABILITY_BOOST')
        self.assertIsNotNone(p.proposed_delta)
        self.assertLess(p.proposed_delta, 0)  # should be negative (reduce boost)
        self.assertIn('Jeugd', p.detected_issue)
        self.assertIn('Jeugd', p.recommendation)

    def test_low_conf_high_success_creates_proposal(self):
        diag = _empty_diagnostics()
        diag['low_confidence_high_success'] = [
            {'care_category': 'WMO', 'success_rate': 0.75, 'total_low_conf': 4, 'severity': 'medium'}
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(len(result), 1)
        p = result[0]
        self.assertEqual(p.source, 'low_conf_high_success')
        self.assertEqual(p.factor_type, 'SPECIALIZATION_WEIGHT')
        self.assertGreater(p.proposed_delta, 0)  # should be positive (increase weight)

    def test_category_drift_creates_proposal_only_when_drift_detected(self):
        diag = _empty_diagnostics()
        diag['care_category_drift'] = [
            {'care_category': 'Jeugd', 'drift_detected': True, 'gap': 0.05, 'recommendation': 'Verhoog X.'},
            {'care_category': 'WMO', 'drift_detected': False, 'gap': 0.30, 'recommendation': ''},
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(len(result), 1)
        self.assertIn('Jeugd', result[0].detected_issue)

    def test_provider_over_confident_creates_proposal(self):
        diag = _empty_diagnostics()
        diag['provider_drift'] = [
            {
                'provider_id': 10,
                'provider_name': 'Aanbieder X',
                'drift_type': 'over_confident',
                'mean_confidence': 0.80,
                'acceptance_rate': 0.20,
                'total': 5,
                'recommendation': 'Verlaag boost.',
            }
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(len(result), 1)
        p = result[0]
        self.assertEqual(p.source, 'provider_drift')
        self.assertEqual(p.factor_type, 'PROVIDER_RELIABILITY_BOOST')
        self.assertLess(p.proposed_delta, 0)  # negative for over-confident

    def test_provider_under_confident_creates_proposal(self):
        diag = _empty_diagnostics()
        diag['provider_drift'] = [
            {
                'provider_id': 20,
                'provider_name': 'Aanbieder Y',
                'drift_type': 'under_confident',
                'mean_confidence': 0.30,
                'acceptance_rate': 0.85,
                'total': 4,
                'recommendation': 'Verhoog gewicht.',
            }
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(len(result), 1)
        p = result[0]
        self.assertGreater(p.proposed_delta, 0)  # positive for under-confident

    def test_taxonomy_cluster_capacity_creates_proposal(self):
        diag = _empty_diagnostics()
        diag['taxonomy_clusters'] = [
            {
                'care_category': 'Jeugd',
                'dominant_reason_code': 'CAPACITY',
                'dominant_pct': 0.70,
                'total_rejections': 7,
                'recommendation': 'Gebruik capaciteitsfilter eerder.',
            }
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(len(result), 1)
        p = result[0]
        self.assertEqual(p.source, 'taxonomy_cluster')
        self.assertEqual(p.factor_type, 'CAPACITY_REJECTION_PENALTY')

    def test_taxonomy_cluster_region_mismatch_maps_to_region_weight(self):
        diag = _empty_diagnostics()
        diag['taxonomy_clusters'] = [
            {
                'care_category': 'WMO',
                'dominant_reason_code': 'REGION_MISMATCH',
                'dominant_pct': 0.50,
                'total_rejections': 5,
                'recommendation': 'Verhoog regiogewicht.',
            }
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(result[0].factor_type, 'REGION_WEIGHT')

    def test_proposals_are_not_saved_automatically(self):
        diag = _empty_diagnostics()
        diag['high_confidence_low_acceptance'] = [
            {'care_category': 'Jeugd', 'acceptance_rate': 0.10, 'total_high_conf': 4, 'severity': 'high'}
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertFalse(result[0]._saved)

    def test_actor_set_on_created_by(self):
        actor = MagicMock()
        diag = _empty_diagnostics()
        diag['high_confidence_low_acceptance'] = [
            {'care_category': 'Jeugd', 'acceptance_rate': 0.10, 'total_high_conf': 4, 'severity': 'high'}
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org, actor=actor)
        self.assertEqual(result[0].created_by, actor)

    def test_actor_none_allowed(self):
        diag = _empty_diagnostics()
        diag['high_confidence_low_acceptance'] = [
            {'care_category': 'Jeugd', 'acceptance_rate': 0.10, 'total_high_conf': 4, 'severity': 'high'}
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org, actor=None)
        self.assertIsNone(result[0].created_by)

    def test_multiple_diagnostics_generate_multiple_proposals(self):
        diag = _empty_diagnostics()
        diag['high_confidence_low_acceptance'] = [
            {'care_category': 'Jeugd', 'acceptance_rate': 0.10, 'total_high_conf': 4, 'severity': 'high'}
        ]
        diag['low_confidence_high_success'] = [
            {'care_category': 'WMO', 'success_rate': 0.80, 'total_low_conf': 4, 'severity': 'high'}
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(len(result), 2)

    def test_provider_drift_no_drift_type_skipped(self):
        diag = _empty_diagnostics()
        diag['provider_drift'] = [
            {'provider_id': 10, 'provider_name': 'X', 'drift_type': None}
        ]
        with self._patch_all():
            result = self.generate(diag, org=self.org)
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# simulate_proposal_impact
# ---------------------------------------------------------------------------

class SimulateProposalImpactTests(unittest.TestCase):
    def setUp(self):
        from contracts.intelligence_tuning import simulate_proposal_impact
        self.simulate = simulate_proposal_impact

    def _proposal(self, delta=0.10, category=None, provider=None):
        p = MockTuningProposal(proposed_delta=delta)
        if category:
            p.affected_care_category = MagicMock()
            p.affected_care_category.name = category
        else:
            p.affected_care_category = None
        p.affected_provider = provider
        return p

    def test_empty_rows_returns_zero_totals(self):
        p = self._proposal()
        result = self.simulate(p, [])
        self.assertEqual(result['total_rows'], 0)
        self.assertEqual(result['in_scope_rows'], 0)
        self.assertIsNone(result['before_mean_confidence'])
        self.assertIsNone(result['after_mean_confidence'])

    def test_delta_applied_to_all_rows_when_no_scope(self):
        p = self._proposal(delta=0.10)
        rows = [_row(conf=0.60), _row(conf=0.70), _row(conf=0.80)]
        result = self.simulate(p, rows)
        self.assertEqual(result['in_scope_rows'], 3)
        self.assertAlmostEqual(result['before_mean_confidence'], 0.7, places=2)
        self.assertAlmostEqual(result['after_mean_confidence'], 0.80, places=2)

    def test_delta_applied_only_to_matching_category(self):
        p = self._proposal(delta=0.20, category='Jeugd')
        rows = [
            _row(conf=0.60, category='Jeugd'),
            _row(conf=0.60, category='Jeugd'),
            _row(conf=0.60, category='WMO'),   # not in scope
        ]
        result = self.simulate(p, rows)
        self.assertEqual(result['in_scope_rows'], 2)
        # after: 2 Jeugd rows → 0.80, 1 WMO row → 0.60; mean = (0.80+0.80+0.60)/3
        self.assertAlmostEqual(result['after_mean_confidence'], round((0.80 + 0.80 + 0.60) / 3, 4), places=3)

    def test_confidence_clamped_to_zero_on_negative_delta(self):
        p = self._proposal(delta=-1.0)  # would push conf below 0
        rows = [_row(conf=0.30)]
        result = self.simulate(p, rows)
        self.assertEqual(result['after_mean_confidence'], 0.0)

    def test_confidence_clamped_to_one_on_large_delta(self):
        p = self._proposal(delta=2.0)
        rows = [_row(conf=0.80)]
        result = self.simulate(p, rows)
        self.assertEqual(result['after_mean_confidence'], 1.0)

    def test_high_conf_pct_computed_correctly(self):
        p = self._proposal(delta=0.15)
        rows = [_row(conf=0.60), _row(conf=0.70)]
        result = self.simulate(p, rows)
        # before: 0.60 < 0.70 threshold → 1/2 = 0.5; after: 0.75 & 0.85 → 2/2 = 1.0
        self.assertAlmostEqual(result['before_high_conf_pct'], 0.5, places=2)
        self.assertAlmostEqual(result['after_high_conf_pct'], 1.0, places=2)

    def test_none_confidence_rows_excluded_from_stats(self):
        p = self._proposal(delta=0.10)
        rows = [_row(conf=None), _row(conf=0.60)]
        result = self.simulate(p, rows)
        self.assertEqual(result['total_rows'], 1)

    def test_scope_description_includes_category(self):
        p = self._proposal(category='Jeugd')
        rows = [_row(conf=0.60, category='Jeugd')]
        result = self.simulate(p, rows)
        self.assertIn('Jeugd', result['scope_description'])

    def test_scope_description_full_dataset_when_no_scope(self):
        p = self._proposal()
        rows = [_row(conf=0.60)]
        result = self.simulate(p, rows)
        self.assertIn('Volledige dataset', result['scope_description'])

    def test_delta_applied_field_reflects_proposal_delta(self):
        p = self._proposal(delta=-0.05)
        rows = [_row(conf=0.70)]
        result = self.simulate(p, rows)
        self.assertAlmostEqual(result['delta_applied'], -0.05, places=5)

    def test_proposal_with_none_delta_treated_as_zero(self):
        p = self._proposal(delta=None)
        rows = [_row(conf=0.70)]
        result = self.simulate(p, rows)
        self.assertAlmostEqual(result['before_mean_confidence'], result['after_mean_confidence'], places=4)


if __name__ == '__main__':
    unittest.main()
