"""Unit tests for gemeente-style arrangement referentietabel (deterministic matching)."""

from unittest import TestCase

from contracts.arrangement_alignment_catalog import match_catalog_row


class ArrangementAlignmentCatalogTests(TestCase):

    def test_pgb_matches_pgb_row(self):
        row = match_catalog_row("PGB ambulant jeugd")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row.row_id, "pgb")

    def test_trajectfunctie_matches(self):
        row = match_catalog_row("Trajectfunctie 40u")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row.row_id, "trajectfunctie")

    def test_gesloten_jeugdhulp_phrase(self):
        row = match_catalog_row("productcode gesloten jeugdhulp kort")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row.row_id, "gesloten_jeugd")

    def test_zin_word_boundary(self):
        row = match_catalog_row("arrangement ZIN jeugd")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row.row_id, "zin")

    def test_zorg_in_natura(self):
        row = match_catalog_row("Zorg in natura traject")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row.row_id, "zin")

    def test_unknown_returns_none(self):
        self.assertIsNone(match_catalog_row("xyz-unknown-code-999"))

    def test_ambulant_without_finance_keyword(self):
        row = match_catalog_row("alleen ambulante jeugdzorg")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row.row_id, "ambulant")
