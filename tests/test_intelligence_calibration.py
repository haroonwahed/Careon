"""
Unit tests for contracts/intelligence_calibration.py

Pure Python — no database, no Django ORM.
Uses in-memory row dicts that mimic PlacementRequest.objects.values() output.
"""
import unittest

from contracts.intelligence_calibration import (
    _cluster_recommendation,
    _safe_rate,
    calibration_diagnostics,
    calibration_recommendations,
    care_category_calibration_drift,
    high_confidence_low_acceptance_mismatches,
    low_confidence_high_success_mismatches,
    provider_calibration_drift,
    rejection_taxonomy_clusters,
)

# ---------------------------------------------------------------------------
# Fixture helpers
# ---------------------------------------------------------------------------

def _row(
    predicted_confidence=None,
    provider_response_status="PENDING",
    provider_response_reason_code="NONE",
    placement_quality_status="PENDING",
    care_category="Jeugd",
    provider_id=1,
    provider_name="Aanbieder A",
    intake_status="PENDING",
) -> dict:
    return {
        "id": 1,
        "predicted_confidence": predicted_confidence,
        "provider_response_status": provider_response_status,
        "provider_response_reason_code": provider_response_reason_code,
        "placement_quality_status": placement_quality_status,
        "selected_provider_id": provider_id,
        "selected_provider__name": provider_name,
        "due_diligence_process__care_category_main__name": care_category,
        "due_diligence_process__intake_outcome_status": intake_status,
        "due_diligence_process__urgency": "MEDIUM",
        "due_diligence_process_id": None,
    }


def _high_conf_rejected(care_category="Jeugd", n=4):
    """n high-confidence placements all rejected — mismatch scenario."""
    return [
        _row(predicted_confidence=0.85, provider_response_status="REJECTED", care_category=care_category)
        for _ in range(n)
    ]


def _low_conf_success(care_category="WMO", n=4):
    """n low-confidence placements all GOOD_FIT — mismatch scenario."""
    return [
        _row(predicted_confidence=0.30, provider_response_status="ACCEPTED",
             placement_quality_status="GOOD_FIT", care_category=care_category)
        for _ in range(n)
    ]


# ---------------------------------------------------------------------------
# high_confidence_low_acceptance_mismatches
# ---------------------------------------------------------------------------

class HighConfLowAcceptTests(unittest.TestCase):
    def test_mismatch_detected_when_acceptance_below_50_pct(self):
        rows = _high_conf_rejected("Jeugd", n=4)
        result = high_confidence_low_acceptance_mismatches(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["care_category"], "Jeugd")
        self.assertEqual(result[0]["acceptance_rate"], 0.0)
        self.assertEqual(result[0]["severity"], "high")

    def test_no_mismatch_when_acceptance_above_threshold(self):
        rows = [
            _row(predicted_confidence=0.85, provider_response_status="ACCEPTED"),
            _row(predicted_confidence=0.90, provider_response_status="ACCEPTED"),
            _row(predicted_confidence=0.88, provider_response_status="ACCEPTED"),
        ]
        result = high_confidence_low_acceptance_mismatches(rows)
        self.assertEqual(result, [])

    def test_below_min_sample_excluded(self):
        rows = _high_conf_rejected("Jeugd", n=2)  # only 2 — below _MIN_SAMPLE_SIZE=3
        result = high_confidence_low_acceptance_mismatches(rows)
        self.assertEqual(result, [])

    def test_severity_medium_when_25_to_50_pct(self):
        # 1 accepted, 3 rejected → 25 % acceptance rate → "medium" (0.25 ≤ rate < 0.50)
        rows = [
            _row(predicted_confidence=0.80, provider_response_status="ACCEPTED"),
            _row(predicted_confidence=0.80, provider_response_status="REJECTED"),
            _row(predicted_confidence=0.80, provider_response_status="REJECTED"),
            _row(predicted_confidence=0.80, provider_response_status="REJECTED"),
        ]
        result = high_confidence_low_acceptance_mismatches(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["severity"], "medium")

    def test_multiple_categories_detected_independently(self):
        rows = _high_conf_rejected("Jeugd", 4) + _high_conf_rejected("WMO", 4)
        result = high_confidence_low_acceptance_mismatches(rows)
        categories = {r["care_category"] for r in result}
        self.assertIn("Jeugd", categories)
        self.assertIn("WMO", categories)

    def test_rows_below_confidence_threshold_ignored(self):
        # confidence 0.60 is below _HIGH_CONF_THRESHOLD (0.70) — should not be flagged
        rows = [
            _row(predicted_confidence=0.60, provider_response_status="REJECTED")
            for _ in range(5)
        ]
        result = high_confidence_low_acceptance_mismatches(rows)
        self.assertEqual(result, [])

    def test_none_confidence_rows_ignored(self):
        rows = [_row(predicted_confidence=None, provider_response_status="REJECTED") for _ in range(5)]
        result = high_confidence_low_acceptance_mismatches(rows)
        self.assertEqual(result, [])

    def test_empty_rows_returns_empty(self):
        self.assertEqual(high_confidence_low_acceptance_mismatches([]), [])


# ---------------------------------------------------------------------------
# low_confidence_high_success_mismatches
# ---------------------------------------------------------------------------

class LowConfHighSuccessTests(unittest.TestCase):
    def test_mismatch_detected_when_success_above_60_pct(self):
        rows = _low_conf_success("WMO", n=4)
        result = low_confidence_high_success_mismatches(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["care_category"], "WMO")
        self.assertEqual(result[0]["success_rate"], 1.0)
        self.assertEqual(result[0]["severity"], "high")

    def test_no_mismatch_when_success_below_threshold(self):
        rows = [
            _row(predicted_confidence=0.3, provider_response_status="REJECTED",
                 placement_quality_status="BROKEN_DOWN")
            for _ in range(4)
        ]
        result = low_confidence_high_success_mismatches(rows)
        self.assertEqual(result, [])

    def test_below_min_sample_excluded(self):
        rows = _low_conf_success("Jeugd", n=2)
        result = low_confidence_high_success_mismatches(rows)
        self.assertEqual(result, [])

    def test_severity_medium_60_to_80_pct(self):
        # 3 GOOD_FIT, 2 not → 60 % → medium
        rows = [
            _row(predicted_confidence=0.3, placement_quality_status="GOOD_FIT"),
            _row(predicted_confidence=0.3, placement_quality_status="GOOD_FIT"),
            _row(predicted_confidence=0.3, placement_quality_status="GOOD_FIT"),
            _row(predicted_confidence=0.3, placement_quality_status="BROKEN_DOWN"),
            _row(predicted_confidence=0.3, placement_quality_status="BROKEN_DOWN"),
        ]
        result = low_confidence_high_success_mismatches(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["severity"], "medium")

    def test_high_confidence_rows_ignored(self):
        rows = [
            _row(predicted_confidence=0.85, placement_quality_status="GOOD_FIT")
            for _ in range(5)
        ]
        result = low_confidence_high_success_mismatches(rows)
        self.assertEqual(result, [])

    def test_empty_rows_returns_empty(self):
        self.assertEqual(low_confidence_high_success_mismatches([]), [])


# ---------------------------------------------------------------------------
# care_category_calibration_drift
# ---------------------------------------------------------------------------

class CareCategoryDriftTests(unittest.TestCase):
    def _make_drift_rows(self, high_accept=2, high_total=4, low_accept=1, low_total=4):
        """Make rows where gap = high_accept/high_total - low_accept/low_total."""
        rows = []
        # high-confidence rows
        for i in range(high_total):
            status = "ACCEPTED" if i < high_accept else "REJECTED"
            rows.append(_row(predicted_confidence=0.80, provider_response_status=status))
        # low-confidence rows
        for i in range(low_total):
            status = "ACCEPTED" if i < low_accept else "REJECTED"
            rows.append(_row(predicted_confidence=0.30, provider_response_status=status))
        return rows

    def test_drift_detected_when_gap_small(self):
        # high: 2/4 = 0.50; low: 2/4 = 0.50 → gap 0.0 → drift
        rows = self._make_drift_rows(high_accept=2, high_total=4, low_accept=2, low_total=4)
        result = care_category_calibration_drift(rows)
        self.assertEqual(len(result), 1)
        self.assertTrue(result[0]["drift_detected"])
        self.assertIn("Confidence scoort niet onderscheidend", result[0]["recommendation"])

    def test_no_drift_when_gap_large(self):
        # high: 4/4 = 1.0; low: 0/4 = 0.0 → gap 1.0 → no drift
        rows = self._make_drift_rows(high_accept=4, high_total=4, low_accept=0, low_total=4)
        result = care_category_calibration_drift(rows)
        self.assertEqual(len(result), 1)
        self.assertFalse(result[0]["drift_detected"])

    def test_below_min_sample_excluded(self):
        # Only 2 high-conf and 2 low-conf rows — below _MIN_SAMPLE_SIZE=3
        rows = self._make_drift_rows(high_accept=1, high_total=2, low_accept=0, low_total=2)
        result = care_category_calibration_drift(rows)
        self.assertEqual(result, [])

    def test_none_confidence_rows_excluded(self):
        rows = [_row(predicted_confidence=None) for _ in range(10)]
        result = care_category_calibration_drift(rows)
        self.assertEqual(result, [])

    def test_gap_computed_correctly(self):
        # high: 4/4 = 1.0; low: 0/4 = 0.0 → gap = 1.0
        rows = self._make_drift_rows(high_accept=4, high_total=4, low_accept=0, low_total=4)
        result = care_category_calibration_drift(rows)
        self.assertAlmostEqual(result[0]["gap"], 1.0, places=2)

    def test_sorted_by_gap_ascending(self):
        rows_jeugd = []
        for i in range(4):
            rows_jeugd.append(_row(predicted_confidence=0.80, provider_response_status="ACCEPTED", care_category="Jeugd"))
        for i in range(4):
            rows_jeugd.append(_row(predicted_confidence=0.30, provider_response_status="ACCEPTED", care_category="Jeugd"))
        rows_wmo = []
        for i in range(4):
            rows_wmo.append(_row(predicted_confidence=0.80, provider_response_status="ACCEPTED", care_category="WMO"))
        for i in range(4):
            rows_wmo.append(_row(predicted_confidence=0.30, provider_response_status="REJECTED", care_category="WMO"))
        result = care_category_calibration_drift(rows_jeugd + rows_wmo)
        # Jeugd gap = 0.0 (worst), WMO gap = 1.0 (best), so Jeugd first
        if len(result) >= 2:
            self.assertLessEqual(result[0]["gap"], result[1]["gap"])


# ---------------------------------------------------------------------------
# provider_calibration_drift
# ---------------------------------------------------------------------------

class ProviderCalibrationDriftTests(unittest.TestCase):
    def test_over_confident_detected(self):
        # mean_conf ≥ 0.65 but accept_rate < 0.40
        # 4 rows: conf=0.80, none accepted
        rows = [
            _row(predicted_confidence=0.80, provider_response_status="REJECTED", provider_id=10, provider_name="Provider X")
            for _ in range(4)
        ]
        result = provider_calibration_drift(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["drift_type"], "over_confident")
        self.assertIn("hoge confidence-scores", result[0]["recommendation"])

    def test_under_confident_detected(self):
        # mean_conf < 0.45 but accept_rate ≥ 0.70
        rows = [
            _row(predicted_confidence=0.30, provider_response_status="ACCEPTED", provider_id=20, provider_name="Provider Y")
            for _ in range(4)
        ]
        result = provider_calibration_drift(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["drift_type"], "under_confident")
        self.assertIn("lage confidence-scores", result[0]["recommendation"])

    def test_well_calibrated_provider_not_reported(self):
        # mean_conf=0.70, accept_rate=0.75 — calibrated
        rows = [
            _row(predicted_confidence=0.70, provider_response_status="ACCEPTED", provider_id=30)
            for _ in range(3)
        ] + [
            _row(predicted_confidence=0.70, provider_response_status="REJECTED", provider_id=30)
        ]
        result = provider_calibration_drift(rows)
        self.assertEqual(result, [])

    def test_below_min_sample_excluded(self):
        rows = [
            _row(predicted_confidence=0.85, provider_response_status="REJECTED", provider_id=40)
            for _ in range(2)  # below _MIN_SAMPLE_SIZE=3
        ]
        result = provider_calibration_drift(rows)
        self.assertEqual(result, [])

    def test_none_confidence_excluded(self):
        rows = [_row(predicted_confidence=None, provider_response_status="REJECTED", provider_id=50) for _ in range(5)]
        result = provider_calibration_drift(rows)
        self.assertEqual(result, [])

    def test_mean_confidence_computed_correctly(self):
        rows = [
            _row(predicted_confidence=0.80, provider_response_status="REJECTED", provider_id=60),
            _row(predicted_confidence=0.70, provider_response_status="REJECTED", provider_id=60),
            _row(predicted_confidence=0.60, provider_response_status="REJECTED", provider_id=60),
            _row(predicted_confidence=0.90, provider_response_status="REJECTED", provider_id=60),
        ]
        result = provider_calibration_drift(rows)
        self.assertEqual(len(result), 1)
        self.assertAlmostEqual(result[0]["mean_confidence"], 0.75, places=2)

    def test_empty_rows_returns_empty(self):
        self.assertEqual(provider_calibration_drift([]), [])


# ---------------------------------------------------------------------------
# rejection_taxonomy_clusters
# ---------------------------------------------------------------------------

class RejectionTaxonomyClustersTests(unittest.TestCase):
    def test_cluster_detected_when_dominant_reason_exceeds_threshold(self):
        # CAPACITY = 4 out of 5 rejections → 80 % → cluster
        rows = [
            _row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY")
            for _ in range(4)
        ] + [
            _row(provider_response_status="REJECTED", provider_response_reason_code="REGION_MISMATCH")
        ]
        result = rejection_taxonomy_clusters(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["dominant_reason_code"], "CAPACITY")
        self.assertAlmostEqual(result[0]["dominant_pct"], 0.80, places=4)

    def test_no_cluster_when_reason_below_threshold(self):
        # 2 CAPACITY, 3 REGION_MISMATCH, 2 AGE_MISMATCH → REGION_MISMATCH at 3/7 ≈ 43 %
        # Use 7 rows where the top reason is only 2/7 ≈ 29 % → below 40 %
        rows = [
            _row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
            _row(provider_response_status="REJECTED", provider_response_reason_code="REGION_MISMATCH"),
            _row(provider_response_status="REJECTED", provider_response_reason_code="AGE_MISMATCH"),
            _row(provider_response_status="REJECTED", provider_response_reason_code="SPECIALIZATION_MISMATCH"),
            _row(provider_response_status="REJECTED", provider_response_reason_code="COMPLEXITY_TOO_HIGH"),
            _row(provider_response_status="REJECTED", provider_response_reason_code="NONE"),
            _row(provider_response_status="REJECTED", provider_response_reason_code="OTHER"),
        ]
        # Each reason_code appears once → max pct = 1/7 ≈ 14 % → no cluster
        result = rejection_taxonomy_clusters(rows)
        self.assertEqual(result, [])

    def test_below_min_sample_excluded(self):
        rows = [
            _row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
            _row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY"),
        ]  # only 2 rejections
        result = rejection_taxonomy_clusters(rows)
        self.assertEqual(result, [])

    def test_non_rejected_rows_excluded(self):
        rows = [
            _row(provider_response_status="ACCEPTED", provider_response_reason_code="CAPACITY")
            for _ in range(5)
        ]
        result = rejection_taxonomy_clusters(rows)
        self.assertEqual(result, [])

    def test_recommendation_contains_reason_code(self):
        rows = [
            _row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY")
            for _ in range(5)
        ]
        result = rejection_taxonomy_clusters(rows)
        self.assertEqual(len(result), 1)
        self.assertIn("CAPACITY", result[0]["recommendation"])

    def test_sorted_by_dominant_pct_descending(self):
        # Category A: CAPACITY 5/5 = 100%; Category B: CAPACITY 4/6 = 67%
        rows = (
            [_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY", care_category="A") for _ in range(5)]
            + [_row(provider_response_status="REJECTED", provider_response_reason_code="CAPACITY", care_category="B") for _ in range(4)]
            + [_row(provider_response_status="REJECTED", provider_response_reason_code="REGION_MISMATCH", care_category="B") for _ in range(2)]
        )
        result = rejection_taxonomy_clusters(rows)
        self.assertGreaterEqual(result[0]["dominant_pct"], result[-1]["dominant_pct"])

    def test_cluster_recommendation_known_code(self):
        rec = _cluster_recommendation("Jeugd", "CAPACITY", 0.80)
        self.assertIn("capaciteitsfiltering", rec)

    def test_cluster_recommendation_unknown_code(self):
        rec = _cluster_recommendation("Jeugd", "UNKNOWN_CODE", 0.80)
        self.assertIn("UNKNOWN_CODE", rec)

    def test_empty_rows_returns_empty(self):
        self.assertEqual(rejection_taxonomy_clusters([]), [])


# ---------------------------------------------------------------------------
# calibration_recommendations
# ---------------------------------------------------------------------------

class CalibrationRecommendationsTests(unittest.TestCase):
    def _minimal_diagnostics(self):
        return {
            "high_confidence_low_acceptance": [],
            "low_confidence_high_success": [],
            "care_category_drift": [],
            "provider_drift": [],
            "taxonomy_clusters": [],
        }

    def test_no_signals_returns_empty(self):
        result = calibration_recommendations(self._minimal_diagnostics())
        self.assertEqual(result, [])

    def test_high_confidence_low_acceptance_generates_recommendation(self):
        diag = self._minimal_diagnostics()
        diag["high_confidence_low_acceptance"] = [
            {"care_category": "Jeugd", "acceptance_rate": 0.20, "severity": "high"}
        ]
        result = calibration_recommendations(diag)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["source"], "hoog_vertrouwen_lage_acceptatie")
        self.assertEqual(result[0]["severity"], "high")
        self.assertIn("Jeugd", result[0]["recommendation"])

    def test_low_confidence_high_success_generates_recommendation(self):
        diag = self._minimal_diagnostics()
        diag["low_confidence_high_success"] = [
            {"care_category": "WMO", "success_rate": 0.75, "severity": "medium"}
        ]
        result = calibration_recommendations(diag)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["source"], "laag_vertrouwen_hoog_succes")

    def test_drift_with_recommendation_included(self):
        diag = self._minimal_diagnostics()
        diag["care_category_drift"] = [
            {"care_category": "Jeugd", "drift_detected": True, "recommendation": "Verhoog weging X."}
        ]
        result = calibration_recommendations(diag)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["source"], "categorie_drift")

    def test_drift_without_flag_excluded(self):
        diag = self._minimal_diagnostics()
        diag["care_category_drift"] = [
            {"care_category": "Jeugd", "drift_detected": False, "recommendation": ""}
        ]
        result = calibration_recommendations(diag)
        self.assertEqual(result, [])

    def test_taxonomy_cluster_generates_recommendation(self):
        diag = self._minimal_diagnostics()
        diag["taxonomy_clusters"] = [
            {
                "care_category": "Jeugd",
                "dominant_pct": 0.70,
                "recommendation": "Verlaag capaciteitspenalty.",
            }
        ]
        result = calibration_recommendations(diag)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["severity"], "high")  # 0.70 ≥ 0.60

    def test_deduplication_prevents_duplicate_entries(self):
        diag = self._minimal_diagnostics()
        # Same entry twice via different sources is allowed — only exact duplicates deduplicated
        diag["high_confidence_low_acceptance"] = [
            {"care_category": "Jeugd", "acceptance_rate": 0.20, "severity": "high"},
            {"care_category": "Jeugd", "acceptance_rate": 0.20, "severity": "high"},
        ]
        result = calibration_recommendations(diag)
        # Each entry produces an independent recommendation; both should appear
        # (same category, same text → deduplicated to 1)
        self.assertEqual(len(result), 1)

    def test_sorted_high_severity_first(self):
        diag = self._minimal_diagnostics()
        diag["high_confidence_low_acceptance"] = [
            {"care_category": "Jeugd", "acceptance_rate": 0.10, "severity": "high"}
        ]
        diag["low_confidence_high_success"] = [
            {"care_category": "WMO", "success_rate": 0.65, "severity": "medium"}
        ]
        result = calibration_recommendations(diag)
        self.assertEqual(result[0]["severity"], "high")

    def test_each_recommendation_has_required_fields(self):
        diag = self._minimal_diagnostics()
        diag["taxonomy_clusters"] = [
            {"care_category": "Jeugd", "dominant_pct": 0.80, "recommendation": "Test."}
        ]
        result = calibration_recommendations(diag)
        for rec in result:
            for key in ("source", "severity", "subject", "recommendation"):
                self.assertIn(key, rec)


# ---------------------------------------------------------------------------
# calibration_diagnostics (integration)
# ---------------------------------------------------------------------------

class CalibrationDiagnosticsIntegrationTests(unittest.TestCase):
    def test_returns_all_required_keys(self):
        result = calibration_diagnostics([])
        for key in (
            "high_confidence_low_acceptance",
            "low_confidence_high_success",
            "care_category_drift",
            "provider_drift",
            "taxonomy_clusters",
            "recommendations",
            "has_signals",
        ):
            self.assertIn(key, result)

    def test_has_signals_false_when_empty_data(self):
        result = calibration_diagnostics([])
        self.assertFalse(result["has_signals"])

    def test_has_signals_true_when_mismatch_detected(self):
        rows = _high_conf_rejected("Jeugd", n=4)
        result = calibration_diagnostics(rows)
        self.assertTrue(result["has_signals"])

    def test_recommendations_populated_from_diagnostics(self):
        rows = _high_conf_rejected("Jeugd", n=4)
        result = calibration_diagnostics(rows)
        self.assertIsInstance(result["recommendations"], list)
        # At least one recommendation because high_confidence_low_acceptance fired
        self.assertGreater(len(result["recommendations"]), 0)

    def test_safe_with_none_confidence_rows(self):
        rows = [_row(predicted_confidence=None) for _ in range(10)]
        result = calibration_diagnostics(rows)
        self.assertFalse(result["has_signals"])

    def test_safe_with_sparse_data(self):
        rows = [_row(predicted_confidence=0.80, provider_response_status="REJECTED")]
        result = calibration_diagnostics(rows)
        # 1 row < _MIN_SAMPLE_SIZE — no signals
        self.assertFalse(result["has_signals"])

    def test_full_scenario_produces_coherent_output(self):
        rows = (
            _high_conf_rejected("Jeugd", n=4)          # high conf, all rejected
            + _low_conf_success("WMO", n=4)             # low conf, all GOOD_FIT
            + [
                _row(predicted_confidence=0.80, provider_response_status="REJECTED",
                     provider_response_reason_code="CAPACITY", care_category="Jeugd"),
                _row(predicted_confidence=0.80, provider_response_status="REJECTED",
                     provider_response_reason_code="CAPACITY", care_category="Jeugd"),
                _row(predicted_confidence=0.80, provider_response_status="REJECTED",
                     provider_response_reason_code="CAPACITY", care_category="Jeugd"),
            ]
        )
        result = calibration_diagnostics(rows)
        self.assertTrue(result["has_signals"])
        # taxonomy_clusters should fire for Jeugd CAPACITY dominance
        cluster_categories = {c["care_category"] for c in result["taxonomy_clusters"]}
        self.assertIn("Jeugd", cluster_categories)


if __name__ == "__main__":
    unittest.main()
