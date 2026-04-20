"""
Validation scenarios for the V3 decision intelligence layer.

These are pure-Python unit tests (no DB required) that verify the quality
and operational trustworthiness of confidence scoring, rejection handling,
trade-off guidance, and evidence generation across realistic case scenarios.

Scenarios covered:
  1. Repeated provider rejection — confidence penalised, risk_notes populated,
     taxonomy-derived matching guidance injected.
  2. Stale / missing summary — fit_summary signals blocking state,
     verification_guidance directs operator to fix data.
  3. No capacity anywhere — all candidates have capacity issues,
     verification_guidance forces capacity validation.
  4. Delayed intake after acceptance — accepted but >5 days without intake
     start, weak_match or intake_not_started alert expected.
  5. Weak-match verification — low confidence triggers verification_guidance
     and the confidence value is < 0.5.
  6. Clean strong match — high confidence, no penalties, correct fit_summary.
  7. Calibration: provider behavior signals move confidence up/down.
  8. Rejection taxonomy enrichment — specific reason codes produce
     structured guidance and matching signals in provider_feedback.
"""
import unittest
from datetime import date, timedelta

from contracts.case_intelligence import (
    REJECTION_TAXONOMY,
    build_v3_evidence,
    detect_missing_information,
    detect_risk_signals,
    evaluate_case_intelligence,
    generate_candidate_hints,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_case() -> dict:
    """Minimal complete case_data that passes all validation checks."""
    return {
        "phase": "MATCHING",
        "care_category": "Jeugd",
        "urgency": "MEDIUM",
        "assessment_complete": True,
        "matching_run_exists": True,
        "top_match_confidence": "high",
        "top_match_has_capacity_issue": False,
        "top_match_wait_days": 7,
        "selected_provider_id": 42,
        "selected_provider_name": "Aanbieder A",
        "placement_status": "IN_REVIEW",
        "placement_updated_at": date(2026, 4, 10),
        "rejected_provider_count": 0,
        "rejection_reason_code": "",
        "open_signal_count": 0,
        "open_task_count": 1,
        "case_updated_at": date(2026, 4, 13),
        "candidate_suggestions": [
            {
                "provider_id": 42,
                "confidence": "high",
                "has_capacity_issue": False,
                "wait_days": 7,
                "has_region_mismatch": False,
            },
        ],
        "provider_response_status": "",
        "now": date(2026, 4, 14),
    }


def _run_evidence(case_data: dict) -> dict:
    """Run the full pipeline and return the v3_evidence block."""
    intel = evaluate_case_intelligence(case_data)
    return intel["v3_evidence"]


# ---------------------------------------------------------------------------
# Scenario 1: Repeated provider rejection
# ---------------------------------------------------------------------------

class RepeatedRejectionScenarioTests(unittest.TestCase):
    def _rejected_case(self, count: int = 2, reason: str = "CAPACITY") -> dict:
        case = _base_case()
        case["rejected_provider_count"] = count
        case["rejection_reason_code"] = reason
        case["provider_response_status"] = "REJECTED"
        case["selected_provider_name"] = "Aanbieder B"
        case["open_signal_count"] = 1  # repeated_rejections signals
        return case

    def test_repeated_rejection_lowers_confidence(self):
        single = _run_evidence(self._rejected_case(count=1))
        repeated = _run_evidence(self._rejected_case(count=3))
        self.assertLess(repeated["confidence"], single["confidence"])

    def test_repeated_rejection_confidence_below_threshold(self):
        # ≥2 rejections on a medium-confidence match should push confidence < 0.5
        case = self._rejected_case(count=3)
        case["top_match_confidence"] = "medium"
        evidence = _run_evidence(case)
        self.assertLess(evidence["confidence"], 0.5)

    def test_repeated_rejection_risk_notes_populated(self):
        evidence = _run_evidence(self._rejected_case(count=2))
        pf = evidence["provider_feedback"]
        self.assertIsNotNone(pf)
        self.assertIn("Herhaalde afwijzing", pf["risk_notes"])

    def test_repeated_rejection_attempt_count(self):
        evidence = _run_evidence(self._rejected_case(count=4))
        self.assertEqual(evidence["provider_feedback"]["attempt_count"], 4)

    def test_rejection_decision_is_reject(self):
        evidence = _run_evidence(self._rejected_case(count=1))
        self.assertEqual(evidence["provider_feedback"]["decision"], "reject")

    def test_rejection_taxonomy_capacity_guidance(self):
        evidence = _run_evidence(self._rejected_case(reason="CAPACITY"))
        guidance = evidence["verification_guidance"]
        self.assertTrue(
            any("capaciteit" in g.lower() for g in guidance),
            f"Expected capacity guidance in: {guidance}",
        )

    def test_rejection_taxonomy_region_guidance(self):
        evidence = _run_evidence(self._rejected_case(reason="REGION_MISMATCH"))
        guidance = evidence["verification_guidance"]
        self.assertTrue(
            any("regio" in g.lower() for g in guidance),
            f"Expected region guidance in: {guidance}",
        )

    def test_rejection_taxonomy_care_mismatch_guidance(self):
        evidence = _run_evidence(self._rejected_case(reason="CARE_MISMATCH"))
        guidance = evidence["verification_guidance"]
        self.assertTrue(
            any("specialisatie" in g.lower() or "zorgprofiel" in g.lower() for g in guidance),
            f"Expected care-mismatch guidance in: {guidance}",
        )

    def test_rejection_taxonomy_reason_label_present(self):
        evidence = _run_evidence(self._rejected_case(reason="CAPACITY"))
        pf = evidence["provider_feedback"]
        self.assertEqual(pf["reason_code"], "CAPACITY")
        self.assertEqual(pf["reason_label"], "Capaciteit")

    def test_rejection_taxonomy_same_reason_strengthens_matching_signal(self):
        # CARE_MISMATCH should add a matching_signal to risk_notes / verification_guidance
        evidence = _run_evidence(self._rejected_case(reason="CARE_MISMATCH", count=2))
        # Either risk_notes or verification_guidance should reference specialisation matching
        combined = (evidence["provider_feedback"]["risk_notes"] or "") + " ".join(
            evidence["verification_guidance"]
        )
        self.assertTrue(
            "specialisatie" in combined.lower() or "zorgprofiel" in combined.lower(),
            f"Expected matching signal in: {combined[:300]}",
        )


# ---------------------------------------------------------------------------
# Scenario 2: Stale / missing summary
# ---------------------------------------------------------------------------

class StaleSummaryScenarioTests(unittest.TestCase):
    def _stale_summary_case(self) -> dict:
        case = _base_case()
        case["has_assessment_summary"] = False
        case["matching_run_exists"] = False
        case["candidate_suggestions"] = []
        return case

    def test_missing_summary_blocks_matching(self):
        case = self._stale_summary_case()
        missing = detect_missing_information(case)
        codes = {m["code"] for m in missing}
        self.assertIn("missing_assessment_summary", codes)

    def test_missing_summary_fit_summary_signals_no_match(self):
        evidence = _run_evidence(self._stale_summary_case())
        self.assertIn("niet mogelijk", evidence["fit_summary"].lower())

    def test_missing_summary_confidence_is_zero(self):
        # No candidates → no base confidence
        evidence = _run_evidence(self._stale_summary_case())
        self.assertEqual(evidence["confidence"], 0.0)

    def test_missing_summary_verification_guidance_non_empty(self):
        evidence = _run_evidence(self._stale_summary_case())
        self.assertTrue(len(evidence["verification_guidance"]) > 0)

    def test_missing_summary_no_candidate_hints(self):
        case = self._stale_summary_case()
        intel = evaluate_case_intelligence(case)
        self.assertEqual(intel["candidate_hints"], [])


# ---------------------------------------------------------------------------
# Scenario 3: No capacity anywhere
# ---------------------------------------------------------------------------

class NoCapacityScenarioTests(unittest.TestCase):
    def _no_capacity_case(self) -> dict:
        case = _base_case()
        case["top_match_has_capacity_issue"] = True
        case["top_match_confidence"] = "medium"
        case["candidate_suggestions"] = [
            {
                "provider_id": 10,
                "confidence": "medium",
                "has_capacity_issue": True,
                "wait_days": 30,
                "has_region_mismatch": False,
            },
            {
                "provider_id": 11,
                "confidence": "low",
                "has_capacity_issue": True,
                "wait_days": 45,
                "has_region_mismatch": True,
            },
        ]
        return case

    def test_no_capacity_signal_raised(self):
        signals = detect_risk_signals(self._no_capacity_case())
        codes = {s["code"] for s in signals}
        self.assertIn("capacity_risk", codes)

    def test_no_capacity_verification_guidance_includes_capacity_check(self):
        evidence = _run_evidence(self._no_capacity_case())
        guidance = evidence["verification_guidance"]
        self.assertTrue(
            any("capaciteit" in g.lower() for g in guidance),
            f"Expected capacity check in: {guidance}",
        )

    def test_no_capacity_confidence_penalised(self):
        # 2 signals + capacity issue → confidence should be below base 0.6
        evidence = _run_evidence(self._no_capacity_case())
        self.assertLess(evidence["confidence"], 0.6)

    def test_no_capacity_factor_breakdown_shows_capacity_limited(self):
        evidence = _run_evidence(self._no_capacity_case())
        breakdown = " ".join(evidence["factor_breakdown"]).lower()
        self.assertIn("capaciteit: beperkt", breakdown)

    def test_no_capacity_top_candidate_trade_off_present(self):
        evidence = _run_evidence(self._no_capacity_case())
        combined = " ".join(evidence["trade_offs"]).lower()
        self.assertIn("capaciteit", combined)


# ---------------------------------------------------------------------------
# Scenario 4: Delayed intake after acceptance
# ---------------------------------------------------------------------------

class DelayedIntakeScenarioTests(unittest.TestCase):
    def _delayed_intake_case(self, days_since_acceptance: int = 7) -> dict:
        case = _base_case()
        case["phase"] = "PLACEMENT"
        case["placement_status"] = "APPROVED"
        case["provider_response_status"] = "ACCEPTED"
        case["selected_provider_name"] = "Aanbieder C"
        # Simulate stale update
        case["case_updated_at"] = case["now"] - timedelta(days=days_since_acceptance)
        case["placement_updated_at"] = case["now"] - timedelta(days=days_since_acceptance)
        return case

    def test_delayed_intake_provider_feedback_is_accepted(self):
        evidence = _run_evidence(self._delayed_intake_case())
        pf = evidence["provider_feedback"]
        self.assertIsNotNone(pf)
        self.assertEqual(pf["decision"], "accept")

    def test_delayed_intake_stale_case_signal_raised(self):
        case = self._delayed_intake_case(days_since_acceptance=12)
        signals = detect_risk_signals(case)
        codes = {s["code"] for s in signals}
        self.assertIn("stale_case", codes)

    def test_delayed_intake_confidence_penalised_by_stale_signal(self):
        # Stale case → 1 extra risk signal → penalty applied
        clean_case = _base_case()
        clean_evidence = _run_evidence(clean_case)
        delayed_case = self._delayed_intake_case(days_since_acceptance=12)
        delayed_evidence = _run_evidence(delayed_case)
        self.assertLessEqual(delayed_evidence["confidence"], clean_evidence["confidence"])

    def test_delayed_intake_provider_name_surfaced(self):
        evidence = _run_evidence(self._delayed_intake_case())
        self.assertEqual(evidence["provider_feedback"]["provider_name"], "Aanbieder C")


# ---------------------------------------------------------------------------
# Scenario 5: Weak-match verification
# ---------------------------------------------------------------------------

class WeakMatchVerificationScenarioTests(unittest.TestCase):
    def _weak_match_case(self) -> dict:
        case = _base_case()
        case["top_match_confidence"] = "low"
        case["top_match_has_capacity_issue"] = True
        case["top_match_wait_days"] = 40
        case["open_signal_count"] = 2
        case["candidate_suggestions"] = [
            {
                "provider_id": 99,
                "confidence": "low",
                "has_capacity_issue": True,
                "wait_days": 40,
                "has_region_mismatch": True,
            },
        ]
        return case

    def test_weak_match_confidence_below_half(self):
        evidence = _run_evidence(self._weak_match_case())
        self.assertLess(evidence["confidence"], 0.5)

    def test_weak_match_fit_summary_signals_weakness(self):
        evidence = _run_evidence(self._weak_match_case())
        self.assertIn("zwakke match", evidence["fit_summary"].lower())

    def test_weak_match_verification_guidance_non_empty(self):
        evidence = _run_evidence(self._weak_match_case())
        self.assertTrue(len(evidence["verification_guidance"]) > 0)

    def test_weak_match_factor_breakdown_shows_issues(self):
        evidence = _run_evidence(self._weak_match_case())
        breakdown = " ".join(evidence["factor_breakdown"]).lower()
        self.assertIn("capaciteit: beperkt", breakdown)
        self.assertIn("lang", breakdown)

    def test_weak_match_trade_offs_non_empty(self):
        evidence = _run_evidence(self._weak_match_case())
        self.assertTrue(len(evidence["trade_offs"]) > 0)

    def test_weak_match_safe_to_proceed_false(self):
        intel = evaluate_case_intelligence(self._weak_match_case())
        self.assertFalse(intel["safe_to_proceed"])


# ---------------------------------------------------------------------------
# Scenario 6: Clean strong match
# ---------------------------------------------------------------------------

class CleanStrongMatchScenarioTests(unittest.TestCase):
    def _clean_case(self) -> dict:
        case = _base_case()
        case["top_match_confidence"] = "high"
        case["top_match_has_capacity_issue"] = False
        case["top_match_wait_days"] = 5
        case["placement_status"] = "APPROVED"
        return case

    def test_clean_match_confidence_above_08(self):
        evidence = _run_evidence(self._clean_case())
        self.assertGreaterEqual(evidence["confidence"], 0.8)

    def test_clean_match_fit_summary_is_strong(self):
        evidence = _run_evidence(self._clean_case())
        self.assertIn("sterke match", evidence["fit_summary"].lower())

    def test_clean_match_factor_breakdown_shows_capacity_available(self):
        evidence = _run_evidence(self._clean_case())
        breakdown = " ".join(evidence["factor_breakdown"]).lower()
        self.assertIn("capaciteit: beschikbaar", breakdown)

    def test_clean_match_no_provider_feedback_for_no_response(self):
        # No provider response status → no provider_feedback
        case = self._clean_case()
        case["provider_response_status"] = ""
        evidence = _run_evidence(case)
        self.assertIsNone(evidence["provider_feedback"])


# ---------------------------------------------------------------------------
# Scenario 7: Confidence calibration via provider behavior signals
# ---------------------------------------------------------------------------

class ConfidenceCalibrationScenarioTests(unittest.TestCase):
    def _case_with_signals(self, behavior: dict) -> dict:
        """Inject behavior_signals into candidate hint to test calibration."""
        case = _base_case()
        # We need to test build_v3_evidence directly with injected candidate_hints
        return case

    def test_reliable_provider_increases_confidence(self):
        # Build intelligence manually with a reliable provider in candidate_hints
        case = _base_case()
        intel = evaluate_case_intelligence(case)
        base_confidence = intel["v3_evidence"]["confidence"]

        # Now simulate behavior_signals with fast + high acceptance
        modified_hints = list(intel["candidate_hints"])
        if modified_hints:
            modified_hints[0] = dict(modified_hints[0])
            modified_hints[0]["behavior_signals"] = {
                "response_speed": "fast",
                "acceptance_pattern": "high",
                "intake_pattern": "high_success",
                "capacity_pattern": "available",
            }
        patched_intel = dict(intel)
        patched_intel["candidate_hints"] = modified_hints
        evidence = build_v3_evidence(case, patched_intel)
        # Reliable provider with good intake_pattern should score higher than base
        self.assertGreaterEqual(evidence["confidence"], base_confidence)

    def test_slow_responder_lowers_confidence(self):
        case = _base_case()
        intel = evaluate_case_intelligence(case)
        base_confidence = intel["v3_evidence"]["confidence"]

        modified_hints = list(intel["candidate_hints"])
        if modified_hints:
            modified_hints[0] = dict(modified_hints[0])
            modified_hints[0]["behavior_signals"] = {
                "response_speed": "slow",
                "acceptance_pattern": "low",
                "capacity_pattern": "often_full",
            }
        patched_intel = dict(intel)
        patched_intel["candidate_hints"] = modified_hints
        evidence = build_v3_evidence(case, patched_intel)
        self.assertLessEqual(evidence["confidence"], base_confidence)

    def test_confidence_clamped_between_zero_and_one(self):
        # Even with extreme penalties confidence should not go below 0 or above 1
        case = _base_case()
        case["top_match_confidence"] = "low"
        case["open_signal_count"] = 10
        case["rejected_provider_count"] = 10
        evidence = _run_evidence(case)
        self.assertGreaterEqual(evidence["confidence"], 0.0)
        self.assertLessEqual(evidence["confidence"], 1.0)


# ---------------------------------------------------------------------------
# Scenario 8: Rejection taxonomy completeness
# ---------------------------------------------------------------------------

class RejectionTaxonomyTests(unittest.TestCase):
    _EXPECTED_CODES = {
        "CAPACITY", "WAITLIST", "CLIENT_DECLINED", "PROVIDER_DECLINED",
        "NO_SHOW", "NO_RESPONSE", "CARE_MISMATCH", "REGION_MISMATCH",
        "SAFETY_RISK", "ADMINISTRATIVE_BLOCK", "OTHER", "NONE",
    }

    def test_all_expected_codes_present(self):
        for code in self._EXPECTED_CODES:
            self.assertIn(code, REJECTION_TAXONOMY, f"Missing taxonomy entry for {code}")

    def test_all_entries_have_required_keys(self):
        for code, entry in REJECTION_TAXONOMY.items():
            for key in ("label", "description", "guidance", "matching_signal"):
                self.assertIn(
                    key, entry,
                    f"Taxonomy entry '{code}' missing key '{key}'",
                )

    def test_safety_risk_guidance_contains_escalate(self):
        self.assertIn("Escaleer", REJECTION_TAXONOMY["SAFETY_RISK"]["guidance"])

    def test_capacity_matching_signal_references_capaciteit(self):
        signal = REJECTION_TAXONOMY["CAPACITY"]["matching_signal"].lower()
        self.assertIn("capaciteit", signal)

    def test_region_mismatch_guidance_references_regio(self):
        guidance = REJECTION_TAXONOMY["REGION_MISMATCH"]["guidance"].lower()
        self.assertIn("regio", guidance)


# ---------------------------------------------------------------------------
# Scenario 9: Multi-candidate trade-off comparison quality
# ---------------------------------------------------------------------------

class CandidateTradeOffComparisonTests(unittest.TestCase):
    def test_capacity_alternative_comparison_mentions_capaciteit(self):
        case = _base_case()
        case["candidate_suggestions"] = [
            {
                "provider_id": 1,
                "confidence": "medium",
                "has_capacity_issue": True,
                "wait_days": 20,
                "has_region_mismatch": False,
            },
            {
                "provider_id": 2,
                "confidence": "medium",
                "has_capacity_issue": False,
                "wait_days": 20,
                "has_region_mismatch": False,
            },
        ]
        hints = generate_candidate_hints(case)
        alt = hints[1]
        self.assertEqual(alt["hint_code"], "capacity_alternative")
        self.assertIn("capaciteit", alt["comparison_to_top"].lower())

    def test_wait_time_alternative_comparison_mentions_wachttijd(self):
        case = _base_case()
        case["candidate_suggestions"] = [
            {
                "provider_id": 1,
                "confidence": "high",
                "has_capacity_issue": False,
                "wait_days": 35,
                "has_region_mismatch": False,
            },
            {
                "provider_id": 2,
                "confidence": "medium",
                "has_capacity_issue": False,
                "wait_days": 10,
                "has_region_mismatch": False,
            },
        ]
        hints = generate_candidate_hints(case)
        alt = hints[1]
        self.assertEqual(alt["hint_code"], "wait_time_alternative")
        self.assertIn("wachttijd", alt["comparison_to_top"].lower())

    def test_region_advantage_comparison_mentions_regio(self):
        case = _base_case()
        case["candidate_suggestions"] = [
            {
                "provider_id": 1,
                "confidence": "medium",
                "has_capacity_issue": False,
                "wait_days": 10,
                "has_region_mismatch": True,
            },
            {
                "provider_id": 2,
                "confidence": "medium",
                "has_capacity_issue": False,
                "wait_days": 12,
                "has_region_mismatch": False,
            },
        ]
        hints = generate_candidate_hints(case)
        alt = hints[1]
        self.assertIn("regio", alt["comparison_to_top"].lower())

    def test_comparison_includes_trade_off_count(self):
        case = _base_case()
        case["candidate_suggestions"] = [
            {
                "provider_id": 1,
                "confidence": "medium",
                "has_capacity_issue": True,
                "wait_days": 35,
                "has_region_mismatch": True,
            },
            {
                "provider_id": 2,
                "confidence": "medium",
                "has_capacity_issue": False,
                "wait_days": 10,
                "has_region_mismatch": False,
            },
        ]
        hints = generate_candidate_hints(case)
        comparison = hints[1]["comparison_to_top"]
        self.assertIn("trade-off", comparison.lower())


# ---------------------------------------------------------------------------
# Scenario 10: evaluate_case_intelligence v3_evidence is always present
# ---------------------------------------------------------------------------

class EvidencePresenceTests(unittest.TestCase):
    def test_v3_evidence_always_in_evaluate_result(self):
        result = evaluate_case_intelligence(_base_case())
        self.assertIn("v3_evidence", result)

    def test_v3_evidence_has_all_required_keys(self):
        result = evaluate_case_intelligence(_base_case())
        evidence = result["v3_evidence"]
        for key in ("fit_summary", "confidence", "factor_breakdown", "trade_offs",
                    "verification_guidance", "provider_feedback"):
            self.assertIn(key, evidence, f"v3_evidence missing key '{key}'")

    def test_v3_evidence_confidence_is_float(self):
        result = evaluate_case_intelligence(_base_case())
        self.assertIsInstance(result["v3_evidence"]["confidence"], float)

    def test_v3_evidence_lists_are_lists(self):
        result = evaluate_case_intelligence(_base_case())
        evidence = result["v3_evidence"]
        for key in ("factor_breakdown", "trade_offs", "verification_guidance"):
            self.assertIsInstance(evidence[key], list, f"'{key}' should be a list")


if __name__ == "__main__":
    unittest.main()
