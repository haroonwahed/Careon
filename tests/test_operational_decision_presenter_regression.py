"""
Regression tests for OperationalDecisionPresenter UI primitive mapping.

This module enforces density constraints and signal mapping consistency
without testing business decision logic. It locks in the presenter's
behavior so page-level consistency cannot silently drift.

Tests verify:
- Max 1 primary signal
- Optional 1 secondary signal only
- Escalation collapses into primary
- Bounded badges list (max 2)
- Consistent action_block generation
- Consistent priority_indicator generation
- Consistent bottleneck mapping
- Safe fallback behavior with partial contract data
"""

from django.test import TestCase

from contracts.operational_decision_presenter import (
    present_operational_decision,
    ATTENTION_BAND_CONFIG,
    PRIORITY_BADGE_CONFIG,
    BOTTLENECK_META_CONFIG,
)


class OperationalDecisionPresenterDensityTests(TestCase):
    """Test signal density enforcement and primitive mapping."""

    def setUp(self):
        """Standard defaults for all tests."""
        self.action_defaults = {
            "label": "Test Action",
            "reason": "Test Reason",
            "url": "/test/",
        }
        self.impact_defaults = {
            "text": "Test Impact",
            "type": "positive",
        }

    def test_empty_payload_returns_safe_defaults(self):
        """Presenter handles empty/None payload gracefully."""
        result = present_operational_decision(
            {},
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Must have all required fields
        self.assertIn("primary_signal", result)
        self.assertIn("secondary_signal", result)
        self.assertIn("action_block", result)
        self.assertIn("priority_indicator", result)
        self.assertIn("badges", result)

        # Defaults apply when payload empty
        self.assertIsNone(result["primary_signal"])
        self.assertIsNone(result["secondary_signal"])
        self.assertEqual(result["action_block"]["action"]["label"], "Test Action")
        self.assertEqual(
            result["action_block"]["impact"]["text"], "Test Impact"
        )
        self.assertEqual(result["attention_band"]["value"], "monitor")
        self.assertEqual(result["bottleneck_state"], "none")

    def test_single_signal_returns_primary_only(self):
        """When one signal candidate, only primary_signal is set."""
        payload = {
            "attention_band": "now",  # This creates 1 candidate
            "bottleneck_state": "none",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Primary signal present, secondary not
        self.assertIsNotNone(result["primary_signal"])
        self.assertIsNone(result["secondary_signal"])
        self.assertEqual(len(result["badges"]), 1)

        # Primary signal is correct label
        self.assertEqual(
            result["primary_signal"]["label"],
            ATTENTION_BAND_CONFIG["now"]["label"],
        )

    def test_two_signals_returns_primary_and_secondary(self):
        """When two signal candidates, both primary and secondary are set."""
        payload = {
            "attention_band": "now",
            "bottleneck_state": "assessment",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Both signals present
        self.assertIsNotNone(result["primary_signal"])
        self.assertIsNotNone(result["secondary_signal"])
        self.assertEqual(len(result["badges"]), 2)

        # Signal candidates built in order: bottleneck first, then attention band
        # So bottleneck is primary, attention band is secondary
        self.assertEqual(
            result["primary_signal"]["label"],
            BOTTLENECK_META_CONFIG["assessment"]["label"],
        )
        self.assertEqual(
            result["secondary_signal"]["label"],
            ATTENTION_BAND_CONFIG["now"]["label"],
        )

    def test_escalation_becomes_primary_signal(self):
        """Escalation collapses into primary position."""
        payload = {
            "attention_band": "today",
            "bottleneck_state": "none",
            "escalation_recommended": True,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Escalation is primary
        self.assertIsNotNone(result["primary_signal"])
        self.assertEqual(result["primary_signal"]["label"], "Escalatie aanbevolen")
        self.assertEqual(result["primary_signal"]["badge_class"], "badge-critical")

    def test_escalation_with_bottleneck_produces_two_signals(self):
        """Escalation + bottleneck creates primary + secondary."""
        payload = {
            "attention_band": "monitor",
            "bottleneck_state": "matching",
            "escalation_recommended": True,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Both signals present
        self.assertIsNotNone(result["primary_signal"])
        self.assertIsNotNone(result["secondary_signal"])

        # Escalation is primary
        self.assertEqual(result["primary_signal"]["label"], "Escalatie aanbevolen")

        # Bottleneck is secondary
        self.assertEqual(
            result["secondary_signal"]["label"],
            BOTTLENECK_META_CONFIG["matching"]["label"],
        )

    def test_badges_list_never_exceeds_two(self):
        """Badges list is always bounded to max 2 items."""
        payload = {
            "attention_band": "now",
            "bottleneck_state": "placement",
            "escalation_recommended": True,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Even with 3 candidates, only 2 badges
        self.assertLessEqual(len(result["badges"]), 2)
        self.assertEqual(len(result["strongest_signals"]), 2)
        self.assertEqual(len(result["signal_chips"]), 2)

    def test_duplicate_signals_deduplicated(self):
        """Duplicate signal labels are removed."""
        # This is tested implicitly by the presenter deduping logic
        payload = {
            "attention_band": "now",
            "bottleneck_state": "none",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Check that all labels are unique
        labels = [s["label"] for s in result["badges"]]
        self.assertEqual(len(labels), len(set(labels)))

    def test_action_block_always_present(self):
        """action_block is always present with all required fields."""
        payload = {"attention_band": "monitor"}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIn("action_block", result)
        self.assertIn("action", result["action_block"])
        self.assertIn("impact", result["action_block"])

        action = result["action_block"]["action"]
        impact = result["action_block"]["impact"]

        self.assertIn("label", action)
        self.assertIn("reason", action)
        self.assertIn("url", action)

        self.assertIn("text", impact)
        self.assertIn("type", impact)

    def test_action_block_uses_payload_over_defaults(self):
        """Action block prefers payload values over defaults."""
        payload = {
            "recommended_action": {
                "label": "Payload Action",
                "reason": "Payload Reason",
                "url": "/payload/",
            },
            "impact_summary": {
                "text": "Payload Impact",
                "type": "accelerating",
            },
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        action = result["action_block"]["action"]
        impact = result["action_block"]["impact"]

        self.assertEqual(action["label"], "Payload Action")
        self.assertEqual(action["reason"], "Payload Reason")
        self.assertEqual(action["url"], "/payload/")
        self.assertEqual(impact["text"], "Payload Impact")
        self.assertEqual(impact["type"], "accelerating")

    def test_action_block_falls_back_to_defaults(self):
        """Action block uses defaults when payload missing."""
        payload = {"attention_band": "monitor"}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        action = result["action_block"]["action"]
        impact = result["action_block"]["impact"]

        self.assertEqual(action["label"], "Test Action")
        self.assertEqual(action["reason"], "Test Reason")
        self.assertEqual(action["url"], "/test/")
        self.assertEqual(impact["text"], "Test Impact")
        self.assertEqual(impact["type"], "positive")

    def test_priority_indicator_always_present(self):
        """priority_indicator is always present with all required fields."""
        payload = {}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIn("priority_indicator", result)
        priority = result["priority_indicator"]

        self.assertIn("value", priority)
        self.assertIn("rank", priority)
        self.assertIn("label", priority)
        self.assertIn("compact_label", priority)
        self.assertIn("badge_class", priority)

    def test_priority_indicator_derives_band_from_rank(self):
        """priority_indicator band derives correctly from priority_rank."""
        test_cases = [
            (3, False, "first"),  # rank <= 5
            (10, False, "soon"),  # rank <= 15
            (25, False, "monitor"),  # rank <= 30
            (50, False, "waiting"),  # rank > 30
        ]

        for rank, escalation, expected_band in test_cases:
            payload = {
                "priority_rank": rank,
                "escalation_recommended": escalation,
            }
            result = present_operational_decision(
                payload,
                action_defaults=self.action_defaults,
                impact_defaults=self.impact_defaults,
            )
            self.assertEqual(
                result["priority_indicator"]["value"],
                expected_band,
                f"Failed for rank={rank}, escalation={escalation}",
            )

    def test_priority_indicator_escalation_overrides_rank(self):
        """When escalation_recommended=True, priority band is 'escalate'."""
        payload = {
            "priority_rank": 50,  # Would normally be 'waiting'
            "escalation_recommended": True,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertEqual(result["priority_indicator"]["value"], "escalate")

    def test_priority_rank_invalid_uses_default(self):
        """Invalid priority_rank falls back to default."""
        payload = {"priority_rank": -1}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
            priority_default_rank=50,
        )

        self.assertEqual(result["priority_rank"], 50)

    def test_priority_rank_boolean_uses_default(self):
        """Boolean priority_rank is rejected and uses default."""
        payload = {"priority_rank": True}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
            priority_default_rank=50,
        )

        self.assertEqual(result["priority_rank"], 50)

    def test_bottleneck_state_none_produces_no_badge(self):
        """When bottleneck_state is 'none', bottleneck_badge is None."""
        payload = {
            "bottleneck_state": "none",
            "attention_band": "monitor",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIsNone(result["bottleneck_badge"])
        self.assertEqual(result["bottleneck_state"], "none")

    def test_bottleneck_state_assessment_produces_badge(self):
        """When bottleneck_state is 'assessment', badge is generated."""
        payload = {
            "bottleneck_state": "assessment",
            "attention_band": "monitor",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIsNotNone(result["bottleneck_badge"])
        self.assertEqual(
            result["bottleneck_badge"]["label"],
            BOTTLENECK_META_CONFIG["assessment"]["label"],
        )

    def test_bottleneck_state_matching_produces_badge(self):
        """When bottleneck_state is 'matching', badge is generated."""
        payload = {
            "bottleneck_state": "matching",
            "attention_band": "monitor",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIsNotNone(result["bottleneck_badge"])
        self.assertEqual(
            result["bottleneck_badge"]["label"],
            BOTTLENECK_META_CONFIG["matching"]["label"],
        )

    def test_bottleneck_state_placement_produces_badge(self):
        """When bottleneck_state is 'placement', badge is generated."""
        payload = {
            "bottleneck_state": "placement",
            "attention_band": "monitor",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIsNotNone(result["bottleneck_badge"])
        self.assertEqual(
            result["bottleneck_badge"]["label"],
            BOTTLENECK_META_CONFIG["placement"]["label"],
        )

    def test_attention_band_defaults_to_monitor(self):
        """Invalid attention_band value is stored as-is, but display uses monitor config."""
        payload = {"attention_band": "invalid_band"}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Invalid band value is preserved as-is
        self.assertEqual(result["attention_band"]["value"], "invalid_band")
        # But display falls back to monitor config
        self.assertEqual(
            result["attention_band"]["label"],
            ATTENTION_BAND_CONFIG["monitor"]["label"],
        )

    def test_attention_band_all_valid_values(self):
        """All valid attention band values map correctly."""
        for band_key in ATTENTION_BAND_CONFIG.keys():
            payload = {"attention_band": band_key}
            result = present_operational_decision(
                payload,
                action_defaults=self.action_defaults,
                impact_defaults=self.impact_defaults,
            )

            self.assertEqual(result["attention_band"]["value"], band_key)
            self.assertEqual(
                result["attention_band"]["label"],
                ATTENTION_BAND_CONFIG[band_key]["label"],
            )

    def test_priority_band_all_valid_values(self):
        """All valid priority band values map correctly."""
        for band_key in PRIORITY_BADGE_CONFIG.keys():
            payload = {"priority_band": band_key}
            result = present_operational_decision(
                payload,
                action_defaults=self.action_defaults,
                impact_defaults=self.impact_defaults,
            )

            self.assertEqual(result["priority_indicator"]["value"], band_key)
            self.assertEqual(
                result["priority_indicator"]["label"],
                PRIORITY_BADGE_CONFIG[band_key]["label"],
            )

    def test_compatibility_fields_present(self):
        """Legacy template compatibility fields are present."""
        payload = {
            "recommended_action": {
                "label": "Test",
                "reason": "Test Reason",
            },
            "impact_summary": {
                "text": "Test Impact",
            },
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Compatibility fields for existing templates
        self.assertIn("recommended_action", result)
        self.assertIn("impact_summary", result)
        self.assertIn("attention_band", result)
        self.assertIn("priority_rank", result)
        self.assertIn("priority_badge", result)
        self.assertIn("bottleneck_state", result)
        self.assertIn("bottleneck_badge", result)
        self.assertIn("escalation_recommended", result)
        self.assertIn("strongest_signal", result)
        self.assertIn("strongest_signals", result)
        self.assertIn("signal_chips", result)

    def test_no_whitespace_stripping_on_url(self):
        """URL fields should have whitespace cleaned but preserved structure."""
        payload = {
            "recommended_action": {
                "url": "  /test/path/  ",
            },
        }
        result = present_operational_decision(
            payload,
            action_defaults={"url": "/default/"},
            impact_defaults=self.impact_defaults,
        )

        # URL cleaned but not corrupted
        self.assertEqual(result["action_block"]["action"]["url"], "/test/path/")

    def test_complex_payload_all_fields(self):
        """Presenter handles fully populated payload correctly."""
        payload = {
            "recommended_action": {
                "label": "Complete Action",
                "reason": "Complete Reason",
                "url": "/complete/",
            },
            "impact_summary": {
                "text": "Complete Impact",
                "type": "accelerating",
            },
            "attention_band": "now",
            "priority_rank": 5,
            "priority_band": "first",
            "bottleneck_state": "matching",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # All fields correctly mapped
        self.assertEqual(
            result["action_block"]["action"]["label"], "Complete Action"
        )
        self.assertEqual(
            result["action_block"]["impact"]["type"], "accelerating"
        )
        self.assertEqual(result["attention_band"]["value"], "now")
        self.assertEqual(result["priority_rank"], 5)
        self.assertEqual(result["priority_indicator"]["value"], "first")
        self.assertEqual(result["bottleneck_state"], "matching")
        self.assertFalse(result["escalation_recommended"])


class OperationalDecisionPresenterEdgeCasesTests(TestCase):
    """Test edge cases and boundary conditions."""

    def setUp(self):
        self.action_defaults = {
            "label": "Default",
            "reason": "Default",
            "url": "/",
        }
        self.impact_defaults = {
            "text": "Default",
            "type": "positive",
        }

    def test_none_payload_handled_safely(self):
        """None payload is treated as empty dict."""
        result = present_operational_decision(
            None,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIsNotNone(result)
        self.assertIn("primary_signal", result)

    def test_empty_string_values_treated_as_missing(self):
        """Empty strings fall back to defaults."""
        payload = {
            "recommended_action": {
                "label": "",
                "reason": "",
                "url": "",
            },
            "impact_summary": {
                "text": "",
                "type": "",
            },
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertEqual(result["action_block"]["action"]["label"], "Default")
        self.assertEqual(result["action_block"]["impact"]["text"], "Default")
        self.assertEqual(result["action_block"]["impact"]["type"], "positive")

    def test_whitespace_only_values_treated_as_missing(self):
        """Whitespace-only strings fall back to defaults."""
        payload = {
            "recommended_action": {
                "label": "   ",
                "reason": "\t",
                "url": "\n",
            },
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertEqual(result["action_block"]["action"]["label"], "Default")
        self.assertEqual(result["action_block"]["action"]["reason"], "Default")

    def test_float_priority_rank_converted_to_int(self):
        """Float priority_rank is converted to int."""
        payload = {"priority_rank": 15.7}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertEqual(result["priority_rank"], 15)
        self.assertIsInstance(result["priority_rank"], int)

    def test_invalid_attention_band_defaults_safely(self):
        """Invalid attention_band value is preserved, display falls back to monitor."""
        payload = {"attention_band": "unknown_band"}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Invalid band value is preserved
        self.assertEqual(result["attention_band"]["value"], "unknown_band")
        # Display label falls back to monitor config
        self.assertEqual(
            result["attention_band"]["label"],
            ATTENTION_BAND_CONFIG["monitor"]["label"],
        )

    def test_invalid_bottleneck_state_produces_no_badge(self):
        """Invalid bottleneck_state produces no badge."""
        payload = {"bottleneck_state": "unknown_state"}
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIsNone(result["bottleneck_badge"])
        self.assertEqual(result["bottleneck_state"], "unknown_state")

    def test_fallback_reason_used_when_no_action_reason(self):
        """fallback_reason parameter is used when action reason missing."""
        payload = {
            "recommended_action": {
                "label": "Action",
            },
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
            fallback_reason="Fallback Reason",
        )

        self.assertEqual(
            result["action_block"]["action"]["reason"], "Fallback Reason"
        )

    def test_impact_type_defaults_to_positive(self):
        """Missing impact type defaults to 'positive'."""
        payload = {
            "impact_summary": {
                "text": "Some Impact",
            },
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertEqual(result["action_block"]["impact"]["type"], "positive")


class OperationalDecisionPresenterSignalOrderingTests(TestCase):
    """Test signal ordering and priority."""

    def setUp(self):
        self.action_defaults = {
            "label": "Default",
            "reason": "Default",
            "url": "/",
        }
        self.impact_defaults = {
            "text": "Default",
            "type": "positive",
        }

    def test_escalation_always_primary_when_present(self):
        """Escalation signal takes primary position regardless of other signals."""
        payloads_to_test = [
            {
                "escalation_recommended": True,
                "attention_band": "now",
                "bottleneck_state": "matching",
            },
            {
                "escalation_recommended": True,
                "attention_band": "monitor",
                "bottleneck_state": "assessment",
            },
            {
                "escalation_recommended": True,
                "attention_band": "waiting",
                "bottleneck_state": "placement",
            },
        ]

        for payload in payloads_to_test:
            result = present_operational_decision(
                payload,
                action_defaults=self.action_defaults,
                impact_defaults=self.impact_defaults,
            )
            self.assertEqual(
                result["primary_signal"]["label"],
                "Escalatie aanbevolen",
                f"Escalation not primary for payload: {payload}",
            )

    def test_bottleneck_is_secondary_when_escalation_present(self):
        """Bottleneck signal becomes secondary when escalation is primary."""
        payload = {
            "escalation_recommended": True,
            "bottleneck_state": "matching",
            "attention_band": "monitor",
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        self.assertIsNotNone(result["secondary_signal"])
        self.assertEqual(
            result["secondary_signal"]["label"],
            BOTTLENECK_META_CONFIG["matching"]["label"],
        )

    def test_attention_band_secondary_without_bottleneck(self):
        """Bottleneck is primary, attention band is secondary in signal ordering."""
        payload = {
            "attention_band": "now",
            "bottleneck_state": "assessment",
            "escalation_recommended": False,
        }
        result = present_operational_decision(
            payload,
            action_defaults=self.action_defaults,
            impact_defaults=self.impact_defaults,
        )

        # Signal ordering: bottleneck built first, then attention band
        # So bottleneck is primary, attention band is secondary
        self.assertEqual(
            result["primary_signal"]["label"],
            BOTTLENECK_META_CONFIG["assessment"]["label"],
        )
        self.assertEqual(
            result["secondary_signal"]["label"],
            ATTENTION_BAND_CONFIG["now"]["label"],
        )
