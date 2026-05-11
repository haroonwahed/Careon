"""Tests for NZa zorgproduct lookup (bundled JSON)."""

from unittest import TestCase

from contracts.nza_zorgproduct_lookup import lookup_nza_zorgproduct_row


class NzaZorgproductLookupTests(TestCase):
    def test_exact_code_match(self):
        row = lookup_nza_zorgproduct_row("020108050")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["zorgproductcode"], "020108050")
        self.assertIn("Maligniteit cervix", row.get("omschrijving") or "")

    def test_embedded_nine_digit_code(self):
        row = lookup_nza_zorgproduct_row("DBC 020108050 vervolg")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["zorgproductcode"], "020108050")

    def test_no_match_returns_none(self):
        self.assertIsNone(lookup_nza_zorgproduct_row("000000000"))
