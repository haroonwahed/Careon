"""Tests for JZ21 productcode lookup (bundled JSON)."""

from unittest import TestCase

from contracts.jeugdwet_jz21_lookup import lookup_jz21_product_row


class JeugdwetJz21LookupTests(TestCase):
    def test_exact_productcode_match(self):
        row = lookup_jz21_product_row("40A01")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["productcode"], "40A01")
        self.assertIn("Persoonlijke verzorging", row.get("omschrijving") or "")

    def test_embedded_productcode_prefers_longest(self):
        row = lookup_jz21_product_row("contract 43A41 en vervolg")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["productcode"], "43A41")

    def test_no_match_returns_none(self):
        self.assertIsNone(lookup_jz21_product_row("totaal willekeur zonder code"))
