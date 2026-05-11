"""Tests for iWlz codelijst lookup (bundled JSON)."""

from unittest import TestCase

from contracts.iwlz_codelijst_lookup import lookup_iwlz_codelijst_row


class IwlzCodelijstLookupTests(TestCase):
    def test_zzp_three_digit_token(self):
        row = lookup_iwlz_codelijst_row("indicatie 750 beschut wonen")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["table_id"], "COD163")
        self.assertEqual(row["id"], "750")

    def test_zorgkantoor_55xx(self):
        row = lookup_iwlz_codelijst_row("zorgkantoor 5503")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["table_id"], "COD001")
        self.assertEqual(row["id"], "5503")

    def test_leveringsvorm_exact_only(self):
        row = lookup_iwlz_codelijst_row("2")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["table_id"], "COD578")
        self.assertIn("Persoonsgebonden budget", row.get("omschrijving") or "")

    def test_short_code_not_substring_matched(self):
        """COD578 code '2' must not match inside unrelated text."""
        self.assertIsNone(lookup_iwlz_codelijst_row("PGB variant 12"))
