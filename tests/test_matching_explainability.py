"""
Tests for matching explainability: factor_breakdown, warning_flags,
verification_guidance, trade_offs, and confidence per provider recommendation.

All tests are unit-level (no HTTP) so they are unaffected by the SPA middleware.
"""

from django.test import TestCase

from contracts.views import _build_matching_explanation, _build_canonical_factor_breakdown, _build_canonical_warning_flags
from contracts.models import MatchResultaat


class ExplanationFactorBreakdownTests(TestCase):
    """factor_breakdown list must cover all 7 required criteria."""

    REQUIRED_KEYS = {'care_form', 'urgency', 'specialization', 'region', 'capacity', 'complexity', 'special_needs'}

    def _build(self, **kwargs):
        defaults = dict(
            match_score=70,
            category_match=True,
            urgency_match=True,
            care_form_match=True,
            region_match=True,
            region_type_match=False,
            free_slots=2,
            average_wait_days=14,
            specialization_summary='Ambulant',
            tradeoff='',
        )
        defaults.update(kwargs)
        return _build_matching_explanation(**defaults)

    def test_factor_breakdown_present(self):
        expl = self._build()
        self.assertIn('factor_breakdown', expl)
        self.assertIsInstance(expl['factor_breakdown'], list)

    def test_factor_breakdown_covers_all_7_criteria(self):
        expl = self._build()
        keys = {f['key'] for f in expl['factor_breakdown']}
        self.assertTrue(self.REQUIRED_KEYS.issubset(keys), f"Missing keys: {self.REQUIRED_KEYS - keys}")

    def test_care_form_match_status(self):
        expl = self._build(care_form_match=True)
        cf = next(f for f in expl['factor_breakdown'] if f['key'] == 'care_form')
        self.assertEqual(cf['status'], 'match')

    def test_care_form_no_match_status(self):
        expl = self._build(care_form_match=False)
        cf = next(f for f in expl['factor_breakdown'] if f['key'] == 'care_form')
        self.assertEqual(cf['status'], 'review')

    def test_urgency_match_status(self):
        expl = self._build(urgency_match=True)
        u = next(f for f in expl['factor_breakdown'] if f['key'] == 'urgency')
        self.assertEqual(u['status'], 'match')

    def test_region_exact_status(self):
        expl = self._build(region_match=True, region_type_match=False)
        r = next(f for f in expl['factor_breakdown'] if f['key'] == 'region')
        self.assertEqual(r['status'], 'exact')

    def test_region_compatible_status(self):
        expl = self._build(region_match=False, region_type_match=True)
        r = next(f for f in expl['factor_breakdown'] if f['key'] == 'region')
        self.assertEqual(r['status'], 'compatible')

    def test_region_review_status(self):
        expl = self._build(region_match=False, region_type_match=False)
        r = next(f for f in expl['factor_breakdown'] if f['key'] == 'region')
        self.assertEqual(r['status'], 'review')

    def test_capacity_available_when_free_slots(self):
        expl = self._build(free_slots=5)
        c = next(f for f in expl['factor_breakdown'] if f['key'] == 'capacity')
        self.assertEqual(c['status'], 'available')

    def test_capacity_limited_when_few_free_slots(self):
        expl = self._build(free_slots=2)
        c = next(f for f in expl['factor_breakdown'] if f['key'] == 'capacity')
        self.assertEqual(c['status'], 'limited')

    def test_complexity_match_status(self):
        expl = self._build(complexity_match=True)
        cx = next(f for f in expl['factor_breakdown'] if f['key'] == 'complexity')
        self.assertEqual(cx['status'], 'match')

    def test_complexity_review_when_not_matched(self):
        expl = self._build(complexity_match=False)
        cx = next(f for f in expl['factor_breakdown'] if f['key'] == 'complexity')
        self.assertEqual(cx['status'], 'review')

    def test_special_needs_ok_status(self):
        expl = self._build(special_needs_ok=True)
        sn = next(f for f in expl['factor_breakdown'] if f['key'] == 'special_needs')
        self.assertEqual(sn['status'], 'ok')

    def test_special_needs_warning_status(self):
        expl = self._build(special_needs_ok=False)
        sn = next(f for f in expl['factor_breakdown'] if f['key'] == 'special_needs')
        self.assertEqual(sn['status'], 'warning')

    def test_each_factor_has_name_and_detail(self):
        expl = self._build()
        for factor in expl['factor_breakdown']:
            self.assertIn('name', factor, f"Factor {factor['key']} missing 'name'")
            self.assertIn('detail', factor, f"Factor {factor['key']} missing 'detail'")
            self.assertTrue(factor['name'], f"Factor {factor['key']} has empty 'name'")
            self.assertTrue(factor['detail'], f"Factor {factor['key']} has empty 'detail'")

    def test_backward_compatible_factors_dict_still_present(self):
        expl = self._build()
        self.assertIn('factors', expl)
        self.assertIsInstance(expl['factors'], dict)
        for key in self.REQUIRED_KEYS:
            self.assertIn(key, expl['factors'], f"'factors' dict missing key: {key}")


class ExplanationWarningFlagsTests(TestCase):
    """warning_flags must surface weak or risky conditions clearly."""

    def _build(self, **kwargs):
        defaults = dict(
            match_score=70,
            category_match=True,
            urgency_match=True,
            care_form_match=True,
            region_match=True,
            region_type_match=False,
            free_slots=2,
            average_wait_days=14,
            specialization_summary='Ambulant',
            tradeoff='',
        )
        defaults.update(kwargs)
        return _build_matching_explanation(**defaults)

    def test_warning_flags_key_present(self):
        expl = self._build()
        self.assertIn('warning_flags', expl)
        self.assertIsInstance(expl['warning_flags'], list)

    def test_no_flags_for_strong_match(self):
        expl = self._build(
            match_score=85,
            urgency_match=True,
            region_match=True,
            region_type_match=False,
            free_slots=3,
            special_needs_ok=True,
        )
        self.assertEqual(expl['warning_flags'], [])

    def test_low_confidence_flag(self):
        expl = self._build(match_score=30, urgency_match=False, region_match=False, region_type_match=False)
        flags_text = ' '.join(expl['warning_flags'])
        self.assertIn('Lage confidence', flags_text)

    def test_no_capacity_flag(self):
        expl = self._build(free_slots=0, match_score=30)
        flags_text = ' '.join(expl['warning_flags'])
        self.assertIn('capaciteit', flags_text.lower())

    def test_urgency_mismatch_flag(self):
        expl = self._build(urgency_match=False)
        flags_text = ' '.join(expl['warning_flags'])
        self.assertIn('Urgentie', flags_text)

    def test_no_region_match_flag(self):
        expl = self._build(region_match=False, region_type_match=False, match_score=30)
        flags_text = ' '.join(expl['warning_flags'])
        self.assertIn('regiomatch', flags_text.lower())

    def test_special_needs_flag(self):
        expl = self._build(special_needs_ok=False)
        flags_text = ' '.join(expl['warning_flags'])
        self.assertIn('Bijzondere', flags_text)


class ExplanationTradeOffsTests(TestCase):
    """trade_offs must be explicit and scenario-specific, not generic."""

    def _build(self, **kwargs):
        defaults = dict(
            match_score=70,
            category_match=True,
            urgency_match=True,
            care_form_match=True,
            region_match=True,
            region_type_match=False,
            free_slots=2,
            average_wait_days=14,
            specialization_summary='Ambulant',
            tradeoff='',
        )
        defaults.update(kwargs)
        return _build_matching_explanation(**defaults)

    def test_trade_offs_key_present(self):
        expl = self._build()
        self.assertIn('trade_offs', expl)

    def test_correct_zorgvorm_but_no_capacity_trade_off(self):
        expl = self._build(care_form_match=True, free_slots=0)
        self.assertTrue(any('zorgvorm' in t.lower() and 'capaciteit' in t.lower() for t in expl['trade_offs']))

    def test_region_compatible_but_not_exact_trade_off(self):
        expl = self._build(region_match=False, region_type_match=True)
        self.assertTrue(any('regiomatch' in t.lower() for t in expl['trade_offs']))

    def test_strong_category_but_slow_wait_trade_off(self):
        expl = self._build(category_match=True, average_wait_days=45, care_form_match=False, region_match=False, region_type_match=False)
        self.assertTrue(any('wachttijd' in t.lower() for t in expl['trade_offs']))

    def test_explicit_tradeoff_argument_is_appended(self):
        expl = self._build(tradeoff='Goede totaalfit maar urgentierisico aanwezig')
        self.assertIn('Goede totaalfit maar urgentierisico aanwezig', expl['trade_offs'])


class ExplanationVerificationGuidanceTests(TestCase):
    """verification_guidance must tell operators what to confirm before placement."""

    def _build(self, **kwargs):
        defaults = dict(
            match_score=70,
            category_match=True,
            urgency_match=True,
            care_form_match=True,
            region_match=True,
            region_type_match=False,
            free_slots=2,
            average_wait_days=14,
            specialization_summary='Ambulant',
            tradeoff='',
        )
        defaults.update(kwargs)
        return _build_matching_explanation(**defaults)

    def test_verification_guidance_key_present(self):
        expl = self._build()
        self.assertIn('verification_guidance', expl)
        self.assertIsInstance(expl['verification_guidance'], list)
        self.assertTrue(expl['verification_guidance'], "verification_guidance must not be empty")

    def test_verify_manually_alias_equals_verification_guidance(self):
        expl = self._build()
        self.assertEqual(expl['verify_manually'], expl['verification_guidance'])

    def test_no_region_match_triggers_verification(self):
        expl = self._build(region_match=False, region_type_match=False)
        combined = ' '.join(expl['verification_guidance'])
        self.assertIn('regio', combined.lower())

    def test_no_capacity_triggers_intake_slot_verification(self):
        expl = self._build(free_slots=0)
        combined = ' '.join(expl['verification_guidance'])
        self.assertIn('intakeslot', combined.lower())

    def test_urgency_mismatch_triggers_urgency_verification(self):
        expl = self._build(urgency_match=False)
        combined = ' '.join(expl['verification_guidance'])
        self.assertIn('urgentieniveau', combined.lower())

    def test_special_needs_not_ok_triggers_verification(self):
        expl = self._build(special_needs_ok=False)
        combined = ' '.join(expl['verification_guidance'])
        self.assertIn('bijzondere', combined.lower())


class ExplanationConfidenceTests(TestCase):
    """Confidence must be structured: high/medium/low."""

    def _build(self, **kwargs):
        defaults = dict(
            match_score=70,
            category_match=True,
            urgency_match=True,
            care_form_match=True,
            region_match=True,
            region_type_match=False,
            free_slots=2,
            average_wait_days=14,
            specialization_summary='Ambulant',
            tradeoff='',
        )
        defaults.update(kwargs)
        return _build_matching_explanation(**defaults)

    def test_high_confidence_for_strong_match(self):
        expl = self._build(match_score=85, free_slots=3, care_form_match=True, urgency_match=True)
        self.assertEqual(expl['confidence'], 'high')

    def test_medium_confidence_for_partial_match(self):
        expl = self._build(match_score=60, free_slots=0)
        self.assertEqual(expl['confidence'], 'medium')

    def test_low_confidence_for_weak_match(self):
        expl = self._build(match_score=40)
        self.assertEqual(expl['confidence'], 'low')

    def test_confidence_reason_present(self):
        expl = self._build()
        self.assertIn('confidence_reason', expl)
        self.assertTrue(expl['confidence_reason'])


class CanonicalFactorBreakdownTests(TestCase):
    """_build_canonical_factor_breakdown derives factors from MatchResultaat scores."""

    def _make_result(self, **score_overrides):
        result = MatchResultaat.__new__(MatchResultaat)
        result.score_inhoudelijke_fit = score_overrides.get('score_inhoudelijke_fit', 20.0)
        result.score_capaciteit_wachttijd_fit = score_overrides.get('score_capaciteit_wachttijd_fit', 15.0)
        result.score_capaciteit = score_overrides.get('score_capaciteit', 15.0)
        result.score_regio_contract_fit = score_overrides.get('score_regio_contract_fit', 12.0)
        result.score_contract_regio = score_overrides.get('score_contract_regio', 12.0)
        result.score_complexiteit_veiligheid_fit = score_overrides.get('score_complexiteit_veiligheid_fit', 10.0)
        result.score_complexiteit = score_overrides.get('score_complexiteit', 10.0)
        result.score_performance_fit = score_overrides.get('score_performance_fit', 7.0)
        result.score_performance = score_overrides.get('score_performance', 7.0)
        result.confidence_label = score_overrides.get('confidence_label', 'HOOG')
        return result

    def test_returns_list(self):
        result = self._make_result()
        breakdown = _build_canonical_factor_breakdown(result)
        self.assertIsInstance(breakdown, list)

    def test_covers_all_required_keys(self):
        result = self._make_result()
        breakdown = _build_canonical_factor_breakdown(result)
        keys = {f['key'] for f in breakdown}
        required = {'care_form', 'urgency', 'specialization', 'region', 'capacity', 'complexity', 'special_needs'}
        self.assertTrue(required.issubset(keys))

    def test_specialization_match_when_high_score(self):
        result = self._make_result(score_inhoudelijke_fit=22.0)
        breakdown = _build_canonical_factor_breakdown(result)
        spec = next(f for f in breakdown if f['key'] == 'specialization')
        self.assertEqual(spec['status'], 'match')

    def test_region_exact_when_high_score(self):
        result = self._make_result(score_regio_contract_fit=12.0)
        breakdown = _build_canonical_factor_breakdown(result)
        region = next(f for f in breakdown if f['key'] == 'region')
        self.assertEqual(region['status'], 'exact')

    def test_region_review_when_low_score(self):
        result = self._make_result(score_regio_contract_fit=4.0, score_contract_regio=4.0)
        breakdown = _build_canonical_factor_breakdown(result)
        region = next(f for f in breakdown if f['key'] == 'region')
        self.assertEqual(region['status'], 'review')

    def test_capacity_available_when_high_score(self):
        result = self._make_result(score_capaciteit_wachttijd_fit=15.0, score_capaciteit=15.0)
        breakdown = _build_canonical_factor_breakdown(result)
        cap = next(f for f in breakdown if f['key'] == 'capacity')
        self.assertEqual(cap['status'], 'available')


class CanonicalWarningFlagsTests(TestCase):
    """_build_canonical_warning_flags derives warnings from MatchResultaat."""

    def _make_result(self, **overrides):
        result = MatchResultaat.__new__(MatchResultaat)
        result.score_capaciteit_wachttijd_fit = overrides.get('score_capaciteit_wachttijd_fit', 15.0)
        result.score_capaciteit = overrides.get('score_capaciteit', 15.0)
        result.score_complexiteit_veiligheid_fit = overrides.get('score_complexiteit_veiligheid_fit', 10.0)
        result.score_complexiteit = overrides.get('score_complexiteit', 10.0)
        result.score_regio_contract_fit = overrides.get('score_regio_contract_fit', 12.0)
        result.score_contract_regio = overrides.get('score_contract_regio', 12.0)
        result.confidence_label = overrides.get('confidence_label', 'HOOG')
        return result

    def test_returns_list(self):
        result = self._make_result()
        flags = _build_canonical_warning_flags(result)
        self.assertIsInstance(flags, list)

    def test_no_flags_for_strong_result(self):
        result = self._make_result(
            confidence_label='HOOG',
            score_capaciteit_wachttijd_fit=15.0,
            score_complexiteit_veiligheid_fit=12.0,
            score_regio_contract_fit=12.0,
        )
        flags = _build_canonical_warning_flags(result)
        self.assertEqual(flags, [])

    def test_low_confidence_flag(self):
        result = self._make_result(confidence_label='ONZEKER')
        flags = _build_canonical_warning_flags(result)
        self.assertTrue(any('confidence' in f.lower() for f in flags))

    def test_low_capacity_score_flag(self):
        result = self._make_result(
            score_capaciteit_wachttijd_fit=4.0,
            score_capaciteit=4.0,
        )
        flags = _build_canonical_warning_flags(result)
        self.assertTrue(any('capaciteit' in f.lower() for f in flags))

    def test_low_region_score_flag(self):
        result = self._make_result(
            score_regio_contract_fit=2.0,
            score_contract_regio=2.0,
        )
        flags = _build_canonical_warning_flags(result)
        self.assertTrue(any('regio' in f.lower() for f in flags))
