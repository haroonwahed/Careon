"""
Unit tests for contracts/intelligence_observability.py

All tests are pure Python — no database, no Django ORM required.
They exercise the aggregation functions using in-memory row dicts that
mimic the structure returned by .values() on PlacementRequest.
"""
import unittest

from contracts.intelligence_observability import (
    _bucket_label,
    _safe_rate,
    confidence_vs_acceptance,
    confidence_vs_intake,
    confidence_vs_placement,
    rejection_reason_distribution,
    repeated_rejection_patterns,
    weak_match_false_positive_rate,
)


# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------

def _make_row(
    predicted_confidence=None,
    provider_response_status="PENDING",
    provider_response_reason_code="NONE",
    placement_quality_status="PENDING",
    intake_outcome_status="PENDING",
    selected_provider_id=1,
    selected_provider__name="Aanbieder A",
    care_category="Jeugd",
    due_diligence_process__intake_outcome_status=None,
    due_diligence_process__care_category_main__name=None,
    due_diligence_process__urgency="MEDIUM",
    due_diligence_process_id=None,
) -> dict:
    return {
        "id": 1,
        "predicted_confidence": predicted_confidence,
        "provider_response_status": provider_response_status,
        "provider_response_reason_code": provider_response_reason_code,
        "placement_quality_status": placement_quality_status,
        "selected_provider_id": selected_provider_id,
        "selected_provider__name": selected_provider__name,
        "due_diligence_process__intake_outcome_status": (
            due_diligence_process__intake_outcome_status or intake_outcome_status
        ),
        "due_diligence_process__care_category_main__name": (
            due_diligence_process__care_category_main__name or care_category
        ),
        "due_diligence_process__urgency": due_diligence_process__urgency,
        "due_diligence_process_id": due_diligence_process_id,
    }


def _rows(*args, **kwargs):
    """Wrap _make_row in an iterable that also exposes .values() for
    functions that call .values() on the queryset.

    In tests we pass a plain list; the functions call list() on it,
    so a list is sufficient.
    """
    return args  # tuple acts as an iterable


# ---------------------------------------------------------------------------
# _bucket_label
# ---------------------------------------------------------------------------

class BucketLabelTests(unittest.TestCase):
    def test_high(self):
        self.assertEqual(_bucket_label(0.80), "Hoog (≥0.80)")
        self.assertEqual(_bucket_label(1.0), "Hoog (≥0.80)")
        self.assertEqual(_bucket_label(0.95), "Hoog (≥0.80)")

    def test_medium(self):
        self.assertEqual(_bucket_label(0.50), "Middel (0.50–0.79)")
        self.assertEqual(_bucket_label(0.60), "Middel (0.50–0.79)")
        self.assertEqual(_bucket_label(0.79), "Middel (0.50–0.79)")

    def test_low(self):
        self.assertEqual(_bucket_label(0.0), "Laag (<0.50)")
        self.assertEqual(_bucket_label(0.30), "Laag (<0.50)")
        self.assertEqual(_bucket_label(0.499), "Laag (<0.50)")

    def test_none_is_unknown(self):
        self.assertEqual(_bucket_label(None), "Onbekend")


# ---------------------------------------------------------------------------
# _safe_rate
# ---------------------------------------------------------------------------

class SafeRateTests(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(_safe_rate(1, 4), 0.25)

    def test_zero_denominator_returns_none(self):
        self.assertIsNone(_safe_rate(0, 0))
        self.assertIsNone(_safe_rate(5, 0))

    def test_precision(self):
        result = _safe_rate(1, 3)
        self.assertAlmostEqual(result, 0.3333, places=4)


# ---------------------------------------------------------------------------
# confidence_vs_acceptance
# ---------------------------------------------------------------------------

class ConfidenceVsAcceptanceTests(unittest.TestCase):
    def _run(self, rows):
        return confidence_vs_acceptance(placement_qs=rows)

    def test_high_bucket_accepted(self):
        rows = [
            _make_row(predicted_confidence=0.85, provider_response_status="ACCEPTED"),
            _make_row(predicted_confidence=0.90, provider_response_status="ACCEPTED"),
            _make_row(predicted_confidence=0.92, provider_response_status="REJECTED"),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        bucket = result["Hoog (≥0.80)"]
        self.assertEqual(bucket["total"], 3)
        self.assertEqual(bucket["accepted"], 2)
        self.assertAlmostEqual(bucket["acceptance_rate"], 2 / 3, places=4)

    def test_low_bucket_zero_acceptance(self):
        rows = [
            _make_row(predicted_confidence=0.2, provider_response_status="REJECTED"),
            _make_row(predicted_confidence=0.3, provider_response_status="NO_CAPACITY"),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        self.assertEqual(result["Laag (<0.50)"]["accepted"], 0)
        self.assertEqual(result["Laag (<0.50)"]["acceptance_rate"], 0.0)

    def test_unknown_bucket_for_none_confidence(self):
        rows = [
            _make_row(predicted_confidence=None, provider_response_status="ACCEPTED"),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        self.assertEqual(result["Onbekend"]["total"], 1)
        self.assertEqual(result["Onbekend"]["accepted"], 1)

    def test_empty_rows_returns_zero_counts(self):
        result = self._run([])
        for bucket in result:
            self.assertEqual(bucket["total"], 0)
            self.assertIsNone(bucket["acceptance_rate"])

    def test_all_four_buckets_present(self):
        result = self._run([])
        labels = {r["label"] for r in result}
        self.assertIn("Hoog (≥0.80)", labels)
        self.assertIn("Middel (0.50–0.79)", labels)
        self.assertIn("Laag (<0.50)", labels)
        self.assertIn("Onbekend", labels)

    def test_mixed_buckets(self):
        rows = [
            _make_row(predicted_confidence=0.9, provider_response_status="ACCEPTED"),
            _make_row(predicted_confidence=0.6, provider_response_status="ACCEPTED"),
            _make_row(predicted_confidence=0.3, provider_response_status="REJECTED"),
            _make_row(predicted_confidence=None, provider_response_status="PENDING"),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        self.assertEqual(result["Hoog (≥0.80)"]["total"], 1)
        self.assertEqual(result["Middel (0.50–0.79)"]["total"], 1)
        self.assertEqual(result["Laag (<0.50)"]["total"], 1)
        self.assertEqual(result["Onbekend"]["total"], 1)


# ---------------------------------------------------------------------------
# confidence_vs_placement
# ---------------------------------------------------------------------------

class ConfidenceVsPlacementTests(unittest.TestCase):
    def _run(self, rows):
        return confidence_vs_placement(placement_qs=rows)

    def test_high_bucket_good_fit(self):
        rows = [
            _make_row(predicted_confidence=0.85, placement_quality_status="GOOD_FIT"),
            _make_row(predicted_confidence=0.88, placement_quality_status="AT_RISK"),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        self.assertEqual(result["Hoog (≥0.80)"]["successful"], 1)
        self.assertAlmostEqual(result["Hoog (≥0.80)"]["success_rate"], 0.5, places=4)

    def test_no_good_fit_returns_zero_rate(self):
        rows = [
            _make_row(predicted_confidence=0.4, placement_quality_status="BROKEN_DOWN"),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        self.assertEqual(result["Laag (<0.50)"]["success_rate"], 0.0)

    def test_empty_rows(self):
        result = self._run([])
        for bucket in result:
            self.assertEqual(bucket["total"], 0)


# ---------------------------------------------------------------------------
# confidence_vs_intake
# ---------------------------------------------------------------------------

class ConfidenceVsIntakeTests(unittest.TestCase):
    def _run(self, rows):
        return confidence_vs_intake(placement_qs=rows)

    def test_completed_intake_counted(self):
        rows = [
            _make_row(
                predicted_confidence=0.70,
                due_diligence_process__intake_outcome_status="COMPLETED",
            ),
            _make_row(
                predicted_confidence=0.65,
                due_diligence_process__intake_outcome_status="NO_SHOW",
            ),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        self.assertEqual(result["Middel (0.50–0.79)"]["intake_started"], 1)
        self.assertAlmostEqual(result["Middel (0.50–0.79)"]["intake_rate"], 0.5, places=4)

    def test_no_completed_intakes_rate_zero(self):
        rows = [
            _make_row(predicted_confidence=0.20, due_diligence_process__intake_outcome_status="PENDING"),
        ]
        result = {r["label"]: r for r in self._run(rows)}
        self.assertEqual(result["Laag (<0.50)"]["intake_rate"], 0.0)


# ---------------------------------------------------------------------------
# rejection_reason_distribution
# ---------------------------------------------------------------------------

class RejectionReasonDistributionTests(unittest.TestCase):
    def _run(self, rows, care_category=None):
        return rejection_reason_distribution(placement_qs=rows, care_category=care_category)

    def test_counts_by_reason(self):
        rows = [
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY", care_category="Jeugd"),
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY", care_category="Jeugd"),
            _make_row(provider_response_status="NO_CAPACITY", provider_response_reason_code="REGION_MISMATCH", care_category="Jeugd"),
            _make_row(provider_response_status="ACCEPTED", provider_response_reason_code="NONE", care_category="Jeugd"),
        ]
        result = self._run(rows)
        # Only 3 rejected rows counted
        totals = {r["reason_code"]: r["count"] for r in result}
        self.assertEqual(totals["CAPACITY"], 2)
        self.assertEqual(totals["REGION_MISMATCH"], 1)
        self.assertNotIn("NONE", totals)  # ACCEPTED not included

    def test_pct_of_rejections_sums_to_100(self):
        rows = [
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="REGION_MISMATCH"),
        ]
        result = self._run(rows)
        total_pct = sum(r["pct_of_rejections"] or 0 for r in result)
        self.assertAlmostEqual(total_pct, 1.0, places=4)

    def test_filter_by_care_category(self):
        rows = [
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY", care_category="Jeugd"),
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY", care_category="WMO"),
        ]
        result_jeugd = self._run(rows, care_category="Jeugd")
        result_wmo = self._run(rows, care_category="WMO")
        self.assertEqual(len(result_jeugd), 1)
        self.assertEqual(len(result_wmo), 1)

    def test_empty_rows_returns_empty_list(self):
        self.assertEqual(self._run([]), [])

    def test_no_rejections_returns_empty_list(self):
        rows = [
            _make_row(provider_response_status="ACCEPTED"),
            _make_row(provider_response_status="PENDING"),
        ]
        self.assertEqual(self._run(rows), [])

    def test_sorted_by_count_descending(self):
        rows = [
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="REGION_MISMATCH"),
        ]
        result = self._run(rows)
        self.assertEqual(result[0]["reason_code"], "CAPACITY")
        self.assertEqual(result[0]["count"], 3)


# ---------------------------------------------------------------------------
# repeated_rejection_patterns
# ---------------------------------------------------------------------------

class RepeatedRejectionPatternsTests(unittest.TestCase):
    def _run(self, rows, min_rejections=2):
        return repeated_rejection_patterns(placement_qs=rows, min_rejections=min_rejections)

    def _make_rejection(self, case_id, provider_id, reason="CAPACITY", provider_name="A"):
        r = _make_row(
            provider_response_status="REJECTED",
            provider_response_reason_code=reason,
            selected_provider_id=provider_id,
            selected_provider__name=provider_name,
        )
        r["due_diligence_process_id"] = case_id
        return r

    def test_basic_repeated_rejection(self):
        rows = [
            self._make_rejection(case_id=1, provider_id=10, reason="CAPACITY"),
            self._make_rejection(case_id=1, provider_id=10, reason="CAPACITY"),
            self._make_rejection(case_id=1, provider_id=10, reason="REGION_MISMATCH"),
        ]
        result = self._run(rows)
        self.assertEqual(len(result), 1)
        entry = result[0]
        self.assertEqual(entry["case_id"], 1)
        self.assertEqual(entry["provider_id"], 10)
        self.assertEqual(entry["rejection_count"], 3)
        self.assertIn("CAPACITY", entry["reason_codes"])
        self.assertIn("REGION_MISMATCH", entry["reason_codes"])

    def test_single_rejection_excluded(self):
        rows = [self._make_rejection(case_id=5, provider_id=20)]
        result = self._run(rows)
        self.assertEqual(result, [])

    def test_min_rejections_threshold(self):
        rows = [
            self._make_rejection(case_id=2, provider_id=30),
            self._make_rejection(case_id=2, provider_id=30),
        ]
        result_2 = self._run(rows, min_rejections=2)
        result_3 = self._run(rows, min_rejections=3)
        self.assertEqual(len(result_2), 1)
        self.assertEqual(result_3, [])

    def test_different_providers_tracked_separately(self):
        rows = [
            self._make_rejection(case_id=1, provider_id=10, provider_name="A"),
            self._make_rejection(case_id=1, provider_id=10, provider_name="A"),
            self._make_rejection(case_id=1, provider_id=20, provider_name="B"),
            self._make_rejection(case_id=1, provider_id=20, provider_name="B"),
        ]
        result = self._run(rows)
        self.assertEqual(len(result), 2)

    def test_sorted_by_count_descending(self):
        rows = [
            self._make_rejection(case_id=1, provider_id=10),
            self._make_rejection(case_id=1, provider_id=10),
            self._make_rejection(case_id=1, provider_id=10),
            self._make_rejection(case_id=2, provider_id=20),
            self._make_rejection(case_id=2, provider_id=20),
        ]
        result = self._run(rows)
        self.assertEqual(result[0]["rejection_count"], 3)
        self.assertEqual(result[1]["rejection_count"], 2)

    def test_reason_codes_are_unique_sorted(self):
        rows = [
            self._make_rejection(case_id=1, provider_id=10, reason="CAPACITY"),
            self._make_rejection(case_id=1, provider_id=10, reason="CAPACITY"),
            self._make_rejection(case_id=1, provider_id=10, reason="REGION_MISMATCH"),
        ]
        result = self._run(rows)
        codes = result[0]["reason_codes"]
        self.assertEqual(codes, sorted(set(codes)))

    def test_empty_rows_returns_empty(self):
        self.assertEqual(self._run([]), [])


# ---------------------------------------------------------------------------
# weak_match_false_positive_rate
# ---------------------------------------------------------------------------

class WeakMatchFalsePositiveRateTests(unittest.TestCase):
    def _run(self, rows):
        return weak_match_false_positive_rate(placement_qs=rows)

    def test_no_confidence_records_returns_zeros(self):
        rows = [
            _make_row(predicted_confidence=None),
        ]
        result = self._run(rows)
        self.assertEqual(result["total_with_confidence"], 0)
        self.assertEqual(result["weak_match_flagged"], 0)
        self.assertIsNone(result["false_positive_rate"])

    def test_false_positive_accepted_and_good_fit(self):
        rows = [
            _make_row(
                predicted_confidence=0.3,
                provider_response_status="ACCEPTED",
                placement_quality_status="GOOD_FIT",
            ),
        ]
        result = self._run(rows)
        self.assertEqual(result["weak_match_flagged"], 1)
        self.assertEqual(result["false_positives"], 1)
        self.assertEqual(result["true_positives"], 0)
        self.assertEqual(result["false_positive_rate"], 1.0)

    def test_true_positive_rejected(self):
        rows = [
            _make_row(
                predicted_confidence=0.2,
                provider_response_status="REJECTED",
                placement_quality_status="PENDING",
            ),
        ]
        result = self._run(rows)
        self.assertEqual(result["weak_match_flagged"], 1)
        self.assertEqual(result["false_positives"], 0)
        self.assertEqual(result["true_positives"], 1)
        self.assertEqual(result["true_positive_rate"], 1.0)
        self.assertEqual(result["false_positive_rate"], 0.0)

    def test_above_threshold_not_flagged(self):
        rows = [
            _make_row(
                predicted_confidence=0.75,
                provider_response_status="REJECTED",
                placement_quality_status="PENDING",
            ),
        ]
        result = self._run(rows)
        self.assertEqual(result["total_with_confidence"], 1)
        self.assertEqual(result["weak_match_flagged"], 0)
        self.assertIsNone(result["false_positive_rate"])

    def test_mixed_cases(self):
        rows = [
            # Weak match FP: flagged but succeeded
            _make_row(predicted_confidence=0.3, provider_response_status="ACCEPTED", placement_quality_status="GOOD_FIT"),
            # Weak match TP: flagged and failed
            _make_row(predicted_confidence=0.4, provider_response_status="REJECTED", placement_quality_status="PENDING"),
            # High confidence: not flagged
            _make_row(predicted_confidence=0.9, provider_response_status="ACCEPTED", placement_quality_status="GOOD_FIT"),
            # No confidence: excluded
            _make_row(predicted_confidence=None, provider_response_status="REJECTED", placement_quality_status="PENDING"),
        ]
        result = self._run(rows)
        self.assertEqual(result["total_with_confidence"], 3)
        self.assertEqual(result["weak_match_flagged"], 2)
        self.assertEqual(result["false_positives"], 1)
        self.assertEqual(result["true_positives"], 1)
        self.assertAlmostEqual(result["false_positive_rate"], 0.5, places=4)
        self.assertAlmostEqual(result["true_positive_rate"], 0.5, places=4)

    def test_empty_rows_returns_zeros(self):
        result = self._run([])
        self.assertEqual(result["total_with_confidence"], 0)
        self.assertIsNone(result["false_positive_rate"])


# ---------------------------------------------------------------------------
# Calibration consistency: higher confidence → higher acceptance rate
# ---------------------------------------------------------------------------

class ConfidenceCalibrationConsistencyTests(unittest.TestCase):
    """Verify that the bucketing logic is monotonic when data supports it."""

    def test_high_bucket_better_than_low_bucket_acceptance(self):
        rows = [
            # High confidence, mostly accepted
            _make_row(predicted_confidence=0.85, provider_response_status="ACCEPTED"),
            _make_row(predicted_confidence=0.90, provider_response_status="ACCEPTED"),
            _make_row(predicted_confidence=0.88, provider_response_status="ACCEPTED"),
            # Low confidence, mostly rejected
            _make_row(predicted_confidence=0.2, provider_response_status="REJECTED"),
            _make_row(predicted_confidence=0.3, provider_response_status="REJECTED"),
            _make_row(predicted_confidence=0.4, provider_response_status="ACCEPTED"),
        ]
        result = {r["label"]: r for r in confidence_vs_acceptance(placement_qs=rows)}
        high_rate = result["Hoog (≥0.80)"]["acceptance_rate"]
        low_rate = result["Laag (<0.50)"]["acceptance_rate"]
        self.assertGreater(high_rate, low_rate)

    def test_rejection_reason_distribution_all_entry_fields_present(self):
        rows = [
            _make_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
        ]
        result = rejection_reason_distribution(placement_qs=rows)
        entry = result[0]
        for key in ("reason_code", "care_category", "provider_name", "count", "pct_of_rejections"):
            self.assertIn(key, entry, f"Missing key '{key}' in rejection distribution entry")


if __name__ == "__main__":
    unittest.main()
