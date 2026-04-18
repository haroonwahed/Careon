from django.test import TestCase

from contracts.governance import build_matching_recommendation_payload


class GovernanceRecommendationPayloadTests(TestCase):
    def test_build_matching_recommendation_payload_returns_safe_empty_defaults(self):
        recommendation, context, adaptive_flags = build_matching_recommendation_payload([])

        self.assertIsNone(recommendation)
        self.assertEqual(context, {"candidate_count": 0, "top_candidates": []})
        self.assertEqual(adaptive_flags, {})

    def test_build_matching_recommendation_payload_serializes_top_candidates_and_flags(self):
        suggestions = [
            {
                "provider_id": 10,
                "provider_name": "Provider A",
                "match_score": 92.0,
                "fit_score": 90.0,
                "explanation": {
                    "confidence": "high",
                    "fit_summary": "Beste fit",
                    "behavior_consideration": "Behavior remained secondary",
                    "behavior_influence": ["Stable response pattern"],
                },
            },
            {
                "provider_id": 11,
                "provider_name": "Provider B",
                "match_score": 80.0,
                "fit_score": 79.0,
                "explanation": {
                    "confidence": "medium",
                    "fit_summary": "Fallback fit",
                    "behavior_consideration": "Behavior remained secondary",
                    "behavior_influence": [],
                },
            },
        ]

        recommendation, context, adaptive_flags = build_matching_recommendation_payload(
            suggestions,
            limit=1,
        )

        self.assertEqual(recommendation["provider_id"], 10)
        self.assertEqual(recommendation["confidence"], "high")
        self.assertEqual(context["candidate_count"], 2)
        self.assertEqual(len(context["top_candidates"]), 1)
        self.assertEqual(context["top_candidates"][0]["provider_name"], "Provider A")
        self.assertEqual(adaptive_flags["behavior_consideration"], "Behavior remained secondary")
        self.assertEqual(adaptive_flags["behavior_influence"], ["Stable response pattern"])
